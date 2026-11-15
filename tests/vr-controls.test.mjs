import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';
import {
  DEFAULT_VR_SETTINGS,
  VR_CONTROL_BINDINGS,
  normalizeVrSettings,
  applyAxisDeadzone,
  readGamepadThumbstick,
  createVrInputStateTracker,
  getVrAvailabilitySync,
  probeVrAvailability,
} from '../src/scene/vrControls.js';

test('vrControls pure helpers normalize settings, deadzones, and decode xr-standard gamepads', () => {
  const normalized = normalizeVrSettings({
    turnMode: 'smooth',
    snapAngleDeg: 45,
    smoothTurnSpeed: 9,
    moveSpeedScale: 0.2,
    deadzone: 0.9,
    showControllerRays: false,
  });
  assert.equal(normalized.turnMode, 'smooth');
  assert.equal(normalized.snapAngleDeg, 45);
  assert.equal(normalized.smoothTurnSpeed, 3.5);
  assert.equal(normalized.moveSpeedScale, 0.6);
  assert.equal(normalized.deadzone, 0.32);
  assert.equal(normalized.showControllerRays, false);
  assert.equal(VR_CONTROL_BINDINGS.length >= 8, true);

  assert.equal(applyAxisDeadzone(0.1, 0.16), 0);
  assert.equal(applyAxisDeadzone(-0.15, 0.16), 0);
  const rescaled = applyAxisDeadzone(0.58, 0.16);
  assert.ok(Math.abs(rescaled - 0.5) < 1e-6, `Expected 0.5 rescaled deadzone, got ${rescaled}`);

  assert.deepEqual(readGamepadThumbstick({ axes: [0.1, -0.2, 0.75, -0.5] }), { x: 0.75, y: -0.5 });
  assert.deepEqual(readGamepadThumbstick({ axes: [-0.4, 0.6] }), { x: -0.4, y: 0.6 });

  const tracker = createVrInputStateTracker({
    turnMode: 'snap',
    snapAngleDeg: 30,
    moveSpeedScale: 1.0,
    deadzone: 0.16,
  });

  // Frame 1: left stick forward (y < 0) + right stick snap turn right (x > 0.6) + trigger down
  const f1 = tracker.stepFrame({
    dt: 0.016,
    leftGamepad: {
      axes: [0, 0, 0.58, -1],
      buttons: [{ pressed: false }, { pressed: false }, { pressed: false }, { pressed: true }],
    },
    rightGamepad: {
      axes: [0, 0, 0.9, 0],
      buttons: [{ pressed: true }, { pressed: true }, { pressed: false }, { pressed: false }, { pressed: true }],
    },
  });
  assert.ok(f1.moveFwd > 0.95);
  assert.ok(Math.abs(f1.moveStrafe - 0.5) < 0.02);
  assert.equal(f1.boostHeld, true);
  assert.equal(f1.stabilizeHeld, true);
  assert.ok(Math.abs(f1.turnYawDeltaRad + (Math.PI / 6)) < 1e-4, 'Snap turn right triggers -30 deg');
  assert.equal(f1.actions.interact, true);
  assert.equal(f1.actions.grabRail, true);
  assert.equal(f1.actions.toggleView, true);

  // Frame 2: holding buttons must NOT re-trigger edge actions or second snap within cooldown
  const f2 = tracker.stepFrame({
    dt: 0.016,
    leftGamepad: {
      axes: [0, 0, 0, 0],
      buttons: [{ pressed: false }, { pressed: false }],
    },
    rightGamepad: {
      axes: [0, 0, 0.9, 0],
      buttons: [{ pressed: true }, { pressed: true }, { pressed: false }, { pressed: false }, { pressed: true }],
    },
  });
  assert.equal(f2.turnYawDeltaRad, 0);
  assert.equal(f2.actions.interact, false);
  assert.equal(f2.actions.toggleView, false);

  // Center stick -> re-arms snap turn
  tracker.stepFrame({
    dt: 0.016,
    rightGamepad: { axes: [0, 0, 0.05, 0], buttons: [] },
  });
  const f4 = tracker.stepFrame({
    dt: 0.016,
    rightGamepad: { axes: [0, 0, -0.9, 0], buttons: [] },
  });
  assert.ok(Math.abs(f4.turnYawDeltaRad - (Math.PI / 6)) < 1e-4, 'Snap turn left triggers +30 deg after re-arm');

  // Switch to smooth turn mode
  tracker.setSettings({ ...DEFAULT_VR_SETTINGS, turnMode: 'smooth', smoothTurnSpeed: 2.0 });
  const fSmooth = tracker.stepFrame({
    dt: 0.05,
    rightGamepad: { axes: [0, 0, 1.0, 0], buttons: [] },
  });
  assert.ok(Math.abs(fSmooth.turnYawDeltaRad + 0.1) < 1e-4);
});

