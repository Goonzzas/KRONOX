import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createAvionicsRackFrontTexture } from './pbrTexturesAndMaterials.js';
import { createDiegeticScreenDisplay } from '../shipInteriorTextures.js';
import { buildCantileveredWorkbench } from './aerospaceShapes.js';

/**
 * Curved anodized microgravity handrail anchored into bulkheads via 90-degree bent returns
 * and bolted standoff flange plates (replaces plain floating sticks).
 */
export function buildCurvedGrabRail({
  start = [0, 0, 0],
  end = [0, 0, 1],
  standoffDir = [0, 0, 0], // inward standoff away from bulkhead, e.g. [0.09, 0, 0]
  radius = 0.022,
  mat,
  mountMat,
  name = 'MicroG_GrabRail',
}) {
  const s = new THREE.Vector3(...start);
  const e = new THREE.Vector3(...end);
  const dir = new THREE.Vector3().subVectors(e, s);
  const len = dir.length();
  const group = new THREE.Group();
  group.name = name;
  if (len < 0.08) return group;

  const off = new THREE.Vector3(...standoffDir);
  if (off.lengthSq() < 1e-6) {
    // Default small perpendicular offset
    const u = dir.clone().normalize();
    const perp = Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    off.crossVectors(u, perp).normalize().multiplyScalar(0.06);
  }

  const midInset = Math.min(0.14, len * 0.14);
  const uDir = dir.clone().normalize();
  const pts = [
    s.clone(),
    s.clone().add(off).addScaledVector(uDir, midInset * 0.35),
    s.clone().add(off).addScaledVector(uDir, midInset),
    e.clone().add(off).addScaledVector(uDir, -midInset),
    e.clone().add(off).addScaledVector(uDir, -midInset * 0.35),
    e.clone(),
  ];

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.35);
  const tubeGeo = new THREE.TubeGeometry(curve, Math.max(20, Math.round(len * 10)), radius, 10, false);
  const railMesh = new THREE.Mesh(tubeGeo, mat);
  railMesh.name = `${name}_Bar`;
  group.add(railMesh);

  // Standoff flange collars bolted at ends
  [s, e].forEach((pt, idx) => {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 2.1, radius * 2.4, 0.032, 12),
      mountMat || mat,
    );
    collar.position.copy(pt);
    const n = off.clone().normalize();
    if (n.lengthSq() > 0.01) {
      collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    }
    collar.name = `${name}_Flange_${idx}`;
    group.add(collar);
  });

  return group;
}

/**
 * Curved umbilical conduit / instrumentation cable harness connecting consoles or reactors.
 */
export function buildCableConduit(pointsArray, radius = 0.025, mat, name = 'ConduitHarness') {
  const vectors = pointsArray.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(vectors);
  const geo = new THREE.TubeGeometry(curve, Math.max(16, vectors.length * 10), radius, 10, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  return mesh;
}

/**
 * Deck-bolted zero-G Crew Foot Restraint Plate (tactile ribbed shoe platform + U-bar loops).
 */
export function buildFootRestraintPlate(mats, name = 'ZeroG_FootRestraint') {
  const g = new THREE.Group();
  g.name = name;

  const base = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.028, 0.36, 2, 0.008), mats.darkFrame);
  base.position.y = 0.014;
  g.add(base);

  [-0.11, 0.11].forEach((fx) => {
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.016, 0.28, 2, 0.005), mats.workSurface);
    pad.position.set(fx, 0.03, 0);
    g.add(pad);

    // Anodized toe restraint bar arch
    const loopPts = [
      [fx - 0.06, 0.032, -0.05],
      [fx - 0.055, 0.095, -0.05],
      [fx + 0.055, 0.095, -0.05],
      [fx + 0.06, 0.032, -0.05],
    ].map((p) => new THREE.Vector3(...p));
    const loopCurve = new THREE.CatmullRomCurve3(loopPts);
    const strap = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, 14, 0.011, 8, false), mats.grabRail);
    g.add(strap);
  });

  return g;
}

