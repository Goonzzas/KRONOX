const IRSA_SIA = 'https://irsa.ipac.caltech.edu/SIA';
const MAX_SEARCH_RESULTS = 250;

/**
 * Official NASA SPHEREx detector bandpass definitions (in microns).
 * D1-D3: Short-Wavelength Infrared (SWIR); D4-D6: Mid-Wavelength Infrared (MWIR).
 */
export const SPHEREX_DETECTOR_BANDS = {
  'SPHEREx-D1': { detector: 1, label: 'D1', minUm: 0.75, maxUm: 1.09, regime: 'SWIR' },
  'SPHEREx-D2': { detector: 2, label: 'D2', minUm: 1.1, maxUm: 1.62, regime: 'SWIR' },
  'SPHEREx-D3': { detector: 3, label: 'D3', minUm: 1.63, maxUm: 2.41, regime: 'SWIR' },
  'SPHEREx-D4': { detector: 4, label: 'D4', minUm: 2.42, maxUm: 3.82, regime: 'MWIR' },
  'SPHEREx-D5': { detector: 5, label: 'D5', minUm: 3.83, maxUm: 4.41, regime: 'MWIR' },
  'SPHEREx-D6': { detector: 6, label: 'D6', minUm: 4.42, maxUm: 5.0, regime: 'MWIR' },
};

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

async function fetchWithRetry(url, options, attempts = 4) {
  let result;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      result = await fetch(url, options);
      if (result.status !== 429 && result.status < 500) return result;
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts)
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  if (result) return result;
  throw lastError || new Error('Network request failed');
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const cells = (line) => {
    const out = [];
    let value = '',
      quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) {
        value += '"';
        i++;
      } else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        out.push(value);
        value = '';
      } else value += char;
    }
    out.push(value);
    return out;
  };
  const keys = cells(lines[0]);
  return lines.slice(1).map((line) => {
    const values = cells(line);
    return Object.fromEntries(keys.map((key, index) => [key, values[index] || '']));
  });
}

/**
 * Extracts the L2B pipeline version and retry flag from an IRSA SPHEREx access_url.
 * Example: ".../l2b-v27-2026-268/3/level2_2026W39_1A_0276_2D3_spx_l2b_retry-v27-2026-269.fits"
 */
export function parsePipelineMetadata(accessUrl = '', collection = 'spherex_qr2') {
  const match = String(accessUrl).match(/l2b(_retry)?-v(\d+)-(\d{4})-(\d+)/i);
  const isRetry = Boolean(match?.[1]);
  const versionMajor = match ? Number(match[2]) : 0;
  const versionYear = match ? Number(match[3]) : 0;
  const versionDoy = match ? Number(match[4]) : 0;
  const pipelineVersion = match
    ? `v${versionMajor}-${versionYear}-${String(versionDoy).padStart(3, '0')}${isRetry ? '-retry' : ''}`
    : 'unknown';
  const releaseRank = collection === 'spherex_qr3' ? 3 : 2;
  // Rank higher pipeline versions, retry re-reductions, and newer releases first
  const priorityScore =
    releaseRank * 1e9 +
    versionMajor * 1e6 +
    versionYear * 1e3 +
    versionDoy +
    (isRetry ? 500 : 0);
  return {
    pipelineVersion,
    versionMajor,
    isRetry,
    priorityScore,
  };
}

/**
 * Deduplicates SIA records across QR2 and QR3 by observational key (obs_id + detector band).
 * When the same exposure exists in both collections or has a `_retry` re-reduction, keeps
 * only the highest-priority pipeline product while recording the superseded version.
 */
export function deduplicateSiaRecords(rawRecords) {
  const byExposure = new Map();
  for (const record of rawRecords) {
    const key = `${record.id}|${record.band}`;
    const existing = byExposure.get(key);
    if (!existing || record.priorityScore >= existing.priorityScore) {
      byExposure.set(key, record);
    }
  }
  return [...byExposure.values()].sort((a, b) => Number(a.dateAvg || a.date) - Number(b.dateAvg || b.date));
}

