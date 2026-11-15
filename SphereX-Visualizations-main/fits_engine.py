"""
SPHEREx FITS Engine: Multi-Extension FITS (MEF) Parser and High-Detail 18-Channel Spectral Generator.

Uses Domain-Warped Fractional Brownian Motion (fBm) magnetohydrodynamic-style turbulence
so that each of the 18 SPHEREx spectral channels (0.78 µm to 4.95 µm) exhibits intricate,
realistic filamentary structure, dark dust lanes, ionization rims, shock fronts, and
chromatic diffraction spikes.
"""

from __future__ import annotations

import gzip
import math
import os
import random
import struct
from typing import Any, Dict, List, Tuple

# 18 SPHEREx Spectral Channels across the 6 LVF Detectors (0.75 - 5.00 µm)
# Each channel includes its chromatic RGB weight vector for Full-Spectrum 18-Band Integration
SPHEREX_BANDS: List[Dict[str, Any]] = [
    {
        "band": 1,
        "id": "ch01_078um",
        "name": "B1-a · 0.78 µm (Continuo Óptico/NIR - Estrellas O/B)",
        "short_name": "0.78 µm · Continuo O/B",
        "detector": 1,
        "wave_min": 0.75,
        "wave_max": 0.82,
        "wave_center": 0.78,
        "resolving_power": 39,
        "line_type": "continuum_hot",
        "chroma_rgb": [0.08, 0.22, 1.00],  # Deep Sapphire Blue
        "features": "Estrellas calientes y reflexión óptica",
    },
    {
        "band": 2,
        "id": "ch02_092um",
        "name": "B1-b · 0.92 µm (Banda Z / Estrellas A-G)",
        "short_name": "0.92 µm · Banda Z Estelar",
        "detector": 1,
        "wave_min": 0.88,
        "wave_max": 0.96,
        "wave_center": 0.92,
        "resolving_power": 39,
        "line_type": "continuum",
        "chroma_rgb": [0.10, 0.45, 1.00],  # Azure Blue
        "features": "Población estelar principal",
    },
    {
        "band": 3,
        "id": "ch03_109um",
        "name": "B1-c · 1.09 µm (Emisión Paschen-γ / He I)",
        "short_name": "1.09 µm · Paschen-γ + He I",
        "detector": 1,
        "wave_min": 1.05,
        "wave_max": 1.11,
        "wave_center": 1.09,
        "resolving_power": 39,
        "line_type": "hii_inner",
        "chroma_rgb": [0.05, 0.75, 1.00],  # Electric Cyan
        "features": "Gas ionizado H II (Pa-γ 1.094 µm)",
    },
    {
        "band": 4,
        "id": "ch04_125um",
        "name": "B2-a · 1.25 µm (Continuo Banda J)",
        "short_name": "1.25 µm · Continuo Banda J",
        "detector": 2,
        "wave_min": 1.18,
        "wave_max": 1.30,
        "wave_center": 1.25,
        "resolving_power": 41,
        "line_type": "continuum",
        "chroma_rgb": [0.05, 0.88, 0.85],  # Turquoise
        "features": "Estrellas gigantes y disco galáctico",
    },
    {
        "band": 5,
        "id": "ch05_128um",
        "name": "B2-b · 1.28 µm (Línea Hidrógeno Paschen-β)",
        "short_name": "1.28 µm · Paschen-β (H II)",
        "detector": 2,
        "wave_min": 1.26,
        "wave_max": 1.31,
        "wave_center": 1.28,
        "resolving_power": 41,
        "line_type": "hii",
        "chroma_rgb": [0.10, 0.95, 0.68],  # Aquamarine
        "features": "Regiones H II intensas (Pa-β)",
    },
    {
        "band": 6,
        "id": "ch06_160um",
        "name": "B2-c · 1.60 µm (Pico Estelar H⁻ / Banda H)",
        "short_name": "1.60 µm · Pico Estelar H⁻",
        "detector": 2,
        "wave_min": 1.54,
        "wave_max": 1.63,
        "wave_center": 1.60,
        "resolving_power": 41,
        "line_type": "stellar_bump",
        "chroma_rgb": [0.22, 0.95, 0.42],  # Emerald Green
        "features": "Mínimo de opacidad H⁻ en estrellas frías y galaxias",
    },
    {
        "band": 7,
        "id": "ch07_164um",
        "name": "B3-a · 1.64 µm (Choque [Fe II] Supernovas/Jets)",
        "short_name": "1.64 µm · Choque [Fe II]",
        "detector": 3,
        "wave_min": 1.63,
        "wave_max": 1.68,
        "wave_center": 1.64,
        "resolving_power": 41,
        "line_type": "shock",
        "chroma_rgb": [0.40, 1.00, 0.25],  # Neon Lime-Emerald
        "features": "Frentes de choque de supernovas y jets ([Fe II])",
    },
    {
        "band": 8,
        "id": "ch08_187um",
        "name": "B3-b · 1.87 µm (Línea Hidrógeno Paschen-α)",
        "short_name": "1.87 µm · Paschen-α",
        "detector": 3,
        "wave_min": 1.83,
        "wave_max": 1.92,
        "wave_center": 1.87,
        "resolving_power": 41,
        "line_type": "hii",
        "chroma_rgb": [0.68, 0.96, 0.18],  # Chartreuse-Gold
        "features": "Nebulosas de emisión brillantes (Pa-α)",
    },
    {
        "band": 9,
        "id": "ch09_212um",
        "name": "B3-c · 2.12 µm (Hidrógeno Molecular H₂ + Br-γ)",
        "short_name": "2.12 µm · H₂ Molecular",
        "detector": 3,
        "wave_min": 2.08,
        "wave_max": 2.20,
        "wave_center": 2.12,
        "resolving_power": 41,
        "line_type": "h2",
        "chroma_rgb": [0.95, 0.88, 0.15],  # Warm Gold
        "features": "Gas molecular excitado en PDRs y choques",
    },
    {
        "band": 10,
        "id": "ch10_235um",
        "name": "B3-d · 2.35 µm (Continuo Banda K / Banda CO)",
        "short_name": "2.35 µm · Continuo Banda K",
        "detector": 3,
        "wave_min": 2.28,
        "wave_max": 2.42,
        "wave_center": 2.35,
        "resolving_power": 41,
        "line_type": "continuum_k",
        "chroma_rgb": [1.00, 0.76, 0.14],  # Golden Amber
        "features": "Estrellas enrojecidas a través de polvo",
    },
    {
        "band": 11,
        "id": "ch11_275um",
        "name": "B4-a · 2.75 µm (Continuo Pre-Hielo)",
        "short_name": "2.75 µm · Continuo NIR",
        "detector": 4,
        "wave_min": 2.65,
        "wave_max": 2.85,
        "wave_center": 2.75,
        "resolving_power": 35,
        "line_type": "continuum_k",
        "chroma_rgb": [1.00, 0.64, 0.12],  # Deep Amber
        "features": "Referencia de continuo antes de absorción de agua",
    },
    {
        "band": 12,
        "id": "ch12_305um",
        "name": "B4-b · 3.05 µm (Absorción de Hielo de Agua H₂O)",
        "short_name": "3.05 µm · Hielo H₂O",
        "detector": 4,
        "wave_min": 2.95,
        "wave_max": 3.15,
        "wave_center": 3.05,
        "resolving_power": 35,
        "line_type": "ice_h2o",
        "chroma_rgb": [1.00, 0.52, 0.10],  # Tangerine
        "features": "Mantos de hielo H₂O en nubes moleculares densas",
    },
    {
        "band": 13,
        "id": "ch13_329um",
        "name": "B4-c · 3.29 µm (Emisión Aromática PAH)",
        "short_name": "3.29 µm · Emisión PAH",
        "detector": 4,
        "wave_min": 3.22,
        "wave_max": 3.36,
        "wave_center": 3.29,
        "resolving_power": 35,
        "line_type": "pah",
        "chroma_rgb": [1.00, 0.42, 0.08],  # Fiery Orange-Coral
        "features": "Anillos y filamentos de hidrocarburos aromáticos (PAH)",
    },
    {
        "band": 14,
        "id": "ch14_340um",
        "name": "B4-d · 3.40 µm (Banda Alifática C-H + Polvo)",
        "short_name": "3.40 µm · Alifáticos C-H",
        "detector": 4,
        "wave_min": 3.36,
        "wave_max": 3.55,
        "wave_center": 3.40,
        "resolving_power": 35,
        "line_type": "pah_aliphatic",
        "chroma_rgb": [1.00, 0.30, 0.12],  # Vermilion Red-Orange
        "features": "Granos hidrocarbonados en regiones de fotodisociación",
    },
    {
        "band": 15,
        "id": "ch15_405um",
        "name": "B5-a · 4.05 µm (Línea Hidrógeno Brackett-α)",
        "short_name": "4.05 µm · Brackett-α",
        "detector": 5,
        "wave_min": 3.98,
        "wave_max": 4.12,
        "wave_center": 4.05,
        "resolving_power": 112,
        "line_type": "hii_deep",
        "chroma_rgb": [1.00, 0.18, 0.24],  # Scarlet Red
        "features": "Gas ionizado profundo sin extinción por polvo",
    },
    {
        "band": 16,
        "id": "ch16_427um",
        "name": "B5-b · 4.27 µm (Absorción de Hielo CO₂)",
        "short_name": "4.27 µm · Hielo CO₂",
        "detector": 5,
        "wave_min": 4.22,
        "wave_max": 4.32,
        "wave_center": 4.27,
        "resolving_power": 112,
        "line_type": "ice_co2",
        "chroma_rgb": [0.98, 0.12, 0.38],  # Crimson Ruby
        "features": "Absorción profunda de hielo de CO₂ en protoestrellas",
    },
    {
        "band": 17,
        "id": "ch17_467um",
        "name": "B6-a · 4.67 µm (Hielo/Gas de Monóxido de Carbono CO)",
        "short_name": "4.67 µm · Hielo/Gas CO",
        "detector": 6,
        "wave_min": 4.60,
        "wave_max": 4.74,
        "wave_center": 4.67,
        "resolving_power": 128,
        "line_type": "co_band",
        "chroma_rgb": [0.95, 0.10, 0.56],  # Rose-Magenta
        "features": "Transiciones ro-vibracionales de CO y polvo tibio",
    },
    {
        "band": 18,
        "id": "ch18_495um",
        "name": "B6-b · 4.95 µm (Continuo Térmico de Polvo Caliente)",
        "short_name": "4.95 µm · Polvo Caliente",
        "detector": 6,
        "wave_min": 4.85,
        "wave_max": 5.00,
        "wave_center": 4.95,
        "resolving_power": 128,
        "line_type": "warm_dust",
        "chroma_rgb": [0.92, 0.16, 0.78],  # Deep Infrared Magenta-Crimson
        "features": "Emisión térmica de polvo circunestelar y protoestrellas",
    },
]