/**
 * Sculpted structural C-profile overhead/side bulkhead arch rib with gusset plates
 * and recessed indirect architectural light cove.
 */
export function buildStructuralArchRib({
  width = 8.4,
  height = 4.6,
  beamDepth = 0.26,
  beamThick = 0.18,
  mats,
  frameMat = null,
  lightMat = null,
  name = 'BulkheadArchRib',
}) {
  const g = new THREE.Group();
  g.name = name;

  const hw = width * 0.5;
  const hh = height;
  const chamfer = 0.72;

  // Inner profile opening path extruded cleanly into an integrated C-arch frame
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, hh - chamfer * 0.6);
  shape.lineTo(-hw + chamfer, hh);
  shape.lineTo(hw - chamfer, hh);
  shape.lineTo(hw, hh - chamfer * 0.6);
  shape.lineTo(hw, 0);
  shape.lineTo(hw - beamThick, 0);
  shape.lineTo(hw - beamThick, hh - chamfer * 0.68);
  shape.lineTo(hw - chamfer * 1.08, hh - beamThick);
  shape.lineTo(-hw + chamfer * 1.08, hh - beamThick);
  shape.lineTo(-hw + beamThick, hh - chamfer * 0.68);
  shape.lineTo(-hw + beamThick, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: beamDepth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.022,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -beamDepth * 0.5);

  const archMesh = new THREE.Mesh(geo, frameMat || mats.anodizedGunmetal || mats.darkFrame);
  archMesh.name = `${name}_Frame`;
  g.add(archMesh);

  // Overhead indirect light diffuser slotted gently inside crown channel
  if (lightMat) {
    const strip = new THREE.Mesh(
      new RoundedBoxGeometry(width - chamfer * 2.5, 0.045, beamDepth * 0.65, 2, 0.012),
      lightMat,
    );
    strip.position.set(0, hh - beamThick - 0.02, 0);
    strip.name = `${name}_CoveLight`;
    g.add(strip);
  }

  return g;
}

/**
 * Grounded Faceted Aerospace Arch Portal Frame for Cylindrical & Semi-Cylindrical Hull Modules.
 * Hugs the pressure wall shell cleanly down into floor deck plinths (replaces floating TorusGeometry hoops).
 */
