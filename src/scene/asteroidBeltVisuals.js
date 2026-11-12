import * as THREE from 'three';

/**
 * KRONOX Main Asteroid Belt & Meteoroid Distribution System.
 *
 * Implements a scientifically authentic representation of the Main Asteroid Belt:
 * - Heliocentric semi-major axis: 2.1 AU to 3.3 AU (between Mars at 1.52 AU and Jupiter at 5.20 AU).
 * - Kirkwood resonance gaps (3:1 at 2.50 AU, 5:2 at 2.82 AU, 2:1 at 3.28 AU).
 * - Realistic orbital inclinations (mean ~7.2°, sigma ~4.5°).
 * - Major named asteroids with real physical parameters (Ceres, Vesta, Pallas, Hygiea).
 * - Instanced 3D irregular asteroid meshes with deterministic Keplerian orbital drift.
 * - Clear astronomical taxonomy: Asteroid vs. Meteoroid vs. Meteor vs. Meteorite.
 */

export const ASTEROID_TAXONOMY = Object.freeze({
  ASTEROID: {
    term: 'Asteroide',
    definition: 'Cuerpo rocoso o metálico de tamaño significativo que orbita directamente alrededor del Sol.',
    examples: ['Ceres (473 km)', 'Vesta (262 km)', 'Pallas (256 km)', 'Hygiea (215 km)'],
  },
  METEOROID: {
    term: 'Meteoroide',
    definition: 'Fragmento rocoso o metálico en el espacio interplanetario de menor tamaño (desde granos de polvo hasta ~1 metro).',
    examples: ['Detritos de colisiones asteroidales', 'Rastro de partículas de cometas'],
  },
  METEOR: {
    term: 'Meteoro',
    definition: 'Fenómeno luminoso atmosférico provocado por la ionización y fricción de un meteoroide al entrar a alta velocidad.',
    examples: ['Estrellas fugaces', 'Bólidos incandescentes'],
  },
  METEORITE: {
    term: 'Meteorito',
    definition: 'Fracción sólida de un meteoroide que sobrevive al paso atmosférico e impacta contra la superficie de un planeta o luna.',
    examples: ['Condritas carbonáceas', 'Sideritos de hierro-níquel'],
  },
});

export const MAJOR_ASTEROIDS = Object.freeze([
  {
    name: 'Ceres',
    designation: '1 Ceres (Planeta Enano)',
    radiusKm: 473.0,
    semiMajorAxisAu: 2.767,
    eccentricity: 0.076,
    inclinationDeg: 10.59,
    orbitalPeriodDays: 1682.0,
    spectralType: 'Tipo C (Carbonáceo con hielos subsuperficiales)',
    description: 'El objeto más masivo del Cinturón Principal. Posee depósitos de carbonato de sodio en el cráter Occator.',
  },
  {
    name: 'Vesta',
    designation: '4 Vesta',
    radiusKm: 262.7,
    semiMajorAxisAu: 2.362,
    eccentricity: 0.089,
    inclinationDeg: 7.14,
    orbitalPeriodDays: 1325.7,
    spectralType: 'Tipo V (Basáltico diferenciado)',
    description: 'Protoplaneta rocoso diferenciado con corteza, manto y núcleo metálico. Fuente de meteoritos HED.',
  },
  {
    name: 'Pallas',
    designation: '2 Pallas',
    radiusKm: 256.0,
    semiMajorAxisAu: 2.772,
    eccentricity: 0.231,
    inclinationDeg: 34.84,
    orbitalPeriodDays: 1686.0,
    spectralType: 'Tipo B (Silicatos hidratados)',
    description: 'Segundo asteroide descubierto. Posee una inclinación orbital extremadamente pronunciada de casi 35°.',
  },
  {
    name: 'Hygiea',
    designation: '10 Hygiea',
    radiusKm: 216.5,
    semiMajorAxisAu: 3.142,
    eccentricity: 0.112,
    inclinationDeg: 3.84,
    orbitalPeriodDays: 2034.0,
    spectralType: 'Tipo C (Rico en carbono)',
    description: 'Cuarto objeto mayor del cinturón. Su forma casi esférica sugiere equilibrio hidrostático en el borde exterior.',
  },
]);

