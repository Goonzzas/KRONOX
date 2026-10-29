import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { P, D2R, TAU, T0, kep, pos } from '../data/planetData.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';

// The Milky Way view compresses the solar neighborhood into a tiny pixel.
// The global Milky Way view compresses nearby stars into an indistinguishable
// dot. Exaggerate only the inner 25 light-years; preserve distant targets'
// placement by letting the expansion become a fixed offset beyond that zone.
const GALACTIC_MAP_UNITS_PER_LIGHT_YEAR = 3;
const LOCAL_NEIGHBORHOOD_EXTRA_UNITS_PER_LIGHT_YEAR = 9;
const LOCAL_NEIGHBORHOOD_RADIUS_LY = 25;

function visualDistanceInMapUnits(distanceLy) {
  return (
    distanceLy * GALACTIC_MAP_UNITS_PER_LIGHT_YEAR +
    Math.min(distanceLy, LOCAL_NEIGHBORHOOD_RADIUS_LY) *
      LOCAL_NEIGHBORHOOD_EXTRA_UNITS_PER_LIGHT_YEAR
  );
}

function localGalacticPosition(target) {
  const ra = (target.ra * Math.PI) / 180;
  const dec = (target.dec * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  const towardCenter =
    -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z;
  const towardLongitude90 =
    0.4941094279 * x - 0.4448296300 * y + 0.7469822445 * z;
  const north = -0.8676661490 * x - 0.1980763734 * y + 0.4559837762 * z;
  // Put the Sun at the map's existing Orion-arm marker, then offset each
  // named star by its approximate heliocentric distance (the map uses ly).
  // Directions remain based on the real coordinates. The nearby-neighborhood
  // expansion is a cartographic aid, not a claim about literal map scale.
  const distance = visualDistanceInMapUnits(target.distanceLy);
  return new THREE.Vector3(
    24500 + distance * (-0.989 * towardCenter + 0.141 * towardLongitude90),
    distance * north,
    -3500 + distance * (0.141 * towardCenter + 0.989 * towardLongitude90),
  );
}

function lab(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.font = '30px Segoe UI, sans-serif';
  context.textAlign = 'center';
  context.fillStyle = '#fff';
  context.shadowColor = '#000';
  context.shadowBlur = 6;
  context.fillText(text, 256, 40);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
      transparent: true,
      sizeAttenuation: false,
    }),
  );
  sprite.scale.set(0.4, 0.05, 1);
  sprite.center.set(0.5, -0.3);
  sprite.renderOrder = 9;
  return sprite;
}