export function buildCylindricalPortalRib({
  radius = 2.3,
  floorLocalY = -1.55,
  beamWidth = 0.16,
  beamDepth = 0.18,
  segments = 12,
  mats,
  frameMat = null,
  lightMat = null,
  lightWidth = 1.0,
  skipSideFloorDrop = null, // 'port' | 'stbd' | 'both' to clear crosswalk passages
  name = 'CylinderPortalRib',
} = {}) {
  const g = new THREE.Group();
  g.name = name;
  const resolvedMat = frameMat || mats.anodizedGunmetal || mats.darkFrame;

  const yFloor = floorLocalY;
  const chordRatio = Math.max(-0.92, Math.min(-0.1, yFloor / radius));
  const startAngle = Math.asin(chordRatio); // negative angle down at floor level
  const endAngle = Math.PI - startAngle;

  const outerPts = [];
  const innerPts = [];
  const innerR = Math.max(0.4, radius - beamWidth);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ang = startAngle + t * (endAngle - startAngle);
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    outerPts.push(new THREE.Vector2(cosA * radius, Math.max(yFloor, sinA * radius)));
    innerPts.push(new THREE.Vector2(cosA * innerR, Math.max(yFloor, sinA * innerR)));
  }

  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0].x, outerPts[0].y);
  for (let i = 1; i < outerPts.length; i++) {
    shape.lineTo(outerPts[i].x, outerPts[i].y);
  }
  for (let i = innerPts.length - 1; i >= 0; i--) {
    shape.lineTo(innerPts[i].x, innerPts[i].y);
  }
  shape.closePath();

  const ribGeo = new THREE.ExtrudeGeometry(shape, {
    depth: beamDepth,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  ribGeo.translate(0, 0, -beamDepth * 0.5);

  const ribMesh = new THREE.Mesh(ribGeo, resolvedMat);
  ribMesh.name = `${name}_Frame`;
  g.add(ribMesh);

  // Structural gusset plinth shoes bolted flush to floor beams on left/right sides (if clear of doorways)
  [-1, 1].forEach((side) => {
    if (
      skipSideFloorDrop === 'both' ||
      (skipSideFloorDrop === 'port' && side < 0) ||
      (skipSideFloorDrop === 'stbd' && side > 0)
    ) {
      return;
    }
    const footX = side * Math.sqrt(Math.max(0.25, radius * radius - yFloor * yFloor)) - side * (beamWidth * 0.45);
    const gusset = new THREE.Mesh(
      new RoundedBoxGeometry(beamWidth * 1.45, 0.24, beamDepth * 1.32, 2, 0.018),
      resolvedMat,
    );
    gusset.position.set(footX, yFloor + 0.12, 0);
    gusset.name = `${name}_Gusset_${side > 0 ? 'S' : 'P'}`;
    g.add(gusset);
  });

  if (lightMat) {
    const strip = new THREE.Mesh(
      new RoundedBoxGeometry(lightWidth, 0.042, beamDepth * 0.72, 2, 0.012),
      lightMat,
    );
    strip.position.set(0, innerR - 0.03, 0);
    strip.name = `${name}_CrownLight`;
    g.add(strip);
  }

  return g;
}

/**
 * Modular aerospace ISPR / Avionics Wall Rack cabinet with beveled frame, recessed modules,
 * handle bars, and technical faceplate texture.
 */
export function buildModularRackBay({
  width = 1.05,
  height = 2.15,
  depth = 0.56,
  label = 'ISPR RACK',
  accentHex = '#38bdf8',
  mats,
  frameMat = null,
  name = 'ModularRackBay',
}) {
  const g = new THREE.Group();
  g.name = name;
  const resolvedFrame = frameMat || mats.anodizedGunmetal || mats.darkFrame;

  const cabinet = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 3, 0.03),
    resolvedFrame,
  );
  cabinet.position.y = height * 0.5;
  g.add(cabinet);

  // Recessed face cassette
  const faceTex = createAvionicsRackFrontTexture({ label, accent: accentHex });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    roughness: 0.45,
    metalness: 0.35,
  });
  const facePlate = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.86, height * 0.88),
    faceMat,
  );
  facePlate.position.set(0, height * 0.5, depth * 0.5 + 0.004);
  g.add(facePlate);

  // Vertical side grab handle bars bolted on rack front face
  [-width * 0.44, width * 0.44].forEach((hx, idx) => {
    const handle = buildCurvedGrabRail({
      start: [hx, 0.25, depth * 0.5],
      end: [hx, height - 0.25, depth * 0.5],
      standoffDir: [0, 0, 0.045],
      radius: 0.014,
      mat: mats.chromePipe,
      mountMat: resolvedFrame,
      name: `${name}_Handle_${idx}`,
    });
    g.add(handle);
  });

  return g;
}

/**
 * Ergonomic zero-G Crew Restraint Chair with lumbar spine column, beveled seat pan,
 * thigh restraint pads, gimbaled armrests, and floor slide track.
 */
