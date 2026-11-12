import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FISH_AUDIO_VOICE_ID,
  createFishAudioVoiceProvider,
  createSequentialVoiceQueue,
} from '../src/utils/voiceProvider.js';
import fishTtsHandler, {
  verifyFishVoiceAccess,
  synthesizeWithFishAudio,
} from '../src/server/fishAudioTts.js';
import {
  COSMIC_HIERARCHY,
  GALAXY_MORPHOLOGY_METADATA,
  ALL_CATALOG_INVENTORY_SUMMARY,
  ASTRONOMICAL_PROVENANCE_MANIFEST,
  getObjectProvenance,
  icrsToCartesianPc,
  cartesianPcToIcrs,
  icrsToGalacticDeg,
  galacticToIcrsDeg,
  estimateDistancePcWithUncertainty,
  getCanonicalStar,
  getCanonicalGalaxy,
  buildGalaxyMorphologyLayer3D,
} from '../src/scene/astronomicalUniverse.js';
import { computeSkyFromObserverPc } from '../src/scene/observerSkyAndUnification.js';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';

test('1. Prueba H — Fish Audio TTS (8150d8bf74d245cd84a154b785aa7fab), backend synthesis test & sequential queue', async () => {
  assert.equal(FISH_AUDIO_VOICE_ID, '8150d8bf74d245cd84a154b785aa7fab');

  const provider = createFishAudioVoiceProvider({
    endpoint: '/KRONOX/api/fish-tts',
    fallbackEndpoint: '/KRONOX/api/voice',
  });
  const url = provider.audioUrl({
    text: 'Soy Cronos, inteligencia de navegación de Kronox. Bienvenido a bordo.',
    language: 'es-US',
  });
  assert.ok(url.includes('/KRONOX/api/fish-tts?'));
  assert.ok(url.includes('reference_id=8150d8bf74d245cd84a154b785aa7fab'));
  assert.ok(!url.toLowerCase().includes('api_key'));

  const fallbackUrl = provider.fallbackAudioUrl({
    text: 'Soy Cronos, inteligencia de navegación de Kronox. Bienvenido a bordo.',
    language: 'es-US',
  });
  assert.ok(fallbackUrl.startsWith('/KRONOX/api/voice?'));

  // Verificación de acceso en backend sin API key configurada -> informa fallback limpio sin exponer secretos
  const statusNoKey = await verifyFishVoiceAccess(FISH_AUDIO_VOICE_ID, async () => {
    throw new Error('Should not call network when key is absent');
  });
  assert.equal(statusNoKey.referenceId, '8150d8bf74d245cd84a154b785aa7fab');
  if (!process.env.FISH_AUDIO_API_KEY && !process.env.FISH_API_KEY) {
    assert.equal(statusNoKey.configured, false);
    assert.equal(statusNoKey.provider, 'fallback');
  }

  // Síntesis en Fish Audio con reference_id 8150d8bf74d245cd84a154b785aa7fab para la frase de prueba solicitada
  const prevKey = process.env.FISH_AUDIO_API_KEY;
  process.env.FISH_AUDIO_API_KEY = 'test-backend-fish-key-never-exposed';
  try {
    const mockAudioBytes = new Uint8Array(256).fill(0x55).buffer;
    const synthResult = await synthesizeWithFishAudio({
      text: 'Soy Cronos, inteligencia de navegación de Kronox. Bienvenido a bordo.',
      referenceId: FISH_AUDIO_VOICE_ID,
      fetchImpl: async (endpoint, opts) => {
        assert.equal(endpoint, 'https://api.fish.audio/v1/tts');
        const parsed = JSON.parse(opts.body);
        assert.equal(parsed.reference_id, '8150d8bf74d245cd84a154b785aa7fab');
        assert.equal(parsed.text, 'Soy Cronos, inteligencia de navegación de Kronox. Bienvenido a bordo.');
        return {
          ok: true,
          headers: { get: () => 'audio/mpeg' },
          arrayBuffer: async () => mockAudioBytes,
        };
      },
    });
    assert.equal(synthResult.provider, 'fish-audio');
    assert.equal(synthResult.referenceId, '8150d8bf74d245cd84a154b785aa7fab');
    assert.ok(synthResult.buffer.byteLength >= 256);
  } finally {
    if (prevKey === undefined) delete process.env.FISH_AUDIO_API_KEY;
    else process.env.FISH_AUDIO_API_KEY = prevKey;
  }

  // Cola secuencial: evita superposiciones y espera el final real de cada locución sin tiempos fijos
  const spokenOrder = [];
  const queue = createSequentialVoiceQueue({
    playPhrase: async (item) => {
      spokenOrder.push(`start:${item.text}`);
      await new Promise((r) => setTimeout(r, 15));
      spokenOrder.push(`end:${item.text}`);
    },
  });
  queue.enqueue('Frase 1');
  queue.enqueue('Frase 2');
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(spokenOrder, [
    'start:Frase 1',
    'end:Frase 1',
    'start:Frase 2',
    'end:Frase 2',
  ]);
});

