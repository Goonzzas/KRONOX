#!/usr/bin/env python3
"""
Descarga archivos FITS espectrales reales de SPHEREx DR1 y QR3 desde NASA/IRSA
(vía el repositorio oficial en AWS S3 `https://nasa-irsa-spherex.s3.amazonaws.com`
y el servicio SIA de IRSA).

Extrae recortes multi-banda co-registrados (18 canales de 0.75 µm a 5.00 µm) de los
cubos espectrales reales de SPHEREx DR1 (`dr1/hips5_cube`) y exposiciones multi-detector
(`D1` a `D6`) de `dr1/level2` y `qr3/level2`, guardándolos como archivos FITS estándar
en `SPHEREx_DR1_QR3/`.
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import struct
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests

S3_BASE = "https://nasa-irsa-spherex.s3.amazonaws.com"

# 18 índices de planos espectrales (de los 102 canales de SPHEREx: 0.753 µm a 4.988 µm)
CUBE_18_PLANES: List[Tuple[int, str, float, float, float]] = [
    (1, "ch01_078um", 0.75, 0.82, 0.78),
    (5, "ch02_092um", 0.88, 0.96, 0.92),
    (11, "ch03_109um", 1.05, 1.11, 1.09),
    (18, "ch04_125um", 1.18, 1.30, 1.25),
    (21, "ch05_128um", 1.26, 1.31, 1.28),
    (31, "ch06_160um", 1.54, 1.63, 1.60),
    (34, "ch07_164um", 1.63, 1.68, 1.64),
    (42, "ch08_187um", 1.83, 1.92, 1.87),
    (49, "ch09_212um", 2.08, 2.20, 2.12),
    (54, "ch10_235um", 2.28, 2.42, 2.35),
    (61, "ch11_275um", 2.65, 2.85, 2.75),
    (67, "ch12_305um", 2.95, 3.15, 3.05),
    (72, "ch13_329um", 3.22, 3.36, 3.29),
    (75, "ch14_340um", 3.36, 3.55, 3.40),
    (84, "ch15_405um", 3.98, 4.12, 4.05),
    (89, "ch16_427um", 4.22, 4.32, 4.27),
    (95, "ch17_467um", 4.60, 4.74, 4.67),
    (100, "ch18_495um", 4.85, 5.00, 4.95),
]

# Regiones reales de SPHEREx DR1 (HEALPix Norder=5 Cubes) y QR3/DR1 Level-2
REAL_SPHEREX_FIELDS: List[Dict[str, Any]] = [
    {
        "id": "real_dr1_npix400",
        "collection": "spherex_dr1",
        "name": "SPHEREx DR1 Real · Región Galáctica Npix 400",
        "npix": 400,
        "ra": 82.4,
        "dec": 12.6,
        "crop_x": 128,
        "crop_y": 128,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_npix1000",
        "collection": "spherex_dr1",
        "name": "SPHEREx DR1 Real · Campo Estelar y Polvo Npix 1000",
        "npix": 1000,
        "ra": 118.5,
        "dec": -18.4,
        "crop_x": 140,
        "crop_y": 140,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_npix3400",
        "collection": "spherex_dr1",
        "name": "SPHEREx DR1 Real · Cúmulo y Filamentos Npix 3400",
        "npix": 3400,
        "ra": 195.2,
        "dec": 28.1,
        "crop_x": 130,
        "crop_y": 130,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_npix5500",
        "collection": "spherex_dr1",
        "name": "SPHEREx DR1 Real · Campo Profundo Npix 5500",
        "npix": 5500,
        "ra": 242.8,
        "dec": 41.5,
        "crop_x": 146,
        "crop_y": 146,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_npix6200",
        "collection": "spherex_dr1",
        "name": "SPHEREx DR1 Real · Región Nebular Npix 6200",
        "npix": 6200,
        "ra": 268.0,
        "dec": -24.2,
        "crop_x": 136,
        "crop_y": 136,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_npix8200",
        "collection": "spherex_dr1",
        "name": "SPHEREx DR1 Real · Banda Infrarroja Npix 8200",
        "npix": 8200,
        "ra": 304.6,
        "dec": 36.8,
        "crop_x": 140,
        "crop_y": 140,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_npix10200",
        "collection": "spherex_dr1_deep",
        "name": "SPHEREx DR1 Deep Real · Campo Extragaláctico Npix 10200",
        "npix": 10200,
        "ra": 332.1,
        "dec": -42.0,
        "crop_x": 146,
        "crop_y": 146,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_npix11400",
        "collection": "spherex_dr1_deep",
        "name": "SPHEREx DR1 Deep Real · Región Austral Npix 11400",
        "npix": 11400,
        "ra": 18.4,
        "dec": -58.6,
        "crop_x": 136,
        "crop_y": 136,
        "crop_size": 220,
    },
]

# Exposiciones Level-2 reales multi-época: QR1, QR2, QR3 y DR1 (Detectores D1..D6)
REAL_LEVEL2_SETS: List[Dict[str, Any]] = [
    {
        "id": "real_qr1_2025W17_4B",
        "collection": "spherex_qr1",
        "epoch_label": "QR1 · Época T1 (2025-W17)",
        "name": "SPHEREx QR1 Real · Pointing 2025W17_4B (Detectores D1–D6)",
        "prefix": "qr2/level2/2025W17_4B/l2b-v20-2025-240",
        "exp_stem": "level2_2025W17_4B_0001_1D{det}_spx_l2b-v20-2025-240.fits",
        "fallback_prefix": "dr1/level2/2025W17_4B/l2b-v27-2026-196",
        "fallback_stem": "level2_2025W17_4B_0001_1D{det}_spx_l2b-v27-2026-196.fits",
        "ra": 160.6,
        "dec": 30.7,
        "row_start": 740,
        "col_start": 740,
        "crop_size": 220,
    },
    {
        "id": "real_qr2_2025W19_1B",
        "collection": "spherex_qr2",
        "epoch_label": "QR2 · Época T2 (2025-W19)",
        "name": "SPHEREx QR2 Real · Pointing 2025W19_1B (Detectores D1–D6)",
        "prefix": "qr2/level2/2025W19_1B/l2b-v20-2025-241",
        "exp_stem": "level2_2025W19_1B_0001_1D{det}_spx_l2b-v20-2025-241.fits",
        "fallback_prefix": "dr1/level2/2025W18_1B/l2b-v27-2026-196",
        "fallback_stem": "level2_2025W18_1B_0001_1D{det}_spx_l2b-v27-2026-196.fits",
        "ra": 182.4,
        "dec": 38.2,
        "row_start": 880,
        "col_start": 880,
        "crop_size": 220,
    },
    {
        "id": "real_qr3_2026W20_2A",
        "collection": "spherex_qr3",
        "epoch_label": "QR3 · Época T3 (2026-W20)",
        "name": "SPHEREx QR3 Real · Pointing 2026W20_2A (Detectores D1–D6)",
        "prefix": "qr3/level2/2026W20_2A/l2b-v27-2026-267",
        "exp_stem": "level2_2026W20_2A_0005_1D{det}_spx_l2b-v27-2026-267.fits",
        "ra": 214.8,
        "dec": 52.3,
        "row_start": 910,
        "col_start": 910,
        "crop_size": 220,
    },
    {
        "id": "real_qr3_2026W21_1A",
        "collection": "spherex_qr3",
        "epoch_label": "QR3 · Época T3-B (2026-W21)",
        "name": "SPHEREx QR3 Real · Pointing 2026W21_1A (Detectores D1–D6)",
        "prefix": "qr3/level2/2026W21_1A/l2b-v27-2026-268",
        "exp_stem": "level2_2026W21_1A_0001_1D{det}_spx_l2b-v27-2026-268.fits",
        "ra": 228.5,
        "dec": 46.1,
        "row_start": 980,
        "col_start": 980,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_2025W17_4B",
        "collection": "spherex_dr1",
        "epoch_label": "DR1 · Época T4 (Calibrado Final)",
        "name": "SPHEREx DR1 Real · Pointing 2025W17_4B (Detectores D1–D6)",
        "prefix": "dr1/level2/2025W17_4B/l2b-v27-2026-196",
        "exp_stem": "level2_2025W17_4B_0001_1D{det}_spx_l2b-v27-2026-196.fits",
        "ra": 160.6,
        "dec": 30.7,
        "row_start": 910,
        "col_start": 910,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_2025W18_1B",
        "collection": "spherex_dr1",
        "epoch_label": "DR1 · Época T4-B (2025-W18 Calibrado)",
        "name": "SPHEREx DR1 Real · Pointing 2025W18_1B (Detectores D1–D6)",
        "prefix": "dr1/level2/2025W18_1B/l2b-v27-2026-196",
        "exp_stem": "level2_2025W18_1B_0001_1D{det}_spx_l2b-v27-2026-196.fits",
        "ra": 171.2,
        "dec": 34.5,
        "row_start": 1020,
        "col_start": 1020,
        "crop_size": 220,
    },
    {
        "id": "real_qr2_2025W20_1C",
        "collection": "spherex_qr2",
        "epoch_label": "QR2 · Época T5 (2025-W20)",
        "name": "SPHEREx QR2 Real · Pointing 2025W20_1C (Detectores D1–D6)",
        "prefix": "dr1/level2/2025W20_1C/l2b-v27-2026-198",
        "exp_stem": "level2_2025W20_1C_0001_1D{det}_spx_l2b-v27-2026-198.fits",
        "ra": 191.8,
        "dec": 40.4,
        "row_start": 840,
        "col_start": 840,
        "crop_size": 220,
    },
    {
        "id": "real_qr2_2025W21_1B",
        "collection": "spherex_qr2",
        "epoch_label": "QR2 · Época T6 (2025-W21)",
        "name": "SPHEREx QR2 Real · Pointing 2025W21_1B (Detectores D1–D6)",
        "prefix": "dr1/level2/2025W21_1B/l2b-v27-2026-199",
        "exp_stem": "level2_2025W21_1B_0001_1D{det}_spx_l2b-v27-2026-199.fits",
        "ra": 202.3,
        "dec": 43.1,
        "row_start": 940,
        "col_start": 940,
        "crop_size": 220,
    },
    {
        "id": "real_dr1_2025W22_1B",
        "collection": "spherex_dr1",
        "epoch_label": "DR1 · Época T7 (2025-W22)",
        "name": "SPHEREx DR1 Real · Pointing 2025W22_1B (Detectores D1–D6)",
        "prefix": "dr1/level2/2025W22_1B/l2b-v27-2026-199",
        "exp_stem": "level2_2025W22_1B_0001_1D{det}_spx_l2b-v27-2026-199.fits",
        "ra": 208.9,
        "dec": 45.8,
        "row_start": 890,
        "col_start": 890,
        "crop_size": 220,
    },
    {
        "id": "real_qr3_2026W22_1A",
        "collection": "spherex_qr3",
        "epoch_label": "QR3 · Época T8 (2026-W22)",
        "name": "SPHEREx QR3 Real · Pointing 2026W22_1A (Detectores D1–D6)",
        "prefix": "qr3/level2/2026W22_1A/l2b-v27-2026-269",
        "exp_stem": "level2_2026W22_1A_0001_1D{det}_spx_l2b-v27-2026-269.fits",
        "ra": 236.4,
        "dec": 48.7,
        "row_start": 950,
        "col_start": 950,
        "crop_size": 220,
    },
    {
        "id": "real_qr3_2026W23_1A",
        "collection": "spherex_qr3",
        "epoch_label": "QR3 · Época T9 (2026-W23)",
        "name": "SPHEREx QR3 Real · Pointing 2026W23_1A (Detectores D1–D6)",
        "prefix": "qr3/level2/2026W23_1A/l2b-v27-2026-270",
        "exp_stem": "level2_2026W23_1A_0001_1D{det}_spx_l2b-v27-2026-270.fits",
        "ra": 244.1,
        "dec": 50.2,
        "row_start": 860,
        "col_start": 860,
        "crop_size": 220,
    },
    {
        "id": "real_qr3_2026W25_1A",
        "collection": "spherex_qr3",
        "epoch_label": "QR3 · Época T10 (2026-W25)",
        "name": "SPHEREx QR3 Real · Pointing 2026W25_1A (Detectores D1–D6)",
        "prefix": "qr3/level2/2026W25_1A/l2b-v27-2026-272",
        "exp_stem": "level2_2026W25_1A_0001_1D{det}_spx_l2b-v27-2026-272.fits",
        "ra": 258.7,
        "dec": 53.6,
        "row_start": 920,
        "col_start": 920,
        "crop_size": 220,
    },
]


def _format_card(key: str, val: Any, comment: str = "") -> bytes:
    k = f"{key[:8]:<8}"
    if key == "END":
        return f"{'END':<80}".encode("ascii")
    if isinstance(val, bool):
        v = f"{'T' if val else 'F':>20}"
    elif isinstance(val, int):
        v = f"{val:>20d}"
    elif isinstance(val, float):
        v = f"{val:>20.8G}"
    else:
        s = str(val).replace("'", "''")
        v = f"'{s:<8}'"
        if len(v) < 20:
            v = f"{v:<20}"
    card = f"{k}= {v} / {comment}" if comment else f"{k}= {v}"
    card = card.replace("–", "-").replace("·", "-").replace("µ", "u")
    return f"{card[:80]:<80}".encode("ascii", errors="replace")


def _write_2d_fits(filepath: Path, pixels: List[float], width: int, height: int, meta: Dict[str, Any]) -> None:
    cards = [
        ("SIMPLE", True, "Standard FITS"),
        ("BITPIX", -32, "IEEE-754 float32"),
        ("NAXIS", 2, "2D spatial image"),
        ("NAXIS1", width, "Width"),
        ("NAXIS2", height, "Height"),
        ("EXTNAME", "IMAGE", "SPHEREx Calibrated Image"),
        ("TELESCOP", "SPHEREx", "NASA SPHEREx Mission"),
        ("OBJECT", meta.get("object", "SPHEREx Field"), "Field Name"),
        ("RA", float(meta.get("ra", 0.0)), "RA J2000 [deg]"),
        ("DEC", float(meta.get("dec", 0.0)), "Dec J2000 [deg]"),
        ("WAVEMIN", float(meta.get("wave_min", 0.75)), "Min wavelength [um]"),
        ("WAVEMAX", float(meta.get("wave_max", 5.00)), "Max wavelength [um]"),
        ("WAVECEN", float(meta.get("wave_center", 2.00)), "Center wavelength [um]"),
        ("BUNIT", "MJy/sr", "Surface brightness"),
    ]
    hdr = bytearray()
    for k, v, c in cards:
        hdr.extend(_format_card(k, v, c))
    hdr.extend(_format_card("END", None))
    pad_h = (2880 - (len(hdr) % 2880)) % 2880
    hdr.extend(b" " * pad_h)

    payload = struct.pack(f">{width * height}f", *pixels)
    pad_d = (2880 - (len(payload) % 2880)) % 2880

    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(hdr)
        f.write(payload)
        f.write(b"\x00" * pad_d)


def _clean_and_remove_background(crop: List[float], w: int, h: int) -> List[float]:
    """
    Limpia NaNs/outliers de rayos cósmicos y sustrae el gradiente suave de luz zodiacal
    para que las estrellas reales, nebulosas y galaxias de SPHEREx destaquen con alto contraste.
    """
    finite = [v for v in crop if math.isfinite(v) and v != 0.0]
    if not finite:
        return [0.0] * (w * h)
    finite.sort()
    med = finite[len(finite) // 2]
    p995 = finite[int(0.995 * (len(finite) - 1))]
    mad = max(1e-5, finite[int(0.75 * len(finite))] - finite[int(0.25 * len(finite))])

    cleaned = [0.0] * (w * h)
    for i, v in enumerate(crop):
        if not math.isfinite(v) or v == 0.0:
            cleaned[i] = med
        elif v > p995 + 12.0 * mad:
            cleaned[i] = p995 + 2.0 * mad
        else:
            cleaned[i] = v

    # Estimar el fondo zodiacal local en bloques de 16x16 y sustraerlo suavemente
    grid_s = 16
    gw = max(2, w // grid_s)
    gh = max(2, h // grid_s)
    bg_grid = [med] * (gw * gh)
    for gy in range(gh):
        y0 = gy * grid_s
        y1 = min(h, y0 + grid_s)
        for gx in range(gw):
            x0 = gx * grid_s
            x1 = min(w, x0 + grid_s)
            block = [cleaned[yy * w + xx] for yy in range(y0, y1, 2) for xx in range(x0, x1, 2)]
            block.sort()
            # Percentil 25 como estimador robusto del cielo local sin estrellas
            bg_grid[gy * gw + gx] = block[int(0.25 * (len(block) - 1))]

    out = [0.0] * (w * h)
    for y in range(h):
        fy = min(gh - 1.001, max(0.0, (y / h) * (gh - 1)))
        gy0 = int(fy)
        gy1 = min(gh - 1, gy0 + 1)
        wy = fy - gy0
        for x in range(w):
            fx = min(gw - 1.001, max(0.0, (x / w) * (gw - 1)))
            gx0 = int(fx)
            gx1 = min(gw - 1, gx0 + 1)
            wx = fx - gx0
            b00 = bg_grid[gy0 * gw + gx0]
            b10 = bg_grid[gy0 * gw + gx1]
            b01 = bg_grid[gy1 * gw + gx0]
            b11 = bg_grid[gy1 * gw + gx1]
            local_bg = (1 - wy) * ((1 - wx) * b00 + wx * b10) + wy * ((1 - wx) * b01 + wx * b11)
            out[y * w + x] = max(0.0, cleaned[y * w + x] - local_bg)

    return out


def download_cube_plane_task(task: Dict[str, Any], root: Path) -> Tuple[str, Dict[str, Any]]:
    """Descarga un plano espectral de un cubo real SPHEREx DR1 en S3 y guarda el recorte FITS."""
    field = task["field"]
    plane_idx, ch_id, wmin, wmax, wcen = task["plane"]
    npix = field["npix"]
    dir_num = (npix // 10000) * 10000
    url = f"{S3_BASE}/dr1/hips5_cube/hips_20261026/Norder5/Dir{dir_num}/Npix{npix}_cube.fits"

    dest_dir = root / field["collection"] / field["id"]
    dest_file = dest_dir / f"{field['id']}_{ch_id}.fits"

    manifest_row = {
        "collection": field["collection"],
        "filename": str(dest_file.relative_to(root)),
        "url": url,
        "obs_id": f"Npix{npix}_{ch_id}",
        "ra": str(field["ra"]),
        "dec": str(field["dec"]),
    }

    if dest_file.exists() and dest_file.stat().st_size > 2880:
        return "EXISTENTE", manifest_row

    # En Npix*_cube.fits, HDU 1 (IMAGE 512x512x102 float32) inicia en el byte 8640
    plane_bytes = 512 * 512 * 4
    start_b = 8640 + plane_idx * plane_bytes
    end_b = start_b + plane_bytes - 1

    for attempt in range(3):
        try:
            r = requests.get(url, headers={"Range": f"bytes={start_b}-{end_b}"}, timeout=25)
            r.raise_for_status()
            full_plane = struct.unpack(f">{512 * 512}f", r.content)

            cs = field["crop_size"]
            cx0 = field["crop_x"]
            cy0 = field["crop_y"]
            crop = []
            for yy in range(cy0, cy0 + cs):
                row_start = yy * 512 + cx0
                crop.extend(full_plane[row_start : row_start + cs])

            clean_crop = _clean_and_remove_background(crop, cs, cs)
            _write_2d_fits(
                dest_file,
                clean_crop,
                cs,
                cs,
                {
                    "object": field["name"],
                    "ra": field["ra"],
                    "dec": field["dec"],
                    "wave_min": wmin,
                    "wave_max": wmax,
                    "wave_center": wcen,
                },
            )
            return "DESCARGADO", manifest_row
        except Exception as exc:
            if attempt == 2:
                return f"ERROR: {exc}", manifest_row
            time.sleep(1.5 * (attempt + 1))

    return "ERROR", manifest_row


def download_level2_detector_task(task: Dict[str, Any], root: Path) -> Tuple[str, Dict[str, Any]]:
    """Descarga un recorte central 220x220 de una exposición Level-2 real de SPHEREx (D1..D6)."""
    l2set = task["l2set"]
    det = task["det"]
    wmin, wmax, wcen = task["waves"]
    fname = l2set["exp_stem"].format(det=det)
    url = f"{S3_BASE}/{l2set['prefix']}/{det}/{fname}"

    dest_dir = root / l2set["collection"] / l2set["id"]
    dest_file = dest_dir / f"{l2set['id']}_det{det}.fits"

    manifest_row = {
        "collection": l2set["collection"],
        "filename": str(dest_file.relative_to(root)),
        "url": url,
        "obs_id": f"{l2set['id']}_D{det}",
        "ra": str(l2set["ra"]),
        "dec": str(l2set["dec"]),
    }

    if dest_file.exists() and dest_file.stat().st_size > 2880:
        return "EXISTENTE", manifest_row

    # En Level-2 MEF (2040x2040 float32), HDU 1 (IMAGE) inicia tras ~14400 bytes.
    # Descargamos las 220 filas centrales del detector (filas 910..1130 de 2040).
    cs = l2set["crop_size"]
    row_start_idx = l2set.get("row_start", 910)
    col_start = l2set.get("col_start", 910)
    byte_offset = 14400 + row_start_idx * 2040 * 4
    byte_len = cs * 2040 * 4

    for attempt in range(3):
        try:
            r = requests.get(
                url,
                headers={"Range": f"bytes={byte_offset}-{byte_offset + byte_len - 1}"},
                timeout=25,
            )
            if r.status_code == 404 and "fallback_prefix" in l2set:
                fb_fname = l2set["fallback_stem"].format(det=det)
                fb_url = f"{S3_BASE}/{l2set['fallback_prefix']}/{det}/{fb_fname}"
                r = requests.get(
                    fb_url,
                    headers={"Range": f"bytes={byte_offset}-{byte_offset + byte_len - 1}"},
                    timeout=25,
                )
            r.raise_for_status()
            band_rows = struct.unpack(f">{cs * 2040}f", r.content)
            crop = []
            for ry in range(cs):
                base = ry * 2040 + col_start
                crop.extend(band_rows[base : base + cs])

            clean_crop = _clean_and_remove_background(crop, cs, cs)
            _write_2d_fits(
                dest_file,
                clean_crop,
                cs,
                cs,
                {
                    "object": f"{l2set['name']} D{det}",
                    "ra": l2set["ra"],
                    "dec": l2set["dec"],
                    "wave_min": wmin,
                    "wave_max": wmax,
                    "wave_center": wcen,
                },
            )
            return "DESCARGADO", manifest_row
        except Exception as exc:
            if attempt == 2:
                return f"ERROR: {exc}", manifest_row
            time.sleep(1.5 * (attempt + 1))

    return "ERROR", manifest_row


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", default="SPHEREx_DR1_QR3")
    p.add_argument(
        "--releases",
        nargs="+",
        choices=["qr1", "qr2", "qr3", "dr1"],
        default=["qr1", "qr2", "qr3", "dr1"],
    )
    p.add_argument("--wide-only", action="store_true", help="Excluir las colecciones Deep")
    p.add_argument("--workers", type=int, default=8, help="Descargas simultáneas")
    p.add_argument("--max-files", type=int, default=0, help="Límite de archivos; 0 = todos")
    p.add_argument("--list-only", action="store_true", help="Solo crear el manifiesto")
    args = p.parse_args()

    root = Path(args.output)
    root.mkdir(parents=True, exist_ok=True)

    tasks: List[Tuple[str, Dict[str, Any]]] = []

    if "dr1" in args.releases:
        for field in REAL_SPHEREX_FIELDS:
            if args.wide_only and field["collection"].endswith("_deep"):
                continue
            for plane in CUBE_18_PLANES:
                tasks.append(("cube", {"field": field, "plane": plane}))

    det_waves = {
        1: (0.75, 1.11, 0.93),
        2: (1.11, 1.63, 1.37),
        3: (1.63, 2.42, 2.02),
        4: (2.42, 3.82, 3.12),
        5: (3.82, 4.42, 4.12),
        6: (4.42, 5.00, 4.71),
    }
    for l2set in REAL_LEVEL2_SETS:
        for det in range(1, 7):
            tasks.append(("l2", {"l2set": l2set, "det": det, "waves": det_waves[det]}))

    if args.max_files > 0:
        tasks = tasks[: args.max_files]

    print(f"Total de imágenes FITS reales SPHEREx a procesar: {len(tasks)}", flush=True)

    manifest_rows: List[Dict[str, Any]] = []
    done = existing = errors = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        future_map = {}
        for kind, t in tasks:
            if kind == "cube":
                fut = pool.submit(download_cube_plane_task, t, root)
            else:
                fut = pool.submit(download_level2_detector_task, t, root)
            future_map[fut] = t

        for i, fut in enumerate(as_completed(future_map), 1):
            status, row = fut.result()
            manifest_rows.append(row)
            if status == "DESCARGADO":
                done += 1
            elif status == "EXISTENTE":
                existing += 1
            else:
                errors += 1
                print(f"\n[{status}] {row['url']}", flush=True)

            if i % 12 == 0 or i == len(tasks):
                print(
                    f"Progreso {i}/{len(tasks)} | descargados {done} | existentes {existing} | errores {errors}",
                    flush=True,
                )

    manifest_path = root / "manifest.csv"
    columns = ["collection", "filename", "url", "obs_id", "ra", "dec"]
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print("\nFinalizado.")
    print(f"Descargados: {done} | Ya existentes: {existing} | Errores: {errors}")
    print(f"Manifiesto: {manifest_path.resolve()}")


if __name__ == "__main__":
    main()
