import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  PHYSICAL_CONSTANTS,
  WORLD_COORDINATE_SYSTEMS,
  CATALOG_DOCUMENTATION_NOTES,
  OBSERVATION_MODES,
  OPTICAL_MAGNIFICATION_STEPS,
  PLANETARY_PHYSICAL_CATALOG,
  physicalPlanetSceneRadius,
  physicalOrbitSceneDistance,
  schematicPlanetSceneRadius,
  schematicOrbitSceneDistance,
  computeTelescopeFieldOfView,
  computeDoublePrecisionRelativeVector,
  verifyFloatingOriginPrecision,
  computeBodyObservationalMetrics,
  computeSafeOrbitalClearance,
  enforcePlanetaryCollisionBoundary,
} from '../src/scene/astronomicalScaleEngine.js';
import { P } from '../src/data/planetData.js';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';

test('FASE 1 (Secciones 1, 2 y 3) — Separación de mundos, precisión numérica Float64 + Floating Origin y escalas físicas planetarias', () => {
  // 1. Verificar definición formal de sistemas de coordenadas independientes
  assert.equal(WORLD_COORDINATE_SYSTEMS.LOCAL_METRIC_WORLD.metersPerUnit, 1.0);
  assert.equal(WORLD_COORDINATE_SYSTEMS.LOCAL_METRIC_WORLD.shipLengthUnits, 120.0);
  assert.equal(WORLD_COORDINATE_SYSTEMS.LOCAL_METRIC_WORLD.cabinLengthUnits, 24.0);
  assert.equal(WORLD_COORDINATE_SYSTEMS.LOCAL_METRIC_WORLD.astronautHeightUnits, 1.75);
  assert.equal(WORLD_COORDINATE_SYSTEMS.LOCAL_METRIC_WORLD.astronautEyeHeightUnits, 1.65);
  assert.equal(WORLD_COORDINATE_SYSTEMS.ASTRONOMICAL_PHYSICAL_WORLD.kmPerUnit, 1_000_000);
  assert.ok(WORLD_COORDINATE_SYSTEMS.ASTRONOMICAL_PHYSICAL_WORLD.cpuPrecision.includes('Float64'));

  // 2. Verificar prueba cuantitativa de precisión numérica (Float64 + Floating Origin vs Float32 directo)
  const precision1Au = verifyFloatingOriginPrecision({
    heliocentricAu: 1.0,
    localVertexOffsetMeters: 60.0,
  });
  assert.ok(
    precision1Au.floatingOriginErrorMeters < 1e-5,
    `El error local tras Floating Origin (${precision1Au.floatingOriginErrorMeters} m) debe ser sub-micrométrico`,
  );
  assert.ok(
    precision1Au.naiveFloat32ErrorMeters > 1.0,
    `Sin Floating Origin, Float32 a 1 UA pierde precisión métrica (${precision1Au.naiveFloat32ErrorMeters.toFixed(2)} m)`,
  );

  const precisionNeptune = verifyFloatingOriginPrecision({
    heliocentricAu: 30.07,
    localVertexOffsetMeters: 60.0,
  });
  assert.ok(precisionNeptune.floatingOriginErrorMeters < 1e-5);

  // 3. Cálculo relativo en doble precisión IEEE 754 (64 bits)
  const relVec = computeDoublePrecisionRelativeVector(
    { x: 5.2044, y: 0.01, z: -0.02 },
    { x: 1.0, y: 0.0, z: 0.0 },
  );
  assert.ok(relVec.deltaScene64 instanceof Float64Array);
  assert.ok(relVec.deltaMeters64 instanceof Float64Array);
  assert.ok(Math.abs(relVec.distanceAu - 4.204459) < 1e-4);

  // 4. Escala física planetaria sin fórmulas comprimidas en modos físicos
  const earthData = P.find((p) => p.n === 'Tierra');
  const saturnData = P.find((p) => p.n === 'Saturno');
  assert.equal(physicalPlanetSceneRadius(earthData), 6371 / 1_000_000);
  assert.equal(physicalPlanetSceneRadius(saturnData), 58232 / 1_000_000);
  assert.ok(
    physicalPlanetSceneRadius(earthData) < schematicPlanetSceneRadius(earthData) * 0.05,
    'El radio físico real nunca debe usar la fórmula inflada Rd_comprimido',
  );
  assert.equal(physicalOrbitSceneDistance(1.0), PHYSICAL_CONSTANTS.AU_ASTRO_SCENE_UNITS);
  assert.ok(
    physicalOrbitSceneDistance(30.07) > schematicOrbitSceneDistance(30.07) * 15,
    'La distancia heliocéntrica física conserva las UA reales sin compresión exponencial',
  );

  // 5. Documentación de parámetros existentes y ausentes del catálogo planetario
  assert.ok(CATALOG_DOCUMENTATION_NOTES.protectedSourceFile.includes('planetData.js'));
  assert.ok(CATALOG_DOCUMENTATION_NOTES.presentInPlanetData.length >= 6);
  assert.ok(CATALOG_DOCUMENTATION_NOTES.missingFromPlanetDataAndDocumentedHere.length >= 4);
});

