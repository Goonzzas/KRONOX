import React from 'react';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { t } from '../i18n.js';

export default function SpherexMissionSelector({ onSelect, onDirectOpen, onClose, language = 'es' }) {
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
            {onDirectOpen && (
              <button
                type="button"
                style={{
                  marginTop: '10px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.25)',
                  border: '1px solid rgba(96, 165, 250, 0.6)',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => onDirectOpen(SPHEREX_TARGETS.find((target) => target.key === 'wise-0855') || SPHEREX_TARGETS[0])}
              >
                <span>🔭</span>
                <span>{t('Abrir Observatorio SPHEREx directamente (acceso rápido)', language)}</span>
              </button>
            )}
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
                  const isWarning = target.scientificStatus === 'WARNING';
                  const isSensible = target.scientificStatus === 'SENSIBLE';
                  const isPhot = target.scientificStatus === 'FOTOMÉTRICO';
                  const badgeBg = isWarning ? '#ff9800' : isSensible ? '#0284c7' : isPhot ? '#8b5cf6' : '#2e7d32';
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
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <b>{t(target.name, language)}</b>
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              textTransform: 'uppercase',
                              fontWeight: 'bold',
                              letterSpacing: '0.04em',
                              background: badgeBg,
                              color: '#fff',
                            }}
                          >
                            {target.statusBadge}
                          </span>
                        </span>
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
