import * as THREE from 'three';
import { P } from '../data/planetData.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import {
  CABIN_DECKS,
  SHIP_INTERIOR_STATIONS,
  describeInteractablePrompt,
} from './kronoxInteriorSpatialModel.js';

const PANEL_WORLD_W = 1.24;
const PANEL_WORLD_H = 0.78;
const CANVAS_W = 1024;
const CANVAS_H = 640;
const MAX_BUTTON_SLOTS = 24;

const SOLAR_DESTINATIONS = [
  ...P.filter((b) => !b.moon).map((b) => ({ kind: 'planet', key: b.n, label: b.n })),
  { kind: 'quick', key: 'sunOrbit', label: 'Órbita Solar' },
  { kind: 'quick', key: 'asteroids', label: 'Asteroides' },
  { kind: 'quick', key: 'orion', label: 'Brazo de Orión' },
  { kind: 'quick', key: 'core', label: 'Centro galáctico' },
];

const REPAIR_STAGE_STEPS = [
  { stage: 0, label: '1. Escaneo IR inicial', detail: 'Inspeccionar el cabezal óptico con haz láser diagnóstico.' },
  { stage: 1, label: '2. Desmontaje del módulo', detail: 'Liberar anillo térmico y exponer el acoplador focal.' },
  { stage: 2, label: '3. Sustituir acoplador', detail: 'Instalar nuevo acoplador óptico de baja dispersión.' },
  { stage: 3, label: '4. Alineación láser He-Ne', detail: 'Sincronizar interferómetro a < 12 nm y sellar cámara.' },
  { stage: 4, label: 'Calibración verificada (4/4)', detail: 'Banco óptico colimado y telemetría nominal.' },
];