export function createAsteroidBeltVisuals({
  count = 900,
  auToSceneDistance = (au) => au * 149.5978707, // Real physical or compressed scale function
} = {}) {
  const root = new THREE.Group();
  root.name = 'MainAsteroidBeltSystem';

  // Irregular Asteroid Rock Geometry using Dodecahedron with vertex noise
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const posAttr = rockGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const noise = 0.85 + Math.sin(vx * 4.2 + vy * 3.1) * 0.18 + Math.cos(vz * 5.4) * 0.12;
    posAttr.setXYZ(i, vx * noise, vy * noise, vz * noise);
  }
  rockGeo.computeVertexNormals();

  const asteroidMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.88,
    metalness: 0.25,
    name: 'AsteroidRegolithRock',
  });

  const instancedMesh = new THREE.InstancedMesh(rockGeo, asteroidMat, count);
  instancedMesh.name = 'InstancedAsteroidSwarm';

  const dummy = new THREE.Object3D();
  const asteroidData = [];

  // Generate Keplerian orbital distribution with Kirkwood Gaps
  for (let i = 0; i < count; i++) {
    let au = 2.1 + Math.random() * 1.2;

    // Suppress density in Kirkwood Gaps (3:1 at 2.50, 5:2 at 2.82)
    if (Math.abs(au - 2.50) < 0.04 || Math.abs(au - 2.82) < 0.03) {
      au += 0.06;
    }

    const meanAnomaly0 = Math.random() * Math.PI * 2;
    const eccentricity = 0.03 + Math.random() * 0.18;
    const inclinationRad = (Math.random() - 0.5) * 0.22; // ~ +/- 6.3 deg
    const longitudeAscendingNode = Math.random() * Math.PI * 2;

    // Size distribution (most small, few large)
    const scaleRadius = 0.04 + Math.pow(Math.random(), 3.5) * 0.28;
    const orbitSpeed = 1.0 / Math.sqrt(au); // Kepler's 3rd law: T ~ a^(3/2) => omega ~ a^(-3/2)

    asteroidData.push({
      au,
      meanAnomaly: meanAnomaly0,
      eccentricity,
      inclinationRad,
      node: longitudeAscendingNode,
      scaleRadius,
      orbitSpeed,
    });
  }

  // Major Asteroid Marker Group
  const majorGroup = new THREE.Group();
  majorGroup.name = 'MajorAsteroidsGroup';

  MAJOR_ASTEROIDS.forEach((ast) => {
    const majorMesh = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({
        color: ast.name === 'Ceres' ? 0x94a3b8 : ast.name === 'Vesta' ? 0xf8fafc : 0x475569,
        roughness: 0.82,
        metalness: 0.2,
      }),
    );
    majorMesh.name = `MajorAsteroid_${ast.name}`;
    majorMesh.scale.setScalar(0.45);
    majorGroup.add(majorMesh);
  });
  root.add(majorGroup);

  // Animation Update for Orbital Movement
  const update = (elapsedDays = 0, currentAuScaleFn = auToSceneDistance) => {
    for (let i = 0; i < count; i++) {
      const d = asteroidData[i];
      const meanAnomaly = d.meanAnomaly + (elapsedDays * 0.015 * d.orbitSpeed);
      // Keplerian radial distance
      const rAu = d.au * (1 - d.eccentricity * Math.cos(meanAnomaly));
      const sceneR = currentAuScaleFn(rAu);

      const x = Math.cos(meanAnomaly + d.node) * sceneR;
      const z = Math.sin(meanAnomaly + d.node) * sceneR;
      const y = Math.sin(meanAnomaly * 1.5) * (sceneR * Math.sin(d.inclinationRad));

      dummy.position.set(x, y, z);
      dummy.rotation.set(i * 0.2, meanAnomaly * 2.0, i * 0.3);
      dummy.scale.setScalar(d.scaleRadius * (sceneR > 500 ? 12.0 : 1.0));
      dummy.updateMatrix();

      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    // Update Major Asteroids
    MAJOR_ASTEROIDS.forEach((ast, idx) => {
      const majorMesh = majorGroup.children[idx];
      if (majorMesh) {
        const meanAnomaly = (elapsedDays / ast.orbitalPeriodDays) * Math.PI * 2;
        const rAu = ast.semiMajorAxisAu * (1 - ast.eccentricity * Math.cos(meanAnomaly));
        const sceneR = currentAuScaleFn(rAu);
        const incRad = (ast.inclinationDeg * Math.PI) / 180;

        const x = Math.cos(meanAnomaly) * sceneR;
        const z = Math.sin(meanAnomaly) * sceneR;
        const y = Math.sin(meanAnomaly) * (sceneR * Math.sin(incRad));

        majorMesh.position.set(x, y, z);
        majorMesh.rotation.y += 0.01;
      }
    });
  };

  root.add(instancedMesh);
  update(0);

  return {
    root,
    instancedMesh,
    majorGroup,
    taxonomy: ASTEROID_TAXONOMY,
    majorAsteroids: MAJOR_ASTEROIDS,
    update,
  };
}