export function extractScientificFits(buffer, includePsf = false) {
  let offset = 0;
  let hasImage = false;
  const keptSlices = [];

  while (offset + 2880 <= buffer.length) {
    const hduStart = offset;
    let header = '';
    let end = false;
    while (offset + 2880 <= buffer.length && !end) {
      const block = buffer.toString('ascii', offset, offset + 2880);
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

    const axes = Number(values.NAXIS || 0);
    const dimensions = Array.from({ length: axes }, (_, index) =>
      Number(values[`NAXIS${index + 1}`] || 0),
    );
    const elementCount = dimensions.reduce((total, size) => total * size, axes ? 1 : 0);
    const bitpix = Number(values.BITPIX || 8);
    const pcount = Number(values.PCOUNT || 0);
    const gcount = Math.max(1, Number(values.GCOUNT || 1));
    const dataLength =
      Math.ceil((((elementCount * Math.abs(bitpix)) / 8 + pcount) * gcount) / 2880) * 2880;
    const hduEnd = Math.min(buffer.length, offset + dataLength);
    const extName = (values.EXTNAME || '').toUpperCase();

    if (extName === 'IMAGE' || (hduStart === 0 && values.SIMPLE === 'T' && elementCount > 0)) {
      hasImage = true;
    }

    // Preserve PRIMARY (HDU 0) and all scientific extensions (IMAGE, FLAGS, VARIANCE, ZODI, WCS-WAVE).
    // Omit the heavy 3D PSF cube (~4.94 MB in QR2) or EPSF binary table (~3.95 MB in QR3) by default
    // unless explicitly requested via ?psf=1.
    const isPsfExtension = extName === 'PSF' || extName === 'EPSF';
    const shouldKeep = hduStart === 0 || includePsf || !isPsfExtension;
    if (shouldKeep) {
      keptSlices.push(buffer.subarray(hduStart, hduEnd));
    }

    offset = hduEnd;
  }

  if (!hasImage) {
    throw new Error('IRSA FITS product does not include an IMAGE extension.');
  }
  return keptSlices.length === 1 ? keptSlices[0] : Buffer.concat(keptSlices);
}

async function querySiaCollection(collection, ra, dec, radius) {
  const url = new URL(IRSA_SIA);
  url.searchParams.set('COLLECTION', collection);
  url.searchParams.set('POS', `circle ${ra} ${dec} ${radius}`);
  url.searchParams.set('RESPONSEFORMAT', 'CSV');
  url.searchParams.set('MAXREC', String(MAX_SEARCH_RESULTS));
  const archiveResponse = await fetchWithRetry(url, { signal: AbortSignal.timeout(25000) });
  if (!archiveResponse.ok) {
    throw new Error(`El archivo IRSA (${collection}) no respondió a la búsqueda.`);
  }
  const rows = parseCsv(await archiveResponse.text());
  const mapped = rows
    .filter((row) => row.access_url && row.t_min)
    .map((row) => {
      const tMin = Number(row.t_min);
      const tMax = Number(row.t_max || row.t_min);
      const tAvg = Number.isFinite(tMin) && Number.isFinite(tMax) ? (tMin + tMax) * 0.5 : tMin;
      const band = row.energy_bandpassname || 'Banda infrarroja';
      const bandMeta = SPHEREX_DETECTOR_BANDS[band] || null;
      const pipe = parsePipelineMetadata(row.access_url, collection);
      return {
        id: row.obs_id,
        date: row.t_min,
        dateEnd: row.t_max || row.t_min,
        dateAvg: Number.isFinite(tAvg) ? tAvg.toFixed(9) : row.t_min,
        band,
        detector: bandMeta?.detector || null,
        detectorRangeUm: bandMeta ? `${bandMeta.minUm.toFixed(2)}–${bandMeta.maxUm.toFixed(2)}` : null,
        wavelengthMin: row.em_min,
        wavelengthMax: row.em_max,
        url: row.access_url,
        release: collection,
        pipelineVersion: pipe.pipelineVersion,
        isRetry: pipe.isRetry,
        priorityScore: pipe.priorityScore,
      };
    });
  return {
    records: mapped,
    truncated: mapped.length >= MAX_SEARCH_RESULTS,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendError(response, 405, 'Method not allowed');
  }

  const { action } = request.query;
  if (action === 'search') {
    const ra = Number(request.query.ra),
      dec = Number(request.query.dec);
    const radius = Math.min(0.1, Math.max(0.005, Number(request.query.radius) || 0.03));
    const releaseParam = String(request.query.release || 'all').toLowerCase();
    if (
      !Number.isFinite(ra) ||
      ra < 0 ||
      ra >= 360 ||
      !Number.isFinite(dec) ||
      dec < -90 ||
      dec > 90
    )
      return sendError(response, 400, 'Coordenadas fuera de rango. RA: 0–360°, Dec: −90–90°.');

    const collectionsToQuery =
      releaseParam === 'qr2'
        ? ['spherex_qr2']
        : releaseParam === 'qr3'
          ? ['spherex_qr3']
          : ['spherex_qr2', 'spherex_qr3'];

    try {
      const results = await Promise.all(
        collectionsToQuery.map((col) =>
          querySiaCollection(col, ra, dec, radius).catch((err) => {
            if (collectionsToQuery.length === 1) throw err;
            return { records: [], truncated: false, error: err.message };
          }),
        ),
      );
      const rawRecords = results.flatMap((r) => r.records);
      const deduplicated = deduplicateSiaRecords(rawRecords);
      const truncated = results.some((r) => r.truncated);
      return response.status(200).json({
        records: deduplicated,
        collection: collectionsToQuery.join('+'),
        rawCount: rawRecords.length,
        deduplicatedCount: deduplicated.length,
        truncated,
      });
    } catch (error) {
      console.error('SPHEREx SIA search failed:', error);
      return sendError(
        response,
        502,
        'No se pudo conectar con el archivo público de SPHEREx. Inténtalo de nuevo.',
      );
    }
  }

  if (action === 'frame') {
    const imageUrl = typeof request.query.url === 'string' ? request.query.url : '';
    const center =
      typeof request.query.center === 'string' ? request.query.center.split(',').map(Number) : [];
    const ra = center[0],
      dec = center[1];
    if (!imageUrl.startsWith('https://irsa.ipac.caltech.edu/ibe/data/spherex/qr'))
      return sendError(response, 400, 'URL de imagen SPHEREx no válida.');
    if (
      !Number.isFinite(ra) ||
      ra < 0 ||
      ra >= 360 ||
      !Number.isFinite(dec) ||
      dec < -90 ||
      dec > 90
    )
      return sendError(response, 400, 'Centro del recorte no válido.');
    try {
      const cutoutUrl = new URL(imageUrl);
      cutoutUrl.searchParams.set('center', `${ra},${dec}`);
      // A half-degree field gives the viewer enough detector pixels and
      // surrounding reference stars to compare observations over time.
      cutoutUrl.searchParams.set('size', '0.5');
      const imageResponse = await fetchWithRetry(cutoutUrl, {
        signal: AbortSignal.timeout(30000),
      });
      if (!imageResponse.ok)
        return sendError(response, 502, 'IRSA no pudo generar el recorte de esta observación.');
      response.setHeader('Content-Type', 'application/fits');
      response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      const includePsf = request.query.psf === '1' || request.query.psf === 'true';
      const product = Buffer.from(await imageResponse.arrayBuffer());
      return response.status(200).send(extractScientificFits(product, includePsf));
    } catch (error) {
      console.error('SPHEREx FITS cutout failed:', error);
      return sendError(response, 502, 'No se pudo cargar la imagen de SPHEREx.');
    }
  }

  return sendError(response, 400, 'Acción no válida.');
}
