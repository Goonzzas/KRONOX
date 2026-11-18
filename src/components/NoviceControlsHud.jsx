import React from 'react';
import { t } from '../i18n.js';

const CONTROL_ROWS = [
  { keys: ['W', 'A', 'S', 'D'], text: 'Caminar por la nave' },
  { keys: ['L'], text: 'Bloquear o liberar el ratón' },
  { keys: ['U', 'V'], text: 'Cámara 1P/3P (U) y Exterior (V)' },
  { keys: ['E'], text: 'Usar mesa SPHEREx o ascensor' },
];

export default function NoviceControlsHud({ language = 'en' }) {
  return (
    <aside className="noviceControlsHud" aria-label={t('Controles de exploración', language)}>
      <div className="noviceControlsHudTitle">{t('CONTROLES DE EXPLORACIÓN', language)}</div>
      <div className="noviceControlsHudRows">
        {CONTROL_ROWS.map(({ keys, text }) => (
          <div className="noviceControlsHudRow" key={text}>
            <span className="noviceControlsHudKeys">
              {keys.map((key) => <kbd key={key}>{key}</kbd>)}
            </span>
            <span className="noviceControlsHudDescription">{t(text, language)}</span>
          </div>
        ))}
      </div>
      <div className="noviceControlsHudHint">
        <span>＋</span> {t('sigue las flechas luminosas o haz clic en la mesa', language)}
      </div>
    </aside>
  );
}
