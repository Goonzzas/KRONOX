"""
SPHEREx Color Composite Visualizer & Live IRSA Explorer Backend Server.

Automatically loads:
1. All real downloaded SPHEREx DR1 & QR3 FITS suites in `SPHEREx_DR1_QR3/` (156 real FITS files)
2. 12 High-resolution 18-band SPHEREx astrophysical suites (216 spectral planes)
Total: 22 regions on the 360° celestial sphere (372 spectral images).

Run with:
    python3 server.py [--port 8765]
"""

from __future__ import annotations

import argparse
import base64
import glob
import hashlib
import json
import math
import mimetypes
import os
import ssl
import struct
import tempfile
import traceback
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional, Tuple

import certifi

from descargar_spherex_dr1_qr3 import REAL_LEVEL2_SETS, REAL_SPHEREX_FIELDS
from fits_engine import (
    SPHEREX_BANDS,
    SPHEREX_FLAG_BITS,
    read_fits_bytes,
)
from irsa_client import (
    NOTABLE_TARGETS,
    download_irsa_fits,
    query_irsa_spherex,
    resolve_target_name,
)
import spherex_api_real

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KRONOX_ROOT = os.path.dirname(BASE_DIR)
HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where())
REAL_DOWNLOAD_ROOT = os.path.join(BASE_DIR, "SPHEREx_DR1_QR3")
REAL_API_ROOT = os.path.join(BASE_DIR, "SPHEREx_REAL")
RUNTIME_API_ROOT = getattr(
    spherex_api_real,
    "RUNTIME_OUT_ROOT",
    os.path.join(tempfile.gettempdir(), "kronox-spherex-real"),
)
DATA_DIR = (
    os.path.join(tempfile.gettempdir(), "kronox-spherex-data")
    if os.environ.get("VERCEL") == "1"
    else os.path.join(BASE_DIR, "data")
)
DOWNLOAD_DIR = os.path.join(DATA_DIR, "downloads")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "static")


