const IRSA_SIA = 'https://irsa.ipac.caltech.edu/SIA';
const MAX_SEARCH_RESULTS = 250;

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

async function fetchWithRetry(url, options, attempts = 3) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt++) {
    result = await fetch(url, options);
    if (result.status !== 429 && result.status < 500) return result;
    if (attempt + 1 < attempts)
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  return result;
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

function imageOnlyFits(buffer) {
  let offset = 0;
  while (offset + 2880 <= buffer.length) {
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
    const pixelCount = dimensions.reduce((total, size) => total * size, axes ? 1 : 0);
    const bitpix = Number(values.BITPIX || 8);
    const dataLength =
      Math.ceil(((pixelCount * Math.abs(bitpix)) / 8 + Number(values.PCOUNT || 0)) / 2880) * 2880;
    if (values.EXTNAME === 'IMAGE' && pixelCount && dimensions.length >= 2) {
      const primaryCards = [
        'SIMPLE  =                    T'.padEnd(80),
        ...cards.filter((card) => {
          const key = card.slice(0, 8).trim();
          return !['XTENSION', 'PCOUNT', 'GCOUNT', 'EXTNAME', 'EXTVER', 'SIMPLE', 'END'].includes(
            key,
          );
        }),
        'END'.padEnd(80),
      ];
      const primaryHeaderCards = primaryCards.join('');
      const primaryHeader =
        primaryHeaderCards +
        ' '.repeat(
          Math.ceil(primaryHeaderCards.length / 2880) * 2880 - primaryHeaderCards.length,
        );
      return Buffer.concat([
        Buffer.from(primaryHeader, 'ascii'),
        buffer.subarray(offset, offset + dataLength),
      ]);
    }
    offset += dataLength;
  }
  throw new Error('IRSA FITS product does not include an IMAGE extension.');
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
    const collection = request.query.release === 'qr2' ? 'spherex_qr2' : 'spherex_qr3';
    if (
      !Number.isFinite(ra) ||
      ra < 0 ||
      ra >= 360 ||
      !Number.isFinite(dec) ||
      dec < -90 ||
      dec > 90
    )
      return sendError(response, 400, 'Coordenadas fuera de rango. RA: 0–360°, Dec: −90–90°.');

    const url = new URL(IRSA_SIA);
    url.searchParams.set('COLLECTION', collection);
    url.searchParams.set('POS', `circle ${ra} ${dec} ${radius}`);
    url.searchParams.set('RESPONSEFORMAT', 'CSV');
    url.searchParams.set('MAXREC', String(MAX_SEARCH_RESULTS));
    try {
      const archiveResponse = await fetchWithRetry(url, { signal: AbortSignal.timeout(25000) });
      if (!archiveResponse.ok)
        return sendError(response, 502, 'El archivo IRSA no respondió a la búsqueda.');
      const records = parseCsv(await archiveResponse.text())
        .filter((row) => row.access_url && row.t_min)
        .map((row) => ({
          id: row.obs_id,
          date: row.t_min,
          band: row.energy_bandpassname || 'Banda infrarroja',
          wavelengthMin: row.em_min,
          wavelengthMax: row.em_max,
          url: row.access_url,
          release: collection,
        }));
      return response
        .status(200)
        .json({ records, collection, truncated: records.length >= MAX_SEARCH_RESULTS });
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
      const product = Buffer.from(await imageResponse.arrayBuffer());
      return response.status(200).send(imageOnlyFits(product));
    } catch (error) {
      console.error('SPHEREx FITS cutout failed:', error);
      return sendError(response, 502, 'No se pudo cargar la imagen de SPHEREx.');
    }
  }

  return sendError(response, 400, 'Acción no válida.');
}
