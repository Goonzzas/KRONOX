import * as THREE from 'three';

function makeDataFallback(r, g, b, a = 255) {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function buildCanvasTex(width, height, drawFn, repeat = [1, 1], isColor = true, registry = null) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const fb = makeDataFallback(isColor ? 36 : 128, isColor ? 46 : 128, isColor ? 62 : 128, 255);
    if (registry) registry.push(fb);
    return fb;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext?.('2d');
  if (ctx) drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (isColor && 'encoding' in tex && THREE.sRGBEncoding) {
    tex.encoding = THREE.sRGBEncoding;
  }
  tex.needsUpdate = true;
  if (registry) registry.push(tex);
  return tex;
}

function buildNormalTex(size, heightFn, strength = 2.0, repeat = [1, 1], registry = null) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const fb = makeDataFallback(128, 128, 255, 255);
    if (registry) registry.push(fb);
    return fb;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext?.('2d');
  if (!ctx) return makeDataFallback(128, 128, 255, 255);
  const img = ctx.createImageData(size, size);
  const hMap = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const rowOff = y * size;
    for (let x = 0; x < size; x++) {
      hMap[rowOff + x] = heightFn(x, y, size);
    }
  }
  const d = img.data;
  const last = size - 1;
  for (let y = 0; y < size; y++) {
    const rowOff = y * size;
    const ymOff = (y === 0 ? last : y - 1) * size;
    const ypOff = (y === last ? 0 : y + 1) * size;
    for (let x = 0; x < size; x++) {
      const xm = x === 0 ? last : x - 1;
      const xp = x === last ? 0 : x + 1;
      const dx = (hMap[rowOff + xp] - hMap[rowOff + xm]) * strength;
      const dy = (hMap[ypOff + x] - hMap[ymOff + x]) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1.0);
      const idx = (rowOff + x) * 4;
      d[idx] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  if (registry) registry.push(tex);
  return tex;
}

function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Suite de materiales PBR arquitectónicos exclusivos de Cabina 1 (Puente de Mando KRONOX).
 * Diseñada sin patrones en cuadrícula repetitiva ni desgaste plástico lavado:
 *  - Suelo arquitectónico de atlas 1024x1024 mapeado 1:1 en UVs normalizadas del puente
 *  - Titanio cepillado oscuro y aleación champán anodizada con reflexión PMREM calibrada
 *  - Fibra de carbono diagonal 2x2 para consolas y respaldos
 *  - Revestimiento acústico acanalado en azul pizarra profundo y cuero técnico pespunteado
 *  - Acristalamiento panorámico ultra limpio y cristal ahumado para zanjas de umbilicales
 */
