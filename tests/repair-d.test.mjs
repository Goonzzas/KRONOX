import {
  heliocentricMapPosition,
  visualDistanceInMapUnits,
} from '../src/scene/astronomicalPositions.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {
  NAVIGATION_SCALES,
  scaleContext,
  scaleForTarget,
  macroGalacticVisible,
} from '../src/scene/navigationScale.js';
import { renderWithOriginRebase } from '../src/scene/originRebase.js';
import { SPHEREX_TARGETS } from '../src/data/spherexTargets.js';
import { M101_OBSERVATIONS } from '../src/data/m101Observations.js';
import { parseFits } from '../src/utils/fitsImage.js';
import { sampleAperture } from '../src/utils/scientificEvidence.js';
import crypto from 'node:crypto';
test('Five astronomical contexts use catalog distances and restrict Orion to the galactic overview', () => {
  assert.equal(NAVIGATION_SCALES.length, 5);
  const barnard = SPHEREX_TARGETS.find((t) => t.key === 'barnard'),
    rw = SPHEREX_TARGETS.find((t) => t.key === 'rw-aurigae');
  assert.equal(scaleForTarget(barnard), 'stellar');
  assert.equal(scaleForTarget(rw), 'regional');
  assert.ok(Math.abs(scaleContext('stellar', barnard).distancePc - 1.83) < 0.03);
  assert.ok(Math.abs(scaleContext('regional', rw).distancePc - 156.1) < 1);
  assert.equal(scaleForTarget(M101_OBSERVATIONS), 'extragalactic');
  for (const scale of NAVIGATION_SCALES)
    assert.equal(macroGalacticVisible(scale.id), scale.id === 'milkyway');
  assert.equal(macroGalacticVisible('milkyway', { cinematic: true }), false);
  const source = fs.readFileSync('src/scene/createScene.js', 'utf8');
  assert.ok(source.includes('macroGalacticGroup.add(gp('));
  assert.ok(source.includes('missionDestinationGroup.add(marker)'));
});
test('Origin rebasing preserves projection/relative distances and restores simulation coordinates even on render failure', () => {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(55, 1, 0.01, 4e5),
    object = new THREE.Object3D();
  object.position.set(150000, 2, -80000);
  scene.add(object);
  camera.position.set(150000.125, 3.75, -79998);
  camera.lookAt(object.position);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const originalCamera = camera.position.clone(),
    originalObject = object.getWorldPosition(new THREE.Vector3()),
    beforeProjection = originalObject.clone().project(camera);
  let rendered = false;
  const state = renderWithOriginRebase(
    {
      render(s, c) {
        rendered = true;
        assert.ok(c.position.length() < 1000);
        const actual = object.getWorldPosition(new THREE.Vector3()).project(c);
        assert.ok(actual.distanceTo(beforeProjection) < 1e-8);
        assert.ok(
          Math.abs(
            object.getWorldPosition(new THREE.Vector3()).distanceTo(c.position) -
              originalObject.distanceTo(originalCamera),
          ) < 1e-8,
        );
      },
    },
    scene,
    camera,
  );
  assert.ok(rendered && state.rebased);
  assert.deepEqual(camera.position, originalCamera);
  assert.deepEqual(object.getWorldPosition(new THREE.Vector3()), originalObject);
  assert.throws(
    () =>
      renderWithOriginRebase(
        {
          render() {
            throw Error('draw failed');
          },
        },
        scene,
        camera,
      ),
    /draw failed/,
  );
  assert.deepEqual(camera.position, originalCamera);
  assert.deepEqual(scene.position, new THREE.Vector3());
});
test('M101 has six distinct authentic cutouts, hashes, calibrated units, positive variance and valid central apertures', () => {
  const target = SPHEREX_TARGETS.find((t) => t.key === 'm101');
  assert.ok(target.localRecords.length >= 6);
  assert.equal(new Set(target.localRecords.map((r) => r.url)).size, target.localRecords.length);
  for (const record of target.localRecords) {
    const bytes = fs.readFileSync('public/demo/' + record.localFile);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.localSha256);
    assert.ok(record.url.startsWith('https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/'));
    const frame = parseFits(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      null,
      target,
      { gridSize: 96, fovDeg: 0.12, zodiMode: 'subtracted', flagPolicy: 'measurement' },
    );
    frame.record = record;
    const m = sampleAperture(frame, target, { radiusArcsec: 24.6 });
    assert.ok(m.valid > 0 && m.sigma > 0 && Number.isFinite(m.flux));
    assert.ok(m.wave > 0.75 && m.wave < 5);
    assert.ok(m.unit.replaceAll(' ', '') === 'MJy/sr');
    assert.ok(
      frame.rawWidth < 120 && frame.rawHeight < 120,
      'cutouts, not full 2040x2040 detectors',
    );
  }
});

test('Solar-origin target frame has no galactic-anchor offset and preserves ICRS angular separations', () => {
  const a = { ra: 0, dec: 0, distanceLy: 6 },
    b = { ra: 90, dec: 0, distanceLy: 6 };
  const pa = new THREE.Vector3(...heliocentricMapPosition(a)),
    pb = new THREE.Vector3(...heliocentricMapPosition(b));
  assert.ok(Math.abs(pa.length() - visualDistanceInMapUnits(6)) < 1e-5);
  assert.ok(Math.abs(pa.angleTo(pb) - Math.PI / 2) < 1e-8);
  assert.ok(
    new THREE.Vector3(...heliocentricMapPosition({ ...a, distanceLy: 0 })).length() < 1e-12,
  );
  const source = fs.readFileSync('src/scene/createScene.js', 'utf8');
  assert.match(source, /missionDestinationGroup.quaternion.copy\(gal.quaternion\)/);
});
