import * as THREE from 'three';

/**
 * KRONOX 120-Meter Modular Research Cruiser 3D Architecture.
 *
 * Implements a high-fidelity, scientifically credible deep-space exploration vessel:
 * - Reference Length: Strictly 120.0 meters (Z: -60.0m to +60.0m).
 * - Beam (Width): 18.0m (hull) / 32.0m (with deployed heat radiators).
 * - Draft (Height): 20.0m (hull) / 24.0m (with communication masts).
 * - Internal pressurized core: 14.0m wide x 16.0m high x 76.0m long,
 *   housing the 4 connected habitable decks within the armored hull.
 *
 * Architecture Modules (separated semantically):
 * 1. Command Module (Bow, Z: -42m to -60m)
 * 2. Structural Spine / Central Truss (Z: -42m to +35m)
 * 3. Pressurized Science Modules & SPHEREx Bay (Z: -20m to -42m)
 * 4. Habitat Modules & Crew Drums (Z: -18m to +12m)
 * 5. Engineering & Tokamak Plasma Core (Z: +12m to +44m)
 * 6. Radiator Thermal Arrays (32m span, Z: +8m to +32m)
 * 7. Engine Cluster (3 primary MPD plasma/ion nozzles + 8 RCS quad thrusters, Z: +44m to +60m)
 * 8. Auxiliary EVA Airlocks, Docking Collar & High-Gain Communications Dish
 */

export const SHIP_METRIC_DIMENSIONS = Object.freeze({
  LENGTH_METERS: 120.0,
  HULL_BEAM_METERS: 18.0,
  RADIATOR_BEAM_METERS: 32.0,
  HULL_HEIGHT_METERS: 20.0,
  PRESSURIZED_VOLUME_M3: 16500.0,
  DECK_COUNT: 4,
  MAX_CREW_CAPACITY: 12,
  PROPULSION_TYPE: 'Magnetoplasmadynamic / Dual Ion Thruster Cluster',
  STRUCTURAL_ALLOY: 'Titanium-Aluminide / Carbon-Nanotube Reinforced Matrix',
});