class DatasetStore:
    """Registry of 100% REAL SPHEREx FITS suites (IRSA API SIA+IBE & DR1/QR3)."""

    def __init__(self) -> None:
        self.datasets: Dict[str, Dict[str, Any]] = {}
        self._initialized: bool = False

    def ensure_initialized(self) -> None:
        if not self._initialized:
            self.initialize()

    def initialize(self) -> None:
        self._initialized = True
        for d in (DATA_DIR, DOWNLOAD_DIR, UPLOAD_DIR):
            try:
                os.makedirs(d, exist_ok=True)
            except OSError:
                pass

        self.refresh_real_api_targets()

        # Load real downloaded SPHEREx DR1 18-channel cube cutouts from SPHEREx_DR1_QR3/
        for field in REAL_SPHEREX_FIELDS:
            folder = os.path.join(REAL_DOWNLOAD_ROOT, field["collection"], field["id"])
            if os.path.isdir(folder):
                fits_files = sorted(glob.glob(os.path.join(folder, "*.fits")))
                if fits_files:
                    self._register_real_dr1_cube_suite(field, fits_files)

        # Load real downloaded SPHEREx QR1/QR2/QR3 & DR1 Level-2 6-detector sets from SPHEREx_DR1_QR3/
        for l2set in REAL_LEVEL2_SETS:
            folder = os.path.join(REAL_DOWNLOAD_ROOT, l2set["collection"], l2set["id"])
            if os.path.isdir(folder):
                fits_files = sorted(glob.glob(os.path.join(folder, "*.fits")))
                if fits_files:
                    self._register_real_level2_suite(l2set, fits_files)

        # Also register real SPHEREx FITS cutouts bundled in KRONOX/public/demo/ (always present on Vercel)
        self._register_kronox_public_demo_suites()

    def _register_kronox_public_demo_suites(self) -> None:
        demo_root = os.path.join(KRONOX_ROOT, "public", "demo")
        if not os.path.isdir(demo_root):
            return
        demo_targets = [
            {
                "id": "kronox_real_m101",
                "folder": "m101",
                "name": "Galaxia del Molinete (M101 · NGC 5457)",
                "collection": "spherex_dr1",
                "ra": 210.8024,
                "dec": 54.3488,
            },
            {
                "id": "kronox_real_rw_aurigae",
                "folder": "rw-aurigae",
                "name": "RW Aurigae (Estrella T Tauri Variable)",
                "collection": "spherex_dr1",
                "ra": 76.9565,
                "dec": 30.4014,
            },
            {
                "id": "kronox_real_barnard",
                "folder": "barnard",
                "name": "Estrella de Barnard (Alto Movimiento Propio)",
                "collection": "spherex_dr1",
                "ra": 269.4521,
                "dec": 4.6934,
            },
            {
                "id": "kronox_real_m31",
                "folder": "m31",
                "name": "Galaxia de Andrómeda (M31 · NGC 224)",
                "collection": "spherex_dr1",
                "ra": 10.6847,
                "dec": 41.2687,
            },
        ]
        for dt in demo_targets:
            if dt["id"] in self.datasets:
                continue
            folder = os.path.join(demo_root, dt["folder"])
            if not os.path.isdir(folder):
                continue
            fits_files = sorted(glob.glob(os.path.join(folder, "D*.fits")))
            if fits_files:
                self._register_real_level2_suite(dt, fits_files)

    def refresh_real_api_targets(self) -> int:
        added = 0
        for root_dir in (REAL_API_ROOT, RUNTIME_API_ROOT):
            targets_dir = os.path.join(root_dir, "targets")
            if not os.path.isdir(targets_dir):
                continue
            for tid in sorted(os.listdir(targets_dir)):
                meta_path = os.path.join(targets_dir, tid, "meta.json")
                if not os.path.isfile(meta_path):
                    continue
                ds_id = f"spx_{tid}"
                if ds_id in self.datasets and self.datasets[ds_id]["type"] == "real_spherex_multiepoch":
                    continue
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    self._register_real_api_target(ds_id, os.path.join(targets_dir, tid), meta)
                    added += 1
                except Exception as exc:
                    print(f"Error loading real target {tid}: {exc}")

        cat_path = os.path.join(REAL_API_ROOT, "catalog_coords.json")
        if os.path.isfile(cat_path):
            try:
                with open(cat_path, "r", encoding="utf-8") as f:
                    catalog = json.load(f)
                for item in catalog:
                    ds_id = f"spx_{item['id']}"
                    if ds_id in self.datasets:
                        continue
                    self.datasets[ds_id] = {
                        "id": ds_id,
                        "query": item["query"],
                        "name": item["name"],
                        "simbad_name": item.get("simbad_name", item["name"]),
                        "type": "real_spherex_ondemand",
                        "category": item.get("category", "galaxy"),
                        "ra": float(item["ra"]),
                        "dec": float(item["dec"]),
                        "width": 128,
                        "height": 128,
                        "size_deg": float(item.get("size_deg", 0.25)),
                        "description": f"Objeto real SIMBAD/NED ({item['ra']:.3f}°, {item['dec']:+.3f}°). Pasa el ratón o haz clic para descargar en vivo desde la API de NASA/IPAC IRSA SPHEREx.",
                        "source": "NASA/IPAC IRSA SPHEREx (En vivo bajo demanda)",
                    }
                    added += 1
            except Exception as exc:
                print(f"Error loading catalog_coords.json: {exc}")
        return added

    def _register_real_api_target(self, ds_id: str, target_dir: str, meta: Dict[str, Any]) -> None:
        exps = meta.get("exposures", [])
        n_exp = len(exps)
        n_seas = len(meta.get("seasons", []))
        n_dr1 = sum(1 for e in exps if e.get("collection") == "spherex_dr1")
        n_qr3 = sum(1 for e in exps if e.get("collection") == "spherex_qr3")
        dates = sorted(str(e.get("date_obs", ""))[:10] for e in exps if e.get("date_obs"))
        self.datasets[ds_id] = {
            "id": ds_id,
            "name": meta["name"],
            "simbad_name": meta.get("simbad_name", meta["name"]),
            "type": "real_spherex_multiepoch",
            "category": meta.get("category", "galaxy"),
            "ra": float(meta["ra"]),
            "dec": float(meta["dec"]),
            "width": int(meta.get("grid_n", 128)),
            "height": int(meta.get("grid_n", 128)),
            "size_deg": float(meta.get("size_deg", 0.25)),
            "pix_scale_arcsec": float(meta.get("pix_scale_arcsec", 6.2)),
            "n_exposures_irsa": int(meta.get("n_exposures_irsa", n_exp)),
            "n_dr1": n_dr1,
            "n_qr3": n_qr3,
            "date_min": dates[0] if dates else "",
            "date_max": dates[-1] if dates else "",
            "seasons": meta.get("seasons", []),
            "exposures": exps,
            "target_dir": target_dir,
            "description": (
                f"Datos 100 % reales NASA/IPAC IRSA SPHEREx ({n_exp} recortes Level-2: "
                f"DR1={n_dr1}, QR3={n_qr3} en {n_seas} épocas; "
                f"{meta.get('n_exposures_irsa', n_exp)} exposiciones totales en IRSA)."
            ),
            "source": meta.get("source", "NASA/IPAC IRSA SPHEREx Level-2 (SIA v2 + IBE cutouts)"),
        }

    def _register_real_dr1_cube_suite(
        self, field: Dict[str, Any], fits_files: List[str]
    ) -> None:
        encoded_planes: Dict[str, Dict[str, Any]] = {}
        width, height = field.get("crop_size", 220), field.get("crop_size", 220)

        for fpath in fits_files:
            with open(fpath, "rb") as f:
                hdus = read_fits_bytes(f.read())
            if not hdus or hdus[0]["float_bytes"] is None:
                continue
            hdu = hdus[0]
            width, height = hdu["width"], hdu["height"]

            # Match channel ID from filename (e.g. ch01_078um)
            fname = os.path.basename(fpath)
            matched_band = None
            for b in SPHEREX_BANDS:
                if b["id"] in fname:
                    matched_band = b
                    break

            cid = matched_band["id"] if matched_band else os.path.splitext(fname)[0]
            encoded_planes[cid] = {
                "IMAGE": {
                    "meta": {
                        "dataset_id": field["id"],
                        "channel_id": cid,
                        "ext_name": "IMAGE",
                        "width": width,
                        "height": height,
                        "wave_min": matched_band["wave_min"] if matched_band else 0.75,
                        "wave_max": matched_band["wave_max"] if matched_band else 5.00,
                        "wave_center": matched_band["wave_center"] if matched_band else 2.00,
                        "short_name": matched_band["short_name"] if matched_band else fname,
                        "name": matched_band["name"] if matched_band else fname,
                        "chroma_rgb": matched_band["chroma_rgb"] if matched_band else [1.0, 1.0, 1.0],
                    },
                    "float32_b64": base64.b64encode(hdu["float_bytes"]).decode("ascii"),
                }
            }

        self.datasets[field["id"]] = {
            "id": field["id"],
            "name": f"🛰️ {field['name']}",
            "type": "real_spherex_fits",
            "ra": field["ra"],
            "dec": field["dec"],
            "width": width,
            "height": height,
            "description": f"Datos FITS reales descargados de NASA/IRSA ({field['collection']}, 18 canales de 0.78 a 4.95 µm).",
            "source": f"NASA/IRSA {field['collection']}",
            "encoded_planes": encoded_planes,
        }

    def _register_real_level2_suite(
        self, l2set: Dict[str, Any], fits_files: List[str]
    ) -> None:
        encoded_planes: Dict[str, Dict[str, Any]] = {}
        width, height = l2set.get("crop_size", 220), l2set.get("crop_size", 220)
        det_chromas = {
            1: ([0.10, 0.38, 1.00], "D1 · 0.75–1.11 µm (Banda 1)"),
            2: ([0.08, 0.88, 0.75], "D2 · 1.11–1.63 µm (Banda 2)"),
            3: ([0.65, 0.95, 0.20], "D3 · 1.63–2.42 µm (Banda 3)"),
            4: ([1.00, 0.65, 0.12], "D4 · 2.42–3.82 µm (Banda 4 PAH)"),
            5: ([1.00, 0.28, 0.22], "D5 · 3.82–4.42 µm (Banda 5 Hielos)"),
            6: ([0.95, 0.14, 0.68], "D6 · 4.42–5.00 µm (Banda 6 Polvo)"),
        }

        for fpath in fits_files:
            with open(fpath, "rb") as f:
                hdus = read_fits_bytes(f.read())
            hdu = next((h for h in hdus if h.get("float_bytes") is not None), None)
            if not hdu:
                continue
            width, height = hdu["width"], hdu["height"]
            fname = os.path.basename(fpath)
            det_match = 1
            for d_num in range(1, 7):
                if f"D{d_num}" in fname.upper() or f"DET{d_num}" in fname.upper():
                    det_match = d_num
                    break
            else:
                det_match = min(6, len(encoded_planes) + 1)
            chroma, label = det_chromas.get(det_match, ([1.0, 1.0, 1.0], f"Detector {det_match}"))
            cid = f"det{det_match}"
            encoded_planes[cid] = {
                "IMAGE": {
                    "meta": {
                        "dataset_id": l2set["id"],
                        "channel_id": cid,
                        "ext_name": "IMAGE",
                        "width": width,
                        "height": height,
                        "short_name": label,
                        "name": f"{l2set['name']} · {label}",
                        "chroma_rgb": chroma,
                    },
                    "float32_b64": base64.b64encode(hdu["float_bytes"]).decode("ascii"),
                }
            }

        self.datasets[l2set["id"]] = {
            "id": l2set["id"],
            "name": f"🛰️ {l2set['name']}",
            "type": "real_spherex_fits",
            "ra": l2set["ra"],
            "dec": l2set["dec"],
            "width": width,
            "height": height,
            "description": f"Exposición Level-2 real descargada de NASA/IRSA ({l2set['collection']}, Detectores D1–D6).",
            "source": f"NASA/IRSA {l2set['collection']}",
            "encoded_planes": encoded_planes,
        }

    def get_bundle_planes(self, dataset_id: str) -> Dict[str, Dict[str, Any]]:
        self.ensure_initialized()
        if dataset_id not in self.datasets:
            raise KeyError(f"Unknown dataset '{dataset_id}'")
        ds = self.datasets[dataset_id]

        if ds["type"] == "real_spherex_ondemand":
            tid = dataset_id[4:] if dataset_id.startswith("spx_") else dataset_id
            found_dir = None
            meta = None
            for root_dir in (REAL_API_ROOT, RUNTIME_API_ROOT):
                cand_dir = os.path.join(root_dir, "targets", tid)
                meta_path = os.path.join(cand_dir, "meta.json")
                if os.path.isfile(meta_path):
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    found_dir = cand_dir
                    break
            if meta and found_dir:
                self._register_real_api_target(dataset_id, found_dir, meta)
                ds = self.datasets[dataset_id]
            else:
                ns = argparse.Namespace(per_det=1, inner_workers=3, max_fill=0.20, force=False)
                resolved: Dict[str, Any] = {}
                for root_dir in (REAL_API_ROOT, RUNTIME_API_ROOT):
                    cache_path = os.path.join(root_dir, "resolved_names.json")
                    if os.path.exists(cache_path):
                        try:
                            with open(cache_path, "r", encoding="utf-8") as f:
                                resolved.update(json.load(f))
                        except OSError:
                            pass
                meta = spherex_api_real.process_target(
                    (ds.get("query", ds["name"]), ds["name"], ds.get("category", "galaxy"), ds.get("size_deg", 0.25)),
                    ns,
                    resolved,
                    coords_override=(float(ds["ra"]), float(ds["dec"]))
                    if ds.get("ra") is not None and ds.get("dec") is not None
                    else None,
                )
                if not meta:
                    raise RuntimeError(f"Sin exposiciones SPHEREx en IRSA para {ds['name']}")
                tdir = os.path.join(RUNTIME_API_ROOT, "targets", meta.get("id", tid))
                if not os.path.isdir(tdir):
                    tdir = os.path.join(REAL_API_ROOT, "targets", meta.get("id", tid))
                self._register_real_api_target(dataset_id, tdir, meta)
                ds = self.datasets[dataset_id]

        if ds["type"] == "real_spherex_multiepoch":
            det_chromas = {
                1: [0.10, 0.38, 1.00],
                2: [0.08, 0.88, 0.75],
                3: [0.65, 0.95, 0.20],
                4: [1.00, 0.65, 0.12],
                5: [1.00, 0.28, 0.22],
                6: [0.95, 0.14, 0.68],
            }
            encoded_planes: Dict[str, Dict[str, Any]] = {}
            target_dir = ds["target_dir"]
            for exp in ds["exposures"]:
                fpath = os.path.join(target_dir, exp["file"])
                if not os.path.isfile(fpath):
                    continue
                with open(fpath, "rb") as f:
                    hdus = read_fits_bytes(f.read())
                if not hdus or hdus[0]["float_bytes"] is None:
                    continue
                hdu = hdus[0]
                det = int(exp["det"])
                cid = f"{exp['obs_id']}_D{det}"
                coll_str = str(exp.get("collection") or "")
                rel_map = {
                    "spherex_dr1": "DR1",
                    "spherex_qr3": "QR3",
                    "spherex_dr1_deep": "DR1-Deep",
                    "spherex_qr2": "QR2",
                }
                rel_label = rel_map.get(coll_str, coll_str.upper().replace("SPHEREX_", "") or "IRSA")
                encoded_planes[cid] = {
                    "IMAGE": {
                        "meta": {
                            "dataset_id": dataset_id,
                            "channel_id": cid,
                            "ext_name": "IMAGE",
                            "width": hdu["width"],
                            "height": hdu["height"],
                            "det": det,
                            "season": exp["season"],
                            "collection": coll_str,
                            "release": rel_label,
                            "mjd": exp["mjd"],
                            "date_obs": exp["date_obs"],
                            "wave_center": exp["wave_um"],
                            "bandwidth_um": exp["bandwidth_um"],
                            "flux_mJy": exp["flux_mJy"],
                            "flux_err_mJy": exp["flux_err_mJy"],
                            "bg_MJysr": exp["bg_MJysr"],
                            "core_mean_MJysr": exp["core_mean_MJysr"],
                            "peak_MJysr": exp["peak_MJysr"],
                            "fill_frac": exp["fill_frac"],
                            "access_url": exp["access_url"],
                            "short_name": f"D{det} · {exp['wave_um']:.2f} µm · {exp['date_obs'][:10]}",
                            "name": f"{exp['obs_id']} · D{det} ({exp['wave_um']:.2f} µm) · {exp['collection']}",
                            "chroma_rgb": det_chromas.get(det, [1.0, 1.0, 1.0]),
                        },
                        "float32_b64": base64.b64encode(hdu["float_bytes"]).decode("ascii"),
                    }
                }
            return encoded_planes

        return ds["encoded_planes"]

    def register_fits_files(
        self,
        dataset_id: str,
        name: str,
        filepaths: List[str],
        source: str = "Local / IRSA FITS",
        description: str = "",
    ) -> Dict[str, Any]:
        encoded_planes: Dict[str, Dict[str, Any]] = {}
        width, height = 180, 180
        ra, dec = 0.0, 0.0

        for f_idx, fpath in enumerate(filepaths):
            with open(fpath, "rb") as f:
                hdus = read_fits_bytes(f.read())
            base_fname = os.path.basename(fpath)

            for hdu in hdus:
                if hdu["float_bytes"] is None:
                    continue
                width, height = hdu["width"], hdu["height"]
                if not ra:
                    ra = float(hdu["header"].get("CRVAL1") or hdu["header"].get("RA") or 0.0)
                if not dec:
                    dec = float(hdu["header"].get("CRVAL2") or hdu["header"].get("DEC") or 0.0)

                if "cube_slices" in hdu:
                    for s_info in hdu["cube_slices"]:
                        s_idx = s_info["slice"]
                        cid = f"file{f_idx + 1}_slice{s_idx + 1}"
                        encoded_planes[cid] = {
                            "IMAGE": {
                                "meta": {
                                    "dataset_id": dataset_id,
                                    "channel_id": cid,
                                    "ext_name": "IMAGE",
                                    "width": width,
                                    "height": height,
                                    "short_name": f"{base_fname} · Slice {s_idx + 1}",
                                    "name": f"{base_fname} · Slice {s_idx + 1}",
                                },
                                "float32_b64": base64.b64encode(s_info["float_bytes"]).decode("ascii"),
                            }
                        }
                else:
                    ext_name = hdu["name"].upper()
                    cid = f"file{f_idx + 1}_{ext_name}_{hdu['index']}"
                    encoded_planes[cid] = {
                        "IMAGE": {
                            "meta": {
                                "dataset_id": dataset_id,
                                "channel_id": cid,
                                "ext_name": ext_name,
                                "width": width,
                                "height": height,
                                "short_name": f"{base_fname} · {ext_name}",
                                "name": f"{base_fname} ({ext_name})",
                            },
                            "float32_b64": base64.b64encode(hdu["float_bytes"]).decode("ascii"),
                        }
                    }

        ds = {
            "id": dataset_id,
            "name": name,
            "type": "custom_fits",
            "ra": ra,
            "dec": dec,
            "width": width,
            "height": height,
            "description": description or f"{len(encoded_planes)} planos cargados de FITS.",
            "source": source,
            "encoded_planes": encoded_planes,
        }
        self.datasets[dataset_id] = ds
        return ds


