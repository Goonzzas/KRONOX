import React, { useEffect, useRef, useState } from 'react';

export default function KronoxWidget({
  guide,
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
}) {
  const [typed, setTyped] = useState('');
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
    setTimeout(() => { movedRef.current = false; }, 0);
  };
  useEffect(() => {
    setTyped('');
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTyped(guide.slice(0, index));
      if (index >= guide.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [guide]);
  return (
    <div
      className={`kronoxWidget ${position ? 'is-positioned' : ''} ${speaking ? 'is-speaking' : ''} ${isTransmitting ? 'is-transmitting' : ''} ${panelOpen ? 'panel-visible' : ''}`}
      style={widgetStyle}
      data-panel-side={panelSide}
    >
      <button
        className="kronoxOrb"
        aria-label="Kronox, guía astral"
        title="Kronox, guía astral"
        onClick={(event) => {
          if (movedRef.current) {
            event.preventDefault();
            return;
          }
          onOrbClick();
        }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="kronoxCore" />
        <svg className="kronoxGyro" viewBox="0 0 100 100" aria-hidden="true">
          <ellipse className="gyroRing ringOne" cx="50" cy="50" rx="39" ry="17" />
          <ellipse className="gyroRing ringTwo" cx="50" cy="50" rx="39" ry="17" />
          <ellipse className="gyroRing ringThree" cx="50" cy="50" rx="39" ry="17" />
          <path className="kronoxFourStar" d="M50 7 57 43 93 50 57 57 50 93 43 57 7 50 43 43Z" />
        </svg>
        <i className="kronoxSpark sparkOne" />
        <i className="kronoxSpark sparkTwo" />
        <i className="kronoxSpark sparkThree" />
      </button>
      {panelOpen && <div className={`kronoxBubble ${isTransmitting ? 'transmitting' : ''}`}>
        <div className="kronoxPanelTop">
          <div className="kronoxName">Kronox · guía astral</div>
          <span className="kronoxStatus"><i />{speaking ? 'transmitiendo…' : 'en línea'}</span>
          <button className="kronoxClose" aria-label="Cerrar panel de Kronox" onClick={onClose}>×</button>
        </div>
        <div className="kronoxVoiceBars" aria-hidden="true">
          {Array.from({ length: 48 }, (_, index) => (
            <i key={index} style={{ '--bar-level': audioLevels?.[index] ?? 0.08 }} />
          ))}
        </div>
        <p aria-live="polite">{typed}<span className="kronoxCursor">▍</span></p>
        <button onClick={onToggleVoice}>{voice ? 'Silenciar voz' : 'Activar voz'}</button>
        {voice && (
          <label className="r" style={{ fontSize: 12, marginBottom: 0 }}>
            Acento de Kronox{' '}
            <select value={accent} onChange={(event) => onAccentChange(event.target.value)}>
              <option value="es-US">Latino</option>
              <option value="es-ES">España</option>
            </select>
          </label>
        )}
        {voice && (
          <small>
            La voz alternativa requiere internet y envía los avisos de Kronox a Google para generar
            el audio.
          </small>
        )}
        {voiceError && <small role="status">{voiceError}</small>}
        {near && <button onClick={() => onMore(near)}>¿Quieres saber más? Dale aquí</button>}
        <div className="kronoxMissionOffer">
          <span>SEÑAL NUEVA · SPHEREx</span>
          <p>¿Rastreamos estrellas en movimiento o comparamos el brillo de estrellas variables?</p>
          <button onClick={onStartMission} disabled={missionStarting}>
            {missionStarting ? 'Preparando el salto…' : 'Elegir misión'}
          </button>
        </div>
      </div>}
    </div>
  );
}
