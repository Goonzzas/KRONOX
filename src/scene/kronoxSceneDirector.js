import * as THREE from 'three';
import { PHYSICAL_CABIN_STATIONS, SHIP_WORLD_UNITS } from './habitableShipWorld.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';

/**
 * Official Ship & Scene Events orchestrated in real time by `KronoxSceneDirector` (Section 2).
 */
export const KRONOX_SCENE_EVENTS = {
  CABIN_ENTERED: 'CABIN_ENTERED',
  AI_ACTIVATED: 'AI_ACTIVATED',
  NAVIGATION_SELECTED: 'NAVIGATION_SELECTED',
  DESTINATION_CONFIRMED: 'DESTINATION_CONFIRMED',
  PROPULSION_ENGAGED: 'PROPULSION_ENGAGED',
  EXTERIOR_CAMERA_REQUESTED: 'EXTERIOR_CAMERA_REQUESTED',
  JUMP_INITIATED: 'JUMP_INITIATED',
  ARRIVAL_DETECTED: 'ARRIVAL_DETECTED',
  SCIENTIFIC_SCAN_STARTED: 'SCIENTIFIC_SCAN_STARTED',
  MISSION_ACTIVATED: 'MISSION_ACTIVATED',
};

/**
 * Control modes for the user & scene (Section 6):
 * - 'FREE_ASTRONAUT': User walks freely (`WASD` + mouse) inside the `1u = 1m` 3D cabin.
 * - 'MACHINE_INTERACTION': Astronaut is operating a physical 3D station inside the bridge.
 * - 'CINEMATIC_SEQUENCE': Real-time 3D engine sequence driven by ship systems (always skippable).
 * - 'EXTERIOR_FLIGHT': User pilots the 120 m ship from exterior camera.
 */
export const KRONOX_CONTROL_MODES = {
  FREE_ASTRONAUT: 'FREE_ASTRONAUT',
  MACHINE_INTERACTION: 'MACHINE_INTERACTION',
  CINEMATIC_SEQUENCE: 'CINEMATIC_SEQUENCE',
  EXTERIOR_FLIGHT: 'EXTERIOR_FLIGHT',
};

/**
 * Builds the 3D Machine Effect Meshes inside the Habitable Cabin (Section 3):
 * 1. Navigation Console 3D Holographic Star Map & Route Vector above `(0, 1.45, -6.2)`
 * 2. AI Holographic Projector Emitter Pedestal & Volumetric Cone at `(0.95, 0, -4.2)`
 * 3. Science Console 3D Volumetric Sensor Sweep Rings above `(-4.2, 1.45, -2.2)`
 * 4. Panoramic Bow Window 3D Target Reticle & Telemetry Frame at `(0, 2.1, -11.6)`
 * 5. Propulsion Power Conduits along the cabin floor & bulkheads
 */