test('FASE 1 (Prueba A) — Proporción física exacta nave (120 m) / cabina (24 m) / Tierra (R = 6.371.000 m)', () => {
  const shipLengthMeters = PHYSICAL_CONSTANTS.SHIP_LENGTH_METERS;
  const cabinLengthMeters = PHYSICAL_CONSTANTS.CABIN_LENGTH_METERS;
  const earthRadiusMeters = PLANETARY_PHYSICAL_CATALOG.Tierra.radiusKm * 1000;

  assert.equal(shipLengthMeters, 120);
  assert.equal(cabinLengthMeters, 24);
  assert.equal(earthRadiusMeters, 6_371_000);

  const ratioEarthToShip = earthRadiusMeters / shipLengthMeters;
  const ratioEarthToCabin = earthRadiusMeters / cabinLengthMeters;
  assert.ok(
    Math.abs(ratioEarthToShip - 53091.67) < 0.05,
    `Relación R_Tierra / L_nave (${ratioEarthToShip.toFixed(2)}) debe ser ≈ 53.091,67`,
  );
  assert.ok(
    ratioEarthToCabin > 265000,
    `La Tierra es ${ratioEarthToCabin.toFixed(0)} veces mayor que la cabina de 24 m`,
  );

  const earthMetrics = computeBodyObservationalMetrics({
    bodyName: 'Tierra',
    observerHeliocentricAu: { x: 1.0, y: 0, z: 0 },
    bodyHeliocentricAu: { x: 1.0001, y: 0, z: 0 },
    opticalMagnification: 1,
  });
  assert.ok(Math.abs(earthMetrics.planetRadiusToShipLengthRatio - 53091.7) < 0.1);
  assert.ok(earthMetrics.planetRadiusToCabinLengthRatio > 265000);
});

