import React, { useEffect, useState } from 'react';
import {
  saveExplorerProfile,
  loadExplorerProfile,
} from '../state/campaignState.js';
import { loadGameState } from '../utils/expeditionJournal.js';
import {
  AudioSettingsGroup,
  SubtitleSettingsGroup,
} from './AudioSubtitleSettingsControls.jsx';
import MissionLoreCodex from './MissionLoreCodex.jsx';

/**
 * Pantalla de Título / Menú Principal Cinematográfico de KRONOX.
 * Deja el hemisferio derecho despejado para lucir la nave de 120 m orbitando en tiempo real.
 */
export default function MainMenu({
  open = false,
  onStartNewExpedition,
  onContinueExpedition,
  hasSavedGame = false,
  savedGameSummary = null,
  gameSettings = {},
  onUpdateGameSettings,
  voiceMuted = false,
  onToggleVoiceMute,
  quality = 'auto',
  onQualityChange,
  visualProfile = 'cinematic',
  onToggleVisualProfile,
  reducedMotion = false,
  onToggleReducedMotion,
  realScale = true,
  onToggleScaleMode,
  onPlayUiCue,
  language = 'es',
}) {
  const [activeView, setActiveView] = useState('home'); // 'home' | 'no-save' | 'settings' | 'credits'
  const [settingsTab, setSettingsTab] = useState('audio'); // 'audio' | 'subtitles' | 'graphics' | 'controls'
  const [explorerAlias, setExplorerAlias] = useState(
    () => loadExplorerProfile()?.alias || 'Comandante Horizonte',
  );

  useEffect(() => {
    if (open) setActiveView('home');
  }, [open]);

  if (!open) return null;

  const currentSave = savedGameSummary || loadGameState();
  const saveAvailable = Boolean(hasSavedGame || currentSave?.savedAt || currentSave?.currentBody);

  const updateSetting = (key, value) => {
    onUpdateGameSettings?.({ ...gameSettings, [key]: value });
  };

  const handleNewGame = () => {
    onPlayUiCue?.('confirm');
    saveExplorerProfile({
      alias: (explorerAlias || '').trim() || 'Comandante Horizonte',
      skillLevel: 'Estándar',
      onboardingCompleted: true,
    });
    onStartNewExpedition?.({
      alias: (explorerAlias || '').trim() || 'Comandante Horizonte',
      skillLevel: 'Estándar',
    });
  };

  const handleContinue = () => {
    onPlayUiCue?.('tap');
    if (saveAvailable) {
      onContinueExpedition?.(currentSave);
    } else {
      setActiveView('no-save');
    }
  };

  return (
    <div
      className="kronox-main-menu-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Menú principal de KRONOX"
    >
      {/* Capa sutil de atmósfera y estrellas sin tapar la nave 3D */}
      <div className="kronox-menu-atmosphere" aria-hidden="true">
        <div className="kronox-menu-vignette" />
        <div className="kronox-menu-stars" />
      </div>

      {activeView === 'home' && (
        <div className="kronox-title-stage">
          <aside className="kronox-title-rail">
            <header className="kronox-title-header">
              <span className="kronox-main-menu-badge">
                PROYECTO HORIZONTE · CRUCERO CIENTÍFICO 120 M
              </span>
              <h1 className="kronox-main-title">KRONOX</h1>
              <p className="kronox-main-subtitle">
                Exploración espacial en microgravedad e instrumentación espectroscópica en el Sistema Solar.
              </p>
            </header>

            <nav className="kronox-title-nav" aria-label="Opciones principales">
              <button
                type="button"
                className="kronox-title-btn is-primary"
                onClick={handleNewGame}
              >
                <span className="kronox-title-btn-marker" aria-hidden="true" />
                <span className="kronox-title-btn-body">
                  <strong>NUEVA PARTIDA</strong>
                  <small>Inicia una nueva expedición y reproduce la introducción 3D</small>
                </span>
              </button>

              <button
                type="button"
                className="kronox-title-btn"
                onClick={handleContinue}
              >
                <span className="kronox-title-btn-marker" aria-hidden="true" />
                <span className="kronox-title-btn-body">
                  <strong>CONTINUAR</strong>
                  <small>
                    {saveAvailable
                      ? `Retomar en ${currentSave?.currentBody || 'órbita'} · ${currentSave?.cameraView || 'Cabina 1P'}`
                      : 'Sin partida guardada en este dispositivo'}
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="kronox-title-btn"
                onClick={() => {
                  onPlayUiCue?.('tap');
                  setActiveView('lore');
                }}
              >
                <span className="kronox-title-btn-marker" aria-hidden="true" />
                <span className="kronox-title-btn-body">
                  <strong>HISTORIA DE LA MISIÓN</strong>
                  <small>Lore del Proyecto Horizonte, NASA SPHEREx y objetivos del cosmos</small>
                </span>
              </button>

              <button
                type="button"
                className="kronox-title-btn"
                onClick={() => {
                  onPlayUiCue?.('tap');
                  setSettingsTab('audio');
                  setActiveView('settings');
                }}
              >
                <span className="kronox-title-btn-marker" aria-hidden="true" />
                <span className="kronox-title-btn-body">
                  <strong>CONFIGURACIÓN</strong>
                  <small>Audio, subtítulos, gráficos, controles y experiencia</small>
                </span>
              </button>

              <button
                type="button"
                className="kronox-title-btn"
                onClick={() => {
                  onPlayUiCue?.('tap');
                  setActiveView('credits');
                }}
              >
                <span className="kronox-title-btn-marker" aria-hidden="true" />
                <span className="kronox-title-btn-body">
                  <strong>CRÉDITOS</strong>
                  <small>Proyecto Horizonte, NASA SPHEREx e inspiración científica</small>
                </span>
              </button>
            </nav>

            <footer className="kronox-title-footer">
              <span>ÉPOCA DE REFERENCIA J2000.0</span>
              <span>·</span>
              <span>ESCENARIO 3D EN TIEMPO REAL</span>
            </footer>
          </aside>

          <div className="kronox-title-hero-caption" aria-hidden="true">
            <span className="kronox-hero-callsign">UNIDAD KRONOX-1 · 120 METROS</span>
            <span className="kronox-hero-orbit">ÓRBITA TERRESTRE · LISTO PARA ABORDAJE</span>
          </div>
        </div>
      )}

      {activeView === 'no-save' && (
        <section className="kronox-menu-panel" aria-label="Aviso de partida guardada">
          <div className="kronox-menu-panel-header">
            <div>
              <span className="kronox-main-menu-badge">DIARIO DE EXPEDICIÓN</span>
              <h2>No hay partida guardada</h2>
            </div>
            <button
              type="button"
              className="kronox-pause-secondary-btn"
              onClick={() => setActiveView('home')}
            >
              Volver
            </button>
          </div>
          <p className="kronox-reg-intro">
            Todavía no existe un punto de guardado registrado en esta sesión o navegador. Puedes iniciar una nueva partida para embarcar en KRONOX desde la secuencia de introducción o guardar en cualquier momento desde el menú de pausa (`ESC`).
          </p>
          <div className="kronox-form-group">
            <label htmlFor="kronox-commander-alias">Indicativo de comandante (opcional)</label>
            <input
              id="kronox-commander-alias"
              type="text"
              className="kronox-reg-input"
              maxLength={32}
              value={explorerAlias}
              onChange={(e) => setExplorerAlias(e.target.value)}
              placeholder="Ej. Comandante Horizonte"
            />
          </div>
          <div className="kronox-reg-actions">
            <button
              type="button"
              className="kronox-pause-secondary-btn"
              onClick={() => setActiveView('home')}
            >
              Volver al menú
            </button>
            <button
              type="button"
              className="kronox-pause-primary-btn"
              onClick={handleNewGame}
            >
              Iniciar Nueva Partida →
            </button>
          </div>
        </section>
      )}

      {activeView === 'settings' && (
        <section className="kronox-menu-panel kronox-menu-panel-wide" aria-label="Configuración del juego">
          <div className="kronox-menu-panel-header">
            <div>
              <span className="kronox-main-menu-badge">SISTEMAS Y PREFERENCIAS</span>
              <h2>Configuración</h2>
            </div>
            <button
              type="button"
              className="kronox-pause-secondary-btn"
              onClick={() => setActiveView('home')}
            >
              ← Volver al Menú
            </button>
          </div>

          <div className="kronox-settings-tabs" role="tablist">
            {[
              { id: 'audio', label: 'Audio y Mezcla' },
              { id: 'subtitles', label: 'Subtítulos' },
              { id: 'graphics', label: 'Gráficos y Escala' },
              { id: 'controls', label: 'Controles' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={settingsTab === tab.id}
                className={`kronox-settings-tab-btn${settingsTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setSettingsTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {settingsTab === 'audio' && (
            <AudioSettingsGroup
              gameSettings={gameSettings}
              onUpdateSetting={updateSetting}
              voiceMuted={voiceMuted}
              onToggleVoiceMute={onToggleVoiceMute}
            />
          )}

          {settingsTab === 'subtitles' && (
            <SubtitleSettingsGroup
              gameSettings={gameSettings}
              onUpdateSetting={updateSetting}
            />
          )}

          {settingsTab === 'graphics' && (
            <div className="kronox-settings-group">
              <div className="kronox-setting-row">
                <div>
                  <strong>Calidad de renderizado WebGL</strong>
                  <p>Equilibra densidad estelar, iluminación PBR y fluidez de cuadros.</p>
                </div>
                <select
                  aria-label="Calidad gráfica"
                  className="kronox-setting-select"
                  value={quality}
                  onChange={(e) => onQualityChange?.(e.target.value)}
                >
                  <option value="auto">Automática</option>
                  <option value="high">Alta (Cinematográfica)</option>
                  <option value="low">Ligera (Alto rendimiento)</option>
                </select>
              </div>
              <div className="kronox-setting-row">
                <div>
                  <strong>Perfil visual del firmamento</strong>
                  <p>Alterna entre contraste cinematográfico de la Vía Láctea o fotometría estricta.</p>
                </div>
                <button
                  type="button"
                  className="kronox-pause-secondary-btn"
                  onClick={() => onToggleVisualProfile?.()}
                >
                  {visualProfile === 'scientific' ? 'Científico Estricto' : 'Cinematográfico'}
                </button>
              </div>
              <div className="kronox-setting-row">
                <div>
                  <strong>Movimiento y transiciones</strong>
                  <p>Reduce desplazamientos rápidos de cámara en secuencias si prefieres confort visual.</p>
                </div>
                <button
                  type="button"
                  className="kronox-pause-secondary-btn"
                  onClick={() => onToggleReducedMotion?.()}
                >
                  {reducedMotion ? 'Movimiento Reducido: Sí' : 'Movimiento Estándar'}
                </button>
              </div>
              {onToggleScaleMode && (
                <div className="kronox-setting-row">
                  <div>
                    <strong>Modelo de escala del Sistema Solar</strong>
                    <p>Selecciona física real J2000.0 o visualización espacial comprimida.</p>
                  </div>
                  <button
                    type="button"
                    className="kronox-pause-secondary-btn"
                    onClick={onToggleScaleMode}
                  >
                    {realScale ? 'Física Real J2000.0' : 'Escala Visual Comprimida'}
                  </button>
                </div>
              )}
            </div>
          )}

          {settingsTab === 'controls' && (
            <div className="kronox-settings-group">
              <div className="kronox-setting-row">
                <div>
                  <strong>Sensibilidad de rotación de cámara</strong>
                  <p>Ajusta la velocidad de giro en cabina, EVA interior y vista exterior.</p>
                </div>
                <select
                  aria-label="Sensibilidad de cámara"
                  className="kronox-setting-select"
                  value={gameSettings.cameraSensitivity || 'normal'}
                  onChange={(e) => updateSetting('cameraSensitivity', e.target.value)}
                >
                  <option value="low">Suave (Cinemática)</option>
                  <option value="normal">Estándar (1.0×)</option>
                  <option value="high">Rápida (1.4×)</option>
                </select>
              </div>
              <div className="kronox-setting-row">
                <div>
                  <strong>Controles de exploración y nave</strong>
                  <p>WASD desplazamiento en microgravedad · E operar consola cercana · C cambiar cámara 1P/3P/Exterior · ESC menú de pausa.</p>
                </div>
                <span className="kronox-setting-pill">6-DOF Activo</span>
              </div>
            </div>
          )}
        </section>
      )}

      {activeView === 'lore' && (
        <MissionLoreCodex
          onBack={() => setActiveView('home')}
          onStartExpedition={handleNewGame}
          onPlayUiCue={onPlayUiCue}
        />
      )}

      {activeView === 'credits' && (
        <section className="kronox-menu-panel kronox-menu-panel-wide" aria-label="Créditos de KRONOX">
          <div className="kronox-menu-panel-header">
            <div>
              <span className="kronox-main-menu-badge">PROYECTO HORIZONTE · CIENCIA ABIERTA</span>
              <h2>Créditos y Agradecimientos</h2>
            </div>
            <button
              type="button"
              className="kronox-pause-secondary-btn"
              onClick={() => setActiveView('home')}
            >
              ← Volver al Menú
            </button>
          </div>

          <div className="kronox-credits-grid">
            <div className="kronox-credit-block">
              <h3>Proyecto Horizonte & KRONOX</h3>
              <p>
                Experiencia interactiva de exploración espacial en 3D diseñada para unir navegación en tiempo real, física de microgravedad y análisis de datos astronómicos reales sin barreras.
              </p>
            </div>
            <div className="kronox-credit-block">
              <h3>Inspiración Científica: Misión NASA SPHEREx</h3>
              <p>
                Inspirado en el observatorio espacial infrarrojo SPHEREx (0.75–5.0 μm) de NASA y Caltech, dedicado al cartografiado espectral de todo el cielo para estudiar la historia cósmica, hielos interestelares y poblaciones estelares.
              </p>
            </div>
            <div className="kronox-credit-block">
              <h3>Archivos y Catálogos Astronómicos</h3>
              <p>
                Trazabilidad observacional basada en documentación de NASA/IPAC IRSA, astrometría de ESA Gaia DR3, fotometría infrarroja de CatWISE2020 y morfología galáctica Spitzer GLIMPSE.
              </p>
            </div>
            <div className="kronox-credit-block">
              <h3>Arquitectura Técnica y Audio</h3>
              <p>
                Motor 3D en tiempo real sobre Three.js y React, doblaje neuronal e inteligencia auxiliar KRONOX IA con síntesis vocal híbrida y paisaje sonoro original.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
