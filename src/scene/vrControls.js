import * as THREE from 'three';

export const DEFAULT_VR_SETTINGS = Object.freeze({
  turnMode: 'smooth', // 'smooth' | 'snap'
  snapAngleDeg: 30, // 30 | 45 | 60
  smoothTurnSpeed: 1.85, // rad/s
  moveSpeedScale: 1.0, // 0.6 .. 1.6
  deadzone: 0.16, // 0.08 .. 0.30
  showControllerRays: true,
  comfortVignette: true,
});

export const VR_CONTROL_BINDINGS = Object.freeze([
  {
    id: 'vr-move',
    category: 'locomotion',
    hand: 'Izquierdo',
    control: 'Stick izquierdo',
    action: 'Desplazarse por la cabina / empuje planar de la nave (W / A / S / D)',
  },
  {
    id: 'vr-boost',
    category: 'locomotion',
    hand: 'Izquierdo',
    control: 'Pulsar Stick izquierdo (L3)',
    action: 'Impulsores RCS aumentados / desplazamiento rápido (Shift)',
  },
  {
    id: 'vr-turn',
    category: 'locomotion',
    hand: 'Derecho',
    control: 'Stick derecho (izq. / der.)',
    action: 'Giro de vista (por pasos o suave) / guiñada en Timón libre',
  },
  {
    id: 'vr-vertical',
    category: 'locomotion',
    hand: 'Derecho',
    control: 'Stick derecho (arriba / abajo)',
    action: 'Ascenso y descenso vertical 6-DOF / cabeceo de nave (Espacio / Ctrl)',
  },
  {
    id: 'vr-interact',
    category: 'interaction',
    hand: 'Derecho',
    control: 'Gatillo derecho (Trigger)',
    action: 'Operar consola apuntada, ascensor o seleccionar objeto celeste ([E] / Clic)',
  },
  {
    id: 'vr-recenter',
    category: 'interaction',
    hand: 'Izquierdo',
    control: 'Gatillo izquierdo / Pulsar Stick der. (R3)',
    action: 'Centrar vista VR y horizonte espacial del visor HMD',
  },
  {
    id: 'vr-grip',
    category: 'interaction',
    hand: 'Ambos',
    control: 'Empuñadura (Grip L / R)',
    action: 'Frenado activo de microgravedad ([X]) y anclaje a pasamanos EVA ([H])',
  },
  {
    id: 'vr-view',
    category: 'systems',
    hand: 'Derecho / Izq.',
    control: 'Botón A / X',
    action: 'Alternar entre Cabina 1P y vista Exterior de la nave 120 m ([C])',
  },
  {
    id: 'vr-telescope',
    category: 'systems',
    hand: 'Derecho / Izq.',
    control: 'Botón B / Y',
    action: 'Alternar Telescopio Óptico ([T]) o Timón libre en vista Exterior',
  },
]);

export function normalizeVrSettings(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const turnMode =
    src.turnMode === 'snap' || src.turnMode === 'smooth'
      ? src.turnMode
      : DEFAULT_VR_SETTINGS.turnMode;
  const rawSnap = Number(src.snapAngleDeg);
  const snapAngleDeg = [15, 30, 45, 60].includes(rawSnap) ? rawSnap : DEFAULT_VR_SETTINGS.snapAngleDeg;
  const smoothTurnSpeed = Number.isFinite(Number(src.smoothTurnSpeed))
    ? Math.max(0.7, Math.min(3.5, Number(src.smoothTurnSpeed)))
    : DEFAULT_VR_SETTINGS.smoothTurnSpeed;
  const moveSpeedScale = Number.isFinite(Number(src.moveSpeedScale))
    ? Math.max(0.6, Math.min(1.6, Number(src.moveSpeedScale)))
    : DEFAULT_VR_SETTINGS.moveSpeedScale;
  const deadzone = Number.isFinite(Number(src.deadzone))
    ? Math.max(0.06, Math.min(0.32, Number(src.deadzone)))
    : DEFAULT_VR_SETTINGS.deadzone;
  return {
    turnMode,
    snapAngleDeg,
    smoothTurnSpeed,
    moveSpeedScale,
    deadzone,
    showControllerRays: src.showControllerRays !== false,
    comfortVignette: src.comfortVignette !== false,
  };
}

export function applyAxisDeadzone(value, deadzone = DEFAULT_VR_SETTINGS.deadzone) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.max(-1, Math.min(1, n));
  const dz = Math.max(0, Math.min(0.45, Number(deadzone) || 0.16));
  const absVal = Math.abs(clamped);
  if (absVal <= dz) return 0;
  return Math.sign(clamped) * ((absVal - dz) / Math.max(1e-4, 1 - dz));
}

