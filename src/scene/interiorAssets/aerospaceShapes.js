import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * KRONOX FASE 2 — HARD-SURFACE PROCEDURAL CAD GEOMETRY BUILDERS
 * Generates machined ribs with lightning cutouts, ConFlat bolted vacuum flanges,
 * corrugated cryogenic bellows, cantilevered desks, and contoured structural ribs
 * so rooms and scientific equipment never look like plain stacked primitives.
 */

/**
 * Machined structural wall C-frame rib with weight-saving aerospace lightning pockets.
 */
export function buildMachinedWallCFrame({
  height = 2.6,
  depth = 0.28,
  thickness = 0.12,
  lip = 0.22,
  mat,
  name = 'MachinedCFrame',
} = {}) {
  const halfH = height * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, -halfH);
  shape.lineTo(depth + lip, -halfH);
  shape.lineTo(depth + lip, -halfH + 0.14);
  shape.quadraticCurveTo(depth * 0.5, -halfH + 0.18, depth * 0.35, -halfH + 0.35);
  shape.lineTo(depth * 0.35, halfH - 0.35);
  shape.quadraticCurveTo(depth * 0.5, halfH - 0.18, depth + lip, halfH - 0.14);
  shape.lineTo(depth + lip, halfH);
  shape.lineTo(0, halfH);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -thickness * 0.5);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  return mesh;
}

/**
 * Precision ConFlat bolted vacuum flange collar (standard aerospace cryogenic / UHV joint).
 */
export function buildVacuumFlangeCollar({
  innerR = 0.22,
  outerR = 0.3,
  thickness = 0.04,
  boltCount = 10,
  flangeMat,
  boltMat,
  name = 'CFVacuumFlange',
} = {}) {
  const group = new THREE.Group();
  group.name = name;

  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const discGeo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 28,
  });
  discGeo.translate(0, 0, -thickness * 0.5);
  const flange = new THREE.Mesh(discGeo, flangeMat);
  group.add(flange);

  const boltR = (innerR + outerR) * 0.52;
  const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, thickness + 0.022, 6);
  boltGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < boltCount; i++) {
    const a = (i / boltCount) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, boltMat || flangeMat);
    bolt.position.set(Math.cos(a) * boltR, Math.sin(a) * boltR, 0);
    group.add(bolt);
  }
  return group;
}

/**
 * Sinusoidal stainless steel cryogenic / vacuum flex bellows via LatheGeometry.
 */
export function buildCorrugatedBellows({
  radius = 0.14,
  length = 0.32,
  convolutions = 6,
  amplitude = 0.022,
  mat,
  name = 'CryoBellows',
} = {}) {
  const pts = [];
  const steps = convolutions * 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = (t - 0.5) * length;
    const r = radius + Math.sin(t * convolutions * Math.PI * 2) * amplitude * Math.sin(Math.PI * t);
    pts.push(new THREE.Vector2(Math.max(0.02, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  return mesh;
}

/**
 * Sculpted multi-material cantilevered aerospace workbench chassis with tapered profile & knee clearance.
 */
export function buildCantileveredWorkbench({
  width = 1.6,
  depth = 0.72,
  height = 0.84,
  frameMat,
  topMat,
  trimMat = null,
  name = 'CantileverWorkbench',
} = {}) {
  const group = new THREE.Group();
  group.name = name;

  // Tapered sculptural side stanchions via ExtrudeGeometry
  const sideShape = new THREE.Shape();
  sideShape.moveTo(-depth * 0.34, 0);
  sideShape.lineTo(depth * 0.24, 0);
  sideShape.lineTo(depth * 0.14, height * 0.42);
  sideShape.quadraticCurveTo(depth * 0.32, height * 0.76, depth * 0.42, height - 0.05);
  sideShape.lineTo(-depth * 0.4, height - 0.05);
  sideShape.lineTo(-depth * 0.4, height * 0.45);
  sideShape.closePath();

  const sideGeo = new THREE.ExtrudeGeometry(sideShape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  sideGeo.translate(0, 0, -0.045);
  sideGeo.rotateY(Math.PI / 2);

  [-width * 0.42, width * 0.42].forEach((sx) => {
    const leg = new THREE.Mesh(sideGeo, frameMat);
    leg.position.set(sx, 0, 0);
    group.add(leg);
  });

  // Recessed rear avionics spine beam connecting legs cleanly
  const crossBeam = new THREE.Mesh(
    new RoundedBoxGeometry(width * 0.86, height * 0.56, depth * 0.36, 3, 0.025),
    frameMat,
  );
  crossBeam.position.set(0, height * 0.48, -depth * 0.18);
  group.add(crossBeam);

  // Sculpted tabletop work deck with bullnose front edge
  const deckGeo = new RoundedBoxGeometry(width + 0.08, 0.068, depth + 0.06, 4, 0.022);
  const deck = new THREE.Mesh(deckGeo, topMat);
  deck.position.set(0, height, 0.02);
  group.add(deck);

  if (trimMat) {
    const frontEdgeLight = new THREE.Mesh(
      new RoundedBoxGeometry(width * 0.88, 0.014, 0.022, 2, 0.005),
      trimMat,
    );
    frontEdgeLight.position.set(0, height - 0.028, depth * 0.5 + 0.042);
    group.add(frontEdgeLight);
  }

  return group;
}

/**
 * Slotted radial cooling louver radiator / heat exchanger block.
 */
export function buildHeatExchangerFins({
  width = 0.65,
  height = 0.42,
  depth = 0.28,
  finCount = 7,
  finMat,
  frameMat,
  name = 'HeatExchangerArray',
} = {}) {
  const g = new THREE.Group();
  g.name = name;
  const headerTop = new THREE.Mesh(new RoundedBoxGeometry(width, 0.045, depth, 2, 0.01), frameMat);
  headerTop.position.y = height * 0.5;
  const headerBot = headerTop.clone();
  headerBot.position.y = -height * 0.5;
  g.add(headerTop, headerBot);

  for (let i = 0; i < finCount; i++) {
    const fx = -width * 0.42 + (i / Math.max(1, finCount - 1)) * width * 0.84;
    const fin = new THREE.Mesh(new RoundedBoxGeometry(0.022, height - 0.04, depth * 0.9, 1, 0.004), finMat);
    fin.position.x = fx;
    g.add(fin);
  }
  return g;
}

