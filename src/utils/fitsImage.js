const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Official NASA SPHEREx detector bandpass definitions (in microns).
 * D1-D3: Short-Wavelength Infrared (SWIR); D4-D6: Mid-Wavelength Infrared (MWIR).
 */
export const SPHEREX_DETECTOR_SPECS = {
  1: { band: 'SPHEREx-D1', label: 'D1', minUm: 0.75, maxUm: 1.09, regime: 'SWIR' },
  2: { band: 'SPHEREx-D2', label: 'D2', minUm: 1.1, maxUm: 1.62, regime: 'SWIR' },
  3: { band: 'SPHEREx-D3', label: 'D3', minUm: 1.63, maxUm: 2.41, regime: 'SWIR' },
  4: { band: 'SPHEREx-D4', label: 'D4', minUm: 2.42, maxUm: 3.82, regime: 'MWIR' },
  5: { band: 'SPHEREx-D5', label: 'D5', minUm: 3.83, maxUm: 4.41, regime: 'MWIR' },
  6: { band: 'SPHEREx-D6', label: 'D6', minUm: 4.42, maxUm: 5.0, regime: 'MWIR' },
};

/**
 * Complete NASA SPHEREx L2 spectral image bitmask definitions (HDU 2: FLAGS),
 * harmonized across QR2 (l2b-v20..v25 `MP_*` cards) and QR3 (l2b-v27+ `MSKN*` / `MSKM*` cards).
 * Note: Use unsigned 32-bit shifts (`>>> 0`) for bits >= 28.
 */
export const SPHEREX_FLAG_BITS = {
  MP_TRANSIENT: (1 << 0) >>> 0, // Bit 0: Transient / cosmic ray detected during SUR
  MP_OVERFLOW: (1 << 1) >>> 0, // Bit 1: Pixel overflow / saturation during exposure
  MP_SUR_ERROR: (1 << 2) >>> 0, // Bit 2: Error in onboard Sample-Up-the-Ramp processing
  MP_PHANTOM: (1 << 4) >>> 0, // Bit 4: Electronic phantom pixel (v20-v25)
  MP_REFERENCE: (1 << 5) >>> 0, // Bit 5: Detector reference pixel (not sky-sensitive)
  MP_NONFUNC: (1 << 6) >>> 0, // Bit 6: Permanently unusable / dead pixel
  MP_DICHROIC: (1 << 7) >>> 0, // Bit 7: Low efficiency due to dichroic transition
  MP_MISSING_DATA: (1 << 9) >>> 0, // Bit 9: Onboard telemetry data lost
  MP_HOT: (1 << 10) >>> 0, // Bit 10: Hot pixel
  MP_COLD: (1 << 11) >>> 0, // Bit 11: Anomalously low signal / cold pixel
  MP_FULLSAMPLE: (1 << 12) >>> 0, // Bit 12: Pixel full sample history is available (informational)
  MP_PHANMISS: (1 << 14) >>> 0, // Bit 14: Phantom frame correction was not applied
  MP_NONLINEAR: (1 << 15) >>> 0, // Bit 15: Nonlinearity correction cannot be applied reliably
  MP_PERSIST: (1 << 17) >>> 0, // Bit 17: Persistent charge above threshold
  MP_OUTLIER: (1 << 19) >>> 0, // Bit 19: Pixel flagged by Detect Outliers in L2 pipeline
  MP_CROSSTALK: (1 << 20) >>> 0, // Bit 20: Pixel affected by electronic crosstalk (v27+)
  MP_SOURCE: (1 << 21) >>> 0, // Bit 21: Pixel mapped to a known celestial source
  MP_GHOST: (1 << 22) >>> 0, // Bit 22: Affected by an optical ghost from a bright source inside exposure
  MP_GHOST_FPA: (1 << 23) >>> 0, // Bit 23: Affected by a ghost from a bright source on another detector
  MP_GHOST_EXT: (1 << 24) >>> 0, // Bit 24: Affected by a ghost from a bright source outside FOV
  MP_STREAK: (1 << 25) >>> 0, // Bit 25: Pixel affected by a satellite / moving-object streak
  MP_BLOOM: (1 << 26) >>> 0, // Bit 26: Pixel part of a saturation bloom artifact
  MP_SNOWBALL: (1 << 27) >>> 0, // Bit 27: Pixel part of a cosmic-ray snowball artifact
  MP_HALO: (1 << 28) >>> 0, // Bit 28: Pixel part of a transient / satellite halo
  MP_SATELLITE_HALO: (1 << 28) >>> 0, // Alias for Bit 28 (MP_HALO / transient or satellite halo)
};

/**
 * Category A — Instrumental Exclusion Mask:
 * Pixels that are physically non-sky-sensitive, missing telemetry, or permanently defective
 * (SUR_ERROR, PHANTOM, REFERENCE, NONFUNC, MISSING_DATA, HOT, COLD).
 * Always excluded from scientific measurements and bilinear interpolation.
 */
export const CATEGORY_A_INSTRUMENTAL_MASK =
  (SPHEREX_FLAG_BITS.MP_SUR_ERROR |
    SPHEREX_FLAG_BITS.MP_PHANTOM |
    SPHEREX_FLAG_BITS.MP_REFERENCE |
    SPHEREX_FLAG_BITS.MP_NONFUNC |
    SPHEREX_FLAG_BITS.MP_MISSING_DATA |
    SPHEREX_FLAG_BITS.MP_HOT |
    SPHEREX_FLAG_BITS.MP_COLD) >>>
  0;

/**
 * Category B — Quality Warning Mask:
 * Pixels with degraded photometric linearity, saturation, dichroic edge attenuation,
 * persistence, crosstalk, optical ghosts, blooms, snowballs, or halos.
 * Preserved visually so bright star cores and faint surroundings do not turn into hollow NaN holes,
 * but flagged with explicit reliability warnings for photometric measurements.
 */
export const CATEGORY_B_QUALITY_WARNING_MASK =
  (SPHEREX_FLAG_BITS.MP_OVERFLOW |
    SPHEREX_FLAG_BITS.MP_DICHROIC |
    SPHEREX_FLAG_BITS.MP_PHANMISS |
    SPHEREX_FLAG_BITS.MP_NONLINEAR |
    SPHEREX_FLAG_BITS.MP_PERSIST |
    SPHEREX_FLAG_BITS.MP_CROSSTALK |
    SPHEREX_FLAG_BITS.MP_GHOST |
    SPHEREX_FLAG_BITS.MP_GHOST_FPA |
    SPHEREX_FLAG_BITS.MP_GHOST_EXT |
    SPHEREX_FLAG_BITS.MP_BLOOM |
    SPHEREX_FLAG_BITS.MP_SNOWBALL |
    SPHEREX_FLAG_BITS.MP_HALO) >>>
  0;

/**
 * Category C — Transient / Anomaly Candidate Mask:
 * Pixels flagged as SUR transients, multi-epoch pipeline outliers, or streaks
 * (`MP_TRANSIENT`, `MP_OUTLIER`, `MP_STREAK`).
 * - In 'measurement' mode: excluded from background/photometric interpolation so cosmic rays do not corrupt flux.
 * - In 'discovery' mode: preserved in the image and highlighted with their candidate flags so fast-moving
 *   or uncatalogued transient sources are never silently erased.
 */