const hs = (a, b, Q) => {
  const s = Math.sin((((a % Q) + Q) % Q) * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vn(x, y, Q) {
  const i = Math.floor(x),
    j = Math.floor(y),
    fx = x - i,
    fy = y - j,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy),
    a = hs(i, j, Q),
    b = hs(i + 1, j, Q),
    c = hs(i, j + 1, Q),
    d = hs(i + 1, j + 1, Q);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(u, v, f) {
  let s = 0,
    a = 0.5,
    k = f;
  for (let o = 0; o < 5; o++) {
    s += a * vn(u * k, (v * k) / 2, k);
    k *= 2;
    a /= 2;
  }
  return s / 0.97;
}
const mix = (a, b, t) => a.map((q, i) => q + (b[i] - q) * t);
function tex(p) {
  const W = 512,
    H = 256,
    cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d'),
    im = g.createImageData(W, H),
    d = im.data;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const u = i / W,
        v = j / H;
      let c;
      if (p.t == 'sun') {
        const n = fbm(u, v, 10);
        c = [255, 170 + n * 85, 40 + n * 90];
      } else if (p.t == 'rock') {
        const k = 0.5 + 0.7 * fbm(u, v, 8);
        c = p.c.map((q) => q * k);
      } else if (p.t == 'venus') {
        const k = 0.8 + 0.4 * fbm(u + 0.2 * fbm(u, v, 3), v, 4);
        c = p.c.map((q) => q * k);
      } else if (p.t == 'earth') {
        const n = fbm(u, v, 4),
          la = Math.abs(v - 0.5) * 2;
        if (la > 0.88 + 0.05 * n) c = [240, 245, 250];
        else if (n > 0.52) c = [40 + (n - 0.5) * 330, 115 + (0.7 - n) * 120, 50];
        else c = [15, 55 + n * 90, 150 + n * 70];
        const m = fbm(u + 0.3, v, 6);
        if (m > 0.58) c = mix(c, [255, 255, 255], Math.min(0.85, (m - 0.58) * 4));
      } else {
        const f = (Math.sin(v * TAU * 5 + 4 * fbm(u, v, 3)) * 0.5 + 0.5) * 3,
          k = Math.min(2, Math.floor(f));
        c = mix(p.c[k], p.c[k + 1], f - k);
        const s = 0.9 + 0.2 * fbm(u, v, 12);
        c = c.map((q) => q * s);
      }
      const o = (j * W + i) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  if (p.t == 'rock')
    for (let k = 0; k < 70; k++) {
      const x = Math.random() * W,
        y = Math.random() * H,
        r = 2 + Math.random() * Math.random() * 16;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fillStyle = 'rgba(0,0,0,.16)';
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.14)';
      g.lineWidth = 1.2;
      g.stroke();
    }
  return new THREE.CanvasTexture(cv);
}
const gs = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
function pts(pos, col, size, op) {
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  G.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  return new THREE.Points(
    G,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}
export function setupScene(el, S) {
  const R = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  R.setPixelRatio(Math.min(2, devicePixelRatio));
  R.setSize(innerWidth, innerHeight);
  el.appendChild(R.domElement);
  const sc = new THREE.Scene(),
    cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.0005, 4e5),
    ct = new OrbitControls(cam, R.domElement);
  let rafId = 0,
    disposed = false;
  ct.enableDamping = true;
  ct.dampingFactor = 0.07;
  ct.maxDistance = 3e5;
  ct.minDistance = 0.0005;
  sc.add(new THREE.AmbientLight(0xffffff, 0.1));
  sc.add(new THREE.PointLight(0xfff2dd, 1.7, 0, 0));
  // estrellas
  let a = [],
    c = [];
  for (let i = 0; i < 12000; i++) {
    const v = new THREE.Vector3(gs(), gs(), gs()).normalize().multiplyScalar(2e5),
      t = Math.random();
    a.push(v.x, v.y, v.z);
    const b = 0.5 + 0.5 * Math.random();
    c.push(b * (0.8 + 0.2 * t), b * 0.9, b * (1 - 0.2 * t));
  }
  sc.add(pts(a, c, 1.5, 0.9));
  // polvo estelar cercano
  a = [];
  c = [];
  for (let i = 0; i < 9000; i++) {
    const v = new THREE.Vector3(gs(), gs() * 0.5, gs()).multiplyScalar(900);
    a.push(v.x, v.y, v.z);
    c.push(0.5 + Math.random() * 0.4, 0.55 + Math.random() * 0.2, 0.8);
  }
  sc.add(pts(a, c, 1, 0.35));
  const LB = [];
  const gal = new THREE.Group(),
    RG = 22500,
    GU = {
      uT: { value: 0 },
      uP: { value: 0 },
      uH: { value: (innerHeight * R.getPixelRatio()) / 1.04 },
    };
  const VS = `#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uT,uP,uH,uS;attribute vec3 col;attribute float aR,aZ;varying vec3 vC;
void main(){float w=uP+uT*(22500./max(aR,6000.)-1.);float c=cos(w),s=sin(w);vec3 p=vec3(position.x*c-position.z*s,position.y,position.x*s+position.z*c);vC=col;
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aZ>0.?min(aZ*uH/max(-mv.z,1.),420.):uS;
#include <logdepthbuf_vertex>
}`,
    FS = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uO;varying vec3 vC;
void main(){
#include <logdepthbuf_fragment>
float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(vC,pow(1.-d,2.)*uO);}`;
  const gp = (P, C, Rr, Z, s, o) => {
    const G = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    G.setAttribute('col', new THREE.Float32BufferAttribute(C, 3));
    G.setAttribute('aR', new THREE.Float32BufferAttribute(Rr, 1));
    G.setAttribute('aZ', new THREE.Float32BufferAttribute(Z, 1));
    const m = new THREE.Points(
      G,
      new THREE.ShaderMaterial({
        uniforms: { uT: GU.uT, uP: GU.uP, uH: GU.uH, uS: { value: s }, uO: { value: o } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: VS,
        fragmentShader: FS,
        extensions: { fragDepth: true },
      }),
    );
    m.frustumCulled = false;
    return m;
  };
  // brazos espirales logarítmicos (pitch ~17°), trailing, saliendo de los extremos de la barra
  const arm = (r, k) => 0.739 + (k * TAU) / 4 - Math.log(r / 9000) / 0.3;
  a = [];
  c = [];
  let Rr = [],
    Z = [];
  for (let i = 0; i < 60000; i++) {
    let x,
      y,
      z,
      col,
      rr = RG;
    if (i < 9000) {
      const u = gs() * (i % 3 ? 9000 : 5000),
        w = gs() * (i % 3 ? 1800 : 5000);
      x = u * 0.89 - w * 0.45;
      z = u * 0.45 + w * 0.89;
      y = gs() * (i % 3 ? 900 : 2500);
      col = [1, 0.85, 0.6];
    } else if (i < 16000) {
      const r = 3000 + Math.random() * 10000,
        an = Math.random() * TAU;
      x = Math.cos(an) * r;
      z = Math.sin(an) * r;
      y = gs() * 500;
      rr = r;
      col = [1, 0.82, 0.58];
    } else {
      const r = 9000 + Math.pow(Math.random(), 0.8) * 36000,
        k = i % 4,
        an = arm(r, k) + gs() * (0.34 + 0.1 * (k % 2)),
        t = r / 45000;
      x = Math.cos(an) * r + gs() * 2800;
      z = Math.sin(an) * r + gs() * 2800;
      y = gs() * 600 * (1 - t * 0.5);
      rr = Math.hypot(x, z);
      col = Math.random() < 0.05 ? [1, 0.45, 0.7] : mix([1, 0.8, 0.6], [0.45, 0.6, 1], t);
    }
    a.push(x, y, z);
    const b = 0.35 + 0.65 * Math.random();
    c.push(col[0] * b, col[1] * b, col[2] * b);
    Rr.push(rr);
    Z.push(0);
  }
  gal.add(gp(a, c, Rr, Z, 2.2, 1));
  // nebulosas: nubes de gas (rosa/azul/violeta/ámbar) a lo largo de los brazos, spur de Orión y brillo del núcleo
  a = [];
  c = [];
  Rr = [];
  Z = [];
  const NC = [
      [1, 0.35, 0.6],
      [0.35, 0.55, 1],
      [0.7, 0.4, 0.95],
      [1, 0.65, 0.35],
    ],
    nc = () => NC[(Math.random() * 4) | 0];
  for (let i = 0; i < 2600; i++) {
    const r = 9000 + Math.random() * 36000,
      an = arm(r, i % 4) + gs() * 0.38,
      cl = nc(),
      x = Math.cos(an) * r + gs() * 3500,
      z = Math.sin(an) * r + gs() * 3500;
    a.push(x, gs() * 500, z);
    c.push(...cl);
    Rr.push(Math.hypot(x, z));
    Z.push(1500 + Math.random() * 3500);
  }
  for (let i = 0; i < 220; i++) {
    const q = gs() * 5000;
    a.push(RG + q * 0.25 + gs() * 1500, gs() * 200, q + gs() * 1500);
    c.push(...nc());
    Rr.push(RG);
    Z.push(200 + Math.random() * 700);
  }
  for (let i = 0; i < 60; i++) {
    const r = Math.random() * 4500,
      an = Math.random() * TAU;
    a.push(Math.cos(an) * r, gs() * 600, Math.sin(an) * r);
    c.push(1, 0.7, 0.4);
    Rr.push(RG);
    Z.push(3000 + Math.random() * 5000);
  }
  gal.add(gp(a, c, Rr, Z, 0, 0.08));
  a = [];
  c = [];
  Rr = [];
  Z = [];
  for (let i = 0; i < 30000; i++) {
    const r = 3000 + Math.pow(Math.random(), 0.75) * 43000,
      an = Math.random() * TAU,
      t = r / 46000,
      b = 0.15 + 0.4 * Math.random(),
      cl = mix([1, 0.8, 0.6], [0.5, 0.65, 1], t);
    a.push(Math.cos(an) * r, gs() * 500 * (1 - t * 0.5), Math.sin(an) * r);
    c.push(cl[0] * b, cl[1] * b, cl[2] * b);
    Rr.push(r);
    Z.push(0);
  }
  gal.add(gp(a, c, Rr, Z, 1.6, 0.9));
  a = [];
  c = [];
  Rr = [];
  Z = [];
  for (let i = 0; i < 1400; i++) {
    const r = 4000 + Math.random() * 41000,
      an = Math.random() * TAU,
      cl = nc(),
      x = Math.cos(an) * r,
      z = Math.sin(an) * r;
    a.push(x, gs() * 400, z);
    c.push(cl[0] * 0.6, cl[1] * 0.6, cl[2] * 0.7);
    Rr.push(r);
    Z.push(2500 + Math.random() * 4000);
  }
  gal.add(gp(a, c, Rr, Z, 0, 0.05));
  a = [];
  c = [];
  Rr = [];
  Z = [];
  for (let i = 0; i < 900; i++) {
    const q = gs() * 4500;
    a.push(RG + q * 0.25 + gs() * 250, gs() * 80, q + gs() * 250);
    c.push(0.4, 0.9, 1);
    Rr.push(RG);
    Z.push(0);
  }
  gal.add(gp(a, c, Rr, Z, 3, 1));
  {
    const q = [];
    for (let i = 0; i < 256; i++)
      q.push(Math.cos((i / 256) * TAU) * 22500, 0, -Math.sin((i / 256) * TAU) * 22500);
    gal.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(q, 3)),
        new THREE.LineBasicMaterial({ color: 0xf2b45a, transparent: true, opacity: 0.6 }),
      ),
    );
  }
  {
    const q = (t, x, z) => {
      const l = lab(t);
      l.position.set(x, 0, z);
      gal.add(l);
      LB.push(l);
    };
    q('Centro galáctico (barra)', 0, 0);
    q('Brazo de Orión · Sol', 24500, -3500);
    q('Órbita aproximada del Sol', 0, -23500);
  }
  gal.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0.0642, 0.0976, -0.9929),
      new THREE.Vector3(-0.868, 0.497, 0),
      new THREE.Vector3(0.4935, 0.8618, 0.1166),
    ),
  );
  sc.add(gal);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(64, 64, 2, 64, 64, 64);
  glowGradient.addColorStop(0, 'rgba(255,255,255,1)');
  glowGradient.addColorStop(0.12, 'rgba(255,255,255,.72)');
  glowGradient.addColorStop(0.38, 'rgba(255,255,255,.18)');
  glowGradient.addColorStop(1, 'rgba(255,255,255,0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 128, 128);
  const missionGlowMap = new THREE.CanvasTexture(glowCanvas);
  const missionMarkers = new Map();
  SPHEREX_TARGETS.forEach((target) => {
    const color = target.mission === 'motion' ? 0x73eaff : 0xffbd72;
    const marker = new THREE.Group();
    marker.position.copy(localGalacticPosition(target));
    // A quiet, softly scattered dust pocket gives the destination a sense of
    // place without obscuring the neighboring stars or the navigation marker.
    const dustPositions = [];
    const dustColors = [];
    const baseColor = new THREE.Color(color);
    for (let i = 0; i < 280; i++) {
      const angle = Math.random() * TAU;
      const radius = 12 + Math.random() ** 1.7 * 44;
      dustPositions.push(
        Math.cos(angle) * radius,
        gs() * radius * 0.36,
        Math.sin(angle) * radius,
      );
      const tint = 0.35 + Math.random() * 0.6;
      dustColors.push(baseColor.r * tint, baseColor.g * tint, baseColor.b * tint);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        size: 5.5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    marker.add(dust);
    const nebula = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: missionGlowMap,
        color,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    nebula.scale.set(100, 62, 1);
    marker.add(nebula);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: missionGlowMap,
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.scale.set(24, 24, 1);
    marker.add(glow);
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xf5fbff }),
    );
    marker.add(star);
    const starGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: missionGlowMap,
        color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    starGlow.scale.set(15, 15, 1);
    marker.add(starGlow);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.28, 6, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 }),
    );
    ring.rotation.x = Math.PI / 2;
    marker.add(ring);
    const label = lab(target.name);
    label.position.set(0, 10, 0);
    label.visible = false;
    marker.add(label);
    LB.push(label);
    gal.add(marker);
    missionMarkers.set(target.key, { target, marker, label });
  });
  // cuerpos
  const B = [];
  let earth;
  P.forEach((p) => {
    const pivot = new THREE.Group(),
      tilt = new THREE.Group(),
      mat = p.sun
        ? new THREE.MeshBasicMaterial({ map: tex(p) })
        : new THREE.MeshStandardMaterial({ map: tex(p), roughness: 1, metalness: 0 }),
      spin = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
    tilt.rotation.z = ((p.tilt || 0) * Math.PI) / 180;
    tilt.add(spin);
    pivot.add(tilt);
    sc.add(pivot);
    const b = { p, pivot, tilt, spin };
    if (p.ring) {
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 1;
      const g = cv.getContext('2d');
      for (let i = 0; i < 256; i++) {
        const k = 0.5 + 0.5 * Math.sin(i * 0.35) * Math.sin(i * 0.09);
        g.fillStyle = `rgba(215,195,150,${(i > 20 && i < 230 ? 0.35 + 0.5 * k : 0) * (i > 110 && i < 122 ? 0.1 : 1)})`;
        g.fillRect(i, 0, 1, 1);
      }
      const rg = new THREE.RingGeometry(1.25, 2.4, 128),
        uv = rg.attributes.uv,
        ps = rg.attributes.position;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, (Math.hypot(ps.getX(i), ps.getY(i)) - 1.25) / 1.15, 0.5);
      const rm = new THREE.Mesh(
        rg,
        new THREE.MeshBasicMaterial({
          map: new THREE.CanvasTexture(cv),
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      rm.rotation.x = Math.PI / 2;
      tilt.add(rm);
    }
    if (p.au) {
      const pp = [];
      for (let k = 0; k < 256; k++) {
        const v = kep(p, (k / 256) * TAU);
        pp.push(v.x, v.y, v.z);
      }
      const G = new THREE.BufferGeometry();
      G.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      b.orbit = new THREE.LineLoop(
        G,
        new THREE.LineBasicMaterial({ color: 0x5a7090, transparent: true, opacity: 0.5 }),
      );
      sc.add(b.orbit);
    }
    if (p.sun) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d'),
        gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,220,140,1)');
      gr.addColorStop(0.25, 'rgba(255,170,60,.45)');
      gr.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      b.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(cv),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sc.add(b.glow);
    }
    b.lab = lab(p.n);
    pivot.add(b.lab);
    LB.push(b.lab);
    b.ax = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -2, 0),
        new THREE.Vector3(0, 2, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0xff5577 }),
    );
    tilt.add(b.ax);
    if (p.au || p.moon) {
      b.ar = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x55ff99);
      pivot.add(b.ar);
    }
    if (p.n == 'Tierra') earth = b;
    B.push(b);
  });
  // cinturón de asteroides
  a = [];
  c = [];
  for (let i = 0; i < 3500; i++) {
    const r = 0.85 + Math.random() * 0.3,
      an = Math.random() * TAU;
    a.push(Math.cos(an) * r, gs() * 0.03, Math.sin(an) * r);
    c.push(0.6, 0.55, 0.5);
  }
  const belt = pts(a, c, 1.2, 0.7);
  sc.add(belt);
  let real = false;
  const Rd = (p) => (p.sun ? (real ? p.km / 1e6 : 4) : real ? p.km / 1e6 : 0.35 * (p.km / 6371)),
    Dd = (au) => (real ? au * 149.6 : 14 + 16 * Math.pow(au, 0.62)),
    Dm = () => (real ? 0.3844 : 1.3),
    shipOffset = () => Math.max(shipSz * 7, Rd(P[3]) * 0.015);
  function layout() {
    B.forEach((b) => {
      const r = Rd(b.p);
      b.tilt.scale.setScalar(r);
      b.r = r;
      if (b.orbit) b.orbit.scale.setScalar(Dd(b.p.au) / b.p.au);
      if (b.glow) b.glow.scale.setScalar(r * (real ? 40 : 6));
    });
    belt.scale.setScalar(Dd(2.7));
    ct.minDistance = 0.0005;
  }
  let foc = null,
    tw = null,
    nav = null,
    nearKey = null,
    activeMissionKey = null;
  function tripTo(target, clearance, name, b, onArrive) {
    const from = sp.clone(),
      away = from.clone().sub(target);
    if (away.lengthSq() < 1e-10) away.set(0, 0.25, 1);
    away.normalize();
    const to = target.clone().addScaledVector(away, clearance),
      look = new THREE.PerspectiveCamera();
    look.position.copy(to);
    look.lookAt(target);
    const distance = from.distanceTo(to),
      speed = Math.max(fs, 0.01),
      long = distance > speed * 18;
    nav = {
      b,
      from,
      to,
      q: look.quaternion.clone(),
      elapsed: 0,
      phase: 'align',
      align: Math.min(1.7, Math.max(0.7, 0.8 + distance / (speed * 10))),
      duration: Math.min(
        16,
        Math.max(2, distance / (speed * (long ? Math.max(1, distance / (speed * 8)) : 1))),
      ),
      long,
      oldFs: fs,
      onArrive,
    };
    if (long) S.fv(Math.min(5e4, Math.max(fs, distance / nav.duration)));
    S.f(name);
  }
  function focus(n, k) {
    tw = null;
    const b = B.find((x) => x.p.n == n);
    if (free) {
      if (!b) {
        nav = null;
        S.f(null);
        return;
      }
      foc = null;
      tripTo(
        b.pivot.position.clone(),
        Math.max(b.r * (b.p.sun ? 1.3 : 1.45), real ? 0.01 : 0.04),
        n,
        b,
      );
      return;
    }
    foc = b;
    if (!b) {
      S.f(null);
      return;
    }
    const dir = cam.position.clone().sub(ct.target);
    if (dir.lengthSq() < 1e-12) dir.set(0, 0.3, 1);
    dir.normalize();
    ct.target.copy(b.pivot.position);
    cam.position.copy(b.pivot.position).addScaledVector(dir, b.r * (b.p.sun ? 3 : k || 5));
    ct.minDistance = b.r * 1.3;
    S.f(n);
  }
  function mode(m) {
    if (free) {
      setFree(false);
      S.fr(false);
    }
    real = m;
    layout();
    ct.target.set(0, 0, 0);
    if (m) {
      cam.position.set(0, 2, 6);
      focus('Tierra');
    } else {
      foc = null;
      S.f(null);
      cam.position.set(0, 90, 230);
    }
  }
  function fly(p) {
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: new THREE.Vector3(...p),
      t1: new THREE.Vector3(),
      k: 0,
    };
  }
  function quick(k) {
    if (!free) {
      setFree(true);
      S.fr(true);
      ti = 9;
      S.intro(false);
    }
    if (k === 'orion') {
      gal.updateMatrixWorld(true);
      tripTo(gal.localToWorld(new V(24500, 0, -3500)), 4000, 'Brazo de Orión');
    } else if (k === 'core') {
      tripTo(gal.position.clone(), 6000, 'Centro galáctico');
    } else if (k === 'sunOrbit') {
      tripTo(
        B[0].pivot.position.clone(),
        Math.max(B[0].r * 2, real ? 1.5 : 9),
        'Órbita próxima al Sol',
      );
    } else if (k === 'asteroids') {
      tripTo(new V(0, 0, Dd(2.7)), Math.max(0.3, real ? 2 : 1.2), 'Cinturón de asteroides');
    } else if (k === 'sun') {
      focus('Sol');
    }
  }
  function missionTarget(key, onArrive) {
    const found = missionMarkers.get(key);
    if (!found) return;
    if (!free) {
      setFree(true);
      S.fr(true);
      ti = 9;
      S.intro(false);
    }
    gal.updateMatrixWorld(true);
    const destination = found.marker.getWorldPosition(new V());
    activeMissionKey = key;
    tripTo(
      destination,
      Math.max(22, visualDistanceInMapUnits(found.target.distanceLy) * 0.16),
      found.target.name,
      null,
      () => {
        found.label.visible = true;
        if (onArrive) onArrive();
      },
    );
  }
  function lvl(k) {
    if (free) {
      setFree(false);
      S.fr(false);
    }
    if (real) mode(false);
    ct.minDistance = 0.0005;
    if (k == 0) {
      focus('Tierra', 9);
      return;
    }
    foc = null;
    S.f(null);
    fly(
      [
        [0, 90, 230],
        [0, 3500, 6000],
        [0, 25000, 50000],
      ][k - 1],
    );
  }
  layout();
  cam.position.set(0, 90, 230);
  let sim = T0();
  const clk = new THREE.Clock(),
    keys = {},
    V = THREE.Vector3;
  let free = false,
    spectator = false,
    fy = 0,
    fp = 0,
    fs = 60,
    shipSz = 0.5,
    fovBase = 55,
    drag = 0,
    ti = 9,
    bk = 0,
    pv = 3,
    th = 0,
    ac = 0,
    yw = 0,
    yp = 0,
    O = { tr: 1, in: 0, au: 0 };
  const sp = new V(),
    vel = new V(),
    pvl = new V(),
    dom = R.domElement,
    ship = new THREE.Group(),
    sm = new THREE.MeshStandardMaterial({
      color: 0xc9d3e6,
      metalness: 0.5,
      roughness: 0.4,
      emissive: 0x3a4a66,
    }),
    em = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff6622 }),
    cm = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2a8fd0 }),
    sa = (g, m, x, y, z, rx) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.rotation.x = rx || 0;
      ship.add(o);
    };
  sa(new THREE.ConeGeometry(0.3, 1, 24), sm, 0, 0, -0.7, -Math.PI / 2);
  sa(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 24), sm, 0, 0, 0.4, Math.PI / 2);
  sa(new THREE.BoxGeometry(2.2, 0.04, 0.7), sm, 0, -0.05, 0.55);
  sa(new THREE.BoxGeometry(0.04, 0.45, 0.5), sm, 0, 0.3, 0.8);
  sa(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 16), em, -0.4, 0, 1, Math.PI / 2);
  sa(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 16), em, 0.4, 0, 1, Math.PI / 2);
  sa(new THREE.SphereGeometry(0.2, 16, 12), cm, 0, 0.2, -0.3);
  const fl2 = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: B[0].glow.material.map,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const gc = document.createElement('canvas');
  gc.width = gc.height = 64;
  {
    const gg = gc.getContext('2d'),
      gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(120,190,255,.6)');
    gr.addColorStop(1, 'rgba(40,100,255,0)');
    gg.fillStyle = gr;
    gg.fillRect(0, 0, 64, 64);
  }
  const gt = new THREE.CanvasTexture(gc),
    dm = new THREE.MeshStandardMaterial({
      color: 0x2a3140,
      metalness: 0.7,
      roughness: 0.4,
      emissive: 0x151a26,
    }),
    am = new THREE.MeshStandardMaterial({ color: 0xe05a2b, emissive: 0x5a1f0a }),
    FL = [],
    NL = [],
    bm = (c, o) =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
  fl2.material.map = gt;
  fl2.position.set(0, 0, 1.5);
  ship.add(fl2);
  sa(new THREE.BoxGeometry(2.24, 0.05, 0.12), am, 0, -0.045, 0.35);
  sa(new THREE.BoxGeometry(0.04, 0.36, 0.3), dm, -1.1, 0.12, 0.62);
  sa(new THREE.BoxGeometry(0.04, 0.36, 0.3), dm, 1.1, 0.12, 0.62);
  sa(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 20), dm, 0, -0.02, 0.75, Math.PI / 2);
  sa(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), dm, 0, 0.05, -1.3, Math.PI / 2);
  [
    [-0.4, 1.2],
    [0.4, 1.2],
    [0, 1.3],
  ].forEach(([x, z]) => {
    sa(new THREE.CylinderGeometry(0.15, 0.2, 0.22, 16, 1, true), dm, x, 0, z, Math.PI / 2);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1, 16, 1, true), bm(0x4aa8ff, 0.55)),
      k = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1, 12, 1, true), bm(0xffffff, 0.9)),
      g = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
    c.rotation.x = k.rotation.x = Math.PI / 2;
    c.position.set(x, 0, z);
    k.position.set(x, 0, z);
    g.position.set(x, 0, z + 0.05);
    ship.add(c, k, g);
    FL.push({ c, k, g, z });
  });
  [
    [-1.1, 0xff2222],
    [1.1, 0x22ff55],
  ].forEach(([x, c]) => {
    const n = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: c }),
    );
    n.position.set(x, 0.02, 0.55);
    ship.add(n);
    NL.push(n);
  });
  const WN = 480,
    warpStars = Array.from({ length: WN }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.2 + Math.random() * 0.8,
      p: Math.random(),
    }));
  const TRN = 1100,
    tr = pts(new Array(TRN * 3).fill(0), new Array(TRN * 3).fill(0), 3.1, 1),
    TP = tr.geometry.attributes.position.array,
    TC = tr.geometry.attributes.color.array,
    TB = new Float32Array(TRN).fill(-99),
    TS = { i: 0 };
  tr.frustumCulled = false;
  tr.visible = false;
  sc.add(tr);
  ship.visible = false;
  sc.add(ship);
  function setFree(on) {
    spectator = false;
    free = on;
    ct.enabled = !on;
    if (on) {
      foc = null;
      S.f(null);
      tw = null;
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
      fy = e.y;
      fp = e.x;
      sp.copy(cam.position);
      shipSz = (2 * Rd(P[3]) * 0.02) / 2.2;
      fs = Math.max(0.01, Math.min(5e4, cam.position.distanceTo(ct.target) * 0.4));
      S.fv(fs);
      ti = 0;
      vel.set(0, 0, 0);
      TB.fill(-99);
      tr.visible = true;
      S.intro(true);
    } else {
      ship.visible = false;
      tr.visible = false;
      S.intro(false);
      const f = new V();
      cam.getWorldDirection(f);
      ct.target.copy(cam.position).addScaledVector(f, Math.max(1, cam.position.length() * 0.1));
    }
  }
  function spectate() {
    let q;
    if (free) q = ship.quaternion.clone();
    else {
      setFree(true);
      q = cam.quaternion.clone();
    }
    spectator = true;
    free = false;
    ct.enabled = true;
    foc = null;
    tw = null;
    nav = null;
    vel.set(0, 0, 0);
    S.f(null);
    S.fr(false);
    S.intro(false);
    tr.visible = false;
    ship.position.copy(sp);
    ship.scale.setScalar(shipSz);
    ship.quaternion.copy(q);
    ship.visible = true;
    const d = Math.max(shipSz * 16, Rd(P[3]) * 0.08, real ? 0.04 : 0.025),
      offset = new V(1, 0.55, 2).applyQuaternion(q).multiplyScalar(d);
    ct.target.copy(sp);
    cam.position.copy(sp).add(offset);
    cam.lookAt(sp);
    ct.update();
  }
  function board() {
    if (!spectator) return;
    spectator = false;
    free = true;
    ct.enabled = false;
    foc = null;
    tw = null;
    nav = null;
    S.f(null);
    S.fr(true);
    S.intro(false);
    vel.set(0, 0, 0);
    const q = ship.quaternion.clone(),
      e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    fy = e.y;
    fp = e.x;
    ti = 9;
    tr.visible = true;
    ship.visible = pv == 3;
    cam.quaternion.copy(q);
    cam.position
      .copy(sp)
      .add(new V(0, 0.3, 1).multiplyScalar(shipOffset() * (pv == 3 ? 1 : 0)).applyQuaternion(q));
  }
  function exitSpectator() {
    if (!spectator) return;
    spectator = false;
    free = false;
    ship.visible = false;
    ct.enabled = true;
    ct.target.copy(sp);
    tr.visible = false;
    S.fr(false);
    S.intro(false);
    S.f(null);
  }
  function jump(k) {
    if (!free) {
      setFree(true);
      S.fr(true);
    }
    tw = null;
    foc = null;
    S.f(null);
    const o = [
        [0, 9e4, 4e4],
        [0, 2500, 14000],
        [0, 0, 0],
      ][k],
      g = gal.position;
    if (k == 2) cam.position.set(0, 4, 14);
    else cam.position.copy(new V(...o).applyQuaternion(gal.quaternion).add(g));
    cam.lookAt(k == 2 ? new V() : g);
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    fy = e.y;
    fp = e.x;
    sp.copy(cam.position);
    shipSz = (2 * Rd(P[3]) * 0.02) / 2.2;
    fs = [3000, 300, 30][k];
    S.fv(fs);
  }
  let speedNoticeTimer;
  const onPointerDown = (e) => {
    if (free) {
      drag = 1;
      dom.setPointerCapture(e.pointerId);
    }
  };
  const onPointerUp = () => {
    drag = 0;
  };
  const onPointerMove = (e) => {
    if (free && drag) {
      fy -= e.movementX * 0.003;
      fp = Math.max(-1.55, Math.min(1.55, fp - e.movementY * 0.003));
      yw = Math.max(-80, Math.min(80, yw + e.movementX));
      yp = Math.max(-80, Math.min(80, yp + e.movementY));
    }
  };
  const onWheel = (e) => {
    if (free) {
      fs = Math.max(0.01, Math.min(5e4, fs * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      S.fv(fs);
      clearTimeout(speedNoticeTimer);
      speedNoticeTimer = setTimeout(() => S.speedNotice(fs), 700);
    }
  };
  const onKeyDown = (e) => {
    keys[e.key.toLowerCase()] = 1;
  };
  const onKeyUp = (e) => {
    delete keys[e.key.toLowerCase()];
  };
  const onResize = () => {
    R.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
  };
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('wheel', onWheel, { passive: true });
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('resize', onResize);
  function tick() {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clk.getDelta(), 0.1),
      spd = S.pause.current ? 0 : S.speed.current;
    sim += dt * spd;
    S.day(sim);
    const fl = S.fl.current;
    B.forEach((b) => {
      const p = b.p;
      if (p.au) {
        const v = pos(p, sim);
        b.pivot.position.copy(v).multiplyScalar(Dd(p.au) / p.au);
        b.au = v.length();
        b.ar.setDirection(
          pos(p, sim + 0.01)
            .sub(v)
            .normalize(),
        );
      } else if (p.moon) {
        const an = (sim / p.per) * TAU,
          e = earth.pivot.position,
          d = Dm();
        b.pivot.position.set(e.x + Math.cos(an) * d, 0, e.z - Math.sin(an) * d);
        b.spin.rotation.y = an + Math.PI / 2;
        b.ar.setDirection(new THREE.Vector3(-Math.sin(an), 0, -Math.cos(an)));
      }
      if (!p.moon) {
        const rs = ((TAU * 24) / p.rot) * spd,
          rate = (rs * 3) / (3 + rs);
        b.spin.rotation.y += rate * dt;
      }
      b.lab.visible = !!fl.lab;
      b.ax.visible = !!fl.ax;
      if (b.orbit) b.orbit.visible = !!fl.orb;
      if (b.ar) {
        b.ar.visible = !!fl.vel;
        const L = cam.position.distanceTo(b.pivot.position) * 0.12;
        b.ar.setLength(L, L * 0.25, L * 0.12);
      }
    });
    if (free) {
      let candidate = null,
        held = null,
        best = Infinity;
      for (const b of B) {
        if (!b.p.au) continue;
        const d = sp.distanceTo(b.pivot.position),
          limit = Math.max(b.r * 2.6, real ? 0.025 : 0.08);
        if (b.p.n === nearKey && d < limit * 1.75) held = b;
        if (d < limit && d < best) {
          candidate = b;
          best = d;
        }
      }
      if (held) candidate = held;
      const key = (candidate && candidate.p.n) || null;
      if (key !== nearKey) {
        nearKey = key;
        S.near(key);
      }
    } else if (nearKey) {
      nearKey = null;
      S.near(null);
    }
    if (foc) {
      const dl = foc.pivot.position.clone().sub(ct.target);
      ct.target.add(dl);
      cam.position.add(dl);
    }
    const mv = new V(
      (keys.w ? 1 : 0) - (keys.s ? 1 : 0),
      (keys.e ? 1 : 0) - (keys.q ? 1 : 0),
      (keys.d ? 1 : 0) - (keys.a ? 1 : 0),
    );
    if (free) {
      ti += dt;
      if (ti > 3.6 && ti - dt <= 3.6) S.intro(false);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
      const ok = ti >= 5,
        mx = ok ? mv.x || (O.au ? 1 : 0) : 0,
        f = new V(0, 0, -1).applyQuaternion(q),
        r = new V(1, 0, 0).applyQuaternion(q),
        bs = fs * (keys.shift ? 5 : 1);
      pvl.copy(vel);
      vel.lerp(
        f
          .multiplyScalar(mx * bs)
          .addScaledVector(cam.up, (ok ? mv.y : 0) * bs)
          .addScaledVector(r, (ok ? mv.z : 0) * bs),
        1 - Math.exp(-dt * (O.in ? 1.2 : 14)),
      );
      sp.addScaledVector(vel, dt);
      ac += (vel.distanceTo(pvl) / Math.max(dt, 1e-4) - ac) * Math.min(1, dt * 8);
      if (nav) {
        nav.elapsed += dt;
        if (nav.phase === 'arrival') {
          sp.copy(nav.to);
          vel.multiplyScalar(Math.exp(-dt * 7));
          q.copy(nav.q);
          if (nav.elapsed >= 0.9) {
            const oldFs = nav.oldFs;
            const onArrive = nav.onArrive;
            nav = null;
            S.fv(oldFs);
            if (onArrive) onArrive();
          }
        } else if (nav.phase === 'jumpout') {
          q.copy(nav.q);
          if (nav.elapsed >= 0.3) {
            nav.phase = 'transit';
            nav.elapsed = 0;
          }
        } else if (nav.phase === 'jumpin') {
          sp.copy(nav.to);
          vel.set(0, 0, 0);
          q.copy(nav.q);
          if (nav.elapsed >= 0.38) {
            nav.phase = 'arrival';
            nav.elapsed = 0;
          }
        } else if (nav.phase === 'align') {
          if (nav.elapsed < nav.align) q.slerp(nav.q, Math.min(1, nav.elapsed / nav.align));
          else {
            nav.phase = nav.long ? 'jumpout' : 'transit';
            nav.elapsed = 0;
            q.copy(nav.q);
          }
        } else {
          const u = Math.min(1, nav.elapsed / nav.duration),
            ease = u * u * (3 - 2 * u),
            prev = sp.clone();
          sp.lerpVectors(nav.from, nav.to, ease);
          vel.copy(sp).sub(prev).divideScalar(Math.max(dt, 1e-4));
          q.copy(nav.q);
          if (u >= 1) {
            sp.copy(nav.to);
            vel.set(0, 0, 0);
            nav.phase = nav.long ? 'jumpin' : 'arrival';
            nav.elapsed = 0;
          }
        }
      }
      const sz = shipSz,
        kk = Math.min(1, Math.max(0, (ti - 2.6) / 2.4)),
        e = 1 - Math.pow(1 - kk, 3);
      bk += (-(ti >= 5 ? mv.z : 0) * 0.5 - bk) * Math.min(1, dt * 5);
      cam.quaternion.copy(q);
      if (pv == 1)
        cam.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), bk * 0.35));
      cam.position
        .copy(sp)
        .add(
          new V(0, 0.3, 1).multiplyScalar(shipOffset() * e * (pv == 3 ? 1 : 0)).applyQuaternion(q),
        );
      const tt =
        ti < 5
          ? 1.2 * (1 - Math.min(1, Math.max(0, (ti - 3.2) / 1.8))) + 0.3
          : Math.min(1.6, vel.length() / fs) + 0.15;
      th += (tt - th) * Math.min(1, dt * 6);
      ship.visible = pv == 3 && kk > 0.02 && !(nav && nav.long && nav.phase === 'transit');
      ship.position.copy(sp);
      ship.scale.setScalar(sz);
      ship.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), bk));
      fl2.scale.setScalar(0.6 + 1.2 * th);
      FL.forEach((o, i) => {
        const L = (0.3 + 1.7 * th) * (1 + 0.1 * Math.sin(ti * 45 + i * 2));
        o.c.scale.set(1 + 0.3 * th, L, 1 + 0.3 * th);
        o.c.position.z = o.z + 0.5 * L;
        o.k.scale.set(1, L * 0.55, 1);
        o.k.position.z = o.z + 0.27 * L;
        o.g.scale.setScalar(0.35 + 0.5 * th);
      });
      NL.forEach((n, i) => (n.visible = Math.sin(ti * 4 + i * 3) > -0.2));
      if (O.tr && pv == 3 && kk > 0.9 && th > 0.3) {
        const tp = new V(0, 0, 1.3 * sz).applyQuaternion(q).add(sp);
        for (let j = 0; j < 4; j++) {
          TS.i = (TS.i + 1) % TRN;
          const o = TS.i * 3;
          TP[o] = tp.x + gs() * sz * 0.08;
          TP[o + 1] = tp.y + gs() * sz * 0.08;
          TP[o + 2] = tp.z + gs() * sz * 0.08;
          TB[TS.i] = ti;
        }
      }
      for (let j = 0; j < TRN; j++) {
        const b = Math.max(0, Math.min(1, 1 - (ti - TB[j]) / 2.6)) * Math.min(1, th);
        TC[j * 3] = 0.4 * b;
        TC[j * 3 + 1] = 0.7 * b;
        TC[j * 3 + 2] = b;
      }
      tr.geometry.attributes.position.needsUpdate = tr.geometry.attributes.color.needsUpdate = true;
      yw *= Math.exp(-dt * 5);
      yp *= Math.exp(-dt * 5);
      const wc = document.getElementById('warp'),
        wg = wc && wc.getContext('2d');
      if (wg) {
        const w = (wc.width = innerWidth * R.getPixelRatio()),
          h = (wc.height = innerHeight * R.getPixelRatio()),
          cx = w * 0.5,
          cy = h * 0.5,
          amount = Math.max(
            nav && nav.long
              ? nav.phase === 'arrival'
                ? 0.92 * (1 - Math.min(1, nav.elapsed / 0.9))
                : nav.phase === 'align'
                  ? 0.82 * Math.min(1, Math.max(0, (nav.elapsed - (nav.align - 0.35)) / 0.35))
                  : 0.92
              : 0,
            Math.max(0, Math.min(1, (Math.log10(Math.max(fs, 0.01)) - 1.4) / 3.1)) *
              Math.min(1, vel.length() / Math.max(fs, 0.01)),
          );
        wg.clearRect(0, 0, w, h);
        wc.style.opacity = amount.toFixed(2);
        if (amount > 0.01) {
          for (let si = 0; si < warpStars.length; si++) {
            const s = warpStars[si];
            s.p += dt * (0.25 + amount * 2.2);
            if (s.p > 1) {
              s.p = 0;
              s.x = Math.random();
              s.y = Math.random();
            }
            const x = s.x * w,
              y = s.y * h,
              dx = x - cx,
              dy = y - cy,
              d = Math.hypot(dx, dy) || 1,
              len = (3 + amount * (nav && nav.long ? 175 : 95)) * s.r * amount;
            wg.beginPath();
            wg.moveTo(x, y);
            wg.lineTo(x + (dx / d) * len, y + (dy / d) * len);
            wg.strokeStyle = 'rgba(190,225,255,' + (0.18 + amount * 0.65) * s.r + ')';
            wg.lineWidth = (0.6 + amount * 1.4) * s.r * R.getPixelRatio();
            wg.stroke();
          }
        }
        if (nav && nav.long && (nav.phase === 'jumpout' || nav.phase === 'jumpin')) {
          const span = nav.phase === 'jumpout' ? 0.3 : 0.38,
            pulse = Math.sin(Math.PI * Math.min(1, nav.elapsed / span)),
            gr = wg.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
          gr.addColorStop(0, 'rgba(255,255,255,' + 0.9 * pulse + ')');
          gr.addColorStop(0.12, 'rgba(150,215,255,' + 0.72 * pulse + ')');
          gr.addColorStop(0.5, 'rgba(35,105,255,' + 0.28 * pulse + ')');
          gr.addColorStop(1, 'rgba(10,35,100,0)');
          wg.fillStyle = gr;
          wg.fillRect(0, 0, w, h);
        }
      }
      if (pv == 1) {
        const y = document.getElementById('yk'),
          t = document.getElementById('tb');
        if (y)
          y.style.transform =
            'translateY(' +
            Math.max(-40, Math.min(40, -yp * 0.8)) +
            'px) rotate(' +
            Math.max(-60, Math.min(60, -bk * 80 + yw * 0.6)) +
            'deg)';
        if (t) t.style.transform = 'scaleX(' + Math.min(1, th / 1.2) + ')';
        const g = (i) => document.getElementById(i),
          sp2 = vel.length(),
          lg = Math.log10(Math.max(fs, 0.01)),
          lvn =
            fs < 5
              ? [1, 'PLANETA']
              : fs < 300
                ? [2, 'SISTEMA']
                : fs < 8000
                  ? [3, 'GALAXIA']
                  : [4, 'HIPER'],
          tx = (i, v) => {
            const o = g(i);
            if (o) o.textContent = v;
          },
          wd = (i, p) => {
            const o = g(i);
            if (o) o.style.width = Math.max(0, Math.min(100, p)) + '%';
          },
          nf = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
        tx('lv', 'NIVEL ' + lvn[0] + '/4 · ' + lvn[1]);
        wd('lf', ((lg + 2) / 6.7) * 100);
        tx(
          'ls',
          'AJUSTE ' + nf(fs) + ' u/s' + (keys.shift ? ' · BOOST ×5' : '') + (O.au ? ' · AUTO' : ''),
        );
        tx(
          'rv',
          nf(sp2) + ' u/s' + (sp2 >= 300 ? ' ≈ ' + Math.round(sp2 * 1.156) + ' a.l./s' : ''),
        );
        wd('rf', (sp2 / (fs * (keys.shift ? 5 : 1))) * 100);
        tx(
          'ri',
          O.in ? 'INERCIA ON · FUERZA ' + nf(ac) + ' u/s²' : 'INERCIA OFF · ' + nf(ac) + ' u/s²',
        );
        wd('rg', (ac / (fs * (O.in ? 1.5 : 15))) * 100);
        tx(
          'rh',
          'RUMBO ' +
            Math.round((((-fy * 57.2958) % 360) + 360) % 360) +
            '° · INCL ' +
            Math.round(fp * 57.2958) +
            '° · SOL ' +
            nf(sp.length()) +
            ' u',
        );
        const headingMarker = g('headingMarker');
        if (headingMarker)
          headingMarker.style.left = `${((((-fy * 57.2958) % 360) + 360) % 360) / 3.6}%`;
      }
    } else if (mv.lengthSq()) {
      const f = new V();
      cam.getWorldDirection(f);
      const r = new V().crossVectors(f, cam.up).normalize(),
        st = cam.position.distanceTo(ct.target) * 0.02,
        w = f
          .multiplyScalar(mv.x)
          .addScaledVector(cam.up, mv.y)
          .addScaledVector(r, mv.z)
          .multiplyScalar(st);
      cam.position.add(w);
      ct.target.add(w);
      if (foc) {
        foc = null;
        S.f(null);
      }
    }
    {
      const ph = fl.gal ? (sim / (365.25 * 230)) * TAU : 0;
      GU.uP.value = ph;
      GU.uT.value += dt * 0.004;
      gal.position
        .set(RG * Math.cos(ph), 0, RG * Math.sin(ph))
        .applyQuaternion(gal.quaternion)
        .negate();
      LB.forEach((l) => (l.visible = !!fl.lab));
      const activeMissionMarker = activeMissionKey && missionMarkers.get(activeMissionKey);
      if (activeMissionMarker) activeMissionMarker.label.visible = true;
      B[0].glow.scale.setScalar(Math.max(B[0].r * (real ? 40 : 6), cam.position.length() * 0.012));
      if (foc && S.d) S.d(foc.au || 0);
    }
    if (tw) {
      tw.k = Math.min(1, tw.k + dt / 1.6);
      const e = tw.k * tw.k * (3 - 2 * tw.k);
      cam.position.lerpVectors(tw.p0, tw.p1, e);
      ct.target.lerpVectors(tw.t0, tw.t1, e);
      if (tw.k >= 1) tw = null;
    }
    if (!free) ct.update();
    R.render(sc, cam);
  }
  tick();
  return {
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(speedNoticeTimer);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('resize', onResize);
      ct.dispose();
      R.dispose();
      if (R.domElement.parentNode === el) el.removeChild(R.domElement);
    },
    view: (v) => {
      pv = v;
      cam.fov = v == 1 ? Math.min(fovBase, 42) : fovBase;
      cam.updateProjectionMatrix();
      GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
      if (free) {
        ship.visible = v == 3;
        const q = ship.quaternion.clone();
        cam.quaternion.copy(q);
        cam.position
          .copy(sp)
          .add(new V(0, 0.3, 1).multiplyScalar(shipOffset() * (v == 3 ? 1 : 0)).applyQuaternion(q));
      }
    },
    speed: (v) => {
      fs = Math.max(0.01, Math.min(5e4, v));
      S.fv(fs);
    },
    opt: (o) => {
      O = o;
    },
    fov: (v) => {
      fovBase = v;
      cam.fov = pv == 1 ? Math.min(v, 42) : v;
      cam.updateProjectionMatrix();
      GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    },
    free: setFree,
    spectate,
    board,
    exitSpectator,
    spectating: () => spectator,
    jump,
    key: (k, v) => {
      v ? (keys[k] = 1) : delete keys[k];
    },
    focus,
    quick,
    missionTarget,
    mode,
    lvl,
    reset: () => {
      sim = T0();
    },
    setDay: (d) => {
      sim = d;
    },
  };
}
export const CK = `<svg viewBox='0 0 1000 600' preserveAspectRatio='none'><defs><linearGradient id='cg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1b2335'/><stop offset='1' stop-color='#05070c'/></linearGradient><radialGradient id='cv' cx='.5' cy='.45' r='.75'><stop offset='.6' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></radialGradient></defs><rect width='1000' height='600' fill='url(#cv)'/><path d='M0 0H1000L900 62Q500 92 100 62Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M0 0L130 62L52 380L0 450Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M1000 0L870 62L948 380L1000 450Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M0 600V462Q120 420 330 432Q500 405 670 432Q880 420 1000 462V600Z' fill='url(#cg)' stroke='#3d4d70' stroke-width='3'/><path d='M60 472Q250 446 400 456L380 520H90Z' fill='#071019' stroke='#2a8fd0' stroke-opacity='.7'/><path d='M940 472Q750 446 600 456L620 520H910Z' fill='#071019' stroke='#2a8fd0' stroke-opacity='.7'/><g stroke='#6ff0ff' stroke-width='2' fill='none' opacity='.75'><path d='M110 500L170 484L230 494L290 470L350 488'/><circle cx='770' cy='494' r='22'/><path d='M770 494L784 482'/><path d='M830 505H900M830 490H885'/></g><circle cx='460' cy='448' r='5' fill='#ff4040'/><circle cx='480' cy='446' r='5' fill='#ffb030'/><circle cx='520' cy='446' r='5' fill='#40ff80'/><circle cx='540' cy='448' r='5' fill='#40c0ff'/></svg>`,
  YK = `<svg viewBox='0 0 220 190' width='100%' height='100%'><rect x='95' y='100' width='30' height='90' rx='6' fill='#131a28' stroke='#3b4864' stroke-width='3'/><path d='M28 64Q28 24 70 24H150Q192 24 192 64V92Q192 110 172 110H48Q28 110 28 92Z' fill='none' stroke='#252e44' stroke-width='20'/><path d='M28 64Q28 24 70 24H150Q192 24 192 64V92Q192 110 172 110H48Q28 110 28 92Z' fill='none' stroke='#4a5a7c' stroke-width='4'/><rect x='12' y='52' width='26' height='54' rx='10' fill='#e05a2b'/><rect x='182' y='52' width='26' height='54' rx='10' fill='#e05a2b'/><circle cx='110' cy='66' r='15' fill='#0b0f18' stroke='#6ff0ff' stroke-width='3'/><circle cx='110' cy='66' r='5' fill='#6ff0ff'/></svg>`;
export const SC = `<div class='sc sl'><div class='st'><i></i> NIVEL DE VELOCIDAD</div><div id='lv' class='sv'></div><div class='bar ledBar'><i id='lf'></i></div><div id='ls' class='ss'></div></div><div class='sc sr'><div class='st'><i></i> TELEMETRÍA DE VUELO</div><div id='rv' class='sv'></div><div class='bar ledBar'><i id='rf'></i></div><div id='ri' class='ss'></div><div class='bar b2 ledBar'><i id='rg'></i></div><div class='headingDial'><i id='headingMarker'></i></div><div id='rh' class='ss'></div></div>`;
