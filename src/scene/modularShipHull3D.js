import * as THREE from 'three';
import astralSentinelsLogoUrl from '../assets/astral-sentinels-logo.jpg';
import { createShipPbrSuite } from './shipPbrMaterials.js';

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

  // Shared PBR exterior material suite with tangent-space normals, roughness maps & metallic trims
  const pbrSuite = createShipPbrSuite(11);
  Object.values(pbrSuite.materials).forEach((m) => {
    if (m) m.clippingPlanes = [sectionClipPlane];
  });

  const extraDisposables = [];
  const geoCache = new Map();
  const cachedGeo = (key, factory) => {
    let g = geoCache.get(key);
    if (!g) {
      g = factory();
      geoCache.set(key, g);
      extraDisposables.push(g);
    }
    return g;
  };
  const makeBasicMat = (color, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...extra });
    m.clippingPlanes = [sectionClipPlane];
    extraDisposables.push(m);
    return m;
  };

  const hullMat = pbrSuite.materials.hullExteriorMat;
  const hullDoubleMat = pbrSuite.materials.hullExteriorDoubleMat;
  const darkMat = pbrSuite.materials.darkTrimMat;
  const goldMat = pbrSuite.materials.goldMliMat;
  const steelMat = pbrSuite.materials.brushedSteelMat;
  const copperMat = pbrSuite.materials.copperCoilMat;
  const finMat = pbrSuite.materials.radiatorGrapheneMat;
  const glassMat = pbrSuite.materials.glassViewportMat;
  const cyanMat = makeBasicMat(0x88dfff, { transparent: true, opacity: 0.88 });
  const warmMat = makeBasicMat(0xffdca0, { transparent: true, opacity: 0.92 });
  const coreNozzleGlowMat = makeBasicMat(0xff9436, { transparent: true, opacity: 0.36 });
  const innerNozzleGlowMat = makeBasicMat(0xffd7a4, { transparent: true, opacity: 0.44 });
  const auxNozzleGlowMat = makeBasicMat(0x68beff, { transparent: true, opacity: 0.38 });

  // Branded bow plate: the white background blends into the painted end cap,
  // while the circular mesh keeps the mark flush with the cylindrical nose.
  const canLoadDomImage =
    typeof document !== 'undefined' && typeof document.createElementNS === 'function';
  const bowLogoTexture = canLoadDomImage
    ? new THREE.TextureLoader().load(astralSentinelsLogoUrl)
    : new THREE.Texture();
  bowLogoTexture.encoding = THREE.sRGBEncoding;
  bowLogoTexture.anisotropy = 8;
  extraDisposables.push(bowLogoTexture);
  const bowLogoMaterial = new THREE.MeshBasicMaterial({
    map: bowLogoTexture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  bowLogoMaterial.clippingPlanes = [sectionClipPlane];
  extraDisposables.push(bowLogoMaterial);

  const shadowCasters = [];
  let shadowsEnabledState = true;
  const staticFreezeCandidates = [];

  const addMesh = (parent, geo, mat, x = 0, y = 0, z = 0, shadow = true, freezeMatrix = true) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow && shadowsEnabledState;
    mesh.receiveShadow = shadow && shadowsEnabledState;
    if (shadow) shadowCasters.push(mesh);
    if (freezeMatrix) staticFreezeCandidates.push(mesh);
    parent.add(mesh);
    return mesh;
  };
  const boxGeo = (a, b, c) =>
    cachedGeo(`box:${a}:${b}:${c}`, () => new THREE.BoxGeometry(a, b, c));
  const cylGeo = (a, b, l, s = 32) =>
    cachedGeo(`cyl:${a}:${b}:${l}:${s}`, () => new THREE.CylinderGeometry(a, b, l, s));
  const torusGeo = (R, t, rs = 12, ts = 96) =>
    cachedGeo(`tor:${R.toFixed(3)}:${t.toFixed(3)}:${rs}:${ts}`, () => new THREE.TorusGeometry(R, t, rs, ts));
  const sphereGeo = (r, ws = 24, hs = 16, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) =>
    cachedGeo(`sph:${r}:${ws}:${hs}:${ps}:${pl.toFixed(3)}:${ts}:${tl.toFixed(3)}`, () => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl));
  const circleGeo = (r, s = 24) =>
    cachedGeo(`cir:${r}:${s}`, () => new THREE.CircleGeometry(r, s));
  const cylX = (parent, r1, r2, l, x, mat, s = 40) => {
    const o = addMesh(parent, cylGeo(r1, r2, l, s), mat, x);
    o.rotation.z = Math.PI / 2;
    return o;
  };
  const torusX = (parent, R, t, x, mat) => {
    const o = addMesh(parent, torusGeo(R, t, 12, 96), mat, x);
    o.rotation.y = Math.PI / 2;
    return o;
  };
  const torusY = (parent, R, t, y, mat) => {
    const o = addMesh(parent, torusGeo(R, t, 10, 96), mat, 0, y, 0, false);
    o.rotation.x = Math.PI / 2;
    return o;
  };
  const addGreebles = (parent, x0, x1, radius, count) => {
    // GPU-instanced structural armor plates, MLI blanket modules & fastener studs wrapped in LOD
    const lod = new THREE.LOD();
    lod.name = 'HullGreeblesLOD';
    const highGrp = new THREE.Group();
    const farGrp = new THREE.Group();
    const darkPos = [];
    const goldPos = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = rnd() * 2 * Math.PI;
      const x = x0 + rnd() * (x1 - x0);
      const w = 0.8 + rnd() * 3;
      const l = 0.8 + rnd() * 2.4;
      const h = 0.3 + rnd() * 1.2;
      dummy.position.set(x, Math.cos(a) * (radius + h / 2 - 0.1), Math.sin(a) * (radius + h / 2 - 0.1));
      dummy.rotation.set(a, 0, 0);
      dummy.scale.set(l, h, w);
      dummy.updateMatrix();
      (rnd() < 0.24 ? goldPos : darkPos).push(dummy.matrix.clone());
    }
    const unitBox = boxGeo(1, 1, 1);
    if (darkPos.length > 0) {
      const inst = new THREE.InstancedMesh(unitBox, darkMat, darkPos.length);
      darkPos.forEach((m, idx) => inst.setMatrixAt(idx, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.matrixAutoUpdate = false;
      shadowCasters.push(inst);
      highGrp.add(inst);
    }
    if (goldPos.length > 0) {
      const inst = new THREE.InstancedMesh(unitBox, goldMat, goldPos.length);
      goldPos.forEach((m, idx) => inst.setMatrixAt(idx, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.matrixAutoUpdate = false;
      shadowCasters.push(inst);
      highGrp.add(inst);
    }
    lod.addLevel(highGrp, 0);
    lod.addLevel(farGrp, 240);
    parent.add(lod);
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
    const baffle = torusX(engineCluster, 1.25, 0.14, -55.9, copperMat);
    baffle.position.set(-55.9, y, z);
    const gg = new THREE.Mesh(circleGeo(1.08, 20), auxNozzleGlowMat);
    gg.rotation.y = -Math.PI / 2;
    gg.position.set(-56.02, y, z);
    staticFreezeCandidates.push(gg);
    engineCluster.add(gg);
  }

  // 4 aletas radiadoras con costillas de enfriamiento instanciadas y bordes en acero cepillado
  const radiatorRibMats = [];
  const radiatorRibGeo = boxGeo(0.28, 10.1, 0.42);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const f = new THREE.Group();
    f.rotation.x = a;
    engineCluster.add(f);
    addMesh(f, boxGeo(14, 10, 0.2), finMat, -43, 14, 0);
    addMesh(f, boxGeo(14.1, 0.35, 0.34), steelMat, -43, 18.85, 0, false);
    addMesh(f, boxGeo(14.1, 0.35, 0.34), darkMat, -43, 9.15, 0, false);
    for (let rx = -49; rx <= -37; rx += 3) {
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
      const p = new THREE.Vector3(rx, 14 * Math.cos(a), 14 * Math.sin(a));
      m4.compose(p, q, new THREE.Vector3(1, 1, 1));
      radiatorRibMats.push(m4);
    }
  }
  if (radiatorRibMats.length > 0) {
    const ribInst = new THREE.InstancedMesh(radiatorRibGeo, steelMat, radiatorRibMats.length);
    radiatorRibMats.forEach((m4, idx) => ribInst.setMatrixAt(idx, m4));
    ribInst.instanceMatrix.needsUpdate = true;
    engineCluster.add(ribInst);
  }

  // Tobera principal con anillo de refrigeración en cobre + plasma en dos etapas (sin saturación blanca)
  torusX(engineCluster, 6.2, 0.32, -59.5, copperMat);
  torusX(engineCluster, 4.1, 0.22, -59.65, steelMat);
  const mainGlowOuter = new THREE.Mesh(circleGeo(6.9, 36), coreNozzleGlowMat);
  mainGlowOuter.rotation.y = -Math.PI / 2;
  mainGlowOuter.position.x = -59.82;
  staticFreezeCandidates.push(mainGlowOuter);
  engineCluster.add(mainGlowOuter);

  const mainGlow = new THREE.Mesh(circleGeo(4.2, 28), innerNozzleGlowMat);
  mainGlow.rotation.y = -Math.PI / 2;
  mainGlow.position.x = -59.9;
  staticFreezeCandidates.push(mainGlow);
  engineCluster.add(mainGlow);

  const makePlumeMat = () => {
    const pm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      uniforms: { t: { value: 0 }, w: { value: 0 } },
      vertexShader:
        'varying vec2 vu;void main(){vu=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform float t,w;varying vec2 vu;void main(){float a=pow(1.-vu.y,1.8);float f=.78+.22*sin(vu.y*28.-t*20.)*sin(t*6.);vec3 c=mix(vec3(1.,.58,.22),vec3(.45,.78,1.),w);c=mix(c,vec3(1.,.95,.88),a*.2);gl_FragColor=vec4(c*f*a*(.34+w*.62),a*.44);}',
    });
    extraDisposables.push(pm);
    return pm;
  };

  const mainPlumeGeo = (r, h, s) =>
    cachedGeo(`cone:${r}:${h}:${s}`, () => new THREE.ConeGeometry(r, h, s, 1, true));

  const plumes = [
    [6.5, 32],
    [3.2, 22],
  ].map(([r, h]) => {
    const m = new THREE.Mesh(mainPlumeGeo(r, h, 32), makePlumeMat());
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
    torusX(g, 2.9, 0.18, -55.7, copperMat).position.y = 16;

    const glOuter = new THREE.Mesh(circleGeo(3.0, 24), coreNozzleGlowMat);
    glOuter.rotation.y = -Math.PI / 2;
    glOuter.position.set(-55.98, 16, 0);
    staticFreezeCandidates.push(glOuter);
    g.add(glOuter);

    const gl = new THREE.Mesh(circleGeo(1.7, 20), innerNozzleGlowMat);
    gl.rotation.y = -Math.PI / 2;
    gl.position.set(-56.06, 16, 0);
    staticFreezeCandidates.push(gl);
    g.add(gl);

    const m = new THREE.Mesh(mainPlumeGeo(3.2, 18, 20), makePlumeMat());
    m.rotation.z = Math.PI / 2;
    m.userData.h = 18;
    m.userData.isPlume = true;
    m.position.y = 16;
    g.add(m);
    plumes.push(m);
  }

  const engineLight = new THREE.PointLight(0xffa860, 1.9, 68);
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
  const bowLogo = addMesh(commandModule, circleGeo(6.42, 96), bowLogoMaterial, 60.025, 0, 0, false);
  bowLogo.rotation.y = Math.PI / 2;

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
    sphereGeo(2.6, 20, 10, 0, 2 * Math.PI, 0, 0.9),
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
      addMesh(structuralSpine, sphereGeo(0.22, 8, 6), cyanMat, q.x, q.y + 1.9, q.z, false);
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
    addMesh(g, torusGeo(r, 0.45, 12, 96), mt, 0, 0, 0);
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
      addMesh(e, sphereGeo(1.4, 20, 14), hullMat, 0, 0, 0);
      addMesh(e, torusGeo(1.45, 0.18, 8, 24), goldMat, 0, 0, 0);
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

  const hubSphereLod = new THREE.LOD();
  hubSphereLod.name = 'HabitatSphereLOD';
  const hubSphereHi = new THREE.Mesh(sphereGeo(SPHERE_R, 48, 36), hullDoubleMat);
  const hubSphereLo = new THREE.Mesh(sphereGeo(SPHERE_R, 24, 18), hullDoubleMat);
  hubSphereHi.matrixAutoUpdate = false;
  hubSphereLo.matrixAutoUpdate = false;
  hubSphereLod.addLevel(hubSphereHi, 0);
  hubSphereLod.addLevel(hubSphereLo, 210);
  hubG.add(hubSphereLod);

  const cageTorusGeo = torusGeo(SPHERE_R + 0.25, 0.3, 8, 84);
  for (let i = 0; i < 8; i++) {
    const o = addMesh(cageG, cageTorusGeo, darkMat, 0, 0, 0, false);
    o.rotation.y = (i * Math.PI) / 8;
  }
  [-15, -10, 10, 15].forEach((y) =>
    torusY(cageG, Math.sqrt(SPHERE_R * SPHERE_R - y * y) + 0.1, 0.3, y, darkMat),
  );

  {
    const inst = new THREE.InstancedMesh(boxGeo(1.5, 0.8, 0.16), warmMat, 200);
    const frameInst = new THREE.InstancedMesh(boxGeo(1.76, 1.04, 0.12), steelMat, 200);
    const dummy = new THREE.Object3D();
    const frameDummy = new THREE.Object3D();
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
        inst.setMatrixAt(count, dummy.matrix);

        frameDummy.position.set((r - 0.02) * Math.cos(a), y, (r - 0.02) * Math.sin(a));
        frameDummy.lookAt(frameDummy.position.x * 2, y * 2, frameDummy.position.z * 2);
        frameDummy.updateMatrix();
        frameInst.setMatrixAt(count, frameDummy.matrix);
        count++;
      }
    }
    inst.count = count;
    inst.instanceMatrix.needsUpdate = true;
    frameInst.count = count;
    frameInst.instanceMatrix.needsUpdate = true;
    hubG.add(frameInst, inst);

    // Sujetadores estructurales instanciados sobre el cinturón ecuatorial de la esfera habitable
    const boltCount = 48;
    const bolts = new THREE.InstancedMesh(cylGeo(0.16, 0.16, 0.24, 6), goldMat, boltCount);
    for (let i = 0; i < boltCount; i++) {
      const a = (i / boltCount) * Math.PI * 2;
      dummy.position.set((SPHERE_R + 0.06) * Math.cos(a), 0, (SPHERE_R + 0.06) * Math.sin(a));
      dummy.rotation.set(0, -a, Math.PI / 2);
      dummy.updateMatrix();
      bolts.setMatrixAt(i, dummy.matrix);
    }
    bolts.instanceMatrix.needsUpdate = true;
    hubG.add(bolts);
  }

  // Ventana frontal de proa saliente (tolva facetada del puente con cristal blindado y parteluces)
  {
    const w = addMesh(scienceModules, cylGeo(2, 4.2, 2.8, 4), hullMat, 20.7, 5, 0);
    w.rotation.z = -Math.PI / 2;
    w.rotation.x = Math.PI / 4;
    addMesh(scienceModules, boxGeo(0.14, 1.35, 2.65), darkMat, 22.02, 5, 0, false);
    addMesh(scienceModules, boxGeo(0.08, 1.18, 2.38), glassMat, 22.14, 5, 0, false);
    addMesh(scienceModules, boxGeo(0.06, 0.26, 2.2), cyanMat, 22.08, 4.65, 0, false);
    [-0.75, 0, 0.75].forEach((mz) =>
      addMesh(scienceModules, boxGeo(0.16, 1.3, 0.08), steelMat, 22.16, 5, mz, false),
    );
    addMesh(scienceModules, boxGeo(0.32, 0.26, 3.25), goldMat, 21.92, 6.45, 0);
    addMesh(scienceModules, boxGeo(0.32, 0.26, 3.25), goldMat, 21.92, 3.55, 0);
  }

  // Marcador estructural de cámara de reactor exterior / bahía ventral
  {
    const ventRing = new THREE.Mesh(torusGeo(6.2, 0.32, 10, 48), goldMat);
    ventRing.rotation.x = Math.PI / 2;
    ventRing.position.set(0, -SPHERE_R + 0.4, 0);
    staticFreezeCandidates.push(ventRing);
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
  extraDisposables.push(bubbleMat);
  const bubble = new THREE.Mesh(sphereGeo(1, 36, 24), bubbleMat);
  bubble.scale.set(95, 55, 55);
  bubble.visible = false;
  bubble.userData.isWarpBubble = true;
  shipFrame.add(bubble);

  // Congelar transformaciones locales de piezas estáticas para evitar updateMatrix cada frame
  for (let i = 0; i < staticFreezeCandidates.length; i += 1) {
    const obj = staticFreezeCandidates[i];
    if (obj && !obj.userData?.isPlume && !obj.userData?.isWarpBubble) {
      obj.updateMatrix();
      obj.matrixAutoUpdate = false;
    }
  }

  const setShadowsEnabled = (enabled) => {
    const active = Boolean(enabled);
    if (shadowsEnabledState === active) return;
    shadowsEnabledState = active;
    for (let i = 0; i < shadowCasters.length; i += 1) {
      const m = shadowCasters[i];
      if (m) {
        m.castShadow = active;
        m.receiveShadow = active;
      }
    }
  };

  let visualEffectsLevel = 'high';
  const setVisualEffectsLevel = (level = 'high') => {
    const next = level === 'low' || level === 'medium' ? level : 'high';
    visualEffectsLevel = next;
    engineLight.visible = next !== 'low';
  };

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
    const showAuxPlumes = visualEffectsLevel !== 'low' || smoothWarp > 0.05;
    for (let i = 0; i < plumes.length; i += 1) {
      const m = plumes[i];
      if (!showAuxPlumes && i > 1) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const s = 0.36 + thr * 0.55 + smoothWarp * 1.4 + Math.sin(simClock * 12.0) * 0.03;
      m.scale.y = s;
      m.position.x = -60 - (m.userData.h * s) / 2;
      m.material.uniforms.t.value = simClock;
      m.material.uniforms.w.value = smoothWarp;
    }

    if (engineLight.visible) {
      engineLight.intensity = 1.45 + thr * 0.85 + smoothWarp * 3.8;
      engineLight.color.copy(warpColorAmber).lerp(warpColorBlue, smoothWarp);
    }

    bubble.material.uniforms.w.value = smoothWarp;
    bubble.visible = sectionClipPlane.constant > 1e3 && smoothWarp > 0.01;
  }

  const dispose = () => {
    pbrSuite.dispose();
    extraDisposables.forEach((d) => d?.dispose?.());
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
    atomOrbits: atomG,
    bubble,
    setSectionCutaway: (yPlane = null) => {
      sectionClipPlane.constant = Number.isFinite(yPlane) ? yPlane : 1e4;
    },
    setShadowsEnabled,
    setVisualEffectsLevel,
    setAnisotropy: (v) => pbrSuite.setAnisotropy(v),
    update,
    dispose,
  };
}

export function createModularShipHull() {
  const shipData = buildModularShip120M();
  return {
    group: shipData.root,
    update: shipData.update,
    dimensions: shipData.dimensions,
    dispose: shipData.dispose,
  };
}
