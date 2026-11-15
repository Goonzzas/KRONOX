import React from 'react';
import { GEMINI_TTS_VOICES } from '../utils/voiceProvider.js';
import { t } from '../i18n.js';

function localize(node, language) {
  if (language !== 'en' || !React.isValidElement(node)) return node;
  const props = { ...node.props };
  for (const key of ['aria-label', 'title', 'placeholder', 'alt']) {
    if (typeof props[key] === 'string') props[key] = t(props[key], language);
  }
  if (props.children !== undefined) {
    props.children = React.Children.map(props.children, (child) => {
      if (typeof child === 'string') {
        const trimmed = child.trim();
        return trimmed ? child.replace(trimmed, t(trimmed, language)) : child;
      }
      return localize(child, language);
    });
  }
  return React.cloneElement(node, props);
}

function VolumeSliderRow({ id, label, description, value, onChange, language = 'en' }) {
  const pct = Math.round((Number.isFinite(value) ? value : 0.8) * 100);
  return localize((
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
  ), language);
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
  onTestVoice,
  language = 'en',
}) {
  const canonicalVoice = GEMINI_TTS_VOICES[0] || {
    id: 'Charon',
    label: 'Charon · Voz Oficial KRONOX IA',
  };
  return localize((
    <div className="kronox-settings-group">
      <VolumeSliderRow
        id="kronox-vol-master"
        language={language}
        label="Volumen general"
        description="Controla la salida maestra de música, ambiente de cabina, efectos y voz."
        value={gameSettings.masterVolume ?? 0.85}
        onChange={(v) => onUpdateSetting('masterVolume', v)}
      />
      <VolumeSliderRow
        id="kronox-vol-music"
        language={language}
        label="Volumen de música"
        description="Ajusta la banda sonora cinematográfica inicial y la música espacial adaptativa."
        value={gameSettings.musicVolume ?? 0.38}
        onChange={(v) => onUpdateSetting('musicVolume', v)}
      />
      <VolumeSliderRow
        id="kronox-vol-sfx"
        language={language}
        label="Volumen de efectos y ambiente"
        description="Controla el zumbido del reactor, ambiente por cubiertas, ascensor, propulsores y respuesta táctil."
        value={gameSettings.sfxVolume ?? 0.65}
        onChange={(v) => onUpdateSetting('sfxVolume', v)}
      />
      <VolumeSliderRow
        id="kronox-vol-voice"
        language={language}
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
      <div className="kronox-setting-row">
        <div>
          <strong>Voz neuronal oficial de KRONOX IA (Google Gemini HD)</strong>
          <p>
            Voz única e invariable de estudio ({canonicalVoice.id}) con rotación automática de claves
            en servidor para evitar cambios de timbre.
          </p>
        </div>
        <div className="kronox-voice-picker-control">
          <span className="kronox-setting-pill" aria-label="Voz oficial única de KRONOX IA">
            {canonicalVoice.label}
          </span>
          {onTestVoice && (
            <button
              type="button"
              className="kronox-pause-secondary-btn"
              onClick={() => onTestVoice(canonicalVoice.id)}
            >
              Probar voz
            </button>
          )}
        </div>
      </div>
    </div>
  ), language);
}

export function SubtitleSettingsGroup({ gameSettings = {}, onUpdateSetting, language = 'en' }) {
  const enabled = gameSettings.showSubtitles !== false;
  const size = gameSettings.subtitleSize || 'normal';
  return localize((
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
  ), language);
}

