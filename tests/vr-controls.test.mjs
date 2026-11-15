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
    addEventListener() { },
    async end() { },
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
        setReferenceSpaceType() { },
        getReferenceSpace: () => dummyRefSpace,
        async setSession() { },
        getCamera: () => camLocal,
      },
      render() { },
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


test('VR HUD 3D: raycast UV sobre QuickBar, Viajes, SPHEREx FITS real y Kronos IA', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { createVrHudPanel3D } = await import('../src/scene/vrHudPanel3D.js');

  const events = [];
  const hud = createVrHudPanel3D({
    fetchImpl: async (url) => {
      const marker = '/demo/';
      const idx = String(url).indexOf(marker);
      assert.ok(idx >= 0, `URL local esperada, recibida: ${url}`);
      const rel = String(url).slice(idx + marker.length);
      const diskPath = path.resolve(process.cwd(), 'public', 'demo', rel);
      const bytes = fs.readFileSync(diskPath);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    },
    onTravelRequest: (req) => events.push(['travel', req]),
    onToggleView: (v) => events.push(['view', v]),
    onSelectDeck: (d) => events.push(['deck', d]),
    onFindingSaved: (rec) => events.push(['finding', rec.astronomicalObject?.key]),
  });

  const eye = new THREE.Vector3(0, 1.68, 0);
  const headQuat = new THREE.Quaternion();
  hud.syncToObserver({ eyeWorldPos: eye, headWorldQuat: headQuat, dt: 0.016, xrPresenting: true });
  assert.equal(hud.group.visible, true);

  const clickSurfaceButton = (mesh, widthPx, heightPx, btn) => {
    const geomParams = mesh.geometry.parameters;
    const u = (btn.x + btn.w * 0.5) / widthPx;
    const v = 1 - (btn.y + btn.h * 0.5) / heightPx;
    const localPt = new THREE.Vector3((u - 0.5) * geomParams.width, (v - 0.5) * geomParams.height, 0);
    const worldPt = mesh.localToWorld(localPt);
    const dir = worldPt.sub(eye).normalize();
    const raycaster = new THREE.Raycaster(eye, dir, 0.05, 8);
    const hits = raycaster.intersectObject(mesh, false);
    assert.ok(hits.length > 0, `Raycast debe impactar botón ${btn.id}`);
    return hud.handleHitClick({
      stationId: mesh.userData.interactId,
      interactId: mesh.userData.interactId,
      uv: hits[0].uv,
      object: mesh,
    });
  };

  // 1. Abrir pestaña Viajar mediante THREE.Raycaster real sobre quickBarMesh
  let state = hud.getState();
  const travelBtn = hud.quickBarMesh.geometry ? state.quickBarButtons.find((b) => b.id === 'qb-travel') : null;
  assert.ok(travelBtn);
  // Calcular coordenadas del primer botón de quickBar usando u/v matemático equivalente al centro del botón
  const qbClickTravel = clickSurfaceButton(hud.quickBarMesh, 1024, 184, {
    id: 'qb-travel',
    x: 20,
    y: 52,
    w: 185,
    h: 112,
  });
  assert.equal(qbClickTravel.handled, true);
  assert.equal(hud.getState().tabletOpen, true);
  assert.equal(hud.getState().activeTab, 'travel');

  // Re-sincronizar matriz tras abrir tablet y pulsar botón de planeta Neptuno y cubierta C03
  hud.syncToObserver({ eyeWorldPos: eye, headWorldQuat: headQuat, dt: 0.016, xrPresenting: true });
  const neptunoHit = hud.handleHitClick({
    stationId: 'vr-hud-tablet',
    uv: new THREE.Vector2((42 + 9 * 0 + 50) / 1280, 1 - (250 + 3 * 126 + 40) / 820),
    object: hud.tabletMesh,
  });
  assert.equal(neptunoHit.handled, true);
  assert.ok(events.some(([k, req]) => k === 'travel' && req.kind === 'planet' && req.target === 'Neptuno'));

  // 2. Abrir SPHEREx y decodificar FITS reales de Estrella de Barnard + guardar hallazgo
  hud.openWithTab('spherex');
  await hud.loadSpherexTargetData('barnard');
  state = hud.getState();
  assert.equal(state.activeTab, 'spherex');
  assert.equal(state.spherexTargetKey, 'barnard');
  assert.equal(state.spherexHasFrameA, true);
  assert.equal(state.spherexHasFrameB, true);

  hud.handleHitClick({
    stationId: 'vr-hud-tablet',
    uv: new THREE.Vector2(900 / 1280, 1 - 680 / 820), // botón spx-save-finding
    object: hud.tabletMesh,
  });
  assert.ok(events.some(([k, tKey]) => k === 'finding' && tKey === 'barnard'));

  // 3. Subtítulos cuando tableta está cerrada y abrir KRONOS IA con pregunta rápida
  hud.closeTablet();
  hud.setAssistantMessage({
    title: 'Kronox IA',
    message: 'Bienvenido al sistema de Barnard.',
    speaking: true,
    durationSec: 10,
  });
  hud.syncToObserver({ eyeWorldPos: eye, headWorldQuat: headQuat, dt: 0.016, xrPresenting: true });
  assert.equal(hud.subtitleMesh.visible, true);

  const subClick = hud.handleHitClick({
    stationId: 'vr-hud-subtitle',
    uv: new THREE.Vector2(0.5, 0.5),
    object: hud.subtitleMesh,
  });
  assert.equal(subClick.handled, true);
  assert.equal(hud.getState().activeTab, 'kronos');

  hud.syncToObserver({ eyeWorldPos: eye, headWorldQuat: headQuat, dt: 0.016, xrPresenting: true });
  const prevMsg = hud.getState().assistantMessage;
  hud.handleHitClick({
    stationId: 'vr-hud-tablet',
    uv: new THREE.Vector2(180 / 1280, 1 - 445 / 820), // primer botón kr-prompt-0-0
    object: hud.tabletMesh,
  });
  await new Promise((r) => setTimeout(r, 15));
  assert.notEqual(hud.getState().assistantMessage, prevMsg);
  hud.dispose();
});

