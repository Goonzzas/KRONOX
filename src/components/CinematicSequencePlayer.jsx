import React, { useEffect, useRef, useState } from 'react';

/**
 * Official 5 Pre-recorded Cinematic Scenes for KRONOX.
 * Each scene points to an original rendered video asset in `/cinematics/`
 * with its corresponding poster frame, synchronized narration, and camera telemetry.
 */
export const KRONOX_CINEMATIC_SCENES = [
  {
    id: 'scene-01',
    code: 'ESCENA 01 / 05',
    title: 'La nave en el cosmos',
    telemetry: 'CRUCERO INTERPLANETARIO · ESCALA FÍSICA 120 m · PROPULSIÓN ACTIVA',
    videoSrc: '/cinematics/scene01_cosmos.mp4',
    posterSrc: '/cinematics/poster01_cosmos.jpg',
    narration:
      'En la inmensidad del brazo de Orión, la nave científica KRONOX avanza a través del cosmos. No somos espectadores pasivos: formamos parte de una expedición astronómica diseñada para explorar el universo tridimensional.',
  },
  {
    id: 'scene-02',
    code: 'ESCENA 02 / 05',
    title: 'Aproximación a la nave',
    telemetry: 'VECTOR DE ATRAQUE · ESTRUCTURA CASCO PRINCIPAL · TOBERAS IÓNICAS',
    videoSrc: '/cinematics/scene02_approach.mp4',
    posterSrc: '/cinematics/poster02_approach.jpg',
    narration:
      'Nos aproximamos a la estructura de 120 metros de eslora de KRONOX. Sus sensores ópticos e infrarrojos están sincronizados con los catálogos astrométricos de Gaia y el archivo espacial de la NASA.',
  },
  {
    id: 'scene-03',
    code: 'ESCENA 03 / 05',
    title: 'Entrada a la cabina de mando',
    telemetry: 'TRANSFERENCIA A 1ª PERSONA · PUENTE DE MANDO · 5 ESTACIONES EN LÍNEA',
    videoSrc: '/cinematics/scene03_cockpit.mp4',
    posterSrc: '/cinematics/poster03_cockpit.jpg',
    narration:
      'Bienvenido al puente de mando, astronauta. Frente a ti tienes las ventanas panorámicas de observación y las cinco estaciones operativas: Navegación, Ciencia, Misiones, Comunicaciones y Observación.',
  },
  {
    id: 'scene-04',
    code: 'ESCENA 04 / 05',
    title: 'Primera comunicación · Activación de Kronox IA',
    telemetry: 'PROYECCIÓN HOLOGRÁFICA 3D · MATRIZ COGNITIVA EN LÍNEA',
    videoSrc: '/cinematics/scene04_ai_greeting.mp4',
    posterSrc: '/cinematics/poster04_ai_greeting.jpg',
    narration:
      'Saludos, explorador. Soy Kronox, la inteligencia tridimensional de a bordo. Te acompañaré en cada salto espacial, responderé a tus órdenes de rumbo y te guiaré en el análisis científico.',
  },
  {
    id: 'scene-05',
    code: 'ESCENA 05 / 05',
    title: 'Misiones científicas reales con NASA SPHEREx',
    telemetry: 'ARCHIVO IRSA / NASA SPHEREx · BANDA INFRARROJA D1–D6 · ÉPOCAS REALES',
    videoSrc: '/cinematics/scene05_missions.mp4',
    posterSrc: '/cinematics/poster05_missions.jpg',
    narration:
      'Nuestra misión une la exploración espacial con datos astronómicos reales del telescopio SPHEREx de la NASA. Compararemos observaciones en distintas épocas para descubrir estrellas con movimiento propio y variabilidad infrarroja.',
  },
];

