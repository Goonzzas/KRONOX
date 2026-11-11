import React from 'react';

/**
 * Escena 1 ("ANTES DE LA LUZ") del prólogo cinematográfico original de KRONOX (Astral Sentinels):
 * "EL UNIVERSO QUE APRENDIMOS A VER"
 * - Comienza en oscuridad profunda con un único punto estelar luminoso central que despierta.
 * - Emergen progresivamente estrellas con temperaturas físicas diferenciadas (rojas M, solares G, azules O/B).
 * - Presenta la identidad ASTRAL SENTINELS mientras la cámara 3D revela el limbo iluminado de la Tierra.
 */
const STAR_COLORS = ['#fff9f2', '#9ec4ff', '#ffd59e', '#ff7340', '#cadcff', '#ffe8c4'];

export default function CinematicOpening({
  reducedMotion = false,
  caption = 'Durante siglos, contemplamos el universo desde un pequeño mundo, buscando respuestas entre las estrellas.',
  subtitlesEnabled = true,
  onToggleSubtitles,
  voiceBlocked = false,
  onActivateAudio,
  onSkip,
}) {
  return (
    <section
      className={'cinematicOpening' + (reducedMotion ? ' reduced' : '')}
      style={{ '--opening-duration': (reducedMotion ? 2.2 : 6.5) + 's' }}
      aria-label="Prólogo de la expedición"
      onClick={() => {
        if (voiceBlocked && onActivateAudio) onActivateAudio();
      }}
    >
      {/* Punto luminoso primordial que inaugura la Escena 1 en la oscuridad */}
      <div
        className="cinematicFirstLightPoint"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: '36%',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fffaf2',
          boxShadow: '0 0 18px 5px rgba(255, 244, 224, 0.85), 0 0 42px 12px rgba(135, 190, 255, 0.45)',
          pointerEvents: 'none',
        }}
      />

      {/* Campo estelar progresivo con temperaturas y brillos diferenciados */}
      <div className="cinematicOpeningStars" aria-hidden="true">
        {Array.from({ length: 64 }, (_, i) => {
          const color = STAR_COLORS[i % STAR_COLORS.length];
          const sizePx = i % 9 === 0 ? 3 : i % 3 === 0 ? 2.2 : 1.5;
          return (
            <i
              key={i}
              style={{
                left: ((i * 61.7) % 100) + '%',
                top: ((i * 37.1) % 100) + '%',
                width: `${sizePx}px`,
                height: `${sizePx}px`,
                background: color,
                boxShadow: sizePx > 2 ? `0 0 8px ${color}` : 'none',
                opacity: 0.22 + (i % 5) * 0.16,
              }}
            />
          );
        })}
      </div>

      <div className="cinematicOpeningTitles">
        <p className="cinematicOpeningStudio">ASTRAL SENTINELS · NASA SPHEREx</p>
        <h1>ASTRAL SENTINELS</h1>
        <p
          style={{
            margin: '4px 0 10px',
            fontSize: '0.78rem',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'rgba(186, 218, 255, 0.84)',
          }}
        >
          EL UNIVERSO QUE APRENDIMOS A VER · KRONOX
        </p>
        <span className="cinematicOpeningRule" />
        {subtitlesEnabled && <p className="cinematicOpeningStory">{caption}</p>}
      </div>

      <div className="cinematicOpeningControls">
        {voiceBlocked && onActivateAudio && (
          <button
            type="button"
            className="cinematicActivateAudioBtn"
            onClick={(e) => {
              e?.stopPropagation?.();
              onActivateAudio();
            }}
          >
            🔊 INICIAR EXPLORACIÓN
          </button>
        )}
        {onToggleSubtitles && (
          <button
            type="button"
            onClick={(e) => {
              e?.stopPropagation?.();
              onToggleSubtitles();
            }}
            aria-pressed={subtitlesEnabled}
          >
            {subtitlesEnabled ? 'CC Subtítulos: Sí' : 'CC Subtítulos: No'}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e?.stopPropagation?.();
            onSkip?.();
          }}
        >
          Omitir introducción
        </button>
      </div>
    </section>
  );
}
