import * as THREE from 'three';

/**
 * AURORA-120 / KRONOX 120-Meter Modular Exploration Cruiser Exterior 3D Architecture.
 *
 * Coordinate Convention in KRONOX (`1 unit = 1.00 meter` in Local Metric World):
 * - Reference Length: Strictly 120.0 meters (`Z: -60.0m` Bow/Proa to `+60.0m` Stern/Popa).
 * - Habitable Sphere Radius: `20.0m` (Diameter `40.0m`), housing 4 stacked interior decks.
 * - Outer Structural Rings: `R = 28.0m` (Diameter `~58.2m` including ring gauge).
 * - Internal Aurora geometry is authored along `+X` (bow) / `-X` (stern) and rotated `+Math.PI / 2`
 *   around `Y` so local bow points strictly along `-Z` and stern plumes trail along `+Z`.
 */

export const SHIP_METRIC_DIMENSIONS = Object.freeze({
  LENGTH_METERS: 120.0,
  HULL_BEAM_METERS: 40.0,
  RADIATOR_BEAM_METERS: 58.24,
  HULL_HEIGHT_METERS: 58.24,
  PRESSURIZED_VOLUME_M3: 33510.0,
  SPHERE_RADIUS_METERS: 20.0,
  DECK_COUNT: 4,
  MAX_CREW_CAPACITY: 16,
  PROPULSION_TYPE: 'Main Plasma Engine + 4 Pylon Thrusters + Alcubierre Warp Bubble',
  STRUCTURAL_ALLOY: 'Aerospace Steel Paneling & Gold MLI Thermal Rings',
});

