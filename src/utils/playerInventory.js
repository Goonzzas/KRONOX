/**
 * KRONOX Player Functional Inventory System.
 * Manages zero-G tools, EVA gear, spare components, and mission logs.
 */

export const INVENTORY_ITEMS = Object.freeze({
  MULTITOOL: {
    id: 'multitool',
    name: 'Multiherramienta de Plasma y Torque',
    category: 'Herramientas',
    icon: '🔧',
    description: 'Herramienta manual multifunción para desmontaje rápido, fijación y soldadura fría en microgravedad.',
    usableInRepair: true,
  },
  SCANNER: {
    id: 'scanner',
    name: 'Escáner Espectral Portátil',
    category: 'Instrumentación',
    icon: '📡',
    description: 'Diagnostica buses ópticos, frecuencias de resonancia y microfisuras en mamparos o circuitos.',
    usableInRepair: true,
  },
  EVA_TETHER: {
    id: 'eva-tether',
    name: 'Anclaje Magnético de Seguridad',
    category: 'Equipamiento EVA',
    icon: '🪢',
    description: 'Mosquetón con cable de aramida retráctil para fijar al astronauta a pasamanos y evitar derivas.',
    usableInRepair: false,
  },
  RCS_PACK: {
    id: 'rcs-pack',
    name: 'Mochila Propulsora Personal RCS',
    category: 'Equipamiento EVA',
    icon: '🚀',
    description: '6 micro-toberas de gas frío nitrógeno para impulsos tridimensionales controlados.',
    usableInRepair: false,
  },
  OPTICAL_COUPLER: {
    id: 'optical-coupler',
    name: 'Acoplador Óptico Cuántico de Repuesto',
    category: 'Repuestos',
    icon: '💎',
    description: 'Cristal de niobato de litio calibrado para restaurar la telemetría del sensor astronómico.',
    usableInRepair: true,
  },
  EXPEDITION_DATAPAD: {
    id: 'datapad',
    name: 'Terminal de Registro de Expedición',
    category: 'Registros',
    icon: '📋',
    description: 'Almacena bitácoras de misión, efemérides J2000.0 y anotaciones personales del explorador.',
    usableInRepair: false,
  },
});

export const INITIAL_INVENTORY_ITEMS = Object.freeze(Object.values(INVENTORY_ITEMS));

const STORAGE_KEY = 'kronox-player-inventory-v2';

let inMemoryInventory = [...INITIAL_INVENTORY_ITEMS];

export function loadPlayerInventory() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [...inMemoryInventory];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INVENTORY_ITEMS));
      return [...INITIAL_INVENTORY_ITEMS];
    }
    return JSON.parse(raw);
  } catch {
    return [...inMemoryInventory];
  }
}

export function savePlayerInventory(items) {
  inMemoryInventory = [...items];
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

export function addInventoryItem(item) {
  const current = loadPlayerInventory();
  if (!current.some((i) => i.id === item.id)) {
    current.push(item);
    savePlayerInventory(current);
  }
  return current;
}

export function removeInventoryItem(itemId) {
  const current = loadPlayerInventory().filter((i) => i.id !== itemId);
  savePlayerInventory(current);
  return current;
}

export function hasInventoryItem(itemId) {
  const current = loadPlayerInventory();
  return current.some((i) => i.id === itemId);
}

export function equipInventoryItem(itemId) {
  const current = loadPlayerInventory();
  const found = current.find((i) => i.id === itemId);
  if (found) {
    current.forEach((i) => { i.equipped = (i.id === itemId); });
    savePlayerInventory(current);
    return found;
  }
  return null;
}