DEFAULT_HIPS_BASE = "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube"
DEFAULT_CUBE_BASE = "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/hips5_cube/hips_20261026"
HIPS_CACHE_DIR = os.environ.get(
    "SPHEREX_CACHE_DIR",
    os.path.join(tempfile.gettempdir(), "kronox-spherex-hips-cache"),
)
_CUBE_INDEX_CACHE: Dict[str, Dict[str, Any]] = {}


def _validate_hips_base(raw: str) -> str:
    base = (raw or DEFAULT_HIPS_BASE).strip().rstrip("/")
    if not base.startswith("https://irsa.ipac.caltech.edu/data/hips/SPHEREx/"):
        raise ValueError("URL HiPS no permitida; debe pertenecer a irsa.ipac.caltech.edu/data/hips/SPHEREx/.")
    return base


def _validate_cube_base(raw: str) -> str:
    base = (raw or DEFAULT_CUBE_BASE).strip().rstrip("/")
    if not base.startswith("https://irsa.ipac.caltech.edu/ibe/data/spherex/"):
        raise ValueError("URL de cubos FITS no permitida; debe pertenecer a irsa.ipac.caltech.edu/ibe/data/spherex/.")
    return base


def _cached_http_get(url: str, force: bool = False, timeout: int = 18) -> bytes:
    os.makedirs(HIPS_CACHE_DIR, exist_ok=True)
    key = hashlib.sha256(url.encode("utf-8")).hexdigest()
    cpath = os.path.join(HIPS_CACHE_DIR, f"{key}.bin")
    if not force:
        try:
            with open(cpath, "rb") as f:
                return f.read()
        except OSError:
            pass
    req = urllib.request.Request(url, headers={"User-Agent": "SPHEREx-Explorer/1.0"})
    with urllib.request.urlopen(req, timeout=timeout, context=HTTPS_CONTEXT) as resp:
        data = resp.read()
    tmp = None
    try:
        fd, tmp = tempfile.mkstemp(prefix=f"{key}.", suffix=".tmp", dir=HIPS_CACHE_DIR)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, cpath)
    except OSError:
        try:
            with open(cpath, "rb") as f:
                return f.read()
        except OSError:
            return data
    finally:
        if tmp:
            try:
                os.remove(tmp)
            except OSError:
                pass
    return data