export function buildCabinMachineSystems3D() {
  const systemsRoot = new THREE.Group();
  systemsRoot.name = 'KronoxCabinMachineSystems3D';

  // =========================================================================
  // 1. NAVIGATION CONSOLE 3D HOLOGRAPHIC STAR MAP & ROUTE VECTOR
  // =========================================================================
  const navHoloGroup = new THREE.Group();
  navHoloGroup.position.set(0, 1.72, -6.2);
  navHoloGroup.visible = false;

  const holoSphereMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
  });
  const holoGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 14), holoSphereMat);
  navHoloGroup.add(holoGlobe);

  const eclipticRing = new THREE.Mesh(
    new THREE.RingGeometry(0.66, 0.7, 48),
    new THREE.MeshBasicMaterial({
      color: 0x6ff0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    }),
  );
  eclipticRing.rotation.x = Math.PI / 2;
  navHoloGroup.add(eclipticRing);

  // Origin node (Sol / Ship)
  const originNode = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  navHoloGroup.add(originNode);

  // Destination node & 3D route vector line inside the hologram
  const destNode = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  destNode.position.set(0.32, 0.22, -0.35);
  navHoloGroup.add(destNode);

  const routePositions = new Float32Array([0, 0, 0, 0.32, 0.22, -0.35]);
  const routeGeo = new THREE.BufferGeometry();
  routeGeo.setAttribute('position', new THREE.BufferAttribute(routePositions, 3));
  const routeLine = new THREE.Line(
    routeGeo,
    new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.95,
    }),
  );
  navHoloGroup.add(routeLine);
  systemsRoot.add(navHoloGroup);

  // =========================================================================
  // 2. AI PROJECTOR EMITTER & DIEGETIC PEDESTAL
  // =========================================================================
  const aiProjectorGroup = new THREE.Group();
  aiProjectorGroup.position.set(0.95, 0.02, -4.2);

  const emitterPad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.32, 0.04, 24),
    new THREE.MeshStandardMaterial({
      color: 0x0a1220,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
    }),
  );
  aiProjectorGroup.add(emitterPad);

  // Discrete holographic emitter ring (replaces the giant inverted cone that spanned from ceiling to floor)
  const projectorBeamCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.16, 0.35, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  projectorBeamCone.position.y = 0.18;
  aiProjectorGroup.add(projectorBeamCone);
  systemsRoot.add(aiProjectorGroup);

  // =========================================================================
  // 3. SCIENCE SENSOR SWEEP RINGS ABOVE SCIENCE CONSOLE (`-4.2, 1.45, -2.2`)
  // =========================================================================
  const sensorSweepGroup = new THREE.Group();
  sensorSweepGroup.position.set(-4.2, 1.68, -2.2);
  sensorSweepGroup.visible = false;

  const sensorRings = [0.35, 0.52, 0.68].map((radius, idx) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.012, 10, 48),
      new THREE.MeshBasicMaterial({
        color: idx === 1 ? 0x34d399 : 0x6ee7b7,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      }),
    );
    sensorSweepGroup.add(ring);
    return ring;
  });
  systemsRoot.add(sensorSweepGroup);

  // =========================================================================
  // 4. PANORAMIC BOW WINDOW 3D TARGET RETICLE (`0, 2.15, -11.5`)
  // =========================================================================
  const bowReticleGroup = new THREE.Group();
  bowReticleGroup.position.set(0, 2.15, -11.5);
  bowReticleGroup.visible = false;

  const outerReticle = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.79, 48),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    }),
  );
  const innerReticle = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.35, 36),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    }),
  );
  bowReticleGroup.add(outerReticle, innerReticle);
  systemsRoot.add(bowReticleGroup);

  // =========================================================================
  // 5. PROPULSION ENERGY CONDUITS & CABIN ENGINE GLOW LIGHT
  // =========================================================================
  const propulsionLight = new THREE.PointLight(0x38bdf8, 0.2, 22);
  propulsionLight.position.set(0, 2.2, 8.5);
  systemsRoot.add(propulsionLight);

  function setRouteTargetVector(targetKey) {
    const tgt = SPHEREX_TARGETS.find((item) => item.key === targetKey) || SPHEREX_TARGETS[0];
    const raRad = ((tgt.ra || 120) * Math.PI) / 180;
    const decRad = ((tgt.dec || 15) * Math.PI) / 180;
    const r = 0.52;
    const x = r * Math.cos(decRad) * Math.cos(raRad);
    const y = r * Math.sin(decRad);
    const z = -r * Math.cos(decRad) * Math.sin(raRad);
    destNode.position.set(x, y, z);
    const posAttr = routeGeo.attributes.position;
    posAttr.setXYZ(1, x, y, z);
    posAttr.needsUpdate = true;
  }

  function update(dt, elapsedTime, systemStates) {
    // Rotate 3D holographic star map when active
    if (navHoloGroup.visible) {
      holoGlobe.rotation.y = elapsedTime * 0.45;
      eclipticRing.rotation.z = elapsedTime * 0.25;
      destNode.scale.setScalar(1 + Math.sin(elapsedTime * 6) * 0.25);
    }

    // Pulse AI projector emitter ring only when AI is explicitly projecting from pedestal
    if (projectorBeamCone) {
      projectorBeamCone.material.opacity = systemStates.aiActive
        ? 0.08 + Math.sin(elapsedTime * 4) * 0.03
        : 0;
    }

    // Animate 3D sensor sweep rings
    if (sensorSweepGroup.visible) {
      sensorRings.forEach((ring, i) => {
        ring.rotation.x = elapsedTime * (1.2 + i * 0.4);
        ring.rotation.y = elapsedTime * (0.9 - i * 0.3);
      });
    }

    // Animate bow panoramic window 3D target reticle
    if (bowReticleGroup.visible) {
      outerReticle.rotation.z = elapsedTime * 0.6;
      innerReticle.rotation.z = -elapsedTime * 1.1;
    }

    // Modulate propulsion light intensity when engines are engaged
    const targetIntensity =
      systemStates.propulsionState === 'JUMP'
        ? 3.8 + Math.sin(elapsedTime * 18) * 1.2
        : systemStates.propulsionState === 'ENGAGED'
          ? 2.2 + Math.sin(elapsedTime * 8) * 0.5
          : 0.35;
    propulsionLight.intensity += (targetIntensity - propulsionLight.intensity) * Math.min(1, dt * 6);
    propulsionLight.color.setHex(
      systemStates.propulsionState === 'JUMP' ? 0x6ff0ff : 0x38bdf8,
    );
  }

  return {
    systemsRoot,
    navHoloGroup,
    aiProjectorGroup,
    sensorSweepGroup,
    bowReticleGroup,
    propulsionLight,
    setRouteTargetVector,
    update,
  };
}

