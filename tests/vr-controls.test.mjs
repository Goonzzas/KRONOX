import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as THREE from 'three';
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
  createWebXrManager,
} from '../src/scene/vrControls.js';

test('vrControls pure helpers normalize settings, deadzones, and decode xr-standard gamepads', () => {
  assert.equal(DEFAULT_VR_SETTINGS.turnMode, 'smooth');
  assert.equal(normalizeVrSettings({}).turnMode, 'smooth');
  const normalized = normalizeVrSettings({
    turnMode: 'snap',
    snapAngleDeg: 45,
    smoothTurnSpeed: 9,
    moveSpeedScale: 0.2,
    deadzone: 0.9,
    showControllerRays: false,
  });
  assert.equal(normalized.turnMode, 'snap');
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
  // Alternate OpenXR profile where thumbstick is on axes [0, 1] and [2, 3] remain idle
  assert.deepEqual(readGamepadThumbstick({ axes: [0.85, -0.4, 0, 0] }), { x: 0.85, y: -0.4 });

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
    rightGamepad: { axes: [0, 0, -0.5, 0], buttons: [] },
  });
  assert.ok(Math.abs(f4.turnYawDeltaRad - (Math.PI / 6)) < 1e-4, 'Snap turn left triggers +30 deg at moderate stick tilt');

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
    const snapBtn = pauseMenu.root
      .findAllByType('button')
      .find((b) => instanceText(b).includes('Por pasos'));
    assert.ok(snapBtn, 'PauseMenu Controles tab displays VR snap turn mode button');
    await act(async () => {
      snapBtn.props.onClick();
    });
    assert.equal(updatedGameSettings?.vr?.turnMode, 'snap');
    const smoothBtn = pauseMenu.root
      .findAllByType('button')
      .find((b) => instanceText(b).includes('Suave continuo'));
    assert.ok(smoothBtn, 'PauseMenu Controles tab displays VR smooth turn mode button');
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

    // Right thumbstick in Exterior (non-free-helm) rotates camera orbit smoothly
    assert.equal(api.navigationSnapshot().view, 3);
    assert.equal(api.isFreeHelmActive(), false);
    api.setVrSettings({ turnMode: 'smooth', smoothTurnSpeed: 2.0 });
    const camBeforeOrbit = api.navigationSnapshot().localCameraPosition;
    api.applyVrControllerInput({ rightAxes: [0, 0, 0.95, 0] });
    harness.stepFrames(8);
    api.applyVrControllerInput(null);
    const camAfterOrbit = api.navigationSnapshot().localCameraPosition;
    const orbitDelta = Math.hypot(
      camAfterOrbit[0] - camBeforeOrbit[0],
      camAfterOrbit[2] - camBeforeOrbit[2],
    );
    assert.ok(orbitDelta > 5, `Expected VR right thumbstick to orbit Exterior camera (delta=${orbitDelta})`);

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

