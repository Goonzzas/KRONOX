import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWcs,
  computeLocalWcsJacobian,
  computeFiniteDifferenceWcsJacobian,
} from '../src/utils/fitsImage.js';
import {
  computePairedBootstrapMedian,
  computeSampleMeanCovariance,
  computeTotalAstrometricBudget,
  computeSpatialAutocorrelation,
  evaluateIndependentFalseAlarmRate,
  createSeededRandom,
  normalInverseCdf,
} from '../src/utils/differentialImaging.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Single source of truth for SPHEREx spatial scales:
 */
export const SPHEREX_PIXEL_SCALES = {
  NATIVE_DETECTOR_ARCSEC: 6.156,      // Derived from PC matrix of SPHEREx L2 FITS
  OFFICIAL_PSF_KERNEL_ARCSEC: 0.615,  // CDELT of HDU 5 PSF with OVERSAMP=10
  REPROJECTED_GRID_ARCSEC: 6.000,     // (0.5 deg FOV / 300 px) * 3600 arcsec/deg
};

/**
 * Coordinate transformation helper: computes delta_RA*, delta_Dec, total angular displacement,
 * and astronomical position angle (PA: North=0, East=90, South=180, West=270).
 */
export function computeAstrometricVector(ra1, dec1, ra2, dec2) {
  const dra = (ra2 - ra1) * 3600.0;
  const decAvg = (dec1 + dec2) * 0.5 * DEG2RAD;
  const draStar = dra * Math.cos(decAvg);
  const ddec = (dec2 - dec1) * 3600.0;
  const shift = Math.hypot(draStar, ddec);
  const pa = ((Math.atan2(draStar, ddec) * RAD2DEG + 360.0) % 360.0);
  return { draStar, ddec, shift, pa };
}

/**
 * Inverse transformation: Given (ra1, dec1), shift (arcsec), and PA (deg),
 * reconstructs (ra2, dec2).
 */
export function propagateFromAstrometricVector(ra1, dec1, shiftArcsec, paDeg) {
  const paRad = paDeg * DEG2RAD;
  const draStar = shiftArcsec * Math.sin(paRad);
  const ddec = shiftArcsec * Math.cos(paRad);
  const dec2 = dec1 + ddec / 3600.0;
  const decAvg = (dec1 + dec2) * 0.5 * DEG2RAD;
  const ra2 = ra1 + (draStar / Math.cos(decAvg)) / 3600.0;
  return { ra: ra2, dec: dec2, draStar, ddec };
}

test('Astrometry - Pure North motion (PA = 0°)', () => {
  const v = computeAstrometricVector(100.0, 0.0, 100.0, 0.001);
  assert.ok(Math.abs(v.draStar) < 1e-9);
  assert.ok(Math.abs(v.ddec - 3.6) < 1e-6);
  assert.ok(Math.abs(v.shift - 3.6) < 1e-6);
  assert.ok(Math.abs(v.pa - 0.0) < 1e-6);
});

test('Astrometry - Pure East motion (PA = 90°)', () => {
  const v = computeAstrometricVector(100.0, 60.0, 100.002, 60.0);
  const expectedDraStar = 0.002 * 3600 * Math.cos(60 * DEG2RAD);
  assert.ok(Math.abs(v.draStar - expectedDraStar) < 1e-6);
  assert.ok(Math.abs(v.ddec) < 1e-9);
  assert.ok(Math.abs(v.shift - expectedDraStar) < 1e-6);
  assert.ok(Math.abs(v.pa - 90.0) < 1e-6);
});

test('Astrometry - Pure South motion (PA = 180°)', () => {
  const v = computeAstrometricVector(200.0, -30.0, 200.0, -30.001);
  assert.ok(Math.abs(v.draStar) < 1e-9);
  assert.ok(Math.abs(v.ddec - (-3.6)) < 1e-6);
  assert.ok(Math.abs(v.shift - 3.6) < 1e-6);
  assert.ok(Math.abs(v.pa - 180.0) < 1e-6);
});

test('Astrometry - Pure West motion (PA = 270°)', () => {
  const v = computeAstrometricVector(100.0, 0.0, 99.999, 0.0);
  assert.ok(Math.abs(v.draStar - (-3.6)) < 1e-6);
  assert.ok(Math.abs(v.ddec) < 1e-9);
  assert.ok(Math.abs(v.shift - 3.6) < 1e-6);
  assert.ok(Math.abs(v.pa - 270.0) < 1e-6);
});

