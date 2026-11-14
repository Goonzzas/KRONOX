/**
 * KRONOX — SISTEMA DE INVENTARIO PERSONAL Y REGISTRO DE BITÁCORA DEL ASTRONAUTA
 *
 * Gestiona el equipamiento EVA Astral Sentinels, herramientas físicas 3D recogibles,
 * muestras científicas recolectadas en las cubiertas C01..C04 y el historial de
 * mensajes relevantes de KRONOX IA.
 */

const INVENTORY_STORAGE_KEY = 'kronox_astronaut_inventory_v1';
const AI_LOG_STORAGE_KEY = 'kronox_ai_message_log_v1';

export const CATALOG_INVENTORY_ITEMS = Object.freeze([
  {
    id: 'astral-suit-mk4',
    name: 'Traje Presurizado Astral Sentinels Mk-IV',
    category: 'Equipamiento EVA',
    deckOrigin: 'C02 · Esclusa EVA',
    icon: '🧑‍🚀',
    equippable: false,
    alwaysEquipped: true,
    defaultOwned: true,
    specs: 'Torso rígido HUT Ti-Al · Visor solar Au · Micro-RCS N₂ · Emblema oficial Astral Sentinels',
    description:
      'Unidad de movilidad extravehicular e intravehicular asignada a la división científica Astral Sentinels. Incluye soporte vital autónomo PLSS de 8 horas y propulsores de microgravedad.',
  },
  {
    id: 'command-keycard',
    name: 'Credencial de Mando KRX-120 (Nivel Alfa)',
    category: 'Credenciales y Suministros',
    deckOrigin: 'C01 · Puente de Mando',
    icon: '🪪',
    equippable: false,
    alwaysEquipped: true,
    defaultOwned: true,
    specs: 'Cifrado cuántico SHA-3 · Autorización C01–C04 y Telemetría IRSA/SPHEREx',
    description:
      'Llave criptográfica institucional que habilita el control de astrogación en el Puente (C01), el ascensor central, los laboratorios de la Cubierta C03 y la grúa del hangar C04.',
  },
  {
    id: 'dosimeter-ir',
    name: 'Dosímetro Cuántico y Biomonitor EVA',
    category: 'Equipamiento EVA',
    deckOrigin: 'C01 · Puente de Mando',
    icon: '📟',
    equippable: false,
    alwaysEquipped: true,
    defaultOwned: true,
    specs: 'Dosis acumulada: 0.14 mSv · Presión interna: 101.3 kPa · O₂: 99.4%',
    description:
      'Sensor personal integrado en el módulo pectoral DCM del traje. Registra el flujo de partículas solares y la estabilidad fisiológica en microgravedad.',
  },
  {
    id: 'optical-coupler',
    name: 'Acoplador Interferométrico He-Ne (λ/40)',
    category: 'Herramientas Técnicas',
    deckOrigin: 'C03 · Banco Óptico Láser',
    icon: '🔬',
    equippable: true,
    toolId: 'optical-coupler',
    defaultOwned: true,
    specs: 'Tolerancia de frente de onda < 12 nm · Acoplamiento magnético de muñeca',
    description:
      'Prisma colimador de referencia utilizado para alinear el interferómetro del Banco Óptico en la Cubierta C03 y verificar la PSF del telescopio.',
  },
  {
    id: 'multitool',
    name: 'Multiherramienta EVA de Torque Magnético',
    category: 'Herramientas Técnicas',
    deckOrigin: 'C04 · Banco de Mantenimiento',
    icon: '🔧',
    equippable: true,
    toolId: 'multitool',
    defaultOwned: false,
    specs: 'Par calibrado 5–120 N·m · Punta inductiva de plasma frío',
    description:
      'Herramienta de mantenimiento aeroespacial recogida en la Cubierta C04. Permite intervenir paneles de servicio, válvulas criogénicas y anclajes del hangar.',
  },
  {
    id: 'scanner',
    name: 'Escáner Espectral Infrarrojo Portátil',
    category: 'Herramientas Técnicas',
    deckOrigin: 'C03 · Laboratorio / Banco Óptico',
    icon: '📡',
    equippable: true,
    toolId: 'scanner',
    defaultOwned: false,
    specs: 'Rango 0.75–5.0 μm · Diagnóstico térmico y de fugas criogénicas',
    description:
      'Analizador de mano recogido en la Cubierta C03. Muestra lecturas en tiempo real de emisión infrarroja y estado de colimación de sensores.',
  },
  {
    id: 'sample-bioponic-flora',
    name: 'Cápsula de Biomasa Hidropónica (Lote BIO-04)',
    category: 'Muestras Científicas',
    deckOrigin: 'C02 · Bahía Biopónica',
    icon: '🌱',
    equippable: false,
    defaultOwned: false,
    specs: 'Tasa fotosintética PAR 99.2% · Intercambio O₂/CO₂ nominal',
    description:
      'Muestra biológica sellada extraída de las bandejas hidropónicas multinivel de la Cubierta C02 para control de soporte vital de ciclo cerrado.',
  },
  {
    id: 'data-spherex-calibration',
    name: 'Matriz Fotométrica SPHEREx LVF (102 Bandas)',
    category: 'Muestras Científicas',
    deckOrigin: 'C03 · Laboratorio SPHEREx',
    icon: '💾',
    equippable: false,
    defaultOwned: false,
    specs: 'Bandas 0.75–5.0 μm · Detector HgCdTe a 42.0 K · Época J2000.0',
    description:
      'Unidad de memoria óptica con curvas de transmisión de filtros lineales variables (LVF) y recortes FITS validados de la misión SPHEREx.',
  },
  {
    id: 'sample-cryo-he3',
    name: 'Testigo Criogénico de Helio-3 (Reactor Aurora)',
    category: 'Muestras Científicas',
    deckOrigin: 'C03 · Núcleo del Reactor Tokamak',
    icon: '⚛️',
    equippable: false,
    defaultOwned: false,
    specs: 'Pureza isotópica 99.98% · Confinamiento magnético toroidal',
    description:
      'Registro diagnóstico de plasma D-He³ y refrigerante criogénico obtenido en el anillo de confinamiento magnético de la Cubierta C03.',
  },
  {
    id: 'eva-ration-pack',
    name: 'Suministro Isotónico y Ración Termoestabilizada',
    category: 'Credenciales y Suministros',
    deckOrigin: 'C02 · Comedor / Taquilla C02',
    icon: '🧪',
    equippable: false,
    defaultOwned: false,
    specs: '2,850 kcal · Electrolitos para microgravedad · Envase magnético',
    description:
      'Ración nutricional de expedición recolectada en la Cubierta Habitacional C02 para travesías prolongadas de observación.',
  },
]);