# 12 Iconic Astronomical Targets Observed by SPHEREx
CATALOG_TARGETS: List[Dict[str, Any]] = [
    {
        "id": "orion_m42",
        "name": "1. Nebulosa de Orión (M42)",
        "ra": 83.8221,
        "dec": -5.3911,
        "description": "Cavidad H II del Trapecio, muralla de fotodisociación en PAH (3.29 µm) y filamentos turbulentos con protoestrellas.",
        "scene_type": "nebula_pah",
        "seed": 42,
    },
    {
        "id": "carina_ngc3372",
        "name": "2. Nebulosa de Carina (NGC 3372)",
        "ra": 161.2650,
        "dec": -59.8680,
        "description": "Acantilados cósmicos, frente de ionización turbulento y pilares de polvo esculpidos por estrellas OB.",
        "scene_type": "pillars_pdr",
        "seed": 137,
    },
    {
        "id": "m51_whirlpool",
        "name": "3. Galaxia del Remolino (M51)",
        "ra": 202.4696,
        "dec": 47.1952,
        "description": "Brazos espirales grand-design con carriles de polvo en PAH (3.29 µm), nudos H II rosados/dorados y núcleo azul/ámbar.",
        "scene_type": "spiral_galaxy",
        "seed": 5151,
    },
    {
        "id": "m16_pillars",
        "name": "4. Pilares de la Creación (M16 / Águila)",
        "ra": 274.7000,
        "dec": -13.8067,
        "description": "Tres columnas turbulentas de gas y polvo con bordes ionizados en cian/oro y protoestrellas rubí en las puntas.",
        "scene_type": "eagle_pillars",
        "seed": 1616,
    },
    {
        "id": "cas_a_snr",
        "name": "5. Supernova Cassiopeia A (Cas A)",
        "ra": 350.8500,
        "dec": 58.8150,
        "description": "Remanente de supernova con filamentos de choque en [Fe II] (esmeralda), jets bipolares y polvo caliente (4.95 µm).",
        "scene_type": "supernova_remnant",
        "seed": 3508,
    },
    {
        "id": "m82_starburst",
        "name": "6. Galaxia del Cigarro (M82 Starburst)",
        "ra": 148.9685,
        "dec": 69.6797,
        "description": "Disco galáctico azul-esmeralda atravesado por plumas filamentarias de superviento en PAH (3.29 µm) y H₂ (2.12 µm).",
        "scene_type": "starburst_wind",
        "seed": 8282,
    },
    {
        "id": "ngc7023_iris",
        "name": "7. Nebulosa del Iris (NGC 7023)",
        "ra": 315.4038,
        "dec": 68.1633,
        "description": "Cavidad de reflexión azul zafiro iluminada por HD 200775 rodeada de pétalos filamentarios en PAH y H₂.",
        "scene_type": "iris_reflection",
        "seed": 7023,
    },
    {
        "id": "rho_ophiuchi",
        "name": "8. Nube Molecular de Rho Ophiuchi",
        "ra": 246.7875,
        "dec": -24.5400,
        "description": "Velos filamentarios multicolor, nubes oscuras de hielo H₂O/CO₂ y cúmulo de protoestrellas jóvenes.",
        "scene_type": "dark_cloud_ices",
        "seed": 2467,
    },
    {
        "id": "sgr_a_galactic_center",
        "name": "9. Centro Galáctico (Sgr A*)",
        "ra": 266.4168,
        "dec": -29.0078,
        "description": "Mini-espiral de gas ionizado, arcos magnéticos no térmicos, anillo circun-nuclear de PAH y cúmulo estelar denso.",
        "scene_type": "galactic_center",
        "seed": 2664,
    },
    {
        "id": "nep_deep_field",
        "name": "10. Campo Profundo Polo Norte Eclíptico (NEP)",
        "ra": 269.9833,
        "dec": 66.5608,
        "description": "Campo profundo extragaláctico con galaxias espirales, elípticas e interactuantes de todos los colores espectrales.",
        "scene_type": "deep_galaxies",
        "seed": 2026,
    },
    {
        "id": "tarantula_30dor",
        "name": "11. Nebulosa de la Tarántula (30 Doradus)",
        "ra": 84.6766,
        "dec": -69.1009,
        "description": "Supercúmulo R136 rodeado de arcos gigantes de gas ionizado, burbujas de supernova y filamentos de polvo.",
        "scene_type": "tarantula_bubbles",
        "seed": 3030,
    },
    {
        "id": "helix_ngc7293",
        "name": "12. Nebulosa de la Hélice (NGC 7293)",
        "ra": 337.4108,
        "dec": -20.8372,
        "description": "Nebulosa planetaria con centro azul ionizado, miles de nudos cometarios radiales en H₂ y anillo exterior rubí.",
        "scene_type": "planetary_helix",
        "seed": 7293,
    },
]