export const CATEGORY_C_CANDIDATE_ANOMALY_MASK =
  (SPHEREX_FLAG_BITS.MP_TRANSIENT |
    SPHEREX_FLAG_BITS.MP_OUTLIER |
    SPHEREX_FLAG_BITS.MP_STREAK) >>>
  0;

/**
 * Default exclusion mask for 'measurement' mode (Category A + Category C + severe non-linear pixels).
 */
export const SEVERE_CONTAMINATION_MASK =
  (CATEGORY_A_INSTRUMENTAL_MASK |
    CATEGORY_C_CANDIDATE_ANOMALY_MASK |
    SPHEREX_FLAG_BITS.MP_NONLINEAR |
    SPHEREX_FLAG_BITS.MP_SNOWBALL) >>>
  0;

export function decodeSpherexFlags(mask) {
  const numeric = Number(mask) >>> 0;
  if (!numeric) return [];
  const active = [];
  for (const [name, bit] of Object.entries(SPHEREX_FLAG_BITS)) {
    if (name === 'MP_SATELLITE_HALO') continue; // avoid duplicate alias with MP_HALO
    if ((numeric & (bit >>> 0)) !== 0) active.push(name);
  }
  return active;
}

export function classifyPixelFlags(mask) {
  const numeric = Number(mask) >>> 0;
  return {
    mask: numeric,
    flags: decodeSpherexFlags(numeric),
    hasCategoryAInstrumental: (numeric & CATEGORY_A_INSTRUMENTAL_MASK) !== 0,
    hasCategoryBWarning: (numeric & CATEGORY_B_QUALITY_WARNING_MASK) !== 0,
    hasCategoryCCandidate: (numeric & CATEGORY_C_CANDIDATE_ANOMALY_MASK) !== 0,
    isKnownSource: (numeric & SPHEREX_FLAG_BITS.MP_SOURCE) !== 0,
  };
}

/**
 * Parses dynamic flag definitions directly from HDU 2 header cards:
 * supports both QR2 (`MP_TRANSIENT = 0`) and QR3 (`MSKN0000 = 'TRANSIENT'`, `MSKM0000 = 1`).
 */
export function parseHeaderFlagDefinitions(hdu2Values = {}) {
  const defs = {};
  for (const [key, val] of Object.entries(hdu2Values)) {
    if (key.startsWith('MP_')) {
      const bit = Number(val);
      if (Number.isInteger(bit) && bit >= 0 && bit < 32) {
        defs[key] = { bit, mask: (1 << bit) >>> 0 };
      }
    } else if (key.startsWith('MSKN')) {
      const indexStr = key.slice(4);
      const bit = Number.parseInt(indexStr, 10);
      const name = `MP_${String(val).trim().toUpperCase()}`;
      const maskVal = Number(hdu2Values[`MSKM${indexStr}`] ?? (1 << bit));
      if (Number.isInteger(bit) && bit >= 0 && bit < 32) {
        defs[name] = {
          bit,
          mask: maskVal >>> 0,
          description: hdu2Values[`MSKD${indexStr}`] || '',
        };
      }
    }
  }
  return defs;
}

export function parseWcs(values) {
  if (!values) return null;
  const crpix1 = Number(values.CRPIX1);
  const crpix2 = Number(values.CRPIX2);
  const crval1 = Number(values.CRVAL1);
  const crval2 = Number(values.CRVAL2);
  if (
    !Number.isFinite(crpix1) ||
    !Number.isFinite(crpix2) ||
    !Number.isFinite(crval1) ||
    !Number.isFinite(crval2)
  ) {
    return null;
  }

  const cdelt1 = Number(values.CDELT1 ?? 1);
  const cdelt2 = Number(values.CDELT2 ?? 1);
  const hasCd =
    values.CD1_1 !== undefined ||
    values.CD1_2 !== undefined ||
    values.CD2_1 !== undefined ||
    values.CD2_2 !== undefined;
  const cd11 = hasCd ? Number(values.CD1_1 || 0) : cdelt1 * Number(values.PC1_1 ?? 1);
  const cd12 = hasCd ? Number(values.CD1_2 || 0) : cdelt1 * Number(values.PC1_2 ?? 0);
  const cd21 = hasCd ? Number(values.CD2_1 || 0) : cdelt2 * Number(values.PC2_1 ?? 0);
  const cd22 = hasCd ? Number(values.CD2_2 || 0) : cdelt2 * Number(values.PC2_2 ?? 1);

  const det = cd11 * cd22 - cd12 * cd21;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-25) {
    return null;
  }
  const inv11 = cd22 / det;
  const inv12 = -cd12 / det;
  const inv21 = -cd21 / det;
  const inv22 = cd11 / det;

  const readSip = (prefix, orderKey) => {
    const order = Number(values[orderKey] ?? -1);
    if (!Number.isFinite(order) || order < 0) return null;
    const terms = [];
    for (let p = 0; p <= order; p++) {
      for (let q = 0; q <= order - p; q++) {
        const coeff = Number(values[`${prefix}_${p}_${q}`] || 0);
        if (coeff !== 0) terms.push({ p, q, coeff });
      }
    }
    return terms.length ? terms : null;
  };

  const aSip = readSip('A', 'A_ORDER');
  const bSip = readSip('B', 'B_ORDER');
  const apSip = readSip('AP', 'AP_ORDER');
  const bpSip = readSip('BP', 'BP_ORDER');

  const evalSip = (terms, u, v) => {
    if (!terms) return 0;
    let sum = 0;
    for (let i = 0; i < terms.length; i++) {
      const { p, q, coeff } = terms[i];
      let powU = 1;
      for (let k = 0; k < p; k++) powU *= u;
      let powV = 1;
      for (let k = 0; k < q; k++) powV *= v;
      sum += coeff * powU * powV;
    }
    return sum;
  };

  const alpha0 = crval1 * DEG2RAD;
  const delta0 = crval2 * DEG2RAD;
  const sinD0 = Math.sin(delta0);
  const cosD0 = Math.cos(delta0);

  const pixelToWorld = (xFits, yFits) => {
    const u = xFits - crpix1;
    const v = yFits - crpix2;
    const uPrime = u + evalSip(aSip, u, v);
    const vPrime = v + evalSip(bSip, u, v);
    const xi = (cd11 * uPrime + cd12 * vPrime) * DEG2RAD;
    const eta = (cd21 * uPrime + cd22 * vPrime) * DEG2RAD;
    const denom = cosD0 - eta * sinD0;
    const raRad = alpha0 + Math.atan2(xi, denom);
    const decRad = Math.atan2(sinD0 + eta * cosD0, Math.hypot(xi, denom));
    return {
      ra: (((raRad * RAD2DEG) % 360) + 360) % 360,
      dec: decRad * RAD2DEG,
    };
  };

  const worldToPixel = (ra, dec) => {
    const alpha = ra * DEG2RAD;
    const delta = dec * DEG2RAD;
    const dAlpha = alpha - alpha0;
    const sinD = Math.sin(delta);
    const cosD = Math.cos(delta);
    const cosDcosA = cosD * Math.cos(dAlpha);
    const denom = sinD * sinD0 + cosDcosA * cosD0;
    if (denom <= 0) return null;
    const xi = ((cosD * Math.sin(dAlpha)) / denom) * RAD2DEG;
    const eta = ((sinD * cosD0 - cosDcosA * sinD0) / denom) * RAD2DEG;
    const uPrime = inv11 * xi + inv12 * eta;
    const vPrime = inv21 * xi + inv22 * eta;

    let u = uPrime + evalSip(apSip, uPrime, vPrime);
    let v = vPrime + evalSip(bpSip, uPrime, vPrime);
    if (aSip || bSip) {
      for (let iter = 0; iter < 3; iter++) {
        const fu = u + evalSip(aSip, u, v) - uPrime;
        const fv = v + evalSip(bSip, u, v) - vPrime;
        u -= fu;
        v -= fv;
      }
    }
    return { xFits: u + crpix1, yFits: v + crpix2 };
  };

  const pixelScaleDeg = Math.sqrt(Math.abs(det));
  const rotationDeg = Math.atan2(cd12, -cd11) * RAD2DEG;

  const crpix1w = Number(values.CRPIX1W ?? 0);
  const crpix2w = Number(values.CRPIX2W ?? 0);

  return {
    crpix1,
    crpix2,
    crval1,
    crval2,
    cd11,
    cd12,
    cd21,
    cd22,
    crpix1w,
    crpix2w,
    ctype1: values.CTYPE1 || 'RA---TAN',
    ctype2: values.CTYPE2 || 'DEC--TAN',
    hasSip: Boolean(aSip || bSip),
    aSip,
    bSip,
    cdMatrix: [
      [cd11, cd12],
      [cd21, cd22],
    ],
    pixelScaleDeg,
    pixelScaleArcsec: pixelScaleDeg * 3600,
    rotationDeg,
    pixelToWorld,
    worldToPixel,
  };
}

