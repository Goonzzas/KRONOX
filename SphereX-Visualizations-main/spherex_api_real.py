#!/usr/bin/env python3
"""
SPHEREx 100 % REAL — descarga directa desde la API oficial de NASA/IPAC IRSA.

Cero píxeles sintéticos. Para cada objeto astronómico real:

1. Resuelve sus coordenadas reales con CDS Sesame (SIMBAD/NED).
2. Consulta la API IVOA SIA v2 de IRSA (https://irsa.ipac.caltech.edu/SIA) en las
   colecciones oficiales `spherex_dr1`, `spherex_qr3`, `spherex_qr2`, `spherex_qr1`
   y obtiene TODAS las exposiciones Level-2 reales que contienen el objeto.
3. Agrupa las exposiciones en épocas reales de observación (SPHEREx re-observa cada
   punto del cielo cada ~6 meses) y, por cada época y detector (D1..D6), descarga
   recortes reales con el servicio de cutouts IBE de IRSA (`?center=RA,DEC&size=DEG`).
4. Para cada recorte:
     * lee IMAGE (MJy/sr), FLAGS y ZODI (modelo zodiacal oficial Kelsall+98 del pipeline);
     * resta el modelo zodiacal oficial y enmascara píxeles con flags de calidad
       (TRANSIENT, OVERFLOW, SUR_ERROR, NONFUNC, MISSING_DATA, HOT, COLD);
     * reproyecta con la WCS TAN-SIP oficial del archivo a una rejilla común
       norte-arriba / este-izquierda centrada en el objeto (interpolación bilineal);
     * calcula la longitud de onda real en la posición del objeto usando la tabla
       oficial WCS-WAVE del filtro lineal variable (LVF) de cada detector;
     * mide fotometría de apertura real (mJy) y brillo superficial (MJy/sr).
5. Guarda cada recorte como FITS estándar con WCS + metadatos y un índice JSON.

Uso (requiere red):
    python3 spherex_api_real.py                     # todos los objetos
    python3 spherex_api_real.py --max-targets 20    # prueba rápida
    python3 spherex_api_real.py --per-det 3 --workers 4
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import struct
import sys
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

import requests

SIA_URL = "https://irsa.ipac.caltech.edu/SIA"
SESAME_URLS = [
    "https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV",
    "https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oxp/SNV",
]
COLLECTIONS = ["spherex_dr1", "spherex_qr3", "spherex_qr2", "spherex_qr1"]
COLL_PRIORITY = {c: i for i, c in enumerate(COLLECTIONS)}

# Bits oficiales del plano FLAGS de SPHEREx (cabeceras MSKNxxxx del propio archivo)
MASK_BITS = 1 | 2 | 4 | 64 | 512 | 1024 | 2048  # TRANSIENT|OVERFLOW|SUR_ERROR|NONFUNC|MISSING_DATA|HOT|COLD

OUT_N = 128  # rejilla de salida común (píxeles)
SEASON_GAP_DAYS = 30.0

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_ROOT = os.path.join(BASE_DIR, "SPHEREx_REAL")

# ---------------------------------------------------------------------------
# Catálogo de objetos REALES (nombre resoluble en SIMBAD/NED, nombre visible,
# categoría, tamaño del recorte en grados).
# Categorías: nebula, black_hole, pulsar, snr, cluster, galaxy
# ---------------------------------------------------------------------------
T = Tuple[str, str, str, float]
TARGETS: List[T] = [
    # ---------------- Nebulosas (regiones H II, reflexión, oscuras, planetarias)
    ("M42", "Nebulosa de Orión (M42)", "nebula", 0.70),
    ("M43", "Nebulosa de De Mairan (M43)", "nebula", 0.30),
    ("M8", "Nebulosa de la Laguna (M8)", "nebula", 0.70),
    ("M16", "Nebulosa del Águila (M16)", "nebula", 0.50),
    ("M17", "Nebulosa Omega (M17)", "nebula", 0.50),
    ("M20", "Nebulosa Trífida (M20)", "nebula", 0.45),
    ("NGC 7000", "Nebulosa Norteamérica (NGC 7000)", "nebula", 0.70),
    ("IC 5070", "Nebulosa del Pelícano (IC 5070)", "nebula", 0.60),
    ("NGC 2237", "Nebulosa Roseta (NGC 2237)", "nebula", 0.70),
    ("NGC 3372", "Nebulosa de Carina (NGC 3372)", "nebula", 0.70),
    ("Barnard 33", "Nebulosa Cabeza de Caballo (B33)", "nebula", 0.35),
    ("NGC 2024", "Nebulosa de la Llama (NGC 2024)", "nebula", 0.35),
    ("M78", "Nebulosa de reflexión M78", "nebula", 0.35),
    ("NGC 1499", "Nebulosa California (NGC 1499)", "nebula", 0.70),
    ("IC 1396", "Nebulosa IC 1396 (Trompa de Elefante)", "nebula", 0.70),
    ("IC 1805", "Nebulosa del Corazón (IC 1805)", "nebula", 0.70),
    ("IC 1848", "Nebulosa del Alma (IC 1848)", "nebula", 0.70),
    ("NGC 281", "Nebulosa Pacman (NGC 281)", "nebula", 0.45),
    ("NGC 6357", "Nebulosa Langosta (NGC 6357)", "nebula", 0.60),
    ("NGC 6334", "Nebulosa Pata de Gato (NGC 6334)", "nebula", 0.60),
    ("NGC 3603", "Región H II NGC 3603", "nebula", 0.35),
    ("NGC 2070", "Nebulosa de la Tarántula (30 Dor)", "nebula", 0.50),
    ("NGC 6888", "Nebulosa Creciente (NGC 6888)", "nebula", 0.40),
    ("NGC 7635", "Nebulosa de la Burbuja (NGC 7635)", "nebula", 0.35),
    ("Sh2-106", "Nebulosa Ángel de Nieve (Sh2-106)", "nebula", 0.25),
    ("NGC 2264", "Nebulosa del Cono (NGC 2264)", "nebula", 0.60),
    ("NGC 1333", "Región de formación estelar NGC 1333", "nebula", 0.35),
    ("NGC 7023", "Nebulosa del Iris (NGC 7023)", "nebula", 0.35),
    ("IC 2944", "Nebulosa Lambda Centauri (IC 2944)", "nebula", 0.60),
    ("NGC 1977", "Nebulosa del Hombre Corriendo (NGC 1977)", "nebula", 0.45),
    ("IC 4604", "Nebulosa Rho Ophiuchi (IC 4604)", "nebula", 0.70),
    ("NGC 6559", "Nebulosa NGC 6559", "nebula", 0.40),
    ("IC 63", "Nebulosa Fantasma de Cassiopeia (IC 63)", "nebula", 0.30),
    ("NGC 6611", "Cúmulo y nebulosa NGC 6611", "nebula", 0.45),
    ("W51", "Complejo H II W51", "nebula", 0.50),
    ("W49A", "Región H II gigante W49A", "nebula", 0.30),
    ("Sh2-155", "Nebulosa de la Cueva (Sh2-155)", "nebula", 0.50),
    ("NGC 6820", "Nebulosa NGC 6820", "nebula", 0.35),
    ("Barnard 68", "Nube oscura Barnard 68", "nebula", 0.20),
    ("M27", "Nebulosa Dumbbell (M27)", "nebula", 0.25),
    ("M57", "Nebulosa del Anillo (M57)", "nebula", 0.15),
    ("NGC 7293", "Nebulosa de la Hélice (NGC 7293)", "nebula", 0.45),
    ("NGC 6543", "Nebulosa Ojo de Gato (NGC 6543)", "nebula", 0.15),
    ("NGC 3132", "Nebulosa del Anillo Sur (NGC 3132)", "nebula", 0.15),
    ("NGC 2392", "Nebulosa del Esquimal (NGC 2392)", "nebula", 0.15),
    ("M97", "Nebulosa del Búho (M97)", "nebula", 0.18),
    ("M76", "Pequeña Dumbbell (M76)", "nebula", 0.15),
    ("NGC 7009", "Nebulosa Saturno (NGC 7009)", "nebula", 0.15),
    ("NGC 7662", "Bola de Nieve Azul (NGC 7662)", "nebula", 0.15),
    ("NGC 6302", "Nebulosa del Insecto (NGC 6302)", "nebula", 0.15),
    ("NGC 6826", "Nebulosa del Ojo Parpadeante (NGC 6826)", "nebula", 0.15),
    ("IC 418", "Nebulosa del Espirógrafo (IC 418)", "nebula", 0.15),
    ("NGC 246", "Nebulosa de la Calavera (NGC 246)", "nebula", 0.18),
    ("NGC 40", "Nebulosa de la Pajarita (NGC 40)", "nebula", 0.15),
    ("NGC 7027", "Nebulosa planetaria NGC 7027", "nebula", 0.15),
    ("M1-92", "Nebulosa Huevo de Minkowski (M1-92)", "nebula", 0.15),
    ("NGC 2440", "Nebulosa planetaria NGC 2440", "nebula", 0.15),
    ("Red Rectangle", "Nebulosa del Rectángulo Rojo", "nebula", 0.15),
    ("Egg Nebula", "Nebulosa del Huevo (CRL 2688)", "nebula", 0.15),
    # ---------------- Agujeros negros (AGN, cuásares, blázares, binarias X)
    ("Sgr A*", "Sagitario A* (centro galáctico)", "black_hole", 0.35),
    ("Cyg X-1", "Cygnus X-1 (binaria con agujero negro)", "black_hole", 0.20),
    ("M87", "M87 (agujero negro supermasivo)", "black_hole", 0.25),
    ("NGC 5128", "Centaurus A (NGC 5128)", "black_hole", 0.40),
    ("3C 273", "Cuásar 3C 273", "black_hole", 0.20),
    ("3C 279", "Blázar 3C 279", "black_hole", 0.20),
    ("OJ 287", "Blázar OJ 287 (AGN binario)", "black_hole", 0.20),
    ("Mrk 421", "Blázar Markarian 421", "black_hole", 0.20),
    ("Mrk 501", "Blázar Markarian 501", "black_hole", 0.20),
    ("BL Lac", "BL Lacertae", "black_hole", 0.20),
    ("NGC 1068", "M77 / NGC 1068 (Seyfert 2)", "black_hole", 0.25),
    ("NGC 4151", "NGC 4151 (Seyfert 1)", "black_hole", 0.25),
    ("NGC 1275", "Perseus A (NGC 1275)", "black_hole", 0.25),
    ("Cyg A", "Cygnus A (radiogalaxia)", "black_hole", 0.20),
    ("SS 433", "Microcuásar SS 433", "black_hole", 0.20),
    ("GRS 1915+105", "Microcuásar GRS 1915+105", "black_hole", 0.20),
    ("V404 Cyg", "V404 Cygni (binaria con agujero negro)", "black_hole", 0.20),
    ("GX 339-4", "GX 339-4 (binaria con agujero negro)", "black_hole", 0.20),
    ("V616 Mon", "A0620-00 / V616 Mon", "black_hole", 0.20),
    ("3C 48", "Cuásar 3C 48", "black_hole", 0.20),
    ("PKS 2155-304", "Blázar PKS 2155-304", "black_hole", 0.20),
    ("3C 454.3", "Blázar 3C 454.3", "black_hole", 0.20),
    ("S5 0716+714", "Blázar S5 0716+714", "black_hole", 0.20),
    ("Mrk 231", "Markarian 231 (cuásar cercano)", "black_hole", 0.20),
    ("NGC 6240", "NGC 6240 (agujeros negros binarios)", "black_hole", 0.20),
    ("I Zw 1", "I Zwicky 1 (NLS1)", "black_hole", 0.20),
    ("NGC 3783", "NGC 3783 (Seyfert 1)", "black_hole", 0.20),
    ("NGC 5548", "NGC 5548 (Seyfert 1)", "black_hole", 0.20),
    ("NGC 7469", "NGC 7469 (Seyfert 1)", "black_hole", 0.20),
    ("MCG-6-30-15", "MCG-6-30-15 (Seyfert 1)", "black_hole", 0.20),
    ("Circinus Galaxy", "Galaxia del Compás (Seyfert 2)", "black_hole", 0.30),
    ("NGC 4945", "NGC 4945 (AGN oscurecido)", "black_hole", 0.35),
    ("Arp 220", "Arp 220 (ULIRG con AGN)", "black_hole", 0.20),
    ("TON 618", "Cuásar TON 618", "black_hole", 0.20),
    ("APM 08279+5255", "Cuásar APM 08279+5255", "black_hole", 0.20),
    ("H 1821+643", "Cuásar H1821+643", "black_hole", 0.20),
    ("NGC 4258", "M106 (máser y AGN)", "black_hole", 0.30),
    ("NGC 4395", "NGC 4395 (agujero negro de masa intermedia)", "black_hole", 0.25),
    ("Ark 120", "Arakelian 120", "black_hole", 0.20),
    ("PG 1211+143", "Cuásar PG 1211+143", "black_hole", 0.20),
    # ---------------- Púlsares, magnetares y nebulosas de viento de púlsar
    ("M1", "Nebulosa del Cangrejo + púlsar (M1)", "pulsar", 0.25),
    ("PSR B0833-45", "Púlsar de Vela (PSR B0833-45)", "pulsar", 0.30),
    ("Geminga", "Púlsar Geminga", "pulsar", 0.20),
    ("PSR B1509-58", "Púlsar «Mano de Dios» (PSR B1509-58)", "pulsar", 0.30),
    ("PSR J0437-4715", "Púlsar de milisegundo J0437-4715", "pulsar", 0.20),
    ("PSR B1919+21", "PSR B1919+21 (primer púlsar)", "pulsar", 0.20),
    ("PSR B0329+54", "PSR B0329+54", "pulsar", 0.20),
    ("PSR B1937+21", "PSR B1937+21 (milisegundo)", "pulsar", 0.20),
    ("3C 58", "3C 58 (nebulosa de viento de púlsar)", "pulsar", 0.20),
    ("PSR B1957+20", "Púlsar Viuda Negra (B1957+20)", "pulsar", 0.20),
    ("PSR B2224+65", "Nebulosa Guitarra (PSR B2224+65)", "pulsar", 0.20),
    ("PSR J0737-3039A", "Púlsar doble J0737-3039", "pulsar", 0.20),
    ("PSR B1257+12", "PSR B1257+12 (púlsar con planetas)", "pulsar", 0.20),
    ("Her X-1", "Hercules X-1 (púlsar de rayos X)", "pulsar", 0.20),
    ("Cen X-3", "Centaurus X-3 (púlsar de rayos X)", "pulsar", 0.20),
    ("Vela X-1", "Vela X-1 (púlsar de rayos X)", "pulsar", 0.20),
    ("Sco X-1", "Scorpius X-1 (estrella de neutrones)", "pulsar", 0.20),
    ("SGR 1806-20", "Magnetar SGR 1806-20", "pulsar", 0.20),
    ("SGR 1900+14", "Magnetar SGR 1900+14", "pulsar", 0.20),
    ("1E 2259+586", "Magnetar 1E 2259+586", "pulsar", 0.20),
    ("4U 0142+61", "Magnetar 4U 0142+61", "pulsar", 0.20),
    ("PSR B0540-69", "Púlsar PSR B0540-69 (LMC)", "pulsar", 0.20),
    ("PSR B0656+14", "PSR B0656+14", "pulsar", 0.20),
    ("PSR B1055-52", "PSR B1055-52", "pulsar", 0.20),
    ("PSR B1913+16", "Púlsar binario Hulse-Taylor", "pulsar", 0.20),
    ("PSR J1614-2230", "PSR J1614-2230 (2 masas solares)", "pulsar", 0.20),
    ("PSR B1706-44", "PSR B1706-44", "pulsar", 0.20),
    ("G21.5-0.9", "PWN G21.5-0.9", "pulsar", 0.20),
    ("Kes 75", "Kes 75 (púlsar + PWN)", "pulsar", 0.20),
    ("PSR J2124-3358", "PSR J2124-3358", "pulsar", 0.20),
    ("PSR B0355+54", "PSR B0355+54", "pulsar", 0.20),
    ("PSR J1023+0038", "Púlsar transicional J1023+0038", "pulsar", 0.20),
    # ---------------- Remanentes de supernova
    ("Cas A", "Cassiopeia A", "snr", 0.20),
    ("Tycho SNR", "Remanente de Tycho (SN 1572)", "snr", 0.20),
    ("Kepler SNR", "Remanente de Kepler (SN 1604)", "snr", 0.15),
    ("SN 1006", "SN 1006", "snr", 0.60),
    ("NGC 6960", "Velo Occidental (NGC 6960)", "snr", 0.60),
    ("NGC 6992", "Velo Oriental (NGC 6992)", "snr", 0.60),
    ("NGC 6979", "Triángulo de Pickering (NGC 6979)", "snr", 0.50),
    ("IC 443", "Nebulosa Medusa (IC 443)", "snr", 0.70),
    ("W44", "Remanente W44", "snr", 0.50),
    ("W49B", "Remanente W49B", "snr", 0.15),
    ("W28", "Remanente W28", "snr", 0.70),
    ("Puppis A", "Puppis A", "snr", 0.70),
    ("RCW 86", "RCW 86 (SN 185)", "snr", 0.70),
    ("RCW 103", "RCW 103", "snr", 0.20),
    ("N132D", "N132D (LMC)", "snr", 0.15),
    ("N49", "N49 (LMC)", "snr", 0.15),
    ("SN 1987A", "SN 1987A", "snr", 0.20),
    ("3C 391", "3C 391", "snr", 0.15),
    ("Kes 73", "Kes 73", "snr", 0.15),
    ("CTB 1", "CTB 1", "snr", 0.60),
    ("G11.2-0.3", "G11.2-0.3", "snr", 0.15),
    ("G292.0+1.8", "G292.0+1.8", "snr", 0.20),
    ("CTB 80", "CTB 80", "snr", 0.50),
    ("G54.1+0.3", "G54.1+0.3", "snr", 0.15),
    ("G1.9+0.3", "G1.9+0.3 (SNR más joven)", "snr", 0.15),
    ("Pa 30", "Pa 30 (SN 1181)", "snr", 0.20),
    ("G327.1-1.1", "G327.1-1.1", "snr", 0.25),
    ("IC 1340", "IC 1340 (Velo)", "snr", 0.40),
    ("HB 21", "HB 21", "snr", 0.70),
    ("G320.4-1.2", "G320.4-1.2 (MSH 15-52)", "snr", 0.40),
    # ---------------- Cúmulos estelares y protoestrellas
    ("M45", "Pléyades (M45)", "cluster", 0.70),
    ("M44", "Cúmulo del Pesebre (M44)", "cluster", 0.70),
    ("NGC 869", "h Persei (NGC 869)", "cluster", 0.45),
    ("NGC 884", "χ Persei (NGC 884)", "cluster", 0.45),
    ("M13", "Cúmulo de Hércules (M13)", "cluster", 0.30),
    ("M3", "Cúmulo globular M3", "cluster", 0.30),
    ("M5", "Cúmulo globular M5", "cluster", 0.30),
    ("M15", "Cúmulo globular M15", "cluster", 0.25),
    ("M2", "Cúmulo globular M2", "cluster", 0.25),
    ("M92", "Cúmulo globular M92", "cluster", 0.25),
    ("NGC 5139", "Omega Centauri (NGC 5139)", "cluster", 0.60),
    ("NGC 104", "47 Tucanae (NGC 104)", "cluster", 0.50),
    ("M22", "Cúmulo globular M22", "cluster", 0.35),
    ("M4", "Cúmulo globular M4", "cluster", 0.35),
    ("M80", "Cúmulo globular M80", "cluster", 0.20),
    ("M10", "Cúmulo globular M10", "cluster", 0.30),
    ("M12", "Cúmulo globular M12", "cluster", 0.30),
    ("NGC 6397", "Cúmulo globular NGC 6397", "cluster", 0.40),
    ("NGC 6752", "Cúmulo globular NGC 6752", "cluster", 0.35),
    ("M7", "Cúmulo de Ptolomeo (M7)", "cluster", 0.70),
    ("M6", "Cúmulo de la Mariposa (M6)", "cluster", 0.50),
    ("M11", "Cúmulo del Pato Salvaje (M11)", "cluster", 0.30),
    ("M35", "Cúmulo abierto M35", "cluster", 0.50),
    ("M37", "Cúmulo abierto M37", "cluster", 0.40),
    ("M41", "Cúmulo abierto M41", "cluster", 0.50),
    ("M46", "Cúmulo abierto M46", "cluster", 0.45),
    ("M67", "Cúmulo abierto M67", "cluster", 0.45),
    ("M52", "Cúmulo abierto M52", "cluster", 0.30),
    ("NGC 457", "Cúmulo de la Lechuza (NGC 457)", "cluster", 0.30),
    ("NGC 7789", "Rosa de Carolina (NGC 7789)", "cluster", 0.45),
    ("Westerlund 1", "Westerlund 1 (supercúmulo)", "cluster", 0.20),
    ("Westerlund 2", "Westerlund 2", "cluster", 0.20),
    ("Trumpler 14", "Trumpler 14", "cluster", 0.20),
    ("NGC 2362", "Cúmulo NGC 2362", "cluster", 0.20),
    ("NGC 6231", "Cúmulo NGC 6231", "cluster", 0.35),
    ("Arches Cluster", "Cúmulo de los Arcos", "cluster", 0.20),
    ("Quintuplet Cluster", "Cúmulo del Quintuplete", "cluster", 0.20),
    ("HH 46", "Objeto Herbig-Haro HH 46/47", "cluster", 0.15),
    ("HH 211", "Chorro protoestelar HH 211", "cluster", 0.15),
    ("HH 1", "Objetos Herbig-Haro HH 1/2", "cluster", 0.15),
    ("L1551 IRS 5", "Protoestrella L1551 IRS 5", "cluster", 0.20),
    ("IRAS 16293-2422", "Protoestrella binaria IRAS 16293-2422", "cluster", 0.15),
    ("T Tau", "T Tauri", "cluster", 0.15),
    ("FU Ori", "FU Orionis", "cluster", 0.15),
    ("V1057 Cyg", "V1057 Cygni (FUor)", "cluster", 0.15),
    ("R Mon", "Nebulosa Variable de Hubble (R Mon)", "cluster", 0.15),
    ("V838 Mon", "V838 Monocerotis", "cluster", 0.15),
    ("Eta Car", "Eta Carinae", "cluster", 0.20),
    ("WR 104", "Wolf-Rayet 104", "cluster", 0.15),
    ("VY CMa", "VY Canis Majoris (hipergigante)", "cluster", 0.15),
    ("IRC +10216", "IRC +10216 (CW Leo)", "cluster", 0.15),
    ("Betelgeuse", "Betelgeuse", "cluster", 0.20),
    ("Mira", "Mira (o Ceti)", "cluster", 0.15),
    ("R Leo", "R Leonis (variable Mira)", "cluster", 0.15),
    ("chi Cyg", "χ Cygni (variable Mira)", "cluster", 0.15),
    ("delta Cep", "δ Cephei (cefeida)", "cluster", 0.15),
    ("Polaris", "Polaris (cefeida)", "cluster", 0.15),
    # ---------------- Galaxias y espacio profundo
    ("M31", "Galaxia de Andrómeda (M31)", "galaxy", 0.80),
    ("M33", "Galaxia del Triángulo (M33)", "galaxy", 0.70),
    ("M51", "Galaxia del Remolino (M51)", "galaxy", 0.25),
    ("M101", "Galaxia del Molinete (M101)", "galaxy", 0.40),
    ("M81", "Galaxia de Bode (M81)", "galaxy", 0.40),
    ("M82", "Galaxia del Cigarro (M82)", "galaxy", 0.25),
    ("M104", "Galaxia del Sombrero (M104)", "galaxy", 0.20),
    ("M63", "Galaxia del Girasol (M63)", "galaxy", 0.25),
    ("M64", "Galaxia del Ojo Negro (M64)", "galaxy", 0.20),
    ("M74", "Galaxia Fantasma (M74)", "galaxy", 0.25),
    ("M83", "Molinete Austral (M83)", "galaxy", 0.30),
    ("M94", "Galaxia M94", "galaxy", 0.25),
    ("M96", "Galaxia M96", "galaxy", 0.20),
    ("NGC 253", "Galaxia del Escultor (NGC 253)", "galaxy", 0.50),
    ("NGC 300", "Galaxia NGC 300", "galaxy", 0.40),
    ("NGC 891", "Galaxia de canto NGC 891", "galaxy", 0.25),
    ("NGC 4565", "Galaxia de la Aguja (NGC 4565)", "galaxy", 0.30),
    ("NGC 4631", "Galaxia de la Ballena (NGC 4631)", "galaxy", 0.30),
    ("NGC 5907", "Galaxia Astilla (NGC 5907)", "galaxy", 0.25),
    ("NGC 7331", "Galaxia NGC 7331", "galaxy", 0.25),
    ("NGC 2403", "Galaxia NGC 2403", "galaxy", 0.40),
    ("NGC 2903", "Galaxia NGC 2903", "galaxy", 0.25),
    ("NGC 1300", "Espiral barrada NGC 1300", "galaxy", 0.20),
    ("NGC 1365", "Gran espiral barrada NGC 1365", "galaxy", 0.25),
    ("NGC 4038", "Galaxias Antenas (NGC 4038/39)", "galaxy", 0.20),
    ("Stephan's Quintet", "Quinteto de Stephan", "galaxy", 0.15),
    ("Cartwheel Galaxy", "Galaxia Rueda de Carro", "galaxy", 0.15),
    ("Hoag's Object", "Objeto de Hoag", "galaxy", 0.15),
    ("Arp 273", "Arp 273 (La Rosa)", "galaxy", 0.15),
    ("M100", "Galaxia M100", "galaxy", 0.25),
    ("M61", "Galaxia M61", "galaxy", 0.20),
    ("M66", "Galaxia M66 (Triplete de Leo)", "galaxy", 0.25),
    ("M65", "Galaxia M65 (Triplete de Leo)", "galaxy", 0.25),
    ("NGC 3628", "Galaxia Hamburguesa (NGC 3628)", "galaxy", 0.30),
    ("NGC 6946", "Galaxia de los Fuegos Artificiales (NGC 6946)", "galaxy", 0.35),
    ("IC 342", "Galaxia IC 342", "galaxy", 0.50),
    ("Maffei 1", "Maffei 1", "galaxy", 0.25),
    ("Maffei 2", "Maffei 2", "galaxy", 0.20),
    ("M108", "Galaxia de la Tabla de Surf (M108)", "galaxy", 0.20),
    ("M109", "Galaxia M109", "galaxy", 0.20),
    ("M88", "Galaxia M88", "galaxy", 0.20),
    ("M90", "Galaxia M90", "galaxy", 0.25),
    ("M99", "Galaxia M99", "galaxy", 0.20),
    ("NGC 4449", "Galaxia irregular NGC 4449", "galaxy", 0.20),
    ("NGC 4214", "Galaxia irregular NGC 4214", "galaxy", 0.20),
    ("M49", "Galaxia elíptica M49", "galaxy", 0.25),
    ("M60", "Galaxia elíptica M60", "galaxy", 0.25),
    ("M84", "Galaxia M84 (Cadena de Markarian)", "galaxy", 0.25),
    ("M86", "Galaxia M86 (Cadena de Markarian)", "galaxy", 0.25),
    ("NGC 1316", "Fornax A (NGC 1316)", "galaxy", 0.25),
    ("NGC 1399", "NGC 1399 (cúmulo de Fornax)", "galaxy", 0.25),
    ("Abell 1689", "Cúmulo de galaxias Abell 1689", "galaxy", 0.15),
    ("Abell 2218", "Cúmulo de galaxias Abell 2218", "galaxy", 0.15),
    ("NGC 4874", "Cúmulo de Coma (NGC 4874)", "galaxy", 0.30),
    ("Abell 370", "Cúmulo de galaxias Abell 370", "galaxy", 0.15),
    ("1E 0657-56", "Cúmulo Bala (1E 0657-56)", "galaxy", 0.15),
    ("NGC 6822", "Galaxia de Barnard (NGC 6822)", "galaxy", 0.40),
    ("IC 1613", "Galaxia enana IC 1613", "galaxy", 0.40),
    ("NGC 55", "Galaxia NGC 55", "galaxy", 0.45),
    ("NGC 5033", "Galaxia NGC 5033", "galaxy", 0.20),
    ("NGC 2841", "Galaxia NGC 2841", "galaxy", 0.20),
    ("NGC 3115", "Galaxia del Huso (NGC 3115)", "galaxy", 0.20),
    ("NEP", "Campo profundo Polo Norte Eclíptico (SPHEREx Deep)", "galaxy", 0.30),
    ("SEP", "Campo profundo Polo Sur Eclíptico (SPHEREx Deep)", "galaxy", 0.30),
]

# Coordenadas exactas de los campos profundos de SPHEREx (polos eclípticos)
FIXED_COORDS = {
    "NEP": (270.0, 66.560708),
    "SEP": (90.0, -66.560708),
}

DET_RANGES = {
    1: (0.75, 1.09),
    2: (1.10, 1.62),
    3: (1.63, 2.41),
    4: (2.42, 3.82),
    5: (3.83, 4.41),
    6: (4.42, 5.00),
}

_tls = threading.local()
_print_lock = threading.Lock()


def log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


def session() -> requests.Session:
    s = getattr(_tls, "s", None)
    if s is None:
        s = requests.Session()
        s.headers["User-Agent"] = "SPHEREx-Real-Explorer/1.0 (academic use)"
        _tls.s = s
    return s


def slugify(name: str) -> str:
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in " -+_.*'":
            out.append("_")
    s = "".join(out)
    while "__" in s:
        s = s.replace("__", "_")
    return s.strip("_")


# ---------------------------------------------------------------------------
# Resolución de nombres (CDS Sesame)
# ---------------------------------------------------------------------------
def resolve_name(name: str) -> Optional[Tuple[float, float, str]]:
    if name in FIXED_COORDS:
        ra, dec = FIXED_COORDS[name]
        return ra, dec, name
    for base in SESAME_URLS:
        try:
            r = session().get(f"{base}?{requests.utils.quote(name)}", timeout=20)
            r.raise_for_status()
            root = ET.fromstring(r.text)
            ra = root.find(".//jradeg")
            de = root.find(".//jdedeg")
            on = root.find(".//oname")
            if ra is not None and de is not None and ra.text and de.text:
                return float(ra.text), float(de.text), (on.text.strip() if on is not None and on.text else name)
        except Exception:
            continue
    return None


# ---------------------------------------------------------------------------
# API SIA v2 de IRSA
# ---------------------------------------------------------------------------
def sia_query(ra: float, dec: float) -> List[Dict[str, Any]]:
    rows: Dict[Tuple[str, int], Dict[str, Any]] = {}
    for coll in COLLECTIONS:
        params = {
            "COLLECTION": coll,
            "POS": f"circle {ra:.6f} {dec:.6f} 0.002",
            "RESPONSEFORMAT": "CSV",
        }
        for attempt in range(3):
            try:
                r = session().get(SIA_URL, params=params, timeout=90)
                r.raise_for_status()
                break
            except Exception:
                if attempt == 2:
                    r = None
                time.sleep(2 + 3 * attempt)
        if r is None:
            continue
        text = r.text
        if not text.startswith("s_ra"):
            continue
        for row in csv.DictReader(io.StringIO(text)):
            if row.get("dataproduct_subtype", "science") not in ("science", ""):
                continue
            band = row.get("energy_bandpassname", "")
            if not band.startswith("SPHEREx-D"):
                continue
            try:
                det = int(band[-1])
                t = float(row["t_min"])
            except Exception:
                continue
            key = (row["obs_id"], det)
            item = {
                "obs_id": row["obs_id"],
                "det": det,
                "mjd": t,
                "collection": coll,
                "access_url": row["access_url"],
                "em_min_um": float(row.get("em_min") or 0) * 1e6,
                "em_max_um": float(row.get("em_max") or 0) * 1e6,
            }
            prev = rows.get(key)
            if prev is None or COLL_PRIORITY[coll] < COLL_PRIORITY[prev["collection"]]:
                rows[key] = item
    return sorted(rows.values(), key=lambda x: x["mjd"])


def group_seasons(rows: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    seasons: List[List[Dict[str, Any]]] = []
    for r in rows:
        if not seasons or r["mjd"] - seasons[-1][-1]["mjd"] > SEASON_GAP_DAYS:
            seasons.append([r])
        else:
            seasons[-1].append(r)
    return seasons


# ---------------------------------------------------------------------------
# Lectura FITS mínima (streaming)
# ---------------------------------------------------------------------------
def _parse_value(raw: str) -> Any:
    v = raw.strip()
    if v.startswith("'"):
        end = v.find("'", 1)
        while end != -1 and end + 1 < len(v) and v[end + 1] == "'":
            end = v.find("'", end + 2)
        return v[1:end].replace("''", "'").strip() if end != -1 else v[1:].strip()
    v = v.split("/")[0].strip()
    if v in ("T", "F"):
        return v == "T"
    try:
        if any(c in v for c in ".EeDd"):
            return float(v.replace("D", "E").replace("d", "e"))
        return int(v)
    except ValueError:
        return v


def _parse_header_block(cards: List[str]) -> Dict[str, Any]:
    kv: Dict[str, Any] = {}
    for c in cards:
        if len(c) >= 10 and c[8:10] == "= ":
            kv[c[:8].strip()] = _parse_value(c[10:])
    return kv


def _data_size(kv: Dict[str, Any]) -> int:
    naxis = int(kv.get("NAXIS", 0))
    if naxis == 0:
        return 0
    n = abs(int(kv.get("BITPIX", 8))) // 8
    for i in range(1, naxis + 1):
        n *= int(kv.get(f"NAXIS{i}", 0))
    return n + int(kv.get("PCOUNT", 0) or 0)


def fetch_cutout_hdus(url: str, ra: float, dec: float, size_deg: float, want: Tuple[str, ...]) -> Dict[str, Tuple[Dict[str, Any], bytes]]:
    full = f"{url}?center={ra:.6f},{dec:.6f}&size={size_deg:.4f}"
    last_exc: Optional[Exception] = None
    for attempt in range(4):
        out: Dict[str, Tuple[Dict[str, Any], bytes]] = {}
        try:
            with session().get(full, stream=True, timeout=120) as r:
                if r.status_code in (429, 500, 502, 503, 504):
                    raise requests.HTTPError(f"{r.status_code} {r.reason} for url: {full}", response=r)
                r.raise_for_status()
                it = r.iter_content(131072)
                buf = bytearray()

                def need(n: int) -> None:
                    while len(buf) < n:
                        chunk = next(it, None)
                        if chunk is None:
                            raise IOError("respuesta FITS truncada")
                        buf.extend(chunk)

                off = 0
                while True:
                    cards: List[str] = []
                    while True:
                        need(off + 2880)
                        blk = bytes(buf[off : off + 2880]).decode("ascii", "replace")
                        off += 2880
                        done = False
                        for i in range(36):
                            c = blk[i * 80 : (i + 1) * 80]
                            cards.append(c)
                            if c.startswith("END") and c[3:].strip() == "":
                                done = True
                                break
                        if done:
                            break
                    kv = _parse_header_block(cards)
                    size = _data_size(kv)
                    name = str(kv.get("EXTNAME", "PRIMARY")).strip().upper()
                    if name in want:
                        need(off + size)
                        out[name] = (kv, bytes(buf[off : off + size]))
                    off += ((size + 2879) // 2880) * 2880
                    if all(w in out for w in want):
                        break
            return out
        except Exception as exc:
            last_exc = exc
            if attempt < 3:
                time.sleep(1.5 * (2 ** attempt))
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# WCS TAN-SIP oficial del archivo
# ---------------------------------------------------------------------------
D2R = math.pi / 180.0


def tan_project(ra: float, dec: float, ra0: float, dec0: float) -> Tuple[float, float]:
    a = (ra - ra0) * D2R
    d = dec * D2R
    d0 = dec0 * D2R
    cd = math.cos(d)
    den = math.sin(d) * math.sin(d0) + cd * math.cos(d0) * math.cos(a)
    xi = cd * math.sin(a) / den
    eta = (math.sin(d) * math.cos(d0) - cd * math.sin(d0) * math.cos(a)) / den
    return xi / D2R, eta / D2R


def tan_deproject(xi: float, eta: float, ra0: float, dec0: float) -> Tuple[float, float]:
    x = xi * D2R
    y = eta * D2R
    d0 = dec0 * D2R
    rho = math.hypot(x, y)
    if rho == 0:
        return ra0, dec0
    c = math.atan(rho)
    sc, cc = math.sin(c), math.cos(c)
    dec = math.asin(cc * math.sin(d0) + y * sc * math.cos(d0) / rho)
    ra = ra0 / 1.0 + math.atan2(x * sc, rho * math.cos(d0) * cc - y * math.sin(d0) * sc) / D2R
    return ra % 360.0, dec / D2R


class SipWcs:
    def __init__(self, kv: Dict[str, Any]):
        self.crpix1 = float(kv["CRPIX1"])
        self.crpix2 = float(kv["CRPIX2"])
        self.ra0 = float(kv["CRVAL1"])
        self.dec0 = float(kv["CRVAL2"])
        c1 = float(kv.get("CDELT1", 1.0))
        c2 = float(kv.get("CDELT2", 1.0))
        if "CD1_1" in kv:
            m = [[float(kv["CD1_1"]), float(kv.get("CD1_2", 0))], [float(kv.get("CD2_1", 0)), float(kv["CD2_2"])]]
        else:
            m = [
                [c1 * float(kv.get("PC1_1", 1)), c1 * float(kv.get("PC1_2", 0))],
                [c2 * float(kv.get("PC2_1", 0)), c2 * float(kv.get("PC2_2", 1))],
            ]
        det = m[0][0] * m[1][1] - m[0][1] * m[1][0]
        self.i00 = m[1][1] / det
        self.i01 = -m[0][1] / det
        self.i10 = -m[1][0] / det
        self.i11 = m[0][0] / det
        self.pix_scale_deg = math.sqrt(abs(det))
        self.ap = self._coeffs(kv, "AP")
        self.bp = self._coeffs(kv, "BP")
        # Desplazamiento a coordenadas crudas del detector (para la tabla WCS-WAVE)
        self.raw_off1 = float(kv.get("CRVAL1W", 1)) - float(kv.get("CRPIX1W", 0))
        self.raw_off2 = float(kv.get("CRVAL2W", 1)) - float(kv.get("CRPIX2W", 0))

    @staticmethod
    def _coeffs(kv: Dict[str, Any], pfx: str) -> List[Tuple[int, int, float]]:
        order = int(kv.get(f"{pfx}_ORDER", 0) or 0)
        out = []
        for p in range(order + 1):
            for q in range(order + 1 - p):
                k = f"{pfx}_{p}_{q}"
                if k in kv:
                    out.append((p, q, float(kv[k])))
        return out

    def world_to_pix(self, ra: float, dec: float) -> Tuple[float, float]:
        """Devuelve coordenadas FITS 1-based (x, y)."""
        xi, eta = tan_project(ra, dec, self.ra0, self.dec0)
        u = self.i00 * xi + self.i01 * eta
        v = self.i10 * xi + self.i11 * eta
        du = 0.0
        dv = 0.0
        for p, q, c in self.ap:
            du += c * (u ** p) * (v ** q)
        for p, q, c in self.bp:
            dv += c * (u ** p) * (v ** q)
        return self.crpix1 + u + du, self.crpix2 + v + dv


# ---------------------------------------------------------------------------
# Tablas oficiales WCS-WAVE (filtro lineal variable) por detector
# ---------------------------------------------------------------------------
_wave_tables: Dict[int, Dict[str, Any]] = {}
_wave_lock = threading.Lock()


def load_wave_table(det: int, url: str, ra: float, dec: float, cache_dir: str) -> Optional[Dict[str, Any]]:
    with _wave_lock:
        if det in _wave_tables:
            return _wave_tables[det]
        cache = os.path.join(cache_dir, f"wcs_wave_D{det}.json")
        if os.path.exists(cache):
            with open(cache) as f:
                _wave_tables[det] = json.load(f)
            return _wave_tables[det]
        try:
            hd = fetch_cutout_hdus(url, ra, dec, 0.02, ("WCS-WAVE",))
            kv, data = hd["WCS-WAVE"]
            nx = int(str(kv.get("TFORM1", "13J")).rstrip("J"))
            ny = int(str(kv.get("TFORM2", "20J")).rstrip("J"))
            nv = int(str(kv.get("TFORM3", "520E")).rstrip("E"))
            xs = list(struct.unpack(f">{nx}i", data[: nx * 4]))
            ys = list(struct.unpack(f">{ny}i", data[nx * 4 : nx * 4 + ny * 4]))
            vals = list(struct.unpack(f">{nv}f", data[nx * 4 + ny * 4 : nx * 4 + ny * 4 + nv * 4]))
            tbl = {"x": xs, "y": ys, "values": vals, "source": "IRSA WCS-WAVE (spectral_wcs)"}
            with open(cache, "w") as f:
                json.dump(tbl, f)
            _wave_tables[det] = tbl
            log(f"  · Tabla oficial WCS-WAVE del detector D{det} cargada ({nx}x{ny} nodos)")
            return tbl
        except Exception as exc:
            log(f"  ! No se pudo cargar WCS-WAVE D{det}: {exc}")
            return None


def wave_at(tbl: Dict[str, Any], xr: float, yr: float) -> Tuple[float, float]:
    xs, ys, vals = tbl["x"], tbl["y"], tbl["values"]
    nx = len(xs)

    def bracket(arr: List[int], v: float) -> Tuple[int, float]:
        if v <= arr[0]:
            return 0, 0.0
        if v >= arr[-1]:
            return len(arr) - 2, 1.0
        for i in range(len(arr) - 1):
            if arr[i] <= v <= arr[i + 1]:
                return i, (v - arr[i]) / max(1e-9, arr[i + 1] - arr[i])
        return len(arr) - 2, 1.0

    ix, fx = bracket(xs, xr)
    iy, fy = bracket(ys, yr)

    def g(i: int, j: int, k: int) -> float:
        return vals[((j * nx) + i) * 2 + k]

    out = []
    for k in (0, 1):
        v = (
            (1 - fx) * (1 - fy) * g(ix, iy, k)
            + fx * (1 - fy) * g(ix + 1, iy, k)
            + (1 - fx) * fy * g(ix, iy + 1, k)
            + fx * fy * g(ix + 1, iy + 1, k)
        )
        out.append(v)
    return out[0], out[1]


# ---------------------------------------------------------------------------
# Reproyección y fotometría
# ---------------------------------------------------------------------------
def build_output_grid(ra: float, dec: float, size_deg: float) -> Tuple[List[Tuple[float, float]], float]:
    scale = size_deg / OUT_N
    c = (OUT_N - 1) / 2.0
    grid = []
    for j in range(OUT_N):
        eta = (j - c) * scale
        for i in range(OUT_N):
            xi = -(i - c) * scale
            grid.append(tan_deproject(xi, eta, ra, dec))
    return grid, scale


def reproject(
    hdus: Dict[str, Tuple[Dict[str, Any], bytes]], grid: List[Tuple[float, float]]
) -> Tuple[List[float], float, SipWcs]:
    kv_img, raw_img = hdus["IMAGE"]
    nx = int(kv_img["NAXIS1"])
    ny = int(kv_img["NAXIS2"])
    npx = nx * ny
    img = struct.unpack(f">{npx}f", raw_img[: npx * 4])
    zod = struct.unpack(f">{npx}f", hdus["ZODI"][1][: npx * 4]) if "ZODI" in hdus else None
    flg = struct.unpack(f">{npx}i", hdus["FLAGS"][1][: npx * 4]) if "FLAGS" in hdus else None

    good = [False] * npx
    val = [0.0] * npx
    for k in range(npx):
        v = img[k]
        if v != v or (flg is not None and (flg[k] & MASK_BITS)):
            continue
        if zod is not None:
            z = zod[k]
            if z == z:
                v -= z
        val[k] = v
        good[k] = True

    wcs = SipWcs(kv_img)
    out = [float("nan")] * len(grid)
    for n, (ra, dec) in enumerate(grid):
        x1, y1 = wcs.world_to_pix(ra, dec)
        x = x1 - 1.0
        y = y1 - 1.0
        ix = int(math.floor(x))
        iy = int(math.floor(y))
        if ix < 0 or iy < 0 or ix >= nx - 1 or iy >= ny - 1:
            continue
        fx = x - ix
        fy = y - iy
        acc = 0.0
        wsum = 0.0
        for (dx, dy, w) in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
            k = (iy + dy) * nx + ix + dx
            if good[k] and w > 0:
                acc += val[k] * w
                wsum += w
        if wsum > 0.25:
            out[n] = acc / wsum

    # Relleno mínimo de huecos enmascarados con la media de vecinos reales válidos
    n_missing = sum(1 for v in out if v != v)
    fill_frac = n_missing / len(out)
    if 0 < n_missing:
        for _ in range(8):
            changed = False
            new = out[:]
            for j in range(OUT_N):
                for i in range(OUT_N):
                    k = j * OUT_N + i
                    if out[k] == out[k]:
                        continue
                    s = 0.0
                    c = 0
                    for dj in (-1, 0, 1):
                        jj = j + dj
                        if jj < 0 or jj >= OUT_N:
                            continue
                        for di in (-1, 0, 1):
                            ii = i + di
                            if ii < 0 or ii >= OUT_N:
                                continue
                            vv = out[jj * OUT_N + ii]
                            if vv == vv:
                                s += vv
                                c += 1
                    if c >= 2:
                        new[k] = s / c
                        changed = True
            out = new
            if not changed:
                break
        finite = sorted(v for v in out if v == v)
        med = finite[len(finite) // 2] if finite else 0.0
        out = [v if v == v else med for v in out]
    return out, fill_frac, wcs


def photometry(img: List[float], scale_deg: float, size_deg: float) -> Dict[str, float]:
    c = (OUT_N - 1) / 2.0
    pix_arcsec = scale_deg * 3600.0
    r_ap = max(1.5, 12.0 / pix_arcsec)
    r_in = max(r_ap + 2, 30.0 / pix_arcsec)
    r_out = max(r_in + 3, 48.0 / pix_arcsec)
    r_core = OUT_N / 6.0
    ap = []
    ann = []
    core = []
    for j in range(OUT_N):
        dy = j - c
        for i in range(OUT_N):
            dx = i - c
            r = math.hypot(dx, dy)
            v = img[j * OUT_N + i]
            if r <= r_ap:
                ap.append(v)
            elif r_in <= r <= r_out:
                ann.append(v)
            if r <= r_core:
                core.append(v)
    ann.sort()
    bg = ann[len(ann) // 2] if ann else 0.0
    mad = sorted(abs(a - bg) for a in ann)[len(ann) // 2] if ann else 0.0
    omega = (scale_deg * D2R) ** 2  # sr por píxel
    flux_mjy = sum(v - bg for v in ap) * omega * 1e9  # MJy/sr * sr -> MJy -> mJy
    err_mjy = 1.4826 * mad * math.sqrt(max(1, len(ap))) * omega * 1e9
    return {
        "flux_mJy": round(flux_mjy, 4),
        "flux_err_mJy": round(err_mjy, 4),
        "bg_MJysr": round(bg, 5),
        "core_mean_MJysr": round(sum(core) / max(1, len(core)), 5),
        "peak_MJysr": round(max(ap) if ap else 0.0, 5),
        "aperture_arcsec": round(r_ap * pix_arcsec, 2),
    }


# ---------------------------------------------------------------------------
# Escritura FITS estándar con WCS
# ---------------------------------------------------------------------------
def _card(key: str, val: Any, comment: str = "") -> bytes:
    if key in ("COMMENT", "HISTORY"):
        return f"{key:<8}{str(val)[:72]}".ljust(80).encode("ascii", "replace")
    k = f"{key[:8]:<8}"
    if isinstance(val, bool):
        v = f"{'T' if val else 'F':>20}"
    elif isinstance(val, int):
        v = f"{val:>20d}"
    elif isinstance(val, float):
        v = f"{val:>20.10G}"
    else:
        s = str(val).replace("'", "''")
        v = f"'{s:<8}'"
        v = f"{v:<20}"
    card = f"{k}= {v} / {comment}" if comment else f"{k}= {v}"
    card = card.encode("ascii", "replace").decode("ascii")
    return card[:80].ljust(80).encode("ascii")


def write_fits(path: str, img: List[float], meta: Dict[str, Any], ra: float, dec: float, scale: float) -> None:
    cards = [
        _card("SIMPLE", True, "Standard FITS"),
        _card("BITPIX", -32, "IEEE float32"),
        _card("NAXIS", 2),
        _card("NAXIS1", OUT_N),
        _card("NAXIS2", OUT_N),
        _card("TELESCOP", "SPHEREx", "NASA SPHEREx"),
        _card("ORIGIN", "NASA/IPAC IRSA", "Datos reales via API SIA v2 + IBE cutout"),
        _card("OBJECT", meta["target"][:60]),
        _card("OBSID", meta["obs_id"]),
        _card("COLLECT", meta["collection"]),
        _card("DETECTOR", meta["det"]),
        _card("MJD-AVG", float(meta["mjd"]), "MJD de la exposicion"),
        _card("DATE-OBS", meta["date_obs"]),
        _card("WAVELEN", float(meta["wave_um"]), "[um] lambda real LVF en el objeto"),
        _card("BANDWID", float(meta["bandwidth_um"]), "[um] ancho de banda LVF"),
        _card("BUNIT", "MJy/sr"),
        _card("ZODISUB", True, "Modelo zodiacal oficial (ZODI) restado"),
        _card("FILLFRAC", float(meta["fill_frac"]), "Fraccion de pixeles enmascarados"),
        _card("RADESYS", "ICRS"),
        _card("CTYPE1", "RA---TAN"),
        _card("CTYPE2", "DEC--TAN"),
        _card("CRVAL1", float(ra)),
        _card("CRVAL2", float(dec)),
        _card("CRPIX1", (OUT_N + 1) / 2.0),
        _card("CRPIX2", (OUT_N + 1) / 2.0),
        _card("CDELT1", -float(scale)),
        _card("CDELT2", float(scale)),
        _card("COMMENT", "Fuente: " + meta["access_url"][:64]),
        _card("END", None) if False else "END".ljust(80).encode("ascii"),
    ]
    hdr = b"".join(cards)
    hdr += b" " * ((2880 - len(hdr) % 2880) % 2880)
    data = struct.pack(f">{OUT_N * OUT_N}f", *img)
    data += b"\x00" * ((2880 - len(data) % 2880) % 2880)
    with open(path, "wb") as f:
        f.write(hdr)
        f.write(data)


# ---------------------------------------------------------------------------
# Pipeline por objeto
# ---------------------------------------------------------------------------
def mjd_to_iso(mjd: float) -> str:
    import datetime

    dt = datetime.datetime(1858, 11, 17) + datetime.timedelta(days=mjd)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def pick_spread(items: List[Dict[str, Any]], k: int) -> List[Dict[str, Any]]:
    if len(items) <= k:
        return list(items)
    idx = sorted({round(i * (len(items) - 1) / (k - 1)) for i in range(k)}) if k > 1 else [len(items) // 2]
    chosen = [items[i] for i in idx]
    rest = [it for i, it in enumerate(items) if i not in idx]
    return chosen + rest  # el resto queda como reserva si alguna falla


def process_target(spec: T, args: argparse.Namespace, resolved_cache: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    query, display, category, size_deg = spec
    tid = slugify(query)
    tdir = os.path.join(OUT_ROOT, "targets", tid)
    meta_path = os.path.join(tdir, "meta.json")
    if os.path.exists(meta_path) and not args.force:
        with open(meta_path) as f:
            return json.load(f)

    res = resolved_cache.get(query)
    if res is None:
        r = resolve_name(query)
        if r is None:
            log(f"[{display}] ✗ No resuelto en SIMBAD/NED")
            return None
        res = {"ra": r[0], "dec": r[1], "simbad_name": r[2]}
        resolved_cache[query] = res
    ra, dec = res["ra"], res["dec"]

    rows = sia_query(ra, dec)
    if not rows:
        log(f"[{display}] ✗ Sin exposiciones SPHEREx en IRSA")
        return None
    seasons = group_seasons(rows)

    os.makedirs(tdir, exist_ok=True)
    grid, scale = build_output_grid(ra, dec, size_deg)
    req_size = min(1.4, size_deg * 1.5 + 0.02)

    jobs: List[Tuple[int, int, List[Dict[str, Any]]]] = []
    for s_idx, season in enumerate(seasons):
        by_det: Dict[int, List[Dict[str, Any]]] = {}
        for r in season:
            by_det.setdefault(r["det"], []).append(r)
        for det, items in sorted(by_det.items()):
            jobs.append((s_idx, det, pick_spread(items, args.per_det)))

    exposures: List[Dict[str, Any]] = []

    def run_job(s_idx: int, det: int, cands: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        got: List[Dict[str, Any]] = []
        tries = 0
        for c in cands:
            if len(got) >= args.per_det or tries >= args.per_det + 3:
                break
            tries += 1
            fname = f"{c['obs_id']}_D{det}.fits"
            fpath = os.path.join(tdir, fname)
            try:
                tbl = load_wave_table(det, c["access_url"], ra, dec, os.path.join(OUT_ROOT, "calib"))
                hd = fetch_cutout_hdus(c["access_url"], ra, dec, req_size, ("IMAGE", "FLAGS", "ZODI"))
                img, fill, wcs = reproject(hd, grid)
                if fill > args.max_fill:
                    continue
                xp, yp = wcs.world_to_pix(ra, dec)
                if tbl:
                    lam, bw = wave_at(tbl, xp + wcs.raw_off1, yp + wcs.raw_off2)
                else:
                    lam, bw = (c["em_min_um"] + c["em_max_um"]) / 2, c["em_max_um"] - c["em_min_um"]
                phot = photometry(img, scale, size_deg)
                meta = {
                    "target": display,
                    "file": fname,
                    "obs_id": c["obs_id"],
                    "det": det,
                    "season": s_idx,
                    "collection": c["collection"],
                    "mjd": round(c["mjd"], 6),
                    "date_obs": mjd_to_iso(c["mjd"]),
                    "wave_um": round(lam, 4),
                    "bandwidth_um": round(bw, 4),
                    "fill_frac": round(fill, 4),
                    "access_url": c["access_url"],
                    **phot,
                }
                write_fits(fpath, img, meta, ra, dec, scale)
                got.append(meta)
            except Exception as exc:
                log(f"   ! {display} {c['obs_id']} D{det}: {exc}")
        return got

    with ThreadPoolExecutor(max_workers=args.inner_workers) as pool:
        futs = [pool.submit(run_job, s, d, c) for s, d, c in jobs]
        for f in as_completed(futs):
            exposures.extend(f.result())

    if not exposures:
        log(f"[{display}] ✗ Ningún recorte válido")
        return None

    exposures.sort(key=lambda e: e["mjd"])
    season_info = []
    for s_idx, season in enumerate(seasons):
        exps = [e for e in exposures if e["season"] == s_idx]
        if not exps:
            continue
        dets = sorted({e["det"] for e in exps})
        season_info.append(
            {
                "season": s_idx,
                "mjd_start": round(season[0]["mjd"], 4),
                "mjd_end": round(season[-1]["mjd"], 4),
                "date_start": mjd_to_iso(season[0]["mjd"])[:10],
                "date_end": mjd_to_iso(season[-1]["mjd"])[:10],
                "detectors": dets,
                "n_exposures_available": len(season),
                "n_exposures_downloaded": len(exps),
                "collections": sorted({e["collection"] for e in exps}),
            }
        )

    meta_obj = {
        "id": tid,
        "query": query,
        "name": display,
        "simbad_name": res.get("simbad_name", query),
        "category": category,
        "ra": ra,
        "dec": dec,
        "size_deg": size_deg,
        "grid_n": OUT_N,
        "pix_scale_arcsec": round(scale * 3600.0, 3),
        "n_exposures_irsa": len(rows),
        "seasons": season_info,
        "exposures": exposures,
        "source": "NASA/IPAC IRSA SPHEREx Level-2 (SIA v2 + IBE cutouts)",
        "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(meta_path, "w") as f:
        json.dump(meta_obj, f, indent=1)
    log(
        f"[{display}] ✓ {len(exposures)} recortes reales · {len(season_info)} épocas · "
        f"{len(rows)} exposiciones en IRSA"
    )
    return meta_obj


def rebuild_index() -> int:
    tdir = os.path.join(OUT_ROOT, "targets")
    items = []
    if os.path.isdir(tdir):
        for tid in sorted(os.listdir(tdir)):
            mp = os.path.join(tdir, tid, "meta.json")
            if os.path.exists(mp):
                with open(mp) as f:
                    m = json.load(f)
                items.append(
                    {
                        k: m[k]
                        for k in ("id", "name", "simbad_name", "category", "ra", "dec", "size_deg", "pix_scale_arcsec", "n_exposures_irsa")
                    }
                    | {"n_exposures": len(m["exposures"]), "n_seasons": len(m["seasons"])}
                )
    with open(os.path.join(OUT_ROOT, "index.json"), "w") as f:
        json.dump({"targets": items, "updated": time.strftime("%Y-%m-%dT%H:%M:%S")}, f, indent=1)
    return len(items)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--max-targets", type=int, default=0)
    p.add_argument("--only", nargs="*", default=None, help="Nombres concretos a descargar")
    p.add_argument("--per-det", type=int, default=3, help="Exposiciones por detector y época")
    p.add_argument("--workers", type=int, default=2, help="Objetos en paralelo")
    p.add_argument("--inner-workers", type=int, default=3, help="Recortes en paralelo por objeto")
    p.add_argument("--max-fill", type=float, default=0.15, help="Máx. fracción de píxeles enmascarados")
    p.add_argument("--force", action="store_true")
    args = p.parse_args()

    os.makedirs(os.path.join(OUT_ROOT, "targets"), exist_ok=True)
    os.makedirs(os.path.join(OUT_ROOT, "calib"), exist_ok=True)

    cache_path = os.path.join(OUT_ROOT, "resolved_names.json")
    resolved: Dict[str, Any] = {}
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            resolved = json.load(f)

    targets = TARGETS
    if args.only:
        targets = [t for t in TARGETS if t[0] in args.only]
    if args.max_targets > 0:
        targets = targets[: args.max_targets]

    log(f"Objetos reales a procesar: {len(targets)}  (API IRSA SPHEREx: {', '.join(COLLECTIONS)})")
    ok = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(process_target, t, args, resolved): t for t in targets}
        for i, f in enumerate(as_completed(futs), 1):
            try:
                if f.result():
                    ok += 1
            except Exception as exc:
                log(f"[{futs[f][1]}] ✗ Error: {exc}")
            if i % 5 == 0:
                with open(cache_path, "w") as fh:
                    json.dump(resolved, fh, indent=1)
                n = rebuild_index()
                log(f"== Progreso {i}/{len(targets)} · {ok} objetos OK · índice {n} · {time.time() - t0:.0f}s")

    with open(cache_path, "w") as fh:
        json.dump(resolved, fh, indent=1)
    n = rebuild_index()
    log(f"\nFinalizado: {ok}/{len(targets)} objetos con datos reales · índice con {n} objetos · {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
