import React from 'react';

function VolumeSliderRow({ id, label, description, value, onChange }) {
  const pct = Math.round((Number.isFinite(value) ? value : 0.8) * 100);
  return (
    <div className="kronox-setting-row">
      <div>
        <label htmlFor={id}>
          <strong>{label}</strong>
        </label>
        <p>{description}</p>
      </div>
      <div className="kronox-volume-control">
        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={pct / 100}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <span className="kronox-volume-pct">{pct}%</span>
      </div>
    </div>
  );
}

/**
 * Controles compartidos de mezcla de audio (general, música, efectos/ambiente y voz)
 * y configuración de subtítulos para Menú Principal y Menú de Pausa.
 */
export function AudioSettingsGroup({
  gameSettings = {},
  onUpdateSetting,
  voiceMuted = false,
  onToggleVoiceMute,
}) {
  return (
    <div className="kronox-settings-group">
      <VolumeSliderRow
        id="kronox-vol-master"
        label="Volumen general"
        description="Controla la salida maestra de música, ambiente de cabina, efectos y voz."
        value={gameSettings.masterVolume ?? 0.85}
        onChange={(v) => onUpdateSetting('masterVolume', v)}
      />
      <VolumeSliderRow
        id="kronox-vol-music"
        label="Volumen de música"
        description="Ajusta la banda sonora cinematográfica de la secuencia de inicio."
        value={gameSettings.musicVolume ?? 0.7}
        onChange={(v) => onUpdateSetting('musicVolume', v)}
      />
      <VolumeSliderRow
        id="kronox-vol-sfx"
        label="Volumen de efectos y ambiente"
        description="Controla el zumbido del reactor, ambiente orbital y respuesta táctil de consolas."
        value={gameSettings.sfxVolume ?? 0.65}
        onChange={(v) => onUpdateSetting('sfxVolume', v)}
      />
      <VolumeSliderRow
        id="kronox-vol-voice"
        label="Volumen de voz"
        description="Ajusta el nivel de locución de KRONOX IA durante la introducción y la misión."
        value={gameSettings.voiceVolume ?? 0.95}
        onChange={(v) => onUpdateSetting('voiceVolume', v)}
      />
      <div className="kronox-setting-row">
        <div>
          <strong>Síntesis de voz de KRONOX IA</strong>
          <p>Activa o silencia las locuciones narradas manteniendo los subtítulos sincronizados.</p>
        </div>
        <button
          type="button"
          className="kronox-pause-secondary-btn"
          onClick={onToggleVoiceMute}
        >
          {voiceMuted ? 'Voz Silenciada (Activar)' : 'Voz Activa (Silenciar)'}
        </button>
      </div>
    </div>
  );
}

export function SubtitleSettingsGroup({ gameSettings = {}, onUpdateSetting }) {
  const enabled = gameSettings.showSubtitles !== false;
  const size = gameSettings.subtitleSize || 'normal';
  return (
    <div className="kronox-settings-group">
      <div className="kronox-setting-row">
        <div>
          <strong>Subtítulos en pantalla</strong>
          <p>Muestra subtítulos limpios centrados en la parte inferior durante cinemáticas y diálogos.</p>
        </div>
        <button
          type="button"
          className="kronox-pause-secondary-btn"
          onClick={() => onUpdateSetting('showSubtitles', !enabled)}
        >
          {enabled ? 'Activados' : 'Desactivados'}
        </button>
      </div>
      <div className="kronox-setting-row">
        <div>
          <strong>Tamaño de subtítulos</strong>
          <p>Ajusta la escala tipográfica para una lectura cómoda en cabina y cinemáticas.</p>
        </div>
        <select
          aria-label="Tamaño de subtítulos"
          className="kronox-setting-select"
          value={size}
          onChange={(e) => onUpdateSetting('subtitleSize', e.target.value)}
        >
          <option value="normal">Estándar</option>
          <option value="large">Grande</option>
        </select>
      </div>
    </div>
  );
}