SPHEREX_FLAG_BITS = {
    0: ("TRANSIENT", "Cosmic ray or transient event detected"),
    1: ("OVERFLOW", "Detector saturation / ADC overflow"),
    2: ("SUR_ERROR", "Sample-up-the-ramp fit residual outlier"),
    3: ("NONFUNC", "Dead, hot, or non-functional detector pixel"),
    4: ("PERSIST", "Persistence artifact from bright prior exposure"),
    5: ("OUTLIER", "Statistical outlier in multi-frame comparison"),
    6: ("SOURCE", "Known bright catalog source core"),
}


# Fast Deterministic 2D Value Noise & Domain-Warped fBm Generator for MHD Filamentary Clouds
_PERM = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,
    20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,
    230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,
    169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,
    147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,
    44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,
    104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,
    192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,
    29,24,72,243,141,128,195,78,66,215,61,156,180,
] * 2


def _noise2d(x: float, y: float, seed_offset: int = 0) -> float:
    xi = int(math.floor(x)) & 255
    yi = int(math.floor(y)) & 255
    xf = x - math.floor(x)
    yf = y - math.floor(y)
    u = xf * xf * (3.0 - 2.0 * xf)
    v = yf * yf * (3.0 - 2.0 * yf)
    s = seed_offset & 255
    aa = _PERM[_PERM[(xi + s) & 255] + yi] / 255.0
    ab = _PERM[_PERM[(xi + s) & 255] + yi + 1] / 255.0
    ba = _PERM[_PERM[(xi + 1 + s) & 255] + yi] / 255.0
    bb = _PERM[_PERM[(xi + 1 + s) & 255] + yi + 1] / 255.0
    x1 = aa + u * (ba - aa)
    x2 = ab + u * (bb - ab)
    return x1 + v * (x2 - x1)


def _fbm(x: float, y: float, seed: int, octaves: int = 4) -> float:
    val = 0.0
    amp = 0.5
    freq = 1.0
    for i in range(octaves):
        val += amp * _noise2d(x * freq, y * freq, seed + i * 31)
        freq *= 2.07
        amp *= 0.5
    return val


def _ridged_fbm(x: float, y: float, seed: int, octaves: int = 4) -> float:
    """Sharp filamentary ridge turbulence (ideal for PAH filaments, SNR shocks, and dust pillars)."""
    val = 0.0
    amp = 0.5
    freq = 1.0
    weight = 1.0
    for i in range(octaves):
        n = _noise2d(x * freq, y * freq, seed + i * 47)
        signal = 1.0 - abs(2.0 * n - 1.0)
        signal = signal * signal * weight
        weight = max(0.1, min(1.0, signal * 1.8))
        val += signal * amp
        freq *= 2.12
        amp *= 0.5
    return val


def _warped_turbulence(nx: float, ny: float, seed: int, scale: float = 3.2) -> Tuple[float, float, float]:
    """
    Compute domain-warped MHD turbulence fields:
      returns (smooth_cloud, sharp_filaments, dark_dust_lanes)
    """
    sx, sy = nx * scale, ny * scale
    qx = _fbm(sx + 1.3, sy + 2.1, seed, 3) - 0.5
    qy = _fbm(sx + 5.7, sy + 1.8, seed + 19, 3) - 0.5
    wx = sx + 1.85 * qx
    wy = sy + 1.85 * qy

    smooth = _fbm(wx, wy, seed + 53, 4)
    filaments = _ridged_fbm(wx * 1.25, wy * 1.25, seed + 97, 4)
    lanes = _ridged_fbm(wx * 0.9 + 3.1, wy * 0.9 - 2.4, seed + 149, 3)
    return smooth, filaments, lanes


