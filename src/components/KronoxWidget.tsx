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

const splitIntervention = (text: string, maxLength = 180) => {
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
  const [listeningMic, setListeningMic] = useState(false);
  const [micStatus, setMicStatus] = useState('');
  const recognitionRef = useRef<any>(null);

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
        setMicStatus('Escuchando consulta por micrófono...');
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

  const categoryMeta = resolveDialogueCategory(narrative, resolvedState);
  const showSubtitleBar =
    !dialogueHidden &&
    subtitlesEnabled &&
    Boolean(narrative && narrative.id !== dismissedMessageId && (typed || intervention));

  if (!showCornerOrb && !showSubtitleBar && !panelOpen) {
    return null;
  }

  return (
    <>
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

      {/* SUBTÍTULO CINEMATOGRÁFICO INFERIOR CENTRADO (Sin aspecto de chat flotante) */}
      {showSubtitleBar && narrative && (
        <section
          className={`kronoxCinematicSubtitleBar ${categoryMeta.accentClass} ${speaking ? 'is-speaking' : ''}`}
          role="region"
          aria-live="polite"
          aria-label={t('Diálogo contextual de la entidad luminosa Kronox IA', language)}
        >
          <div className="kronoxSubtitleHeaderRow">
            <div className="kronoxSubtitleIdentity">
              <span
                className={`kronoxSubtitleOrbIcon ${speaking ? 'is-pulsing' : ''}`}
                aria-hidden="true"
              >
                <span className="kronoxSubtitleOrbCore" />
              </span>
              <span className="kronoxSubtitleSpeakerName">KRONOX IA</span>
              <span className={`kronoxSubtitleCategoryBadge ${categoryMeta.accentClass}`}>
                {categoryMeta.badge}
              </span>
              <span className="kronoxStatePill" data-state={resolvedState}>
                {resolvedState}
              </span>
              {speaking && (
                <span className="kronoxSubtitleVoiceWave" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, idx) => (
                    <i
                      key={idx}
                      style={
                        {
                          '--bar-level': audioLevels?.[idx * 5] ?? 0.35,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
              )}
            </div>

            <div className="kronoxSubtitleControls">
              {voice && (voiceFailed || voiceError) && onRetryVoice && (
                <button
                  type="button"
                  className="kronoxSubtitleGhostBtn is-warning"
                  onClick={onRetryVoice}
                  title={
                    voiceError ||
                    'Audio oficial temporalmente no disponible. Pulsa para reintentar con la voz oficial.'
                  }
                >
                  ↻ Reintentar voz
                </button>
              )}
              {onToggleVoice && (
                <button
                  type="button"
                  className="kronoxSubtitleGhostBtn"
                  onClick={onToggleVoice}
                  title={voice ? 'Silenciar voz de KRONOX IA' : 'Activar voz oficial de KRONOX IA'}
                >
                  {voice ? '🔊 Voz' : '🔇 Silencio'}
                </button>
              )}
              {onPauseSpeech && (
                <button
                  type="button"
                  className="kronoxSubtitleGhostBtn"
                  onClick={() => {
                    setTextPaused((prev) => !prev);
                    onPauseSpeech();
                  }}
                  title={textPaused || speechPaused ? 'Reanudar narración' : 'Pausar narración'}
                >
                  {textPaused || speechPaused ? '▶' : '⏸'}
                </button>
              )}
              {onRepeatSpeech && (
                <button
                  type="button"
                  className="kronoxSubtitleGhostBtn"
                  onClick={() => {
                    setTextPaused(false);
                    setTyped('');
                    onRepeatSpeech();
                  }}
                  title="Repetir locución actual"
                >
                  ↺ Repetir
                </button>
              )}
              {onOrbClick && (
                <button
                  type="button"
                  className="kronoxSubtitleGhostBtn is-consult"
                  onClick={onOrbClick}
                  title="Abrir ventana para consultar a KRONOX IA [K]"
                >
                  💬 Consultar [K]
                </button>
              )}
              <button
                type="button"
                className="kronoxSubtitleCloseBtn"
                onClick={() => setDismissedMessageId(narrative.id)}
                title="Ocultar este subtítulo"
                aria-label="Ocultar subtítulo"
              >
                ✕
              </button>
            </div>
          </div>

          <p className="kronoxSubtitleText">
            {typed || intervention}
            <span className="kronoxCursor">▍</span>
          </p>
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
                    INTELIGENCIA DE A BORDO · VOZ OFICIAL UNIFICADA (CHARON)
                  </div>
                  <h3 className="kronoxConsultTitle">CONSULTAR A KRONOX IA</h3>
                </div>
              </div>
              <div className="kronoxSubtitleControls">
                {onToggleVoice && (
                  <button
                    type="button"
                    className="kronoxSubtitleGhostBtn"
                    onClick={onToggleVoice}
                  >
                    {voice ? '🔊 Voz Activa' : '🔇 Silenciado'}
                  </button>
                )}
                <button
                  type="button"
                  className="kronoxSubtitleGhostBtn"
                  onClick={() => setSubtitlesEnabled((prev) => !prev)}
                >
                  {subtitlesEnabled ? 'CC Subtítulos: Sí' : 'CC Subtítulos: No'}
                </button>
                {onEndGuide && (
                  <button
                    type="button"
                    className="kronoxSubtitleGhostBtn"
                    onClick={onEndGuide}
                  >
                    Finalizar tutorial
                  </button>
                )}
                <button
                  type="button"
                  className="kronoxSubtitleCloseBtn"
                  onClick={onClose}
                  aria-label="Cerrar consulta a KRONOX IA"
                >
                  ✕ ESC
                </button>
              </div>
            </header>

            <div className="kronoxConsultBody">
              <p className="kronoxConsultIntro">
                Formula una consulta sobre astronomía, los instrumentos SPHEREx, las cubiertas de la
                nave o solicita navegación asistida hacia cualquier destino del catálogo.
              </p>

              {narrative?.text && (
                <div className="kronoxConsultLastReply">
                  <div className="kronoxConsultReplyHeader">
                    <span className={`kronoxSubtitleCategoryBadge ${categoryMeta.accentClass}`}>
                      {categoryMeta.badge}
                    </span>
                    {voice && (voiceFailed || voiceError) && onRetryVoice && (
                      <button
                        type="button"
                        className="kronoxSubtitleGhostBtn is-warning"
                        onClick={onRetryVoice}
                      >
                        ↻ Reintentar voz oficial
                      </button>
                    )}
                  </div>
                  <p>{narrative.text}</p>
                </div>
              )}

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
                      ✦ {missionStarting ? 'Preparando salto…' : 'Catálogo de misiones SPHEREx'}
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
                      ? 'Ask or command KRONOX IA (e.g. "Take me to Barnard", "Compare epochs")...'
                      : 'Escribe una consulta u orden para KRONOX IA (ej. «Llévame a Barnard»)...'
                  }
                  aria-label={t('Enviar orden o consulta a Kronox', language)}
                />
                <button
                  type="button"
                  className={`kronoxConsultMicBtn ${listeningMic ? 'is-listening' : ''}`}
                  onClick={handleTogglePushToTalk}
                  title="Hablar por micrófono con KRONOX IA"
                  aria-label="Hablar por micrófono con KRONOX IA"
                >
                  {listeningMic ? '⏹' : '🎙️'}
                </button>
                <button type="submit" className="kronoxConsultSendBtn">
                  {language === 'en' ? 'Transmit' : 'Transmitir'}
                </button>
              </form>
              {micStatus && (
                <small role="status" className="kronoxMicStatus">
                  {micStatus}
                </small>
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