/**
 * Computes the analytical local Jacobian of the WCS transformation, including SIP distortion polynomials:
 *   J_total = 3600 * CD * J_SIP (in arcseconds per pixel)
 *
 * @param {object} wcs - Parsed WCS object from parseWcs
 * @param {number} xFits - FITS 1-based X coordinate
 * @param {number} yFits - FITS 1-based Y coordinate
 * @returns {object} Analytical Jacobian matrix, component scales and norms
 */
export function computeLocalWcsJacobian(wcs, xFits, yFits) {
  if (!wcs) return null;
  const u = xFits - wcs.crpix1;
  const v = yFits - wcs.crpix2;

  let dfa_du = 0.0, dfa_dv = 0.0;
  if (wcs.aSip) {
    for (let i = 0; i < wcs.aSip.length; i++) {
      const { p, q, coeff } = wcs.aSip[i];
      if (p > 0) dfa_du += coeff * p * Math.pow(u, p - 1) * Math.pow(v, q);
      if (q > 0) dfa_dv += coeff * q * Math.pow(u, p) * Math.pow(v, q - 1);
    }
  }

  let dfb_du = 0.0, dfb_dv = 0.0;
  if (wcs.bSip) {
    for (let i = 0; i < wcs.bSip.length; i++) {
      const { p, q, coeff } = wcs.bSip[i];
      if (p > 0) dfb_du += coeff * p * Math.pow(u, p - 1) * Math.pow(v, q);
      if (q > 0) dfb_dv += coeff * q * Math.pow(u, p) * Math.pow(v, q - 1);
    }
  }

  const jSip11 = 1.0 + dfa_du;
  const jSip12 = dfa_dv;
  const jSip21 = dfb_du;
  const jSip22 = 1.0 + dfb_dv;

  const cd11 = wcs.cd11;
  const cd12 = wcs.cd12;
  const cd21 = wcs.cd21;
  const cd22 = wcs.cd22;

  // Linear Jacobian (no SIP): 3600 * CD (in arcseconds per pixel)
  const J_linear = [
    [3600.0 * cd11, 3600.0 * cd12],
    [3600.0 * cd21, 3600.0 * cd22],
  ];

  // Tangent-plane Jacobian with SIP: 3600 * CD * J_SIP (in arcseconds per pixel)
  const J_tangent = [
    [3600.0 * (cd11 * jSip11 + cd12 * jSip21), 3600.0 * (cd11 * jSip12 + cd12 * jSip22)],
    [3600.0 * (cd21 * jSip11 + cd22 * jSip21), 3600.0 * (cd21 * jSip12 + cd22 * jSip22)],
  ];

  // Full celestial spherical Jacobian incorporating the gnomic projection tensor J_proj:
  // J_total = J_proj * J_tangent
  const evalSipVal = (terms, uu, vv) => {
    if (!terms) return 0;
    let sum = 0;
    for (let i = 0; i < terms.length; i++) {
      const { p, q, coeff } = terms[i];
      let powU = 1, powV = 1;
      for (let k = 0; k < p; k++) powU *= uu;
      for (let k = 0; k < q; k++) powV *= vv;
      sum += coeff * powU * powV;
    }
    return sum;
  };

  const up = u + evalSipVal(wcs.aSip, u, v);
  const vp = v + evalSipVal(wcs.bSip, u, v);
  const xiDeg = cd11 * up + cd12 * vp;
  const etaDeg = cd21 * up + cd22 * vp;

  const xi = xiDeg * DEG2RAD;
  const eta = etaDeg * DEG2RAD;
  const delta0 = wcs.crval2 * DEG2RAD;

  const denom = Math.cos(delta0) - eta * Math.sin(delta0);
  const R2 = xi * xi + denom * denom;
  const rho = Math.sqrt(R2);
  const num = Math.sin(delta0) + eta * Math.cos(delta0);

  const dra_dxi = denom / R2;
  const dra_deta = (xi * Math.sin(delta0)) / R2;

  const sec2Dec = 1.0 + (num / rho) * (num / rho);
  const ddec_dxi = (-num * xi / (rho * rho * rho)) / sec2Dec;
  const ddec_deta = ((Math.cos(delta0) * rho + (num * denom * Math.sin(delta0)) / rho) / (rho * rho)) / sec2Dec;

  const cWorld = wcs.pixelToWorld(xFits, yFits);
  const cosDec = Math.cos(cWorld.dec * DEG2RAD);

  const jProj11 = cosDec * dra_dxi;
  const jProj12 = cosDec * dra_deta;
  const jProj21 = ddec_dxi;
  const jProj22 = ddec_deta;

  // Complete spherical Jacobian J_total: J_proj * J_tangent
  const J_total = [
    [jProj11 * J_tangent[0][0] + jProj12 * J_tangent[1][0], jProj11 * J_tangent[0][1] + jProj12 * J_tangent[1][1]],
    [jProj21 * J_tangent[0][0] + jProj22 * J_tangent[1][0], jProj21 * J_tangent[0][1] + jProj22 * J_tangent[1][1]],
  ];

  const colNorm0 = Math.hypot(J_total[0][0], J_total[1][0]);
  const colNorm1 = Math.hypot(J_total[0][1], J_total[1][1]);
  const rowNorm0 = Math.hypot(J_total[0][0], J_total[0][1]);
  const rowNorm1 = Math.hypot(J_total[1][0], J_total[1][1]);

  return {
    J_total,
    J_tangent,
    J_linear,
    J_proj: [
      [jProj11, jProj12],
      [jProj21, jProj22],
    ],
    J_sip: [
      [jSip11, jSip12],
      [jSip21, jSip22],
    ],
    colNorm0,
    colNorm1,
    meanDetectorScale: 0.5 * (colNorm0 + colNorm1),
    rowNorm0,
    rowNorm1,
  };
}

