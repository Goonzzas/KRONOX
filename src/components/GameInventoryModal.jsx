import React, { useMemo, useState } from 'react';
import { CATALOG_INVENTORY_ITEMS } from '../utils/astronautInventory.js';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { OPTICAL_MAGNIFICATION_STEPS } from '../scene/astronomicalScaleEngine.js';
import ItemSvgIcon from './ItemSvgIcon.jsx';
import GalacticMapPanel from './GalacticMapPanel.jsx';

const DECK_MANUAL_DATA = [
  {
    code: 'C01',
    elevation: '+3.4 m',
    name: 'Puente de Mando y Astrogación',
    accent: '#38bdf8',
    summary:
      'Centro neurálgico de navegación interestelar, mando orbital y observación directa a través del mirador panorámico de proa.',
    stations: [
      'Timón de Mando Central: Puesto principal del comandante para vectorización y navegación.',
      'Consolas en Chevrón de Proa: Control de astrodinámica, propulsión y sensores ópticos.',
      'Enlace KRONOX IA (Babor): Terminal neural de consulta científica y diagnóstico de sistemas.',
      'Mesa Holográfica Táctica (Popa): Proyección orbital y selección de misiones SPHEREx.',
      'Ventanal Panorámico de Proa: Observación directa del cosmos y uso del telescopio óptico [T].',
    ],
  },
  {
    code: 'C02',
    elevation: '0.0 m',
    name: 'Anillo Habitacional, Biopónica y Esclusa EVA',
    accent: '#f59e0b',
    summary:
      'Cubierta dedicada a la vida a bordo, descanso de la tripulación, reciclado biológico de soporte vital y preparación extravehicular.',
    stations: [
      'Camarotes de Tripulación (HAB-01 a HAB-06): Seis cabinas individuales integradas.',
      'Comedor Circular y Dispensador Galley: Zona común de nutrición e hidratación isotónica.',
      'Bahía Biopónica (Popa): Cultivos hidropónicos multinivel para regeneración de O₂ y H₂O.',
      'Esclusa Radial EVA (Proa): Compuerta blindada de presurización y trajes Astral Sentinels.',
    ],
  },
  {
    code: 'C03',
    elevation: '-3.4 m',
    name: 'Laboratorio SPHEREx, Banco Óptico y Reactor',
    accent: '#fbbf24',
    summary:
      'Nivel científico y energético donde se procesan los espectros infrarrojos de la misión SPHEREx y opera el reactor de fusión.',
    stations: [
      'Laboratorio Espectral SPHEREx (Babor): Análisis de imágenes FITS y espectrometría infrarroja (0.75–5.0 μm).',
      'Banco Óptico Láser He-Ne (Estribor): Alineación interferométrica de frente de onda y colimación de espejos.',
      'Núcleo del Reactor Tokamak D-He³ (Popa): Confinamiento magnético toroidal con tres modos operativos.',
      'Tanques Criogénicos MLI (Proa): Reserva de helio superfluido para enfriamiento pasivo.',
    ],
  },
  {
    code: 'C04',
    elevation: '-6.8 m',
    name: 'Bodega Logística, Hangar y Mantenimiento EVA',
    accent: '#34d399',
    summary:
      'Cubierta industrial inferior para estiba de contenedores ISO, servicio del transbordador auxiliar y taller mecánico.',
    stations: [
      'Pórtico del Transbordador de Servicio (Proa): Bahía de apontaje con grúa puente desplegable.',
      'Banco de Mantenimiento EVA: Estación de herramientas magnéticas, diagnóstico y calibración mecánica.',
      'Estiba de Contenedores ISO: Suministros de larga duración, repuestos ópticos y sondas auxiliares.',
    ],
  },
];

