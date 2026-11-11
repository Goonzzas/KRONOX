/** Bounded browser requests cover headers AND body, distinguish invalid responses. */
export async function fetchResource(
  url,
  { kind = 'json', timeoutMs = 45000, signal, ...options } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Se agotó el tiempo. Reintenta.', 'TimeoutError')),
    timeoutMs,
  );
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw Error(body.error || `Error de red HTTP ${r.status}. Puedes reintentar.`);
    }
    if (kind === 'buffer') {
      const bytes = await r.arrayBuffer();
      const signature = new TextDecoder('ascii').decode(bytes.slice(0, 80));
      if (!signature.startsWith('SIMPLE'))
        throw Error('Archivo inválido: la respuesta no es un FITS.');
      return bytes;
    }
    const result = await r.json();
    if (!result || typeof result !== 'object') throw Error('Respuesta de archivo inválida');
    return result;
  } catch (e) {
    if (controller.signal.aborted)
      throw Error(
        signal?.aborted
          ? 'Consulta cancelada.'
          : 'Tiempo de espera agotado. Usa Reintentar o los productos locales.',
      );
    throw e;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
export function archiveStatus(result) {
  if (result.partial || result.truncated)
    return {
      kind: 'partial',
      text: `Consulta parcial${result.truncated ? ' o truncada' : ''}. Faltan: ${(result.failedCollections || []).join(', ') || 'registros adicionales'}. No equivale al archivo completo.`,
    };
  if (!result.records?.length)
    return {
      kind: 'empty',
      text: 'Búsqueda sin resultados para esta región; no significa que el objeto no exista.',
    };
  return {
    kind: 'ready',
    text: 'Consulta recibida. La cobertura y calidad se verifican al abrir cada FITS.',
  };
}

/** All products remain accessible. A cursor indexes documented collection/TIME requests, not an invented SIA OFFSET. */
export function observationStats(records) {
  return {
    products: records.length,
    exposures: new Set(records.map((r) => r.id)).size,
    detectorExposures: new Set(records.map((r) => r.id + '|' + r.band)).size,
    epochs: new Set(records.map((r) => r.dateAvg || r.date).filter(Boolean)).size,
    bands: new Set(records.map((r) => r.band)).size,
  };
}
export async function collectArchive({
  ra,
  dec,
  signal,
  segmented = false,
  deep = false,
  refresh = false,
  onPage = () => {},
  request = fetchResource,
  base = '/api/spherex',
} = {}) {
  let cursor = 0,
    finished = false;
  const merged = new Map(),
    failures = new Set();
  let pages = 0,
    total = 0;
  while (!finished) {
    if (signal?.aborted) throw Error('Consulta cancelada.');
    const params = new URLSearchParams({
      action: 'search',
      ra: String(ra),
      dec: String(dec),
      release: 'all',
      progressive: '1',
      cursor: String(cursor),
      segmented: segmented ? '1' : '0',
      deep: deep ? '1' : '0',
      refresh: refresh ? '1' : '0',
    });
    const data = await request(base + '?' + params, { signal, timeoutMs: 65000 });
    if (!Array.isArray(data.records)) throw Error('Respuesta IRSA sin lista de productos.');
    for (const record of data.records)
      if (record.url) merged.set(record.url, { ...record, queryCenter: { ra, dec } });
    for (const name of data.failedCollections || []) failures.add(name);
    if (data.partial && !data.failedCollections?.length)
      failures.add(data.collection || 'consulta');
    pages++;
    total = data.pageCount || pages;
    finished = data.nextCursor === null || data.nextCursor === undefined;
    const records = [...merged.values()].sort(
      (a, b) =>
        Number(a.dateAvg || a.date) - Number(b.dateAvg || b.date) || a.url.localeCompare(b.url),
    );
    const result = {
      records,
      partial: failures.size > 0,
      failedCollections: [...failures],
      page: pages,
      pageCount: total,
      complete: finished,
      stats: observationStats(records),
      queriedAt: data.queriedAt,
    };
    onPage(result);
    if (finished) return result;
    if (!Number.isInteger(data.nextCursor) || data.nextCursor <= cursor)
      throw Error('El archivo devolvió un cursor inválido.');
    cursor = data.nextCursor;
  }
}
export class FrameLru {
  constructor(limit = 20) {
    this.limit = limit;
    this.items = new Map();
  }
  has(k) {
    return this.items.has(k);
  }
  get(k) {
    const v = this.items.get(k);
    if (v) {
      this.items.delete(k);
      this.items.set(k, v);
    }
    return v;
  }
  set(k, v) {
    this.items.delete(k);
    this.items.set(k, v);
    while (this.items.size > this.limit) this.items.delete(this.items.keys().next().value);
    return v;
  }
  clear() {
    this.items.clear();
  }
  get size() {
    return this.items.size;
  }
}

export function fitsCacheKey(record, target) {
  return [
    record.url,
    record.localFile ? 'local:' + record.localSha256 : 'irsa',
    record.cutoutSizeDeg || 0.12,
    target.ra,
    target.dec,
    'g96',
    'subtracted',
    'measurement',
  ].join('|');
}