test('vrControls detects WebXR availability across browser environments', async () => {
  const insecure = getVrAvailabilitySync({
    navigatorObj: { xr: {} },
    windowObj: { isSecureContext: false },
  });
  assert.equal(insecure.supported, false);
  assert.equal(insecure.reason, 'insecure-context');

  const noXr = getVrAvailabilitySync({
    navigatorObj: {},
    windowObj: { isSecureContext: true },
  });
  assert.equal(noXr.supported, false);
  assert.equal(noXr.reason, 'no-webxr');

  const supported = await probeVrAvailability({
    navigatorObj: { xr: { isSessionSupported: async (mode) => mode === 'immersive-vr' } },
    windowObj: { isSecureContext: true },
  });
  assert.equal(supported.supported, true);
  assert.equal(supported.reason, 'supported');
});

test('VR HUD buttons, PauseMenu VR settings, and createScene WebXR controller loop integrate cleanly', async () => {
  const instanceText = (node) => {
    if (node == null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node.children)) return node.children.map(instanceText).join(' ');
    return '';
  };
  const viewEvents = [];
  const harness = await createSceneHarness({
    stateOverrides: {
      onViewChange: (v) => viewEvents.push(v),
    },
  });
  try {
    const { default: SpaceshipCockpit } = await harness.server.ssrLoadModule(
      '/src/components/SpaceshipCockpit.jsx',
    );
    const { default: PauseMenu } = await harness.server.ssrLoadModule(
      '/src/components/PauseMenu.jsx',
    );

    // 1. HUD VR buttons in SpaceshipCockpit
    let vrToggled = 0;
    let vrRecentered = 0;
    let cockpit;
    await act(async () => {
      cockpit = TestRenderer.create(
        React.createElement(SpaceshipCockpit, {
          freeRoam: true,
          viewMode: 'cockpit',
          cabinFirstPerson: true,
          vrState: { supported: true, presenting: false, connectedHands: 0 },
          onToggleVr: () => { vrToggled += 1; },
          onRecenterVr: () => { vrRecentered += 1; },
        }),
      );
    });
    const enterVrBtn = cockpit.root
      .findAllByType('button')
      .find((b) => instanceText(b).includes('Entrar VR'));
    assert.ok(enterVrBtn, 'SpaceshipCockpit renders Entrar VR button when supported');
    await act(async () => {
      enterVrBtn.props.onClick();
    });
    assert.equal(vrToggled, 1);

    await act(async () => {
      cockpit.update(
        React.createElement(SpaceshipCockpit, {
          freeRoam: true,
          viewMode: 'cockpit',
          cabinFirstPerson: true,
          vrState: { supported: true, presenting: true, connectedHands: 2 },
          onToggleVr: () => { vrToggled += 1; },
          onRecenterVr: () => { vrRecentered += 1; },
        }),
      );
    });
    const recenterBtn = cockpit.root
      .findAllByType('button')
      .find((b) => instanceText(b).includes('Centrar'));
    assert.ok(recenterBtn, 'SpaceshipCockpit shows Centrar HMD button while VR session presents');
    await act(async () => {
      recenterBtn.props.onClick();
    });
    assert.equal(vrRecentered, 1);
    cockpit.unmount();

    // 2. PauseMenu VR settings (Ajustes -> Controles) + Controles manual card
    let updatedGameSettings = null;
    let pauseMenu;
    await act(async () => {
      pauseMenu = TestRenderer.create(
        React.createElement(PauseMenu, {
          open: true,
          initialSection: 'settings',
          gameSettings: { vr: { ...DEFAULT_VR_SETTINGS } },
          onUpdateGameSettings: (next) => { updatedGameSettings = next; },
          vrState: { supported: true, presenting: false, connectedHands: 0 },
          onToggleVr: () => { vrToggled += 1; },
          onRecenterVr: () => { vrRecentered += 1; },
        }),
      );
    });
    const controlsSettingsTab = pauseMenu.root
      .findAllByType('button')
      .find((b) => instanceText(b).trim() === 'Controles');
    assert.ok(controlsSettingsTab);
    await act(async () => {
      controlsSettingsTab.props.onClick();
    });
    const smoothBtn = pauseMenu.root
      .findAllByType('button')
      .find((b) => instanceText(b).includes('Suave continuo'));
    assert.ok(smoothBtn, 'PauseMenu Controles tab displays VR turn mode selector');
    await act(async () => {
      smoothBtn.props.onClick();
    });
    assert.equal(updatedGameSettings?.vr?.turnMode, 'smooth');

    const manualNavBtn = pauseMenu.root
      .findAllByType('button')
      .find((b) => instanceText(b).includes('7. Controles'));
    assert.ok(manualNavBtn);
    await act(async () => {
      manualNavBtn.props.onClick();
    });
    const manualJson = JSON.stringify(pauseMenu.toJSON());
    assert.ok(manualJson.includes('Mandos VR (WebXR 6DoF)'), 'PauseMenu manual includes VR controller guide');
    assert.ok(manualJson.includes('Stick izquierdo'));
    pauseMenu.unmount();

    // 3. createScene integration with VR controller input (Cabina 1P -> snap turn -> telescope -> Exterior)
    const api = await harness.start();
    api.skipRealTimeIntro();
    api.view(1);
    harness.stepFrames(5);

    const vrInit = api.getVrState();
    assert.equal(vrInit.presenting, false);
    api.setVrSettings({ turnMode: 'snap', snapAngleDeg: 45, moveSpeedScale: 1.25 });
    assert.equal(api.getVrState().settings.snapAngleDeg, 45);

    // Move astronaut forward with left thumbstick in Cabina 1P
    const astroBeforeMove = api.getAstronautPosition();
    api.applyVrControllerInput({ leftAxes: [0, 0, 0, -0.95] });
    harness.stepFrames(12);
    api.applyVrControllerInput(null);
    harness.stepFrames(2);
    const astroAfterMove = api.getAstronautPosition();
    const movedDist = Math.hypot(
      astroAfterMove.x - astroBeforeMove.x,
      astroAfterMove.z - astroBeforeMove.z,
    );
    assert.ok(movedDist > 0.05, `Expected VR left thumbstick to move astronaut in Cabina 1P (dist=${movedDist})`);

    // Right thumbstick snap turn (45 deg)
    const yawBeforeSnap = astroAfterMove.yaw;
    api.applyVrControllerInput({ rightAxes: [0, 0, 0.9, 0] });
    harness.stepFrames(3);
    api.applyVrControllerInput(null);
    harness.stepFrames(2);
    const yawAfterSnap = api.getAstronautPosition().yaw;
    assert.ok(
      Math.abs((yawAfterSnap - yawBeforeSnap) + Math.PI / 4) < 0.05,
      `Expected ~ -45 deg snap turn (${yawBeforeSnap} -> ${yawAfterSnap})`,
    );

    // VR toggleTelescope (Y / oneShot)
    api.applyVrControllerInput({ toggleTelescope: true, oneShot: true });
    harness.stepFrames(2);
    assert.equal(api.getObservationMode().opticalMagnification, 50);
    api.applyVrControllerInput({ toggleTelescope: true, oneShot: true });
    harness.stepFrames(2);
    assert.equal(api.getObservationMode().opticalMagnification, 1);

    // VR toggleView (A/X) switches Cabina 1P -> Exterior 3P and back cleanly
    api.applyVrControllerInput({ toggleView: true, oneShot: true });
    harness.stepFrames(3);
    assert.equal(api.navigationSnapshot().view, 3, 'VR A/X toggle switches from Cabina 1P to Exterior view');
    assert.ok(viewEvents.includes(3), 'onViewChange callback notified of Exterior view');

    api.setFreeHelmMode(true);
    const shipBeforeMove = api.getShipPosition();
    api.applyVrControllerInput({ leftAxes: [0, 0, 0, -1], boost: true });
    harness.stepFrames(10);
    api.applyVrControllerInput(null);
    const shipAfterMove = api.getShipPosition();
    const shipMoved = Math.hypot(
      shipAfterMove[0] - shipBeforeMove[0],
      shipAfterMove[1] - shipBeforeMove[1],
      shipAfterMove[2] - shipBeforeMove[2],
    );
    assert.ok(shipMoved > 0, 'VR left thumbstick drives ship thrust in Free Helm mode');

    const recenterRes = api.recenterVr();
    assert.ok(Array.isArray(recenterRes.offset));
  } finally {
    await harness.close();
  }
});