/**
 * Computes the central finite difference Jacobian of the WCS transformation via pixelToWorld:
 *   J_fd = [ [dRAstar/dx, dRAstar/dy], [dDec/dx, dDec/dy] ] (in arcseconds per pixel)
 *
 * @param {object} wcs - Parsed WCS object from parseWcs
 * @param {number} xFits - FITS 1-based X coordinate
 * @param {number} yFits - FITS 1-based Y coordinate
 * @param {number} dp - Finite difference step in pixels (default 0.005)
 * @returns {object} Numerical Jacobian matrix and norms
 */
export function computeFiniteDifferenceWcsJacobian(wcs, xFits, yFits, dp = 0.005) {
  if (!wcs?.pixelToWorld) return null;
  const c = wcs.pixelToWorld(xFits, yFits);
  const cosDec = Math.cos(c.dec * DEG2RAD);

  const xp = wcs.pixelToWorld(xFits + dp, yFits);
  const xm = wcs.pixelToWorld(xFits - dp, yFits);
  const yp = wcs.pixelToWorld(xFits, yFits + dp);
  const ym = wcs.pixelToWorld(xFits, yFits - dp);

  // Normalize RA differences across 0/360 wrap
  const normDra = (ra2, ra1) => {
    let d = ra2 - ra1;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };

  const dra_dx = (normDra(xp.ra, xm.ra) * 3600.0 * cosDec) / (2.0 * dp);
  const ddec_dx = ((xp.dec - xm.dec) * 3600.0) / (2.0 * dp);
  const dra_dy = (normDra(yp.ra, ym.ra) * 3600.0 * cosDec) / (2.0 * dp);
  const ddec_dy = ((yp.dec - ym.dec) * 3600.0) / (2.0 * dp);

  const J_fd = [
    [dra_dx, dra_dy],
    [ddec_dx, ddec_dy],
  ];

  const colNorm0 = Math.hypot(dra_dx, ddec_dx);
  const colNorm1 = Math.hypot(dra_dy, ddec_dy);
  const rowNorm0 = Math.hypot(dra_dx, dra_dy);
  const rowNorm1 = Math.hypot(ddec_dx, ddec_dy);

  return {
    J_fd,
    colNorm0,
    colNorm1,
    meanDetectorScale: 0.5 * (colNorm0 + colNorm1),
    rowNorm0,
    rowNorm1,
  };
}

/**
 * Parses the SPHEREx HDU 6 (EXTNAME = 'WCS-WAVE') Binary Table extension
 * containing the 2D Lookup Table (WAVE-TAB) for Linear Variable Filter (LVF)
 * approximated central wavelength (lambda) and spectral bandwidth (Delta lambda) in microns.
 * Dynamically reads TFORM1 ('9J' or '13J'), TFORM2 ('9J' or '20J'), and TFORM3 ('162E' or '520E')
 * so all SPHEREx detectors (D1..D6) and pipeline versions (v20..v27+) are supported.
 *
 * Note: As stated in the FITS header (`WCSNAMEW = 'Approximated per-pixel wavelength and bandwidth'`),
 * WCS-WAVE provides the per-pixel LVF wavelength approximation for visualization and band comparison,
 * and is not a substitute for the full detector-wide CWAVE/CBAND calibration products in precision spectrophotometry.
 */
export function parseWcsWaveTable(
  view,
  dataStart,
  rowBytes,
  tableHeaderValues = {},
  imageHeaderValues = {},
) {
  const nx = Number.parseInt(String(tableHeaderValues.TFORM1 || '9J'), 10) || 9;
  const ny = Number.parseInt(String(tableHeaderValues.TFORM2 || '9J'), 10) || 9;
  const totalCells = nx * ny;
  const expectedBytes = (nx + ny) * 4 + totalCells * 8;
  if (!view || rowBytes < expectedBytes || dataStart + expectedBytes > view.byteLength) return null;

  const xGrid = new Float64Array(nx);
  const yGrid = new Float64Array(ny);
  for (let i = 0; i < nx; i++) {
    xGrid[i] = view.getInt32(dataStart + i * 4, false);
  }
  const yOffset = dataStart + nx * 4;
  for (let j = 0; j < ny; j++) {
    yGrid[j] = view.getInt32(yOffset + j * 4, false);
  }
  const valuesOffset = yOffset + ny * 4;
  const waveGrid = new Float32Array(totalCells);
  const bandGrid = new Float32Array(totalCells);
  let minWave = Infinity;
  let maxWave = -Infinity;
  let minBand = Infinity;
  let maxBand = -Infinity;
  for (let idx = 0; idx < totalCells; idx++) {
    const lam = view.getFloat32(valuesOffset + idx * 8, false);
    const dlam = view.getFloat32(valuesOffset + idx * 8 + 4, false);
    waveGrid[idx] = lam;
    bandGrid[idx] = dlam;
    if (Number.isFinite(lam)) {
      minWave = Math.min(minWave, lam);
      maxWave = Math.max(maxWave, lam);
    }
    if (Number.isFinite(dlam)) {
      minBand = Math.min(minBand, dlam);
      maxBand = Math.max(maxBand, dlam);
    }
  }

  const crpix1w = Number(imageHeaderValues.CRPIX1W ?? 0);
  const crpix2w = Number(imageHeaderValues.CRPIX2W ?? 0);

  const findBracket = (grid, val) => {
    const clamped = Math.max(grid[0], Math.min(grid[grid.length - 1], val));
    for (let i = 0; i < grid.length - 1; i++) {
      if (clamped <= grid[i + 1] || i === grid.length - 2) {
        const span = grid[i + 1] - grid[i];
        return {
          i,
          frac: span > 0 ? Math.max(0, Math.min(1, (clamped - grid[i]) / span)) : 0,
        };
      }
    }
    return { i: 0, frac: 0 };
  };

  const evaluateAtCutoutPixel = (xFits, yFits) => {
    if (!Number.isFinite(xFits) || !Number.isFinite(yFits)) return null;
    const detX = crpix1w !== 0 ? xFits - crpix1w : xFits;
    const detY = crpix2w !== 0 ? yFits - crpix2w : yFits;
    const bx = findBracket(xGrid, detX);
    const by = findBracket(yGrid, detY);
    const i00 = by.i * nx + bx.i;
    const i10 = by.i * nx + (bx.i + 1);
    const i01 = (by.i + 1) * nx + bx.i;
    const i11 = (by.i + 1) * nx + (bx.i + 1);
    const w00 = (1 - bx.frac) * (1 - by.frac);
    const w10 = bx.frac * (1 - by.frac);
    const w01 = (1 - bx.frac) * by.frac;
    const w11 = bx.frac * by.frac;
    const wavelengthUm =
      waveGrid[i00] * w00 + waveGrid[i10] * w10 + waveGrid[i01] * w01 + waveGrid[i11] * w11;
    const bandwidthUm =
      bandGrid[i00] * w00 + bandGrid[i10] * w10 + bandGrid[i01] * w01 + bandGrid[i11] * w11;
    return {
      wavelengthUm: Number(wavelengthUm.toFixed(4)),
      bandwidthUm: Number(bandwidthUm.toFixed(4)),
      resolvingPower: Number((wavelengthUm / Math.max(1e-6, bandwidthUm)).toFixed(1)),
      detectorX: Number(detX.toFixed(2)),
      detectorY: Number(detY.toFixed(2)),
      calibrationMethod: 'WCS-WAVE (WAVE-TAB bilinear approximation)',
    };
  };

  return {
    nx,
    ny,
    xGrid: Array.from(xGrid),
    yGrid: Array.from(yGrid),
    minWaveUm: Number(minWave.toFixed(4)),
    maxWaveUm: Number(maxWave.toFixed(4)),
    minBandUm: Number(minBand.toFixed(4)),
    maxBandUm: Number(maxBand.toFixed(4)),
    evaluateAtCutoutPixel,
  };
}