export function buildMicroGCommandSeat(mats, name = 'MicroG_CommandSeat') {
  const chair = new THREE.Group();
  chair.name = name;
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  // Anchored deck slide track
  const track = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.04, 0.68, 2, 0.012), frameMat);
  track.position.y = 0.02;
  chair.add(track);

  // Pneumatic articulated pedestal profile via LatheGeometry
  const pedProfile = [
    new THREE.Vector2(0.0, 0.04),
    new THREE.Vector2(0.2, 0.04),
    new THREE.Vector2(0.16, 0.12),
    new THREE.Vector2(0.095, 0.22),
    new THREE.Vector2(0.085, 0.44),
    new THREE.Vector2(0.14, 0.48),
    new THREE.Vector2(0.0, 0.48),
  ];
  const ped = new THREE.Mesh(new THREE.LatheGeometry(pedProfile, 18), frameMat);
  chair.add(ped);

  // Contoured low-profile micro-G seat pan & low-back lumbar shell (keeps forward sightline unobstructed)
  const seatPan = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.085, 0.48, 3, 0.025), mats.darkSeat);
  seatPan.position.set(0, 0.47, -0.02);
  chair.add(seatPan);

  // Dual lumbar spine struts & sculpted ergonomic backrest (capped cleanly below display sightline)
  const spineBack = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.48, 0.065, 3, 0.018), frameMat);
  spineBack.position.set(0, 0.72, 0.24);
  spineBack.rotation.x = -0.16;
  chair.add(spineBack);

  const backCushion = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.44, 0.075, 3, 0.025), mats.darkSeat);
  backCushion.position.set(0, 0.72, 0.2);
  backCushion.rotation.x = -0.16;
  chair.add(backCushion);

  [-0.22, 0.22].forEach((bx) => {
    const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.36, 0.09, 2, 0.02), mats.habTextileWarm || mats.darkSeat);
    bolster.position.set(bx, 0.71, 0.16);
    bolster.rotation.x = -0.16;
    bolster.rotation.z = bx < 0 ? 0.12 : -0.12;
    chair.add(bolster);
  });

  const neckCollar = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.09, 0.075, 3, 0.025), frameMat);
  neckCollar.position.set(0, 0.96, 0.25);
  neckCollar.rotation.x = -0.08;
  chair.add(neckCollar);

  // Articulated gimbaled armrests with miniature wrist controller bolsters
  [-0.32, 0.32].forEach((ax) => {
    const strut = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.22, 0.09, 2, 0.015), frameMat);
    strut.position.set(ax, 0.58, 0.08);
    const rest = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.055, 0.44, 3, 0.02), mats.darkSeat);
    rest.position.set(ax, 0.7, -0.02);
    chair.add(strut, rest);
  });

  // Microgravity lap/thigh anchor buckle bars
  const lapStrap = buildCurvedGrabRail({
    start: [-0.26, 0.56, -0.18],
    end: [0.26, 0.56, -0.18],
    standoffDir: [0, 0.05, 0],
    radius: 0.012,
    mat: mats.grabRail,
    mountMat: frameMat,
    name: `${name}_ThighRestraint`,
  });
  chair.add(lapStrap);

  return chair;
}

/**
 * Pressurized bulkhead sliding iris doorway with heavy gasket frame, locking handwheel,
 * viewing slit, and discrete status annunciator bar.
 */