test('FASE 1 (Pruebas B y C) — Observación a simple vista (1×) vs. Telescopio Óptico (10× a 500×) por FOV óptico sin inflar mallas 3D', async () => {
  assert.deepEqual(OPTICAL_MAGNIFICATION_STEPS, [1, 10, 50, 150, 300, 500]);

  const harness = await createSceneHarness();
  try {
    const api = await harness.start();
    api.skipRealTimeIntro();
    harness.stepFrames(3);

    // Verificar separación de mundos en la escena activa
    const dualState = api.getDualWorldArchitectureState();
    assert.equal(dualState.localWorld.cabinInAstronomicalScene, false);
    assert.equal(dualState.localWorld.shipInAstronomicalScene, false);
    assert.equal(dualState.localWorld.cabinInLocalScene, true);
    assert.equal(dualState.localWorld.shipInLocalScene, true);
    assert.equal(dualState.localWorld.shipHullDimensionsMeters.lengthMeters, 120);
    assert.ok(dualState.localWorld.cabinBoundingSizeMeters.lengthMeters >= 24);
    assert.equal(dualState.astronomicalWorld.isPhysicalScale, true);

    // PRUEBA B — En Modo 1 (Simple vista 1×) desde órbita terrestre:
    const obsMode1 = api.getObservationMode();
    assert.equal(obsMode1.id, 'naked-eye');
    assert.equal(obsMode1.isCompressedScale, false);
    assert.equal(obsMode1.opticalMagnification, 1);

    const earthTel = api.getPlanetaryObservationalTelemetry('Tierra');
    const moonTel = api.getPlanetaryObservationalTelemetry('Luna');
    const jupiterTel = api.getPlanetaryObservationalTelemetry('Júpiter');
    const saturnTel = api.getPlanetaryObservationalTelemetry('Saturno');
    const marsTel = api.getPlanetaryObservationalTelemetry('Marte');

    // Tierra cercana ocupa una porción coherente (~35° a 65° en órbita alta segura)
    assert.ok(
      earthTel.angularDiameterDeg > 25 && earthTel.angularDiameterDeg < 90,
      `Tierra en órbita tiene diámetro angular coherente (${earthTel.angularDiameterDeg.toFixed(1)}°)`,
    );
    // La Luna conserva su tamaño angular real (~0.45° a 0.58°, es decir ~1600″ a 2100″)
    assert.ok(
      moonTel.angularDiameterArcsec > 1500 && moonTel.angularDiameterArcsec < 2200,
      `La Luna conserva su tamaño angular físico (${moonTel.angularDiameterArcsec.toFixed(0)}″ ≈ 0.5°)`,
    );
    // Júpiter, Saturno y Marte tienen θ < 60″ a simple vista y NO se resuelven como grandes esferas
    assert.equal(jupiterTel.resolvedNakedEye, false);
    assert.equal(saturnTel.resolvedNakedEye, false);
    assert.equal(marsTel.resolvedNakedEye, false);

    // PRUEBA C — Telescopio óptico (10×, 50×, 150×, 300×, 500×):
    // Comprobar que el aumento estrecha el FOV ópticamente y NUNCA infla el radio 3D del planeta en la escena
    const astroScene = harness.renderers[0].scene;
    const jupiterPivot = astroScene.children.find(
      (obj) => obj.userData?.planetName === 'Júpiter',
    );
    assert.ok(jupiterPivot, 'Nodo de Júpiter presente en la escena astronómica');
    const jupiterTilt = jupiterPivot.children[0];
    const physicalJupiterRadius = jupiterTilt.scale.x;
    assert.ok(
      Math.abs(physicalJupiterRadius - 69911 / 1_000_000) < 1e-7,
      `El radio en escena de Júpiter (${physicalJupiterRadius}) es exactamente 69.911 km / 10^6 km`,
    );

    const baseFov = api.getObservationMode().opticalFieldOfViewDeg;
    for (const mag of [10, 50, 150, 300, 500]) {
      const modeMag = api.setOpticalTelescope({
        enabled: true,
        magnification: mag,
        targetName: 'Júpiter',
      });
      harness.stepFrames(2);
      assert.equal(modeMag.id, 'optical-instrument');
      assert.equal(modeMag.opticalMagnification, mag);

      // El FOV de la cámara astronómica se estrecha ópticamente según FOV(M) = 2·arctan(tan(FOV_0/2)/M)
      const expectedFov = computeTelescopeFieldOfView(baseFov, mag);
      assert.ok(
        Math.abs(modeMag.opticalFieldOfViewDeg - expectedFov) < 0.01,
        `A ${mag}× el FOV óptico (${modeMag.opticalFieldOfViewDeg}°) coincide con ${expectedFov.toFixed(4)}°`,
      );
      // La malla 3D del planeta NO se infla en el espacio 3D
      assert.equal(
        jupiterTilt.scale.x,
        physicalJupiterRadius,
        `A ${mag}× la escala 3D de Júpiter permanece invariante en su radio físico`,
      );
    }

    const jupAt500x = api.getPlanetaryObservationalTelemetry('Júpiter');
    assert.equal(jupAt500x.resolvedWithInstrument, true);
    assert.deepEqual(
      jupAt500x.resolvableMoons.map((m) => m.name),
      ['Ío', 'Europa', 'Ganímedes', 'Calisto'],
    );
    assert.ok(jupAt500x.axialTiltDeg > 3);

    api.setOpticalTelescope({ enabled: false, magnification: 1 });
    harness.stepFrames(1);
  } finally {
    await harness.close();
  }
});

