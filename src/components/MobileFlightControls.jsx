import React from 'react';

const DIRECTIONS = [
  { key: 'w', label: '▲', className: 'mobileUp', name: 'Avanzar' },
  { key: 'a', label: '◀', className: 'mobileLeft', name: 'Izquierda' },
  { key: 's', label: '▼', className: 'mobileDown', name: 'Retroceder' },
  { key: 'd', label: '▶', className: 'mobileRight', name: 'Derecha' },
];

export default function MobileFlightControls({ active, api, speed, onSpeedChange }) {
  if (!active) return null;
  const hold = (key, pressed) => api()?.key(key, pressed);
  return (
    <div className="mobileFlightControls" aria-label="Controles táctiles de vuelo">
      <div className="mobileDpad" aria-label="Dirección de la nave">
        {DIRECTIONS.map((direction) => (
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
          aria-label="Subir"
          onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold('e', true); }}
          onPointerUp={() => hold('e', false)}
          onPointerCancel={() => hold('e', false)}
          onLostPointerCapture={() => hold('e', false)}
        >
          ⬆
        </button>
        <button
          aria-label="Bajar"
          onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold('q', true); }}
          onPointerUp={() => hold('q', false)}
          onPointerCancel={() => hold('q', false)}
          onLostPointerCapture={() => hold('q', false)}
        >
          ⬇
        </button>
      </div>
      <div className="mobileSpeedControls">
        <button aria-label="Reducir velocidad" onClick={() => onSpeedChange(Math.max(0.01, speed / 2))}>−</button>
        <span>{speed >= 1000 ? `${(speed / 1000).toFixed(1)}k` : speed.toFixed(speed < 10 ? 1 : 0)} u/s</span>
        <button aria-label="Aumentar velocidad" onClick={() => onSpeedChange(Math.min(50000, speed * 2))}>+</button>
      </div>
    </div>
  );
}
