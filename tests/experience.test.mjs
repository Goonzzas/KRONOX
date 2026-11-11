import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import * as THREE from 'three';
import {
  chronologicalShowcase,
  temporalPair,
  spectralCandidates,
  preferredProducts,
  observationMjd,
} from '../src/utils/temporalObservations.js';
import { SPHEREX_TARGETS } from '../src/data/spherexTargets.js';
import { TEMPORAL_OBSERVATIONS } from '../src/data/temporalObservationsData.js';
import { NAVIGATION_CATALOG } from '../src/data/navigationCatalog.js';
import { NEARBY_GALAXIES } from '../src/data/nearbyGalaxies.js';
import {
  sampleAperture,
  compareEpochs,
  hasTemporalCoverage,
} from '../src/utils/scientificEvidence.js';
import { parseFits } from '../src/utils/fitsImage.js';
import { createSceneLabel } from '../src/scene/sceneLabels.js';
import { buildStellarAtlas, contextCatalog } from '../src/scene/navigationAtlas.js';
import { makeAtlasGalaxy } from '../src/scene/galaxyVisuals.js';
import {
  galaxySymbolRadii,
  galaxyMapPosition,
  fitAtlasCamera,
  labelBoxes,
} from '../src/scene/mapLayout.js';
const fakeDocument = {
  createElement() {
    return {
      getContext() {
        return { measureText: (s) => ({ width: s.length * 14 }), fillText() {} };
      },
    };
  },
};

test('Date navigation covers the full interval, deduplicates processing versions, and balances spectral detectors', () => {
  const records = Array.from({ length: 40 }, (_, i) => ({
    id: 'exp' + i,
    date: String(60000 + i * 11),
    dateAvg: String(60000 + i * 11),
    band: i % 2 ? 'SPHEREx-D1' : 'SPHEREx-D2',
    url: 'product' + i,
  }));
  records.push({ ...records[0], url: 'preferred-reprocessing', priorityScore: 100 });
  assert.equal(preferredProducts(records).length, 40);
  assert.equal(preferredProducts(records)[0].url, 'preferred-reprocessing');
  const selection = chronologicalShowcase(records, { count: 18 });
  assert.equal(selection.length, 18);
  assert.equal(observationMjd(selection[0]), 60000);
  assert.equal(observationMjd(selection.at(-1)), 60429);
  assert.equal(new Set(selection.map((r) => Math.floor(observationMjd(r)))).size, 18);
  const pair = temporalPair(records, { band: 'SPHEREx-D1', minDays: 300 });
  assert.equal(pair.a.band, pair.b.band);
  assert.ok(pair.days > 300);
  assert.equal(
    temporalPair([
      { ...records[0], id: 'same' },
      { ...records[0], id: 'same', dateAvg: '60400' },
    ]),
    null,
    'Versions of one exposure are not independent dates',
  );
  const balanced = spectralCandidates(records);
  assert.equal(new Set(balanced.map((r) => r.url)).size, 40);
  assert.equal(new Set(balanced.slice(0, 2).map((r) => r.band)).size, 2);
});

test('Curated temporal pairs reproduce native FITS measurements, hashes, date spans and local wavelength compatibility', () => {
  for (const curated of TEMPORAL_OBSERVATIONS.targets) {
    const target = SPHEREX_TARGETS.find((t) => t.key === curated.key),
      pair = target.temporalPair;
    assert.ok(target.localRecords.length > 20);
    assert.ok(pair && pair.days > 180);
    assert.ok(+pair.measurements[0].date !== +pair.measurements[1].date);
    const measurements = [pair.a, pair.b].map((url) => {
      const record = target.localRecords.find((r) => r.url === url);
      assert.ok(record && record.localFile);
      const bytes = fs.readFileSync('public/demo/' + record.localFile);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.localSha256);
      const frame = parseFits(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        null,
        target,
        {
          gridSize: 96,
          fovDeg: record.cutoutSizeDeg,
          zodiMode: 'subtracted',
          flagPolicy: 'measurement',
        },
      );
      frame.record = record;
      return sampleAperture(frame, target, {
        radiusArcsec: target.type === 'galaxia' ? 24.6 : 12.3,
      });
    });
    assert.ok(measurements.every(hasTemporalCoverage));
    assert.ok(compareEpochs(...measurements).ok);
    assert.ok(+measurements[0].date < +measurements[1].date);
    assert.deepEqual(
      measurements.map((m) => Number(m.date)),
      pair.measurements.map((m) => Number(m.date)),
    );
    assert.ok(Math.abs(+measurements[1].date - +measurements[0].date - pair.days) < 1e-7);
  }
  assert.ok(SPHEREX_TARGETS.find((t) => t.key === 'rw-aurigae').temporalPair.days > 365);
});

