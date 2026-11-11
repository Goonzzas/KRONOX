import {parseCsvTable,buildSearchPlan} from './_lib/archivePlan.js';
import {cachedIrsaBytes} from './_lib/irsaCache.js';
export {parseCsv,buildSearchPlan} from './_lib/archivePlan.js';
import {parseFitsCardValue} from '../src/utils/fitsCard.js';
const IRSA_SIA = 'https://irsa.ipac.caltech.edu/SIA';


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

export async function fetchWithRetry(url, options = {}, attempts = 4) {
  const { timeoutMs = 0, ...fetchOptions } = options;
  let lastResponse;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // Create a fresh timeout signal for every attempt. A timed-out signal stays
      // aborted forever and must not be reused for retries.
      const attemptOptions = timeoutMs
        ? { ...fetchOptions, signal: AbortSignal.timeout(timeoutMs) }
        : fetchOptions;
      const response = await fetch(url, attemptOptions);
      lastResponse = response;
      if (response.status !== 429 && response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts)
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error('Network request failed');
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
  const releaseRank = collection.startsWith('spherex_qr3') ? 3 : 2;
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
        values[key] = parseFitsCardValue(card);
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

export async function querySiaCollection(collection, ra, dec, radius, options = {}) {
  const url = new URL(IRSA_SIA);
  url.searchParams.set('COLLECTION', collection);
  url.searchParams.set('POS', `circle ${ra} ${dec} ${radius}`);
  url.searchParams.set('RESPONSEFORMAT', 'CSV');
  // IRSA documents an unlimited default. Do not invent OFFSET/paging or silently cap the archive.
  if(options.time)url.searchParams.set('TIME',options.time);
  const result=await cachedIrsaBytes(url,{force:options.force,timeoutMs:18000,maxBytes:12*1024*1024,attempts:2});
  const table=parseCsvTable(result.bytes.toString('utf8'));
  if(!table.headers.includes('access_url'))throw Error('Respuesta IRSA inválida o incompleta; intenta la consulta segmentada.');
  const rows=table.rows;
  const mapped = rows
    .filter((row) => row.access_url?.startsWith('https://irsa.ipac.caltech.edu/ibe/data/spherex/'))
    .map((row) => {
      const tMin = Number.parseFloat(row.t_min);
      const tMax = Number.parseFloat(row.t_max || row.t_min);
      const tAvg = Number.isFinite(tMin) && Number.isFinite(tMax) ? (tMin + tMax) * 0.5 : tMin;
      const band = row.energy_bandpassname || 'Banda infrarroja';
      const bandMeta = SPHEREX_DETECTOR_BANDS[band] || null;
      const pipe = parsePipelineMetadata(row.access_url, collection);
      return {
        id: row.obs_id || row.obs_publisher_did || row.access_url,
        productId:row.obs_publisher_did||row.access_url,facility:row.facility_name||'SPHEREx',instrument:row.instrument_name||'SPHEREx',
        queryCenter:{ra,dec},footprint:row.s_region||null,
        accessFormat:row.access_format,estimatedSizeKb:Number(row.access_estsize)||null,
        date: row.t_min || null,
        dateEnd: row.t_max || row.t_min,
        dateAvg: Number.isFinite(tAvg) ? tAvg.toFixed(9) : null,
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
    truncated: false, queryUrl:url.href, cached:result.cached, rawCount:rows.length, droppedRows:rows.length-mapped.length,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendError(response, 405, 'Method not allowed');
  }

  const query = new URL(request.url, 'http://localhost').searchParams;
  const action = query.get('action');
  if (action === 'search') {
    const ra = Number(query.get('ra')),
      dec = Number(query.get('dec'));
    const radius = Math.min(0.1, Math.max(0.005, Number(query.get('radius')) || 0.03));
    const releaseParam = String(query.get('release') || 'all').toLowerCase();
    if (
      !query.has('ra') || !query.has('dec') || !Number.isFinite(ra) ||
      ra < 0 ||
      ra >= 360 ||
      !Number.isFinite(dec) ||
      dec < -90 ||
      dec > 90
    )
      return sendError(response, 400, 'Coordenadas fuera de rango. RA: 0–360°, Dec: −90–90°.');

    if(query.get('progressive')==='1'){
      const plan=buildSearchPlan({release:releaseParam,deep:query.get('deep')==='1',segmented:query.get('segmented')==='1'}),cursor=Number(query.get('cursor')||0);
      if(!Number.isInteger(cursor)||cursor<0||cursor>=plan.length)return sendError(response,400,'Cursor de consulta inválido.');
      const task=plan[cursor];try{const result=await querySiaCollection(task.collection,ra,dec,radius,{time:task.time,force:query.get('refresh')==='1'});return response.status(200).json({...result,collection:task.collection,page:cursor+1,pageCount:plan.length,nextCursor:cursor+1<plan.length?cursor+1:null,partial:false,failedCollections:[],queriedAt:new Date().toISOString()});}
      catch(error){return response.status(200).json({records:[],collection:task.collection,page:cursor+1,pageCount:plan.length,nextCursor:cursor+1<plan.length?cursor+1:null,partial:true,failedCollections:[task.collection],error:error.message,queriedAt:new Date().toISOString()});}
    }
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
            return { records: [], truncated: false, error: err.message };
          }),
        ),
      );
      const rawRecords = results.flatMap((r) => r.records);
      const deduplicated = deduplicateSiaRecords(rawRecords);
      const truncated = results.some((r) => r.truncated);
      const failedCollections = results
        .map((result, index) => result.error ? collectionsToQuery[index] : null)
        .filter(Boolean);
      if (failedCollections.length === collectionsToQuery.length) {
        throw new Error(`IRSA no respondió para: ${failedCollections.join(', ')}`);
      }
      return response.status(200).json({
        records: [...new Map(rawRecords.map(r=>[r.url,r])).values()],
        preferredRecords:deduplicated,observationCount:new Set(rawRecords.map(r=>r.id)).size,
        collection: collectionsToQuery.join('+'),
        rawCount: rawRecords.length,
        deduplicatedCount: deduplicated.length,
        truncated,
        partial: failedCollections.length > 0,
        failedCollections,
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
    const imageUrl = query.get('url') || '';
    const center = (query.get('center') || '').split(',').map(Number);
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
      const size=Math.max(0.01,Math.min(0.5,Number(query.get('size'))||0.12));
      cutoutUrl.searchParams.set('size',String(size));
      const imageResponse = await cachedIrsaBytes(cutoutUrl,{timeoutMs:22000,ttlMs:7*86400000,force:query.get('refresh')==='1'});
      response.setHeader('Content-Type', 'application/fits');
      response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      const includePsf = query.get('psf') === '1' || query.get('psf') === 'true';
      const product = imageResponse.bytes;
      return response.status(200).send(extractScientificFits(product, includePsf));
    } catch (error) {
      console.error('SPHEREx FITS cutout failed:', error);
      return sendError(response, 502, 'No se pudo cargar la imagen de SPHEREx.');
    }
  }

  return sendError(response, 400, 'Acción no válida.');
}
