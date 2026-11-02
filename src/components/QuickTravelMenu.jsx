import React from 'react';
import { t } from '../i18n.js';

const DESTINATIONS = [
  ['Órbita próxima al Sol', 'sunOrbit'],
  ['Cinturón de asteroides', 'asteroids'],
  ['Brazo de Orión', 'orion'],
  ['Centro galáctico', 'core'],
];

export default function QuickTravelMenu({
  open,
  language = 'es',
  onToggle,
  selectedPlanet,
  planets,
  onFree,
  onQuickTravel,
  onPlanetTravel,
}) {
  return (
    <div className="bd">
      <button onClick={() => onToggle(!open)}>
        {open ? t('Cerrar viajes rápidos ▲', language) : t('Viajes rápidos ▼', language)}
      </button>
      {open && (
        <div className="qpanel">
          <div className="qtitle">{t('Destinos rápidos', language)}</div>
          <div className="qrow">
            {DESTINATIONS.map(([label, key]) => (
              <button key={key} onClick={() => onQuickTravel(key, t(label, language))}>
                {t(label, language)}
              </button>
            ))}
          </div>
          <div className="qtitle">{t('Planetas y cuerpos', language)}</div>
          <div className="qrow">
            <button className={!selectedPlanet ? 'on' : ''} onClick={onFree}>
              {t('Vista libre', language)}
            </button>
            {planets.map((planet) => (
              <button
                key={planet.n}
                className={selectedPlanet === planet.n ? 'on' : ''}
                onClick={() => onPlanetTravel(planet.n)}
              >
                {t(planet.n, language)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