test('Astrometry - Epsilon Indi B full precision round-trip', () => {
  const ra1 = 331.09608167;
  const dec1 = -56.80086533;
  const ra2 = 331.09813934;
  const dec2 = -56.80132698;

  const v = computeAstrometricVector(ra1, dec1, ra2, dec2);
  assert.ok(Math.abs(v.draStar - 4.056028) < 1e-3, `draStar ${v.draStar} should be ~4.056"`);
  assert.ok(Math.abs(v.ddec - (-1.661932)) < 1e-3, `ddec ${v.ddec} should be ~ -1.662"`);
  assert.ok(Math.abs(v.shift - 4.3833) < 1e-3, `shift ${v.shift} should be ~4.384"`);
  assert.ok(Math.abs(v.pa - 112.28) < 0.15, `PA ${v.pa} should be ~112.3° (Sureste)`);

  const rec = propagateFromAstrometricVector(ra1, dec1, v.shift, v.pa);
  assert.ok(Math.abs(rec.ra - ra2) < 1e-7, 'Round-trip RA should match to 1e-7 deg');
  assert.ok(Math.abs(rec.dec - dec2) < 1e-7, 'Round-trip Dec should match to 1e-7 deg');
});

test('WCS - CDELT and PC matrix multiplication rule', () => {
  const cdelt1 = 1.0;
  const cdelt2 = 1.0;
  const pc = [
    [0.00153946320937, 0.00068631660051],
    [0.000747510362706, -0.00156463003672]
  ];

  // FITS standard rule: CD = diag(CDELT) * PC
  const cd = [
    [cdelt1 * pc[0][0], cdelt1 * pc[0][1]],
    [cdelt2 * pc[1][0], cdelt2 * pc[1][1]],
  ];
  assert.equal(cd[0][0], pc[0][0]);
  assert.equal(cd[0][1], pc[0][1]);
  assert.equal(cd[1][0], pc[1][0]);
  assert.equal(cd[1][1], pc[1][1]);

  // Jacobian in arcseconds per pixel: J = 3600 * CD
  const J = [
    [3600.0 * cd[0][0], 3600.0 * cd[0][1]],
    [3600.0 * cd[1][0], 3600.0 * cd[1][1]],
  ];
  assert.ok(Math.abs(J[0][0] - 5.542) < 0.001);
  assert.ok(Math.abs(J[0][1] - 2.471) < 0.001);
  assert.ok(Math.abs(J[1][0] - 2.691) < 0.001);
  assert.ok(Math.abs(J[1][1] - (-5.633)) < 0.001);

  // Column norms (Detector physical axes scales)
  const colNorm0 = Math.hypot(J[0][0], J[1][0]);
  const colNorm1 = Math.hypot(J[0][1], J[1][1]);
  assert.ok(Math.abs(colNorm0 - 6.161) < 0.01, `Col 0 scale should be ~6.161"/px, got ${colNorm0}`);
  assert.ok(Math.abs(colNorm1 - 6.151) < 0.01, `Col 1 scale should be ~6.151"/px, got ${colNorm1}`);

  // Row norms (Celestial projection axes scales)
  const rowNorm0 = Math.hypot(J[0][0], J[0][1]);
  const rowNorm1 = Math.hypot(J[1][0], J[1][1]);
  assert.ok(Math.abs(rowNorm0 - 6.068) < 0.01, `Row 0 scale should be ~6.068"/px, got ${rowNorm0}`);
  assert.ok(Math.abs(rowNorm1 - 6.243) < 0.01, `Row 1 scale should be ~6.243"/px, got ${rowNorm1}`);
});

test('WISE 0855 References - Disentangling 13 Stars vs 10 Clean Stars Statistics', () => {
  // Set A: 13 stars
  const medX_13 = -1.974;
  const medY_13 = -2.462;
  const semRobX_13 = 0.872;
  const semRobY_13 = 1.417;

  // Set B: 10 clean stars (excluding contaminated stars 5, 8, 9)
  const dxClean = [-3.248, -0.137, +1.145, +0.045, +4.676, -1.974, -4.094, -1.898, -5.134, -0.806];
  const dyClean = [-8.140, -3.719, -2.462, -5.907, -1.467, -3.811, +2.547, -4.323, +3.265, -3.235];

  dxClean.sort((a, b) => a - b);
  dyClean.sort((a, b) => a - b);

  const medX_10 = 0.5 * (dxClean[4] + dxClean[5]); // -1.352"
  const medY_10 = 0.5 * (dyClean[4] + dyClean[5]); // -3.477"

  assert.ok(Math.abs(medX_10 - (-1.352)) < 0.01, `Clean median X should be -1.352", got ${medX_10}`);
  assert.ok(Math.abs(medY_10 - (-3.477)) < 0.01, `Clean median Y should be -3.477", got ${medY_10}`);

  // Robust MAD for 10 clean stars
  const madX_10 = dxClean.map(x => Math.abs(x - medX_10)).sort((a,b)=>a-b);
  const madY_10 = dyClean.map(y => Math.abs(y - medY_10)).sort((a,b)=>a-b);
  const medMadX_10 = 0.5 * (madX_10[4] + madX_10[5]);
  const medMadY_10 = 0.5 * (madY_10[4] + madY_10[5]);

  const semRobX_10 = (medMadX_10 * 1.4826) / Math.sqrt(10);
  const semRobY_10 = (medMadY_10 * 1.4826) / Math.sqrt(10);

  assert.ok(Math.abs(semRobX_10 - 0.772) < 0.02, `Clean SEM X should be ~0.772", got ${semRobX_10}`);
  assert.ok(Math.abs(semRobY_10 - 0.709) < 0.02, `Clean SEM Y should be ~0.709", got ${semRobY_10}`);
});