export function createBridgeCabina1MaterialSuite() {
  const textures = [];
  const materials = [];
  const trackMat = (mat) => {
    materials.push(mat);
    return mat;
  };

  // Mapeo de coordenadas Aurora -> Atlas [0..1024]: ax in [-13..16] -> u, az in [-13..13] -> v
  const toU = (ax, s) => ((ax + 13.0) / 29.0) * s;
  const toV = (az, s) => ((az + 13.0) / 26.0) * s;

  // 1) Suelo arquitectónico compuesto NO repetitivo (atlas macro 1024x1024, repeat [1, 1])
  const bridgeFloorColorTex = buildCanvasTex(
    1024,
    1024,
    (ctx, w, h) => {
      const grad = ctx.createRadialGradient(toU(3.0, w), toV(0, h), 40, toU(2.0, w), toV(0, h), 620);
      grad.addColorStop(0, '#18212e');
      grad.addColorStop(0.55, '#121923');
      grad.addColorStop(1, '#0d131c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Veteado mineral/compuesto continuo muy sutil (sin motas ni cuadrículas pequeñas)
      for (let i = 0; i < 420; i++) {
        const rx = hash2D(i, 1.3) * w;
        const ry = hash2D(i, 7.9) * h;
        const rw = 28 + hash2D(i, 3.1) * 140;
        const rh = 1.5 + hash2D(i, 5.7) * 3.0;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.016)' : 'rgba(4,8,14,0.032)';
        ctx.fillRect(rx, ry, rw, rh);
      }

      // Corredor central ceremonial (popa holo -> ascensor -> estrado -> timón)
      const cx0 = toU(-7.0, w);
      const cx1 = toU(11.6, w);
      const cyMid = toV(0, h);
      const aisleHalfH = (1.55 / 26.0) * h;
      ctx.fillStyle = 'rgba(28, 40, 56, 0.55)';
      ctx.fillRect(cx0, cyMid - aisleHalfH, cx1 - cx0, aisleHalfH * 2);

      // Juntas arquitectónicas de gran formato (convergencia radial hacia el estrado ax=5.5 y eje)
      ctx.strokeStyle = 'rgba(6, 10, 16, 0.85)';
      ctx.lineWidth = 3.5;
      [-10.5, -7.8, -4.5, -2.0, 2.2, 5.5, 8.6, 12.2].forEach((ax) => {
        const px = toU(ax, w);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      });
      [-8.2, -4.8, -1.6, 1.6, 4.8, 8.2].forEach((az) => {
        const py = toV(az, h);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      });

      // Diagonales limpias acompañando las alas en chevrón hacia proa
      [-1, 1].forEach((s) => {
        ctx.strokeStyle = 'rgba(182, 152, 106, 0.36)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(toU(1.5, w), toV(s * 3.8, h));
        ctx.lineTo(toU(13.8, w), toV(s * 0.9, h));
        ctx.stroke();

        ctx.strokeStyle = 'rgba(92, 178, 224, 0.24)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(toU(-11.2, w), toV(s * 5.2, h));
        ctx.lineTo(toU(1.2, w), toV(s * 2.2, h));
        ctx.stroke();
      });

      // Aros concéntricos fresados en torno al ascensor (0,0), estrado (5.5,0) y holo (-6.0,0)
      [
        [0, 0, 2.35, 'rgba(120, 198, 238, 0.34)'],
        [5.5, 0, 3.45, 'rgba(188, 156, 108, 0.38)'],
        [-6.0, 0, 2.25, 'rgba(105, 194, 238, 0.32)'],
      ].forEach(([ax, az, radMeters, strokeCol]) => {
        const rPx = (radMeters / 27.5) * w;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(toU(ax, w), toV(az, h), rPx, 0, Math.PI * 2);
        ctx.stroke();
      });
    },
    [1, 1],
    true,
    textures,
  );

  const bridgeFloorRoughTex = buildCanvasTex(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#8b8b8b';
      ctx.fillRect(0, 0, w, h);
      // Corredor central ligeramente más satinado
      ctx.fillStyle = '#6c6c6c';
      ctx.fillRect(toU(-7.0, w), toV(-1.55, h), toU(11.6, w) - toU(-7.0, w), (3.1 / 26.0) * h);
      // Juntas oscuras de ranura fresada más mates
      ctx.strokeStyle = '#3f3f3f';
      ctx.lineWidth = 3;
      [-10.5, -7.8, -4.5, -2.0, 2.2, 5.5, 8.6, 12.2].forEach((ax) => {
        const px = toU(ax, w);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      });
    },
    [1, 1],
    false,
    textures,
  );

  const bridgeFloorNormalTex = buildNormalTex(
    512,
    (x, y, s) => {
      const gx = x / s;
      const gy = y / s;
      const ax = gx * 29.0 - 13.0;
      const az = gy * 26.0 - 13.0;
      let v = 0.72 + Math.sin(ax * 1.4) * 0.015;
      [-10.5, -7.8, -4.5, -2.0, 2.2, 5.5, 8.6, 12.2].forEach((seamX) => {
        if (Math.abs(ax - seamX) < 0.09) v = 0.25;
      });
      [-8.2, -4.8, -1.6, 1.6, 4.8, 8.2].forEach((seamZ) => {
        if (Math.abs(az - seamZ) < 0.09) v = 0.25;
      });
      return v;
    },
    1.8,
    [1, 1],
    textures,
  );

  // 2) Titanio cepillado lineal y champán anodizado
  const brushedTitanNormalTex = buildNormalTex(
    256,
    (x, y, s) => {
      const fine = hash2D(Math.floor(x * 0.25), y) * 0.16;
      const panelEdge = x < 3 || y < 3 || x > s - 4 || y > s - 4 ? -0.22 : 0;
      return 0.65 + fine + panelEdge;
    },
    1.15,
    [1, 1],
    textures,
  );

  // 3) Fibra de carbono diagonal 2x2 para consolas y respaldos
  const carbonColorTex = buildCanvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#11161f';
      ctx.fillRect(0, 0, w, h);
      const cell = 16;
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          const shift = ((y / cell) % 2) * (cell * 0.5);
          ctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? '#1a2230' : '#0f141d';
          ctx.fillRect((x + shift) % w, y, cell * 0.48, cell * 0.86);
        }
      }
    },
    [4, 4],
    true,
    textures,
  );

  const carbonNormalTex = buildNormalTex(
    256,
    (x, y) => {
      const u = Math.floor((x + y) / 8) % 2;
      return u === 0 ? 0.68 : 0.46;
    },
    1.25,
    [4, 4],
    textures,
  );

  // 4) Revestimiento acústico acanalado azul-pizarra para paredes de babor/estribor/popa
  const acousticWallColorTex = buildCanvasTex(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#17202e';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0, '#0f151f');
        g.addColorStop(0.5, '#202c3e');
        g.addColorStop(1, '#0f151f');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 15, h);
      }
      ctx.fillStyle = 'rgba(8, 12, 18, 0.55)';
      ctx.fillRect(0, h * 0.49, w, 6);
    },
    [2, 1],
    true,
    textures,
  );

  const acousticWallNormalTex = buildNormalTex(
    256,
    (x, y, s) => {
      const flute = Math.sin((x / s) * Math.PI * 2 * 16) * 0.34;
      const midSeam = Math.abs(y - s * 0.5) < 3 ? -0.35 : 0;
      return 0.6 + flute + midSeam;
    },
    2.1,
    [2, 1],
    textures,
  );

  // 5) Revestimiento suave de dosel/techo en composite mate continuo (sin rejilla perforada)
  const canopyLinerColorTex = buildCanvasTex(
    512,
    512,
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#131a25');
      grad.addColorStop(0.5, '#192230');
      grad.addColorStop(1, '#121822');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(7, 10, 16, 0.72)';
      ctx.lineWidth = 3;
      [0.25, 0.5, 0.75].forEach((f) => {
        ctx.beginPath();
        ctx.moveTo(0, h * f);
        ctx.lineTo(w, h * f);
        ctx.stroke();
      });
    },
    [1, 1],
    true,
    textures,
  );

  // 6) Cuero técnico microperforado para sillería aeroespacial
  const leatherNormalTex = buildNormalTex(
    256,
    (x, y) => {
      const cellX = Math.sin(x * 0.52);
      const cellY = Math.cos(y * 0.52);
      return 0.56 + cellX * cellY * 0.14 + hash2D(x, y) * 0.04;
    },
    0.85,
    [3, 3],
    textures,
  );

  // Materiales calibrados con envMapIntensity moderado para que RoomEnvironment dé brillos en biseles sin blanquear el puente
  const bridgeFloorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: bridgeFloorColorTex,
      normalMap: bridgeFloorNormalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: bridgeFloorRoughTex,
      roughness: 0.62,
      metalness: 0.36,
      envMapIntensity: 0.34,
    }),
  );

  const bridgeRibMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x202938,
      normalMap: brushedTitanNormalTex,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.32,
      metalness: 0.84,
      envMapIntensity: 0.46,
    }),
  );

  const bridgeChampagneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc4aa82,
      normalMap: brushedTitanNormalTex,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughness: 0.26,
      metalness: 0.88,
      envMapIntensity: 0.56,
    }),
  );

  const bridgeCarbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: carbonColorTex,
      normalMap: carbonNormalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.42,
      metalness: 0.22,
      envMapIntensity: 0.28,
    }),
  );

  const bridgeAcousticWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: acousticWallColorTex,
      normalMap: acousticWallNormalTex,
      normalScale: new THREE.Vector2(0.68, 0.68),
      roughness: 0.80,
      metalness: 0.08,
      envMapIntensity: 0.16,
    }),
  );

  const bridgeCanopyLinerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: canopyLinerColorTex,
      normalMap: brushedTitanNormalTex,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.64,
      metalness: 0.24,
      envMapIntensity: 0.22,
    }),
  );

  const bridgeUpholsteryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x24201f,
      normalMap: leatherNormalTex,
      normalScale: new THREE.Vector2(0.36, 0.36),
      roughness: 0.56,
      metalness: 0.05,
      envMapIntensity: 0.18,
    }),
  );

  const bridgeCopperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc87846,
      normalMap: brushedTitanNormalTex,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.28,
      metalness: 0.90,
      envMapIntensity: 0.54,
    }),
  );

  const bridgeTrimSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7a8a9e,
      normalMap: brushedTitanNormalTex,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.28,
      metalness: 0.86,
      envMapIntensity: 0.50,
    }),
  );

  const bridgeWarmCoveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4c2,
      emissive: 0xffb86b,
      emissiveIntensity: 0.66,
      roughness: 0.34,
      metalness: 0.05,
    }),
  );

  const bridgeCyanCoveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc9f2ff,
      emissive: 0x4cc9f0,
      emissiveIntensity: 0.58,
      roughness: 0.32,
      metalness: 0.05,
    }),
  );

  const bridgePanoramaGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x98dcff,
      metalness: 0.04,
      roughness: 0.05,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      envMapIntensity: 0.35,
    }),
  );

  const bridgeTrenchGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b1623,
      metalness: 0.10,
      roughness: 0.12,
      transparent: true,
      opacity: 0.64,
      envMapIntensity: 0.42,
    }),
  );

  const bridgeOpticalLensMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x52c7f5,
      emissive: 0x165e8a,
      emissiveIntensity: 0.42,
      metalness: 0.18,
      roughness: 0.12,
      transparent: true,
      opacity: 0.86,
    }),
  );

  // Pantallas MFD de alta resolución (1024x512) diferenciadas visualmente por rol de consola
  const buildMfdMaterial = (role) => {
    const tex = buildCanvasTex(
      1024,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#07111d';
        ctx.fillRect(0, 0, w, h);
        // Marco sutil
        ctx.strokeStyle = 'rgba(130, 195, 240, 0.25)';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, w - 20, h - 20);

        if (role === 'helm') {
          // Horizonte artificial + vectores de navegación delta-V
          ctx.fillStyle = '#38d8ff';
          ctx.font = '700 24px monospace';
          ctx.fillText('KRONOX-120 // TIMÓN ORBITAL & ACTITUD', 34, 52);

          const cx = w * 0.34;
          const cy = h * 0.56;
          ctx.strokeStyle = 'rgba(56, 216, 255, 0.55)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 145, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, 94, -0.45, Math.PI + 0.45);
          ctx.stroke();
          ctx.strokeStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(cx - 110, cy);
          ctx.lineTo(cx - 28, cy);
          ctx.moveTo(cx + 28, cy);
          ctx.lineTo(cx + 110, cy);
          ctx.stroke();

          // Barras vectoriales derecha
          ctx.fillStyle = 'rgba(14, 34, 54, 0.85)';
          ctx.fillRect(w * 0.62, 86, 340, 380);
          ['V-REL  +14.28 km/s', 'INCL   +0.024 deg', 'RCS     NOMINAL 99%', 'TRAY    ESTABLE L2'].forEach((line, idx) => {
            ctx.fillStyle = idx === 0 ? '#7fe7ff' : '#d6ecf8';
            ctx.font = '600 22px monospace';
            ctx.fillText(line, w * 0.65, 142 + idx * 52);
          });
          ctx.fillStyle = '#34d399';
          ctx.fillRect(w * 0.65, 368, 260, 18);
        } else if (role === 'astro') {
          // Carta estelar polar + curva espectral IR
          ctx.fillStyle = '#7cd7ff';
          ctx.font = '700 24px monospace';
          ctx.fillText('ASTROGACIÓN // CATÁLOGO GAIA DR3 + SPHEREx', 34, 52);

          const cx = w * 0.28;
          const cy = h * 0.56;
          [55, 110, 165].forEach((rr) => {
            ctx.strokeStyle = 'rgba(124, 215, 255, 0.32)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.stroke();
          });
          for (let i = 0; i < 42; i++) {
            const a = hash2D(i, 2.1) * Math.PI * 2;
            const r = Math.sqrt(hash2D(i, 6.4)) * 158;
            ctx.fillStyle = i % 5 === 0 ? '#ffd28a' : '#bfe9ff';
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i % 5 === 0 ? 4 : 2.3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Gráfica espectrométrica derecha
          ctx.strokeStyle = '#38d8ff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let px = 0; px <= 380; px += 10) {
            const x = w * 0.56 + px;
            const py = 360 - Math.sin(px * 0.045) * 65 - (Math.abs(px - 180) < 28 ? 85 : 0);
            if (px === 0) ctx.moveTo(x, py);
            else ctx.lineTo(x, py);
          }
          ctx.stroke();
        } else if (role === 'neural') {
          // Canal neural KRONOX IA
          ctx.fillStyle = '#fbbf24';
          ctx.font = '700 24px monospace';
          ctx.fillText('ENLACE NEURAL // NÚCLEO KRONOX IA', 34, 52);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          for (let px = 0; px <= 920; px += 12) {
            const x = 48 + px;
            const y = 248 + Math.sin(px * 0.032) * 58 * Math.cos(px * 0.008);
            if (px === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.fillStyle = '#9be7ff';
          ctx.font = '600 20px monospace';
          ctx.fillText('BANDA KA: 100.0% · SINAPSIS VOZ ACTIVA · LATENCIA 0.4 ms', 48, 438);
        } else {
          // Ingeniería y casco C01-C04
          ctx.fillStyle = '#58e2a4';
          ctx.font = '700 24px monospace';
          ctx.fillText('TELEMETRÍA DE CASCO // C01–C04 INTEGRIDAD', 34, 52);
          [0.94, 0.88, 0.91, 0.96].forEach((val, idx) => {
            const bx = 56 + idx * 235;
            ctx.fillStyle = 'rgba(20, 44, 52, 0.9)';
            ctx.fillRect(bx, 118, 190, 290);
            ctx.fillStyle = '#58e2a4';
            ctx.fillRect(bx + 26, 370 - val * 185, 138, val * 185);
            ctx.fillStyle = '#dffcf0';
            ctx.font = '700 22px monospace';
            ctx.fillText(`C0${idx + 1} ${(val * 100).toFixed(0)}%`, bx + 38, 152);
          });
        }
      },
      [1, 1],
      true,
      textures,
    );
    return trackMat(
      new THREE.MeshBasicMaterial({
        map: tex,
      }),
    );
  };

  const mfdHelmMat = buildMfdMaterial('helm');
  const mfdAstroMat = buildMfdMaterial('astro');
  const mfdNeuralMat = buildMfdMaterial('neural');
  const mfdEngMat = buildMfdMaterial('eng');

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    materials.forEach((m) => m?.dispose?.());
    textures.forEach((t) => t?.dispose?.());
  };

  const setAnisotropy = (val = 4) => {
    const next = Math.max(1, Math.min(8, Number(val) || 4));
    for (let i = 0; i < textures.length; i += 1) {
      const t = textures[i];
      if (t && t.anisotropy !== next) {
        t.anisotropy = next;
        t.needsUpdate = true;
      }
    }
  };

  return {
    materials: {
      bridgeFloorMat,
      bridgeRibMat,
      bridgeChampagneMat,
      bridgeCarbonMat,
      bridgeAcousticWallMat,
      bridgeCanopyLinerMat,
      bridgeUpholsteryMat,
      bridgeCopperMat,
      bridgeTrimSteelMat,
      bridgeWarmCoveMat,
      bridgeCyanCoveMat,
      bridgePanoramaGlassMat,
      bridgeTrenchGlassMat,
      bridgeOpticalLensMat,
      mfdHelmMat,
      mfdAstroMat,
      mfdNeuralMat,
      mfdEngMat,
    },
    setAnisotropy,
    dispose,
  };
}