def _parse_hips_properties(text: str) -> Dict[str, Any]:
    kv: Dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        kv[k.strip()] = v.strip()
    waves = [float(x) for x in kv.get("data_cube_crval3_arr", "").split() if x]
    return {
        "obsTitle": kv.get("obs_title", "SPHEREx DR1 all-sky data cube"),
        "obsCollection": kv.get("obs_collection", "SPHEREx DR1"),
        "obsDescription": kv.get("obs_description", ""),
        "releaseDate": kv.get("hips_release_date") or kv.get("hips_creation_date", ""),
        "order": int(float(kv.get("hips_order", "5"))),
        "orderMin": int(float(kv.get("hips_order_min", "0"))),
        "tileWidth": int(float(kv.get("hips_tile_width", "512"))),
        "pixelScaleDeg": float(kv.get("hips_pixel_scale", "0.0035786")),
        "cubeDepth": int(float(kv.get("hips_cube_depth", str(len(waves) or 102)))),
        "wavelengthsUm": waves,
        "blankChannels": [50, 51],
        "pixelCut": kv.get("hips_pixel_cut", "0 40"),
        "pixelFunction": kv.get("hips_pixel_function", "asinh"),
        "dataRange": kv.get("hips_data_range", ""),
        "serviceUrl": kv.get("hips_service_url", DEFAULT_HIPS_BASE),
    }


_CTAB = [0] * 256
for _i in range(256):
    _c = 0
    for _b in range(8):
        _c |= ((_i >> _b) & 1) << (2 * _b)
    _CTAB[_i] = _c
_JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]
_JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7]


def _spread_bits16(v: int) -> int:
    return _CTAB[v & 0xFF] | (_CTAB[(v >> 8) & 0xFF] << 16)


def _ang2pix_nest(order: int, ra_deg: float, dec_deg: float) -> int:
    nside = 1 << order
    phi = math.radians(ra_deg % 360.0)
    z = math.sin(math.radians(max(-90.0, min(90.0, dec_deg))))
    za = abs(z)
    tt = (phi / (math.pi * 0.5)) % 4.0
    if za <= 2.0 / 3.0:
        temp1 = nside * (0.5 + tt)
        temp2 = nside * z * 0.75
        jp = int(math.floor(temp1 - temp2))
        jm = int(math.floor(temp1 + temp2))
        ifp = jp >> order
        ifm = jm >> order
        if ifp == ifm:
            face = 4 if ifp == 4 else ifp + 4
        elif ifp < ifm:
            face = ifp
        else:
            face = ifm + 8
        ix = jm & (nside - 1)
        iy = nside - (jp & (nside - 1)) - 1
    else:
        ntt = min(3, int(math.floor(tt)))
        tp = tt - ntt
        tmp = nside * math.sqrt(3.0 * (1.0 - za))
        jp = min(nside - 1, int(math.floor(tp * tmp)))
        jm = min(nside - 1, int(math.floor((1.0 - tp) * tmp)))
        if z >= 0:
            face = ntt
            ix = nside - jm - 1
            iy = nside - jp - 1
        else:
            face = ntt + 8
            ix = jp
            iy = jm
    ipf = _spread_bits16(ix) | (_spread_bits16(iy) << 1)
    return face * nside * nside + ipf


def _hpx_project(ra_deg: float, dec_deg: float) -> Tuple[float, float]:
    ra = ra_deg % 360.0
    sin_dec = math.sin(math.radians(max(-90.0, min(90.0, dec_deg))))
    if abs(sin_dec) <= 2.0 / 3.0:
        return ra, 67.5 * sin_dec
    sigma = math.sqrt(3.0 * (1.0 - abs(sin_dec)))
    ra_sector = int(math.floor(ra / 90.0))
    xc = ra_sector * 90.0 + 45.0
    return xc + (ra - xc) * sigma, (1.0 if sin_dec >= 0 else -1.0) * 45.0 * (2.0 - sigma)


def _ra_dec_to_hpx_fits_pixel(ra_deg: float, dec_deg: float, wcs: Dict[str, float]) -> Dict[str, Any]:
    pc11, pc12, pc21, pc22 = wcs["PC1_1"], wcs["PC1_2"], wcs["PC2_1"], wcs["PC2_2"]
    det = pc11 * pc22 - pc12 * pc21
    if abs(det) < 1e-18:
        raise ValueError("Matriz WCS HPX singular.")
    n1 = wcs.get("NAXIS1", 512)
    n2 = wcs.get("NAXIS2", 512)
    x_hpx_base, y_hpx = _hpx_project(ra_deg, dec_deg)
    best = None
    best_score = float("inf")
    for x_shift in (0.0, -360.0, 360.0):
        dx = x_hpx_base + x_shift - wcs.get("CRVAL1", 0.0)
        dy = y_hpx - wcs.get("CRVAL2", 0.0)
        px0 = wcs["CRPIX1"] + (pc22 * dx - pc12 * dy) / det - 1.0
        py0 = wcs["CRPIX2"] + (-pc21 * dx + pc11 * dy) / det - 1.0
        dist_out = max(0.0, -px0, px0 - (n1 - 1)) + max(0.0, -py0, py0 - (n2 - 1))
        if dist_out < best_score:
            best_score = dist_out
            best = {"x": int(round(px0)), "y": int(round(py0)), "xExact": px0, "yExact": py0}
    return best


_RANGE_SESSION = None


def _get_range_session():
    global _RANGE_SESSION
    if _RANGE_SESSION is None:
        import requests
        from requests.adapters import HTTPAdapter

        s = requests.Session()
        s.headers.update({"User-Agent": "SPHEREx-Explorer/1.0"})
        adapter = HTTPAdapter(pool_connections=16, pool_maxsize=24)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        _RANGE_SESSION = s
    return _RANGE_SESSION