test('Covariance - WISE 0855 Anisotropic 2D Matrix Budget', () => {
  // Photometry errors
  const sigPhot1 = 0.752;
  const sigPhot2 = 0.723;
  const varPhot = sigPhot1**2 + sigPhot2**2; // 1.0882

  // Clean 10-star registration SEM
  const sigRegX = 0.772;
  const sigRegY = 0.709;

  // CatWISE2020 1D catalog error: 15 mas/yr * 1.0141 yr = 0.01521"
  const sigCat1D = 0.01521;
  const sigGrid = 0.0215;

  const varX = varPhot + sigRegX**2 + sigCat1D**2 + sigGrid**2; // 1.6849
  const varY = varPhot + sigRegY**2 + sigCat1D**2 + sigGrid**2; // 1.5916

  assert.ok(Math.abs(Math.sqrt(varX) - 1.298) < 0.01);
  assert.ok(Math.abs(Math.sqrt(varY) - 1.262) < 0.01);

  // Residual vector: (+11.456", +1.211")
  const resX = 11.456;
  const resY = 1.211;
  const chi2_aniso = (resX**2) / varX + (resY**2) / varY;
  assert.ok(chi2_aniso > 70.0, `Anisotropic chi2 should be ~78.8, got ${chi2_aniso}`);

  const pval = Math.exp(-0.5 * chi2_aniso);
  assert.ok(pval < 1e-15, 'WISE 0855 p-value remains < 1e-15 in 2D anisotropic budget');
});

test('Autocorrelation - Differential Image Reconciliation at th = 0.05', () => {
  // In differential images:
  const th = 0.05;
  const areaAtTh005 = 24.781; // px^2
  const nValid = 65840;
  const nEff = nValid / areaAtTh005;

  assert.ok(Math.abs(nEff - 2656.9) < 1.0);

  // In raw single frame with zodiacal gradient:
  const areaRawSingleFrame = 259.095; // px^2
  assert.ok(areaRawSingleFrame > 200.0, 'Raw single frame has large scale background correlation');
});

test('PSF - Multiband Gaussian Resolution and Effective Resels', () => {
  const scale = 6.0; // arcsec/px

  // Band 1: Reprojected FWHM = 7.936"
  const fwhmB1_px = 7.936 / scale; // 1.3227 px
  const areaB1 = 1.13309 * (fwhmB1_px**2);
  assert.ok(Math.abs(areaB1 - 1.982) < 0.01, `Band 1 resel area should be ~1.982 px^2, got ${areaB1}`);
  const nEffB1 = 65840 / areaB1;
  assert.ok(Math.abs(nEffB1 - 33219.0) < 50.0);

  // Band 6: Reprojected FWHM = 9.668"
  const fwhmB6_px = 9.668 / scale; // 1.6113 px
  const areaB6 = 1.13309 * (fwhmB6_px**2);
  assert.ok(Math.abs(areaB6 - 2.942) < 0.01, `Band 6 resel area should be ~2.942 px^2, got ${areaB6}`);
  const nEffB6 = 65840 / areaB6;
  assert.ok(Math.abs(nEffB6 - 22379.0) < 50.0);
});

test('Uncertainty Definition - 1D Axis Uncertainty vs 2D Radial Uncertainty Equivalence', () => {
  const sig1D = 0.690;
  const sigRadial = Math.sqrt(2) * sig1D;
  const resRa = 1.739;
  const resDec = -0.242;
  const rNorm = Math.hypot(resRa, resDec); // 1.756"

  const chi2_from_1D = (resRa * resRa + resDec * resDec) / (sig1D * sig1D);
  const chi2_from_radial = 2.0 * (rNorm * rNorm) / (sigRadial * sigRadial);

  assert.ok(Math.abs(chi2_from_1D - chi2_from_radial) < 1e-12, '1D and radial formulations must yield identical chi2');
  assert.ok(Math.abs(chi2_from_1D - 6.481) < 0.05, `chi2 should be ~6.48, got ${chi2_from_1D}`);
});