/**
 * Estimates the local sky background independently from the valid detector pixels
 * using robust median and NMAD (1.4826 * MAD) statistics so it can be compared
 * against the parametric ZODI model (`HDU 4`).
 */
export function estimateEmpiricalBackground(pixels, flagsPixels = null, excludeMask = SEVERE_CONTAMINATION_MASK) {
  const sample = [];
  const step = Math.max(1, Math.floor(pixels.length / 10000));
  for (let i = 0; i < pixels.length; i += step) {
    const val = pixels[i];
    if (!Number.isFinite(val)) continue;
    if (flagsPixels && (flagsPixels[i] & excludeMask) !== 0) continue;
    sample.push(val);
  }
  if (!sample.length) return { medianMjySr: 0, nmadMjySr: 0, sampleCount: 0 };
  sample.sort((a, b) => a - b);
  const median = sample[Math.floor(sample.length / 2)];
  const absDevs = sample.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const nmad = absDevs[Math.floor(absDevs.length / 2)] * 1.4826;
  return {
    medianMjySr: Number(median.toFixed(4)),
    nmadMjySr: Number(nmad.toFixed(4)),
    sampleCount: sample.length,
  };
}

export function sampleDetectorBilinear(
  pixels,
  width,
  height,
  xFits,
  yFits,
  variancePixels = null,
  flagsPixels = null,
  badMask = SEVERE_CONTAMINATION_MASK,
) {
  const x = xFits - 1;
  const y = yFits - 1;
  if (x < -0.5 || x > width - 0.5 || y < -0.5 || y > height - 0.5) {
    return variancePixels || flagsPixels
      ? { value: NaN, variance: NaN, flags: 0, maskedByFlags: false, outOfBounds: true }
      : NaN;
  }
  const xClamped = Math.max(0, Math.min(width - 1, x));
  const yClamped = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(xClamped);
  const y0 = Math.floor(yClamped);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = xClamped - x0;
  const fy = yClamped - y0;

  const idx00 = y0 * width + x0;
  const idx10 = y0 * width + x1;
  const idx01 = y1 * width + x0;
  const idx11 = y1 * width + x1;

  const indices = [idx00, idx10, idx01, idx11];
  const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];

  let sum = 0;
  let weight = 0;
  let combinedFlags = 0;
  let hadFiniteSignal = false;
  let rejectedByFlags = 0;

  for (let k = 0; k < 4; k++) {
    const idx = indices[k];
    const w = weights[k];
    if (w <= 0) continue;
    const rawVal = pixels[idx];
    const flagVal = flagsPixels ? flagsPixels[idx] >>> 0 : 0;
    combinedFlags = (combinedFlags | flagVal) >>> 0;
    if (Number.isFinite(rawVal)) {
      hadFiniteSignal = true;
      if (flagsPixels && (flagVal & badMask) !== 0) {
        rejectedByFlags++;
        continue;
      }
      sum += rawVal * w;
      weight += w;
    }
  }

  if (!variancePixels && !flagsPixels) {
    return weight > 0 ? sum / weight : NaN;
  }

  if (weight <= 0) {
    return {
      value: NaN,
      variance: NaN,
      flags: combinedFlags >>> 0,
      maskedByFlags: hadFiniteSignal && rejectedByFlags > 0,
      outOfBounds: false,
    };
  }

  const value = sum / weight;
  let variance = NaN;
  if (variancePixels) {
    let varSum = 0;
    let varWeightSq = 0;
    for (let k = 0; k < 4; k++) {
      const idx = indices[k];
      const w = weights[k];
      if (w <= 0) continue;
      const rawVal = pixels[idx];
      const flagVal = flagsPixels ? flagsPixels[idx] >>> 0 : 0;
      if (!Number.isFinite(rawVal) || (flagsPixels && (flagVal & badMask) !== 0)) continue;
      const vVar = variancePixels[idx];
      if (Number.isFinite(vVar) && vVar >= 0) {
        const normW = w / weight;
        varSum += normW * normW * vVar;
        varWeightSq += normW * normW;
      }
    }
    variance = varWeightSq > 0 ? varSum : NaN;
  }

  return {
    value,
    variance,
    flags: combinedFlags >>> 0,
    maskedByFlags: false,
    outOfBounds: false,
  };
}

export function reprojectToCommonSkyGrid(
  pixels,
  width,
  height,
  wcs,
  center,
  options = {},
) {
  const gridSize = options.gridSize || 300;
  const fovDeg = options.fovDeg || 0.5;
  const variancePixels = options.variancePixels || null;
  const flagsPixels = options.flagsPixels || null;
  const badMask = options.badMask ?? SEVERE_CONTAMINATION_MASK;

  const scaleDeg = fovDeg / gridSize;
  const alphaCenter = center.ra * DEG2RAD;
  const deltaCenter = center.dec * DEG2RAD;
  const sinDc = Math.sin(deltaCenter);
  const cosDc = Math.cos(deltaCenter);
  const cx = (gridSize - 1) / 2;
  const cy = (gridSize - 1) / 2;

  const totalGridPixels = gridSize * gridSize;
  const out = new Float32Array(totalGridPixels);
  out.fill(NaN);
  const outVariance = variancePixels ? new Float32Array(totalGridPixels) : null;
  if (outVariance) outVariance.fill(NaN);
  const outFlags = flagsPixels ? new Uint32Array(totalGridPixels) : null;

  let validPixelCount = 0;
  let maskedByFlagsCount = 0;
  let noCoverageCount = 0;
  let warningPixelCount = 0;
  let candidatePixelCount = 0;

  const gridToWorld = (col, row) => {
    const xi = -(col - cx) * scaleDeg * DEG2RAD;
    const eta = -(row - cy) * scaleDeg * DEG2RAD;
    const denom = cosDc - eta * sinDc;
    const raRad = alphaCenter + Math.atan2(xi, denom);
    const decRad = Math.atan2(sinDc + eta * cosDc, Math.hypot(xi, denom));
    return {
      ra: (((raRad * RAD2DEG) % 360) + 360) % 360,
      dec: decRad * RAD2DEG,
    };
  };

  const worldToGrid = (ra, dec) => {
    const alpha = ra * DEG2RAD;
    const delta = dec * DEG2RAD;
    const dAlpha = alpha - alphaCenter;
    const sinD = Math.sin(delta);
    const cosD = Math.cos(delta);
    const cosDcosA = cosD * Math.cos(dAlpha);
    const denom = sinD * sinDc + cosDcosA * cosDc;
    if (denom <= 0) return null;
    const xiDeg = ((cosD * Math.sin(dAlpha)) / denom) * RAD2DEG;
    const etaDeg = ((sinD * cosDc - cosDcosA * sinDc) / denom) * RAD2DEG;
    const col = cx - xiDeg / scaleDeg;
    const row = cy - etaDeg / scaleDeg;
    return {
      col,
      row,
      xPercent: ((col + 0.5) / gridSize) * 100,
      yPercent: ((row + 0.5) / gridSize) * 100,
    };
  };

  const useRichSampling = Boolean(variancePixels || flagsPixels);

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const idx = row * gridSize + col;
      const sky = gridToWorld(col, row);
      const det = wcs.worldToPixel(sky.ra, sky.dec);
      if (!det) {
        noCoverageCount++;
        continue;
      }
      if (useRichSampling) {
        const sampled = sampleDetectorBilinear(
          pixels,
          width,
          height,
          det.xFits,
          det.yFits,
          variancePixels,
          flagsPixels,
          badMask,
        );
        if (outFlags) outFlags[idx] = sampled.flags;
        if (Number.isFinite(sampled.value)) {
          out[idx] = sampled.value;
          if (outVariance) outVariance[idx] = sampled.variance;
          validPixelCount++;
          if ((sampled.flags & CATEGORY_B_QUALITY_WARNING_MASK) !== 0) warningPixelCount++;
          if ((sampled.flags & CATEGORY_C_CANDIDATE_ANOMALY_MASK) !== 0) candidatePixelCount++;
        } else if (sampled.maskedByFlags) {
          maskedByFlagsCount++;
        } else {
          noCoverageCount++;
        }
      } else {
        const value = sampleDetectorBilinear(pixels, width, height, det.xFits, det.yFits);
        if (Number.isFinite(value)) {
          out[idx] = value;
          validPixelCount++;
        } else {
          noCoverageCount++;
        }
      }
    }
  }

  return {
    pixels: out,
    variancePixels: outVariance,
    flagsPixels: outFlags,
    width: gridSize,
    height: gridSize,
    fovDeg,
    scaleDeg,
    validPixelCount,
    maskedByFlagsCount,
    noCoverageCount,
    warningPixelCount,
    candidatePixelCount,
    coverageFraction: validPixelCount / totalGridPixels,
    gridToWorld,
    worldToGrid,
  };
}