def _parse_header_block(raw_bytes: bytes) -> Tuple[Dict[str, Any], Dict[str, str], bool]:
    cards: Dict[str, Any] = {}
    comments: Dict[str, str] = {}
    ended = False

    for offset in range(0, len(raw_bytes), 80):
        card = raw_bytes[offset : offset + 80].decode("ascii", errors="replace")
        key = card[:8].strip()
        if key == "END":
            ended = True
            break
        if not key or key in ("COMMENT", "HISTORY"):
            continue
        if card[8:10] != "= ":
            continue

        rest = card[10:]
        val_str = rest
        comment_str = ""
        if "'" in rest:
            first_q = rest.find("'")
            second_q = rest.find("'", first_q + 1)
            if second_q != -1:
                val_str = rest[first_q + 1 : second_q].rstrip()
                slash_idx = rest.find("/", second_q + 1)
                if slash_idx != -1:
                    comment_str = rest[slash_idx + 1 :].strip()
                cards[key] = val_str
                if comment_str:
                    comments[key] = comment_str
                continue

        if "/" in rest:
            parts = rest.split("/", 1)
            val_str = parts[0].strip()
            comment_str = parts[1].strip()
        else:
            val_str = rest.strip()

        if val_str == "T":
            val: Any = True
        elif val_str == "F":
            val = False
        else:
            try:
                if "." in val_str or "E" in val_str.upper() or "D" in val_str.upper():
                    val = float(val_str.replace("D", "E").replace("d", "e"))
                else:
                    val = int(val_str)
            except ValueError:
                val = val_str

        cards[key] = val
        if comment_str:
            comments[key] = comment_str

    return cards, comments, ended


