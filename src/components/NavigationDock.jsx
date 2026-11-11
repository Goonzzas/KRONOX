import React, { useState } from 'react';
import { NAVIGATION_SCALES } from '../scene/navigationScale.js';
export default function NavigationDock({
  context,
  travelActive = false,
  onScale,
  onObserve,
  onReenter,
  onReplayIntro,
  onStop,
  onView,
  onMissions,
  onMap,
  onSettings,
  onStartPerformance,
  onPerformance,
  performanceReport,
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <aside
      className={'navigationDock' + (expanded ? ' expanded' : '')}
      aria-label="Navegación y escalas"
    >
      <header>
        <div>
          <b>{context.label}</b>
          <small>{context.targetName || 'Mapa de contexto'}</small>
        </div>
        <button aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Cerrar controles' : 'Mapa y navegación'}
        </button>
      </header>
      <button className="navigationObserve" onClick={onObserve}>
        Abrir observatorio SPHEREx
      </button>
      {expanded && (
        <div className="navigationDockBody">
          <label>
            Escala astronómica
            <select
              disabled={travelActive}
              value={context.id}
              onChange={(e) => onScale(e.target.value)}
              onClick={(e) => {
                // Si el usuario vuelve a hacer clic en la escala teniendo un objeto enfocado, reencuadrar la vista completa
                if (context.targetName || context.targetKey) {
                  onScale(e.target.value || context.id);
                }
              }}
            >
              {NAVIGATION_SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.level}. {s.label}
                </option>
              ))}
            </select>
          </label>
          {(context.targetName || context.targetKey) && (
            <button
              type="button"
              className="navigationDockZoomOutBtn"
              style={{
                width: '100%',
                padding: '7px 10px',
                margin: '4px 0 8px',
                background: 'rgba(14, 165, 233, 0.22)',
                border: '1px solid rgba(56, 189, 248, 0.55)',
                borderRadius: '8px',
                color: '#e0f2fe',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'center',
                fontWeight: 600,
              }}
              onClick={() => onScale(context.id)}
            >
              🔍 Vista general completa de {context.label || 'la escala'}
            </button>
          )}
          {context.distancePc !== null && (
            <p>
              Distancia de catálogo:{' '}
              {context.distancePc.toLocaleString('es', { maximumFractionDigits: 2 })} pc
            </p>
          )}
          <p>{context.description}</p>
          <div className="navigationDockActions">
            <button onClick={onReenter}>Reingresar con Cronos</button>
            <button disabled={travelActive} onClick={onReplayIntro}>
              Reproducir introducción
            </button>
            <button onClick={onStop}>Frenar e inspeccionar</button>
            <button disabled={travelActive} onClick={onView}>
              Ver nave exterior
            </button>
            <button disabled={travelActive} onClick={onMissions}>
              Elegir misión científica
            </button>
            <button disabled={travelActive} onClick={onMap}>
              {context.id === 'regional'
                ? 'Vista general de la región'
                : context.id === 'extragalactic'
                  ? 'Vista general extragaláctica'
                  : 'Vista general del vecindario'}
            </button>
            <button onClick={onSettings}>Más ajustes de vuelo</button>
          </div>
          <details>
            <summary>Medición de rendimiento</summary>
            <button onClick={onStartPerformance}>Iniciar muestra de 600 fotogramas</button>
            <button onClick={onPerformance}>Consultar medición</button>
            {performanceReport && <output>{JSON.stringify(performanceReport)}</output>}
          </details>
        </div>
      )}
    </aside>
  );
}
