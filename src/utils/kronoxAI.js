import { SPHEREX_TARGETS, SPHEREX_MISSION_TYPES } from '../data/spherexTargets.js';
import { P, INFO } from '../data/planetData.js';
import { NEARBY_GALAXIES } from '../data/nearbyGalaxies.js';

/**
 * Normalizes user text for intent detection (lowercase, accent-insensitive).
 */
export function normalizeText(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Matches a SPHEREx target from user text.
 */
export function matchSpherexTarget(query = '') {
  const q = normalizeText(query);
  if (!q) return null;
  if (q.includes('barnard') && !q.includes('galaxia') && !q.includes('ngc')) {
    return SPHEREX_TARGETS.find((t) => t.key === 'barnard');
  }
  if (q.includes('epsilon') || q.includes('indi')) {
    return SPHEREX_TARGETS.find((t) => t.key === 'epsilon-indi-b');
  }
  if (q.includes('wise') || q.includes('0855')) {
    return SPHEREX_TARGETS.find((t) => t.key === 'wise-0855');
  }
  if (q.includes('rw') || q.includes('auriga')) {
    return SPHEREX_TARGETS.find((t) => t.key === 'rw-aurigae');
  }
  if (q.includes('draco') || q.includes('r draconis')) {
    return SPHEREX_TARGETS.find((t) => t.key === 'r-draconis');
  }
  return null;
}

/**
 * Matches a Solar System body from user text.
 */
export function matchPlanet(query = '') {
  const q = normalizeText(query);
  if (!q) return null;
  const aliases = [
    ['Sol', ['sol', 'sun']],
    ['Mercurio', ['mercurio', 'mercury']],
    ['Venus', ['venus']],
    ['Tierra', ['tierra', 'earth']],
    ['Luna', ['luna', 'moon']],
    ['Marte', ['marte', 'mars']],
    ['Júpiter', ['jupiter']],
    ['Saturno', ['saturno', 'saturn']],
    ['Urano', ['urano', 'uranus']],
    ['Neptuno', ['neptuno', 'neptune']],
    ['Plutón', ['pluton', 'pluto']],
    ['Ceres', ['ceres']],
    ['Haumea', ['haumea']],
    ['Makemake', ['makemake']],
    ['Eris', ['eris']],
  ];
  for (const [name, terms] of aliases) {
    if (terms.some((term) => new RegExp(`\\b${term}\\b`).test(q))) {
      return P.find((p) => p.n === name) || null;
    }
  }
  return null;
}

/**
 * Matches a Nearby Galaxy from user text.
 */
export function matchNearbyGalaxy(query = '') {
  const q = normalizeText(query);
  if (!q) return null;
  if (q.includes('andromeda') || q.includes('m31')) {
    return NEARBY_GALAXIES.find((g) => g.key === 'm31');
  }
  if (q.includes('triangulo') || q.includes('triangulum') || q.includes('m33')) {
    return NEARBY_GALAXIES.find((g) => g.key === 'm33');
  }
  if (q.includes('magallanes') || q.includes('lmc')) {
    return NEARBY_GALAXIES.find((g) => g.key === 'lmc');
  }
  if (q.includes('cigarro') || q.includes('m82')) {
    return NEARBY_GALAXIES.find((g) => g.key === 'm82');
  }
  if (q.includes('bode') || q.includes('m81')) {
    return NEARBY_GALAXIES.find((g) => g.key === 'm81');
  }
  if (q.includes('escultor') || q.includes('ngc 253')) {
    return NEARBY_GALAXIES.find((g) => g.key === 'ngc-253');
  }
  return null;
}

/**
 * Formats an MJD timestamp into a readable UTC date string.
 */
function formatMjdDate(mjd) {
  const date = new Date((Number(mjd) - 40587) * 86400000);
  if (Number.isNaN(date.getTime())) return 'fecha desconocida';
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Processes a natural-language query or command directed at Kronox Onboard Intelligence.
 * Returns { reply, action, suggestions } where `action` is an executable command descriptor
 * that the host application (`App.jsx` / `SpherexMission.jsx`) executes immediately.
 *
 * Supported Capabilities:
 * - A: Exploration Guide ("qué estoy viendo", "dame una pista", "estrella vs galaxia")
 * - B: Navigator ("llévame a...", "visitar...", "regresar a la cabina", "destinos disponibles")
 * - C: Scientific Assistant ("qué sabemos de...", "fechas observadas", "bandas", "comparar épocas")
 * - D: Mission Instructor ("movimiento propio vs aparente", "variabilidad vs ruido", "cómo comprobar")
 * - E: Expedition Companion ("mi progreso", "mis hallazgos", "resumen de misión")
 */
export function processKronoxQuery(userQuery = '', context = {}) {
  const q = normalizeText(userQuery);
  const {
    activeTargetKey = 'barnard',
    missionOpen = false,
    missionStage = 'arrival',
    focusedPlanet = null,
    nearPlanet = null,
    selectedObject = null,
    findings = [],
    records = [],
    cockpitActive = false,
  } = context;

  const currentTarget =
    SPHEREX_TARGETS.find((t) => t.key === activeTargetKey) || SPHEREX_TARGETS[0];
  const matchedTarget = matchSpherexTarget(q);
  const matchedPlanet = matchPlanet(q);
  const matchedGalaxy = matchNearbyGalaxy(q);

  // =========================================================================
  // FUNCIÓN B — NAVEGADORA (Órdenes reales de viaje y cabina)
  // =========================================================================
  const isNavVerb =
    /\b(llevame|vamos|ir|viajar|viaja|visitar|visita|dirigete|rumbo|salto|navega|explorar|acercate|enfoca|abre)\b/.test(
      q,
    );

  if (
    q.includes('regresemos a la nave') ||
    q.includes('volver a la nave') ||
    q.includes('ir a la cabina') ||
    q.includes('entrar a la cabina') ||
    q.includes('puente de mando') ||
    q.includes('vista interior')
  ) {
    return {
      reply:
        'Transfiriendo control al puente de mando en primera persona. Todas las consolas de navegación, ciencia y misiones están operativas frente a ti.',
      action: { type: 'ENTER_COCKPIT' },
      role: 'Navegadora',
    };
  }

  if (
    q.includes('vista exterior') ||
    q.includes('tercera persona') ||
    q.includes('ver la nave por fuera')
  ) {
    return {
      reply:
        'Cambiando a cámara exterior de seguimiento. La nave mantiene su escala física constante de 120 metros mientras cruza el espacio.',
      action: { type: 'SET_VIEW_MODE', view: 3 },
      role: 'Navegadora',
    };
  }

  if (
    q.includes('destinos disponibles') ||
    q.includes('que destinos') ||
    q.includes('adonde podemos ir') ||
    q.includes('que misiones hay') ||
    q.includes('mostrar destinos')
  ) {
    const names = SPHEREX_TARGETS.map((t) => `${t.name} (${t.distanceLabel})`).join(', ');
    return {
      reply: `Contamos con 5 destinos estelares con datos infrarrojos reales de SPHEREx: ${names}. También puedes viajar a cualquier planeta del Sistema Solar (como Marte, Júpiter o Saturno) o al mapa de galaxias cercanas. Abriendo el selector de misiones.`,
      action: { type: 'OPEN_MISSION_SELECTOR' },
      role: 'Navegadora',
    };
  }

  // Direct travel to a SPHEREx target
  if (matchedTarget && (isNavVerb || q.startsWith(normalizeText(matchedTarget.name)))) {
    return {
      reply: `Rumbo fijado hacia ${matchedTarget.name} (${matchedTarget.distanceLabel}, RA ${matchedTarget.ra.toFixed(4)}°, Dec ${matchedTarget.dec.toFixed(4)}°). Iniciando alineación y salto espacial hacia su posición en el brazo de Orión.`,
      action: { type: 'TRAVEL_SPHEREX', targetKey: matchedTarget.key, target: matchedTarget },
      role: 'Navegadora',
    };
  }

  // Direct travel to a Planet
  if (matchedPlanet && isNavVerb) {
    return {
      reply: `Calculando vector de aproximación hacia ${matchedPlanet.n}. Activando propulsión de crucero en el Sistema Solar.`,
      action: { type: 'TRAVEL_PLANET', planetName: matchedPlanet.n },
      role: 'Navegadora',
    };
  }

  // Direct travel to a Nearby Galaxy
  if (matchedGalaxy && isNavVerb) {
    return {
      reply: `Desplegando cartografía intergaláctica y enfocando ${matchedGalaxy.name.es} (${matchedGalaxy.distanceText?.es || 'Grupo Local'}). Nota científica: este objeto pertenece al mapa galáctico esquemático y no dispone de recortes FITS individuales en esta misión SPHEREx.`,
      action: { type: 'TRAVEL_GALAXY', galaxyKey: matchedGalaxy.key },
      role: 'Navegadora',
    };
  }

  // =========================================================================
  // FUNCIÓN C — ASISTENTE CIENTÍFICO (Archivo temporal SPHEREx y metadatos)
  // =========================================================================
  if (
    q.includes('comparar') ||
    q.includes('compara dos epocas') ||
    q.includes('alternar epocas') ||
    q.includes('blink')
  ) {
    return {
      reply: `Activando la etapa de Observación Temporal para ${currentTarget.name}. Alternaremos entre dos épocas reales de SPHEREx para comprobar cambios de posición o brillo frente al fondo estelar.`,
      action: { type: 'OPEN_MISSION_STAGE', targetKey: currentTarget.key, stage: 'compare' },
      role: 'Asistente científico',
    };
  }

  if (
    q.includes('fechas') ||
    q.includes('cuando se observo') ||
    q.includes('observaciones de 2025') ||
    q.includes('observaciones de 2026') ||
    q.includes('mas reciente') ||
    q.includes('archivo temporal') ||
    q.includes('bandas')
  ) {
    const subject = matchedTarget || currentTarget;
    if (records && records.length > 0 && (!matchedTarget || matchedTarget.key === currentTarget.key)) {
      const bands = [...new Set(records.map((r) => r.band))].join(', ');
      const firstDate = formatMjdDate(records[0].dateAvg || records[0].date);
      const lastDate = formatMjdDate(
        records[records.length - 1].dateAvg || records[records.length - 1].date,
      );
      const count2025 = records.filter((r) => {
        const yr = new Date((Number(r.dateAvg || r.date) - 40587) * 86400000).getUTCFullYear();
        return yr === 2025;
      }).length;
      const count2026 = records.filter((r) => {
        const yr = new Date((Number(r.dateAvg || r.date) - 40587) * 86400000).getUTCFullYear();
        return yr === 2026;
      }).length;

      return {
        reply: `En el archivo real de SPHEREx (IRSA) para ${subject.name} tenemos ${records.length} observaciones cargadas entre ${firstDate} y ${lastDate} (${count2025} en 2025 y ${count2026} en 2026). Bandas infrarrojas detectadas: ${bands} (banda preferente: ${subject.preferredBand}).`,
        action: missionOpen
          ? { type: 'OPEN_MISSION_STAGE', targetKey: subject.key, stage: 'explore' }
          : { type: 'OPEN_OBSERVATORY', targetKey: subject.key },
        role: 'Asistente científico',
      };
    }

    return {
      reply: `Para ${subject.name} (${subject.distanceLabel}), SPHEREx opera principalmente en la banda ${subject.preferredBand}. ${subject.observationSummary} Abriendo la consola científica para consultar el listado exacto de fechas UTC en IRSA.`,
      action: { type: 'OPEN_OBSERVATORY', targetKey: subject.key },
      role: 'Asistente científico',
    };
  }

  if (
    matchedTarget ||
    q.includes('que sabemos de esta estrella') ||
    q.includes('que sabemos de este objeto') ||
    q.includes('informacion cientifica') ||
    q.includes('estado cientifico')
  ) {
    const subject = matchedTarget || currentTarget;
    return {
      reply: `${subject.name} (${subject.distanceLabel}): ${subject.note} Coordenadas ICRS propagadas (J2025.8): RA ${subject.ra.toFixed(4)}°, Dec ${subject.dec.toFixed(4)}°. Banda principal: ${subject.preferredBand}. Estado: ${subject.scientificStatus} (${subject.validationType}). ${subject.observationSummary}`,
      action: { type: 'SELECT_OBJECT', kind: 'spherex', key: subject.key },
      role: 'Asistente científico',
    };
  }

  if (matchedPlanet) {
    const info = INFO[matchedPlanet.n];
    return {
      reply: `${matchedPlanet.n}: Diámetro ${(matchedPlanet.km * 2).toLocaleString('es-ES')} km${matchedPlanet.au ? `, distancia media al Sol ${matchedPlanet.au} UA` : ''}. ${info ? info.intro + ' ' + info.temperatura : ''} Nota: Los cuerpos del Sistema Solar se exploran en 3D; el archivo de recortes FITS de esta misión está dedicado a los 5 objetivos estelares de SPHEREx.`,
      action: { type: 'SELECT_OBJECT', kind: 'planet', key: matchedPlanet.n },
      role: 'Asistente científico',
    };
  }

  // =========================================================================
  // FUNCIÓN D — INSTRUCTORA DE MISIONES (Conceptos y verificación)
  // =========================================================================
  if (
    q.includes('comprobar si se ha desplazado') ||
    q.includes('como puedo comprobar') ||
    q.includes('movimiento propio') ||
    q.includes('se mueve')
  ) {
    return {
      reply:
        'Para comprobar si una estrella tiene movimiento propio real: 1) Activa la etapa «Observación temporal» en modo Alternar épocas (Blink). 2) Fíjate en las estrellas débiles de fondo: permanecen fijas porque están a miles de años luz. 3) Si la fuente central salta de posición entre 2025 y 2026 mientras el fondo queda quieto, estás viendo movimiento propio real (como los 10,36″/año de Barnard).',
      action: missionOpen
        ? { type: 'OPEN_MISSION_STAGE', targetKey: currentTarget.key, stage: 'compare' }
        : null,
      role: 'Instructora de misiones',
    };
  }

  if (
    q.includes('diferencia entre una estrella y una galaxia') ||
    q.includes('estrella y galaxia') ||
    q.includes('enana marron')
  ) {
    return {
      reply:
        'Una estrella (como Barnard o RW Aurigae) es una esfera individual de plasma dentro de nuestra Vía Láctea; en SPHEREx aparece como una fuente puntual cuya forma responde a la PSF del telescopio (~6,2″/píxel). Una enana marrón (como WISE 0855 o Epsilon Indi Ba/Bb) es un objeto subestelar frío que emite casi todo su flujo en el infrarrojo. Una galaxia (como Andrómeda M31) es un sistema de cientos de miles de millones de estrellas situado a millones de años luz.',
      action: null,
      role: 'Instructora de misiones',
    };
  }

  if (q.includes('ruido') || q.includes('artefacto') || q.includes('wise 0855')) {
    return {
      reply:
        'No todo cambio visual en una imagen infrarroja es astrofísico. El fondo zodiacal, los rayos cósmicos y la varianza instrumental crean fluctuaciones. Por ejemplo, WISE 0855 mantiene estado WARNING porque en la Época 1 su relación señal-ruido de apertura es 1,07 (sub-umbral, indistinguible de ruido sin prior de catálogo), y en Época 2 alcanza 61,0 % de completitud en simulaciones Monte Carlo.',
      action: null,
      role: 'Instructora de misiones',
    };
  }

  // =========================================================================
  // FUNCIÓN A — GUÍA DE EXPLORACIÓN (¿Qué estoy viendo? / Pistas progresivas)
  // =========================================================================
  if (
    q.includes('pista') ||
    q.includes('ayuda') ||
    q.includes('no encuentro') ||
    q.includes('donde buscar')
  ) {
    const isMotion = currentTarget.mission === 'motion';
    return {
      reply: isMotion
        ? `Pista de exploración para ${currentTarget.name}: Observa cerca del retículo central donde se proyecta la coordenada propagada de Gaia/CatWISE (RA ${currentTarget.ra.toFixed(3)}°, Dec ${currentTarget.dec.toFixed(3)}°). Primero identifica dos fuentes brillantes periféricas que NO se muevan al alternar épocas; úsalas como ancla visual y luego mira el centro.`
        : `Pista de exploración para ${currentTarget.name}: No busques un cambio de posición; esta estrella está a ${currentTarget.distanceLabel} y su desplazamiento angular es mínimo. Compara la intensidad del núcleo brillante central entre dos fechas o activa el modo «Diferencia» para ver el residuo fotométrico.`,
      action: null,
      role: 'Guía de exploración',
    };
  }

  if (
    q.includes('que estoy viendo') ||
    q.includes('donde estoy') ||
    q.includes('que es esto')
  ) {
    if (missionOpen) {
      return {
        reply: `Estás en la consola de expedición científica observando ${currentTarget.name} (${currentTarget.distanceLabel}) en la etapa «${missionStage}». Las imágenes son recortes FITS reales del telescopio espacial SPHEREx (banda ${currentTarget.preferredBand}) proyectados en coordenadas celestes.`,
        action: null,
        role: 'Guía de exploración',
      };
    }
    if (selectedObject?.kind === 'spherex') {
      const tObj = SPHEREX_TARGETS.find((t) => t.key === selectedObject.key) || currentTarget;
      return {
        reply: `Tienes seleccionado el objetivo estelar ${tObj.name} a ${tObj.distanceLabel}. ${tObj.note} Puedes viajar hacia él o abrir directamente sus observaciones infrarrojas de SPHEREx.`,
        action: null,
        role: 'Guía de exploración',
      };
    }
    const planetName = selectedObject?.key || nearPlanet || focusedPlanet;
    if (planetName && INFO[planetName]) {
      return {
        reply: `Estás observando ${planetName} en el modelo tridimensional del Sistema Solar. ${INFO[planetName].intro} ${INFO[planetName].temperatura}`,
        action: null,
        role: 'Guía de exploración',
      };
    }
    return {
      reply: `Te encuentras a bordo de la nave de exploración KRONOX${cockpitActive ? ' (en la cabina de mando en primera persona)' : ' navegando por el universo 3D'}. Desde aquí puedes pilotar libremente, seleccionar estrellas reales de la misión SPHEREx o pedirme que te lleve a cualquier destino.`,
      action: null,
      role: 'Guía de exploración',
    };
  }

  // =========================================================================
  // FUNCIÓN E — COMPAÑERA DE EXPEDICIÓN (Progreso y hallazgos guardados)
  // =========================================================================
  if (
    q.includes('hallazgo') ||
    q.includes('progreso') ||
    q.includes('cuaderno') ||
    q.includes('guardado')
  ) {
    const total = findings.length;
    const byTarget = findings.filter((f) => f.targetKey === currentTarget.key).length;
    return {
      reply:
        total > 0
          ? `Llevas ${total} hallazgo(s) registrado(s) en tu cuaderno de expedición (${byTarget} en ${currentTarget.name}). Puedes revisarlos, restaurar su vista o exportarlos en formato CSV desde la etapa de Investigación o Cierre.`
          : `Aún no has guardado hallazgos en tu cuaderno. Cuando estés observando una imagen en ${currentTarget.name}, entra en la etapa «Investigación», marca un punto sobre el lienzo astronómico y escribe tu observación.`,
      action: missionOpen
        ? { type: 'OPEN_MISSION_STAGE', targetKey: currentTarget.key, stage: 'investigate' }
        : null,
      role: 'Compañera de expedición',
    };
  }

  // Fallback contextual e inteligente
  return {
    reply: `Recibido, explorador. Actualmente nuestro objetivo de referencia es ${currentTarget.name} (${currentTarget.distanceLabel}, banda ${currentTarget.preferredBand}). Puedo llevarte a cualquier estrella de misión («Llévame a Barnard», «Visitar Epsilon Indi», «Ir a RW Aurigae»), consultar las fechas y bandas reales de SPHEREx, o darte pistas para identificar movimiento propio y variabilidad.`,
    action: null,
    role: 'Inteligencia de a bordo',
  };
}

export const KRONOX_QUICK_PROMPTS = [
  { label: '¿Qué estoy viendo?', query: '¿Qué estoy viendo?' },
  { label: 'Destinos disponibles', query: 'Muéstrame los destinos disponibles' },
  { label: 'Llévame a Barnard', query: 'Llévame a la estrella de Barnard' },
  { label: 'Visitar Epsilon Indi', query: 'Quiero visitar Epsilon Indi' },
  { label: 'Fechas SPHEREx', query: '¿En qué fechas se observó esta estrella y qué bandas hay?' },
  { label: 'Comparar épocas', query: 'Compara dos épocas de esta estrella' },
  { label: 'Dame una pista', query: 'Dame una pista para encontrar el objeto' },
  { label: 'Ir a la cabina', query: 'Regresemos a la nave e ir a la cabina' },
];

