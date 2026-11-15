"""
NASA/IPAC IRSA Live Archive Client for SPHEREx Data.

Supports:
1. Astronomical Target Name Resolution via CDS Sesame (SIMBAD/NED/VizieR) + built-in catalog.
2. Live IVOA Simple Image Access (SIA v2) & Table Access Protocol (TAP) queries against
   `https://irsa.ipac.caltech.edu/SIA` and `https://irsa.ipac.caltech.edu/TAP/sync`
   for SPHEREx collections (`spherex_dr1`, `spherex_qr3`, `spherex_dr1_deep`, `spherex_qr2`).
3. Live FITS & On-the-Fly Cutout downloader (`?center=ra,dec&size=deg`).
"""

from __future__ import annotations

import hashlib
import os
import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

import requests

# Built-in catalog of notable SPHEREx targets for instant lookup
NOTABLE_TARGETS: Dict[str, Tuple[float, float, str]] = {
    "m42": (83.8221, -5.3911, "Orion Nebula (M42) - H II Region & PAH Ridge"),
    "orion": (83.8221, -5.3911, "Orion Nebula (M42)"),
    "ngc 3372": (161.2650, -59.8680, "Carina Nebula (NGC 3372)"),
    "carina": (161.2650, -59.8680, "Carina Nebula (NGC 3372)"),
    "nep": (269.9833, 66.5608, "SPHEREx North Ecliptic Pole (NEP) Deep Field"),
    "sep": (90.0, -66.5608, "SPHEREx South Ecliptic Pole (SEP) Deep Field"),
    "m31": (10.6847, 41.2687, "Andromeda Galaxy (M31)"),
    "m51": (202.4696, 47.1952, "Whirlpool Galaxy (M51)"),
    "m82": (148.9685, 69.6797, "Cigar Galaxy Starburst (M82)"),
    "ngc 7023": (315.4038, 68.1633, "Iris Nebula Reflection & PAH Nebula (NGC 7023)"),
    "rho oph": (246.7875, -24.5400, "Rho Ophiuchi Molecular Cloud Complex"),
    "sgr a*": (266.4168, -29.0078, "Galactic Center (Sgr A*)"),
    "lmc": (80.8942, -69.7561, "Large Magellanic Cloud (30 Doradus / Tarantula)"),
    "30 dor": (84.6766, -69.1009, "30 Doradus (Tarantula Nebula in LMC)"),
    "jwst deep": (53.1647, -27.7910, "Chandra / JWST GOODS-South Deep Field"),
}

IRSA_SIA_URL = "https://irsa.ipac.caltech.edu/SIA"
IRSA_TAP_SYNC_URL = "https://irsa.ipac.caltech.edu/TAP/sync"
SESAME_URL = "https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oxp/SNV"


def resolve_target_name(query: str) -> Dict[str, Any]:
    """
    Resolve an astronomical object name (e.g. 'M42', 'NGC 7023', '83.82 -5.39')
    into decimal J2000 (RA, Dec) degrees.
    """
    q = query.strip()
    if not q:
        raise ValueError("Empty target name or coordinate string.")

    # 1. Check if already decimal coordinates "RA, Dec" or "RA Dec"
    coord_match = re.match(
        r"^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$", q
    )
    if coord_match:
        ra = float(coord_match.group(1))
        dec = float(coord_match.group(2))
        return {
            "name": f"Coord ({ra:.4f}, {dec:.4f})",
            "ra": ra,
            "dec": dec,
            "resolver": "Direct Coordinates",
        }

    # 2. Check built-in notable SPHEREx catalog first for instant response
    norm = q.lower().strip()
    if norm in NOTABLE_TARGETS:
        ra, dec, desc = NOTABLE_TARGETS[norm]
        return {"name": desc, "ra": ra, "dec": dec, "resolver": "SPHEREx Target Catalog"}

    # 3. Query CDS Sesame (SIMBAD + NED + VizieR) online
    try:
        url = f"{SESAME_URL}?{urllib.parse.quote(q)}"
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        jradeg = root.find(".//jradeg")
        jdedeg = root.find(".//jdedeg")
        oname = root.find(".//oname")
        if jradeg is not None and jdedeg is not None and jradeg.text and jdedeg.text:
            return {
                "name": oname.text.strip() if (oname is not None and oname.text) else q,
                "ra": float(jradeg.text),
                "dec": float(jdedeg.text),
                "resolver": "CDS Sesame (SIMBAD/NED)",
            }
    except Exception as exc:
        raise RuntimeError(
            f"Could not resolve '{q}' online via CDS Sesame ({exc}). "
            "Try entering decimal RA, Dec (e.g. 83.82, -5.39) or a preset target."
        ) from exc

    raise ValueError(f"Target '{q}' not found in SIMBAD/NED.")


