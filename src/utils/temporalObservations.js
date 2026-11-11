import { sampleAperture, compareEpochs, hasTemporalCoverage } from './scientificEvidence.js';
export const observationMjd = (r) => Number.parseFloat(r?.dateAvg || r?.date);
export function preferredProducts(records) {
  const groups = new Map();
  for (const r of records) {
    const key = r.id + '|' + r.band,
      old = groups.get(key);
    if (!old || Number(r.priorityScore || 0) > Number(old.priorityScore || 0)) groups.set(key, r);
  }
  return [...groups.values()].sort((a, b) => observationMjd(a) - observationMjd(b));
}
export function recordDateRange(records) {
  const dates = records.map(observationMjd).filter(Number.isFinite);
  return dates.length
    ? {
        first: Math.min(...dates),
        last: Math.max(...dates),
        days: Math.max(...dates) - Math.min(...dates),
      }
    : null;
}
export function temporalPair(records, { band = null, minDays = 30 } = {}) {
  const groups = new Map();
  for (const r of preferredProducts(records)) {
    if (!Number.isFinite(observationMjd(r)) || (band && r.band !== band)) continue;
    if (!groups.has(r.band)) groups.set(r.band, []);
    groups.get(r.band).push(r);
  }
  let best = null;
  for (const rows of groups.values()) {
    const a = rows[0],
      b = rows.at(-1),
      days = observationMjd(b) - observationMjd(a);
    if (days >= minDays && a.id !== b.id && (!best || days > best.days))
      best = { a, b, days, band: a.band, calibrated: false };
  }
  return best;
}
export function chronologicalShowcase(records, { count = 12, band = null } = {}) {
  let rows = preferredProducts(records).filter((r) => !band || r.band === band);
  const days = new Map();
  for (const r of rows) {
    const day = Math.floor(observationMjd(r));
    if (!Number.isFinite(day)) continue;
    const key = day;
    if (!days.has(key)) days.set(key, r);
  }
  rows = [...days.values()].sort((a, b) => observationMjd(a) - observationMjd(b));
  if (rows.length <= count) return rows;
  return Array.from(
    { length: count },
    (_, i) => rows[Math.round((i * (rows.length - 1)) / (count - 1))],
  );
}
export function spectralCandidates(records) {
  const groups = new Map();
  for (const r of preferredProducts(records)) {
    if (!groups.has(r.band)) groups.set(r.band, []);
    groups.get(r.band).push(r);
  }
  const selected = [];
  for (let round = 0; round < Math.max(0, ...[...groups.values()].map((a) => a.length)); round++) {
    for (const rows of groups.values()) {
      if (round >= rows.length) continue;
      const index =
        round % 2 === 0 ? Math.floor(round / 2) : rows.length - 1 - Math.floor(round / 2);
      if (index >= 0 && index < rows.length) selected.push(rows[index]);
    }
  }
  return selected;
}
export function temporalCandidates(records, band) {
  const rows = preferredProducts(records).filter((r) => !band || r.band === band),
    out = [];
  for (let i = 0; i < Math.ceil(rows.length / 2); i++) {
    out.push(rows[i]);
    if (rows.length - 1 - i !== i) out.push(rows[rows.length - 1 - i]);
  }
  return out;
}
export async function findCalibratedTemporalPair({
  records,
  target,
  loadFits,
  band,
  minDays = 90,
  maxProducts = 32,
  signal,
  onProgress = () => {},
}) {
  const candidates = temporalCandidates(records, band).slice(0, maxProducts),
    measured = [],
    failures = [];
  let best = null;
  for (const [i, record] of candidates.entries()) {
    if (signal?.aborted) throw Error('Búsqueda temporal cancelada.');
    try {
      const frame = await loadFits(record, signal);
      const m = sampleAperture({ ...frame, record }, target, {
        radiusArcsec: target.type === 'galaxia' ? 24.6 : 12.3,
      });
      if (Number.isFinite(m.flux) && hasTemporalCoverage(m)) {
        for (const old of measured) {
          const days = Math.abs(observationMjd(record) - observationMjd(old.record));
          if (days < minDays || !compareEpochs(m, old.m).ok) continue;
          if (!best || days > best.days)
            best = {
              a: observationMjd(record) < observationMjd(old.record) ? record : old.record,
              b: observationMjd(record) < observationMjd(old.record) ? old.record : record,
              days,
              band: record.band,
              calibrated: true,
              waveDifference: Math.abs(m.wave - old.m.wave),
              measurements: [m, old.m],
            };
        }
        measured.push({ record, m });
      }
    } catch (e) {
      if (signal?.aborted) throw e;
      failures.push({ url: record.url, error: e.message });
    }
    onProgress({ done: i + 1, total: candidates.length, valid: measured.length, best, failures });
    if (best?.days >= 300) return { ...best, checked: i + 1 };
  }
  return best
    ? { ...best, checked: candidates.length }
    : {
        a: null,
        b: null,
        checked: candidates.length,
        failures,
        reason:
          'No se encontró un par con apertura válida, λ compatible y separación mínima entre los productos revisados. Amplía la búsqueda o cambia de detector.',
      };
}
