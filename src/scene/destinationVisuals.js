import { makeAtlasGalaxy } from './galaxyVisuals.js';
import * as THREE from 'three';
// Scene sizes/colors are illustrative. No infrared image is treated as a 3D density map.
export const VISUAL_BUDGET = {
  galaxyPoints: 256,
  sphereWidth: 24,
  sphereHeight: 16,
  textureSize: 256,
  detailDistance: 80,
  starClearance: 1.3,
  galaxyClearance: 9,
};
export function createDestinationResources(documentRef = document) {
  const owned = new Set(),
    surfaceCache = new Map();
  const own = (o) => (owned.add(o), o);
  const sphere = own(
    new THREE.SphereGeometry(1, VISUAL_BUDGET.sphereWidth, VISUAL_BUDGET.sphereHeight),
  );
  const disk = own(new THREE.CircleGeometry(1, 48));
  function texture(kind, color) {
    const key = kind + color;
    if (surfaceCache.has(key)) return surfaceCache.get(key);
    const c = documentRef.createElement('canvas');
    c.width = c.height = kind === 'particle' ? 128 : VISUAL_BUDGET.textureSize;
    const ctx = c.getContext('2d'),
      n = c.width;
    if (kind === 'particle') {
      const gradient = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.2, 'rgba(255,255,255,.7)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, n, n);
    } else if (kind.startsWith('galaxy')) {
      ctx.clearRect(0, 0, n, n);
      ctx.save();
      ctx.translate(n / 2, n / 2);
      for (let arm = 0; arm < (kind === 'galaxy-elliptical' ? 0 : 2); arm++) {
        for (let i = 0; i < (kind === 'galaxy-irregular' ? 40 : 150); i++) {
          const r = 2 + i * 0.35,
            angle = kind === 'galaxy-irregular' ? i * 2.399 : arm * Math.PI + Math.log(1 + r) * 1.3;
          const g = ctx.createRadialGradient(
            Math.cos(angle) * r,
            Math.sin(angle) * r,
            0,
            Math.cos(angle) * r,
            Math.sin(angle) * r,
            12,
          );
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.11;
          ctx.fillStyle = g;
          ctx.fillRect(Math.cos(angle) * r - 12, Math.sin(angle) * r - 12, 24, 24);
        }
      }
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
      core.addColorStop(0, '#fff2d1');
      core.addColorStop(0.2, 'rgba(235,191,134,.8)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = core;
      ctx.fillRect(-128, -128, 256, 256);
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, n, n);
      for (let i = 0; i < 90; i++) {
        const x = (i * 71.17) % n,
          y = (i * 39.61) % n,
          g = ctx.createRadialGradient(x, y, 0, x, y, 8 + (i % 7));
        g.addColorStop(0, 'rgba(255,225,165,.16)');
        g.addColorStop(1, 'rgba(90,30,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, n, n);
      }
    }
    const t = own(new THREE.CanvasTexture(c));
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.encoding = THREE.sRGBEncoding;
    surfaceCache.set(key, t);
    return t;
  }
  const softMap = texture('particle', '#ffffff');
  function build(target) {
    const galaxy = target.type === 'galaxia',
      color = galaxy ? '#b3c8e3' : target.key === 'barnard' ? '#d87a54' : '#efbc87',
      radius = galaxy ? 3 : 0.24;
    const marker = new THREE.Group(),
      detail = new THREE.Group();
    let built = false,
      oriented = false;
    const halo = new THREE.Sprite(
      own(
        new THREE.SpriteMaterial({
          map: softMap,
          color,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    halo.scale.setScalar(radius * 3.6);
    marker.add(halo);
    marker.add(detail);
    marker.userData = {
      spherexTargetKey: target.key,
      inspectionClearance: galaxy ? VISUAL_BUDGET.galaxyClearance : VISUAL_BUDGET.starClearance,
      representation:
        'ILUSTRACIÓN 3D; escala, espesor, color y detalle inferidos no son observaciones',
      physicalParameters: { temperatureK: null, radiusSolar: null },
      orientation: 'Fija para permitir orbitar el volumen; posición angular y espesor ilustrativos',
      morphology: target.morphology || null,
    };
    function ensureDetail() {
      if (built) return;
      built = true;
      if (galaxy) {
        const volume = makeAtlasGalaxy({
          key: target.key,
          type: target.morphology || 'spiral',
          radius,
          pointCount: VISUAL_BUDGET.galaxyPoints,
          color,
          softMap,
        });
        volume.traverse((node) => {
          if (node.geometry) own(node.geometry);
          for (const material of Array.isArray(node.material)
            ? node.material
            : node.material
              ? [node.material]
              : [])
            own(material);
        });
        detail.add(volume);
      } else {
        const surface = new THREE.Mesh(
          sphere,
          own(new THREE.MeshBasicMaterial({ map: texture('surface', color) })),
        );
        surface.scale.setScalar(radius);
        detail.add(surface);
      }
    }
    const world = new THREE.Vector3();
    return {
      marker,
      ensureDetail,
      update(camera) {
        const distance = camera.position.distanceTo(marker.getWorldPosition(world));
        if (distance < VISUAL_BUDGET.detailDistance) ensureDetail();
        detail.visible = distance < VISUAL_BUDGET.detailDistance;
        if (galaxy && detail.visible && !oriented) {
          detail.lookAt(new THREE.Vector3(0, 0, 0));
          detail.rotateY(
            target.key === 'm31' ? (77 * Math.PI) / 180 : target.key === 'm101' ? 0 : 0.6,
          );
          detail.rotateZ(-0.35);
          oriented = true;
        }
        halo.material.opacity = distance < radius * 6 ? 0.16 : 0.38;
      },
      get detailBuilt() {
        return built;
      },
      get radius() {
        return radius;
      },
    };
  }
  return {
    build,
    softMap,
    dispose(disposed = new Set()) {
      for (const item of owned)
        if (!disposed.has(item)) {
          item.dispose?.();
          disposed.add(item);
        }
      owned.clear();
      surfaceCache.clear();
    },
    budget: VISUAL_BUDGET,
  };
}
export function summarizeFrameTimes(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b),
    mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    samples: s.length,
    meanFrameMs: mean,
    p50Ms: s[Math.floor(s.length * 0.5)],
    p95Ms: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
    fps: 1000 / mean,
  };
}