test('createWebXrManager auto-calibrates seated/standing HMD eye height and filters gaze sources on right stick', async () => {
  const prevDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const dummyRefSpace = { id: 'local-floor-ref' };
  const fakeSession = {
    inputSources: [
      // Gaze source without handedness must NOT steal the right controller slot
      { targetRayMode: 'gaze', handedness: 'none', gamepad: { axes: [], buttons: [] } },
      { targetRayMode: 'tracked-pointer', handedness: 'left', gamepad: { axes: [0, 0, 0, -0.5], buttons: [] } },
      // OpenXR/Link right controller reporting thumbstick on axes [0, 1]
      { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: { axes: [0.88, 0, 0, 0], buttons: [] } },
    ],
    addEventListener() {},
    async end() {},
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      xr: {
        isSessionSupported: async (mode) => mode === 'immersive-vr',
        requestSession: async () => fakeSession,
      },
    },
  });
  try {
    const sceneAstro = new THREE.Scene();
    const sceneLocal = new THREE.Scene();
    const camAstro = new THREE.PerspectiveCamera();
    const camLocal = new THREE.PerspectiveCamera();
    const fakeRenderer = {
      xr: {
        enabled: false,
        setReferenceSpaceType() {},
        getReferenceSpace: () => dummyRefSpace,
        async setSession() {},
        getCamera: () => camLocal,
      },
      render() {},
    };
    const xrManager = createWebXrManager({
      renderer: fakeRenderer,
      sceneAstro,
      sceneLocal,
      camAstro,
      camLocal,
    });
    const enterRes = await xrManager.enterVr();
    assert.equal(enterRes.ok, true);

    // Simulate seated user (HMD y = 0.98m, offset laterally in guardian)
    const seatedFrame = {
      getViewerPose: (ref) =>
        ref === dummyRefSpace
          ? {
              transform: {
                position: { x: 0.25, y: 0.98, z: -0.15 },
                orientation: { x: 0, y: 0, z: 0, w: 1 },
              },
            }
          : null,
    };
    const polled = xrManager.pollInput({ dt: 0.016, xrFrame: seatedFrame });
    assert.ok(polled, 'pollInput returns frame in XR');
    assert.ok(polled.turnYawDeltaRad < -0.01, `Expected right stick rotation despite leading gaze source, got ${polled.turnYawDeltaRad}`);

    const cabinEye = new THREE.Vector3(0, 5.05, -10.4);
    const cabinYaw = new THREE.Quaternion();
    xrManager.syncRigsBeforeRender({
      astroCamPos: new THREE.Vector3(),
      astroCamQuat: new THREE.Quaternion(),
      localEyePos: cabinEye,
      localYawQuat: cabinYaw,
      inCabin: true,
      xrFrame: seatedFrame,
    });
    // Rig position + HMD height (0.98m) should land directly at exact cabinEye.y (5.05m)
    const renderedEyeY = xrManager.vrLocalRig.position.y + 0.98;
    assert.ok(Math.abs(renderedEyeY - 5.05) < 1e-4, `Expected rendered eye height 5.05m, got ${renderedEyeY}`);

    // Now test user standing up to 1.72m and calling recenterVr(standingFrame)
    const standingFrame = {
      getViewerPose: () => ({
        transform: {
          position: { x: 0, y: 1.72, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
      }),
    };
    const rec = xrManager.recenterVr(standingFrame);
    assert.ok(Math.abs(rec.offset[1] - 1.72) < 1e-4);
    xrManager.syncRigsBeforeRender({
      astroCamPos: new THREE.Vector3(),
      astroCamQuat: new THREE.Quaternion(),
      localEyePos: cabinEye,
      localYawQuat: cabinYaw,
      inCabin: true,
      xrFrame: standingFrame,
    });
    assert.ok(Math.abs((xrManager.vrLocalRig.position.y + 1.72) - 5.05) < 1e-4);
  } finally {
    if (prevDesc) Object.defineProperty(globalThis, 'navigator', prevDesc);
    else delete globalThis.navigator;
  }
});

