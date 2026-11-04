import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { P, D2R, TAU, T0, kep, pos } from '../data/planetData.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { NEARBY_GALAXIES } from '../data/nearbyGalaxies.js';

// A single scale cannot show both the Milky Way and nearby star systems
// clearly. Expand only the inner 25 light-years to 1,000 map units per
// light-year, then return to the galaxy-wide scale beyond that neighborhood.
const GALACTIC_MAP_UNITS_PER_LIGHT_YEAR = 3;
const LOCAL_NEIGHBORHOOD_EXTRA_UNITS_PER_LIGHT_YEAR = 997;
const LOCAL_NEIGHBORHOOD_RADIUS_LY = 25;
// Visual parameters only; mission astrometry and target coordinates remain untouched.
const SPHEREX_VISUALS = {
  barnard: { type: 'red-dwarf', radiusSolar: 0.196, color: '#d96c42', seed: 17 },
  'epsilon-indi-b': { type: 'brown-binary', radiusSolar: 0.093, color: '#b77a50', seed: 29 },
  'wise-0855': { type: 'ultracool', radiusSolar: 0.1, color: '#8f9fc9', seed: 41 },
  'rw-aurigae': { type: 'young-variable', radiusSolar: 1.5, color: '#ffc071', seed: 53 },
  'r-draconis': { type: 'mira-variable', radiusSolar: 100, color: '#e86b48', seed: 67 },
};
const PLANET_TEXTURE_FILES = {
  Mercurio: '2k_mercury.jpg',
  Venus: '2k_venus.jpg',
  Tierra: '2k_earth_daymap.jpg',
  Luna: '2k_moon.jpg',
  Marte: '2k_mars.jpg',
  Júpiter: '2k_jupiter.jpg',
  Saturno: '2k_saturn.jpg',
  Urano: '2k_uranus.jpg',
  Neptuno: '2k_neptune.jpg',
};
// The spacecraft model spans about 2.5 local units from nose to engine.
// Scale it as a compact 120 m exploration craft against Earth's physical size.
const SHIP_LENGTH_METERS = 120;
const SHIP_MODEL_LENGTH = 2.5;
// Satellite paths are illustrative; slow only their visual animation so the
// accelerated day clock does not make them race around the Earth.
const SATELLITE_VISUAL_TIME_SCALE = 0.0001;

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
  const towardCenter = -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z;
  const towardLongitude90 = 0.4941094279 * x - 0.44482963 * y + 0.7469822445 * z;
  const north = -0.867666149 * x - 0.1980763734 * y + 0.4559837762 * z;
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