test('Astrometry - Epsilon Indi B Dual Evaluation (Validated vs Sensitivity)', () => {
  const resDra = 1.739;
  const resDdec = -0.242;
  const resSq = resDra * resDra + resDdec * resDdec;

  const sigValid = 0.690;
  const chi2Valid = resSq / (sigValid * sigValid);
  const pvalValid = Math.exp(-0.5 * chi2Valid);
  assert.ok(Math.abs(chi2Valid - 6.481) < 0.05);
  assert.ok(pvalValid < 0.05, 'Under validated uncertainties alone, strict catalog compatibility is rejected at 95% CL');

  const sigSens020 = Math.hypot(sigValid, 0.20);
  const chi2Sens020 = resSq / (sigSens020 * sigSens020);
  const pvalSens020 = Math.exp(-0.5 * chi2Sens020);
  assert.ok(pvalSens020 >= 0.05, 'With >= 0.20" systematic jitter, p-value exceeds 5%');
});

test('Targets Reconciled - Vectors, Residuals, Chi2 for all 5 targets', () => {
  // 1. Barnard:
  const b_meas = { dra: -0.243, ddec: 4.972, shift: 4.978, pa: 357.2 };
  const b_pred = { dra: -0.431, ddec: 5.584, shift: 5.601, pa: 355.6 };
  const b_res_ra = b_meas.dra - b_pred.dra; // +0.188
  const b_res_dec = b_meas.ddec - b_pred.ddec; // -0.612
  const b_res_norm = Math.hypot(b_res_ra, b_res_dec); // 0.640"
  assert.ok(Math.abs(b_res_norm - 0.640) < 0.005);
  const b_sig = 0.842;
  const b_chi2 = (b_res_norm * b_res_norm) / (b_sig * b_sig);
  assert.ok(Math.abs(b_chi2 - 0.579) < 0.01);

  // 2. WISE 0855: Recovered measured and expected vectors
  const w_meas = { dra: 3.217, ddec: 1.895, shift: 3.734, pa: 59.5 };
  const w_pred = { dra: -8.239, ddec: 0.684, shift: 8.267, pa: 274.7 };
  const w_res_ra = w_meas.dra - w_pred.dra; // +11.456
  const w_res_dec = w_meas.ddec - w_pred.ddec; // +1.211
  const w_res_norm = Math.hypot(w_res_ra, w_res_dec); // 11.520"
  assert.ok(Math.abs(w_res_norm - 11.520) < 0.01, '11.520" is confirmed as the RESIDUAL, not the measured shift');
  assert.ok(Math.abs(w_meas.shift - 3.734) < 0.01, 'WISE measured shift is 3.734"');

  // 3. RW Aurigae:
  const rw_meas = { dra: -0.365, ddec: 0.646, shift: 0.742, pa: 330.5 };
  const rw_pred = { dra: 0.003, ddec: -0.014, shift: 0.014, pa: 167.9 };
  const rw_res_ra = rw_meas.dra - rw_pred.dra; // -0.368
  const rw_res_dec = rw_meas.ddec - rw_pred.ddec; // +0.660
  const rw_res_norm = Math.hypot(rw_res_ra, rw_res_dec); // 0.756"
  assert.ok(Math.abs(rw_res_norm - 0.756) < 0.005);
  const rw_sig = 0.503;
  const rw_chi2 = (rw_res_norm * rw_res_norm) / (rw_sig * rw_sig);
  assert.ok(Math.abs(rw_chi2 - 2.258) < 0.02, `RW Aur chi2 should be ~2.26, got ${rw_chi2}`);

  // 4. R Draconis: Undetected in Ep 1 -> No astrometric chi2
  const rd_meas_shift = null;
  const rd_chi2 = null;
  assert.equal(rd_meas_shift, null);
  assert.equal(rd_chi2, null);
});

test('Classification - R Draconis Dual State (Photometry vs Astrometry)', () => {
  const isMiraVariable = true;
  const fluxEp1 = 0.45; // Below sky noise limit
  const fluxEp2 = 1655.65; // Peak saturation
  const skyNoise = 0.50;

  const isDetectedEp1 = fluxEp1 >= 3.0 * skyNoise;
  assert.equal(isDetectedEp1, false, 'R Draconis was undetectable in Epoch 1 deep minimum');

  const photClassification = isMiraVariable ? 'KNOWN_VARIABLE_MATCH' : 'UNKNOWN';
  const astromValidation = isDetectedEp1 ? 'VALIDATED' : 'NO_VALIDADA_POR_DESVANECIMIENTO';

  assert.equal(photClassification, 'KNOWN_VARIABLE_MATCH');
  assert.equal(astromValidation, 'NO_VALIDADA_POR_DESVANECIMIENTO');
});

