import React, { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n.js';
import { KRONOX_QUICK_PROMPTS } from '../utils/kronoxAI.js';
import { KRONOX_LUMINOUS_STATES } from '../scene/habitableShipWorld.js';
import type { NarrativeMessage } from '../state/kronoxMessages.js';

type KronoxWidgetProps = {
  narrative: NarrativeMessage | null;
  language?: string;
  voice?: boolean;
  accent?: string;
  near?: string | null;
  voiceError?: string;
  voiceFailed?: boolean;
  onRetryVoice?: () => void;
  speaking?: boolean;
  audioLevels?: number[];
  panelOpen?: boolean;
  dialogueHidden?: boolean;
  showSubtitles?: boolean;
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

type DialogueCategory = {
  id: 'tutorial' | 'response' | 'narrative';
  badge: string;
  accentClass: string;
};

function resolveDialogueCategory(
  msg: NarrativeMessage | null,
  avatarState?: string,
): DialogueCategory {
  if (!msg) {
    return { id: 'narrative', badge: 'DIÁLOGO NARRATIVO', accentClass: 'is-narrative' };
  }
  const id = String(msg.id || '').toLowerCase();
  const intent = String((msg as { intent?: string }).intent || '').toLowerCase();
  const state = String(avatarState || '').toLowerCase();
  if (
    intent === 'orientation' ||
    id.startsWith('tut-') ||
    id.startsWith('guide-') ||
    id.includes('tour') ||
    state.includes('orient') ||
    state.includes('instruc')
  ) {
    return {
      id: 'tutorial',
      badge: 'INDICACIÓN DEL TUTORIAL',
      accentClass: 'is-tutorial',
    };
  }
  if (
    intent === 'response' ||
    id.startsWith('reply-') ||
    id.startsWith('query-') ||
    state.includes('respuesta')
  ) {
    return {
      id: 'response',
      badge: 'RESPUESTA A CONSULTA',
      accentClass: 'is-response',
    };
  }
  return {
    id: 'narrative',
    badge: 'DIÁLOGO NARRATIVO',
    accentClass: 'is-narrative',
  };
}

const splitIntervention = (text: string, maxLength = 148) => {
  const pieces: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    let cut = Math.max(
      remaining.lastIndexOf('. ', maxLength),
      remaining.lastIndexOf('! ', maxLength),
      remaining.lastIndexOf('? ', maxLength),
    );
    if (cut < 55) cut = remaining.lastIndexOf(' ', maxLength);
    if (cut < 1) cut = maxLength;
    pieces.push(
      remaining
        .slice(
          0,
          cut +
            (remaining[cut] === '.' || remaining[cut] === '!' || remaining[cut] === '?' ? 1 : 0),
        )
        .trim(),
    );
    remaining = remaining.slice(cut + 1).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
};

export default function KronoxWidget({
  narrative,
  language = 'es',
  voice = true,
  voiceError = '',
  voiceFailed = false,
  onRetryVoice,
  speaking = false,
  audioLevels,
  panelOpen = false,
  onClose,
  onToggleVoice,
  onOrbClick,
  onStartMission,
  missionStarting = false,
  onCommand,
  onRepeatSpeech,
  onPauseSpeech,
  speechPaused = false,
  avatarState = 'Reposo',
  history = [],
  aiProjection = null,
  dialogueHidden = false,
  showSubtitles = true,
  showCornerOrb = false,
  onMessageComplete,
  onEndGuide,
}: KronoxWidgetProps) {
  const [typed, setTyped] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [textPaused, setTextPaused] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [dismissedMessageId, setDismissedMessageId] = useState<string | null>(null);
  const [partIndex, setPartIndex] = useState(0);
  const [consultMode, setConsultMode] = useState<'chat' | 'voice'>('chat');
  const [listeningMic, setListeningMic] = useState(false);
  const [processingMic, setProcessingMic] = useState(false);
  const [micStatus, setMicStatus] = useState('');
  const recognitionRef = useRef<any>(null);
  const micTimerRef = useRef<any>(null);

  const interventions = useMemo(
    () => splitIntervention(narrative?.text || ''),
    [narrative?.id, narrative?.text],
  );
  const intervention = interventions[partIndex] || '';

  const stateMap: Record<string, string> = {
    IDLE: 'Reposo',
    LISTENING: 'Escucha',
    TALKING: 'Comunicación',
    EXPLAINING: 'Explicación',
    POINTING: 'Señalización',
    GREETING: 'Acompañamiento',
    CELEBRATING: 'Celebración',
  };
  const rawState = aiProjection?.state || avatarState;
  const resolvedState: string =
    stateMap[rawState] ||
    (KRONOX_LUMINOUS_STATES.includes(rawState) ? rawState : 'Acompañamiento');

  const activeMessageKeyRef = useRef('');

  useEffect(() => {
    setTyped('');
    setTextPaused(false);
    setPartIndex(0);
    setDismissedMessageId(null);
  }, [narrative?.id]);

  useEffect(() => {
    if (textPaused || speechPaused) return undefined;
    const text = intervention;
    const msgKey = `${narrative?.id || ''}#${partIndex}#${text}`;
    const switchedMessage = activeMessageKeyRef.current !== msgKey;
    activeMessageKeyRef.current = msgKey;
    if (!text) {
      setTyped('');
      return undefined;
    }
    let idx = switchedMessage ? 0 : typed.length;
    if (switchedMessage) setTyped('');
    if (idx >= text.length) return undefined;
    const nowFn = () =>
      typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let lastTs = nowFn();
    const timer = setInterval(() => {
      const now = nowFn();
      const dtMs = Math.max(16, now - lastTs);
      lastTs = now;
      const step = Math.max(4, Math.round(dtMs * 0.28));
      idx = Math.min(text.length, idx + step);
      setTyped(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(timer);
      }
    }, 22);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrative?.id, partIndex, intervention, textPaused, speechPaused]);

  useEffect(() => {
    if (
      !narrative ||
      !intervention ||
      typed.length < intervention.length ||
      textPaused ||
      speechPaused
    )
      return undefined;
    if (partIndex < interventions.length - 1) {
      const wordCount = Math.max(1, intervention.trim().split(/\s+/).length);
      const holdMs = Math.max(2400, Math.min(6000, wordCount * 270));
      const timer = setTimeout(() => {
        setPartIndex((index) => index + 1);
        setTyped('');
      }, holdMs);
      return () => clearTimeout(timer);
    }
    if (!speaking) {
      const timer = setTimeout(() => onMessageComplete?.(narrative.id), 3600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [
    narrative,
    intervention,
    interventions.length,
    partIndex,
    typed.length,
    textPaused,
    speechPaused,
    speaking,
    onMessageComplete,
  ]);

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

  const handleTogglePushToTalk = async () => {
    clearTimeout(micTimerRef.current);
    if (listeningMic && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setListeningMic(false);
      setMicStatus('');
      return;
    }

    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor) {
      setMicStatus('Reconocimiento de voz no disponible en este navegador. Usa el chat escrito [K].');
      micTimerRef.current = setTimeout(() => setMicStatus(''), 4200);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((tr) => tr.stop());
      } catch {
        setListeningMic(false);
        setMicStatus('Permiso de micrófono denegado. Habilita el micrófono en el navegador.');
        micTimerRef.current = setTimeout(() => setMicStatus(''), 4200);
        return;
      }
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'en' ? 'en-US' : 'es-ES';

      recognition.onstart = () => {
        setListeningMic(true);
        setProcessingMic(false);
        setMicStatus('🎙️ Escuchando a través del micrófono... Habla ahora con KRONOX IA.');
      };

      recognition.onresult = (event: any) => {
        const results = event?.results;
        const lastResult = results?.[results.length - 1];
        const transcript = lastResult?.[0]?.transcript?.trim() || '';
        const isFinal = Boolean(lastResult?.isFinal);
        if (transcript) {
          setInputQuery(transcript);
          if (!isFinal) {
            setMicStatus(`🎙️ Escuchando: «${transcript}»...`);
            return;
          }
          setListeningMic(false);
          setProcessingMic(true);
          setMicStatus(`⏳ Procesando consulta: «${transcript}»...`);
          onCommand?.(transcript);
          micTimerRef.current = setTimeout(() => {
            setProcessingMic(false);
            setMicStatus('');
          }, 2600);
        }
      };

      recognition.onerror = () => {
        setListeningMic(false);
        setProcessingMic(false);
        setMicStatus('No se detectó voz o permiso de micrófono denegado.');
        micTimerRef.current = setTimeout(() => setMicStatus(''), 3800);
      };

      recognition.onend = () => {
        setListeningMic(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListeningMic(false);
      setProcessingMic(false);
      setMicStatus('No fue posible iniciar el micrófono bajo demanda.');
      micTimerRef.current = setTimeout(() => setMicStatus(''), 3800);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onExternalMic = () => {
      handleTogglePushToTalk();
    };
    const onEscClose = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelOpen) {
        onClose?.();
      }
    };
    window.addEventListener('kronox:toggle-mic', onExternalMic);
    window.addEventListener('keydown', onEscClose);
    return () => {
      window.removeEventListener('kronox:toggle-mic', onExternalMic);
      window.removeEventListener('keydown', onEscClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listeningMic, panelOpen, language]);

  const categoryMeta = resolveDialogueCategory(narrative, resolvedState);
  const showSubtitleBar =
    !dialogueHidden &&
    showSubtitles &&
    subtitlesEnabled &&
    Boolean(narrative && narrative.id !== dismissedMessageId && (typed || intervention));
  const showFloatingMicPill = Boolean((listeningMic || processingMic || micStatus) && !panelOpen);

  if (!showCornerOrb && !showSubtitleBar && !panelOpen && !showFloatingMicPill) {
    return null;
  }

  return (
    <>
      {showFloatingMicPill && (
        <div
          className={`kronoxFloatingMicBanner ${listeningMic ? 'is-listening' : ''} ${processingMic ? 'is-processing' : ''}`}
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: showSubtitleBar ? '152px' : '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 48,
            background: listeningMic
              ? 'rgba(15, 23, 42, 0.94)'
              : 'rgba(9, 18, 34, 0.92)',
            border: listeningMic
              ? '1px solid rgba(52, 211, 153, 0.65)'
              : '1px solid rgba(56, 189, 248, 0.5)',
            borderRadius: '999px',
            padding: '8px 18px',
            color: '#f8fafc',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.65)',
          }}
        >
          <span>{micStatus || (listeningMic ? '🎙️ Escuchando...' : '⏳ Procesando...')}</span>
          {listeningMic && (
            <button
              type="button"
              className="kronoxSubtitleGhostBtn"
              onClick={handleTogglePushToTalk}
              style={{ padding: '2px 8px', fontSize: '0.74rem' }}
            >
              Detener
            </button>
          )}
        </div>
      )}
      {showCornerOrb && (
        <button
          type="button"
          className={`kronoxOrb kronoxCornerOrb ${speaking ? 'is-transmitting' : ''}`}
          onClick={onOrbClick}
          title={panelOpen ? 'Cerrar consulta a KRONOX IA' : 'Consultar a KRONOX IA [K]'}
          aria-label={panelOpen ? 'Cerrar consulta a KRONOX IA' : 'Consultar a KRONOX IA'}
          aria-expanded={Boolean(panelOpen)}
        >
          <span className="kronoxCore" />
          <svg className="kronoxGyro" viewBox="0 0 58 58" aria-hidden="true">
            <ellipse className="gyroRing ringOne" cx="29" cy="29" rx="25" ry="10" />
            <ellipse className="gyroRing ringTwo" cx="29" cy="29" rx="25" ry="10" />
            <ellipse className="gyroRing ringThree" cx="29" cy="29" rx="25" ry="10" />
            <path
              className="kronoxFourStar"
              d="M47 9l1.7 4.3L53 15l-4.3 1.7L47 21l-1.7-4.3L41 15l4.3-1.7z"
            />
          </svg>
          <span className="kronoxSpark sparkOne" />
          <span className="kronoxSpark sparkTwo" />
          <span className="kronoxSpark sparkThree" />
        </button>
      )}

      {/* SUBTÍTULO DISCRETO DE VIDEOJUEGO INFERIOR CENTRADO (Sin controles de conversación) */}
      {showSubtitleBar && narrative && (
        <section
          className={`kronoxCinematicSubtitleBar ${categoryMeta.accentClass} ${speaking ? 'is-speaking' : ''}`}
          role="status"
          aria-live="polite"
          aria-label={t('Subtítulo de KRONOX IA', language)}
        >
          <div className="kronoxSubtitleCompactSpeaker">
            <span className="kronoxSubtitleSpeakerTag">KRONOX IA</span>
            {speaking && (
              <span className="kronoxSubtitleVoiceWave" aria-hidden="true">
                {Array.from({ length: 4 }, (_, idx) => (
                  <i
                    key={idx}
                    style={
                      {
                        '--bar-level': audioLevels?.[idx * 6] ?? 0.35,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            )}
          </div>
          <p className="kronoxSubtitleText">{typed || intervention}</p>
        </section>
      )}

      {/* VENTANA MODAL DE CONSULTA A KRONOX IA (Sólo se abre cuando el jugador lo solicita) */}
      {panelOpen && (
        <div
          className="kronoxConsultModalBackdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Consultar a KRONOX IA"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <aside className="kronoxConsultModalCard">
            <header className="kronoxConsultModalHeader">
              <div className="kronoxSubtitleIdentity">
                <span
                  className={`kronoxSubtitleOrbIcon ${speaking ? 'is-pulsing' : ''}`}
                  aria-hidden="true"
                >
                  <span className="kronoxSubtitleOrbCore" />
                </span>
                <div>
                  <div className="kronoxConsultKicker">
                    INTELIGENCIA DE A BORDO · COMUNICACIÓN CON KRONOX IA
                  </div>
                  <h3 className="kronoxConsultTitle">KRONOX IA</h3>
                </div>
              </div>
              <div className="kronoxSubtitleControls">
                {onToggleVoice && (
                  <button
                    type="button"
                    className="kronoxSubtitleGhostBtn"
                    onClick={onToggleVoice}
                  >
                    {voice ? '🔊 Voz activa' : '🔇 Silenciado'}
                  </button>
                )}
                {onRepeatSpeech && narrative?.text && (
                  <button
                    type="button"
                    className="kronoxSubtitleGhostBtn"
                    onClick={() => onRepeatSpeech?.()}
                  >
                    ↺ Repetir
                  </button>
                )}
                <button
                  type="button"
                  className="kronoxSubtitleGhostBtn"
                  onClick={() => setSubtitlesEnabled((prev) => !prev)}
                >
                  {subtitlesEnabled ? 'CC Subtítulos: Sí' : 'CC Subtítulos: No'}
                </button>
                <button
                  type="button"
                  className="kronoxSubtitleCloseBtn"
                  onClick={onClose}
                  aria-label="Cerrar KRONOX IA"
                >
                  ✕ ESC
                </button>
              </div>
            </header>

            <div className="kronoxConsultModeSwitch" role="tablist" aria-label="Canal de comunicación">
              <button
                type="button"
                role="tab"
                aria-selected={consultMode === 'chat'}
                className={`kronoxConsultModeBtn${consultMode === 'chat' ? ' is-active' : ''}`}
                onClick={() => setConsultMode('chat')}
              >
                💬 Chat escrito
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={consultMode === 'voice'}
                className={`kronoxConsultModeBtn${consultMode === 'voice' ? ' is-active' : ''}`}
                onClick={() => setConsultMode('voice')}
              >
                🎙️ Micrófono de voz
              </button>
            </div>

            <div className="kronoxConsultBody">
              {narrative?.text && (
                <div className="kronoxConsultLastReply">
                  <div className="kronoxConsultReplyHeader">
                    <span className={`kronoxSubtitleCategoryBadge ${categoryMeta.accentClass}`}>
                      KRONOX IA · {categoryMeta.badge}
                    </span>
                    {voice && (voiceFailed || voiceError) && onRetryVoice && (
                      <button
                        type="button"
                        className="kronoxSubtitleGhostBtn is-warning"
                        onClick={onRetryVoice}
                      >
                        ↻ Reintentar voz
                      </button>
                    )}
                  </div>
                  <p>{narrative.text}</p>
                </div>
              )}

              {consultMode === 'voice' ? (
                <div className="kronoxConsultVoiceBox">
                  <p className="kronoxConsultIntro">
                    Activa el micrófono bajo demanda para hablar directamente con KRONOX IA sobre astronomía, sistemas de la nave o navegación.
                  </p>
                  <button
                    type="button"
                    className={`kronoxVoicePrimaryBtn${listeningMic ? ' is-listening' : ''}`}
                    onClick={handleTogglePushToTalk}
                  >
                    {listeningMic ? '⏹ Detener escucha de micrófono' : '🎙️ Pulsar para hablar por micrófono'}
                  </button>
                  {micStatus && (
                    <small role="status" className="kronoxMicStatus">
                      {micStatus}
                    </small>
                  )}
                  {inputQuery && (
                    <div className="kronoxVoiceTranscriptPreview">
                      <span>Transcripción:</span>
                      <strong>«{inputQuery}»</strong>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="kronoxConsultQuickSection">
                    <span className="kronoxConsultSectionLabel">CONSULTAS Y ÓRDENES FRECUENTES:</span>
                    <div className="kronoxConsultChipGrid">
                      {KRONOX_QUICK_PROMPTS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="kronoxConsultChip"
                          onClick={() => handleQuickPrompt(item.query)}
                        >
                          {t(item.label, language)}
                        </button>
                      ))}
                      {onStartMission && (
                        <button
                          type="button"
                          className="kronoxConsultChip is-highlight"
                          onClick={onStartMission}
                          disabled={missionStarting}
                        >
                          ✦ {missionStarting ? 'Preparando salto…' : 'Misiones SPHEREx'}
                        </button>
                      )}
                    </div>
                  </div>

                  {history.length > 0 && (
                    <div className="kronoxAiHistory">
                      {history.slice(-3).map((item, idx) => (
                        <div key={idx} className="kronoxAiHistoryRow">
                          <span className="kronoxAiUserQuery">▸ {item.query}</span>
                          {item.actionLabel && (
                            <span className="kronoxAiExecTag">✓ {item.actionLabel}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <form className="kronoxConsultInputRow" onSubmit={handleSubmit}>
                    <input
                      type="text"
                      value={inputQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setInputQuery(e.target.value)
                      }
                      placeholder={
                        language === 'en'
                          ? 'Ask or command KRONOX IA (e.g. "Take me to Barnard")...'
                          : 'Escribe tu consulta u orden para KRONOX IA (ej. «Llévame a Barnard»)...'
                      }
                      aria-label={t('Enviar orden o consulta a Kronox', language)}
                    />
                    <button type="submit" className="kronoxConsultSendBtn">
                      {language === 'en' ? 'Transmit' : 'Enviar'}
                    </button>
                  </form>
                </>
              )}

              {voiceError && (
                <small role="status" className="kronoxVoiceErrorNote">
                  {voiceError}
                </small>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
