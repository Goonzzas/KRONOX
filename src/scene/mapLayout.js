import * as THREE from 'three';
export const galaxyMapDistance = (mly) => 140 * Math.log1p(Math.max(0, mly || 0) * 4);
export function galaxyMapPosition(entry) {
  const r = galaxyMapDistance(entry.distanceMly),
    ra = ((entry.raDeg || 0) * Math.PI) / 180,
    dec = ((entry.decDeg || 0) * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(dec) * Math.cos(ra),
    r * Math.sin(dec),
    r * Math.cos(dec) * Math.sin(ra),
  );
}
export function galaxySymbolRadii(entries) {
  const base = {
    'milky-way': 22,
    m31: 25,
    m33: 13,
    m101: 22,
    'ngc-253': 16,
    m81: 16,
    m82: 8,
    lmc: 5,
    smc: 4,
    'sagittarius-dwarf': 3,
    'ngc-6822': 4,
  };
  const galaxies = entries.filter((e) => e.kind !== 'group'),
    positions = new Map(galaxies.map((e) => [e.key, galaxyMapPosition(e)])),
    radii = new Map();
  for (const e of galaxies) {
    let radius = base[e.key] || 8;
    for (const other of galaxies) {
      if (other.key === e.key) continue;
      const d = positions.get(e.key).distanceTo(positions.get(other.key));
      if (d > 0) radius = Math.min(radius, d * 0.28);
    }
    radii.set(e.key, Math.max(0.3, radius));
  }
  return radii;
}
export function fitAtlasCamera(entries, aspect = 1.6) {
  const radii = galaxySymbolRadii(entries),
    objects = entries.filter((e) => e.kind !== 'group'),
    range = Math.max(
      100,
      ...objects.map((e) => galaxyMapPosition(e).length() + (radii.get(e.key) || 1)),
    ),
    distance = range * 2.65;
  let best = null;
  for (const elevation of [20, 35, 50, 65])
    for (let az = 0; az < 360; az += 30) {
      const a = (az * Math.PI) / 180,
        e = (elevation * Math.PI) / 180,
        camera = new THREE.PerspectiveCamera(55, aspect, 0.05, 4e5);
      camera.position.set(
        distance * Math.cos(e) * Math.sin(a),
        distance * Math.sin(e),
        distance * Math.cos(e) * Math.cos(a),
      );
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      const points = objects.map((o) => {
        const p = galaxyMapPosition(o),
          v = p.clone().project(camera);
        return {
          x: v.x * aspect,
          y: v.y,
          r:
            (radii.get(o.key) || 1) /
            camera.position.distanceTo(p) /
            Math.tan((55 * Math.PI) / 360),
        };
      });
      let score = 0;
      for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++) {
          const p = points[i],
            q = points[j],
            gap = Math.hypot(p.x - q.x, p.y - q.y);
          score += Math.max(0, p.r + q.r + 0.035 - gap) ** 2;
        }
      if (!best || score < best.score) best = { score, position: camera.position.toArray(), range };
    }
  return best;
}
export function labelBoxes(
  anchors,
  {
    width = 1280,
    height = 800,
    left = 18,
    right = 340,
    top = 84,
    bottom = 80,
    boxWidth = 180,
    boxHeight = 27,
  } = {},
) {
  const boxes = [],
    result = [];
  for (const item of anchors) {
    if (item.z > 1 || item.z < -1) continue;
    const x = (item.x * 0.5 + 0.5) * width,
      y = (-item.y * 0.5 + 0.5) * height;
    let chosen = null;
    for (const [dx, dy] of [
      [8, -34],
      [8, 8],
      [-boxWidth - 8, -34],
      [-boxWidth - 8, 8],
      [8, -72],
      [-boxWidth - 8, -72],
      [8, 45],
      [-boxWidth - 8, 45],
      [8, -110],
      [8, 82],
    ]) {
      const box = {
        x: Math.min(width - right - boxWidth, Math.max(left, x + dx)),
        y: Math.min(height - bottom - boxHeight, Math.max(top, y + dy)),
        width: boxWidth,
        height: boxHeight,
      };
      if (
        !boxes.some(
          (b) =>
            box.x < b.x + b.width + 4 &&
            box.x + box.width + 4 > b.x &&
            box.y < b.y + b.height + 3 &&
            box.y + box.height + 3 > b.y,
        )
      ) {
        chosen = box;
        break;
      }
    }
    if (chosen) {
      boxes.push(chosen);
      result.push({ ...item, ...chosen, anchorX: x, anchorY: y });
    }
  }
  return result;
}
export function placeAtlasLabels(entries, camera, viewport = {}) {
  camera.updateMatrixWorld(true);
  const anchors = entries.map((e) => {
    const p = e.marker.getWorldPosition(new THREE.Vector3()).project(camera);
    return { ...e, x: p.x, y: p.y, z: p.z };
  });
  const boxes = labelBoxes(anchors, viewport);
  for (const e of entries) {
    e.label.visible = false;
    if (e.leader) e.leader.visible = false;
  }
  for (const box of boxes) {
    const p = new THREE.Vector3(
      ((box.x + box.width / 2) / (viewport.width || 1280)) * 2 - 1,
      1 - ((box.y + box.height / 2) / (viewport.height || 800)) * 2,
      box.z,
    ).unproject(camera);
    box.label.position.copy(box.marker.worldToLocal(p));
    box.label.visible = true;
    box.label.userData.pixelWidth = box.width;
    box.label.userData.pixelHeight = box.height;
    if (box.leader) {
      const a = box.leader.geometry.attributes.position.array;
      a[0] = a[1] = a[2] = 0;
      a[3] = box.label.position.x;
      a[4] = box.label.position.y;
      a[5] = box.label.position.z;
      box.leader.geometry.attributes.position.needsUpdate = true;
      box.leader.visible = true;
    }
  }
}
export function makeLabelLeader() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(
    g,
    new THREE.LineBasicMaterial({
      color: 0x699bb6,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
    }),
  );
}