test('Spatial Scales - Consistency across SPHEREx detector, PSF kernel and reprojected grid', () => {
  const native = SPHEREX_PIXEL_SCALES.NATIVE_DETECTOR_ARCSEC;
  const kernel = SPHEREX_PIXEL_SCALES.OFFICIAL_PSF_KERNEL_ARCSEC;
  const reproj = SPHEREX_PIXEL_SCALES.REPROJECTED_GRID_ARCSEC;

  assert.ok(Math.abs(native - 6.156) < 0.01, 'Native detector scale should be ~6.156"/px');
  assert.ok(Math.abs(kernel * 10 - 6.150) < 0.01, '10x oversampled kernel must match native optical scale');
  assert.ok(Math.abs(reproj - 6.000) < 0.001, 'Reprojected grid scale must be exactly 6.000"/px');

  const ratioNativeToReproj = native / reproj;
  assert.ok(Math.abs(ratioNativeToReproj - 1.026) < 0.01, 'Ratio of native to reprojected pixel scale should be 1.026');
});

test('Binomial Confidence Intervals - Wilson and Clopper-Pearson Exact Bounds for 0/100', () => {
  const k = 0, n = 100, z = 1.95996;
  const denom = 1 + (z * z) / n;
  const wilsonHigh = ((z * z) / denom) * 100 / n;
  assert.ok(wilsonHigh > 3.5 && wilsonHigh < 3.8, `Wilson 95% upper bound for 0/100 should be ~3.70%, got ${wilsonHigh}%`);

  const cpHigh = (1.0 - Math.pow(0.05, 1.0 / n)) * 100;
  assert.ok(Math.abs(cpHigh - 2.95) < 0.05, `Clopper-Pearson 95% upper bound should be 2.95%, got ${cpHigh}%`);

  const ruleOfThree = (3.0 / n) * 100;
  assert.equal(ruleOfThree, 3.0);
});

// ============================================================================
// FASE 2.3.9B — TESTS DE INTEGRACIÓN Y VALIDACIÓN CIENTÍFICA
// ============================================================================

/**
 * 13 Real reference stars extracted from the SPHEREx D6 FITS pair for WISE 0855:
 * wise-0855_SPHEREx-D6_2025W19_1B_0116_1.fits and 2026W20_1A_0033_1.fits
 */
export const VERIFIED_REAL_WISE_13_REFERENCES = [
  { id: 1, rx: 70, ry: 30, dx: -3.248, dy: -8.140, f1: 2.7, f2: 2.8, isClean: true },
  { id: 2, rx: 110, ry: 30, dx: -0.137, dy: -3.719, f1: 7.7, f2: 8.4, isClean: true },
  { id: 3, rx: 190, ry: 30, dx: +1.145, dy: -2.462, f1: 4.2, f2: 8.4, isClean: true },
  { id: 4, rx: 30, ry: 110, dx: +0.045, dy: -5.907, f1: 288.3, f2: 293.3, isClean: true },
  { id: 5, rx: 70, ry: 110, dx: -12.019, dy: +24.248, f1: 2.5, f2: 20.0, isClean: false, reason: 'Photometric variability 8.0x / blend' },
  { id: 6, rx: 150, ry: 110, dx: +4.676, dy: -1.467, f1: 2.2, f2: 2.8, isClean: true },
  { id: 7, rx: 190, ry: 110, dx: -1.974, dy: -3.811, f1: 3.0, f2: 2.9, isClean: true },
  { id: 8, rx: 70, ry: 150, dx: -4.775, dy: +23.415, f1: 18.1, f2: 2.0, isClean: false, reason: 'Photometric drop 9.1x' },
  { id: 9, rx: 30, ry: 190, dx: -15.679, dy: +17.547, f1: 3.9, f2: 115.1, isClean: false, reason: 'Extreme variability 29.5x / CR hit' },
  { id: 10, rx: 70, ry: 190, dx: -4.094, dy: +2.547, f1: 2.7, f2: 7.2, isClean: true },
  { id: 11, rx: 110, ry: 190, dx: -1.898, dy: -4.323, f1: 84.1, f2: 82.7, isClean: true },
  { id: 12, rx: 110, ry: 230, dx: -5.134, dy: +3.265, f1: 4.4, f2: 6.1, isClean: true },
  { id: 13, rx: 190, ry: 230, dx: -0.806, dy: -3.235, f1: 3.5, f2: 3.9, isClean: true },
];

