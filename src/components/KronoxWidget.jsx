import React, { useEffect, useState } from 'react';

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
  const isTransmitting = speaking || typed.length < guide.length;
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
    <div className={`kronoxWidget ${speaking ? 'is-speaking' : ''} ${isTransmitting ? 'is-transmitting' : ''}`}>
      <button
        className="kronoxOrb"
        aria-label="Kronox, guía astral"
        title="Kronox, guía astral"
        onClick={onOrbClick}
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
