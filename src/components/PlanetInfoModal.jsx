import React, { useEffect, useRef } from 'react';
import { t } from '../i18n.js';

export default function PlanetInfoModal({ planet, data, onClose, onExplore, language = 'es' }) {
  const cardRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!planet) return undefined;
    const previousFocus = document.activeElement;
    cardRef.current?.querySelector('button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const focusable = [...(cardRef.current?.querySelectorAll('button, a[href]') || [])];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [planet]);
  if (!planet || !data) return null;
  return (
    <div className="modalShade" onClick={onClose}>
      <article
        ref={cardRef}
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
        <div className="infoActions">
          <button type="button" className="infoExploreButton" onClick={onExplore}>
            {language === 'en'
              ? `Explore ${t(planet, language)}`
              : `Explorar ${t(planet, language)}`}{' '}
            <span aria-hidden="true">↗</span>
          </button>
          <button type="button" onClick={onClose}>
            {language === 'en' ? 'Return to the solar system' : 'Volver al sistema solar'}
          </button>
        </div>
      </article>
    </div>
  );
}