function createProceduralTexture(width, height, drawFn, fallbackRgba = [123, 132, 142, 255]) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const tex = new THREE.DataTexture(new Uint8Array(fallbackRgba), 1, 1, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext?.('2d');
  if (ctx) drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function buildModularShip120M() {
  const root = new THREE.Group();
  root.name = 'KronoxModularResearchCruiser120M';

  // Orientation wrapper: Aurora-120 X-axis (+60 bow, -60 stern) -> KRONOX Z-axis (-60 bow, +60 stern)
  const shipFrame = new THREE.Group();
  shipFrame.name = 'Aurora120ExteriorFrame';
  shipFrame.rotation.y = Math.PI / 2;
  root.add(shipFrame);

  // Deterministic PRNG matching Aurora-120 procedural hull panel & window layout
  const rnd = ((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(11);

  const sectionClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);

  const panels = createProceduralTexture(512, 512, (g) => {
    g.fillStyle = '#7b848e';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14; i++) {
      for (let j = 0; j < 14; j++) {
        const v = (125 + rnd() * 75) | 0;
        g.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
        g.fillRect(i * 36 + 1, j * 36 + 1, 34, 34);
        if (rnd() < 0.14) {
          g.fillStyle = '#2a2f36';
          g.fillRect(i * 36 + 8, j * 36 + 9, 18, 6);
        }
      }
    }
  });
  panels.repeat.set(3, 3);

  const makeStdMat = (opts) => {
    const m = new THREE.MeshStandardMaterial(opts);
    m.clippingPlanes = [sectionClipPlane];
    return m;
  };
  const makeBasicMat = (color, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...extra });
    m.clippingPlanes = [sectionClipPlane];
    return m;
  };

  const hullMat = makeStdMat({
    color: 0xdde3e9,
    map: panels,
    bumpMap: panels,
    bumpScale: 1.4,
    metalness: 0.55,
    roughness: 0.5,
  });
  const hullDoubleMat = makeStdMat({
    color: 0xdde3e9,
    map: panels,
    bumpMap: panels,
    bumpScale: 1.4,
    metalness: 0.5,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const darkMat = makeStdMat({ color: 0x39404a, metalness: 0.7, roughness: 0.4 });
  const goldMat = makeStdMat({ color: 0xc9a24b, metalness: 0.9, roughness: 0.32 });
  const finMat = makeStdMat({ color: 0xcfd6dc, metalness: 0.3, roughness: 0.6 });
  const cyanMat = makeBasicMat(0x9be7ff);
  const warmMat = makeBasicMat(0xffe6b0);

  const addMesh = (parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    parent.add(mesh);
    return mesh;
  };
  const boxGeo = (a, b, c) => new THREE.BoxGeometry(a, b, c);
  const cylGeo = (a, b, l, s = 32) => new THREE.CylinderGeometry(a, b, l, s);
  const cylX = (parent, r1, r2, l, x, mat, s = 40) => {
    const o = addMesh(parent, cylGeo(r1, r2, l, s), mat, x);
    o.rotation.z = Math.PI / 2;
    return o;
  };
  const torusX = (parent, R, t, x, mat) => {
    const o = addMesh(parent, new THREE.TorusGeometry(R, t, 12, 96), mat, x);
    o.rotation.y = Math.PI / 2;
    return o;
  };
  const torusY = (parent, R, t, y, mat) => {
    const o = addMesh(parent, new THREE.TorusGeometry(R, t, 10, 96), mat, 0, y, 0, false);
    o.rotation.x = Math.PI / 2;
    return o;
  };
  const addGreebles = (parent, x0, x1, radius, count) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * 2 * Math.PI;
      const x = x0 + rnd() * (x1 - x0);
      const w = 0.8 + rnd() * 3;
      const l = 0.8 + rnd() * 2.4;
      const h = 0.3 + rnd() * 1.2;
      const m = addMesh(
        parent,
        boxGeo(l, h, w),
        rnd() < 0.22 ? goldMat : darkMat,
        x,
        Math.cos(a) * (radius + h / 2 - 0.1),
        Math.sin(a) * (radius + h / 2 - 0.1),
      );
      m.rotation.x = a;
    }
  };

  // Semantic sub-groups expected by callers & telemetry
  const engineCluster = new THREE.Group();
  engineCluster.name = 'EngineCluster';
  const structuralSpine = new THREE.Group();
  structuralSpine.name = 'StructuralSpine';
  const commandModule = new THREE.Group();
  commandModule.name = 'CommandModule';
  const antennaGroup = new THREE.Group();
  antennaGroup.name = 'CommunicationsDish';
  const radiatorArrays = new THREE.Group();
  radiatorArrays.name = 'StructuralRingsAndOrbits';
  const habitatModule = new THREE.Group();
  habitatModule.name = 'HabitatSphereModule';
  const scienceModules = new THREE.Group();
  scienceModules.name = 'ScienceSphereSector';
  const engineeringModule = new THREE.Group();
  engineeringModule.name = 'EngineeringReactorSector';

  shipFrame.add(
    engineCluster,
    structuralSpine,
    commandModule,
    antennaGroup,
    radiatorArrays,
    habitatModule,
    scienceModules,
    engineeringModule,
  );

  // =========================================================================
  // 1. POPA · MOTOR PRINCIPAL Y 4 MOTORES AUXILIARES EN PILONES (X: -60..-35)
  // =========================================================================
  cylX(engineCluster, 9, 9, 18, -43, hullMat);
  [-36, -50].forEach((x) => cylX(engineCluster, 9.4, 9.4, 2.2, x, goldMat));
  cylX(engineCluster, 8, 4.6, 8, -56, darkMat);
  addGreebles(engineCluster, -51, -35, 9, 60);
  [-52.8, -55, -57.2, -59.2].forEach((x) =>
    torusX(engineCluster, 4.6 + (-52 - x) * 0.425 + 0.35, 0.3, x, goldMat),
  );
  torusX(engineCluster, 9.6, 0.2, -51, cyanMat);
  torusX(engineCluster, 9.6, 0.2, -35, cyanMat);

  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    g.rotation.x = (i * Math.PI) / 4;
    engineCluster.add(g);
    addMesh(g, boxGeo(14, 0.2, 0.5), cyanMat, -43, 9.1, 0, false);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const y = 8.3 * Math.cos(a);
    const z = 8.3 * Math.sin(a);
    cylX(engineCluster, 1.6, 1, 4, -54, darkMat, 16).position.set(-54, y, z);
    const gg = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 20),
      new THREE.MeshBasicMaterial({ color: 0xbfe3ff, side: THREE.DoubleSide }),
    );
    gg.rotation.y = -Math.PI / 2;
    gg.position.set(-56.05, y, z);
    engineCluster.add(gg);
  }
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    f.rotation.x = (i * Math.PI) / 2 + Math.PI / 4;
    engineCluster.add(f);
    addMesh(f, boxGeo(14, 10, 0.2), finMat, -43, 14, 0);
  }

  const mainGlow = new THREE.Mesh(
    new THREE.CircleGeometry(7.4, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0, side: THREE.DoubleSide }),
  );
  mainGlow.rotation.y = -Math.PI / 2;
  mainGlow.position.x = -59.9;
  engineCluster.add(mainGlow);

  const makePlumeMat = () =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      uniforms: { t: { value: 0 }, w: { value: 0 } },
      vertexShader:
        'varying vec2 vu;void main(){vu=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform float t,w;varying vec2 vu;void main(){float a=pow(1.-vu.y,1.8);float f=.78+.22*sin(vu.y*28.-t*20.)*sin(t*6.);vec3 c=mix(vec3(1.,.58,.22),vec3(.45,.78,1.),w);c=mix(c,vec3(1.,.95,.88),a*.35);gl_FragColor=vec4(c*f*a*(.54+w*.95),a*.82);}',
    });

  const plumes = [
    [6.5, 32],
    [3.2, 22],
  ].map(([r, h]) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 32, 1, true), makePlumeMat());
    m.rotation.z = Math.PI / 2;
    m.userData.h = h;
    m.userData.isPlume = true;
    engineCluster.add(m);
    return m;
  });

  // 4 motores auxiliares radiales sobre pilones
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    g.rotation.x = (i * Math.PI) / 2;
    engineCluster.add(g);
    addMesh(g, boxGeo(9, 7, 0.9), hullMat, -45, 12.5, 0);
    cylX(g, 2.5, 2.5, 14, -46, hullMat, 24).position.y = 16;
    cylX(g, 3.5, 2, 5, -53.5, darkMat, 24).position.y = 16;
    [
      [-52.5, 2.7],
      [-54, 3.15],
      [-55.5, 3.6],
    ].forEach(([x, R]) => {
      torusX(g, R, 0.2, x, goldMat).position.y = 16;
    });
    torusX(g, 2.6, 0.1, -41, cyanMat).position.y = 16;
    torusX(g, 2.6, 0.1, -49, cyanMat).position.y = 16;

    const gl = new THREE.Mesh(
      new THREE.CircleGeometry(3.3, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0, side: THREE.DoubleSide }),
    );
    gl.rotation.y = -Math.PI / 2;
    gl.position.set(-56.05, 16, 0);
    g.add(gl);

    const m = new THREE.Mesh(new THREE.ConeGeometry(3.2, 18, 24, 1, true), makePlumeMat());
    m.rotation.z = Math.PI / 2;
    m.userData.h = 18;
    m.userData.isPlume = true;
    m.position.y = 16;
    g.add(m);
    plumes.push(m);
  }

  const engineLight = new THREE.PointLight(0xffa860, 2.8, 70);
  engineLight.position.set(-64, 0, 0);
  engineCluster.add(engineLight);

  // =========================================================================
  // 2. TRONCOS ESTRUCTURALES, PROA (MÓDULO DE CARGA/ACOPLE) Y BRAZOS DE SUJECIÓN
  // =========================================================================
  cylX(structuralSpine, 3.6, 3.6, 17, -27.5, hullMat);
  cylX(structuralSpine, 3.6, 3.6, 22, 30, hullMat);
  [-34, -30, -26, -22].forEach((x) => torusX(structuralSpine, 3.75, 0.4, x, goldMat));
  [22, 26, 30, 34, 38].forEach((x) => torusX(structuralSpine, 3.75, 0.4, x, goldMat));
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    g.rotation.x = (i * Math.PI) / 3 + Math.PI / 6;
    structuralSpine.add(g);
    cylX(g, 0.3, 0.3, 17, -27.5, darkMat, 8).position.y = 4;
    cylX(g, 0.3, 0.3, 22, 30, darkMat, 8).position.y = 4;
  }

  // Proa: módulo cilíndrico de carga / acople (`+41..+60` en Aurora -> `-41..-60` en KRONOX)
  cylX(commandModule, 6.5, 6.5, 19, 50.5, hullMat);
  [44, 48, 52, 56].forEach((x) => torusX(commandModule, 6.6, 0.28, x, goldMat));
  addGreebles(commandModule, 42, 59, 6.5, 70);
  torusX(commandModule, 3.2, 0.45, 59.5, goldMat);
  torusX(commandModule, 2.4, 0.12, 59.85, cyanMat);

  // Antenas de comunicaciones y plato parabólico
  [
    [52, 0],
    [47, 0.9],
  ].forEach(([x, a]) => {
    const m = addMesh(antennaGroup, cylGeo(0.12, 0.12, 13, 8), darkMat, x, 6.5 + 5, 0);
    m.rotation.x = a * 0.4;
  });
  addMesh(
    antennaGroup,
    new THREE.SphereGeometry(2.6, 24, 12, 0, 2 * Math.PI, 0, 0.9),
    finMat,
    -28,
    5.4,
    0,
  );
  addMesh(antennaGroup, cylGeo(0.15, 0.15, 2.4, 8), darkMat, -28, 4.2, 0);

  // Brazos estructurales diagonales desde ringA hacia proa
  const addStrutBeam = (a, b, radius, mat) => {
    const d = b.clone().sub(a);
    const len = d.length();
    const o = addMesh(structuralSpine, cylGeo(radius, radius, len, 12), mat);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };
  for (const s of [1, -1]) {
    const P0 = new THREE.Vector3(4, 0, s * 28);
    const P1 = new THREE.Vector3(44, 0, s * 3.5);
    const Y = new THREE.Vector3(0, 2.6, 0);
    const D = P1.clone().sub(P0).normalize();
    const Lt = D.clone().cross(Y).normalize().multiplyScalar(2.3);
    const ts = [0.06, 0.23, 0.4, 0.57, 0.74, 0.91];
    const at = (t, k) => P0.clone().lerp(P1, t).addScaledVector(Y, k);

    [1, -1].forEach((k) => addStrutBeam(at(0, k), at(1, k), 1.6, hullMat));
    addStrutBeam(P0, P1, 0.7, goldMat);
    [1, -1].forEach((k) =>
      addStrutBeam(P0.clone().addScaledVector(Lt, k), P1.clone().addScaledVector(Lt, k), 0.35, goldMat),
    );
    ts.forEach((t, i) => {
      [1, -1].forEach((k) =>
        addStrutBeam(
          at(t, k).addScaledVector(D, -0.45),
          at(t, k).addScaledVector(D, 0.45),
          2.1,
          goldMat,
        ),
      );
      addStrutBeam(at(t, 1), at(t, -1), 0.55, darkMat);
      const q = at(t, 1);
      addMesh(structuralSpine, new THREE.SphereGeometry(0.22, 8, 6), cyanMat, q.x, q.y + 1.9, q.z, false);
      if (i < 5) {
        const u = ts[i + 1];
        addStrutBeam(at(t, 1), at(u, -1), 0.4, darkMat);
        addStrutBeam(at(t, -1), at(u, 1), 0.4, darkMat);
      }
    });
  }

  // =========================================================================
  // 3. ANILLOS ESTRUCTURALES GIRATORIOS, ÓRBITAS TIPO ÁTOMO Y ESFERA HABITABLE
  // =========================================================================
  const ringA = new THREE.Group();
  const ringB = new THREE.Group();
  radiatorArrays.add(ringA, ringB);

  [-4, 4].forEach((x) => {
    torusX(ringA, 28, 1.1, x, hullMat);
    torusX(ringA, 29.12, 0.1, x, cyanMat);
  });
  [-10.5, -14.5].forEach((x) => {
    torusX(ringB, 24.3, 0.7, x, goldMat);
    torusX(ringB, 25.05, 0.1, x, cyanMat);
  });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    g.rotation.x = (i / 6) * 2 * Math.PI;
    ringB.add(g);
    addMesh(g, boxGeo(4.4, 0.8, 0.8), darkMat, -12.5, 24.3, 0);
  }
  for (const s of [1, -1]) {
    addMesh(radiatorArrays, boxGeo(4.6, 7.8, 4.6), darkMat, 4, 0, s * 28);
    addMesh(radiatorArrays, boxGeo(5, 0.6, 5), goldMat, 4, 3.6, s * 28);
    addMesh(radiatorArrays, boxGeo(5, 0.6, 5), goldMat, 4, -3.6, s * 28);
  }
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    g.rotation.x = (i / 12) * 2 * Math.PI;
    ringA.add(g);
    addMesh(g, boxGeo(8, 1.2, 1.2), darkMat, 0, 28, 0);
    addMesh(g, boxGeo(1.4, 8.6, 1.4), hullMat, 0, 24, 0);
  }

  // Órbitas tipo átomo inclinadas 60° con sondas ("electrones") en revolución
  const atomG = new THREE.Group();
  atomG.name = 'AtomOrbitalRings';
  radiatorArrays.add(atomG);
  const atomOrbs = [];
  [
    [21.8, hullMat, 1.3],
    [22.6, darkMat, -1],
    [23.4, goldMat, 1.7],
  ].forEach(([r, mt, sp], i) => {
    const g = new THREE.Group();
    g.rotation.y = (i * Math.PI) / 3;
    atomG.add(g);
    addMesh(g, new THREE.TorusGeometry(r, 0.45, 12, 128), mt, 0, 0, 0);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI;
      const m = addMesh(
        g,
        boxGeo(1.5, 1.6, 1.6),
        k % 3 ? darkMat : goldMat,
        r * Math.cos(a),
        r * Math.sin(a),
        0,
      );
      m.rotation.z = a;
    }
    const orb = new THREE.Group();
    g.add(orb);
    atomOrbs.push([orb, sp]);

    [r, -r].forEach((x) => {
      const e = new THREE.Group();
      e.position.x = x;
      orb.add(e);
      addMesh(e, new THREE.SphereGeometry(1.4, 24, 16), hullMat, 0, 0, 0);
      addMesh(e, new THREE.TorusGeometry(1.45, 0.18, 8, 24), goldMat, 0, 0, 0);
      addMesh(e, boxGeo(0.5, 0.5, 3.6), darkMat, 0, 0, 0);
    });
  });
  [1, -1].forEach((s) =>
    addMesh(atomG, cylGeo(1.1, 1.1, 3.6, 16), goldMat, 0, s * 22.6, 0),
  );

  // Esfera habitable central (`R = 20.0 m`) con ventanas iluminadas y jaula exterior
  const SPHERE_R = 20;
  const hubG = new THREE.Group();
  const cageG = new THREE.Group();
  habitatModule.add(hubG, cageG);

  addMesh(hubG, new THREE.SphereGeometry(SPHERE_R, 64, 48), hullDoubleMat, 0, 0, 0, false);
  for (let i = 0; i < 8; i++) {
    const o = addMesh(cageG, new THREE.TorusGeometry(SPHERE_R + 0.25, 0.3, 8, 96), darkMat, 0, 0, 0, false);
    o.rotation.y = (i * Math.PI) / 8;
  }
  [-15, -10, 10, 15].forEach((y) =>
    torusY(cageG, Math.sqrt(SPHERE_R * SPHERE_R - y * y) + 0.1, 0.3, y, darkMat),
  );

  {
    const inst = new THREE.InstancedMesh(boxGeo(1.6, 0.9, 0.2), warmMat, 200);
    const dummy = new THREE.Object3D();
    let count = 0;
    for (let n = 1; n <= 4; n++) {
      const y = 6.8 - n * 3.4 + 1.7;
      const r = Math.sqrt(SPHERE_R * SPHERE_R - y * y) + 0.05;
      for (let i = 0; i < 40; i++) {
        if (rnd() < 0.15) continue;
        const a = (i / 40) * 2 * Math.PI;
        dummy.position.set(r * Math.cos(a), y, r * Math.sin(a));
        dummy.lookAt(dummy.position.x * 2, y * 2, dummy.position.z * 2);
        dummy.updateMatrix();
        inst.setMatrixAt(count++, dummy.matrix);
      }
    }
    inst.count = count;
    inst.instanceMatrix.needsUpdate = true;
    hubG.add(inst);
  }

  // Ventana frontal de proa saliente (tolva facetada del puente sobre el ecuador de la esfera)
  {
    const w = addMesh(scienceModules, cylGeo(2, 4.2, 2.8, 4), hullMat, 20.7, 5, 0);
    w.rotation.z = -Math.PI / 2;
    w.rotation.x = Math.PI / 4;
    addMesh(scienceModules, boxGeo(0.15, 1.2, 2.4), cyanMat, 22.15, 5, 0, false);
    addMesh(scienceModules, boxGeo(0.3, 0.25, 3.2), goldMat, 21.9, 6.5, 0);
    addMesh(scienceModules, boxGeo(0.3, 0.25, 3.2), goldMat, 21.9, 3.5, 0);
  }

  // Marcador estructural de cámara de reactor exterior / bahía ventral
  {
    const ventRing = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.32, 10, 48), goldMat);
    ventRing.rotation.x = Math.PI / 2;
    ventRing.position.set(0, -SPHERE_R + 0.4, 0);
    engineeringModule.add(ventRing);
  }

  // Burbuja Alcubierre de curvatura (visible cuando warpAmount > 0.01 durante saltos)
  const warpColorBlue = new THREE.Color(0x8fcaff);
  const warpColorAmber = new THREE.Color(0xffa860);
  const bubbleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { w: { value: 0 } },
    vertexShader:
      'varying vec3 n;varying vec3 v;varying vec3 p;void main(){n=normalize(normalMatrix*normal);vec4 q=modelViewMatrix*vec4(position,1.);v=normalize(-q.xyz);p=position;gl_Position=projectionMatrix*q;}',
    fragmentShader:
      'uniform float w;varying vec3 n;varying vec3 v;varying vec3 p;void main(){float f=pow(1.-abs(dot(n,v)),3.);float b=.6+.4*sin(p.x*9.);gl_FragColor=vec4(.45,.75,1.,1.)*f*w*b*.9;}',
  });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), bubbleMat);
  bubble.scale.set(95, 55, 55);
  bubble.visible = false;
  bubble.userData.isWarpBubble = true;
  shipFrame.add(bubble);

  let simClock = 0;
  let smoothWarp = 0;

  function update(dt = 0.016, throttle = 0.25, targetWarp = 0) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0.016));
    simClock += safeDt;

    const wGoal = Math.max(0, Math.min(1, Number(targetWarp) || 0));
    smoothWarp += (wGoal - smoothWarp) * Math.min(1, safeDt * (wGoal > smoothWarp ? 1.8 : 2.6));

    hubG.rotation.y += safeDt * 0.12;
    cageG.rotation.y -= safeDt * 0.2;
    ringA.rotation.x += safeDt * (0.18 + smoothWarp * 0.5);
    ringB.rotation.x -= safeDt * (0.3 + smoothWarp * 0.6);
    atomOrbs.forEach(([orb, sp]) => {
      orb.rotation.z += safeDt * sp * (1 + smoothWarp * 2);
    });
    atomG.rotation.y += safeDt * 0.25;
    atomG.rotation.x = Math.sin(simClock * 0.4) * 0.45;

    const thr = Math.max(0.05, Math.min(2.0, Number(throttle) || 0.2));
    plumes.forEach((m) => {
      const s = 0.36 + thr * 0.55 + smoothWarp * 1.4 + Math.sin(simClock * 12.0) * 0.03;
      m.scale.y = s;
      m.position.x = -60 - (m.userData.h * s) / 2;
      m.material.uniforms.t.value = simClock;
      m.material.uniforms.w.value = smoothWarp;
    });

    engineLight.intensity = 2.0 + thr * 1.2 + smoothWarp * 5.0;
    engineLight.color.copy(warpColorAmber).lerp(warpColorBlue, smoothWarp);

    bubble.material.uniforms.w.value = smoothWarp;
    bubble.visible = sectionClipPlane.constant > 1e3 && smoothWarp > 0.01;
  }

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
    atomOrbits: atomG,
    bubble,
    setSectionCutaway: (yPlane = null) => {
      sectionClipPlane.constant = Number.isFinite(yPlane) ? yPlane : 1e4;
    },
    update,
  };
}

export function createModularShipHull() {
  const shipData = buildModularShip120M();
  return {
    group: shipData.root,
    update: shipData.update,
    dimensions: shipData.dimensions,
  };
}
