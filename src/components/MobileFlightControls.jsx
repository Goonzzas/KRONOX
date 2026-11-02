import React from 'react';
import { t } from '../i18n.js';

export default function MobileFlightControls({
  active,
  api,
  speed,
  onSpeedChange,
  language = 'es',
}) {
  if (!active) return null;
  const directions = [
    {
      key: 'w',
      label: '▲',
      className: 'mobileUp',
      name: language === 'es' ? 'Avanzar' : 'Forward',
    },
    {
      key: 'a',
      label: '◀',
      className: 'mobileLeft',
      name: language === 'es' ? 'Izquierda' : 'Left',
    },
    {
      key: 's',
      label: '▼',
      className: 'mobileDown',
      name: language === 'es' ? 'Retroceder' : 'Back',
    },
    {
      key: 'd',
      label: '▶',
      className: 'mobileRight',
      name: language === 'es' ? 'Derecha' : 'Right',
    },
  ];
  const hold = (key, pressed) => api()?.key(key, pressed);
  return (
    <div className="mobileFlightControls" aria-label={t('Controles táctiles de vuelo', language)}>
      <div className="mobileDpad" aria-label={t('Dirección de la nave', language)}>
        {directions.map((direction) => (
          <button
            key={direction.key}
            className={direction.className}
            aria-label={direction.name}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              hold(direction.key, true);
            }}
            onPointerUp={() => hold(direction.key, false)}
            onPointerCancel={() => hold(direction.key, false)}
            onLostPointerCapture={() => hold(direction.key, false)}
          >
            {direction.label}
          </button>
        ))}
      </div>
      <div className="mobileVerticalControls">
        <button
          aria-label={t('Subir', language)}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            hold('e', true);
          }}
          onPointerUp={() => hold('e', false)}
          onPointerCancel={() => hold('e', false)}
          onLostPointerCapture={() => hold('e', false)}
        >
          ⬆
        </button>
        <button
          aria-label={t('Bajar', language)}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            hold('q', true);
          }}
          onPointerUp={() => hold('q', false)}
          onPointerCancel={() => hold('q', false)}
          onLostPointerCapture={() => hold('q', false)}
        >
          ⬇
        </button>
      </div>
      <div className="mobileSpeedControls">
        <button
          aria-label={t('Reducir velocidad', language)}
          onClick={() => onSpeedChange(Math.max(0.01, speed / 2))}
        >
          −
        </button>
        <span>
          {speed >= 1000 ? `${(speed / 1000).toFixed(1)}k` : speed.toFixed(speed < 10 ? 1 : 0)} u/s
        </span>
        <button
          aria-label={t('Aumentar velocidad', language)}
          onClick={() => onSpeedChange(Math.min(50000, speed * 2))}
        >
          +
        </button>
      </div>
    </div>
  );
}
