import * as THREE from 'three';
import { P } from '../data/planetData.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { parseFits } from '../utils/fitsImage.js';
import { previewPixels } from '../utils/fitsTransport.js';
import { computeDifferentialImage } from '../utils/differentialImaging.js';
import {
  createFindingRecord,
  loadFindingsFromStorage,
  saveFindingsToStorage,
} from '../utils/findingsStorage.js';
import { KRONOX_QUICK_PROMPTS, processKronoxQuery } from '../utils/kronoxAI.js';

const PLANET_NAMES_ORDER = [
  'Sol',
  'Mercurio',
  'Venus',
  'Tierra',
  'Luna',
  'Marte',
  'Júpiter',
  'Saturno',
  'Urano',
  'Neptuno',
  'Plutón',
  'Ceres',
];

const QUICK_DESTINATIONS = [
  { id: 'sunOrbit', label: 'Órbita Solar', badge: '1.0 UA' },
  { id: 'asteroids', label: 'Cinturón Asteroides', badge: '2.7 UA' },
  { id: 'orion', label: 'Nebulosa Orión', badge: 'M42' },
  { id: 'core', label: 'Núcleo Galáctico', badge: 'Vía Láctea' },
];

const SHIP_DECKS = [
  { id: 'C01', label: 'C01 Puente' },
  { id: 'C02', label: 'C02 Habitación' },
  { id: 'C03', label: 'C03 Reactor' },
  { id: 'C04', label: 'C04 Hangar' },
];

const SPHEREX_NAV_TARGETS = [
  { key: 'barnard', label: 'Estrella de Barnard' },
  { key: 'epsilon-indi', label: 'Epsilon Indi' },
  { key: 'rw-aurigae', label: 'RW Aurigae' },
  { key: 'm101', label: 'M101 · Molinete' },
  { key: 'm31', label: 'M31 · Andrómeda' },
];

const C_BG = 'rgba(7, 13, 27, 0.94)';
const C_CARD = 'rgba(13, 23, 44, 0.92)';
const C_CARD_ALT = 'rgba(18, 32, 60, 0.95)';
const C_BORDER = 'rgba(104, 178, 255, 0.46)';
const C_ACCENT = '#4cc9f0';
const C_GREEN = '#34d399';
const C_VIOLET = '#a78bfa';
const C_AMBER = '#fbbf24';
const C_TEXT = '#f1f6ff';
const C_MUTED = '#9db4d8';

function resolveBaseUrl() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      return String(import.meta.env.BASE_URL).replace(/\/$/, '');
    }
  } catch {
    /* ignore */
  }
  return '/KRONOX';
}

function planetAccentCss(planet) {
  if (!planet) return '#7dd3fc';
  if (planet.sun) return '#fbbf24';
  if (Array.isArray(planet.c?.[0])) {
    const [r, g, b] = planet.c[0];
    return `rgb(${r},${g},${b})`;
  }
  if (Array.isArray(planet.c)) {
    const [r, g, b] = planet.c;
    return `rgb(${r},${g},${b})`;
  }
  return '#7cc4ff';
}

function applySrgbTextureColorSpace(tex) {
  if (!tex) return;
  if ('sRGBEncoding' in THREE) {
    tex.encoding = THREE.sRGBEncoding;
  }
}

