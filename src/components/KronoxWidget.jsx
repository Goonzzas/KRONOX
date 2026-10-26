import React from 'react';

export default function KronoxWidget({
  guide,
  voice,
  accent,
  voiceError,
  near,
  onAccentChange,
  onToggleVoice,
  onMore,
  onOrbClick,
}) {
  return (
    <div className="kronoxWidget">
      <button
        className="kronoxOrb"
        aria-label="Kronox, guía astral"
        title="Kronox, guía astral"
        onClick={onOrbClick}
      >
        ✧
      </button>
      <div className="kronoxBubble">
        <div className="kronoxName">Kronox · guía astral</div>
        <p>{guide}</p>
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
      </div>
    </div>
  );
}