export function buildPressurizedBulkheadDoor({
  zPos = 0,
  width = 2.6,
  height = 2.7,
  labelHex = 0x38bdf8,
  mats,
  doorsList = null,
  name = 'PressurizedBulkheadDoor',
}) {
  const frame = new THREE.Group();
  frame.name = name;
  frame.position.set(0, 0, zPos);

  const hw = width * 0.5;
  const hh = height * 0.5;
  const frameT = 0.28;

  // Extruded heavy beveled bulkhead collar around door opening
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-hw - frameT, -hh - 0.1);
  outerShape.lineTo(-hw - frameT, hh + frameT);
  outerShape.lineTo(hw + frameT, hh + frameT);
  outerShape.lineTo(hw + frameT, -hh - 0.1);
  outerShape.closePath();

  const innerHole = new THREE.Path();
  innerHole.moveTo(-hw, -hh);
  innerHole.lineTo(-hw, hh);
  innerHole.lineTo(hw, hh);
  innerHole.lineTo(hw, -hh);
  innerHole.closePath();
  outerShape.holes.push(innerHole);

  const frameMat = mats.anodizedGunmetal || mats.darkFrame;
  const collarGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  collarGeo.translate(0, 0, -0.18);
  const collar = new THREE.Mesh(collarGeo, frameMat);
  frame.add(collar);

  const sill = new THREE.Mesh(new RoundedBoxGeometry(width + 0.5, 0.1, 0.44, 2, 0.02), mats.hazardTrim);
  sill.position.set(0, -hh - 0.02, 0);
  frame.add(sill);

  const statusMat = new THREE.MeshStandardMaterial({
    color: labelHex,
    emissive: labelHex,
    emissiveIntensity: 0.65,
    roughness: 0.3,
  });
  const statusStrip = new THREE.Mesh(
    new RoundedBoxGeometry(width * 0.58, 0.04, 0.42, 2, 0.01),
    statusMat,
  );
  statusStrip.position.set(0, hh + 0.12, 0);
  frame.add(statusStrip);

  const leafW = width * 0.5;
  const makeLeaf = (side) => {
    const leafGroup = new THREE.Group();
    const coreMat = mats.workSurface || mats.bulkhead;
    // Chamfered heavy composite door leaf (matte titanium slate, NOT flat white plastic)
    const panel = new THREE.Mesh(
      new RoundedBoxGeometry(leafW - 0.015, height - 0.06, 0.11, 2, 0.02),
      coreMat,
    );
    leafGroup.add(panel);

    // Upper & lower recessed armor reinforcement plates + diagonal pressure seal ribs
    const lowerPlate = new THREE.Mesh(
      new RoundedBoxGeometry(leafW - 0.12, height * 0.34, 0.13, 2, 0.015),
      frameMat,
    );
    lowerPlate.position.set(0, -height * 0.27, 0);
    const upperHeader = new THREE.Mesh(
      new RoundedBoxGeometry(leafW - 0.12, 0.24, 0.13, 2, 0.012),
      frameMat,
    );
    upperHeader.position.set(0, height * 0.38, 0);
    leafGroup.add(lowerPlate, upperHeader);

    // Armored deep sapphire viewport slit framed in gunmetal casing (proud glazing over dark recess)
    const slitGlassMat = new THREE.MeshStandardMaterial({
      color: 0x091524,
      emissive: 0x0c253f,
      emissiveIntensity: 0.42,
      roughness: 0.08,
      metalness: 0.78,
    });
    const viewWindow = new THREE.Mesh(
      new RoundedBoxGeometry(0.16, 0.56, 0.128, 2, 0.014),
      slitGlassMat,
    );
    viewWindow.position.set(-side * 0.18, 0.34, 0);
    leafGroup.add(viewWindow);

    [-0.1, 0.1].forEach((bx) => {
      const bezelSide = new THREE.Mesh(
        new RoundedBoxGeometry(0.032, 0.62, 0.14, 1, 0.008),
        frameMat,
      );
      bezelSide.position.set(-side * 0.18 + bx, 0.34, 0);
      leafGroup.add(bezelSide);
    });
    [-0.3, 0.3].forEach((by) => {
      const bezelCap = new THREE.Mesh(
        new RoundedBoxGeometry(0.23, 0.035, 0.14, 1, 0.008),
        frameMat,
      );
      bezelCap.position.set(-side * 0.18, 0.34 + by, 0);
      leafGroup.add(bezelCap);
    });

    // Horizontal recessed mechanical lock bar + manual rotary release lever (replaces sticks & donuts)
    [-0.075, 0.075].forEach((zf) => {
      const lockChannel = new THREE.Mesh(
        new RoundedBoxGeometry(leafW * 0.64, 0.11, 0.035, 2, 0.01),
        frameMat,
      );
      lockChannel.position.set(-side * 0.1, -0.06, zf);
      const releaseHandle = new THREE.Mesh(
        new RoundedBoxGeometry(0.24, 0.035, 0.045, 2, 0.012),
        mats.grabRail,
      );
      releaseHandle.position.set(-side * 0.2, -0.06, zf + Math.sign(zf) * 0.022);
      leafGroup.add(lockChannel, releaseHandle);
    });

    // Nose seal rubber gasket strip along meeting center edge
    const gasket = new THREE.Mesh(
      new RoundedBoxGeometry(0.035, height - 0.04, 0.125, 1, 0.006),
      mats.carbonFiber,
    );
    gasket.position.set(-side * (leafW * 0.5 - 0.015), 0, 0);
    leafGroup.add(gasket);

    leafGroup.position.set(side * leafW * 0.5, 0, 0);
    return leafGroup;
  };

  const leafL = makeLeaf(-1);
  const leafR = makeLeaf(1);
  frame.add(leafL, leafR);

  if (Array.isArray(doorsList)) {
    doorsList.push({
      z: zPos,
      x: 0,
      y: 0,
      leafL,
      leafR,
      halfW: leafW,
      openProgress: 0,
      statusMat,
    });
  }

  return frame;
}