/**
 * `KronoxSceneDirector`: Central event-driven orchestrator (Sections 2, 3, 4, 5 & 6).
 * Coordinates the 120m ship systems, habitable 3D cabin machines, camera trajectories,
 * 1.75m astronaut control states, and the 3D luminous Kronox IA entity.
 */
export function createKronoxSceneDirector({
  cabinSystem,
  machineSystems,
  luminousAI,
  onEventCallback,
  onNarrativeCallback,
  onControlModeChange,
}) {
  const shipState = {
    controlMode: KRONOX_CONTROL_MODES.FREE_ASTRONAUT,
    lastEvent: null,
    aiActive: true,
    navMapDeployed: false,
    selectedDestination: null,
    confirmedDestination: null,
    propulsionState: 'IDLE', // 'IDLE' | 'ENGAGED' | 'JUMP' | 'ARRIVED'
    sensorState: 'STANDBY', // 'STANDBY' | 'SCANNING' | 'LOCKED'
    activeSequence: null,
    eventLog: [],
  };

  function setControlMode(nextMode) {
    if (shipState.controlMode !== nextMode) {
      shipState.controlMode = nextMode;
      onControlModeChange?.(nextMode, { ...shipState });
    }
  }

  function narrateSynced(text, aiState = 'Comunicación', stationId = null) {
    if (aiState) luminousAI.setState(aiState);
    onNarrativeCallback?.(text, aiState, stationId, { ...shipState });
  }

  /**
   * Dispatches a ship system or astronaut event (`KRONOX_SCENE_EVENTS`),
   * triggering real-time 3D machine states, AI physical movement, and camera choreography.
   */
  function dispatchEvent(eventName, payload = {}) {
    if (!Object.values(KRONOX_SCENE_EVENTS).includes(eventName)) {
      return null;
    }

    const entry = {
      event: eventName,
      timestamp: Date.now(),
      payload,
    };
    shipState.lastEvent = eventName;
    shipState.eventLog = [...shipState.eventLog.slice(-19), entry];

    const navStation = PHYSICAL_CABIN_STATIONS.find((s) => s.id === 'nav');
    const sciStation = PHYSICAL_CABIN_STATIONS.find((s) => s.id === 'science');
    const misStation = PHYSICAL_CABIN_STATIONS.find((s) => s.id === 'missions');
    const winStation = PHYSICAL_CABIN_STATIONS.find((s) => s.id === 'windows');

    switch (eventName) {
      case 'CABIN_ENTERED': {
        shipState.aiActive = true;
        setControlMode(KRONOX_CONTROL_MODES.FREE_ASTRONAUT);
        luminousAI.setTargetPosition(new THREE.Vector3(0.95, 1.72, -4.2), 'Acompañamiento');
        luminousAI.pointAtWorldPosition(null, false);
        narrateSynced(
          'Sistemas ambientales del puente en línea (escala 1 unidad = 1 metro). Camina con WASD hacia cualquier consola física para operar la nave.',
          'Acompañamiento',
          null,
        );
        break;
      }

      case 'AI_ACTIVATED': {
        shipState.aiActive = true;
        // Emerge above the AI projector pedestal and glide toward the astronaut
        luminousAI.setTargetPosition(new THREE.Vector3(0.95, 1.68, -3.4), 'Comunicación');
        luminousAI.pointAtWorldPosition(null, false);
        narrateSynced(
          payload.message ||
            'Proyector cuántico activo. Soy Kronox IA, tu entidad luminosa de a bordo. Te acompañaré por las consolas de la nave y en cada observación astronómica.',
          'Comunicación',
          'comms',
        );
        break;
      }

      case 'NAVIGATION_SELECTED': {
        shipState.navMapDeployed = true;
        machineSystems.navHoloGroup.visible = true;
        const tgtKey = payload.targetKey || shipState.selectedDestination?.key || 'barnard';
        const tgt = SPHEREX_TARGETS.find((item) => item.key === tgtKey) || SPHEREX_TARGETS[0];
        shipState.selectedDestination = tgt;
        machineSystems.setRouteTargetVector(tgt.key);
        setControlMode(KRONOX_CONTROL_MODES.MACHINE_INTERACTION);

        if (navStation) {
          luminousAI.setTargetPosition(navStation.aiHoverPos, 'Explicación');
          luminousAI.pointAtWorldPosition(new THREE.Vector3(0, 1.72, -6.2), true);
          cabinSystem.stationMeshes
            .find((s) => s.id === 'nav')
            ?.updateScreen(`RUTA TRAZADA: ${tgt.name.toUpperCase()}`);
        }
        narrateSynced(
          `Consola de Navegación activa. He desplegado el holograma estelar 3D y calculado el vector hacia ${tgt.name} (${tgt.distanceLabel}). Confirma el destino para encender los propulsores.`,
          'Explicación',
          'nav',
        );
        break;
      }

      case 'DESTINATION_CONFIRMED': {
        const tgt =
          payload.target ||
          SPHEREX_TARGETS.find((item) => item.key === payload.targetKey) ||
          shipState.selectedDestination ||
          SPHEREX_TARGETS[0];
        shipState.selectedDestination = tgt;
        shipState.confirmedDestination = tgt;
        shipState.navMapDeployed = true;
        machineSystems.navHoloGroup.visible = true;
        machineSystems.setRouteTargetVector(tgt.key);
        machineSystems.bowReticleGroup.visible = true;

        if (navStation) {
          luminousAI.setTargetPosition(navStation.aiHoverPos, 'Señalización');
          luminousAI.pointAtWorldPosition(new THREE.Vector3(0, 2.15, -11.5), false);
          cabinSystem.stationMeshes
            .find((s) => s.id === 'nav')
            ?.updateScreen(`DESTINO FIJADO: ${tgt.name.toUpperCase()}`);
        }
        narrateSynced(
          `Coordenadas de ${tgt.name} (RA ${tgt.ra.toFixed(3)}°, Dec ${tgt.dec.toFixed(3)}°) bloqueadas en el computador de vuelo. Iniciando secuencia de propulsión.`,
          'Señalización',
          'nav',
        );
        break;
      }

      case 'PROPULSION_ENGAGED': {
        shipState.propulsionState = 'ENGAGED';
        setControlMode(KRONOX_CONTROL_MODES.CINEMATIC_SEQUENCE);
        const tgtName =
          payload.targetName ||
          shipState.confirmedDestination?.name ||
          shipState.selectedDestination?.name ||
          'el objetivo estelar';

        // Start real-time 3D propulsion & exterior departure sequence (Section 4)
        shipState.activeSequence = {
          type: 'PROPULSION_AND_DEPARTURE',
          elapsed: 0,
          duration: payload.duration || 6.4,
          phaseNotified: -1,
          targetName: tgtName,
        };
        luminousAI.setTargetPosition(new THREE.Vector3(1.2, 1.75, -5.2), 'Desplazamiento');
        narrateSynced(
          `Propulsores iónicos encendidos. Observa cómo la nave KRONOX de 120 metros alinea su vector y se desplaza hacia ${tgtName} (interpolación espacial suavizada sp.lerpVectors en unidades de mapa galáctico).`,
          'Desplazamiento',
          'nav',
        );
        break;
      }

      case 'EXTERIOR_CAMERA_REQUESTED': {
        setControlMode(KRONOX_CONTROL_MODES.EXTERIOR_FLIGHT);
        narrateSynced(
          `Cámara exterior del casco activa (${SHIP_WORLD_UNITS.SHIP_LENGTH_METERS} metros de eslora). Los motores responden al régimen de velocidad de crucero del simulador.`,
          'Acompañamiento',
          null,
        );
        break;
      }

      case 'JUMP_INITIATED': {
        shipState.propulsionState = 'JUMP';
        setControlMode(KRONOX_CONTROL_MODES.CINEMATIC_SEQUENCE);
        const tgtName =
          payload.targetName ||
          shipState.confirmedDestination?.name ||
          'el sistema estelar';
        narrateSynced(
          `Tránsito interestelar en curso hacia ${tgtName}. Desplazamiento visual simulado en el mapa galáctico 3D hacia sus coordenadas ICRS J2025.8.`,
          'Desplazamiento',
          'windows',
        );
        break;
      }

      case 'ARRIVAL_DETECTED': {
        shipState.propulsionState = 'ARRIVED';
        shipState.sensorState = 'SCANNING';
        shipState.activeSequence = null;
        machineSystems.sensorSweepGroup.visible = true;
        machineSystems.bowReticleGroup.visible = true;
        setControlMode(KRONOX_CONTROL_MODES.FREE_ASTRONAUT);

        const tgtName =
          payload.targetName ||
          shipState.confirmedDestination?.name ||
          shipState.selectedDestination?.name ||
          'el destino';

        if (winStation) {
          luminousAI.setTargetPosition(winStation.aiHoverPos, 'Señalización');
          luminousAI.pointAtWorldPosition(new THREE.Vector3(0, 2.15, -11.5), true);
        }
        narrateSynced(
          `Llegada confirmada a ${tgtName}. Los sensores de proa han fijado la estrella a través del parabrisas panorámico. Acércate a la Consola Científica SPHEREx a babor para iniciar el escaneo.`,
          'Señalización',
          'science',
        );
        break;
      }

      case 'SCIENTIFIC_SCAN_STARTED': {
        shipState.sensorState = 'LOCKED';
        machineSystems.sensorSweepGroup.visible = true;
        setControlMode(KRONOX_CONTROL_MODES.MACHINE_INTERACTION);
        const tgt =
          payload.target ||
          SPHEREX_TARGETS.find((item) => item.key === payload.targetKey) ||
          shipState.confirmedDestination ||
          shipState.selectedDestination ||
          SPHEREX_TARGETS[0];

        if (sciStation) {
          luminousAI.setTargetPosition(sciStation.aiHoverPos, 'Explicación');
          luminousAI.pointAtWorldPosition(sciStation.consolePos, true);
          cabinSystem.stationMeshes
            .find((s) => s.id === 'science')
            ?.updateScreen(`ESCANEO FITS: ${tgt.preferredBand} · ${tgt.scientificStatus}`);
        }
        narrateSynced(
          `Instrumentación científica activa sobre ${tgt.name}. Descargando recortes FITS reales de NASA SPHEREx (${tgt.preferredBand}, estado ${tgt.scientificStatus}) para comparar épocas.`,
          'Explicación',
          'science',
        );
        break;
      }

      case 'MISSION_ACTIVATED': {
        setControlMode(KRONOX_CONTROL_MODES.MACHINE_INTERACTION);
        if (misStation) {
          luminousAI.setTargetPosition(misStation.aiHoverPos, 'Explicación');
          luminousAI.pointAtWorldPosition(misStation.consolePos, true);
        }
        narrateSynced(
          'Consola de Misiones activada. Selecciona un objetivo estelar para trazar la ruta en la Consola de Navegación o continúa registrando hallazgos verificados.',
          'Explicación',
          'missions',
        );
        break;
      }

      default:
        break;
    }

    onEventCallback?.(eventName, payload, { ...shipState });
    return entry;
  }

  /**
   * Updates active system-driven real-time 3D sequences (`PROPULSION_AND_DEPARTURE`, etc.)
   * and returns camera override instructions if a sequence is currently directing the camera.
   */
  function update(dt, elapsedTime) {
    machineSystems.update(dt, elapsedTime, shipState);

    if (!shipState.activeSequence) {
      return null;
    }

    const seq = shipState.activeSequence;
    seq.elapsed += dt;
    const u = Math.min(1, seq.elapsed / seq.duration);

    if (seq.type === 'PROPULSION_AND_DEPARTURE') {
      // Phase 1 (0.0 - 0.32): Pull camera back behind the 120m ship as engines ignite
      // Phase 2 (0.32 - 0.78): Wide exterior tracking shot as the ship accelerates through the cosmos
      // Phase 3 (0.78 - 1.00): Smooth return into the habitable 3D cabin bridge
      if (u >= 0.32 && seq.phaseNotified < 1) {
        seq.phaseNotified = 1;
        shipState.propulsionState = 'JUMP';
      }
      if (u >= 0.78 && seq.phaseNotified < 2) {
        seq.phaseNotified = 2;
        narrateSynced(
          `Velocidad de crucero estabilizada rumbo a ${seq.targetName}. Regresando la vista al puente habitable 3D; tienes el control del astronauta.`,
          'Acompañamiento',
          'windows',
        );
      }
      if (u >= 1) {
        shipState.activeSequence = null;
        setControlMode(KRONOX_CONTROL_MODES.FREE_ASTRONAUT);
        return { finished: true };
      }
      return {
        type: seq.type,
        progress: u,
        showExteriorShip: u < 0.82,
        showInteriorCabin: u >= 0.76,
      };
    }

    return null;
  }

  function skipActiveSequence() {
    if (shipState.activeSequence) {
      shipState.activeSequence = null;
      setControlMode(KRONOX_CONTROL_MODES.FREE_ASTRONAUT);
    }
  }

  function returnToAstronautControl() {
    setControlMode(KRONOX_CONTROL_MODES.FREE_ASTRONAUT);
  }

  return {
    dispatchEvent,
    update,
    skipActiveSequence,
    returnToAstronautControl,
    setControlMode,
    getState: () => ({ ...shipState }),
    getEventLog: () => [...shipState.eventLog],
  };
}