test('2. Astrometric coordinate transforms (ICRS <-> Galactic <-> 3D Cartesian pc) and parallax uncertainty rules', () => {
  const barnard = getCanonicalStar('barnard');
  assert.ok(barnard);
  const cart = icrsToCartesianPc(barnard.raDeg, barnard.decDeg, barnard.distancePc);
  const backIcrs = cartesianPcToIcrs(cart.x, cart.y, cart.z);
  assert.ok(Math.abs(backIcrs.raDeg - barnard.raDeg) < 1e-4);
  assert.ok(Math.abs(backIcrs.decDeg - barnard.decDeg) < 1e-4);
  assert.ok(Math.abs(backIcrs.distancePc - barnard.distancePc) < 1e-4);

  const gal = icrsToGalacticDeg(266.405, -28.93617);
  assert.ok(gal.lDeg < 0.2 || gal.lDeg > 359.8);
  assert.ok(Math.abs(gal.bDeg) < 0.2);
  const backEq = galacticToIcrsDeg(gal.lDeg, gal.bDeg);
  assert.ok(Math.abs(backEq.raDeg - 266.405) < 0.05);
  assert.ok(Math.abs(backEq.decDeg - -28.93617) < 0.05);

  const goodParallax = estimateDistancePcWithUncertainty({
    parallaxMas: 546.9759,
    parallaxErrorMas: 0.0401,
  });
  assert.equal(goodParallax.reliableParallax, true);
  assert.equal(goodParallax.method, 'trigonometric-parallax');
  assert.ok(Math.abs(goodParallax.distancePc - 1.8282) < 0.002);

  const noisyParallax = estimateDistancePcWithUncertainty({
    parallaxMas: 2.0,
    parallaxErrorMas: 0.8,
    publishedDistancePc: 460,
  });
  assert.equal(noisyParallax.reliableParallax, false);
  assert.equal(noisyParallax.method, 'bayesian-photogeometric-fallback');
  assert.equal(noisyParallax.distancePc, 460);
});

