import React from 'react';
import { t } from '../i18n.js';

const CONTROL_ROWS = [
  { keys: ['W', 'A', 'S', 'D'], text: 'Caminar por la nave' },
  { keys: ['L'], text: 'Bloquear o liberar el cursor para mirar con el ratón' },
  { keys: ['U'], text: 'Cambiar la perspectiva del personaje' },
  { keys: ['E'], text: 'Abrir el Centro de Misión al llegar a la mesa' },
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
            <span>{t(text, language)}</span>
          </div>
        ))}
      </div>
      <div className="noviceControlsHudHint">
        <span>＋</span> {t('o haz clic directamente en la mesa táctica', language)}
      </div>
    </aside>
  );
}
