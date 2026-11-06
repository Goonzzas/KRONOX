import React, { useEffect, useState } from 'react';
import { t } from '../i18n.js';
import { KRONOX_QUICK_PROMPTS } from '../utils/kronoxAI.js';
import { KRONOX_LUMINOUS_STATES } from '../scene/habitableShipWorld.js';

/**
 * In-World 3D Luminous AI Dialogue & Subtitle HUD (Section 5).
 * Kronox IA is a real 3D luminous energy sphere inside the Three.js cabin scene (no humanoid figure,
 * no separate floating corner chat box). This component renders:
 * 1. A discreet 3D-projected floating state badge near the 3D light entity in the cabin.
 * 2. A contextual cinematic subtitle bar at the bottom of the screen when Kronox IA speaks or guides the astronaut.
 * 3. A secondary collapsible command input bar when the astronaut wants to type a command or question.
 */
export default function KronoxWidget({
  guide,
  language = 'es',
  voice,
  accent,
  voiceError,
  near,
  speaking,
  audioLevels,
  panelOpen,
  onClose,
  onAccentChange,
  onToggleVoice,
  onMore,
  onOrbClick,
  onStartMission,
  missionStarting = false,
  onCommand,
  onRepeatSpeech,
  onPauseSpeech,
  speechPaused = false,
  onReplayCinematic,
  aiRole = 'Entidad Luminosa 3D',
  avatarState = 'Reposo',
  epistemicCategory = 'Comunicación espacial en puente 3D',
  history = [],
  aiProjection = null,
}) {
  const [typed, setTyped] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [textPaused, setTextPaused] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  // Map legacy state strings to the 8 required Spanish states of the 3D luminous entity
  const stateMap = {
    IDLE: 'Reposo',
    LISTENING: 'Escucha',
    TALKING: 'Comunicación',
    EXPLAINING: 'Explicación',
    POINTING: 'Señalización',
    GREETING: 'Acompañamiento',
    CELEBRATING: 'Celebración',
  };
  // Single Unified Source of Truth for Kronox IA's behavior state
  const rawState = aiProjection?.state || avatarState;
  const resolvedState = inputFocused
    ? 'Escucha'
    : speaking && (rawState === 'IDLE' || rawState === 'Reposo')
      ? 'Comunicación'
      : stateMap[rawState] || (KRONOX_LUMINOUS_STATES.includes(rawState) ? rawState : 'Acompañamiento');

  useEffect(() => {
    setTyped('');
    setTextPaused(false);
  }, [guide]);

  useEffect(() => {
    if (textPaused || speechPaused) return undefined;
    const text = guide || '';
    if (typed.length >= text.length) return undefined;
    const timer = setInterval(() => {
      setTyped((prev) => {
        const nextIdx = Math.min(text.length, prev.length + 3);
        return text.slice(0, nextIdx);
      });
    }, 14);
    return () => clearInterval(timer);
  }, [guide, textPaused, speechPaused, typed.length]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const q = inputQuery.trim();
    if (!q || !onCommand) return;
    setInputQuery('');
    onCommand(q);
  };

  const handleQuickPrompt = (query) => {
    if (!onCommand) return;
    onCommand(query);
  };

  return (
    <>
      {/* 1. 3D-PROJECTED TAG ATTACHED TO THE REAL 3D LUMINOUS ENTITY INSIDE THE CABIN */}
      {aiProjection?.visible && (
        <button
          type="button"
          className={`kronoxInWorldTag ${speaking ? 'speaking' : ''}`}
          style={{
            left: `${Math.max(90, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1280) - 90, aiProjection.x))}px`,
            top: `${Math.max(70, Math.min((typeof window !== 'undefined' ? window.innerHeight : 720) - 140, aiProjection.y - 54))}px`,
          }}
          onClick={onOrbClick}
          title="Entidad de luz 3D Kronox IA · Haz clic para abrir canal de órdenes"
        >
          <span className="kronoxInWorldPulse" />
          <strong>KRONOX IA 3D</strong>
          <small>{resolvedState}</small>
        </button>
      )}

      {/* 2. DISCRETE CINEMATIC SUBTITLE BAR LINKED TO KRONOX IA */}
      {Boolean(typed && typed.trim().length > 0) && (
      <div
        className={`kronoxSubtitleDock ${speaking ? 'is-speaking' : ''} ${panelOpen ? 'expanded' : 'compact'}`}
        role="region"
        aria-label={t('Diálogo contextual de la entidad luminosa Kronox IA', language)}
      >
        <div className="kronoxSubtitleMainRow">
          {/* Subtle indicator icon */}
          <div className="kronoxSubtitleSparkIndicator" aria-hidden="true">
            <span className="kronoxSparkDot" />
          </div>

          <div className="kronoxSubtitleContent">
            <div className="kronoxSubtitleMeta">
              <span className="kronoxEntityName">KRONOX IA</span>
              <span className="kronoxStatePill" data-state={resolvedState}>
                ● {resolvedState}
              </span>
              <span className="kronoxEpistemicInline">{epistemicCategory}</span>
              {speaking && (
                <div className="kronoxMiniVoiceWave" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, idx) => (
                    <i key={idx} style={{ '--bar-level': audioLevels?.[idx * 4] ?? 0.1 }} />
                  ))}
                </div>
              )}
            </div>

            <p className="kronoxSubtitleText" aria-live="polite">
              {typed}
              <span className="kronoxCursor">▍</span>
            </p>
          </div>

          <div className="kronoxSubtitleQuickActions">
            {/* Contextual discrete settings button */}
            <button
              type="button"
              className="kronoxSubMiniBtn"
              onClick={() => setShowVoiceMenu((prev) => !prev)}
              title="Ajustes de voz y locución"
              aria-label="Ajustes de voz"
            >
              {voice ? '🔊' : '🔇'}
            </button>

            {showVoiceMenu && (
              <div className="kronoxVoiceContextMenu">
                <button
                  type="button"
                  className="kronoxMenuActionBtn"
                  onClick={onToggleVoice}
                >
                  {voice ? 'Silenciar voz' : 'Activar voz'}
                </button>
                <button
                  type="button"
                  className="kronoxMenuActionBtn"
                  onClick={() => {
                    setTextPaused((prev) => !prev);
                    onPauseSpeech?.();
                  }}
                >
                  {textPaused || speechPaused ? 'Reanudar' : 'Pausar'}
                </button>
                {onRepeatSpeech && (
                  <button
                    type="button"
                    className="kronoxMenuActionBtn"
                    onClick={() => {
                      setTextPaused(false);
                      setTyped('');
                      onRepeatSpeech();
                    }}
                  >
                    Repetir
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="kronoxSubMiniBtn primary"
              onClick={onOrbClick}
              title="Abrir canal de consulta o órdenes escritas"
            >
              {panelOpen ? '✕' : '💬'}
            </button>
          </div>
        </div>

        {/* 3. SECONDARY COLLAPSIBLE COMMAND INPUT & QUICK ORDERS */}
        {panelOpen && (
          <div className="kronoxSecondaryCommandDrawer">
            <form className="kronoxCommandForm" onSubmit={handleSubmit}>
              <input
                type="text"
                className="kronoxCommandInput"
                value={inputQuery}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  language === 'en'
                    ? 'Ask or command Kronox IA (e.g. "Take me to Barnard", "Compare epochs")...'
                    : 'Escribe una orden o consulta para Kronox IA (ej. «Llévame a Barnard», «Compara las épocas»)...'
                }
                aria-label={t('Enviar orden o consulta a Kronox', language)}
              />
              <button type="submit" className="kronoxCommandSend">
                {language === 'en' ? 'Transmit' : 'Transmitir'}
              </button>
              <button
                type="button"
                className="kronoxSubActionBtn"
                onClick={onClose}
                aria-label="Cerrar barra de comandos"
              >
                ×
              </button>
            </form>

            <div className="kronoxQuickPrompts">
              {KRONOX_QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="kronoxPromptChip"
                  onClick={() => handleQuickPrompt(item.query)}
                >
                  {t(item.label, language)}
                </button>
              ))}
              <button
                type="button"
                className="kronoxPromptChip highlight"
                onClick={onStartMission}
                disabled={missionStarting}
              >
                ✦ {missionStarting ? 'Preparando salto…' : 'Catálogo de misiones'}
              </button>
            </div>

            {history.length > 0 && (
              <div className="kronoxAiHistory">
                {history.slice(-2).map((item, idx) => (
                  <div key={idx} className="kronoxAiHistoryRow">
                    <span className="kronoxAiUserQuery">▸ {item.query}</span>
                    {item.actionLabel && (
                      <span className="kronoxAiExecTag">✓ {item.actionLabel}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {voiceError && <small role="status">{voiceError}</small>}
          </div>
        )}
      </div>
      )}
    </>
  );
}