function wrapLines(ctx, text, maxWidth, maxLines = 4) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = words[i];
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth - 20) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 4))}…`;
    }
  }
  return lines;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
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

/**
 * Crea un panel diegético 3D contextual para operar cualquier consola existente
 * dentro de la nave en WebXR VR sin ocupar pantalla cuando se camina libremente.
 */
export function createVrConsoleOverlay3D() {
  const root = new THREE.Group();
  root.name = 'KronoxVrConsoleOverlayRoot';
  root.visible = false;

  const panelGroup = new THREE.Group();
  panelGroup.name = 'KronoxVrActiveConsolePanel';
  panelGroup.visible = false;
  root.add(panelGroup);

  const tooltipGroup = new THREE.Group();
  tooltipGroup.name = 'KronoxVrHoverTooltip';
  tooltipGroup.visible = false;
  root.add(tooltipGroup);

  const canDrawCanvas = typeof document !== 'undefined' && typeof document.createElement === 'function';

  const applyCanvasTextureColorSpace = (tex) => {
    if (tex && 'encoding' in tex && THREE.sRGBEncoding !== undefined) {
      tex.encoding = THREE.sRGBEncoding;
    }
  };

  const panelCanvas = canDrawCanvas ? document.createElement('canvas') : null;
  if (panelCanvas) {
    panelCanvas.width = CANVAS_W;
    panelCanvas.height = CANVAS_H;
  }
  const panelCtx = panelCanvas?.getContext?.('2d') || null;
  const panelTex = panelCanvas ? new THREE.CanvasTexture(panelCanvas) : null;
  applyCanvasTextureColorSpace(panelTex);

  const panelGeo = new THREE.PlaneGeometry(PANEL_WORLD_W, PANEL_WORLD_H);
  const panelMat = new THREE.MeshBasicMaterial({
    map: panelTex || null,
    color: panelTex ? 0xffffff : 0x0b1628,
    transparent: true,
    opacity: 0.97,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const panelMesh = new THREE.Mesh(panelGeo, panelMat);
  panelGroup.add(panelMesh);

  // Marco perimetral sutil para lectura cómoda sobre cualquier fondo
  const frameGeo = new THREE.PlaneGeometry(PANEL_WORLD_W + 0.032, PANEL_WORLD_H + 0.032);
  const frameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.z = -0.004;
  panelGroup.add(frameMesh);

  // Ranuras raycastables preasignadas para botones (evita asignaciones en runtime)
  const slotGeo = new THREE.PlaneGeometry(1, 1);
  const slotMeshes = [];
  const activeButtonMeshes = [];
  for (let i = 0; i < MAX_BUTTON_SLOTS; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.001,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const m = new THREE.Mesh(slotGeo, mat);
    m.visible = false;
    m.name = `VrConsoleButtonSlot_${i}`;
    panelGroup.add(m);
    slotMeshes.push(m);
  }

  // Tooltip compacto sobre el objeto apuntado o confirmación breve de mecanismo directo
  const tipCanvas = canDrawCanvas ? document.createElement('canvas') : null;
  if (tipCanvas) {
    tipCanvas.width = 640;
    tipCanvas.height = 128;
  }
  const tipCtx = tipCanvas?.getContext?.('2d') || null;
  const tipTex = tipCanvas ? new THREE.CanvasTexture(tipCanvas) : null;
  applyCanvasTextureColorSpace(tipTex);
  const tipGeo = new THREE.PlaneGeometry(0.78, 0.16);
  const tipMat = new THREE.MeshBasicMaterial({
    map: tipTex || null,
    color: tipTex ? 0xffffff : 0x0f172a,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
  const tipMesh = new THREE.Mesh(tipGeo, tipMat);
  tipMesh.renderOrder = 25;
  tooltipGroup.add(tipMesh);

  const uiState = {
    navTab: 'solar', // 'solar' | 'spherex' | 'pilot'
    solarPage: 0,
    spherexPage: 0,
    missionsPage: 0,
    scienceTargetIdx: 0,
    scienceView: 'overview', // 'overview' | 'bands' | 'epochs'
    archiveTargetIdx: 0,
    hoveredButtonKey: null,
  };

  let lastPanelHash = '';
  let lastTipHash = '';
  let toastState = null; // { text, anchorPos, untilMs, accent }

  const tmpLookTarget = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpPanelPos = new THREE.Vector3();

  function setNavTab(tab) {
    if (tab === 'solar' || tab === 'spherex' || tab === 'pilot') {
      uiState.navTab = tab;
      lastPanelHash = '';
    }
  }

  function stepPage(field, delta, totalItems, perPage) {
    const maxPage = Math.max(0, Math.ceil(totalItems / perPage) - 1);
    const cur = Number(uiState[field] || 0);
    uiState[field] = ((cur + delta) % (maxPage + 1) + (maxPage + 1)) % (maxPage + 1);
    lastPanelHash = '';
  }

  function cycleTargetIndex(field, delta) {
    const len = SPHEREX_TARGETS.length || 1;
    uiState[field] = ((uiState[field] + delta) % len + len) % len;
    lastPanelHash = '';
  }

  function setScienceView(view) {
    if (view === 'overview' || view === 'bands' || view === 'epochs') {
      uiState.scienceView = view;
      lastPanelHash = '';
    }
  }

  function showDirectToast({ text, anchorPos = null, accent = '#34d399', durationMs = 2800 } = {}) {
    if (!text) return;
    toastState = {
      text: String(text),
      anchorPos: anchorPos ? anchorPos.clone() : null,
      accent,
      untilMs: Date.now() + durationMs,
    };
    lastTipHash = '';
  }

  function setHoveredButtonKey(key = null) {
    const normalized = key || null;
    if (uiState.hoveredButtonKey !== normalized) {
      uiState.hoveredButtonKey = normalized;
      lastPanelHash = '';
    }
  }

  function orientBillboardTowardEye(group, pos, eyePos) {
    group.position.copy(pos);
    if (!eyePos) return;
    tmpLookTarget.set(eyePos.x, group.position.y, eyePos.z);
    group.lookAt(tmpLookTarget);
  }

  function buildConsoleLayout(stationId, ctx = {}) {
    const stationMeta = SHIP_INTERIOR_STATIONS.find((s) => s.id === stationId);
    const targetName = ctx.targetName || 'Sistema Solar';
    const findingsCount = Number(ctx.findingsCount || 0);
    const mech = ctx.mechanisms || {};
    const speed = Number(ctx.speed || 0);
    const flightMode = String(ctx.flightMode || 'ESPERA');
    const seated = Boolean(ctx.seated);
    const repairStage = Math.max(0, Math.min(4, Number(ctx.repairStage || 0)));
    const buttons = [];
    const infoLines = [];
    let accent = stationMeta?.colorHex ? `#${stationMeta.colorHex.toString(16).padStart(6, '0')}` : '#38bdf8';
    let tag = stationMeta?.tag || 'CONSOLA KRONOX';
    let title = stationMeta?.label || 'Terminal de A Bordo';

    const pushFooter = () => {
      if (seated) {
        buttons.push({
          key: 'foot-stand',
          x: 42,
          y: 556,
          w: 270,
          h: 56,
          label: 'Levantarse del asiento',
          action: 'stand-up-seat',
          tone: 'amber',
        });
      }
      buttons.push({
        key: 'foot-close',
        x: CANVAS_W - 242,
        y: 556,
        w: 200,
        h: 56,
        label: '× Cerrar [B]',
        action: 'close-console',
        tone: 'danger',
      });
    };

    if (stationId === 'nav') {
      tag = 'CUBIERTA 01 · NAVEGACIÓN ESTELAR';
      title = 'CONSOLA DE NAVEGACIÓN · VIAJES Y TIMÓN';
      infoLines.push(
        `DESTINO ACTUAL: ${targetName}  |  MODO: ${flightMode}  |  VEL: ${speed.toFixed(1)} u/s`,
      );
      [
        ['solar', '✦ Sistema Solar / Rápidos', 42],
        ['spherex', '◎ Objetivos SPHEREx', 362],
        ['pilot', '✈ Timón y Velocidad', 682],
      ].forEach(([tabId, label, x]) => {
        buttons.push({
          key: `nav-tab-${tabId}`,
          x,
          y: 138,
          w: 300,
          h: 52,
          label,
          action: 'ui-nav-tab',
          payload: { tab: tabId },
          active: uiState.navTab === tabId,
          tone: 'tab',
        });
      });

      if (uiState.navTab === 'solar') {
        const perPage = 6;
        const start = uiState.solarPage * perPage;
        const pageItems = SOLAR_DESTINATIONS.slice(start, start + perPage);
        infoLines.push('Selecciona un planeta o destino galáctico para iniciar el salto automático:');
        pageItems.forEach((item, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          buttons.push({
            key: `nav-dest-${item.key}`,
            x: 42 + col * 476,
            y: 236 + row * 84,
            w: 460,
            h: 68,
            label: `🚀 Viajar a ${item.label}`,
            action: item.kind === 'planet' ? 'travel-planet' : 'quick-travel',
            payload: item.kind === 'planet'
              ? { planetName: item.key }
              : { key: item.key, label: item.label },
          });
        });
        buttons.push(
          {
            key: 'nav-solar-prev',
            x: 332,
            y: 556,
            w: 196,
            h: 56,
            label: '‹ Anterior',
            action: 'ui-page',
            payload: { field: 'solarPage', delta: -1, total: SOLAR_DESTINATIONS.length, perPage },
          },
          {
            key: 'nav-solar-next',
            x: 544,
            y: 556,
            w: 196,
            h: 56,
            label: 'Siguiente ›',
            action: 'ui-page',
            payload: { field: 'solarPage', delta: 1, total: SOLAR_DESTINATIONS.length, perPage },
          },
        );
      } else if (uiState.navTab === 'spherex') {
        const perPage = 4;
        const start = uiState.spherexPage * perPage;
        const pageTargets = SPHEREX_TARGETS.slice(start, start + perPage);
        infoLines.push('Saltos científicos SPHEREx (con llegada al vecindario galáctico):');
        pageTargets.forEach((tgt, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          buttons.push({
            key: `nav-spx-${tgt.key}`,
            x: 42 + col * 476,
            y: 242 + row * 108,
            w: 460,
            h: 90,
            label: `✦ ${tgt.name}`,
            sublabel: `${tgt.distanceLabel || ''} · ${tgt.preferredBand || 'SPHEREx'}`,
            action: 'travel-spherex',
            payload: { targetKey: tgt.key },
          });
        });
        buttons.push(
          {
            key: 'nav-spx-prev',
            x: 332,
            y: 556,
            w: 196,
            h: 56,
            label: '‹ Anterior',
            action: 'ui-page',
            payload: { field: 'spherexPage', delta: -1, total: SPHEREX_TARGETS.length, perPage },
          },
          {
            key: 'nav-spx-next',
            x: 544,
            y: 556,
            w: 196,
            h: 56,
            label: 'Siguiente ›',
            action: 'ui-page',
            payload: { field: 'spherexPage', delta: 1, total: SPHEREX_TARGETS.length, perPage },
          },
        );
      } else {
        infoLines.push('Control manual en 3ª persona o ajuste instantáneo de propulsión:');
        buttons.push({
          key: 'nav-free-helm',
          x: 42,
          y: 236,
          w: 460,
          h: 82,
          label: ctx.freeHelmMode ? '↩ Volver a Cabina 1P' : '✈ Activar Timón Libre (Exterior 3P)',
          action: 'toggle-free-helm',
          active: Boolean(ctx.freeHelmMode),
          tone: 'emerald',
        });
        buttons.push({
          key: 'nav-seat-toggle',
          x: 518,
          y: 236,
          w: 460,
          h: 82,
          label: seated ? 'Levantarse del sillón de mando' : '💺 Sentarse en puesto de mando',
          action: seated ? 'stand-up-seat' : 'sit-command-seat',
          tone: 'amber',
        });
        [
          [1, 'Órbita (1 u/s)'],
          [60, 'Sistema (60 u/s)'],
          [3000, 'Galaxia (3.000)'],
          [40000, 'Hiper (40.000)'],
        ].forEach(([val, lbl], idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          buttons.push({
            key: `nav-spd-${val}`,
            x: 42 + col * 476,
            y: 344 + row * 86,
            w: 460,
            h: 70,
            label: `⚡ Velocidad: ${lbl}`,
            action: 'speed-preset',
            payload: { speed: val },
          });
        });
      }
      pushFooter();
      return { tag, title, accent, infoLines, buttons };
    }

    if (stationId === 'missions') {
      accent = '#8ae8ff';
      tag = 'CUBIERTA 01 · MESA HOLOGRÁFICA TÁCTICA';
      title = 'EXPEDICIONES Y MISIONES NASA SPHEREx';
      const perPage = 4;
      const start = uiState.missionsPage * perPage;
      const pageTargets = SPHEREX_TARGETS.slice(start, start + perPage);
      infoLines.push(
        `HALLAZGOS REGISTRADOS: ${findingsCount}  |  OBJETIVO EN FOCO: ${targetName}`,
        'Elige un objetivo científico SPHEREx para viajar automáticamente al lugar:',
      );
      pageTargets.forEach((tgt, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        buttons.push({
          key: `mis-tgt-${tgt.key}`,
          x: 42 + col * 476,
          y: 204 + row * 102,
          w: 460,
          h: 86,
          label: `🚀 ${tgt.name}`,
          sublabel: `${tgt.preferredBand} · ${tgt.statusBadge || tgt.scientificStatus} · ${tgt.distanceLabel || ''}`,
          action: 'travel-spherex',
          payload: { targetKey: tgt.key },
        });
      });
      buttons.push(
        {
          key: 'mis-barnard-train',
          x: 42,
          y: 428,
          w: 460,
          h: 72,
          label: '★ Entrenamiento guiado: Estrella de Barnard',
          action: 'travel-spherex',
          payload: { targetKey: 'barnard' },
          tone: 'emerald',
        },
        {
          key: 'mis-scan-3d',
          x: 518,
          y: 428,
          w: 460,
          h: 72,
          label: '◎ Activar barrido espectral en objetivo',
          action: 'scientific-scan',
          payload: { targetKey: ctx.activeTargetKey || 'barnard' },
        },
        {
          key: 'mis-prev',
          x: 332,
          y: 556,
          w: 196,
          h: 56,
          label: '‹ Anterior',
          action: 'ui-page',
          payload: { field: 'missionsPage', delta: -1, total: SPHEREX_TARGETS.length, perPage },
        },
        {
          key: 'mis-next',
          x: 544,
          y: 556,
          w: 196,
          h: 56,
          label: 'Siguiente ›',
          action: 'ui-page',
          payload: { field: 'missionsPage', delta: 1, total: SPHEREX_TARGETS.length, perPage },
        },
      );
      pushFooter();
      return { tag, title, accent, infoLines, buttons };
    }

    if (stationId === 'comms') {
      accent = '#ffb84d';
      tag = 'CUBIERTA 01 · ENLACE NEURAL KRONOX IA';
      title = 'ASISTENTE DE A BORDO · KRONOX IA';
      const reply = ctx.lastKronoxReply || 'KRONOX IA en línea. Elige una consulta rápida para interactuar por voz y en pantalla.';
      infoLines.push(`VOZ IA: ${ctx.voiceEnabled !== false ? 'ACTIVA' : 'SILENCIADA'}  |  ESTADO: EN LÍNEA`);
      const prompts = [
        ['¿Qué objetivo tengo y cuál es el estado actual de la misión?', 'Estado actual y misión'],
        ['Explícame la misión NASA SPHEREx y sus bandas infrarrojas', 'Explicar misión SPHEREx'],
        ['Activa el telescopio óptico a 50x', 'Telescopio 50×'],
        ['Viaja a la Estrella de Barnard', 'Viajar a Barnard'],
      ];
      prompts.forEach(([query, label], idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        buttons.push({
          key: `comms-q-${idx}`,
          x: 42 + col * 476,
          y: 280 + row * 82,
          w: 460,
          h: 66,
          label: `✦ ${label}`,
          action: 'kronox-query',
          payload: { query },
        });
      });
      buttons.push(
        {
          key: 'comms-tour',
          x: 42,
          y: 454,
          w: 224,
          h: 66,
          label: 'Tour del puente',
          action: 'start-tour',
          tone: 'emerald',
        },
        {
          key: 'comms-repeat',
          x: 280,
          y: 454,
          w: 224,
          h: 66,
          label: '🔊 Repetir voz',
          action: 'repeat-voice',
        },
        {
          key: 'comms-voice',
          x: 518,
          y: 454,
          w: 224,
          h: 66,
          label: ctx.voiceEnabled !== false ? 'Silenciar voz' : 'Activar voz',
          action: 'toggle-voice',
          tone: 'amber',
        },
        {
          key: 'comms-mic',
          x: 756,
          y: 454,
          w: 224,
          h: 66,
          label: '🎙 Hablar (Mic)',
          action: 'toggle-mic',
        },
      );
      pushFooter();
      return { tag, title, accent, infoLines, replyBoxText: reply, buttons };
    }

    if (stationId === 'windows') {
      accent = '#38d8ff';
      tag = 'CUBIERTA 01 · VENTANAL PANORÁMICO DE PROA';
      title = 'MIRADOR ÓPTICO Y OBSERVACIÓN DEL COSMOS';
      const mag = Number(ctx.opticalMagnification || 1);
      infoLines.push(
        `ÓPTICA ACTUAL: ${mag > 1 ? `Telescopio ${mag}×` : 'Simple vista (1×)'}  |  PERFIL: ${ctx.visualProfile === 'scientific' ? 'CIENTÍFICO' : 'CINEMATOGRÁFICO'}`,
        `REFERENCIA EN CAMPO: ${targetName}`,
      );
      buttons.push(
        {
          key: 'win-mag-1',
          x: 42,
          y: 230,
          w: 300,
          h: 82,
          label: 'Simple vista (1×)',
          action: 'set-telescope',
          payload: { enabled: false, magnification: 1 },
          active: mag <= 1,
        },
        {
          key: 'win-mag-50',
          x: 362,
          y: 230,
          w: 300,
          h: 82,
          label: '🔭 Telescopio 50×',
          action: 'set-telescope',
          payload: { enabled: true, magnification: 50 },
          active: mag === 50,
          tone: 'emerald',
        },
        {
          key: 'win-mag-150',
          x: 682,
          y: 230,
          w: 296,
          h: 82,
          label: '🔭 Alta resolución 150×',
          action: 'set-telescope',
          payload: { enabled: true, magnification: 150 },
          active: mag >= 150,
          tone: 'emerald',
        },
        {
          key: 'win-profile',
          x: 42,
          y: 344,
          w: 460,
          h: 84,
          label: ctx.visualProfile === 'scientific'
            ? 'Cambiar a Perfil Cinematográfico'
            : 'Cambiar a Perfil Científico estricto',
          action: 'toggle-visual-profile',
        },
        {
          key: 'win-free-helm',
          x: 518,
          y: 344,
          w: 460,
          h: 84,
          label: '✈ Salir a Timón Libre Exterior (3P)',
          action: 'toggle-free-helm',
          tone: 'amber',
        },
      );
      pushFooter();
      return { tag, title, accent, infoLines, buttons };
    }

    if (stationId === 'science' || stationId === 'archive') {
      const isArchive = stationId === 'archive';
      accent = isArchive ? '#a2b6ff' : '#ffbe55';
      tag = isArchive ? 'CUBIERTA 03 · ARCHIVO IRSA QR2' : 'CUBIERTA 03 · LABORATORIO ESPECTRAL SPHEREx';
      title = isArchive ? 'ARCHIVO CIENTÍFICO Y PRODUCTOS SPHEREx' : 'CONSOLA CIENTÍFICA · ESPECTROFOTOMETRÍA IR';
      const idxField = isArchive ? 'archiveTargetIdx' : 'scienceTargetIdx';
      const tgt = SPHEREX_TARGETS[uiState[idxField]] || SPHEREX_TARGETS[0];
      const recCount = Array.isArray(tgt?.localRecords) ? tgt.localRecords.length : 0;
      const bandSet = Array.from(
        new Set((tgt?.localRecords || []).map((r) => String(r?.band || '').match(/D[1-6]$/)?.[0]).filter(Boolean)),
      );
      infoLines.push(
        `OBJETIVO SELECCIONADO: ${tgt?.name || 'N/D'} (${tgt?.distanceLabel || 'Catálogo'})`,
        `COORDENADAS: RA ${Number(tgt?.ra || 0).toFixed(3)}° · DEC ${Number(tgt?.dec || 0).toFixed(3)}° · BANDA PREF: ${tgt?.preferredBand || 'SPHEREx'}`,
        `ARCHIVO LOCAL IRSA: ${recCount} recortes FITS (${bandSet.length ? bandSet.join(', ') : 'Sin bandas'}) · HALLAZGOS: ${findingsCount}`,
      );
      const sciNote = tgt?.observationSummary || tgt?.note || '';
      buttons.push(
        {
          key: 'sci-prev-tgt',
          x: 42,
          y: 320,
          w: 224,
          h: 68,
          label: '‹ Obj. anterior',
          action: 'ui-target-step',
          payload: { field: idxField, delta: -1 },
        },
        {
          key: 'sci-next-tgt',
          x: 280,
          y: 320,
          w: 224,
          h: 68,
          label: 'Obj. siguiente ›',
          action: 'ui-target-step',
          payload: { field: idxField, delta: 1 },
        },
        {
          key: 'sci-scan',
          x: 518,
          y: 320,
          w: 460,
          h: 68,
          label: `◎ Iniciar barrido 3D en ${tgt?.name || 'objetivo'}`,
          action: 'scientific-scan',
          payload: { targetKey: tgt?.key, targetName: tgt?.name, preferredBand: tgt?.preferredBand },
          tone: 'emerald',
        },
        {
          key: 'sci-travel',
          x: 42,
          y: 412,
          w: 460,
          h: 72,
          label: `🚀 Viajar a ${tgt?.name || 'objetivo'}`,
          action: 'travel-spherex',
          payload: { targetKey: tgt?.key },
        },
        {
          key: 'sci-inspect',
          x: 518,
          y: 412,
          w: 460,
          h: 72,
          label: '✦ Consultar análisis con KRONOX IA',
          action: 'kronox-query',
          payload: { query: `Analiza el espectro y los datos locales SPHEREx de ${tgt?.name || 'este objetivo'}` },
          tone: 'amber',
        },
      );
      pushFooter();
      return { tag, title, accent, infoLines, replyBoxText: sciNote, buttons };
    }

    if (stationId === 'sensor-calibration') {
      accent = '#45e8ff';
      tag = 'CUBIERTA 03 · BANCO ÓPTICO LÁSER';
      title = 'CALIBRACIÓN INTERFEROMÉTRICA Y REPARACIÓN';
      const stepMeta = REPAIR_STAGE_STEPS[repairStage] || REPAIR_STAGE_STEPS[0];
      infoLines.push(
        `PROGRESO ACTUAL: ${repairStage}/4 ETAPAS · ${stepMeta.label.toUpperCase()}`,
        stepMeta.detail,
      );
      buttons.push(
        {
          key: 'rep-next',
          x: 42,
          y: 248,
          w: 616,
          h: 96,
          label: repairStage >= 4
            ? '✓ Calibración Completa (4/4)'
            : `⚙ Ejecutar Etapa ${repairStage + 1}: ${REPAIR_STAGE_STEPS[repairStage + 1]?.label || 'Finalizar'}`,
          action: 'repair-next-stage',
          tone: 'emerald',
        },
        {
          key: 'rep-reset',
          x: 682,
          y: 248,
          w: 296,
          h: 96,
          label: '↺ Reiniciar (0/4)',
          action: 'repair-reset',
        },
      );
      REPAIR_STAGE_STEPS.slice(0, 4).forEach((st, idx) => {
        buttons.push({
          key: `rep-s-${idx + 1}`,
          x: 42 + idx * 238,
          y: 378,
          w: 224,
          h: 68,
          label: `${repairStage >= idx + 1 ? '✓ ' : ''}${st.label.split('.')[0]}. Paso`,
          action: 'repair-set-stage',
          payload: { stage: idx + 1 },
          active: repairStage === idx + 1,
        });
      });
      pushFooter();
      return { tag, title, accent, infoLines, buttons };
    }

    if (stationId === 'engineering') {
      accent = '#6ce0ff';
      tag = 'CUBIERTA 03 · NÚCLEO DEL REACTOR AURORA';
      title = 'CONTROL DEL REACTOR TOKAMAK Y PLASMA';
      const rMode = String(mech.reactorMode || 'nominal');
      infoLines.push(
        `RÉGIMEN ACTIVO: ${rMode.toUpperCase()}  |  CRIOGENIA: 4.2 K`,
        `VELOCIDAD ACTUAL DE LA NAVE: ${speed.toFixed(2)} u/s`,
      );
      [
        ['nominal', '◎ Régimen Nominal', 'Modo equilibrado de fusión D-T (4.2 GW simulados)'],
        ['overclock', '⚡ Alta Potencia', 'Sobrecarga magnética y plasma azul intenso'],
        ['quiet', '☾ Modo Silencioso', 'Emisión térmica reducida para observación profunda'],
      ].forEach(([mode, label], idx) => {
        buttons.push({
          key: `eng-${mode}`,
          x: 42 + idx * 316,
          y: 268,
          w: 298,
          h: 112,
          label,
          action: 'mech-engineering',
          payload: { mode },
          active: rMode === mode,
          tone: mode === 'overclock' ? 'amber' : 'emerald',
        });
      });
      pushFooter();
      return { tag, title, accent, infoLines, buttons };
    }

    if (stationId === 'elevator-panel') {
      accent = '#38d8ff';
      tag = 'ASCENSOR CENTRAL 3D';
      title = 'SELECCIÓN DE CUBIERTA C01 – C04';
      const curDeckId = ctx.currentDeckId || 'deck-01';
      infoLines.push(`CUBIERTA ACTUAL: ${curDeckId.toUpperCase()} · Selecciona destino para viajar:`);
      CABIN_DECKS.forEach((d, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        buttons.push({
          key: `el-floor-${d.id}`,
          x: 42 + col * 476,
          y: 230 + row * 124,
          w: 460,
          h: 102,
          label: `${d.code} · ${d.shortName}`,
          sublabel: curDeckId === d.id ? '● Estás en esta cubierta' : 'Viajar en ascensor físico',
          action: 'elevator-floor',
          payload: { deckId: d.id },
          active: curDeckId === d.id,
          tone: 'emerald',
        });
      });
      pushFooter();
      return { tag, title, accent, infoLines, buttons };
    }

    if (stationId === 'bed-rest') {
      const bayIdx = Number.isInteger(mech.restingBayIndex) ? mech.restingBayIndex : 0;
      const suiteCode = `HAB-0${bayIdx + 1}`;
      const restPct = Math.round(Number(mech.crewRestPct ?? 82));
      const lampMode = mech.cabinLamps?.[bayIdx] || 'warm';
      accent = '#818cf8';
      tag = `CUBIERTA 02 · ${suiteCode} · REPOSO`;
      title = `LITERA DE DESCANSO · ${suiteCode}`;
      infoLines.push(
        `ENERGÍA TRIPULACIÓN: ${restPct}%  |  CICLOS COMPLETADOS: ${Number(mech.restCyclesCompleted || 0)}  |  LÁMPARA: ${lampMode.toUpperCase()}`,
      );
      infoLines.push('Descansa en gravedad simulada o empuja el stick izquierdo para levantarte.');
      buttons.push({
        key: 'bed-rest-nap',
        x: 42,
        y: 250,
        w: 460,
        h: 112,
        label: '☾ Tomar Siesta Orbital (+4h)',
        sublabel: 'Restaurar energía al 100% · Luz nocturna suave',
        action: 'bed-rest-nap',
        tone: 'emerald',
      });
      buttons.push({
        key: 'bed-rest-lamp',
        x: 518,
        y: 250,
        w: 460,
        h: 112,
        label: `☼ Lámpara Cabecera (${lampMode.toUpperCase()})`,
        sublabel: 'Alternar cálida / nocturna / apagada',
        action: 'bed-rest-lamp',
        tone: 'amber',
      });
      buttons.push({
        key: 'bed-rest-stand',
        x: 42,
        y: 410,
        w: 936,
        h: 94,
        label: '↑ Levantarse de la litera',
        sublabel: 'Salir de la cama junto al pasillo del camarote',
        action: 'bed-rest-stand',
        tone: 'emerald',
      });
      buttons.push({
        key: 'foot-close',
        x: CANVAS_W - 242,
        y: 556,
        w: 200,
        h: 56,
        label: '× Salir [B]',
        action: 'bed-rest-stand',
        tone: 'danger',
      });
      return { tag, title, accent, infoLines, buttons };
    }

    // Fallback genérico para cualquier consola adicional
    infoLines.push(`Módulo listo para operación en ${stationMeta?.deckId?.toUpperCase() || 'NAVE'}.`);
    pushFooter();
    return { tag, title, accent, infoLines, buttons };
  }

  function renderPanelCanvas(layout) {
    if (!panelCtx || !panelTex) return;
    const ctx = panelCtx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Fondo vidrio oscuro aeroespacial
    drawRoundedRect(ctx, 4, 4, CANVAS_W - 8, CANVAS_H - 8, 22);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, 'rgba(9, 17, 32, 0.96)');
    bgGrad.addColorStop(1, 'rgba(6, 12, 24, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = layout.accent || '#38bdf8';
    ctx.stroke();

    // Cabecera
    ctx.fillStyle = layout.accent || '#38bdf8';
    ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(layout.tag || 'CONSOLA KRONOX', 42, 30);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(layout.title || 'TERMINAL', 42, 60);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, 108);
    ctx.lineTo(CANVAS_W - 42, 108);
    ctx.stroke();

    // Telemetría / líneas de descripción
    ctx.font = '500 20px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    layout.infoLines.slice(0, 3).forEach((line, i) => {
      const y = (layout.buttons.some((b) => b.key.startsWith('nav-tab-')) ? 202 : 122) + i * 28;
      ctx.fillText(line.slice(0, 96), 42, y);
    });

    if (layout.replyBoxText) {
      drawRoundedRect(ctx, 42, 158, CANVAS_W - 84, 108, 12);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.font = '500 21px system-ui, -apple-system, Segoe UI, sans-serif';
      const wrapped = wrapLines(ctx, layout.replyBoxText, CANVAS_W - 120, 3);
      wrapped.forEach((wl, idx) => {
        ctx.fillText(wl, 60, 174 + idx * 29);
      });
    }

    // Botones interactivos
    for (let i = 0; i < layout.buttons.length; i += 1) {
      const b = layout.buttons[i];
      const hovered = uiState.hoveredButtonKey === b.key;
      drawRoundedRect(ctx, b.x, b.y, b.w, b.h, 12);

      let fill = 'rgba(30, 41, 59, 0.92)';
      let stroke = 'rgba(56, 189, 248, 0.45)';
      let textColor = '#e2e8f0';

      if (b.tone === 'danger') {
        fill = hovered ? 'rgba(220, 38, 38, 0.45)' : 'rgba(127, 29, 29, 0.55)';
        stroke = '#f87171';
        textColor = '#fee2e2';
      } else if (b.active || b.tone === 'emerald') {
        fill = hovered ? 'rgba(16, 185, 129, 0.42)' : 'rgba(6, 95, 70, 0.55)';
        stroke = '#34d399';
        textColor = '#ecfdf5';
      } else if (b.tone === 'amber') {
        fill = hovered ? 'rgba(245, 158, 11, 0.35)' : 'rgba(120, 53, 15, 0.52)';
        stroke = '#fbbf24';
        textColor = '#fef3c7';
      } else if (hovered) {
        fill = 'rgba(14, 165, 233, 0.38)';
        stroke = '#22d3ee';
        textColor = '#ffffff';
      }

      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = hovered ? 4 : 2.5;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';
      if (b.sublabel) {
        ctx.font = 'bold 22px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.fillText(b.label.slice(0, 42), b.x + 18, b.y + b.h * 0.36);
        ctx.font = '500 17px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(b.sublabel.slice(0, 56), b.x + 18, b.y + b.h * 0.72);
      } else {
        ctx.font = 'bold 21px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.fillText(b.label.slice(0, 46), b.x + 18, b.y + b.h * 0.5);
      }
    }

    panelTex.needsUpdate = true;
  }

  function syncButtonHitMeshes(buttons) {
    activeButtonMeshes.length = 0;
    const count = Math.min(buttons.length, MAX_BUTTON_SLOTS);
    for (let i = 0; i < MAX_BUTTON_SLOTS; i += 1) {
      const m = slotMeshes[i];
      if (i >= count) {
        m.visible = false;
        m.userData.vrConsoleAction = null;
        m.userData.vrConsolePayload = null;
        m.userData.vrConsoleButtonKey = null;
        continue;
      }
      const b = buttons[i];
      const cxPx = b.x + b.w * 0.5;
      const cyPx = b.y + b.h * 0.5;
      const wx = ((cxPx / CANVAS_W) - 0.5) * PANEL_WORLD_W;
      const wy = (0.5 - (cyPx / CANVAS_H)) * PANEL_WORLD_H;
      const ww = (b.w / CANVAS_W) * PANEL_WORLD_W;
      const wh = (b.h / CANVAS_H) * PANEL_WORLD_H;

      m.position.set(wx, wy, 0.012);
      m.scale.set(ww, wh, 1);
      m.visible = true;
      m.userData.vrConsoleAction = b.action;
      m.userData.vrConsolePayload = { ...(b.payload || {}), buttonKey: b.key };
      m.userData.vrConsoleLabel = b.label;
      m.userData.vrConsoleButtonKey = b.key;
      m.material.opacity = uiState.hoveredButtonKey === b.key ? 0.14 : 0.001;
      activeButtonMeshes.push(m);
    }
  }

  function renderTooltipCanvas(text, subText = '', accent = '#34d399') {
    if (!tipCtx || !tipTex) return;
    const ctx = tipCtx;
    ctx.clearRect(0, 0, 640, 128);
    drawRoundedRect(ctx, 4, 4, 632, 120, 20);
    ctx.fillStyle = 'rgba(9, 17, 32, 0.94)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(String(text || '').slice(0, 44), 26, subText ? 22 : 46);

    if (subText) {
      ctx.fillStyle = accent;
      ctx.font = 'bold 22px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(String(subText).slice(0, 48), 26, 68);
    }
    tipTex.needsUpdate = true;
  }

  function update({
    presenting = false,
    inCabin = true,
    activeStationId = null,
    stationAnchorPos = null,
    deckFloorY = 3.4,
    eyePos = null,
    hoveredHit = null,
    context = {},
  } = {}) {
    if (!presenting || !inCabin) {
      lastPanelHash = '';
      lastTipHash = '';
      root.visible = false;
      panelGroup.visible = false;
      tooltipGroup.visible = false;
      activeButtonMeshes.length = 0;
      uiState.hoveredButtonKey = null;
      return;
    }

    const now = Date.now();
    if (toastState && now >= toastState.untilMs) {
      toastState = null;
    }

    if (activeStationId) {
      uiState.hoveredButtonKey = hoveredHit?.vrAction ? hoveredHit?.vrPayload?.buttonKey || null : null;
      root.visible = true;
      panelGroup.visible = true;
      tooltipGroup.visible = false;

      // Posicionar el panel 3D a distancia ergonómica frente a la vista (sin quedar detrás de obstáculos o en la cara)
      const baseAnchor = stationAnchorPos || eyePos || new THREE.Vector3(0, deckFloorY + 1.4, -10);
      tmpPanelPos.copy(baseAnchor);
      if (eyePos) {
        tmpDir.copy(baseAnchor).sub(eyePos);
        tmpDir.y = 0;
        const horizDist = Math.hypot(tmpDir.x, tmpDir.z);
        if (horizDist > 1e-5) {
          tmpDir.divideScalar(horizDist);
          const clampedDist = Math.max(0.95, Math.min(1.75, horizDist - 0.34));
          tmpPanelPos.x = eyePos.x + tmpDir.x * clampedDist;
          tmpPanelPos.z = eyePos.z + tmpDir.z * clampedDist;
        }
      }
      tmpPanelPos.y = Math.max(
        deckFloorY + 1.42,
        Math.min(deckFloorY + 2.15, (eyePos ? eyePos.y - 0.08 : baseAnchor.y + 0.42)),
      );
      orientBillboardTowardEye(panelGroup, tmpPanelPos, eyePos);

      const layout = buildConsoleLayout(activeStationId, context);
      const nextHash = JSON.stringify({
        stationId: activeStationId,
        hovered: uiState.hoveredButtonKey,
        navTab: uiState.navTab,
        solarPage: uiState.solarPage,
        spherexPage: uiState.spherexPage,
        missionsPage: uiState.missionsPage,
        scienceTargetIdx: uiState.scienceTargetIdx,
        archiveTargetIdx: uiState.archiveTargetIdx,
        tag: layout.tag,
        info: layout.infoLines,
        reply: layout.replyBoxText,
        buttons: layout.buttons.map((b) => `${b.key}:${b.active ? 1 : 0}:${b.label}`),
      });
      if (nextHash !== lastPanelHash) {
        lastPanelHash = nextHash;
        renderPanelCanvas(layout);
        syncButtonHitMeshes(layout.buttons);
        frameMat.color.set(layout.accent || '#38bdf8');
      }
      return;
    }

    // Sin consola abierta: limpiar botones activos y caché de hash para regenerar ranuras al reabrir
    if (panelGroup.visible || activeButtonMeshes.length > 0) {
      lastPanelHash = '';
    }
    panelGroup.visible = false;
    activeButtonMeshes.length = 0;
    setHoveredButtonKey(null);

    if (toastState) {
      root.visible = true;
      tooltipGroup.visible = true;
      const tipPos = (toastState.anchorPos || eyePos || new THREE.Vector3()).clone();
      tipPos.y = Math.max(deckFloorY + 1.15, tipPos.y + 0.34);
      orientBillboardTowardEye(tooltipGroup, tipPos, eyePos);
      const tHash = `toast|${toastState.text}|${toastState.accent}`;
      if (tHash !== lastTipHash) {
        lastTipHash = tHash;
        renderTooltipCanvas(toastState.text, 'Acción ejecutada en consola', toastState.accent || '#34d399');
      }
      return;
    }

    if (hoveredHit?.stationId) {
      const prompt = describeInteractablePrompt(hoveredHit.stationId, {
        mechanisms: context.mechanisms,
        cabHere: context.cabHere,
        isAnchored: context.isAnchored,
      });
      if (prompt) {
        root.visible = true;
        tooltipGroup.visible = true;
        const hoverPos = (hoveredHit.point || eyePos || new THREE.Vector3()).clone();
        hoverPos.y = Math.max(deckFloorY + 1.05, hoverPos.y + 0.28);
        orientBillboardTowardEye(tooltipGroup, hoverPos, eyePos);
        const hHash = `hover|${hoveredHit.stationId}|${prompt.label}|${prompt.actionLabel}`;
        if (hHash !== lastTipHash) {
          lastTipHash = hHash;
          renderTooltipCanvas(prompt.label, `[Gatillo] ${prompt.actionLabel || 'Operar'}`, '#38bdf8');
        }
        return;
      }
    }

    lastTipHash = '';
    root.visible = false;
    tooltipGroup.visible = false;
  }

  function dispose() {
    slotMeshes.forEach((m) => m.material?.dispose?.());
    slotGeo.dispose();
    panelGeo.dispose();
    panelMat.dispose();
    panelTex?.dispose?.();
    frameGeo.dispose();
    frameMat.dispose();
    tipGeo.dispose();
    tipMat.dispose();
    tipTex?.dispose?.();
  }

  return {
    root,
    getInteractiveButtonMeshes: () => (panelGroup.visible ? activeButtonMeshes : []),
    setNavTab,
    stepPage,
    cycleTargetIndex,
    setScienceView,
    setHoveredButtonKey,
    showDirectToast,
    update,
    dispose,
  };
}
