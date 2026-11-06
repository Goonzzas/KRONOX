import * as THREE from 'three';

/**
 * Physical Scale Constants for the Habitable Ship World (Section 7):
 * 1 unit in the local interior world = 1.00 meter.
 * Ship total length = 120.0 meters (~68.6 human heights).
 * Astronaut height = 1.75 meters (eye height = 1.65 meters).
 */
export const SHIP_WORLD_UNITS = {
  METER: 1.0,
  SHIP_LENGTH_METERS: 120.0,
  ASTRONAUT_HEIGHT_METERS: 1.75,
  ASTRONAUT_EYE_METERS: 1.65,
  ASTRONAUT_RADIUS_METERS: 0.36,
  WALK_SPEED_MPS: 4.2,
  SPRINT_SPEED_MPS: 7.4,
};

/**
 *Valid states for the 3D Luminous Energy Entity (Kronox IA — Section 5).
 */
export const KRONOX_LUMINOUS_STATES = [
  'Reposo',
  'Escucha',
  'Comunicación',
  'Explicación',
  'Señalización',
  'Desplazamiento',
  'Acompañamiento',
  'Celebración',
];

/**
 * Physical Interactive Stations inside the 3D Habitable Cabin (Section 4).
 * Coordinates are in meters (`1 unit = 1 meter`) relative to the bridge center `(0, 0, 0)`.
 * Forward towards the bow panoramic windows is `-Z`; Aft corridor is `+Z`.
 */
export const PHYSICAL_CABIN_STATIONS = [
  {
    id: 'nav',
    code: 'CONSOLA DE NAVEGACIÓN',
    title: 'Timón y Cartografía Estelar',
    prompt: 'Pulsa [E] o haz clic para operar la Consola de Navegación',
    position: new THREE.Vector3(0, 0, -6.2),
    consolePos: new THREE.Vector3(0, 0.95, -7.35),
    aiHoverPos: new THREE.Vector3(1.25, 1.72, -6.8),
    lookTarget: new THREE.Vector3(0, 1.15, -7.5),
    color: 0x38bdf8,
    description:
      'Controla el rumbo de la nave de 120 m, los regímenes de velocidad y los saltos hacia objetivos estelares.',
  },
  {
    id: 'science',
    code: 'CONSOLA CIENTÍFICA · SPHEREx',
    title: 'Laboratorio Infrarrojo e Imágenes FITS Reales',
    prompt: 'Pulsa [E] o haz clic para analizar observaciones reales de NASA SPHEREx',
    position: new THREE.Vector3(-4.2, 0, -2.2),
    consolePos: new THREE.Vector3(-5.55, 0.98, -2.2),
    aiHoverPos: new THREE.Vector3(-4.6, 1.75, -0.95),
    lookTarget: new THREE.Vector3(-5.7, 1.25, -2.2),
    rotationY: Math.PI / 2,
    color: 0x34d399,
    description:
      'Consulta recortes FITS reales de IRSA/SPHEREx, filtra épocas (2025–2026), compara desplazamientos y verifica coordenadas WCS.',
  },
  {
    id: 'missions',
    code: 'CONSOLA DE MISIONES',
    title: 'Expediciones y Bitácora de Hallazgos',
    prompt: 'Pulsa [E] o haz clic para abrir el Sistema de Misiones y Cuaderno',
    position: new THREE.Vector3(4.2, 0, -2.2),
    consolePos: new THREE.Vector3(5.55, 0.98, -2.2),
    aiHoverPos: new THREE.Vector3(4.6, 1.75, -0.95),
    lookTarget: new THREE.Vector3(5.7, 1.25, -2.2),
    rotationY: -Math.PI / 2,
    color: 0xfbbf24,
    description:
      'Selecciona entre las 5 estrellas oficiales de misión SPHEREx y revisa tus hallazgos registrados.',
  },
  {
    id: 'comms',
    code: 'CONSOLA DE COMUNICACIONES · IA',
    title: 'Enlace Directo con Kronox IA',
    prompt: 'Pulsa [E] o haz clic para dialogar o iniciar recorrido guiado con Kronox IA',
    position: new THREE.Vector3(-2.8, 0, 2.8),
    consolePos: new THREE.Vector3(-3.85, 0.98, 2.8),
    aiHoverPos: new THREE.Vector3(-2.6, 1.7, 1.8),
    lookTarget: new THREE.Vector3(-4.0, 1.2, 2.8),
    rotationY: Math.PI * 0.38,
    color: 0xa78bfa,
    description:
      'Transmite órdenes en lenguaje natural a la entidad luminosa Kronox IA o solicita un recorrido por el puente.',
  },
  {
    id: 'windows',
    code: 'VENTANAS PANORÁMICAS DE PROA',
    title: 'Mirador Astronómico del Puente',
    prompt: 'Pulsa [E] o haz clic para contemplar el exterior o alternar vista de nave',
    position: new THREE.Vector3(0, 0, -9.8),
    consolePos: new THREE.Vector3(0, 1.05, -11.1),
    aiHoverPos: new THREE.Vector3(1.6, 1.85, -10.2),
    lookTarget: new THREE.Vector3(0, 1.65, -18.0),
    color: 0x60a5fa,
    description:
      'Observa directamente el cosmos exterior a través del domo blindado de proa o cambia a cámara exterior.',
  },
];