export function readGamepadThumbstick(gamepad) {
  if (!gamepad || !gamepad.axes || typeof gamepad.axes.length !== 'number') {
    return { x: 0, y: 0 };
  }
  const axes = gamepad.axes;
  const ax0 = Number.isFinite(axes[0]) ? axes[0] : 0;
  const ax1 = Number.isFinite(axes[1]) ? axes[1] : 0;
  if (axes.length < 4) {
    return { x: ax0, y: ax1 };
  }
  const ax2 = Number.isFinite(axes[2]) ? axes[2] : 0;
  const ax3 = Number.isFinite(axes[3]) ? axes[3] : 0;
  // En WebXR 'xr-standard', los ejes [2,3] son el thumbstick y [0,1] touchpad.
  // Algunos drivers OpenXR/Link reportan el thumbstick en [0,1] dejando [2,3] en 0:
  // si [2,3] está en reposo pero [0,1] supera la zona mínima, usamos [0,1] como respaldo.
  const mag23 = Math.hypot(ax2, ax3);
  const mag01 = Math.hypot(ax0, ax1);
  if (mag23 >= 0.02 || mag23 >= mag01) {
    return { x: ax2, y: ax3 };
  }
  return { x: ax0, y: ax1 };
}

function isGamepadButtonPressed(gamepad, index) {
  const btn = gamepad?.buttons?.[index];
  if (!btn) return false;
  if (typeof btn === 'boolean') return btn;
  if (typeof btn === 'number') return btn > 0.55;
  return Boolean(btn.pressed || (Number.isFinite(btn.value) && btn.value > 0.55));
}

/**
 * Decodifica entradas de mandos WebXR ('xr-standard') y señales sintéticas de prueba.
 * Botones xr-standard:
 * 0: trigger, 1: squeeze/grip, 2: touchpad press, 3: thumbstick press, 4: A/X, 5: B/Y.
 */
export function createVrInputStateTracker(initialSettings = DEFAULT_VR_SETTINGS) {
  let settings = normalizeVrSettings(initialSettings);
  let snapCooldown = 0;
  let snapArmed = true;
  const prevPressed = {
    leftTrigger: false,
    rightTrigger: false,
    leftGrip: false,
    rightGrip: false,
    leftStickClick: false,
    rightStickClick: false,
    buttonA: false,
    buttonB: false,
    buttonX: false,
    buttonY: false,
    menu: false,
  };

  function risingEdge(key, currentValue) {
    const val = Boolean(currentValue);
    const triggered = val && !prevPressed[key];
    prevPressed[key] = val;
    return triggered;
  }

  return {
    setSettings(next) {
      settings = normalizeVrSettings(next);
      return settings;
    },
    getSettings() {
      return { ...settings };
    },
    reset() {
      snapCooldown = 0;
      snapArmed = true;
      Object.keys(prevPressed).forEach((k) => {
        prevPressed[k] = false;
      });
    },
    stepFrame({ dt = 0.016, leftGamepad = null, rightGamepad = null, externalInput = null } = {}) {
      const safeDt = Math.max(0.001, Math.min(0.1, Number(dt) || 0.016));
      const ext = externalInput && typeof externalInput === 'object' ? externalInput : null;

      const leftStickRaw = Array.isArray(ext?.leftAxes)
        ? readGamepadThumbstick({ axes: ext.leftAxes })
        : readGamepadThumbstick(leftGamepad);
      const rightStickRaw = Array.isArray(ext?.rightAxes)
        ? readGamepadThumbstick({ axes: ext.rightAxes })
        : readGamepadThumbstick(rightGamepad);

      const moveStrafe = Math.max(
        -1,
        Math.min(
          1,
          (applyAxisDeadzone(leftStickRaw.x, settings.deadzone) + (Number(ext?.moveX) || 0)) *
            settings.moveSpeedScale,
        ),
      );
      // En Gamepad/WebXR hacia delante en el stick suele ser axisY < 0
      const moveFwd = Math.max(
        -1,
        Math.min(
          1,
          (-applyAxisDeadzone(leftStickRaw.y, settings.deadzone) + (Number(ext?.moveY) || 0)) *
            settings.moveSpeedScale,
        ),
      );

      const turnX = Math.max(
        -1,
        Math.min(1, applyAxisDeadzone(rightStickRaw.x, settings.deadzone) + (Number(ext?.turnX) || 0)),
      );
      const vertStick = Math.max(
        -1,
        Math.min(
          1,
          -applyAxisDeadzone(rightStickRaw.y, settings.deadzone) + (Number(ext?.moveZ) || 0),
        ),
      );

      let turnYawDeltaRad = 0;
      if (settings.turnMode === 'smooth') {
        turnYawDeltaRad = -turnX * settings.smoothTurnSpeed * safeDt;
      } else {
        snapCooldown = Math.max(0, snapCooldown - safeDt);
        const absTurn = Math.abs(turnX);
        if (absTurn < 0.22) {
          snapArmed = true;
          snapCooldown = 0;
        } else if (absTurn >= 0.38 && (snapArmed || snapCooldown <= 0)) {
          const stepRad = THREE.MathUtils.degToRad(settings.snapAngleDeg);
          turnYawDeltaRad = -Math.sign(turnX) * stepRad;
          snapArmed = false;
          snapCooldown = 0.28;
        }
      }

      const leftBtn = (idx) =>
        isGamepadButtonPressed(leftGamepad, idx) || Boolean(ext?.leftButtons?.[idx]);
      const rightBtn = (idx) =>
        isGamepadButtonPressed(rightGamepad, idx) || Boolean(ext?.rightButtons?.[idx]);

      const triggerLeftHeld = leftBtn(0);
      const triggerRightHeld = rightBtn(0) || Boolean(ext?.interactHold);
      const gripLeftHeld = leftBtn(1);
      const gripRightHeld = rightBtn(1);
      const boostHeld = leftBtn(3) || Boolean(ext?.boost);
      const stabilizeHeld = gripLeftHeld || gripRightHeld || Boolean(ext?.stabilize);

      const triggerLeftPressed = risingEdge('leftTrigger', triggerLeftHeld);
      const triggerRightPressed = risingEdge('rightTrigger', triggerRightHeld || ext?.interact);
      const gripLeftPressed = risingEdge('leftGrip', gripLeftHeld);
      const gripRightPressed = risingEdge('rightGrip', gripRightHeld);
      const rightStickPressed = risingEdge('rightStickClick', rightBtn(3));
      const aPressed = risingEdge('buttonA', rightBtn(4) || ext?.toggleView);
      const bPressed = risingEdge('buttonB', rightBtn(5));
      const xPressed = risingEdge('buttonX', leftBtn(4));
      const yPressed = risingEdge('buttonY', leftBtn(5));
      const menuPressed = risingEdge('menu', Boolean(ext?.openMenu || leftBtn(2) || rightBtn(2)));
      const recenterEdge = Boolean(ext?.recenter) || triggerLeftPressed || rightStickPressed;

      return {
        moveFwd,
        moveStrafe,
        moveVert: vertStick,
        turnYawDeltaRad,
        shipYawAxis: turnX,
        shipPitchAxis: vertStick,
        boostHeld,
        stabilizeHeld,
        triggerLeftHeld,
        triggerRightHeld,
        gripLeftHeld,
        gripRightHeld,
        triggerLeftPressed,
        triggerRightPressed,
        leftStickX: leftStickRaw.x,
        leftStickY: leftStickRaw.y,
        rightStickX: rightStickRaw.x,
        rightStickY: rightStickRaw.y,
        actions: {
          interact: triggerRightPressed,
          grabRail: gripLeftPressed || gripRightPressed || Boolean(ext?.grabRail),
          toggleView: aPressed || xPressed,
          toggleTelescope: yPressed || Boolean(ext?.toggleTelescope),
          toggleFreeHelm: bPressed || Boolean(ext?.toggleFreeHelm),
          recenter: recenterEdge,
          openMenu: menuPressed,
        },
      };
    },
  };
}

