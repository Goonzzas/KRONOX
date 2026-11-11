import * as THREE from 'three';

/**
 * Reconstrucción 3D optimizada del observatorio espacial SPHEREx de NASA/JPL.
 *
 * Parámetros reales de referencia (lanzamiento marzo 2025):
 * - Dimensiones aproximadas: ~2.6 m de altura × ~3.2 m de diámetro máximo en los escudos.
 * - Tres escudos fotónicos cónicos concéntricos (1.7 m de altura, hasta 3.2 m de diámetro).
 * - Radiador criogénico de ranura en V (V-groove radiator) de 3 etapas bajo los escudos.
 * - Telescopio fuera de eje (off-axis) de aluminio de 20 cm de apertura efectiva con
 *   divisor dicroico y dos planos focales infrarrojos (0.75 a 5.0 μm, 102 bandas espectrales).
 * - Bus hexagonal/octagonal con aislamiento térmico multicapa (MLI dorado) y montantes bipode.
 * - Panel solar único fijo (~2.67 m × 1.02 m).
 * - Órbita terrestre baja polar heliosíncrona simulada (~650 km de altitud nominal,
 *   período ~98 minutos, inclinación ~98°).
 */
export const SPHEREX_ORBIT_SPEC = Object.freeze({
  missionName: 'SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer)',
  launchDate: '2025-03',
  nominalAltitudeKm: 650,
  earthRadiusKm: 6371,
  orbitalPeriodMinutes: 98,
  inclinationDeg: 98.0,
  spectralRangeMicrons: [0.75, 5.0],
  spectralBands: 102,
  apertureCm: 20,
  shieldDiameterMeters: 3.2,
  shieldHeightMeters: 1.7,
  totalHeightMeters: 2.6,
  solarPanelMeters: [2.67, 1.02],
  isSimulatedOrbit: true,
  simulationNotice: 'Órbita polar heliosíncrona simulada (~650 km, 98 min) basada en parámetros nominales de misión NASA/JPL.',
});