/**
 * Shared sculpted scientific/engineering/habitat workstation replacing primitive box desks.
 * Aligns cleanly to `stationDef.consolePos` facing `stationDef.position` and registers screen updates.
 */
export function buildSculptedStationConsole(
  stationDef,
  mats,
  {
    width = 1.65,
    accentHex = '#38bdf8',
    waveformMode = 'orbit',
    style = 'console', // 'console' | 'wallPanel' | 'lectern' | 'pulpit'
    withFootRestraint = true,
    withBeacon = false,
    wallMounted = false,
    frameMat = null,
    topMat = null,
    extraLines = null,
  } = {},
) {
  const group = new THREE.Group();
  group.name = `Station_${stationDef.id}`;
  group.userData = { stationId: stationDef.id, deckLevel: stationDef.deckLevel };
  const floorY = stationDef.position.y;
  const yaw = Math.atan2(
    stationDef.position.x - stationDef.consolePos.x,
    stationDef.position.z - stationDef.consolePos.z,
  );
  group.position.set(stationDef.consolePos.x, floorY, stationDef.consolePos.z);
  group.rotation.y = yaw;

  const resolvedFrameMat = frameMat || mats.anodizedGunmetal || mats.darkFrame;
  const resolvedTopMat = topMat || mats.workSurface;
  const resolvedAccent = typeof accentHex === 'number' ? `#${accentHex.toString(16).padStart(6, '0')}` : accentHex;
  const trimBarMat = new THREE.MeshStandardMaterial({
    color: resolvedAccent,
    emissive: resolvedAccent,
    emissiveIntensity: 0.42,
    roughness: 0.34,
  });

  const disp = createDiegeticScreenDisplay({
    title: stationDef.label.toUpperCase(),
    subtitle: 'EN LÍNEA · PULSA [E] PARA INTERACTUAR',
    lines: extraLines || [
      `UBICACIÓN: ${stationDef.zoneLabel.slice(0, 34)}`,
      `SISTEMA: NOMINAL · CALIBRADO`,
      `CONEXIÓN: BUS DE DATOS 1.00 m`,
    ],
    accent: resolvedAccent,
    waveformMode,
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: disp.texture, toneMapped: false });

  if (style === 'wallPanel') {
    const panelW = Math.min(1.18, width * 0.85);
    const panelH = 0.62;
    const housing = new THREE.Mesh(
      new RoundedBoxGeometry(panelW + 0.14, panelH + 0.28, 0.22, 3, 0.025),
      resolvedFrameMat,
    );
    housing.position.set(0, 1.32, -0.08);
    group.add(housing);

    const visor = new THREE.Mesh(
      new RoundedBoxGeometry(panelW + 0.1, 0.045, 0.26, 2, 0.01),
      resolvedFrameMat,
    );
    visor.position.set(0, 1.66, -0.02);
    group.add(visor);

    const statusStrip = new THREE.Mesh(
      new RoundedBoxGeometry(panelW * 0.72, 0.02, 0.03, 1, 0.005),
      trimBarMat,
    );
    statusStrip.position.set(0, 1.61, 0.045);
    group.add(statusStrip);

    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelH * 0.82), screenMat);
    screenMesh.position.set(0, 1.35, 0.036);
    screenMesh.rotation.x = -0.1;
    group.add(screenMesh);

    const switchShelf = new THREE.Mesh(
      new RoundedBoxGeometry(panelW + 0.06, 0.06, 0.24, 2, 0.014),
      resolvedTopMat,
    );
    switchShelf.position.set(0, 0.96, 0.06);
    switchShelf.rotation.x = 0.25;
    group.add(switchShelf);

    [-panelW * 0.34, 0, panelW * 0.34].forEach((sx) => {
      const toggleBay = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.03, 0.1, 1, 0.006), mats.carbonFiber);
      toggleBay.position.set(sx, 0.99, 0.06);
      toggleBay.rotation.x = 0.25;
      group.add(toggleBay);
    });

    return {
      id: stationDef.id,
      deckLevel: stationDef.deckLevel,
      definition: stationDef,
      group,
      screenMesh,
      trimBarMat,
      floorBeacon: null,
      updateScreen(subtitle, lines, phase = 0) {
        disp.redraw(stationDef.label.toUpperCase(), subtitle, lines, phase);
      },
    };
  }

  const effectiveWallMounted = Boolean(wallMounted);
  const consoleTopY = effectiveWallMounted ? 0.92 : style === 'pulpit' ? 0.94 : 0.84;

  if (style === 'lectern') {
    const pedCol = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.96, 0.22, 3, 0.03), resolvedFrameMat);
    pedCol.position.set(0, 0.48, -0.06);
    pedCol.rotation.x = 0.14;
    const footBase = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.055, 0.52, 2, 0.015), resolvedFrameMat);
    footBase.position.set(0, 0.028, 0);
    const deskPod = new THREE.Mesh(
      new RoundedBoxGeometry(width * 0.85, 0.12, 0.58, 3, 0.025),
      resolvedTopMat,
    );
    deskPod.position.set(0, 0.96, 0.04);
    deskPod.rotation.x = 0.24;
    group.add(pedCol, footBase, deskPod);
  } else if (!effectiveWallMounted) {
    const workbench = buildCantileveredWorkbench({
      width,
      depth: 0.62,
      height: consoleTopY,
      frameMat: resolvedFrameMat,
      topMat: resolvedTopMat,
      trimMat: trimBarMat,
      name: `${stationDef.id}_CantileverChassis`,
    });
    workbench.position.set(0, 0, 0.02);
    group.add(workbench);
  } else {
    const bracket = new THREE.Mesh(
      new RoundedBoxGeometry(width * 0.78, 0.28, 0.36, 3, 0.025),
      resolvedFrameMat,
    );
    bracket.position.set(0, consoleTopY - 0.17, -0.08);
    group.add(bracket);

    const deck = new THREE.Mesh(
      new RoundedBoxGeometry(width + 0.06, 0.064, 0.6, 3, 0.022),
      resolvedTopMat,
    );
    deck.position.set(0, consoleTopY, 0.03);
    group.add(deck);

    const frontTrim = new THREE.Mesh(
      new RoundedBoxGeometry(width * 0.88, 0.014, 0.022, 2, 0.006),
      trimBarMat,
    );
    frontTrim.position.set(0, consoleTopY - 0.022, 0.33);
    group.add(frontTrim);
  }

  if (style !== 'lectern') {
    group.add(
      buildCurvedGrabRail({
        start: [-width * 0.34, consoleTopY - 0.08, 0.32],
        end: [width * 0.34, consoleTopY - 0.08, 0.32],
        standoffDir: [0, 0, 0.055],
        radius: 0.014,
        mat: mats.grabRail,
        mountMat: resolvedFrameMat,
        name: `${stationDef.id}_FrontRail`,
      }),
    );
  }

  // Integrated flush capacitive switch matrix & backlit rocker bank (zero floating desk clutter)
  const deckPadY = style === 'lectern' ? 1.01 : consoleTopY + 0.034;
  const deckPadZ = style === 'lectern' ? 0.14 : 0.15;
  const keyDeck = new THREE.Mesh(
    new RoundedBoxGeometry(Math.min(0.84, width * 0.56), 0.018, 0.2, 2, 0.006),
    mats.carbonFiber,
  );
  keyDeck.position.set(0, deckPadY, deckPadZ);
  if (style === 'lectern') keyDeck.rotation.x = 0.24;
  group.add(keyDeck);

  [-0.22, 0, 0.22].forEach((bx, bi) => {
    const indStrip = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, 0.009, 0.022, 1, 0.003),
      bi === 1 ? trimBarMat : mats.chromePipe,
    );
    indStrip.position.set(bx, deckPadY + 0.011, deckPadZ - 0.045);
    if (style === 'lectern') indStrip.rotation.x = 0.24;
    group.add(indStrip);
  });

  // Integrated Canted Aerospace Display Hood & Armored Monitor Bezel (flush on console deck, NO tall stick arms)
  const screenW = style === 'lectern' ? Math.min(1.08, width * 0.78) : Math.min(1.38, width * 0.82);
  const screenH = style === 'lectern' ? 0.38 : 0.44;
  const screenHolder = new THREE.Group();
  screenHolder.position.set(0, deckPadY + screenH * 0.52, -0.14);
  screenHolder.rotation.x = -0.34;

  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(screenW + 0.09, screenH + 0.09, 0.075, 3, 0.018),
    resolvedFrameMat,
  );
  bezel.position.z = -0.022;
  // Glare shield brow cowling over top & sides of telemetry screen
  const brow = new THREE.Mesh(
    new RoundedBoxGeometry(screenW + 0.11, 0.032, 0.15, 2, 0.008),
    resolvedFrameMat,
  );
  brow.position.set(0, screenH * 0.5 + 0.042, 0.035);
  screenHolder.add(bezel, brow);

  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
  screenMesh.position.z = 0.018;
  screenHolder.add(screenMesh);
  group.add(screenHolder);

  if (withFootRestraint) {
    const footRest = buildFootRestraintPlate(mats, `${stationDef.id}_FootRestraint`);
    footRest.position.set(0, 0, 0.84);
    group.add(footRest);
  }

  let floorBeacon = null;
  if (withBeacon) {
    floorBeacon = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.41, 28),
      new THREE.MeshBasicMaterial({
        color: resolvedAccent,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      }),
    );
    floorBeacon.rotation.x = -Math.PI / 2;
    floorBeacon.position.set(0, 0.018, 1.15);
    group.add(floorBeacon);
  }

  return {
    id: stationDef.id,
    deckLevel: stationDef.deckLevel,
    definition: stationDef,
    group,
    screenMesh,
    trimBarMat,
    floorBeacon,
    updateScreen(subtitle, lines, phase = 0) {
      disp.redraw(stationDef.label.toUpperCase(), subtitle, lines, phase);
    },
  };
}

