# SPHEREx Spectral Color Composite Visualizer & Live IRSA Explorer

An interactive web application for visualizing **NASA SPHEREx** (*Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer*) Multi-Extension FITS (MEF) data across its 6 Linear Variable Filter (LVF) near-infrared bands ($0.75 - 5.0\ \mu\text{m}$).

## Quick Start

```bash
python3 -m pip install -r requirements.txt
python3 server.py --port 8765
```

Then open **http://127.0.0.1:8765** in your browser.

In KRONOX, the 102-channel DR1 explorer is opened from the SPHEREx mission's **Imágenes** stage. Its embedded viewer queries this local service for the real FITS catalog, HiPS tiles, and IRSA products. The repository does not include downloaded observation caches or the generated demonstration FITS files; the server queries public IRSA products on demand.

---

## Can We Fetch SPHEREx Data Online, or Do We Have to Download It?

**Both are supported:**
1. **Live Online Fetching (No Manual Download Needed):**
   - Click **🛰️ Fetch Live IRSA Data** in the top bar to query the **NASA/IPAC Infrared Science Archive (IRSA)** via the IVOA **Simple Image Access (SIA v2)** API (`https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1&POS=circle+...`).
   - Because full SPHEREx Level 2 MEF detector frames ($2040 \times 2040 \times 6$ extensions) can be large, the visualizer uses **IRSA's On-the-Fly Cutout Service** (`?center=RA,DEC&size=DEG`) to stream compact spatial cutouts directly into the viewer.
   - Target names (e.g., `M42`, `NGC 7023`, `Carina`, `30 Dor`, `M82`) are resolved automatically via **CDS Sesame (SIMBAD/NED)** or the built-in SPHEREx catalog.
   - All SPHEREx public data releases are also mirrored on AWS S3 at `s3://nasa-irsa-spherex/` (`--no-sign-request`).
2. **Local FITS Upload & Pre-Loaded Sample Suites:**
   - Click **📂 Load Local FITS** to open one or more `.fits`, `.fit`, or `.fits.gz` files from disk.
   - On first startup, `fits_engine.py` generates three 6-band SPHEREx Level 2 Multi-Extension FITS suites in `data/` (**Orion M42**, **Carina NGC 3372**, and **SPHEREx North Ecliptic Pole Deep Field**) so you can explore multi-band color composites and spectra immediately offline.

---

## Features

- **3 Composite & Inspection Modes:**
  - **Multi-Band RGB Composite:** Map any of the 6 SPHEREx LVF bands (`Band 1: 0.75–1.11 µm` through `Band 6: 4.42–5.00 µm`) to Red, Green, and Blue channels, or use 1-click scientific presets (*PAH 3.3 µm & Warm Dust*, *H₂O / CO₂ Ice Absorption*, *Near-IR Continuum*, *Full Spectral Span*).
  - **Single-MEF Layer Composite:** Blend or compare the extensions inside a single SPHEREx Level 2 MEF file (`HDU 1: IMAGE`, `HDU 4: ZODI`, `IMAGE − ZODI`, `HDU 3: VARIANCE`, and `HDU 2: FLAGS`).
  - **Single-Band False-Color Map:** Inspect individual bands or extensions using `Inferno`, `Viridis`, `Magma`, `Coolwarm`, or `Grayscale` colormaps.
- **Astronomical Stretch & Calibration:**
  - **Lupton Asinh Color-Preserving RGB** stretch, per-channel Asinh, Logarithmic, Square Root, and Linear stretches.
  - Real-time **Zodiacal Light Subtraction (`IMAGE − ZODI`)** and **Cosmic Ray Bitmask Filtering** (Bit 0 `TRANSIENT` in `HDU 2: FLAGS`).
- **Interactive 0.75–5.0 µm Spectrophotometer:**
  - Click any star, protostar, dust pillar, or galaxy to extract its 6-band SPHEREx Spectral Energy Distribution (SED) in $\text{MJy/sr}$ with $\pm 1\sigma$ uncertainty bars and infrared diagnostic markers ($\text{Pa}\alpha$, $\text{H}_2\text{O}$ ice $3.05\ \mu\text{m}$, $\text{PAH}\ 3.29\ \mu\text{m}$, $\text{CO}_2$ ice $4.27\ \mu\text{m}$, $\text{CO}\ 4.67\ \mu\text{m}$).
