import * as THREE from 'three';
import { NAVIGATION_CATALOG } from '../data/navigationCatalog.js';
import { propagateCoordinates, SPHEREX_REFERENCE_EPOCH } from '../data/spherexTargets.js';
import { heliocentricMapPosition } from './astronomicalPositions.js';
import { createSceneLabel } from './sceneLabels.js';
import { makeLabelLeader } from './mapLayout.js';

function starColor(temperature) {
  if (!Number.isFinite(temperature)) return new THREE.Color('#d7e5fa');
  const t = Math.max(10, Math.min(400, temperature / 100)),
    r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592),
    g =
      t <= 66
        ? 99.4708025861 * Math.log(t) - 161.1195681661
        : 288.1221695283 * Math.pow(t - 60, -0.0755148492),
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return new THREE.Color(
    Math.max(0, Math.min(255, r)) / 255,
    Math.max(0, Math.min(255, g)) / 255,
    Math.max(0, Math.min(255, b)) / 255,
  );
}
export function contextCatalog(mode, missionTargets = []) {
  const byKey = new Map(NAVIGATION_CATALOG.stars.map((s) => [s.key, s]));
  for (const t of missionTargets.filter(
    (t) => t.type !== 'galaxia' && Number.isFinite(t.distanceLy),
  )) {
    const old = byKey.get(t.key) || {};
    byKey.set(t.key, {
      ...old,
      key: t.key,
      name: t.name,
      ra: t.ra,
      dec: t.dec,
      distancePc:
        t.astrometry?.parallaxMas > 0
          ? 1000 / t.astrometry.parallaxMas
          : t.distanceLy / 3.261563777,
      distanceLy: t.distanceLy,
      missionKey: t.key,
      source: t.astrometry?.reference || old.source,
      sourceTitle: t.astrometry?.source || old.sourceTitle,
      epoch: null,
    });
  }
  return [...byKey.values()]
    .filter((s) =>
      mode === 'stellar' ? s.distancePc <= 10 : s.distancePc > 10 && s.distancePc <= 300,
    )
    .sort((a, b) => a.distancePc - b.distancePc);
}
export function buildStellarAtlas(mode, { softMap, missionTargets = [], orientation } = {}) {
  const group = new THREE.Group();
  group.name =
    mode === 'stellar'
      ? 'Named nearby star systems (0–10 pc)'
      : 'Named regional star systems (10–300 pc)';
  if (orientation) group.quaternion.copy(orientation);
  const units = mode === 'stellar' ? 1200 : 50,
    rangePc = mode === 'stellar' ? 10 : 300,
    entries = contextCatalog(mode, missionTargets),
    markers = new Map(),
    labels = [],
    geometry = new THREE.SphereGeometry(1, 24, 16),
    pickGeometry = new THREE.SphereGeometry(1, 8, 6),
    pickMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  const add = (entry) => {
    const marker = new THREE.Group(),
      color = starColor(entry.temperatureK),
      radius = 2.5 + Math.log10(1 + Math.max(0, entry.radiusSolar || 1)) * 3,
      body = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));
    body.scale.setScalar(radius);
    marker.add(body);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: softMap,
        color,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    );
    halo.scale.set(0.014, 0.014, 1);
    marker.add(halo);
    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.scale.setScalar(100);
    marker.add(pick);
    const label = createSceneLabel(entry.name + ' · ' + entry.distancePc.toFixed(2) + ' pc');
    marker.add(label);
    const leader = makeLabelLeader();
    marker.add(leader);
    let sky = entry;
    if (entry.epoch && Number.isFinite(entry.pmRa) && Number.isFinite(entry.pmDec))
      sky =
        propagateCoordinates(
          {
            raRef: entry.ra,
            decRef: entry.dec,
            epoch: entry.epoch,
            pmRa: entry.pmRa,
            pmDec: entry.pmDec,
            parallaxMas: entry.parallaxMas,
            radialVelocityKms: null,
          },
          SPHEREX_REFERENCE_EPOCH,
        ) || entry;
    const direction = new THREE.Vector3(
      ...heliocentricMapPosition({ ra: sky.ra, dec: sky.dec, distanceLy: 1 }),
    ).normalize();
    marker.position.copy(direction.multiplyScalar(entry.distancePc * units));
    marker.userData = {
      catalogStarKey: entry.key,
      physicalDistancePc: entry.distancePc,
      representation:
        'Radio de visualización comprimido; color orientativo por Teff cuando está documentada',
    };
    marker.traverse((n) => (n.userData.catalogStarKey = entry.key));
    group.add(marker);
    const value = { target: entry, marker, label, leader, body, halo, radius };
    markers.set(entry.key, value);
    labels.push(value);
  };
  add({
    key: 'sun',
    name: 'Sol',
    ra: 0,
    dec: 0,
    distancePc: 0,
    temperatureK: 5772,
    radiusSolar: 1,
    planetCount: 8,
    sourceTitle: 'Sistema Solar',
    source: 'https://science.nasa.gov/sun/',
  });
  for (const entry of entries) add(entry);
  for (const pc of mode === 'stellar' ? [1, 2, 5, 10] : [25, 50, 100, 200, 300]) {
    const vertices = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      vertices.push(Math.cos(a) * pc * units, 0, Math.sin(a) * pc * units);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    group.add(
      new THREE.Line(
        g,
        new THREE.LineBasicMaterial({ color: 0x35748f, transparent: true, opacity: 0.22 }),
      ),
    );
    const label = createSceneLabel(pc + ' pc');
    label.position.set(pc * units, 0, 0);
    label.userData.rangeLabel = true;
    group.add(label);
  }
  group.visible = false;
  return {
    group,
    entries,
    markers,
    labels,
    units,
    rangePc,
    update(camera, selectedKey) {
      for (const e of markers.values()) {
        const distance = camera.position.distanceTo(e.marker.getWorldPosition(new THREE.Vector3()));
        e.body.visible = distance < 500;
        e.pickRadius = 100;
        e.label.visible = false;
      }
      return labels
        .filter((e) => e.target.key === selectedKey)
        .concat(labels.filter((e) => e.target.key !== selectedKey).slice(0, 24));
    },
  };
}
