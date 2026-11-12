import React, { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n.js';
import { KRONOX_QUICK_PROMPTS } from '../utils/kronoxAI.js';
import { KRONOX_LUMINOUS_STATES } from '../scene/habitableShipWorld.js';
import type { NarrativeMessage } from '../state/kronoxMessages.js';

/**
 * In-World 3D Luminous AI Dialogue & Subtitle HUD (Section 5).
 * Kronox IA remains a luminous sphere in the Three.js scene. This component
 * provides a compact corner orb, contextual subtitles and a command input.
 */
type KronoxWidgetProps = {
  narrative: NarrativeMessage | null;
  language?: string;
  voice?: boolean;
  accent?: string;
  near?: string | null;
  voiceError?: string;
  speaking?: boolean;
  audioLevels?: number[];
  panelOpen?: boolean;
  dialogueHidden?: boolean;
  showCornerOrb?: boolean;
  onClose?: () => void;
  onToggleVoice?: () => void;
  onOrbClick?: () => void;
  onStartMission?: () => void;
  missionStarting?: boolean;
  onCommand?: (query: string) => void;
  onRepeatSpeech?: () => void;
  onPauseSpeech?: () => void;
  speechPaused?: boolean;
  onReplayCinematic?: () => void;
  aiRole?: string;
  avatarState?: string;
  epistemicCategory?: string;
  history?: Array<{ query: string; actionLabel?: string }>;
  aiProjection?: { visible?: boolean; x?: number; y?: number; state?: string } | null;
  onMessageComplete?: (id: string) => void;
  onEndGuide?: () => void;
};

const splitIntervention = (text: string, maxLength = 140) => {
  const pieces: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    let cut = Math.max(remaining.lastIndexOf('. ', maxLength), remaining.lastIndexOf('! ', maxLength), remaining.lastIndexOf('? ', maxLength));
    if (cut < 45) cut = remaining.lastIndexOf(' ', maxLength);
    if (cut < 1) cut = maxLength;
    pieces.push(remaining.slice(0, cut + (remaining[cut] === '.' || remaining[cut] === '!' || remaining[cut] === '?' ? 1 : 0)).trim());
    remaining = remaining.slice(cut + 1).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
};

export default function KronoxWidget({
  narrative,
  language = 'es',
  voice,
  accent,
  voiceError,
  near,
  speaking,
  audioLevels,
  panelOpen,
  onClose,
  onToggleVoice,
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
  dialogueHidden = false,
  showCornerOrb = false,
  onMessageComplete,
  onEndGuide,
}: KronoxWidgetProps) {
  const [typed, setTyped] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [textPaused, setTextPaused] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [partIndex, setPartIndex] = useState(0);
  const [listeningMic, setListeningMic] = useState(false);
  const [micStatus, setMicStatus] = useState('');
  const recognitionRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const interventions = useMemo(() => splitIntervention(narrative?.text || ''), [narrative?.id, narrative?.text]);
  const intervention = interventions[partIndex] || '';

  // Map legacy state strings to the 8 required Spanish states of the 3D luminous entity
  const stateMap: Record<string, string> = {
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
  // This label reports behavior only; voice and narrative playback have separate indicators.
  const resolvedState: string = stateMap[rawState] || (KRONOX_LUMINOUS_STATES.includes(rawState) ? rawState : 'Acompañamiento');

  useEffect(() => {
    setTyped('');
    setTextPaused(false);
    setPartIndex(0);
  }, [narrative?.id]);

  useEffect(() => {
    if (!showVoiceMenu) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowVoiceMenu(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [showVoiceMenu]);

  useEffect(() => {
    if (textPaused || speechPaused) return undefined;
    const text = intervention;
    if (typed.length >= text.length) return undefined;
    const timer = setInterval(() => {
      setTyped((prev) => {
        const nextIdx = Math.min(text.length, prev.length + 3);
        return text.slice(0, nextIdx);
      });
    }, 14);
    return () => clearInterval(timer);
  }, [intervention, textPaused, speechPaused, typed.length]);

  useEffect(() => {
    if (!narrative || !intervention || typed.length < intervention.length || textPaused || speechPaused) return undefined;
    if (partIndex < interventions.length - 1) {
      const wordCount = Math.max(1, intervention.trim().split(/\s+/).length);
      const holdMs = Math.max(1800, Math.min(5500, wordCount * 240));
      const timer = window.setTimeout(() => {
        setPartIndex((index) => index + 1);
        setTyped('');
      }, holdMs);
      return () => window.clearTimeout(timer);
    }
    if (!speaking) {
      const timer = window.setTimeout(() => onMessageComplete?.(narrative.id), 1500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [narrative, intervention, interventions.length, partIndex, typed.length, textPaused, speechPaused, speaking, onMessageComplete]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = inputQuery.trim();
    if (!q || !onCommand) return;
    setInputQuery('');
    onCommand(q);
  };

  const handleQuickPrompt = (query: string) => {
    if (!onCommand) return;
    onCommand(query);
  };

  const handleTogglePushToTalk = () => {
    if (listeningMic && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setListeningMic(false);
      return;
    }

    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor) {
      setMicStatus('Reconocimiento de voz no disponible en este navegador.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'en' ? 'en-US' : 'es-ES';

      recognition.onstart = () => {
        setListeningMic(true);
        setMicStatus('Escuchando orden de voz (se desactiva al terminar frase)...');
      };

      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim() || '';
        setListeningMic(false);
        setMicStatus('');
        if (transcript) {
          setInputQuery(transcript);
          onCommand?.(transcript);
        }
      };

      recognition.onerror = () => {
        setListeningMic(false);
        setMicStatus('No se detectó voz o permiso de micrófono denegado.');
      };

      recognition.onend = () => {
        setListeningMic(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListeningMic(false);
      setMicStatus('No fue posible iniciar el micrófono bajo demanda.');
    }
  };

  return (
    <>
      {showCornerOrb && (
        <button
          type="button"
          className={`kronoxOrb kronoxCornerOrb ${speaking ? 'is-transmitting' : ''}`}
          onClick={onOrbClick}
          title={panelOpen ? 'Cerrar canal de Kronox IA' : 'Abrir canal de Kronox IA'}
          aria-label={panelOpen ? 'Cerrar canal de Kronox IA' : 'Abrir canal de Kronox IA'}
          aria-expanded={Boolean(panelOpen)}
        >
          <span className="kronoxCore" />
          <svg className="kronoxGyro" viewBox="0 0 58 58" aria-hidden="true">
            <ellipse className="gyroRing ringOne" cx="29" cy="29" rx="25" ry="10" />
            <ellipse className="gyroRing ringTwo" cx="29" cy="29" rx="25" ry="10" />
            <ellipse className="gyroRing ringThree" cx="29" cy="29" rx="25" ry="10" />
            <path className="kronoxFourStar" d="M47 9l1.7 4.3L53 15l-4.3 1.7L47 21l-1.7-4.3L41 15l4.3-1.7z" />
          </svg>
          <span className="kronoxSpark sparkOne" />
          <span className="kronoxSpark sparkTwo" />
          <span className="kronoxSpark sparkThree" />
        </button>
      )}

      {/* 2. DISCRETE CINEMATIC SUBTITLE BAR LINKED TO KRONOX IA */}
      {!dialogueHidden &&
        ((narrative && subtitlesEnabled && Boolean(typed && typed.trim().length > 0)) ||
          panelOpen) && (
      <div
        className={`kronoxDialogueCard right ${speaking ? 'is-speaking' : ''} ${panelOpen ? 'expanded' : 'compact'}`}
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
              <span className="kronoxStatePill" data-state={resolvedState}>{resolvedState}</span>
              {speaking && (
                <div className="kronoxMiniVoiceWave" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, idx) => (
                    <i key={idx} style={{ '--bar-level': audioLevels?.[idx * 4] ?? 0.1 } as React.CSSProperties} />
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
              <div className="kronoxVoiceContextMenu" ref={menuRef}>
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
                <button type="button" className="kronoxMenuActionBtn" onClick={() => setSubtitlesEnabled((value) => !value)}>
                  {subtitlesEnabled ? 'Desactivar subtítulos' : 'Activar subtítulos'}
                </button>
                {onEndGuide && (
                  <button type="button" className="kronoxMenuActionBtn" onClick={onEndGuide}>
                    Finalizar recorrido guiado
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputQuery(e.target.value)}
                placeholder={
                  language === 'en'
                    ? 'Ask or command Kronox IA (e.g. "Take me to Barnard", "Compare epochs")...'
                    : 'Escribe una orden o consulta para Kronox IA (ej. «Llévame a Barnard», «Compara las épocas»)...'
                }
                aria-label={t('Enviar orden o consulta a Kronox', language)}
              />
              <button
                type="button"
                className={`kronoxSubActionBtn ${listeningMic ? 'is-listening' : ''}`}
                onClick={handleTogglePushToTalk}
                title="Pulsar para hablar con Kronox IA (Micrófono bajo demanda)"
                aria-label="Hablar por micrófono con Kronox IA"
              >
                {listeningMic ? '⏹ Escuchando' : '🎙️ Voz'}
              </button>
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
            {micStatus && <small role="status" className="kronoxMicStatus">{micStatus}</small>}

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