/**
 * Generates a high-contrast canvas texture for a 3D diegetic console screen.
 */
function createConsoleScreenTexture(station, extraLine = '') {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  // Deep sci-fi instrument background
  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#040d1a');
  grad.addColorStop(1, '#091e36');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  // Grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 32; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 320);
    ctx.stroke();
  }
  for (let y = 32; y < 320; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const hexColor = '#' + station.color.toString(16).padStart(6, '0');
  ctx.strokeStyle = hexColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 304);

  // Header bar
  ctx.fillStyle = hexColor;
  ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText(`▸ ${station.code}`, 26, 44);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(station.title, 26, 82);

  // Telemetry waveform / star reticle graphic
  ctx.strokeStyle = hexColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(410, 175, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(410, 175, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(340, 175);
  ctx.lineTo(480, 175);
  ctx.moveTo(410, 105);
  ctx.lineTo(410, 245);
  ctx.stroke();

  // Status lines
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px ui-monospace, monospace';
  ctx.fillText('SISTEMA EN LÍNEA · ESCALA 1:1 (120 m)', 26, 132);
  ctx.fillText('INTERACCIÓN FÍSICA: ACÉRCATE Y PULSA [E]', 26, 162);
  if (extraLine) {
    ctx.fillStyle = '#fef08a';
    ctx.fillText(extraLine, 26, 198);
  }

  ctx.fillStyle = hexColor;
  ctx.fillRect(26, 250, 280, 36);
  ctx.fillStyle = '#020617';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('OPERAR ESTACIÓN [E / CLIC]', 44, 274);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the 3D Luminous Energy Entity (Kronox IA — Section 5).
 * Preserves the original astral light identity: glowing core, 3 gyroscopic energy rings,
 * 4-pointed star core, volumetric particle cloud, light trail, and target pointing beam.
 * Strictly NO humanoid or robot geometry.
 */
export function createKronoxLuminousEntity3D() {
  const group = new THREE.Group();
  group.name = 'KronoxLuminousEntity3D';

  // Radial glow texture
  let glowMap = null;
  if (typeof document !== 'undefined') {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const gCtx = glowCanvas.getContext('2d');
    const grad = gCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.22, 'rgba(111, 240, 255, 0.92)');
    grad.addColorStop(0.55, 'rgba(14, 165, 233, 0.42)');
    grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, 128, 128);
    glowMap = new THREE.CanvasTexture(glowCanvas);
  }

  // 1. Luminous Inner Core Sphere
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.96,
  });
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 28, 24), coreMat);
  group.add(coreMesh);

  // 2. Volumetric Energy Halo Sprite
  const haloMat = new THREE.SpriteMaterial({
    map: glowMap,
    color: 0x6ff0ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloSprite = new THREE.Sprite(haloMat);
  haloSprite.scale.setScalar(1.15);
  group.add(haloSprite);

  // 3. Four-Pointed Astral Star Core (3D Octahedral Star)
  const starGroup = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
  });
  const rayV = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), starMat);
  rayV.scale.set(0.28, 1.25, 0.28);
  const rayH = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), starMat);
  rayH.scale.set(1.25, 0.28, 0.28);
  const rayZ = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), starMat);
  rayZ.scale.set(0.28, 0.28, 1.25);
  starGroup.add(rayV, rayH, rayZ);
  group.add(starGroup);

  // 4. Three Gyroscopic Orbital Rings (matching original Kronox orb identity)
  const ringMat1 = new THREE.MeshBasicMaterial({
    color: 0x6ff0ff,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
  });
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.64,
    blending: THREE.AdditiveBlending,
  });
  const ringMat3 = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
  });

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.009, 12, 64), ringMat1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.008, 12, 64), ringMat2);
  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.007, 12, 64), ringMat3);
  ring1.rotation.x = Math.PI * 0.32;
  ring2.rotation.y = Math.PI * 0.38;
  ring3.rotation.z = Math.PI * 0.25;
  group.add(ring1, ring2, ring3);

  // 5. Orbiting Light Sparks / Particles
  const sparkCount = 36;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkPhases = [];
  for (let i = 0; i < sparkCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.28 + Math.random() * 0.36;
    sparkPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    sparkPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    sparkPositions[i * 3 + 2] = r * Math.cos(phi);
    sparkPhases.push({ theta, phi, r, speed: 0.8 + Math.random() * 1.6 });
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMat = new THREE.PointsMaterial({
    map: glowMap,
    color: 0xa5f3fc,
    size: 0.11,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  group.add(sparks);

  // 6. Dynamic Light Trail (wake behind the entity when moving)
  const trailLen = 18;
  const trailPositions = new Float32Array(trailLen * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
  });
  const trailLine = new THREE.Line(trailGeo, trailMat);
  // Trail is kept in cabin space so it forms a true spatial wake

  // 7. Real 3D Pointing Energy Beam (connects entity to pointed console or star direction)
  const beamPositions = new Float32Array(6);
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
  const beamMat = new THREE.LineBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const pointingBeam = new THREE.Line(beamGeo, beamMat);

  // Point light cast onto cabin walls and consoles
  const entityLight = new THREE.PointLight(0x38bdf8, 1.6, 9.5);
  group.add(entityLight);

  // Internal state
  const currentPos = new THREE.Vector3(1.1, 1.72, -4.6);
  const targetPos = new THREE.Vector3(1.1, 1.72, -4.6);
  const pointedTargetPos = new THREE.Vector3();
  let hasPointedTarget = false;
  let state = 'Reposo';
  let clock = 0;
  const historyPoints = Array.from({ length: trailLen }, () => currentPos.clone());

  group.position.copy(currentPos);

  function setTargetPosition(vec, newState = null) {
    if (vec) targetPos.copy(vec);
    if (newState && KRONOX_LUMINOUS_STATES.includes(newState)) {
      state = newState;
    }
  }

  function pointAtWorldPosition(vec, explainText = false) {
    if (!vec) {
      hasPointedTarget = false;
      state = 'Reposo';
      return;
    }
    pointedTargetPos.copy(vec);
    hasPointedTarget = true;
    state = explainText ? 'Explicación' : 'Señalización';
  }

  function setState(newState) {
    if (KRONOX_LUMINOUS_STATES.includes(newState)) {
      state = newState;
      if (newState !== 'Señalización' && newState !== 'Explicación') {
        hasPointedTarget = false;
      }
    }
  }

  function update(dt, elapsedOrOptions = {}, speakingArg = false, audioLevelArg = 0.1) {
    const isObj = elapsedOrOptions && typeof elapsedOrOptions === 'object';
    const speaking = isObj ? Boolean(elapsedOrOptions.speaking) : Boolean(speakingArg);
    const audioLevel = isObj ? (elapsedOrOptions.audioLevel ?? 0.1) : (audioLevelArg ?? 0.1);
    const astronautPos = isObj ? elapsedOrOptions.astronautPos : null;
    const followAstronaut = isObj ? Boolean(elapsedOrOptions.followAstronaut) : false;
    clock += dt;

    // If in Acompañamiento mode and astronaut moves, glide alongside at comfortable shoulder height
    if (followAstronaut && astronautPos && state !== 'Señalización') {
      const desired = new THREE.Vector3(
        Math.max(-5.2, Math.min(5.2, astronautPos.x + 1.35)),
        1.72,
        Math.max(-9.8, Math.min(7.2, astronautPos.z - 1.5)),
      );
      targetPos.lerp(desired, dt * 2.5);
    }

    // Clamp targetPos inside walkable bridge bounds so Kronox IA never passes through walls or ceiling
    targetPos.x = Math.max(-5.8, Math.min(5.8, targetPos.x));
    targetPos.y = Math.max(1.15, Math.min(3.55, targetPos.y));
    targetPos.z = Math.max(-10.8, Math.min(8.8, targetPos.z));

    const distToTarget = currentPos.distanceTo(targetPos);
    const speedFactor = distToTarget > 0.25 ? 3.4 : 1.8;
    currentPos.lerp(targetPos, Math.min(1, dt * speedFactor));

    // Prevent currentPos from intersecting central console pedestals while gliding across the bridge
    const navConsoleCenter = new THREE.Vector2(0, -7.35);
    const distToNavConsole = Math.hypot(
      currentPos.x - navConsoleCenter.x,
      currentPos.z - navConsoleCenter.y,
    );
    if (distToNavConsole < 1.05 && currentPos.y < 1.65) {
      currentPos.y = 1.72;
    }

    // Gentle harmonic float
    const floatY = Math.sin(clock * 2.4) * 0.065;
    group.position.set(currentPos.x, currentPos.y + floatY, currentPos.z);

    // Orient starGroup / entity towards pointed target or movement direction
    if (hasPointedTarget) {
      const dir = pointedTargetPos.clone().sub(group.position);
      if (dir.lengthSq() > 1e-4) {
        group.rotation.y = Math.atan2(dir.x, dir.z);
      }
    } else if (distToTarget > 0.15) {
      const moveDir = targetPos.clone().sub(currentPos);
      if (moveDir.lengthSq() > 1e-4) {
        group.rotation.y = Math.atan2(moveDir.x, moveDir.z);
      }
    }

    // Effective animation state
    const activeState =
      distToTarget > 0.45
        ? 'Desplazamiento'
        : speaking && (state === 'Reposo' || state === 'Acompañamiento')
          ? 'Comunicación'
          : state;

    // Color & pulsation modulation by state
    let ringSpeed = 1.0;
    let pulseScale = 1.0 + Math.sin(clock * 3.2) * 0.06;
    let targetColor = 0x38bdf8;

    if (activeState === 'Comunicación' || speaking) {
      ringSpeed = 2.4;
      pulseScale = 1.08 + audioLevel * 0.55 + Math.abs(Math.sin(clock * 14)) * 0.12;
      targetColor = 0x6ff0ff;
    } else if (activeState === 'Escucha') {
      ringSpeed = 0.65;
      pulseScale = 0.96 + Math.sin(clock * 5.0) * 0.08;
      targetColor = 0xa78bfa;
    } else if (activeState === 'Señalización' || activeState === 'Explicación') {
      ringSpeed = 1.9;
      pulseScale = 1.12 + Math.sin(clock * 4.5) * 0.09;
      targetColor = 0xfef08a;
    } else if (activeState === 'Celebración') {
      ringSpeed = 3.6;
      pulseScale = 1.22 + Math.sin(clock * 9.0) * 0.16;
      targetColor = 0x34d399;
    } else if (activeState === 'Desplazamiento') {
      ringSpeed = 2.8;
      pulseScale = 1.05;
      targetColor = 0x38bdf8;
    }

    coreMesh.scale.setScalar(pulseScale);
    starGroup.scale.setScalar(pulseScale * 1.05);
    starGroup.rotation.y = clock * 1.4 * ringSpeed;
    starGroup.rotation.z = Math.sin(clock * 0.9) * 0.4;
    haloSprite.scale.setScalar(1.15 * pulseScale);
    haloMat.color.setHex(targetColor);
    entityLight.color.setHex(targetColor);
    entityLight.intensity = 1.35 + (pulseScale - 1.0) * 2.2;

    ring1.rotation.z += dt * 1.2 * ringSpeed;
    ring1.rotation.x = Math.PI * 0.32 + Math.sin(clock * 1.1) * 0.22;
    ring2.rotation.x += dt * -1.45 * ringSpeed;
    ring2.rotation.y = Math.PI * 0.38 + Math.cos(clock * 0.9) * 0.25;
    ring3.rotation.y += dt * 1.75 * ringSpeed;

    // Update orbiting sparks
    const posAttr = sparkGeo.attributes.position;
    for (let i = 0; i < sparkCount; i++) {
      const sp = sparkPhases[i];
      const t = clock * sp.speed * ringSpeed + sp.theta;
      const r = sp.r * (0.92 + 0.18 * Math.sin(clock * 2 + i));
      posAttr.setXYZ(
        i,
        r * Math.sin(sp.phi) * Math.cos(t),
        r * Math.sin(sp.phi) * Math.sin(t),
        r * Math.cos(sp.phi),
      );
    }
    posAttr.needsUpdate = true;

    // Update spatial wake trail
    historyPoints.pop();
    historyPoints.unshift(group.position.clone());
    const tAttr = trailGeo.attributes.position;
    for (let i = 0; i < trailLen; i++) {
      const p = historyPoints[i];
      tAttr.setXYZ(i, p.x, p.y, p.z);
    }
    tAttr.needsUpdate = true;

    // Update 3D pointing beam
    if (hasPointedTarget) {
      const bAttr = beamGeo.attributes.position;
      bAttr.setXYZ(0, group.position.x, group.position.y, group.position.z);
      bAttr.setXYZ(1, pointedTargetPos.x, pointedTargetPos.y, pointedTargetPos.z);
      bAttr.needsUpdate = true;
      beamMat.opacity = Math.min(0.85, beamMat.opacity + dt * 4);
    } else {
      beamMat.opacity = Math.max(0, beamMat.opacity - dt * 4);
    }

    return activeState;
  }

  return {
    group,
    trailLine,
    pointingBeam,
    update,
    setTargetPosition,
    pointAtWorldPosition,
    setState,
    getState: () => state,
    getPosition: () => group.position.clone(),
    getPointedTarget: () => (hasPointedTarget ? pointedTargetPos.clone() : null),
  };
}

/**
 * Builds the 1.75 m Human Astronaut Model (Section 3 & Section 7):
 * - Visible full body when in 3rd-person cabin view.
 * - Visible articulated first-person spacesuit forearms/hands when in 1st-person view.
 */
export function createAstronautModel3D() {
  const root = new THREE.Group();
  root.name = 'KronoxAstronaut175m';

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.42,
    metalness: 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.3,
    metalness: 0.55,
    emissive: 0x0369a1,
    emissiveIntensity: 0.25,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.88,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.22,
  });

  // Full 3rd-person body group (1.75 m total height)
  const thirdPersonBody = new THREE.Group();

  // Legs (0.0 m to 0.82 m)
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.78, 14), suitMat);
  leftLeg.position.set(-0.12, 0.39, 0);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.78, 14), suitMat);
  rightLeg.position.set(0.12, 0.39, 0);
  thirdPersonBody.add(leftLeg, rightLeg);

  // Torso (0.78 m to 1.44 m)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.64, 0.26), suitMat);
  torso.position.set(0, 1.11, 0);
  const lifeSupportPack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.16), trimMat);
  lifeSupportPack.position.set(0, 1.14, 0.19);
  thirdPersonBody.add(torso, lifeSupportPack);

  // Arms
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.58, 12), suitMat);
  leftArm.position.set(-0.27, 1.1, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.58, 12), suitMat);
  rightArm.position.set(0.27, 1.1, 0);
  thirdPersonBody.add(leftArm, rightArm);

  // Helmet (1.46 m to 1.75 m; eyes at 1.65 m)
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 20), suitMat);
  helmet.position.set(0, 1.6, 0);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.142, 20, 16), visorMat);
  visor.position.set(0, 1.61, -0.045);
  thirdPersonBody.add(helmet, visor);

  root.add(thirdPersonBody);

  // First-person hands/forearms group (attached below eye level in 1st-person view)
  const firstPersonHands = new THREE.Group();
  const fpLeftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.34, 12), suitMat);
  fpLeftForearm.rotation.x = Math.PI * 0.38;
  fpLeftForearm.rotation.z = -0.18;
  fpLeftForearm.position.set(-0.24, -0.28, -0.38);

  const fpRightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.34, 12), suitMat);
  fpRightForearm.rotation.x = Math.PI * 0.38;
  fpRightForearm.rotation.z = 0.18;
  fpRightForearm.position.set(0.24, -0.28, -0.38);

  const fpLeftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), trimMat);
  fpLeftGlove.position.set(-0.21, -0.21, -0.52);
  const fpRightGlove = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), trimMat);
  fpRightGlove.position.set(0.21, -0.21, -0.52);

  firstPersonHands.add(fpLeftForearm, fpRightForearm, fpLeftGlove, fpRightGlove);

  let walkClock = 0;
  function updateAnimation(dt, isMoving, speedMagnitude, firstPerson = true) {
    thirdPersonBody.visible = !firstPerson;
    firstPersonHands.visible = firstPerson;
    if (isMoving) {
      walkClock += dt * Math.max(4, speedMagnitude * 1.6);
      const swing = Math.sin(walkClock) * 0.32;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.8;
      rightArm.rotation.x = swing * 0.8;
      firstPersonHands.position.y = Math.sin(walkClock * 2) * 0.012;
      firstPersonHands.position.x = Math.cos(walkClock) * 0.01;
    } else {
      leftLeg.rotation.x *= 0.85;
      rightLeg.rotation.x *= 0.85;
      leftArm.rotation.x *= 0.85;
      rightArm.rotation.x *= 0.85;
      firstPersonHands.position.y *= 0.85;
      firstPersonHands.position.x *= 0.85;
    }
  }

  return {
    root,
    thirdPersonBody,
    firstPersonHands,
    updateAnimation,
  };
}