export function getVrAvailabilitySync({
  navigatorObj = globalThis.navigator,
  windowObj = globalThis.window,
  isNodeHarness = false,
} = {}) {
  const secureContext =
    typeof windowObj?.isSecureContext === 'boolean' ? windowObj.isSecureContext : true;
  const webxrApi = Boolean(navigatorObj && 'xr' in navigatorObj && navigatorObj.xr);
  if (isNodeHarness) {
    return {
      secureContext: true,
      webxrApi: false,
      supported: false,
      reason: 'harness',
    };
  }
  if (!secureContext) {
    return {
      secureContext: false,
      webxrApi,
      supported: false,
      reason: 'insecure-context',
    };
  }
  if (!webxrApi) {
    return {
      secureContext: true,
      webxrApi: false,
      supported: false,
      reason: 'no-webxr',
    };
  }
  return {
    secureContext: true,
    webxrApi: true,
    supported: null,
    reason: 'ready-to-probe',
  };
}

export async function probeVrAvailability({
  navigatorObj = globalThis.navigator,
  windowObj = globalThis.window,
  isNodeHarness = false,
} = {}) {
  const base = getVrAvailabilitySync({ navigatorObj, windowObj, isNodeHarness });
  if (!base.webxrApi || base.supported === false) {
    return base;
  }
  try {
    const supported = Boolean(await navigatorObj.xr.isSessionSupported('immersive-vr'));
    return {
      ...base,
      supported,
      reason: supported ? 'supported' : 'no-headset-or-runtime',
    };
  } catch {
    return {
      ...base,
      supported: false,
      reason: 'probe-error',
    };
  }
}

function buildVrControllerVisual(hand = 'right') {
  const group = new THREE.Group();
  group.name = `kronox-vr-controller-${hand}`;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x162438,
    metalness: 0.72,
    roughness: 0.34,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.9,
    metalness: 0.4,
    roughness: 0.25,
  });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.11, 14), bodyMat);
  handle.rotation.x = Math.PI * 0.26;
  handle.position.set(0, -0.028, 0.032);
  group.add(handle);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0045, 10, 28), trimMat);
  halo.rotation.x = Math.PI * 0.42;
  halo.position.set(0, 0.012, -0.035);
  group.add(halo);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), bodyMat);
  core.position.set(0, 0, -0.015);
  group.add(core);

  return { group, bodyMat, trimMat };
}

function buildVrPointerBeam() {
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -3.5),
  ]);
  const beamMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
  });
  const line = new THREE.Line(beamGeo, beamMat);
  line.name = 'kronox-vr-ray';
  line.frustumCulled = false;

  const reticleGeo = new THREE.RingGeometry(0.008, 0.015, 16);
  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const reticle = new THREE.Mesh(reticleGeo, reticleMat);
  reticle.visible = false;

  return { line, beamGeo, beamMat, reticle, reticleGeo, reticleMat };
}