test('VR integración en setupScene: mundo 3D, HUD espacial y Kronox IA visibles sin corrupción de cámara en WebXR', async () => {
  const endListeners = [];
  const fakeSession = {
    addEventListener: (ev, cb) => {
      if (ev === 'end' && typeof cb === 'function') endListeners.push(cb);
    },
    removeEventListener: () => { },
    requestReferenceSpace: async () => ({ type: 'local-floor' }),
    end: async () => {
      presentingFlag = false;
      while (endListeners.length) endListeners.shift()();
    },
    inputSources: [],
  };

  const travelRequests = [];
  const kronoxQueries = [];
  let presentingFlag = false;
  let xrLoop = null;
  const hmdLocalMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(0.04, 1.65, 0.06),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.03, 0.18, 0, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
  const renderLog = [];

  const harness = await createSceneHarness({
    stateOverrides: {
      onVrTravelRequest: (req) => travelRequests.push(req),
      onVrKronoxQuery: (q) => {
        kronoxQueries.push(q);
        return { reply: `Respuesta VR para: ${q}`, role: 'Kronox IA' };
      },
    },
  });

  try {
    // Habilitar navigator.xr después de createSceneHarness (el harness sobrescribe navigator)
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        ...globalThis.navigator,
        xr: {
          isSessionSupported: async () => true,
          requestSession: async () => fakeSession,
        },
      },
    });
    globalThis.window.isSecureContext = true;

    const renderer = harness.renderers[0];
    renderer.autoClear = true;
    renderer.clearDepth = () => { };
    renderer.setAnimationLoop = (cb) => {
      xrLoop = cb;
    };
    const origRender = renderer.render.bind(renderer);
    renderer.xr = {
      enabled: false,
      get isPresenting() {
        return presentingFlag;
      },
      setReferenceSpaceType: () => { },
      getReferenceSpace: () => ({ type: 'local-floor' }),
      setSession: async () => {
        presentingFlag = true;
      },
      getController: () => new THREE.Group(),
      getControllerGrip: () => new THREE.Group(),
      getCamera: (camera) => {
        // Replicar Three.js WebXRManager.getCamera: lanza TypeError si falta camera y muta la cámara pasada
        if (!camera) {
          throw new TypeError("Cannot read properties of undefined (reading 'near')");
        }
        const parent = camera.parent;
        if (parent) parent.updateMatrixWorld(true);
        const worldMat = parent
          ? new THREE.Matrix4().multiplyMatrices(parent.matrixWorld, hmdLocalMatrix)
          : hmdLocalMatrix.clone();
        camera.matrixWorld.copy(worldMat);
        camera.matrix.copy(hmdLocalMatrix);
        camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
        return { matrix: hmdLocalMatrix.clone(), matrixWorld: worldMat };
      },
    };
    renderer.render = (sceneObj, cameraObj) => {
      origRender(sceneObj, cameraObj);
      if (renderer.xr.isPresenting) {
        const camVr = renderer.xr.getCamera(cameraObj);
        const isLocal = Boolean(sceneObj.getObjectByName('vr-hud-quickbar'));
        renderLog.push({
          isLocal,
          autoClear: renderer.autoClear,
          camWorldPos: new THREE.Vector3().setFromMatrixPosition(camVr.matrixWorld),
        });
      }
    };

    const api = await harness.start();
    api.skipRealTimeIntro();
    api.free(true, false);
    api.view(1);
    harness.stepFrames(3);

    const stepXrOrRaf = (count) => {
      for (let i = 0; i < count; i++) {
        if (presentingFlag && xrLoop) {
          xrLoop(performance.now(), {
            getViewerPose: () => ({
              transform: {
                position: { x: 0.04, y: 1.65, z: 0.06 },
                orientation: { x: 0, y: 0.09, z: 0, w: 0.996 },
              },
            }),
          });
        } else {
          harness.stepFrames(1);
        }
      }
    };

    // En modo escritorio no VR el HUD VR permanece oculto
    assert.equal(api.getVrHudState().xrPresenting, false);
    assert.equal(api.getVrHudRaycastTargets().length, 0);

    const enterRes = await api.enterVr();
    assert.equal(enterRes.ok, true, `enterVr falló: ${enterRes.reason} ${enterRes.message || ''}`);
    renderLog.length = 0;
    stepXrOrRaf(6);

    assert.equal(renderer.autoClear, true, 'R.autoClear debe quedar restaurado tras tick() VR');
    const cabinSnap = api.navigationSnapshot();
    assert.equal(cabinSnap.cabinVisible, true, 'La cabina 3D debe seguir visible en Cabina 1P VR');
    assert.equal(cabinSnap.view, 1);

    const lastTwoCabin = renderLog.slice(-2);
    assert.equal(lastTwoCabin.length, 2);
    assert.equal(lastTwoCabin[0].isLocal, false, 'Pass 1 debe renderizar el universo astronómico sc');
    assert.equal(lastTwoCabin[0].autoClear, true);
    assert.equal(lastTwoCabin[1].isLocal, true, 'Pass 2 debe renderizar localShipScene encima de sc');
    assert.equal(lastTwoCabin[1].autoClear, false);

    const hudCabin = api.getVrHudState();
    assert.equal(hudCabin.xrPresenting, true);
    assert.ok(api.getVrHudRaycastTargets().some((m) => m.userData?.interactId === 'vr-hud-quickbar'));

    const aiRoot = renderer.localScene?.getObjectByName('KronoxCompanionWorldRoot');
    assert.ok(aiRoot, 'KronoxCompanionWorldRoot debe vivir en localShipScene');
    assert.equal(aiRoot.visible, true);

    // Abrir SPHEREx y luego pasar a Exterior VR por múltiples frames
    api.openVrHudTab('spherex');
    assert.equal(api.getVrHudState().activeTab, 'spherex');
    assert.equal(api.getVrHudState().tabletOpen, true);

    api.view(3);
    renderLog.length = 0;
    stepXrOrRaf(6);

    assert.equal(renderer.autoClear, true, 'R.autoClear debe quedar restaurado en Exterior VR');
    const extSnap = api.navigationSnapshot();
    assert.equal(extSnap.view, 3);
    assert.equal(extSnap.shipVisible, true, 'La nave 3D debe ser visible en Exterior VR');
    assert.equal(extSnap.cabinVisible, false);
    assert.equal(api.getVrHudState().xrPresenting, true);
    assert.equal(aiRoot.visible, true);

    // Verificar que WebXRManager.getCamera no corrompió cam ni localCam hacia el origen/Sol o -sp
    const shipVec = new THREE.Vector3(...extSnap.shipPosition);
    const camVec = new THREE.Vector3(...extSnap.cameraPosition);
    assert.ok(camVec.length() > 50, 'La cámara astronómica VR no debe colapsar a (0, 1.65, 0) en Exterior');
    assert.ok(camVec.distanceTo(shipVec) < 5, 'La cámara astronómica VR debe permanecer junto a la nave');

    const localCamDist = Math.hypot(...extSnap.localCameraPosition);
    assert.ok(
      localCamDist > 4 && localCamDist < 120,
      `localCam VR en Exterior no debe alejarse a -sp (${localCamDist} m)`,
    );

    const lastTwoExt = renderLog.slice(-2);
    assert.equal(lastTwoExt[0].isLocal, false);
    assert.equal(lastTwoExt[1].isLocal, true);
    assert.ok(lastTwoExt[1].camWorldPos.length() < 120, 'El eye world VR en Exterior debe seguir cerca de la nave');

    await api.exitVr();
    stepXrOrRaf(3);
    assert.equal(api.getVrHudState().xrPresenting, false);
    assert.equal(aiRoot.visible, false);
  } finally {
    await harness.close();
  }
});
