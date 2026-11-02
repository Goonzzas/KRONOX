import React from 'react';
import { t } from '../i18n.js';

export default function PlanetInfoModal({ planet, data, onClose, language = 'es' }) {
  if (!planet || !data) return null;
  return (
    <div className="modalShade" onClick={onClose}>
      <article
        className="infoCard"
        role="dialog"
        aria-modal="true"
        aria-label={t(`Información sobre ${t(planet, language)}`, language)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="infoHeader">
          <div>
            <h2>{t(planet, language)}</h2>
            <p>{t(data.intro, language)}</p>
          </div>
          <button onClick={onClose} aria-label={t('Cerrar ficha', language)}>
            {t('Cerrar ✕', language)}
          </button>
        </div>
        <img
          className="infoImage"
          src={data.img}
          alt={t(`Imagen de ${planet} — NASA`, language)}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <div className="infoGrid">
          {[
            [t('Superficie / estructura', language), t(data.superficie, language)],
            [t('Composición', language), t(data.composicion, language)],
            [t('Atmósfera', language), t(data.atmosfera, language)],
            [t('Temperatura', language), t(data.temperatura, language)],
            [t('Clima', language), t(data.clima, language)],
            [t('Dato curioso', language), t(data.dato, language)],
          ].map(([title, value]) => (
            <div className="infoItem" key={title}>
              <b>{title}</b>
              {value}
            </div>
          ))}
        </div>
        <div className="infoFooter">
          {t(
            'Imagen y datos: NASA. Las temperaturas de los gigantes gaseosos y helados corresponden a una capa atmosférica de referencia, no a una superficie sólida.',
            language,
          )}{' '}
          <a href={data.source} target="_blank" rel="noreferrer">
            {t(`Ficha de ${t(planet, language)} en NASA`, language)}
          </a>{' '}
          ·{' '}
          <a
            href="https://science.nasa.gov/resource/solar-system-temperatures/"
            target="_blank"
            rel="noreferrer"
          >
            {t('Temperaturas del sistema solar', language)}
          </a>
        </div>
      </article>
    </div>
  );
}