def query_irsa_spherex(
    ra: float,
    dec: float,
    radius_deg: float = 0.15,
    collection: str = "spherex_dr1",
    max_records: int = 30,
) -> Dict[str, Any]:
    """
    Query NASA/IPAC IRSA Simple Image Access (SIA v2) endpoint for SPHEREx FITS images
    covering (ra, dec) within radius_deg.
    """
    collections_to_try = [collection]
    if collection == "auto":
        collections_to_try = ["spherex_dr1", "spherex_qr3", "spherex_dr1_deep", "spherex_qr2"]

    release_labels = {
        "spherex_dr1": "DR1",
        "spherex_qr3": "QR3",
        "spherex_dr1_deep": "DR1-Deep",
        "spherex_qr2": "QR2",
    }

    last_error: Optional[str] = None
    all_records: List[Dict[str, Any]] = []
    seen_keys = set()
    collections_found: List[str] = []
    release_counts: Dict[str, int] = {}

    for coll in collections_to_try:
        params = {
            "COLLECTION": coll,
            "POS": f"circle {ra:.6f} {dec:.6f} {radius_deg:.5f}",
            "MAXREC": str(max_records),
        }
        try:
            resp = requests.get(IRSA_SIA_URL, params=params, timeout=12)
            resp.raise_for_status()
            records = _parse_votable_sia_response(resp.text, coll)
            if records:
                rel = release_labels.get(coll, coll.upper().replace("SPHEREX_", ""))
                if coll not in collections_found:
                    collections_found.append(coll)
                added = 0
                for rec in records:
                    rec["release"] = rel
                    rec_key = rec.get("obs_id") or rec.get("access_url") or f"{coll}_{len(all_records)}"
                    if rec_key not in seen_keys:
                        seen_keys.add(rec_key)
                        all_records.append(rec)
                        added += 1
                release_counts[rel] = release_counts.get(rel, 0) + added
        except Exception as exc:
            last_error = str(exc)

    used_collection = "+".join(collections_found) if collections_found else collection

    return {
        "ra": ra,
        "dec": dec,
        "radius_deg": radius_deg,
        "collection": used_collection,
        "collections_found": collections_found,
        "release_counts": release_counts,
        "count": len(all_records),
        "records": all_records[:max_records],
        "error": last_error if not all_records else None,
        "query_url": f"{IRSA_SIA_URL}?COLLECTION={collections_found[0] if collections_found else collection}&POS=circle+{ra:.4f}+{dec:.4f}+{radius_deg:.4f}",
    }


