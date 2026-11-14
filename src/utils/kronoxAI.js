import {resolveScienceHelp} from './contextualScienceHelp.js';
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
  const additional=SPHEREX_TARGETS.find(t=>t.key==='m31'&&(q.includes('m31')||q.includes('andromeda'))||t.key!=='barnard'&&q.includes(normalizeText(t.name)));
  if(additional)return additional;
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
 * Returns { reply, action, role, avatarState, pointDirection, epistemicCategory }
 * where `action` is an executable command descriptor that `App.jsx` / `SpherexMission.jsx`
 * executes immediately, and `avatarState` drives the 3D rigged holographic avatar.
 *
 * Supported Capabilities (Sections 3, 4 & 9):
 * - Función A: Bienvenida y presentación progresiva de la nave
 * - Función B: Enseñar a explorar el universo
 * - Función C: Enseñar a identificar estrellas (con pistas progresivas)
 * - Función D: Enseñar a estudiar variaciones temporales
 * - Función E: Navegación real
 * - Función F: Lore, personalidad y rigor epistémico (distinguiendo Objeto 3D, Objetivo, Fuente, Candidato, Hallazgo personal, Resultado confirmado)
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
  const scienceHelp=resolveScienceHelp(q,context,currentTarget);
  if(scienceHelp)return scienceHelp;
  const matchedTarget = matchSpherexTarget(q);
  const matchedPlanet = matchPlanet(q);
  const matchedGalaxy = matchNearbyGalaxy(q);

  // =========================================================================
  // DOCUMENTAL INTERACTIVO HISTÓRICO SPHEREx (NASA · JPL · CALTECH)
  // =========================================================================
  if (
    q.includes('que es spherex') ||
    q.includes('historia de spherex') ||
    q.includes('documental spherex') ||
    q.includes('cuentame sobre spherex') ||
    q.includes('quien creo spherex') ||
    q.includes('quien construyo spherex') ||
    q.includes('como se construyo spherex') ||
    q.includes('que hace spherex') ||
    (q.includes('spherex') && (q.includes('documental') || q.includes('historia') || q.includes('origen') || q.includes('construccion') || q.includes('equipo') || q.includes('caltech')))
  ) {
    return {
      reply:
        'Iniciando documental interactivo de la misión SPHEREx de NASA y Caltech: desde su concepción en 102 bandas espectrales y pruebas criogénicas, hasta su despegue a bordo del Falcon 9 y sus tres pilares cosmológicos.',
      action: { type: 'PLAY_SPHEREX_DOCUMENTARY' },
      role: 'KRONOX IA · Asistente Científico',
      avatarState: 'EXPLAINING',
      pointDirection: 'left',
      epistemicCategory: 'Documental Histórico SPHEREx',
    };
  }

  // =========================================================================
  // FUNCIÓN A — BIENVENIDA Y REPRODUCCIÓN DE INTRODUCCIÓN CINEMATOGRÁFICA
  // =========================================================================
  if (
    q.includes('hola') ||
    q.includes('bienvenida') ||
    q.includes('quien eres') ||
    q.includes('presentate')
  ) {
    return {
      reply:
        'Saludos, astronauta. Soy Kronox IA, la inteligencia holográfica de a bordo de esta nave de exploración científica de 120 metros. Mi propósito es acompañarte por el universo 3D, asistirte en el puente de mando y analizar contigo las observaciones infrarrojas reales del telescopio espacial SPHEREx de la NASA.',
      action: null,
      role: 'Compañera de expedición',
      avatarState: 'GREETING',
      pointDirection: 'forward',
      epistemicCategory: 'Lore de expedición · Identidad de a bordo',
    };
  }

  if (
    q.includes('reproducir introduccion') ||
    q.includes('ver cinematica') ||
    q.includes('repetir introduccion') ||
    q.includes('secuencia cinematica')
  ) {
    return {
      reply:
        'Iniciando las 5 secuencias cinematográficas pregrabadas de aproximación y abordaje de la nave KRONOX.',
      action: { type: 'PLAY_CINEMATIC_INTRO' },
      role: 'Compañera de expedición',
      avatarState: 'GREETING',
      pointDirection: 'forward',
      epistemicCategory: 'Secuencia cinematográfica pregrabada',
    };
  }

  if (
    q.includes('despedida') ||
    q.includes('hasta luego') ||
    q.includes('cerrar sesion') ||
    q.includes('fin de mision')
  ) {
    return {
      reply:
        'Ha sido un honor compartir esta guardia en el puente de mando, explorador. Tus hallazgos quedan resguardados en la bitácora de a bordo. Estaré en línea cuando decidas retomar la expedición.',
      action: null,
      role: 'Compañera de expedición',
      avatarState: 'FAREWELL',
      pointDirection: 'forward',
      epistemicCategory: 'Lore de expedición',
    };
  }

  // =========================================================================
  // FUNCIÓN F — LORE DE LA NAVE Y RIGOR EPISTÉMICO (SECCIÓN 9)
  // =========================================================================
  if (
    q.includes('historia de la nave') ||
    q.includes('lore') ||
    q.includes('que es kronox') ||
    q.includes('aurora-120') ||
    q.includes('aurora 120') ||
    q.includes('proyecto horizonte') ||
    q.includes('proposito de la expedicion')
  ) {
    return {
      reply:
        'El Proyecto Horizonte diseñó KRONOX Aurora-120 como un crucero científico modular de 120 metros con cuatro cubiertas presurizadas, reactor toroidal de fusión y anillos giroscópicos para llevar observación infrarroja al espacio profundo. Importante distinción científica: la nave Aurora-120, el Proyecto Horizonte y nuestra historia forman parte del marco narrativo del juego, mientras que cada coordenada Gaia DR3, espectro y observación de NASA SPHEREx/IRSA que analizamos a bordo son datos astronómicos reales.',
      action: null,
      role: 'Compañera de expedición',
      avatarState: 'EXPLAINING',
      pointDirection: 'forward',
      epistemicCategory: 'Distinción: Lore Proyecto Horizonte vs. Datos reales SPHEREx',
    };
  }

  if (
    q.includes('categorias') ||
    q.includes('diferencia entre hallazgo') ||
    q.includes('confirmado') ||
    q.includes('candidato')
  ) {
    return {
      reply:
        'En KRONOX distinguimos 6 niveles epistémicos sin confundirlos: 1) Objeto de la escena 3D (representación espacial interactiva); 2) Objetivo astronómico identificado (como las 5 estrellas del catálogo); 3) Fuente detectada en una imagen FITS; 4) Candidato a fenómeno (variación o desplazamiento pendiente de contraste); 5) Hallazgo personal del usuario (tus marcas guardadas en el cuaderno); y 6) Resultado científicamente confirmado (validado estadísticamente con astrometría Gaia/CatWISE).',
      action: null,
      role: 'Asistente científico',
      avatarState: 'EXPLAINING',
      pointDirection: 'up',
      epistemicCategory: 'Taxonomía epistémica de 6 niveles',
    };
  }

  // =========================================================================
  // FUNCIÓN E — NAVEGACIÓN (Órdenes reales de viaje y cabina)
  // =========================================================================
  const isNavVerb =
    /\b(llevame|vamos|ir|viajar|viaja|visitar|visita|dirigete|rumbo|salto|navega|explorar|acercate|enfoca|abre)\b/.test(
      q,
    );

  if (
    q.includes('regresemos a la nave') ||
    q.includes('regresemos a la cabina') ||
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
      avatarState: 'NAVIGATING',
      pointDirection: 'forward',
      epistemicCategory: 'Objeto de la escena 3D · Cabina de mando',
    };
  }

  if (
    q.includes('explorar el sistema solar') ||
    q.includes('volver al sistema solar') ||
    q.includes('ir al sistema solar')
  ) {
    return {
      reply:
        'Fijando rumbo de retorno al Sistema Solar interior y enfocando la Tierra. Puedes seleccionar cualquier planeta en 3D para inspeccionar su órbita.',
      action: { type: 'TRAVEL_PLANET', planetName: 'Tierra' },
      role: 'Navegadora',
      avatarState: 'NAVIGATING',
      pointDirection: 'left',
      epistemicCategory: 'Objeto de la escena 3D · Sistema Solar',
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
      avatarState: 'NAVIGATING',
      pointDirection: 'up',
      epistemicCategory: 'Objeto de la escena 3D · Escala física 120 m',
    };
  }

  if (
    q.includes('telescopio') ||
    q.includes('aumento optico') ||
    q.includes('ampliacion optica') ||
    q.includes('150x') ||
    q.includes('300x')
  ) {
    const mag = q.includes('300') ? 300 : q.includes('150') ? 150 : q.includes('50') ? 50 : 150;
    return {
      reply: `Activando instrumento óptico de a bordo con aumento ${mag}×. Ahora podrás resolver el disco planetario real (θ = 2·arctan(R/D)), los anillos de Saturno y las lunas galileanas de Júpiter que a simple vista aparecen como puntos estelares.`,
      action: { type: 'SET_OPTICAL_TELESCOPE', enabled: true, magnification: mag },
      role: 'Asistente científico',
      avatarState: 'POINTING',
      pointDirection: 'forward',
      epistemicCategory: 'Instrumento óptico · Resolución angular real (J2000.0)',
    };
  }

  if (q.includes('simple vista') || q.includes('desactivar telescopio')) {
    return {
      reply:
        'Restaurando observación a simple vista (1×). Los cuerpos lejanos cuyo tamaño angular es menor a 60 segundos de arco se observan como puntos brillantes reales en la bóveda celeste.',
      action: { type: 'SET_OPTICAL_TELESCOPE', enabled: false, magnification: 1 },
      role: 'Asistente científico',
      avatarState: 'EXPLAINING',
      pointDirection: 'forward',
      epistemicCategory: 'Observación a simple vista (1×)',
    };
  }

  if (
    q.includes('destinos disponibles') ||
    q.includes('que destinos') ||
    q.includes('que objetos puedo visitar') ||
    q.includes('adonde podemos ir') ||
    q.includes('que misiones hay') ||
    q.includes('mostrar destinos')
  ) {
    const names = SPHEREX_TARGETS.map((t) => `${t.name} (${t.distanceLabel})`).join(', ');
    return {
      reply: `Contamos con 5 objetivos astronómicos identificados con datos infrarrojos reales de SPHEREx: ${names}. También puedes visitar los planetas del Sistema Solar en la escena 3D o consultar el mapa de galaxias cercanas. Señalando el selector de misiones.`,
      action: { type: 'OPEN_MISSION_SELECTOR' },
      role: 'Navegadora',
      avatarState: 'POINTING',
      pointDirection: 'left',
      epistemicCategory: 'Objetivo astronómico identificado (Catálogo SPHEREx)',
    };
  }

  // Direct travel to a SPHEREx target
  if (matchedTarget && (isNavVerb || q.startsWith(normalizeText(matchedTarget.name)))) {
    return {
      reply: `Rumbo fijado hacia ${matchedTarget.name}, a ${matchedTarget.distanceLabel} en el vecindario solar. Nota física: realizamos un desplazamiento acelerado de visualización en el motor 3D hacia su posición real.`,
      action: { type: 'TRAVEL_SPHEREX', targetKey: matchedTarget.key, target: matchedTarget },
      role: 'Navegadora',
      avatarState: 'NAVIGATING',
      pointDirection: 'up',
      epistemicCategory: 'Objetivo astronómico identificado · Viaje en motor 3D',
    };
  }

  // Direct travel to a Planet
  if (matchedPlanet && isNavVerb) {
    return {
      reply: `Calculando vector de aproximación hacia ${matchedPlanet.n}. Activando propulsión de crucero en el Sistema Solar.`,
      action: { type: 'TRAVEL_PLANET', planetName: matchedPlanet.n },
      role: 'Navegadora',
      avatarState: 'NAVIGATING',
      pointDirection: 'left',
      epistemicCategory: 'Objeto de la escena 3D · Planeta del Sistema Solar',
    };
  }

  // Direct travel to a Nearby Galaxy
  if (matchedGalaxy && isNavVerb) {
    return {
      reply: `Desplegando cartografía intergaláctica y enfocando ${matchedGalaxy.name.es} (${matchedGalaxy.distanceText?.es || 'Grupo Local'}). Nota científica: este objeto pertenece al mapa galáctico 3D y no dispone de recortes FITS individuales en esta misión SPHEREx.`,
      action: { type: 'TRAVEL_GALAXY', galaxyKey: matchedGalaxy.key },
      role: 'Navegadora',
      avatarState: 'NAVIGATING',
      pointDirection: 'up',
      epistemicCategory: 'Objeto de la escena 3D · Galaxia del Grupo Local',
    };
  }

  // =========================================================================
  // FUNCIÓN D — ESTUDIAR VARIACIONES TEMPORALES Y ARCHIVO SPHEREx
  // =========================================================================
  if (
    q.includes('comparar') ||
    q.includes('compara dos epocas') ||
    q.includes('alternar epocas') ||
    q.includes('blink')
  ) {
    return {
      reply: `Activando la etapa de Observación Temporal para ${currentTarget.name}. Observa cómo alternamos dos recortes FITS reales de distintas épocas: las fuentes fijas sirven de ancla astrométrica y cualquier desplazamiento o cambio de flujo revela actividad en el objetivo.`,
      action: { type: 'OPEN_MISSION_STAGE', targetKey: currentTarget.key, stage: 'compare' },
      role: 'Asistente científico',
      avatarState: 'POINTING',
      pointDirection: 'left',
      epistemicCategory: 'Comparación temporal de observaciones reales SPHEREx',
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
        avatarState: 'EXPLAINING',
        pointDirection: 'left',
        epistemicCategory: 'Objetivo astronómico identificado · Archivo FITS IRSA',
      };
    }

    return {
      reply: `Para ${subject.name} (${subject.distanceLabel}), SPHEREx opera principalmente en la banda ${subject.preferredBand}. ${subject.observationSummary} Abriendo la consola científica para consultar el listado exacto de fechas UTC en IRSA.`,
      action: { type: 'OPEN_OBSERVATORY', targetKey: subject.key },
      role: 'Asistente científico',
      avatarState: 'POINTING',
      pointDirection: 'left',
      epistemicCategory: 'Objetivo astronómico identificado · Archivo FITS IRSA',
    };
  }

  if (
    matchedTarget ||
    q.includes('que sabemos de esta estrella') ||
    q.includes('que es esta estrella') ||
    q.includes('que sabemos de este objeto') ||
    q.includes('informacion cientifica') ||
    q.includes('estado cientifico')
  ) {
    const subject = matchedTarget || currentTarget;
    return {
      reply: `${subject.name} (${subject.distanceLabel}): ${subject.note} Coordenadas ICRS propagadas (J2025.8): RA ${subject.ra.toFixed(4)}°, Dec ${subject.dec.toFixed(4)}°. Banda principal: ${subject.preferredBand}. Estado: ${subject.scientificStatus} (${subject.validationType}). ${subject.observationSummary}`,
      action: { type: 'SELECT_OBJECT', kind: 'spherex', key: subject.key },
      role: 'Asistente científico',
      avatarState: 'POINTING',
      pointDirection: 'left',
      epistemicCategory:
        subject.scientificStatus === 'VALIDADO'
          ? 'Resultado científicamente confirmado (Gaia DR3 / SPHEREx)'
          : 'Candidato / Estado científico condicionado (' + subject.scientificStatus + ')',
    };
  }

  if (matchedPlanet || q.includes('como identifico un planeta')) {
    if (matchedPlanet) {
      const info = INFO[matchedPlanet.n];
      return {
        reply: `${matchedPlanet.n}: Diámetro ${(matchedPlanet.km * 2).toLocaleString('es-ES')} km${matchedPlanet.au ? `, distancia media al Sol ${matchedPlanet.au} UA` : ''}. ${info ? info.intro + ' ' + info.temperatura : ''} Nota: Los cuerpos del Sistema Solar son objetos de la escena 3D; el archivo de recortes FITS de esta misión está dedicado a los 5 objetivos estelares de SPHEREx.`,
        action: { type: 'SELECT_OBJECT', kind: 'planet', key: matchedPlanet.n },
        role: 'Asistente científico',
        avatarState: 'POINTING',
        pointDirection: 'left',
        epistemicCategory: 'Objeto de la escena 3D · Efemérides del Sistema Solar',
      };
    }
    return {
      reply:
        'Un planeta del Sistema Solar se distingue porque orbita alrededor de nuestro Sol siguiendo las leyes de Kepler y refleja luz solar, desplazándose rápidamente frente a las constelaciones. En cambio, las estrellas de nuestro catálogo SPHEREx están a años luz de distancia y emiten su propia radiación térmica e infrarroja.',
      action: null,
      role: 'Instructora de misiones',
      avatarState: 'EXPLAINING',
      pointDirection: 'forward',
      epistemicCategory: 'Guía astronómica · Planeta vs. Estrella',
    };
  }

  // =========================================================================
  // FUNCIÓN C — ENSEÑAR A IDENTIFICAR ESTRELLAS Y VARIACIONES
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
      avatarState: 'EXPLAINING',
      pointDirection: 'left',
      epistemicCategory: 'Metodología astrométrica · Movimiento propio vs. aparente',
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
      avatarState: 'EXPLAINING',
      pointDirection: 'up',
      epistemicCategory: 'Astrofísica observacional · Clasificación de fuentes',
    };
  }

  if (q.includes('ruido') || q.includes('artefacto') || q.includes('wise 0855')) {
    return {
      reply:
        'No todo cambio visual en una imagen infrarroja es astrofísico. El fondo zodiacal, los rayos cósmicos y la varianza instrumental crean fluctuaciones. Por ejemplo, WISE 0855 mantiene estado WARNING porque en la Época 1 su relación señal-ruido de apertura es 1,07 (sub-umbral, indistinguible de ruido sin prior de catálogo), y en Época 2 alcanza 61,0 % de completitud en simulaciones Monte Carlo.',
      action: null,
      role: 'Instructora de misiones',
      avatarState: 'EXPLAINING',
      pointDirection: 'left',
      epistemicCategory: 'Candidato sub-umbral · Análisis de ruido e incertidumbre',
    };
  }

  // =========================================================================
  // FUNCIÓN B/C — GUÍA DE EXPLORACIÓN (¿Qué estoy viendo? / Pistas visuales 3D)
  // =========================================================================
  if (
    q.includes('pista') ||
    q.includes('ayuda') ||
    q.includes('no encuentro') ||
    q.includes('donde buscar') ||
    q.includes('identificar')
  ) {
    const isMotion = currentTarget.mission === 'motion';
    return {
      reply: isMotion
        ? `Observa ese campo estelar de ${currentTarget.name}. Busca la fuente que quiero mostrarte: estoy señalando hacia el retículo central (RA ${currentTarget.ra.toFixed(3)}°, Dec ${currentTarget.dec.toFixed(3)}°). Pista 1: Identifica primero dos fuentes periféricas que permanezcan inmóviles. Pista 2: Alterna épocas para detectar qué fuente central se desplaza respecto a ellas.`
        : `Observa ese campo estelar de ${currentTarget.name}. Estoy señalando hacia el núcleo central a ${currentTarget.distanceLabel}. Pista: Aquí la posición no cambia; compara la intensidad del brillo central entre dos fechas o activa el mapa de «Diferencia» para aislar la variación fotométrica.`,
      action: missionOpen ? { type: 'HIGHLIGHT_FIELD_REGION' } : null,
      role: 'Instructora de misiones',
      avatarState: 'POINTING',
      pointDirection: 'left',
      epistemicCategory: 'Fuente detectada en imagen · Guía de identificación progresiva',
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
        avatarState: 'POINTING',
        pointDirection: 'left',
        epistemicCategory: 'Objetivo astronómico identificado · Recorte FITS real',
      };
    }
    if (selectedObject?.kind === 'spherex') {
      const tObj = SPHEREX_TARGETS.find((t) => t.key === selectedObject.key) || currentTarget;
      return {
        reply: `Tienes seleccionado el objetivo estelar ${tObj.name} a ${tObj.distanceLabel}. ${tObj.note} Puedes viajar hacia él o abrir directamente sus observaciones infrarrojas de SPHEREx.`,
        action: null,
        role: 'Guía de exploración',
        avatarState: 'POINTING',
        pointDirection: 'left',
        epistemicCategory: 'Objetivo astronómico identificado',
      };
    }
    const planetName = selectedObject?.key || nearPlanet || focusedPlanet;
    if (planetName && INFO[planetName]) {
      return {
        reply: `Estás observando ${planetName} en el modelo tridimensional del Sistema Solar. ${INFO[planetName].intro} ${INFO[planetName].temperatura}`,
        action: null,
        role: 'Guía de exploración',
        avatarState: 'POINTING',
        pointDirection: 'left',
        epistemicCategory: 'Objeto de la escena 3D · Planeta',
      };
    }
    return {
      reply: `Te encuentras a bordo de la nave de exploración KRONOX${cockpitActive ? ' (en la cabina de mando en primera persona)' : ' navegando por el universo 3D'}. Desde aquí puedes pilotar libremente, seleccionar estrellas reales de la misión SPHEREx o pedirme que te lleve a cualquier destino.`,
      action: null,
      role: 'Guía de exploración',
      avatarState: 'TALKING',
      pointDirection: 'forward',
      epistemicCategory: 'Objeto de la escena 3D · Crucero de exploración',
    };
  }

  // =========================================================================
  // FUNCIÓN E/F — COMPAÑERA DE EXPEDICIÓN (Progreso y hallazgos personales)
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
          ? `¡Excelente trabajo! Llevas ${total} hallazgo(s) personal(es) registrado(s) en tu cuaderno de expedición (${byTarget} en ${currentTarget.name}). Recuerda que un hallazgo personal registra tus coordenadas WCS medidas para contrastarlas con el catálogo confirmado.`
          : `Aún no has guardado hallazgos personales en tu cuaderno. Cuando estés observando una imagen en ${currentTarget.name}, entra en la etapa «Investigación», marca una fuente sobre el lienzo astronómico y guarda tu observación.`,
      action: missionOpen
        ? { type: 'OPEN_MISSION_STAGE', targetKey: currentTarget.key, stage: 'investigate' }
        : null,
      role: 'Compañera de expedición',
      avatarState: total > 0 ? 'SUCCESS' : 'EXPLAINING',
      pointDirection: 'left',
      epistemicCategory: 'Hallazgo personal del usuario · Bitácora de expedición',
    };
  }

  // Fallback contextual e inteligente
  return {
    reply: `Recibido, explorador. Actualmente nuestro objetivo de referencia es ${currentTarget.name} (${currentTarget.distanceLabel}, banda ${currentTarget.preferredBand}). Puedo llevarte a cualquier estrella de misión («Llévame a Barnard», «Visitar Epsilon Indi», «Ir a RW Aurigae»), consultar las fechas y bandas reales de SPHEREx, o darte pistas visuales para identificar fuentes.`,
    action: null,
    role: 'Inteligencia de a bordo',
    avatarState: 'TALKING',
    pointDirection: 'forward',
    epistemicCategory: 'Comunicación de puente de mando',
    isFallback: true,
  };
}

