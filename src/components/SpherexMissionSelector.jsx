import React from 'react';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS } from '../data/spherexTargets.js';

export default function SpherexMissionSelector({ onSelect, onClose }) {
  return (
    <div className="spherexSelectorShade" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="spherexSelector" role="dialog" aria-modal="true" aria-labelledby="spherex-selector-title">
        <header className="spherexSelectorHeader">
          <div>
            <span>KRONOX · PLANIFICACIÓN DE MISIÓN</span>
            <h2 id="spherex-selector-title">¿Qué misión quieres hacer?</h2>
            <p>Elige un tipo de búsqueda y el objetivo. Kronox fijará el destino y preparará el salto.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <div className="spherexMissionChoices">
          {SPHEREX_MISSION_TYPES.map((mission, index) => (
            <article className="spherexMissionChoice" key={mission.key}>
              <div className="spherexMissionChoiceIcon" aria-hidden="true">{index === 0 ? '✧' : '◉'}</div>
              <small>MISIÓN 0{index + 1}</small>
              <h3>{mission.title}</h3>
              <p>{mission.description}</p>
              <div className="spherexTargetChoices">
                {mission.targetKeys.map((key) => {
                  const target = SPHEREX_TARGETS.find((item) => item.key === key);
                  return (
                    <button type="button" key={target.key} onClick={() => onSelect(target)}>
                      <span><b>{target.name}</b><small>{target.note}</small></span>
                      <em>{target.distanceLabel}</em>
                      <strong aria-hidden="true">↗</strong>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
        <footer>Los destinos aparecen cerca del Sol en el mapa: todos son objetivos del vecindario galáctico observado.</footer>
      </section>
    </div>
  );
}