def _parse_votable_sia_response(xml_text: str, default_collection: str) -> List[Dict[str, Any]]:
    """Parse an IVOA VOTable XML response from IRSA SIA into clean observation dicts."""
    # Strip namespaces for simpler ElementTree traversal
    clean_xml = re.sub(r'\sxmlns(:\w+)?="[^"]+"', "", xml_text)
    root = ET.fromstring(clean_xml)

    fields: List[str] = []
    table = root.find(".//TABLE")
    if table is None:
        return []

    for f_elem in table.findall("./FIELD"):
        fname = f_elem.attrib.get("name") or f_elem.attrib.get("ID") or ""
        fields.append(fname.lower())

    rows_out: List[Dict[str, Any]] = []
    for tr in table.findall(".//TABLEDATA/TR"):
        tds = [td.text.strip() if td.text else "" for td in tr.findall("./TD")]
        row_dict = {fields[i]: tds[i] for i in range(min(len(fields), len(tds)))}

        access_url = (
            row_dict.get("access_url")
            or row_dict.get("acref")
            or row_dict.get("url")
            or row_dict.get("download")
            or ""
        )
        access_format = row_dict.get("access_format") or row_dict.get("format") or ""
        # Keep FITS or datalink records
        if not access_url:
            continue

        # Convert wavelength from meters (SIAv2 standard) to micrometers (µm) if needed
        em_min = _safe_float(row_dict.get("em_min"), 0.0)
        em_max = _safe_float(row_dict.get("em_max"), 0.0)
        if 0 < em_min < 1e-3:
            em_min *= 1e6
        if 0 < em_max < 1e-3:
            em_max *= 1e6

        band_name = (
            row_dict.get("energy_bandpassname")
            or row_dict.get("filter")
            or row_dict.get("band_name")
            or (f"{em_min:.2f}-{em_max:.2f} µm" if em_min > 0 else "SPHEREx LVF")
        )

        rows_out.append(
            {
                "obs_id": row_dict.get("obs_id")
                or row_dict.get("obs_publisher_did")
                or os.path.basename(access_url.split("?")[0]),
                "collection": row_dict.get("obs_collection") or default_collection,
                "access_url": access_url,
                "access_format": access_format,
                "ra": _safe_float(row_dict.get("s_ra") or row_dict.get("ra"), 0.0),
                "dec": _safe_float(row_dict.get("s_dec") or row_dict.get("dec"), 0.0),
                "em_min_um": round(em_min, 3),
                "em_max_um": round(em_max, 3),
                "band_name": band_name,
                "exptime": _safe_float(row_dict.get("t_exptime"), 0.0),
                "calib_level": row_dict.get("calib_level", "2"),
                "instrument": row_dict.get("instrument_name", "SPHEREx"),
            }
        )

    # Prioritize direct FITS files over auxiliary links
    fits_rows = [
        r
        for r in rows_out
        if "fits" in r["access_format"].lower() or r["access_url"].lower().endswith((".fits", ".fits.gz", ".fit"))
    ]
    return fits_rows if fits_rows else rows_out


def download_irsa_fits(
    access_url: str,
    download_dir: str,
    cutout_ra: Optional[float] = None,
    cutout_dec: Optional[float] = None,
    cutout_size_deg: Optional[float] = None,
) -> Tuple[str, str]:
    """
    Download a SPHEREx FITS file or on-the-fly IRSA IBE spatial cutout (`?center=RA,DEC&size=DEG`)
    and cache it locally in `download_dir`.
    Returns (local_filepath, final_url).
    """
    os.makedirs(download_dir, exist_ok=True)
    final_url = access_url

    # Append IRSA IBE cutout query parameters if requested and supported by URL
    if (
        cutout_ra is not None
        and cutout_dec is not None
        and cutout_size_deg is not None
        and cutout_size_deg > 0
        and "ibe/data" in access_url
    ):
        sep = "&" if "?" in access_url else "?"
        final_url = f"{access_url}{sep}center={cutout_ra:.6f},{cutout_dec:.6f}&size={cutout_size_deg:.4f}"

    url_hash = hashlib.sha1(final_url.encode("utf-8")).hexdigest()[:10]
    base_name = os.path.basename(access_url.split("?")[0])
    if not base_name.lower().endswith((".fits", ".fit", ".fits.gz")):
        base_name = f"irsa_spherex_{url_hash}.fits"
    else:
        stem, ext = os.path.splitext(base_name)
        base_name = f"{stem}_{url_hash}{ext}"

    local_path = os.path.join(download_dir, base_name)
    if os.path.exists(local_path) and os.path.getsize(local_path) > 2880:
        return local_path, final_url

    resp = requests.get(final_url, timeout=30, stream=True)
    resp.raise_for_status()

    with open(local_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)

    return local_path, final_url


def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default
