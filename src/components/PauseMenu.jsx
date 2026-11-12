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

const PAUSE_SECTIONS = [
  { id: 'continue', label: '1. Continuar', subtitle: 'Reanudar exploración espacial' },
  { id: 'save', label: '2. Guardar partida', subtitle: 'Estado de nave y efemérides' },
  { id: 'observations', label: '3. Mis observaciones', subtitle: 'Registro científico personal' },
  { id: 'journal', label: '4. Diario de exploración', subtitle: 'Bitácora de misiones y objetos' },
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
  initialSection = 'save',
  onClose,
  onReturnToMainMenu,
  currentBody = 'Tierra',
  cameraView = 'Cabina 1P',
  observationMode = 'naked-eye',
  opticalMagnification = 1,
  scaleMode = 'real',
  onToggleScaleMode,
  activeMissionId = null,
  activeObjective = null,
  voiceMuted = false,
  onToggleVoiceMute,
  onRepeatLastKronoxMessage,
  gameSettings = {},
  onUpdateGameSettings,
  onOpenMissionTarget,
}) {
  const [activeSection, setActiveSection] = useState(initialSection || 'save');
  const [activeSettingsTab, setActiveSettingsTab] = useState('graphics');
  const [findings, setFindings] = useState([]);
  const [journal, setJournal] = useState(() => loadExpeditionJournal());
  const [lastSave, setLastSave] = useState(() => loadGameState());
  const [saveFeedback, setSaveFeedback] = useState('');
  const [exportedEnvelope, setExportedEnvelope] = useState(null);

  useEffect(() => {
    if (open) {
      setFindings(loadFindings());
      setJournal(loadExpeditionJournal());
      setLastSave(loadGameState());
      setSaveFeedback('');
      setExportedEnvelope(null);
      if (initialSection && initialSection !== 'continue') {
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
      onReturnToMainMenu?.();
      return;
    }
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
                <span className="kronox-pause-eyebrow">BITÁCORA DE A BORDO</span>
                <h3>Diario de exploración</h3>
                <p>
                  Síntesis de misiones completadas, objetos astronómicos investigados y registro
                  cronológico de tu expedición a bordo de KRONOX.
                </p>
              </header>

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
                      Sin entradas recientes en la bitácora.
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
                {activeSettingsTab === 'graphics' && (
                  <div className="kronox-settings-group">
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
                )}

                {activeSettingsTab === 'audio' && (
                  <div className="kronox-settings-group">
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Audio de voz y comunicaciones de puente</strong>
                        <p>Controla la síntesis vocal neuronal de Kronox IA.</p>
                      </div>
                      <button
                        type="button"
                        className="kronox-pause-secondary-btn"
                        onClick={onToggleVoiceMute}
                      >
                        {voiceMuted ? 'Voz Silenciada (Activar)' : 'Voz Activa (Silenciar)'}
                      </button>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'controls' && (
                  <div className="kronox-settings-group">
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
                  </div>
                )}

                {activeSettingsTab === 'accessibility' && (
                  <div className="kronox-settings-group">
                    <div className="kronox-setting-row">
                      <div>
                        <strong>Subtítulos sincronizados de Kronox IA</strong>
                        <p>Muestra una barra inferior discreta cuando Kronox IA transmite mensajes.</p>
                      </div>
                      <button
                        type="button"
                        className="kronox-pause-secondary-btn"
                        onClick={() =>
                          updateSetting('showSubtitles', gameSettings.showSubtitles === false)
                        }
                      >
                        {gameSettings.showSubtitles === false ? 'Desactivados' : 'Activados'}
                      </button>
                    </div>
                  </div>
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
                  <h4>Exploración en Cabina (1ª Persona)</h4>
                  <ul className="kronox-pause-meta-list">
                    <li>
                      <span>Desplazamiento del astronauta:</span>
                      <strong>W / A / S / D o Flechas</strong>
                    </li>
                    <li>
                      <span>Mirar alrededor:</span>
                      <strong>Arrastrar con ratón</strong>
                    </li>
                    <li>
                      <span>Operar consola o estación cercana:</span>
                      <strong>Tecla [E] o Clic directo</strong>
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
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
