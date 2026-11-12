/**
 * KRONOX Scientific Video Game Achievements System.
 * 10 Rigorous scientific and exploration achievements.
 */

export const GAME_ACHIEVEMENTS = Object.freeze([
  {
    id: 'ACH_FIRST_STEPS_0G',
    title: 'Primeros Pasos en Microgravedad',
    icon: '🧑‍🚀',
    category: 'Vuelo y Movilidad',
    description: 'Completar con éxito la primera navegación tridimensional a través de las cubiertas de KRONOX.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_ONBOARD_TECH',
    title: 'Ingeniero de A Bordo',
    icon: '🔧',
    category: 'Ingeniería Espacial',
    description: 'Diagnosticar el fallo en el sensor SPHEREx de la Cubierta 02 y sustituir el acoplador óptico.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_ASTEROID_BELT',
    title: 'Explorador del Cinturón Principal',
    icon: '🪨',
    category: 'Astronomía Planetaria',
    description: 'Navegar la zona entre 2.1 y 3.3 UA e identificar los huecos de Kirkwood y a 1 Ceres.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_INFRARED_REVEAL',
    title: 'El Universo Invisible',
    icon: '🌈',
    category: 'Espectroscopía',
    description: 'Inspeccionar una fuente cósmica en 102 bandas espectrales con el telescopio criogénico SPHEREx.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_BROWN_DWARF',
    title: 'Cazador de Enanas Marrones',
    icon: '🪐',
    category: 'Astrofísica',
    description: 'Identificar una enana marrón fría (clase T o Y) usando las bandas infrarrojas de metano y vapor de agua.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_COSMIC_SCALE',
    title: 'Medir el Cosmos',
    icon: '📐',
    category: 'Astrometría',
    description: 'Calcular la distancia heliocéntrica y separación angular de dos cuerpos en Unidades Astronómicas.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_BARNARD_MOTION',
    title: 'La Estrella Veloz',
    icon: '⚡',
    category: 'Dinámica Estelar',
    description: 'Registrar el movimiento propio de 10.3 segundos de arco por año de la Estrella de Barnard.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_MILKY_WAY_CORE',
    title: 'Hacia el Corazón Galáctico',
    icon: '🌌',
    category: 'Estructura Galáctica',
    description: 'Orientar la nave hacia el Centro Galáctico en Sagitario a través de las bandas de polvo interestelar.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_RIGOROUS_OBSERVER',
    title: 'Observador Riguroso',
    icon: '📊',
    category: 'Metodología Científica',
    description: 'Guardar una observación astronómica que incluya incertidumbres fotométricas y astrométricas formales.',
    unlockedByDefault: false,
  },
  {
    id: 'ACH_CITIZEN_SCIENTIST',
    title: 'Científico Ciudadano',
    icon: '🌐',
    category: 'Comunidad',
    description: 'Generar un sobre estandarizado de observación para la red colaborativa de ciencia ciudadana.',
    unlockedByDefault: false,
  },
]);

const STORAGE_KEY = 'kronox-game-achievements-v2';

let inMemoryUnlocked = [];

export function loadUnlockedAchievements() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [...inMemoryUnlocked];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [...inMemoryUnlocked];
  } catch {
    return [...inMemoryUnlocked];
  }
}

export function unlockAchievement(achievementId) {
  const unlocked = loadUnlockedAchievements();
  if (!unlocked.includes(achievementId)) {
    unlocked.push(achievementId);
    inMemoryUnlocked = [...unlocked];
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
      } catch {
        // Ignore storage error
      }
    }
    return true; // Newly unlocked
  }
  return false;
}

export const unlockGameAchievement = unlockAchievement;

export function isGameAchievementUnlocked(achievementId) {
  const unlocked = loadUnlockedAchievements();
  return unlocked.includes(achievementId);
}

export function getGameAchievementsStatus() {
  const unlocked = loadUnlockedAchievements();
  return {
    totalCount: GAME_ACHIEVEMENTS.length,
    unlockedCount: unlocked.length,
    percentage: Math.round((unlocked.length / GAME_ACHIEVEMENTS.length) * 100),
    achievements: GAME_ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: unlocked.includes(a.id),
    })),
  };
}
