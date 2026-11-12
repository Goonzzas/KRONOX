/**
 * KRONOX Progressive Educational Campaign & Lore State.
 *
 * Implements the 7-level progressive scientific campaign and explorer profile:
 * - Level 0: Prólogo de Reparación Técnica (Cubierta 02 - Calibración Óptica).
 * - Level 1: Fundamentos de Navegación y Propulsión (Cubierta 01 - Timón).
 * - Level 2: Observación Planetaria y Escalas del Sistema Solar.
 * - Level 3: El Cinturón de Asteroides y la Población Menor.
 * - Level 4: Espectroscopía Infrarroja y Misión SPHEREx (102 Bandas).
 * - Level 5: Objetos Fríos, Enanas Marrones y Estrellas Cercanas.
 * - Level 6: Estructura de la Vía Láctea y Cartografía Galáctica.
 * - Level 7: Investigación Abierta y Ciencia Ciudadana.
 */

export const CAMPAIGN_LEVELS = Object.freeze([
  {
    level: 0,
    id: 'prologue',
    title: 'PRÓLOGO — CALIBRACIÓN DEL BANCO ÓPTICO',
    summary: 'Servicio técnico en microgravedad en la Cubierta 02 para reparar el acoplador óptico del sensor SPHEREx.',
    deckLocation: 'CUBIERTA 02 — CIENCIA E INVESTIGACIÓN',
    objective: 'Dirígete al banco óptico de la Cubierta 02, escanea la avería, sustituye el acoplador y calibra el bus.',
    learningGoal: 'Comprender la instrumentación astronómica criogénica y el funcionamiento del sensor de infrarrojo.',
  },
  {
    level: 1,
    id: 'level-01',
    title: 'NIVEL 1 — FUNDAMENTOS DE NAVEGACIÓN Y PROPULSIÓN',
    summary: 'Aprende a pilotar la nave de 120 metros en microgravedad, usar el timón, los propulsores RCS y estabilizar la nave.',
    deckLocation: 'CUBIERTA 01 — MANDO Y NAVEGACIÓN',
    objective: 'Toma el timón en el puente, ejecuta una maniobra de empuje planar y estabiliza los propulsores.',
    learningGoal: 'Dominar la inercia newtoniana en el vacío, el vector de cabeceo/guiñada y el frenado por contrapresión.',
  },
  {
    level: 2,
    id: 'level-02',
    title: 'NIVEL 2 — OBSERVACIÓN PLANETARIA Y ESCALAS FÍSICAS',
    summary: 'Identificación visual y espectral de los mundos del Sistema Solar a escala real 1:1.000.000 km.',
    deckLocation: 'CUBIERTA 01 / MIRADOR PANORÁMICO',
    objective: 'Apunta la retícula hacia Marte y Júpiter, observando la diferencia angular y distancia heliocéntrica.',
    learningGoal: 'Entender el tamaño físico de los planetas respecto a las vastas distancias interplanetarias en Unidades Astronómicas.',
  },
  {
    level: 3,
    id: 'level-03',
    title: 'NIVEL 3 — EL CINTURÓN DE ASTEROIDES Y DETRITOS',
    summary: 'Exploración de la distribución de asteroides entre 2.1 y 3.3 UA y los huecos de resonancia de Kirkwood.',
    deckLocation: 'CUBIERTA 02 — LABORATORIO DE CIENCIAS',
    objective: 'Identificar a Ceres y Vesta en la carta celeste y clasificar muestras asteroidales vs. meteoritos.',
    learningGoal: 'Diferenciar entre asteroide, meteoroide, meteoro y meteorito, reconociendo la perturbación gravitatoria de Júpiter.',
  },
  {
    level: 4,
    id: 'level-04',
    title: 'NIVEL 4 — ESPECTROSCOPÍA INFRARROJA NASA SPHEREx',
    summary: 'Análisis de cubos de datos FITS espectroscópicos en 102 canales infrarrojos entre 0.75 y 5.0 micrómetros.',
    deckLocation: 'CUBIERTA 02 — ARCHIVO ASTRONÓMICO',
    objective: 'Cargar la imagen de la Estrella de Barnard y contrastar la emisión visible con la banda de metano e hielo de agua.',
    learningGoal: 'Comprender por qué el infrarrojo permite atravesar el polvo cósmico e identificar moléculas clave para la vida.',
  },
  {
    level: 5,
    id: 'level-05',
    title: 'NIVEL 5 — OBJETOS FRÍOS Y ENANAS MARRONES',
    summary: 'Búsqueda e identificación de cuerpos subestelares hiperfríos con emisión casi nula en el espectro visible.',
    deckLocation: 'CUBIERTA 02 / CUBIERTA 01',
    objective: 'Localizar Epsilon Indi B y examinar la candidata hiperfría WISE 0855 en datos SPHEREx D2.',
    learningGoal: 'Identificar las clases espectrales L, T e Y y comprender la frontera entre planetas gigantes y estrellas fallidas.',
  },
  {
    level: 6,
    id: 'level-06',
    title: 'NIVEL 6 — LA VÍA LÁCTEA DESDE EL INTERIOR',
    summary: 'Cartografía del disco galáctico, el centro galáctico en Sagitario y las bandas de extinción de la Gran Grieta.',
    deckLocation: 'CUBIERTA 01 — TIMÓN Y NAVEGACIÓN GALÁCTICA',
    objective: 'Observar la concentración estelar en el ecuador galáctico y orientar la nave hacia el Centro Galáctico.',
    learningGoal: 'Visualizar nuestra posición periférica dentro del disco espiral de la galaxia y el efecto de la absorción por polvo interestelar.',
  },
  {
    level: 7,
    id: 'level-07',
    title: 'NIVEL 7 — INVESTIGACIÓN Y COLABORACIÓN',
    summary: 'Registro riguroso de hallazgos personales con estimación de incertidumbres y aportes a la ciencia ciudadana.',
    deckLocation: 'CUBIERTA 02 / MENÚ DE PAUSA',
    objective: 'Generar una observación documentando coordenadas, banda, fecha e incertidumbre formal.',
    learningGoal: 'Aprender las normas de reproducibilidad y rigor para compartir datos en la comunidad científica.',
  },
]);