function lab(text, scale = 0.4, fontSize = 30) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.font = `${fontSize}px Segoe UI, sans-serif`;
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
  sprite.scale.set(scale, scale * 0.125, 1);
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
function sunTexture(p) {
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
      const n = fbm(u, v, 10);
      c = [255, 170 + n * 85, 40 + n * 90];
      const o = (j * W + i) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  g.putImageData(im, 0, 0);
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

function makeDeepGalaxyTexture({ seed = 1, color = '#8ecbff', arms = 4, edgeOn = false } = {}) {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  context.save();
  context.translate(256, 192);
  context.rotate(seed * 0.37);
  context.scale(1, edgeOn ? 0.19 : 0.68);
  const halo = context.createRadialGradient(0, 0, 4, 0, 0, 178);
  halo.addColorStop(0, '#fff8e8');
  halo.addColorStop(0.08, color);
  halo.addColorStop(0.3, `${color}a8`);
  halo.addColorStop(0.68, `${color}26`);
  halo.addColorStop(1, `${color}00`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(0, 0, 178, 0, TAU);
  context.fill();

  context.globalCompositeOperation = 'lighter';
  for (let arm = 0; arm < arms; arm++) {
    for (let i = 0; i < 420; i++) {
      const progress = 0.04 + random() * 0.96;
      const angle = (arm / arms) * TAU + progress * 5.3 + (random() - 0.5) * 0.38;
      const radius = 15 + progress * 158;
      const scatter = (random() + random() - 1) * (4 + progress * 13);
      const x = Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * scatter;
      const y = Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * scatter;
      const size = random() > 0.965 ? 2.8 : 0.7 + random() * 1.6;
      context.globalAlpha = 0.2 + random() * 0.65;
      context.fillStyle = random() > 0.9 ? '#ffe6c4' : color;
      context.beginPath();
      context.arc(x, y, size, 0, TAU);
      context.fill();
    }
  }
  // A handful of bright star-forming knots give each distant silhouette depth.
  for (let i = 0; i < 90; i++) {
    const angle = random() * TAU;
    const radius = 18 + Math.pow(random(), 0.7) * 145;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const glow = context.createRadialGradient(x, y, 0, x, y, 5 + random() * 10);
    glow.addColorStop(0, 'rgba(255,244,218,.9)');
    glow.addColorStop(1, 'rgba(255,244,218,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 14, 0, TAU);
    context.fill();
  }
  context.restore();
  context.globalAlpha = 1;
  return new THREE.CanvasTexture(canvas);
}

export function setupScene(el, S) {
  let qualityMode = S.quality || 'auto';
  const isMobileDevice = () =>
    window.matchMedia?.('(max-width: 760px), (pointer: coarse)')?.matches;
  const pixelRatioFor = (mode) => {
    if (mode === 'performance') return 1;
    if (mode === 'quality') return Math.min(2, devicePixelRatio || 1);
    return Math.min(isMobileDevice() ? 1.25 : 1.75, devicePixelRatio || 1);
  };
  const R = new THREE.WebGLRenderer({
    antialias: qualityMode !== 'performance' && !isMobileDevice(),
    logarithmicDepthBuffer: true,
  });
  R.setPixelRatio(pixelRatioFor(qualityMode));
  R.setSize(innerWidth, innerHeight);
  el.appendChild(R.domElement);
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (file, colorMap = true, planetName = '') => {
    const texture = textureLoader.load(
      `${import.meta.env.BASE_URL}textures/planets/${file}`,
      (loaded) => {
        if (planetName !== 'Urano' && planetName !== 'Neptuno') return;
        const source = loaded.image;
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d');
        if (planetName === 'Neptuno') {
          // The source already contains cloud bands and a storm; lift their
          // contrast gently so the detail survives the planet's shading.
          context.filter = 'contrast(1.4) saturate(0.92)';
          context.drawImage(source, 0, 0);
        } else {
          context.drawImage(source, 0, 0);
          // The source Uranus map is almost featureless. Add restrained,
          // soft latitude bands and a few high cloud streaks for depth.
          const banding = context.createLinearGradient(0, 0, 0, canvas.height);
          banding.addColorStop(0, 'rgba(72, 158, 174, 0.12)');
          banding.addColorStop(0.12, 'rgba(231, 255, 255, 0.08)');
          banding.addColorStop(0.27, 'rgba(64, 154, 171, 0.13)');
          banding.addColorStop(0.43, 'rgba(235, 255, 255, 0.07)');
          banding.addColorStop(0.57, 'rgba(58, 143, 163, 0.14)');
          banding.addColorStop(0.72, 'rgba(226, 255, 255, 0.08)');
          banding.addColorStop(0.88, 'rgba(72, 158, 174, 0.12)');
          banding.addColorStop(1, 'rgba(220, 250, 255, 0.08)');
          context.fillStyle = banding;
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.filter = 'blur(5px)';
          context.fillStyle = 'rgba(246, 255, 255, 0.22)';
          [
            [0.22, 0.29, 0.04],
            [0.63, 0.39, 0.06],
            [0.81, 0.61, 0.045],
            [0.4, 0.72, 0.035],
          ].forEach(([x, y, width]) => {
            context.beginPath();
            context.ellipse(
              canvas.width * x,
              canvas.height * y,
              canvas.width * width,
              canvas.height * 0.006,
              0,
              0,
              Math.PI * 2,
            );
            context.fill();
          });
        }
        loaded.image = canvas;
        loaded.needsUpdate = true;
      },
    );
    if (colorMap) texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
    return texture;
  };
  const sc = new THREE.Scene(),
    cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 1e-8, 4e5),
    ct = new OrbitControls(cam, R.domElement);
  let rafId = 0,
    disposed = false,
    lastNavigationPublish = -1,
    lastNavigationHadNav = false;
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
  // Decorative deep-sky galaxies sit far beyond the Milky Way starfield.
  // They fade in as the camera pulls back to explore galactic scales and stay
  // subtle near planets, where they would otherwise distract from navigation.
  const deepGalaxyBackdrop = new THREE.Group();
  deepGalaxyBackdrop.name = 'Deep galaxy backdrop';
  const deepGalaxyMaterials = [];
  const distantGalaxies = [
    {
      direction: [0.08, 0.13, -1],
      distance: 142000,
      size: 22000,
      seed: 71,
      color: '#8fcaff',
      arms: 2,
    },
    {
      direction: [-0.48, 0.2, -0.86],
      distance: 190000,
      size: 9800,
      seed: 113,
      color: '#e2b2ff',
      arms: 3,
    },
    {
      direction: [0.72, -0.08, 0.69],
      distance: 185000,
      size: 10500,
      seed: 149,
      color: '#ffd29b',
      arms: 2,
      edgeOn: true,
    },
    {
      direction: [-0.94, 0.17, 0.3],
      distance: 168000,
      size: 8200,
      seed: 193,
      color: '#9ce8dd',
      arms: 5,
    },
    {
      direction: [0.24, 0.86, 0.45],
      distance: 198000,
      size: 9800,
      seed: 229,
      color: '#ffaed1',
      arms: 4,
    },
    {
      direction: [0.55, -0.73, -0.4],
      distance: 172000,
      size: 7600,
      seed: 271,
      color: '#b8c6ff',
      arms: 3,
      edgeOn: true,
    },
  ];
  distantGalaxies.forEach((entry) => {
    const material = new THREE.SpriteMaterial({
      map: makeDeepGalaxyTexture(entry),
      transparent: true,
      opacity: 0,
      // Keep nearby planets and the spacecraft in front of the distant art.
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    deepGalaxyMaterials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.fromArray(entry.direction).normalize().multiplyScalar(entry.distance);
    // Show Andromeda as a prominent spiral and keep the other distant
    // galaxies large enough to read clearly against the starfield.
    sprite.scale.set(entry.size * 3.6, entry.size * 2.66, 1);
    sprite.renderOrder = -2;
    deepGalaxyBackdrop.add(sprite);
  });
  sc.add(deepGalaxyBackdrop);
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
  // A deliberately generous scale height keeps the camera immersed in a
  // three-dimensional stellar volume instead of seeing the galaxy as an edge-on line.
  const diskHeight = (r) => 950 + 2600 * Math.exp(-r / 14000);
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
      y = gs() * (i % 3 ? 2500 : 6200);
      col = [1, 0.85, 0.6];
    } else if (i < 16000) {
      const r = 3000 + Math.random() * 10000,
        an = Math.random() * TAU;
      x = Math.cos(an) * r;
      z = Math.sin(an) * r;
      y = gs() * (1100 + 3300 * Math.exp(-r / 7000));
      rr = r;
      col = [1, 0.82, 0.58];
    } else {
      const r = 9000 + Math.pow(Math.random(), 0.8) * 36000,
        k = i % 4,
        an = arm(r, k) + gs() * (0.34 + 0.1 * (k % 2)),
        t = r / 45000;
      x = Math.cos(an) * r + gs() * 2800;
      z = Math.sin(an) * r + gs() * 2800;
      y = gs() * diskHeight(r);
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
    a.push(x, gs() * diskHeight(r), z);
    c.push(...cl);
    Rr.push(Math.hypot(x, z));
    Z.push(1500 + Math.random() * 3500);
  }
  for (let i = 0; i < 220; i++) {
    const q = gs() * 5000;
    a.push(RG + q * 0.25 + gs() * 1500, gs() * 2400, q + gs() * 1500);
    c.push(...nc());
    Rr.push(RG);
    Z.push(200 + Math.random() * 700);
  }
  for (let i = 0; i < 60; i++) {
    const r = Math.random() * 4500,
      an = Math.random() * TAU;
    a.push(Math.cos(an) * r, gs() * 3200, Math.sin(an) * r);
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
    a.push(Math.cos(an) * r, gs() * diskHeight(r), Math.sin(an) * r);
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
    a.push(x, gs() * diskHeight(r), z);
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
    a.push(RG + q * 0.25 + gs() * 250, gs() * 1800, q + gs() * 250);
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
  // Separate, schematic overview layer. It is shown only while the nearby-
  // galaxies map is active and never participates in astronomical navigation.
  const nearbyGalaxyGroup = new THREE.Group();
  nearbyGalaxyGroup.visible = false;
  // Cartographic Milky Way frame used only by the neighborhood overview.
  // The small solar-system marker is parented here so it shares one absolute
  // galactic rotation transform without changing the live planetary scene.
  const galacticMapFrame = new THREE.Group();
  nearbyGalaxyGroup.add(galacticMapFrame);
  const galacticMapDisk = new THREE.Group();
  galacticMapFrame.add(galacticMapDisk);
  // Build a stable, textured spiral from individual stars rather than smooth
  // lines. The small random offsets create dust lanes and bright star-forming
  // knots while preserving four clearly legible arms.
  const makeGalaxyParticles = ({
    seed = 1,
    count = 2200,
    arms = 4,
    radius = 40,
    color = '#80c9ff',
    irregular = false,
    pointSize = 1.25,
  } = {}) => {
    let state = seed >>> 0;
    const random = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(color);
    const warm = new THREE.Color('#ffd39b');
    const hot = new THREE.Color('#fff4db');
    for (let i = 0; i < count; i++) {
      const core = random() < 0.2;
      const arm = Math.floor(random() * arms);
      const progress = core ? Math.pow(random(), 1.8) * 0.36 : 0.16 + random() * 0.84;
      const r = (core ? 0.04 + progress * 0.48 : 0.12 + progress * 0.88) * radius;
      const twist = irregular ? 1.5 : 5.15;
      const theta =
        arm * (TAU / arms) + progress * twist + (random() - 0.5) * (irregular ? 2.2 : 0.42);
      const spread = irregular ? 0.2 : 0.055 + progress * 0.12;
      const jitter = (random() + random() + random() - 1.5) * radius * spread;
      const x = Math.cos(theta) * r + Math.cos(theta + Math.PI / 2) * jitter;
      const z = Math.sin(theta) * r + Math.sin(theta + Math.PI / 2) * jitter;
      const y = (random() + random() - 1) * radius * (irregular ? 0.15 : 0.025 + progress * 0.035);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const knot = random() > 0.93;
      const tint = core ? warm : knot ? hot : baseColor;
      const brightness = core ? 0.72 + random() * 0.48 : 0.48 + random() * 0.72;
      colors[i * 3] = tint.r * brightness;
      colors[i * 3 + 1] = tint.g * brightness;
      colors[i * 3 + 2] = tint.b * brightness;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: pointSize,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    points.frustumCulled = false;
    return points;
  };
  galacticMapDisk.add(
    makeGalaxyParticles({
      seed: 2048,
      count: 10500,
      arms: 4,
      radius: 84,
      color: '#75bfff',
      pointSize: 1.05,
    }),
  );
  const galacticMapCore = new THREE.Mesh(
    new THREE.SphereGeometry(4.1, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd39b, transparent: true, opacity: 0.94 }),
  );
  galacticMapDisk.add(galacticMapCore);
  const solarSystemMapMarker = new THREE.Group();
  solarSystemMapMarker.position.x = 54;
  galacticMapDisk.add(solarSystemMapMarker);
  const solarMapSun = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd76c }),
  );
  solarSystemMapMarker.add(solarMapSun);
  const solarMapPlanets = [];
  const miniPlanetColors = {
    Mercurio: 0xb4aa9a,
    Venus: 0xe7c887,
    Tierra: 0x55adff,
    Marte: 0xe47658,
    Júpiter: 0xd9ae83,
    Saturno: 0xe5d09b,
    Urano: 0x7bd5d6,
    Neptuno: 0x5986ef,
  };
  P.filter((planet) => planet.au).forEach((planet) => {
    // The overview compresses the real orbital radii while retaining each
    // planet's orbital phase from the existing simulation clock.
    const visualOrbitRadius = Math.log1p(planet.au) * 2.8;
    const orbitPoints = [];
    for (let step = 0; step < 64; step++) {
      const angle = (step / 64) * TAU;
      orbitPoints.push(
        new THREE.Vector3(
          Math.cos(angle) * visualOrbitRadius,
          0,
          Math.sin(angle) * visualOrbitRadius,
        ),
      );
    }
    solarSystemMapMarker.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0xb4cee9, transparent: true, opacity: 0.24 }),
      ),
    );
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(planet.au > 4 ? 0.82 : 0.64, 10, 8),
      new THREE.MeshBasicMaterial({ color: miniPlanetColors[planet.n] || 0xc6d4e4 }),
    );
    solarSystemMapMarker.add(marker);
    solarMapPlanets.push({ planet, marker, visualOrbitRadius });
  });
  const solarSystemLabel = lab('Sistema Solar · Sol', 82, 22);
  solarSystemLabel.position.set(0, 7, 0);
  solarSystemMapMarker.add(solarSystemLabel);
  const overviewStarPositions = [];
  const overviewStarColors = [];
  for (let index = 0; index < 1800; index++) {
    const direction = new THREE.Vector3(gs(), gs(), gs()).normalize();
    const radius = 520 + Math.random() * 980;
    overviewStarPositions.push(direction.x * radius, direction.y * radius, direction.z * radius);
    const tint = Math.random();
    overviewStarColors.push(0.56 + tint * 0.36, 0.68 + tint * 0.26, 0.82 + tint * 0.18);
  }
  nearbyGalaxyGroup.add(pts(overviewStarPositions, overviewStarColors, 1.15, 0.3));
  const nearbyGalaxyMarkers = new Map();
  const nearbyMarkerGeometry = new THREE.SphereGeometry(1, 12, 10);
  const galaxyDistance = (entry) => Math.sqrt(Math.max(0, entry.distanceMly || 0)) * 76;
  const galaxyDirection = (entry) => {
    if (!Number.isFinite(entry.raDeg) || !Number.isFinite(entry.decDeg)) return new THREE.Vector3();
    const ra = (entry.raDeg * Math.PI) / 180;
    const dec = (entry.decDeg * Math.PI) / 180;
    return new THREE.Vector3(
      Math.cos(dec) * Math.cos(ra),
      Math.sin(dec),
      Math.cos(dec) * Math.sin(ra),
    );
  };
  NEARBY_GALAXIES.forEach((entry) => {
    const group = new THREE.Group();
    group.userData.nearbyGalaxyKey = entry.key;
    const isGroup = entry.kind === 'group';
    const color = entry.key === 'milky-way' ? 0x8fdfff : isGroup ? 0xffbc72 : 0xa8c9ff;
    const marker = new THREE.Mesh(
      nearbyMarkerGeometry,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isGroup ? 0.86 : 0.96 }),
    );
    // Keep the Milky Way's pick target compact so it does not cover the
    // larger spiral-disk illustration drawn behind it.
    const radius = entry.key === 'milky-way' ? 5 : isGroup ? 10 : 7;
    marker.scale.setScalar(radius);
    marker.userData.nearbyGalaxyKey = entry.key;
    group.add(marker);
    if (entry.key !== 'milky-way') {
      const irregular = entry.type?.en?.includes('Irregular') || isGroup;
      group.add(
        makeGalaxyParticles({
          seed: entry.key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 31),
          count: isGroup ? 2100 : 2800,
          arms: irregular ? 5 : entry.key.includes('andromeda') ? 2 : 3,
          radius: isGroup ? 25 : 20,
          color: isGroup ? '#ffc27d' : '#9edcff',
          irregular,
          pointSize: 0.62,
        }),
      );
    }
    if (isGroup) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.6, 0.7, 4, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
      );
      ring.rotation.x = Math.PI / 2.8;
      group.add(ring);
    }
    const label = lab(entry.name.es, 52, 22);
    label.visible = false;
    label.position.set(0, radius + 7, 0);
    group.add(label);
    group.userData.label = label;
    const offset =
      entry.key === 'milky-way'
        ? new THREE.Vector3()
        : galaxyDirection(entry).multiplyScalar(galaxyDistance(entry));
    if (entry.anchorKey) {
      const anchor = NEARBY_GALAXIES.find((item) => item.key === entry.anchorKey);
      if (anchor) offset.copy(galaxyDirection(anchor).multiplyScalar(galaxyDistance(anchor)));
    }
    if (entry.key === 'local-group') offset.set(0, 0, 28);
    group.position.copy(offset);
    nearbyGalaxyGroup.add(group);
    nearbyGalaxyMarkers.set(entry.key, group);
  });
  sc.add(nearbyGalaxyGroup);
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
  const makeMissionStarTexture = (visual, seedOffset = 0) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = visual.color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const palette = {
      'red-dwarf': ['rgba(255,196,124,.34)', 'rgba(73,24,29,.35)', 'rgba(236,113,66,.28)'],
      'brown-binary': ['rgba(255,202,139,.24)', 'rgba(58,33,46,.46)', 'rgba(208,121,71,.28)'],
      ultracool: ['rgba(208,218,255,.2)', 'rgba(35,43,77,.46)', 'rgba(162,117,148,.25)'],
      'young-variable': ['rgba(255,245,190,.38)', 'rgba(112,46,25,.24)', 'rgba(255,149,70,.26)'],
      'mira-variable': ['rgba(255,187,112,.28)', 'rgba(89,25,32,.4)', 'rgba(229,84,60,.25)'],
    }[visual.type];
    let seed = visual.seed + seedOffset;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const bands = visual.type === 'brown-binary' || visual.type === 'ultracool' ? 18 : 8;
    for (let band = 0; band < bands; band++) {
      const y = (band / bands) * canvas.height + (random() - 0.5) * 18;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(
        canvas.width * 0.28,
        y + (random() - 0.5) * 34,
        canvas.width * 0.68,
        y + (random() - 0.5) * 34,
        canvas.width,
        y + (random() - 0.5) * 18,
      );
      context.strokeStyle = palette[band % palette.length];
      context.lineWidth = 4 + random() * (visual.type === 'mira-variable' ? 26 : 15);
      context.stroke();
    }
    const cells = visual.type === 'mira-variable' ? 38 : 74;
    for (let index = 0; index < cells; index++) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const rx = (visual.type === 'mira-variable' ? 14 : 5) + random() * 29;
      const ry = rx * (0.4 + random() * 0.8);
      context.beginPath();
      context.ellipse(x, y, rx, ry, random() * Math.PI, 0, TAU);
      context.fillStyle = palette[index % palette.length];
      context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
    return texture;
  };
  const missionMarkers = new Map();
  const missionMarkerEffects = [];
  SPHEREX_TARGETS.forEach((target) => {
    const visual = SPHEREX_VISUALS[target.key];
    const color = new THREE.Color(visual.color);
    const markerRadius = Math.max(0.07, Math.min(0.82, 0.08 * Math.sqrt(visual.radiusSolar)));
    const marker = new THREE.Group();
    marker.position.copy(localGalacticPosition(target));
    // A quiet, softly scattered dust pocket gives the destination a sense of
    // place without obscuring the neighboring stars or the navigation marker.
    const dustPositions = [];
    const dustColors = [];
    const baseColor = new THREE.Color(color);
    for (let i = 0; i < 180; i++) {
      const angle = Math.random() * TAU;
      const radius = 2 + Math.random() ** 1.7 * 10;
      dustPositions.push(Math.cos(angle) * radius, gs() * radius * 0.36, Math.sin(angle) * radius);
      const tint = 0.35 + Math.random() * 0.6;
      dustColors.push(baseColor.r * tint, baseColor.g * tint, baseColor.b * tint);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        size: 2.8,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.3,
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
    nebula.scale.set(markerRadius * 9, markerRadius * 5.6, 1);
    marker.add(nebula);
    const corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: missionGlowMap,
        color: color.clone().lerp(new THREE.Color(0xffffff), 0.55),
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    corona.scale.setScalar(markerRadius * 4.8);
    marker.add(corona);
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
    glow.scale.setScalar(markerRadius * 2.7);
    marker.add(glow);
    const starTexture = makeMissionStarTexture(visual);
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      new THREE.MeshStandardMaterial({
        map: starTexture,
        emissive: 0xffffff,
        emissiveMap: starTexture,
        emissiveIntensity: 0.38,
        roughness: 0.92,
        metalness: 0,
      }),
    );
    star.scale.setScalar(markerRadius);
    marker.add(star);
    let companion = null;
    if (target.key === 'epsilon-indi-b') {
      const companionTexture = makeMissionStarTexture(visual, 7);
      companion = new THREE.Mesh(
        new THREE.SphereGeometry(1, 40, 28),
        new THREE.MeshStandardMaterial({
          map: companionTexture,
          emissive: 0xffffff,
          emissiveMap: companionTexture,
          emissiveIntensity: 0.32,
          roughness: 0.94,
        }),
      );
      companion.scale.setScalar(markerRadius * 0.94);
      marker.add(companion);
      const binaryTrack = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.012, 5, 80),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24 }),
      );
      binaryTrack.rotation.x = Math.PI / 2.5;
      marker.add(binaryTrack);
    }
    if (target.key === 'rw-aurigae') {
      const diskMaterial = new THREE.MeshBasicMaterial({
        color: 0xc68e56,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const disk = new THREE.Mesh(new THREE.RingGeometry(0.48, 2.2, 112), diskMaterial);
      disk.rotation.set(Math.PI / 2, 0.18, 0.26);
      marker.add(disk);
      const innerDisk = new THREE.Mesh(
        new THREE.RingGeometry(0.38, 0.56, 96),
        new THREE.MeshBasicMaterial({
          color: 0xffc477,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      innerDisk.rotation.copy(disk.rotation);
      marker.add(innerDisk);
    }
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
    starGlow.scale.setScalar(markerRadius * 3.2);
    marker.add(starGlow);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.035, 6, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34 }),
    );
    ring.scale.setScalar(markerRadius * 2.25);
    ring.rotation.x = Math.PI / 2;
    marker.add(ring);
    const label = lab(target.name);
    label.position.set(0, markerRadius * 2.5 + 0.6, 0);
    label.visible = false;
    marker.add(label);
    LB.push(label);
    gal.add(marker);
    missionMarkers.set(target.key, { target, marker, label });
    missionMarkerEffects.push({
      star,
      companion,
      markerRadius,
      visual,
      glow,
      corona,
      ring,
      starGlow,
      phase: Math.random() * TAU,
    });
  });
  // cuerpos
  const B = [];
  let earth;
  const satelliteBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9e4ed,
    metalness: 0.72,
    roughness: 0.3,
  });
  const satellitePanelMaterial = new THREE.MeshStandardMaterial({
    color: 0x315e89,
    metalness: 0.42,
    roughness: 0.38,
  });
  const goldSatelliteMaterial = new THREE.MeshStandardMaterial({
    color: 0xc89d58,
    metalness: 0.58,
    roughness: 0.38,
  });
  const satelliteBodyGeometry = new THREE.BoxGeometry(0.055, 0.052, 0.07);
  const satellitePanelGeometry = new THREE.BoxGeometry(0.12, 0.012, 0.06);
  const makeSatellite = (size = 0.04, station = false) => {
    const object = new THREE.Group();
    if (station) {
      // Compact ISS silhouette: pressurised modules along a central truss,
      // paired solar wings, radiator panels, and a small docking port.
      const truss = new THREE.Mesh(
        new THREE.BoxGeometry(1.14, 0.035, 0.035),
        goldSatelliteMaterial,
      );
      object.add(truss);
      const module = (geometry, position, material = satelliteBodyMaterial) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        object.add(mesh);
      };
      module(
        new THREE.CylinderGeometry(0.067, 0.067, 0.44, 10),
        [0, 0, -0.03],
        satelliteBodyMaterial,
      );
      module(
        new THREE.CylinderGeometry(0.055, 0.055, 0.27, 10),
        [0, 0.018, 0.32],
        goldSatelliteMaterial,
      );
      module(
        new THREE.CylinderGeometry(0.052, 0.052, 0.26, 10),
        [0, 0.018, -0.34],
        goldSatelliteMaterial,
      );
      module(new THREE.BoxGeometry(0.19, 0.065, 0.11), [0, 0.025, -0.02], satelliteBodyMaterial);
      [-1, 1].forEach((side) => {
        [-1, 1].forEach((pair) => {
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.012, 0.12),
            satellitePanelMaterial,
          );
          panel.position.set(side * 0.42, 0.018, pair * 0.14);
          object.add(panel);
          const fineLines = new THREE.Mesh(
            new THREE.BoxGeometry(0.27, 0.004, 0.006),
            satelliteBodyMaterial,
          );
          fineLines.position.set(side * 0.42, 0.026, pair * 0.14);
          object.add(fineLines);
        });
      });
      module(new THREE.CylinderGeometry(0.026, 0.035, 0.11, 8), [0, 0, 0.5], satelliteBodyMaterial);
    } else {
      object.add(new THREE.Mesh(satelliteBodyGeometry, satelliteBodyMaterial));
      [-1, 1].forEach((side) => {
        const panel = new THREE.Mesh(satellitePanelGeometry, satellitePanelMaterial);
        panel.position.x = side * 0.105;
        object.add(panel);
      });
    }
    object.scale.setScalar(size);
    return object;
  };
  const makeOrbitTrack = (radius, color, opacity = 0.38) => {
    const points = [];
    for (let step = 0; step < 128; step++) {
      const angle = (step / 128) * TAU;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
  };
  const makeMoonTexture = (moon) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = moon.base;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shading = context.createLinearGradient(0, 0, 0, canvas.height);
    shading.addColorStop(0, 'rgba(255,255,255,.18)');
    shading.addColorStop(0.5, 'rgba(255,255,255,0)');
    shading.addColorStop(1, 'rgba(0,0,0,.24)');
    context.fillStyle = shading;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Stable, deterministic surface marks keep the procedural maps consistent
    // between visits while giving each moon a distinct visual character.
    let seed = moon.seed;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (moon.name === 'Europa') {
      for (let i = 0; i < 46; i++) {
        const x = random() * canvas.width;
        const y = random() * canvas.height;
        context.beginPath();
        context.moveTo(x, y);
        context.bezierCurveTo(
          x + (random() - 0.5) * 80,
          y + 20,
          x + (random() - 0.5) * 100,
          y - 20,
          x + (random() - 0.5) * 110,
          y + (random() - 0.5) * 70,
        );
        context.strokeStyle = i % 4 === 0 ? 'rgba(151,83,67,.5)' : 'rgba(190,112,84,.3)';
        context.lineWidth = 1 + random() * 2.5;
        context.stroke();
      }
    } else {
      const count = moon.name === 'Ío' ? 55 : 95;
      for (let i = 0; i < count; i++) {
        const x = random() * canvas.width;
        const y = random() * canvas.height;
        const radius = 2 + random() * (moon.name === 'Ío' ? 10 : 15);
        const colors = moon.craterColors;
        context.beginPath();
        context.ellipse(x, y, radius * 1.4, radius, random() * Math.PI, 0, Math.PI * 2);
        context.fillStyle = colors[Math.floor(random() * colors.length)];
        context.fill();
        context.beginPath();
        context.ellipse(
          x - radius * 0.18,
          y - radius * 0.2,
          radius * 0.78,
          radius * 0.55,
          0,
          0,
          Math.PI * 2,
        );
        context.fillStyle = 'rgba(255,235,195,.12)';
        context.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
    return texture;
  };
  const makeDwarfTexture = (planet) => {
    const width = 1024;
    const height = 512;
    const sampleWidth = 512;
    const sampleHeight = 256;
    const canvas = document.createElement('canvas');
    const reliefCanvas = document.createElement('canvas');
    const baseCanvas = document.createElement('canvas');
    const baseReliefCanvas = document.createElement('canvas');
    canvas.width = reliefCanvas.width = width;
    canvas.height = reliefCanvas.height = height;
    const context = canvas.getContext('2d');
    const reliefContext = reliefCanvas.getContext('2d');
    baseCanvas.width = baseReliefCanvas.width = sampleWidth;
    baseCanvas.height = baseReliefCanvas.height = sampleHeight;
    const baseContext = baseCanvas.getContext('2d');
    const baseReliefContext = baseReliefCanvas.getContext('2d');
    const image = baseContext.createImageData(sampleWidth, sampleHeight);
    const relief = baseReliefContext.createImageData(sampleWidth, sampleHeight);
    const palettes = {
      Ceres: [
        [43, 42, 40],
        [91, 87, 80],
        [142, 136, 126],
        [184, 178, 163],
      ],
      Plutón: [
        [76, 48, 42],
        [132, 83, 66],
        [184, 132, 105],
        [225, 194, 158],
      ],
      Haumea: [
        [72, 76, 74],
        [132, 139, 136],
        [195, 201, 195],
        [233, 233, 222],
      ],
      Makemake: [
        [76, 40, 34],
        [130, 66, 51],
        [181, 108, 82],
        [221, 169, 129],
      ],
      Eris: [
        [102, 105, 103],
        [151, 154, 151],
        [198, 200, 195],
        [232, 231, 222],
      ],
    };
    const palette = palettes[planet.n] || [
      [planet.c[0] * 0.45, planet.c[1] * 0.45, planet.c[2] * 0.45],
      planet.c,
      [planet.c[0] * 1.18, planet.c[1] * 1.18, planet.c[2] * 1.18],
      [230, 220, 205],
    ];
    let seed = planet.seed;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const seedOffset = planet.seed * 0.013;
    const interpolate = (a, b, amount) => a + (b - a) * amount;
    for (let y = 0; y < sampleHeight; y++) {
      const v = y / sampleHeight;
      for (let x = 0; x < sampleWidth; x++) {
        const u = x / sampleWidth;
        const broad = fbm(u + seedOffset, v + seedOffset * 0.31, 4.5);
        const detail = fbm(u + seedOffset * 0.7, v + seedOffset * 0.9, 27);
        const latitude = planet.n === 'Eris' ? Math.abs(v - 0.5) * 0.2 : 0;
        let tone = THREE.MathUtils.clamp(
          0.5 + (broad - 0.5) * 2.1 + (detail - 0.5) * 1.1 + latitude,
          0,
          0.999,
        );
        const band = Math.min(2, Math.floor(tone * 3));
        const blend = tone * 3 - band;
        const color = palette[3].map((channel, index) =>
          interpolate(palette[band][index], palette[band + 1][index], blend),
        );
        const pixel = (y * sampleWidth + x) * 4;
        image.data[pixel] = color[0];
        image.data[pixel + 1] = color[1];
        image.data[pixel + 2] = color[2];
        image.data[pixel + 3] = 255;
        const heightValue = THREE.MathUtils.clamp(
          110 + (broad - 0.5) * 110 + (detail - 0.5) * 54,
          0,
          255,
        );
        relief.data[pixel] = relief.data[pixel + 1] = relief.data[pixel + 2] = heightValue;
        relief.data[pixel + 3] = 255;
      }
    }
    baseContext.putImageData(image, 0, 0);
    baseReliefContext.putImageData(relief, 0, 0);
    context.drawImage(baseCanvas, 0, 0, width, height);
    reliefContext.drawImage(baseReliefCanvas, 0, 0, width, height);

    const craterCount =
      { Ceres: 205, Plutón: 170, Haumea: 110, Makemake: 150, Eris: 185 }[planet.n] || 140;
    for (let index = 0; index < craterCount; index++) {
      const x = random() * width;
      const y = random() * height;
      const radius = 2 + Math.pow(random(), 2.1) * 37;
      const flatten = 0.65 + random() * 0.65;
      const rotation = random() * Math.PI;
      const shadow = context.createRadialGradient(
        x - radius * 0.18,
        y - radius * 0.2,
        radius * 0.12,
        x,
        y,
        radius,
      );
      shadow.addColorStop(0, 'rgba(18,18,20,.48)');
      shadow.addColorStop(0.48, 'rgba(28,25,24,.22)');
      shadow.addColorStop(0.74, 'rgba(245,235,218,.35)');
      shadow.addColorStop(1, 'rgba(20,18,18,0)');
      context.beginPath();
      context.ellipse(x, y, radius, radius * flatten, rotation, 0, TAU);
      context.fillStyle = shadow;
      context.fill();

      const reliefGradient = reliefContext.createRadialGradient(x, y, radius * 0.28, x, y, radius);
      reliefGradient.addColorStop(0, 'rgba(32,32,32,.7)');
      reliefGradient.addColorStop(0.68, 'rgba(72,72,72,.3)');
      reliefGradient.addColorStop(0.84, 'rgba(238,238,238,.62)');
      reliefGradient.addColorStop(1, 'rgba(128,128,128,0)');
      reliefContext.beginPath();
      reliefContext.ellipse(x, y, radius, radius * flatten, rotation, 0, TAU);
      reliefContext.fillStyle = reliefGradient;
      reliefContext.fill();
    }
    if (planet.n === 'Plutón') {
      // Broad, irregular bright ice plains inspired by Tombaugh Regio.
      context.beginPath();
      context.moveTo(570, 192);
      context.bezierCurveTo(618, 111, 700, 121, 735, 170);
      context.bezierCurveTo(793, 115, 872, 151, 855, 205);
      context.bezierCurveTo(838, 259, 745, 285, 694, 258);
      context.bezierCurveTo(633, 293, 556, 256, 570, 192);
      context.fillStyle = 'rgba(255,230,194,.54)';
      context.fill();
      context.strokeStyle = 'rgba(246,214,180,.3)';
      context.lineWidth = 10;
      context.stroke();
      const ice = context.createRadialGradient(713, 204, 14, 713, 204, 150);
      ice.addColorStop(0, 'rgba(255,241,211,.28)');
      ice.addColorStop(1, 'rgba(255,241,211,0)');
      context.fillStyle = ice;
      context.fillRect(548, 94, 332, 230);
    } else if (planet.n === 'Ceres') {
      [
        [488, 232, 22],
        [493, 229, 11],
        [211, 326, 8],
        [793, 117, 6],
      ].forEach(([x, y, radius]) => {
        const salt = context.createRadialGradient(x, y, 1, x, y, radius * 2.8);
        salt.addColorStop(0, 'rgba(255,255,244,.96)');
        salt.addColorStop(0.3, 'rgba(251,249,232,.78)');
        salt.addColorStop(1, 'rgba(245,241,224,0)');
        context.fillStyle = salt;
        context.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);
      });
    } else if (planet.n === 'Haumea') {
      context.save();
      context.translate(562, 246);
      context.rotate(-0.22);
      const dark = context.createRadialGradient(0, 0, 14, 0, 0, 146);
      dark.addColorStop(0, 'rgba(108,52,43,.55)');
      dark.addColorStop(1, 'rgba(108,52,43,0)');
      context.fillStyle = dark;
      context.fillRect(-160, -75, 320, 150);
      context.restore();
      context.strokeStyle = 'rgba(255,255,245,.25)';
      context.lineWidth = 2;
      for (let groove = 0; groove < 24; groove++) {
        const y = random() * height;
        const x = random() * width;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(
          x + 18 + random() * 70,
          y - 8 + random() * 16,
          x + 48 + random() * 95,
          y + random() * 14,
        );
        context.stroke();
      }
    } else if (planet.n === 'Makemake') {
      for (let patch = 0; patch < 34; patch++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 18 + random() * 74;
        const frost = context.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        frost.addColorStop(0, random() > 0.5 ? 'rgba(242,213,171,.3)' : 'rgba(72,35,31,.24)');
        frost.addColorStop(1, 'rgba(100,50,40,0)');
        context.fillStyle = frost;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    const bumpTexture = new THREE.CanvasTexture(reliefCanvas);
    texture.encoding = THREE.sRGBEncoding;
    const anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
    texture.anisotropy = bumpTexture.anisotropy = anisotropy;
    return { map: texture, bumpMap: bumpTexture };
  };
  P.forEach((p) => {
    const dwarfSurface = p.dwarf ? makeDwarfTexture(p) : null;
    const pivot = new THREE.Group(),
      tilt = new THREE.Group(),
      mat = p.sun
        ? new THREE.MeshBasicMaterial({ map: sunTexture(p) })
        : new THREE.MeshStandardMaterial({
            map: dwarfSurface
              ? dwarfSurface.map
              : loadTexture(PLANET_TEXTURE_FILES[p.n], true, p.n),
            roughness: p.n === 'Venus' ? 0.88 : 0.96,
            metalness: 0,
            ...(dwarfSurface ? { bumpMap: dwarfSurface.bumpMap, bumpScale: 0.022 } : {}),
            ...(p.n === 'Tierra'
              ? {
                  normalMap: loadTexture('2k_earth_normal_map.jpg', false),
                  normalScale: new THREE.Vector2(0.11, 0.11),
                }
              : {}),
          }),
      spin = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
    if (p.shape) spin.scale.y = p.shape;
    tilt.rotation.z = ((p.tilt || 0) * Math.PI) / 180;
    tilt.add(spin);
    if (p.n === 'Tierra' || p.n === 'Venus') {
      const isEarth = p.n === 'Tierra';
      const atmosphericMap = loadTexture(
        isEarth ? '2k_earth_clouds.jpg' : '2k_venus_atmosphere.jpg',
      );
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.009, 64, 48),
        new THREE.MeshStandardMaterial({
          map: atmosphericMap,
          alphaMap: isEarth ? atmosphericMap : null,
          color: isEarth ? 0xffffff : 0xffe5c2,
          transparent: true,
          opacity: isEarth ? 0.76 : 0.52,
          roughness: 1,
          metalness: 0,
          depthWrite: false,
          side: THREE.FrontSide,
        }),
      );
      spin.add(atmosphere);
    }
    if (p.n === 'Urano' || p.n === 'Neptuno') {
      // Thin limb haze gives the ice giants depth without turning their
      // atmospheres into a bright, opaque blue shell.
      const atmosphereColor = p.n === 'Urano' ? 0x8fe8ed : 0x4e9dff;
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.035, 64, 48),
        new THREE.ShaderMaterial({
          uniforms: { glowColor: { value: new THREE.Color(atmosphereColor) } },
          vertexShader: `varying vec3 vNormal; varying vec3 vViewDirection;
            void main() {
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vViewDirection = normalize(-viewPosition.xyz);
              gl_Position = projectionMatrix * viewPosition;
            }`,
          fragmentShader: `uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vViewDirection;
            void main() {
              float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 3.0);
              gl_FragColor = vec4(glowColor, rim * 0.34);
            }`,
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      spin.add(atmosphere);
    }
    pivot.add(tilt);
    sc.add(pivot);
    const b = { p, pivot, tilt, spin };
    if (p.n === 'Tierra') {
      // Illustrative, visually compressed orbital planes: the satellites are
      // intentionally small and are not positional/ephemeris data.
      const system = new THREE.Group();
      pivot.add(system);
      b.satelliteSystem = system;
      b.satellites = [];
      const constellation = [
        {
          name: 'STARLINK',
          count: 28,
          radius: 1.18,
          inclination: 0.28,
          period: 0.0667,
          color: 0x68caff,
        },
        {
          name: 'STARLINK',
          count: 26,
          radius: 1.38,
          inclination: 0.72,
          period: 0.071,
          color: 0x68caff,
        },
        {
          name: 'STARLINK',
          count: 24,
          radius: 1.6,
          inclination: 1.02,
          period: 0.076,
          color: 0x68caff,
        },
        {
          name: 'STARLINK',
          count: 20,
          radius: 1.82,
          inclination: 1.31,
          period: 0.079,
          color: 0x68caff,
        },
        {
          name: 'ISS · Estación Espacial Internacional',
          count: 1,
          radius: 1.9,
          inclination: 0.9,
          period: 0.0646,
          color: 0xffc979,
          station: true,
          size: 0.055,
        },
        {
          name: 'Hubble · NASA/ESA',
          count: 1,
          radius: 2.16,
          inclination: 0.35,
          period: 0.066,
          color: 0xe6efff,
          size: 0.055,
        },
      ];
      constellation.forEach((orbit, orbitIndex) => {
        const plane = new THREE.Group();
        plane.rotation.set(orbit.inclination, 0, orbitIndex * 0.71);
        system.add(plane);
        const objects = [];
        for (let index = 0; index < orbit.count; index++) {
          const satellite = makeSatellite(orbit.size || 0.04, orbit.station);
          plane.add(satellite);
          objects.push({ object: satellite, phase: (index / orbit.count) * TAU });
        }
        if (orbit.name !== 'STARLINK' || orbitIndex === 0) {
          const label = lab(orbit.name === 'STARLINK' ? 'STARLINK' : orbit.name, 0.15, 18);
          label.position.set(0, orbit.radius + 0.16, 0);
          label.visible = false;
          plane.add(label);
          LB.push(label);
        }
        b.satellites.push({ ...orbit, plane, objects });
      });
    }
    if (p.n === 'Júpiter') {
      // The Galilean moons and their tracks are drawn at an expanded visual
      // scale so they remain legible beside the compressed planetary orbits.
      const system = new THREE.Group();
      pivot.add(system);
      b.moonSystem = system;
      b.jupiterMoons = [
        {
          name: 'Ío',
          radius: 2.05,
          size: 0.15,
          period: 1.769,
          inclination: 0.0035,
          base: '#bd8c42',
          seed: 17,
          craterColors: ['rgba(255,216,98,.42)', 'rgba(187,82,36,.32)', 'rgba(88,53,35,.25)'],
          phase: 0.4,
        },
        {
          name: 'Europa',
          radius: 2.75,
          size: 0.13,
          period: 3.551,
          inclination: 0.0082,
          base: '#c9c3ad',
          seed: 31,
          phase: 2.1,
        },
        {
          name: 'Ganímedes',
          radius: 3.65,
          size: 0.22,
          period: 7.155,
          inclination: 0.0041,
          base: '#817a6e',
          seed: 47,
          craterColors: ['rgba(47,48,46,.35)', 'rgba(183,164,133,.3)', 'rgba(107,88,67,.3)'],
          phase: 3.8,
        },
        {
          name: 'Calisto',
          radius: 4.75,
          size: 0.19,
          period: 16.689,
          inclination: 0.0087,
          base: '#514b43',
          seed: 63,
          craterColors: ['rgba(21,22,22,.45)', 'rgba(158,145,126,.25)', 'rgba(86,74,62,.4)'],
          phase: 5.1,
        },
      ].map((moon) => {
        const moonPivot = new THREE.Group();
        moonPivot.rotation.x = moon.inclination;
        system.add(moonPivot);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(moon.size, 20, 14),
          new THREE.MeshStandardMaterial({
            map: makeMoonTexture(moon),
            roughness: 0.88,
            metalness: 0,
          }),
        );
        moonPivot.add(mesh);
        const label = lab(moon.name, 0.12, 16);
        label.position.set(0, moon.size * 2.4, 0);
        label.visible = false;
        moonPivot.add(label);
        LB.push(label);
        return { ...moon, moonPivot, mesh };
      });
    }
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
        new THREE.LineBasicMaterial({
          color: p.dwarf ? 0xa58ad7 : 0x5a7090,
          transparent: true,
          opacity: 0.5,
        }),
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
  // Belt made from instanced, irregular 3D bodies instead of point sprites.
  const belt = new THREE.Group();
  const asteroidMeshes = [];
  const asteroidRecords = [];
  const asteroidPalette = [0x887c70, 0x9c8d7a, 0x6e6c68, 0xa09382, 0x776454, 0xaaa196];
  const asteroidVariantCount = 8;
  const asteroidCountPerVariant = 110;
  let asteroidSeed = 92071;
  const asteroidRandom = () => {
    asteroidSeed = (asteroidSeed * 1664525 + 1013904223) >>> 0;
    return asteroidSeed / 4294967296;
  };
  for (let variant = 0; variant < asteroidVariantCount; variant++) {
    const geometries = [
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.DodecahedronGeometry(1, 1),
      new THREE.OctahedronGeometry(1, 1),
      new THREE.IcosahedronGeometry(1, 2),
    ];
    const geometry = geometries[variant % geometries.length];
    const positions = geometry.attributes.position;
    const vertexSeed = 1789 + variant * 7919;
    let vertexState = vertexSeed;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      vertexState = (vertexState * 1664525 + 1013904223) >>> 0;
      const roughness = 0.78 + (vertexState / 4294967296) * 0.42;
      positions.setXYZ(
        vertex,
        positions.getX(vertex) * roughness,
        positions.getY(vertex) * roughness,
        positions.getZ(vertex) * roughness,
      );
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.035,
      vertexColors: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, asteroidCountPerVariant);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    belt.add(mesh);
    asteroidMeshes.push(mesh);
    for (let index = 0; index < asteroidCountPerVariant; index++) {
      const au = 2.05 + asteroidRandom() * 1.25;
      const radiusKm = 0.5 + Math.pow(asteroidRandom(), 2.1) * 469;
      const visualRadius = 0.009 + Math.pow(radiusKm / 469, 0.58) * 0.066;
      const color = new THREE.Color(
        asteroidPalette[Math.floor(asteroidRandom() * asteroidPalette.length)],
      );
      color.multiplyScalar(0.82 + asteroidRandom() * 0.34);
      mesh.setColorAt(index, color);
      asteroidRecords.push({
        mesh,
        index,
        au,
        radiusKm,
        visualRadius,
        phase: asteroidRandom() * TAU,
        inclination: (asteroidRandom() - 0.5) * 0.13,
        period: 365.25 * Math.pow(au, 1.5),
        spin: asteroidRandom() * TAU,
        spinRate: (asteroidRandom() - 0.5) * 0.9,
        shape: new THREE.Vector3(
          0.78 + asteroidRandom() * 0.42,
          0.72 + asteroidRandom() * 0.52,
          0.78 + asteroidRandom() * 0.42,
        ),
      });
    }
  }
  sc.add(belt);
  const asteroidDummy = new THREE.Object3D();
  let real = false;
  let sim = T0();
  function updateAsteroids(day) {
    asteroidRecords.forEach((asteroid) => {
      const angle = asteroid.phase + (day / asteroid.period) * TAU;
      const radius = asteroid.au / 2.7;
      asteroidDummy.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * Math.sin(asteroid.inclination),
        Math.sin(angle) * radius,
      );
      asteroidDummy.rotation.set(
        asteroid.spin + day * asteroid.spinRate * 0.0008,
        asteroid.phase,
        asteroid.inclination,
      );
      const size = real ? asteroid.radiusKm / 1e6 / Dd(2.7) : asteroid.visualRadius / Dd(2.7);
      asteroidDummy.scale.set(
        size * asteroid.shape.x,
        size * asteroid.shape.y,
        size * asteroid.shape.z,
      );
      asteroidDummy.updateMatrix();
      asteroid.mesh.setMatrixAt(asteroid.index, asteroidDummy.matrix);
    });
    asteroidMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  const Rd = (p) =>
      p.sun
        ? real
          ? p.km / 1e6
          : 4
        : real
          ? p.km / 1e6
          : p.dwarf
            ? Math.max(0.075, 0.35 * (p.km / 6371))
            : 0.35 * (p.km / 6371),
    Dd = (au) => (real ? au * 149.6 : 14 + 16 * Math.pow(au, 0.62)),
    Dm = () => (real ? 0.3844 : 1.3),
    shipScale = () => (Rd(P[3]) * (SHIP_LENGTH_METERS / 1000)) / (P[3].km * SHIP_MODEL_LENGTH),
    // Keep the external follow camera at a planet-relative distance; a
    // hull-relative camera makes even a physically small ship fill the view.
    shipCameraDistance = () => {
      let distance = Math.max(shipSz * 16, Rd(P[3]) * 0.08, real ? 0.04 : 0.025);
      const solarViewLimit = Dd(30.07) * 2;
      // Frame the ship against nearby planetary bodies by angular size, not
      // only by distance to the hull. This stops it appearing oversized when
      // a planet is farther away in the shot.
      B.forEach((body) => {
        if (!body.p.au || body.r <= 0) return;
        const bodyDistance = sp.distanceTo(body.pivot.position);
        if (bodyDistance < solarViewLimit) {
          distance = Math.max(distance, (shipSz * 64 * bodyDistance) / body.r);
        }
      });
      // Keep the physically scaled hull large enough to recognize in the
      // default chase view. Zoom can still pull back to inspect system scale.
      distance = Math.min(distance, shipSz * 220);
      return distance * shipZoom;
    },
    // The exterior follow camera uses the same frame distance so the craft
    // remains visible while its angular size stays small beside the planets.
    shipOffset = () => shipCameraDistance();
  function layout() {
    B.forEach((b) => {
      const r = Rd(b.p);
      b.tilt.scale.setScalar(r);
      b.r = r;
      if (b.orbit) b.orbit.scale.setScalar(Dd(b.p.au) / b.p.au);
      if (b.glow) b.glow.scale.setScalar(r * (real ? 40 : 6));
      if (b.satelliteSystem) b.satelliteSystem.scale.setScalar(r);
      if (b.moonSystem) b.moonSystem.scale.setScalar(r);
    });
    belt.scale.setScalar(Dd(2.7));
    updateAsteroids(sim);
    ct.minDistance = 0.0005;
  }
  let foc = null,
    tw = null,
    nav = null,
    nearKey = null,
    activeMissionKey = null,
    nearbyMapState = null,
    nearbySelectedKey = 'milky-way',
    nearbyMapRotation = 0;
  const nearbyRaycaster = new THREE.Raycaster();
  const nearbyPointer = new THREE.Vector2();
  const nearbyMarkerWorld = new THREE.Vector3();
  let nearbyPointerStart = null;
  function nearbyMap() {
    if (nearbyMapState) return;
    nearbyMapState = {
      camera: cam.position.clone(),
      target: ct.target.clone(),
      enabled: ct.enabled,
      free,
      spectator,
      visibility: sc.children.map((child) => [child, child.visible]),
      minDistance: ct.minDistance,
      maxDistance: ct.maxDistance,
    };
    nav = null;
    tw = null;
    free = false;
    spectator = false;
    ct.enabled = true;
    S.fr(false);
    S.intro(false);
    S.f(null);
    nearbyMapState.visibility.forEach(([child]) => {
      child.visible = false;
    });
    nearbyGalaxyGroup.visible = true;
    nearbyGalaxyGroup.position.set(0, 0, 0);
    nearbyGalaxyGroup.quaternion.copy(gal.quaternion);
    ct.minDistance = 90;
    ct.maxDistance = 2400;
    const center = new THREE.Vector3();
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: center.clone().add(new THREE.Vector3(0, 270, 650)),
      t1: center,
      k: 0,
    };
  }
  function returnFromNearbyMap() {
    if (!nearbyMapState) return;
    const saved = nearbyMapState;
    nearbyMapState = null;
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: saved.camera,
      t1: saved.target,
      k: 0,
    };
    saved.visibility.forEach(([child, visible]) => {
      child.visible = visible;
    });
    ct.enabled = saved.enabled;
    ct.minDistance = saved.minDistance;
    ct.maxDistance = saved.maxDistance;
    free = saved.free;
    spectator = saved.spectator;
    S.fr(saved.free || saved.spectator);
    S.intro(saved.free);
  }
  function focusNearbyGalaxy(key) {
    if (!nearbyMapState) nearbyMap();
    const marker = nearbyGalaxyMarkers.get(key);
    if (!marker) return;
    nearbySelectedKey = key;
    const target = marker.getWorldPosition(new THREE.Vector3());
    const direction = cam.position.clone().sub(ct.target);
    if (direction.lengthSq() < 1e-8) direction.set(0.18, 0.32, 1);
    direction.normalize();
    const distance = key === 'milky-way' ? 360 : 150;
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: target.clone().addScaledVector(direction, distance),
      t1: target,
      k: 0,
    };
  }
  function focusSolarSystemMap() {
    if (!nearbyMapState) nearbyMap();
    nearbySelectedKey = 'milky-way';
    solarSystemLabel.visible = true;
    const target = solarSystemMapMarker.getWorldPosition(new THREE.Vector3());
    const direction = cam.position.clone().sub(ct.target);
    if (direction.lengthSq() < 1e-8) direction.set(0.18, 0.32, 1);
    direction.normalize();
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: target.clone().addScaledVector(direction, 58),
      t1: target,
      k: 0,
    };
  }
  function tripTo(target, clearance, name, b, onArrive, respectSpeed = false) {
    const motionFactor = S.reducedMotion?.() ? 0.45 : 1;
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
      align: Math.min(1.7, Math.max(0.7, 0.8 + distance / (speed * 10))) * motionFactor,
      duration: respectSpeed
        ? Math.min(16, Math.max(2, distance / speed)) * motionFactor
        : Math.min(
            16,
            Math.max(2, distance / (speed * (long ? Math.max(1, distance / (speed * 8)) : 1))),
          ) * motionFactor,
      motionFactor,
      distance,
      long,
      respectSpeed,
      oldFs: fs,
      onArrive,
    };
    if (long && !respectSpeed) S.fv(Math.min(5e4, Math.max(fs, distance / nav.duration)));
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
      Math.max(22, Math.min(60, visualDistanceInMapUnits(found.target.distanceLy) * 0.04)),
      found.target.name,
      null,
      () => {
        found.label.visible = true;
        if (onArrive) onArrive();
      },
      true,
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
  const clk = new THREE.Clock(),
    keys = {},
    V = THREE.Vector3;
  let free = false,
    spectator = false,
    launchSequence = null,
    launchCameraBlend = null,
    shipZoom = 1,
    fy = 0,
    fp = 0,
    fs = 1,
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
      color: 0xcbd9e8,
      metalness: 0.68,
      roughness: 0.28,
      emissive: 0x182c40,
    }),
    em = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff6622 }),
    cm = new THREE.MeshStandardMaterial({
      color: 0x70d8ff,
      metalness: 0.36,
      roughness: 0.16,
      emissive: 0x164566,
    }),
    wingMat = new THREE.MeshStandardMaterial({
      color: 0x526a82,
      metalness: 0.7,
      roughness: 0.34,
      emissive: 0x101d2a,
      side: THREE.DoubleSide,
    }),
    sa = (g, m, x, y, z, rx) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.rotation.x = rx || 0;
      ship.add(o);
    };
  sa(new THREE.ConeGeometry(0.3, 1, 24), sm, 0, 0, -0.7, -Math.PI / 2);
  sa(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 24), sm, 0, 0, 0.4, Math.PI / 2);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.08, -0.22);
  wingShape.lineTo(0.3, -0.02);
  wingShape.lineTo(1.13, 0.45);
  wingShape.lineTo(1.06, 0.68);
  wingShape.lineTo(0.34, 0.43);
  wingShape.lineTo(0.27, 0.94);
  wingShape.lineTo(0.06, 0.8);
  wingShape.closePath();
  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.022,
    bevelThickness: 0.018,
  });
  [-1, 1].forEach((direction) => {
    const wing = new THREE.Mesh(wingGeometry, wingMat);
    wing.scale.x = direction;
    wing.rotation.x = Math.PI / 2;
    wing.position.set(0, -0.055, 0.32);
    ship.add(wing);
  });
  sa(new THREE.BoxGeometry(0.035, 0.022, 0.48), em, -0.76, -0.045, 0.74);
  sa(new THREE.BoxGeometry(0.035, 0.022, 0.48), em, 0.76, -0.045, 0.74);
  sa(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 16), em, -0.4, 0, 1, Math.PI / 2);
  sa(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 16), em, 0.4, 0, 1, Math.PI / 2);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), cm);
  cockpit.scale.set(0.21, 0.17, 0.34);
  cockpit.position.set(0, 0.17, -0.29);
  ship.add(cockpit);
  const cockpitFrame = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 8, 32), sm);
  cockpitFrame.scale.set(1, 0.82, 1.48);
  cockpitFrame.position.set(0, 0.17, -0.29);
  ship.add(cockpitFrame);
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
  sa(new THREE.CylinderGeometry(0.16, 0.24, 0.4, 24, 1, true), dm, 0, -0.02, 1.03, Math.PI / 2);
  const mainEngineRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.035, 8, 32),
    new THREE.MeshStandardMaterial({
      color: 0x87dfff,
      emissive: 0x1d83bc,
      metalness: 0.5,
      roughness: 0.24,
    }),
  );
  mainEngineRim.position.set(0, -0.02, 1.25);
  ship.add(mainEngineRim);
  sa(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), dm, 0, 0.36, 0.45, Math.PI / 2);
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
  function setFree(on, launchFromEarth = false) {
    spectator = false;
    free = on;
    ct.enabled = !on;
    if (on) {
      foc = null;
      S.f(null);
      tw = null;
      launchSequence = null;
      launchCameraBlend = null;
      if (launchFromEarth) nav = null;
      if (launchFromEarth && earth) {
        const radial = new V(0, 1, 0);
        if (sp.lengthSq()) radial.copy(sp).sub(earth.pivot.position);
        if (radial.lengthSq() < 1e-10) radial.set(0, 1, 0);
        radial.normalize();
        const tangent = new V(0, 0, 1).cross(radial);
        if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0).cross(radial);
        tangent.normalize();
        const launchQ = new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), radial);
        shipSz = shipScale();
        sp.copy(earth.pivot.position).addScaledVector(radial, earth.r * 1.005);
        launchSequence = {
          elapsed: 0,
          duration: 5.5,
          radial,
          cameraOffset: radial
            .clone()
            .add(tangent)
            .multiplyScalar(shipSz * 220),
          startRadius: earth.r * 1.005,
          endRadius: earth.r * 6,
        };
        cam.position.copy(sp).add(launchSequence.cameraOffset);
        cam.lookAt(sp);
        fy = new THREE.Euler().setFromQuaternion(launchQ, 'YXZ').y;
        fp = new THREE.Euler().setFromQuaternion(launchQ, 'YXZ').x;
      } else if (earth && cam.position.length() > Dd(earth.p.au) * 3) {
        // The overview camera starts several AU away. Board near Earth's
        // orbit so the first view reads as a spacecraft-scale perspective.
        const standOff = Math.max(earth.r * 12, Dm());
        sp.copy(earth.pivot.position).add(new V(standOff, 0, 0));
        cam.position.copy(sp);
        cam.lookAt(earth.pivot.position);
      } else {
        sp.copy(cam.position);
      }
      if (!launchSequence) {
        const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
        fy = e.y;
        fp = e.x;
      }
      shipSz = shipScale();
      fs = launchSequence
        ? Math.max(0.01, earth.r * 0.5)
        : Math.max(0.01, Math.min(5e4, cam.position.distanceTo(ct.target) * 0.4));
      S.fv(fs);
      ti = 0;
      vel.set(0, 0, 0);
      TB.fill(-99);
      tr.visible = true;
      S.intro(true);
    } else {
      launchSequence = null;
      launchCameraBlend = null;
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
    const d = shipCameraDistance(),
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
    shipSz = shipScale();
    fs = [3000, 300, 30][k];
    S.fv(fs);
  }
  let speedNoticeTimer;
  const onPointerDown = (e) => {
    if (nearbyMapState) nearbyPointerStart = { x: e.clientX, y: e.clientY };
    if (free) {
      drag = 1;
      dom.setPointerCapture(e.pointerId);
    }
  };
  const onPointerUp = (e) => {
    drag = 0;
    if (nearbyMapState && nearbyPointerStart) {
      const moved = Math.hypot(e.clientX - nearbyPointerStart.x, e.clientY - nearbyPointerStart.y);
      nearbyPointerStart = null;
      if (moved < 6) {
        const rect = dom.getBoundingClientRect();
        nearbyPointer.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        nearbyRaycaster.setFromCamera(nearbyPointer, cam);
        const hits = nearbyRaycaster.intersectObjects(
          [...nearbyGalaxyMarkers.values()].flatMap((g) => g.children),
          true,
        );
        const key = hits
          .map((hit) => {
            let node = hit.object;
            while (node && !node.userData.nearbyGalaxyKey) node = node.parent;
            return node?.userData.nearbyGalaxyKey;
          })
          .find(Boolean);
        if (key) {
          focusNearbyGalaxy(key);
          S.onNearbyGalaxySelect?.(key);
        }
      }
    }
  };
  const onPointerMove = (e) => {
    if (free && drag && !launchSequence && !launchCameraBlend) {
      fy -= e.movementX * 0.003;
      fp = Math.max(-1.55, Math.min(1.55, fp - e.movementY * 0.003));
      yw = Math.max(-80, Math.min(80, yw + e.movementX));
      yp = Math.max(-80, Math.min(80, yp + e.movementY));
    }
  };
  const onWheel = (e) => {
    if (free) {
      e.preventDefault();
      if (pv == 3) {
        shipZoom = Math.max(0.1, Math.min(100, shipZoom * (e.deltaY < 0 ? 0.8 : 1.25)));
      } else {
        fs = Math.max(0.01, Math.min(5e4, fs * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        S.fv(fs);
        clearTimeout(speedNoticeTimer);
        speedNoticeTimer = setTimeout(() => S.speedNotice(fs), 700);
      }
    }
  };
  const onKeyDown = (e) => {
    keys[e.key.toLowerCase()] = 1;
  };
  const onKeyUp = (e) => {
    delete keys[e.key.toLowerCase()];
  };
  const onResize = () => {
    R.setPixelRatio(pixelRatioFor(qualityMode));
    R.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
  };
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('resize', onResize);
  function tick() {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clk.getDelta(), 0.1),
      spd = S.pause.current ? 0 : S.speed.current;
    const deepSkyVisibility =
      0.55 + 0.45 * THREE.MathUtils.smoothstep(cam.position.length(), 1800, 10000);
    deepGalaxyMaterials.forEach((material) => {
      material.opacity = deepSkyVisibility * 0.68;
    });
    sim += dt * spd;
    S.day(sim);
    updateAsteroids(sim);
    if (S.onNavigation && clk.elapsedTime - lastNavigationPublish > 0.18) {
      lastNavigationPublish = clk.elapsedTime;
      if (!nav && lastNavigationHadNav) {
        lastNavigationHadNav = false;
        S.onNavigation(null);
      } else if (nav) {
        lastNavigationHadNav = true;
        const progress =
          nav.phase === 'align'
            ? Math.min(0.15, (nav.elapsed / nav.align) * 0.15)
            : nav.phase === 'transit'
              ? 0.15 + Math.min(0.68, (nav.elapsed / nav.duration) * 0.68)
              : nav.phase === 'jumpin'
                ? 0.88 + Math.min(0.08, (nav.elapsed / (0.38 * nav.motionFactor)) * 0.08)
                : nav.phase === 'arrival'
                  ? 0.96 + Math.min(0.04, (nav.elapsed / (0.9 * nav.motionFactor)) * 0.04)
                  : 0.1;
        S.onNavigation({ phase: nav.phase, progress });
      }
    }
    const fl = S.fl.current,
      solarOrbitVisibility = fl.orb
        ? 1 - THREE.MathUtils.smoothstep(cam.position.length(), 150, 240)
        : 0;
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
      if (b.satellites) {
        b.satellites.forEach((plane) => {
          const orbitAngle = ((sim * SATELLITE_VISUAL_TIME_SCALE) / plane.period) * TAU;
          plane.objects.forEach(({ object, phase }) => {
            const angle = orbitAngle + phase;
            object.position.set(Math.cos(angle) * plane.radius, 0, Math.sin(angle) * plane.radius);
            object.rotation.y = -angle;
          });
        });
      }
      if (b.jupiterMoons) {
        b.jupiterMoons.forEach((moon) => {
          const angle = (sim / moon.period) * TAU + moon.phase;
          moon.moonPivot.position.set(
            Math.cos(angle) * moon.radius,
            0,
            Math.sin(angle) * moon.radius,
          );
          // The Galilean moons are tidally locked: one axial turn per orbit.
          moon.mesh.rotation.y = -angle;
        });
      }
      if (!p.moon) {
        const rate = ((TAU * 24) / p.rot) * spd;
        b.spin.rotation.y += rate * dt;
      }
      b.lab.visible = !!fl.lab;
      b.ax.visible = !!fl.ax;
      if (b.orbit) {
        b.orbit.material.opacity = 0.5 * solarOrbitVisibility;
        b.orbit.visible = solarOrbitVisibility > 0.01;
      }
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
      if (launchSequence) {
        const launch = launchSequence;
        launch.elapsed = Math.min(launch.duration, launch.elapsed + dt);
        const progress = launch.elapsed / launch.duration,
          eased = progress * progress * (3 - 2 * progress),
          previous = sp.clone(),
          radius = launch.startRadius + (launch.endRadius - launch.startRadius) * eased;
        sp.copy(earth.pivot.position).addScaledVector(launch.radial, radius);
        vel.copy(sp).sub(previous).divideScalar(Math.max(dt, 1e-4));
        if (progress >= 1) {
          launchSequence = null;
          launchCameraBlend = {
            elapsed: 0,
            duration: 0.9,
            fromPosition: cam.position.clone(),
            fromQuaternion: cam.quaternion.clone(),
          };
          vel.set(0, 0, 0);
          ti = 4.1;
          S.intro(false);
        }
      } else {
        vel.lerp(
          f
            .multiplyScalar(mx * bs)
            .addScaledVector(cam.up, (ok ? mv.y : 0) * bs)
            .addScaledVector(r, (ok ? mv.z : 0) * bs),
          1 - Math.exp(-dt * (O.in ? 1.2 : 14)),
        );
        sp.addScaledVector(vel, dt);
      }
      ac += (vel.distanceTo(pvl) / Math.max(dt, 1e-4) - ac) * Math.min(1, dt * 8);
      if (nav) {
        nav.elapsed += dt;
        if (nav.phase === 'arrival') {
          sp.copy(nav.to);
          vel.multiplyScalar(Math.exp(-dt * 7));
          q.copy(nav.q);
          if (nav.elapsed >= 0.9 * nav.motionFactor) {
            const oldFs = nav.oldFs;
            const restoreAutoSpeed = !nav.respectSpeed;
            const onArrive = nav.onArrive;
            nav = null;
            if (restoreAutoSpeed) S.fv(oldFs);
            if (onArrive) onArrive();
          }
        } else if (nav.phase === 'jumpout') {
          q.copy(nav.q);
          if (nav.elapsed >= 0.3 * nav.motionFactor) {
            nav.phase = 'transit';
            nav.elapsed = 0;
          }
        } else if (nav.phase === 'jumpin') {
          sp.copy(nav.to);
          vel.set(0, 0, 0);
          q.copy(nav.q);
          if (nav.elapsed >= 0.38 * nav.motionFactor) {
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
      const pilotQuaternion = cam.quaternion.clone(),
        pilotPosition = sp
          .clone()
          .add(
            new V(0, 0.3, 1)
              .multiplyScalar(shipOffset() * e * (pv == 3 ? 1 : 0))
              .applyQuaternion(q),
          );
      if (launchSequence) {
        cam.position.copy(sp).add(launchSequence.cameraOffset);
        cam.lookAt(sp);
      } else if (launchCameraBlend) {
        const blend = launchCameraBlend;
        blend.elapsed = Math.min(blend.duration, blend.elapsed + dt);
        const amount = blend.elapsed / blend.duration,
          eased = amount * amount * (3 - 2 * amount);
        cam.position.lerpVectors(blend.fromPosition, pilotPosition, eased);
        cam.quaternion.copy(blend.fromQuaternion).slerp(pilotQuaternion, eased);
        if (amount >= 1) launchCameraBlend = null;
      } else {
        cam.position.copy(pilotPosition);
      }
      const tt =
        ti < 5
          ? 1.2 * (1 - Math.min(1, Math.max(0, (ti - 3.2) / 1.8))) + 0.3
          : Math.min(1.6, vel.length() / fs) + 0.15;
      th += (tt - th) * Math.min(1, dt * 6);
      ship.visible =
        !!launchSequence ||
        (!!launchCameraBlend && pv == 1) ||
        (pv == 3 && kk > 0.02 && !(nav && nav.long && nav.phase === 'transit'));
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
          nf = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
        tx('lv', 'NIVEL ' + lvn[0] + '/4 · ' + lvn[1]);
        for (let stage = 1; stage <= 4; stage++) {
          const point = g('speedStage' + stage);
          if (point) point.classList.toggle('active', stage === lvn[0]);
        }
        tx(
          'ls',
          'AJUSTE ' + nf(fs) + ' u/s' + (keys.shift ? ' · BOOST ×5' : '') + (O.au ? ' · AUTO' : ''),
        );
        const speedRatio = Math.max(0, Math.min(1, sp2 / (fs * (keys.shift ? 5 : 1))));
        const inertiaRatio = Math.max(0, Math.min(1, ac / (fs * (O.in ? 1.5 : 15))));
        const heading = (((-fy * 57.2958) % 360) + 360) % 360;
        const needle = (id, degrees) => {
          const dialNeedle = g(id);
          if (dialNeedle) dialNeedle.style.transform = `rotate(${degrees}deg)`;
        };
        needle('needleSpeed', -135 + speedRatio * 270);
        needle('needleInertia', -135 + inertiaRatio * 270);
        needle('needleHeading', heading);
        tx('gaugeSpeedValue', nf(sp2));
        tx('gaugeInertiaValue', nf(ac));
        tx('gaugeHeadingValue', Math.round(heading) + '°');
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
      missionMarkerEffects.forEach((effect) => {
        const pulse = 0.96 + Math.sin(clk.elapsedTime * 1.8 + effect.phase) * 0.055;
        const radius = effect.markerRadius;
        effect.star.scale.setScalar(radius * pulse);
        effect.glow.scale.setScalar(radius * 2.7 * pulse);
        effect.corona.scale.setScalar(radius * 4.8 * (1.08 - pulse));
        effect.starGlow.scale.setScalar(radius * 3.2 * pulse);
        effect.ring.material.opacity = 0.28 + (pulse - 0.96) * 0.9;
        if (effect.companion) {
          const orbit = clk.elapsedTime * 0.46 + effect.phase;
          effect.companion.position.set(Math.cos(orbit) * 0.33, 0, Math.sin(orbit) * 0.33);
          effect.star.position.set(-Math.cos(orbit) * 0.33, 0, -Math.sin(orbit) * 0.33);
        }
      });

      const activeMissionMarker = activeMissionKey && missionMarkers.get(activeMissionKey);
      if (activeMissionMarker) activeMissionMarker.label.visible = true;
      B[0].glow.scale.setScalar(Math.max(B[0].r * (real ? 40 : 6), cam.position.length() * 0.012));
      if (foc && S.d) S.d(foc.au || 0);
    }
    if (nearbyMapState) {
      nearbyGalaxyGroup.position.set(0, 0, 0);
      nearbyGalaxyGroup.quaternion.copy(gal.quaternion);
      const solarGalacticRadius = Math.hypot(24500, 3500);
      // Keep the solar-system marker on the same visible disk rotation as the
      // Milky Way. The additional map-only phase makes that schematic motion
      // perceptible without changing the physical simulation clock.
      galacticMapDisk.rotation.y = -(
        GU.uP.value +
        GU.uT.value * (RG / Math.max(solarGalacticRadius, 6000) - 1) +
        nearbyMapRotation
      );
      nearbyMapRotation = (nearbyMapRotation + dt * 0.12) % TAU;
      solarSystemLabel.visible =
        nearbySelectedKey === 'milky-way' ||
        cam.position.distanceTo(solarSystemMapMarker.getWorldPosition(nearbyMarkerWorld)) < 170;
      solarMapPlanets.forEach(({ planet, marker, visualOrbitRadius }) => {
        const orbitalPosition = pos(planet, sim);
        marker.position.set(
          (orbitalPosition.x / planet.au) * visualOrbitRadius,
          0,
          (orbitalPosition.z / planet.au) * visualOrbitRadius,
        );
      });
      nearbyGalaxyMarkers.forEach((marker, key) => {
        marker.userData.label.visible =
          key === nearbySelectedKey ||
          cam.position.distanceTo(marker.getWorldPosition(nearbyMarkerWorld)) < 280;
      });
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
    nearbyMap,
    returnFromNearbyMap,
    focusNearbyGalaxy,
    focusSolarSystemMap,
    navigationActive: () => !!nav,
    quality: (mode) => {
      qualityMode = mode;
      R.setPixelRatio(pixelRatioFor(qualityMode));
      R.setSize(innerWidth, innerHeight);
    },
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
      if (nav?.respectSpeed && nav.phase !== 'arrival') {
        if (nav.phase === 'transit') {
          const progress = Math.min(1, nav.elapsed / nav.duration);
          const eased = progress * progress * (3 - 2 * progress);
          nav.from.lerp(nav.to, eased);
          nav.distance = nav.from.distanceTo(nav.to);
          nav.elapsed = 0;
        }
        nav.duration = Math.min(16, Math.max(0.4, nav.distance / fs));
      }
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
export const CK = `<svg viewBox='0 0 1000 600' preserveAspectRatio='none'><defs><linearGradient id='cg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1b2335'/><stop offset='1' stop-color='#05070c'/></linearGradient><radialGradient id='cv' cx='.5' cy='.45' r='.75'><stop offset='.6' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></radialGradient></defs><rect width='1000' height='600' fill='url(#cv)'/><path d='M0 0H1000L900 62Q500 92 100 62Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M0 0L130 62L52 380L0 450Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M1000 0L870 62L948 380L1000 450Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M0 600V462Q120 420 330 432Q500 405 670 432Q880 420 1000 462V600Z' fill='url(#cg)' stroke='#3d4d70' stroke-width='3'/><path d='M58 455Q220 432 398 446L380 564Q230 548 78 570Z' fill='#071019' fill-opacity='.72' stroke='#2a8fd0' stroke-opacity='.68' stroke-width='2'/><path d='M942 455Q780 432 602 446L620 564Q770 548 922 570Z' fill='#071019' fill-opacity='.72' stroke='#2a8fd0' stroke-opacity='.68' stroke-width='2'/><g stroke='#6ff0ff' stroke-width='2' fill='none' opacity='.75'><path d='M110 500L170 484L230 494L290 470L350 488'/><circle cx='770' cy='494' r='22'/><path d='M770 494L784 482'/><path d='M830 505H900M830 490H885'/></g><circle cx='460' cy='448' r='5' fill='#ff4040'/><circle cx='480' cy='446' r='5' fill='#ffb030'/><circle cx='520' cy='446' r='5' fill='#40ff80'/><circle cx='540' cy='448' r='5' fill='#40c0ff'/></svg>`,
  YK = `<svg viewBox='0 0 220 190' width='100%' height='100%'><rect x='95' y='100' width='30' height='90' rx='6' fill='#131a28' stroke='#3b4864' stroke-width='3'/><path d='M28 64Q28 24 70 24H150Q192 24 192 64V92Q192 110 172 110H48Q28 110 28 92Z' fill='none' stroke='#252e44' stroke-width='20'/><path d='M28 64Q28 24 70 24H150Q192 24 192 64V92Q192 110 172 110H48Q28 110 28 92Z' fill='none' stroke='#4a5a7c' stroke-width='4'/><rect x='12' y='52' width='26' height='54' rx='10' fill='#e05a2b'/><rect x='182' y='52' width='26' height='54' rx='10' fill='#e05a2b'/><circle cx='110' cy='66' r='15' fill='#0b0f18' stroke='#6ff0ff' stroke-width='3'/><circle cx='110' cy='66' r='5' fill='#6ff0ff'/></svg>`;
export const SC = `<div class='sc sl'><div class='st'><i></i> NIVEL DE VELOCIDAD</div><div id='lv' class='sv'></div><div class='speedStages'><div id='speedStage1'><i></i><span>PLANETA</span></div><div id='speedStage2'><i></i><span>SISTEMA</span></div><div id='speedStage3'><i></i><span>GALAXIA</span></div><div id='speedStage4'><i></i><span>HIPER</span></div></div><div id='ls' class='ss'></div></div><div class='sc sr'><div class='st'><i></i> TELEMETRÍA DE VUELO</div><div class='gaugeRow'><div class='flightGauge'><div class='gaugeFace'><i id='needleSpeed' class='gaugeNeedle'></i><b></b></div><strong id='gaugeSpeedValue'>0</strong><small>VELOCIDAD</small></div><div class='flightGauge'><div class='gaugeFace'><i id='needleInertia' class='gaugeNeedle inertiaNeedle'></i><b></b></div><strong id='gaugeInertiaValue'>0</strong><small>INERCIA</small></div><div class='flightGauge'><div class='gaugeFace compassFace'><i id='needleHeading' class='gaugeNeedle headingNeedle'></i><b></b></div><strong id='gaugeHeadingValue'>0°</strong><small>RUMBO</small></div></div></div>`;
