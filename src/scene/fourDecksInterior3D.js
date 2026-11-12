import * as THREE from 'three';

/**
 * KRONOX 4-Deck Habitable Interior Architecture (1 unit = 1 meter).
 *
 * Implements the 4 connected operational decks within the 120-meter modular hull:
 * - DECK 01: Mando y Navegación (Y = +3.4m, Bow)
 * - DECK 02: Ciencia e Investigación (Y = 0.0m, Mid-Forward)
 * - DECK 03: Habitabilidad y Tripulación (Y = -3.4m, Mid-Aft)
 * - DECK 04: Ingeniería y Logística (Y = -6.8m, Aft)
 * - Circulation Spine: Central vertical transit tube with airlocks and continuous grab rails.
 *
 * Designed strictly for zero-G / microgravity:
 * All equipment, foot restraints, tethered sleeping pods, magnetic galleys,
 * tool straps, and handrails conform to realistic space engineering standards.
 */

export const CABIN_DECKS = Object.freeze([
  {
    id: 'deck-01',
    level: 1,
    name: 'CUBIERTA 01 — MANDO Y NAVEGACIÓN',
    code: 'DECK-01-NAV',
    elevationY: 3.4,
    centerZ: -24.0,
    bounds: { minX: -6.5, maxX: 6.5, minY: 2.0, maxY: 5.2, minZ: -38.0, maxZ: -10.0 },
    summary: 'Puente de mando, timón, mirador panorámico y estación de comunicaciones.',
  },
  {
    id: 'deck-02',
    level: 2,
    name: 'CUBIERTA 02 — CIENCIA E INVESTIGACIÓN',
    code: 'DECK-02-SCI',
    elevationY: 0.0,
    centerZ: -20.0,
    bounds: { minX: -7.5, maxX: 7.5, minY: -1.6, maxY: 1.8, minZ: -34.0, maxZ: -6.0 },
    summary: 'Laboratorio de análisis infrarrojo SPHEREx, archivo astronómico y calibración óptica.',
  },
  {
    id: 'deck-03',
    level: 3,
    name: 'CUBIERTA 03 — HABITABILIDAD',
    code: 'DECK-03-HAB',
    elevationY: -3.4,
    centerZ: 2.0,
    bounds: { minX: -6.0, maxX: 6.0, minY: -5.0, maxY: -1.8, minZ: -10.0, maxZ: 14.0 },
    summary: 'Camarotes en microgravedad, sacos de dormir sujetos, cocina espacial y enfermería.',
  },
  {
    id: 'deck-04',
    level: 4,
    name: 'CUBIERTA 04 — INGENIERÍA Y LOGÍSTICA',
    code: 'DECK-04-ENG',
    elevationY: -6.8,
    centerZ: 12.0,
    bounds: { minX: -7.0, maxX: 7.0, minY: -8.4, maxY: -5.2, minZ: 0.0, maxZ: 28.0 },
    summary: 'Reactor de plasma, soporte vital Sabatier, esclusa EVA y taller de mantenimiento.',
  },
]);