export function createWebXrManager({
  renderer,
  sceneAstro,
  sceneLocal,
  camAstro,
  camLocal,
  vrSettings = DEFAULT_VR_SETTINGS,
  isNodeHarness = false,
  onStateChange = null,
  onSessionStartCallback = null,
  onSessionEndCallback = null,
  onInteractHit = null,
  onStatusMessage = null,
} = {}) {
  const tracker = createVrInputStateTracker(vrSettings);
  let settings = tracker.getSettings();
  let syntheticInput = null;
  let xrPresenting = false;
  let currentSession = null;
  let referenceSpaceType = null;
  let availability = getVrAvailabilitySync({ isNodeHarness });
  let controller0 = null;
  let controller1 = null;
  let controllerGrip0 = null;
  let controllerGrip1 = null;
  let visual0 = null;
  let visual1 = null;
  let ray0 = null;
  let ray1 = null;
  let rigInitialized = false;

  const vrAstroRig = new THREE.Group();
  vrAstroRig.name = 'kronox-vr-astro-rig';
  const vrLocalRig = new THREE.Group();
  vrLocalRig.name = 'kronox-vr-local-rig';

  const recenterOffset = new THREE.Vector3(0, 0, 0);
  let recenterYawRad = 0;
  let pendingInitialCalibration = false;
  let calibrationSamples = 0;
  let hasSampledPose = false;
  let lastSampledPoseYaw = 0;

  let savedAstroNear = camAstro?.near ?? 0.0005;
  let savedAstroFar = camAstro?.far ?? 4e5;
  let savedLocalNear = camLocal?.near ?? 0.05;
  let savedLocalFar = camLocal?.far ?? 4000;

  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  const rayRotMatrix = new THREE.Matrix4();
  const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const tmpQuat = new THREE.Quaternion();
  const tmpVec = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const lastSampledPosePos = new THREE.Vector3();
  const savedCamPosScratch = new THREE.Vector3();
  const savedCamQuatScratch = new THREE.Quaternion();
  const savedCamScaleScratch = new THREE.Vector3();
  const rebaseOrigin = new THREE.Vector3();

  let activeHoveredStation = null;
  let lastHandCount = 0;
  let lastStateHash = '';

  function buildStateSnapshot() {
    return {
      supported: availability.supported,
      webxrApi: availability.webxrApi,
      secureContext: availability.secureContext,
      reason: availability.reason,
      presenting: xrPresenting,
      referenceSpaceType,
      connectedHands: lastHandCount,
      hoveredStationId: activeHoveredStation?.userData?.stationId || null,
      settings: { ...settings },
    };
  }

  function emitState(force = false) {
    const snap = buildStateSnapshot();
    const hash = `${snap.supported}|${snap.reason}|${snap.presenting}|${snap.connectedHands}|${snap.hoveredStationId}|${snap.settings.turnMode}|${snap.settings.snapAngleDeg}`;
    if (!force && hash === lastStateHash) return snap;
    lastStateHash = hash;
    onStateChange?.(snap);
    return snap;
  }

  function ensureControllersBuilt() {
    if (rigInitialized || isNodeHarness || !renderer?.xr || typeof renderer.xr.getController !== 'function') {
      return;
    }
    rigInitialized = true;
    controller0 = renderer.xr.getController(0);
    controller1 = renderer.xr.getController(1);
    controllerGrip0 = renderer.xr.getControllerGrip(0);
    controllerGrip1 = renderer.xr.getControllerGrip(1);

    ray0 = buildVrPointerBeam();
    ray1 = buildVrPointerBeam();
    visual0 = buildVrControllerVisual('left');
    visual1 = buildVrControllerVisual('right');

    controller0.add(ray0.line);
    controller0.add(ray0.reticle);
    controller1.add(ray1.line);
    controller1.add(ray1.reticle);

    controllerGrip0.add(visual0.group);
    controllerGrip1.add(visual1.group);

    controller0.userData.handedness = 'unknown';
    controller1.userData.handedness = 'unknown';

    const onConnected = (ctrl) => (ev) => {
      const src = ev?.data;
      ctrl.userData.xrInputSource = src || null;
      ctrl.userData.handedness = src?.handedness || 'unknown';
      lastHandCount = Math.min(
        2,
        [controller0, controller1].filter((c) => Boolean(c?.userData?.xrInputSource)).length,
      );
      emitState();
    };
    const onDisconnected = (ctrl) => () => {
      ctrl.userData.xrInputSource = null;
      ctrl.userData.handedness = 'unknown';
      lastHandCount = [controller0, controller1].filter((c) => Boolean(c?.userData?.xrInputSource)).length;
      emitState();
    };

    controller0.addEventListener('connected', onConnected(controller0));
    controller0.addEventListener('disconnected', onDisconnected(controller0));
    controller1.addEventListener('connected', onConnected(controller1));
    controller1.addEventListener('disconnected', onDisconnected(controller1));

    vrLocalRig.add(controller0, controller1, controllerGrip0, controllerGrip1);
  }

  function attachRigs() {
    if (camAstro && camAstro.parent !== vrAstroRig) {
      savedAstroNear = camAstro.near;
      savedAstroFar = camAstro.far;
      vrAstroRig.add(camAstro);
    }
    if (camLocal && sceneLocal) {
      savedLocalNear = camLocal.near;
      savedLocalFar = camLocal.far;
      if (vrLocalRig.parent !== sceneLocal) {
        sceneLocal.add(vrLocalRig);
      }
      if (camLocal.parent !== vrLocalRig) {
        vrLocalRig.add(camLocal);
      }
    }
    // Unifica near/far mientras dura WebXR para evitar reconfiguración de renderState 2 veces por frame
    if (camAstro && camLocal) {
      camAstro.near = 0.04;
      camAstro.far = 4e5;
      camAstro.updateProjectionMatrix();
      camLocal.near = 0.04;
      camLocal.far = 4e5;
      camLocal.updateProjectionMatrix();
    }
    if (controller0) controller0.visible = true;
    if (controller1) controller1.visible = true;
    if (controllerGrip0) controllerGrip0.visible = true;
    if (controllerGrip1) controllerGrip1.visible = true;
  }

  function detachRigs() {
    if (camAstro && camAstro.parent === vrAstroRig) {
      vrAstroRig.remove(camAstro);
      camAstro.near = savedAstroNear;
      camAstro.far = savedAstroFar;
      camAstro.updateProjectionMatrix();
    }
    if (camLocal && camLocal.parent === vrLocalRig) {
      vrLocalRig.remove(camLocal);
      camLocal.near = savedLocalNear;
      camLocal.far = savedLocalFar;
      camLocal.updateProjectionMatrix();
    }
    if (vrLocalRig.parent) {
      vrLocalRig.parent.remove(vrLocalRig);
    }
    activeHoveredStation = null;
  }

  function sampleXrViewerPose(xrFrame = null) {
    if (!xrPresenting || !renderer?.xr) return null;
    try {
      const refSpace =
        typeof renderer.xr.getReferenceSpace === 'function'
          ? renderer.xr.getReferenceSpace()
          : null;
      if (xrFrame && refSpace && typeof xrFrame.getViewerPose === 'function') {
        const viewerPose = xrFrame.getViewerPose(refSpace);
        const transform = viewerPose?.transform;
        if (transform?.position && transform?.orientation) {
          tmpVec.set(
            Number(transform.position.x) || 0,
            Number(transform.position.y) || 0,
            Number(transform.position.z) || 0,
          );
          tmpQuat.set(
            Number(transform.orientation.x) || 0,
            Number(transform.orientation.y) || 0,
            Number(transform.orientation.z) || 0,
            Number.isFinite(transform.orientation.w) ? transform.orientation.w : 1,
          );
          tmpEuler.setFromQuaternion(tmpQuat, 'YXZ');
          lastSampledPosePos.copy(tmpVec);
          lastSampledPoseYaw = Number.isFinite(tmpEuler.y) ? tmpEuler.y : 0;
          hasSampledPose = true;
          return { pos: lastSampledPosePos, yaw: lastSampledPoseYaw };
        }
      }
      if (typeof renderer.xr.getCamera === 'function' && camLocal) {
        savedCamPosScratch.copy(camLocal.position);
        savedCamQuatScratch.copy(camLocal.quaternion);
        savedCamScaleScratch.copy(camLocal.scale);
        try {
          const xrCam = renderer.xr.getCamera(camLocal);
          if (xrCam?.matrix && typeof xrCam.matrix.decompose === 'function') {
            // Three.js WebXRManager copia la matriz de vista en xrCam.matrix sin actualizar xrCam.quaternion
            xrCam.matrix.decompose(tmpVec, tmpQuat, tmpScale);
            if (tmpQuat.lengthSq() < 1e-8 && xrCam.quaternion) {
              tmpQuat.copy(xrCam.quaternion);
            }
            tmpEuler.setFromQuaternion(tmpQuat, 'YXZ');
            lastSampledPosePos.copy(tmpVec);
            lastSampledPoseYaw = Number.isFinite(tmpEuler.y) ? tmpEuler.y : 0;
            hasSampledPose = true;
            return { pos: lastSampledPosePos, yaw: lastSampledPoseYaw };
          }
        } finally {
          camLocal.position.copy(savedCamPosScratch);
          camLocal.quaternion.copy(savedCamQuatScratch);
          camLocal.scale.copy(savedCamScaleScratch);
        }
      }
    } catch {
      /* noop */
    }
    return hasSampledPose ? { pos: lastSampledPosePos, yaw: lastSampledPoseYaw } : null;
  }

  function tryAutoCalibrate(xrFrame = null) {
    if (!pendingInitialCalibration || !xrPresenting) return;
    const pose = sampleXrViewerPose(xrFrame);
    calibrationSamples += 1;
    if (!pose) {
      if (calibrationSamples >= 12) {
        pendingInitialCalibration = false;
      }
      return;
    }
    // En 'local-floor' la cabeza real (sentado ~0.95m, de pie ~1.7m) supera > 2 cm;
    // en 'local' (origen 0,0,0) o tras 8 frames de estabilización bloqueamos la referencia exacta.
    if (pose.pos.length() > 0.02 || calibrationSamples >= 8) {
      recenterOffset.copy(pose.pos);
      recenterYawRad = pose.yaw;
      pendingInitialCalibration = false;
    }
  }

  function handleSessionEnded() {
    currentSession = null;
    xrPresenting = false;
    referenceSpaceType = null;
    lastHandCount = 0;
    pendingInitialCalibration = false;
    calibrationSamples = 0;
    hasSampledPose = false;
    lastSampledPoseYaw = 0;
    recenterOffset.set(0, 0, 0);
    recenterYawRad = 0;
    tracker.reset();
    detachRigs();
    if (renderer?.xr) {
      try {
        renderer.xr.enabled = false;
      } catch {
        /* noop */
      }
    }
    onSessionEndCallback?.();
    emitState(true);
  }

  async function refreshAvailability() {
    availability = await probeVrAvailability({ isNodeHarness });
    emitState(true);
    return availability;
  }

  async function enterVr() {
    if (xrPresenting && currentSession) {
      return { ok: true, alreadyPresenting: true };
    }
    availability = await probeVrAvailability({ isNodeHarness });
    if (!availability.supported || !navigator?.xr || !renderer?.xr) {
      const msg =
        availability.reason === 'insecure-context'
          ? 'WebXR requiere contexto seguro (HTTPS o localhost).'
          : 'No se detectó un visor o entorno WebXR compatible en este navegador.';
      onStatusMessage?.(msg);
      emitState(true);
      return { ok: false, reason: availability.reason, message: msg };
    }

    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
      currentSession = session;
      referenceSpaceType = 'local-floor';
      renderer.xr.enabled = true;
      try {
        renderer.xr.setReferenceSpaceType?.('local-floor');
      } catch {
        referenceSpaceType = 'local';
      }
      ensureControllersBuilt();
      attachRigs();
      session.addEventListener('end', handleSessionEnded, { once: true });
      try {
        await renderer.xr.setSession(session);
      } catch (refErr) {
        // Algunos navegadores/visores sin 'local-floor' requieren respaldo explícito a 'local'
        if (referenceSpaceType !== 'local') {
          referenceSpaceType = 'local';
          renderer.xr.setReferenceSpaceType?.('local');
          await renderer.xr.setSession(session);
        } else {
          throw refErr;
        }
      }
      xrPresenting = true;
      recenterOffset.set(0, 0, 0);
      recenterYawRad = 0;
      pendingInitialCalibration = true;
      calibrationSamples = 0;
      hasSampledPose = false;
      onSessionStartCallback?.(session);
      emitState(true);
      return { ok: true, referenceSpaceType };
    } catch (err) {
      detachRigs();
      xrPresenting = false;
      currentSession = null;
      const msg = err?.message ? `No se pudo iniciar la sesión VR: ${err.message}` : 'Error al iniciar sesión VR.';
      onStatusMessage?.(msg);
      emitState(true);
      return { ok: false, reason: 'session-error', message: msg };
    }
  }

  async function exitVr() {
    if (!currentSession) {
      return { ok: false, reason: 'not-presenting' };
    }
    try {
      await currentSession.end();
      return { ok: true };
    } catch {
      handleSessionEnded();
      return { ok: true };
    }
  }

  function recenterVr(xrFrame = null) {
    if (xrPresenting && renderer?.xr) {
      const pose = sampleXrViewerPose(xrFrame);
      if (pose) {
        recenterOffset.copy(pose.pos);
        recenterYawRad = pose.yaw;
        pendingInitialCalibration = false;
      } else {
        recenterOffset.set(0, 0, 0);
        recenterYawRad = 0;
      }
    } else {
      recenterOffset.set(0, 1.65, 0);
      recenterYawRad = 0;
    }
    onStatusMessage?.('Vista VR centrada en la posición actual del observador.');
    return {
      offset: [recenterOffset.x, recenterOffset.y, recenterOffset.z],
      yawRad: recenterYawRad,
    };
  }

  function getControllerGamepads() {
    let leftGamepad = null;
    let rightGamepad = null;
    const sources = currentSession?.inputSources;
    if (!sources || typeof sources[Symbol.iterator] !== 'function') {
      return { leftGamepad, rightGamepad };
    }
    const candidates = [];
    for (const src of sources) {
      if (!src?.gamepad) continue;
      if (src.targetRayMode === 'gaze' || src.targetRayMode === 'screen') continue;
      candidates.push(src);
    }
    // Pasada 1: respetar estrictamente handedness 'left' / 'right' evitando que un perfil sin mano ocupe el slot
    for (const src of candidates) {
      const axesCount = src.gamepad.axes?.length || 0;
      if (src.handedness === 'left' && (!leftGamepad || ((leftGamepad.axes?.length || 0) < 2 && axesCount >= 2))) {
        leftGamepad = src.gamepad;
      } else if (src.handedness === 'right' && (!rightGamepad || ((rightGamepad.axes?.length || 0) < 2 && axesCount >= 2))) {
        rightGamepad = src.gamepad;
      }
    }
    // Pasada 2: respaldo solo para mandos sin handedness declarado con ejes de stick
    for (const src of candidates) {
      if (src.handedness === 'left' || src.handedness === 'right') continue;
      if ((src.gamepad.axes?.length || 0) < 2) continue;
      if (!rightGamepad) rightGamepad = src.gamepad;
      else if (!leftGamepad) leftGamepad = src.gamepad;
    }
    return { leftGamepad, rightGamepad };
  }

  function updateControllerRays({ interactableMeshes = [] } = {}) {
    activeHoveredStation = null;
    if (!xrPresenting || !rigInitialized) return null;

    const pairs = [
      { ctrl: controller1, ray: ray1 },
      { ctrl: controller0, ray: ray0 },
    ];
    let primaryHit = null;
    const showRays = settings.showControllerRays !== false;

    for (let i = 0; i < pairs.length; i++) {
      const { ctrl, ray } = pairs[i];
      if (!ctrl || !ray) continue;
      ray.line.visible = showRays;
      ray.reticle.visible = false;
      if (!showRays) continue;

      rayRotMatrix.identity().extractRotation(ctrl.matrixWorld);
      rayOrigin.setFromMatrixPosition(ctrl.matrixWorld);
      rayDir.set(0, 0, -1).applyMatrix4(rayRotMatrix).normalize();

      let hitIsHud = false;
      if (Array.isArray(interactableMeshes) && interactableMeshes.length > 0) {
        raycaster.set(rayOrigin, rayDir);
        raycaster.near = 0.05;
        raycaster.far = 6.0;
        const visibleHits = raycaster.intersectObjects(interactableMeshes, true).filter((h) => {
          let vis = h.object;
          while (vis) {
            if (vis.visible === false) return false;
            vis = vis.parent;
          }
          return true;
        });
        const hudHit = visibleHits.find((h) => {
          let cur = h.object;
          while (cur) {
            if (cur.userData?.isVrHud) return true;
            cur = cur.parent;
          }
          return false;
        });
        const hit = hudHit || visibleHits[0];
        if (hit) {
          hitIsHud = Boolean(hudHit);
          const dist = Math.max(0.12, hit.distance);
          const posAttr = ray.beamGeo.attributes?.position;
          if (posAttr && typeof posAttr.setXYZ === 'function') {
            posAttr.setXYZ(1, 0, 0, -dist);
            posAttr.needsUpdate = true;
          }
          ray.reticle.position.set(0, 0, -dist);
          ray.reticle.visible = true;
          ray.reticle.renderOrder = hitIsHud ? 120 : 12;
          if (ray.reticle.material) {
            ray.reticle.material.depthTest = !hitIsHud;
          }
          ray.beamMat.color.setHex(hitIsHud ? 0x38bdf8 : 0x34d399);
          if (!primaryHit) {
            let cur = hit.object;
            while (cur && !(cur.userData?.interactId || cur.userData?.stationId) && cur.parent) cur = cur.parent;
            const hitId = cur?.userData?.interactId || cur?.userData?.stationId;
            if (hitId) {
              activeHoveredStation = cur;
              primaryHit = {
                stationId: hitId,
                interactId: hitId,
                isHud: hitIsHud,
                hand: ray === ray0 ? 'left' : 'right',
                distance: dist,
                point: hit.point.clone(),
                uv: hit.uv ? hit.uv.clone() : null,
                object: cur,
              };
            }
          }
          continue;
        }
      }
      if (ray.reticle.material) ray.reticle.material.depthTest = true;
      ray.reticle.renderOrder = 12;

      const posAttr = ray.beamGeo.attributes?.position;
      if (posAttr && typeof posAttr.setXYZ === 'function') {
        posAttr.setXYZ(1, 0, 0, -3.5);
        posAttr.needsUpdate = true;
      }
      ray.beamMat.color.setHex(0x38bdf8);
    }

    emitState();
    return primaryHit;
  }

  function pollInput({ dt = 0.016, xrFrame = null, interactableMeshes = [] } = {}) {
    if (xrPresenting && xrFrame) {
      if (pendingInitialCalibration) {
        tryAutoCalibrate(xrFrame);
      } else {
        sampleXrViewerPose(xrFrame);
      }
    }
    const { leftGamepad, rightGamepad } = xrPresenting
      ? getControllerGamepads()
      : { leftGamepad: null, rightGamepad: null };
    const ext = syntheticInput;
    // Las acciones de un solo pulso externo se consumen tras un frame; los ejes/hold se mantienen hasta limpiarse
    const hasAnything = Boolean(xrPresenting || leftGamepad || rightGamepad || ext);
    if (!hasAnything) {
      return null;
    }
    const rayHit = updateControllerRays({ interactableMeshes });
    const frame = tracker.stepFrame({
      dt,
      leftGamepad,
      rightGamepad,
      externalInput: ext,
    });
    if (ext && ext.oneShot) {
      syntheticInput = null;
    } else if (ext) {
      // Limpia botones edge one-shot después de procesarse
      delete ext.interact;
      delete ext.grabRail;
      delete ext.toggleView;
      delete ext.toggleTelescope;
      delete ext.toggleFreeHelm;
      delete ext.recenter;
      delete ext.openMenu;
    }
    const hudLeftClick =
      Boolean(rayHit?.isHud || rayHit?.interactId === 'kronox-ai') &&
      rayHit?.hand === 'left' &&
      Boolean(frame.actions.recenter);
    if ((frame.actions.interact || hudLeftClick) && rayHit?.stationId) {
      onInteractHit?.(rayHit.stationId, rayHit);
    }
    if (frame.actions.recenter && !hudLeftClick) {
      recenterVr(xrFrame);
    }
    return { ...frame, rayHit };
  }

  /**
   * Sincroniza vrLocalRig y vrAstroRig antes del renderizado estereoscópico dual.
   * Mantiene alineadas las estrellas/planetas de `sc` con la cabina/casco de `localShipScene`.
   */
  function syncRigsBeforeRender({
    astroCamPos,
    astroCamQuat,
    localEyePos,
    localYawQuat,
    inCabin = true,
    xrFrame = null,
  } = {}) {
    if (!xrPresenting) return;
    if (pendingInitialCalibration) {
      tryAutoCalibrate(xrFrame);
    }
    if (localYawQuat && localEyePos) {
      tmpEuler.set(0, -recenterYawRad, 0, 'YXZ');
      tmpQuat.setFromEuler(tmpEuler);
      vrLocalRig.quaternion.copy(localYawQuat).multiply(tmpQuat);
      tmpVec.copy(recenterOffset).applyQuaternion(vrLocalRig.quaternion);
      vrLocalRig.position.copy(localEyePos).sub(tmpVec);
      vrLocalRig.updateMatrixWorld(true);
    }
    if (astroCamPos) {
      vrAstroRig.position.copy(astroCamPos);
    }
    if (localYawQuat && inCabin) {
      vrAstroRig.quaternion.copy(vrLocalRig.quaternion);
    } else if (astroCamQuat) {
      tmpEuler.set(0, -recenterYawRad, 0, 'YXZ');
      tmpQuat.setFromEuler(tmpEuler);
      vrAstroRig.quaternion.copy(astroCamQuat).multiply(tmpQuat);
    }
    vrAstroRig.updateMatrixWorld(true);
  }

  /**
   * Ejecuta el render de `sceneAstro` con rebasing Float64 sobre `vrAstroRig` en WebXR.
   */
  function renderAstroInVr({ threshold = 10000, cellSize = 1024 } = {}) {
    if (!renderer || !sceneAstro || !camAstro) return { rebased: false };
    const dist = vrAstroRig.position.length();
    if (dist < threshold) {
      vrAstroRig.updateMatrixWorld(true);
      renderer.render(sceneAstro, camAstro);
      return { rebased: false, origin: [0, 0, 0], precisionBits: 32 };
    }
    const savedScenePos = sceneAstro.position.clone();
    const savedRigPos = vrAstroRig.position.clone();
    const step = cellSize > 0 ? cellSize : 1024;
    rebaseOrigin.set(
      Math.round(savedRigPos.x / step) * step,
      Math.round(savedRigPos.y / step) * step,
      Math.round(savedRigPos.z / step) * step,
    );
    try {
      sceneAstro.position.sub(rebaseOrigin);
      vrAstroRig.position.sub(rebaseOrigin);
      sceneAstro.updateMatrixWorld(true);
      vrAstroRig.updateMatrixWorld(true);
      renderer.render(sceneAstro, camAstro);
      return {
        rebased: true,
        origin: [rebaseOrigin.x, rebaseOrigin.y, rebaseOrigin.z],
        precisionBits: 64,
      };
    } finally {
      sceneAstro.position.copy(savedScenePos);
      vrAstroRig.position.copy(savedRigPos);
      sceneAstro.updateMatrixWorld(true);
      vrAstroRig.updateMatrixWorld(true);
    }
  }

  function setSettings(nextSettings) {
    settings = tracker.setSettings(nextSettings);
    if (ray0) ray0.line.visible = xrPresenting && settings.showControllerRays;
    if (ray1) ray1.line.visible = xrPresenting && settings.showControllerRays;
    emitState();
    return { ...settings };
  }

  function setSyntheticInput(inputPatch) {
    if (!inputPatch) {
      syntheticInput = null;
      return null;
    }
    syntheticInput = { ...inputPatch };
    return syntheticInput;
  }

  function dispose() {
    if (currentSession) {
      currentSession.end().catch(() => {});
    }
    detachRigs();
    [visual0, visual1].forEach((v) => {
      if (!v) return;
      v.bodyMat?.dispose?.();
      v.trimMat?.dispose?.();
    });
    [ray0, ray1].forEach((r) => {
      if (!r) return;
      r.beamGeo?.dispose?.();
      r.beamMat?.dispose?.();
      r.reticleGeo?.dispose?.();
      r.reticleMat?.dispose?.();
    });
  }

  return {
    getState: () => buildStateSnapshot(),
    isPresenting: () => xrPresenting,
    refreshAvailability,
    enterVr,
    exitVr,
    recenterVr,
    setSettings,
    setSyntheticInput,
    pollInput,
    syncRigsBeforeRender,
    renderAstroInVr,
    vrAstroRig,
    vrLocalRig,
    dispose,
  };
}