test('Temporal screening rejects sparse apertures, same numeric dates and incompatible units without discarding real spectral samples', () => {
  const a = {
    unit: 'MJy / sr',
    band: 'D2',
    wave: 1.3,
    bandwidth: 0.03,
    date: '60000',
    valid: 8,
    total: 12,
    radiusArcsec: 12.3,
  };
  assert.ok(compareEpochs(a, { ...a, unit: 'MJy/sr', date: '60400' }).ok);
  assert.equal(compareEpochs(a, { ...a, date: '60000.000' }).ok, false);
  assert.equal(compareEpochs(a, { ...a, unit: 'mJy/sr', date: '60400' }).ok, false);
  assert.equal(compareEpochs(a, { ...a, valid: 2, date: '60400' }).ok, false);
  assert.equal(hasTemporalCoverage({ ...a, valid: 0 }), false);
});

test('Local and regional atlases contain named catalog systems at their radial distances and preserve provenance', () => {
  assert.ok(NAVIGATION_CATALOG.stars.length > 100);
  for (const mode of ['stellar', 'regional']) {
    const list = contextCatalog(mode, SPHEREX_TARGETS);
    assert.ok(list.length > 40);
    const before = globalThis.document;
    globalThis.document = fakeDocument;
    let atlas;
    try {
      atlas = buildStellarAtlas(mode, {
        missionTargets: SPHEREX_TARGETS,
        softMap: new THREE.Texture(),
      });
      assert.equal(atlas.markers.size, list.length + 1);
      assert.ok(atlas.markers.has('sun'));
      for (const entry of list) {
        assert.ok(entry.name && entry.source);
        const marker = atlas.markers.get(entry.key).marker;
        assert.ok(Math.abs(marker.position.length() - entry.distancePc * atlas.units) < 1e-7);
      }
    } finally {
      globalThis.document = before;
    }
  }
});

test('Galaxy symbols have bounded nonoverlapping world radii; projected labels avoid panels and one another', () => {
  const objects = NEARBY_GALAXIES.filter((e) => e.kind !== 'group'),
    radii = galaxySymbolRadii(NEARBY_GALAXIES);
  for (let i = 0; i < objects.length; i++)
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i],
        b = objects[j],
        distance = galaxyMapPosition(a).distanceTo(galaxyMapPosition(b));
      assert.ok(radii.get(a.key) + radii.get(b.key) < distance);
    }
  const framing = fitAtlasCamera(NEARBY_GALAXIES, 1.6);
  assert.ok(framing.score < 0.005);
  const boxes = labelBoxes(
    Array.from({ length: 14 }, (_, i) => ({
      key: i,
      x: ((i % 4) - 1.5) * 0.07,
      y: (Math.floor(i / 4) - 1.5) * 0.07,
      z: 0.5,
    })),
    { width: 1280, height: 800, left: 325, right: 350 },
  );
  assert.ok(boxes.length > 5);
  for (const a of boxes) {
    assert.ok(a.x >= 325 && a.x + a.width <= 930);
    assert.ok(a.y >= 84 && a.y + a.height <= 720);
    for (const b of boxes) {
      if (a === b) continue;
      assert.ok(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      );
    }
  }
});

