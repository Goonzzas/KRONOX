import * as THREE from 'three';

/**
 * KRONOX 120-Meter Modular Research Cruiser 3D Architecture.
 *
 * Implements a scientifically plausible, modular deep-space exploration vessel:
 * - Reference Length: Exactly 120.0 meters (Z: -60.0m to +60.0m).
 * - Beam (Width): 18.0m (hull) / 32.0m (with deployed heat radiators).
 * - Draft (Height): 20.0m (hull) / 24.0m (with communication masts).
 * - Internal pressurized core: 14.0m wide x 16.0m high x 76.0m long, comfortably
 *   housing the 4 connected habitable decks within the 120m armored hull.
 *
 * Architecture Modules (separated semantically):
 * 1. Command Module (Bow, Z: -42m to -60m)
 * 2. Structural Spine / Central Truss (Z: -42m to +35m)
 * 3. Pressurized Science Modules (Z: -20m to -42m)
 * 4. Habitat Modules (Z: -10m to +15m)
 * 5. Engineering & Propulsion Core (Z: +15m to +60m)
 * 6. Radiator Thermal Arrays (Z: +5m to +25m, deployed laterally)
 * 7. Engine Cluster (3 primary plasma/ion nozzles + 8 RCS thruster blocks)
 * 8. Auxiliary EVA Airlocks, Docking Rings & High-Gain Communications Dish
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

  // Master PBR Materials
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x222a38,
    metalness: 0.72,
    roughness: 0.42,
    name: 'ShipArmorHull',
  });

  const secondaryArmorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.65,
    roughness: 0.48,
    name: 'SecondaryPlating',
  });

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.32,
    name: 'StructuralSpineTruss',
  });

  const copperDetailMat = new THREE.MeshStandardMaterial({
    color: 0xc27a42,
    metalness: 0.78,
    roughness: 0.35,
    name: 'ThermalCoilCopper',
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.15,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.92,
    ior: 1.48,
    name: 'ReinforcedObservationGlass',
  });

  const radiatorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x1e150a,
    emissiveIntensity: 0.22,
    metalness: 0.9,
    roughness: 0.65,
    name: 'CarbonThermalRadiator',
  });

  const warningStripeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.5,
    metalness: 0.2,
    name: 'WarningHazardStripe',
  });

  const engineGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    name: 'IonPlasmaExhaust',
  });

  // =========================================================================
  // 1. COMMAND MODULE (Bow: Z = -42m to -60m)
  // =========================================================================
  const commandModule = new THREE.Group();
  commandModule.name = 'CommandModule_Bow';

  // Aerodynamic/Deflection Bow Nosecone (Angular, faceted, not an airplane wing)
  const noseConeGeo = new THREE.CylinderGeometry(2.4, 7.8, 16.0, 8, 1);
  const noseConeMesh = new THREE.Mesh(noseConeGeo, armorMat);
  noseConeMesh.rotation.x = Math.PI / 2;
  noseConeMesh.position.set(0, 0.5, -52.0);
  commandModule.add(noseConeMesh);

  // Armored Observation Bridge Canopy (Forward Cupola)
  const canopyGeo = new THREE.SphereGeometry(4.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2);
  const canopyMesh = new THREE.Mesh(canopyGeo, glassMat);
  canopyMesh.rotation.x = -Math.PI / 2.3;
  canopyMesh.position.set(0, 3.8, -48.5);
  canopyMesh.scale.set(1.1, 0.75, 1.4);
  commandModule.add(canopyMesh);

  // Reinforcing bridge canopy frame ribs
  const canopyFrameGeo = new THREE.TorusGeometry(4.1, 0.28, 8, 16, Math.PI);
  const canopyFrameMesh = new THREE.Mesh(canopyFrameGeo, secondaryArmorMat);
  canopyFrameMesh.rotation.x = -Math.PI / 2.3;
  canopyFrameMesh.position.set(0, 3.7, -48.5);
  commandModule.add(canopyFrameMesh);

  // Forward Navigation Lidar Sensor Array (tri-cluster)
  [-1.8, 0, 1.8].forEach((x, idx) => {
    const sensorGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.4, 12);
    const sensor = new THREE.Mesh(sensorGeo, copperDetailMat);
    sensor.rotation.x = Math.PI / 2;
    sensor.position.set(x, 4.2 + (idx === 1 ? 0.6 : 0), -58.2);
    commandModule.add(sensor);
  });

  // Forward Directional Communications Mast
  const mastGeo = new THREE.CylinderGeometry(0.12, 0.2, 5.5, 8);
  const mast = new THREE.Mesh(mastGeo, trussMat);
  mast.position.set(0, 6.2, -45.0);
  mast.rotation.z = 0.08;
  commandModule.add(mast);

  root.add(commandModule);

  // =========================================================================
  // 2. CENTRAL STRUCTURAL SPINE & PRESSURIZED TRUNK (Z = -42m to +35m)
  // =========================================================================
  const structuralSpine = new THREE.Group();
  structuralSpine.name = 'StructuralSpine_Core';

  // Central Pressurized Transit Conduit (connecting Deck 01 to Deck 04)
  const coreTrunkGeo = new THREE.CylinderGeometry(6.5, 7.2, 74.0, 12, 1);
  const coreTrunk = new THREE.Mesh(coreTrunkGeo, secondaryArmorMat);
  coreTrunk.rotation.x = Math.PI / 2;
  coreTrunk.position.set(0, 0, -4.0);
  structuralSpine.add(coreTrunk);

  // Heavy External Truss Girders (hexagonal cage around core)
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
    const girderGeo = new THREE.BoxGeometry(0.45, 0.45, 76.0);
    const girder = new THREE.Mesh(girderGeo, trussMat);
    const radius = 8.6;
    girder.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -4.0);
    structuralSpine.add(girder);

    // Cross-reinforcement structural rings
    [-32, -16, 0, 16, 32].forEach((ringZ) => {
      const ringSegGeo = new THREE.BoxGeometry(1.6, 0.35, 0.35);
      const ringSeg = new THREE.Mesh(ringSegGeo, trussMat);
      ringSeg.position.set(Math.cos(angle) * (radius - 0.5), Math.sin(angle) * (radius - 0.5), ringZ);
      ringSeg.rotation.z = angle + Math.PI / 2;
      structuralSpine.add(ringSeg);
    });
  }

  // Androgynous Peripheral Docking System (APAS) Port on Dorsal Core
  const dockingRingGeo = new THREE.TorusGeometry(1.8, 0.32, 12, 24);
  const dockingRing = new THREE.Mesh(dockingRingGeo, secondaryArmorMat);
  dockingRing.rotation.x = Math.PI / 2;
  dockingRing.position.set(0, 8.8, -12.0);
  structuralSpine.add(dockingRing);

  const hatchCapGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.4, 16);
  const hatchCap = new THREE.Mesh(hatchCapGeo, warningStripeMat);
  hatchCap.position.set(0, 8.6, -12.0);
  structuralSpine.add(hatchCap);

  root.add(structuralSpine);

  // =========================================================================
  // 3. SCIENCE MODULES & INSTRUMENT PODS (Z = -20m to -40m)
  // =========================================================================
  const scienceModules = new THREE.Group();
  scienceModules.name = 'ScienceModules_ResearchPods';

  // Port Science Pod (Deck 02 Analysis Bay)
  const podGeo = new THREE.CylinderGeometry(4.2, 4.2, 18.0, 12, 1);
  const portPod = new THREE.Mesh(podGeo, armorMat);
  portPod.rotation.x = Math.PI / 2;
  portPod.position.set(-8.8, 0.5, -28.0);
  scienceModules.add(portPod);

  // Starboard Science Pod (Cryogenic IR Instrument Enclosure)
  const stbdPod = portPod.clone();
  stbdPod.position.x = 8.8;
  scienceModules.add(stbdPod);

  // Connecting pressurized science airlocks to core
  [-8.8, 8.8].forEach((x) => {
    const bridgeGeo = new THREE.CylinderGeometry(1.8, 1.8, 4.2, 8);
    const bridge = new THREE.Mesh(bridgeGeo, secondaryArmorMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(x * 0.5, 0.5, -28.0);
    scienceModules.add(bridge);
  });

  // Ventral SPHEREx-compatible Infrared Cryogenic Telescope Assembly
  const telescopeEnclosureGeo = new THREE.CylinderGeometry(2.1, 2.5, 6.4, 16, 1, true);
  const telescopeEnclosure = new THREE.Mesh(telescopeEnclosureGeo, secondaryArmorMat);
  telescopeEnclosure.rotation.x = Math.PI / 2.15;
  telescopeEnclosure.position.set(0, -8.2, -32.0);
  scienceModules.add(telescopeEnclosure);

  // Primary Gold-Coated Cryogenic Mirror
  const mirrorGeo = new THREE.CircleGeometry(1.9, 24);
  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.98,
    roughness: 0.08,
    name: 'GoldInfraredMirror',
  });
  const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
  mirror.rotation.x = -Math.PI / 2.15;
  mirror.position.set(0, -7.5, -30.8);
  scienceModules.add(mirror);

  // Telescopic Sunshield Vanes (characteristic multi-layer insulation)
  const sunshieldGeo = new THREE.BoxGeometry(7.2, 0.12, 9.4);
  const sunshield = new THREE.Mesh(sunshieldGeo, copperDetailMat);
  sunshield.position.set(0, -9.6, -32.5);
  sunshield.rotation.x = -0.15;
  scienceModules.add(sunshield);

  root.add(scienceModules);

  // =========================================================================
  // 4. HABITATION MODULE (Deck 03 Living Quarters: Z = -8m to +16m)
  // =========================================================================
  const habitatModule = new THREE.Group();
  habitatModule.name = 'HabitatModule_CrewQuarters';

  // Twin cylindrical pressurized habitat drums
  const drumGeo = new THREE.CylinderGeometry(5.2, 5.2, 22.0, 16);
  const portDrum = new THREE.Mesh(drumGeo, secondaryArmorMat);
  portDrum.rotation.x = Math.PI / 2;
  portDrum.position.set(-6.5, 1.2, 4.0);
  habitatModule.add(portDrum);

  const stbdDrum = portDrum.clone();
  stbdDrum.position.x = 6.5;
  habitatModule.add(stbdDrum);

  // Crew Zero-G Porthole Windows
  [-6.5, 6.5].forEach((x) => {
    [-3, 2, 7, 12].forEach((z) => {
      const portHole = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), glassMat);
      portHole.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      portHole.position.set(x + (x > 0 ? 5.22 : -5.22), 1.2, z);
      habitatModule.add(portHole);
    });
  });

  // Ventral EVA Airlock Staging Bay with safety markers
  const airlockBayGeo = new THREE.BoxGeometry(4.2, 3.2, 5.6);
  const airlockBay = new THREE.Mesh(airlockBayGeo, armorMat);
  airlockBay.position.set(0, -7.2, 6.0);
  habitatModule.add(airlockBay);

  // Yellow Safety EVA Handrails around airlock
  [-1.8, 1.8].forEach((x) => {
    const railGeo = new THREE.BoxGeometry(0.08, 0.08, 4.8);
    const rail = new THREE.Mesh(railGeo, warningStripeMat);
    rail.position.set(x, -8.7, 6.0);
    habitatModule.add(rail);
  });

  root.add(habitatModule);

  // =========================================================================
  // 5. THERMAL RADIATOR PANELS (Lateral heat dissipation: Z = +5m to +28m)
  // =========================================================================
  const radiatorArrays = new THREE.Group();
  radiatorArrays.name = 'RadiatorThermalArrays';

  // High-efficiency graphene deployed heat radiator panels
  [-1, 1].forEach((dir) => {
    const panelGeo = new THREE.BoxGeometry(9.5, 0.15, 20.0);
    const panel = new THREE.Mesh(panelGeo, radiatorMat);
    panel.position.set(dir * 17.5, 1.5, 16.0);
    panel.rotation.z = dir * 0.12;

    // Hinged support truss struts
    const strutGeo = new THREE.CylinderGeometry(0.18, 0.18, 6.4, 8);
    const strut = new THREE.Mesh(strutGeo, trussMat);
    strut.rotation.z = dir * (Math.PI / 2 - 0.2);
    strut.position.set(dir * 10.5, 1.2, 16.0);

    radiatorArrays.add(panel, strut);
  });

  root.add(radiatorArrays);

  // =========================================================================
  // 6. ENGINEERING & PROPULSION CORE (Deck 04 Aft: Z = +20m to +60m)
  // =========================================================================
  const engineeringModule = new THREE.Group();
  engineeringModule.name = 'EngineeringModule_AftCore';

  // Tokamak/Plasma Reactor Housing (Reinforced spherical cylinder)
  const reactorGeo = new THREE.CylinderGeometry(7.8, 9.2, 24.0, 16, 2);
  const reactor = new THREE.Mesh(reactorGeo, armorMat);
  reactor.rotation.x = Math.PI / 2;
  reactor.position.set(0, 0, 32.0);
  engineeringModule.add(reactor);

  // Superconducting Magnetic Field Torus Bands
  [-2, 6, 14].forEach((offsetZ) => {
    const coilGeo = new THREE.TorusGeometry(8.9, 0.45, 8, 24);
    const coil = new THREE.Mesh(coilGeo, copperDetailMat);
    coil.position.set(0, 0, 32.0 + offsetZ);
    engineeringModule.add(coil);
  });

  // =========================================================================
  // 7. ENGINE CLUSTER & NOZZLES (Aft Thrusters: Z = +44m to +58m)
  // =========================================================================
  const engineCluster = new THREE.Group();
  engineCluster.name = 'EngineCluster_Nozzles';

  // 3 Primary Magnetoplasmadynamic (MPD) Ion Thruster Nozzles
  const enginePositions = [
    { x: 0, y: 3.4, z: 57.0 },
    { x: -4.2, y: -2.8, z: 57.0 },
    { x: 4.2, y: -2.8, z: 57.0 },
  ];

  const engineNozzles = [];
  const exhaustPlumes = [];

  enginePositions.forEach((pos, idx) => {
    // Outer Bell Nozzle (rim reaches exactly Z = +60.0m)
    const bellGeo = new THREE.CylinderGeometry(1.6, 3.4, 6.0, 20, 1, true);
    const bell = new THREE.Mesh(bellGeo, armorMat);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(pos.x, pos.y, pos.z);
    engineCluster.add(bell);

    // Inner Magnetic Confinement Ring
    const innerRingGeo = new THREE.TorusGeometry(1.8, 0.24, 8, 24);
    const innerRing = new THREE.Mesh(innerRingGeo, copperDetailMat);
    innerRing.position.set(pos.x, pos.y, pos.z + 1.2);
    engineCluster.add(innerRing);

    // Active Ion Exhaust Plume (animated in tick)
    const plumeGeo = new THREE.ConeGeometry(2.0, 5.8, 16, 1, true);
    const plume = new THREE.Mesh(plumeGeo, engineGlowMat);
    plume.rotation.x = -Math.PI / 2;
    plume.position.set(pos.x, pos.y, pos.z);
    engineCluster.add(plume);

    exhaustPlumes.push(plume);
    engineNozzles.push({ bell, innerRing, plume, idx });
  });

  engineeringModule.add(engineCluster);

  // 8 Quad RCS Thruster Pods (Reaction Control System in 3D Zero-G)
  const rcsLocations = [
    // Bow RCS blocks
    { x: -6.5, y: 4.5, z: -44.0 },
    { x: 6.5, y: 4.5, z: -44.0 },
    { x: -6.5, y: -4.5, z: -44.0 },
    { x: 6.5, y: -4.5, z: -44.0 },
    // Aft RCS blocks
    { x: -8.5, y: 6.0, z: 38.0 },
    { x: 8.5, y: 6.0, z: 38.0 },
    { x: -8.5, y: -6.0, z: 38.0 },
    { x: 8.5, y: -6.0, z: 38.0 },
  ];

  rcsLocations.forEach((loc) => {
    const rcsBaseGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const rcsBase = new THREE.Mesh(rcsBaseGeo, secondaryArmorMat);
    rcsBase.position.set(loc.x, loc.y, loc.z);
    engineeringModule.add(rcsBase);

    // 4 micro-nozzles per pod
    [
      [0.65, 0, 0],
      [-0.65, 0, 0],
      [0, 0.65, 0],
      [0, -0.65, 0],
    ].forEach(([dx, dy, dz]) => {
      const nozzleGeo = new THREE.ConeGeometry(0.18, 0.45, 8, 1, true);
      const nozzle = new THREE.Mesh(nozzleGeo, copperDetailMat);
      nozzle.position.set(loc.x + dx, loc.y + dy, loc.z + dz);
      nozzle.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      engineeringModule.add(nozzle);
    });
  });

  root.add(engineeringModule);

  // =========================================================================
  // 8. HIGH-GAIN COMMUNICATION DISH (Dorsal Gimbaled Steerable Antenna)
  // =========================================================================
  const antennaGroup = new THREE.Group();
  antennaGroup.name = 'HighGainAntennaDish';

  const dishBaseGeo = new THREE.CylinderGeometry(0.9, 1.2, 2.2, 12);
  const dishBase = new THREE.Mesh(dishBaseGeo, trussMat);
  dishBase.position.set(0, 9.2, -2.0);
  antennaGroup.add(dishBase);

  // Steerable Gimbal Dish
  const dishHead = new THREE.Group();
  dishHead.name = 'DishGimbalHead';
  dishHead.position.set(0, 10.8, -2.0);
  dishHead.rotation.x = -0.38;
  dishHead.rotation.y = 0.52;

  const parabolicGeo = new THREE.SphereGeometry(3.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3);
  const parabolicMesh = new THREE.Mesh(parabolicGeo, secondaryArmorMat);
  parabolicMesh.rotation.x = Math.PI;
  dishHead.add(parabolicMesh);

  // Feed Horn Assembly
  const feedHornGeo = new THREE.ConeGeometry(0.35, 2.8, 8);
  const feedHorn = new THREE.Mesh(feedHornGeo, copperDetailMat);
  feedHorn.rotation.x = Math.PI;
  feedHorn.position.set(0, 0, 1.4);
  dishHead.add(feedHorn);

  antennaGroup.add(dishHead);
  root.add(antennaGroup);

  // =========================================================================
  // 9. NAVIGATION LIGHTS (Standard Maritime/Astronautic Starboard/Port/Beacon)
  // =========================================================================
  const navLights = [];
  const lightSpecs = [
    { x: -17.5, y: 1.5, z: 24.0, color: 0xef4444, label: 'PortLightRed' },
    { x: 17.5, y: 1.5, z: 24.0, color: 0x22c55e, label: 'StarboardLightGreen' },
    { x: 0, y: 11.2, z: -46.0, color: 0xffffff, label: 'BowDorsalWhite' },
    { x: 0, y: -9.8, z: 32.0, color: 0x38bdf8, label: 'VentralBeaconCyan' },
  ];

  lightSpecs.forEach((spec) => {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: spec.color }),
    );
    bulb.position.set(spec.x, spec.y, spec.z);
    bulb.name = spec.label;
    root.add(bulb);
    navLights.push({ bulb, color: spec.color });
  });

  // Functional Animation Controller
  const update = (elapsedSeconds = 0, engineThrust = 1.0) => {
    // 1. Gently animate ion plasma plumes
    exhaustPlumes.forEach((plume, i) => {
      const pulse = 0.92 + Math.sin(elapsedSeconds * 12.0 + i * 2.1) * 0.08;
      plume.scale.set(pulse, pulse * (0.8 + engineThrust * 0.4), pulse);
      plume.visible = engineThrust > 0.01;
    });

    // 2. Slow tracking orientation of the high-gain deep-space antenna
    dishHead.rotation.y = 0.45 + Math.sin(elapsedSeconds * 0.15) * 0.35;
    dishHead.rotation.x = -0.32 + Math.cos(elapsedSeconds * 0.12) * 0.18;

    // 3. Blink navigation strobes synchronously
    const blink = Math.floor(elapsedSeconds * 1.5) % 2 === 0;
    navLights.forEach(({ bulb }) => {
      bulb.visible = blink;
    });
  };

  return {
    root,
    commandModule,
    structuralSpine,
    scienceModules,
    habitatModule,
    engineeringModule,
    radiatorArrays,
    engineCluster,
    antennaGroup,
    dishHead,
    exhaustPlumes,
    navLights,
    dimensions: SHIP_METRIC_DIMENSIONS,
    update,
  };
}

/**
 * Asynchronously exports the 120-meter modular ship hierarchy to binary GLTF/GLB format
 * for runtime asset caching or external modeling tool inspection.
 */
export async function exportModularShipToGLB(shipRoot) {
  if (typeof window === 'undefined') {
    globalThis.window = {
      FileReader: class {
        readAsArrayBuffer(blob) {
          blob.arrayBuffer().then((buf) => {
            this.result = buf;
            this.onloadend?.();
          });
        }
        readAsDataURL(blob) {
          blob.arrayBuffer().then((buf) => {
            this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
            this.onloadend?.();
          });
        }
      },
    };
  }

  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    try {
      exporter.parse(
        shipRoot,
        (gltfBinary) => {
          resolve(gltfBinary);
        },
        { binary: true },
      );
    } catch (err) {
      reject(err);
    }
  });
}