const CLIENT_AI_CACHE = new Map();
const ALLOWED_CLIENT_ACTIONS = new Set([
  'PLAY_SPHEREX_DOCUMENTARY',
  'PLAY_CINEMATIC_INTRO',
  'ENTER_COCKPIT',
  'SET_VIEW_MODE',
  'SET_OPTICAL_TELESCOPE',
  'OPEN_MISSION_SELECTOR',
  'TRAVEL_SPHEREX',
  'TRAVEL_PLANET',
  'TRAVEL_GALAXY',
  'OPEN_MISSION_STAGE',
  'OPEN_OBSERVATORY',
  'SELECT_OBJECT',
  'HIGHLIGHT_FIELD_REGION',
]);

/**
 * Valida que una acción emitida por Kronox IA pertenezca exclusivamente a la lista blanca
 * de comandos controlados del motor.
 */
export function validateKronoxAction(action) {
  if (!action || typeof action !== 'object') return null;
  const type = String(action.type || '').trim();
  if (!ALLOWED_CLIENT_ACTIONS.has(type)) return null;
  return action;
}

/**
 * Procesa una consulta combinando el motor determinista local (para órdenes de navegación,
 * consolas y preguntas científicas indexadas) con el servicio backend Gemini (/api/kronox-chat)
 * para preguntas abiertas o explicaciones dinámicas contextuales.
 */