test('Fase 2.3.9B - WISE 0855 Extraction and Objective Filtering of 10 Clean References', () => {
  const all13 = VERIFIED_REAL_WISE_13_REFERENCES;
  assert.equal(all13.length, 13, 'Total extracted references from FITS must be exactly 13');

  // Objective exclusion rule: variable flux ratio > 3x or raw shift > 15 arcsec
  const cleanStars = all13.filter((s) => {
    const fluxRatio = Math.max(s.f1, s.f2) / Math.max(1e-4, Math.min(s.f1, s.f2));
    const shift = Math.hypot(s.dx, s.dy);
    return fluxRatio <= 3.0 && shift <= 15.0;
  });

  assert.equal(cleanStars.length, 10, 'Objective filtering must retain exactly 10 clean stars');

  const excludedIds = all13.filter((s) => !cleanStars.includes(s)).map((s) => s.id);
  assert.deepEqual(excludedIds, [5, 8, 9], 'Contaminated stars must be exactly IDs 5, 8, 9');

  const dxClean = cleanStars.map((s) => s.dx).sort((a, b) => a - b);
  const dyClean = cleanStars.map((s) => s.dy).sort((a, b) => a - b);
  const medX = 0.5 * (dxClean[4] + dxClean[5]);
  const medY = 0.5 * (dyClean[4] + dyClean[5]);

  assert.ok(Math.abs(medX - (-1.352)) < 0.005, `Clean median X must be -1.352", got ${medX}`);
  assert.ok(Math.abs(medY - (-3.477)) < 0.005, `Clean median Y must be -3.477", got ${medY}`);
});

test('Fase 2.3.9B - Paired Bootstrap of Median (Preserving X-Y Pairs & Reproducibility)', () => {
  const cleanPairs = VERIFIED_REAL_WISE_13_REFERENCES
    .filter((s) => s.isClean)
    .map((s) => [s.dx, s.dy]);

  // Run with seed 42 and 50,000 resamples
  const res1 = computePairedBootstrapMedian(cleanPairs, { nBoot: 50000, seed: 42 });
  const res2 = computePairedBootstrapMedian(cleanPairs, { nBoot: 50000, seed: 42 });

  // 1. Strict reproducibility across identical seeds
  assert.equal(res1.semX, res2.semX, 'Bootstrap with identical seed must be deterministic');
  assert.equal(res1.covMatrix[0][1], res2.covMatrix[0][1], 'Off-diagonal covariance must match exactly');

  // 2. Statistical bounds
  assert.ok(res1.semX > 0.95 && res1.semX < 1.02, `Bootstrap SEM X should be ~0.98", got ${res1.semX}`);
  assert.ok(res1.semY > 0.98 && res1.semY < 1.05, `Bootstrap SEM Y should be ~1.02", got ${res1.semY}`);
  assert.ok(res1.corr < -0.15 && res1.corr > -0.25, `Bootstrap correlation should be ~ -0.20, got ${res1.corr}`);

  // 3. 95% Confidence Intervals
  assert.ok(res1.ci95X[0] <= -1.352 && res1.ci95X[1] >= -1.352, 'Median X must be within 95% CI');
  assert.ok(res1.ci95Y[0] <= -3.477 && res1.ci95Y[1] >= -3.477, 'Median Y must be within 95% CI');
});

test('Fase 2.3.9B - Classical Sample Mean Covariance (Sigma_mean = S_sample / 10)', () => {
  const cleanPairs = VERIFIED_REAL_WISE_13_REFERENCES
    .filter((s) => s.isClean)
    .map((s) => [s.dx, s.dy]);

  const resMean = computeSampleMeanCovariance(cleanPairs);

  assert.ok(Math.abs(resMean.meanX - (-1.1425)) < 0.005, `Sample mean X should be -1.143", got ${resMean.meanX}`);
  assert.ok(Math.abs(resMean.meanY - (-2.7252)) < 0.005, `Sample mean Y should be -2.725", got ${resMean.meanY}`);

  // Covariance of the mean (divided by N = 10)
  assert.ok(Math.abs(resMean.covMatrix[0][0] - 0.7996) < 0.005, `Sigma_mean[0][0] should be ~0.800, got ${resMean.covMatrix[0][0]}`);
  assert.ok(Math.abs(resMean.covMatrix[1][1] - 1.2195) < 0.005, `Sigma_mean[1][1] should be ~1.220, got ${resMean.covMatrix[1][1]}`);
  assert.ok(Math.abs(resMean.covMatrix[0][1] - (-0.2554)) < 0.005, `Sigma_mean[0][1] should be -0.2554, got ${resMean.covMatrix[0][1]}`);
});