function readJsonStorage(key, fallback) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadAstronautInventory() {
  const defaultOwnedIds = CATALOG_INVENTORY_ITEMS.filter((i) => i.defaultOwned).map((i) => i.id);
  const stored = readJsonStorage(INVENTORY_STORAGE_KEY, null);
  const ownedSet = new Set([
    ...defaultOwnedIds,
    ...(Array.isArray(stored?.ownedIds) ? stored.ownedIds : []),
  ]);
  const acquiredAt = stored?.acquiredAt && typeof stored.acquiredAt === 'object' ? stored.acquiredAt : {};
  const equippedToolId = stored?.equippedToolId || null;

  return {
    ownedIds: Array.from(ownedSet),
    acquiredAt,
    equippedToolId,
    items: CATALOG_INVENTORY_ITEMS.map((item) => ({
      ...item,
      owned: ownedSet.has(item.id),
      acquiredTimestamp: acquiredAt[item.id] || null,
      equipped: item.alwaysEquipped || (item.toolId && item.toolId === equippedToolId),
    })),
  };
}

export function grantInventoryItem(itemId) {
  const catalogEntry = CATALOG_INVENTORY_ITEMS.find((i) => i.id === itemId);
  if (!catalogEntry) return { added: false, item: null, inventory: loadAstronautInventory() };
  const current = loadAstronautInventory();
  const alreadyOwned = current.ownedIds.includes(itemId);
  const nextOwned = alreadyOwned ? current.ownedIds : [...current.ownedIds, itemId];
  const nextAcquired = {
    ...current.acquiredAt,
    [itemId]: current.acquiredAt[itemId] || new Date().toISOString(),
  };
  const nextEquipped =
    catalogEntry.equippable && catalogEntry.toolId ? catalogEntry.toolId : current.equippedToolId;

  writeJsonStorage(INVENTORY_STORAGE_KEY, {
    ownedIds: nextOwned,
    acquiredAt: nextAcquired,
    equippedToolId: nextEquipped,
  });

  const updated = loadAstronautInventory();
  const item = updated.items.find((i) => i.id === itemId) || catalogEntry;
  return { added: !alreadyOwned, item, inventory: updated };
}

export function setEquippedInventoryTool(toolId) {
  const current = loadAstronautInventory();
  const nextEquipped = current.equippedToolId === toolId ? null : toolId || null;
  writeJsonStorage(INVENTORY_STORAGE_KEY, {
    ownedIds: current.ownedIds,
    acquiredAt: current.acquiredAt,
    equippedToolId: nextEquipped,
  });
  return loadAstronautInventory();
}

export function loadRecordedAiMessages() {
  const list = readJsonStorage(AI_LOG_STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function recordAiMessageToLog({ text, category = 'NARRATIVA', intent = 'explanation' } = {}) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return loadRecordedAiMessages();
  const current = loadRecordedAiMessages();
  if (current[0]?.text === cleanText) return current;
  const entry = {
    id: `ai-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: cleanText,
    category,
    intent,
    timestamp: new Date().toISOString(),
  };
  const next = [entry, ...current].slice(0, 40);
  writeJsonStorage(AI_LOG_STORAGE_KEY, next);
  return next;
}