const INSTRUMENTS_MANUAL_DATA = [
  {
    title: 'Observatorio y Espectrómetro Infrarrojo SPHEREx',
    tag: '0.75 – 5.0 μm · 102 Bandas LVF',
    body: 'Utiliza Filtros Lineales Variables (LVF) sin partes móviles para obtener espectros de cada píxel del cielo. Identifica hielos de agua (H₂O a 3.05 μm), dióxido de carbono (CO₂ a 4.27 μm), monóxido de carbono e hidrocarburos aromáticos policíclicos (PAH).',
  },
  {
    title: 'Telescopio Óptico Planetario de A Bordo',
    tag: 'Aumentos 10× · 50× · 150× · 300× · 500×',
    body: 'En Escala Física Real, los planetas distantes se observan como puntos de luz a simple vista. Al activar el telescopio óptico [T], el campo visual se estrecha físicamente para resolver discos planetarios, anillos y lunas.',
  },
  {
    title: 'Ascensor Central y Locomoción en Microgravedad',
    tag: 'Núcleo Vertical C01–C04 · 6-DOF',
    body: 'El ascensor central conecta las 4 cubiertas. Pulsa [E] frente a la puerta y elige el nivel ([1] a [4]). Alterna entre locomoción asistida y microgravedad libre con [M], o sujétate a pasamanos con [H].',
  },
];

const CONTROLS_MANUAL_DATA = [
  { keys: 'W A S D', action: 'Desplazarse por las cubiertas / Levantarse del sillón de mando' },
  { keys: 'Mouse', action: 'Orientar la mirada de cámara (1ª y 3ª persona)' },
  { keys: 'E', action: 'Interactuar con consolas, puertas de ascensor, objetos y sillón' },
  { keys: '1 · 2 · 3 · 4', action: 'Seleccionar cubierta C01–C04 dentro del ascensor central' },
  { keys: 'V / C', action: 'Alternar vista Cabina 1P / 3P y vista Exterior de la nave (120 m)' },
  { keys: 'I', action: 'Abrir / cerrar Inventario, Mapa galáctico, Misiones y Manual' },
  { keys: 'K', action: 'Abrir interfaz de KRONOX IA (Chat escrito y Micrófono)' },
  { keys: 'T', action: 'Alternar aumentos del Telescopio Óptico (1× a 500×)' },
  { keys: 'Shift / Espacio / Ctrl', action: 'Impulso RCS / Ascender / Descender en microgravedad' },
  { keys: 'M / H', action: 'Alternar microgravedad Asistida/Libre y sujetarse a pasamanos' },
];

const HUB_TABS = [
  { id: 'inventory', label: 'Inventario', icon: '🎒' },
  { id: 'map', label: 'Mapa galáctico', icon: '🌌' },
  { id: 'missions', label: 'Misiones', icon: '🎯' },
  { id: 'manual', label: 'Manual', icon: '📘' },
  { id: 'exploration', label: 'Exploración', icon: '🔭' },
  { id: 'systems', label: 'Sistemas', icon: '⚙️' },
];

const SHORT_ITEM_LABELS = {
  'astral-suit-mk4': 'Traje EVA',
  'command-keycard': 'Credencial',
  'dosimeter-ir': 'Dosímetro',
  'optical-coupler': 'Acoplador',
  multitool: 'Multiherr.',
  scanner: 'Escáner IR',
  'sample-bioponic-flora': 'Biomasa',
  'data-spherex-calibration': 'SPHEREx',
  'sample-cryo-he3': 'Helio-3',
  'eva-ration-pack': 'Ración EVA',
};

const TOTAL_SLOTS = 14;

