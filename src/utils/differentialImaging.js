import {
  CATEGORY_A_INSTRUMENTAL_MASK,
  CATEGORY_B_QUALITY_WARNING_MASK,
  CATEGORY_C_CANDIDATE_ANOMALY_MASK,
  SPHEREX_FLAG_BITS,
  assessPhotometricComparability,
  classifyPixelFlags,
} from './fitsImage.js';
import { propagateCoordinates } from '../data/spherexTargets.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Robustly estimates the photometric scale factor (alpha) and residual background offset (B)
 * between two reprojected SPHEREx observations:
 *   I2(x,y) ~= alpha * I1(x,y) + B
 *
 * To avoid circular bias, pixels belonging to the science target region, saturated pixels
 * (MP_OVERFLOW), and pixels with instrumental errors (Category A) are excluded.
 *
 * @param {object} frame1 - Reference epoch parsed FITS frame
 * @param {object} frame2 - Comparison epoch parsed FITS frame
 * @param {object} options - Configuration options
 * @returns {object} Scale factor, background offset, variances, and reliability metrics
 */
export function computePhotometricScaleAndBackground(frame1, frame2, options = {}) {
  const pixels1 = frame1?.scientificPixels || frame1?.reprojected?.pixels;
  const pixels2 = frame2?.scientificPixels || frame2?.reprojected?.pixels;
  if (!pixels1 || !pixels2 || pixels1.length !== pixels2.length) {
    return {
      alpha: 1.0,
      alphaVariance: 0.0,
      backgroundOffset: 0.0,
      backgroundVariance: 0.0,
      validReferencePixelCount: 0,
      correlation: 0.0,
      isReliable: false,
      warningEs: 'Dimensiones incompatibles entre las imágenes para cálculo de normalización.',
      warningEn: 'Incompatible image dimensions for normalization calculation.',
    };
  }

  const length = pixels1.length;
  const width = frame1.reprojected?.width || frame1.width || Math.round(Math.sqrt(length));
  const height = frame1.reprojected?.height || frame1.height || width;

  const var1 = frame1.reprojected?.variancePixels || frame1.rawVariancePixels;
  const var2 = frame2.reprojected?.variancePixels || frame2.rawVariancePixels;
  const flags1 = frame1.reprojected?.flagsPixels || frame1.rawFlagsPixels;
  const flags2 = frame2.reprojected?.flagsPixels || frame2.rawFlagsPixels;

  const excludedCenter = options.excludedCenter || null;
  const excludedRadiusPx = options.excludedRadiusPx || 14; // ~84 arcsec exclusion around primary target
  const centerCol = excludedCenter?.col ?? width * 0.5;
  const centerRow = excludedCenter?.row ?? height * 0.5;

  // 1. Independent empirical background and robust noise estimation
  const validPixels1 = [];
  const validPixels2 = [];

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      const v1 = pixels1[idx];
      const v2 = pixels2[idx];
      if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;

      if (excludedCenter && Math.hypot(c - centerCol, r - centerRow) <= excludedRadiusPx) {
        continue;
      }

      const f1 = flags1 ? flags1[idx] : 0;
      const f2 = flags2 ? flags2[idx] : 0;
      if (
        (f1 & (CATEGORY_A_INSTRUMENTAL_MASK | SPHEREX_FLAG_BITS.MP_OVERFLOW)) !== 0 ||
        (f2 & (CATEGORY_A_INSTRUMENTAL_MASK | SPHEREX_FLAG_BITS.MP_OVERFLOW)) !== 0
      ) {
        continue;
      }

      validPixels1.push(v1);
      validPixels2.push(v2);
    }
  }

  const nTotal = validPixels1.length;
  if (nTotal < 40) {
    return {
      alpha: 1.0,
      alphaVariance: 0.0,
      backgroundOffset: 0.0,
      backgroundVariance: 0.0,
      baseVariance: 0.0,
      meanX: 0.0,
      validReferencePixelCount: 0,
      correlation: 0.0,
      method: 'insufficient_pixels',
      isReliable: false,
      warningEs: 'Número insuficiente de píxeles válidos (N < 40). Se utilizó α = 1.0 sin reescalado.',
      warningEn: 'Insufficient valid pixels (N < 40). Using α = 1.0 without rescaling.',
    };
  }

  // Median and MAD background estimation
  const sorted1 = [...validPixels1].sort((a, b) => a - b);
  const sorted2 = [...validPixels2].sort((a, b) => a - b);
  const bg1 = sorted1[Math.floor(nTotal * 0.5)];
  const bg2 = sorted2[Math.floor(nTotal * 0.5)];
  const mad1 = sorted1.map((v) => Math.abs(v - bg1)).sort((a, b) => a - b)[Math.floor(nTotal * 0.5)] || 0.02;
  const mad2 = sorted2.map((v) => Math.abs(v - bg2)).sort((a, b) => a - b)[Math.floor(nTotal * 0.5)] || 0.02;
  const sig1 = mad1 * 1.4826;
  const sig2 = mad2 * 1.4826;

  // 2. Identify independent stellar reference sources (flux > 2.5-sigma above background)
  // to avoid regression noise-dilution bias on diffuse background
  const refStarX = [];
  const refStarY = [];
  const refStarW = [];

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      const v1 = pixels1[idx];
      const v2 = pixels2[idx];
      if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;

      if (excludedCenter && Math.hypot(c - centerCol, r - centerRow) <= excludedRadiusPx) {
        continue;
      }

      const f1 = flags1 ? flags1[idx] : 0;
      const f2 = flags2 ? flags2[idx] : 0;
      if (
        (f1 & (CATEGORY_A_INSTRUMENTAL_MASK | SPHEREX_FLAG_BITS.MP_OVERFLOW)) !== 0 ||
        (f2 & (CATEGORY_A_INSTRUMENTAL_MASK | SPHEREX_FLAG_BITS.MP_OVERFLOW)) !== 0
      ) {
        continue;
      }

      // Exclude saturated cores
      if (v1 > 1000 || v2 > 1000) continue;

      const d1 = v1 - bg1;
      const d2 = v2 - bg2;

      // Select stellar signal significantly above local background in BOTH epochs
      if (d1 >= 2.5 * sig1 && d2 >= 2.5 * sig2) {
        const ev1 = var1 && Number.isFinite(var1[idx]) && var1[idx] > 0 ? var1[idx] : sig1 * sig1;
        const ev2 = var2 && Number.isFinite(var2[idx]) && var2[idx] > 0 ? var2[idx] : sig2 * sig2;
        const weight = 1.0 / (ev1 + ev2);

        refStarX.push(d1);
        refStarY.push(d2);
        refStarW.push(weight);
      }
    }
  }

  const nStars = refStarX.length;
  const sameDetector =
    (frame1.detector?.detector || frame1.band) === (frame2.detector?.detector || frame2.band);

  let alpha = 1.0;
  let bgOffset = bg2 - bg1;
  let alphaVar = 0.0;
  let bgVar = (sig1 * sig1 + sig2 * sig2) / Math.max(1, nTotal);
  let baseVar = bgVar;
  let rPearson = 0.0;
  let meanX = 0.0;
  let isReliable = false;
  let method = 'unrescaled_fallback';
  let warningEs = null;
  let warningEn = null;

  if (nStars >= 25) {
    // Perform robust weighted regression on net stellar source fluxes
    let sumW = 0,
      sumWXX = 0,
      sumWXY = 0,
      sumWYY = 0,
      sumWX = 0,
      sumWY = 0;

    for (let i = 0; i < nStars; i++) {
      const x = refStarX[i];
      const y = refStarY[i];
      const w = refStarW[i];
      sumW += w;
      sumWX += w * x;
      sumWY += w * y;
      sumWXX += w * x * x;
      sumWXY += w * x * y;
      sumWYY += w * y * y;
    }

    if (sumWXX > 1e-12) {
      alpha = sumWXY / sumWXX;
      bgOffset = bg2 - alpha * bg1;

      meanX = sumWX / sumW;
      const denom = Math.sqrt(Math.max(1e-12, sumWXX * sumWYY));
      rPearson = denom > 0 ? sumWXY / denom : 0.0;

      // Residual dispersion on reference stars
      const starRes = refStarX.map((x, i) => Math.abs(refStarY[i] - alpha * x));
      starRes.sort((a, b) => a - b);
      const medRes = starRes[Math.floor(starRes.length / 2)] || 0.01;
      const sigmaStarRes = medRes * 1.4826;

      alphaVar = (sigmaStarRes * sigmaStarRes) / Math.max(1e-6, sumWXX);
      baseVar = (sigmaStarRes * sigmaStarRes) / Math.max(1e-6, sumW);
      bgVar = baseVar + bg1 * bg1 * alphaVar;

      method = 'stellar_sources';
      isReliable = sameDetector && alpha >= 0.5 && alpha <= 2.0 && rPearson >= 0.60;
    }
  } else {
    // Insufficient stellar sources to perform unbiased regression;
    // fallback safely to unrescaled comparison (alpha = 1.0) with independent median background subtraction
    alpha = 1.0;
    bgOffset = bg2 - bg1;
    alphaVar = 0.0;
    rPearson = 0.0;
    method = 'unrescaled_fallback';
    isReliable = false;
    warningEs =
      'Fuentes de referencia estelares independientes insuficientes (N < 25). Se aplicó comparación sin reescalado (α = 1.0, B = B2 - B1) para evitar sesgo por ruido difuso.';
    warningEn =
      'Insufficient independent stellar reference sources (N < 25). Applied unrescaled comparison (α = 1.0, B = B2 - B1) to prevent diffuse noise bias.';
  }

  if (!sameDetector) {
    warningEs =
      'Detectores distintos: el factor α refleja pendientes espectrales de las fuentes de campo, no normalización fotométrica monomodal.';
    warningEn =
      'Different detectors: α factor reflects field SED slopes rather than monomodal photometric normalization.';
  } else if (!isReliable && nStars >= 25) {
    warningEs = `Normalización de fuentes de baja correlación (r = ${rPearson.toFixed(2)}, α = ${alpha.toFixed(2)}). Se recomienda verificar manualmente.`;
    warningEn = `Low-correlation source normalization (r = ${rPearson.toFixed(2)}, α = ${alpha.toFixed(2)}). Manual verification recommended.`;
  }

  return {
    alpha: Number(alpha.toFixed(4)),
    alphaVariance: Number(Math.max(1e-7, alphaVar).toFixed(6)),
    backgroundOffset: Number(bgOffset.toFixed(4)),
    backgroundVariance: Number(Math.max(1e-7, bgVar).toFixed(6)),
    baseVariance: Number(Math.max(1e-7, baseVar).toFixed(6)),
    meanX: Number(meanX.toFixed(4)),
    validReferencePixelCount: nStars,
    correlation: Number(rPearson.toFixed(3)),
    method,
    isReliable,
    warningEs,
    warningEn,
  };
}

