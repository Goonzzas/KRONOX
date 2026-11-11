import * as THREE from 'three';
// Symbolic morphology only: these volumes are not reconstructions from FITS.
export function makeAtlasGalaxy({ key, type, radius, color, softMap, pointCount = 1600 }) {
  const group = new THREE.Group(),
    description = String(type || '').toLowerCase(),
    elliptical = /spheroid|ellipt|esferoid/.test(description),
    irregular = /irregular/.test(description),
    edgeOn = key === 'm82';
  let seed = Array.from(key).reduce((n, c) => n + c.charCodeAt(0), 31);
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296,
    normal = () => random() + random() + random() - 1.5;
  const positions = [],
    colors = [],
    c = new THREE.Color(color);
  for (let i = 0; i < pointCount; i++) {
    let x, y, z;
    if (elliptical || i < Math.round((pointCount * 220) / 1600)) {
      const r = elliptical ? radius : radius * 0.2;
      x = normal() * r;
      y = normal() * r * (elliptical ? 0.72 : 0.8);
      z = normal() * r * (elliptical ? 0.65 : 0.8);
    } else if (irregular) {
      const cluster = i % 4,
        angle = (cluster * Math.PI) / 2;
      x = (Math.cos(angle) * 0.35 + normal() * 0.38) * radius;
      y = normal() * radius * 0.17;
      z = (Math.sin(angle) * 0.35 + normal() * 0.4) * radius;
    } else {
      const r = radius * Math.sqrt(random()),
        angle = (i % 2) * Math.PI + Math.log(1 + (r / radius) * 10) * 2.1 + (random() - 0.5) * 0.32;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      y = normal() * radius * 0.035;
    }
    positions.push(x, y, z);
    const glow = 0.55 + random() * 0.45;
    colors.push(c.r * glow, c.g * glow, c.b * glow);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  group.add(
    new THREE.Points(
      g,
      new THREE.PointsMaterial({
        vertexColors: true,
        map: softMap,
        size: Math.max(0.07, radius * 0.025),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        alphaTest: 0.02,
      }),
    ),
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#e8d2a5', transparent: true, opacity: 0.58 }),
  );
  core.scale.set(
    radius * (elliptical ? 0.48 : 0.12),
    radius * (elliptical ? 0.34 : 0.09),
    radius * (elliptical ? 0.35 : 0.1),
  );
  group.add(core);
  if (edgeOn) group.rotation.z = 0.35;
  else group.rotation.set(0.2 + (seed % 7) * 0.12, (seed % 19) * 0.2, 0.1);
  group.userData.morphology = elliptical ? 'elliptical' : irregular ? 'irregular' : 'spiral';
  return group;
}