export default function GameInventoryModal({
  open = false,
  initialTab = 'inventory',
  onClose,
  onTabChange,
  inventoryState,
  journal,
  findings = [],
  heldToolId = null,
  activeMissionId = 'barnard',
  activeObjective = '',
  currentDeck = { code: 'C01', name: 'Puente de Mando' },
  currentBody = 'Tierra',
  viewMode = 'cockpit',
  cabinFirstPerson = true,
  visualProfile = 'cinematic',
  scaleMode = 'visual',
  astronautSectorState = { microgravityMode: 'ASSISTED' },
  observationModeInfo = null,
  navigationScaleId = 'solar',
  selectedGalaxyKey = 'milky-way',
  onEquipTool,
  onInspectSampleWithAi,
  onUseInventoryItem,
  onSaveGame,
  onSelectScale,
  onActivateSceneMapView,
  onFocusPlanet,
  onTravelToPlanet,
  onTravelToSpherex,
  onFocusStar,
  onFocusGalaxy,
  onQuickTravel,
  onOpenSpherexObservatory,
  onOpenMissionSelector,
  onOpenPlanetInfo,
  onSetOpticalTelescope,
  onChangeCameraPerspective,
  onToggleVisualProfile,
  onToggleScaleMode,
  onToggleMicrogravityMode,
  onTransitToDeck,
  onRestartTutorial,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'inventory');
  const [manualSubTab, setManualSubTab] = useState('controls');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [selectedItemId, setSelectedItemId] = useState('multitool');

  React.useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  React.useEffect(() => {
    if (open) {
      onTabChange?.(activeTab);
    }
  }, [open, activeTab, onTabChange]);

  const inventoryItems = useMemo(() => {
    const inv = inventoryState?.inventory || inventoryState;
    const rawIds = Array.isArray(inv?.ownedIds)
      ? inv.ownedIds
      : Array.isArray(inv?.items)
        ? inv.items
            .filter((entry) => (typeof entry === 'string' ? true : entry?.owned !== false))
            .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
            .filter(Boolean)
        : [];
    const ownedSet = new Set(rawIds);
    const hasExplicitInventory = Array.isArray(inv?.ownedIds) || Array.isArray(inv?.items);
    const baseItems = CATALOG_INVENTORY_ITEMS.map((item) => ({
      ...item,
      shortName: item.shortName || SHORT_ITEM_LABELS[item.id] || item.name.split('(')[0].trim().slice(0, 14),
      owned: hasExplicitInventory ? ownedSet.has(item.id) : Boolean(item.defaultOwned),
      equipped: Boolean(item.toolId && heldToolId === item.toolId),
    })).filter((i) => i.owned);
    return baseItems;
  }, [inventoryState, heldToolId]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'Todos') return inventoryItems;
    if (categoryFilter === 'Herramientas') {
      return inventoryItems.filter(
        (i) =>
          Boolean(i.toolId) ||
          i.category === 'Herramientas Técnicas' ||
          i.category === 'Equipo' ||
          i.category === 'Instrumento',
      );
    }
    if (categoryFilter === 'Muestras') {
      return inventoryItems.filter(
        (i) =>
          i.category === 'Muestras Científicas' ||
          i.category === 'Muestra' ||
          i.category === 'Datos',
      );
    }
    return inventoryItems.filter(
      (i) =>
        i.category === 'Equipamiento EVA' ||
        i.category === 'Credenciales y Suministros' ||
        i.category === 'Acceso' ||
        i.category === 'Consumible',
    );
  }, [inventoryItems, categoryFilter]);

  const slotsGrid = useMemo(() => {
    const arr = Array.from({ length: TOTAL_SLOTS }, (_, idx) => filteredItems[idx] || null);
    return arr;
  }, [filteredItems]);

  const hotbarTools = useMemo(() => {
    return inventoryItems.filter((item) => Boolean(item.toolId)).slice(0, 6);
  }, [inventoryItems]);

  const selectedItem =
    inventoryItems.find((i) => i.id === selectedItemId) || filteredItems[0] || inventoryItems[0] || null;

  const activeMissionTarget =
    SPHEREX_TARGETS.find((t) => t.key === activeMissionId) || SPHEREX_TARGETS[0];

  const investigatedList = journal?.investigatedObjects || [];

  if (!open) return null;

  return (
    <div
      className="kronoxHubBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Inventario y Centro de Operaciones KRONOX"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="kronoxMinecraftHubModal">
        <header className="kronoxPersonalHubHeader">
          <div className="kronoxPersonalHubBrand">
            <div className="kronoxHubTitleBlock">
              <span className="kronoxPersonalHubKicker">
                EQUIPAMIENTO & OPERACIONES · {currentDeck.code} {currentDeck.name.toUpperCase()} · {currentBody.toUpperCase()}
              </span>
              <h2 className="kronoxPersonalHubTitle">CENTRO TÁCTICO KRONOX</h2>
            </div>
          </div>

          <nav className="kronoxPersonalHubTabs" role="tablist" aria-label="Categorías de inventario y operación">
            {HUB_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`kronoxHubTabBtn ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="kronoxPersonalHubHeaderActions">
            {onSaveGame && (
              <button type="button" className="kronoxHubActionBtn" onClick={onSaveGame}>
                💾 Guardar
              </button>
            )}
            <button type="button" className="kronoxHubCloseBtn" onClick={onClose}>
              ✕ ESC
            </button>
          </div>
        </header>

        <div className="kronoxPersonalHubBody">
          {/* 1. INVENTARIO TIPO VIDEOJUEGO CON SLOTS Y CINTURÓN RÁPIDO */}
          {activeTab === 'inventory' && (
            <div className="kronoxMcInventoryLayout">
              <div className="kronoxMcGridColumn">
                <div className="kronoxMcFilterBar">
                  <div className="kronoxMcFilterGroup">
                    {['Todos', 'Herramientas', 'Muestras', 'Sistemas'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`kronoxMcFilterChip${categoryFilter === cat ? ' is-active' : ''}`}
                        onClick={() => setCategoryFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <span className="kronoxMcCapacityTag">
                    {inventoryItems.length} / {TOTAL_SLOTS} espacios ocupados
                  </span>
                </div>

                {/* Cuadrícula de slots (7x2 estilo videojuego) */}
                <div className="kronoxMcSlotGrid" role="grid" aria-label="Espacios de inventario">
                  {slotsGrid.map((item, idx) => {
                    const isSelected = Boolean(item && selectedItem?.id === item.id);
                    return (
                      <button
                        key={item ? item.id : `empty-${idx}`}
                        type="button"
                        disabled={!item}
                        className={`kronoxMcSlot${item ? ' is-filled' : ' is-empty'}${isSelected ? ' is-selected' : ''}${item?.equipped ? ' is-equipped' : ''}`}
                        onClick={() => item && setSelectedItemId(item.id)}
                        title={item ? `${item.name} (${item.category})` : 'Espacio vacío'}
                      >
                        {item ? (
                          <>
                            <span className="kronoxMcSlotIconWrap">
                              <ItemSvgIcon itemId={item.id} size={34} />
                            </span>
                            <span className="kronoxMcSlotLabel">{item.shortName || item.name}</span>
                            <span className="kronoxMcSlotQty">×1</span>
                            {item.equipped && <span className="kronoxMcEquippedDot" title="Equipado en mano" />}
                          </>
                        ) : (
                          <span className="kronoxMcSlotEmptyMark" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Cinturón de acceso rápido inferior (Hotbar) */}
                <div className="kronoxMcHotbarSection">
                  <span className="kronoxMcHotbarTitle">CINTURÓN DE EQUIPAMIENTO RÁPIDO (1P):</span>
                  <div className="kronoxMcHotbar">
                    <button
                      type="button"
                      className={`kronoxMcHotbarSlot${!heldToolId ? ' is-active' : ''}`}
                      onClick={() => onEquipTool?.(null)}
                      title="Guardar herramienta y usar manos libres"
                    >
                      <span className="kronoxMcHotbarNum">0</span>
                      <span className="kronoxMcHotbarHands">✋</span>
                      <small>Manos libres</small>
                    </button>
                    {hotbarTools.map((tool, index) => (
                      <button
                        key={tool.id}
                        type="button"
                        className={`kronoxMcHotbarSlot${heldToolId === tool.toolId ? ' is-active' : ''}`}
                        onClick={() => {
                          setSelectedItemId(tool.id);
                          onEquipTool?.(heldToolId === tool.toolId ? null : tool.toolId);
                        }}
                        title={`Equipar ${tool.name}`}
                      >
                        <span className="kronoxMcHotbarNum">{index + 1}</span>
                        <ItemSvgIcon itemId={tool.id} size={26} />
                        <small>{tool.shortName || tool.name}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Panel derecho: Inspector técnico del objeto seleccionado */}
              <aside className="kronoxMcInspector" aria-label="Detalle del objeto seleccionado">
                {selectedItem ? (
                  <>
                    <div className="kronoxMcInspectorPreview">
                      <ItemSvgIcon itemId={selectedItem.id} size={68} />
                    </div>
                    <span className="kronoxMcInspectorCat">{selectedItem.category.toUpperCase()}</span>
                    <h3 className="kronoxMcInspectorTitle">{selectedItem.name}</h3>
                    <p className="kronoxMcInspectorDesc">{selectedItem.description}</p>

                    {(selectedItem.scientificNote || selectedItem.specs) && (
                      <div className="kronoxMcInspectorNote">
                        <strong>Nota técnica / científica:</strong>
                        <p>{selectedItem.scientificNote || selectedItem.specs}</p>
                      </div>
                    )}

                    <div className="kronoxMcInspectorStats">
                      <div>
                        <span>Estado:</span>
                        <strong>{selectedItem.equipped ? 'Equipado en 1P' : 'Almacenado'}</strong>
                      </div>
                      <div>
                        <span>Origen:</span>
                        <strong>{selectedItem.deckOrigin || 'KRONOX'}</strong>
                      </div>
                    </div>

                    <div className="kronoxMcInspectorActions">
                      {selectedItem.toolId ? (
                        <button
                          type="button"
                          className="kronoxInvPrimaryBtn"
                          onClick={() =>
                            onEquipTool?.(selectedItem.equipped ? null : selectedItem.toolId)
                          }
                        >
                          {selectedItem.equipped ? 'Guardar herramienta' : '✋ Equipar en mano 1P'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="kronoxInvPrimaryBtn"
                          onClick={() => {
                            if (
                              selectedItem.category === 'Muestras Científicas' ||
                              selectedItem.category === 'Muestra' ||
                              selectedItem.category === 'Datos'
                            ) {
                              onInspectSampleWithAi?.(selectedItem);
                            } else {
                              onUseInventoryItem?.(selectedItem);
                            }
                          }}
                        >
                          {selectedItem.category === 'Muestras Científicas' ||
                          selectedItem.category === 'Muestra' ||
                          selectedItem.category === 'Datos'
                            ? '🤖 Analizar con KRONOX IA'
                            : '⚡ Usar / Verificar estado'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="kronoxHubMuted">Selecciona un objeto del inventario para ver sus especificaciones.</p>
                )}
              </aside>
            </div>
          )}

          {/* 2. MAPA GALÁCTICO INTERACTIVO CONECTADO AL MOTOR 3D */}
          {activeTab === 'map' && (
            <GalacticMapPanel
              navigationScaleId={navigationScaleId}
              selectedPlanet={currentBody}
              selectedGalaxyKey={selectedGalaxyKey}
              onSelectScale={onSelectScale}
              onActivateSceneMapView={onActivateSceneMapView}
              onFocusPlanet={onFocusPlanet}
              onTravelToPlanet={onTravelToPlanet}
              onTravelToSpherex={onTravelToSpherex}
              onFocusStar={onFocusStar}
              onFocusGalaxy={onFocusGalaxy}
              onQuickTravel={onQuickTravel}
              onCloseHub={onClose}
            />
          )}

          {/* 3. MISIONES SPHEREx Y OBJETIVOS OPERATIVOS */}
          {activeTab === 'missions' && (
            <div className="kronoxHubGridTwoCol">
              <section className="kronoxHubCard">
                <header className="kronoxHubCardHeader">
                  <span className="kronoxHubSectionBadge">MISIÓN ACTIVA</span>
                  <h3>{activeMissionTarget?.name || 'Estrella de Barnard'}</h3>
                </header>
                <p className="kronoxHubMuted">
                  {activeObjective || 'Explora las cubiertas de la nave o traza un salto hacia un objetivo infrarrojo SPHEREx.'}
                </p>
                <div className="kronoxMcInspectorActions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="kronoxInvPrimaryBtn"
                    onClick={() => {
                      onOpenSpherexObservatory?.(activeMissionTarget);
                      onClose?.();
                    }}
                  >
                    🔭 Abrir Observatorio SPHEREx
                  </button>
                  <button
                    type="button"
                    className="kronoxHubActionBtn"
                    onClick={() => {
                      onOpenMissionSelector?.();
                      onClose?.();
                    }}
                  >
                    🎯 Selector completo de misiones
                  </button>
                </div>

                <hr className="kronoxHubDivider" />
                <span className="kronoxHubSectionBadge is-amber">CAMPAÑAS DISPONIBLES</span>
                <div className="kronoxHubMissionList">
                  {SPHEREX_MISSION_TYPES.map((m) => (
                    <div key={m.key} className="kronoxHubMissionRow">
                      <div>
                        <strong>{m.title}</strong>
                        <small>{m.description || m.objective}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="kronoxHubCard">
                <header className="kronoxHubCardHeader">
                  <span className="kronoxHubSectionBadge">CATÁLOGO DE OBJETIVOS SPHEREx</span>
                  <h3>Destinos de Investigación</h3>
                </header>
                <div className="kronoxHubTargetScroll">
                  {SPHEREX_TARGETS.map((target) => {
                    const isActive = target.key === activeMissionId;
                    return (
                      <div key={target.key} className={`kronoxHubTargetItem${isActive ? ' is-current' : ''}`}>
                        <div>
                          <strong>{target.name}</strong>
                          <small>
                            {target.statusBadge || target.scienceTypeLabel || target.type || 'SPHEREx'} · {Number.isFinite(target.distanceLy) ? `${target.distanceLy} años luz` : 'Extragaláctico'}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="kronoxHubSmallBtn"
                          onClick={() => {
                            onTravelToSpherex?.(target);
                            onClose?.();
                          }}
                        >
                          🚀 Ir
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* 4. MANUAL DE LA NAVE */}
          {activeTab === 'manual' && (
            <div className="kronoxManualLayout">
              <div className="kronoxManualSubNav">
                <button
                  type="button"
                  className={manualSubTab === 'controls' ? 'is-active' : ''}
                  onClick={() => setManualSubTab('controls')}
                >
                  🎮 Controles y atajos
                </button>
                <button
                  type="button"
                  className={manualSubTab === 'decks' ? 'is-active' : ''}
                  onClick={() => setManualSubTab('decks')}
                >
                  🛸 Cubiertas de la nave (C01–C04)
                </button>
                <button
                  type="button"
                  className={manualSubTab === 'instruments' ? 'is-active' : ''}
                  onClick={() => setManualSubTab('instruments')}
                >
                  🔬 Sistemas e instrumentos
                </button>
              </div>

              {manualSubTab === 'controls' && (
                <div className="kronoxManualControlsGrid">
                  {CONTROLS_MANUAL_DATA.map((row) => (
                    <div key={row.keys} className="kronoxManualControlRow">
                      <kbd className="kronoxKeycap">{row.keys}</kbd>
                      <span>{row.action}</span>
                    </div>
                  ))}
                  {onRestartTutorial && (
                    <div className="kronoxManualControlFooter">
                      <button
                        type="button"
                        className="kronoxInvPrimaryBtn"
                        onClick={() => {
                          onClose?.();
                          onRestartTutorial();
                        }}
                      >
                        🧭 Iniciar tutorial interactivo guiado
                      </button>
                    </div>
                  )}
                </div>
              )}

              {manualSubTab === 'decks' && (
                <div className="kronoxManualDecksGrid">
                  {DECK_MANUAL_DATA.map((deck) => (
                    <article key={deck.code} className="kronoxManualDeckCard">
                      <div className="kronoxManualDeckHead">
                        <span className="kronoxManualDeckCode" style={{ borderColor: deck.accent, color: deck.accent }}>
                          {deck.code} · {deck.elevation}
                        </span>
                        <h4>{deck.name}</h4>
                      </div>
                      <p>{deck.summary}</p>
                      <ul>
                        {deck.stations.map((st, idx) => (
                          <li key={idx}>{st}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}

              {manualSubTab === 'instruments' && (
                <div className="kronoxManualInstrumentsGrid">
                  {INSTRUMENTS_MANUAL_DATA.map((inst) => (
                    <article key={inst.title} className="kronoxHubCard">
                      <span className="kronoxHubSectionBadge">{inst.tag}</span>
                      <h4>{inst.title}</h4>
                      <p>{inst.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. EXPLORACIÓN ASTRONÓMICA Y CUERPOS INVESTIGADOS */}
          {activeTab === 'exploration' && (
            <div className="kronoxHubGridTwoCol">
              <section className="kronoxHubCard">
                <header className="kronoxHubCardHeader">
                  <span className="kronoxHubSectionBadge">INSTRUMENTO ÓPTICO DE PROA</span>
                  <h3>Telescopio Planetario (FOV Físico)</h3>
                </header>
                <p className="kronoxHubMuted">
                  Objetivo óptico actual: <strong>{observationModeInfo?.opticalTargetBody || currentBody}</strong> · Aumento: <strong>{observationModeInfo?.opticalMagnification || 1}×</strong>
                </p>
                <div className="kronoxOpticsMagGrid">
                  <button
                    type="button"
                    className={`kronoxMcFilterChip${(observationModeInfo?.opticalMagnification || 1) <= 1 ? ' is-active' : ''}`}
                    onClick={() => onSetOpticalTelescope?.(false, 1)}
                  >
                    Simple vista 1×
                  </button>
                  {OPTICAL_MAGNIFICATION_STEPS.filter((m) => m > 1).map((mag) => (
                    <button
                      key={mag}
                      type="button"
                      className={`kronoxMcFilterChip${observationModeInfo?.opticalMagnification === mag ? ' is-active' : ''}`}
                      onClick={() => {
                        onSetOpticalTelescope?.(true, mag);
                        onClose?.();
                      }}
                    >
                      {mag}×
                    </button>
                  ))}
                </div>

                <hr className="kronoxHubDivider" />
                <span className="kronoxHubSectionBadge is-green">HALLAZGOS ESPECTRALES ({findings.length})</span>
                {findings.length > 0 ? (
                  <ul className="kronoxHubSimpleList">
                    {findings.slice(-6).map((fItem, i) => (
                      <li key={fItem?.id || i}>
                        <strong>{fItem?.targetName || fItem?.title || fItem?.object || fItem?.targetKey || 'Espectro'}</strong> — {fItem?.summary || fItem?.detail || fItem?.molecule || 'Firma infrarroja registrada'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="kronoxHubMuted">Realiza capturas en el Observatorio SPHEREx (C03 o desde el mapa) para registrar hallazgos.</p>
                )}
              </section>

              <section className="kronoxHubCard">
                <header className="kronoxHubCardHeader">
                  <span className="kronoxHubSectionBadge">ASTROS INVESTIGADOS ({investigatedList.length})</span>
                  <h3>Registro de Observación</h3>
                </header>
                {investigatedList.length > 0 ? (
                  <div className="kronoxHubTargetScroll">
                    {investigatedList.map((entry, idx) => {
                      const entryKey = typeof entry === 'string' ? entry : (entry?.key || entry?.label || `obj-${idx}`);
                      const entryLabel = typeof entry === 'string' ? entry : (entry?.label || entry?.key || 'Objetivo');
                      const entryKind = typeof entry === 'object' && entry?.kind ? entry.kind : null;
                      return (
                        <div key={entryKey} className="kronoxHubTargetItem">
                          <div>
                            <strong>✦ {entryLabel}</strong>
                            {entryKind && <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.72 }}>{entryKind}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="kronoxHubSmallBtn"
                              onClick={() => {
                                onFocusPlanet?.(entryLabel);
                                onClose?.();
                              }}
                            >
                              Enfocar
                            </button>
                            <button
                              type="button"
                              className="kronoxHubSmallBtn"
                              onClick={() => {
                                onOpenPlanetInfo?.(entryLabel);
                              }}
                            >
                              Dossier
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="kronoxHubMuted">Enfoca un planeta o estrella desde el puente, vista exterior o Mapa Galáctico para documentar tus observaciones.</p>
                )}
              </section>
            </div>
          )}

          {/* 6. SISTEMAS DE LA NAVE, CÁMARAS Y ASCENSOR */}
          {activeTab === 'systems' && (
            <div className="kronoxHubGridTwoCol">
              <section className="kronoxHubCard">
                <header className="kronoxHubCardHeader">
                  <span className="kronoxHubSectionBadge">PERSPECTIVA DE CÁMARA</span>
                  <h3>Modos de Visión y Perfil Visual</h3>
                </header>
                <div className="kronoxSystemsBtnRow">
                  <button
                    type="button"
                    className={`kronoxMcFilterChip${viewMode === 'cockpit' && cabinFirstPerson ? ' is-active' : ''}`}
                    onClick={() => onChangeCameraPerspective?.('1p')}
                  >
                    Cabina 1P
                  </button>
                  <button
                    type="button"
                    className={`kronoxMcFilterChip${viewMode === 'cockpit' && !cabinFirstPerson ? ' is-active' : ''}`}
                    onClick={() => onChangeCameraPerspective?.('3p')}
                  >
                    Astronauta 3P
                  </button>
                  <button
                    type="button"
                    className={`kronoxMcFilterChip${viewMode === 'exterior' ? ' is-active' : ''}`}
                    onClick={() => onChangeCameraPerspective?.('exterior')}
                  >
                    Exterior Nave 120 m
                  </button>
                </div>

                <hr className="kronoxHubDivider" />
                <div className="kronoxSystemsBtnRow">
                  <button type="button" className="kronoxHubActionBtn" onClick={onToggleVisualProfile}>
                    🌌 Perfil visual: {visualProfile === 'scientific' ? 'Científico estricto' : 'Cinematográfico'}
                  </button>
                  <button type="button" className="kronoxHubActionBtn" onClick={onToggleScaleMode}>
                    📏 Escala espacial: {scaleMode === 'real' ? 'Física Real' : 'Cartográfica'}
                  </button>
                  <button type="button" className="kronoxHubActionBtn" onClick={onToggleMicrogravityMode}>
                    🧭 Microgravedad: {astronautSectorState.microgravityMode === 'FREE' ? 'Libre 6-DOF [M]' : 'Asistida'}
                  </button>
                </div>
              </section>

              <section className="kronoxHubCard">
                <header className="kronoxHubCardHeader">
                  <span className="kronoxHubSectionBadge">TRÁNSITO INTERNO DE CUBIERTAS</span>
                  <h3>Ascensor Central Aurora-120</h3>
                </header>
                <p className="kronoxHubMuted">Ubicación actual: <strong>{currentDeck.code} · {currentDeck.name}</strong></p>
                <div className="kronoxSystemsDeckGrid">
                  {DECK_MANUAL_DATA.map((deck, idx) => {
                    const deckId = `deck-0${idx + 1}`;
                    const isHere = currentDeck.code === deck.code;
                    return (
                      <button
                        key={deck.code}
                        type="button"
                        className={`kronoxSystemDeckBtn${isHere ? ' is-active' : ''}`}
                        onClick={() => {
                          onTransitToDeck?.(deckId);
                          onClose?.();
                        }}
                      >
                        <strong>{deck.code}</strong>
                        <span>{deck.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
