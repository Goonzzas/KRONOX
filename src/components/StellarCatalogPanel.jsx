import React from 'react';
import { contextCatalog } from '../scene/navigationAtlas.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
export default function StellarCatalogPanel({ mode, selectedKey, onFocus }) {
  const entries = contextCatalog(mode, SPHEREX_TARGETS);
  return (
    <aside className="stellarCatalogPanel" aria-label="Sistemas del mapa">
      <details open>
        <summary>
          {mode === 'stellar' ? 'Vecindario solar · 0–10 pc' : 'Región galáctica · 10–300 pc'}
        </summary>
        <p>
          {entries.length} sistemas de catálogo. Los círculos indican distancia al Sol; los tamaños
          de las estrellas están ampliados para poder verlas.
        </p>
        <div>
          {entries.map((s) => (
            <button key={s.key} aria-pressed={s.key === selectedKey} onClick={() => onFocus(s.key)}>
              <b>{s.name}</b>
              <span>
                {s.distancePc.toFixed(2)} pc
                {s.planetCount ? ' · ' + s.planetCount + ' planetas confirmados' : ''}
              </span>
            </button>
          ))}
        </div>
        <small>
          CNS5 / NASA Exoplanet Archive. Las órbitas de esos planetas no se deducen de las imágenes
          SPHEREx.
        </small>
      </details>
    </aside>
  );
}