const STORAGE_KEY_PROFILE = 'kronox-explorer-profile-v2';
const STORAGE_KEY_CAMPAIGN = 'kronox-campaign-progress-v2';

let inMemoryProfile = {
  alias: 'Explorador Horizonte',
  skillLevel: 'intermediate',
  registeredAt: Date.now(),
};

let inMemoryProgress = {
  currentLevelIndex: 0,
  currentLevelId: 'prologue',
  completedLevels: [],
  prologueRepaired: false,
  activeObjectiveText: CAMPAIGN_LEVELS[0].objective,
};

export function loadExplorerProfile() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return inMemoryProfile;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!raw) return inMemoryProfile;
    return JSON.parse(raw);
  } catch {
    return inMemoryProfile;
  }
}

export function saveExplorerProfile(profile) {
  inMemoryProfile = { ...inMemoryProfile, ...profile };
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(inMemoryProfile));
  } catch {
    // Ignore storage write error
  }
}

export function loadCampaignProgress() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return inMemoryProgress;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMPAIGN);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_CAMPAIGN, JSON.stringify(inMemoryProgress));
      return inMemoryProgress;
    }
    return JSON.parse(raw);
  } catch {
    return inMemoryProgress;
  }
}

export const getCampaignProgress = loadCampaignProgress;

export function saveCampaignProgress(progress) {
  inMemoryProgress = { ...inMemoryProgress, ...progress };
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CAMPAIGN, JSON.stringify(inMemoryProgress));
  } catch {
    // Ignore storage write error
  }
}

export function advanceCampaignLevel(completedLevelIndex) {
  const progress = loadCampaignProgress();
  if (!progress.completedLevels.includes(completedLevelIndex)) {
    progress.completedLevels.push(completedLevelIndex);
  }
  const nextIdx = Math.min(CAMPAIGN_LEVELS.length - 1, completedLevelIndex + 1);
  progress.currentLevelIndex = nextIdx;
  progress.currentLevelId = CAMPAIGN_LEVELS[nextIdx].id;
  progress.activeObjectiveText = CAMPAIGN_LEVELS[nextIdx].objective;
  saveCampaignProgress(progress);
  return progress;
}

export function completeCampaignLevel(levelIdOrIndex) {
  const progress = loadCampaignProgress();
  let idx = typeof levelIdOrIndex === 'number'
    ? levelIdOrIndex
    : CAMPAIGN_LEVELS.findIndex((l) => l.id === levelIdOrIndex);

  if (idx < 0) idx = 0;
  const levelId = CAMPAIGN_LEVELS[idx].id;

  if (!progress.completedLevels.includes(levelId)) {
    progress.completedLevels.push(levelId);
  }
  if (!progress.completedLevels.includes(idx)) {
    progress.completedLevels.push(idx);
  }
  if (levelId === 'prologue') {
    progress.prologueRepaired = true;
  }

  const nextIdx = Math.min(CAMPAIGN_LEVELS.length - 1, idx + 1);
  progress.currentLevelIndex = nextIdx;
  progress.currentLevelId = CAMPAIGN_LEVELS[nextIdx].id;
  progress.activeObjectiveText = CAMPAIGN_LEVELS[nextIdx].objective;

  saveCampaignProgress(progress);
  return progress;
}
