import React, { useMemo, useState } from 'react';
import astralLogoUrl from '../assets/astral-sentinels-logo.jpg';

const DECK_MANUAL_DATA = [
  {
    code: 'C01',
    elevation: '+3.4 m',
    name: 'Puente de Mando y Astrogación',
    accent: '#38bdf8',
    summary:
      'Centro neurálgico de navegación interestelar, mando orbital y observación directa a través del mirador panorámico de proa.',
    stations: [
      'Sillón de Mando Central: Puesto principal del comandante frente al timón y telemetría de vuelo.',
      'Terminal de Astrogación (Babor): Selección de destinos planetarios, estelares y extragalácticos.',
      'Mesa de Misiones (Estribor): Acceso a campañas de investigación científica SPHEREx.',
      'Enlace KRONOX IA: Canal de consulta científica y diagnóstico de sistemas.',
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
      'Camarotes de Tripulación (HAB-01 a HAB-06): Seis cabinas individuales con literas integradas, escritorios y terminales personales.',
      'Comedor Circular y Dispensador Galley: Zona común de nutrición e hidratación isotónica.',
      'Bahía Biopónica (Popa): Cultivos hidropónicos multinivel con iluminación PAR para regeneración de O₂ y H₂O.',
      'Esclusa Radial EVA (Proa): Compuerta blindada de presurización y nichos de trajes Astral Sentinels.',
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
      'Laboratorio Espectral SPHEREx (Babor): Análisis de imágenes FITS y espectrometría infrarroja (0.75–5.0 μm) en 102 bandas.',
      'Banco Óptico Láser He-Ne (Estribor): Alineación interferométrica de frente de onda y colimación de espejos.',
      'Núcleo del Reactor Tokamak D-He³ (Popa): Confinamiento magnético toroidal con modos Nominal, Sobrecarga y Silencioso.',
      'Tanques Criogénicos MLI (Proa): Reserva de helio superfluido para enfriamiento pasivo de detectores a 42 K.',
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
      'Banco de Mantenimiento EVA: Estación de herramientas magnéticas, diagnóstico de trajes y calibración mecánica.',
      'Estiba de Contenedores ISO: Suministros de larga duración, repuestos ópticos y sondas auxiliares.',
    ],
  },
];

const INSTRUMENTS_MANUAL_DATA = [
  {
    title: 'Observatorio y Espectrómetro Infrarrojo SPHEREx',
    tag: '0.75 – 5.0 μm · 102 Bandas LVF',
    body: 'Utiliza Filtros Lineales Variables (LVF) sin partes móviles para obtener espectros de cada píxel del cielo. Permite identificar hielos de agua (H₂O a 3.05 μm), dióxido de carbono (CO₂ a 4.27 μm), monóxido de carbono e hidrocarburos aromáticos policíclicos (PAH) en regiones de formación estelar y galaxias.',
  },
  {
    title: 'Telescopio Óptico Planetario de A Bordo',
    tag: 'Aumentos 10× · 50× · 150× · 300× · 500×',
    body: 'En el modo de Escala Física Real (1 unidad = 10⁶ km), los planetas distantes se observan como puntos de luz a simple vista. Al activar el telescopio óptico [T] desde el puente o exterior, el campo visual (FOV) se estrecha físicamente para resolver discos planetarios, anillos y las lunas galileanas.',
  },
  {
    title: 'Ascensor Central y Locomoción en Microgravedad',
    tag: 'Núcleo Vertical C01–C04 · 6-DOF',
    body: 'El ascensor central conecta físicamente las 4 cubiertas. Acércate a la puerta o consola de llamada, pulsa [E] y elige la planta ([1] a [4]). Dentro de la nave puedes alternar entre locomoción asistida y microgravedad libre [M], o sujetarte a los pasamanos amarillos con [H].',
  },
];

const CONTROLS_MANUAL_DATA = [
  { keys: 'W A S D', action: 'Desplazarse por las cubiertas / Levantarse del sillón de mando' },
  { keys: 'Mouse / L', action: 'Arrastrar para mirar o pulsar [L] para alternar vista libre con el ratón' },
  { keys: 'E', action: 'Interactuar con consolas, puertas de ascensor, objetos y sillón de mando' },
  { keys: '1 · 2 · 3 · 4', action: 'Seleccionar cubierta C01–C04 dentro del ascensor central' },
  { keys: 'V / C', action: 'Alternar vista Interior (1P / 3P) y vista Exterior de la nave (120 m)' },
  { keys: 'J', action: 'Abrir / cerrar Bitácora Personal (Diario y Manual)' },
  { keys: 'K', action: 'Abrir / cerrar ventana de Consulta a KRONOX IA' },
  { keys: 'T', action: 'Alternar aumentos del Telescopio Óptico (1× a 500×)' },
  { keys: 'Shift / Espacio / Ctrl', action: 'Impulso RCS / Ascender / Descender en microgravedad' },
  { keys: 'M / H', action: 'Alternar microgravedad Asistida/Libre y sujetarse a pasamanos' },
];