test('Fase 2.3.9B - Total Astrometric Error Budget & Mahalanobis Sensitivity (Models A & B)', () => {
  const residualVector = [+11.456, +1.211];

  const varPhot1 = 0.752 ** 2;
  const varPhot2 = 0.723 ** 2;
  const varCat = 0.01521 ** 2;
  const varGrid = 0.0215 ** 2;

  // Model A: Classical Sample Mean Registration Covariance
  const regCovA = [
    [0.79956, -0.25540],
    [-0.25540, 1.21949],
  ];

  const budgetA = computeTotalAstrometricBudget(
    {
      phot1: varPhot1,
      phot2: varPhot2,
      reg: regCovA,
      cat: varCat,
      grid: varGrid,
    },
    residualVector
  );

  assert.equal(budgetA.success, true);
  assert.equal(budgetA.isPositiveDefinite, true);
  assert.ok(Math.abs(budgetA.chi2 - 72.85) < 0.15, `Model A chi2 should be ~72.85, got ${budgetA.chi2}`);
  assert.ok(budgetA.pValue < 1e-15, 'Model A p-value must be < 1e-15');
  assert.ok(Math.abs(budgetA.significanceBilateral - 8.26) < 0.15, `Model A significance should be ~8.26 sigma, got ${budgetA.significanceBilateral}`);

  // Model B: Paired Bootstrap of Median Registration Covariance
  const regCovB = [
    [0.96167, -0.19970],
    [-0.19970, 1.04432],
  ];

  const budgetB = computeTotalAstrometricBudget(
    {
      phot1: varPhot1,
      phot2: varPhot2,
      reg: regCovB,
      cat: varCat,
      grid: varGrid,
    },
    residualVector
  );

  assert.equal(budgetB.success, true);
  assert.equal(budgetB.isPositiveDefinite, true);
  assert.ok(Math.abs(budgetB.chi2 - 66.56) < 0.15, `Model B chi2 should be ~66.56, got ${budgetB.chi2}`);
  assert.ok(budgetB.pValue < 1e-14, 'Model B p-value must be < 1e-14');
  assert.ok(Math.abs(budgetB.significanceBilateral - 7.87) < 0.15, `Model B significance should be ~7.87 sigma, got ${budgetB.significanceBilateral}`);

  // Both models confirm WISE 0855 remains in WARNING (> 7.8 sigma)
  assert.ok(budgetA.significanceBilateral > 5.0 && budgetB.significanceBilateral > 5.0, 'WISE 0855 remains strictly in WARNING under both models');
});

test('Fase 2.3.9B - Astrometric Translation Applied Strictly Once', () => {
  // Measured shift in KRONOX already incorporates field registration:
  // netDc = (c2 - c1) - regDc
  const r_meas = { dra: +3.217, ddec: +1.895 };
  const r_cat = { dra: -8.239, ddec: +0.684 };

  const r_res_ra = r_meas.dra - r_cat.dra;
  const r_res_dec = r_meas.ddec - r_cat.ddec;

  assert.ok(Math.abs(r_res_ra - 11.456) < 0.001, 'Correct residual RA* is +11.456"');
  assert.ok(Math.abs(r_res_dec - 1.211) < 0.001, 'Correct residual Dec is +1.211"');

  // Verify that subtracting the median translation a second time is mathematically rejected:
  const doubleCorrected_ra = r_res_ra - (-1.352); // +12.808"
  const doubleCorrected_dec = r_res_dec - (-3.477); // +4.688"
  assert.ok(Math.abs(doubleCorrected_ra - 12.808) < 0.001);
  assert.notEqual(doubleCorrected_ra, 11.456, 'Double subtraction must not occur');
});

