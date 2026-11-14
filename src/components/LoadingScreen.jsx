import React, { useEffect, useState, useRef } from 'react';
import AstralSentinelsLogo from './AstralSentinelsLogo.jsx';

const LOADING_STEPS = [
  { threshold: 18, msg: 'INICIALIZANDO MOTOR 3D Y SUBSISTEMAS KRONOX...', sys: 'SYS-01' },
  { threshold: 42, msg: 'SINCRONIZANDO EFEMÉRIDES J2000.0 Y CARTOGRAFÍA ESTELAR...', sys: 'SYS-02' },
  { threshold: 68, msg: 'CARGANDO ESPECTROMETRÍA INFRARROJA NASA SPHEREx (0.75 - 5.0 µm)...', sys: 'SYS-03' },
  { threshold: 88, msg: 'COMPILANDO SHADERS WEBGL E ILUMINACIÓN PBR...', sys: 'SYS-04' },
  { threshold: 99, msg: 'CALIBRANDO SISTEMAS DE MICROGRAVEDAD Y NAVEGACIÓN...', sys: 'SYS-05' },
  { threshold: 100, msg: 'SISTEMAS EN LÍNEA · PREPARADO PARA ABORDAJE', sys: 'READY' },
];

/**
 * Pantalla de Carga Cinematográfica de KRONOX con el logotipo vectorizado Astral Sentinels.
 * Se integra armoniosamente con la estética espacial del menú principal:
 * - Evita pantallas congeladas durante la inicialización de Three.js y shaders
 * - Presenta telemetría técnica en tiempo real y progreso suave
 * - Transición de salida fluida (fade-out + reveal) hacia el menú o cabina
 */
export default function LoadingScreen({
  isReady = false,
  onComplete,
  minDurationMs = 1200,
}) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('active'); // 'active' | 'leaving' | 'done'
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    // En entorno de pruebas de CPU (sceneHarness), evitar desincronizar frames o timers
    if (typeof globalThis !== 'undefined' && globalThis.__KRONOX_SCENE_HARNESS__) {
      setProgress(100);
      setPhase('done');
      onComplete?.();
      return;
    }

    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;

      setProgress((prev) => {
        if (isReady) {
          // Si el motor 3D y la escena ya están listos, avanzar fluidamente al 100%
          const next = prev + Math.max(3, (100 - prev) * 0.2);
          return next >= 99.5 ? 100 : next;
        }

        // Simulación progresiva fluida hasta un 88% mientras se compilan los shaders
        const targetSimulated = Math.min(88, (elapsed / minDurationMs) * 88);
        if (prev < targetSimulated) {
          return prev + Math.max(0.8, (targetSimulated - prev) * 0.14);
        }
        return prev;
      });
    }, 25);

    return () => clearInterval(interval);
  }, [isReady, minDurationMs, onComplete]);

  // Manejo del cambio a fase 'leaving' y finalización
  useEffect(() => {
    if (progress >= 100 && phase === 'active') {
      const finishTimer = setTimeout(() => {
        setPhase('leaving');
        const unmountTimer = setTimeout(() => {
          setPhase('done');
          onComplete?.();
        }, 700); // Duración de la animación de salida CSS
        return () => clearTimeout(unmountTimer);
      }, 250);
      return () => clearTimeout(finishTimer);
    }
  }, [progress, phase, onComplete]);

  if (phase === 'done') return null;

  const currentStep =
    LOADING_STEPS.find((s) => progress <= s.threshold) ||
    LOADING_STEPS[LOADING_STEPS.length - 1];

  return (
    <aside
      className={`kronox-loading-overlay${phase === 'leaving' ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando KRONOX"
    >
      {/* Fondo con atmósfera estelar y viñeta cinematográfica */}
      <div className="kronox-menu-atmosphere" aria-hidden="true">
        <div className="kronox-menu-vignette" />
        <div className="kronox-menu-stars" />
      </div>

      {/* Retícula y marcadores HUD de las esquinas */}
      <div className="kronox-loading-hud-corners" aria-hidden="true">
        <span className="hud-corner top-left" />
        <span className="hud-corner top-right" />
        <span className="hud-corner bottom-left" />
        <span className="hud-corner bottom-right" />
      </div>

      <div className="kronox-loading-container">
        {/* Cabecera técnica */}
        <header className="kronox-loading-header">
          <span className="kronox-main-menu-badge">
            PROYECTO HORIZONTE · INICIALIZACIÓN DE SISTEMAS
          </span>
        </header>

        {/* Centro: Logotipo Vectorizado Astral Sentinels */}
        <div className="kronox-loading-logo-wrapper">
          <div className="kronox-loading-aura" aria-hidden="true" />
          <AstralSentinelsLogo
            width={330}
            height={330}
            animated={true}
            glow={true}
            className="kronox-loading-brand"
          />
        </div>

        {/* Barra de progreso futurista */}
        <div className="kronox-loading-progress-block">
          <div className="kronox-loading-bar-track">
            <div
              className="kronox-loading-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            >
              <div className="kronox-loading-bar-flare" />
            </div>
            {/* Ticks de cuadrícula tecnológica */}
            <div className="kronox-loading-bar-ticks" aria-hidden="true">
              <span style={{ left: '25%' }} />
              <span style={{ left: '50%' }} />
              <span style={{ left: '75%' }} />
            </div>
          </div>

          <div className="kronox-loading-meta">
            <div className="kronox-loading-status-text">
              <span className="kronox-loading-sys-tag">[{currentStep.sys}]</span>
              <span className="kronox-loading-msg">{currentStep.msg}</span>
            </div>
            <div className="kronox-loading-pct" aria-hidden="true">
              {Math.round(progress)}%
            </div>
          </div>
        </div>

        {/* Pie de página con efemérides y telemetría */}
        <footer className="kronox-loading-footer">
          <span>CRUCERO CIENTÍFICO 120 M · ÓRBITA J2000.0</span>
          <span>·</span>
          <span>KRONOX ASTRO-PHYSICS ENGINE</span>
        </footer>
      </div>
    </aside>
  );
}
