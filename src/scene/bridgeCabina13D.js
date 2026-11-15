import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  ELEVATOR_SHAFT_RADIUS,
  getBridgeHalfWidthAtZ,
} from './kronoxInteriorSpatialModel.js';
import { createHolographicShaderMaterial } from './shipPbrMaterials.js';
import { createBridgeCabina1MaterialSuite } from './bridgeCabina1Materials.js';

/**
 * Construye íntegramente la arquitectura 3D esculpida, mobiliario ergonómico,
 * techo abovedado, suelos compuestos con zanjas de umbilicales, iluminación
 * atmosférica calibrada y terminales integrados de Cabina 1 (Puente de Mando · `deck-01`).
 */
export function buildBridgeCabina13D({
  parentGroup,
  floorY = 3.4,
  mountDeckPlacard,
  registerColliderMesh,
  staticFreezeCandidates,
} = {}) {
  const f = floorY;
  const localSuite = createBridgeCabina1MaterialSuite();
  const M = localSuite.materials;

  const extraDisposables = [];
  const trackGeo = (g) => {
    extraDisposables.push(g);
    return g;
  };
  const trackMat = (m) => {
    extraDisposables.push(m);
    return m;
  };

  const geoCache = new Map();
  const cached = (key, factory) => {
    if (!geoCache.has(key)) {
      geoCache.set(key, trackGeo(factory()));
    }
    return geoCache.get(key);
  };

  const place = (target, geo, mat, x = 0, y = 0, z = 0, colliderKind = null) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    target.add(mesh);
    if (colliderKind && registerColliderMesh) {
      registerColliderMesh(mesh, colliderKind, 'deck-01');
    }
    if (staticFreezeCandidates) {
      staticFreezeCandidates.push(mesh);
    }
    return mesh;
  };

  const rbox = (w, h, d, r = 0.032, segs = 2) =>
    cached(`rb:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}:${segs}`, () =>
      new RoundedBoxGeometry(w, h, d, segs, r),
    );
  const cyl = (rt, rb, h, seg = 20) =>
    cached(`cy:${rt.toFixed(3)}:${rb.toFixed(3)}:${h.toFixed(3)}:${seg}`, () =>
      new THREE.CylinderGeometry(rt, rb, h, seg),
    );
  const torus = (rad, tube, rs = 10, ts = 32) =>
    cached(`to:${rad.toFixed(3)}:${tube.toFixed(3)}:${rs}:${ts}`, () =>
      new THREE.TorusGeometry(rad, tube, rs, ts),
    );
  const tubeGeo = (key, points, radius, tubularSegments = 20, radialSegments = 8, closed = false) =>
    cached(`tb:${key}`, () => {
      const curve = new THREE.CatmullRomCurve3(
        points.map(([px, py, pz]) => new THREE.Vector3(px, py, pz)),
        closed,
      );
      return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
    });

  // =========================================================================
  // GEOMETRÍAS ESCULPIDAS PARAMÉTRICAS (Extrusión Bezier + Torno Lathe)
  // =========================================================================

  // Costilla abovedada continua de exoesqueleto (sube desde el antepecho hasta la espina del techo)
  const buildVaultRibGeo = (halfSpan, wallTopY = 0.72, apexY = 2.94, depth = 0.19) =>
    cached(`rib:${halfSpan.toFixed(2)}:${apexY.toFixed(2)}`, () => {
      const outerSpan = halfSpan + 0.08;
      const innerSpan = Math.max(2.2, halfSpan - 0.34);
      const shape = new THREE.Shape();
      shape.moveTo(-outerSpan, 0.0);
      shape.lineTo(-outerSpan, wallTopY);
      shape.bezierCurveTo(
        -outerSpan + 0.06,
        apexY * 0.72,
        -outerSpan * 0.42,
        apexY + 0.08,
        0,
        apexY + 0.08,
      );
      shape.bezierCurveTo(
        outerSpan * 0.42,
        apexY + 0.08,
        outerSpan - 0.06,
        apexY * 0.72,
        outerSpan,
        wallTopY,
      );
      shape.lineTo(outerSpan, 0.0);
      shape.lineTo(innerSpan, 0.0);
      shape.lineTo(innerSpan + 0.04, wallTopY + 0.04);
      shape.bezierCurveTo(
        innerSpan,
        apexY * 0.66,
        innerSpan * 0.44,
        apexY - 0.22,
        0,
        apexY - 0.22,
      );
      shape.bezierCurveTo(
        -innerSpan * 0.44,
        apexY - 0.22,
        -innerSpan,
        apexY * 0.66,
        -innerSpan - 0.04,
        wallTopY + 0.04,
      );
      shape.lineTo(-innerSpan, 0.0);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.022,
        bevelSize: 0.018,
        bevelSegments: 2,
        curveSegments: 20,
      });
      geo.translate(0, 0, -depth * 0.5);
      geo.rotateY(Math.PI / 2);
      return geo;
    });

  // Panel superior de techo abovedado oscuro liso (sella toda la cubierta C01 sin huecos ni rejillas)
  const buildVaultedCanopySlabGeo = (halfSpan, widthAlongX, apexY = 2.98) =>
    cached(`vault:${halfSpan.toFixed(2)}:${widthAlongX.toFixed(2)}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-halfSpan, 2.38);
      s.bezierCurveTo(-halfSpan * 0.62, apexY + 0.04, -halfSpan * 0.2, apexY + 0.14, 0, apexY + 0.14);
      s.bezierCurveTo(halfSpan * 0.2, apexY + 0.14, halfSpan * 0.62, apexY + 0.04, halfSpan, 2.38);
      s.lineTo(halfSpan - 0.18, 2.32);
      s.bezierCurveTo(halfSpan * 0.60, apexY - 0.04, halfSpan * 0.2, apexY + 0.06, 0, apexY + 0.06);
      s.bezierCurveTo(-halfSpan * 0.2, apexY + 0.06, -halfSpan * 0.60, apexY - 0.04, -halfSpan + 0.18, 2.32);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: widthAlongX,
        bevelEnabled: false,
        curveSegments: 16,
      });
      geo.translate(0, 0, -widthAlongX * 0.5);
      geo.rotateY(Math.PI / 2);
      return geo;
    });

  // Antepecho inclinado aerodinámico para ventanales panorámicos (sx > 0 mapea a -Z interior tras rotateY(+PI/2))
  const buildSlopedKneeWallGeo = (len, height = 0.70) =>
    cached(`knee:${len.toFixed(2)}:${height.toFixed(2)}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-0.22, 0);
      s.lineTo(0.32, 0);
      s.bezierCurveTo(0.38, height * 0.42, 0.44, height * 0.78, 0.28, height);
      s.lineTo(-0.20, height);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: len,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.018,
        bevelSegments: 2,
      });
      geo.rotateY(Math.PI / 2);
      geo.translate(-len * 0.5, 0, 0);
      return geo;
    });

  // Visera superior antirreflejos proyectada hacia el interior (-Z local tras rotateY(+PI/2))
  const buildBowGlareBrowGeo = (len) =>
    cached(`brow:${len.toFixed(2)}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-0.22, 2.94);
      s.lineTo(0.20, 2.94);
      s.bezierCurveTo(0.46, 2.86, 0.58, 2.74, 0.48, 2.66);
      s.lineTo(-0.20, 2.70);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: len,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.016,
        bevelSegments: 2,
      });
      geo.rotateY(Math.PI / 2);
      geo.translate(-len * 0.5, 0, 0);
      return geo;
    });

  // Consola en voladizo esculpida con vientre curvo (reemplaza el prisma recto)
  const buildSculptedChevronDeskGeo = (width = 2.02) =>
    cached(`chevDesk:${width.toFixed(2)}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-0.34, 0.0);
      s.lineTo(0.36, 0.0);
      s.lineTo(0.46, 0.62);
      s.bezierCurveTo(0.56, 0.84, 0.52, 0.94, 0.30, 0.96);
      s.lineTo(-0.56, 0.99);
      s.bezierCurveTo(-0.68, 0.95, -0.62, 0.78, -0.34, 0.64);
      s.bezierCurveTo(-0.22, 0.45, -0.26, 0.16, -0.34, 0.0);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: width,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.022,
        bevelSegments: 2,
        curveSegments: 12,
      });
      geo.rotateY(Math.PI / 2);
      geo.translate(-width * 0.5, 0, 0);
      return geo;
    });

  // Chasis curvo aerodinámico para Timón Central Gullwing
  const buildGullwingHelmProfileGeo = (width = 1.66) =>
    cached(`gullwing:${width.toFixed(2)}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-0.18, 0.58);
      s.lineTo(0.24, 0.58);
      s.bezierCurveTo(0.38, 0.64, 0.44, 0.78, 0.32, 0.86);
      s.lineTo(-0.28, 0.88);
      s.bezierCurveTo(-0.38, 0.82, -0.34, 0.66, -0.18, 0.58);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: width,
        bevelEnabled: true,
        bevelThickness: 0.026,
        bevelSize: 0.022,
        bevelSegments: 2,
      });
      geo.rotateY(Math.PI / 2);
      geo.translate(-width * 0.5, 0, 0);
      return geo;
    });

  // Carcasa ergonómica en S para respaldo trasero (-Z de butaca tras rotateY(+PI/2))
  const buildChairShellBackGeo = (w = 0.66) =>
    cached(`chairBack:${w.toFixed(2)}`, () => {
      const s = new THREE.Shape();
      s.moveTo(0.20, 0.44);
      s.bezierCurveTo(0.30, 0.60, 0.39, 0.98, 0.45, 1.38);
      s.lineTo(0.36, 1.44);
      s.bezierCurveTo(0.30, 1.04, 0.22, 0.66, 0.12, 0.50);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: w,
        bevelEnabled: true,
        bevelThickness: 0.022,
        bevelSize: 0.018,
        bevelSegments: 2,
        curveSegments: 14,
      });
      geo.rotateY(Math.PI / 2);
      geo.translate(-w * 0.5, 0, 0);
      return geo;
    });

  // Pedestal torno-laminado para sillería hidráulica
  const chairPedestalGeo = cached('chairPedestalLathe', () => {
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.38, 0.0),
      new THREE.Vector2(0.36, 0.045),
      new THREE.Vector2(0.16, 0.085),
      new THREE.Vector2(0.10, 0.16),
      new THREE.Vector2(0.085, 0.36),
      new THREE.Vector2(0.14, 0.41),
      new THREE.Vector2(0.0, 0.41),
    ];
    return new THREE.LatheGeometry(pts, 24);
  });

  // Difusor circular aerodinámico torneado para el techo
  const ceilingDiffuserGeo = cached('ceilDiffuserLathe', () => {
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.42, 0.0),
      new THREE.Vector2(0.38, 0.055),
      new THREE.Vector2(0.24, 0.085),
      new THREE.Vector2(0.14, 0.04),
      new THREE.Vector2(0.0, 0.02),
    ];
    return new THREE.LatheGeometry(pts, 24);
  });

  // Falda de turbina acampanada torneada para Mesa Holográfica Táctica de popa
  const holoTurbinePedestalGeo = cached('holoTurbineLathe', () => {
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(1.74, 0.0),
      new THREE.Vector2(1.66, 0.11),
      new THREE.Vector2(1.36, 0.24),
      new THREE.Vector2(1.22, 0.56),
      new THREE.Vector2(1.42, 0.78),
      new THREE.Vector2(1.58, 0.89),
      new THREE.Vector2(1.46, 0.92),
      new THREE.Vector2(1.04, 0.90),
      new THREE.Vector2(0.96, 0.80),
      new THREE.Vector2(0.0, 0.80),
    ];
    return new THREE.LatheGeometry(pts, 32);
  });

  // Estrado del Capitán: doble anillo biselado suave
  const daisLowerGeo = cached('daisLowerLathe', () => {
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(3.18, 0.0),
      new THREE.Vector2(3.04, 0.14),
      new THREE.Vector2(2.96, 0.18),
      new THREE.Vector2(0.0, 0.18),
    ];
    return new THREE.LatheGeometry(pts, 32);
  });
  const daisUpperGeo = cached('daisUpperLathe', () => {
    const pts = [
      new THREE.Vector2(0.0, 0.18),
      new THREE.Vector2(2.62, 0.18),
      new THREE.Vector2(2.48, 0.36),
      new THREE.Vector2(2.40, 0.40),
      new THREE.Vector2(0.0, 0.40),
    ];
    return new THREE.LatheGeometry(pts, 32);
  });

  // =========================================================================
  // 1. SUELO COMPUESTO NO REPETITIVO + ZANJAS ACRISTALADAS DE UMBILICALES 3D
  // =========================================================================
  const P = [
    [15.5, 0],
    [11, 6.2],
    [1, 12],
    [-12, 10.5],
    [-12, -10.5],
    [1, -12],
    [11, -6.2],
  ];
  const edgeInfo = (A, B) => {
    const dx = B[0] - A[0];
    const dz = B[1] - A[1];
    const l = Math.hypot(dx, dz);
    const mx = (A[0] + B[0]) * 0.5;
    const mz = (A[1] + B[1]) * 0.5;
    let nx = dz / l;
    let nz = -dx / l;
    if (nx * mx + nz * mz < 0) {
      nx = -nx;
      nz = -nz;
    }
    return {
      l,
      mx,
      mz,
      nx,
      nz,
      rot: Math.atan2(nx, nz),
      at: (t) => [A[0] + dx * t, A[1] + dz * t],
    };
  };
  const E = P.map((a, i) => edgeInfo(a, P[(i + 1) % P.length]));

  const buildBridgeFloorGeo = () =>
    cached('bridgeFloorDeckGeo', () => {
      const sh = new THREE.Shape();
      P.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
      sh.closePath();

      // Hueco exacto para el núcleo vertical del ascensor (evita superposiciones con la cabina)
      const elevHole = new THREE.Path();
      elevHole.absarc(0, 0, ELEVATOR_SHAFT_RADIUS + 0.04, 0, Math.PI * 2, true);
      sh.holes.push(elevHole);

      // Dos zanjas reales hundidas en el suelo (popa-ascensor y ascensor-proa)
      // Nota: antes de rotateX(-PI/2), shape-Y corresponde a -az; como las zanjas son simétricas ±0.34, es invariante.
      [
        [-4.25, -1.85],
        [1.85, 3.25],
      ].forEach(([x0, x1]) => {
        const hole = new THREE.Path();
        hole.moveTo(x0, -0.34);
        hole.lineTo(x0, 0.34);
        hole.lineTo(x1, 0.34);
        hole.lineTo(x1, -0.34);
        hole.closePath();
        sh.holes.push(hole);
      });

      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);

      // Proyección UV planar normalizada 1:1 en metros de puente (elimina cuadrícula repetida)
      const posAttr = geo.attributes.position;
      const uvAttr = geo.attributes.uv;
      for (let i = 0; i < posAttr.count; i += 1) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        uvAttr.setXY(i, (vx + 13.0) / 29.0, 1.0 - (vz + 13.0) / 26.0);
      }
      uvAttr.needsUpdate = true;
      return geo;
    });

  place(parentGroup, buildBridgeFloorGeo(), M.bridgeFloorMat, 0, f, 0);

  // Interior real de las 2 zanjas del corredor: conductos curvos de cobre + fibra óptica + marco biselado + cristal ahumado
  [
    [-4.25, -1.85, 'aft'],
    [1.85, 3.25, 'fwd'],
  ].forEach(([x0, x1, tag]) => {
    const cx = (x0 + x1) * 0.5;
    const len = x1 - x0;
    // Fondo oscuro metálico del canal + bordes de latón/champán
    place(parentGroup, rbox(len + 0.08, 0.018, 0.72, 0.008), M.bridgeRibMat, cx, f + 0.008, 0);
    [-0.36, 0.36].forEach((rz) => {
      place(parentGroup, rbox(len + 0.12, 0.026, 0.065, 0.01), M.bridgeChampagneMat, cx, f + 0.058, rz);
    });
    // Tubos umbilicales trenzados visibles bajo el vidrio
    place(
      parentGroup,
      tubeGeo(
        `trenchCuA:${tag}`,
        [
          [x0 + 0.06, f + 0.028, -0.15],
          [cx - len * 0.16, f + 0.036, -0.09],
          [cx + len * 0.16, f + 0.026, -0.16],
          [x1 - 0.06, f + 0.028, -0.14],
        ],
        0.024,
        16,
      ),
      M.bridgeCopperMat,
    );
    place(
      parentGroup,
      tubeGeo(
        `trenchCuB:${tag}`,
        [
          [x0 + 0.06, f + 0.028, 0.15],
          [cx - len * 0.16, f + 0.026, 0.16],
          [cx + len * 0.16, f + 0.036, 0.09],
          [x1 - 0.06, f + 0.028, 0.14],
        ],
        0.024,
        16,
      ),
      M.bridgeCopperMat,
    );
    place(
      parentGroup,
      tubeGeo(
        `trenchOptic:${tag}`,
        [
          [x0 + 0.04, f + 0.034, 0],
          [cx, f + 0.034, 0.02],
          [x1 - 0.04, f + 0.034, 0],
        ],
        0.014,
        12,
      ),
      M.bridgeCyanCoveMat,
    );
    // Cristal ahumado pisable a ras de cubierta
    place(parentGroup, rbox(len - 0.01, 0.02, 0.65, 0.006), M.bridgeTrenchGlassMat, cx, f + 0.056, 0);
  });

  // Aro arquitectónico fresado en torno al atrio del ascensor
  const elevCollar = place(parentGroup, torus(1.56, 0.048, 10, 40), M.bridgeChampagneMat, 0, f + 0.062, 0);
  elevCollar.rotation.x = Math.PI / 2;
  const elevGlowRing = place(parentGroup, torus(1.48, 0.014, 8, 40), M.bridgeCyanCoveMat, 0, f + 0.072, 0);
  elevGlowRing.rotation.x = Math.PI / 2;

  // =========================================================================
  // 2. ARQUITECTURA PERIMETRAL, VENTANALES PANORÁMICOS Y TECHO ABOVEDADO
  // =========================================================================
  const bowFacets = new Set([5, 6, 0, 1]);
  E.forEach((e, i) => {
    const wallGrp = new THREE.Group();
    wallGrp.position.set(e.mx, f, e.mz);
    wallGrp.rotation.y = e.rot;
    parentGroup.add(wallGrp);

    if (i === 3) {
      // Mamparo curvo-artesonado de popa rodeando el portal C01
      [-1, 1].forEach((side) => {
        const wSeg = e.l / 2 - 1.25;
        const cx = side * (e.l / 4 + 0.62);
        place(wallGrp, rbox(wSeg, 2.86, 0.24, 0.035), M.bridgeRibMat, cx, 1.43, 0, 'wall');
        place(wallGrp, rbox(wSeg - 0.36, 1.88, 0.08, 0.025), M.bridgeAcousticWallMat, cx, 1.48, -0.10);
        place(wallGrp, rbox(wSeg - 0.22, 0.045, 0.14, 0.014), M.bridgeChampagneMat, cx, 2.46, -0.11);
        place(wallGrp, rbox(wSeg - 0.4, 0.02, 0.03, 0.008), M.bridgeWarmCoveMat, cx, 2.51, -0.13);
        place(wallGrp, rbox(wSeg - 0.18, 0.22, 0.28, 0.03), M.bridgeCarbonMat, cx, 0.11, -0.02);
      });
    } else if (bowFacets.has(i)) {
      // Antepecho inclinado aerodinámico + acristalamiento óptico limpio + visera superior antirreflejos
      place(wallGrp, buildSlopedKneeWallGeo(e.l + 0.08, 0.70), M.bridgeRibMat, 0, 0, 0, 'wall');
      place(wallGrp, rbox(e.l + 0.06, 0.05, 0.50, 0.02), M.bridgeCarbonMat, 0, 0.71, -0.06);
      place(wallGrp, rbox(e.l - 0.08, 0.03, 0.14, 0.01), M.bridgeChampagneMat, 0, 0.74, -0.26);
      place(wallGrp, rbox(e.l - 0.36, 0.014, 0.024, 0.005), M.bridgeCyanCoveMat, 0, 0.67, -0.31);

      // Vidrio panorámico limpio sin neblina lechosa
      place(wallGrp, cached(`pane:${e.l.toFixed(2)}`, () => new THREE.PlaneGeometry(e.l + 0.04, 2.02)), M.bridgePanoramaGlassMat, 0, 1.72, 0.0);
      const backPane = place(wallGrp, cached(`pane:${e.l.toFixed(2)}`, () => new THREE.PlaneGeometry(e.l + 0.04, 2.02)), M.bridgePanoramaGlassMat, 0, 1.72, 0.02);
      backPane.rotation.y = Math.PI;

      // Visera superior arqueada y montantes afinados inclinados
      place(wallGrp, buildBowGlareBrowGeo(e.l + 0.08), M.bridgeRibMat, 0, 0, 0);
      place(wallGrp, rbox(e.l - 0.14, 0.035, 0.12, 0.012), M.bridgeChampagneMat, 0, 2.68, -0.26);
      place(wallGrp, rbox(e.l * 0.78, 0.016, 0.026, 0.006), M.bridgeWarmCoveMat, 0, 2.66, -0.20);

      [-0.31, 0.31].forEach((mt) => {
        const mullion = place(wallGrp, rbox(0.11, 2.04, 0.19, 0.026), M.bridgeRibMat, e.l * mt, 1.72, -0.04);
        mullion.rotation.x = 0.08;
        const mTrim = place(wallGrp, rbox(0.042, 1.98, 0.22, 0.012), M.bridgeChampagneMat, e.l * mt, 1.72, -0.05);
        mTrim.rotation.x = 0.08;
      });
    } else {
      // Mamparos laterales esculpidos (i=4 Babor Neural/Comms · i=2 Estribor Ingeniería)
      place(wallGrp, rbox(e.l + 0.06, 2.86, 0.24, 0.035), M.bridgeRibMat, 0, 1.43, 0, 'wall');
      place(wallGrp, rbox(e.l - 0.24, 2.08, 0.08, 0.02), M.bridgeAcousticWallMat, 0, 1.45, -0.09);
      place(wallGrp, rbox(e.l, 0.22, 0.30, 0.03), M.bridgeCarbonMat, 0, 0.11, -0.02);
      place(wallGrp, rbox(e.l - 0.2, 0.05, 0.22, 0.016), M.bridgeChampagneMat, 0, 2.56, -0.10);
      place(wallGrp, rbox(e.l * 0.86, 0.018, 0.03, 0.007), M.bridgeWarmCoveMat, 0, 2.61, -0.12);

      // Pilastras estructurales biseladas entre bahías y nichos integrados
      [-0.38, -0.125, 0.125, 0.38].forEach((pt) => {
        place(wallGrp, rbox(0.18, 2.52, 0.14, 0.028), M.bridgeRibMat, e.l * pt, 1.38, -0.10);
        place(wallGrp, rbox(0.045, 2.46, 0.16, 0.012), M.bridgeChampagneMat, e.l * pt, 1.38, -0.115);
      });

      const isPort = i === 4;
      const sideBayMfd = isPort ? M.mfdNeuralMat : M.mfdEngMat;
      [-0.25, 0.25].forEach((bt) => {
        // Marco empotrado de bahía + mesa curva adosada a la pared
        place(wallGrp, rbox(e.l * 0.20, 1.18, 0.10, 0.025), M.bridgeCarbonMat, e.l * bt, 1.62, -0.11);
        place(wallGrp, rbox(e.l * 0.178, 0.94, 0.02, 0.008), sideBayMfd, e.l * bt, 1.62, -0.158);
        place(wallGrp, rbox(e.l * 0.19, 0.038, 0.16, 0.012), M.bridgeChampagneMat, e.l * bt, 2.22, -0.12);
        // Conductos verticales orgánicos laterales
        [-1, 1].forEach((ps) => {
          place(
            wallGrp,
            tubeGeo(
              `wallPipe:${i}:${ps}`,
              [
                [0, 0.24, -0.14],
                [0, 1.0, -0.18],
                [0, 2.25, -0.14],
              ],
              0.018,
              10,
            ),
            isPort ? M.bridgeCopperMat : M.bridgeTrimSteelMat,
            e.l * bt + ps * (e.l * 0.105),
            0,
            0,
          );
        });
      });
    }
  });

  // Pilares esbeltos biselados en vértices del puente (sin bloquear el vértice frontal P[0])
  P.forEach((p, idx) => {
    if (idx === 0) {
      place(parentGroup, rbox(0.28, 0.72, 0.28, 0.04), M.bridgeRibMat, p[0], f + 0.36, p[1], 'wall');
      place(parentGroup, rbox(0.16, 0.74, 0.32, 0.025), M.bridgeChampagneMat, p[0], f + 0.37, p[1]);
    } else {
      place(parentGroup, rbox(0.32, 2.86, 0.32, 0.05), M.bridgeRibMat, p[0], f + 1.43, p[1], 'wall');
      place(parentGroup, rbox(0.12, 2.84, 0.36, 0.025), M.bridgeChampagneMat, p[0], f + 1.43, p[1]);
    }
  });

  // Techo abovedado completo C01 (bóvedas acústicas oscuras + 6 costillas curvas de exoesqueleto + espina con difusores torneados)
  const ribPositions = [-10.2, -6.2, -2.2, 1.8, 5.8, 9.8];
  ribPositions.forEach((ax) => {
    const halfSpan = Math.max(4.6, getBridgeHalfWidthAtZ(-ax) - 0.18);
    place(parentGroup, buildVaultRibGeo(halfSpan, 0.72, 2.94, 0.20), M.bridgeRibMat, ax, f, 0);
    // Filete interior champán y luz indirecta rasante a lo largo del arco
    place(
      parentGroup,
      tubeGeo(
        `ribCove:${ax}`,
        [
          [ax, f + 2.52, -halfSpan * 0.56],
          [ax, f + 2.74, 0],
          [ax, f + 2.52, halfSpan * 0.56],
        ],
        0.018,
        14,
      ),
      M.bridgeWarmCoveMat,
    );
  });

  // Cobertor continuo de bóveda entre mamparo trasero y proa (sella 100% la techumbre sin cuadrículas perforadas)
  [
    [-8.2, 4.0],
    [-4.2, 4.0],
    [-0.2, 4.0],
    [3.8, 4.0],
    [7.8, 4.0],
    [11.3, 3.0],
  ].forEach(([segX, segLen]) => {
    const halfSpan = Math.max(4.1, getBridgeHalfWidthAtZ(-segX) - 0.05);
    place(parentGroup, buildVaultedCanopySlabGeo(halfSpan, segLen, 2.98), M.bridgeCanopyLinerMat, segX, f, 0);
  });

  // Espina longitudinal central del techo con difusores LatheGeometry + umbilicales térmicos de cobre
  place(parentGroup, rbox(23.8, 0.14, 1.24, 0.03), M.bridgeRibMat, -0.4, f + 2.86, 0);
  place(parentGroup, rbox(23.2, 0.06, 0.78, 0.02), M.bridgeCarbonMat, -0.4, f + 2.78, 0);
  [-0.52, 0.52].forEach((cz) => {
    place(
      parentGroup,
      tubeGeo(
        `ceilCu:${cz}`,
        [
          [-11.6, f + 2.78, cz],
          [-2.0, f + 2.81, cz * 0.96],
          [11.0, f + 2.78, cz],
        ],
        0.026,
        18,
      ),
      M.bridgeCopperMat,
    );
    place(parentGroup, rbox(22.4, 0.018, 0.032, 0.006), M.bridgeCyanCoveMat, -0.4, f + 2.75, cz * 0.68);
  });
  [-8.2, -4.2, -0.2, 3.8, 7.8].forEach((dx) => {
    const diff = place(parentGroup, ceilingDiffuserGeo, M.bridgeChampagneMat, dx, f + 2.70, 0);
    diff.rotation.x = Math.PI;
  });

  // =========================================================================
  // 3. SILLERÍA AEROESPACIAL ESCULPIDA + ESTRADO DEL CAPITÁN + CONSOLAS EN CHEVRÓN
  // =========================================================================
  const buildSculptedChair = (target, cx, cz, yBase, rotY, isCaptain = false) => {
    const g = new THREE.Group();
    g.position.set(cx, yBase, cz);
    g.rotation.y = rotY;
    target.add(g);

    const w = isCaptain ? 0.78 : 0.66;
    place(g, chairPedestalGeo, M.bridgeRibMat, 0, 0, 0);
    const collar = place(g, torus(0.24, 0.016, 8, 24), M.bridgeChampagneMat, 0, 0.14, 0);
    collar.rotation.x = Math.PI / 2;

    // Cojín anatómico y bastidor curvo de carbono
    place(g, rbox(w, 0.09, 0.64, 0.036), M.bridgeCarbonMat, 0, 0.44, 0.02);
    place(g, rbox(w - 0.08, 0.09, 0.56, 0.036), M.bridgeUpholsteryMat, 0, 0.50, 0.04);
    const thighRest = place(g, rbox(w - 0.14, 0.065, 0.16, 0.025), M.bridgeChampagneMat, 0, 0.48, 0.31);
    thighRest.rotation.x = 0.25;

    // Respaldo esculpido en S (sin solaparse con ojos en 1P)
    place(g, buildChairShellBackGeo(w - 0.04), M.bridgeCarbonMat, 0, 0, 0);
    const backPad = place(g, rbox(w - 0.14, 0.68, 0.09, 0.036), M.bridgeUpholsteryMat, 0, 0.90, -0.24);
    backPad.rotation.x = -0.16;

    // Refuerzos lumbares laterales + apoyacabezas con clip champán
    [-1, 1].forEach((side) => {
      const bolster = place(g, rbox(0.095, 0.56, 0.14, 0.034), M.bridgeUpholsteryMat, side * (w * 0.40), 0.86, -0.19);
      bolster.rotation.y = side * -0.26;
      bolster.rotation.x = -0.14;

      // Apoyabrazos tubular continuo en voladizo
      place(
        g,
        tubeGeo(
          `arm:${isCaptain ? 'cap' : 'crew'}:${side}`,
          [
            [side * (w * 0.44), 0.44, -0.18],
            [side * (w * 0.54), 0.64, -0.14],
            [side * (w * 0.54), 0.72, 0.08],
            [side * (w * 0.50), 0.71, 0.28],
          ],
          0.024,
          14,
        ),
        M.bridgeChampagneMat,
      );
      place(g, rbox(0.085, 0.032, 0.34, 0.014), M.bridgeUpholsteryMat, side * (w * 0.53), 0.73, 0.06);
      if (isCaptain) {
        place(g, rbox(0.075, 0.016, 0.10, 0.006), M.bridgeCyanCoveMat, side * (w * 0.51), 0.745, 0.24);
      }
    });

    place(g, rbox(0.40, 0.21, 0.095, 0.038), M.bridgeCarbonMat, 0, 1.38, -0.37);
    place(g, rbox(0.34, 0.17, 0.08, 0.03), M.bridgeUpholsteryMat, 0, 1.38, -0.32);
    place(g, rbox(0.44, 0.028, 0.11, 0.01), M.bridgeChampagneMat, 0, 1.26, -0.36);
    return g;
  };

  // Consolas delanteras en chevrón diferenciadas por ala (Babor Astrogación vs Estribor Propulsión)
  const extraConsoleScreens = [];
  [[5, 3], [6, 1], [0, 1], [1, 3]].forEach(([ei, count]) => {
    const e = E[ei];
    const isPortWing = ei === 5 || ei === 6;
    const wingMfdMat = isPortWing ? M.mfdAstroMat : M.mfdHelmMat;

    // Zócalo canalizador curvo bajo cada fila de chevrón
    const zGrp = new THREE.Group();
    zGrp.position.set(e.mx * 0.72, f + 0.04, e.mz * 0.72);
    zGrp.rotation.y = e.rot;
    parentGroup.add(zGrp);
    place(zGrp, rbox(e.l * 0.70, 0.026, 0.40, 0.01), M.bridgeRibMat, 0, 0, 0);
    place(zGrp, rbox(e.l * 0.66, 0.012, 0.024, 0.005), isPortWing ? M.bridgeCyanCoveMat : M.bridgeWarmCoveMat, 0, 0.016, -0.17);

    for (let k = 0; k < count; k += 1) {
      const [ax, az] = e.at((k + 0.5) / count);
      const g = new THREE.Group();
      g.position.set(ax * 0.72, f, az * 0.72);
      g.rotation.y = e.rot;
      parentGroup.add(g);

      place(g, buildSculptedChevronDeskGeo(1.98), M.bridgeRibMat, 0, 0, 0, 'console');
      place(g, rbox(2.04, 0.036, 1.04, 0.016), M.bridgeCarbonMat, 0, 0.97, -0.04);
      place(g, rbox(1.92, 0.024, 0.88, 0.01), isPortWing ? M.bridgeChampagneMat : M.bridgeTrimSteelMat, 0, 0.995, -0.05);
      // Instrumental específico del ala
      place(g, rbox(0.58, 0.024, 0.22, 0.008), M.bridgeCarbonMat, -0.05, 1.015, -0.18);
      if (isPortWing) {
        // Esfera óptica calibradora y colimador espectral a babor
        place(g, cyl(0.08, 0.11, 0.09, 16), M.bridgeChampagneMat, 0.58, 1.05, -0.02);
        place(g, cached('opticSphere', () => new THREE.SphereGeometry(0.062, 16, 12)), M.bridgeOpticalLensMat, 0.58, 1.11, -0.02);
        place(g, cyl(0.042, 0.042, 0.02, 16), M.bridgeTrimSteelMat, -0.60, 1.02, -0.14);
      } else {
        // Cuadrante de empuje vectorial dual y guarda de precaución a estribor
        place(g, rbox(0.24, 0.048, 0.26, 0.014), M.bridgeCarbonMat, 0.56, 1.03, -0.06);
        const leverA = place(g, cyl(0.016, 0.02, 0.14, 10), M.bridgeChampagneMat, 0.52, 1.10, -0.04);
        leverA.rotation.x = 0.24;
        const leverB = place(g, cyl(0.016, 0.02, 0.14, 10), M.bridgeCopperMat, 0.60, 1.10, -0.08);
        leverB.rotation.x = 0.24;
        place(g, rbox(0.46, 0.014, 0.03, 0.005), M.bridgeWarmCoveMat, 0.52, 1.012, -0.34);
      }

      // Contorno de pantalla doble MFD mirando hacia el operador (-Z local del puesto)
      const chevDisplayGrp = new THREE.Group();
      chevDisplayGrp.position.set(0, 1.28, 0.30);
      chevDisplayGrp.rotation.y = Math.PI;
      g.add(chevDisplayGrp);
      const screenShroud = place(chevDisplayGrp, rbox(1.78, 0.56, 0.055, 0.024), M.bridgeCarbonMat, 0, 0, 0);
      screenShroud.rotation.x = -0.48;
      const scrL = place(chevDisplayGrp, rbox(0.80, 0.46, 0.02, 0.008), wingMfdMat, -0.43, 0, 0.024);
      scrL.rotation.x = -0.48;
      const scrR = place(chevDisplayGrp, rbox(0.80, 0.46, 0.02, 0.008), isPortWing ? M.mfdNeuralMat : M.mfdEngMat, 0.43, 0, 0.024);
      scrR.rotation.x = -0.48;
      extraConsoleScreens.push(
        { mesh: scrL, stationId: isPortWing ? 'windows' : 'nav' },
        { mesh: scrR, stationId: isPortWing ? 'missions' : 'comms' },
      );
      place(chevDisplayGrp, rbox(1.82, 0.036, 0.16, 0.014), M.bridgeRibMat, 0, 0.27, 0.02);

      // Butaca de puesto
      buildSculptedChair(parentGroup, ax * 0.72 - e.nx * 1.9, az * 0.72 - e.nz * 1.9, f, e.rot, false);
    }
  });

  // Consolas laterales en voladizo empotradas en mamparos Babor (4) y Estribor (2)
  [2, 4].forEach((ei) => {
    const e = E[ei];
    const isPort = ei === 4;
    const matScreen = isPort ? M.mfdNeuralMat : M.mfdEngMat;
    for (let k = 0; k < 4; k += 1) {
      const [ax, az] = e.at(0.18 + k * 0.21);
      const g = new THREE.Group();
      g.position.set(ax - e.nx * 1.1, f, az - e.nz * 1.1);
      g.rotation.y = e.rot + Math.PI;
      parentGroup.add(g);

      // Brazos laterales en voladizo curvo en lugar de bloques rectangulares
      [-0.78, 0.78].forEach((sx) => {
        place(
          g,
          tubeGeo(
            `sideArm:${ei}:${sx}`,
            [
              [sx, 0.02, 0.38],
              [sx, 0.56, 0.34],
              [sx, 0.92, -0.02],
              [sx, 0.96, -0.34],
            ],
            0.055,
            12,
          ),
          M.bridgeRibMat,
          0,
          0,
          0,
          'console',
        );
      });
      place(g, rbox(2.04, 0.08, 0.84, 0.03), M.bridgeCarbonMat, 0, 0.98, 0, 'console');
      place(g, rbox(2.08, 0.032, 0.88, 0.014), M.bridgeChampagneMat, 0, 1.028, 0);
      place(g, rbox(0.68, 0.022, 0.22, 0.008), M.bridgeCarbonMat, 0, 1.05, 0.18);
      // Pantalla empotrada contra pared (-Z) mirando hacia el pasillo (+Z)
      const scrHood = place(g, rbox(1.74, 0.58, 0.055, 0.022), M.bridgeCarbonMat, 0, 1.34, -0.26);
      scrHood.rotation.x = -0.22;
      const scrPanel = place(g, rbox(1.62, 0.48, 0.02, 0.008), matScreen, 0, 1.34, -0.228);
      scrPanel.rotation.x = -0.22;
      extraConsoleScreens.push({
        mesh: scrPanel,
        stationId: isPort ? (k < 2 ? 'comms' : 'missions') : (k < 2 ? 'nav' : 'science'),
      });
      place(g, rbox(1.78, 0.036, 0.14, 0.012), M.bridgeChampagneMat, 0, 1.64, -0.20);
    }
  });

  // Estrado de Comando del Capitán en doble nivel torneado + dosel acústico suspendido
  place(parentGroup, daisLowerGeo, M.bridgeRibMat, 5.5, f, 0);
  const daisRingLow = place(parentGroup, torus(3.00, 0.024, 8, 40), M.bridgeChampagneMat, 5.5, f + 0.175, 0);
  daisRingLow.rotation.x = Math.PI / 2;
  place(parentGroup, daisUpperGeo, M.bridgeCarbonMat, 5.5, f, 0);
  const daisCoveGlow = place(parentGroup, torus(2.50, 0.016, 8, 40), M.bridgeWarmCoveMat, 5.5, f + 0.365, 0);
  daisCoveGlow.rotation.x = Math.PI / 2;
  const daisTopTrim = place(parentGroup, torus(2.42, 0.026, 8, 40), M.bridgeChampagneMat, 5.5, f + 0.40, 0);
  daisTopTrim.rotation.x = Math.PI / 2;

  // Dosel anular de comando suspendido del techo sin barras verticales bloqueando la vista
  const capHalo = place(parentGroup, torus(2.24, 0.06, 12, 42), M.bridgeRibMat, 5.5, f + 2.70, 0);
  capHalo.rotation.x = Math.PI / 2;
  const capHaloTrim = place(parentGroup, torus(2.19, 0.022, 8, 42), M.bridgeChampagneMat, 5.5, f + 2.65, 0);
  capHaloTrim.rotation.x = Math.PI / 2;
  const capHaloGlow = place(parentGroup, torus(2.12, 0.016, 8, 42), M.bridgeWarmCoveMat, 5.5, f + 2.67, 0);
  capHaloGlow.rotation.x = Math.PI / 2;
  [0.8, 2.34, 3.94, 5.48].forEach((ang) => {
    place(parentGroup, cyl(0.024, 0.028, 0.32, 10), M.bridgeChampagneMat, 5.5 + Math.cos(ang) * 2.24, f + 2.86, Math.sin(ang) * 2.24);
  });

  // Espacio central de la plataforma circular despejado y transitable (sin silla central)

  // =========================================================================
  // 4. TIMÓN CENTRAL GULLWING + 4 TERMINALES INTERACTIVOS INTEGRADOS (SIN PALOS SUELTOS)
  // =========================================================================
  // Butaca del Piloto (KRONOX (0, 3.4, -9.85) = Aurora (+9.85, f, 0))
  buildSculptedChair(parentGroup, 9.85, 0, f, Math.PI / 2, false);

  const helmGroup = new THREE.Group();
  helmGroup.name = 'BridgeCentralHelmConsole';
  helmGroup.position.set(10.68, f, 0);
  helmGroup.rotation.y = Math.PI / 2;
  parentGroup.add(helmGroup);

  // Columna aerodinámica delantera + casco Gullwing esculpido
  place(helmGroup, rbox(0.68, 0.58, 0.42, 0.08), M.bridgeRibMat, 0, 0.29, 0.04, 'console');
  place(helmGroup, rbox(0.74, 0.06, 0.52, 0.025), M.bridgeChampagneMat, 0, 0.03, 0.04);
  place(helmGroup, buildGullwingHelmProfileGeo(1.66), M.bridgeCarbonMat, 0, 0, 0);
  place(helmGroup, rbox(1.70, 0.03, 0.56, 0.012), M.bridgeChampagneMat, 0, 0.88, -0.02);

  // Cuerno de mando ergonómico bimanual en tubo continuo (yoke aeroespacial, sin toro flotante)
  place(
    helmGroup,
    tubeGeo(
      'helmYoke',
      [
        [-0.22, 0.98, -0.34],
        [-0.22, 0.88, -0.28],
        [0, 0.88, -0.25],
        [0.22, 0.88, -0.28],
        [0.22, 0.98, -0.34],
      ],
      0.021,
      20,
    ),
    M.bridgeTrimSteelMat,
  );
  place(helmGroup, cyl(0.032, 0.042, 0.22, 12), M.bridgeRibMat, 0, 0.86, -0.18).rotation.x = 0.55;
  // Aceleradores dobles redondeados
  place(helmGroup, rbox(0.16, 0.055, 0.18, 0.018), M.bridgeCopperMat, 0.54, 0.91, -0.06);
  place(helmGroup, rbox(0.16, 0.055, 0.18, 0.018), M.bridgeChampagneMat, -0.54, 0.91, -0.06);

  // Capucha baja integrada del Timón que alberga el terminal interactivo `nav` mirando al piloto (-Z de helmGroup)
  const helmDisplayPivot = new THREE.Group();
  helmDisplayPivot.position.set(0, 0.985, 0.09);
  helmDisplayPivot.rotation.y = Math.PI;
  helmGroup.add(helmDisplayPivot);
  const helmHoodBack = place(helmDisplayPivot, rbox(1.16, 0.36, 0.05, 0.02), M.bridgeCarbonMat, 0, 0, -0.01);
  helmHoodBack.rotation.x = -0.52;
  place(helmDisplayPivot, rbox(1.20, 0.032, 0.13, 0.012), M.bridgeRibMat, 0, 0.16, 0.03);

  // Malla interactiva `nav` integrada dentro de la capucha del timón (+Z de helmDisplayPivot -> hacia el piloto)
  const navScreenGeo = cached('navBezelScreen', () => new THREE.BoxGeometry(1.06, 0.30, 0.018));
  const navScreenMesh = place(helmDisplayPivot, navScreenGeo, M.mfdHelmMat, 0, 0.005, 0.024);
  navScreenMesh.rotation.x = -0.52;

  // Terminal `windows` desplazado sutilmente al lateral babor de proa en atril colimador inclinado hacia el pasillo (+Z local -> hacia jugador)
  const winLectern = new THREE.Group();
  winLectern.name = 'BridgeBowCollimatorLectern';
  winLectern.position.set(13.25, f, -1.42);
  winLectern.rotation.y = -Math.PI / 2 - 0.38;
  parentGroup.add(winLectern);
  place(winLectern, cyl(0.06, 0.10, 0.92, 16), M.bridgeRibMat, 0, 0.46, 0);
  place(winLectern, rbox(0.92, 0.055, 0.32, 0.02), M.bridgeCarbonMat, 0, 0.92, 0);
  place(winLectern, rbox(0.88, 0.025, 0.30, 0.01), M.bridgeChampagneMat, 0, 0.95, 0);
  const winHood = place(winLectern, rbox(0.86, 0.40, 0.045, 0.016), M.bridgeCarbonMat, 0, 1.12, -0.06);
  winHood.rotation.x = -0.50;
  const winScreenMesh = place(
    winLectern,
    cached('winBezelScreen', () => new THREE.BoxGeometry(0.78, 0.34, 0.018)),
    M.mfdAstroMat,
    0,
    1.12,
    -0.032,
  );
  winScreenMesh.rotation.x = -0.50;
  // Barrilete óptico lateral en el colimador
  place(winLectern, cyl(0.05, 0.065, 0.22, 16), M.bridgeChampagneMat, 0.34, 1.00, -0.02).rotation.x = -0.6;
  place(winLectern, cached('collimLens', () => new THREE.SphereGeometry(0.048, 16, 12)), M.bridgeOpticalLensMat, 0.34, 1.06, -0.10);

  // Nicho escultórico Enlace KRONOX IA en Babor (`comms`, mirando directo hacia el jugador en (2.5, 3.4, -7.4))
  const neuralAlcove = new THREE.Group();
  neuralAlcove.name = 'BridgeKronoxNeuralAlcove';
  neuralAlcove.position.set(2.0, f, -8.35);
  neuralAlcove.rotation.y = 0.48;
  parentGroup.add(neuralAlcove);
  place(neuralAlcove, rbox(0.96, 0.12, 0.56, 0.04), M.bridgeRibMat, 0, 0.06, 0, 'console');
  place(neuralAlcove, cyl(0.09, 0.12, 2.28, 16), M.bridgeCarbonMat, -0.26, 1.18, -0.14);
  place(neuralAlcove, cyl(0.048, 0.048, 2.08, 16), M.bridgeCyanCoveMat, -0.26, 1.18, -0.02);
  place(neuralAlcove, rbox(0.84, 0.06, 0.42, 0.022), M.bridgeChampagneMat, 0, 0.96, 0);
  // Cableado umbilical curvo conectando núcleo neural con suelo
  place(
    neuralAlcove,
    tubeGeo(
      'neuralFiberBundle',
      [
        [-0.36, 0.08, -0.08],
        [-0.44, 0.62, -0.18],
        [-0.34, 1.12, -0.16],
        [-0.26, 1.90, -0.14],
      ],
      0.024,
      14,
    ),
    M.bridgeCopperMat,
  );
  const commsHood = place(neuralAlcove, rbox(0.94, 0.48, 0.055, 0.018), M.bridgeCarbonMat, 0.06, 1.24, -0.06);
  commsHood.rotation.x = -0.32;
  const commsScreenMesh = place(
    neuralAlcove,
    cached('commsBezelScreen', () => new THREE.BoxGeometry(0.86, 0.42, 0.02)),
    M.mfdNeuralMat,
    0.06,
    1.24,
    -0.028,
  );
  commsScreenMesh.rotation.x = -0.32;

  // =========================================================================
  // 5. OBSERVATORIO HOLOGRÁFICO TÁCTICO DE POPA (`missions`, KRONOX (0, 3.4, +6.0))
  // =========================================================================
  place(parentGroup, holoTurbinePedestalGeo, M.bridgeRibMat, -6.0, f, 0, 'console');
  // 8 aletas radiales biseladas en la falda de la mesa holográfica
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const fin = place(
      parentGroup,
      rbox(0.08, 0.74, 0.28, 0.018),
      M.bridgeChampagneMat,
      -6.0 + Math.cos(a) * 1.42,
      f + 0.42,
      Math.sin(a) * 1.42,
    );
    fin.rotation.y = -a + Math.PI / 2;
    fin.rotation.x = -0.16;
  }
  const holoTrimRing = place(parentGroup, torus(1.54, 0.045, 10, 42), M.bridgeChampagneMat, -6.0, f + 0.90, 0);
  holoTrimRing.rotation.x = Math.PI / 2;
  place(parentGroup, cyl(1.24, 1.32, 0.036, 28), M.bridgeCopperMat, -6.0, f + 0.91, 0);
  place(parentGroup, cyl(1.02, 1.02, 0.024, 28), M.bridgeTrenchGlassMat, -6.0, f + 0.93, 0);
  const holoGlowRing = place(parentGroup, torus(0.98, 0.018, 8, 36), M.bridgeCyanCoveMat, -6.0, f + 0.945, 0);
  holoGlowRing.rotation.x = Math.PI / 2;

  // Corona superior sobre holograma
  const holoCrown = place(parentGroup, torus(1.62, 0.056, 10, 36), M.bridgeRibMat, -6.0, f + 2.74, 0);
  holoCrown.rotation.x = Math.PI / 2;
  const holoCrownTrim = place(parentGroup, torus(1.56, 0.02, 8, 36), M.bridgeChampagneMat, -6.0, f + 2.69, 0);
  holoCrownTrim.rotation.x = Math.PI / 2;
  const holoCrownGlow = place(parentGroup, torus(1.48, 0.015, 8, 36), M.bridgeCyanCoveMat, -6.0, f + 2.70, 0);
  holoCrownGlow.rotation.x = Math.PI / 2;

  // Consolita interactiva `missions` anclada físicamente al collar delantero (+ax / ascensor) de la mesa holográfica
  const holoConsoleGroup = new THREE.Group();
  holoConsoleGroup.name = 'BridgeHoloPodium';
  holoConsoleGroup.position.set(-4.52, f, 0);
  holoConsoleGroup.rotation.y = Math.PI / 2;
  parentGroup.add(holoConsoleGroup);
  place(holoConsoleGroup, rbox(0.56, 0.10, 0.24, 0.02), M.bridgeRibMat, 0, 0.88, -0.06);
  const missionsHood = place(holoConsoleGroup, rbox(0.98, 0.46, 0.05, 0.018), M.bridgeCarbonMat, 0, 1.08, -0.08);
  missionsHood.rotation.x = -0.56;
  const missionsScreenMesh = place(
    holoConsoleGroup,
    cached('missionsBezelScreen', () => new THREE.BoxGeometry(0.90, 0.40, 0.02)),
    M.mfdHelmMat,
    0,
    1.08,
    -0.05,
  );
  missionsScreenMesh.rotation.x = -0.56;

  // Proyector holográfico central conservando orden de hijos [0, 1, 2] esperado por `updateStations`
  const wfMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x9be7ff, wireframe: true }));
  const holoShaderMat = trackMat(
    createHolographicShaderMaterial({
      color: 0x38bdf8,
      accentColor: 0xfbbf24,
      opacity: 0.42,
      scanlineDensity: 38.0,
    }),
  );
  const holoOrbMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x52e0ff,
      transparent: true,
      opacity: 0.72,
    }),
  );

  const holoTableOrb = new THREE.Group();
  holoTableOrb.name = 'BridgeHoloProjector';
  holoTableOrb.position.set(-6.0, f + 1.85, 0);
  parentGroup.add(holoTableOrb);
  place(holoTableOrb, cached('holoIco', () => new THREE.IcosahedronGeometry(0.68, 1)), wfMat, 0, 0, 0);
  place(holoTableOrb, cached('holoSph', () => new THREE.SphereGeometry(0.56, 20, 14)), holoShaderMat, 0, 0, 0);
  const holoOrbit = place(holoTableOrb, torus(0.95, 0.022, 8, 40), holoOrbMat, 0, 0, 0);
  holoOrbit.rotation.x = 1.2;
  holoOrbit.userData.dynamicTransform = true;

  // Portal trasero de popa con marco esculpido y rótulo C01
  [-1, 1].forEach((side) => {
    place(parentGroup, rbox(0.10, 1.38, 5.6, 0.028), M.bridgeCarbonMat, -11.84, f + 1.66, side * 5.85);
    place(parentGroup, rbox(0.03, 1.22, 5.2, 0.01), side < 0 ? M.mfdNeuralMat : M.mfdAstroMat, -11.78, f + 1.66, side * 5.85);
    place(parentGroup, rbox(0.38, 2.86, 0.30, 0.04), M.bridgeRibMat, -11.98, f + 1.43, side * 1.25);
  });
  place(parentGroup, rbox(0.40, 0.30, 2.84, 0.04), M.bridgeRibMat, -11.98, f + 2.82, 0);
  place(parentGroup, rbox(0.08, 2.44, 2.08, 0.02), M.bridgeCarbonMat, -12.06, f + 1.26, 0);
  place(parentGroup, rbox(0.03, 0.038, 1.92, 0.01), M.bridgeWarmCoveMat, -12.01, f + 2.50, 0);
  if (mountDeckPlacard) {
    mountDeckPlacard(
      parentGroup,
      -11.74,
      f + 2.55,
      0,
      Math.PI / 2,
      'C01',
      'PUENTE DE MANDO',
      'NAVEGACIÓN, ÓPTICA Y ENLACE KRONOX',
      '#7bd3f8',
    );
  }

  // =========================================================================
  // 6. ILUMINACIÓN ATMOSFÉRICA LOCAL CALIBRADA (CÁLIDA PROA / FRÍA POPA)
  // =========================================================================
  if (typeof THREE.PointLight === 'function') {
    const bowWarmLight = new THREE.PointLight(0xffdfb8, 1.15, 16, 1.35);
    bowWarmLight.position.set(7.2, f + 2.45, 0);
    parentGroup.add(bowWarmLight);

    const aftCoolLight = new THREE.PointLight(0x6fd8ff, 0.85, 14, 1.45);
    aftCoolLight.position.set(-5.8, f + 2.45, 0);
    parentGroup.add(aftCoolLight);
  }

  return {
    materials: M,
    stationScreenMeshes: {
      windows: winScreenMesh,
      nav: navScreenMesh,
      comms: commsScreenMesh,
      missions: missionsScreenMesh,
    },
    extraConsoleScreens,
    setAnisotropy: (v) => localSuite.setAnisotropy(v),
    updateScreens: (telemetry) => localSuite.updateScreens?.(telemetry),
    dispose: () => {
      extraDisposables.forEach((d) => d?.dispose?.());
      localSuite.dispose();
    },
  };
}
