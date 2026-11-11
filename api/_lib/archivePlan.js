export function parseCsvTable(text = '') {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  const value = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && value[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw Error('CSV incompleto: campo entre comillas sin cerrar');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = (rows.shift() || []).map((k) => k.trim());
  return {
    headers,
    rows: rows.map((values) => Object.fromEntries(headers.map((k, i) => [k, values[i] ?? '']))),
  };
}
export const parseCsv = (text) => parseCsvTable(text).rows;
export function buildSearchPlan({
  release = 'all',
  deep = false,
  segmented = false,
  now = new Date(),
} = {}) {
  const collections =
    release === 'qr2'
      ? ['spherex_qr2']
      : release === 'qr3'
        ? ['spherex_qr3']
        : ['spherex_qr2', 'spherex_qr3'];
  if (deep) collections.push(...collections.map((c) => c + '_deep'));
  if (!segmented) return collections.map((collection) => ({ collection, time: null }));
  const cuts = [];
  let date = new Date('2025-03-01T00:00:00Z');
  while (date <= now) {
    cuts.push(date.getTime() / 86400000 + 40587);
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }
  cuts.push(date.getTime() / 86400000 + 40587);
  const intervals = [
    ['-Inf', cuts[0]],
    ...cuts.slice(0, -1).map((v, i) => [v, cuts[i + 1]]),
    [cuts.at(-1), 'Inf'],
  ];
  return collections.flatMap((collection) =>
    intervals.map(([a, b]) => ({ collection, time: `${a} ${b}` })),
  );
}