def read_fits_bytes(data: bytes) -> List[Dict[str, Any]]:
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)

    pos = 0
    total_len = len(data)
    hdus: List[Dict[str, Any]] = []
    hdu_index = 0

    while pos + 2880 <= total_len:
        header: Dict[str, Any] = {}
        comments: Dict[str, str] = {}
        ended = False

        while pos + 2880 <= total_len and not ended:
            block = data[pos : pos + 2880]
            pos += 2880
            c, cm, ended = _parse_header_block(block)
            header.update(c)
            comments.update(cm)

        if not header and not ended:
            break

        bitpix = int(header.get("BITPIX", 8))
        naxis = int(header.get("NAXIS", 0))
        gcount = int(header.get("GCOUNT", 1))
        pcount = int(header.get("PCOUNT", 0))
        bzero = float(header.get("BZERO", 0.0))
        bscale = float(header.get("BSCALE", 1.0))

        dims = []
        for ax in range(1, naxis + 1):
            dims.append(int(header.get(f"NAXIS{ax}", 0)))

        num_elements = 0
        if naxis > 0:
            prod = 1
            for d in dims:
                prod *= d
            num_elements = gcount * (pcount + prod)

        bytes_per_elem = abs(bitpix) // 8
        data_byte_len = num_elements * bytes_per_elem
        padded_byte_len = ((data_byte_len + 2879) // 2880) * 2880

        raw_payload = data[pos : pos + data_byte_len]
        pos += padded_byte_len

        extname = str(header.get("EXTNAME", "PRIMARY" if hdu_index == 0 else f"HDU_{hdu_index}")).strip()
        xtension = str(header.get("XTENSION", "IMAGE" if hdu_index == 0 else "")).strip()

        hdu_info: Dict[str, Any] = {
            "index": hdu_index,
            "name": extname,
            "xtension": xtension,
            "header": header,
            "comments": comments,
            "bitpix": bitpix,
            "naxis": naxis,
            "dims": dims,
            "width": dims[0] if naxis >= 1 else 0,
            "height": dims[1] if naxis >= 2 else 0,
            "depth": dims[2] if naxis >= 3 else 1,
            "float_bytes": None,
            "stats": None,
        }

        if naxis >= 2 and dims[0] > 0 and dims[1] > 0 and xtension in ("IMAGE", "PRIMARY", ""):
            w, h = dims[0], dims[1]
            npix = w * h
            slice_byte_len = npix * bytes_per_elem
            if len(raw_payload) >= slice_byte_len:
                f32_bytes, stats = _convert_slice_to_float32(
                    raw_payload[:slice_byte_len], npix, bitpix, bscale, bzero
                )
                hdu_info["float_bytes"] = f32_bytes
                hdu_info["stats"] = stats

                if naxis >= 3 and dims[2] > 1:
                    n_slices = min(dims[2], 24)
                    cube_slices = []
                    for s_idx in range(n_slices):
                        start_b = s_idx * slice_byte_len
                        end_b = start_b + slice_byte_len
                        if end_b <= len(raw_payload):
                            sb, s_stats = _convert_slice_to_float32(
                                raw_payload[start_b:end_b], npix, bitpix, bscale, bzero
                            )
                            cube_slices.append({"slice": s_idx, "float_bytes": sb, "stats": s_stats})
                    hdu_info["cube_slices"] = cube_slices

        hdus.append(hdu_info)
        hdu_index += 1

    return hdus


def _convert_slice_to_float32(
    raw_slice: bytes, npix: int, bitpix: int, bscale: float, bzero: float
) -> Tuple[bytes, Dict[str, float]]:
    if bitpix == -32:
        vals = list(struct.unpack(f">{npix}f", raw_slice))
    elif bitpix == -64:
        vals = list(struct.unpack(f">{npix}d", raw_slice))
    elif bitpix == 16:
        vals = [float(x) for x in struct.unpack(f">{npix}h", raw_slice)]
    elif bitpix == 32:
        vals = [float(x) for x in struct.unpack(f">{npix}i", raw_slice)]
    elif bitpix == 8:
        vals = [float(x) for x in struct.unpack(f">{npix}B", raw_slice)]
    else:
        vals = [0.0] * npix

    if bscale != 1.0 or bzero != 0.0:
        vals = [v * bscale + bzero for v in vals]

    finite_vals = [v for v in vals if math.isfinite(v)]
    if not finite_vals:
        stats = {"min": 0.0, "max": 1.0, "p50": 0.5}
    else:
        step = max(1, len(finite_vals) // 6000)
        sampled = sorted(finite_vals[::step])
        n = len(sampled)
        stats = {
            "min": float(sampled[0]),
            "max": float(sampled[-1]),
            "p50": float(sampled[n // 2]),
        }

    f32_bytes = struct.pack(f"<{npix}f", *vals)
    return f32_bytes, stats


def synthesize_target_channel_planes(
    tgt: Dict[str, Any], width: int = 180, height: int = 180
) -> Dict[str, Dict[str, Any]]:
    """
    Synthesize all 18 SPHEREx spectral channels for a given target `tgt` with rich,
    multi-scale domain-warped filamentary structure and balanced spectral diversity
    so multi-band composites have vibrant sapphire, cyan, emerald, gold, coral, and ruby structures.
    """
    seed = tgt["seed"]
    rng = random.Random(seed)
    scene = tgt["scene_type"]

    # Generate rich stellar populations across distinct spectral classes:
    # - Hot OB blue stars (bright in 0.78 - 1.09 µm)
    # - Evolved K/M giant stars (bright in 1.25 - 2.35 µm golden H- bump)
    # - Dusty AGB / Young Stellar Objects (bright in 3.29 - 4.95 µm coral/ruby)
    stars = []
    n_stars = 120 if scene != "galactic_center" else 260
    for _ in range(n_stars):
        sx = rng.uniform(4, width - 5)
        sy = rng.uniform(4, height - 5)
        # Keep field stars within circular vignette radius for clean sphere blending
        dx_c = (sx - width * 0.5) / (width * 0.5)
        dy_c = (sy - height * 0.5) / (height * 0.5)
        if dx_c * dx_c + dy_c * dy_c > 0.85:
            continue

        amp = min(380.0, (rng.uniform(0.18, 1.0) ** (-1.9)) * 11.0)
        star_class = rng.choice(["hot_ob", "main_seq", "red_giant", "protostar"])
        stars.append((sx, sy, star_class, amp))

    # Add signature bright cluster stars & deeply embedded protostars per scene
    if scene == "nebula_pah":
        stars.append((width * 0.49, height * 0.51, "hot_ob", 580.0))
        stars.append((width * 0.52, height * 0.48, "hot_ob", 440.0))
        stars.append((width * 0.35, height * 0.65, "protostar", 520.0))
        stars.append((width * 0.67, height * 0.33, "protostar", 460.0))
        stars.append((width * 0.42, height * 0.36, "red_giant", 410.0))
    elif scene == "pillars_pdr":
        stars.append((width * 0.26, height * 0.72, "hot_ob", 560.0))
        stars.append((width * 0.54, height * 0.42, "protostar", 510.0))
        stars.append((width * 0.70, height * 0.55, "protostar", 450.0))
        stars.append((width * 0.38, height * 0.28, "red_giant", 390.0))
    elif scene == "eagle_pillars":
        stars.append((width * 0.34, height * 0.68, "protostar", 540.0))
        stars.append((width * 0.50, height * 0.58, "protostar", 490.0))
        stars.append((width * 0.66, height * 0.48, "protostar", 440.0))
        stars.append((width * 0.48, height * 0.82, "hot_ob", 520.0))
    elif scene == "iris_reflection":
        stars.append((width * 0.50, height * 0.50, "hot_ob", 720.0))
        stars.append((width * 0.36, height * 0.58, "protostar", 380.0))
        stars.append((width * 0.64, height * 0.42, "red_giant", 410.0))
    elif scene == "dark_cloud_ices":
        for px_f, py_f in [(0.42, 0.55), (0.56, 0.46), (0.48, 0.36), (0.35, 0.44), (0.63, 0.60)]:
            stars.append((width * px_f, height * py_f, "protostar", 540.0))
        stars.append((width * 0.28, height * 0.68, "hot_ob", 490.0))
    elif scene == "planetary_helix":
        stars.append((width * 0.50, height * 0.50, "hot_ob", 480.0))
    elif scene == "tarantula_bubbles":
        for _ in range(14):
            sx = width * 0.50 + rng.gauss(0, 4.5)
            sy = height * 0.50 + rng.gauss(0, 4.5)
            stars.append((sx, sy, "hot_ob", rng.uniform(160.0, 420.0)))
        for px_f, py_f in [(0.34, 0.36), (0.68, 0.62), (0.30, 0.65), (0.66, 0.34)]:
            stars.append((width * px_f, height * py_f, "protostar", 470.0))

    galaxies = []
    if scene == "deep_galaxies":
        for _ in range(75):
            gx = rng.uniform(14, width - 14)
            gy = rng.uniform(14, height - 14)
            dx_c = (gx - width * 0.5) / (width * 0.5)
            dy_c = (gy - height * 0.5) / (height * 0.5)
            if dx_c * dx_c + dy_c * dy_c > 0.78:
                continue
            g_amp = rng.uniform(35.0, 145.0)
            g_rad = rng.uniform(2.2, 6.4)
            # Galaxies at distinct redshifts glow in completely different SPHEREx bands!
            gal_type = rng.choice(["blue_spiral", "green_lirk", "gold_elliptical", "coral_pah", "ruby_highz"])
            ellip = rng.uniform(0.32, 0.95)
            ang = rng.uniform(0, math.pi)
            galaxies.append((gx, gy, g_amp, g_rad, gal_type, ellip, ang))

    cx, cy = width * 0.5, height * 0.5
    npix = width * height

    # 7 Distinct Physical Morphological Layers (each shining in a different spectral regime!)
    # 1. comp_hot_refl:   0.78 - 1.09 µm (Sapphire/Cyan reflection & hot UV-ionized inner cavities)
    # 2. comp_hii:        1.09 - 1.87 µm (Cyan/Aquamarine/Emerald H II recombination shells)
    # 3. comp_stellar:    1.25 - 2.35 µm (Turquoise/Gold stellar disks & bulges)
    # 4. comp_shock_fe:   1.64 µm        (Emerald-Lime shocked filaments & jets)
    # 5. comp_h2_mol:     2.12 µm        (Warm Gold excited molecular H₂ knots & rims)
    # 6. comp_pah_ring:   3.29 - 3.40 µm (Fiery Coral-Orange swirling PAH filaments)
    # 7. comp_warm_dust:  4.05 - 4.95 µm (Crimson-Ruby-Magenta warm dust cores & pillars)
    comp_hot_refl = [0.0] * npix
    comp_hii = [0.0] * npix
    comp_stellar = [0.0] * npix
    comp_shock_fe = [0.0] * npix
    comp_h2_mol = [0.0] * npix
    comp_pah_ring = [0.0] * npix
    comp_warm_dust = [0.0] * npix
    comp_dark_lane = [0.0] * npix

    for y in range(height):
        ny = (y - cy) / (height * 0.5)
        for x in range(width):
            nx = (x - cx) / (width * 0.5)
            idx = y * width + x
            r2 = nx * nx + ny * ny
            r = math.sqrt(r2)
            if r > 0.98:
                continue
            theta = math.atan2(ny, nx)

            # Radial soft envelope so every nebula naturally fades into Vantablack at the circular rim
            env = max(0.0, 1.0 - (r / 0.94) ** 4)
            sm, fil, lane = _warped_turbulence(nx, ny, seed, scale=3.1)

            if scene == "nebula_pah":
                # Orion M42: Sapphire/Cyan central Trapezium cavity, Emerald/Gold Huygens ionization bar,
                # Fiery Coral/Orange swirling PAH wings, and Ruby-Magenta molecular cloud ridge
                cav = math.exp(-r2 / 0.085) * (0.65 + 0.7 * sm)
                bar = math.exp(-((0.68 * nx - 0.72 * ny + 0.16 + 0.08 * sm) ** 2) / 0.0045) * math.exp(-r2 / 0.35)
                wings = math.exp(-((r - 0.38 - 0.12 * math.cos(2.0 * theta + 0.5)) ** 2) / 0.025) * (0.4 + 1.2 * fil)
                ridge = math.exp(-((0.62 * nx + 0.78 * ny - 0.18 + 0.14 * sm) ** 2) / 0.022) * (0.5 + 1.1 * fil)

                comp_hot_refl[idx] = 150.0 * cav * env
                comp_hii[idx] = (140.0 * cav + 135.0 * bar + 45.0 * wings) * env
                comp_shock_fe[idx] = (120.0 * bar + 75.0 * fil * cav) * env
                comp_h2_mol[idx] = (145.0 * bar + 125.0 * wings * fil) * env
                comp_pah_ring[idx] = (175.0 * wings + 135.0 * bar + 95.0 * ridge) * env
                comp_warm_dust[idx] = (180.0 * ridge + 115.0 * wings * lane) * env
                comp_dark_lane[idx] = min(0.88, 0.85 * lane * ridge)

            elif scene == "pillars_pdr":
                # Carina Cosmic Cliffs: Upper-left sapphire/cyan ionized ocean, golden-emerald ionization cliff face,
                # and fiery orange/ruby mountain peaks & dust pillars below
                cliff_y = -0.18 * nx + 0.12 * math.sin(4.5 * nx) + 0.16 * (sm - 0.5)
                dist_cliff = ny - cliff_y
                sky_ocean = (1.0 / (1.0 + math.exp(-dist_cliff * 14.0))) * (0.55 + 0.65 * sm)
                cliff_rim = math.exp(-(dist_cliff * dist_cliff) / 0.006) * (0.6 + 1.1 * fil)
                mountain_body = (1.0 / (1.0 + math.exp(dist_cliff * 12.0))) * (0.4 + 1.25 * fil)
                deep_peaks = mountain_body * lane

                comp_hot_refl[idx] = 155.0 * sky_ocean * env
                comp_hii[idx] = (125.0 * sky_ocean + 165.0 * cliff_rim) * env
                comp_shock_fe[idx] = 140.0 * cliff_rim * fil * env
                comp_h2_mol[idx] = (165.0 * cliff_rim + 95.0 * mountain_body * fil) * env
                comp_pah_ring[idx] = (175.0 * cliff_rim + 155.0 * mountain_body) * env
                comp_warm_dust[idx] = (185.0 * deep_peaks + 120.0 * mountain_body * sm) * env

            elif scene == "spiral_galaxy":
                # M51 Whirlpool: Golden-emerald core, sapphire-cyan star-forming spiral arms,
                # fiery coral-orange PAH dust lanes, and ruby H II knots
                bulge = math.exp(-r2 / 0.022)
                disk = math.exp(-r / 0.42)
                arm_phase = 2.0 * theta - 4.5 * math.log(max(0.05, r))
                arm1 = (0.5 + 0.5 * math.cos(arm_phase)) ** 3.2 * math.exp(-((r - 0.36) ** 2) / 0.15)
                dust_spur = (0.5 + 0.5 * math.cos(arm_phase + 0.55)) ** 4.0 * math.exp(-((r - 0.34) ** 2) / 0.14)
                knots = (0.5 + 0.5 * math.sin(8.0 * theta + 10.0 * r)) ** 4.0 * arm1
                r2_comp = (nx - 0.46) ** 2 + (ny - 0.44) ** 2
                companion = math.exp(-r2_comp / 0.016)

                comp_hot_refl[idx] = (165.0 * arm1 * (0.6 + 0.6 * fil) + 95.0 * companion) * env
                comp_stellar[idx] = (185.0 * bulge + 95.0 * disk + 160.0 * companion) * env
                comp_hii[idx] = (175.0 * knots + 85.0 * arm1) * env
                comp_h2_mol[idx] = (145.0 * dust_spur * fil + 90.0 * bulge) * env
                comp_pah_ring[idx] = (185.0 * dust_spur * (0.5 + 0.9 * fil) + 140.0 * knots) * env
                comp_warm_dust[idx] = (190.0 * knots + 135.0 * dust_spur * lane + 85.0 * bulge) * env

            elif scene == "eagle_pillars":
                # M16 Pillars of Creation: Turquoise/cyan ambient UV halo, golden ionized pillar rims,
                # coral-orange turbulent pillar trunks, and ruby-magenta dense cores
                def pillar_col(px0, py_top, w_col):
                    dx_p = (nx - px0) + 0.20 * (ny - py_top) + 0.045 * (sm - 0.5)
                    in_len = 1.0 if ny <= py_top else math.exp(-((ny - py_top) ** 2) / 0.007)
                    trunk = math.exp(-(dx_p * dx_p) / w_col) * in_len
                    rim = math.exp(-((abs(dx_p) - math.sqrt(w_col) * 0.85) ** 2) / (w_col * 0.25)) * in_len
                    return trunk, rim

                t1, r1 = pillar_col(-0.30, 0.36, 0.011)
                t2, r2_p = pillar_col(0.02, 0.20, 0.008)
                t3, r3 = pillar_col(0.32, 0.04, 0.007)
                trunks = (t1 + t2 + t3) * (0.45 + 1.1 * fil)
                rims = (r1 + r2_p + r3) * (0.6 + 0.8 * sm)
                uv_halo = math.exp(-((ny - 0.35) ** 2) / 0.28) * (1.0 - min(0.9, trunks))

                comp_hot_refl[idx] = 140.0 * uv_halo * env
                comp_hii[idx] = (175.0 * rims + 75.0 * uv_halo) * env
                comp_h2_mol[idx] = 170.0 * rims * fil * env
                comp_pah_ring[idx] = (180.0 * trunks + 130.0 * rims) * env
                comp_warm_dust[idx] = 195.0 * trunks * lane * env

            elif scene == "supernova_remnant":
                # Cas A: Sapphire synchrotron outer rim, emerald-lime [Fe II] shocked ejecta ring,
                # golden argon/neon knots, and fiery coral/ruby freshly synthesized warm dust
                shell_r = 0.44 + 0.05 * (sm - 0.5)
                outer_blast = math.exp(-((r - shell_r - 0.08) ** 2) / 0.003)
                fe_ring = math.exp(-((r - shell_r) ** 2) / 0.009) * (0.3 + 1.4 * fil)
                inner_dust = math.exp(-((r - 0.28) ** 2) / 0.022) * (0.3 + 1.3 * lane)
                jet = math.exp(-((ny - 0.42 * nx) ** 2) / 0.004) * (1.0 if nx > 0.1 else 0.0) * fil

                comp_hot_refl[idx] = (165.0 * outer_blast + 125.0 * jet) * env
                comp_shock_fe[idx] = (195.0 * fe_ring + 160.0 * jet) * env
                comp_hii[idx] = 145.0 * fe_ring * sm * env
                comp_h2_mol[idx] = 155.0 * fe_ring * lane * env
                comp_pah_ring[idx] = 165.0 * inner_dust * fil * env
                comp_warm_dust[idx] = (195.0 * inner_dust + 115.0 * fe_ring) * env

            elif scene == "starburst_wind":
                # M82 Cigar Galaxy: Sapphire/emerald edge-on stellar disk + spectacular biconical
                # golden/coral/ruby superwind plumes erupting perpendicular to the disk!
                rx = nx * 0.92 + ny * 0.38
                ry = -nx * 0.38 + ny * 0.92
                disk = math.exp(-(rx * rx) / 0.24) * math.exp(-(ry * ry) / 0.009)
                cone_w = 0.015 + 0.38 * (ry * ry)
                wind = math.exp(-(rx * rx) / cone_w) * (1.0 - math.exp(-(ry * ry) / 0.008)) * math.exp(-(ry * ry) / 0.48)
                plumes = wind * (0.35 + 1.35 * fil)

                comp_hot_refl[idx] = 165.0 * disk * (1.0 - 0.5 * lane) * env
                comp_stellar[idx] = 185.0 * disk * env
                comp_hii[idx] = (130.0 * disk + 145.0 * plumes * sm) * env
                comp_shock_fe[idx] = 165.0 * plumes * lane * env
                comp_h2_mol[idx] = 175.0 * plumes * env
                comp_pah_ring[idx] = 195.0 * plumes * env
                comp_warm_dust[idx] = (190.0 * plumes * lane + 140.0 * math.exp(-r2 / 0.018)) * env

            elif scene == "iris_reflection":
                # NGC 7023 Iris Nebula: Vivid sapphire central reflection petals surrounded by
                # golden H₂ filaments and coral-ruby PAH outer rings
                central_refl = math.exp(-r2 / 0.055) * (0.6 + 0.7 * sm)
                petals = math.exp(-((r - 0.34 - 0.09 * math.cos(2.0 * theta)) ** 2) / 0.014) * (0.4 + 1.2 * fil)
                outer_veil = math.exp(-((r - 0.50) ** 2) / 0.028) * (0.4 + 1.1 * lane)

                comp_hot_refl[idx] = 195.0 * central_refl * env
                comp_hii[idx] = 135.0 * central_refl * fil * env
                comp_h2_mol[idx] = 175.0 * petals * env
                comp_pah_ring[idx] = (185.0 * petals + 135.0 * outer_veil) * env
                comp_warm_dust[idx] = 180.0 * outer_veil * env

            elif scene == "dark_cloud_ices":
                # Rho Ophiuchi: Multi-colored reflection sheets (blue, cyan, gold, coral, ruby)
                sheet_blue = math.exp(-((nx + 0.28) ** 2 + (ny - 0.25) ** 2) / 0.14) * (0.5 + 0.8 * sm)
                sheet_gold = math.exp(-((nx - 0.22) ** 2 + (ny - 0.18) ** 2) / 0.16) * (0.4 + 1.1 * fil)
                core_ruby = math.exp(-((nx - 0.05) ** 2 + (ny + 0.22) ** 2) / 0.15) * (0.4 + 1.2 * lane)

                comp_hot_refl[idx] = 185.0 * sheet_blue * env
                comp_hii[idx] = 150.0 * (sheet_blue * fil + 0.4 * sheet_gold) * env
                comp_h2_mol[idx] = 180.0 * sheet_gold * env
                comp_pah_ring[idx] = (185.0 * sheet_gold * fil + 150.0 * core_ruby) * env
                comp_warm_dust[idx] = 195.0 * core_ruby * env

            elif scene == "galactic_center":
                # Sgr A*: Turquoise/gold ionized mini-spiral, sapphire/emerald non-thermal radio/IR arcs,
                # and fiery coral/ruby circumnuclear molecular torus
                arm1 = math.exp(-((nx - 0.26 * math.sin(3.2 * ny)) ** 2) / 0.011) * math.exp(-r2 / 0.24)
                arm2 = math.exp(-((ny + 0.26 * math.cos(3.2 * nx)) ** 2) / 0.012) * math.exp(-r2 / 0.24)
                arches = math.exp(-((nx - 0.32) ** 2) / 0.008) * (0.5 + 0.5 * math.sin(18.0 * nx)) * math.exp(-(ny * ny) / 0.3)
                torus = math.exp(-((r - 0.44) ** 2) / 0.022) * (0.4 + 1.2 * fil)

                comp_hot_refl[idx] = 165.0 * arches * env
                comp_hii[idx] = 185.0 * (arm1 + arm2) * env
                comp_stellar[idx] = 155.0 * math.exp(-r2 / 0.08) * env
                comp_h2_mol[idx] = (175.0 * torus + 110.0 * arm1) * env
                comp_pah_ring[idx] = (190.0 * torus + 135.0 * arm2 * fil) * env
                comp_warm_dust[idx] = (195.0 * (arm1 + arm2) * lane + 165.0 * torus) * env

            elif scene == "tarantula_bubbles":
                # 30 Doradus: Central sapphire/cyan R136 cavity surrounded by interlocking golden/coral/ruby superbubbles
                b1 = math.exp(-((math.sqrt((nx - 0.22) ** 2 + (ny - 0.18) ** 2) - 0.28) ** 2) / 0.009)
                b2 = math.exp(-((math.sqrt((nx + 0.25) ** 2 + (ny + 0.14) ** 2) - 0.32) ** 2) / 0.011)
                b3 = math.exp(-((math.sqrt((nx - 0.05) ** 2 + (ny + 0.26) ** 2) - 0.24) ** 2) / 0.009)
                shells = (b1 + b2 + b3) * (0.45 + 1.15 * fil)
                core_c = math.exp(-r2 / 0.065) * (0.6 + 0.6 * sm)

                comp_hot_refl[idx] = 185.0 * core_c * env
                comp_hii[idx] = (165.0 * core_c + 150.0 * b1 * sm) * env
                comp_shock_fe[idx] = 165.0 * b2 * fil * env
                comp_h2_mol[idx] = 175.0 * shells * env
                comp_pah_ring[idx] = 190.0 * shells * env
                comp_warm_dust[idx] = 195.0 * (b2 + b3) * lane * env

            elif scene == "planetary_helix":
                # Helix Nebula: Deep sapphire/cyan central O III / He II core, golden cometary knot ring,
                # and fiery coral/ruby outer molecular envelope
                re = math.sqrt((nx * 0.88 + ny * 0.22) ** 2 + ((ny * 0.88 - nx * 0.22) * 1.24) ** 2)
                inner_core = math.exp(-(re * re) / 0.045)
                mid_knots = math.exp(-((re - 0.30) ** 2) / 0.009) * (0.45 + 0.55 * math.cos(22.0 * theta + 4.0 * sm))
                outer_ring = math.exp(-((re - 0.44) ** 2) / 0.015) * (0.45 + 1.1 * fil)
                outer_halo = math.exp(-((re - 0.55) ** 2) / 0.018) * (0.4 + 1.1 * lane)

                comp_hot_refl[idx] = 190.0 * inner_core * env
                comp_hii[idx] = (150.0 * inner_core + 165.0 * mid_knots) * env
                comp_h2_mol[idx] = (185.0 * mid_knots + 145.0 * outer_ring) * env
                comp_pah_ring[idx] = 190.0 * outer_ring * env
                comp_warm_dust[idx] = (195.0 * outer_halo + 135.0 * outer_ring) * env

    planes_out: Dict[str, Dict[str, Any]] = {}

    for ch in SPHEREX_BANDS:
        cid = ch["id"]
        lam = ch["wave_center"]
        ltype = ch["line_type"]

        # Balanced spectral weights so every band has distinct, vivid morphology!
        w_hot = math.exp(-((lam - 0.85) ** 2) / 0.18)
        w_hii = (
            1.45
            if ltype in ("hii", "hii_inner", "hii_deep")
            else math.exp(-((lam - 1.45) ** 2) / 0.35) * 0.65
        )
        w_stel = math.exp(-((lam - 1.65) ** 2) / 0.45)
        w_shk = 1.85 if ltype == "shock" else math.exp(-((lam - 1.75) ** 2) / 0.25) * 0.55
        w_h2 = 1.75 if ltype == "h2" else math.exp(-((lam - 2.25) ** 2) / 0.38) * 0.75
        w_pah = (
            1.90
            if ltype in ("pah", "pah_aliphatic")
            else math.exp(-((lam - 3.35) ** 2) / 0.42) * 0.85
        )
        w_dust = (
            1.95
            if ltype in ("warm_dust", "co_band")
            else math.exp(-((lam - 4.75) ** 2) / 0.65) * 0.90
        )

        arr = [0.0] * npix
        for i in range(npix):
            atten = 1.0 - comp_dark_lane[i] * math.exp(-lam / 1.8)
            arr[i] = (
                w_hot * comp_hot_refl[i] * atten
                + w_hii * comp_hii[i] * atten
                + w_stel * comp_stellar[i] * atten
                + w_shk * comp_shock_fe[i]
                + w_h2 * comp_h2_mol[i]
                + w_pah * comp_pah_ring[i]
                + w_dust * comp_warm_dust[i]
            )

        # Add diverse galaxy populations for NEP Deep Field
        if scene == "deep_galaxies":
            for gx, gy, g_amp, g_rad, gal_type, ellip, ang in galaxies:
                if gal_type == "blue_spiral":
                    sed_f = math.exp(-((lam - 0.95) ** 2) / 0.35) + 0.45 * w_pah
                elif gal_type == "green_lirk":
                    sed_f = math.exp(-((lam - 1.55) ** 2) / 0.35)
                elif gal_type == "gold_elliptical":
                    sed_f = math.exp(-((lam - 2.20) ** 2) / 0.45)
                elif gal_type == "coral_pah":
                    sed_f = math.exp(-((lam - 3.30) ** 2) / 0.38)
                else:
                    sed_f = math.exp(-((lam - 4.65) ** 2) / 0.55)

                flux_scale = g_amp * sed_f
                if flux_scale < 1.0:
                    continue
                box = int(math.ceil(g_rad * 3.0))
                x0, x1 = max(0, int(gx) - box), min(width - 1, int(gx) + box)
                y0, y1 = max(0, int(gy) - box), min(height - 1, int(gy) + box)
                cos_a, sin_a = math.cos(ang), math.sin(ang)
                for py in range(y0, y1 + 1):
                    dy = py - gy
                    for px in range(x0, x1 + 1):
                        dx = px - gx
                        rx = dx * cos_a + dy * sin_a
                        ry = (-dx * sin_a + dy * cos_a) / ellip
                        r2_g = (rx * rx + ry * ry) / (g_rad * g_rad)
                        if r2_g < 9.0:
                            arr[py * width + px] += flux_scale * math.exp(-r2_g)

        # Add multi-colored stars with wavelength-dependent diffraction spikes
        psf_sigma = 0.88 + 0.05 * (ch["detector"] - 1)
        for sx, sy, star_class, amp in stars:
            if star_class == "hot_ob":
                sed_w = math.exp(-((lam - 0.85) ** 2) / 0.55) + 0.15
            elif star_class == "main_seq":
                sed_w = math.exp(-((lam - 1.35) ** 2) / 0.75) + 0.20
            elif star_class == "red_giant":
                sed_w = math.exp(-((lam - 2.25) ** 2) / 0.95) + 0.25
            else:  # protostar
                sed_w = math.exp(-((lam - 4.55) ** 2) / 1.10)

            peak = amp * sed_w
            if peak < 2.0:
                continue

            box = 7 if peak > 140.0 else 3
            x0, x1 = max(0, int(sx) - box), min(width - 1, int(sx) + box)
            y0, y1 = max(0, int(sy) - box), min(height - 1, int(sy) + box)
            for py in range(y0, y1 + 1):
                dy = py - sy
                for px in range(x0, x1 + 1):
                    dx = px - sx
                    r2_s = (dx * dx + dy * dy) / (2.0 * psf_sigma * psf_sigma)
                    psf_v = math.exp(-r2_s)
                    if peak > 140.0:
                        psf_v += 0.045 * math.exp(-abs(dx) / 0.42) * math.exp(-(dy * dy) / 14.0)
                        psf_v += 0.045 * math.exp(-abs(dy) / 0.42) * math.exp(-(dx * dx) / 14.0)
                    arr[py * width + px] += peak * psf_v

        f32_bytes = struct.pack(f"<{npix}f", *arr)
        planes_out[cid] = {
            "IMAGE": {
                "meta": {
                    "dataset_id": tgt["id"],
                    "channel_id": cid,
                    "ext_name": "IMAGE",
                    "width": width,
                    "height": height,
                    "wave_min": ch["wave_min"],
                    "wave_max": ch["wave_max"],
                    "wave_center": ch["wave_center"],
                    "short_name": ch["short_name"],
                    "name": ch["name"],
                    "chroma_rgb": ch["chroma_rgb"],
                    "features": ch["features"],
                },
                "float_bytes": f32_bytes,
            }
        }

    return planes_out