export function buildModularShip120M() {
  const root = new THREE.Group();
  root.name = 'KronoxModularResearchCruiser120M';

  // Master PBR Materials with aerospace surface differentiation
  const primaryArmorMat = new THREE.MeshStandardMaterial({
    color: 0x1e2738,
    metalness: 0.78,
    roughness: 0.38,
    name: 'ShipPrimaryArmorPlates',
  });

  const secondaryHullMat = new THREE.MeshStandardMaterial({
    color: 0x2d3a4f,
    metalness: 0.65,
    roughness: 0.46,
    name: 'SecondaryPlatingCeramic',
  });

  const structuralTrussMat = new THREE.MeshStandardMaterial({
    color: 0x161d2b,
    metalness: 0.90,
    roughness: 0.28,
    name: 'TitaniumSpineTruss',
  });

  // Multi-Layer Insulation (MLI) gold thermal foil for cryogenic science pods
  const goldFoilMliMat = new THREE.MeshStandardMaterial({
    color: 0xd4a017,
    emissive: 0x3d2806,
    emissiveIntensity: 0.18,
    metalness: 0.88,
    roughness: 0.24,
    name: 'MliGoldThermalInsulation',
  });

  const copperConduitMat = new THREE.MeshStandardMaterial({
    color: 0xb8652d,
    metalness: 0.82,
    roughness: 0.32,
    name: 'CryoCoolantPipesCopper',
  });

  const glassObservationMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe2ff,
    transparent: true,
    opacity: 0.22,
    roughness: 0.04,
    metalness: 0.08,
    transmission: 0.92,
    ior: 1.52,
    side: THREE.DoubleSide,
    name: 'ReinforcedObservationQuartzGlass',
  });

  const radiatorGrapheneMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    emissive: 0x2e1104,
    emissiveIntensity: 0.28,
    metalness: 0.92,
    roughness: 0.58,
    name: 'GrapheneThermalDissipationMatrix',
  });

  const hazardChevronMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.42,
    metalness: 0.25,
    name: 'HazardAirlockYellow',
  });

  const ionGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
    name: 'MpdIonPlasmaGlow',
  });

  const tokamakGlowMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.75,
    name: 'TokamakCherenkovField',
  });

  const beaconRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const beaconGreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const beaconWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

  // -------------------------------------------------------------
  // 1. MÓDULO DE MANDO Y NAVEGACIÓN (Proa, Z: -60.0m a -42.0m)
  // -------------------------------------------------------------
  const commandModule = new THREE.Group();
  commandModule.name = 'CommandModule';

  // Cuña frontal aerodinámica/deflectora facetada de titanio
  // Nariz afilada con punta exacta en Z = -60.0m
  const prowShape = new THREE.CylinderGeometry(0.12, 4.8, 12.0, 8);
  prowShape.rotateX(Math.PI / 2);
  const prowCone = new THREE.Mesh(prowShape, primaryArmorMat);
  prowCone.position.set(0, 0.4, -54.0); // Z de -60.0m a -48.0m
  commandModule.add(prowCone);

  // Cuerpo principal del puente de mando (Z: -48.0m a -42.0m)
  const bridgeHullGeo = new THREE.BoxGeometry(9.6, 5.8, 7.0);
  const bridgeHull = new THREE.Mesh(bridgeHullGeo, secondaryHullMat);
  bridgeHull.position.set(0, 0.8, -45.5);
  commandModule.add(bridgeHull);

  // Cúpula acristalada de observación (Mirador del puente con ventanales facetados)
  const cupolaGeo = new THREE.CylinderGeometry(3.6, 4.4, 2.8, 8, 1, false, 0, Math.PI);
  cupolaGeo.rotateZ(Math.PI);
  cupolaGeo.rotateX(Math.PI / 2);
  const cupolaGlass = new THREE.Mesh(cupolaGeo, glassObservationMat);
  cupolaGlass.position.set(0, 2.6, -46.5);
  commandModule.add(cupolaGlass);

  // Marco estructural de los ventanales de proa
  const mullionGeo = new THREE.BoxGeometry(0.24, 0.28, 3.8);
  [-1.8, 0, 1.8].forEach((x) => {
    const mullion = new THREE.Mesh(mullionGeo, structuralTrussMat);
    mullion.position.set(x, 3.4, -46.5);
    commandModule.add(mullion);
  });

  // Mástil dorsal de aviónica, antenas phased array y sensores LIDAR
  const avionicsMast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 5.2, 6), structuralTrussMat);
  avionicsMast.position.set(0, 4.8, -43.5);
  commandModule.add(avionicsMast);

  const lidarBlister = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8), copperConduitMat);
  lidarBlister.position.set(0, 7.2, -43.5);
  commandModule.add(lidarBlister);

  // Cuadricópteros RCS de proa (babor y estribor)
  [-4.8, 4.8].forEach((x, i) => {
    const rcsBlock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), structuralTrussMat);
    rcsBlock.position.set(x, 0.6, -48.5);
    commandModule.add(rcsBlock);

    // Balizas de navegación: Babor (Rojo), Estribor (Verde)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), i === 0 ? beaconRedMat : beaconGreenMat);
    beacon.position.set(x * 1.05, 1.2, -48.5);
    commandModule.add(beacon);
  });

  // Baliza blanca estroboscópica de proa
  const bowStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), beaconWhiteMat);
  bowStrobe.position.set(0, 0.5, -59.8);
  commandModule.add(bowStrobe);

  root.add(commandModule);

  // -------------------------------------------------------------
  // 2. ESPINA DORSAL ESTRUCTURAL Y CELOSÍA (Z: -42.0m a +35.0m)
  // -------------------------------------------------------------
  const structuralSpine = new THREE.Group();
  structuralSpine.name = 'StructuralSpine';

  // Túnel cilíndrico presurizado interno de circulación (Z: -42.0m a +35.0m = 77.0m)
  const coreTubeGeo = new THREE.CylinderGeometry(2.2, 2.2, 77.0, 16);
  coreTubeGeo.rotateX(Math.PI / 2);
  const coreTube = new THREE.Mesh(coreTubeGeo, primaryArmorMat);
  coreTube.position.set(0, 0, -3.5);
  structuralSpine.add(coreTube);

  // Celosía triangular externa de titanio (cercha estructural espacial con costillas)
  const ribCount = 14;
  for (let i = 0; i < ribCount; i++) {
    const z = -38.0 + (i * 70.0) / (ribCount - 1);
    const outerRingGeo = new THREE.TorusGeometry(3.6, 0.22, 6, 8);
    const ring = new THREE.Mesh(outerRingGeo, structuralTrussMat);
    ring.position.set(0, 0, z);
    structuralSpine.add(ring);

    // Tirantes de arriostramiento en X
    const braceGeo = new THREE.CylinderGeometry(0.12, 0.12, 7.2, 4);
    const brace1 = new THREE.Mesh(braceGeo, structuralTrussMat);
    brace1.rotation.z = Math.PI / 4;
    brace1.position.set(0, 0, z);
    const brace2 = new THREE.Mesh(braceGeo, structuralTrussMat);
    brace2.rotation.z = -Math.PI / 4;
    brace2.position.set(0, 0, z);
    structuralSpine.add(brace1, brace2);
  }

  // Tuberías externas de helio líquido y líneas criogénicas
  [-2.6, 2.6].forEach((x) => {
    const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 74.0, 8);
    pipeGeo.rotateX(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, copperConduitMat);
    pipe.position.set(x, 2.4, -3.5);
    structuralSpine.add(pipe);
  });

  // Pasarela exterior de servicio con pasamanos amarillos EVA
  const catwalkGeo = new THREE.BoxGeometry(1.6, 0.15, 72.0);
  const catwalk = new THREE.Mesh(catwalkGeo, secondaryHullMat);
  catwalk.position.set(0, -2.6, -3.5);
  structuralSpine.add(catwalk);

  const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 72.0, 6);
  railGeo.rotateX(Math.PI / 2);
  [-0.75, 0.75].forEach((rx) => {
    const rail = new THREE.Mesh(railGeo, hazardChevronMat);
    rail.position.set(rx, -2.1, -3.5);
    structuralSpine.add(rail);
  });

  root.add(structuralSpine);

  // -------------------------------------------------------------
  // 3. MÓDULOS CIENTÍFICOS Y BAHÍA SPHEREX (Z: -40.0m a -18.0m)
  // -------------------------------------------------------------
  const scienceModules = new THREE.Group();
  scienceModules.name = 'ScienceModules';

  // Vainas presurizadas laterales de investigación (Laboratorios de espectrometría IR)
  [-5.6, 5.6].forEach((x, idx) => {
    const podGeo = new THREE.CylinderGeometry(2.6, 2.6, 18.0, 10);
    podGeo.rotateX(Math.PI / 2);
    const pod = new THREE.Mesh(podGeo, secondaryHullMat);
    pod.position.set(x, 0, -29.0);
    scienceModules.add(pod);

    // Manto térmico dorado de protección criogénica (MLI)
    const mliGeo = new THREE.CylinderGeometry(2.7, 2.7, 10.0, 10);
    mliGeo.rotateX(Math.PI / 2);
    const mliWrap = new THREE.Mesh(mliGeo, goldFoilMliMat);
    mliWrap.position.set(x, 0, -29.0);
    scienceModules.add(mliWrap);

    // Tanques esféricos de rocío criogénico de helio/nitrógeno líquido
    const dewarGeo = new THREE.SphereGeometry(1.4, 12, 10);
    const dewar = new THREE.Mesh(dewarGeo, goldFoilMliMat);
    dewar.position.set(x * 1.35, 1.9, -29.0);
    scienceModules.add(dewar);

    // Soportes estructurales hacia la espina dorsal
    const pylonGeo = new THREE.BoxGeometry(Math.abs(x) - 2.2, 0.8, 3.2);
    const pylon = new THREE.Mesh(pylonGeo, structuralTrussMat);
    pylon.position.set(x / 2, 0, -29.0);
    scienceModules.add(pylon);
  });

  // Telescopio Criogénico SPHEREx montado en la bahía dorsal (Z: -26.0m)
  const spherexBaffleGeo = new THREE.ConeGeometry(2.2, 4.6, 12, 1, true);
  spherexBaffleGeo.rotateX(Math.PI / 2);
  const spherexBaffle = new THREE.Mesh(spherexBaffleGeo, primaryArmorMat);
  spherexBaffle.position.set(0, 4.6, -26.0);
  scienceModules.add(spherexBaffle);

  // Apertura óptica con filtro de cuarzo aluminizado
  const opticAperture = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), glassObservationMat);
  opticAperture.position.set(0, 4.6, -28.2);
  opticAperture.rotation.y = Math.PI;
  scienceModules.add(opticAperture);

  // Parasol desplegable hexagonal de protección radiométrica
  const sunshieldGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.12, 6);
  sunshieldGeo.rotateX(Math.PI / 2);
  const sunshield = new THREE.Mesh(sunshieldGeo, goldFoilMliMat);
  sunshield.position.set(0, 4.6, -23.8);
  scienceModules.add(sunshield);

  root.add(scienceModules);

  // -------------------------------------------------------------
  // 4. MÓDULO DE HABITABILIDAD Y TAMBORES DE TRIPULACIÓN (Z: -18.0m a +12.0m)
  // -------------------------------------------------------------
  const habitatModule = new THREE.Group();
  habitatModule.name = 'HabitatModule';

  // Dos tambores de habitabilidad gemelos (Babor / Estribor)
  [-6.2, 6.2].forEach((x) => {
    const drumGeo = new THREE.CylinderGeometry(4.2, 4.2, 22.0, 16);
    drumGeo.rotateX(Math.PI / 2);
    const drum = new THREE.Mesh(drumGeo, primaryArmorMat);
    drum.position.set(x, 0, -3.0);
    habitatModule.add(drum);

    // Anillos de refuerzo estructural antiblindaje contra micrometeoritos
    [-8.0, 0, 8.0].forEach((dz) => {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.18, 6, 16), secondaryHullMat);
      rib.position.set(x, 0, -3.0 + dz);
      habitatModule.add(rib);
    });

    // Ojos de buey iluminados para habitáculos de tripulación
    for (let p = 0; p < 6; p++) {
      const pz = -10.0 + p * 2.8;
      const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12), glassObservationMat);
      porthole.position.set(x + (x > 0 ? 4.22 : -4.22), 0.8, pz);
      porthole.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      habitatModule.add(porthole);
    }
  });

  // Esclusa ventral de acceso EVA (Z: -6.0m) con señalización de seguridad
  const airlockBayGeo = new THREE.BoxGeometry(4.4, 2.6, 5.0);
  const airlockBay = new THREE.Mesh(airlockBayGeo, secondaryHullMat);
  airlockBay.position.set(0, -3.4, -6.0);
  habitatModule.add(airlockBay);

  // Marco de escotilla con franja de peligro
  const airlockHatchGeo = new THREE.BoxGeometry(2.4, 0.15, 2.8);
  const airlockHatch = new THREE.Mesh(airlockHatchGeo, hazardChevronMat);
  airlockHatch.position.set(0, -4.75, -6.0);
  habitatModule.add(airlockHatch);

  root.add(habitatModule);

  // -------------------------------------------------------------
  // 5. INGENIERÍA Y NÚCLEO TOKAMAK DE PLASMA (Z: +12.0m a +44.0m)
  // -------------------------------------------------------------
  const engineeringModule = new THREE.Group();
  engineeringModule.name = 'EngineeringModule';

  // Casco acorazado de ingeniería
  const engHullGeo = new THREE.CylinderGeometry(5.2, 5.8, 30.0, 12);
  engHullGeo.rotateX(Math.PI / 2);
  const engHull = new THREE.Mesh(engHullGeo, primaryArmorMat);
  engHull.position.set(0, 0, 27.0);
  engineeringModule.add(engHull);

  // Cámara toroidal de confinamiento magnético Tokamak (Z = +24.0m)
  const tokamakTorusGeo = new THREE.TorusGeometry(6.4, 1.4, 12, 24);
  const tokamakTorus = new THREE.Mesh(tokamakTorusGeo, structuralTrussMat);
  tokamakTorus.position.set(0, 0, 24.0);
  engineeringModule.add(tokamakTorus);

  // Bobinas superconductoras de campo magnético (6 bobinas poloidales)
  for (let c = 0; c < 6; c++) {
    const angle = (c * Math.PI) / 3;
    const coilGeo = new THREE.BoxGeometry(0.8, 2.4, 1.2);
    const coil = new THREE.Mesh(coilGeo, copperConduitMat);
    coil.position.set(Math.cos(angle) * 6.4, Math.sin(angle) * 6.4, 24.0);
    coil.rotation.z = angle;
    engineeringModule.add(coil);
  }

  // Núcleo de plasma visible con radiación Cherenkov
  const plasmaCore = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.7, 8, 20), tokamakGlowMat);
  plasmaCore.position.set(0, 0, 24.0);
  plasmaCore.name = 'TokamakPlasmaGlowRing';
  engineeringModule.add(plasmaCore);

  root.add(engineeringModule);

  // -------------------------------------------------------------
  // 6. MATRIZ DE RADIADORES TÉRMICOS DE GRAFENO (Envergadura 32.0m, Z: +8.0m a +32.0m)
  // -------------------------------------------------------------
  const radiatorArrays = new THREE.Group();
  radiatorArrays.name = 'RadiatorArrays';

  // Dos alas de radiadores térmicos desplegados simétricamente (Babor y Estribor)
  // Envergadura total desde x = -16.0m hasta x = +16.0m (32.0m)
  [-1, 1].forEach((side) => {
    const wingGroup = new THREE.Group();
    wingGroup.name = side < 0 ? 'RadiatorPortWing' : 'RadiatorStarboardWing';

    // Panel disipador de calor plano con ranurado de grafeno
    const panelGeo = new THREE.BoxGeometry(8.5, 0.14, 22.0);
    const panel = new THREE.Mesh(panelGeo, radiatorGrapheneMat);
    panel.position.set(side * 11.2, 0, 20.0);
    wingGroup.add(panel);

    // Mástil de despliegue en tijera y tuberías colectoras de freón/sodio líquido
    const pylonGeo = new THREE.CylinderGeometry(0.32, 0.38, 5.8, 6);
    pylonGeo.rotateZ(Math.PI / 2);
    const pylon = new THREE.Mesh(pylonGeo, structuralTrussMat);
    pylon.position.set(side * 5.8, 0, 20.0);
    wingGroup.add(pylon);

    // Colectores térmicos de alta temperatura
    const headerPipeGeo = new THREE.CylinderGeometry(0.24, 0.24, 22.0, 8);
    headerPipeGeo.rotateX(Math.PI / 2);
    const headerPipe = new THREE.Mesh(headerPipeGeo, copperConduitMat);
    headerPipe.position.set(side * 7.2, 0.25, 20.0);
    wingGroup.add(headerPipe);

    radiatorArrays.add(wingGroup);
  });

  root.add(radiatorArrays);

  // -------------------------------------------------------------
  // 7. CLÚSTER DE PROPULSIÓN MPD / IÓNICO (Popa, Z: +44.0m a +60.0m)
  // -------------------------------------------------------------
  const engineCluster = new THREE.Group();
  engineCluster.name = 'EngineCluster';

  // Placa trasera de empuje y montaje de motores
  const thrustStructureGeo = new THREE.CylinderGeometry(5.8, 6.2, 6.0, 12);
  thrustStructureGeo.rotateX(Math.PI / 2);
  const thrustStructure = new THREE.Mesh(thrustStructureGeo, structuralTrussMat);
  thrustStructure.position.set(0, 0, 46.0);
  engineCluster.add(thrustStructure);

  // 3 Toberas principales de plasma MPD dispuestas en triángulo
  // Longitud de tobera: 9.0m (Z: +51.0m a +60.0m)
  const nozzlePositions = [
    { x: 0, y: 2.6, z: 55.5 },
    { x: -2.8, y: -2.1, z: 55.5 },
    { x: 2.8, y: -2.1, z: 55.5 },
  ];

  const plasmaPlumes = [];

  nozzlePositions.forEach((pos, idx) => {
    const nozzleGroup = new THREE.Group();
    nozzleGroup.position.set(pos.x, pos.y, pos.z);

    // Campana de tobera con chaqueta de enfriamiento regenerativo
    const bellGeo = new THREE.CylinderGeometry(1.2, 2.8, 9.0, 16, 1, true);
    bellGeo.rotateX(Math.PI / 2);
    const bell = new THREE.Mesh(bellGeo, primaryArmorMat);
    nozzleGroup.add(bell);

    // Anillo exterior de titanio en el borde de salida de la tobera (Z = +60.0m)
    const rimGeo = new THREE.TorusGeometry(2.8, 0.16, 6, 16);
    const rim = new THREE.Mesh(rimGeo, secondaryHullMat);
    rim.position.set(0, 0, 4.5); // 55.5 + 4.5 = 60.0m exactos
    nozzleGroup.add(rim);

    // Rejilla de aceleración interna
    const gridGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.6, 8);
    gridGeo.rotateX(Math.PI / 2);
    const grid = new THREE.Mesh(gridGeo, structuralTrussMat);
    grid.position.set(0, 0, -3.8);
    nozzleGroup.add(grid);

    // Penacho dinámico de plasma MPD que pulsa con el acelerador
    // En reposo se aloja dentro de la tobera (Z <= 60.0m) para preservar la eslora métrica exacta de 120m
    const plumeGeo = new THREE.ConeGeometry(1.8, 1.8, 16, 1, true);
    plumeGeo.rotateX(-Math.PI / 2);
    const plume = new THREE.Mesh(plumeGeo, ionGlowMat);
    plume.position.set(0, 0, 3.6); // max Z = 3.6 + 0.9 = 4.5 rel -> 55.5 + 4.5 = 60.0m exactos
    plume.name = `MpdPlasmaPlume_${idx}`;
    nozzleGroup.add(plume);
    plasmaPlumes.push(plume);

    // Actuadores de empuje vectorial montados en cardán
    [-1.8, 1.8].forEach((ax) => {
      const actuator = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 4), structuralTrussMat);
      actuator.position.set(ax, 0, -2.0);
      actuator.rotation.x = Math.PI / 2;
      nozzleGroup.add(actuator);
    });

    engineCluster.add(nozzleGroup);
  });

  // 4 Bloques RCS cuádruples en las esquinas de popa
  [
    { x: -5.4, y: 3.4 },
    { x: 5.4, y: 3.4 },
    { x: -5.4, y: -3.4 },
    { x: 5.4, y: -3.4 },
  ].forEach((pos) => {
    const rcs = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.4), structuralTrussMat);
    rcs.position.set(pos.x, pos.y, 48.0);
    engineCluster.add(rcs);
  });

  root.add(engineCluster);

  // -------------------------------------------------------------
  // 8. GRUPO DE ANTENA DE ALTA GANANCIA Y ANILLO DE ATRAQUE
  // -------------------------------------------------------------
  const antennaGroup = new THREE.Group();
  antennaGroup.name = 'AntennaGroup';

  // Antena parabólica orientable de comunicaciones de espacio profundo (Z: -36.0m)
  const dishSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4.4, 6), structuralTrussMat);
  dishSupport.position.set(0, 5.0, -36.0);
  antennaGroup.add(dishSupport);

  const dishGeo = new THREE.CylinderGeometry(3.6, 0.4, 1.2, 16, 1, true);
  dishGeo.rotateX(Math.PI / 2);
  const dish = new THREE.Mesh(dishGeo, secondaryHullMat);
  dish.position.set(0, 7.4, -36.0);
  dish.rotation.x = -Math.PI / 5;
  antennaGroup.add(dish);

  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 2.0, 6), copperConduitMat);
  feedHorn.position.set(0, 7.8, -37.2);
  feedHorn.rotation.x = -Math.PI / 5;
  antennaGroup.add(feedHorn);

  // Anillo de atraque estándar internacional (IDSS) en el costado de estribor
  const dockingRingGeo = new THREE.TorusGeometry(1.6, 0.28, 8, 16);
  const dockingRing = new THREE.Mesh(dockingRingGeo, primaryArmorMat);
  dockingRing.position.set(2.4, 0, -14.0);
  dockingRing.rotation.y = Math.PI / 2;
  antennaGroup.add(dockingRing);

  root.add(antennaGroup);

  // Función de actualización de animaciones de vuelo (penachos MPD, plasma y rotación sutil de antenas)
  const update = (dt, throttle = 0) => {
    const time = performance.now() * 0.001;
    const pulse = 0.85 + Math.sin(time * 12.0) * 0.15;
    const throttleScale = Math.max(0.2, throttle);

    plasmaPlumes.forEach((plume, i) => {
      const flicker = 1.0 + Math.sin(time * 24.0 + i * 2.0) * 0.08;
      plume.scale.set(
        1.0 + throttle * 0.4,
        1.0 + throttle * 0.4,
        (throttleScale * 1.6 + pulse * 0.4) * flicker,
      );
      if (plume.material) {
        plume.material.opacity = Math.min(0.95, 0.35 + throttle * 0.6);
      }
    });

    if (plasmaCore?.material) {
      plasmaCore.material.opacity = 0.55 + Math.sin(time * 4.0) * 0.25;
    }

    if (dish) {
      dish.rotation.z = Math.sin(time * 0.15) * 0.18;
    }
  };

  return {
    root,
    dimensions: SHIP_METRIC_DIMENSIONS,
    commandModule,
    structuralSpine,
    scienceModules,
    habitatModule,
    engineeringModule,
    radiatorArrays,
    engineCluster,
    antennaGroup,
    plasmaPlumes,
    update,
  };
}

/**
 * Serializador a GLB para entornos Three.js y validación de assets.
 */
export async function exportModularShipToGLB() {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const shipData = buildModularShip120M();
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      shipData.root,
      (gltf) => resolve(gltf),
      (error) => reject(error),
      { binary: true },
    );
  });
}