test('3. Pruebas A, B, C y D — Reconstrucción morfológica de galaxias (Vía Láctea, M31, SagDEG), estrellas (Barnard, Sol, Sirio/Rígel) y manifiesto de procedencia', () => {
  assert.equal(COSMIC_HIERARCHY.length, 7);

  // Prueba D: Diferenciación cromática y astrofísica de estrellas
  const sun = getCanonicalStar('sun');
  assert.equal(sun.spectralType, 'G2V');
  assert.equal(sun.temperatureK, 5772);
  assert.equal(sun.spaceColorHex, '#fff9f2');

  const barnard = getCanonicalStar('barnard');
  assert.equal(barnard.spectralType, 'M4.0Ve');
  assert.equal(barnard.temperatureK, 3220);
  assert.equal(barnard.radiusSolar, 0.187);
  assert.equal(barnard.luminositySolar, 0.00346);
  assert.equal(barnard.spaceColorHex, '#ff7340'); // Cálida rojiza-anaranjada, nunca blanca

  const sirius = getCanonicalStar('sirius');
  const rigel = getCanonicalStar('rigel');
  const spica = getCanonicalStar('spica');
  assert.ok(sirius.temperatureK > 9500);
  assert.ok(rigel.temperatureK > 11500);
  assert.ok(spica.temperatureK > 24000);
  assert.notEqual(barnard.spaceColorHex, sun.spaceColorHex);
  assert.notEqual(barnard.spaceColorHex, sirius.spaceColorHex);

  // Pruebas A, B, C: Verificar las 11 galaxias y su manifiesto de procedencia científica
  const expectedGalaxies = [
    'milky-way',
    'm31',
    'm33',
    'm101',
    'm81',
    'm82',
    'ngc-253',
    'lmc',
    'smc',
    'ngc-6822',
    'sagittarius-dwarf',
  ];
  assert.deepEqual(
    ALL_CATALOG_INVENTORY_SUMMARY.individualGalaxies.sort(),
    expectedGalaxies.slice().sort(),
  );

  for (const key of expectedGalaxies) {
    const gal = getCanonicalGalaxy(key);
    assert.ok(gal, `Missing canonical galaxy ${key}`);
    assert.ok(GALAXY_MORPHOLOGY_METADATA[key], `Missing morphology metadata for ${key}`);
    const prov = getObjectProvenance(key);
    assert.ok(prov, `Missing provenance record for ${key}`);
    assert.ok(Array.isArray(prov.referenceUrls) && prov.referenceUrls.length > 0);
    const layer3D = buildGalaxyMorphologyLayer3D(key, 12);
    assert.ok(layer3D, `Failed to build 3D layer for ${key}`);
  }

  // Prueba A: Vía Láctea espiral barrada (Hurt/Spitzer sig05-010a)
  const mwProv = getObjectProvenance('milky-way');
  assert.ok(mwProv.referenceUrls.some((u) => u.includes('sig05-010a-milky-way-bar')));
  const mwLayer = buildGalaxyMorphologyLayer3D('milky-way', 14);
  assert.ok(mwLayer.getObjectByName('galactic-central-bar'));
  assert.ok(mwLayer.getObjectByName('milky-way-orion-spur-anchor'));

  // Prueba B: Andrómeda M31 (heic2501a / PHAT) con satélites M32 y M110
  const m31Prov = getObjectProvenance('m31');
  assert.ok(m31Prov.referenceUrls.some((u) => u.includes('heic2501a')));
  const m31Layer = buildGalaxyMorphologyLayer3D('m31', 14);
  assert.ok(m31Layer.getObjectByName('m31-companion-m32'));
  assert.ok(m31Layer.getObjectByName('m31-companion-m110'));

  // Prueba C: Enana de Sagitario (dSph/E7 en disrupción de marea, sin esfera sólida ni brazos espirales)
  const sagMeta = GALAXY_MORPHOLOGY_METADATA['sagittarius-dwarf'];
  assert.equal(sagMeta.family, 'dwarf-spheroidal');
  assert.equal(sagMeta.armCount, 0);
  const sagLayer = buildGalaxyMorphologyLayer3D('sagittarius-dwarf', 10);
  assert.equal(sagLayer.getObjectByName('galactic-central-bar'), undefined);
});

test('4. Prueba E — Firmamento desde la nave: paralelaje 3D, gradiente por latitud galáctica y Modo Científico vs Cinematográfico', () => {
  const earthSky = computeSkyFromObserverPc({ x: 0, y: 0, z: 0 }, { visualProfile: 'cinematic' });
  assert.equal(earthSky.environmentMode, 'milky-way-interior');
  assert.equal(earthSky.visualProfile, 'cinematic');
  assert.ok(!earthSky.stars.some((s) => s.key === 'sun'));
  assert.ok(earthSky.densityStats.nearGalacticPlaneCount > 0);

  const barnard = getCanonicalStar('barnard');
  const barnardSky = computeSkyFromObserverPc(barnard.positionPc, { visualProfile: 'scientific' });
  assert.equal(barnardSky.visualProfile, 'scientific');
  const sunFromBarnard = barnardSky.stars.find((s) => s.key === 'sun');
  assert.ok(sunFromBarnard);
  assert.ok(Math.abs(sunFromBarnard.distanceFromObserverPc - barnard.distancePc) < 0.01);
});