test('vrControls controller raycasting skips hidden deck trees, prioritizes VR panel buttons, and supports left-trigger ray click', async () => {
  const prevDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const dummyRefSpace = { id: 'local-floor-ref' };
  const ctrl0 = new THREE.Group();
  const ctrl1 = new THREE.Group();
  const grip0 = new THREE.Group();
  const grip1 = new THREE.Group();
  const leftGamepad = { axes: [0, 0, 0, 0], buttons: [{ pressed: false }] };
  const rightGamepad = { axes: [0, 0, 0, 0], buttons: [{ pressed: false }] };

  const fakeSession = {
    inputSources: [
      { targetRayMode: 'tracked-pointer', handedness: 'left', gamepad: leftGamepad },
      { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: rightGamepad },
    ],
    addEventListener() {},
    async end() {},
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      xr: {
        isSessionSupported: async (mode) => mode === 'immersive-vr',
        requestSession: async () => fakeSession,
      },
    },
  });

  try {
    const sceneAstro = new THREE.Scene();
    const sceneLocal = new THREE.Scene();
    const camAstro = new THREE.PerspectiveCamera();
    const camLocal = new THREE.PerspectiveCamera();
    const fakeRenderer = {
      xr: {
        enabled: false,
        setReferenceSpaceType() {},
        getReferenceSpace: () => dummyRefSpace,
        async setSession() {},
        getCamera: () => camLocal,
        getController: (idx) => (idx === 0 ? ctrl0 : ctrl1),
        getControllerGrip: (idx) => (idx === 0 ? grip0 : grip1),
      },
      render() {},
    };

    const hitsTriggered = [];
    const xrManager = createWebXrManager({
      renderer: fakeRenderer,
      sceneAstro,
      sceneLocal,
      camAstro,
      camLocal,
      onInteractHit: (stationId, rayHit) => hitsTriggered.push({ stationId, rayHit }),
    });

    const enterRes = await xrManager.enterVr();
    assert.equal(enterRes.ok, true);

    ctrl0.dispatchEvent({ type: 'connected', data: fakeSession.inputSources[0] });
    ctrl1.dispatchEvent({ type: 'connected', data: fakeSession.inputSources[1] });
    assert.equal(xrManager.getState().connectedHands, 2);

    const hiddenParent = new THREE.Group();
    hiddenParent.visible = false;
    const hiddenMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshBasicMaterial());
    hiddenMesh.position.set(0, 1.5, -1.2);
    hiddenMesh.userData.interactId = 'comms';
    hiddenParent.add(hiddenMesh);
    sceneLocal.add(hiddenParent);

    const visibleNavMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshBasicMaterial());
    visibleNavMesh.position.set(0, 1.5, -2.4);
    visibleNavMesh.userData.interactId = 'nav';
    visibleNavMesh.userData.actionLabel = 'Puente de mando';
    sceneLocal.add(visibleNavMesh);

    const priorityBtnMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial());
    priorityBtnMesh.position.set(0, 1.5, -1.8);
    priorityBtnMesh.userData.vrConsoleAction = 'travel-planet';
    priorityBtnMesh.userData.vrConsolePayload = { planetName: 'Marte' };
    priorityBtnMesh.userData.vrConsoleLabel = 'Viajar a Marte';
    sceneLocal.add(priorityBtnMesh);

    const frame = {
      getViewerPose: () => ({
        transform: {
          position: { x: 0, y: 1.65, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
      }),
    };

    ctrl0.position.set(2, 1.5, 0);
    ctrl0.rotation.set(0, Math.PI, 0);
    ctrl1.position.set(0, 1.5, 0);
    ctrl1.rotation.set(0, 0, 0);
    sceneLocal.updateMatrixWorld(true);
    ctrl0.updateMatrixWorld(true);
    ctrl1.updateMatrixWorld(true);

    // 1. Ancestor visibility culling: skips closer invisible group and hits visible nav mesh
    const passVisible = xrManager.pollInput({
      dt: 0.016,
      xrFrame: frame,
      interactableMeshes: [hiddenMesh, visibleNavMesh],
      priorityMeshes: [],
    });
    assert.equal(passVisible.rayHit?.stationId, 'nav');
    assert.equal(passVisible.rayHit?.controllerHand, 'right');

    // 2. Priority panel button overrides background console and fires on right trigger
    rightGamepad.buttons[0].pressed = true;
    const passBtn = xrManager.pollInput({
      dt: 0.016,
      xrFrame: frame,
      interactableMeshes: [hiddenMesh, visibleNavMesh],
      priorityMeshes: [priorityBtnMesh],
    });
    assert.equal(passBtn.rayHit?.vrAction, 'travel-planet');
    assert.equal(passBtn.rayHit?.vrPayload?.planetName, 'Marte');
    assert.equal(hitsTriggered.length, 1);
    assert.equal(hitsTriggered[0].rayHit?.vrAction, 'travel-planet');
    rightGamepad.buttons[0].pressed = false;

    // 3. Left controller ray aims at console: left trigger clicks console without triggering recenter
    const initialRecenterOffset = xrManager.recenterVr(frame).offset[1];
    assert.ok(Math.abs(initialRecenterOffset - 1.65) < 1e-4);
    ctrl1.rotation.set(0, Math.PI, 0);
    ctrl0.position.set(0, 1.5, 0);
    ctrl0.rotation.set(0, 0, 0);
    ctrl0.updateMatrixWorld(true);
    ctrl1.updateMatrixWorld(true);

    const standingLaterFrame = {
      getViewerPose: () => ({
        transform: {
          position: { x: 0, y: 1.92, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
      }),
    };
    leftGamepad.buttons[0].pressed = true;
    const leftClickPass = xrManager.pollInput({
      dt: 0.016,
      xrFrame: standingLaterFrame,
      interactableMeshes: [visibleNavMesh],
      priorityMeshes: [],
    });
    assert.equal(leftClickPass.rayHit?.stationId, 'nav');
    assert.equal(leftClickPass.rayHit?.controllerHand, 'left');
    assert.equal(hitsTriggered.length, 2);
    assert.equal(hitsTriggered[1].stationId, 'nav');
    // Recenter was NOT fired when clicking a targeted console (offset remains 1.65, so rig y = 5.05 - 1.65 = 3.40)
    const cabinEyePos = new THREE.Vector3(0, 5.05, -10.4);
    const cabinYawQuat = new THREE.Quaternion();
    xrManager.syncRigsBeforeRender({
      astroCamPos: new THREE.Vector3(),
      astroCamQuat: new THREE.Quaternion(),
      localEyePos: cabinEyePos,
      localYawQuat: cabinYawQuat,
      inCabin: true,
      xrFrame: standingLaterFrame,
    });
    assert.ok(Math.abs((xrManager.vrLocalRig.position.y + 1.92) - 5.32) < 1e-4);

    // 4. Release & aim into open space: left trigger performs normal HMD recenter
    leftGamepad.buttons[0].pressed = false;
    xrManager.pollInput({ dt: 0.016, xrFrame: standingLaterFrame, interactableMeshes: [visibleNavMesh] });
    ctrl0.rotation.set(0, Math.PI, 0);
    ctrl0.updateMatrixWorld(true);
    leftGamepad.buttons[0].pressed = true;
    const openSpacePass = xrManager.pollInput({
      dt: 0.016,
      xrFrame: standingLaterFrame,
      interactableMeshes: [visibleNavMesh],
    });
    assert.equal(openSpacePass.rayHit, null);
    xrManager.syncRigsBeforeRender({
      astroCamPos: new THREE.Vector3(),
      astroCamQuat: new THREE.Quaternion(),
      localEyePos: cabinEyePos,
      localYawQuat: cabinYawQuat,
      inCabin: true,
      xrFrame: standingLaterFrame,
    });
    assert.ok(Math.abs((xrManager.vrLocalRig.position.y + 1.92) - 5.05) < 1e-4);
  } finally {
    if (prevDesc) Object.defineProperty(globalThis, 'navigator', prevDesc);
    else delete globalThis.navigator;
  }
});

test('VR diegetic console screens and contextual 3D panels operate every C01-C04 station without floating idle HUD', async () => {
  const vrActions = [];
  const stationEvents = [];
  const freeHelmEvents = [];
  const harness = await createSceneHarness({
    stateOverrides: {
      onVrAction: (action, payload) => vrActions.push({ action, payload }),
      onStationInteract: (stationId) => stationEvents.push(stationId),
      onFreeHelmChange: (enabled) => freeHelmEvents.push(enabled),
    },
  });

  try {
    const api = await harness.start();
    api.skipRealTimeIntro();
    api.view(1);
    harness.stepFrames(4);

    const { buildKronoxInterior120M } = await harness.server.ssrLoadModule('/src/scene/kronoxInterior120M.js');
    const { createVrConsoleOverlay3D } = await harness.server.ssrLoadModule('/src/scene/vrConsoleOverlay3D.js');

    // 1. Verify interactive consoles across Decks C01-C03 are registered as raycastable meshes
    const interior = buildKronoxInterior120M();
    const deck01Ids = interior.getInteractMeshesForDeck('deck-01').map((m) => m.userData?.interactId);
    const deck02Ids = interior.getInteractMeshesForDeck('deck-02').map((m) => m.userData?.interactId);
    const deck03Ids = interior.getInteractMeshesForDeck('deck-03').map((m) => m.userData?.interactId);

    for (const id of ['nav', 'missions', 'comms', 'windows', 'elevator-call-deck-01-bow', 'elevator-floor-deck-01']) {
      assert.ok(deck01Ids.includes(id), `Expected C01 deck-01 interactable meshes to include ${id}`);
    }
    assert.ok(deck01Ids.filter((id) => id === 'windows').length >= 2, 'Expected C01 wing/wall displays registered');
    for (const id of ['comms', 'science', 'archive', 'engineering', 'nav', 'missions', 'elevator-call-deck-02-bow']) {
      assert.ok(deck02Ids.includes(id), `Expected C02 deck-02 interactable meshes to include ${id}`);
    }
    for (const id of ['engineering', 'science', 'sensor-calibration', 'elevator-call-deck-03-bow']) {
      assert.ok(deck03Ids.includes(id), `Expected C03 deck-03 interactable meshes to include ${id}`);
    }
    interior.dispose?.();

    // 2. Verify contextual vrConsoleOverlay3D stays hidden when exploring freely, shows tooltip on aim, and opens buttons per station
    const overlay = createVrConsoleOverlay3D();
    const eyePos = new THREE.Vector3(0, 5.05, -8.5);
    const baseCtx = {
      targetName: 'Estrella de Barnard',
      activeTargetKey: 'barnard',
      findingsCount: 2,
      lastKronoxReply: 'Listo para explorar.',
      voiceEnabled: true,
      visualProfile: 'cinematic',
      opticalMagnification: 1,
      speed: 0,
      flightMode: 'MANUAL',
      freeHelmMode: false,
      seated: false,
      repairStage: 0,
      currentDeckId: 'deck-01',
      mechanisms: { reactorMode: 'nominal' },
    };

    overlay.update({
      presenting: true,
      inCabin: true,
      activeStationId: null,
      eyePos,
      deckFloorY: 3.4,
      hoveredHit: null,
      context: baseCtx,
    });
    assert.equal(overlay.root.visible, false, 'No permanent floating HUD should appear during free exploration');
    assert.equal(overlay.getInteractiveButtonMeshes().length, 0);

    overlay.update({
      presenting: true,
      inCabin: true,
      activeStationId: null,
      eyePos,
      deckFloorY: 3.4,
      hoveredHit: { stationId: 'comms', actionLabel: 'KRONOX IA' },
      context: baseCtx,
    });
    assert.equal(overlay.root.visible, true, 'Aiming at a console should surface compact aim tooltip');
    assert.equal(overlay.getInteractiveButtonMeshes().length, 0, 'Hover tooltip should not spawn panel buttons');

    overlay.showDirectToast({ text: 'Ascensor en marcha hacia C03' });
    overlay.update({
      presenting: true,
      inCabin: true,
      activeStationId: null,
      eyePos,
      deckFloorY: 3.4,
      hoveredHit: null,
      context: baseCtx,
    });
    assert.equal(overlay.root.visible, true, 'Direct mechanisms should show brief 3D toast in VR');

    const getActions = () => overlay.getInteractiveButtonMeshes().map((m) => m.userData?.vrConsoleAction);
    const stationChecks = [
      { id: 'nav', expectAction: 'travel-planet' },
      { id: 'missions', expectAction: 'travel-spherex' },
      { id: 'comms', expectAction: 'kronox-query' },
      { id: 'windows', expectAction: 'set-telescope' },
      { id: 'science', expectAction: 'scientific-scan' },
      { id: 'archive', expectAction: 'scientific-scan' },
      { id: 'sensor-calibration', expectAction: 'repair-next-stage' },
      { id: 'engineering', expectAction: 'mech-engineering' },
      { id: 'elevator-panel', expectAction: 'elevator-floor' },
    ];
    for (const check of stationChecks) {
      overlay.update({
        presenting: true,
        inCabin: true,
        activeStationId: check.id,
        stationAnchorPos: new THREE.Vector3(0, 4.9, -11.4),
        eyePos,
        deckFloorY: 3.4,
        hoveredHit: null,
        context: baseCtx,
      });
      const actions = getActions();
      assert.ok(actions.includes(check.expectAction), `Expected VR console ${check.id} to expose action ${check.expectAction}`);
      assert.ok(actions.includes('close-console'), `Expected VR console ${check.id} to expose close button`);
    }

    overlay.setNavTab('spherex');
    overlay.update({
      presenting: true,
      inCabin: true,
      activeStationId: 'nav',
      stationAnchorPos: new THREE.Vector3(0, 4.9, -11.4),
      eyePos,
      deckFloorY: 3.4,
      hoveredHit: null,
      context: baseCtx,
    });
    assert.ok(getActions().includes('travel-spherex'));
    overlay.setNavTab('pilot');
    overlay.update({
      presenting: true,
      inCabin: true,
      activeStationId: 'nav',
      stationAnchorPos: new THREE.Vector3(0, 4.9, -11.4),
      eyePos,
      deckFloorY: 3.4,
      hoveredHit: null,
      context: baseCtx,
    });
    assert.ok(getActions().includes('toggle-free-helm'));
    overlay.dispose();

    // 3. Verify createScene handles real console proximity interaction, console actions, syncVrContext, and Button B close/stand-up
    assert.equal(api.getVrConsoleButtonMeshes().length, 0);
    if (api.isAstronautSeated()) api.standUpFromBridgeSeat();
    assert.equal(api.isAstronautSeated(), false);

    api.teleportAstronautToDeck('deck-03');
    api.setAstronautPosition({ x: 12.8, y: -3.4, z: 0.0 }, -Math.PI / 2, -0.06);
    harness.stepFrames(4);
    assert.equal(api.activateNearestStation(), true);
    assert.ok(stationEvents.includes('sensor-calibration'));
    assert.equal(api.getRepairMissionStage(), 1);
    api.handleVrConsoleAction('repair-next-stage');
    assert.equal(api.getRepairMissionStage(), 2);
    api.handleVrConsoleAction('repair-set-stage', { stage: 4 });
    assert.equal(api.getRepairMissionStage(), 4);
    api.handleVrConsoleAction('repair-reset');
    assert.equal(api.getRepairMissionStage(), 0);

    api.handleVrConsoleAction('mech-engineering', { mode: 'overclock' });
    assert.equal(api.getMechanismsState()?.reactorMode, 'overclock');

    api.handleVrConsoleAction('elevator-floor', { deckId: 'deck-03' });
    assert.equal(api.getElevatorState()?.targetDeckId, 'deck-03');

    api.teleportAstronautToDeck('deck-01');
    api.setAstronautPosition({ x: 0.0, y: 3.4, z: -9.3 }, 0, -0.06);
    harness.stepFrames(4);
    assert.equal(api.activateNearestStation(), true);
    assert.equal(stationEvents[stationEvents.length - 1], 'nav');
    api.handleVrConsoleAction('sit-command-seat');
    assert.equal(api.isAstronautSeated(), true);

    // Button B in Cabina 1P closes active console first, then second press stands up from command seat
    api.applyVrControllerInput({ toggleFreeHelm: true });
    harness.stepFrames(2);
    assert.equal(stationEvents[stationEvents.length - 1], null);
    api.applyVrControllerInput(null);
    harness.stepFrames(2);

    api.applyVrControllerInput({ toggleFreeHelm: true });
    harness.stepFrames(2);
    assert.equal(api.isAstronautSeated(), false);
    api.applyVrControllerInput(null);
    harness.stepFrames(2);

    // From nav panel, Timón libre enters Exterior Free Helm and Button B toggles it back off
    api.handleVrConsoleAction('toggle-free-helm');
    assert.equal(api.isFreeHelmActive(), true);
    assert.equal(freeHelmEvents[freeHelmEvents.length - 1], true);
    api.applyVrControllerInput({ toggleFreeHelm: true });
    harness.stepFrames(2);
    assert.equal(api.isFreeHelmActive(), false);
    api.applyVrControllerInput(null);
    harness.stepFrames(2);
    api.view(1);
    harness.stepFrames(2);

    api.handleVrConsoleAction('travel-planet', { planetName: 'Saturno' });
    api.handleVrConsoleAction('travel-spherex', { targetKey: 'barnard' });
    api.handleVrConsoleAction('kronox-query', { query: '¿Qué es SPHEREx?' });
    api.handleVrConsoleAction('start-tour');
    api.handleVrConsoleAction('scientific-scan', { targetKey: 'wise-0855' });
    const firedNames = vrActions.map((entry) => entry.action);
    assert.deepEqual(
      firedNames,
      ['travel-planet', 'travel-spherex', 'kronox-query', 'start-tour', 'scientific-scan'],
    );
    assert.equal(vrActions[0].payload?.planetName, 'Saturno');

    const ctxSnapshot = api.syncVrContext({
      findingsCount: 3,
      lastKronoxReply: 'Telemetría SPHEREx lista.',
      voiceEnabled: false,
    });
    assert.equal(ctxSnapshot.findingsCount, 3);
    assert.equal(ctxSnapshot.lastKronoxReply, 'Telemetría SPHEREx lista.');
    assert.equal(ctxSnapshot.voiceEnabled, false);
  } finally {
    await harness.close();
  }
});

test('VR prevents nav/rail/pause lockups, syncs IRL roomscale walking, and switches travel to exterior view', async () => {
  const prevNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const prevDocDesc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const pauseRequests = [];
  const pointerEscapeCount = { count: 0 };
  const viewChanges = [];
  const stationEvents = [];
  const harness = await createSceneHarness({
    stateOverrides: {
      onVrPauseRequest: (opts) => pauseRequests.push(opts || {}),
      onPointerLockEscape: () => { pointerEscapeCount.count += 1; },
      onViewChange: (v) => viewChanges.push(v),
      onStationInteract: (id) => stationEvents.push(id),
    },
  });

  try {
    // 1. Unit-verify syncRoomscaleAvatarStep sliding wall clamp and 1:1 floor sync
    const dummyRefSpace = { id: 'local-floor-stage' };
    let unitPose = { x: 0.1, y: 1.66, z: 0.2 };
    const unitSceneAstro = new THREE.Scene();
    const unitSceneLocal = new THREE.Scene();
    const unitCamAstro = new THREE.PerspectiveCamera();
    const unitCamLocal = new THREE.PerspectiveCamera();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        languages: ['es-CO'],
        language: 'es-CO',
        xr: {
          isSessionSupported: async (mode) => mode === 'immersive-vr',
          requestSession: async () => ({
            inputSources: [],
            addEventListener() {},
            async end() {},
          }),
        },
      },
    });
    const unitRenderer = {
      xr: {
        enabled: false,
        setReferenceSpaceType() {},
        getReferenceSpace: () => dummyRefSpace,
        async setSession() {},
        getCamera: () => unitCamLocal,
      },
      render() {},
    };
    const xrMgr = createWebXrManager({
      renderer: unitRenderer,
      sceneAstro: unitSceneAstro,
      sceneLocal: unitSceneLocal,
      camAstro: unitCamAstro,
      camLocal: unitCamLocal,
    });
    assert.equal((await xrMgr.enterVr()).ok, true);
    const makePoseFrame = (p) => ({
      getViewerPose: (ref) =>
        ref === dummyRefSpace
          ? {
              transform: {
                position: { x: p.x, y: p.y, z: p.z },
                orientation: { x: 0, y: 0, z: 0, w: 1 },
              },
            }
          : null,
    });
    // Calibrate baseline at (0.1, 1.66, 0.2)
    xrMgr.pollInput({ dt: 0.016, xrFrame: makePoseFrame(unitPose) });
    // Step IRL forward 0.45 m along -Z on open deck
    unitPose = { x: 0.1, y: 1.66, z: -0.25 };
    xrMgr.pollInput({ dt: 0.016, xrFrame: makePoseFrame(unitPose) });
    let avatarZ = -9.0;
    const step1 = xrMgr.syncRoomscaleAvatarStep(0, (dx, dz) => {
      avatarZ += dz;
      return { dx, dz };
    });
    assert.ok(Math.abs(step1.localDz + 0.45) < 1e-4, `Expected -0.45 m roomscale delta, got ${step1.localDz}`);
    assert.ok(Math.abs(avatarZ + 9.45) < 1e-4);
    assert.ok(Math.hypot(xrMgr.getViewerStageOffset().x, xrMgr.getViewerStageOffset().z) < 1e-4);

    // Next step tries to push through a wall at z=-9.6 (only 0.15 m allowed)
    unitPose = { x: 0.1, y: 1.66, z: -0.65 };
    xrMgr.pollInput({ dt: 0.016, xrFrame: makePoseFrame(unitPose) });
    xrMgr.syncRoomscaleAvatarStep(0, (dx, dz) => {
      const nextZ = Math.max(-9.6, avatarZ + dz);
      const clampedDz = nextZ - avatarZ;
      avatarZ = nextZ;
      return { dx: 0, dz: clampedDz };
    });
    assert.ok(Math.abs(avatarZ + 9.6) < 1e-4, `Avatar clamped at wall -9.6, got ${avatarZ}`);
    assert.ok(Math.abs(xrMgr.getViewerStageOffset().z + 0.25) < 1e-4, 'Blocked wall penetration does not shift stage baseline past wall');

    // 2. Full createScene VR session tests
    const api = await harness.start();
    api.skipRealTimeIntro();
    api.view(1);
    harness.stepFrames(3);

    // Ensure grabbing a rail and opening 'nav' no longer traps VR thumbstick locomotion
    api.teleportAstronautToDeck('deck-01');
    api.setAstronautPosition({ x: 0.0, y: 3.4, z: -8.6 }, 0, -0.05);
    harness.stepFrames(3);
    assert.equal(api.activateNearestStation(), true);
    api.handleVrConsoleAction('sit-command-seat');
    api.setActiveCabinStation('nav');
    harness.stepFrames(2);
    const beforeNavWalk = api.getAstronautPosition();
    api.applyVrControllerInput({ leftAxes: [0, 0, 0, -0.95] });
    harness.stepFrames(10);
    api.applyVrControllerInput(null);
    harness.stepFrames(2);
    const afterNavWalk = api.getAstronautPosition();
    const walkedFromNav = Math.hypot(
      afterNavWalk.x - beforeNavWalk.x,
      afterNavWalk.z - beforeNavWalk.z,
    );
    assert.ok(walkedFromNav > 0.05, `Left stick must walk even from seated nav console (moved=${walkedFromNav})`);

    // Attach mock XR onto the scene renderer so full WebXR tick runs
    const renderer = harness.renderers[0];
    let xrLoop = null;
    const leftGamepad = { axes: [0, 0, 0, 0], buttons: [{ pressed: false }] };
    const rightGamepad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 6 }, () => ({ pressed: false })) };
    const fakeSceneSession = {
      inputSources: [
        { targetRayMode: 'tracked-pointer', handedness: 'left', gamepad: leftGamepad },
        { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: rightGamepad },
      ],
      addEventListener() {},
      async end() {},
    };
    const sceneRefSpace = { id: 'scene-local-floor' };
    let scenePose = { x: 0, y: 1.7, z: 0 };
    const ctrl0 = new THREE.Group();
    const ctrl1 = new THREE.Group();
    const grip0 = new THREE.Group();
    const grip1 = new THREE.Group();
    renderer.xr = {
      enabled: false,
      setReferenceSpaceType() {},
      getReferenceSpace: () => sceneRefSpace,
      async setSession() {},
      getCamera: (cam) => cam,
      getController: (idx) => (idx === 0 ? ctrl0 : ctrl1),
      getControllerGrip: (idx) => (idx === 0 ? grip0 : grip1),
    };
    renderer.setAnimationLoop = (cb) => { xrLoop = cb; };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        languages: ['es-CO'],
        language: 'es-CO',
        xr: {
          isSessionSupported: async (mode) => mode === 'immersive-vr',
          requestSession: async () => fakeSceneSession,
        },
      },
    });

    // Pause before entering VR must automatically resume on session start
    api.setSimulationPaused(true);
    assert.equal(api.isSimulationPaused(), true);
    const vrStartRes = await api.enterVr();
    assert.equal(vrStartRes.ok, true);
    assert.equal(api.isSimulationPaused(), false, 'Entering WebXR must clear lingering pause state');
    assert.ok(typeof xrLoop === 'function');

    const stepXrFrames = (count, dtMs = 33.3) => {
      for (let i = 0; i < count; i++) {
        xrLoop(performance.now() + i * dtMs, {
          getViewerPose: (ref) =>
            ref === sceneRefSpace
              ? {
                  transform: {
                    position: { x: scenePose.x, y: scenePose.y, z: scenePose.z },
                    orientation: { x: 0, y: 0, z: 0, w: 1 },
                  },
                }
              : null,
        });
      }
    };

    // Stabilize initial HMD pose calibration
    api.setAstronautPosition({ x: 0, y: 3.4, z: -8.8 }, 0, 0);
    stepXrFrames(4);

    // Walking IRL in roomscale while seated must stand up (>0.55m) and sync astronautPos on deck
    api.sitInCommandSeat();
    assert.equal(api.isAstronautSeated(), true);
    stepXrFrames(2);
    scenePose = { x: 0.2, y: 1.7, z: 0.25 };
    stepXrFrames(2);
    scenePose = { x: 0.3, y: 1.7, z: 0.55 };
    stepXrFrames(2);
    assert.equal(api.isAstronautSeated(), false, 'Walking IRL >0.55m must automatically stand up from seat');
    scenePose = { x: 0.35, y: 1.7, z: 0.95 };
    stepXrFrames(2);
    scenePose = { x: 0.4, y: 1.7, z: 1.35 };
    stepXrFrames(2);
    const posAfterIrl = api.getAstronautPosition();
    assert.ok(posAfterIrl.x > 0.25 && posAfterIrl.z > -8.6, `IRL walking must advance astronautPos cleanly (${posAfterIrl.x}, ${posAfterIrl.z})`);

    // Rail grab auto-releases on VR thumbstick input
    const micro = api.getMicrogravityController();
    micro.toggleAnchor('rail-nav-01');
    assert.equal(micro.isAnchored(), true);
    leftGamepad.axes = [0, 0, 0, -0.95];
    stepXrFrames(4);
    leftGamepad.axes = [0, 0, 0, 0];
    assert.equal(micro.isAnchored(), false, 'Pushing VR stick must auto-release handrail anchor');

    // Recover from external simulationPaused with VR B button
    api.setSimulationPaused(true);
    rightGamepad.buttons[5].pressed = true;
    stepXrFrames(1);
    rightGamepad.buttons[5].pressed = false;
    assert.equal(pauseRequests.at(-1)?.resumeOnly, true, 'VR controller button while paused requests resume instead of staying locked');
    api.setSimulationPaused(false);
    stepXrFrames(1);

    // Travel triggered while presenting in Cabina 1P must switch to Exterior view (pv = 3, ship visible)
    const travelStarted = api.focus('Saturno');
    assert.equal(travelStarted, true);
    assert.equal(viewChanges.at(-1), 3, 'VR travel must immediately switch to Exterior view 3');
    stepXrFrames(3);
    assert.equal(api.navigationActive(), true);
    assert.equal(renderer.scene.name === 'kronox-local-ship-scene' || renderer.camera !== null, true);

    // Advance travel through completion and verify controls + returning to Cabina 1P with [A]
    for (let i = 0; i < 650 && api.navigationActive(); i++) {
      stepXrFrames(1, 50);
    }
    assert.equal(api.navigationActive(), false, 'VR exterior travel completes arrival cleanly');
    rightGamepad.buttons[4].pressed = true;
    stepXrFrames(1);
    rightGamepad.buttons[4].pressed = false;
    assert.equal(viewChanges.at(-1), 1, 'Pressing [A] after VR travel arrival returns cleanly to Cabina 1P');
    assert.equal(pointerEscapeCount.count, 0, 'PointerLock escape never triggers during WebXR');
  } finally {
    if (prevNavDesc) Object.defineProperty(globalThis, 'navigator', prevNavDesc);
    else delete globalThis.navigator;
    if (prevDocDesc) Object.defineProperty(globalThis, 'document', prevDocDesc);
    await harness.close();
  }
});