function normalizeAngle(rad) {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function truncateText(text = '', max = 28) {
  const s = String(text || '').trim();
  if (!s || s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function drawRoundedRect(ctx, x, y, w, h, r = 14) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function measureLines(ctx, text, maxWidth) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (!ctx || typeof ctx.measureText !== 'function') {
    const approxChars = Math.max(18, Math.floor(maxWidth / 11));
    const out = [];
    for (let i = 0; i < clean.length; i += approxChars) {
      out.push(clean.slice(i, i + approxChars).trim());
    }
    return out;
  }
  const words = clean.split(' ');
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  if (!ctx) return 0;
  const lines = measureLines(ctx, text, maxWidth);
  const count = Math.min(lines.length, maxLines);
  for (let i = 0; i < count; i++) {
    let content = lines[i];
    if (i === count - 1 && lines.length > maxLines) {
      content = `${content.slice(0, Math.max(0, content.length - 1))}…`;
    }
    ctx.fillText(content, x, y + i * lineHeight);
  }
  return count;
}

function buildFitsPreviewCanvas(frame, diffData = null) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const w = diffData?.width || frame?.width || 96;
  const h = diffData?.height || frame?.height || 96;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const img = ctx.createImageData(w, h);
  if (diffData?.diffPixels) {
    const pixels = diffData.diffPixels;
    const limit = Math.max(1e-4, diffData.sigmaThreshold || 5.0);
    for (let i = 0; i < pixels.length; i++) {
      const v = pixels[i];
      const at = i * 4;
      if (!Number.isFinite(v)) {
        img.data[at] = 10;
        img.data[at + 1] = 16;
        img.data[at + 2] = 28;
        img.data[at + 3] = 255;
        continue;
      }
      const norm = Math.max(-1, Math.min(1, v / limit));
      if (norm >= 0) {
        img.data[at] = Math.round(28 + norm * 227);
        img.data[at + 1] = Math.round(30 + norm * 130);
        img.data[at + 2] = Math.round(42 - norm * 20);
      } else {
        const n = -norm;
        img.data[at] = Math.round(24 - n * 16);
        img.data[at + 1] = Math.round(40 + n * 185);
        img.data[at + 2] = Math.round(70 + n * 185);
      }
      img.data[at + 3] = 255;
    }
  } else if (frame?.scientificPixels) {
    const rgba = previewPixels(frame);
    img.data.set(rgba);
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function createHudSurface(widthPx, heightPx, worldW, worldH, interactId, renderOrder = 100) {
  let canvas = null;
  let ctx = null;
  let texture = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    ctx = canvas.getContext('2d');
    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    applySrgbTextureColorSpace(texture);
  }
  const geometry = new THREE.PlaneGeometry(worldW, worldH);
  const material = new THREE.MeshBasicMaterial({
    map: texture || null,
    color: 0xffffff,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = interactId;
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  mesh.userData = {
    interactId,
    isVrHud: true,
  };
  return {
    interactId,
    widthPx,
    heightPx,
    worldW,
    worldH,
    canvas,
    ctx,
    texture,
    geometry,
    material,
    mesh,
    buttons: [],
    dirty: true,
  };
}

/**
 * Crea el HUD espacial 3D para WebXR VR (barra rápida persistente, subtítulos Kronos
 * y tableta interactiva con Viajes, Laboratorio SPHEREx y Asistente KRONOS IA).
 */
export function createVrHudPanel3D(callbacks = {}) {
  const group = new THREE.Group();
  group.name = 'KronoxVrHudPanel3D';
  group.visible = false;

  const quickBar = createHudSurface(1024, 184, 1.12, 0.20, 'vr-hud-quickbar', 101);
  const subtitleSurface = createHudSurface(960, 168, 1.14, 0.20, 'vr-hud-subtitle', 100);
  const tabletSurface = createHudSurface(1280, 820, 1.56, 1.00, 'vr-hud-tablet', 102);

  group.add(quickBar.mesh);
  group.add(subtitleSurface.mesh);
  group.add(tabletSurface.mesh);

  const state = {
    xrPresenting: false,
    tabletOpen: false,
    quickBarCompact: false,
    activeTab: 'travel', // 'travel' | 'spherex' | 'kronos' | 'cabin'
    travelActionMode: 'travel', // 'travel' | 'focus'
    hoveredButtonId: null,
    hoveredSurfaceId: null,
    viewMode: 1,
    freeHelmMode: false,
    opticalEnabled: false,
    opticalMag: 1,
    activeDeckId: 'C01',
    nearestStationId: null,
    nearestStationLabel: '',
    seatedInBridge: false,
    railAnchored: false,
    focusedObject: 'Tierra',
    nearObject: 'Tierra',
    travelStatus: null, // { active, label, progress, phase }
    voiceEnabled: true,
    aiSpeaking: false,
    aiStateLabel: 'En línea',
    assistantTitle: 'Kronox IA',
    assistantRole: 'Inteligencia de a bordo',
    assistantMessage:
      'Sistemas VR listos. Elige Viajar para fijar rumbo, SPHEREx para inspeccionar recortes FITS reales o KRONOS para asistencia.',
    assistantCategory: 'Puente espacial VR',
    subtitleUntilMs: 0,
    kronoxBusy: false,
    promptPage: 0,
    // SPHEREx 3D state
    spherexTargetKey: SPHEREX_TARGETS[0]?.key || 'barnard',
    spherexPage: 0,
    spherexViewMode: 'A', // 'A' | 'B' | 'diff' | 'blink'
    spherexBlinkEpoch: 'A',
    spherexBlinkAccum: 0,
    spherexLoading: false,
    spherexArchiveBusy: false,
    spherexError: '',
    spherexNotice: '',
    spherexFrameA: null,
    spherexFrameB: null,
    spherexDiff: null,
    spherexCanvasA: null,
    spherexCanvasB: null,
    spherexCanvasDiff: null,
    spherexArchiveRecordsByTarget: {},
    spherexFindingsCount: 0,
  };

  try {
    state.spherexFindingsCount = loadFindingsFromStorage().length;
  } catch {
    state.spherexFindingsCount = 0;
  }

  const fitsFrameCache = new Map();
  let hudAnchorValid = false;
  const hudAnchorPos = new THREE.Vector3();
  let hudYaw = 0;
  let forceSnapPose = true;

  const tempForward = new THREE.Vector3();
  const tempRight = new THREE.Vector3();
  const tempOffset = new THREE.Vector3();

  function markAllDirty() {
    quickBar.dirty = true;
    subtitleSurface.dirty = true;
    tabletSurface.dirty = true;
  }

  function resolveSpherexTarget() {
    return (
      SPHEREX_TARGETS.find((t) => t.key === state.spherexTargetKey) ||
      SPHEREX_TARGETS[0]
    );
  }

  function resolveTargetRecords(target) {
    const archiveRecs = state.spherexArchiveRecordsByTarget[target.key];
    if (Array.isArray(archiveRecs) && archiveRecs.length > 0) return archiveRecs;
    return Array.isArray(target.localRecords) ? target.localRecords : [];
  }

  function pickEpochPair(records = [], target = {}) {
    if (!records.length) return { recA: null, recB: null };
    const temporalPairIds = target.temporalPair;
    if (temporalPairIds?.primary && temporalPairIds?.secondary) {
      const a = records.find((r) => r.id === temporalPairIds.primary);
      const b = records.find((r) => r.id === temporalPairIds.secondary);
      if (a && b) return { recA: a, recB: b };
    }
    const pref = records.find((r) => r.band === target.preferredBand);
    const recA = pref || records[0];
    const recB =
      records.find((r) => r !== recA && r.band === recA.band) ||
      records.find((r) => r !== recA) ||
      null;
    return { recA, recB };
  }

  async function fetchFitsFrame(record, target) {
    if (!record) return null;
    const cacheKey = `${target.key}::${record.id || record.url || record.localFile}::${record.band}`;
    if (fitsFrameCache.has(cacheKey)) {
      return fitsFrameCache.get(cacheKey);
    }
    const baseUrl = resolveBaseUrl();
    const fetchUrl = record.localFile
      ? `${baseUrl}/demo/${record.localFile}`
      : `${baseUrl}/api/spherex?action=frame&url=${encodeURIComponent(record.url)}&center=${target.ra},${target.dec}&size=${record.cutoutSizeDeg || 0.12}`;

    const fetchFn =
      callbacks.fetchImpl || (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
    if (!fetchFn) {
      throw new Error('Fetch no disponible en este entorno.');
    }
    const response = await fetchFn(fetchUrl, { record, target });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al leer FITS (${record.band || 'SPHEREx'})`);
    }
    const buffer = await response.arrayBuffer();
    const parsed = parseFits(
      buffer,
      null,
      { ra: target.ra, dec: target.dec },
      {
        gridSize: 96,
        fovDeg: record.cutoutSizeDeg || 0.08,
        zodiMode: 'subtracted',
        flagPolicy: 'measurement',
      },
    );
    const wrapped = {
      ...parsed,
      record,
      center: { ra: target.ra, dec: target.dec },
      previewCanvas: buildFitsPreviewCanvas(parsed),
    };
    if (fitsFrameCache.size >= 16) {
      const firstKey = fitsFrameCache.keys().next().value;
      if (firstKey) fitsFrameCache.delete(firstKey);
    }
    fitsFrameCache.set(cacheKey, wrapped);
    return wrapped;
  }

  let spherexLoadToken = 0;

  async function loadSpherexTargetData(targetKey = state.spherexTargetKey) {
    const target = SPHEREX_TARGETS.find((t) => t.key === targetKey) || resolveSpherexTarget();
    state.spherexTargetKey = target.key;
    const records = resolveTargetRecords(target);
    state.spherexError = '';
    state.spherexNotice = '';
    state.spherexDiff = null;
    state.spherexCanvasDiff = null;

    if (!records.length) {
      state.spherexLoading = false;
      state.spherexFrameA = null;
      state.spherexFrameB = null;
      state.spherexCanvasA = null;
      state.spherexCanvasB = null;
      state.spherexNotice =
        'Sin recorte FITS local. Pulsa «Consultar archivo IRSA» para buscar productos reales.';
      tabletSurface.dirty = true;
      return;
    }

    const token = ++spherexLoadToken;
    state.spherexLoading = true;
    tabletSurface.dirty = true;

    try {
      const { recA, recB } = pickEpochPair(records, target);
      const frameA = await fetchFitsFrame(recA, target);
      if (token !== spherexLoadToken) return;
      state.spherexFrameA = frameA;
      state.spherexCanvasA = frameA?.previewCanvas || null;

      let frameB = null;
      if (recB) {
        frameB = await fetchFitsFrame(recB, target).catch(() => null);
      }
      if (token !== spherexLoadToken) return;
      state.spherexFrameB = frameB;
      state.spherexCanvasB = frameB?.previewCanvas || null;

      if (frameA && frameB) {
        try {
          const diffRes = computeDifferentialImage(frameA, frameB);
          state.spherexDiff = diffRes;
          state.spherexCanvasDiff = buildFitsPreviewCanvas(frameA, diffRes);
        } catch {
          state.spherexDiff = null;
          state.spherexCanvasDiff = null;
        }
      }
      state.spherexLoading = false;
      tabletSurface.dirty = true;
    } catch (err) {
      if (token !== spherexLoadToken) return;
      state.spherexLoading = false;
      state.spherexError = err?.message || 'Error al decodificar el recorte FITS.';
      tabletSurface.dirty = true;
    }
  }

  async function queryArchiveForCurrentTarget() {
    const target = resolveSpherexTarget();
    if (state.spherexArchiveBusy) return;
    state.spherexArchiveBusy = true;
    state.spherexError = '';
    state.spherexNotice = `Consultando archivo SPHEREx IRSA para ${target.name}…`;
    tabletSurface.dirty = true;
    try {
      const baseUrl = resolveBaseUrl();
      const params = new URLSearchParams({
        action: 'search',
        ra: String(target.ra),
        dec: String(target.dec),
        radius: '0.03',
        release: 'all',
      });
      const fetchFn =
        callbacks.fetchImpl || (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
      if (!fetchFn) throw new Error('Fetch no disponible.');
      const res = await fetchFn(`${baseUrl}/api/spherex?${params.toString()}`);
      if (!res.ok) throw new Error(`IRSA devolvió HTTP ${res.status}`);
      const data = await res.json();
      const recs = Array.isArray(data?.preferredRecords) && data.preferredRecords.length
        ? data.preferredRecords
        : Array.isArray(data?.records)
          ? data.records
          : [];
      if (!recs.length) {
        state.spherexNotice = 'IRSA no devolvió recortes nuevos en esta coordenada.';
      } else {
        state.spherexArchiveRecordsByTarget[target.key] = recs.slice(0, 12);
        state.spherexNotice = `${recs.length} productos reales recibidos de IRSA.`;
        state.spherexArchiveBusy = false;
        await loadSpherexTargetData(target.key);
        return;
      }
    } catch (err) {
      state.spherexError = err?.message || 'Sin conexión con el servidor IRSA.';
    }
    state.spherexArchiveBusy = false;
    tabletSurface.dirty = true;
  }

  function saveCurrentSpherexFinding() {
    const target = resolveSpherexTarget();
    const frameA = state.spherexFrameA;
    if (!frameA?.record) {
      state.spherexError = 'Carga primero una observación FITS antes de registrar el hallazgo.';
      tabletSurface.dirty = true;
      return { ok: false };
    }
    const frameB = state.spherexFrameB || null;
    const mjdA = Number(frameA.record.dateAvg || frameA.record.date);
    const mjdB = frameB ? Number(frameB.record.dateAvg || frameB.record.date) : NaN;
    const deltaDays =
      Number.isFinite(mjdA) && Number.isFinite(mjdB) ? Math.abs(mjdB - mjdA) : null;
    const bandLabel = frameA.record.band || target.preferredBand || 'SPHEREx';
    const record = createFindingRecord({
      target,
      frame: frameA.record,
      compareFrame: frameB?.record || null,
      marker: null,
      description: `Inspección VR en ${target.name} (${bandLabel}). Modo ${state.spherexViewMode}.`,
      viewMode:
        state.spherexViewMode === 'blink'
          ? 'blink'
          : state.spherexViewMode === 'diff'
            ? 'sideBySide'
            : 'single',
      diagnostics: frameA,
      timeDeltaDays: deltaDays,
    });
    const list = loadFindingsFromStorage();
    const next = [record, ...list];
    const saved = saveFindingsToStorage(next);
    state.spherexFindingsCount = next.length;
    state.spherexError = '';
    state.spherexNotice = saved
      ? `Hallazgo guardado (${next.length} en cuaderno).`
      : 'Registro preparado (almacenamiento local no disponible en este entorno).';
    tabletSurface.dirty = true;
    callbacks.onFindingSaved?.(record, next);
    return { ok: true, record };
  }

  function registerBtn(surface, id, x, y, w, h, action, payload = null, style = {}) {
    surface.buttons.push({ id, x, y, w, h, action, payload });
    const ctx = surface.ctx;
    if (!ctx) return;
    const hovered =
      state.hoveredSurfaceId === surface.interactId && state.hoveredButtonId === id;
    const active = Boolean(style.active);
    const fill = style.fill
      ? style.fill
      : hovered
        ? 'rgba(56, 189, 248, 0.34)'
        : active
          ? 'rgba(36, 99, 178, 0.62)'
          : C_CARD_ALT;
    const stroke = style.stroke
      ? style.stroke
      : hovered
        ? '#7dd3fc'
        : active
          ? C_ACCENT
          : 'rgba(135, 185, 255, 0.34)';

    drawRoundedRect(ctx, x, y, w, h, style.radius ?? 14);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = hovered || active ? 2.5 : 1.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    if (style.dotColor) {
      ctx.beginPath();
      ctx.arc(x + 20, y + h * 0.5, 7, 0, Math.PI * 2);
      ctx.fillStyle = style.dotColor;
      ctx.fill();
    }

    if (style.label) {
      ctx.fillStyle = style.textColor || (hovered ? '#ffffff' : C_TEXT);
      ctx.font = style.font || '600 22px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = style.align || 'center';
      ctx.textBaseline = 'middle';
      const tx =
        style.align === 'left' ? x + (style.dotColor ? 36 : 16) : x + w * 0.5;
      const ty = style.subLabel ? y + h * 0.38 : y + h * 0.5;
      ctx.fillText(style.label, tx, ty, w - (style.dotColor ? 44 : 20));
    }

    if (style.subLabel) {
      ctx.fillStyle = style.subColor || C_MUTED;
      ctx.font = style.subFont || '500 15px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = style.align || 'center';
      ctx.textBaseline = 'middle';
      const tx =
        style.align === 'left' ? x + (style.dotColor ? 36 : 16) : x + w * 0.5;
      ctx.fillText(style.subLabel, tx, y + h * 0.72, w - (style.dotColor ? 44 : 20));
    }
  }

  function renderQuickBar() {
    quickBar.buttons = [];
    const ctx = quickBar.ctx;
    const W = quickBar.widthPx;
    const H = quickBar.heightPx;
    if (ctx) {
      ctx.clearRect(0, 0, W, H);
    }

    if (state.quickBarCompact && !state.tabletOpen) {
      const hasContextAction = Boolean(state.seatedInBridge || state.nearestStationLabel);
      if (hasContextAction) {
        registerBtn(quickBar, 'qb-expand-bar', 164, 108, 336, 68, 'toggle-compact', null, {
          label: '☰ Menú VR',
          subLabel: 'Mostrar barra completa',
          stroke: C_ACCENT,
          font: '700 20px system-ui, sans-serif',
          subFont: '500 14px system-ui, sans-serif',
        });
        registerBtn(quickBar, 'qb-context-act', 516, 108, 344, 68, 'interact-nearest', null, {
          label: state.seatedInBridge ? '🪑 Levantarse' : `⚡ ${truncateText(state.nearestStationLabel, 22)}`,
          subLabel: 'Acción rápida cabina',
          active: true,
          stroke: C_GREEN,
          font: '700 20px system-ui, sans-serif',
          subFont: '500 14px system-ui, sans-serif',
        });
      } else {
        registerBtn(quickBar, 'qb-expand-bar', 292, 108, 440, 68, 'toggle-compact', null, {
          label: '☰ MENÚ VR · Cabina y Espacio',
          subLabel: 'Pulsa o usa B / Grip+Y para abrir',
          stroke: C_ACCENT,
          font: '700 20px system-ui, sans-serif',
          subFont: '500 14px system-ui, sans-serif',
        });
      }
      if (quickBar.texture) quickBar.texture.needsUpdate = true;
      quickBar.dirty = false;
      return;
    }

    if (ctx) {
      drawRoundedRect(ctx, 4, 4, W - 8, H - 8, 24);
      ctx.fillStyle = C_BG;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();

      // Top telemetry micro-bar
      const modeName = state.freeHelmMode
        ? 'Timón Libre'
        : state.viewMode === 3
          ? 'Vista Exterior'
          : `Cabina ${state.activeDeckId}`;
      const locLabel = truncateText(state.nearObject || state.focusedObject || 'Espacio', 16);
      ctx.fillStyle = C_ACCENT;
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const headerLeft = state.travelStatus?.active
        ? `Rumbo ${state.travelStatus.label || ''} · ${Math.round((state.travelStatus.progress || 0) * 100)}%`
        : `KRONOX VR · ${modeName} · ${locLabel}`;
      ctx.fillText(headerLeft, 22, 26, 338);
    }

    const contextBtn = state.seatedInBridge
      ? {
          label: '🪑 Levantarse del asiento',
          action: 'interact-nearest',
          active: true,
          stroke: C_GREEN,
        }
      : state.nearestStationLabel
        ? {
            label: `⚡ Usar: ${truncateText(state.nearestStationLabel, 22)}`,
            action: 'interact-nearest',
            active: true,
            stroke: C_GREEN,
          }
        : state.viewMode === 1
          ? {
              label: state.railAnchored ? '🧲 Soltar barandal' : '🧲 Agarrar barandal',
              action: 'grab-rail',
              active: Boolean(state.railAnchored),
              stroke: C_ACCENT,
            }
          : {
              label: state.freeHelmMode ? '🛸 Salir Timón Libre' : '🛸 Activar Timón Libre',
              action: 'toggle-free-helm',
              active: Boolean(state.freeHelmMode),
              stroke: C_ACCENT,
            };

    registerBtn(quickBar, 'qb-context-act', 370, 8, 370, 36, contextBtn.action, null, {
      label: contextBtn.label,
      active: contextBtn.active,
      stroke: contextBtn.stroke,
      radius: 10,
      font: '700 15px system-ui, sans-serif',
    });
    registerBtn(quickBar, 'qb-recenter-mini', 750, 8, 138, 36, 'recenter-hud', null, {
      label: '⟲ Centrar',
      radius: 10,
      font: '700 15px system-ui, sans-serif',
    });
    registerBtn(quickBar, 'qb-compact-bar', 898, 8, 106, 36, 'toggle-compact', null, {
      label: '▼ Ocultar',
      radius: 10,
      font: '700 14px system-ui, sans-serif',
    });

    const gap = 14;
    const padX = 20;
    const btnY = 52;
    const btnH = 112;
    const count = 5;
    const btnW = Math.floor((W - padX * 2 - gap * (count - 1)) / count);

    const items = [
      {
        id: 'qb-travel',
        label: 'Viajar',
        subLabel: 'Sistema y SPHEREx',
        action: 'open-tab',
        payload: 'travel',
        active: state.tabletOpen && state.activeTab === 'travel',
        stroke: C_ACCENT,
      },
      {
        id: 'qb-spherex',
        label: 'SPHEREx',
        subLabel: 'Misión y FITS',
        action: 'open-tab',
        payload: 'spherex',
        active: state.tabletOpen && state.activeTab === 'spherex',
        stroke: C_VIOLET,
      },
      {
        id: 'qb-kronos',
        label: 'KRONOS IA',
        subLabel: state.aiSpeaking ? 'Hablando…' : 'Asistente 3D',
        action: 'open-tab',
        payload: 'kronos',
        active: state.tabletOpen && state.activeTab === 'kronos',
        stroke: state.aiSpeaking ? C_GREEN : C_VIOLET,
      },
      {
        id: 'qb-view',
        label: state.viewMode === 3 ? 'Cabina 1P' : 'Exterior',
        subLabel: 'Cambiar vista',
        action: 'toggle-view',
        active: state.viewMode === 3,
      },
      state.tabletOpen
        ? {
            id: 'qb-close',
            label: 'Cerrar panel',
            subLabel: 'Ocultar tableta',
            action: 'close-tablet',
            fill: 'rgba(127, 29, 29, 0.55)',
            stroke: '#f87171',
          }
        : {
            id: 'qb-optics',
            label: state.opticalEnabled ? `Óptica ${state.opticalMag}×` : 'Óptica 1×',
            subLabel: 'Alternar zoom',
            action: 'toggle-optics',
            active: state.opticalEnabled,
          },
    ];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      registerBtn(
        quickBar,
        it.id,
        padX + i * (btnW + gap),
        btnY,
        btnW,
        btnH,
        it.action,
        it.payload,
        {
          label: it.label,
          subLabel: it.subLabel,
          active: it.active,
          fill: it.fill,
          stroke: it.stroke,
          font: '700 22px system-ui, sans-serif',
          subFont: '500 15px system-ui, sans-serif',
        },
      );
    }

    if (quickBar.texture) quickBar.texture.needsUpdate = true;
    quickBar.dirty = false;
  }

  function renderSubtitleBanner() {
    subtitleSurface.buttons = [];
    const ctx = subtitleSurface.ctx;
    const W = subtitleSurface.widthPx;
    const H = subtitleSurface.heightPx;
    if (ctx) {
      ctx.clearRect(0, 0, W, H);
      drawRoundedRect(ctx, 4, 4, W - 8, H - 8, 22);
      ctx.fillStyle = 'rgba(10, 16, 36, 0.92)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = state.aiSpeaking ? C_GREEN : C_VIOLET;
      ctx.stroke();

      ctx.fillStyle = C_VIOLET;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `✦ ${state.assistantTitle} · ${state.aiSpeaking ? 'Locución activa' : state.assistantRole}`,
        24,
        28,
      );

      ctx.fillStyle = C_ACCENT;
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Pulsa para abrir asistente ↗', W - 24, 28);

      ctx.fillStyle = '#f8fbff';
      ctx.font = '500 23px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      drawWrappedText(ctx, state.assistantMessage, 24, 68, W - 48, 30, 3);
    }
    subtitleSurface.buttons.push({
      id: 'sub-open-kronos',
      x: 0,
      y: 0,
      w: W,
      h: H,
      action: 'open-tab',
      payload: 'kronos',
    });
    if (subtitleSurface.texture) subtitleSurface.texture.needsUpdate = true;
    subtitleSurface.dirty = false;
  }

  function renderTravelTab(W, H) {
    const ctx = tabletSurface.ctx;
    const yTop = 104;

    if (ctx) {
      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, 24, yTop, W - 48, 76, 16);
      ctx.fill();
      ctx.strokeStyle = C_BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const modeLabel =
      state.travelActionMode === 'focus' ? 'Modo: Enfocar (cámara)' : 'Modo: Viajar (nave)';
    registerBtn(tabletSurface, 'tr-mode', 38, yTop + 12, 266, 52, 'toggle-travel-mode', null, {
      label: modeLabel,
      active: state.travelActionMode === 'travel',
      font: '700 19px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'tr-helm', 316, yTop + 12, 210, 52, 'toggle-free-helm', null, {
      label: state.freeHelmMode ? 'Salir Timón' : 'Timón Libre',
      active: state.freeHelmMode,
      font: '700 19px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'tr-view', 538, yTop + 12, 214, 52, 'toggle-view', null, {
      label: state.viewMode === 3 ? 'Ir a Cabina' : 'Ir a Exterior',
      active: state.viewMode === 3,
      font: '700 19px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'tr-optics', 764, yTop + 12, 210, 52, 'toggle-optics', null, {
      label: state.opticalEnabled ? `Óptica ${state.opticalMag}×` : 'Óptica 1×',
      active: state.opticalEnabled,
      font: '700 19px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'tr-pause', 986, yTop + 12, 256, 52, 'open-pause', null, {
      label: 'Menú y ajustes',
      font: '700 19px system-ui, sans-serif',
    });

    // Left panel: Solar System grid (3 columns x 4 rows)
    const gridX = 24;
    const gridY = yTop + 94;
    const gridW = 688;
    if (ctx) {
      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, gridX, gridY, gridW, H - gridY - 24, 18);
      ctx.fill();
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();

      ctx.fillStyle = C_ACCENT;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('SISTEMA SOLAR · DESTINOS DIRECTOS', gridX + 20, gridY + 26);
    }

    const colW = 208;
    const rowH = 112;
    const gapX = 16;
    const gapY = 14;
    for (let i = 0; i < PLANET_NAMES_ORDER.length; i++) {
      const name = PLANET_NAMES_ORDER[i];
      const pObj = P.find((item) => item.n === name);
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = gridX + 18 + col * (colW + gapX);
      const by = gridY + 52 + row * (rowH + gapY);
      const sub = pObj?.sun
        ? 'Estrella central'
        : pObj?.moon
          ? 'Satélite Tierra'
          : Number.isFinite(pObj?.au)
            ? `${pObj.au} UA`
            : 'Planeta';
      const isCurrent = state.focusedObject === name || state.nearObject === name;
      registerBtn(
        tabletSurface,
        `tr-planet-${name}`,
        bx,
        by,
        colW,
        rowH,
        'travel-planet',
        name,
        {
          label: name,
          subLabel: sub,
          dotColor: planetAccentCss(pObj),
          align: 'left',
          active: isCurrent,
          font: '700 21px system-ui, sans-serif',
          subFont: '500 15px system-ui, sans-serif',
        },
      );
    }

    // Right panel: Quick Jumps, SPHEREx targets, Cabin Decks
    const rightX = 728;
    const rightW = W - rightX - 24;
    const rightY = gridY;
    if (ctx) {
      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, rightX, rightY, rightW, H - rightY - 24, 18);
      ctx.fill();
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();

      ctx.fillStyle = C_ACCENT;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('REGIONES CÓSMICAS Y SALTOS', rightX + 18, rightY + 24);
    }

    const qBtnW = 242;
    const qBtnH = 66;
    for (let i = 0; i < QUICK_DESTINATIONS.length; i++) {
      const q = QUICK_DESTINATIONS[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      registerBtn(
        tabletSurface,
        `tr-quick-${q.id}`,
        rightX + 18 + col * (qBtnW + 12),
        rightY + 46 + row * (qBtnH + 10),
        qBtnW,
        qBtnH,
        'travel-quick',
        q.id,
        {
          label: q.label,
          subLabel: q.badge,
          font: '700 18px system-ui, sans-serif',
          subFont: '500 14px system-ui, sans-serif',
        },
      );
    }

    const spY = rightY + 206;
    if (ctx) {
      ctx.fillStyle = C_VIOLET;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ESTRELLAS Y GALAXIAS SPHEREx', rightX + 18, spY);
    }

    for (let i = 0; i < SPHEREX_NAV_TARGETS.length; i++) {
      const sp = SPHEREX_NAV_TARGETS[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const wide = i === SPHEREX_NAV_TARGETS.length - 1 ? qBtnW * 2 + 12 : qBtnW;
      registerBtn(
        tabletSurface,
        `tr-spx-${sp.key}`,
        rightX + 18 + col * (qBtnW + 12),
        spY + 20 + row * 60,
        wide,
        52,
        'travel-spherex',
        sp.key,
        {
          label: sp.label,
          active: state.spherexTargetKey === sp.key,
          font: '700 17px system-ui, sans-serif',
        },
      );
    }

    const deckY = spY + 216;
    if (ctx) {
      ctx.fillStyle = C_GREEN;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ASCENSOR Y CUBIERTAS C01–C04', rightX + 18, deckY);
    }

    const dW = 115;
    for (let i = 0; i < SHIP_DECKS.length; i++) {
      const dk = SHIP_DECKS[i];
      registerBtn(
        tabletSurface,
        `tr-deck-${dk.id}`,
        rightX + 18 + i * (dW + 12),
        deckY + 22,
        dW,
        74,
        'select-deck',
        dk.id,
        {
          label: dk.id,
          subLabel: dk.label.split(' ')[1],
          active: state.activeDeckId === dk.id && state.viewMode === 1,
          font: '700 20px system-ui, sans-serif',
          subFont: '500 13px system-ui, sans-serif',
        },
      );
    }
  }

  function renderSpherexTab(W, H) {
    const ctx = tabletSurface.ctx;
    const yTop = 104;
    const leftX = 24;
    const leftW = 356;
    const target = resolveSpherexTarget();
    const primaryTargets = SPHEREX_TARGETS.slice(0, 7);
    const pageSize = 5;
    const maxPage = Math.max(0, Math.ceil(primaryTargets.length / pageSize) - 1);
    const page = Math.min(state.spherexPage, maxPage);
    const pageItems = primaryTargets.slice(page * pageSize, page * pageSize + pageSize);

    if (ctx) {
      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, leftX, yTop, leftW, H - yTop - 24, 18);
      ctx.fill();
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();

      ctx.fillStyle = C_VIOLET;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('OBJETIVOS SPHEREx', leftX + 18, yTop + 24);
    }

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      const hasLocal = Array.isArray(item.localRecords) && item.localRecords.length > 0;
      registerBtn(
        tabletSurface,
        `spx-target-${item.key}`,
        leftX + 14,
        yTop + 46 + i * 76,
        leftW - 28,
        68,
        'spherex-select-target',
        item.key,
        {
          label: item.name,
          subLabel: `${hasLocal ? 'FITS Local' : 'Archivo IRSA'} · ${item.preferredBand || 'NIR'}`,
          align: 'left',
          active: item.key === target.key,
          dotColor: hasLocal ? C_GREEN : C_ACCENT,
          font: '700 18px system-ui, sans-serif',
          subFont: '500 14px system-ui, sans-serif',
        },
      );
    }

    registerBtn(tabletSurface, 'spx-prev-page', leftX + 14, yTop + 432, 158, 46, 'spherex-page', -1, {
      label: '◀ Anteriores',
      font: '600 16px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'spx-next-page', leftX + 184, yTop + 432, 158, 46, 'spherex-page', 1, {
      label: 'Siguientes ▶',
      font: '600 16px system-ui, sans-serif',
    });

    if (ctx) {
      const boxY = yTop + 492;
      ctx.fillStyle = 'rgba(9, 17, 34, 0.9)';
      drawRoundedRect(ctx, leftX + 14, boxY, leftW - 28, 128, 12);
      ctx.fill();
      ctx.fillStyle = C_TEXT;
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(target.name, leftX + 26, boxY + 24, leftW - 52);
      ctx.fillStyle = C_MUTED;
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText(
        `RA ${Number(target.ra || 0).toFixed(3)}° · Dec ${Number(target.dec || 0).toFixed(3)}°`,
        leftX + 26,
        boxY + 48,
        leftW - 52,
      );
      drawWrappedText(
        ctx,
        target.distanceLabel || target.note || 'Objetivo científico SPHEREx.',
        leftX + 26,
        boxY + 72,
        leftW - 52,
        20,
        3,
      );
    }

    registerBtn(
      tabletSurface,
      'spx-jump-3d',
      leftX + 14,
      H - 92,
      leftW - 28,
      58,
      'travel-spherex',
      target.key,
      {
        label: 'Saltar al objetivo en 3D',
        fill: 'rgba(16, 118, 92, 0.72)',
        stroke: C_GREEN,
        font: '700 19px system-ui, sans-serif',
      },
    );

    // Right workbench area
    const rightX = leftX + leftW + 18;
    const rightW = W - rightX - 24;
    if (ctx) {
      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, rightX, yTop, rightW, H - yTop - 24, 18);
      ctx.fill();
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();
    }

    const toolbarY = yTop + 14;
    registerBtn(tabletSurface, 'spx-mode-a', rightX + 16, toolbarY, 134, 50, 'spherex-mode', 'A', {
      label: 'Época A',
      active: state.spherexViewMode === 'A',
      font: '700 17px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'spx-mode-b', rightX + 160, toolbarY, 134, 50, 'spherex-mode', 'B', {
      label: 'Época B',
      active: state.spherexViewMode === 'B',
      font: '700 17px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'spx-mode-diff', rightX + 304, toolbarY, 152, 50, 'spherex-mode', 'diff', {
      label: 'Dif. B − A',
      active: state.spherexViewMode === 'diff',
      font: '700 17px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'spx-mode-blink', rightX + 466, toolbarY, 140, 50, 'spherex-mode', 'blink', {
      label: 'Parpadeo',
      active: state.spherexViewMode === 'blink',
      font: '700 17px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'spx-query-irsa', rightX + 618, toolbarY, 224, 50, 'spherex-query-irsa', null, {
      label: state.spherexArchiveBusy ? 'Consultando IRSA…' : 'Consultar archivo IRSA',
      stroke: C_ACCENT,
      font: '700 16px system-ui, sans-serif',
    });

    // FITS image viewport
    const viewX = rightX + 20;
    const viewY = toolbarY + 66;
    const viewSize = 446;
    const activeFrame =
      state.spherexViewMode === 'B'
        ? state.spherexFrameB || state.spherexFrameA
        : state.spherexViewMode === 'blink' && state.spherexBlinkEpoch === 'B'
          ? state.spherexFrameB || state.spherexFrameA
          : state.spherexFrameA;
    const activePreview =
      state.spherexViewMode === 'diff'
        ? state.spherexCanvasDiff || state.spherexCanvasA
        : state.spherexViewMode === 'B'
          ? state.spherexCanvasB || state.spherexCanvasA
          : state.spherexViewMode === 'blink' && state.spherexBlinkEpoch === 'B'
            ? state.spherexCanvasB || state.spherexCanvasA
            : state.spherexCanvasA;

    if (ctx) {
      drawRoundedRect(ctx, viewX, viewY, viewSize, viewSize, 14);
      ctx.fillStyle = '#040814';
      ctx.fill();
      ctx.strokeStyle = 'rgba(104, 178, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (activePreview && activePreview.width > 0) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(activePreview, viewX + 8, viewY + 8, viewSize - 16, viewSize - 16);
        ctx.restore();
      } else {
        ctx.fillStyle = C_MUTED;
        ctx.font = '600 19px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          state.spherexLoading ? 'Decodificando FITS…' : 'Sin imagen FITS activa',
          viewX + viewSize * 0.5,
          viewY + viewSize * 0.5,
        );
      }

      // Crosshair overlay inside FITS frame
      const cx = viewX + viewSize * 0.5;
      const cy = viewY + viewSize * 0.5;
      ctx.strokeStyle = 'rgba(76, 201, 240, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy);
      ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy);
      ctx.lineTo(cx + 24, cy);
      ctx.moveTo(cx, cy - 24);
      ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx, cy + 8);
      ctx.lineTo(cx, cy + 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Right-hand telemetry & scientific notes inside SPHEREx workbench
      const infoX = viewX + viewSize + 20;
      const infoW = rightX + rightW - infoX - 20;
      ctx.fillStyle = C_TEXT;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Datos del recorte FITS', infoX, viewY + 24);

      const rec = activeFrame?.record;
      const lines = [
        `Banda: ${rec?.band || target.preferredBand || '—'}`,
        `MJD: ${rec?.dateAvg || rec?.date || '—'}`,
        `Resolución: ${activeFrame?.width ? `${activeFrame.width}×${activeFrame.height}` : 'Pendiente'}`,
        `λ centro: ${rec?.wavelengthAtTargetUm ? `${rec.wavelengthAtTargetUm.toFixed(4)} μm` : 'Consultando WCS'}`,
        `Cuaderno: ${state.spherexFindingsCount} hallazgo(s)`,
      ];
      ctx.fillStyle = C_ACCENT;
      ctx.font = '600 16px system-ui, sans-serif';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], infoX, viewY + 58 + i * 28, infoW);
      }

      ctx.fillStyle = C_MUTED;
      ctx.font = '500 15px system-ui, sans-serif';
      drawWrappedText(
        ctx,
        state.spherexError ||
          state.spherexNotice ||
          target.observationSummary ||
          target.scientificLimitations ||
          'Inspección multi-época real SPHEREx QR2.',
        infoX,
        viewY + 218,
        infoW,
        22,
        7,
      );
    }

    const actionBtnX = viewX + viewSize + 20;
    const actionBtnW = rightX + rightW - actionBtnX - 20;
    registerBtn(
      tabletSurface,
      'spx-save-finding',
      actionBtnX,
      H - 162,
      actionBtnW,
      58,
      'spherex-save-finding',
      null,
      {
        label: 'Guardar hallazgo en cuaderno',
        fill: 'rgba(16, 118, 92, 0.72)',
        stroke: C_GREEN,
        font: '700 18px system-ui, sans-serif',
      },
    );
    registerBtn(
      tabletSurface,
      'spx-open-2d',
      actionBtnX,
      H - 92,
      actionBtnW,
      58,
      'open-spherex-2d',
      target.key,
      {
        label: 'Abrir visor SPHEREx completo',
        font: '700 18px system-ui, sans-serif',
      },
    );
  }

  function renderKronosTab(W, H) {
    const ctx = tabletSurface.ctx;
    const yTop = 104;

    if (ctx) {
      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, 24, yTop, W - 48, 76, 16);
      ctx.fill();
      ctx.strokeStyle = C_VIOLET;
      ctx.stroke();

      ctx.fillStyle = C_VIOLET;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `✦ ${state.assistantTitle} · ${state.aiSpeaking ? 'Hablando ahora' : state.aiStateLabel}`,
        42,
        yTop + 26,
      );

      ctx.fillStyle = C_MUTED;
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText(state.assistantCategory || state.assistantRole, 42, yTop + 52, 520);
    }

    registerBtn(tabletSurface, 'kr-voice', 592, yTop + 12, 184, 52, 'kronos-toggle-voice', null, {
      label: state.voiceEnabled ? '🔊 Voz: ON' : '🔇 Voz: OFF',
      active: state.voiceEnabled,
      font: '700 18px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'kr-repeat', 788, yTop + 12, 198, 52, 'kronos-repeat', null, {
      label: '↺ Repetir voz',
      font: '700 18px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'kr-summon', 998, yTop + 12, 244, 52, 'kronos-summon-orb', null, {
      label: '✨ Traer esfera 3D',
      stroke: C_GREEN,
      font: '700 18px system-ui, sans-serif',
    });

    // Response card
    const msgY = yTop + 92;
    const msgH = 218;
    if (ctx) {
      ctx.fillStyle = 'rgba(11, 20, 44, 0.95)';
      drawRoundedRect(ctx, 24, msgY, W - 48, msgH, 18);
      ctx.fill();
      ctx.strokeStyle = state.aiSpeaking ? C_GREEN : C_BORDER;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = state.kronoxBusy ? C_AMBER : C_ACCENT;
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(
        state.kronoxBusy ? 'Procesando consulta con Kronox IA…' : 'RESPUESTA DE KRONOX IA',
        44,
        msgY + 30,
      );

      ctx.fillStyle = '#f6f9ff';
      ctx.font = '500 22px system-ui, sans-serif';
      drawWrappedText(ctx, state.assistantMessage, 44, msgY + 66, W - 88, 30, 5);
    }

    // Quick prompts grid (2 cols x 4 rows) + pager
    const gridY = msgY + msgH + 18;
    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(KRONOX_QUICK_PROMPTS.length / pageSize));
    const page = state.promptPage % totalPages;
    const visiblePrompts = KRONOX_QUICK_PROMPTS.slice(page * pageSize, page * pageSize + pageSize);

    const colW = 594;
    const rowH = 66;
    for (let i = 0; i < visiblePrompts.length; i++) {
      const p = visiblePrompts[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      registerBtn(
        tabletSurface,
        `kr-prompt-${page}-${i}`,
        24 + col * (colW + 44),
        gridY + row * (rowH + 12),
        colW,
        rowH,
        'kronos-query',
        p.query,
        {
          label: p.label,
          subLabel: p.query,
          align: 'left',
          font: '700 18px system-ui, sans-serif',
          subFont: '500 14px system-ui, sans-serif',
        },
      );
    }

    registerBtn(tabletSurface, 'kr-prompts-more', 24, H - 72, 340, 48, 'kronos-prompt-page', 1, {
      label: `Más preguntas (${page + 1}/${totalPages}) ↻`,
      font: '700 17px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'kr-open-tour', 384, H - 72, 340, 48, 'kronos-start-tour', null, {
      label: '🧭 Tour guiado por Kronox',
      font: '700 17px system-ui, sans-serif',
    });
  }

  function renderCabinTab(W, H) {
    const ctx = tabletSurface.ctx;
    const yTop = 104;
    const leftX = 24;
    const leftW = 604;
    const rightX = 648;
    const rightW = W - rightX - 24;
    const panelH = H - yTop - 24;

    if (ctx) {
      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, leftX, yTop, leftW, panelH, 18);
      ctx.fill();
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();

      ctx.fillStyle = C_ACCENT;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('INTERACCIÓN EN CABINA Y CUBIERTAS', leftX + 20, yTop + 26);

      ctx.fillStyle = C_CARD;
      drawRoundedRect(ctx, rightX, yTop, rightW, panelH, 18);
      ctx.fill();
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();

      ctx.fillStyle = C_VIOLET;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NAVE, ESPACIO Y CONTROLES QUEST VR', rightX + 20, yTop + 26);
    }

    const nearLabel = state.seatedInBridge
      ? '🪑 Levantarse del asiento de mando'
      : state.nearestStationLabel
        ? `⚡ Activar: ${truncateText(state.nearestStationLabel, 30)}`
        : '⚡ Apunta con el láser o acércate a una consola';
    registerBtn(tabletSurface, 'cab-interact-near', leftX + 20, yTop + 52, leftW - 40, 86, 'interact-nearest', null, {
      label: nearLabel,
      subLabel: state.seatedInBridge
        ? 'Salir del asiento y caminar por Cabina 1P'
        : state.nearestStationId
          ? `Estación detectada (${state.nearestStationId})`
          : 'También puedes usar Gatillo I / D sobre cualquier objeto 3D',
      active: Boolean(state.seatedInBridge || state.nearestStationLabel),
      stroke: state.seatedInBridge || state.nearestStationLabel ? C_GREEN : C_BORDER,
      align: 'left',
      font: '700 21px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });

    registerBtn(tabletSurface, 'cab-grab-rail', leftX + 20, yTop + 154, leftW - 40, 74, 'grab-rail', null, {
      label: state.railAnchored ? '🧲 Soltar pasamanos EVA' : '🧲 Agarrar / soltar pasamanos cercano',
      subLabel: 'Atajo rápido en VR: Empuñadura (Grip L o R)',
      active: Boolean(state.railAnchored),
      stroke: C_ACCENT,
      align: 'left',
      font: '700 20px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });

    if (ctx) {
      ctx.fillStyle = C_ACCENT;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ASCENSOR Y TELETRANSPORTE ENTRE CUBIERTAS', leftX + 20, yTop + 258);
    }

    const deckList = [
      { code: 'C01', deckId: 'deck-01', name: 'Puente y Mando' },
      { code: 'C02', deckId: 'deck-02', name: 'Habitación y Vistas' },
      { code: 'C03', deckId: 'deck-03', name: 'Laboratorio y Reactor' },
      { code: 'C04', deckId: 'deck-04', name: 'Hangar y Salida EVA' },
    ];
    const dBtnW = Math.floor((leftW - 56) / 2);
    for (let i = 0; i < deckList.length; i++) {
      const d = deckList[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      registerBtn(
        tabletSurface,
        `cab-deck-${d.code}`,
        leftX + 20 + col * (dBtnW + 16),
        yTop + 280 + row * 94,
        dBtnW,
        82,
        'select-deck',
        d.deckId,
        {
          label: `${d.code} · Cubierta ${i + 1}`,
          subLabel: d.name,
          active: state.activeDeckId === d.code,
          font: '700 20px system-ui, sans-serif',
          subFont: '500 15px system-ui, sans-serif',
        },
      );
    }

    registerBtn(tabletSurface, 'cab-open-kronos', leftX + 20, yTop + 482, leftW - 40, 74, 'open-tab', 'kronos', {
      label: '✦ Hablar o consultar a KRONOS IA',
      subLabel: 'Preguntas científicas, voz espacial e IA a bordo',
      stroke: C_VIOLET,
      font: '700 20px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });

    const rColW = Math.floor((rightW - 56) / 2);
    registerBtn(tabletSurface, 'cab-toggle-view', rightX + 20, yTop + 52, rColW, 84, 'toggle-view', null, {
      label: state.viewMode === 3 ? 'Ir a Cabina 1P' : 'Vista Exterior 120m',
      subLabel: 'Botón A / X',
      active: state.viewMode === 3,
      font: '700 19px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'cab-toggle-helm', rightX + 36 + rColW, yTop + 52, rColW, 84, 'toggle-free-helm', null, {
      label: state.freeHelmMode ? 'Salir Timón Libre' : 'Timón Libre 6-DOF',
      subLabel: 'Botón B (Exterior)',
      active: state.freeHelmMode,
      font: '700 19px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });

    registerBtn(tabletSurface, 'cab-toggle-optics', rightX + 20, yTop + 150, rColW, 84, 'toggle-optics', null, {
      label: state.opticalEnabled ? `Óptica ${state.opticalMag}× ON` : 'Telescopio Óptico',
      subLabel: 'Botón Y · Zoom espacial',
      active: state.opticalEnabled,
      font: '700 19px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'cab-summon-orb', rightX + 36 + rColW, yTop + 150, rColW, 84, 'kronos-summon-orb', null, {
      label: '✦ Llamar Esfera IA',
      subLabel: 'Traer holograma frente a ti',
      stroke: C_VIOLET,
      font: '700 19px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });

    registerBtn(tabletSurface, 'cab-start-tour', rightX + 20, yTop + 248, rColW, 80, 'kronos-start-tour', null, {
      label: '▶ Tour guiado nave',
      subLabel: 'Recorrido C01–C04',
      font: '700 19px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'cab-open-travel', rightX + 36 + rColW, yTop + 248, rColW, 80, 'open-tab', 'travel', {
      label: '🚀 Destinos y Mapa',
      subLabel: 'Planetas y regiones',
      stroke: C_ACCENT,
      font: '700 19px system-ui, sans-serif',
      subFont: '500 15px system-ui, sans-serif',
    });

    registerBtn(tabletSurface, 'cab-recenter', rightX + 20, yTop + 342, rColW, 74, 'recenter-hud', null, {
      label: '⟲ Centrar vista HMD',
      subLabel: 'R3 o Grip I + Gatillo I',
      font: '700 18px system-ui, sans-serif',
      subFont: '500 14px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'cab-pause', rightX + 36 + rColW, yTop + 342, rColW, 74, 'open-pause', null, {
      label: '⚙ Ajustes / Gráficos',
      subLabel: 'Abrir menú 2D',
      font: '700 18px system-ui, sans-serif',
      subFont: '500 14px system-ui, sans-serif',
    });

    if (ctx) {
      drawRoundedRect(ctx, rightX + 20, yTop + 434, rightW - 40, 122, 14);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.stroke();

      ctx.fillStyle = C_ACCENT;
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ATAJOS META QUEST TOUCH EN VR', rightX + 36, yTop + 460);
      ctx.fillStyle = C_TEXT;
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText('• Stick I: mover / L3: impulso   • Stick D: girar y subir/bajar', rightX + 36, yTop + 490);
      ctx.fillText('• Gatillo I o D: usar menú o consola   • Grip I/D: freno y barandal', rightX + 36, yTop + 515);
      ctx.fillText('• B (Cabina) o Grip + B / Y: abrir tableta   • R3: centrar visor', rightX + 36, yTop + 540);
    }
  }

  function renderTablet() {
    tabletSurface.buttons = [];
    const ctx = tabletSurface.ctx;
    const W = tabletSurface.widthPx;
    const H = tabletSurface.heightPx;
    if (ctx) {
      ctx.clearRect(0, 0, W, H);
      drawRoundedRect(ctx, 4, 4, W - 8, H - 8, 28);
      ctx.fillStyle = C_BG;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C_BORDER;
      ctx.stroke();

      ctx.fillStyle = C_ACCENT;
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('KRONOX · PANEL VR', 28, 48);
    }

    const tabs = [
      { id: 'tab-travel', label: '🚀 Viajar', value: 'travel' },
      { id: 'tab-spherex', label: '🔬 SPHEREx', value: 'spherex' },
      { id: 'tab-kronos', label: '✦ KRONOS', value: 'kronos' },
      { id: 'tab-cabin', label: '🛠 Cabina', value: 'cabin' },
    ];
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      registerBtn(tabletSurface, t.id, 296 + i * 160, 18, 150, 62, 'open-tab', t.value, {
        label: t.label,
        active: state.activeTab === t.value,
        font: '700 19px system-ui, sans-serif',
      });
    }

    registerBtn(tabletSurface, 'tb-recenter', 948, 18, 150, 62, 'recenter-hud', null, {
      label: '⟲ Centrar',
      font: '700 18px system-ui, sans-serif',
    });
    registerBtn(tabletSurface, 'tb-close', 1110, 18, 142, 62, 'close-tablet', null, {
      label: '✕ Cerrar',
      fill: 'rgba(127, 29, 29, 0.58)',
      stroke: '#f87171',
      font: '700 18px system-ui, sans-serif',
    });

    if (state.activeTab === 'travel') renderTravelTab(W, H);
    else if (state.activeTab === 'spherex') renderSpherexTab(W, H);
    else if (state.activeTab === 'cabin') renderCabinTab(W, H);
    else renderKronosTab(W, H);

    if (tabletSurface.texture) tabletSurface.texture.needsUpdate = true;
    tabletSurface.dirty = false;
  }

  function findButtonAtUv(surface, uv) {
    if (!surface || !uv) return null;
    const px = uv.x * surface.widthPx;
    const py = (1 - uv.y) * surface.heightPx;
    for (let i = surface.buttons.length - 1; i >= 0; i--) {
      const b = surface.buttons[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  function ensurePopulatedButtons() {
    if (quickBar.dirty || quickBar.buttons.length === 0) renderQuickBar();
    if (subtitleSurface.dirty || subtitleSurface.buttons.length === 0) renderSubtitleBanner();
    if (state.tabletOpen && (tabletSurface.dirty || tabletSurface.buttons.length === 0)) {
      renderTablet();
    }
  }

  function openWithTab(tabId = 'travel') {
    const validTab =
      tabId === 'spherex' || tabId === 'kronos' || tabId === 'cabin' ? tabId : 'travel';
    state.activeTab = validTab;
    state.tabletOpen = true;
    forceSnapPose = true;
    if (validTab === 'spherex' && !state.spherexFrameA && !state.spherexLoading) {
      loadSpherexTargetData(state.spherexTargetKey);
    }
    markAllDirty();
    ensurePopulatedButtons();
    return getState();
  }

  function closeTablet() {
    state.tabletOpen = false;
    markAllDirty();
    ensurePopulatedButtons();
    return getState();
  }

  function toggleTablet(tabId = null) {
    if (state.tabletOpen && (!tabId || state.activeTab === tabId)) {
      return closeTablet();
    }
    return openWithTab(tabId || state.activeTab || 'travel');
  }

  function executeButton(btn) {
    if (!btn) return { handled: false };
    switch (btn.action) {
      case 'open-tab':
        if (state.tabletOpen && state.activeTab === btn.payload && btn.id.startsWith('qb-')) {
          closeTablet();
        } else {
          openWithTab(btn.payload);
        }
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'close-tablet':
        closeTablet();
        return { handled: true, action: btn.action };
      case 'recenter-hud':
        forceSnapPose = true;
        callbacks.onRecenterVr?.();
        return { handled: true, action: btn.action };
      case 'toggle-view': {
        const nextView = state.viewMode === 3 ? 1 : 3;
        state.viewMode = nextView;
        markAllDirty();
        callbacks.onToggleView?.(nextView);
        return { handled: true, action: btn.action, payload: nextView };
      }
      case 'toggle-optics':
        callbacks.onToggleOptics?.();
        return { handled: true, action: btn.action };
      case 'toggle-travel-mode':
        state.travelActionMode = state.travelActionMode === 'travel' ? 'focus' : 'travel';
        tabletSurface.dirty = true;
        return { handled: true, action: btn.action, payload: state.travelActionMode };
      case 'toggle-free-helm':
        callbacks.onToggleFreeHelm?.();
        return { handled: true, action: btn.action };
      case 'interact-nearest':
        closeTablet();
        callbacks.onInteractNearest?.();
        return { handled: true, action: btn.action };
      case 'grab-rail':
        callbacks.onGrabRail?.();
        return { handled: true, action: btn.action };
      case 'toggle-compact':
        state.quickBarCompact = !state.quickBarCompact;
        quickBar.dirty = true;
        return { handled: true, action: btn.action, payload: state.quickBarCompact };
      case 'open-pause':
        closeTablet();
        callbacks.onPauseMenuRequest?.();
        return { handled: true, action: btn.action };
      case 'travel-planet':
        state.focusedObject = btn.payload;
        if (state.travelActionMode === 'travel') closeTablet();
        else tabletSurface.dirty = true;
        callbacks.onTravelRequest?.({
          kind: 'planet',
          target: btn.payload,
          mode: state.travelActionMode,
        });
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'travel-quick':
        closeTablet();
        callbacks.onTravelRequest?.({
          kind: 'quick',
          target: btn.payload,
          mode: 'travel',
        });
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'travel-spherex':
        state.spherexTargetKey = btn.payload;
        closeTablet();
        callbacks.onTravelRequest?.({
          kind: 'spherex',
          target: btn.payload,
          mode: 'travel',
        });
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'select-deck':
        state.activeDeckId = btn.payload;
        closeTablet();
        callbacks.onSelectDeck?.(btn.payload);
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'spherex-select-target':
        loadSpherexTargetData(btn.payload);
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'spherex-page': {
        const totalPages = Math.max(1, Math.ceil(Math.min(7, SPHEREX_TARGETS.length) / 5));
        state.spherexPage = Math.max(0, Math.min(totalPages - 1, state.spherexPage + Number(btn.payload || 0)));
        tabletSurface.dirty = true;
        return { handled: true, action: btn.action, payload: state.spherexPage };
      }
      case 'spherex-mode':
        state.spherexViewMode = btn.payload;
        tabletSurface.dirty = true;
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'spherex-query-irsa':
        queryArchiveForCurrentTarget();
        return { handled: true, action: btn.action };
      case 'spherex-save-finding':
        return { handled: true, action: btn.action, ...saveCurrentSpherexFinding() };
      case 'open-spherex-2d':
        closeTablet();
        callbacks.onOpenSpherex2D?.(btn.payload);
        return { handled: true, action: btn.action, payload: btn.payload };
      case 'kronos-toggle-voice':
        state.voiceEnabled = !state.voiceEnabled;
        markAllDirty();
        callbacks.onToggleVoice?.(state.voiceEnabled);
        return { handled: true, action: btn.action, payload: state.voiceEnabled };
      case 'kronos-repeat':
        callbacks.onRepeatVoice?.();
        return { handled: true, action: btn.action };
      case 'kronos-summon-orb':
        callbacks.onSummonOrb?.();
        setAssistantMessage({
          title: 'Kronox IA',
          message: 'Esfera holográfica situada frente a ti.',
          speaking: false,
          durationSec: 4,
        });
        return { handled: true, action: btn.action };
      case 'kronos-prompt-page': {
        const total = Math.max(1, Math.ceil(KRONOX_QUICK_PROMPTS.length / 8));
        state.promptPage = (state.promptPage + 1) % total;
        tabletSurface.dirty = true;
        return { handled: true, action: btn.action, payload: state.promptPage };
      }
      case 'kronos-start-tour':
        closeTablet();
        callbacks.onStartGuidedTour?.();
        return { handled: true, action: btn.action };
      case 'kronos-query':
        state.kronoxBusy = true;
        tabletSurface.dirty = true;
        Promise.resolve(
          callbacks.onKronoxQuery
            ? callbacks.onKronoxQuery(btn.payload)
            : processKronoxQuery(btn.payload, {
                nearPlanet: state.nearObject || 'Tierra',
                focusedPlanet: state.focusedObject || state.nearObject || 'Tierra',
                viewMode: state.viewMode,
                activeTargetKey: state.spherexTargetKey,
              }),
        )
          .then((replyObj) => {
            state.kronoxBusy = false;
            if (replyObj?.reply) {
              setAssistantMessage({
                title: replyObj.role || 'Kronox IA',
                message: replyObj.reply,
                category: replyObj.epistemicCategory || 'Asistente KRONOX',
                speaking: true,
                durationSec: 12,
              });
            } else {
              tabletSurface.dirty = true;
            }
          })
          .catch(() => {
            state.kronoxBusy = false;
            tabletSurface.dirty = true;
          });
        return { handled: true, action: btn.action, payload: btn.payload };
      default:
        return { handled: false };
    }
  }

  function handleHitClick(hit) {
    if (!hit) return { handled: false };
    ensurePopulatedButtons();
    const sid = hit.stationId || hit.interactId || hit.object?.userData?.interactId;
    const surface =
      sid === quickBar.interactId
        ? quickBar
        : sid === tabletSurface.interactId
          ? tabletSurface
          : sid === subtitleSurface.interactId
            ? subtitleSurface
            : null;
    if (!surface) return { handled: false };
    const btn = findButtonAtUv(surface, hit.uv);
    if (!btn) {
      if (sid === subtitleSurface.interactId) {
        openWithTab('kronos');
        return { handled: true, action: 'open-tab', payload: 'kronos' };
      }
      return { handled: true, missedButton: true };
    }
    return executeButton(btn);
  }

  function setHoverHit(hit) {
    ensurePopulatedButtons();
    const sid = hit?.stationId || hit?.interactId || hit?.object?.userData?.interactId || null;
    const surface =
      sid === quickBar.interactId
        ? quickBar
        : sid === tabletSurface.interactId
          ? tabletSurface
          : sid === subtitleSurface.interactId
            ? subtitleSurface
            : null;
    const btn = surface ? findButtonAtUv(surface, hit?.uv) : null;
    const nextSurfId = surface ? surface.interactId : null;
    const nextBtnId = btn ? btn.id : null;
    if (nextSurfId !== state.hoveredSurfaceId || nextBtnId !== state.hoveredButtonId) {
      state.hoveredSurfaceId = nextSurfId;
      state.hoveredButtonId = nextBtnId;
      markAllDirty();
    }
  }

  function setAssistantMessage({
    title,
    message,
    role,
    category,
    speaking = false,
    durationSec = 9,
  } = {}) {
    let changed = false;
    if (title && title !== state.assistantTitle) {
      state.assistantTitle = String(title);
      changed = true;
    }
    if (role && role !== state.assistantRole) {
      state.assistantRole = String(role);
      changed = true;
    }
    if (category && category !== state.assistantCategory) {
      state.assistantCategory = String(category);
      changed = true;
    }
    if (typeof message === 'string' && message.trim() && message !== state.assistantMessage) {
      state.assistantMessage = message.trim();
      state.subtitleUntilMs = Date.now() + Math.max(3, durationSec) * 1000;
      changed = true;
    }
    if (Boolean(speaking) !== state.aiSpeaking) {
      state.aiSpeaking = Boolean(speaking);
      changed = true;
    }
    if (changed) markAllDirty();
  }

  function setTelemetry(patch = {}) {
    let changed = false;
    const keys = [
      ['viewMode', 'viewMode'],
      ['freeHelmMode', 'freeHelmMode'],
      ['opticalEnabled', 'opticalEnabled'],
      ['opticalMag', 'opticalMag'],
      ['activeDeckId', 'activeDeckId'],
      ['nearestStationId', 'nearestStationId'],
      ['nearestStationLabel', 'nearestStationLabel'],
      ['seatedInBridge', 'seatedInBridge'],
      ['railAnchored', 'railAnchored'],
      ['focusedObject', 'focusedObject'],
      ['nearObject', 'nearObject'],
      ['voiceEnabled', 'voiceEnabled'],
      ['aiSpeaking', 'aiSpeaking'],
      ['aiStateLabel', 'aiStateLabel'],
      ['spherexTargetKey', 'spherexTargetKey'],
    ];
    for (const [src, dst] of keys) {
      if (patch[src] !== undefined && patch[src] !== state[dst]) {
        state[dst] = patch[src];
        changed = true;
      }
    }
    if (patch.travelStatus !== undefined) {
      const prev = state.travelStatus;
      const next = patch.travelStatus;
      const pProg = Math.round((prev?.progress || 0) * 50);
      const nProg = Math.round((next?.progress || 0) * 50);
      if (Boolean(prev?.active) !== Boolean(next?.active) || pProg !== nProg || prev?.label !== next?.label) {
        state.travelStatus = next ? { ...next } : null;
        changed = true;
      }
    }
    if (changed) markAllDirty();
  }

  function syncToObserver({ eyeWorldPos, headWorldQuat, dt = 0.016, xrPresenting = false } = {}) {
    state.xrPresenting = Boolean(xrPresenting);
    group.visible = state.xrPresenting;
    if (!state.xrPresenting || !eyeWorldPos || !headWorldQuat) return;

    if (state.tabletOpen && state.activeTab === 'spherex' && state.spherexViewMode === 'blink') {
      state.spherexBlinkAccum += dt;
      if (state.spherexBlinkAccum >= 0.85) {
        state.spherexBlinkAccum = 0;
        state.spherexBlinkEpoch = state.spherexBlinkEpoch === 'A' ? 'B' : 'A';
        tabletSurface.dirty = true;
      }
    }

    tempForward.set(0, 0, -1).applyQuaternion(headWorldQuat);
    const flatLen = Math.hypot(tempForward.x, tempForward.z);
    if (hudAnchorValid && hudAnchorPos.distanceToSquared(eyeWorldPos) > 20) {
      hudAnchorValid = false;
    }
    if (flatLen > 0.08) {
      const targetYaw = Math.atan2(-tempForward.x, -tempForward.z);
      if (!hudAnchorValid || forceSnapPose) {
        hudYaw = targetYaw;
        hudAnchorPos.copy(eyeWorldPos);
        hudAnchorValid = true;
        forceSnapPose = false;
      } else {
        const diff = normalizeAngle(targetYaw - hudYaw);
        if (Math.abs(diff) > 0.24) {
          const speed = Math.abs(diff) > 1.05 ? 10 : 5.5;
          const excess = diff - Math.sign(diff) * 0.24;
          hudYaw = normalizeAngle(hudYaw + excess * Math.min(1, dt * speed));
        }
        const posFollow = 1 - Math.exp(-12 * Math.max(dt, 0.001));
        hudAnchorPos.lerp(eyeWorldPos, posFollow);
      }
    } else if (!hudAnchorValid) {
      hudAnchorPos.copy(eyeWorldPos);
      hudAnchorValid = true;
      forceSnapPose = false;
    }

    tempForward.set(-Math.sin(hudYaw), 0, -Math.cos(hudYaw));
    tempRight.set(Math.cos(hudYaw), 0, -Math.sin(hudYaw));

    // Place Quick Bar cleanly below eye level so forward view remains open
    quickBar.mesh.visible = true;
    const qbDist = state.tabletOpen ? 1.42 : 1.36;
    const qbDrop = state.tabletOpen ? -0.60 : state.quickBarCompact ? -0.49 : -0.42;
    tempOffset.copy(hudAnchorPos).addScaledVector(tempForward, qbDist);
    tempOffset.y += qbDrop;
    quickBar.mesh.position.copy(tempOffset);
    quickBar.mesh.rotation.set(0, hudYaw, 0);
    quickBar.mesh.rotateX(-0.24);

    // Place Interactive Tablet when open
    tabletSurface.mesh.visible = Boolean(state.tabletOpen);
    if (state.tabletOpen) {
      tempOffset.copy(hudAnchorPos).addScaledVector(tempForward, 1.48);
      tempOffset.y += 0.02;
      tabletSurface.mesh.position.copy(tempOffset);
      tabletSurface.mesh.rotation.set(0, hudYaw, 0);
      tabletSurface.mesh.rotateX(-0.04);
    }

    // Place Subtitle Banner only when active and tablet is closed
    const subtitleActive =
      !state.tabletOpen &&
      Boolean(state.assistantMessage) &&
      (state.aiSpeaking || Date.now() <= state.subtitleUntilMs);
    subtitleSurface.mesh.visible = subtitleActive;
    if (subtitleActive) {
      tempOffset.copy(hudAnchorPos).addScaledVector(tempForward, 1.44);
      tempOffset.y += 0.34;
      subtitleSurface.mesh.position.copy(tempOffset);
      subtitleSurface.mesh.rotation.set(0, hudYaw, 0);
      subtitleSurface.mesh.rotateX(0.16);
    }

    if (quickBar.dirty) renderQuickBar();
    if (subtitleSurface.mesh.visible && subtitleSurface.dirty) renderSubtitleBanner();
    if (tabletSurface.mesh.visible && tabletSurface.dirty) renderTablet();
    group.updateMatrixWorld(true);
  }

  function getRaycastTargets() {
    if (!state.xrPresenting) return [];
    const list = [quickBar.mesh];
    if (state.tabletOpen) list.push(tabletSurface.mesh);
    if (subtitleSurface.mesh.visible) list.push(subtitleSurface.mesh);
    return list;
  }

  function getState() {
    ensurePopulatedButtons();
    return {
      xrPresenting: state.xrPresenting,
      tabletOpen: state.tabletOpen,
      activeTab: state.activeTab,
      travelActionMode: state.travelActionMode,
      viewMode: state.viewMode,
      freeHelmMode: state.freeHelmMode,
      opticalEnabled: state.opticalEnabled,
      activeDeckId: state.activeDeckId,
      spherexTargetKey: state.spherexTargetKey,
      spherexViewMode: state.spherexViewMode,
      spherexHasFrameA: Boolean(state.spherexFrameA),
      spherexHasFrameB: Boolean(state.spherexFrameB),
      spherexFindingsCount: state.spherexFindingsCount,
      assistantTitle: state.assistantTitle,
      assistantMessage: state.assistantMessage,
      subtitleVisible: subtitleSurface.mesh.visible,
      quickBarButtons: quickBar.buttons.map((b) => ({ id: b.id, action: b.action, payload: b.payload })),
      tabletButtons: tabletSurface.buttons.map((b) => ({ id: b.id, action: b.action, payload: b.payload })),
    };
  }

  function dispose() {
    for (const s of [quickBar, subtitleSurface, tabletSurface]) {
      s.geometry.dispose();
      s.material.dispose();
      s.texture?.dispose();
    }
    fitsFrameCache.clear();
  }

  ensurePopulatedButtons();

  return {
    group,
    quickBarMesh: quickBar.mesh,
    subtitleMesh: subtitleSurface.mesh,
    tabletMesh: tabletSurface.mesh,
    syncToObserver,
    getRaycastTargets,
    setHoverHit,
    handleHitClick,
    openWithTab,
    closeTablet,
    toggleTablet,
    setAssistantMessage,
    setTelemetry,
    loadSpherexTargetData,
    getState,
    dispose,
  };
}