export default function CinematicSequencePlayer({
  open = false,
  onComplete,
  onSkip,
  onSceneChange,
  speakNarration,
  voiceEnabled = false,
  onToggleVoice,
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  const currentScene = KRONOX_CINEMATIC_SCENES[sceneIndex] || KRONOX_CINEMATIC_SCENES[0];

  useEffect(() => {
    if (!open) return undefined;
    setSceneIndex(0);
    setVideoFailed(false);
    setProgress(0);
    setIsPlaying(true);
    return () => {
      clearInterval(fallbackTimerRef.current);
    };
  }, [open]);

  // Trigger voice narration and notify parent when scene changes
  useEffect(() => {
    if (!open) return;
    setVideoFailed(false);
    setProgress(0);
    if (onSceneChange) onSceneChange(sceneIndex, currentScene);
    if (voiceEnabled && speakNarration) {
      speakNarration(currentScene.narration);
    }
  }, [open, sceneIndex]);

  // Fallback timer when video cannot play or finishes
  useEffect(() => {
    if (!open || !videoFailed) return undefined;
    const durationMs = 6500;
    const startedAt = Date.now();
    fallbackTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      if (elapsed >= durationMs) {
        clearInterval(fallbackTimerRef.current);
        advanceScene();
      }
    }, 100);
    return () => clearInterval(fallbackTimerRef.current);
  }, [open, videoFailed, sceneIndex]);

  if (!open) return null;

  const advanceScene = () => {
    if (sceneIndex + 1 < KRONOX_CINEMATIC_SCENES.length) {
      setSceneIndex((prev) => prev + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  const prevScene = () => {
    if (sceneIndex > 0) {
      setSceneIndex((prev) => prev - 1);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    setProgress(Math.min(100, (vid.currentTime / vid.duration) * 100));
  };

  const handleReplayScene = () => {
    if (speakNarration && voiceEnabled) {
      speakNarration(currentScene.narration);
    }
    const vid = videoRef.current;
    if (vid && !videoFailed) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
  };

  return (
    <div
      className="kronoxCinematicOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Secuencia cinematográfica pregrabada: ${currentScene.title}`}
    >
      {/* Pre-recorded Video Viewport with progressive loading (preload="metadata") */}
      <div className="kronoxCinematicViewport">
        {!videoFailed ? (
          <video
            key={currentScene.id}
            ref={videoRef}
            className="kronoxCinematicVideo"
            src={currentScene.videoSrc}
            poster={currentScene.posterSrc}
            preload="metadata"
            autoPlay
            muted
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={advanceScene}
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <div
            className="kronoxCinematicFallback"
            style={{ backgroundImage: `url(${currentScene.posterSrc})` }}
          >
            <div className="kronoxFallbackNote">
              <span>MODO VISUAL DE RESPALDO · ESCENA {sceneIndex + 1}</span>
            </div>
          </div>
        )}

        {/* Cinematic Letterbox & Top HUD */}
        <div className="kronoxCinematicTopBar">
          <div className="kronoxCinematicBadgeGroup">
            <span className="kronoxPrerecordedTag">
              ● SECUENCIA CINEMATOGRÁFICA PREGRABADA ({currentScene.code})
            </span>
            <span className="kronoxCinematicTelemetry">{currentScene.telemetry}</span>
          </div>

          <div className="kronoxCinematicTopActions">
            {onToggleVoice && (
              <button
                type="button"
                className={`kronoxCinematicAudioBtn ${voiceEnabled ? 'active' : ''}`}
                onClick={onToggleVoice}
              >
                {voiceEnabled ? '🔊 Narración activa' : '🔇 Activar voz'}
              </button>
            )}
            <button
              type="button"
              className="kronoxCinematicReplayBtn"
              onClick={handleReplayScene}
              title="Repetir escena y narración"
            >
              ↺ Repetir escena
            </button>
            <button
              type="button"
              className="kronoxCinematicSkipBtn"
              onClick={onSkip || onComplete}
            >
              Saltar introducción ⏭
            </button>
          </div>
        </div>

        {/* Synchronized Subtitles & Scene Controls */}
        <div className="kronoxCinematicBottomBar">
          <div className="kronoxCinematicSubtitleBox" aria-live="polite">
            <div className="kronoxSubtitleHeader">
              <strong>{currentScene.title}</strong>
              <div className="kronoxSceneStepDots">
                {KRONOX_CINEMATIC_SCENES.map((sc, idx) => (
                  <button
                    key={sc.id}
                    type="button"
                    className={`kronoxSceneDot ${idx === sceneIndex ? 'active' : ''} ${idx < sceneIndex ? 'done' : ''}`}
                    onClick={() => setSceneIndex(idx)}
                    aria-label={`Ir a ${sc.code}: ${sc.title}`}
                  />
                ))}
              </div>
            </div>
            <p className="kronoxSubtitleText">«{currentScene.narration}»</p>
            <div className="kronoxSceneProgressBar">
              <div className="kronoxSceneProgressFill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="kronoxCinematicNavBtns">
            <button
              type="button"
              className="kronoxCineNavBtn"
              onClick={prevScene}
              disabled={sceneIndex === 0}
            >
              ◀ Anterior
            </button>
            <button
              type="button"
              className="kronoxCineNavBtn primary"
              onClick={advanceScene}
            >
              {sceneIndex + 1 < KRONOX_CINEMATIC_SCENES.length
                ? 'Siguiente escena ▶'
                : 'Entrar a la cabina interactiva ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