def _fetch_range_bytes(url: str, start: int, length: int, timeout: int = 15) -> bytes:
    try:
        r = _get_range_session().get(
            url,
            headers={"Range": f"bytes={start}-{start + length - 1}"},
            timeout=timeout,
        )
        r.raise_for_status()
        return r.content
    except Exception:
        req = urllib.request.Request(
            url,
            headers={"Range": f"bytes={start}-{start + length - 1}", "User-Agent": "SPHEREx-Explorer/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout, context=HTTPS_CONTEXT) as resp:
            return resp.read()


def _parse_fits_header_cards(buf: bytes) -> Tuple[Dict[str, str], bool]:
    kv: Dict[str, str] = {}
    has_end = False
    for i in range(0, len(buf), 80):
        card = buf[i:i + 80].decode("ascii", errors="replace")
        key = card[:8].strip()
        if key == "END":
            has_end = True
            break
        if len(card) > 9 and card[8] == "=" and key:
            val_part = card[10:80].split("/", 1)[0].strip()
            if val_part.startswith("'") and val_part.endswith("'"):
                val_part = val_part[1:-1].strip()
            kv[key] = val_part
    return kv, has_end


def _get_cube_index(cube_url: str) -> Dict[str, Any]:
    if cube_url in _CUBE_INDEX_CACHE:
        return _CUBE_INDEX_CACHE[cube_url]
    offset = 0
    hdus: Dict[str, Dict[str, Any]] = {}
    primary_header: Dict[str, str] = {}
    image_header: Dict[str, str] = {}
    for hdu_idx in range(8):
        hdr_buf = b""
        found_end = False
        while not found_end and len(hdr_buf) < 32 * 2880:
            blk = _fetch_range_bytes(cube_url, offset, 2880)
            offset += 2880
            hdr_buf += blk
            kv, found_end = _parse_fits_header_cards(hdr_buf)
            if found_end:
                naxis = int(kv.get("NAXIS", "0"))
                dims = [int(kv.get(f"NAXIS{j}", "0")) for j in range(1, naxis + 1)]
                nel = 1 if naxis > 0 else 0
                for d in dims:
                    nel *= d
                bitpix = int(kv.get("BITPIX", "8"))
                pcount = int(kv.get("PCOUNT", "0"))
                gcount = max(1, int(kv.get("GCOUNT", "1")))
                data_bytes = ((nel * abs(bitpix)) // 8 + pcount) * gcount
                padded = ((data_bytes + 2879) // 2880) * 2880
                ext = kv.get("EXTNAME", "PRIMARY" if hdu_idx == 0 else f"HDU{hdu_idx}").strip().upper()
                hdus[ext] = {"ext": ext, "bitpix": bitpix, "dims": dims, "data_start": offset, "data_bytes": data_bytes}
                if hdu_idx == 0:
                    primary_header = kv
                if ext == "IMAGE":
                    image_header = kv
                offset += padded
        if not found_end or "WCS-WAVE" in hdus:
            break
    if "IMAGE" not in hdus:
        raise ValueError("El cubo FITS no contiene extensión IMAGE.")
    spectral_channels: List[Dict[str, Any]] = []
    if "SPECTRAL_CHANNELS" in hdus and hdus["SPECTRAL_CHANNELS"]["data_bytes"] >= 28 * 102:
        sc_buf = _fetch_range_bytes(cube_url, hdus["SPECTRAL_CHANNELS"]["data_start"], hdus["SPECTRAL_CHANNELS"]["data_bytes"])
        for i in range(min(102, len(sc_buf) // 28)):
            det, sub, wl, wmin, wmax, r_val, _rstd, bw = struct.unpack(">hhffffff", sc_buf[i * 28:(i + 1) * 28])
            spectral_channels.append({
                "channel": i,
                "channel1Based": i + 1,
                "detector": det,
                "localChannel": sub,
                "wavelengthUm": round(wl, 4),
                "wlMinUm": round(wmin, 4),
                "wlMaxUm": round(wmax, 4),
                "resolvingPowerR": round(r_val, 1),
                "bandwidthUm": round(bw, 4),
            })
    meta = {
        "cube_url": cube_url,
        "hdus": hdus,
        "primary_header": primary_header,
        "image_header": image_header,
        "spectral_channels": spectral_channels,
    }
    if len(_CUBE_INDEX_CACHE) > 32:
        _CUBE_INDEX_CACHE.pop(next(iter(_CUBE_INDEX_CACHE)))
    _CUBE_INDEX_CACHE[cube_url] = meta
    return meta


_CUBE_FLAG_NAMES = [
    (0, "TRANSIENT"), (1, "OVERFLOW"), (2, "SUR_ERROR"), (5, "REFERENCE"),
    (6, "NONFUNC"), (7, "HOT_OR_MISSING"), (9, "PERSIST"), (10, "ZODI_SUB_ERR"),
    (11, "PHANTOM"), (15, "COSMIC_RAY"), (19, "SOURCE"), (23, "GHOST_FPA"),
]


def _decode_cube_flags(flag_int: Optional[int]) -> List[str]:
    if not flag_int:
        return []
    f = int(flag_int) & 0xFFFFFFFF
    labels = [name for bit, name in _CUBE_FLAG_NAMES if (f & (1 << bit)) != 0]
    return labels if labels else [f"BITMASK(0x{f:x})"]


STORE = DatasetStore()


class VisualizerRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        pass

    def _send_json(self, payload: Any, status: int = 200) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _send_error_json(self, message: str, status: int = 400) -> None:
        self._send_json({"ok": False, "error": message}, status=status)

    def _send_bytes(self, data: bytes, content_type: str, status: int = 200, cache_control: str = "public, max-age=86400") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache_control)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(data)

    def _handle_hips_properties(self, qs: Dict[str, List[str]]) -> None:
        hips_base = _validate_hips_base(qs.get("hips_url", [DEFAULT_HIPS_BASE])[0])
        force = qs.get("refresh", ["0"])[0] == "1"
        prop_url = f"{hips_base}/properties"
        raw = _cached_http_get(prop_url, force=force, timeout=15)
        props = _parse_hips_properties(raw.decode("utf-8", errors="replace"))
        self._send_json({"ok": True, "propertiesUrl": prop_url, **props})

    def _handle_hips_tile(self, qs: Dict[str, List[str]]) -> None:
        hips_base = _validate_hips_base(qs.get("hips_url", [DEFAULT_HIPS_BASE])[0])
        try:
            order = int(qs.get("order", ["5"])[0])
            npix = int(qs.get("npix", ["0"])[0])
            frame = int(qs.get("frame", ["0"])[0])
        except ValueError:
            self._send_error_json("Parámetros order/npix/frame inválidos.", status=400)
            return
        if order < 0 or order > 5:
            self._send_error_json("Orden HiPS inválido (0–5).", status=400)
            return
        max_npix = 12 * (1 << (2 * order))
        if npix < 0 or npix >= max_npix:
            self._send_error_json(f"npix fuera de rango para orden {order}.", status=400)
            return
        if frame < 0 or frame > 101:
            self._send_error_json("Canal fuera de rango (0–101).", status=400)
            return
        fname = f"Npix{npix}.png" if frame == 0 else f"Npix{npix}_{frame}.png"
        tile_url = f"{hips_base}/Norder{order}/Dir{(npix // 10000) * 10000}/{fname}"
        data = _cached_http_get(tile_url, force=False, timeout=18)
        self._send_bytes(data, "image/png")

    def _parse_ipac_table(self, text: str) -> List[Dict[str, str]]:
        lines = text.splitlines()
        header_idx = -1
        for idx, line in enumerate(lines):
            if line.startswith("|"):
                header_idx = idx
                break
        if header_idx < 0:
            return []
        header_line = lines[header_idx]
        cols: List[Tuple[str, int, int]] = []
        pos = 0
        while pos < len(header_line):
            next_bar = header_line.find("|", pos + 1)
            if next_bar < 0:
                break
            name = header_line[pos + 1:next_bar].strip()
            cols.append((name, pos + 1, next_bar))
            pos = next_bar
        rows: List[Dict[str, str]] = []
        for line in lines[header_idx + 1:]:
            if not line or line.startswith("\\") or line.startswith("|"):
                continue
            row: Dict[str, str] = {}
            for name, start, end in cols:
                row[name] = line[start:end].strip()
            rows.append(row)
        return rows

    def _handle_catalog_overlay(self, qs: Dict[str, List[str]]) -> None:
        cat = (qs.get("catalog", ["gaia"])[0] or "gaia").strip().lower()
        if cat not in ("gaia", "wise"):
            self._send_error_json("Catálogo inválido (usa 'gaia' o 'wise').", status=400)
            return
        try:
            ra = float(qs["ra"][0]) % 360.0
            dec = max(-90.0, min(90.0, float(qs["dec"][0])))
            radius = max(0.02, min(2.0, float(qs.get("radius", ["0.4"])[0])))
            limit = max(10, min(500, int(qs.get("limit", ["300"])[0])))
        except (KeyError, ValueError):
            self._send_error_json("Parámetros ra, dec inválidos.", status=400)
            return

        # Quantize coordinates slightly to maximize cache hits during small pans
        q_ra = round(ra, 3)
        q_dec = round(dec, 3)
        q_rad = round(radius, 3)

        items: List[Dict[str, Any]] = []
        if cat == "gaia":
            adql = (
                f"SELECT TOP {limit} source_id, ra, dec, phot_g_mean_mag, bp_rp "
                f"FROM gaiadr3.gaia_source "
                f"WHERE 1=CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {q_ra}, {q_dec}, {q_rad})) "
                f"AND phot_g_mean_mag IS NOT NULL ORDER BY phot_g_mean_mag ASC"
            )
            url = (
                "https://gea.esac.esa.int/tap-server/tap/sync?"
                + urllib.parse.urlencode({
                    "REQUEST": "doQuery",
                    "LANG": "ADQL",
                    "FORMAT": "json",
                    "QUERY": adql,
                })
            )
            raw = _cached_http_get(url, force=False, timeout=22)
            payload = json.loads(raw.decode("utf-8", errors="replace"))
            for row in payload.get("data", []):
                if row[1] is None or row[2] is None:
                    continue
                items.append({
                    "id": f"Gaia DR3 {row[0]}",
                    "ra": float(row[1]),
                    "dec": float(row[2]),
                    "mag": float(row[3]) if row[3] is not None else None,
                    "color": float(row[4]) if row[4] is not None else None,
                })
        else:
            rad_arcsec = round(q_rad * 3600.0, 1)
            url = (
                "https://irsa.ipac.caltech.edu/cgi-bin/Gator/nph-query?"
                + urllib.parse.urlencode({
                    "catalog": "allwise_p3as_psd",
                    "spatial": "cone",
                    "radius": str(rad_arcsec),
                    "radunits": "arcsec",
                    "objstr": f"{q_ra} {q_dec}",
                    "outfmt": "1",
                    "selcols": "designation,ra,dec,w1mpro,w2mpro,w3mpro,w4mpro",
                })
            )
            raw = _cached_http_get(url, force=False, timeout=22)
            parsed_rows = self._parse_ipac_table(raw.decode("utf-8", errors="replace"))

            def _opt_float(val: str) -> Optional[float]:
                if not val or val.lower() == "null":
                    return None
                try:
                    return float(val)
                except ValueError:
                    return None

            for r in parsed_rows:
                ra_v = _opt_float(r.get("ra", ""))
                dec_v = _opt_float(r.get("dec", ""))
                if ra_v is None or dec_v is None:
                    continue
                items.append({
                    "id": f"WISE {r.get('designation', '')}".strip(),
                    "ra": ra_v,
                    "dec": dec_v,
                    "w1": _opt_float(r.get("w1mpro", "")),
                    "w2": _opt_float(r.get("w2mpro", "")),
                    "w3": _opt_float(r.get("w3mpro", "")),
                    "w4": _opt_float(r.get("w4mpro", "")),
                })
            items.sort(key=lambda x: x["w1"] if x["w1"] is not None else 99.0)
            items = items[:limit]

        self._send_json({"ok": True, "catalog": cat, "count": len(items), "items": items})

    def _handle_cube_inspect(self, qs: Dict[str, List[str]]) -> None:
        try:
            ra = float(qs["ra"][0])
            dec = float(qs["dec"][0])
            channel = int(qs.get("channel", ["0"])[0])
        except (KeyError, ValueError):
            self._send_error_json("Parámetros ra, dec y channel requeridos.", status=400)
            return
        if not (math.isfinite(ra) and 0.0 <= ra < 360.0 and math.isfinite(dec) and -90.0 <= dec <= 90.0):
            self._send_error_json("Coordenadas fuera de rango (RA 0–360°, Dec -90–90°).", status=400)
            return
        if channel < 0 or channel > 101:
            self._send_error_json("Canal fuera de rango (0–101).", status=400)
            return

        include_spectrum = qs.get("spectrum", ["0"])[0] == "1"
        cube_base = _validate_cube_base(qs.get("cube_url", [DEFAULT_CUBE_BASE])[0])
        npix = _ang2pix_nest(5, ra, dec)
        source_file = f"Npix{npix}_cube.fits"
        cube_url = f"{cube_base}/Norder5/Dir{(npix // 10000) * 10000}/{source_file}"
        meta = _get_cube_index(cube_url)
        ih = meta["image_header"]
        wcs = {
            "CRPIX1": float(ih["CRPIX1"]),
            "CRPIX2": float(ih["CRPIX2"]),
            "PC1_1": float(ih["PC1_1"]),
            "PC1_2": float(ih["PC1_2"]),
            "PC2_1": float(ih["PC2_1"]),
            "PC2_2": float(ih["PC2_2"]),
            "CRVAL1": float(ih.get("CRVAL1", 0.0)),
            "CRVAL2": float(ih.get("CRVAL2", 0.0)),
            "NAXIS1": meta["hdus"]["IMAGE"]["dims"][0],
            "NAXIS2": meta["hdus"]["IMAGE"]["dims"][1],
        }
        px = _ra_dec_to_hpx_fits_pixel(ra, dec, wcs)
        n1, n2 = wcs["NAXIS1"], wcs["NAXIS2"]
        x = max(0, min(n1 - 1, px["x"]))
        y = max(0, min(n2 - 1, px["y"]))
        p_idx = y * n1 + x

        img_start = meta["hdus"]["IMAGE"]["data_start"]
        nh_start = meta["hdus"].get("NHITS", {}).get("data_start")
        fl_start = meta["hdus"].get("FLAGS", {}).get("data_start")

        def read_plane(z: int, full_meta: bool = True) -> Dict[str, Any]:
            byte_off = (z * n1 * n2 + p_idx) * 4
            val_b = _fetch_range_bytes(cube_url, img_start + byte_off, 4)
            val = struct.unpack(">f", val_b)[0]
            nhits = None
            flags = None
            if full_meta:
                if nh_start is not None:
                    nhits = struct.unpack(">i", _fetch_range_bytes(cube_url, nh_start + byte_off, 4))[0]
                if fl_start is not None:
                    flags = struct.unpack(">i", _fetch_range_bytes(cube_url, fl_start + byte_off, 4))[0]
            return {
                "intensityMJysr": float(val) if math.isfinite(val) else None,
                "nhits": nhits,
                "flags": flags,
            }

        point = read_plane(channel, full_meta=True)
        sc = meta["spectral_channels"][channel] if channel < len(meta["spectral_channels"]) else {}

        spectrum102 = None
        if include_spectrum:
            spec_cache_key = f"cube_spec_{npix}_{x}_{y}.json"
            spec_cache_path = os.path.join(HIPS_CACHE_DIR, spec_cache_key)
            if os.path.isfile(spec_cache_path):
                try:
                    with open(spec_cache_path, "r", encoding="utf-8") as f:
                        spectrum102 = json.load(f)
                except OSError:
                    spectrum102 = None
            if spectrum102 is None:
                def read_plane_with_z(z: int) -> Tuple[int, Dict[str, Any]]:
                    if z in (50, 51):
                        return z, {"intensityMJysr": None, "nhits": None, "flags": None}
                    if z == channel:
                        return z, point
                    return z, read_plane(z, full_meta=False)

                spectrum102 = [None] * 102
                with ThreadPoolExecutor(max_workers=16) as pool:
                    for z, res in pool.map(read_plane_with_z, range(102)):
                        sc_z = meta["spectral_channels"][z] if z < len(meta["spectral_channels"]) else {}
                        spectrum102[z] = {
                            "channel": z,
                            "channel1Based": z + 1,
                            "detector": sc_z.get("detector", (z // 17) + 1),
                            "localChannel": sc_z.get("localChannel", (z % 17) + 1),
                            "wavelengthUm": sc_z.get("wavelengthUm"),
                            "intensityMJysr": None if z in (50, 51) else res["intensityMJysr"],
                            "nhits": res["nhits"],
                            "flags": res["flags"],
                            "blank": z in (50, 51),
                        }
                try:
                    os.makedirs(HIPS_CACHE_DIR, exist_ok=True)
                    with open(spec_cache_path, "w", encoding="utf-8") as f:
                        json.dump(spectrum102, f)
                except OSError:
                    pass

        self._send_json({
            "ok": True,
            "ra": ra,
            "dec": dec,
            "order": 5,
            "npix": npix,
            "x": x,
            "y": y,
            "xExact": round(px["xExact"], 2),
            "yExact": round(px["yExact"], 2),
            "channel": channel,
            "channel1Based": channel + 1,
            "detector": sc.get("detector", (channel // 17) + 1),
            "localChannel": sc.get("localChannel", (channel % 17) + 1),
            "wavelengthUm": sc.get("wavelengthUm"),
            "wlMinUm": sc.get("wlMinUm"),
            "wlMaxUm": sc.get("wlMaxUm"),
            "bandwidthUm": sc.get("bandwidthUm"),
            "resolvingPowerR": sc.get("resolvingPowerR"),
            "bunit": str(ih.get("BUNIT", "MJy/sr")).strip(),
            "intensityMJysr": None if channel in (50, 51) else point["intensityMJysr"],
            "nhits": point["nhits"],
            "flags": point["flags"],
            "flagLabels": _decode_cube_flags(point["flags"]),
            "blankChannel": channel in (50, 51),
            "sourceFile": source_file,
            "sourceUrl": cube_url,
            "dateBeg": meta["primary_header"].get("DATE-BEG"),
            "dateEnd": meta["primary_header"].get("DATE-END"),
            "spectrum102": spectrum102,
        })

    def _normalize_route_path(self, raw_path: str, qs: Dict[str, List[str]]) -> str:
        routed = qs.get("__route", [""])[0].strip()
        path = routed if routed else raw_path
        if path.startswith("/KRONOX/"):
            path = path[len("/KRONOX") :]
        if not path.startswith("/"):
            path = "/" + path
        return path

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_GET(self) -> None:
        STORE.ensure_initialized()
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        path = self._normalize_route_path(parsed.path, qs)

        try:
            if path == "/api/health":
                self._send_json({"ok": True, "service": "spherex-visualizer", "version": 2, "runtime": "vercel-serverless"})
            elif path == "/api/datasets":
                self._handle_list_datasets()
            elif path == "/api/bundle":
                self._handle_get_dataset_bundle(qs)
            elif path == "/api/resolve":
                self._handle_resolve(qs)
            elif path == "/api/irsa/search":
                self._handle_irsa_search(qs)
            elif path == "/api/spherex/refresh":
                added = STORE.refresh_real_api_targets()
                self._send_json({"ok": True, "added": added, "total": len(STORE.datasets)})
            elif path == "/api/spherex/region_stats":
                self._handle_spherex_region_stats(qs)
            elif path == "/api/hips/properties":
                self._handle_hips_properties(qs)
            elif path == "/api/hips/tile":
                self._handle_hips_tile(qs)
            elif path == "/api/catalog/overlay":
                self._handle_catalog_overlay(qs)
            elif path == "/api/cube/inspect":
                self._handle_cube_inspect(qs)
            elif path in ("/api/embeddings_bundle", "/spherex_v2_interactive_bundle.json", "/spherex_temporal_bundle.json"):
                btype = qs.get("type", [""])[0]
                if path.endswith("spherex_temporal_bundle.json") or btype == "temporal":
                    self._serve_static("/spherex_temporal_bundle.json")
                else:
                    self._serve_static("/spherex_v2_interactive_bundle.json")
            else:
                self._serve_static(path)
        except Exception as exc:
            traceback.print_exc()
            self._send_error_json(str(exc), status=500)

    def do_POST(self) -> None:
        STORE.ensure_initialized()
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        path = self._normalize_route_path(parsed.path, qs)
        content_len = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_len) if content_len > 0 else b"{}"

        try:
            if path == "/api/irsa/fetch":
                payload = json.loads(body.decode("utf-8"))
                self._handle_irsa_fetch(payload)
            elif path == "/api/spherex/fetch_target":
                payload = json.loads(body.decode("utf-8"))
                self._handle_spherex_fetch_target(payload)
            elif path == "/api/upload":
                payload = json.loads(body.decode("utf-8"))
                self._handle_upload_fits(payload)
            else:
                self._send_error_json(f"Unknown POST endpoint: {path}", status=404)
        except Exception as exc:
            traceback.print_exc()
            self._send_error_json(str(exc), status=500)

    def _dataset_summary(self, ds: Dict[str, Any]) -> Dict[str, Any]:
        out = {
            "id": ds["id"],
            "name": ds["name"],
            "type": ds["type"],
            "category": ds.get("category"),
            "ra": ds["ra"],
            "dec": ds["dec"],
            "width": ds["width"],
            "height": ds["height"],
            "description": ds["description"],
            "source": ds["source"],
        }
        if ds["type"] == "real_spherex_multiepoch":
            out["simbad_name"] = ds.get("simbad_name", ds["name"])
            out["size_deg"] = ds.get("size_deg", 0.25)
            out["pix_scale_arcsec"] = ds.get("pix_scale_arcsec", 6.2)
            out["n_exposures_irsa"] = ds.get("n_exposures_irsa", 0)
            n_dr1 = ds.get("n_dr1", 0)
            n_qr3 = ds.get("n_qr3", 0)
            out["n_dr1"] = n_dr1
            out["n_qr3"] = n_qr3
            out["date_min"] = ds.get("date_min", "")
            out["date_max"] = ds.get("date_max", "")
            out["seasons"] = ds.get("seasons", [])
            n_exp = len(ds.get("exposures", []))
            out["n_exposures"] = n_exp
            out["n_planes"] = n_exp
            rels: List[str] = []
            if n_dr1 > 0:
                rels.append("DR1")
            if n_qr3 > 0:
                rels.append("QR3")
            for exp in ds.get("exposures", []):
                c = str(exp.get("collection") or "")
                if c == "spherex_dr1_deep" and "DR1-Deep" not in rels:
                    rels.append("DR1-Deep")
                elif c == "spherex_qr2" and "QR2" not in rels:
                    rels.append("QR2")
            out["releases"] = rels
            out["release_badge"] = "+".join(rels) if rels else "IRSA"
        elif ds["type"] == "real_spherex_ondemand":
            out["size_deg"] = ds.get("size_deg", 0.25)
            out["releases"] = ["IRSA"]
            out["release_badge"] = "IRSA Live"
        else:
            out["releases"] = ["FITS"]
            out["release_badge"] = "FITS"
        return out

    def _handle_spherex_region_stats(self, qs: Dict[str, List[str]]) -> None:
        dataset_id = qs.get("dataset_id", [""])[0]
        live = qs.get("live", ["0"])[0] == "1"
        if dataset_id not in STORE.datasets:
            self._send_error_json(f"Unknown dataset '{dataset_id}'", status=404)
            return
        ds = STORE.datasets[dataset_id]
        ra = float(ds.get("ra", 0.0))
        dec = float(ds.get("dec", 0.0))
        resp: Dict[str, Any] = {
            "ok": True,
            "dataset_id": dataset_id,
            "name": ds.get("name", dataset_id),
            "ra": ra,
            "dec": dec,
            "cached": {
                "total": len(ds.get("exposures", [])),
                "dr1": ds.get("n_dr1", 0),
                "qr3": ds.get("n_qr3", 0),
                "seasons": len(ds.get("seasons", [])),
                "date_min": ds.get("date_min", ""),
                "date_max": ds.get("date_max", ""),
            },
            "n_exposures_irsa": ds.get("n_exposures_irsa", 0),
        }
        if live:
            import spherex_api_real as sar
            rows = sar.sia_query(ra, dec)
            seasons = sar.group_seasons(rows)
            dr1_cnt = sum(1 for r in rows if r.get("collection") == "spherex_dr1")
            qr3_cnt = sum(1 for r in rows if r.get("collection") == "spherex_qr3")
            mjds = sorted(r["mjd"] for r in rows if r.get("mjd"))
            resp["live_irsa"] = {
                "total": len(rows),
                "dr1": dr1_cnt,
                "qr3": qr3_cnt,
                "seasons": len(seasons),
                "date_min": sar.mjd_to_iso(mjds[0])[:10] if mjds else "",
                "date_max": sar.mjd_to_iso(mjds[-1])[:10] if mjds else "",
            }
        self._send_json(resp)

    def _handle_list_datasets(self) -> None:
        items = [self._dataset_summary(ds) for ds in STORE.datasets.values()]
        self._send_json(
            {
                "ok": True,
                "datasets": items,
                "spherex_bands": SPHEREX_BANDS,
                "flag_bits": {str(k): v for k, v in SPHEREX_FLAG_BITS.items()},
                "notable_targets": [
                    {"key": k, "ra": v[0], "dec": v[1], "name": v[2]}
                    for k, v in NOTABLE_TARGETS.items()
                ],
            }
        )

    def _handle_get_dataset_bundle(self, qs: Dict[str, List[str]]) -> None:
        dataset_id = qs.get("dataset_id", [""])[0]
        if dataset_id not in STORE.datasets:
            self._send_error_json(f"Unknown dataset '{dataset_id}'", status=404)
            return

        ds = STORE.datasets[dataset_id]
        planes = STORE.get_bundle_planes(dataset_id)
        ds_out = self._dataset_summary(ds)
        if ds["type"] == "real_spherex_multiepoch":
            ds_out["exposures"] = ds.get("exposures", [])
        self._send_json(
            {
                "ok": True,
                "dataset": ds_out,
                "planes": planes,
            }
        )

    def _handle_spherex_fetch_target(self, payload: Dict[str, Any]) -> None:
        query = str(payload.get("query", "")).strip()
        if not query:
            self._send_error_json("Missing 'query' in request.", status=400)
            return
        category = str(payload.get("category", "galaxy")).strip() or "galaxy"
        size_deg = float(payload.get("size_deg", 0.25))
        per_det = int(payload.get("per_det", 1))

        ns = argparse.Namespace(
            per_det=per_det,
            inner_workers=3,
            max_fill=0.20,
            force=bool(payload.get("force", False)),
        )
        resolved: Dict[str, Any] = {}
        for root_dir in (REAL_API_ROOT, RUNTIME_API_ROOT):
            cache_path = os.path.join(root_dir, "resolved_names.json")
            if os.path.exists(cache_path):
                try:
                    with open(cache_path, "r", encoding="utf-8") as f:
                        resolved.update(json.load(f))
                except OSError:
                    pass

        for sub in ("targets", "calib"):
            try:
                os.makedirs(os.path.join(RUNTIME_API_ROOT, sub), exist_ok=True)
            except OSError:
                pass
        meta = spherex_api_real.process_target((query, query, category, size_deg), ns, resolved)
        if not meta:
            self._send_error_json(f"No se encontraron exposiciones reales de SPHEREx en IRSA para '{query}'.", status=404)
            return

        try:
            with open(os.path.join(RUNTIME_API_ROOT, "resolved_names.json"), "w", encoding="utf-8") as f:
                json.dump(resolved, f, indent=1)
        except OSError:
            pass
        spherex_api_real.rebuild_index()
        STORE.refresh_real_api_targets()
        ds_id = f"spx_{meta['id']}"
        ds = STORE.datasets[ds_id]
        ds_out = self._dataset_summary(ds)
        ds_out["exposures"] = ds.get("exposures", [])
        planes = STORE.get_bundle_planes(ds_id)
        self._send_json({"ok": True, "dataset_id": ds_id, "dataset": ds_out, "planes": planes})

    def _handle_resolve(self, qs: Dict[str, List[str]]) -> None:
        query = qs.get("q", [""])[0]
        res = resolve_target_name(query)
        self._send_json({"ok": True, **res})

    def _handle_irsa_search(self, qs: Dict[str, List[str]]) -> None:
        ra = float(qs.get("ra", ["83.8221"])[0])
        dec = float(qs.get("dec", ["-5.3911"])[0])
        radius = float(qs.get("radius", ["0.15"])[0])
        collection = float_or_str(qs.get("collection", ["auto"])[0])
        res = query_irsa_spherex(ra=ra, dec=dec, radius_deg=radius, collection=collection)
        self._send_json({"ok": True, **res})

    def _handle_irsa_fetch(self, payload: Dict[str, Any]) -> None:
        access_url = payload.get("access_url", "").strip()
        if not access_url:
            self._send_error_json("Missing 'access_url' in request.", status=400)
            return

        cutout_ra = payload.get("ra")
        cutout_dec = payload.get("dec")
        cutout_size = payload.get("cutout_size_deg")
        obs_id = payload.get("obs_id") or os.path.basename(access_url.split("?")[0])

        local_path, final_url = download_irsa_fits(
            access_url=access_url,
            download_dir=DOWNLOAD_DIR,
            cutout_ra=float(cutout_ra) if cutout_ra is not None else None,
            cutout_dec=float(cutout_dec) if cutout_dec is not None else None,
            cutout_size_deg=float(cutout_size) if cutout_size is not None else None,
        )

        ds_id = f"irsa_{os.path.splitext(os.path.basename(local_path))[0]}"
        ds = STORE.register_fits_files(
            dataset_id=ds_id,
            name=f"IRSA: {obs_id}",
            filepaths=[local_path],
            source=f"NASA/IRSA ({final_url})",
        )
        planes = STORE.get_bundle_planes(ds["id"])
        self._send_json({
            "ok": True,
            "dataset_id": ds["id"],
            "local_path": local_path,
            "dataset": self._dataset_summary(ds),
            "planes": planes,
        })

    def _handle_upload_fits(self, payload: Dict[str, Any]) -> None:
        files = payload.get("files", [])
        if not files:
            self._send_error_json("No FITS files provided.", status=400)
            return

        try:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
        except OSError:
            pass
        saved_paths: List[str] = []
        for f_obj in files:
            fname = os.path.basename(f_obj.get("filename", "uploaded.fits"))
            raw_bytes = base64.b64decode(f_obj.get("content_b64", ""))
            dest_path = os.path.join(UPLOAD_DIR, fname)
            with open(dest_path, "wb") as f:
                f.write(raw_bytes)
            saved_paths.append(dest_path)

        ds_id = f"local_{len(STORE.datasets) + 1}"
        title = (
            f"FITS Local: {os.path.basename(saved_paths[0])}"
            if len(saved_paths) == 1
            else f"FITS Local ({len(saved_paths)} archivos)"
        )
        ds = STORE.register_fits_files(
            dataset_id=ds_id,
            name=title,
            filepaths=saved_paths,
            source="Local FITS Upload",
        )
        planes = STORE.get_bundle_planes(ds["id"])
        self._send_json({
            "ok": True,
            "dataset_id": ds["id"],
            "dataset": self._dataset_summary(ds),
            "planes": planes,
        })

    def _serve_static(self, path: str) -> None:
        if path in ("/", ""):
            path = "/index.html"
        safe_rel = os.path.normpath(path.lstrip("/"))
        if safe_rel.startswith(".."):
            self._send_error_json("Forbidden path", status=403)
            return
        full_path = os.path.join(STATIC_DIR, safe_rel)
        if not os.path.isfile(full_path):
            alt_path = os.path.join(BASE_DIR, safe_rel)
            if os.path.isfile(alt_path):
                full_path = alt_path
            else:
                self._send_error_json(f"File not found: {path}", status=404)
                return

        ctype, _ = mimetypes.guess_type(full_path)
        if not ctype:
            ctype = "application/octet-stream"
        with open(full_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)


def float_or_str(v: str) -> str:
    return str(v)


def main() -> None:
    parser = argparse.ArgumentParser(description="SPHEREx Color Composite Visualizer Server")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765)")
    args = parser.parse_args()

    STORE.initialize()
    print(f"Loaded {len(STORE.datasets)} SPHEREx datasets (real DR1/QR3 + catalog).")

    server = ThreadingHTTPServer((args.host, args.port), VisualizerRequestHandler)
    print(f"SPHEREx Visualizer listening on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
