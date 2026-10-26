import React from 'react';

const DESTINATIONS = [
  ['Órbita próxima al Sol', 'sunOrbit'],
  ['Cinturón de asteroides', 'asteroids'],
  ['Brazo de Orión', 'orion'],
  ['Centro galáctico', 'core'],
];

export default function QuickTravelMenu({
  open,
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
        {open ? 'Cerrar viajes rápidos ▲' : 'Viajes rápidos ▼'}
      </button>
      {open && (
        <div className="qpanel">
          <div className="qtitle">Destinos rápidos</div>
          <div className="qrow">
            {DESTINATIONS.map(([label, key]) => (
              <button key={key} onClick={() => onQuickTravel(key, label)}>
                {label}
              </button>
            ))}
          </div>
          <div className="qtitle">Planetas y cuerpos</div>
          <div className="qrow">
            <button className={!selectedPlanet ? 'on' : ''} onClick={onFree}>
              Vista libre
            </button>
            {planets.map((planet) => (
              <button
                key={planet.n}
                className={selectedPlanet === planet.n ? 'on' : ''}
                onClick={() => onPlanetTravel(planet.n)}
              >
                {planet.n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