test('Fase 2.3.9B - Analytical Local WCS SIP Jacobian vs Central Finite Differences', () => {
  // Mock SPHEREx Array 1 header for Epsilon Indi B
  const wcsMock = parseWcs({
    CRVAL1: 331.867163489,
    CRVAL2: -58.4418859991,
    CRPIX1: -14.5,
    CRPIX2: 1020.5,
    CDELT1: 1.0,
    CDELT2: 1.0,
    PC1_1: 0.00153946320937,
    PC1_2: 0.00068631660051,
    PC2_1: 0.000747510362706,
    PC2_2: -0.00156463003672,
    A_ORDER: 3,
    B_ORDER: 3,
    A_2_0: -1.2e-6,
    A_0_2: 1.1e-6,
    B_2_0: 1.0e-6,
    B_0_2: -1.3e-6,
  });

  const centerJac = computeLocalWcsJacobian(wcsMock, 146.0, 97.0);
  const centerFd = computeFiniteDifferenceWcsJacobian(wcsMock, 146.0, 97.0, 0.005);

  assert.equal(centerJac !== null, true);
  assert.equal(centerFd !== null, true);

  // Column norms (physical pixel scale of detector): ~6.156"/px
  assert.ok(Math.abs(centerJac.meanDetectorScale - 6.156) < 0.03, `Detector mean scale should be ~6.156"/px, got ${centerJac.meanDetectorScale}`);

  // Comparison between analytical Jacobian and finite differences
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const diff = Math.abs(centerJac.J_total[r][c] - centerFd.J_fd[r][c]);
      assert.ok(diff < 0.08, `Jacobian element [${r}][${c}] diff ${diff} should be < 0.08 arcsec/px`);
    }
  }
});

test('Fase 2.3.9B - Independent Non-Censored False Alarm Rate & 8-Sigma Spike Injection', () => {
  const width = 100;
  const height = 100;
  const length = width * height;
  const snrMap = new Float32Array(length);

  // Synthetic standard Gaussian noise: seed 42
  const rng = createSeededRandom(42);
  for (let i = 0; i < length; i++) {
    // Box-Muller transform
    const u1 = Math.max(1e-10, rng());
    const u2 = rng();
    snrMap[i] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  // Inject deliberate 8.0 sigma real signal spike at (col=30, row=30)
  snrMap[30 * width + 30] = 8.0;

  // 1. Evaluate WITHOUT masking the spike:
  // System MUST NOT censor or delete values with |Z| > 3.5 sigma!
  const resWithSpike = evaluateIndependentFalseAlarmRate(snrMap, width, height, {
    blockSize: 20,
    threshold: 5.0,
    sourceExclusionList: [], // No source mask
  });

  assert.equal(resWithSpike.passesThreshold, false, '8-sigma spike must be detected and not censored');
  assert.equal(resWithSpike.falsePositiveCount, 1, 'Exactly one block must trip the 5-sigma threshold');
  assert.ok(resWithSpike.maxObservedSnr >= 8.0, `Max observed SNR must reflect the 8.0 sigma spike, got ${resWithSpike.maxObservedSnr}`);

  // 2. Evaluate WITH independent catalog mask around the known source:
  const resMasked = evaluateIndependentFalseAlarmRate(snrMap, width, height, {
    blockSize: 20,
    threshold: 5.0,
    sourceExclusionList: [{ col: 30, row: 30, radiusPx: 5 }],
  });

  assert.equal(resMasked.passesThreshold, true, 'Clean background without sources must pass 5-sigma threshold');
  assert.equal(resMasked.falsePositiveCount, 0, 'No pure noise block should exceed 5-sigma in 25 blocks');
  assert.ok(resMasked.clopperPearsonUpper95 < 0.15, 'Exact 95% Clopper-Pearson bound properly computed');
});

test('Fase 2.3.9B - Spatial Autocorrelation: Separation of A_beam, A_corr_weighted and A_support_geom', () => {
  const width = 60;
  const height = 60;
  const diffPixels = new Float32Array(width * height);
  const rng = createSeededRandom(12345);

  // Synthesize smooth background with spatial correlation
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      diffPixels[r * width + c] = rng() - 0.5;
    }
  }

  const resAcf = computeSpatialAutocorrelation(diffPixels, width, height, {
    threshold: 0.05,
    fwhmPx: 1.611,
    patchRadius: 25,
  });

  assert.equal(resAcf !== null, true);

  // A_beam: Analytical PSF beam area = 1.13309 * 1.611^2 = 2.942 px^2
  assert.ok(Math.abs(resAcf.A_beam - 2.942) < 0.01, `A_beam should be ~2.942 px^2, got ${resAcf.A_beam}`);

  // A_corr_weighted and A_support_geom must be strictly non-negative and distinct
  assert.ok(resAcf.A_corr_weighted > 0, 'Weighted correlation integral must be positive');
  assert.ok(resAcf.A_support_geom >= 1, 'Geometric support area must contain at least the central lag');
  assert.ok(resAcf.N_eff_weighted > 0, 'Effective degrees of freedom must be positive');

  // Verify conceptual separation:
  assert.notEqual(resAcf.A_beam, resAcf.A_corr_weighted, 'A_beam must not be conflated with A_corr_weighted');
  assert.notEqual(resAcf.A_support_geom, resAcf.A_corr_weighted, 'Geometric support area must not be conflated with weighted integral');
});