/**
 * Evaluates Point Spread Function (PSF) comparability between two observations.
 * SPHEREx native FWHM ranges from ~5.25" (D1) to ~6.5" (D6).
 */
export function assessPsfComparability(frame1, frame2) {
  const fwhm1 =
    Number(frame1?.extensions?.psfFwhmArcsec) ||
    Number(frame1?.headerValues?.PSF_FWHM) ||
    (frame1?.detector?.detector ? 5.0 + frame1.detector.detector * 0.25 : 5.5);
  const fwhm2 =
    Number(frame2?.extensions?.psfFwhmArcsec) ||
    Number(frame2?.headerValues?.PSF_FWHM) ||
    (frame2?.detector?.detector ? 5.0 + frame2.detector.detector * 0.25 : 5.5);

  const deltaFwhm = Math.abs(fwhm2 - fwhm1);
  const sameDetector =
    (frame1?.detector?.detector || frame1?.band) === (frame2?.detector?.detector || frame2?.band);
  const compatible = sameDetector && deltaFwhm <= 0.85;
  const quantitativeInterpretationAllowed = compatible;

  let warningEs = null;
  let warningEn = null;
  if (!sameDetector) {
    warningEs = `PSF de detectores diferentes (D${frame1?.detector?.detector || '?'} vs D${frame2?.detector?.detector || '?'}). Los perfiles ópticos difieren. No se permite interpretación fotométrica cuantitativa sin convolución a PSF común.`;
    warningEn = `Different detector PSFs (D${frame1?.detector?.detector || '?'} vs D${frame2?.detector?.detector || '?'}). Optical profiles differ. Quantitative photometric interpretation is not permitted without common PSF convolution.`;
  } else if (!compatible) {
    warningEs = `Desajuste de PSF no corregido (ΔFWHM = ${deltaFwhm.toFixed(2)}"). La sustracción directa puede inducir anillos dipolares espurios y no permite interpretación cuantitativa.`;
    warningEn = `Uncorrected PSF mismatch (ΔFWHM = ${deltaFwhm.toFixed(2)}"). Direct subtraction may induce spurious dipolar rings and does not permit quantitative interpretation.`;
  }

  return {
    compatible,
    quantitativeInterpretationAllowed,
    fwhm1: Number(fwhm1.toFixed(3)),
    fwhm2: Number(fwhm2.toFixed(3)),
    deltaFwhm: Number(deltaFwhm.toFixed(3)),
    warningEs,
    warningEn,
  };
}

/**
 * Computes the differential image D(x,y) = I2(x,y) - alpha * I1(x,y) - B(x,y)
 * with complete variance and significance (SNR) propagation:
 *   Var(D) = Var(I2) + alpha^2 * Var(I1) + I1^2 * Var(alpha)
 *   SNR_D = D / sqrt(Var(D))
 *
 * @param {object} frame1 - Reference epoch frame
 * @param {object} frame2 - Comparison epoch frame
 * @param {object} options - Configuration options (e.g., custom alpha, excludeCenter)
 * @returns {object} Differential image arrays, statistics, and metadata
 */