function readTypedArrayFromHdu(view, hdu, forceInt32 = false) {
  const { offset: start, count, bitpix, bzero, bscale } = hdu;
  if (forceInt32 && bitpix === 32) {
    const arr = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      const raw = view.getInt32(start + i * 4, false);
      arr[i] = (raw + bzero) >>> 0;
    }
    return arr;
  }
  const arr = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const at = start + (i * Math.abs(bitpix)) / 8;
    let value;
    if (bitpix === -32) value = view.getFloat32(at, false);
    else if (bitpix === -64) value = view.getFloat64(at, false);
    else if (bitpix === 16) value = view.getInt16(at, false);
    else if (bitpix === 32) value = view.getInt32(at, false);
    else if (bitpix === 8) value = view.getUint8(at);
    else throw new Error(`Formato FITS BITPIX=${bitpix} no compatible.`);
    arr[i] = value * bscale + bzero;
  }
  return arr;
}

/**
 * Compares two parsed/rendered observations to classify whether any apparent brightness
 * difference can be interpreted as physical temporal variability in the same spectral region,
 * or whether it is caused by LVF central wavelength shift or instrumental flag warnings.
 */
export function assessPhotometricComparability(frameA, frameB) {
  if (!frameA || !frameB) return null;
  const detA = frameA.detector?.detector || frameA.band;
  const detB = frameB.detector?.detector || frameB.band;
  const sameDetector = detA === detB;

  const lamA = frameA.spectral?.wavelengthUm;
  const lamB = frameB.spectral?.wavelengthUm;
  const bwA = frameA.spectral?.bandwidthUm || 0.03;
  const bwB = frameB.spectral?.bandwidthUm || 0.03;
  const meanBw = (bwA + bwB) * 0.5;
  const deltaLambdaUm =
    Number.isFinite(lamA) && Number.isFinite(lamB) ? Math.abs(lamB - lamA) : null;
  const deltaLambdaInBandwidths =
    deltaLambdaUm !== null && meanBw > 0 ? deltaLambdaUm / meanBw : null;

  let regime = 'comparable';
  let reasonEs = 'Misma región espectral LVF; el brillo es directamente comparable.';
  let reasonEn = 'Same LVF spectral region; brightness is directly comparable.';

  if (!sameDetector) {
    regime = 'different-detector';
    reasonEs = `Detectores distintos (${detA} vs ${detB}); diferencia dominada por la distribución espectral (SED), no por variabilidad temporal.`;
    reasonEn = `Different detectors (${detA} vs ${detB}); difference is dominated by the spectral energy distribution (SED), not temporal variability.`;
  } else if (deltaLambdaInBandwidths !== null && deltaLambdaInBandwidths > 1.0) {
    regime = 'shifted-wavelength';
    reasonEs = `Mismo detector pero longitud de onda LVF desplazada (Δλ = ${deltaLambdaUm.toFixed(3)} μm = ${deltaLambdaInBandwidths.toFixed(1)}×Δλ); los cambios de intensidad pueden reflejar rasgos espectrales además de variabilidad.`;
    reasonEn = `Same detector but shifted LVF wavelength (Δλ = ${deltaLambdaUm.toFixed(3)} μm = ${deltaLambdaInBandwidths.toFixed(1)}×Δλ); intensity changes may reflect spectral features as well as variability.`;
  }

  return {
    sameDetector,
    regime,
    deltaLambdaUm: deltaLambdaUm !== null ? Number(deltaLambdaUm.toFixed(4)) : null,
    deltaLambdaInBandwidths:
      deltaLambdaInBandwidths !== null ? Number(deltaLambdaInBandwidths.toFixed(2)) : null,
    reasonEs,
    reasonEn,
  };
}

