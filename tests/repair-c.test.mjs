import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { parseFits } from '../src/utils/fitsImage.js';
import { restoreFitsFrame, wavelengthPlane } from '../src/utils/fitsTransport.js';
import { sampleAperture } from '../src/utils/scientificEvidence.js';
import { rgbChannels, composeRgb } from '../src/utils/rgbComposite.js';
import { SPHEREX_TARGETS } from '../src/data/spherexTargets.js';
const target = SPHEREX_TARGETS.find((t) => t.key === 'm31');
function read(record = target.localRecords[0]) {
  const b = fs.readFileSync('public/demo/' + record.localFile);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
const options = { gridSize: 96, fovDeg: 0.08, zodiMode: 'subtracted', flagPolicy: 'measurement' };
function frame(record = target.localRecords[0]) {
  const f = parseFits(read(record), null, target, options);
  f.record = record;
  f.center = { ra: target.ra, dec: target.dec };
  f.wavelengthPixels = wavelengthPlane(f);
  return f;
}
test('Real FITS worker transfers typed pixels, restores WCS/SIP and wavelength calibration without scientific changes', async () => {
  const module = new URL('../src/workers/fitsWorker.js', import.meta.url).href;
  const code = `import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};await import(${JSON.stringify(module)});parentPort.on('message',data=>self.onmessage({data}));`;
  const worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(code)));
  try {
    const buffer = read();
    const reply = new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
    });
    worker.postMessage(
      { buffer, range: null, center: { ra: target.ra, dec: target.dec }, options },
      [buffer],
    );
    assert.equal(buffer.byteLength, 0);
    const message = await reply;
    assert.equal(message.error, undefined);
    assert.ok(message.frame.decodeMs >= 0);
    const actual = restoreFitsFrame(message.frame),
      expected = frame();
    actual.record = expected.record;
    assert.deepEqual(actual.scientificPixels, expected.scientificPixels);
    assert.deepEqual(actual.rawVariancePixels, expected.rawVariancePixels);
    assert.deepEqual(actual.rawFlagsPixels, expected.rawFlagsPixels);
    assert.deepEqual(
      sampleAperture(actual, target, { radiusArcsec: 24.6 }),
      sampleAperture(expected, target, { radiusArcsec: 24.6 }),
    );
    for (const [x, y] of [
      [0, 0],
      [48, 48],
      [95, 95],
    ]) {
      const a = actual.reprojected.gridToWorld(x, y),
        b = expected.reprojected.gridToWorld(x, y);
      assert.ok(Math.abs(a.ra - b.ra) < 1e-10);
      assert.ok(Math.abs(a.dec - b.dec) < 1e-10);
      const p = actual.reprojected.worldToGrid(a.ra, a.dec);
      assert.ok(Math.abs(p.col - x) < 1e-7 && Math.abs(p.row - y) < 1e-7);
    }
    assert.ok(actual.wavelengthPixels.some(Number.isFinite));
    assert.equal(actual.previewPixels.length, 96 * 96 * 4);
  } finally {
    await worker.terminate();
  }
});
test('RGB masks real per-pixel wavelength intervals and visual adjustments do not change flux arrays', () => {
  const f = frame(),
    frames = [f, f, f],
    wave = f.wavelengthPixels.find(Number.isFinite);
  const broad = rgbChannels(frames, [
      [0.75, 5],
      [0.75, 5],
      [0.75, 5],
    ]),
    excluded = rgbChannels(frames, [
      [4.9, 5],
      [0.75, 5],
      [0.75, 5],
    ]);
  assert.ok(broad[0].some(Number.isFinite));
  assert.ok(excluded[0].every((v) => !Number.isFinite(v)));
  const before = Float32Array.from(f.scientificPixels);
  const result = composeRgb({
    channels: broad,
    width: 96,
    height: 96,
    gain: 1.3,
    contrast: 1.5,
    normalization: 'channel',
  });
  assert.equal(result.normalization, 'channel');
  assert.deepEqual(f.scientificPixels, before);
  assert.equal(composeRgb({ channels: excluded, width: 96, height: 96 }).missing, 96 * 96);
  assert.ok(wave > 0.75);
});
test('Spectrum renders real numbers, empty extraction has an explicit cause, and samples accumulate beyond 12 with bounded frames', async () => {
  const server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  let renderer;
  try {
    const { default: Plot } = await server.ssrLoadModule('/src/components/SpectrumPlot.jsx');
    const { useObservationSamples } = await server.ssrLoadModule(
      '/src/components/useObservationSamples.js',
    );
    const actual = frame();
    const measurement = sampleAperture(actual, target, { radiusArcsec: 24.6 });
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Plot, {
          measurements: [measurement],
          selected: null,
          onSelect() {},
          domain: [0.75, 5],
        }),
      );
    });
    assert.equal(renderer.root.findAllByType('circle').length, 1);
    assert.ok(JSON.stringify(renderer.toJSON()).includes('MJy / sr'));
    await act(async () =>
      renderer.update(
        React.createElement(Plot, {
          measurements: [
            { ...measurement, flux: null, reason: 'Sin píxeles válidos en la apertura' },
          ],
          selected: null,
          onSelect() {},
          domain: [0.75, 5],
        }),
      ),
    );
    assert.equal(renderer.root.findAllByType('svg').length, 0);
    assert.ok(JSON.stringify(renderer.toJSON()).includes('Sin píxeles válidos'));
    await act(async () => renderer.unmount());
    const records = Array.from({ length: 25 }, (_, i) => ({
      ...target.localRecords[0],
      url: target.localRecords[0].url + '?test-fixture=' + i,
      id: 'test-fixture-' + i,
    }));
    let api;
    function Harness({ current }) {
      api = useObservationSamples({
        target,
        frame: current,
        records,
        loadFits: async (record) => ({ ...actual, record }),
        radius: 24.6,
        selection: null,
      });
      return null;
    }
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Harness, { current: { ...actual, record: records[0] } }),
      );
    });
    for (let i = 0; i < 4; i++) await act(async () => api.loadBatch());
    assert.equal(api.samples.length, 25);
    assert.equal(api.remaining, 0);
    assert.equal(api.frames.length, 18);
    await act(async () =>
      renderer.update(
        React.createElement(Harness, { current: { ...actual, record: records[24] } }),
      ),
    );
    assert.equal(api.samples.length, 25, 'Image changes must preserve the accumulated spectrum');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await server.close();
  }
});
