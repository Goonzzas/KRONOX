import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';
import { SHIP_INTERIOR_STATIONS } from '../src/scene/kronoxInteriorSpatialModel.js';
import { buildKronoxInterior120M } from '../src/scene/kronoxInterior120M.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Station definition for missions separates approach pad from podium consolePos (+Z)', () => {
  const missions = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'missions');
  assert.ok(missions);
  assert.ok(missions.consolePos.z > missions.position.z, 'missions consolePos must sit aft (+Z) of standing approach');
  assert.ok(missions.maxInteractDistance >= 3.2);
});

test('KronoxInterior120M builds visible 3D path ribbon, chevron arrows, and waypoint marker', () => {
  const interior = buildKronoxInterior120M();
  try {
    const pts = [
      { x: 0, y: 3.4, z: -9.2 },
      { x: 3.35, y: 3.4, z: -4.4 },
      { x: 3.35, y: 3.4, z: 2.3 },
      { x: 0, y: 3.4, z: 4.35 },
    ];
    interior.setTutorialPath({ visible: true, points: pts, colorHex: 0x38bdf8 });
    interior.setTutorialWaypoint({ visible: true, position: { x: 0, y: 3.42, z: 4.35 }, colorHex: 0x38bdf8 });

    const pathGroup = interior.root.getObjectByName('KronoxTutorialPath3D');
    const wpGroup = interior.root.getObjectByName('KronoxTutorialWaypoint3D');
    assert.ok(pathGroup, 'KronoxTutorialPath3D group should exist');
    assert.equal(pathGroup.visible, true);
    assert.ok(pathGroup.children.length >= 10, 'Path should include ribbon, tube, and directional chevron arrows');
    assert.ok(wpGroup && wpGroup.visible === true, 'KronoxTutorialWaypoint3D beacon should be visible');

    // Step animation update cleanly
    interior.updateStations(1.5, null, null, 'missions', false, { x: 0, y: 3.4, z: -9.2 }, 0, {});

    interior.setTutorialPath({ visible: false });
    assert.equal(pathGroup.visible, false);
    assert.equal(pathGroup.children.length, 0);
  } finally {
    interior.dispose();
  }
});

test('Novice mode Barnard arrival enables player control, projects Mission Command HUD arrow, and clears guidance when opened', async () => {
  let latestGuide = null;
  let latestObjective = '';
  let latestWaypoint = null;
  let selectorOpened = false;

  const harness = await createSceneHarness({
    stateOverrides: {
      onGuideStateChange: (st) => {
        latestGuide = st;
      },
      onGuideObjective: (txt) => {
        latestObjective = txt;
      },
      onMissionWaypointHud: (wp) => {
        latestWaypoint = wp;
      },
      onGuidedMissionSelectorOpen: () => {
        selectorOpened = true;
      },
    },
  });

  try {
    const api = await harness.start();
    api.skipRealTimeIntro();
    api.startGuidedTour('novice-cinematic');
    harness.stepFrames(5);

    // Simulate Barnard arrival in novice-cinematic mode
    api.onGuidedDestinationArrival({ key: 'barnard', name: 'Estrella de Barnard' });
    harness.stepFrames(25);

    assert.equal(latestGuide?.step, 'novice-mission-console');
    assert.equal(latestGuide?.stationId, 'missions');
    assert.equal(latestGuide?.cinematic, false, 'Player should have free movement/look control immediately at Barnard');
    assert.match(latestObjective, /BARNARD|flechas|SPHEREx/i);
    assert.ok(latestWaypoint?.visible, 'On-screen directional waypoint HUD should be active');
    assert.ok(latestWaypoint.distanceMeters > 8, 'Should report real distance from bridge bow to missions podium');

    // Trigger optional auto-walk and verify astronaut faces +Z toward missions podium (not 180 deg backwards)
    assert.equal(api.walkNoviceToMissionConsole(), true);
    let safety = 0;
    while (api.getDeckTransitState()?.active && safety++ < 900) {
      harness.stepFrames(1);
    }
    assert.ok(safety < 900, 'Walk to mission console should complete promptly');
    harness.stepFrames(10);

    assert.equal(latestGuide?.step, 'novice-mission-console');
    assert.ok(latestWaypoint?.visible && latestWaypoint.nearReady, 'Waypoint HUD must stay active and show ready state right in front of console');

    // Activate nearest station ([E] / click) and verify mission selector opens and guidance cleans up
    assert.equal(api.activateNearestStation(), true);
    harness.stepFrames(5);
    assert.equal(selectorOpened, true, 'Activating missions station must open SpherexMissionSelector');
    assert.equal(latestGuide?.step, 'novice-select-mission');
    assert.equal(latestWaypoint, null, 'Waypoint HUD must hide once Mission Command is opened');

    // Selecting Barnard, arriving, starting mission, and completing novice guide unlocks free ship exploration
    api.onGuidedDestinationSelected({ key: 'barnard', name: 'Estrella de Barnard' });
    api.onGuidedDestinationArrival({ key: 'barnard', name: 'Estrella de Barnard' });
    harness.stepFrames(5);
    assert.equal(latestGuide?.step, 'mission_start');
    assert.match(latestObjective, /BARNARD|Estrella de Barnard/i);

    api.endGuidedCabinTour();
    harness.stepFrames(3);
    assert.equal(latestGuide?.step, 'free');
  } finally {
    await harness.close();
  }
});

test('Legacy galaxies/epochs/stars visualizer is completely removed and Extantword SphereX views + Barnard + transparent subtitles are wired', async () => {
  for (const removed of [
    'src/components/SpherexMission.jsx',
    'src/components/EvidenceLab.jsx',
    'src/components/ObservationGallery.jsx',
    'src/components/SpectrumPlot.jsx',
    'src/styles/observatory.css',
    'src/styles/evidenceLab.css',
  ]) {
    let exists = true;
    try {
      await fs.access(path.join(ROOT, removed));
    } catch {
      exists = false;
    }
    assert.equal(exists, false, `${removed} must be deleted`);
  }

  const appSrc = await fs.readFile(path.join(ROOT, 'src', 'App.jsx'), 'utf8');
  assert.equal(/SpherexMission\.jsx|EvidenceLab|ObservationGallery|SpectrumPlot/.test(appSrc), false);
  assert.match(appSrc, /noviceCabinMissionsOpen/);

  const explorerSrc = await fs.readFile(path.join(ROOT, 'src', 'components', 'SphereXAdvancedExplorer.jsx'), 'utf8');
  assert.match(explorerSrc, /static\/index\.html\?raw/);
  assert.match(explorerSrc, /static\/app\.js\?raw/);
  assert.match(explorerSrc, /import\.meta\.env\.BASE_URL/);
  assert.match(explorerSrc, /1 · ESTRELLA DE BARNARD EN SPHEREx/);
  assert.equal(/<iframe\b/i.test(explorerSrc), false);

  await fs.access(path.join(ROOT, 'public', 'spherex-viz', 'umap3d.html'));
  await fs.access(path.join(ROOT, 'SphereX-Visualizations-main', 'static', 'index.html'));

  const stylesCss = await fs.readFile(path.join(ROOT, 'src', 'styles.css'), 'utf8');
  assert.match(stylesCss, /\.kronoxFilmSubtitleText\s*\{[\s\S]*?background:\s*transparent/);

  const cinCss = await fs.readFile(path.join(ROOT, 'src', 'styles', 'cinematicNavigation.css'), 'utf8');
  assert.match(cinCss, /\.kronoxFloatingTutorialCard\s*\{[\s\S]*?left:\s*16px/);
});