export default function AstronautPersonalHub({
  open = false,
  initialTab = 'journal',
  onClose,
  journal = {},
  inventoryState = { items: [], equippedToolId: null },
  recordedAiMessages = [],
  guideState = { step: 'free', active: false, completed: false },
  guideObjective = null,
  currentDeck = { code: 'C01', name: 'Puente de Mando' },
  currentBody = 'Tierra',
  heldToolId = null,
  onEquipTool,
  onInspectSampleWithAi,
  onRestartTutorial,
  onOpenSpherexLab,
  onSaveGame,
}) {
  const [activeTab, setActiveTab] = useState(
    initialTab === 'manual' ? 'manual' : 'journal',
  );
  const [manualSection, setManualSection] = useState('decks');

  React.useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab === 'manual' ? 'manual' : 'journal');
    }
  }, [open, initialTab]);

  const tutorialSteps = useMemo(() => {
    const step = guideState?.step || 'free';
    const isDone = Boolean(guideState?.completed || step === 'free');
    const stepOrder = ['stand_up', 'nav', 'elevator_c03', 'science', 'free'];
    const currentIdx = stepOrder.indexOf(step === 'bridge' ? 'nav' : step);
    return [
      {
        id: 'stand_up',
        label: '1. Levantarse del sillón de mando en el Puente (C01)',
        detail: 'Pulsa WASD o [E] desde la vista en 3ª persona en el puesto de mando central.',
        done: isDone || currentIdx > 0,
        active: !isDone && currentIdx === 0,
      },
      {
        id: 'nav',
        label: '2. Operar el Panel de Control y Navegación en C01',
        detail: 'Acércate a la consola iluminada en el Puente de Mando y pulsa [E].',
        done: isDone || currentIdx > 1,
        active: !isDone && currentIdx === 1,
      },
      {
        id: 'elevator_c03',
        label: '3. Descender en el Ascensor Central hacia la Cubierta C03',
        detail: 'Entra al ascensor en el centro de la cubierta, pulsa [E] y selecciona C03.',
        done: isDone || currentIdx > 2,
        active: !isDone && currentIdx === 2,
      },
      {
        id: 'science',
        label: '4. Visitar y activar el Laboratorio SPHEREx en C03',
        detail: 'Sigue la baliza hacia babor en la Cubierta C03 y opera el laboratorio con [E].',
        done: isDone,
        active: !isDone && currentIdx === 3,
      },
    ];
  }, [guideState]);

  if (!open) return null;

  return (
    <div
      className="kronoxPersonalHubBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sistema Personal del Astronauta: Diario y Manual"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="kronoxPersonalHubModal">
        {/* Cabecera institucional Astral Sentinels */}
        <header className="kronoxPersonalHubHeader">
          <div className="kronoxPersonalHubBrand">
            <img
              src={astralLogoUrl}
              alt="Emblema Astral Sentinels"
              className="kronoxPersonalHubLogo"
            />
            <div>
              <div className="kronoxPersonalHubKicker">
                DIVISIÓN CIENTÍFICA ASTRAL SENTINELS · KRONOX-1 (120 M)
              </div>
              <h2 className="kronoxPersonalHubTitle">
                TERMINAL PERSONAL DEL COMANDANTE
              </h2>
            </div>
          </div>

          <div className="kronoxPersonalHubTabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'journal'}
              className={`kronoxHubTabBtn ${activeTab === 'journal' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('journal')}
            >
              <span>📓</span> Diario de Misión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'manual'}
              className={`kronoxHubTabBtn ${activeTab === 'manual' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              <span>📘</span> Manual de la Nave
            </button>
          </div>

          <div className="kronoxPersonalHubHeaderActions">
            {onSaveGame && (
              <button
                type="button"
                className="kronoxHubActionBtn"
                onClick={onSaveGame}
                title="Guardar estado actual de la expedición"
              >
                💾 Guardar
              </button>
            )}
            <button
              type="button"
              className="kronoxHubCloseBtn"
              onClick={onClose}
              aria-label="Cerrar terminal personal"
            >
              ✕ ESC
            </button>
          </div>
        </header>

        {/* Barra de estado rápido de ubicación */}
        <div className="kronoxPersonalHubStatusBar">
          <span>
            <strong>UBICACIÓN:</strong> {currentDeck?.code || 'C01'} · {currentDeck?.name || 'Puente de Mando'}
          </span>
          <span>
            <strong>ÓRBITA / SECTOR:</strong> {currentBody || 'Tierra'}
          </span>
          <span>
            <strong>HERRAMIENTA EN MANO:</strong>{' '}
            {heldToolId === 'multitool'
              ? '🔧 Multiherramienta EVA'
              : heldToolId === 'scanner'
                ? '📡 Escáner Espectral IR'
                : heldToolId === 'optical-coupler'
                  ? '🔬 Acoplador Óptico He-Ne'
                  : 'Manos libres'}
          </span>
        </div>

        {/* CONTENIDO PESTAÑA 1: DIARIO DE MISIÓN */}
        {activeTab === 'journal' && (
          <div className="kronoxPersonalHubBody kronoxJournalGrid">
            <div className="kronoxHubColumn">
              {/* Tarjeta de Entrenamiento Operativo / Tutorial Progresivo */}
              <section className="kronoxHubCard">
                <div className="kronoxHubCardHeader">
                  <div>
                    <span className="kronoxHubSectionBadge is-tutorial">PROTOCOLO DE ORIENTACIÓN</span>
                    <h3>Entrenamiento Operativo en la Nave</h3>
                  </div>
                  {onRestartTutorial && (
                    <button
                      type="button"
                      className="kronoxHubMiniBtn"
                      onClick={() => {
                        onRestartTutorial();
                        onClose?.();
                      }}
                    >
                      ↻ Reiniciar Tutorial
                    </button>
                  )}
                </div>
                {guideObjective && (
                  <div className="kronoxHubActiveObjectiveBanner">
                    <strong>OBJETIVO ACTIVO:</strong> {guideObjective}
                  </div>
                )}
                <div className="kronoxTutorialChecklist">
                  {tutorialSteps.map((st) => (
                    <div
                      key={st.id}
                      className={`kronoxTutorialStepRow ${st.done ? 'is-done' : ''} ${st.active ? 'is-active' : ''}`}
                    >
                      <span className="kronoxTutorialCheckIcon">
                        {st.done ? '✓' : st.active ? '◉' : '○'}
                      </span>
                      <div>
                        <div className="kronoxTutorialStepTitle">{st.label}</div>
                        <div className="kronoxTutorialStepDetail">{st.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Misiones completadas y objetos astronómicos */}
              <section className="kronoxHubCard">
                <div className="kronoxHubCardHeader">
                  <div>
                    <span className="kronoxHubSectionBadge">ARCHIVO DE EXPEDICIÓN</span>
                    <h3>Misiones y Descubrimientos Registrados</h3>
                  </div>
                  {onOpenSpherexLab && (
                    <button
                      type="button"
                      className="kronoxHubMiniBtn"
                      onClick={() => {
                        onClose?.();
                        onOpenSpherexLab();
                      }}
                    >
                      🔬 Abrir Lab SPHEREx
                    </button>
                  )}
                </div>

                <div className="kronoxHubMetricsRow">
                  <div className="kronoxHubMetricBox">
                    <span className="kronoxHubMetricVal">
                      {journal?.completedMissions?.length || 0}
                    </span>
                    <span className="kronoxHubMetricLbl">Misiones Completadas</span>
                  </div>
                  <div className="kronoxHubMetricBox">
                    <span className="kronoxHubMetricVal">
                      {journal?.investigatedObjects?.length || 0}
                    </span>
                    <span className="kronoxHubMetricLbl">Objetos Investigados</span>
                  </div>
                  <div className="kronoxHubMetricBox">
                    <span className="kronoxHubMetricVal">
                      {journal?.personalDiscoveries?.length || 0}
                    </span>
                    <span className="kronoxHubMetricLbl">Hallazgos Científicos</span>
                  </div>
                </div>

                {journal?.completedMissions?.length > 0 ? (
                  <ul className="kronoxHubCompactList">
                    {journal.completedMissions.slice(0, 6).map((m) => (
                      <li key={m.id}>
                        <span className="kronoxHubListDot">★</span>
                        <div>
                          <strong>{m.title}</strong>
                          <small>
                            Completada · {new Date(m.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="kronoxHubEmptyHint">
                    Aún no has cerrado misiones científicas. Visita el Laboratorio SPHEREx en la Cubierta C03 o la Mesa de Misiones en C01.
                  </p>
                )}

                {journal?.investigatedObjects?.length > 0 && (
                  <div className="kronoxHubChipCloud">
                    {journal.investigatedObjects.map((obj) => (
                      <span key={obj.key} className="kronoxHubObjectChip">
                        🪐 {obj.label || obj.key}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="kronoxHubColumn">
              {/* Registro de Comunicaciones de KRONOX IA */}
              <section className="kronoxHubCard">
                <div className="kronoxHubCardHeader">
                  <div>
                    <span className="kronoxHubSectionBadge is-ai">BITÁCORA DE VOZ E IA</span>
                    <h3>Mensajes Relevantes de KRONOX IA</h3>
                  </div>
                </div>
                {recordedAiMessages.length > 0 ? (
                  <div className="kronoxHubScrollList">
                    {recordedAiMessages.slice(0, 14).map((msg) => (
                      <div key={msg.id} className="kronoxHubAiLogItem">
                        <div className="kronoxHubAiLogMeta">
                          <span className={`kronoxHubCategoryTag is-${String(msg.category || 'narrativa').toLowerCase()}`}>
                            {msg.category || 'NARRATIVA'}
                          </span>
                          <time>
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </time>
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="kronoxHubEmptyHint">
                    Los diálogos narrativos, indicaciones del tutorial y respuestas de KRONOX IA quedarán registrados aquí automáticamente.
                  </p>
                )}
              </section>

              {/* Cronología de eventos recientes */}
              <section className="kronoxHubCard">
                <div className="kronoxHubCardHeader">
                  <div>
                    <span className="kronoxHubSectionBadge">REGISTRO CRONOLÓGICO</span>
                    <h3>Eventos Recientes de la Expedición</h3>
                  </div>
                </div>
                {journal?.activities?.length > 0 ? (
                  <div className="kronoxHubScrollList">
                    {journal.activities.slice(0, 12).map((act) => (
                      <div key={act.id} className="kronoxHubEventRow">
                        <span className="kronoxHubEventType">{act.type}</span>
                        <div>
                          <div className="kronoxHubEventTitle">{act.title}</div>
                          {act.detail && <div className="kronoxHubEventDetail">{act.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="kronoxHubEmptyHint">
                    Inicia tu recorrido por el Puente de Mando (C01) para registrar eventos en el diario.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}

        {/* CONTENIDO PESTAÑA 2: MANUAL DE LA NAVE */}
        {activeTab === 'manual' && (
          <div className="kronoxPersonalHubBody">
            <div className="kronoxManualSubnav">
              <button
                type="button"
                className={`kronoxManualSubBtn ${manualSection === 'decks' ? 'is-active' : ''}`}
                onClick={() => setManualSection('decks')}
              >
                🏢 Cubiertas de la Nave (C01–C04)
              </button>
              <button
                type="button"
                className={`kronoxManualSubBtn ${manualSection === 'instruments' ? 'is-active' : ''}`}
                onClick={() => setManualSection('instruments')}
              >
                🛰️ Instrumentos Científicos y Sistemas
              </button>
              <button
                type="button"
                className={`kronoxManualSubBtn ${manualSection === 'controls' ? 'is-active' : ''}`}
                onClick={() => setManualSection('controls')}
              >
                🎮 Controles de Exploración y Vuelo
              </button>
            </div>

            {manualSection === 'decks' && (
              <div className="kronoxManualDecksGrid">
                {DECK_MANUAL_DATA.map((deck) => (
                  <article
                    key={deck.code}
                    className="kronoxHubCard kronoxManualDeckCard"
                    style={{ borderTopColor: deck.accent }}
                  >
                    <div className="kronoxManualDeckTop">
                      <span className="kronoxManualDeckCode" style={{ background: deck.accent }}>
                        {deck.code}
                      </span>
                      <div>
                        <h3>{deck.name}</h3>
                        <small>Cota estructural: {deck.elevation}</small>
                      </div>
                    </div>
                    <p className="kronoxManualDeckSummary">{deck.summary}</p>
                    <ul className="kronoxManualStationList">
                      {deck.stations.map((st, idx) => (
                        <li key={idx}>{st}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}

            {manualSection === 'instruments' && (
              <div className="kronoxManualInstrumentsList">
                {INSTRUMENTS_MANUAL_DATA.map((inst, idx) => (
                  <article key={idx} className="kronoxHubCard">
                    <div className="kronoxHubCardHeader">
                      <div>
                        <span className="kronoxHubSectionBadge">{inst.tag}</span>
                        <h3>{inst.title}</h3>
                      </div>
                    </div>
                    <p className="kronoxManualDeckSummary">{inst.body}</p>
                  </article>
                ))}
              </div>
            )}

            {manualSection === 'controls' && (
              <div className="kronoxHubCard">
                <div className="kronoxHubCardHeader">
                  <div>
                    <span className="kronoxHubSectionBadge">REFERENCIA RÁPIDA</span>
                    <h3>Mapa de Controles del Astronauta y de la Nave</h3>
                  </div>
                </div>
                <div className="kronoxControlsTable">
                  {CONTROLS_MANUAL_DATA.map((row, idx) => (
                    <div key={idx} className="kronoxControlsRow">
                      <kbd className="kronoxControlKbd">{row.keys}</kbd>
                      <span>{row.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

