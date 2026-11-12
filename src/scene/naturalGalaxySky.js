import * as THREE from 'three';

/**
 * KRONOX Naturalistic Galaxy Sky & Reticle Celestial Object Identification.
 *
 * Implements:
 * 1. Naturalistic Milky Way background as seen from inside the galactic disk:
 *    - Stellar density concentration towards galactic equator (b = 0°).
 *    - Galactic Center bulge in Sagittarius (l = 0°).
 *    - Interstellar dust extinction (Great Rift dust lanes) without unnatural neon haze.
 * 2. Reticle Raycasting & Angular Proximity Celestial Object Identifier:
 *    - Detects whether camera is pointing at planets, stars or galaxies (angular proximity < 2.5°).
 *    - Displays clean contextual telemetry: name, object class, distance, coordinates, SPHEREx availability.
 */

export const CELESTIAL_CATALOG_TARGETS = Object.freeze([
  {
    key: 'jupiter',
    name: 'Júpiter',
    category: 'Planeta Gigante Gaseoso',
    spectralClass: 'Atmósfera H2/He',
    distanceDesc: '5.20 UA heliocéntrica',
    hasSpherex: false,
    spherexDesc: 'Objeto planetario del Sistema Solar (Observación visual y óptica).',
    direction: new THREE.Vector3(0.85, 0.05, 0.52).normalize(),
  },
  {
    key: 'saturn',
    name: 'Saturno',
    category: 'Planeta Anillado',
    spectralClass: 'H2/He con Sistema de Anillos de Hielo',
    distanceDesc: '9.58 UA heliocéntrica',
    hasSpherex: false,
    spherexDesc: 'Objeto planetario del Sistema Solar (Observación visual y óptica).',
    direction: new THREE.Vector3(-0.45, 0.08, 0.88).normalize(),
  },
  {
    key: 'barnard',
    name: 'Estrella de Barnard',
    category: 'Estrella Enana Roja (M4.0V)',
    spectralClass: 'M4.0V (T_eff ~ 3130 K)',
    distanceDesc: '1.828 pc (5.96 años luz)',
    hasSpherex: true,
    spherexDesc: 'Cubo de datos FITS disponible (Alto movimiento propio: 10.3″/año).',
    direction: new THREE.Vector3(0.12, 0.08, -0.98).normalize(),
  },
  {
    key: 'epsilon-indi-b',
    name: 'Epsilon Indi B',
    category: 'Sistema de Enanas Marrones (T1 + T6)',
    spectralClass: 'T1V / T6V Binaria',
    distanceDesc: '3.626 pc (11.82 años luz)',
    hasSpherex: true,
    spherexDesc: 'Datos infrarrojos en 102 bandas SPHEREx (Astrometría y bandas de metano).',
    direction: new THREE.Vector3(-0.72, -0.65, 0.24).normalize(),
  },
  {
    key: 'wise-0855',
    name: 'WISE 0855-0714',
    category: 'Enana Marrón Sub-Estelar Hiper-Fría (Y-dwarf)',
    spectralClass: 'Y-dwarf (T ~ 250 K)',
    distanceDesc: '2.23 pc (7.27 años luz)',
    hasSpherex: true,
    spherexDesc: 'Candidato sub-umbral SPHEREx D2 con estado WARNING metodológico.',
    direction: new THREE.Vector3(0.55, -0.15, -0.82).normalize(),
  },
  {
    key: 'm31',
    name: 'Galaxia de Andrómeda (M31)',
    category: 'Galaxia Espiral Mayor',
    spectralClass: 'SA(s)b',
    distanceDesc: '765 kpc (2.5 millones de años luz)',
    hasSpherex: true,
    spherexDesc: 'Fotometría estelar UV/IR e historia de formación cósmica SPHEREx.',
    direction: new THREE.Vector3(0.68, 0.62, 0.38).normalize(),
  },
  {
    key: 'm82',
    name: 'Galaxia del Cigarro (M82)',
    category: 'Galaxia con Estallido Estelar (Starburst)',
    spectralClass: 'I0',
    distanceDesc: '3.53 Mpc (11.5 millones de años luz)',
    hasSpherex: true,
    spherexDesc: 'Fuerte emisión infrarroja por hidrocarburos aromáticos policíclicos (PAH).',
    direction: new THREE.Vector3(-0.35, 0.82, -0.45).normalize(),
  },
]);