export function createSpherexObservatory3D() {
  const root = new THREE.Group();
  root.name = 'SPHEREx_Observatory_3D';
  root.userData = {
    spherexObservatory: true,
    name: 'Observatorio Espacial SPHEREx (NASA)',
    orbitSpec: SPHEREX_ORBIT_SPEC,
  };

  // Escala interna del modelo: 1 unidad local = 1 metro del observatorio (altura ~2.6 m, ancho ~3.2 m).
  // El nodo padre ajusta root.scale según la escala de la escena.
  const modelGroup = new THREE.Group();
  root.add(modelGroup);

  // Materiales principales optimizados
  const outerShieldMat = new THREE.MeshStandardMaterial({
    color: 0xdce6f2,
    metalness: 0.62,
    roughness: 0.28,
    side: THREE.DoubleSide,
  });
  const midShieldMat = new THREE.MeshStandardMaterial({
    color: 0xeaf2fc,
    metalness: 0.74,
    roughness: 0.22,
    side: THREE.DoubleSide,
  });
  const innerShieldMat = new THREE.MeshStandardMaterial({
    color: 0xf5f9ff,
    metalness: 0.82,
    roughness: 0.16,
    side: THREE.DoubleSide,
  });
  const shieldRimMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.85,
    roughness: 0.18,
  });
  const vGrooveMat = new THREE.MeshStandardMaterial({
    color: 0xc5d3e6,
    metalness: 0.78,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  const goldMliMat = new THREE.MeshStandardMaterial({
    color: 0xd89b2b,
    emissive: 0x2a1800,
    emissiveIntensity: 0.18,
    metalness: 0.82,
    roughness: 0.32,
  });
  const busStructureMat = new THREE.MeshStandardMaterial({
    color: 0x243042,
    metalness: 0.68,
    roughness: 0.36,
  });
  const whiteRadiatorMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf5,
    metalness: 0.3,
    roughness: 0.42,
  });
  const strutMat = new THREE.MeshStandardMaterial({
    color: 0x1b2230,
    metalness: 0.75,
    roughness: 0.3,
  });
  const opticsAluminumMat = new THREE.MeshStandardMaterial({
    color: 0xb8c7db,
    metalness: 0.88,
    roughness: 0.18,
  });
  const detectorGlowMat = new THREE.MeshBasicMaterial({
    color: 0x5ce6ff,
    transparent: true,
    opacity: 0.85,
  });
  const solarCellMat = new THREE.MeshStandardMaterial({
    color: 0x0e274c,
    emissive: 0x071833,
    emissiveIntensity: 0.25,
    metalness: 0.58,
    roughness: 0.24,
  });
  const solarFrameMat = new THREE.MeshStandardMaterial({
    color: 0x9fb0c7,
    metalness: 0.72,
    roughness: 0.28,
  });

  // ============================================================================
  // 1. TRES ESCUDOS FOTÓNICOS CÓNICOS CONCÉNTRICOS (Photon Shields)
  // ============================================================================
  const photonShieldGroup = new THREE.Group();
  photonShieldGroup.name = 'PhotonShields';
  modelGroup.add(photonShieldGroup);

  const shieldSpecs = [
    // [radioSuperior, radioInferior, altura, yCentro, material]
    [1.60, 0.76, 1.68, 0.56, outerShieldMat],
    [1.32, 0.62, 1.54, 0.58, midShieldMat],
    [1.04, 0.48, 1.40, 0.60, innerShieldMat],
  ];

  for (let i = 0; i < shieldSpecs.length; i++) {
    const [rTop, rBot, height, yPos, mat] = shieldSpecs[i];
    const coneGeo = new THREE.CylinderGeometry(rTop, rBot, height, 40, 1, true);
    const coneMesh = new THREE.Mesh(coneGeo, mat);
    coneMesh.position.y = yPos;
    photonShieldGroup.add(coneMesh);

    // Anillo de refuerzo en el borde superior de cada escudo cónico
    const rimGeo = new THREE.TorusGeometry(rTop, 0.018, 10, 40);
    rimGeo.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, shieldRimMat);
    rimMesh.position.y = yPos + height * 0.5;
    photonShieldGroup.add(rimMesh);
  }

  // Costillas longitudinales externas del escudo fotónico (visibles en las fotos de JPL)
  const ribCount = 12;
  const outerSlopeAngle = Math.atan2(1.60 - 0.76, 1.68);
  const ribLength = Math.hypot(1.60 - 0.76, 1.68);
  const ribGeo = new THREE.CylinderGeometry(0.012, 0.012, ribLength, 6);
  for (let i = 0; i < ribCount; i++) {
    const theta = (i / ribCount) * Math.PI * 2;
    const midRadius = (1.60 + 0.76) * 0.5 + 0.01;
    const rib = new THREE.Mesh(ribGeo, shieldRimMat);
    rib.position.set(Math.cos(theta) * midRadius, 0.56, Math.sin(theta) * midRadius);
    rib.rotation.y = -theta;
    rib.rotation.z = -outerSlopeAngle;
    photonShieldGroup.add(rib);
  }

  // ============================================================================
  // 2. SISTEMA DE RADIADORES CRIOGÉNICOS V-GROOVE (3 etapas bajo los escudos)
  // ============================================================================
  const vGrooveGroup = new THREE.Group();
  vGrooveGroup.name = 'VGrooveRadiators';
  modelGroup.add(vGrooveGroup);

  for (let stage = 0; stage < 3; stage++) {
    const rOuter = 0.88 - stage * 0.09;
    const rInner = 0.42 - stage * 0.04;
    const yStage = -0.30 - stage * 0.095;
    const vgGeo = new THREE.CylinderGeometry(rOuter, rInner, 0.07, 32, 1, true);
    const vgMesh = new THREE.Mesh(vgGeo, vGrooveMat);
    vgMesh.position.y = yStage;
    vGrooveGroup.add(vgMesh);
  }

  // ============================================================================
  // 3. TELESCOPIO ÓPTICO FUERA DE EJE (20 cm) Y CÁMARA DE PLANO FOCAL
  // ============================================================================
  const opticsGroup = new THREE.Group();
  opticsGroup.name = 'OpticalTelescopeAssembly';
  modelGroup.add(opticsGroup);

  // Banco óptico criogénico
  const opticalBench = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.46, 0.24, 24),
    opticsAluminumMat,
  );
  opticalBench.position.y = -0.02;
  opticsGroup.add(opticalBench);

  // Tubo deflector (baffle) del telescopio de aluminio fuera de eje (20 cm de apertura efectiva)
  const primaryBaffle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.19, 0.78, 28, 1, true),
    opticsAluminumMat,
  );
  primaryBaffle.position.set(0.08, 0.46, 0);
  primaryBaffle.rotation.z = -0.06;
  opticsGroup.add(primaryBaffle);

  // Espejo primario / apertura óptica interna con reflejo dicroico infrarrojo
  const primaryMirror = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 24),
    detectorGlowMat,
  );
  primaryMirror.rotation.x = -Math.PI / 2;
  primaryMirror.position.set(0.08, 0.22, 0);
  opticsGroup.add(primaryMirror);

  // Caja del divisor de haz dicroico y detectores NIR/SWIR (0.75 - 5.0 um)
  const focalPlaneBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.26, 0.34),
    goldMliMat,
  );
  focalPlaneBox.position.set(-0.18, 0.22, 0);
  opticsGroup.add(focalPlaneBox);

  // ============================================================================
  // 4. MONTANTES BIPODE DE AISLAMIENTO TÉRMICO (Hexapod Bipod Struts)
  // ============================================================================
  const strutsGroup = new THREE.Group();
  strutsGroup.name = 'BipodStruts';
  modelGroup.add(strutsGroup);

  const bipodPairs = 6;
  const strutCylGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.62, 8);
  for (let i = 0; i < bipodPairs; i++) {
    const baseAngle = (i / bipodPairs) * Math.PI * 2;
    for (const dir of [-1, 1]) {
      const strut = new THREE.Mesh(strutCylGeo, strutMat);
      const rMid = 0.64;
      const angle = baseAngle + dir * 0.14;
      strut.position.set(Math.cos(angle) * rMid, -0.58, Math.sin(angle) * rMid);
      strut.rotation.y = -angle;
      strut.rotation.x = dir * 0.32;
      strut.rotation.z = 0.22;
      strutsGroup.add(strut);
    }
  }

  // ============================================================================
  // 5. CUERPO DEL SATÉLITE (Spacecraft Bus con mantas térmicas MLI doradas)
  // ============================================================================
  const busGroup = new THREE.Group();
  busGroup.name = 'SpacecraftBus';
  modelGroup.add(busGroup);

  // Cuerpo principal octagonal cubierto de MLI dorado
  const mainBus = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.58, 0.56, 8),
    goldMliMat,
  );
  mainBus.position.y = -0.88;
  busGroup.add(mainBus);

  // Paneles radiadores laterales blancos/metálicos en el bus
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const radPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.42, 0.04),
      i % 2 === 0 ? whiteRadiatorMat : busStructureMat,
    );
    radPanel.position.set(Math.cos(angle) * 0.58, -0.88, Math.sin(angle) * 0.58);
    radPanel.rotation.y = -angle + Math.PI / 2;
    busGroup.add(radPanel);
  }

  // Anillo adaptador de lanzamiento y módulo nadir (como se aprecia en la base del satélite)
  const nadirCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.42, 0.28, 24),
    whiteRadiatorMat,
  );
  nadirCylinder.position.y = -1.24;
  busGroup.add(nadirCylinder);

  const nadirCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.28, 0.12, 24),
    busStructureMat,
  );
  nadirCap.position.y = -1.42;
  busGroup.add(nadirCap);

  // Antena de alta ganancia en banda Ka / S y sensores de estrellas (Star Trackers)
  const kaDish = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.12, 20, 1, true),
    whiteRadiatorMat,
  );
  kaDish.position.set(0.34, -1.28, 0.26);
  kaDish.rotation.x = Math.PI * 0.85;
  busGroup.add(kaDish);

  for (const side of [-1, 1]) {
    const starTracker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.04, 0.16, 12),
      busStructureMat,
    );
    starTracker.position.set(-0.56, -0.78, side * 0.24);
    starTracker.rotation.z = Math.PI * 0.38;
    busGroup.add(starTracker);
  }

  // ============================================================================
  // 6. PANEL SOLAR (2.67 m × 1.02 m)
  // ============================================================================
  const solarArrayGroup = new THREE.Group();
  solarArrayGroup.name = 'SolarArray';
  modelGroup.add(solarArrayGroup);

  // Brazo de soporte (yoke)
  const solarYoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.06, 0.18),
    solarFrameMat,
  );
  solarYoke.position.set(0.82, -0.88, 0);
  solarArrayGroup.add(solarYoke);

  // Marco del panel solar
  const panelWidth = 1.02;
  const panelLength = 2.67;
  const solarFrame = new THREE.Mesh(
    new THREE.BoxGeometry(panelLength, 0.035, panelWidth),
    solarFrameMat,
  );
  solarFrame.position.set(1.02 + panelLength * 0.35, -0.88, 0);
  solarFrame.rotation.x = 0.18;

  // Superficie fotovoltaica activa
  const solarCells = new THREE.Mesh(
    new THREE.PlaneGeometry(panelLength * 0.96, panelWidth * 0.94, 6, 2),
    solarCellMat,
  );
  solarCells.rotation.x = -Math.PI / 2;
  solarCells.position.y = 0.02;
  solarFrame.add(solarCells);

  const solarCellsBack = solarCells.clone();
  solarCellsBack.rotation.x = Math.PI / 2;
  solarCellsBack.position.y = -0.02;
  solarFrame.add(solarCellsBack);

  solarArrayGroup.add(solarFrame);

  // ============================================================================
  // 7. EFECTO VISUAL DE ADQUISICIÓN ESPECTRAL (Escena 2 / Inspección)
  // ============================================================================
  const spectralScanGroup = new THREE.Group();
  spectralScanGroup.name = 'SpectralAcquisitionEffect';
  spectralScanGroup.visible = false;
  modelGroup.add(spectralScanGroup);

  const scanConeMat = new THREE.MeshBasicMaterial({
    color: 0x4de8ff,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const scanCone = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 0.24, 5.2, 32, 1, true),
    scanConeMat,
  );
  scanCone.position.y = 3.1;
  spectralScanGroup.add(scanCone);

  // Anillos espectrales que representan la descomposición en 102 bandas infrarrojas (0.75–5.0 μm)
  const spectralColors = [0x58d5ff, 0x4ef2b8, 0xffd15c, 0xff6e54];
  const spectralRings = [];
  for (let i = 0; i < spectralColors.length; i++) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: spectralColors[i],
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const r = 0.55 + i * 0.48;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.045, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1.45 + i * 1.05;
    spectralScanGroup.add(ring);
    spectralRings.push({ mesh: ring, baseY: 1.45 + i * 1.05, baseR: r, mat: ringMat });
  }

  // Luz puntual sutil para iluminar el interior de los escudos durante la toma de datos
  const apertureLight = new THREE.PointLight(0x7be8ff, 0.9, 6.0);
  apertureLight.position.set(0, 1.1, 0);
  modelGroup.add(apertureLight);

  // Inclinación polar heliosíncrona (~98 grados respecto al plano ecuatorial/eclíptico)
  const inclinationRad = THREE.MathUtils.degToRad(SPHEREX_ORBIT_SPEC.inclinationDeg);
  const orbitNormal = new THREE.Vector3(
    0,
    Math.cos(inclinationRad),
    Math.sin(inclinationRad),
  ).normalize();
  const orbitBasisU = new THREE.Vector3(1, 0, 0);
  const orbitBasisV = new THREE.Vector3().crossVectors(orbitNormal, orbitBasisU).normalize();

  let currentOrbitAngle = 0.82; // Ángulo inicial sobre el limbo iluminado terrestre

  /**
   * Actualiza la posición orbital polar heliosíncrona alrededor de la Tierra
   * y anima el efecto de adquisición espectral cuando está activo.
   */
  function update({
    simDays = 0,
    elapsedTime = 0,
    earthRadius = 0.1,
    orbitRadius = null,
    scanning = false,
    cinematicAngleOverride = null,
  } = {}) {
    // Altitud orbital coherente alrededor de la Tierra (por encima de las nubes/atmósfera 3D)
    const rOrbit = orbitRadius ?? Math.max(earthRadius * 1.42, 0.045);

    // Período orbital real de SPHEREx: ~98 minutos = 14.69 órbitas por día
    const orbitsPerDay = (24 * 60) / SPHEREX_ORBIT_SPEC.orbitalPeriodMinutes;
    if (Number.isFinite(cinematicAngleOverride)) {
      currentOrbitAngle = cinematicAngleOverride;
    } else {
      currentOrbitAngle = 0.82 + simDays * orbitsPerDay * Math.PI * 2 + elapsedTime * 0.035;
    }

    const pos = new THREE.Vector3()
      .addScaledVector(orbitBasisU, Math.cos(currentOrbitAngle) * rOrbit)
      .addScaledVector(orbitBasisV, Math.sin(currentOrbitAngle) * rOrbit);

    root.position.copy(pos);

    // Orientación: el eje +Y del telescopio apunta radialmente hacia el cenit (alejándose de la Tierra)
    // para proteger el sistema óptico de la radiación infrarroja terrestre y solar.
    const zenith = pos.clone().normalize();
    const velocityDir = new THREE.Vector3()
      .addScaledVector(orbitBasisU, -Math.sin(currentOrbitAngle))
      .addScaledVector(orbitBasisV, Math.cos(currentOrbitAngle))
      .normalize();
    const rightDir = new THREE.Vector3().crossVectors(zenith, velocityDir).normalize();
    const correctedForward = new THREE.Vector3().crossVectors(rightDir, zenith).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(rightDir, zenith, correctedForward);
    root.quaternion.setFromRotationMatrix(rotMatrix);

    // Animar adquisición espectral si está activa
    spectralScanGroup.visible = Boolean(scanning);
    if (scanning) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 3.2);
      scanConeMat.opacity = 0.11 + pulse * 0.08;
      for (let i = 0; i < spectralRings.length; i++) {
        const item = spectralRings[i];
        const phase = ((elapsedTime * 0.55 + i * 0.25) % 1);
        item.mesh.position.y = 1.35 + phase * 3.8;
        const scale = 0.45 + phase * 1.45;
        item.mesh.scale.setScalar(scale);
        item.mat.opacity = Math.sin(phase * Math.PI) * 0.48;
      }
    }
  }

  return {
    root,
    modelGroup,
    photonShieldGroup,
    vGrooveGroup,
    opticsGroup,
    strutsGroup,
    busGroup,
    solarArrayGroup,
    spectralScanGroup,
    orbitSpec: SPHEREX_ORBIT_SPEC,
    update,
  };
}
