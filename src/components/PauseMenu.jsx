import React, { useState, useEffect } from 'react';
import { loadFindings, deleteFinding } from '../utils/findingsStorage.js';
import {
  loadExpeditionJournal,
  saveGameState,
  loadGameState,
} from '../utils/expeditionJournal.js';
import {
  COMMUNITY_MODULE_STATUS,
  COMMUNITY_ENTITY_SCHEMAS,
  PRIVACY_LEVELS,
  buildShareableObservationEnvelope,
} from '../utils/communitySchema.js';
import { getGameAchievementsStatus } from '../utils/gameAchievements.js';
import {
  AudioSettingsGroup,
  SubtitleSettingsGroup,
} from './AudioSubtitleSettingsControls.jsx';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  GRAPHICS_PRESET_OPTIONS,
  RENDER_SCALE_OPTIONS,
  SHADOW_QUALITY_OPTIONS,
  VISUAL_EFFECTS_OPTIONS,
  FPS_LIMIT_OPTIONS,
  normalizeGraphicsPreset,
} from '../scene/graphicsConfig.js';

const PAUSE_SECTIONS = [
  { id: 'continue', label: '1. Continuar', subtitle: 'Reanudar exploración espacial' },
  { id: 'save', label: '2. Guardar partida', subtitle: 'Estado de nave y efemérides' },
  { id: 'observations', label: '3. Mis observaciones', subtitle: 'Registro científico personal' },
  { id: 'journal', label: '4. Diario de exploración', subtitle: 'Registro de misiones y logros' },
  { id: 'community', label: '5. Comunidad', subtitle: 'Arquitectura de ciencia ciudadana' },
  { id: 'settings', label: '6. Ajustes', subtitle: 'Gráficos, audio, interfaz y voz' },
  { id: 'controls', label: '7. Controles', subtitle: 'Mapa de mando y navegación' },
  { id: 'main-menu', label: '8. Volver al menú principal', subtitle: 'Salir a la portada de KRONOX' },
];

const SETTINGS_TABS = [
  { id: 'graphics', label: 'Gráficos' },
  { id: 'audio', label: 'Audio' },
  { id: 'controls', label: 'Controles' },
  { id: 'accessibility', label: 'Accesibilidad' },
  { id: 'interface', label: 'Interfaz' },
  { id: 'voice', label: 'Voz y Kronox IA' },
];

