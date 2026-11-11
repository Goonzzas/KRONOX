/**
 * KRONOX — Sistema de Persistencia y Gestión de Hallazgos Astronómicos
 * Almacenamiento local fiable con validación de esquema, WCS y trazabilidad.
 */

export const FINDINGS_STORAGE_KEY = 'kronox_findings_v1';

/**
 * Carga y valida la lista de hallazgos almacenados en localStorage.
 * Soporta migración de esquemas anteriores y tolera almacenamiento corrupto o deshabilitado.
 * @returns {Array<object>} Lista de hallazgos válidos
 */
export function loadFindingsFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(FINDINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => normalizeFindingRecord(item, index));
  } catch (err) {
    console.warn('[KRONOX] Error al leer hallazgos de localStorage:', err);
    return [];
  }
}

/**
 * Guarda la lista de hallazgos en localStorage.
 * @param {Array<object>} findings
 * @returns {boolean} true si se guardó con éxito, false en caso contrario
 */
export function saveFindingsToStorage(findings) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const cleanList = Array.isArray(findings) ? findings : [];
    window.localStorage.setItem(FINDINGS_STORAGE_KEY, JSON.stringify(cleanList));
    return true;
  } catch (err) {
    console.error('[KRONOX] Error al guardar hallazgos en localStorage:', err);
    return false;
  }
}

/**
 * Elimina un hallazgo por su identificador único.
 * @param {string} id
 * @returns {Array<object>} Nueva lista de hallazgos tras la eliminación
 */
export function deleteFindingFromStorage(id) {
  const current = loadFindingsFromStorage();
  const updated = current.filter((item) => item.id !== id);
  saveFindingsToStorage(updated);
  return updated;
}

/**
 * Normaliza y valida un registro de hallazgo contra el esquema canónico de KRONOX.
 * @param {object} raw
 * @param {number} fallbackIndex
 * @returns {object} Registro estructurado
 */
export function normalizeFindingRecord(raw, fallbackIndex = 0) {
  const id = String(raw.id || `find_${Date.now()}_${fallbackIndex}`);
  const targetKey = String(raw.targetKey || raw.targetId || 'barnard');
  const targetName = String(raw.targetName || raw.target || 'Objetivo astronómico');
  const createdAt = raw.createdAt || raw.dateCreated || new Date().toISOString();
  const description = String(raw.description || raw.note || '').trim();
  const viewMode = String(raw.viewMode || 'sideBySide');
  const band = String(raw.band || 'SPHEREx');

  // Observaciones comparadas
  const frameId1 = String(raw.frameId1 || raw.frameId || 'Obs-1');
  const frameDate1 = String(raw.frameDate1 || raw.previousDate || raw.date1 || '');
  const frameMjd1 = typeof raw.frameMjd1 === 'number' ? raw.frameMjd1 : null;

  const frameId2 = raw.frameId2 ? String(raw.frameId2) : null;
  const frameDate2 = raw.frameDate2 ? String(raw.frameDate2) : (raw.currentDate ? String(raw.currentDate) : null);
  const frameMjd2 = typeof raw.frameMjd2 === 'number' ? raw.frameMjd2 : null;
  const timeDeltaDays = typeof raw.timeDeltaDays === 'number' ? raw.timeDeltaDays : null;

  // Marcador espacial
  const rawMarker = raw.marker || {};
  const xPercent = typeof raw.xPercent === 'number' ? raw.xPercent : (typeof rawMarker.xPercent === 'number' ? rawMarker.xPercent : (typeof raw.x === 'number' ? raw.x : null));
  const yPercent = typeof raw.yPercent === 'number' ? raw.yPercent : (typeof rawMarker.yPercent === 'number' ? rawMarker.yPercent : (typeof raw.y === 'number' ? raw.y : null));
  const hasMarker = Boolean(raw.hasMarker || (xPercent !== null && yPercent !== null) || raw.marker);

  const pixelX = typeof raw.pixelX === 'number' ? raw.pixelX : (typeof rawMarker.pixelX === 'number' ? rawMarker.pixelX : (xPercent !== null ? Math.round((xPercent / 100) * 300) : null));
  const pixelY = typeof raw.pixelY === 'number' ? raw.pixelY : (typeof rawMarker.pixelY === 'number' ? rawMarker.pixelY : (yPercent !== null ? Math.round((yPercent / 100) * 300) : null));

  const ra = typeof raw.ra === 'number' && Number.isFinite(raw.ra) ? raw.ra : (typeof rawMarker.ra === 'number' && Number.isFinite(rawMarker.ra) ? rawMarker.ra : null);
  const dec = typeof raw.dec === 'number' && Number.isFinite(raw.dec) ? raw.dec : (typeof rawMarker.dec === 'number' && Number.isFinite(rawMarker.dec) ? rawMarker.dec : null);
  const pane = raw.pane || rawMarker.pane || 'both';

  return {
    id,
    targetKey,
    targetName,
    createdAt,
    description,
    conclusion: raw.conclusion ? String(raw.conclusion) : null,
    question: raw.question ? String(raw.question) : null,
    evidence: raw.evidence && typeof raw.evidence === 'object' ? raw.evidence : null,
    viewMode,
    band,
    frameId1,
    frameDate1,
    frameMjd1,
    frameId2,
    frameDate2,
    frameMjd2,
    timeDeltaDays,
    hasMarker,
    marker: hasMarker && xPercent !== null && yPercent !== null ? {
      xPercent,
      yPercent,
      pixelX,
      pixelY,
      ra,
      dec,
      pane,
    } : null,
  };
}

