import React from 'react';
import { t } from '../i18n.js';

export default function NoviceMissionWaypointHud({
  waypoint,
  language = 'es',
  onActivate,
  onWalkToConsole,
}) {
  if (!waypoint?.visible) return null;

  const {
    inFront,
    onScreen,
    x = 0,
    y = 0,
    turnSide = 'right',
    distanceMeters = 0,
    nearReady = false,
    autoWalking = false,
  } = waypoint;

  const distLabel = `${Number(distanceMeters || 0).toFixed(1)} m`;

  if (inFront && onScreen) {
    return (
      <div
        className={`noviceWaypointPin ${nearReady ? 'is-ready' : ''}`}
        style={{ left: `${x}px`, top: `${y}px` }}
        role="status"
        aria-live="polite"
      >
        <div className="noviceWaypointCard">
          <div className="noviceWaypointTop">
            <span className="noviceWaypointDot" aria-hidden="true" />
            <span className="noviceWaypointTitle">
              {t('Mando de Misiones SPHEREx', language)}
            </span>
            <span className="noviceWaypointDist">{distLabel}</span>
          </div>
          <div className="noviceWaypointActions">
            {nearReady ? (
              <button
                type="button"
                className="noviceWaypointActionBtn is-primary"
                onClick={onActivate}
              >
                <kbd>E</kbd> {t('Abrir Misiones SPHEREx', language)}
              </button>
            ) : (
              <>
                <span className="noviceWaypointSub">
                  {t('Sigue las flechas luminosas', language)}
                </span>
                {!autoWalking && onWalkToConsole && (
                  <button
                    type="button"
                    className="noviceWaypointActionBtn"
                    onClick={onWalkToConsole}
                  >
                    {t('Ir caminando', language)}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="noviceWaypointArrowDown" aria-hidden="true">
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
            <path
              d="M4 3L14 14L24 3"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  const turnLeft = turnSide === 'left';
  const promptText = !inFront
    ? turnLeft
      ? 'Gira a la izquierda y sigue las flechas luminosas'
      : 'Gira a la derecha y sigue las flechas luminosas'
    : 'Sigue las flechas luminosas en el suelo';

  return (
    <div
      className={`noviceWaypointCompass ${turnLeft ? 'is-left' : 'is-right'}`}
      role="status"
      aria-live="polite"
    >
      <div className="noviceWaypointCompassArrow" aria-hidden="true">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{ transform: turnLeft ? 'rotate(180deg)' : 'none' }}
        >
          <path
            d="M5 12H19M19 12L13 6M19 12L13 18"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="noviceWaypointCompassCopy">
        <div className="noviceWaypointCompassTitle">
          <span>{t('Mando de Misiones SPHEREx', language)}</span>
          <span className="noviceWaypointDist">{distLabel}</span>
        </div>
        <span className="noviceWaypointCompassSub">{t(promptText, language)}</span>
      </div>
      {!autoWalking && onWalkToConsole && (
        <button
          type="button"
          className="noviceWaypointActionBtn"
          onClick={onWalkToConsole}
        >
          {t('Ir caminando', language)}
        </button>
      )}
    </div>
  );
}