export function computeDifferentialImage(frame1, frame2, options = {}) {
  const pixels1 = frame1?.scientificPixels || frame1?.reprojected?.pixels;
  const pixels2 = frame2?.scientificPixels || frame2?.reprojected?.pixels;
  if (!pixels1 || !pixels2 || pixels1.length !== pixels2.length) {
    throw new Error('Las dos observaciones no tienen la misma cuadrícula de píxeles reproyectada.');
  }

  const length = pixels1.length;
  const width = frame1.reprojected?.width || frame1.width || Math.round(Math.sqrt(length));
  const height = frame1.reprojected?.height || frame1.height || width;

  const var1 = frame1.reprojected?.variancePixels || frame1.rawVariancePixels;
  const var2 = frame2.reprojected?.variancePixels || frame2.rawVariancePixels;
  const flags1 = frame1.reprojected?.flagsPixels || frame1.rawFlagsPixels;
  const flags2 = frame2.reprojected?.flagsPixels || frame2.rawFlagsPixels;

  // Compute or apply photometric scale and residual background
  const scaleNorm =
    options.manualAlpha !== undefined
      ? {
          alpha: Number(options.manualAlpha) || 1.0,
          alphaVariance: 0.0,
          backgroundOffset: Number(options.manualBackground) || 0.0,
          backgroundVariance: 0.0,
          validReferencePixelCount: length,
          correlation: 1.0,
          isReliable: true,
          warningEs: null,
          warningEn: null,
        }
      : computePhotometricScaleAndBackground(frame1, frame2, options);

  const { alpha, alphaVariance, backgroundOffset } = scaleNorm;
  const alphaSq = alpha * alpha;

  const diffPixels = new Float32Array(length);
  const variancePixels = new Float32Array(length);
  const sigmaPixels = new Float32Array(length);
  const snrPixels = new Float32Array(length);

  diffPixels.fill(NaN);
  variancePixels.fill(NaN);
  sigmaPixels.fill(NaN);
  snrPixels.fill(NaN);

  let validCount = 0;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  let sumDiff = 0;
  let sumDiffSq = 0;
  let posResidualSum = 0;
  let negResidualSum = 0;
  let minSnr = Infinity;
  let maxSnr = -Infinity;

  const validDiffValues = [];

  for (let i = 0; i < length; i++) {
    const v1 = pixels1[i];
    const v2 = pixels2[i];

    // Require valid, finite pixels in BOTH images
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;

    // Mask Category A instrumental errors from either observation
    const f1 = flags1 ? flags1[i] : 0;
    const f2 = flags2 ? flags2[i] : 0;
    if (
      (f1 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0 ||
      (f2 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0
    ) {
      continue;
    }

    // Mathematical difference: D = I2 - alpha * I1 - B
    const d = v2 - alpha * v1 - backgroundOffset;
    diffPixels[i] = d;
    validDiffValues.push(d);

    // Exact variance propagation including Var(B) and Cov(alpha, B):
    // Var(D) = Var(I2) + alpha^2 * Var(I1) + (I1 - meanX)^2 * Var(alpha) + Var(B_cen)
    const ev1 = var1 && Number.isFinite(var1[i]) && var1[i] > 0 ? var1[i] : 0.02;
    const ev2 = var2 && Number.isFinite(var2[i]) && var2[i] > 0 ? var2[i] : 0.02;
    const meanRefX = scaleNorm.meanX || 0.0;
    const baseBgVar = scaleNorm.baseVariance || scaleNorm.backgroundVariance || 0.0;
    const varModel = (v1 - meanRefX) * (v1 - meanRefX) * alphaVariance + baseBgVar;
    const varD = ev2 + alphaSq * ev1 + varModel;
    const sigD = Math.sqrt(Math.max(1e-7, varD));

    variancePixels[i] = varD;
    sigmaPixels[i] = sigD;

    // Significance map: SNR_D = D / sigma_D
    const snr = sigD > 0 ? d / sigD : 0;
    snrPixels[i] = snr;

    validCount++;
    sumDiff += d;
    sumDiffSq += d * d;
    if (d > 0) posResidualSum += d;
    else negResidualSum += d;

    minDiff = Math.min(minDiff, d);
    maxDiff = Math.max(maxDiff, d);
    minSnr = Math.min(minSnr, snr);
    maxSnr = Math.max(maxSnr, snr);
  }

  validDiffValues.sort((a, b) => a - b);
  const medianDiff = validDiffValues.length
    ? validDiffValues[Math.floor(validDiffValues.length / 2)]
    : 0;
  const meanDiff = validCount > 0 ? sumDiff / validCount : 0;
  const rmsDiff = validCount > 0 ? Math.sqrt(sumDiffSq / validCount) : 0;

  // ---------------------------------------------------------------------------
  // EMPIRICAL NOISE CALIBRATION ON SOURCE-FREE SKY REGIONS
  // ---------------------------------------------------------------------------
  const skyDiffVals = [];
  const skyTheoSigVals = [];
  const cx = width * 0.5;
  const cy = height * 0.5;
  const centerExclRadius = 22; // ~132 arcsec radius to exclude primary target

  for (let r = 15; r < height - 15; r++) {
    for (let c = 15; c < width - 15; c++) {
      if (Math.hypot(c - cx, r - cy) <= centerExclRadius) continue;
      const idx = r * width + c;
      const v1 = pixels1[idx];
      const v2 = pixels2[idx];
      const d = diffPixels[idx];
      const s = sigmaPixels[idx];
      if (!Number.isFinite(d) || !Number.isFinite(s) || s <= 0) continue;

      // Select source-free background: fluxes below median + 2.5 sigma
      if (v1 <= medianDiff + 1.5 && v2 <= medianDiff + 1.5) {
        skyDiffVals.push(d);
        skyTheoSigVals.push(s);
      }
    }
  }

  let etaSky = 1.0;
  let sigmaEmp = 0.04;
  let medianSkyDiff = 0.0;
  let medianTheoSigma = 0.04;
  let robustSigmaSkyCal = 1.0;
  let falsePositiveCount = 0;

  if (skyDiffVals.length >= 100) {
    skyDiffVals.sort((a, b) => a - b);
    medianSkyDiff = skyDiffVals[Math.floor(skyDiffVals.length * 0.5)];
    const skyMads = skyDiffVals
      .map((d) => Math.abs(d - medianSkyDiff))
      .sort((a, b) => a - b);
    const skyMad = skyMads[Math.floor(skyMads.length * 0.5)];
    sigmaEmp = Math.max(1e-5, skyMad * 1.4826);

    skyTheoSigVals.sort((a, b) => a - b);
    medianTheoSigma = Math.max(1e-5, skyTheoSigVals[Math.floor(skyTheoSigVals.length * 0.5)]);
    etaSky = Math.max(0.5, Math.min(25.0, sigmaEmp / medianTheoSigma));
  }

  // Construct empirically calibrated SNR map:
  // SNR_cal(x, y) = D(x, y) / (etaSky * sigma_theo(x, y))
  // Note: D(x, y) already incorporates the unbiased background offset B = meanY - alpha * meanX.
  // We strictly avoid arbitrary post-hoc median subtraction on the calibration data.
  const calibratedSnrPixels = new Float32Array(length);
  calibratedSnrPixels.fill(NaN);
  let minCalSnr = Infinity;
  let maxCalSnr = -Infinity;

  for (let i = 0; i < length; i++) {
    const d = diffPixels[i];
    const s = sigmaPixels[i];
    if (Number.isFinite(d) && Number.isFinite(s) && s > 0) {
      const calSig = s * etaSky;
      const calSnr = d / calSig;
      calibratedSnrPixels[i] = calSnr;
      minCalSnr = Math.min(minCalSnr, calSnr);
      maxCalSnr = Math.max(maxCalSnr, calSnr);
    }
  }

  // Audit normalized residual distribution on control sky sample
  if (skyDiffVals.length >= 100) {
    const calSkySnrs = [];
    for (let i = 0; i < skyDiffVals.length; i++) {
      const d = skyDiffVals[i];
      const s = skyTheoSigVals[i] * etaSky;
      const sCal = d / s;
      calSkySnrs.push(sCal);
      if (Math.abs(sCal) >= 5.0) falsePositiveCount++;
    }
    calSkySnrs.sort((a, b) => a - b);
    const medCal = calSkySnrs[Math.floor(calSkySnrs.length * 0.5)];
    const madCal = calSkySnrs
      .map((x) => Math.abs(x - medCal))
      .sort((a, b) => a - b)[Math.floor(calSkySnrs.length * 0.5)];
    robustSigmaSkyCal = Number((madCal * 1.4826).toFixed(3));
  }

  const psfAssessment = assessPsfComparability(frame1, frame2);
  const spectralAssessment = assessPhotometricComparability(frame1, frame2);

  return {
    diffPixels,
    variancePixels,
    sigmaPixels,
    snrPixels,
    calibratedSnrPixels,
    width,
    height,
    length,
    validPixelCount: validCount,
    scaleNorm,
    psfAssessment,
    spectralAssessment,
    empiricalCalibration: {
      etaSky: Number(etaSky.toFixed(4)),
      sigmaEmp: Number(sigmaEmp.toFixed(4)),
      medianSkyDiff: Number(medianSkyDiff.toFixed(4)),
      medianTheoSigma: Number(medianTheoSigma.toFixed(4)),
      robustSigmaSkyCal,
      skyControlCount: skyDiffVals.length,
      falsePositiveCount,
    },
    stats: {
      minDiff: Number.isFinite(minDiff) ? Number(minDiff.toFixed(4)) : 0,
      maxDiff: Number.isFinite(maxDiff) ? Number(maxDiff.toFixed(4)) : 0,
      meanDiff: Number(meanDiff.toFixed(4)),
      medianDiff: Number(medianDiff.toFixed(4)),
      rmsDiff: Number(rmsDiff.toFixed(4)),
      posResidualSum: Number(posResidualSum.toFixed(3)),
      negResidualSum: Number(negResidualSum.toFixed(3)),
      minSnr: Number.isFinite(minSnr) ? Number(minSnr.toFixed(2)) : 0,
      maxSnr: Number.isFinite(maxSnr) ? Number(maxSnr.toFixed(2)) : 0,
      minCalSnr: Number.isFinite(minCalSnr) ? Number(minCalSnr.toFixed(2)) : 0,
      maxCalSnr: Number.isFinite(maxCalSnr) ? Number(maxCalSnr.toFixed(2)) : 0,
    },
  };
}

/**
 * Renders a diverging colormap onto an HTML Canvas (or Data URL)
 * for differential images D or significance maps SNR_D.
 *
 * Colormap scheme:
 *   Negative (< -threshold): Deep Blue / Electric Cyan (dimmed / vacated)
 *   Near Zero (|val| < threshold/3): Neutral Space Dark (no significant change)
 *   Positive (> +threshold): Solar Amber / Fiery Crimson / White (brightened / appeared)
 *
 * @param {Float32Array} pixels - Differential array or SNR array
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @param {object} options - Threshold and mode configuration
 * @returns {string} Data URL (PNG) of rendered canvas
 */
export function renderDivergingColormap(pixels, width, height, options = {}) {
  const threshold = options.threshold || 5.0; // default 5.0 sigma or limit
  const isSnrMode = options.isSnrMode ?? false;
  const customLimit = options.limit || (isSnrMode ? threshold : threshold * 0.2);

  if (typeof document === 'undefined') {
    // Return empty placeholder in non-DOM/node environment
    return '';
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const total = width * height;
  for (let i = 0; i < total; i++) {
    const v = pixels[i];
    const at = i * 4;

    if (!Number.isFinite(v)) {
      // Uncovered or masked: transparent dark
      data[at] = 4;
      data[at + 1] = 7;
      data[at + 2] = 14;
      data[at + 3] = 0;
      continue;
    }

    // Normalized value from -1.0 to +1.0
    const norm = Math.max(-1.0, Math.min(1.0, v / customLimit));
    const absNorm = Math.abs(norm);

    if (absNorm < 0.12) {
      // Near zero noise floor: subtle dark slate
      const darkScale = Math.round(absNorm * 40);
      data[at] = 10 + darkScale;
      data[at + 1] = 14 + darkScale;
      data[at + 2] = 24 + darkScale;
      data[at + 3] = 255;
    } else if (norm < 0) {
      // Negative residual: Blue to Cyan
      const t = Math.pow(absNorm, 0.75);
      data[at] = Math.round(20 * (1 - t) + 0 * t);
      data[at + 1] = Math.round(90 * (1 - t) + 210 * t);
      data[at + 2] = Math.round(230 * (1 - t) + 255 * t);
      data[at + 3] = 255;
    } else {
      // Positive residual: Amber to Crimson to Warm White
      const t = Math.pow(absNorm, 0.75);
      if (t < 0.7) {
        const u = t / 0.7;
        data[at] = Math.round(230 * u + 50 * (1 - u));
        data[at + 1] = Math.round(110 * u + 15 * (1 - u));
        data[at + 2] = Math.round(25 * (1 - u));
      } else {
        const u = (t - 0.7) / 0.3;
        data[at] = 255;
        data[at + 1] = Math.round(110 + 145 * u);
        data[at + 2] = Math.round(20 + 235 * u);
      }
      data[at + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Computes the subpixel centroid and integrated aperture flux of an astronomical source
 * within a local region, subtracting the local sky background from a surrounding annulus.
 * Includes theoretical centroid error propagation: sigma_pos ~= sigma_PSF / SNR.
 *
 * @param {object} frame - Parsed FITS frame with reprojected or native pixels
 * @param {number} approxCol - Approximate column center
 * @param {number} approxRow - Approximate row center
 * @param {number} radius - Aperture radius (pixels)
 * @returns {object} Centroid { col, row, flux, snr, sigmaPosPx, skyBg }
 */
export function computeSubpixelSourceCentroid(frame, approxCol, approxRow, radius = 4.5) {
  const pixels = frame?.reprojected?.pixels || frame?.scientificPixels;
  const varPixels = frame?.reprojected?.variancePixels || frame?.rawVariancePixels;
  const width = frame?.reprojected?.width || frame?.width || 300;
  const height = frame?.reprojected?.height || frame?.height || 300;
  if (!pixels) return null;

  // Local sky annulus [radius + 1.5, radius + 4.0]
  const skyInner = radius + 1.5;
  const skyOuter = radius + 4.0;
  const skyVals = [];
  const rMin = Math.max(0, Math.floor(approxRow - skyOuter));
  const rMax = Math.min(height - 1, Math.ceil(approxRow + skyOuter));
  const cMin = Math.max(0, Math.floor(approxCol - skyOuter));
  const cMax = Math.min(width - 1, Math.ceil(approxCol + skyOuter));

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const d = Math.hypot(c - approxCol, r - approxRow);
      if (d >= skyInner && d <= skyOuter) {
        const v = pixels[r * width + c];
        if (Number.isFinite(v)) skyVals.push(v);
      }
    }
  }
  skyVals.sort((a, b) => a - b);
  const skyBg = skyVals.length ? skyVals[Math.floor(skyVals.length * 0.5)] : 0;

  // Flux-weighted center of mass with background subtraction and saturated core reconstruction
  let sumW = 0, sumWx = 0, sumWy = 0, sumVar = 0;
  // First pass: find maximum valid flux in core to handle saturated NaN cores symmetrically
  let coreMaxVal = 0;
  for (let r = Math.max(0, Math.floor(approxRow - 2)); r <= Math.min(height - 1, Math.ceil(approxRow + 2)); r++) {
    for (let c = Math.max(0, Math.floor(approxCol - 2)); c <= Math.min(width - 1, Math.ceil(approxCol + 2)); c++) {
      const v = pixels[r * width + c];
      if (Number.isFinite(v) && v > coreMaxVal) coreMaxVal = v;
    }
  }

  for (let r = Math.max(0, Math.floor(approxRow - radius)); r <= Math.min(height - 1, Math.ceil(approxRow + radius)); r++) {
    for (let c = Math.max(0, Math.floor(approxCol - radius)); c <= Math.min(width - 1, Math.ceil(approxCol + radius)); c++) {
      const d = Math.hypot(c - approxCol, r - approxRow);
      if (d <= radius) {
        const idx = r * width + c;
        let rawVal = pixels[idx];
        if (!Number.isFinite(rawVal) && d <= 2.0 && coreMaxVal > 10.0) {
          rawVal = coreMaxVal; // Restore symmetry of saturated core
        }
        const v = (Number.isFinite(rawVal) ? rawVal : skyBg) - skyBg;
        if (v > 0) {
          sumW += v;
          sumWx += v * c;
          sumWy += v * r;
          const variance = varPixels ? varPixels[idx] : 0.005;
          sumVar += Number.isFinite(variance) ? variance : 0.005;
        }
      }
    }
  }

  const cx = sumW > 0 ? sumWx / sumW : approxCol;
  const cy = sumW > 0 ? sumWy / sumW : approxRow;
  const snr = sumW / Math.sqrt(Math.max(1e-6, sumVar));
  const sigmaPsfPx = 5.25 / 6.0 / 2.355; // ~0.37 px for SPHEREx
  const sigmaPosPx = Math.max(0.01, sigmaPsfPx / Math.max(1.0, snr));

  return { col: cx, row: cy, flux: sumW, snr, sigmaPosPx, skyBg };
}

/**
 * Measures the subpixel astrometric displacement between two frames for a given source,
 * using stationary field reference stars to correct for residual boresight alignment.
 *
 * @param {object} frame1 - Reference epoch frame
 * @param {object} frame2 - Comparison epoch frame
 * @param {number} col - Source column
 * @param {number} row - Source row
 * @returns {object} Astrometric shift details and significance
 */
export function measureSubpixelAstrometry(frame1, frame2, col, row) {
  const c1 = computeSubpixelSourceCentroid(frame1, col, row, 4.5);
  const c2 = computeSubpixelSourceCentroid(frame2, col, row, 4.5);
  if (!c1 || !c2 || c1.flux <= 0 || c2.flux <= 0) {
    return { success: false, measuredShiftArcsec: 0, measuredPaDeg: 0, astrometricSnr: 0 };
  }

  const gridToWorld1 = frame1?.reprojected?.gridToWorld;
  const gridToWorld2 = frame2?.reprojected?.gridToWorld || gridToWorld1;
  const scaleArcsec = frame1?.reprojected?.scaleDeg ? frame1.reprojected.scaleDeg * 3600 : 6.0;

  // Measure field registration offset using bright reference stars outside central region
  const w = frame1?.reprojected?.width || 300;
  const h = frame1?.reprojected?.height || 300;
  const px1 = frame1?.reprojected?.pixels;
  const px2 = frame2?.reprojected?.pixels;
  let regDc = 0, regDr = 0, regUncertaintyPx = 0.05;

  if (px1 && px2) {
    const offsets = [];
    for (let r = 25; r < h - 25; r += 10) {
      for (let c = 25; c < w - 25; c += 10) {
        if (Math.hypot(c - col, r - row) < 25) continue;
        if (px1[r * w + c] > 2.0 && px2[r * w + c] > 2.0) {
          const s1 = computeSubpixelSourceCentroid(frame1, c, r, 3.5);
          const s2 = computeSubpixelSourceCentroid(frame2, c, r, 3.5);
          if (s1 && s2 && s1.flux > 2.0 && s2.flux > 2.0 && Math.hypot(s1.col - s2.col, s1.row - s2.row) < 1.0) {
            offsets.push({ dc: s2.col - s1.col, dr: s2.row - s1.row });
          }
        }
      }
    }
    if (offsets.length >= 3) {
      offsets.sort((a, b) => a.dc - b.dc);
      regDc = offsets[Math.floor(offsets.length * 0.5)].dc;
      offsets.sort((a, b) => a.dr - b.dr);
      regDr = offsets[Math.floor(offsets.length * 0.5)].dr;
      regUncertaintyPx = 0.37 / Math.sqrt(offsets.length);
    }
  }

  // Net motion vector corrected for field registration
  const netDc = (c2.col - c1.col) - regDc;
  const netDr = (c2.row - c1.row) - regDr;

  let measuredShiftArcsec = 0;
  let measuredPaDeg = 0;

  if (gridToWorld1 && gridToWorld2) {
    const w1 = gridToWorld1(c1.col, c1.row);
    const w2 = gridToWorld2(c1.col + netDc, c1.row + netDr);
    const dra = (w2.ra - w1.ra) * Math.cos(((w1.dec + w2.dec) * 0.5 * Math.PI) / 180) * 3600;
    const ddec = (w2.dec - w1.dec) * 3600;
    measuredShiftArcsec = Math.hypot(dra, ddec);
    measuredPaDeg = ((Math.atan2(dra, ddec) * 180) / Math.PI + 360) % 360;
  } else {
    measuredShiftArcsec = Math.hypot(netDc, netDr) * scaleArcsec;
    measuredPaDeg = ((Math.atan2(netDc, -netDr) * 180) / Math.PI + 360) % 360;
  }

  const totalSigPx = Math.hypot(c1.sigmaPosPx, c2.sigmaPosPx, regUncertaintyPx);
  const astrometricSnr = measuredShiftArcsec / Math.max(1e-4, totalSigPx * scaleArcsec);

  return {
    success: true,
    measuredShiftArcsec: Number(measuredShiftArcsec.toFixed(3)),
    measuredPaDeg: Number(measuredPaDeg.toFixed(1)),
    astrometricSnr: Number(astrometricSnr.toFixed(1)),
    centroid1: { col: Number(c1.col.toFixed(3)), row: Number(c1.row.toFixed(3)), flux: Number(c1.flux.toFixed(2)) },
    centroid2: { col: Number(c2.col.toFixed(3)), row: Number(c2.row.toFixed(3)), flux: Number(c2.flux.toFixed(2)) },
    fieldRegistration: { dcPx: Number(regDc.toFixed(3)), drPx: Number(regDr.toFixed(3)) },
  };
}

/**
 * Scans the differential and significance arrays to identify astronomical candidates:
 * - Proper Motion Dipoles (paired negative deficit + positive excess along space motion vector)
 * - Variable Stars (brightened or dimmed without dipole partner)
 * - Transient Anomalies (coinciding with Category C flags: TRANSIENT, OUTLIER, STREAK)
 * - Artifacts (Category A instrumental errors or optical reflections)
 *
 * @param {object} diffResult - Result from computeDifferentialImage
 * @param {object} frame1 - Reference epoch frame
 * @param {object} frame2 - Comparison epoch frame
 * @param {object} targetInfo - Selected mission target metadata
 * @param {object} options - Detection options
 * @returns {Array<object>} Identified candidates with positions, significance, and classification
 */
export function detectDifferentialCandidates(diffResult, frame1, frame2, targetInfo, options = {}) {
  const { diffPixels, snrPixels, calibratedSnrPixels, width, height } = diffResult;
  // Use empirically calibrated SNR by default to eliminate false alarms from unmodeled sky noise
  const activeSnr = calibratedSnrPixels || snrPixels;
  const snrThreshold = options.snrThreshold || 4.5;
  const minFluxThreshold = options.minFluxThreshold || 0.10; // minimum |D| in MJy/sr
  const scaleArcsec = frame1?.reprojected?.scaleDeg ? frame1.reprojected.scaleDeg * 3600 : 6.0;
  // Formal spatial resolution model: effective reprojected FWHM is ~9.67 arcsec (~1.61 reprojected pixels)
  const fwhmEffArcsec = diffResult?.psfAssessment?.fwhmArcsec || 9.67;
  // Maximum allowed dipole lobe separation: bounded by 2.5 * FWHM_eff (24.2 arcsec), or 2x catalog prediction
  const catalogExpectedShiftArcsec = options.expectedShiftArcsec || 0;
  const maxDipoleSeparationArcsec = Math.min(2.5 * fwhmEffArcsec, Math.max(15.0, 2.0 * catalogExpectedShiftArcsec));
  const maxDipoleSeparationPx = maxDipoleSeparationArcsec / scaleArcsec;
  const minDipoleSeparationPx = Math.max(0.6, 0.4 * fwhmEffArcsec / scaleArcsec);
  const maxCandidates = options.maxCandidates || 50;

  const gridToWorld = frame1?.reprojected?.gridToWorld || frame2?.reprojected?.gridToWorld;
  const worldToGrid = frame1?.reprojected?.worldToGrid || frame2?.reprojected?.worldToGrid;

  const flags1 = frame1?.reprojected?.flagsPixels || frame1?.rawFlagsPixels;
  const flags2 = frame2?.reprojected?.flagsPixels || frame2?.rawFlagsPixels;

  const rawExtCandidates = [];

  // 1. Locate local peaks (positive excess) and local dips (negative deficit)
  for (let r = 4; r < height - 4; r++) {
    for (let c = 4; c < width - 4; c++) {
      const idx = r * width + c;
      const calSnr = activeSnr[idx];
      const theoSnr = snrPixels[idx];
      const d = diffPixels[idx];
      if (!Number.isFinite(calSnr) || Math.abs(calSnr) < snrThreshold || Math.abs(d) < minFluxThreshold) {
        continue;
      }

      // Check if local extremum in 3x3 neighborhood
      let isExtremum = true;
      const isPositive = calSnr > 0;
      for (let dr = -1; dr <= 1 && isExtremum; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const neighborSnr = activeSnr[(r + dr) * width + (c + dc)];
          if (Number.isFinite(neighborSnr)) {
            if (isPositive && neighborSnr > calSnr) isExtremum = false;
            else if (!isPositive && neighborSnr < calSnr) isExtremum = false;
          }
        }
      }

      if (isExtremum) {
        rawExtCandidates.push({
          col: c,
          row: r,
          d,
          calSnr,
          theoSnr,
          isPositive,
          paired: false,
        });
      }
    }
  }

  // 2. Identify dipole pairs (moving object signature)
  const candidates = [];
  const posPeaks = rawExtCandidates.filter((p) => p.isPositive);
  const negDips = rawExtCandidates.filter((p) => !p.isPositive);

  // Check if primary target has astrometric motion prediction
  let predictedTargetEpoch1 = null;
  let predictedTargetEpoch2 = null;

  if (targetInfo?.astrometry && frame1?.temporal?.mjdAvg && frame2?.temporal?.mjdAvg) {
    predictedTargetEpoch1 = propagateCoordinates(targetInfo.astrometry, frame1.temporal.mjdAvg);
    predictedTargetEpoch2 = propagateCoordinates(targetInfo.astrometry, frame2.temporal.mjdAvg);
  } else if (targetInfo?.ra && targetInfo?.dec) {
    predictedTargetEpoch1 = { ra: targetInfo.ra, dec: targetInfo.dec };
    predictedTargetEpoch2 = { ra: targetInfo.ra, dec: targetInfo.dec };
  }

  // Find dipole pairs: negative dip at epoch 1 position, positive peak at epoch 2 position
  for (const pos of posPeaks) {
    let bestDip = null;
    let minDipDist = Infinity;

    for (const neg of negDips) {
      if (neg.paired) continue;
      const distPx = Math.hypot(pos.col - neg.col, pos.row - neg.row);
      if (distPx >= minDipoleSeparationPx && distPx <= maxDipoleSeparationPx) {
        if (distPx < minDipDist) {
          minDipDist = distPx;
          bestDip = neg;
        }
      }
    }

    if (bestDip) {
      pos.paired = true;
      bestDip.paired = true;
      const wPos = gridToWorld ? gridToWorld(pos.col, pos.row) : { ra: 0, dec: 0 };
      const wNeg = gridToWorld ? gridToWorld(bestDip.col, bestDip.row) : { ra: 0, dec: 0 };

      const dra =
        (wPos.ra - wNeg.ra) * Math.cos(((wPos.dec + wNeg.dec) * 0.5 * Math.PI) / 180) * 3600;
      const ddec = (wPos.dec - wNeg.dec) * 3600;
      const motionArcsec = Math.hypot(dra, ddec);
      const motionAngle = ((Math.atan2(dra, ddec) * 180) / Math.PI + 360) % 360;

      // Check match with target prediction
      let matchesTarget = false;
      let offsetFromTargetArcsec = null;
      if (predictedTargetEpoch2) {
        const toPredDra =
          (wPos.ra - predictedTargetEpoch2.ra) *
          Math.cos((predictedTargetEpoch2.dec * Math.PI) / 180) *
          3600;
        const toPredDdec = (wPos.dec - predictedTargetEpoch2.dec) * 3600;
        offsetFromTargetArcsec = Math.hypot(toPredDra, toPredDdec);
        matchesTarget = offsetFromTargetArcsec <= 10.0; // within ~1.6 SPHEREx detector pixels
      }

      // Check pixel flags
      const idxPos = pos.row * width + pos.col;
      const idxNeg = bestDip.row * width + bestDip.col;
      const f1 = flags1 ? flags1[idxNeg] : 0;
      const f2 = flags2 ? flags2[idxPos] : 0;
      const activeFlags = [
        ...classifyPixelFlags(f1).flags,
        ...classifyPixelFlags(f2).flags,
      ];
      const hasCategoryA = (f1 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0 || (f2 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0;

      const taxonomyType = matchesTarget
        ? 'KNOWN_OBJECT_MATCH'
        : hasCategoryA
          ? 'INSTRUMENTAL_ARTIFACT'
          : 'MOVING_OBJECT_CANDIDATE';

      const dataQuality = hasCategoryA ? 'POOR' : activeFlags.length > 0 ? 'CAUTION' : 'NOMINAL';
      const confidence = matchesTarget
        ? 'KNOWN_OBJECT_MATCH'
        : hasCategoryA
          ? 'ARTIFACT'
          : Math.abs(pos.calSnr) >= 6.0
            ? 'HIGH'
            : 'MEDIUM';

      // Execute Method B: Subpixel Astrometric Centroiding
      const subpixelAstrometry = measureSubpixelAstrometry(frame1, frame2, pos.col, pos.row);

      // Unified physical dipole rule:
      // 1. Statistically significant photocenter motion: SNR_astrom >= 2.5 sigma
      // 2. Spatial coherence: |dipoleSep - measuredShift| <= 1.5 * FWHM_eff (~14.5 arcsec)
      // 3. Negligible proper motion target: if catalog PM < 100 mas/yr, motion cannot produce a multi-arcsec dipole
      const isAstrmStationary = subpixelAstrometry.success && subpixelAstrometry.astrometricSnr < 2.5;
      const isSeparationInconsistent =
        subpixelAstrometry.success &&
        Math.abs(motionArcsec - subpixelAstrometry.measuredShiftArcsec) > (1.5 * fwhmEffArcsec);

      // Check if target is a known variable star with negligible proper motion (< 100 mas/yr)
      const isKnownVariableTarget =
        matchesTarget &&
        targetInfo?.astrometry &&
        Math.hypot(targetInfo.astrometry.pmRa || 0, targetInfo.astrometry.pmDec || 0) < 100.0;

      let resolvedTaxonomy = taxonomyType;
      let resolvedSubType = 'PROPER_MOTION_DIPOLE';
      if (isKnownVariableTarget || isAstrmStationary || isSeparationInconsistent) {
        resolvedTaxonomy = matchesTarget ? 'KNOWN_OBJECT_MATCH' : 'VARIABLE_SOURCE_CANDIDATE';
        resolvedSubType = matchesTarget ? 'KNOWN_VARIABLE_MATCH' : 'VARIABLE_BRIGHTENED';
      }

      candidates.push({
        id: `DIPOLE_${pos.col}_${pos.row}`,
        taxonomyType: resolvedTaxonomy,
        type: resolvedTaxonomy,
        subType: resolvedSubType,
        confidence,
        dataQuality,
        col: pos.col,
        row: pos.row,
        originCol: bestDip.col,
        originRow: bestDip.row,
        ra: Number(wPos.ra.toFixed(6)),
        dec: Number(wPos.dec.toFixed(6)),
        originRa: Number(wNeg.ra.toFixed(6)),
        originDec: Number(wNeg.dec.toFixed(6)),
        snr: Number(pos.calSnr.toFixed(2)),
        snrCalibrated: Number(pos.calSnr.toFixed(2)),
        snrTheoretical: Number(pos.theoSnr.toFixed(2)),
        originSnr: Number(bestDip.calSnr.toFixed(2)),
        netFluxMjySr: Number(pos.d.toFixed(3)),
        motionArcsec: Number(motionArcsec.toFixed(2)),
        motionAngleDeg: Number(motionAngle.toFixed(1)),
        subpixelAstrometry: subpixelAstrometry.success ? subpixelAstrometry : null,
        matchesTarget,
        offsetFromTargetArcsec:
          offsetFromTargetArcsec !== null ? Number(offsetFromTargetArcsec.toFixed(2)) : null,
        flagsActive: [...new Set(activeFlags)],
        date1: frame1?.temporal?.dateAvg || frame1?.dateAvg || 'Época 1',
        date2: frame2?.temporal?.dateAvg || frame2?.dateAvg || 'Época 2',
        mjd1: frame1?.temporal?.mjdAvg || Number(frame1?.dateAvg) || 0,
        mjd2: frame2?.temporal?.mjdAvg || Number(frame2?.dateAvg) || 0,
        detector: frame2?.detector?.label || frame2?.band || 'D?',
        wavelengthUm: frame2?.spectral?.wavelengthUm || null,
        evidence: `Dipolo espacial de ${motionArcsec.toFixed(2)}" hacia PA=${motionAngle.toFixed(1)}° (SNR_cal = ${pos.calSnr.toFixed(1)}σ, SNR_astrom = ${subpixelAstrometry.astrometricSnr || 0}σ)`,
        notesEs: matchesTarget
          ? `Correspondencia con objeto conocido de catálogo: ${targetInfo.name} (desplazamiento medido = ${motionArcsec.toFixed(2)}", residuo = ${offsetFromTargetArcsec.toFixed(2)}").`
          : `Candidato a objeto móvil: firma dipolar de desplazamiento estelar (+${motionArcsec.toFixed(2)}" hacia PA = ${motionAngle.toFixed(1)}°).`,
        notesEn: matchesTarget
          ? `Catalog known object match: ${targetInfo.name} (measured shift = ${motionArcsec.toFixed(2)}", offset = ${offsetFromTargetArcsec.toFixed(2)}").`
          : `Moving object candidate: proper motion dipole signature (+${motionArcsec.toFixed(2)}" towards PA = ${motionAngle.toFixed(1)}°).`,
      });
    }
  }

  // 3. Process unpaired positive peaks (Brightening / Flaring / Transients)
  for (const pos of posPeaks) {
    if (pos.paired) continue;
    const wPos = gridToWorld ? gridToWorld(pos.col, pos.row) : { ra: 0, dec: 0 };
    const idx = pos.row * width + pos.col;
    const f2 = flags2 ? flags2[idx] : 0;
    const classified = classifyPixelFlags(f2);
    const hasCategoryC = (f2 & CATEGORY_C_CANDIDATE_ANOMALY_MASK) !== 0;
    const hasCategoryA = (f2 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0;

    let matchesTarget = false;
    let offsetFromTargetArcsec = null;
    if (predictedTargetEpoch2) {
      const toPredDra =
        (wPos.ra - predictedTargetEpoch2.ra) *
        Math.cos((predictedTargetEpoch2.dec * Math.PI) / 180) *
        3600;
      const toPredDdec = (wPos.dec - predictedTargetEpoch2.dec) * 3600;
      offsetFromTargetArcsec = Math.hypot(toPredDra, toPredDdec);
      matchesTarget = offsetFromTargetArcsec <= 10.0;
    }

    const taxonomyType = matchesTarget
      ? 'KNOWN_OBJECT_MATCH'
      : hasCategoryA
        ? 'INSTRUMENTAL_ARTIFACT'
        : hasCategoryC
          ? 'TRANSIENT_ANOMALY'
          : 'VARIABLE_SOURCE_CANDIDATE';

    const dataQuality = hasCategoryA ? 'POOR' : hasCategoryC ? 'CAUTION' : 'NOMINAL';
    const confidence = matchesTarget
      ? 'KNOWN_OBJECT_MATCH'
      : hasCategoryA
        ? 'ARTIFACT'
        : hasCategoryC
          ? 'SUSPECT_ANOMALY'
          : Math.abs(pos.calSnr) >= 6.0
            ? 'HIGH'
            : 'MEDIUM';

    candidates.push({
      id: `VAR_POS_${pos.col}_${pos.row}`,
      taxonomyType,
      type: taxonomyType,
      subType: 'VARIABLE_BRIGHTENED',
      confidence,
      dataQuality,
      col: pos.col,
      row: pos.row,
      ra: Number(wPos.ra.toFixed(6)),
      dec: Number(wPos.dec.toFixed(6)),
      snr: Number(pos.calSnr.toFixed(2)),
      snrCalibrated: Number(pos.calSnr.toFixed(2)),
      snrTheoretical: Number(pos.theoSnr.toFixed(2)),
      netFluxMjySr: Number(pos.d.toFixed(3)),
      matchesTarget,
      offsetFromTargetArcsec:
        offsetFromTargetArcsec !== null ? Number(offsetFromTargetArcsec.toFixed(2)) : null,
      flagsActive: classified.flags,
      date1: frame1?.temporal?.dateAvg || frame1?.dateAvg || 'Época 1',
      date2: frame2?.temporal?.dateAvg || frame2?.dateAvg || 'Época 2',
      mjd1: frame1?.temporal?.mjdAvg || Number(frame1?.dateAvg) || 0,
      mjd2: frame2?.temporal?.mjdAvg || Number(frame2?.dateAvg) || 0,
      detector: frame2?.detector?.label || frame2?.band || 'D?',
      wavelengthUm: frame2?.spectral?.wavelengthUm || null,
      evidence: `Exceso de flujo neto puntual +${pos.d.toFixed(2)} MJy/sr (SNR_cal = ${pos.calSnr.toFixed(1)}σ, SNR_theo = ${pos.theoSnr.toFixed(1)}σ)`,
      notesEs: matchesTarget
        ? `Correspondencia con objeto conocido de catálogo: ${targetInfo.name} (+${pos.d.toFixed(2)} MJy/sr, SNR_cal = ${pos.calSnr.toFixed(1)}σ).`
        : hasCategoryC
          ? `Anomalía transitoria: exceso con bandera (${classified.flags.join(', ')}). Posible rayo cósmico o evento rápido.`
          : hasCategoryA
            ? `Artefacto instrumental: pixel con bandera de error (${classified.flags.join(', ')}).`
            : `Candidato a fuente variable: aumento significativo de brillo (+${pos.d.toFixed(2)} MJy/sr, SNR_cal = ${pos.calSnr.toFixed(1)}σ).`,
      notesEn: matchesTarget
        ? `Catalog known object match: ${targetInfo.name} (+${pos.d.toFixed(2)} MJy/sr, SNR_cal = ${pos.calSnr.toFixed(1)}σ).`
        : hasCategoryC
          ? `Transient anomaly: excess with flag (${classified.flags.join(', ')}). Possible cosmic ray or transient event.`
          : hasCategoryA
            ? `Instrumental artifact: flagged error pixel (${classified.flags.join(', ')}).`
            : `Variable source candidate: significant brightness increase (+${pos.d.toFixed(2)} MJy/sr, SNR_cal = ${pos.calSnr.toFixed(1)}σ).`,
    });
  }

  // 4. Process unpaired negative dips (Dimming / Eclipsing)
  for (const neg of negDips) {
    if (neg.paired) continue;
    const wNeg = gridToWorld ? gridToWorld(neg.col, neg.row) : { ra: 0, dec: 0 };
    const idx = neg.row * width + neg.col;
    const f1 = flags1 ? flags1[idx] : 0;
    const classified = classifyPixelFlags(f1);
    const hasCategoryA = (f1 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0;

    let matchesTarget = false;
    let offsetFromTargetArcsec = null;
    if (predictedTargetEpoch1) {
      const toPredDra =
        (wNeg.ra - predictedTargetEpoch1.ra) *
        Math.cos((predictedTargetEpoch1.dec * Math.PI) / 180) *
        3600;
      const toPredDdec = (wNeg.dec - predictedTargetEpoch1.dec) * 3600;
      offsetFromTargetArcsec = Math.hypot(toPredDra, toPredDdec);
      matchesTarget = offsetFromTargetArcsec <= 10.0;
    }

    const taxonomyType = matchesTarget
      ? 'KNOWN_OBJECT_MATCH'
      : hasCategoryA
        ? 'INSTRUMENTAL_ARTIFACT'
        : 'VARIABLE_SOURCE_CANDIDATE';

    const dataQuality = hasCategoryA ? 'POOR' : 'NOMINAL';
    const confidence = matchesTarget
      ? 'KNOWN_OBJECT_MATCH'
      : hasCategoryA
        ? 'ARTIFACT'
        : Math.abs(neg.calSnr) >= 6.0
          ? 'HIGH'
          : 'MEDIUM';

    candidates.push({
      id: `VAR_NEG_${neg.col}_${neg.row}`,
      taxonomyType,
      type: taxonomyType,
      subType: 'VARIABLE_DIMMED',
      confidence,
      dataQuality,
      col: neg.col,
      row: neg.row,
      ra: Number(wNeg.ra.toFixed(6)),
      dec: Number(wNeg.dec.toFixed(6)),
      snr: Number(neg.calSnr.toFixed(2)),
      snrCalibrated: Number(neg.calSnr.toFixed(2)),
      snrTheoretical: Number(neg.theoSnr.toFixed(2)),
      netFluxMjySr: Number(neg.d.toFixed(3)),
      matchesTarget,
      offsetFromTargetArcsec:
        offsetFromTargetArcsec !== null ? Number(offsetFromTargetArcsec.toFixed(2)) : null,
      flagsActive: classified.flags,
      date1: frame1?.temporal?.dateAvg || frame1?.dateAvg || 'Época 1',
      date2: frame2?.temporal?.dateAvg || frame2?.dateAvg || 'Época 2',
      mjd1: frame1?.temporal?.mjdAvg || Number(frame1?.dateAvg) || 0,
      mjd2: frame2?.temporal?.mjdAvg || Number(frame2?.dateAvg) || 0,
      detector: frame2?.detector?.label || frame2?.band || 'D?',
      wavelengthUm: frame2?.spectral?.wavelengthUm || null,
      evidence: `Déficit de flujo neto puntual ${neg.d.toFixed(2)} MJy/sr (SNR_cal = ${neg.calSnr.toFixed(1)}σ, SNR_theo = ${neg.theoSnr.toFixed(1)}σ)`,
      notesEs: matchesTarget
        ? `Correspondencia con objeto conocido de catálogo (déficit en pos. época 1): ${targetInfo.name} (${neg.d.toFixed(2)} MJy/sr, SNR_cal = ${neg.calSnr.toFixed(1)}σ).`
        : hasCategoryA
          ? `Artefacto instrumental: pixel con bandera de error (${classified.flags.join(', ')}).`
          : `Candidato a fuente variable: disminución significativa de brillo (${neg.d.toFixed(2)} MJy/sr, SNR_cal = ${neg.calSnr.toFixed(1)}σ).`,
      notesEn: matchesTarget
        ? `Catalog known object match (deficit at epoch 1 pos): ${targetInfo.name} (${neg.d.toFixed(2)} MJy/sr, SNR_cal = ${neg.calSnr.toFixed(1)}σ).`
        : hasCategoryA
          ? `Instrumental artifact: flagged error pixel (${classified.flags.join(', ')}).`
          : `Variable source candidate: significant brightness decrease (${neg.d.toFixed(2)} MJy/sr, SNR_cal = ${neg.calSnr.toFixed(1)}σ).`,
    });
  }

  // 5. Target subpixel astrometric verification (Method B + C integration)
  // If the target has astrometric proper motion and was not already matched by a dipole:
  const hasMatchedTarget = candidates.some((c) => c.matchesTarget);
  if (!hasMatchedTarget && predictedTargetEpoch2 && worldToGrid) {
    const gPred = worldToGrid(predictedTargetEpoch2.ra, predictedTargetEpoch2.dec);
    if (gPred.col >= 10 && gPred.col < width - 10 && gPred.row >= 10 && gPred.row < height - 10) {
      const subpixel = measureSubpixelAstrometry(frame1, frame2, gPred.col, gPred.row);
      if (subpixel.success && subpixel.astrometricSnr >= 2.5) {
        // Evaluate concordance with expected motion vector
        let isConcordant = true;
        let expectedMotionArcsec = 0;
        let expectedPaDeg = 0;
        if (predictedTargetEpoch1) {
          const draExp = (predictedTargetEpoch2.ra - predictedTargetEpoch1.ra) * Math.cos((predictedTargetEpoch1.dec * Math.PI) / 180) * 3600;
          const ddecExp = (predictedTargetEpoch2.dec - predictedTargetEpoch1.dec) * 3600;
          expectedMotionArcsec = Math.hypot(draExp, ddecExp);
          expectedPaDeg = ((Math.atan2(draExp, ddecExp) * 180) / Math.PI + 360) % 360;

          const paDiff = Math.abs(subpixel.measuredPaDeg - expectedPaDeg);
          const paDist = Math.min(paDiff, 360 - paDiff);
          isConcordant = paDist <= 30.0;
        }

        const isKnownVariable = targetInfo?.astrometry &&
          Math.hypot(targetInfo.astrometry.pmRa || 0, targetInfo.astrometry.pmDec || 0) < 100.0;

        const idx = Math.round(gPred.row) * width + Math.round(gPred.col);
        const f1 = flags1 ? flags1[idx] : 0;
        const f2 = flags2 ? flags2[idx] : 0;
        const activeFlags = [
          ...classifyPixelFlags(f1).flags,
          ...classifyPixelFlags(f2).flags,
        ];
        const hasCategoryA = (f1 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0 || (f2 & CATEGORY_A_INSTRUMENTAL_MASK) !== 0;

        candidates.push({
          id: `TARGET_SUBPIXEL_${Math.round(gPred.col)}_${Math.round(gPred.row)}`,
          taxonomyType: 'KNOWN_OBJECT_MATCH',
          type: 'KNOWN_OBJECT_MATCH',
          subType: isKnownVariable ? 'KNOWN_VARIABLE_MATCH' : 'SUBPIXEL_PROPER_MOTION',
          confidence: 'KNOWN_OBJECT_MATCH',
          dataQuality: hasCategoryA ? 'CAUTION' : activeFlags.length > 0 ? 'CAUTION' : 'NOMINAL',
          col: Math.round(gPred.col),
          row: Math.round(gPred.row),
          ra: Number(predictedTargetEpoch2.ra.toFixed(6)),
          dec: Number(predictedTargetEpoch2.dec.toFixed(6)),
          snr: Number(subpixel.astrometricSnr.toFixed(2)),
          snrCalibrated: Number(subpixel.astrometricSnr.toFixed(2)),
          snrTheoretical: Number(subpixel.astrometricSnr.toFixed(2)),
          netFluxMjySr: Number(diffPixels[idx]?.toFixed(3) || 0),
          motionArcsec: Number(subpixel.measuredShiftArcsec.toFixed(2)),
          motionAngleDeg: Number(subpixel.measuredPaDeg.toFixed(1)),
          subpixelAstrometry: subpixel,
          matchesTarget: true,
          offsetFromTargetArcsec: 0.0,
          flagsActive: [...new Set(activeFlags)],
          date1: frame1?.temporal?.dateAvg || frame1?.dateAvg || 'Época 1',
          date2: frame2?.temporal?.dateAvg || frame2?.dateAvg || 'Época 2',
          mjd1: frame1?.temporal?.mjdAvg || Number(frame1?.dateAvg) || 0,
          mjd2: frame2?.temporal?.mjdAvg || Number(frame2?.dateAvg) || 0,
          detector: frame2?.detector?.label || frame2?.band || 'D?',
          wavelengthUm: frame2?.spectral?.wavelengthUm || null,
          evidence: `Detección astrométrica subpíxel de ${subpixel.measuredShiftArcsec.toFixed(2)}" hacia PA=${subpixel.measuredPaDeg.toFixed(1)}° (SNR_astrom = ${subpixel.astrometricSnr.toFixed(1)}σ, concordancia = ${isConcordant ? 'COMPLETA' : 'DISCREPANTE'})`,
          notesEs: `Correspondencia confirmada con objeto de catálogo mediante astrometría subpíxel: ${targetInfo?.name || 'Objeto'} (movimiento medido = ${subpixel.measuredShiftArcsec.toFixed(2)}" hacia PA=${subpixel.measuredPaDeg.toFixed(1)}°, esperado = ${expectedMotionArcsec.toFixed(2)}").`,
          notesEn: `Catalog known object confirmed via subpixel centroid astrometry: ${targetInfo?.name || 'Target'} (measured shift = ${subpixel.measuredShiftArcsec.toFixed(2)}" towards PA=${subpixel.measuredPaDeg.toFixed(1)}°, expected = ${expectedMotionArcsec.toFixed(2)}").`,
        });
      }
    }
  }

  // Sort by target match first, then by absolute calibrated significance |SNR_cal| descending
  candidates.sort((a, b) => {
    if (a.matchesTarget !== b.matchesTarget) return a.matchesTarget ? -1 : 1;
    return Math.abs(b.snrCalibrated) - Math.abs(a.snrCalibrated);
  });

  return candidates.slice(0, maxCandidates);
}