/**
 * Crea un nuevo registro de hallazgo completamente tipado y validado.
 */
export function createFindingRecord({
  target,
  frame,
  compareFrame,
  marker,
  description,
  viewMode,
  diagnostics,
  timeDeltaDays,
  conclusion = null, question = null, evidence = null,
}) {
  const noteClean = String(description || '').trim();
  if (!noteClean) {
    throw new Error('La descripción del hallazgo es obligatoria.');
  }
  if (!frame) {
    throw new Error('Se requiere al menos una observación activa para registrar un hallazgo.');
  }

  const id = `find_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const targetKey = target?.key || 'custom';
  const targetName = target?.name || 'Objetivo desconocido';
  const createdAt = new Date().toISOString();
  const band = frame.band || 'Desconocida';

  const frameId1 = frame.id;
  const frameDate1 = frame.dateAvg || frame.date;
  const frameMjd1 = Number(frame.dateAvg || frame.date) || null;

  const frameId2 = compareFrame ? compareFrame.id : null;
  const frameDate2 = compareFrame ? (compareFrame.dateAvg || compareFrame.date) : null;
  const frameMjd2 = compareFrame ? Number(compareFrame.dateAvg || compareFrame.date) : null;

  let computedMarker = null;
  if (marker && typeof marker.xPercent === 'number' && typeof marker.yPercent === 'number') {
    const pixelX = typeof marker.pixelX === 'number' ? marker.pixelX : Math.round((marker.xPercent / 100) * 300);
    const pixelY = typeof marker.pixelY === 'number' ? marker.pixelY : Math.round((marker.yPercent / 100) * 300);

    let ra = typeof marker.ra === 'number' ? marker.ra : null;
    let dec = typeof marker.dec === 'number' ? marker.dec : null;

    // Si RA/Dec no vienen calculados, intentar resolver con WCS reprojected si está disponible
    if (ra === null && diagnostics?.reprojected?.gridToWorld) {
      try {
        const sky = diagnostics.reprojected.gridToWorld(pixelX, pixelY);
        if (sky && Number.isFinite(sky.ra) && Number.isFinite(sky.dec)) {
          ra = sky.ra;
          dec = sky.dec;
        }
      } catch (err) {
        console.warn('[KRONOX] No se pudo calcular RA/Dec mediante WCS:', err);
      }
    }

    computedMarker = {
      xPercent: marker.xPercent,
      yPercent: marker.yPercent,
      pixelX,
      pixelY,
      ra,
      dec,
      pane: marker.pane || 'both',
    };
  }

  return normalizeFindingRecord({
    id,
    targetKey,
    targetName,
    createdAt,
    description: noteClean,
    conclusion, question, evidence,
    viewMode: viewMode || 'sideBySide',
    band,
    frameId1,
    frameDate1,
    frameMjd1,
    frameId2,
    frameDate2,
    frameMjd2,
    timeDeltaDays: typeof timeDeltaDays === 'number' ? timeDeltaDays : null,
    hasMarker: Boolean(computedMarker),
    marker: computedMarker,
  });
}