test('FASE 1 (Pruebas D, E, F, G y H) — Anillos de Saturno, Vista Exterior de 120 m, preservación de posición, no contaminación de escalas y warp exclusivo de hipersalto', async () => {
  const harness = await createSceneHarness();
  try {
    const api = await harness.start();
    api.skipRealTimeIntro();
    harness.stepFrames(3);

    // =========================================================================
    // PRUEBA E — Vista exterior de la nave de 120 m
    // =========================================================================
    api.view(1);
    harness.stepFrames(1);
    api.view(3);
    harness.stepFrames(1);
    const snapChase = api.navigationSnapshot();
    assert.equal(snapChase.view, 3);
    assert.equal(snapChase.shipVisible, true, 'Nave visible desde el primer frame en view(3)');
    assert.equal(snapChase.cabinVisible, false);
    assert.ok(
      Math.abs(snapChase.shipNdc[0]) < 1 &&
        Math.abs(snapChase.shipNdc[1]) < 1 &&
        snapChase.shipNdc[2] > -1 &&
        snapChase.shipNdc[2] < 1,
      `Nave centrada dentro del frustum de localCam: ${JSON.stringify(snapChase.shipNdc)}`,
    );

    assert.equal(api.inspectExterior(), true);
    harness.stepFrames(2);
    assert.equal(api.isExteriorInspection(), true);
    const dualExt = api.getDualWorldArchitectureState();
    assert.equal(dualExt.localWorld.shipHullDimensionsMeters.lengthMeters, 120);
    assert.equal(api.getShipPhysicalSpecs().localMetricScale, 120 / 2.61);
    api.view(1);
    harness.stepFrames(2);
    assert.equal(api.isExteriorInspection(), false);

    // =========================================================================
    // PRUEBA D — Saturno y sus anillos nunca invaden la cabina ni el casco
    // =========================================================================
    api.focus('Saturno');
    let jumpFrames = 0;
    while (api.navigationActive() && jumpFrames++ < 600) {
      harness.stepFrames(1);
      if (jumpFrames === 15) {
        const transitMode = api.getObservationMode();
        assert.equal(
          transitMode.travelCompressionBanner,
          'TRÁNSITO CON COMPRESIÓN TEMPORAL',
          'El tránsito interplanetario se identifica explícitamente con compresión temporal',
        );
      }
    }
    harness.stepFrames(3);
    const saturnPosAfterArrival = new THREE.Vector3(...api.getShipPosition());
    const astroScene = harness.renderers[0].scene;
    const saturnPivot = astroScene.children.find(
      (obj) => obj.userData?.planetName === 'Saturno',
    );
    const saturnRadiusScene = 58232 / 1_000_000;
    const saturnRingsOuterScene = saturnRadiusScene * PLANETARY_PHYSICAL_CATALOG.Saturno.ringOuterRatio;
    const distToSaturnCenter = saturnPosAfterArrival.distanceTo(saturnPivot.position);
    assert.ok(
      distToSaturnCenter > saturnRingsOuterScene * 1.15,
      `Distancia orbital a Saturno (${(distToSaturnCenter * 1e6).toFixed(0)} km) queda fuera del borde exterior de los anillos (${(saturnRingsOuterScene * 1e6).toFixed(0)} km)`,
    );

    // Comprobar tanto en Cabina 1P como en Vista Exterior que los anillos nunca invaden la cámara local
    api.view(1);
    harness.stepFrames(2);
    assert.equal(api.getObservationMode().id, 'close-inspection');
    api.view(3);
    harness.stepFrames(2);
    assert.equal(api.navigationSnapshot().shipVisible, true);
    api.view(1);
    harness.stepFrames(1);

    // =========================================================================
    // PRUEBA F — Preservar posición al cambiar de vista (Mapa -> Cabina)
    // =========================================================================
    const savedSaturnShipPos = api.getShipPosition();
    // 1. Abrir Modo 3 (Mapa de navegación solar)
    api.setObservationMode('solar-navigation');
    harness.stepFrames(10);
    assert.equal(api.getObservationMode().id, 'solar-navigation');
    assert.equal(
      api.getObservationMode().schematicBanner,
      'VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA',
    );
    // 2. Volver a cabina y comprobar que getShipPosition() conserva la posición en Saturno
    api.reenterCabin();
    harness.stepFrames(10);
    assert.deepEqual(
      api.getShipPosition(),
      savedSaturnShipPos,
      'getShipPosition() conserva exactamente la posición previa tras abrir el mapa solar y volver a cabina',
    );

    // 3. Abrir Modo 4 (Mapa astronómico estelar y extragaláctico) y volver a cabina
    api.setObservationMode('astronomical-map', { scaleId: 'stellar' });
    harness.stepFrames(10);
    assert.equal(api.getObservationMode().id, 'astronomical-map');
    api.nearbyMap();
    harness.stepFrames(10);
    api.reenterCabin();
    harness.stepFrames(10);
    assert.deepEqual(
      api.getShipPosition(),
      savedSaturnShipPos,
      'getShipPosition() conserva exactamente la posición previa tras abrir mapas multiescala y volver a cabina',
    );

    // =========================================================================
    // PRUEBA G — No contaminación entre modos (Mapa esquemático -> Modo físico)
    // =========================================================================
    const earthPivot = astroScene.children.find(
      (obj) => obj.userData?.planetName === 'Tierra',
    );
    const earthTilt = earthPivot.children[0];

    // En Modo 3 (Mapa esquemático), la Tierra usa escala comprimida para orientación
    api.setObservationMode('solar-navigation');
    harness.stepFrames(2);
    assert.equal(api.getObservationMode().isPhysicalScale, false);
    const schematicEarthScale = earthTilt.scale.x;
    assert.ok(schematicEarthScale > 0.1, 'En el mapa esquemático el marcador es comprimido');

    // Al volver a Cabina (Modo físico), los planetas recuperan de inmediato sus radios y distancias físicas reales
    api.reenterCabin();
    harness.stepFrames(2);
    assert.equal(api.getObservationMode().isPhysicalScale, true);
    assert.equal(
      earthTilt.scale.x,
      6371 / 1_000_000,
      'Al regresar a cabina, la Tierra recupera su radio físico exacto (6.371 km / 10^6 km) sin contaminación del mapa',
    );
    assert.ok(
      Math.abs(earthPivot.position.length() - PHYSICAL_CONSTANTS.AU_ASTRO_SCENE_UNITS) < 3.0,
      'Al regresar a cabina, la Tierra recupera su distancia heliocéntrica física (~149,6 millones de km)',
    );

    // =========================================================================
    // PRUEBA H — Efectos de velocidad (#warp nunca se activa en vuelo normal)
    // =========================================================================
    api.speed(5000);
    api.key('w', true);
    api.key('shift', true);
    harness.stepFrames(15);
    const warpNormalFlight = api.getWarpEffectState();
    assert.equal(
      warpNormalFlight.warpAmount,
      0,
      'El efecto warp (480 líneas) jamás debe activarse durante el movimiento normal de la nave',
    );
    assert.equal(warpNormalFlight.navActive, false);
    api.key('w', false);
    api.key('shift', false);
  } finally {
    await harness.close();
  }
});