export function parseFits(buffer, fixedRange = null, targetCenter = null, options = {}) {
  // Options:
  // - zodiMode: 'subtracted' (default visual processing IMAGE - ZODI) | 'raw' (original IMAGE) | 'model' (ZODI model only)
  // - flagPolicy: 'measurement' (masks Category A + Category C) | 'discovery' (masks only Category A, preserves Category C transients/outliers)
  const zodiMode =
    options.zodiMode || (options.subtractZodi === false ? 'raw' : 'subtracted');
  const flagPolicy = options.flagPolicy || 'measurement';
  const applyFlagsMask = options.applyFlagsMask ?? true;
  const badMask =
    options.badMask ??
    (flagPolicy === 'discovery' ? CATEGORY_A_INSTRUMENTAL_MASK : SEVERE_CONTAMINATION_MASK);

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;
  const hdus = {};
  const extensionNames = [];

  while (offset + 2880 <= bytes.length) {
    let header = '',
      end = false;
    while (offset + 2880 <= bytes.length && !end) {
      const block = new TextDecoder('ascii').decode(bytes.subarray(offset, offset + 2880));
      offset += 2880;
      header += block;
      end = (block.match(/.{80}/g) || []).some((card) => card.slice(0, 8).trim() === 'END');
    }
    if (!end) break;
    const cards = header.match(/.{80}/g) || [];
    const values = {};
    for (const card of cards) {
      const key = card.slice(0, 8).trim();
      if (card[8] === '=' && key)
        values[key] = card.slice(10).split('/')[0].trim().replace(/^'|'$/g, '').trim();
    }
    const bitpix = Number(values.BITPIX || 8);
    const naxis = Number(values.NAXIS || 0);
    const dimensions = Array.from({ length: naxis }, (_, i) =>
      Number(values[`NAXIS${i + 1}`] || 0),
    );
    const count = dimensions.reduce((total, size) => total * size, naxis ? 1 : 0);
    const bytesPerValue = Math.abs(bitpix) / 8;
    const pcount = Number(values.PCOUNT || 0);
    const gcount = Math.max(1, Number(values.GCOUNT || 1));
    const rawByteCount = (count * bytesPerValue + pcount) * gcount;
    const dataSize = Math.ceil(rawByteCount / 2880) * 2880;
    const extName = (
      values.EXTNAME || (extensionNames.length === 0 && values.SIMPLE === 'T' ? 'PRIMARY' : '')
    ).toUpperCase();

    extensionNames.push(extName || `HDU_${extensionNames.length}`);

    const hduDescriptor = {
      extName,
      offset,
      count,
      rawByteCount,
      dimensions,
      width: dimensions[0] || 0,
      height: dimensions[1] || 0,
      bitpix,
      bzero: Number(values.BZERO || 0),
      bscale: Number(values.BSCALE || 1),
      bunit: values.BUNIT || '',
      values,
    };

    if (
      count &&
      dimensions.length >= 2 &&
      (extName === 'IMAGE' || (!hdus.IMAGE && values.SIMPLE === 'T'))
    ) {
      hdus.IMAGE = hduDescriptor;
    } else if (extName) {
      hdus[extName] = hduDescriptor;
    }

    offset += dataSize;
  }

  const image = hdus.IMAGE;
  if (!image) throw new Error('El archivo FITS no contiene una imagen legible.');

  const { count, width: rawWidth, height: rawHeight, values } = image;

  // 1. Original scientific data (HDU 1: IMAGE) — preserved unmodified
  const rawImagePixels = readTypedArrayFromHdu(view, image, false);

  const hasMatchingDims = (hdu) =>
    Boolean(hdu && hdu.width === rawWidth && hdu.height === rawHeight && hdu.count === count);

  // 2. Companion 2D scientific extensions — preserved as independent arrays
  const rawFlagsPixels = hasMatchingDims(hdus.FLAGS)
    ? readTypedArrayFromHdu(view, hdus.FLAGS, true)
    : null;
  const rawVariancePixels = hasMatchingDims(hdus.VARIANCE)
    ? readTypedArrayFromHdu(view, hdus.VARIANCE, false)
    : null;
  const rawZodiPixels = hasMatchingDims(hdus.ZODI)
    ? readTypedArrayFromHdu(view, hdus.ZODI, false)
    : null;

  // Separate ZODI-subtracted array (IMAGE - ZODI) kept distinct from rawImagePixels
  const zodiSubtractedPixels = rawZodiPixels ? new Float32Array(count) : null;
  if (rawZodiPixels && zodiSubtractedPixels) {
    for (let i = 0; i < count; i++) {
      const imgVal = rawImagePixels[i];
      const zodiVal = rawZodiPixels[i];
      zodiSubtractedPixels[i] =
        Number.isFinite(imgVal) && Number.isFinite(zodiVal) ? imgVal - zodiVal : imgVal;
    }
  }

  // Parse WCS-WAVE lookup table if present
  const wcsWave = hdus['WCS-WAVE']
    ? parseWcsWaveTable(
        view,
        hdus['WCS-WAVE'].offset,
        hdus['WCS-WAVE'].width,
        hdus['WCS-WAVE'].values,
        values,
      )
    : null;

  // Parse temporal metadata from FITS header (DATE-OBS, DATE-AVG, DATE-END, MJD-OBS, MJD-AVG, MJD-END)
  const mjdObs = Number(values['MJD-OBS'] || values['MJD-BEG']);
  const mjdAvg = Number(values['MJD-AVG']);
  const mjdEnd = Number(values['MJD-END']);
  const temporal = {
    dateObs: values['DATE-OBS'] || values['DATE-BEG'] || null,
    dateAvg: values['DATE-AVG'] || null,
    dateEnd: values['DATE-END'] || null,
    dateCreated: values.DATE || null,
    mjdObs: Number.isFinite(mjdObs) ? mjdObs : null,
    mjdAvg: Number.isFinite(mjdAvg)
      ? mjdAvg
      : Number.isFinite(mjdObs) && Number.isFinite(mjdEnd)
        ? (mjdObs + mjdEnd) * 0.5
        : Number.isFinite(mjdObs)
          ? mjdObs
          : null,
    mjdEnd: Number.isFinite(mjdEnd) ? mjdEnd : null,
    exposureSeconds: Number.isFinite(Number(values.XPOSURE || values.EXPTIME))
      ? Number(values.XPOSURE || values.EXPTIME)
      : null,
    astrometricEpochField: Number.isFinite(mjdAvg) ? 'MJD-AVG' : 'MJD-OBS',
  };

  // Parse detector metadata and official spectral range
  const detectorNum = Number(values.DETECTOR) || null;
  const detectorInfo = detectorNum && SPHEREX_DETECTOR_SPECS[detectorNum]
    ? {
        detector: detectorNum,
        ...SPHEREX_DETECTOR_SPECS[detectorNum],
      }
    : null;

  // Select which detector pixel array feeds the active processing mode ('subtracted', 'raw', or 'model')
  const sourceModePixels =
    zodiMode === 'model' && rawZodiPixels
      ? rawZodiPixels
      : zodiMode === 'subtracted' && zodiSubtractedPixels
        ? zodiSubtractedPixels
        : rawImagePixels;

  const workingPixels = new Float32Array(count);
  let min = Infinity,
    max = -Infinity;
  let zodiSum = 0,
    zodiCount = 0;
  let categoryACount = 0;
  let categoryBCount = 0;
  let categoryCCount = 0;
  let detectorFlaggedSevereCount = 0;
  let detectorSourceFlagCount = 0;
  let varianceSum = 0,
    varianceCount = 0;

  for (let i = 0; i < count; i++) {
    if (rawZodiPixels) {
      const z = rawZodiPixels[i];
      if (Number.isFinite(z)) {
        zodiSum += z;
        zodiCount++;
      }
    }
    const flagVal = rawFlagsPixels ? rawFlagsPixels[i] >>> 0 : 0;
    if (flagVal) {
      if ((flagVal & CATEGORY_A_INSTRUMENTAL_MASK) !== 0) categoryACount++;
      if ((flagVal & CATEGORY_B_QUALITY_WARNING_MASK) !== 0) categoryBCount++;
      if ((flagVal & CATEGORY_C_CANDIDATE_ANOMALY_MASK) !== 0) categoryCCount++;
      if ((flagVal & badMask) !== 0) detectorFlaggedSevereCount++;
      if ((flagVal & SPHEREX_FLAG_BITS.MP_SOURCE) !== 0) detectorSourceFlagCount++;
    }
    if (rawVariancePixels) {
      const v = rawVariancePixels[i];
      if (Number.isFinite(v) && v >= 0) {
        varianceSum += v;
        varianceCount++;
      }
    }

    const val = sourceModePixels[i];
    if (applyFlagsMask && rawFlagsPixels && (flagVal & badMask) !== 0) {
      workingPixels[i] = NaN;
    } else {
      workingPixels[i] = val;
      if (Number.isFinite(val)) {
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    }
  }

  // Independent empirical background estimation on original IMAGE vs ZODI-subtracted IMAGE
  const empiricalRawBg = estimateEmpiricalBackground(
    rawImagePixels,
    rawFlagsPixels,
    SEVERE_CONTAMINATION_MASK,
  );
  const empiricalNetBg = zodiSubtractedPixels
    ? estimateEmpiricalBackground(
        zodiSubtractedPixels,
        rawFlagsPixels,
        SEVERE_CONTAMINATION_MASK,
      )
    : null;

  // Compute intensity percentiles strictly from valid unmasked detector pixels
  const histogram = new Uint32Array(4096);
  const span = Math.max(1e-20, max - min);
  let validCount = 0;
  for (let i = 0; i < count; i++) {
    const value = workingPixels[i];
    if (Number.isFinite(value)) {
      histogram[Math.min(4095, Math.floor(((value - min) / span) * 4096))]++;
      validCount++;
    }
  }
  const percentile = (fraction) => {
    let sum = 0;
    for (let i = 0; i < histogram.length; i++) {
      sum += histogram[i];
      if (sum >= validCount * fraction) return min + (i / 4095) * span;
    }
    return max;
  };
  const low = fixedRange?.low ?? percentile(0.03),
    high = fixedRange?.high ?? percentile(0.997),
    stretch = Math.max(1e-20, high - low);

  const wcs = parseWcs(values);
  const center =
    targetCenter && Number.isFinite(targetCenter.ra) && Number.isFinite(targetCenter.dec)
      ? targetCenter
      : wcs
        ? wcs.pixelToWorld((rawWidth + 1) / 2, (rawHeight + 1) / 2)
        : null;

  // Evaluate spectral wavelength and bandwidth at the reference center
  let spectral = null;
  if (wcsWave) {
    const detPt =
      wcs && center
        ? wcs.worldToPixel(center.ra, center.dec)
        : { xFits: (rawWidth + 1) / 2, yFits: (rawHeight + 1) / 2 };
    if (detPt) {
      spectral = wcsWave.evaluateAtCutoutPixel(detPt.xFits, detPt.yFits);
    }
  }

  let renderPixels = workingPixels;
  let width = rawWidth;
  let height = rawHeight;
  let reprojected = null;

  if (wcs && center) {
    reprojected = reprojectToCommonSkyGrid(workingPixels, rawWidth, rawHeight, wcs, center, {
      gridSize: 300,
      fovDeg: 0.5,
      variancePixels: rawVariancePixels,
      flagsPixels: rawFlagsPixels,
      badMask: applyFlagsMask ? badMask : 0,
    });
    renderPixels = reprojected.pixels;
    width = reprojected.width;
    height = reprojected.height;
  } else {
    const flipped = new Float32Array(count);
    for (let y = 0; y < rawHeight; y++) {
      const srcRow = (rawHeight - 1 - y) * rawWidth;
      const dstRow = y * rawWidth;
      for (let x = 0; x < rawWidth; x++) {
        flipped[dstRow + x] = workingPixels[srcRow + x];
      }
    }
    renderPixels = flipped;
  }

  const psfHdu = hdus.PSF || hdus.EPSF || null;
  const headerFlagDefinitions = hdus.FLAGS ? parseHeaderFlagDefinitions(hdus.FLAGS.values) : {};

  const extensionsSummary = {
    available: extensionNames.filter((name) => name !== 'PRIMARY'),
    hasFlags: Boolean(rawFlagsPixels),
    hasVariance: Boolean(rawVariancePixels),
    hasZodi: Boolean(rawZodiPixels),
    hasWcsWave: Boolean(wcsWave),
    hasPsfCube: Boolean(psfHdu),
    psfExtensionName: psfHdu?.extName || null,
    psfDimensions: psfHdu?.dimensions || null,
    psfFwhmArcsec: values.PSF_FWHM ? Number(Number(values.PSF_FWHM).toFixed(3)) : null,
    imageUnit: image.bunit || 'MJy / sr',
    varianceUnit: hdus.VARIANCE?.bunit || (rawVariancePixels ? 'MJy2 / sr2' : null),
    zodiUnit: hdus.ZODI?.bunit || (rawZodiPixels ? 'MJy / sr' : null),
    zodiMode,
    zodiSubtracted: Boolean(rawZodiPixels && zodiMode === 'subtracted'),
    flagPolicy,
    meanZodiMjySr: zodiCount > 0 ? Number((zodiSum / zodiCount).toFixed(4)) : null,
    empiricalRawBgMjySr: empiricalRawBg.medianMjySr,
    empiricalNetBgMjySr: empiricalNetBg ? empiricalNetBg.medianMjySr : null,
    empiricalBgNmadMjySr: empiricalRawBg.nmadMjySr,
    meanSigmaMjySr:
      varianceCount > 0 ? Number(Math.sqrt(varianceSum / varianceCount).toFixed(4)) : null,
    categoryAInstrumentalCount: categoryACount,
    categoryBWarningCount: categoryBCount,
    categoryCCandidateCount: categoryCCount,
    detectorFlaggedSevereCount,
    detectorSourceFlagCount,
    gridMaskedByFlagsCount: reprojected?.maskedByFlagsCount ?? 0,
    gridNoCoverageCount: reprojected?.noCoverageCount ?? 0,
    gridWarningPixelCount: reprojected?.warningPixelCount ?? 0,
    gridCandidatePixelCount: reprojected?.candidatePixelCount ?? 0,
    headerFlagDefinitionsCount: Object.keys(headerFlagDefinitions).length,
    spectral,
  };

  if (typeof document === 'undefined') {
    return {
      src: '',
      range: fixedRange || { low, high },
      width,
      height,
      rawWidth,
      rawHeight,
      wcs,
      wcsWave,
      spectral,
      temporal,
      detector: detectorInfo,
      extensions: extensionsSummary,
      reprojected,
      scientificPixels: renderPixels,
      rawImagePixels,
      zodiSubtractedPixels,
      rawFlagsPixels,
      rawVariancePixels,
      rawZodiPixels,
      headerValues: values,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const frame = ctx.createImageData(width, height);
  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i++) {
    const val = renderPixels[i];
    const at = i * 4;
    if (!Number.isFinite(val)) {
      frame.data[at] = 3;
      frame.data[at + 1] = 6;
      frame.data[at + 2] = 14;
      frame.data[at + 3] = 0;
      continue;
    }
    const normalized = Math.max(0, Math.min(1, (val - low) / stretch));
    const scaled = Math.max(0, Math.min(255, Math.pow(normalized, 0.72) * 255));
    frame.data[at] = scaled * 0.68;
    frame.data[at + 1] = scaled * 0.82;
    frame.data[at + 2] = scaled;
    frame.data[at + 3] = 255;
  }
  ctx.putImageData(frame, 0, 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = renderPixels[y * width + x];
      if (!Number.isFinite(val)) continue;
      const normalized = (val - low) / stretch;
      if (!Number.isFinite(normalized) || normalized < 0.72) continue;
      const alpha = Math.min(0.34, (normalized - 0.72) * 0.8);
      const glow = ctx.createRadialGradient(x + 0.5, y + 0.5, 0, x + 0.5, y + 0.5, 2.3);
      glow.addColorStop(0, `rgba(160, 222, 255, ${alpha})`);
      glow.addColorStop(1, 'rgba(100, 180, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 2, y - 2, 5, 5);
    }
  }
  return {
    src: canvas.toDataURL('image/png'),
    range: fixedRange || { low, high },
    width,
    height,
    rawWidth,
    rawHeight,
    wcs,
    wcsWave,
    spectral,
    temporal,
    detector: detectorInfo,
    extensions: extensionsSummary,
    reprojected,
    scientificPixels: renderPixels,
    rawImagePixels,
    zodiSubtractedPixels,
    rawFlagsPixels,
    rawVariancePixels,
    rawZodiPixels,
    headerValues: values,
  };
}