test('Labels keep a bounded pixel footprint during a trip regardless of legacy scale, distance or parent scale', () => {
  const label = createSceneLabel('Enana de Sagitario', 82, 128, fakeDocument),
    parent = new THREE.Group();
  parent.add(label);
  const camera = new THREE.PerspectiveCamera(55, 1.6, 0.01, 4e5),
    focal = 800 / (2 * Math.tan((55 * Math.PI) / 360));
  for (const scale of [1, 0.02, 1000])
    for (const distance of [1, 100000]) {
      parent.scale.setScalar(scale);
      camera.position.z = distance;
      parent.updateMatrixWorld(true);
      label.onBeforeRender({ domElement: { clientHeight: 800 } }, null, camera);
      const world = label.getWorldScale(new THREE.Vector3());
      assert.ok(Math.abs(world.x * focal - 220) < 1e-7);
      assert.ok(Math.abs(world.y * focal - 28) < 1e-7);
    }
});

test('Elliptical galaxies use a thick ellipsoidal volume and spirals a disk, without duplicate group galaxies', () => {
  const spiral = makeAtlasGalaxy({
      key: 'm31',
      type: 'spiral',
      radius: 20,
      color: '#aabbcc',
      softMap: new THREE.Texture(),
    }),
    elliptical = makeAtlasGalaxy({
      key: 'sagittarius-dwarf',
      type: 'elliptical',
      radius: 20,
      color: '#aabbcc',
      softMap: new THREE.Texture(),
    });
  const thickness = (g) => {
    const p = g.children[0].geometry.attributes.position.array;
    let sum = 0;
    for (let i = 1; i < p.length; i += 3) sum += p[i] * p[i];
    return Math.sqrt(sum / (p.length / 3));
  };
  assert.ok(thickness(elliptical) > thickness(spiral) * 3);
  assert.equal(elliptical.userData.morphology, 'elliptical');
  assert.ok(NEARBY_GALAXIES.some((g) => g.kind === 'group'));
});

test('React gallery exposes nine images per page and all products; catalog-star inspector does not offer undefined planet travel', async () => {
  const server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  let renderer;
  try {
    const { default: Gallery } = await server.ssrLoadModule(
        '/src/components/ObservationGallery.jsx',
      ),
      { default: Cockpit } = await server.ssrLoadModule('/src/components/SpaceshipCockpit.jsx');
    const records = Array.from({ length: 40 }, (_, i) => ({
        id: 'test' + i,
        url: 'test' + i,
        date: String(60000 + i * 11),
        band: 'SPHEREx-D1',
        release: 'spherex_qr2',
      })),
      opened = [];
    const inner = (n) => (typeof n === 'string' ? n : (n.children || []).map(inner).join(''));
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Gallery, {
          records,
          loadFits: async (r) => ({ src: 'data:image/png;base64,' + r.id }),
          onSelect: (u) => opened.push(u),
        }),
      );
    });
    assert.equal(renderer.root.findAllByType('img').length, 9);
    await act(async () =>
      renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'exposures' } }),
    );
    assert.ok(inner(renderer.root).includes('40 imágenes'));
    for (let i = 0; i < 4; i++)
      await act(async () =>
        renderer.root
          .findAllByType('button')
          .find((b) => inner(b) === 'Más imágenes')
          .props.onClick(),
      );
    assert.equal(renderer.root.findAllByType('img').length, 4);
    await act(async () =>
      renderer.root
        .findAllByType('button')
        .find((b) => b.props['aria-label']?.startsWith('Abrir imagen'))
        .props.onClick(),
    );
    assert.equal(opened[0], 'test36');
    await act(async () => renderer.unmount());
    const star = NAVIGATION_CATALOG.stars[0];
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Cockpit, { selectedObject: { kind: 'catalog-star', key: star.key } }),
      );
    });
    let tree = JSON.stringify(renderer.toJSON());
    assert.ok(tree.includes('Consultar catálogo de origen'));
    assert.ok(!tree.includes('Viajar a undefined'));
    await act(async () => renderer.unmount());
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Cockpit, {
          selectedObject: { kind: 'spherex', key: 'sagittarius-dwarf' },
        }),
      );
    });
    tree = JSON.stringify(renderer.toJSON());
    assert.ok(tree.includes('Galaxia · cobertura SPHEREx'));
    assert.ok(!tree.includes('Distancia pendiente de verificar'));
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await server.close();
  }
});
