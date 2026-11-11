import { propagateCoordinates } from '../data/spherexTargets.js';
const INFO_BITS = ((2 ** 21) | (2 ** 12)) >>> 0;
export function sampleAperture(frame, target, { radiusArcsec = 12.3, selection = null } = {}) {
  const record = frame?.record || {};
  const blank = {
    productId: record.productId || record.id,
    url: record.url,
    localSha256: record.localSha256,
    band: record.band,
    date: record.dateAvg || record.date,
    unit: frame?.extensions?.imageUnit || null,
    flux: null,
    sigma: null,
    wave: null,
    bandwidth: null,
    valid: 0,
    total: 0,
    flags: 0,
    reason: null,
  };
  if (!frame?.wcs || !frame.wcsWave || !frame.rawVariancePixels || !frame.rawFlagsPixels)
    return { ...blank, reason: 'Faltan WCS, λ, varianza o máscara; no se inventa una medición.' };
  const unit = frame.extensions.imageUnit?.replace(/\s/g, '');
  if (unit !== 'MJy/sr') return { ...blank, reason: 'Unidades incompatibles: ' + unit };
  const epoch = Number.parseFloat(record.dateAvg || record.date || frame.temporal?.mjdAvg);
  if (!selection && target.astrometry && !Number.isFinite(epoch))
    return {
      ...blank,
      reason: 'Falta la época de observación para propagar el movimiento propio del objetivo.',
    };
  const propagated =
    !selection && target.astrometry ? propagateCoordinates(target.astrometry, epoch) : null;
  const sky = selection || propagated || target,
    p = frame.wcs.worldToPixel(sky.ra, sky.dec);
  if (!p) return { ...blank, reason: 'Sin cobertura espacial' };
  const cx = p.xFits - 1,
    cy = p.yFits - 1,
    radiusPx = radiusArcsec / frame.wcs.pixelScaleArcsec;
  const values = [];
  let total = 0,
    flags = 0;
  const pixels = frame.extensions.zodiSubtracted
    ? frame.zodiSubtractedPixels
    : frame.rawImagePixels;
  for (let y = Math.ceil(cy - radiusPx); y <= Math.floor(cy + radiusPx); y++)
    for (let x = Math.ceil(cx - radiusPx); x <= Math.floor(cx + radiusPx); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radiusPx ** 2) continue;
      total++;
      if (x < 0 || y < 0 || x >= frame.rawWidth || y >= frame.rawHeight) continue;
      const i = y * frame.rawWidth + x,
        f = frame.rawFlagsPixels[i] >>> 0;
      flags |= f;
      const v = frame.rawVariancePixels[i],
        flux = pixels[i],
        wave = frame.wcsWave.evaluateAtCutoutPixel(x + 1, y + 1);
      if (
        (f & ~INFO_BITS) !== 0 ||
        !Number.isFinite(v) ||
        v <= 0 ||
        !Number.isFinite(flux) ||
        !wave
      )
        continue;
      values.push({ flux, sigma: Math.sqrt(v), wave: wave.wavelengthUm, width: wave.bandwidthUm });
    }
  const n = values.length,
    mean = (key) => values.reduce((s, v) => s + v[key], 0) / n;
  return {
    ...blank,
    flux: n ? mean('flux') : null,
    sigma: n ? mean('sigma') : null,
    wave: n ? mean('wave') : null,
    bandwidth: n ? mean('width') : null,
    waveMin: n ? Math.min(...values.map((v) => v.wave)) : null,
    waveMax: n ? Math.max(...values.map((v) => v.wave)) : null,
    valid: n,
    total,
    flags: flags >>> 0,
    radiusArcsec,
    selection: { ra: sky.ra, dec: sky.dec },
    zodiSubtracted: !!frame.extensions.zodiSubtracted,
    reason: n ? null : 'Sin píxeles válidos en la apertura; evidencia insuficiente',
    method:
      'Media de brillo superficial sobre píxeles nativos; sigma conservadora = media de sigma. Sin corrección PSF ni fondo local. FLAGS salvo SOURCE/FULLSAMPLE excluidos.',
  };
}
export function qualifiesAsResearch(finding) {
  return !!(
    finding?.conclusion &&
    finding?.description?.trim().length >= 30 &&
    finding?.evidence?.inspected &&
    finding?.evidence?.measurements?.length &&
    finding?.evidence?.products?.some((p) => p.url?.startsWith('https://irsa.ipac.caltech.edu/'))
  );
}
export function researchState(findings, targetKey) {
  return findings.some((f) => f.targetKey === targetKey && qualifiesAsResearch(f))
    ? 'investigation-completed'
    : 'free-exploration';
}
export function hasTemporalCoverage(m) {
  return m?.valid >= 6 && m.total > 0 && m.valid / m.total >= 0.5;
}
export function compareEpochs(a, b) {
  if (!a || !b) return { ok: false, reason: 'Faltan dos observaciones.' };
  if (!a.unit || !b.unit || a.unit.replace(/\s/g, '') !== b.unit.replace(/\s/g, ''))
    return { ok: false, reason: 'Unidades diferentes o desconocidas.' };
  if (a.band !== b.band)
    return {
      ok: false,
      reason: 'Cambio de detector/longitud de onda: no es una comparación temporal.',
    };
  if (!Number.isFinite(a.wave) || !Number.isFinite(b.wave) || !a.bandwidth || !b.bandwidth)
    return { ok: false, reason: 'Falta calibración de longitud de onda.' };
  if (Math.abs(a.wave - b.wave) > 0.25 * Math.min(a.bandwidth, b.bandwidth))
    return {
      ok: false,
      reason: 'Mismo detector, distinta λ LVF: falta un par con respuesta espectral compatible.',
    };
  if (!Number.isFinite(Number.parseFloat(a.date)) || !Number.isFinite(Number.parseFloat(b.date)))
    return { ok: false, reason: 'Falta una fecha de observación válida.' };
  if (a.radiusArcsec && b.radiusArcsec && a.radiusArcsec !== b.radiusArcsec)
    return { ok: false, reason: 'Aperturas diferentes; vuelve a extraer con el mismo radio.' };
  if (Math.abs(Number.parseFloat(a.date) - Number.parseFloat(b.date)) < 1e-7)
    return { ok: false, reason: 'Es la misma fecha; no son dos épocas.' };
  if ([a, b].some((m) => Number.isFinite(m.valid) && !hasTemporalCoverage(m)))
    return {
      ok: false,
      reason:
        'Cobertura insuficiente para el par temporal: se requieren al menos 6 píxeles y el 50% de la apertura sin banderas en cada imagen (filtro exploratorio).',
    };
  return {
    ok: true,
    reason:
      'Misma apertura y banda con centros λ próximos. PSF/sistemáticos aún deben comprobarse; no demuestra variación.',
  };
}
export function continuumExercise(depth = 0.25) {
  const rows = Array.from({ length: 41 }, (_, i) => {
    const wave = 2.5 + i * 0.025,
      continuum = 1 + 0.12 * (wave - 3),
      absorption = depth * Math.exp(-0.5 * ((wave - 3.05) / 0.09) ** 2);
    return { wave, continuum, flux: continuum * Math.exp(-absorption) };
  });
  return {
    kind: 'synthetic',
    label: 'SIMULACIÓN EDUCATIVA · NO es detección SPHEREx',
    rows,
    reference:
      'https://science.nasa.gov/missions/webb/webb-unveils-dark-side-of-pre-stellar-ice-chemistry/',
  };
}