/**
 * Builds the Habitable 3D Ship Interior Architecture (`1 unit = 1 meter`).
 * Includes:
 * - Main Bridge Deck (`14 m` wide × `20 m` long × `4.2 m` ceiling height)
 * - Aft Corridor leading towards the engineering bulkhead (`+Z`)
 * - Panoramic Forward Observation Windows (`-Z`) with structural titanium ribs
 * - 5 Physical 3D Consoles with emissive interactive screens and proximity rings
 * - Interior lighting, ceiling ribs, floor walkways, and collision bounds.
 */
export function buildHabitableCabin3D() {
  const cabinRoot = new THREE.Group();
  cabinRoot.name = 'KronoxHabitableCabin1to1';

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.65,
    metalness: 0.45,
  });
  const walkwayMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.55,
  });
  const bulkheadMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.65,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.78,
  });
  const neonStripMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.14,
    roughness: 0.1,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // 1. Bridge Main Floor (14 m wide x 24 m long)
  const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 24), deckMat);
  mainFloor.position.set(0, -0.1, -1);
  cabinRoot.add(mainFloor);

  // Illuminated Central Walkway & Station Paths
  const centerWalkway = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 21), walkwayMat);
  centerWalkway.position.set(0, 0.01, -1);
  cabinRoot.add(centerWalkway);

  const crossWalkway = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.02, 2.4), walkwayMat);
  crossWalkway.position.set(0, 0.01, -2.2);
  cabinRoot.add(crossWalkway);

  // Floor LED Guide Strips
  [-1.32, 1.32].forEach((x) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 20.5), neonStripMat);
    strip.position.set(x, 0.015, -1);
    cabinRoot.add(strip);
  });

  // 2. Ceiling Structure (Height = 4.2 m) with Open Starlight Skylight & Structural Ribs
  const leftCeiling = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 24), bulkheadMat);
  leftCeiling.position.set(-4.9, 4.2, -1);
  const rightCeiling = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 24), bulkheadMat);
  rightCeiling.position.set(4.9, 4.2, -1);
  cabinRoot.add(leftCeiling, rightCeiling);

  // Structural Arch Ribs every 3.5 meters
  for (let z = -10.5; z <= 9.5; z += 3.5) {
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(14, 0.26, 0.32), ribMat);
    topBeam.position.set(0, 4.1, z);
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 4.2, 0.36), ribMat);
    leftPillar.position.set(-6.8, 2.1, z);
    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 4.2, 0.36), ribMat);
    rightPillar.position.set(6.8, 2.1, z);
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.04, 0.08), neonStripMat);
    lightBar.position.set(0, 3.95, z);
    cabinRoot.add(topBeam, leftPillar, rightPillar, lightBar);
  }

  // 3. Port & Starboard Walls with Observation Windows
  // Lower solid dado wall (0 to 1.1 m) and upper wall (3.2 to 4.2 m) leaving panoramic side windows
  [-6.95, 6.95].forEach((x) => {
    const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 24), bulkheadMat);
    lowerWall.position.set(x, 0.575, -1);
    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 24), bulkheadMat);
    upperWall.position.set(x, 3.7, -1);
    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(23.6, 2.05), glassMat);
    sideGlass.rotation.y = Math.PI / 2;
    sideGlass.position.set(x * 0.99, 2.15, -1);
    cabinRoot.add(lowerWall, upperWall, sideGlass);
  });

  // 4. Aft Bulkhead & Airlock Door (`z = +10.8 m`, where the camera enters during the intro)
  const aftWallLeft = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.28), bulkheadMat);
  aftWallLeft.position.set(-4.4, 2.1, 10.8);
  const aftWallRight = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.28), bulkheadMat);
  aftWallRight.position.set(4.4, 2.1, 10.8);
  const aftHeader = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 0.28), bulkheadMat);
  aftHeader.position.set(0, 3.5, 10.8);
  const airlockFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2.8, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 }),
  );
  airlockFrame.position.set(0, 1.4, 10.95);
  cabinRoot.add(aftWallLeft, aftWallRight, aftHeader, airlockFrame);

  // 5. Bow Panoramic Observation Dome (`z = -12.2 m`)
  const bowLowerLip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.85, 0.28), bulkheadMat);
  bowLowerLip.position.set(0, 0.425, -12.2);
  const bowUpperLip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.65, 0.28), bulkheadMat);
  bowUpperLip.position.set(0, 3.88, -12.2);
  const bowGlass = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 2.7), glassMat);
  bowGlass.position.set(0, 2.2, -12.15);
  cabinRoot.add(bowLowerLip, bowUpperLip, bowGlass);

  // Angled bow window mullions
  [-4.2, -1.8, 1.8, 4.2].forEach((x) => {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.18), ribMat);
    mullion.position.set(x, 2.1, -12.12);
    cabinRoot.add(mullion);
  });

  // 6. Build the 5 Physical Interactive 3D Consoles
  const stationMeshes = [];
  const stationColliders = [];

  PHYSICAL_CABIN_STATIONS.forEach((st) => {
    const stationGroup = new THREE.Group();
    stationGroup.position.copy(st.consolePos);
    if (st.rotationY) stationGroup.rotation.y = st.rotationY;
    stationGroup.userData.cabinStationId = st.id;
    stationGroup.userData.stationId = st.id;

    // Pedestal base
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.95, 0.85),
      new THREE.MeshStandardMaterial({
        color: 0x111c2d,
        metalness: 0.72,
        roughness: 0.32,
      }),
    );
    pedestal.position.y = -0.45;
    stationGroup.add(pedestal);

    // Slanted control desk surface
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.12, 0.96),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.65,
        roughness: 0.28,
        emissive: st.color,
        emissiveIntensity: 0.12,
      }),
    );
    desk.rotation.x = 0.26;
    desk.position.set(0, 0.05, 0.05);
    stationGroup.add(desk);

    // Holographic / Diegetic 3D Screen Display mounted above the console
    const screenTex = createConsoleScreenTexture(st);
    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTex,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
    });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.14), screenMat);
    screenMesh.position.set(0, 0.76, -0.18);
    screenMesh.rotation.x = -0.12;
    screenMesh.userData.cabinStationId = st.id;
    screenMesh.userData.stationId = st.id;
    stationGroup.add(screenMesh);

    // Glowing floor proximity pad where the astronaut stands
    const floorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.78, 36),
      new THREE.MeshBasicMaterial({
        color: st.color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.set(0, -0.93, 1.15);
    stationGroup.add(floorRing);

    cabinRoot.add(stationGroup);
    stationMeshes.push({
      id: st.id,
      station: st,
      group: stationGroup,
      screenMesh,
      floorRing,
      updateScreen: (extraLine) => {
        screenMat.map = createConsoleScreenTexture(st, extraLine);
        screenMat.needsUpdate = true;
      },
    });

    // Register physical bounding box for collision detection
    stationColliders.push({
      id: st.id,
      center: st.consolePos.clone(),
      radius: 0.95,
    });
  });

  // Interior Bridge Lighting
  const bridgeAmbient = new THREE.PointLight(0xbae6fd, 1.35, 28);
  bridgeAmbient.position.set(0, 3.6, -2.5);
  const bowLight = new THREE.PointLight(0x38bdf8, 1.1, 18);
  bowLight.position.set(0, 2.8, -9.5);
  const aftLight = new THREE.PointLight(0x818cf8, 0.9, 16);
  aftLight.position.set(0, 3.2, 6.5);
  cabinRoot.add(bridgeAmbient, bowLight, aftLight);

  /**
   * Resolves astronaut collision against cabin walls and physical 3D consoles.
   * Mutates `pos` (in cabin local meters) to keep the astronaut inside walkable bounds.
   */
  function clampAstronautPosition(pos) {
    const r = SHIP_WORLD_UNITS.ASTRONAUT_RADIUS_METERS;
    // Outer wall bounds
    pos.x = Math.max(-6.35 + r, Math.min(6.35 - r, pos.x));
    pos.z = Math.max(-11.25 + r, Math.min(9.85 - r, pos.z));
    pos.y = 0;

    // Physical console colliders
    for (const col of stationColliders) {
      const dx = pos.x - col.center.x;
      const dz = pos.z - col.center.z;
      const dist = Math.hypot(dx, dz);
      const minSep = col.radius + r;
      if (dist < minSep && dist > 1e-5) {
        const push = (minSep - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
    return pos;
  }

  /**
   * Finds the nearest physical station within interactive reach (2.45 meters).
   */
  function findNearestInteractiveStation(astronautPos) {
    let best = null;
    let bestDist = 2.45;
    for (const st of PHYSICAL_CABIN_STATIONS) {
      const d = Math.hypot(astronautPos.x - st.position.x, astronautPos.z - st.position.z);
      if (d < bestDist) {
        bestDist = d;
        best = {
          ...st,
          station: st,
          distance: Number(d.toFixed(2)),
          distanceMeters: Number(d.toFixed(2)),
        };
      }
    }
    return best;
  }

  function updateStations(elapsedTime = 0, nearStationId = null, activeStationId = null) {
    stationMeshes.forEach((entry, idx) => {
      const isNear = entry.id === nearStationId;
      const isActive = entry.id === activeStationId;
      const pulse = 0.55 + Math.sin(elapsedTime * 3.2 + idx) * 0.18;
      if (entry.floorRing?.material) {
        entry.floorRing.material.opacity = isActive ? 0.95 : isNear ? 0.85 : pulse * 0.65;
      }
      if (entry.floorRing) {
        entry.floorRing.scale.setScalar(isActive || isNear ? 1.08 : 1.0);
      }
    });
  }

  return {
    cabinRoot,
    stationMeshes,
    clampAstronautPosition,
    findNearestInteractiveStation,
    updateStations,
  };
}
