/**
 * KRONOX — DIARIO DE EXPLORACIÓN Y SISTEMA DE GUARDADO DE PARTIDA
 *
 * Registra de forma persistente (localStorage):
 * - Misiones completadas
 * - Objetos astronómicos investigados (planetas, estrellas de catálogo, objetivos SPHEREx)
 * - Observaciones guardadas
 * - Descubrimientos personales
 * - Actividad reciente cronológica con época astronómica
 * - Estado completo de guardado de partida (ubicación, cámara, ajustes, modo de observación)
 */

const JOURNAL_STORAGE_KEY = 'kronox_expedition_journal_v1';
const SAVEGAME_STORAGE_KEY = 'kronox_savegame_v1';

const DEFAULT_JOURNAL = {
  version: 1,
  explorerId: 'local-commander',
  completedMissions: [],
  investigatedObjects: [],
  personalDiscoveries: [],
  activities: [],
  updatedAt: null,
};

function readRawStorage(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRawStorage(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadExpeditionJournal() {
  const parsed = readRawStorage(JOURNAL_STORAGE_KEY);
  if (!parsed || typeof parsed !== 'object') {
    return {
      ...DEFAULT_JOURNAL,
      completedMissions: [],
      investigatedObjects: [],
      personalDiscoveries: [],
      activities: [],
    };
  }
  return {
    version: 1,
    explorerId: String(parsed.explorerId || 'local-commander'),
    completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
    investigatedObjects: Array.isArray(parsed.investigatedObjects) ? parsed.investigatedObjects : [],
    personalDiscoveries: Array.isArray(parsed.personalDiscoveries) ? parsed.personalDiscoveries : [],
    activities: Array.isArray(parsed.activities) ? parsed.activities.slice(0, 60) : [],
    updatedAt: parsed.updatedAt || null,
  };
}

export function saveExpeditionJournal(journal) {
  const normalized = {
    ...DEFAULT_JOURNAL,
    ...journal,
    updatedAt: new Date().toISOString(),
  };
  writeRawStorage(JOURNAL_STORAGE_KEY, normalized);
  return normalized;
}

/**
 * Registra un evento en el Diario de Exploración sin duplicar entradas idénticas consecutivas.
 */
export function recordJournalActivity(entry = {}) {
  const journal = loadExpeditionJournal();
  const type = String(entry.type || 'EXPLORATION');
  const objectKey = entry.objectKey ? String(entry.objectKey).trim() : null;
  const objectKind = entry.objectKind ? String(entry.objectKind).trim() : 'astronomical-body';
  const title = String(entry.title || 'Actividad de exploración registrada').trim();
  const detail = String(entry.detail || '').trim();
  const nowIso = entry.timestamp || new Date().toISOString();

  if (objectKey && !journal.investigatedObjects.some((item) => item.key === objectKey)) {
    journal.investigatedObjects.unshift({
      key: objectKey,
      kind: objectKind,
      label: entry.objectLabel || objectKey,
      firstInvestigatedAt: nowIso,
    });
  }

  if (entry.missionId && !journal.completedMissions.some((m) => m.id === entry.missionId)) {
    journal.completedMissions.unshift({
      id: String(entry.missionId),
      title: entry.missionTitle || title,
      completedAt: nowIso,
    });
  }

  if (entry.discoveryId && !journal.personalDiscoveries.some((d) => d.id === entry.discoveryId)) {
    journal.personalDiscoveries.unshift({
      id: String(entry.discoveryId),
      title: entry.discoveryTitle || title,
      objectKey: objectKey || 'unknown',
      epistemicStatus: 'PERSONAL_ANNOTATION',
      recordedAt: nowIso,
    });
  }

  const topActivity = journal.activities[0];
  const isDuplicateConsecutive =
    topActivity &&
    topActivity.type === type &&
    topActivity.title === title &&
    topActivity.objectKey === objectKey;

  if (!isDuplicateConsecutive) {
    journal.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      detail,
      objectKey,
      objectKind,
      epoch: 'J2000.0',
      timestamp: nowIso,
    });
    journal.activities = journal.activities.slice(0, 60);
  }

  return saveExpeditionJournal(journal);
}

/**
 * Guarda el estado completo de la partida de KRONOX.
 */
export function saveGameState(snapshot = {}) {
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    epoch: 'J2000.0',
    shipName: 'KRONOX-1 (120 m)',
    currentBody: snapshot.currentBody || 'Tierra',
    cameraView: snapshot.cameraView || 'Cabina 1P',
    observationMode: snapshot.observationMode || 'naked-eye',
    opticalMagnification: Number(snapshot.opticalMagnification) || 1,
    scaleMode: snapshot.scaleMode || 'real',
    activeMissionId: snapshot.activeMissionId || null,
    activeObjective: snapshot.activeObjective || null,
    settings: snapshot.settings || {},
  };
  writeRawStorage(SAVEGAME_STORAGE_KEY, payload);
  recordJournalActivity({
    type: 'SAVEGAME',
    title: `Partida guardada en ${payload.currentBody}`,
    detail: `Modo: ${payload.cameraView} · Escala: ${payload.scaleMode === 'real' ? 'Física Real' : 'Visual'}`,
    objectKey: payload.currentBody,
    objectKind: 'planet',
  });
  return payload;
}

export function loadGameState() {
  return readRawStorage(SAVEGAME_STORAGE_KEY);
}