/**
 * Diegetic sector placard mounted cleanly onto structural headers.
 */
export function buildSectorPlacard({
  code = 'C01',
  title = 'SECTOR',
  accentHex = '#38bdf8',
  width = 1.65,
  height = 0.34,
  mats,
  name = 'SectorPlacard',
}) {
  const holder = new THREE.Group();
  holder.name = name;
  const frame = new THREE.Mesh(
    new RoundedBoxGeometry(width + 0.08, height + 0.08, 0.045, 2, 0.012),
    mats.darkFrame,
  );
  holder.add(frame);

  let tex = null;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas) {
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0c131d';
      ctx.fillRect(0, 0, 512, 112);
      ctx.fillStyle = accentHex;
      ctx.fillRect(0, 0, 14, 112);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 504, 104);
      ctx.font = '700 32px system-ui, Segoe UI, sans-serif';
      ctx.fillStyle = accentHex;
      ctx.fillText(code, 30, 44);
      ctx.font = '600 22px system-ui, Segoe UI, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(title.toUpperCase().slice(0, 32), 30, 82);
      tex = new THREE.CanvasTexture(canvas);
      tex.encoding = THREE.sRGBEncoding;
    }
  }
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    color: tex ? 0xffffff : 0x162232,
    emissive: 0x0b1626,
    emissiveMap: tex || null,
    emissiveIntensity: 0.72,
    roughness: 0.35,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  face.position.z = 0.025;
  holder.add(face);
  return holder;
}


