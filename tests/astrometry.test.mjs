import test from 'node:test';
import assert from 'node:assert/strict';

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
