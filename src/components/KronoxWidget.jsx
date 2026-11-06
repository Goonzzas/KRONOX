import React, { useEffect, useRef, useState } from 'react';
import { t } from '../i18n.js';
import { KRONOX_QUICK_PROMPTS } from '../utils/kronoxAI.js';
import KronoxAvatarStage from './KronoxAvatarStage.jsx';

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
  onReplayCinematic,
  aiRole = 'Inteligencia de a bordo',
  avatarState = 'IDLE',
  pointDirection = 'right',
  epistemicCategory = 'Comunicación de puente de mando',
  history = [],
}) {
  const [typed, setTyped] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kronox-widget-position'));
      return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null;
    } catch {
      return null;
    }
  });
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const isTransmitting = speaking || typed.length < guide.length;
  const panelSide = position && position.x < window.innerWidth / 2 ? 'right' : 'left';
  const widgetStyle = position
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : undefined;

  // Compute effective 3D avatar animation state
  const effectiveAvatarState = inputFocused
    ? 'LISTENING'
    : speaking && (avatarState === 'IDLE' || avatarState === 'LISTENING')
      ? 'TALKING'
      : avatarState || 'IDLE';

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    movedRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position?.x ?? window.innerWidth - 45,
      originY: position?.y ?? window.innerHeight - 112,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
    if (!movedRef.current) return;
    const x = Math.max(34, Math.min(window.innerWidth - 34, drag.originX + dx));
    const y = Math.max(34, Math.min(window.innerHeight - 34, drag.originY + dy));
    setPosition({ x, y });
  };
  const endDrag = (event) => {
    if (!dragRef.current) return;
    if (movedRef.current) {
      const x = Math.max(34, Math.min(window.innerWidth - 34, event.clientX));
      const y = Math.max(34, Math.min(window.innerHeight - 34, event.clientY));
      const next = { x, y };
      setPosition(next);
      try {
        localStorage.setItem('kronox-widget-position', JSON.stringify(next));
      } catch {
        // Keep dragging available when storage is disabled.
      }
    }
    dragRef.current = null;
    setTimeout(() => {
      movedRef.current = false;
    }, 0);
  };

  useEffect(() => {
    setTyped('');
    let index = 0;
    const timer = setInterval(() => {
      index += 2;
      setTyped(guide.slice(0, index));
      if (index >= guide.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [guide]);

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
    <div
      className={`kronoxWidget ${position ? 'is-positioned' : ''} ${speaking ? 'is-speaking' : ''} ${isTransmitting ? 'is-transmitting' : ''} ${panelOpen ? 'panel-visible' : ''}`}
      style={widgetStyle}
      data-panel-side={panelSide}
    >
      {/* Persistent 3D Holographic Avatar Pod + Quick Toggle Button */}
      <div
        className="kronoxHologramPod"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <KronoxAvatarStage
          animState={effectiveAvatarState}
          speaking={speaking}
          audioLevels={audioLevels}
          pointDirection={pointDirection}
          compact={!panelOpen}
          onClickAvatar={() => {
            if (!movedRef.current) onOrbClick();
          }}
        />
        <button
          className="kronoxOrb"
          aria-label={t('Kronox, inteligencia tridimensional de a bordo', language)}
          title={t('Kronox, inteligencia tridimensional de a bordo', language)}
          onClick={(event) => {
            if (movedRef.current) {
              event.preventDefault();
              return;
            }
            onOrbClick();
          }}
        >
          <span className="kronoxCore" />
          <svg className="kronoxGyro" viewBox="0 0 100 100" aria-hidden="true">
            <ellipse className="gyroRing ringOne" cx="50" cy="50" rx="39" ry="17" />
            <ellipse className="gyroRing ringTwo" cx="50" cy="50" rx="39" ry="17" />
            <ellipse className="gyroRing ringThree" cx="50" cy="50" rx="39" ry="17" />
            <path className="kronoxFourStar" d="M50 7 57 43 93 50 57 57 50 93 43 57 7 50 43 43Z" />
          </svg>
        </button>
      </div>

      {panelOpen && (
        <div className={`kronoxBubble kronoxAiConsole ${isTransmitting ? 'transmitting' : ''}`}>
          <div className="kronoxPanelTop">
            <div className="kronoxName">
              {t('KRONOX · IA HOLOGRÁFICA 3D', language)}
              <span className="kronoxRoleBadge">{t(aiRole, language)}</span>
            </div>
            <span className="kronoxStatus">
              <i />
              {speaking ? t('transmitiendo…', language) : t(effectiveAvatarState, language)}
            </span>
            <button
              className="kronoxClose"
              aria-label={t('Cerrar panel de Kronox', language)}
              onClick={onClose}
            >
              ×
            </button>
          </div>

          {/* Epistemic Category & Voice Engine Transparency Badge */}
          <div className="kronoxEpistemicBar">
            <span className="kronoxEpistemicTag">◈ {epistemicCategory}</span>
            <small className="kronoxVoiceTechNote">
              {voice ? 'Voz: Síntesis TTS Web / Audio local' : 'Subtítulos sincronizados (Audio silenciado)'}
            </small>
          </div>

          <div className="kronoxVoiceBars" aria-hidden="true">
            {Array.from({ length: 48 }, (_, index) => (
              <i key={index} style={{ '--bar-level': audioLevels?.[index] ?? 0.08 }} />
            ))}
          </div>

          <p className="kronoxAiMessage" aria-live="polite">
            {typed}
            <span className="kronoxCursor">▍</span>
          </p>

          {history.length > 0 && (
            <div className="kronoxAiHistory" aria-label={t('Registro de órdenes recientes', language)}>
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

          {/* Interactive Command & Question Input */}
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
                  ? 'Ask or command (e.g. "Take me to Barnard")...'
                  : 'Pregunta u ordena (ej. «Llévame a Barnard»)...'
              }
              aria-label={t('Enviar orden o consulta a Kronox', language)}
            />
            <button type="submit" className="kronoxCommandSend">
              {language === 'en' ? 'Send' : 'Enviar'}
            </button>
          </form>

          {/* Suggested Real Actions & Queries */}
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
          </div>

          <div className="kronoxVoiceControlsRow">
            <button type="button" onClick={onToggleVoice}>
              {voice ? t('Silenciar voz', language) : t('Activar voz', language)}
            </button>
            {onRepeatSpeech && (
              <button
                type="button"
                onClick={onRepeatSpeech}
                title={t('Repetir explicación actual', language)}
              >
                ↺ {t('Repetir explicación', language)}
              </button>
            )}
            {onReplayCinematic && (
              <button
                type="button"
                onClick={onReplayCinematic}
                title={t('Reproducir secuencias cinematográficas de introducción', language)}
              >
                🎬 {t('Ver cinemática', language)}
              </button>
            )}
            {voice && (
              <label className="r" style={{ fontSize: 12, marginBottom: 0 }}>
                {t(language === 'es' ? 'Acento' : 'Voice', language)}{' '}
                <select value={accent} onChange={(event) => onAccentChange(event.target.value)}>
                  {language === 'es' ? (
                    <>
                      <option value="es-US">Latino</option>
                      <option value="es-ES">España</option>
                    </>
                  ) : (
                    <option value="en-US">United States</option>
                  )}
                </select>
              </label>
            )}
            {near && (
              <button type="button" onClick={() => onMore(near)}>
                {t('Ficha de ' + near, language)}
              </button>
            )}
          </div>
          {voiceError && <small role="status">{voiceError}</small>}

          <div className="kronoxMissionOffer">
            <span>{t('SISTEMA DE MISIONES · SPHEREx', language)}</span>
            <p>
              {t(
                'Selecciona un destino estelar o pídeme que trace rumbo hacia cualquier estrella del catálogo.',
                language,
              )}
            </p>
            <button type="button" onClick={onStartMission} disabled={missionStarting}>
              {missionStarting ? t('Preparando el salto…', language) : t('Elegir misión', language)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
