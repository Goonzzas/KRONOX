import { parseWcs, parseWcsWaveTable } from './fitsImage.js';
export function plainFitsFrame(frame) {
  const seen = new WeakMap();
  function copy(v) {
    if (typeof v === 'function') return undefined;
    if (!v || typeof v !== 'object' || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v;
    if (seen.has(v)) return seen.get(v);
    const out = Array.isArray(v) ? [] : {};
    seen.set(v, out);
    for (const [k, item] of Object.entries(v)) if (typeof item !== 'function') out[k] = copy(item);
    return out;
  }
  return copy(frame);
}
export function transferBuffers(value) {
  const buffers = new Set(),
    seen = new WeakSet();
  function visit(v) {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (ArrayBuffer.isView(v)) {
      buffers.add(v.buffer);
      return;
    }
    if (v instanceof ArrayBuffer) {
      buffers.add(v);
      return;
    }
    for (const item of Object.values(v)) visit(item);
  }
  visit(value);
  return [...buffers];
}
export function restoreFitsFrame(frame) {
  frame.wcs = parseWcs(frame.headerValues);
  const table = frame.wcsWave;
  if (table) {
    const bytes = new ArrayBuffer((table.nx + table.ny) * 4 + table.nx * table.ny * 8),
      view = new DataView(bytes);
    let at = 0;
    for (const v of [...table.xGrid, ...table.yGrid]) {
      view.setInt32(at, v, false);
      at += 4;
    }
    for (let i = 0; i < table.waveGrid.length; i++) {
      view.setFloat32(at, table.waveGrid[i], false);
      view.setFloat32(at + 4, table.bandGrid[i], false);
      at += 8;
    }
    frame.wcsWave = parseWcsWaveTable(
      view,
      0,
      bytes.byteLength,
      { TFORM1: table.nx + 'J', TFORM2: table.ny + 'J' },
      frame.headerValues,
    );
  }
  if (frame.reprojected && frame.center) {
    const r = frame.reprojected,
      n = r.width,
      wcs = parseWcs({
        CRPIX1: (n + 1) / 2,
        CRPIX2: (n + 1) / 2,
        CRVAL1: frame.center.ra,
        CRVAL2: frame.center.dec,
        CDELT1: -r.scaleDeg,
        CDELT2: -r.scaleDeg,
      });
    r.gridToWorld = (col, row) => wcs.pixelToWorld(col + 1, row + 1);
    r.worldToGrid = (ra, dec) => {
      const p = wcs.worldToPixel(ra, dec);
      return p
        ? {
            col: p.xFits - 1,
            row: p.yFits - 1,
            xPercent: ((p.xFits - 0.5) / n) * 100,
            yPercent: ((p.yFits - 0.5) / n) * 100,
          }
        : null;
    };
  }
  return frame;
}
export function wavelengthPlane(frame) {
  if (!frame.reprojected || !frame.wcsWave || !frame.wcs) return null;
  const plane = new Float32Array(frame.width * frame.height).fill(NaN);
  for (let i = 0; i < plane.length; i++) {
    const sky = frame.reprojected.gridToWorld(i % frame.width, Math.floor(i / frame.width)),
      p = frame.wcs.worldToPixel(sky.ra, sky.dec),
      wave = p && frame.wcsWave.evaluateAtCutoutPixel(p.xFits, p.yFits);
    if (wave) plane[i] = wave.wavelengthUm;
  }
  return plane;
}
export function previewPixels(frame) {
  const rgba = new Uint8ClampedArray(frame.width * frame.height * 4),
    low = frame.range.low,
    span = frame.range.high - low || 1;
  for (let i = 0; i < frame.scientificPixels.length; i++) {
    const v = frame.scientificPixels[i];
    if (!Number.isFinite(v)) {
      const hatch = ((i % frame.width) + Math.floor(i / frame.width)) % 12 < 2;
      rgba.set(hatch ? [14, 20, 32, 255] : [6, 9, 16, 255], i * 4);
      continue;
    }
    const k = 255 * Math.pow(Math.max(0, Math.min(1, (v - low) / span)), 0.72);
    rgba.set([k * 0.68, k * 0.82, k, 255], i * 4);
  }
  return rgba;
}