export async function askKronoxDynamic(userQuery = '', context = {}, options = {}) {
  const deterministic = processKronoxQuery(userQuery, context);
  if (!deterministic.isFallback || deterministic.action) {
    return {
      ...deterministic,
      action: validateKronoxAction(deterministic.action),
      source: 'deterministic-engine',
    };
  }

  const cacheKey = `${normalizeText(userQuery)}::${context.focusedPlanet || context.nearPlanet || 'Tierra'}::${context.activeTargetKey || 'barnard'}`;
  if (CLIENT_AI_CACHE.has(cacheKey)) {
    return CLIENT_AI_CACHE.get(cacheKey);
  }

  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) {
    return { ...deterministic, source: 'deterministic-fallback' };
  }

  try {
    const baseUrl =
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
        ? import.meta.env.BASE_URL.replace(/\/$/, '')
        : '/KRONOX';
    const response = await fetchImpl(`${baseUrl}/api/kronox-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userQuery,
        context: {
          focusedPlanet: context.focusedPlanet || context.nearPlanet || 'Tierra',
          observationMode: context.observationMode || 'naked-eye',
          observationModeLabel: context.observationModeLabel || 'Simple vista (1×)',
          activeTargetKey: context.activeTargetKey || 'barnard',
          activeTargetName:
            (SPHEREX_TARGETS.find((t) => t.key === context.activeTargetKey) || SPHEREX_TARGETS[0])
              ?.name || 'Estrella de Barnard',
          activeStation: context.activeStation || 'Puente de mando',
          activeObjective: context.activeObjective || 'Exploración científica libre',
        },
      }),
    });

    if (response && response.ok) {
      const data = await response.json();
      if (data && data.ok && data.reply) {
        const result = {
          reply: data.reply,
          action: validateKronoxAction(data.action),
          role: data.role || 'Kronox IA · Astrofísica de a bordo',
          avatarState: data.avatarState || 'EXPLAINING',
          pointDirection: data.pointDirection || 'forward',
          epistemicCategory:
            data.epistemicCategory || 'Síntesis contextual asistida por Kronox IA',
          source: 'gemini-backend',
        };
        if (CLIENT_AI_CACHE.size >= 120) {
          const oldest = CLIENT_AI_CACHE.keys().next().value;
          if (oldest) CLIENT_AI_CACHE.delete(oldest);
        }
        CLIENT_AI_CACHE.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Si no hay red o el backend está inaccesible, degradar limpiamente al motor determinista
  }

  return {
    ...deterministic,
    source: 'deterministic-fallback',
  };
}

export const KRONOX_QUICK_PROMPTS = [
  { label: '¿Qué es el Proyecto Horizonte?', query: '¿Qué es el Proyecto Horizonte y la nave KRONOX?' },
  { label: '¿Qué es SPHEREx?', query: '¿Qué es SPHEREx?' },
  { label: '¿Qué es una banda infrarroja?', query: '¿Qué es una banda infrarroja?' },
  {label:'¿Qué representa este eje?',query:'¿Qué representa este eje?'},
  {label:'¿Qué puedo concluir de este pico?',query:'¿Qué puedo concluir de este pico?'},
  { label: '¿Qué estoy viendo?', query: '¿Qué estoy viendo?' },
  { label: 'Destinos disponibles', query: 'Muéstrame los destinos disponibles' },
  { label: 'Llévame a Barnard', query: 'Llévame a la estrella de Barnard' },
  { label: 'Visitar Epsilon Indi', query: 'Quiero visitar Epsilon Indi' },
  { label: 'Fechas SPHEREx', query: '¿En qué fechas se observó esta estrella y qué bandas hay?' },
  { label: 'Comparar épocas', query: 'Compara dos épocas de esta estrella' },
  { label: 'Dame una pista visual', query: 'Dame una pista para identificar el objeto' },
  { label: 'Categorías científicas', query: 'Explica las categorías entre candidato, hallazgo y confirmado' },
];
