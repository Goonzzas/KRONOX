import React from 'react';
import { t } from '../i18n.js';

export default function ToastNotification({ notice, onMore, language = 'es' }) {
  if (!notice) return null;
  return (
    <div className="kronoxNotice" aria-live="assertive" aria-atomic="true" key={notice.id}>
      <b>{t(notice.title, language)}</b>
      <p>{t(notice.text, language)}</p>
      {notice.planet && (
        <button onClick={() => onMore(notice.planet)}>
          {t('¿Quieres saber más? Dale aquí', language)}
        </button>
      )}
    </div>
  );
}
