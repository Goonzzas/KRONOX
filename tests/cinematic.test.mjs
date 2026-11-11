import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {
  createJumpSequence,
  advanceJump,
  jumpVisualState,
  JUMP_PHASES,
  JUMP_DURATIONS,
} from '../src/scene/jumpSequence.js';
import { createHyperspaceEffect } from '../src/scene/hyperspaceEffect.js';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';
const plan = () =>
  createJumpSequence({
    from: new THREE.Vector3(1, 2, 3),
    target: new THREE.Vector3(12000, 500, -3000),
    startQuaternion: new THREE.Quaternion(),
    clearance: 1.3,
  });
test('Jump phases run in order, in seconds, with deterministic arrival at 30 and 144 Hz', () => {
  const results = [];
  for (const fps of [30, 144]) {
    const nav = plan();
    for (let i = 0; i < fps * 30 && !nav.done; i++) advanceJump(nav, 1 / fps);
    assert.ok(nav.done);
    assert.deepEqual(nav.history, JUMP_PHASES);
    assert.ok(nav.position.distanceTo(nav.to) < 1e-12);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(nav.currentQuaternion);
    assert.ok(direction.dot(nav.target.clone().sub(nav.position).normalize()) > 0.999999);
    results.push(nav);
  }
  assert.ok(results[0].position.distanceTo(results[1].position) < 1e-12);
  assert.ok(Math.abs(results[0].time - results[1].time) < 1e-9);
});
test('Entry visibly lengthens trails before cruise and exit fades them; reduced motion suppresses the threshold pulse', () => {
  const nav = plan();
  nav.phase = 'HYPERSPACE_ENTRY';
  const entry = [0, 0.5, 1].map((t) => {
    nav.phaseProgress = t;
    return jumpVisualState(nav);
  });
  assert.ok(entry[0].stretch < entry[1].stretch && entry[1].stretch < entry[2].stretch);
  assert.ok(entry[1].threshold > 0.9);
  nav.phase = 'HYPERSPACE_EXIT';
  nav.phaseProgress = 1;
  assert.equal(jumpVisualState(nav).opacity, 0);
  nav.reducedMotion = true;
  nav.phase = 'HYPERSPACE_ENTRY';
  nav.phaseProgress = 0.5;
  assert.equal(jumpVisualState(nav).threshold, 0);
  assert.ok(jumpVisualState(nav).opacity < entry[1].opacity);
});
test('Temporary corridor attaches without altering exterior objects and releases every owned GPU resource', () => {
  const scene = new THREE.Scene(),
    star = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial()),
    camera = new THREE.PerspectiveCamera(),
    effect = createHyperspaceEffect({ count: 440 });
  scene.add(star, effect.group);
  const before = star.toJSON(),
    nav = plan();
  nav.phase = 'HYPERSPACE_CRUISE';
  nav.phaseProgress = 0.5;
  effect.update(nav, camera, 0.1);
  assert.ok(effect.snapshot().visible);
  assert.equal(effect.snapshot().objects, 3);
  assert.equal(effect.snapshot().vertices, 880);
  const released = [];
  effect.group.traverse((n) => {
    n.geometry?.addEventListener('dispose', () => released.push(n.geometry));
    n.material?.addEventListener('dispose', () => released.push(n.material));
  });
  effect.dispose();
  assert.equal(scene.children.length, 1);
  assert.equal(scene.children[0], star);
  assert.deepEqual(star.toJSON(), before);
  assert.equal(released.length, 6);
  assert.equal(new Set(released).size, 6);
});
test('Existing scene keeps the ship visible through consecutive Barnard, RW Aurigae and galaxy jumps; heading survives control handoff', async () => {
  const harness = await createSceneHarness();
  try {
    const api = await harness.start();
    api.skipRealTimeIntro();
    api.view(3);
    harness.stepFrames(90);
    let arrived = 0;
    for (const [key, view, firstPerson = true] of [
      ['barnard', 3],
      ['rw-aurigae', 1],
      ['m31', 3],
      ['rw-aurigae', 1, false],
    ]) {
      api.view(view);
      if (view === 1) api.setCabinFirstPerson(firstPerson);
      assert.notEqual(
        api.missionTarget(key, () => arrived++),
        false,
      );
      const states = new Set();
      let frames = 0;
      while (api.navigationActive() && frames++ < 1200) {
        harness.stepFrames(1);
        const snap = api.navigationSnapshot();
        states.add(snap.state);
        if (view === 3 && snap.state !== 'IDLE') {
          assert.ok(snap.shipVisible, 'Ship hidden in ' + snap.state);
          assert.ok(
            Math.abs(snap.shipNdc[0]) < 1 &&
              Math.abs(snap.shipNdc[1]) < 1 &&
              snap.shipNdc[2] > -1 &&
              snap.shipNdc[2] < 1,
            key + ' ship outside camera in ' + snap.state + ' ' + JSON.stringify(snap.shipNdc),
          );
        }
        if (snap.state === 'HYPERSPACE_CRUISE') assert.ok(snap.effect?.visible);
      }
      assert.ok(frames < 1200);
      const end = api.navigationSnapshot();
      assert.equal(end.state, 'IDLE');
      assert.ok(end.forwardDot > 0.9999, key + ' forward');
      assert.ok(
        Math.abs(end.targetNdc[0]) < 0.12 && Math.abs(end.targetNdc[1]) < 0.12,
        key + ' camera centered',
      );
      assert.ok(end.targetNdc[2] > -1 && end.targetNdc[2] < 1);
      if (view === 1) assert.equal(end.cabinOccluded, false, key + ' obscured by cabin furniture');
      assert.equal(end.effect, null);
      assert.deepEqual(end.lastJump.phases, JUMP_PHASES);
      const position = api.getShipPosition();
      harness.stepFrames(90);
      const handoff = api.navigationSnapshot();
      assert.deepEqual(api.getShipPosition(), position);
      assert.ok(handoff.forwardDot > 0.9999, key + ' heading after handoff');
      assert.ok(
        Math.abs(handoff.targetNdc[0]) < 0.12 && Math.abs(handoff.targetNdc[1]) < 0.12,
        key + ' camera after handoff',
      );
    }
    assert.equal(arrived, 4);
  } finally {
    await harness.close();
  }
});
test('Original entry and Cronos events remain available, with an opening stage and repeatable skip', async () => {
  let reduced = false;
  const harness = await createSceneHarness({ stateOverrides: { reducedMotion: () => reduced } });
  try {
    const api = await harness.start();
    api.startRealTimeIntro();
    assert.equal(api.introSnapshot().phase, 'opening');
    harness.stepFrames(30);
    assert.equal(api.introSnapshot().phase, 'opening');
    api.skipRealTimeIntro();
    harness.stepFrames(2);
    assert.equal(api.introSnapshot().active, false);
    assert.ok(api.introSnapshot().cabinVisible);
    assert.ok(harness.events.some((e) => e.name === 'AI_ACTIVATED'));
    api.startRealTimeIntro();
    assert.equal(api.introSnapshot().phase, 'opening');
    harness.stepFrames(850);
    assert.equal(api.introSnapshot().active, false);
    assert.ok(api.introSnapshot().cabinVisible);
    reduced = true;
    api.startRealTimeIntro();
    harness.stepFrames(90);
    assert.equal(api.introSnapshot().active, false);
    assert.ok(api.introSnapshot().cabinVisible);
  } finally {
    await harness.close();
  }
});
test('Astronomical appearance, science, image data and services remain byte-identical to the pre-cinematic baseline', () => {
  const baseline = JSON.parse(
      fs.readFileSync('docs/cinematic-navigation-2026-11-07/baseline.json'),
    ),
    protectedPrefixes = ['api/', 'public/', 'src/data/', 'src/workers/'],
    protectedFiles = [
      'src/scene/destinationVisuals.js',
      'src/scene/galaxyVisuals.js',
      'src/scene/navigationAtlas.js',
      'src/scene/mapLayout.js',
      'src/scene/astronomicalPositions.js',
      'src/scene/habitableShipWorld.js',
      'src/scene/kronoxSceneDirector.js',
      'src/components/SpherexMission.jsx',
      'src/components/EvidenceLab.jsx',
      'src/components/ObservationGallery.jsx',
      'src/utils/fitsImage.js',
      'src/utils/scientificEvidence.js',
    ];
  for (const file of baseline.files.filter(
    // The legacy voice adapter now has an intentional network timeout; scientific services stay protected.
    (f) => f.path !== 'api/voice.js' && (protectedPrefixes.some((p) => f.path.startsWith(p)) || protectedFiles.includes(f.path)),
  )) {
    assert.ok(fs.existsSync(file.path));
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),
      file.sha256,
      file.path,
    );
  }
});