test('5. Pruebas A–G en escena 3D real: sin esferas amarillas opacas, sin nave gigante en el Sistema Solar y transición limpia entre escalas', async () => {
  const harness = await createSceneHarness();
  try {
    const api = await harness.start();
    harness.stepFrames(3);
    const scene = harness.renderers[0].scene;

    // 1. Verificar que ninguna galaxia en `nearbyGalaxyMarkers` o `missionMarkers` conserva una esfera amarilla opaca visible (#e8d2a5)
    let visibleLegacyYellowCoreCount = 0;
    scene.traverse((obj) => {
      if (
        obj.isMesh &&
        obj.visible &&
        obj.geometry?.type === 'SphereGeometry' &&
        obj.material?.color?.getHexString?.() === 'e8d2a5'
      ) {
        visibleLegacyYellowCoreCount++;
      }
    });
    assert.equal(
      visibleLegacyYellowCoreCount,
      0,
      'Ninguna galaxia debe mostrar la esfera amarilla opaca heredada (#e8d2a5)',
    );

    // 2. Prueba F: Tras estar en la cabina 1P (`skipRealTimeIntro`), al cambiar al Sistema Solar o a cualquier escala de mapa,
    // `localCabinWorld` (24 m) y `ship` deben ocultarse por completo (nunca quedar flotando junto a los planetas).
    api.skipRealTimeIntro();
    harness.stepFrames(2);
    assert.equal(api.navigationSnapshot().cabinVisible, true);

    assert.equal(api.setNavigationScale('solar'), true);
    harness.stepFrames(5);
    assert.equal(
      api.navigationSnapshot().cabinVisible,
      false,
      'La cabina habitable de 24 unidades NO debe permanecer visible en la vista del Sistema Solar',
    );
    assert.equal(
      api.navigationSnapshot().shipVisible,
      false,
      'La nave NO debe permanecer visible como objeto gigante en la vista del Sistema Solar',
    );

    // También al usar lvl(1), lvl(2), lvl(3) o nearbyMap()
    api.reenterCabin();
    harness.stepFrames(20);
    assert.equal(api.navigationSnapshot().cabinVisible, true);
    api.lvl(1);
    harness.stepFrames(3);
    assert.equal(api.navigationSnapshot().cabinVisible, false);
    assert.equal(api.navigationSnapshot().shipVisible, false);

    // 3. Prueba E: Alternar entre Modo Científico y Modo Cinematográfico en la escena
    assert.equal(api.getVisualProfile(), 'cinematic');
    api.setVisualProfile('scientific');
    assert.equal(api.getVisualProfile(), 'scientific');
    api.setVisualProfile('cinematic');
    assert.equal(api.getVisualProfile(), 'cinematic');

    // 4. Continuidad entre escalas y manifiesto accesible desde el API
    assert.ok(api.getProvenanceManifest());
    assert.ok(api.getObjectProvenance('milky-way'));
    assert.ok(api.getObjectProvenance('barnard'));

    api.setNavigationScale('stellar');
    harness.stepFrames(60);
    const farState = api.getScaleUnificationState();
    assert.equal(farState.showDetailedSolarSystem, false);

    api.setCameraPose([0, 40, 120], [0, 0, 0], 55);
    harness.stepFrames(3);
    const zoomedInState = api.getScaleUnificationState();
    assert.equal(zoomedInState.showDetailedSolarSystem, true);
  } finally {
    await harness.close();
  }
});