export function buildFourDecksInterior3D() {
  const root = new THREE.Group();
  root.name = 'KronoxFourDecksHabitableInterior';

  // PBR Interior Materials
  const deckPlateMat = new THREE.MeshStandardMaterial({
    color: 0x111622,
    roughness: 0.82,
    metalness: 0.35,
    name: 'GraphiteDeckPlates',
  });

  const walkwayPolymerMat = new THREE.MeshStandardMaterial({
    color: 0x182030,
    roughness: 0.68,
    metalness: 0.28,
    name: 'NonSlipWalkwayPolymer',
  });

  const bulkheadTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x1a2436,
    roughness: 0.52,
    metalness: 0.68,
    name: 'BrushedTitaniumBulkhead',
  });

  const structuralRibMat = new THREE.MeshStandardMaterial({
    color: 0x24324a,
    roughness: 0.38,
    metalness: 0.78,
    name: 'StructuralArchSteel',
  });

  const handrailYellowMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.45,
    metalness: 0.25,
    emissive: 0x78350f,
    emissiveIntensity: 0.2,
    name: 'ZeroGSafetyHandrail',
  });

  const consoleMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.6,
    name: 'StationConsoleHousing',
  });

  const screenActiveMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.8,
    name: 'StationDisplayScreen',
  });

  const windowGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.08,
    roughness: 0.03,
    metalness: 0.08,
    transmission: 0.94,
    ior: 1.48,
    side: THREE.DoubleSide,
    depthWrite: false,
    name: 'ForwardObservationWindow',
  });

  const fabricSleepingMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.9,
    metalness: 0.05,
    name: 'TetheredSleepingPodFabric',
  });

  const hatchAirlockMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.3,
    name: 'AirtightAirlockHatch',
  });

  const interactiveStations = [];
  const grabRails = [];
  const deckContainers = {};

  // =========================================================================
  // HELPER: BUILD STANDARD RECTANGULAR HABITABLE ROOM WITH ARCH RIBS
  // =========================================================================
  function createDeckChamber({ id, width, height, length, posY, posZ, label }) {
    const chamber = new THREE.Group();
    chamber.name = `Chamber_${id}`;
    chamber.position.set(0, posY, posZ);

    const halfW = width * 0.5;
    const halfH = height * 0.5;
    const halfL = length * 0.5;

    // Floor and Ceiling
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.15, length), deckPlateMat);
    floor.position.set(0, -halfH, 0);
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, 0.15, length), bulkheadTitaniumMat);
    ceiling.position.set(0, halfH, 0);
    chamber.add(floor, ceiling);

    // Floor central polymer walkway
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, length - 0.4), walkwayPolymerMat);
    walkway.position.set(0, -halfH + 0.08, 0);
    chamber.add(walkway);

    // Port and Starboard Bulkhead Walls
    const wallGeo = new THREE.BoxGeometry(0.2, height, length);
    const portWall = new THREE.Mesh(wallGeo, bulkheadTitaniumMat);
    portWall.position.set(-halfW, 0, 0);
    const stbdWall = new THREE.Mesh(wallGeo, bulkheadTitaniumMat);
    stbdWall.position.set(halfW, 0, 0);
    chamber.add(portWall, stbdWall);

    // Structural Rib Arches & Safety Handrails along walls
    const ribCount = Math.max(3, Math.floor(length / 4.0));
    const stepL = length / (ribCount - 1);

    for (let i = 0; i < ribCount; i++) {
      const ribZ = -halfL + i * stepL;

      // Overhead arch beam
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.35, 0.35), structuralRibMat);
      topBeam.position.set(0, halfH - 0.18, ribZ);
      chamber.add(topBeam);

      // Side pillars
      [-halfW + 0.12, halfW - 0.12].forEach((px) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.25, height - 0.3, 0.25), structuralRibMat);
        pillar.position.set(px, 0, ribZ);
        chamber.add(pillar);
      });
    }

    // Continuous Zero-G Safety Grab Rails (yellow bars at 0.9m and 1.9m heights)
    [-halfW + 0.35, halfW - 0.35].forEach((px) => {
      [-0.4, 0.5].forEach((py) => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length - 1.0, 8), handrailYellowMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(px, py, 0);
        chamber.add(rail);
        grabRails.push({ mesh: rail, deckId: id, worldPos: new THREE.Vector3(px, posY + py, posZ) });
      });
    });

    // Soft Overhead Recessed Ambient Lighting
    const roomLight = new THREE.PointLight(0xdbeafe, 0.55, width * 2.2);
    roomLight.position.set(0, halfH - 0.4, 0);
    chamber.add(roomLight);

    root.add(chamber);
    deckContainers[id] = chamber;
    return chamber;
  }

  // =========================================================================
  // 1. CUBIERTA 01: MANDO Y NAVEGACIÓN (Y = +3.4m, Z = -24m)
  // =========================================================================
  const deck01 = createDeckChamber({
    id: 'deck-01',
    width: 12.0,
    height: 3.4,
    length: 26.0,
    posY: 3.4,
    posZ: -24.0,
    label: 'Mando y Navegación',
  });

  // Forward Observation Window at Bow (Z = -37.0m in world)
  const windowFrameGeo = new THREE.BoxGeometry(9.6, 2.6, 0.18);
  const bridgeWindow = new THREE.Mesh(windowFrameGeo, windowGlassMat);
  bridgeWindow.position.set(0, 0.2, -12.9);
  deck01.add(bridgeWindow);

  // Helm & Navigation Console (Forward Center)
  const navDeskGeo = new THREE.BoxGeometry(3.2, 0.95, 1.4);
  const navDesk = new THREE.Mesh(navDeskGeo, consoleMat);
  navDesk.position.set(0, -0.9, -10.5);

  const navScreen = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.75, 0.05), screenActiveMat);
  navScreen.position.set(0, 0.85, -0.2);
  navScreen.rotation.x = -0.35;
  navDesk.add(navScreen);
  deck01.add(navDesk);

  interactiveStations.push({
    id: 'nav',
    deckId: 'deck-01',
    deckLevel: 1,
    name: 'Consola de Navegación e Hipersalto',
    code: 'ST-NAV-01',
    position: new THREE.Vector3(0, 3.4, -32.5),
    mesh: navDesk,
    prompt: '[E] Operar Navegación y Cartografía Estelar',
  });

  // Communications & Kronox IA Station (Starboard Bow)
  const commsDesk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 1.2), consoleMat);
  commsDesk.position.set(4.2, -0.9, -8.0);
  commsDesk.rotation.y = -Math.PI / 4;
  const commsScreen = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 0.05), screenActiveMat);
  commsScreen.position.set(0, 0.8, -0.15);
  commsDesk.add(commsScreen);
  deck01.add(commsDesk);

  interactiveStations.push({
    id: 'comms',
    deckId: 'deck-01',
    deckLevel: 1,
    name: 'Estación de Comunicaciones con Kronox IA',
    code: 'ST-COMMS-01',
    position: new THREE.Vector3(4.2, 3.4, -32.0),
    mesh: commsDesk,
    prompt: '[E] Conectar con Kronox IA',
  });

  // Expeditions & Mission Tactical Table (Port Bow)
  const tacticalTable = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.85, 12), consoleMat);
  tacticalTable.position.set(-4.2, -0.9, -8.0);
  const holoProjectorDisk = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.05, 16), screenActiveMat);
  holoProjectorDisk.position.set(0, 0.45, 0);
  tacticalTable.add(holoProjectorDisk);
  deck01.add(tacticalTable);

  interactiveStations.push({
    id: 'missions',
    deckId: 'deck-01',
    deckLevel: 1,
    name: 'Mesa Táctica de Misiones y Objetivos',
    code: 'ST-MSSN-01',
    position: new THREE.Vector3(-4.2, 3.4, -32.0),
    mesh: tacticalTable,
    prompt: '[E] Consultar Misiones de Exploración',
  });

  // =========================================================================
  // 2. CUBIERTA 02: CIENCIA E INVESTIGACIÓN (Y = 0.0m, Z = -20m)
  // =========================================================================
  const deck02 = createDeckChamber({
    id: 'deck-02',
    width: 14.0,
    height: 3.2,
    length: 26.0,
    posY: 0.0,
    posZ: -20.0,
    label: 'Ciencia e Investigación',
  });

  // SPHEREx Spectral Analysis Lab Bench (Center Island)
  const scienceLabDesk = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.95, 2.0), consoleMat);
  scienceLabDesk.position.set(0, -0.75, 0);

  // Multi-band spectral monitors
  [-1.4, 0, 1.4].forEach((sx) => {
    const scScreen = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.05), screenActiveMat);
    scScreen.position.set(sx, 0.9, -0.3);
    scScreen.rotation.x = -0.22;
    scienceLabDesk.add(scScreen);
  });
  deck02.add(scienceLabDesk);

  interactiveStations.push({
    id: 'science',
    deckId: 'deck-02',
    deckLevel: 2,
    name: 'Laboratorio de Observación Infrarroja SPHEREx',
    code: 'ST-SCI-02',
    position: new THREE.Vector3(0, 0.0, -20.0),
    mesh: scienceLabDesk,
    prompt: '[E] Analizar Datos SPHEREx y Espectroscopia',
  });

  // Astrometric Correlation & Reference Optical Archive (Port Wall)
  const archiveDesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 1.2), consoleMat);
  archiveDesk.position.set(-5.5, -0.75, 4.0);
  archiveDesk.rotation.y = Math.PI / 2;
  const archiveScreen = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.05), screenActiveMat);
  archiveScreen.position.set(0, 0.85, -0.15);
  archiveDesk.add(archiveScreen);
  deck02.add(archiveDesk);

  interactiveStations.push({
    id: 'archive',
    deckId: 'deck-02',
    deckLevel: 2,
    name: 'Terminal de Archivo Astronómico e Historial',
    code: 'ST-ARCH-02',
    position: new THREE.Vector3(-5.5, 0.0, -16.0),
    mesh: archiveDesk,
    prompt: '[E] Abrir Archivo Astronómico y Catálogo',
  });

  // Astronomical Optical Benchmark & Diagnostic Unit (Starboard Wall)
  const sensorCalibrationUnit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.4), consoleMat);
  sensorCalibrationUnit.position.set(5.5, -0.65, 4.0);
  sensorCalibrationUnit.rotation.y = -Math.PI / 2;

  // Calibration status glow beacon (for Prologue Mission repair)
  const sensorBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
      name: 'DiagnosticBeaconYellow',
    }),
  );
  sensorBeacon.position.set(0, 0.85, 0);
  sensorCalibrationUnit.add(sensorBeacon);
  deck02.add(sensorCalibrationUnit);

  interactiveStations.push({
    id: 'sensor-calibration',
    deckId: 'deck-02',
    deckLevel: 2,
    name: 'Banco de Telemetría y Referencia Óptica',
    code: 'ST-REPAIR-02',
    position: new THREE.Vector3(5.5, 0.0, -16.0),
    mesh: sensorCalibrationUnit,
    prompt: '[E] Inspeccionar y Reparar Sensor Óptico',
  });

  // =========================================================================
  // 3. CUBIERTA 03: HABITABILIDAD (Y = -3.4m, Z = +2m)
  // =========================================================================
  const deck03 = createDeckChamber({
    id: 'deck-03',
    width: 12.0,
    height: 3.2,
    length: 24.0,
    posY: -3.4,
    posZ: 2.0,
    label: 'Habitabilidad',
  });

  // Tethered Zero-G Sleeping Pods (Vertical cocoons attached to wall)
  [-4.8, 4.8].forEach((px) => {
    [-6, -1, 4].forEach((pz) => {
      const podFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), bulkheadTitaniumMat);
      podFrame.position.set(px, 0.1, pz);

      const cocoon = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.9, 0.8), fabricSleepingMat);
      cocoon.position.set(0, 0, 0.1);
      podFrame.add(cocoon);

      // Elastic restraint harness straps
      [-0.4, 0, 0.4].forEach((sy) => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.05), handrailYellowMat);
        strap.position.set(0, sy, 0.52);
        podFrame.add(strap);
      });

      deck03.add(podFrame);
    });
  });

  // Zero-G Magnetic Galley & Water Rehydration Station
  const galley = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.4), consoleMat);
  galley.position.set(0, -0.65, -8.0);
  const galleyDispenser = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.35), screenActiveMat);
  galleyDispenser.position.set(0, 0.75, -0.2);
  galley.add(galleyDispenser);
  deck03.add(galley);

  interactiveStations.push({
    id: 'galley',
    deckId: 'deck-03',
    deckLevel: 3,
    name: 'Cocina Espacial y Dispensador Nutricional',
    code: 'ST-HAB-03',
    position: new THREE.Vector3(0, -3.4, -6.0),
    mesh: galley,
    prompt: '[E] Registrar Turno y Ración de Explorador',
  });

  // Cardiovascular Ergometer Exercise Rig (essential in Zero-G)
  const ergometer = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.8), bulkheadTitaniumMat);
  ergometer.position.set(0, -0.65, 7.5);
  const ergoPedals = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8), structuralRibMat);
  ergoPedals.rotation.z = Math.PI / 2;
  ergoPedals.position.set(0, 0.1, 0.3);
  ergometer.add(ergoPedals);
  deck03.add(ergometer);

  // =========================================================================
  // 4. CUBIERTA 04: INGENIERÍA Y LOGÍSTICA (Y = -6.8m, Z = +14m)
  // =========================================================================
  const deck04 = createDeckChamber({
    id: 'deck-04',
    width: 14.0,
    height: 3.2,
    length: 26.0,
    posY: -6.8,
    posZ: 14.0,
    label: 'Ingeniería y Logística',
  });

  // Plasma Reactor Inspection Window & Primary Isolation Hatch (Aft Wall)
  const reactorWindow = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.2, 16), windowGlassMat);
  reactorWindow.rotation.x = Math.PI / 2;
  reactorWindow.position.set(0, 0.2, 12.8);
  deck04.add(reactorWindow);

  const reactorGlow = new THREE.PointLight(0x38bdf8, 0.85, 12);
  reactorGlow.position.set(0, 0.2, 13.5);
  deck04.add(reactorGlow);

  // Engineering Power Distribution & Sabatier Life-Support Console
  const engineeringDesk = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.95, 1.5), consoleMat);
  engineeringDesk.position.set(0, -0.75, 8.5);
  const engScreen = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.75, 0.05), screenActiveMat);
  engScreen.position.set(0, 0.85, -0.2);
  engScreen.rotation.x = -0.25;
  engineeringDesk.add(engScreen);
  deck04.add(engineeringDesk);

  interactiveStations.push({
    id: 'engineering',
    deckId: 'deck-04',
    deckLevel: 4,
    name: 'Consola del Reactor de Plasma y Soporte Vital',
    code: 'ST-ENG-04',
    position: new THREE.Vector3(0, -6.8, 22.5),
    mesh: engineeringDesk,
    prompt: '[E] Supervisar Reactores y Ciclo Sabatier',
  });

  // EVA Airlock Staging Bay Door (Port Wall of Deck 04)
  const airlockHatch = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 1.6), hatchAirlockMat);
  airlockHatch.position.set(-6.8, 0.0, 0.0);
  const airlockWheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16), handrailYellowMat);
  airlockWheel.rotation.y = Math.PI / 2;
  airlockWheel.position.set(0.15, 0, 0);
  airlockHatch.add(airlockWheel);
  deck04.add(airlockHatch);

  interactiveStations.push({
    id: 'airlock',
    deckId: 'deck-04',
    deckLevel: 4,
    name: 'Esclusa de Despresurización para Paseo Espacial (EVA)',
    code: 'ST-AIRLOCK-04',
    position: new THREE.Vector3(-6.5, -6.8, 14.0),
    mesh: airlockHatch,
    prompt: '[E] Preparar Esclusa de Salida EVA',
  });

  // =========================================================================
  // 5. CENTRAL VERTICAL CIRCULATION TUBE (Connects all 4 Decks)
  // =========================================================================
  // Positioned at X = 0, Z = -11m, extending from Y = +4.5m to Y = -7.5m (height: 12.0m)
  const tubeGroup = new THREE.Group();
  tubeGroup.name = 'VerticalTransitSpineTube';
  tubeGroup.position.set(0, -1.7, -11.0);

  const tubeOuterGeo = new THREE.CylinderGeometry(2.4, 2.4, 12.5, 16, 1, true);
  const tubeMesh = new THREE.Mesh(tubeOuterGeo, bulkheadTitaniumMat);
  tubeGroup.add(tubeMesh);

  // Vertical ladder / grab rail run inside tube
  [-1, 1].forEach((dir) => {
    const vRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 12.0, 8), handrailYellowMat);
    vRail.position.set(dir * 1.6, 0, 0);
    tubeGroup.add(vRail);
  });

  // Floor hatches on each deck intersection
  CABIN_DECKS.forEach((deck) => {
    const localHatchY = deck.elevationY - (-1.7);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 20), structuralRibMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, localHatchY, 0);
    tubeGroup.add(ring);
  });

  root.add(tubeGroup);

  // =========================================================================
  // 6. SPATIAL BOUNDS & ASTRONAUT CLAMPING ACROSS DECKS
  // =========================================================================
  const clampAstronautPosition = (pos) => {
    // Determine which deck or transit tube the astronaut is currently in
    let currentDeck = null;
    for (const deck of CABIN_DECKS) {
      const b = deck.bounds;
      if (pos.y >= b.minY - 0.5 && pos.y <= b.maxY + 0.5 && pos.z >= b.minZ && pos.z <= b.maxZ) {
        currentDeck = deck;
        break;
      }
    }

    if (currentDeck) {
      const b = currentDeck.bounds;
      // If near the central vertical tube (X in [-2, 2], Z near -11m), allow vertical travel between decks!
      const inTubeZ = Math.abs(pos.z - (-11.0)) < 2.0 && Math.abs(pos.x) < 2.0;
      if (!inTubeZ) {
        pos.y = THREE.MathUtils.clamp(pos.y, b.minY + 0.2, b.maxY - 0.2);
      } else {
        // In vertical shaft: clamp from bottom of Deck 04 to top of Deck 01
        pos.y = THREE.MathUtils.clamp(pos.y, -7.8, 4.8);
      }
      pos.x = THREE.MathUtils.clamp(pos.x, b.minX + 0.3, b.maxX - 0.3);
      pos.z = THREE.MathUtils.clamp(pos.z, b.minZ + 0.3, b.maxZ - 0.3);
    } else {
      // General safety fallback clamp within 120m ship interior
      pos.x = THREE.MathUtils.clamp(pos.x, -6.5, 6.5);
      pos.y = THREE.MathUtils.clamp(pos.y, -7.8, 4.8);
      pos.z = THREE.MathUtils.clamp(pos.z, -37.0, 26.0);
    }
    return pos;
  };

  const findNearestInteractiveStation = (astronautPos, maxDist = 2.45) => {
    let nearest = null;
    let minD = maxDist;

    interactiveStations.forEach((station) => {
      const dist = astronautPos.distanceTo(station.position);
      if (dist < minD) {
        minD = dist;
        nearest = {
          ...station,
          distance: Number(dist.toFixed(2)),
          distanceMeters: Number(dist.toFixed(2)),
        };
      }
    });

    return nearest;
  };

  const updateStations = (elapsedSeconds = 0, activeStationId = null) => {
    interactiveStations.forEach((st) => {
      if (st.id === 'sensor-calibration') {
        // Pulse yellow beacon in Deck 02 during prologue repair
        const pulse = 0.5 + Math.sin(elapsedSeconds * 4.0) * 0.45;
        const beacon = st.mesh.children.find((c) => c.material?.name === 'DiagnosticBeaconYellow');
        if (beacon && beacon.material) {
          beacon.material.emissiveIntensity = activeStationId === st.id ? 1.0 : pulse;
        }
      }
    });
  };

  return {
    root,
    decks: CABIN_DECKS,
    deckContainers,
    interactiveStations,
    grabRails,
    clampAstronautPosition,
    findNearestInteractiveStation,
    updateStations,
  };
}