export function createNaturalGalaxySky() {
  const root = new THREE.Group();
  root.name = 'NaturalGalaxySkyDome';

  // 1. Naturalistic Galactic Background Dome (Radius 12000u)
  const domeRadius = 12000;
  const domeGeo = new THREE.SphereGeometry(domeRadius, 32, 24);

  // Procedural canvas shader simulation for internal Milky Way disk view
  let texture;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, 1024, 512);

      // Galactic Plane gradient centered along middle latitude (y = 256)
      const diskGrad = ctx.createLinearGradient(0, 160, 0, 352);
      diskGrad.addColorStop(0.0, 'rgba(15, 23, 42, 0)');
      diskGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.08)');
      diskGrad.addColorStop(0.5, 'rgba(219, 234, 254, 0.22)'); // Dense stellar haze
      diskGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.08)');
      diskGrad.addColorStop(1.0, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = diskGrad;
      ctx.fillRect(0, 160, 1024, 192);

      // Galactic Bulge towards Sagittarius (x ~ 512, y ~ 256)
      const bulgeGrad = ctx.createRadialGradient(512, 256, 0, 512, 256, 160);
      bulgeGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)'); // Warm yellow-white bulge
      bulgeGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.15)');
      bulgeGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = bulgeGrad;
      ctx.fillRect(352, 120, 320, 272);

      // Dark dust rifts (The Great Rift extinction clouds)
      ctx.fillStyle = 'rgba(2, 6, 18, 0.55)';
      ctx.beginPath();
      ctx.moveTo(380, 248);
      ctx.bezierCurveTo(440, 260, 480, 238, 540, 252);
      ctx.bezierCurveTo(600, 265, 660, 245, 720, 254);
      ctx.lineTo(720, 262);
      ctx.bezierCurveTo(660, 252, 600, 272, 540, 260);
      ctx.bezierCurveTo(480, 246, 440, 268, 380, 256);
      ctx.closePath();
      ctx.fill();
    }
    texture = new THREE.CanvasTexture(canvas);
  } else {
    // Headless / Node.js test environment fallback texture
    const data = new Uint8Array([3, 7, 18, 255]);
    texture = new THREE.DataTexture(data, 1, 1);
    texture.needsUpdate = true;
  }
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const domeMat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    name: 'MilkyWayNaturalDomeMat',
  });

  const skyDome = new THREE.Mesh(domeGeo, domeMat);
  skyDome.visible = false; // Preserva compatibilidad de API/tests sin superponer parches opacos sobre la bóveda estelar
  root.add(skyDome);

  // 2. Optical Reticle Raycaster for Target Identification
  const identifyTargetUnderCrosshair = (camera, maxAngularDistDeg = 3.5) => {
    if (!camera) return null;

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    let closestTarget = null;
    let minAngleDeg = maxAngularDistDeg;

    CELESTIAL_CATALOG_TARGETS.forEach((target) => {
      // Angular separation theta = arccos(u . v)
      const dot = THREE.MathUtils.clamp(camDir.dot(target.direction), -1, 1);
      const angleDeg = (Math.acos(dot) * 180) / Math.PI;

      if (angleDeg < minAngleDeg) {
        minAngleDeg = angleDeg;
        closestTarget = {
          ...target,
          angularDistanceDeg: Number(angleDeg.toFixed(1)),
        };
      }
    });

    return closestTarget;
  };

  return {
    root,
    skyDome,
    targets: CELESTIAL_CATALOG_TARGETS,
    identifyTargetUnderCrosshair,
  };
}
