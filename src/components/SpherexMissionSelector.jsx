import React from 'react';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { t } from '../i18n.js';

export default function SpherexMissionSelector({ onSelect, onClose, language = 'es' }) {
  return (
    <div
      className="spherexSelectorShade"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="spherexSelector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spherex-selector-title"
      >
        <header className="spherexSelectorHeader">
          <div>
            <span>{t('KRONOX · PLANIFICACIÓN DE MISIÓN', language)}</span>
            <h2 id="spherex-selector-title">{t('¿Qué misión quieres hacer?', language)}</h2>
            <p>
              {t(
                'Elige un tipo de búsqueda y el objetivo. Kronox fijará el destino y preparará el salto.',
                language,
              )}
            </p>
          </div>
          <button type="button" aria-label={t('Cerrar', language)} onClick={onClose}>
            ×
          </button>
        </header>
        <div className="spherexMissionChoices">
          {SPHEREX_MISSION_TYPES.map((mission, index) => (
            <article className="spherexMissionChoice" key={mission.key}>
              <div className="spherexMissionChoiceIcon" aria-hidden="true">
                {index === 0 ? '✧' : '◉'}
              </div>
              <small>
                {t('MISIÓN', language)} 0{index + 1}
              </small>
              <h3>{t(mission.title, language)}</h3>
              <p>{t(mission.description, language)}</p>
              <div className="spherexTargetChoices">
                {mission.targetKeys.map((key) => {
                  const target = SPHEREX_TARGETS.find((item) => item.key === key);
                  return (
                    <button
                      type="button"
                      key={target.key}
                      onClick={() =>
                        onSelect({
                          ...target,
                          name: t(target.name, language),
                          note: t(target.note, language),
                        })
                      }
                    >
                      <span>
                        <b>{t(target.name, language)}</b>
                        <small>{t(target.note, language)}</small>
                      </span>
                      <em>{t(target.distanceLabel, language)}</em>
                      <strong aria-hidden="true">↗</strong>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
        <footer>
          {t(
            'Los destinos aparecen cerca del Sol en el mapa: todos son objetivos del vecindario galáctico observado.',
            language,
          )}
        </footer>
      </section>
    </div>
  );
}