export default function PauseMenu({
  open,
  initialSection = 'continue',
  onClose,
  onReturnToMainMenu,
  currentBody = 'Tierra',
  cameraView = 'Cabina 1P',
  observationMode = 'naked-eye',
  opticalMagnification = 1,
  scaleMode = 'real',
  onToggleScaleMode,
  visualProfile = 'cinematic',
  onToggleVisualProfile,
  viewMode = 'cockpit',
  cabinFirstPerson = true,
  navigationActive = false,
  onChangeViewMode,
  onToggleCabinPerspective,
  onResetExteriorView,
  onSetOpticalTelescope,
  microgravityMode = 'ASSISTED',
  onChangeMicrogravityMode,
  activeMissionId = null,
  activeObjective = null,
  voiceMuted = false,
  onToggleVoiceMute,
  onTestVoice,
  onRepeatLastKronoxMessage,
  gameSettings = {},
  onUpdateGameSettings,
  graphicsRuntime = null,
  onOpenMissionTarget,
}) {
  const [activeSection, setActiveSection] = useState(initialSection || 'continue');
  const [activeSettingsTab, setActiveSettingsTab] = useState('graphics');
  const [journalSubTab, setJournalSubTab] = useState('bitacora');
  const [achievementsStatus, setAchievementsStatus] = useState(() => getGameAchievementsStatus());
  const [findings, setFindings] = useState([]);
  const [journal, setJournal] = useState(() => loadExpeditionJournal());
  const [lastSave, setLastSave] = useState(() => loadGameState());
  const [saveFeedback, setSaveFeedback] = useState('');
  const [exportedEnvelope, setExportedEnvelope] = useState(null);
  const [confirmMainMenu, setConfirmMainMenu] = useState(false);

  useEffect(() => {
    if (open) {
      setFindings(loadFindings());
      setJournal(loadExpeditionJournal());
      setAchievementsStatus(getGameAchievementsStatus());
      setLastSave(loadGameState());
      setSaveFeedback('');
      setExportedEnvelope(null);
      setConfirmMainMenu(false);
      if (initialSection) {
        setActiveSection(initialSection);
      }
    }
  }, [open, initialSection]);

  if (!open) return null;

  const handleSelectSection = (sectionId) => {
    if (sectionId === 'continue') {
      onClose?.();
      return;
    }
    if (sectionId === 'main-menu') {
      setConfirmMainMenu(true);
      return;
    }
    setConfirmMainMenu(false);
    setActiveSection(sectionId);
  };

  const handleSaveGame = () => {
    const saved = saveGameState({
      currentBody,
      cameraView,
      observationMode,
      opticalMagnification,
      scaleMode,
      activeMissionId,
      activeObjective,
      settings: gameSettings,
    });
    setLastSave(saved);
    setJournal(loadExpeditionJournal());
    setSaveFeedback(
      `Partida guardada correctamente (${new Date(saved.savedAt).toLocaleTimeString('es-ES')}).`,
    );
  };

  const handleDeleteFinding = (id) => {
    const next = deleteFinding(id);
    setFindings(next);
  };

  const handlePreviewShareEnvelope = (finding) => {
    try {
      const env = buildShareableObservationEnvelope(finding);
      setExportedEnvelope(env);
    } catch {
      setExportedEnvelope(null);
    }
  };

  const updateSetting = (key, value) => {
    onUpdateGameSettings?.({
      ...gameSettings,
      [key]: value,
    });
  };

  return (
    <div
      className="kronox-pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de pausa de KRONOX"
    >
      <div className="kronox-pause-shell">
        <aside className="kronox-pause-sidebar">
          <div className="kronox-pause-brand">
            <span className="kronox-pause-kicker">CRUCERO CIENTÍFICO · 120 M</span>
            <h2>KRONOX</h2>
            <p>
              Ubicación: <strong>{currentBody}</strong> · Época J2000.0
            </p>
          </div>

          <nav className="kronox-pause-nav" aria-label="Secciones del menú de pausa">
            {PAUSE_SECTIONS.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  className={`kronox-pause-nav-btn${isActive ? ' is-active' : ''}${sec.id === 'continue' ? ' is-primary-resume' : ''}`}
                  onClick={() => handleSelectSection(sec.id)}
                >
                  <span className="kronox-pause-nav-title">{sec.label}</span>
                  <span className="kronox-pause-nav-sub">{sec.subtitle}</span>
                </button>
              );
            })}
          </nav>

          <div className="kronox-pause-footer-hint">
            Pulsa <kbd>ESC</kbd> en cualquier momento para volver a la simulación espacial.
          </div>
        </aside>

        <main className="kronox-pause-content">
          {activeSection === 'save' && (
            <section className="kronox-pause-panel">
              <header className="kronox-pause-header">
                <span className="kronox-pause-eyebrow">PERSISTENCIA DE EXPEDICIÓN</span>
                <h3>Guardar partida</h3>
                <p>
                  Almacena el estado actual de la nave KRONOX (120 m), tu posición orbital en el
                  Sistema Solar, el modo de observación instrumental y la configuración de cabina.
                </p>
              </header>

              <div className="kronox-pause-card-grid">
                <div className="kronox-pause-card">
                  <h4>Estado actual en curso</h4>
                  <ul className="kronox-pause-meta-list">
                    <li>
                      <span>Cuerpo de referencia:</span>
                      <strong>{currentBody}</strong>
                    </li>
                    <li>
                      <span>Modo de cámara:</span>
                      <strong>{cameraView}</strong>
                    </li>
                    <li>
                      <span>Instrumento óptico:</span>
                      <strong>
                        {opticalMagnification > 1
                          ? `Telescopio Óptico (${opticalMagnification}×)`
                          : 'Simple vista (1×)'}
                      </strong>
                    </li>
                    <li>
                      <span>Escala espacial:</span>
                      <strong>
                        {scaleMode === 'real'
                          ? 'Física Real (J2000.0)'
                          : 'Visual de Navegación'}
                      </strong>
                    </li>
                    <li>
                      <span>Observaciones guardadas:</span>
                      <strong>{findings.length}</strong>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="kronox-pause-action-btn"
                    onClick={handleSaveGame}
                  >
                    Guardar estado de partida ahora
                  </button>
                  {saveFeedback && (
                    <div className="kronox-pause-save-feedback" role="status">
                      {saveFeedback}
                    </div>
                  )}
                </div>

                <div className="kronox-pause-card">
                  <h4>Último punto de guardado</h4>
                  {lastSave ? (
                    <ul className="kronox-pause-meta-list">
                      <li>
                        <span>Fecha UTC:</span>
                        <strong>{new Date(lastSave.savedAt).toLocaleString('es-ES')}</strong>
                      </li>
                      <li>
                        <span>Ubicación:</span>
                        <strong>{lastSave.currentBody}</strong>
                      </li>
                      <li>
                        <span>Cámara:</span>
                        <strong>{lastSave.cameraView}</strong>
                      </li>
                      <li>
                        <span>Aumento óptico:</span>
                        <strong>{lastSave.opticalMagnification || 1}×</strong>
                      </li>
                      <li>
                        <span>Época astronómica:</span>
                        <strong>{lastSave.epoch || 'J2000.0'}</strong>
                      </li>
                    </ul>
                  ) : (
                    <p className="kronox-pause-empty-text">
                      Aún no existe un punto de guardado manual registrado en esta sesión.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'observations' && (
            <section className="kronox-pause-panel">
              <header className="kronox-pause-header">
                <span className="kronox-pause-eyebrow">REGISTRO ASTROMÉTRICO PERSONAL</span>
                <h3>Mis observaciones ({findings.length})</h3>
                <p>
                  Cada observación conserva sus metadatos WCS (RA/Dec ICRS), banda espectral,
                  instrumento y estado epistémico diferenciado entre anotación personal y validación
                  científica.
                </p>
              </header>

              {findings.length === 0 ? (
                <div className="kronox-pause-card">
                  <p className="kronox-pause-empty-text">
                    Todavía no has registrado observaciones personales. Acércate a la consola de
                    Ciencia SPHEREx en la cabina, inspecciona un recorte FITS real y guarda una
                    anotación astrométrica.
                  </p>
                </div>
              ) : (
                <div className="kronox-pause-obs-list">
                  {findings.map((obs) => (
                    <article key={obs.id} className="kronox-pause-obs-item">
                      <div className="kronox-pause-obs-top">
                        <div>
                          <h4>
                            {typeof obs.astronomicalObject === 'object'
                              ? obs.astronomicalObject?.name || obs.targetName
                              : obs.astronomicalObject || obs.targetName}
                          </h4>
                          <span className="kronox-pause-obs-sub">
                            ID: {obs.id} · Propietario: {obs.ownerId || 'local_explorer'}
                          </span>
                        </div>
                        <span className="kronox-epistemic-badge is-personal">
                          {obs.epistemicLabel ||
                            'Anotación personal del explorador (No validada oficialmente)'}
                        </span>
                      </div>

                      <div className="kronox-pause-obs-meta">
                        <span>
                          <strong>Coordenadas ICRS:</strong>{' '}
                          {obs.ra !== null && obs.ra !== undefined && obs.dec !== null && obs.dec !== undefined
                            ? `RA ${Number(obs.ra).toFixed(5)}° · Dec ${Number(obs.dec).toFixed(5)}°`
                            : `Píxel (${obs.pixelX ?? '—'}, ${obs.pixelY ?? '—'})`}
                        </span>
                        <span>
                          <strong>Instrumento:</strong> {obs.instrument || 'NASA SPHEREx'}
                        </span>
                        <span>
                          <strong>Banda espectral:</strong> {obs.spectralBand || obs.band || 'IR'}
                        </span>
                        <span>
                          <strong>Fecha obs.:</strong>{' '}
                          {typeof obs.observationDate === 'object'
                            ? obs.observationDate?.primary || obs.frameDate1 || 'MJD'
                            : obs.observationDate || obs.frameDate1 || 'MJD'}
                        </span>
                      </div>

                      <p className="kronox-pause-obs-desc">{obs.userNotes || obs.description}</p>

                      <div className="kronox-pause-obs-actions">
                        {onOpenMissionTarget && obs.targetKey && (
                          <button
                            type="button"
                            className="kronox-pause-secondary-btn"
                            onClick={() => {
                              onOpenMissionTarget(obs.targetKey);
                              onClose?.();
                            }}
                          >
                            Inspeccionar FITS en laboratorio
                          </button>
                        )}
                        <button
                          type="button"
                          className="kronox-pause-secondary-btn"
                          onClick={() => handlePreviewShareEnvelope(obs)}
                        >
                          Generar paquete de ciencia ciudadana
                        </button>
                        <button
                          type="button"
                          className="kronox-pause-danger-btn"
                          onClick={() => handleDeleteFinding(obs.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {exportedEnvelope && (
                <div className="kronox-pause-card" style={{ marginTop: 14 }}>
                  <h4>Paquete verificable para Ciencia Ciudadana (JSON Schema v1.0)</h4>
                  <pre className="kronox-pause-code">
                    {JSON.stringify(exportedEnvelope, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          )}

          {activeSection === 'journal' && (
            <section className="kronox-pause-panel">
              <header className="kronox-pause-header">
                <span className="kronox-pause-eyebrow">EXPEDICIÓN Y PROGRESO DE A BORDO</span>
                <h3>Diario de exploración y logros</h3>
                <p>
                  Registro cronológico de tu expedición y progreso en los objetivos científicos a bordo de KRONOX.
                </p>
              </header>

              <div className="kronox-settings-tabs" role="tablist" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className={`kronox-settings-tab-btn${journalSubTab === 'bitacora' ? ' is-active' : ''}`}
                  onClick={() => setJournalSubTab('bitacora')}
                >
                  Registro de Misiones
                </button>
                <button
                  type="button"
                  className={`kronox-settings-tab-btn${journalSubTab === 'logros' ? ' is-active' : ''}`}
                  onClick={() => setJournalSubTab('logros')}
                >
                  Logros Científicos ({achievementsStatus.unlockedCount}/{achievementsStatus.totalCount})
                </button>
              </div>

              {journalSubTab === 'bitacora' && (
                <>
                  <div className="kronox-pause-stats-row">
                    <div className="kronox-pause-stat-box">
                      <span className="kronox-pause-stat-num">
                        {journal.completedMissions.length}
                      </span>
                      <span className="kronox-pause-stat-label">Misiones completadas</span>
                    </div>
                    <div className="kronox-pause-stat-box">
                      <span className="kronox-pause-stat-num">
                        {journal.investigatedObjects.length}
                      </span>
                      <span className="kronox-pause-stat-label">Objetos investigados</span>
                    </div>
                    <div className="kronox-pause-stat-box">
                      <span className="kronox-pause-stat-num">{findings.length}</span>
                      <span className="kronox-pause-stat-label">Observaciones guardadas</span>
                    </div>
                    <div className="kronox-pause-stat-box">
                      <span className="kronox-pause-stat-num">
                        {journal.personalDiscoveries.length + findings.length}
                      </span>
                      <span className="kronox-pause-stat-label">Anotaciones personales</span>
                    </div>
                  </div>

                  <div className="kronox-pause-card-grid">
                    <div className="kronox-pause-card">
                      <h4>Objetos astronómicos investigados</h4>
                      {journal.investigatedObjects.length === 0 ? (
                        <p className="kronox-pause-empty-text">
                          Selecciona planetas, estrellas del catálogo o destinos SPHEREx para poblar tu
                          registro cartográfico.
                        </p>
                      ) : (
                        <ul className="kronox-pause-meta-list">
                          {journal.investigatedObjects.slice(0, 10).map((obj) => (
                            <li key={obj.key}>
                              <span>{obj.label}</span>
                              <strong>{obj.kind}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="kronox-pause-card">
                      <h4>Actividad reciente</h4>
                      {journal.activities.length === 0 ? (
                        <p className="kronox-pause-empty-text">
                          Sin entradas recientes registradas.
                        </p>
                      ) : (
                        <ul className="kronox-pause-activity-list">
                          {journal.activities.slice(0, 8).map((act) => (
                            <li key={act.id}>
                              <div className="kronox-pause-act-title">{act.title}</div>
                              {act.detail && (
                                <div className="kronox-pause-act-detail">{act.detail}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}

              {journalSubTab === 'logros' && (
                <div className="kronox-pause-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4>Logros de Exploración y Ciencia</h4>
                    <span className="kronox-badge">
                      {achievementsStatus.unlockedCount} / {achievementsStatus.totalCount} ({achievementsStatus.percentage}%)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {achievementsStatus.achievements.map((ach) => (
                      <div
                        key={ach.id}
                        style={{
                          background: ach.unlocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.5)',
                          border: `1px solid ${ach.unlocked ? 'rgba(52, 211, 153, 0.5)' : 'rgba(71, 85, 105, 0.3)'}`,
                          borderRadius: 8,
                          padding: 10,
                          opacity: ach.unlocked ? 1 : 0.65,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>{ach.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: ach.unlocked ? '#a7f3d0' : '#e2e8f0', fontSize: '0.9rem' }}>
                              {ach.title}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{ach.category}</span>
                          </div>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.35 }}>
                          {ach.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activeSection === 'community' && (
            <section className="kronox-pause-panel">
              <header className="kronox-pause-header">
                <span className="kronox-pause-eyebrow">{COMMUNITY_MODULE_STATUS.label}</span>
                <h3>Red de Ciencia Ciudadana KRONOX</h3>
                <p>{COMMUNITY_MODULE_STATUS.summary}</p>
              </header>

              <div className="kronox-pause-card" style={{ marginBottom: 14 }}>
                <h4>Garantía de rigor epistémico y privacidad</h4>
                <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.55, margin: 0 }}>
                  En KRONOX las observaciones personales son{' '}
                  <strong>{PRIVACY_LEVELS.PRIVATE_BY_DEFAULT.label}</strong> y se almacenan con la
                  etiqueta explícita <code>PERSONAL_ANNOTATION</code>. Ninguna marca de usuario se
                  presenta como descubrimiento oficial hasta superar revisión astrométrica frente a
                  catálogos Gaia DR3, CatWISE y archivos FITS originales de NASA/IPAC IRSA.
                </p>
              </div>

              <div className="kronox-pause-schema-grid">
                {Object.values(COMMUNITY_ENTITY_SCHEMAS).map((schema) => (
                  <div key={schema.entity} className="kronox-pause-schema-card">
                    <div className="kronox-pause-schema-head">
                      <strong>{schema.title}</strong>
                      <span
                        className={`kronox-schema-badge ${schema.status === 'READY_SCHEMA' ? 'is-ready' : 'is-planned'}`}
                      >
                        {schema.status === 'READY_SCHEMA'
                          ? 'Esquema de datos activo'
                          : 'Módulo de red planificado'}
                      </span>
                    </div>
                    <p>{schema.description}</p>
                    <div className="kronox-pause-schema-fields">
                      {schema.fields.map((f) => (
                        <code key={f}>{f}</code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'settings' && (
            <section className="kronox-pause-panel">
              <header className="kronox-pause-header">
                <span className="kronox-pause-eyebrow">CONFIGURACIÓN DEL SISTEMA</span>
                <h3>Ajustes</h3>
                <p>Configura el motor visual, los instrumentos, el audio y el asistente Kronox IA.</p>
              </header>

              <div className="kronox-settings-tabs" role="tablist">
                {SETTINGS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSettingsTab === tab.id}
                    className={`kronox-settings-tab-btn${activeSettingsTab === tab.id ? ' is-active' : ''}`}
                    onClick={() => setActiveSettingsTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="kronox-pause-card">
                {activeSettingsTab === 'graphics' && (() => {
                  const gfx = { ...DEFAULT_GRAPHICS_SETTINGS, ...(gameSettings.graphics || {}) };
                  const activePreset = normalizeGraphicsPreset(gfx.preset, 'auto');
                  const eff = graphicsRuntime?.effective;
                  const hw = graphicsRuntime?.hardware;
                  const updateGfx = (patch) =>
                    updateSetting('graphics', {
                      ...gfx,
                      ...patch,
                    });
                  return (
                    <div className="kronox-settings-group">
                      <div className="kronox-setting-row">
                        <div>
                          <strong>Calidad gráfica del motor 3D</strong>
                          <p>
                            Se aplica en tiempo real sin reiniciar.
                            {hw ? ` Equipo detectado: ${hw.renderer ? hw.renderer.slice(0, 42) : `${hw.cores || '?'} núcleos`} · Perfil sugerido: ${eff?.presetLabel || hw.autoDetectedPreset}.` : ''}
                          </p>
                        </div>
                        <div className="kronox-pause-seg-group" role="group" aria-label="Calidad gráfica">
                          {GRAPHICS_PRESET_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              className={`kronox-pause-seg-btn${activePreset === opt.id ? ' is-active' : ''}`}
                              onClick={() =>
                                updateGfx({
                                  preset: opt.id,
                                  renderScale: null,
                                  shadowQuality: null,
                                  visualEffects: null,
                                  fpsLimit: null,
                                })
                              }
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="kronox-setting-row">
                        <div>
                          <strong>Resolución de renderizado</strong>
                          <p>Escala interna del lienzo WebGL ({eff ? `${Math.round(eff.renderScale * 100)}% · DPR ${eff.effectivePixelRatio.toFixed(2)}` : 'automática'}).</p>
                        </div>
                        <select
                          aria-label="Resolución de renderizado"
                          className="kronox-setting-select"
                          value={gfx.renderScale == null ? 'auto' : String(gfx.renderScale)}
                          onChange={(e) =>
                            updateGfx({
                              renderScale: e.target.value === 'auto' ? null : Number(e.target.value),
                            })
                          }
                        >
                          <option value="auto">Automática ({eff ? `${Math.round(eff.renderScale * 100)}%` : 'perfil'})</option>
                          {RENDER_SCALE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={String(opt.id)}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="kronox-setting-row">
                        <div>
                          <strong>Calidad de sombras</strong>
                          <p>Sombras direccionales en casco y cubiertas ({eff?.shadowsEnabled ? `${eff.shadowMapSize}px` : 'desactivadas'}).</p>
                        </div>
                        <select
                          aria-label="Calidad de sombras"
                          className="kronox-setting-select"
                          value={gfx.shadowQuality ?? 'auto'}
                          onChange={(e) =>
                            updateGfx({
                              shadowQuality: e.target.value === 'auto' ? null : e.target.value,
                            })
                          }
                        >
                          <option value="auto">Automática (según calidad)</option>
                          {SHADOW_QUALITY_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="kronox-setting-row">
                        <div>
                          <strong>Efectos visuales</strong>
                          <p>Densidad estelar, atmósferas planetarias, reflejos IBL y propulsores.</p>
                        </div>
                        <select
                          aria-label="Efectos visuales"
                          className="kronox-setting-select"
                          value={gfx.visualEffects ?? 'auto'}
                          onChange={(e) =>
                            updateGfx({
                              visualEffects: e.target.value === 'auto' ? null : e.target.value,
                            })
                          }
                        >
                          <option value="auto">Automática (según calidad)</option>
                          {VISUAL_EFFECTS_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="kronox-setting-row">
                        <div>
                          <strong>Límite de FPS</strong>
                          <p>Limita los cuadros por segundo para mantener temperaturas estables y menor consumo.</p>
                        </div>
                        <select
                          aria-label="Límite de FPS"
                          className="kronox-setting-select"
                          value={gfx.fpsLimit == null ? 'auto' : String(gfx.fpsLimit)}
                          onChange={(e) =>
                            updateGfx({
                              fpsLimit: e.target.value === 'auto' ? null : Number(e.target.value),
                            })
                          }
                        >
                          <option value="auto">Automático ({eff?.fpsLimit ? `${eff.fpsLimit} FPS` : 'Ilimitado'})</option>
                          {FPS_LIMIT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={String(opt.id)}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="kronox-setting-row">
                        <div>
                          <strong>Modo de firmamento y cielo estelar</strong>
                          <p>
                            Alterna entre Modo Científico (brillo estelar estricto según magnitud aparente
                            física y menor dispersión) y Modo Cinematográfico (mayor riqueza visual de la
                            Vía Láctea, polvo oscuro y nebulosas).
                          </p>
                        </div>
                        <button
                          type="button"
                          className="kronox-pause-secondary-btn"
                          onClick={onToggleVisualProfile}
                        >
                          {visualProfile === 'scientific'
                            ? '✦ Cielo: Científico (Activo)'
                            : '✦ Cielo: Cinematográfico (Activo)'}
                        </button>
                      </div>
                      <div className="kronox-setting-row">
                        <div>
                          <strong>Escala astronómica del Sistema Solar</strong>
                          <p>
                            En modo Física Real (J2000.0), los planetas lejanos conservan su tamaño
                            angular real (θ = 2·arctan(R/D)) y requieren el Telescopio Óptico [T]
                            para resolver su disco.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="kronox-pause-secondary-btn"
                          onClick={onToggleScaleMode}
                        >
                          {scaleMode === 'real'
                            ? 'Física Real J2000.0 (Activo)'
                            : 'Escala Visual Comprimida'}
                        </button>
                      </div>
                      <div className="kronox-setting-row">
                        <div>
                          <strong>Mapeo tonal cinematográfico</strong>
                          <p>ACES Filmic con iluminación física atenuada y contraste día/noche real.</p>
                        </div>
                        <span className="kronox-setting-pill">ACES Filmic · Activo</span>
                      </div>
                    </div>
                  );
                })()}

                {activeSettingsTab === 'audio' && (
                  <AudioSettingsGroup
                    gameSettings={gameSettings}
                    onUpdateSetting={updateSetting}
                    voiceMuted={voiceMuted}
                    onToggleVoiceMute={onToggleVoiceMute}
                    onTestVoice={onTestVoice}
                  />
                )}

                {activeSettingsTab === 'controls' && (
                  <div className="kronox-settings-group">
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Perspectiva de cámara 3D [C / V]</strong>
                        <p>Cambia entre vista en primera persona (ojos del astronauta), tercera persona EVA o inspección exterior de 120 m.</p>
                      </div>
                      <div className="kronox-pause-seg-group" role="group" aria-label="Perspectiva de cámara">
                        <button
                          type="button"
                          className={`kronox-pause-seg-btn${viewMode === 'cockpit' && cabinFirstPerson ? ' is-active' : ''}`}
                          disabled={navigationActive}
                          onClick={() => {
                            onChangeViewMode?.('cockpit');
                            onToggleCabinPerspective?.(true);
                          }}
                        >
                          Cabina 1P
                        </button>
                        <button
                          type="button"
                          className={`kronox-pause-seg-btn${viewMode === 'cockpit' && !cabinFirstPerson ? ' is-active' : ''}`}
                          disabled={navigationActive}
                          onClick={() => {
                            onChangeViewMode?.('cockpit');
                            onToggleCabinPerspective?.(false);
                          }}
                        >
                          3P EVA [V]
                        </button>
                        <button
                          type="button"
                          className={`kronox-pause-seg-btn${viewMode === 'exterior' ? ' is-active' : ''}`}
                          disabled={navigationActive}
                          onClick={() => onChangeViewMode?.('exterior')}
                        >
                          Exterior [C]
                        </button>
                        {viewMode === 'exterior' && onResetExteriorView && (
                          <button
                            type="button"
                            className="kronox-pause-seg-btn"
                            disabled={navigationActive}
                            onClick={() => onResetExteriorView?.()}
                          >
                            Restablecer [R]
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Telescopio Óptico de a bordo [T]</strong>
                        <p>Alterna entre observación a simple vista (1×) y aumentos ópticos reales en el firmamento.</p>
                      </div>
                      <div className="kronox-pause-seg-group" role="group" aria-label="Aumentos del telescopio">
                        {[1, 10, 50, 150, 300, 500].map((mag) => (
                          <button
                            key={mag}
                            type="button"
                            className={`kronox-pause-seg-btn${opticalMagnification === mag ? ' is-active' : ''}`}
                            onClick={() => onSetOpticalTelescope?.(mag > 1, mag)}
                          >
                            {mag === 1 ? '1× Libre' : `${mag}×`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Sensibilidad de rotación en cabina y órbita exterior</strong>
                        <p>Ajusta la respuesta de cámara al arrastrar o mirar alrededor.</p>
                      </div>
                      <select
                        value={gameSettings.cameraSensitivity || 'normal'}
                        onChange={(e) => updateSetting('cameraSensitivity', e.target.value)}
                        className="kronox-setting-select"
                      >
                        <option value="low">Suave (Cinemática)</option>
                        <option value="normal">Estándar (1.0×)</option>
                        <option value="high">Rápida (1.4×)</option>
                      </select>
                    </div>
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Distancia de cámara en 3ª Persona [V]</strong>
                        <p>Regula la separación del encuadre orbital tras el hombro del astronauta.</p>
                      </div>
                      <select
                        value={gameSettings.cameraDistance3P || 'normal'}
                        onChange={(e) => updateSetting('cameraDistance3P', e.target.value)}
                        className="kronox-setting-select"
                      >
                        <option value="compact">Compacta (1.7 m)</option>
                        <option value="normal">Estándar (2.3 m)</option>
                        <option value="wide">Amplia (3.1 m)</option>
                      </select>
                    </div>
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Modo de física en microgravedad [M]</strong>
                        <p>Asistida aplica frenado suave automático; Libre conserva la inercia 6-DOF.</p>
                      </div>
                      <select
                        value={microgravityMode || gameSettings.microgravityMode || 'ASSISTED'}
                        onChange={(e) => {
                          const nextMode = e.target.value;
                          updateSetting('microgravityMode', nextMode);
                          onChangeMicrogravityMode?.(nextMode);
                        }}
                        className="kronox-setting-select"
                      >
                        <option value="ASSISTED">Asistida (Amortiguada)</option>
                        <option value="FREE">Libre 6-DOF (Inercial)</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'accessibility' && (
                  <SubtitleSettingsGroup
                    gameSettings={gameSettings}
                    onUpdateSetting={updateSetting}
                  />
                )}

                {activeSettingsTab === 'interface' && (
                  <div className="kronox-settings-group">
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Modo de HUD espacial</strong>
                        <p>
                          Mantiene la interfaz limpia durante la exploración, mostrando paneles sólo
                          al interactuar con consolas físicas.
                        </p>
                      </div>
                      <span className="kronox-setting-pill">HUD Mínimo de Videojuego</span>
                    </div>
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Telemetría angular en Telescopio Óptico</strong>
                        <p>
                          Muestra distancia física (UA / km), radio planetario, diámetro angular (″)
                          y magnitud aparente V.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="kronox-pause-secondary-btn"
                        onClick={() =>
                          updateSetting(
                            'showTelescopeTelemetry',
                            gameSettings.showTelescopeTelemetry === false,
                          )
                        }
                      >
                        {gameSettings.showTelescopeTelemetry === false
                          ? 'Oculta'
                          : 'Visible al usar Telescopio'}
                      </button>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'voice' && (
                  <div className="kronox-settings-group">
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Estado de voz de Kronox IA</strong>
                        <p>Activa o silencia la reproducción de voz con caché de audio integrado.</p>
                      </div>
                      <button
                        type="button"
                        className="kronox-pause-secondary-btn"
                        onClick={onToggleVoiceMute}
                      >
                        {voiceMuted ? 'Silenciada' : 'Activada'}
                      </button>
                    </div>
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Repetir última transmisión de Kronox IA</strong>
                        <p>Vuelve a escuchar el último mensaje narrativo o científico recibido.</p>
                      </div>
                      <button
                        type="button"
                        className="kronox-pause-secondary-btn"
                        onClick={() => {
                          onRepeatLastKronoxMessage?.();
                          onClose?.();
                        }}
                      >
                        Repetir último mensaje
                      </button>
                    </div>
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Entrada de micrófono (Voz a texto)</strong>
                        <p>
                          Por privacidad y rendimiento, el micrófono nunca permanece abierto: se
                          activa exclusivamente mediante el botón «Pulsar para hablar» en la consola
                          de Comunicaciones.
                        </p>
                      </div>
                      <span className="kronox-setting-pill">Pulsar para hablar (Bajo demanda)</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === 'controls' && (
            <section className="kronox-pause-panel">
              <header className="kronox-pause-header">
                <span className="kronox-pause-eyebrow">MANUAL DE OPERACIONES</span>
                <h3>Controles de la nave y exploración</h3>
                <p>
                  Referencias rápidas para caminar por el puente habitable de 120 m, pilotar y
                  operar los instrumentos astronómicos.
                </p>
              </header>

              <div className="kronox-controls-grid">
                <div className="kronox-pause-card">
                  <h4>Exploración en Cabina y Cámaras</h4>
                  <ul className="kronox-pause-meta-list">
                    <li>
                      <span>Desplazamiento del astronauta:</span>
                      <strong>W / A / S / D o Flechas</strong>
                    </li>
                    <li>
                      <span>Mirar alrededor / alternar vista libre:</span>
                      <strong>Arrastrar con ratón o tecla [L]</strong>
                    </li>
                    <li>
                      <span>Alternar 1ª Persona / 3ª Persona EVA:</span>
                      <strong>Tecla [V]</strong>
                    </li>
                    <li>
                      <span>Alternar Cabina / Exterior Nave 120 m:</span>
                      <strong>Tecla [C]</strong>
                    </li>
                    <li>
                      <span>Operar puerta, herramienta o consola apuntada:</span>
                      <strong>Tecla [E] o Clic directo</strong>
                    </li>
                    <li>
                      <span>Seleccionar planta dentro del Ascensor 3D:</span>
                      <strong>Teclas [1 / 2 / 3 / 4] o [E]</strong>
                    </li>
                    <li>
                      <span>Salir de una consola activa:</span>
                      <strong>Tecla [ESC]</strong>
                    </li>
                  </ul>
                </div>

                <div className="kronox-pause-card">
                  <h4>Instrumentos Ópticos y Cámara Exterior</h4>
                  <ul className="kronox-pause-meta-list">
                    <li>
                      <span>Alternar Telescopio Óptico (1× / 50× / 150× / 300×):</span>
                      <strong>Tecla [T]</strong>
                    </li>
                    <li>
                      <span>Restablecer encuadre de cámara exterior (120 m):</span>
                      <strong>Tecla [R]</strong>
                    </li>
                    <li>
                      <span>Zoom de cámara / aumento instrumental:</span>
                      <strong>Rueda del ratón</strong>
                    </li>
                    <li>
                      <span>Menú de Pausa de KRONOX:</span>
                      <strong>Tecla [ESC]</strong>
                    </li>
                  </ul>
                </div>

                <div className="kronox-pause-card">
                  <h4>Física de Microgravedad 6-DOF y Pilotaje</h4>
                  <ul className="kronox-pause-meta-list">
                    <li>
                      <span>Empuje planar (relativo a la vista):</span>
                      <strong>W / A / S / D</strong>
                    </li>
                    <li>
                      <span>Impulso vertical ascendente (+Y):</span>
                      <strong>Tecla [ESPACIO]</strong>
                    </li>
                    <li>
                      <span>Impulso vertical descendente (-Y):</span>
                      <strong>Tecla [CTRL]</strong>
                    </li>
                    <li>
                      <span>Impulso RCS de potencia aumentada:</span>
                      <strong>Tecla [SHIFT]</strong>
                    </li>
                    <li>
                      <span>Estabilización activa (frenado RCS):</span>
                      <strong>Tecla [X]</strong>
                    </li>
                    <li>
                      <span>Anclaje o suelta de pasamanos EVA:</span>
                      <strong>Tecla [H] o [E]</strong>
                    </li>
                    <li>
                      <span>Cambiar modo microgravedad (Asistida / Libre):</span>
                      <strong>Tecla [M]</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {confirmMainMenu && (
            <div
              className="kronox-pause-confirm-modal"
              role="alertdialog"
              aria-modal="true"
              aria-label="Confirmación de salida"
            >
              <div className="kronox-pause-card">
                <header className="kronox-pause-header">
                  <span className="kronox-pause-eyebrow">CONFIRMACIÓN DE SALIDA</span>
                  <h3>¿Abandonar la expedición actual?</h3>
                  <p>
                    Regresarás al menú principal de KRONOX. Asegúrate de haber guardado tu partida
                    reciente para no perder el estado de la nave ni tus observaciones científicas.
                  </p>
                </header>
                <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                  <button
                    type="button"
                    className="kronox-pause-danger-btn"
                    onClick={() => {
                      setConfirmMainMenu(false);
                      onReturnToMainMenu?.();
                    }}
                  >
                    Sí, salir al menú principal
                  </button>
                  <button
                    type="button"
                    className="kronox-pause-secondary-btn"
                    onClick={() => setConfirmMainMenu(false)}
                  >
                    Cancelar y permanecer en pausa
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
