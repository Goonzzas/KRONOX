import React from 'react';
import { NEARBY_GALAXIES } from '../data/nearbyGalaxies.js';

const text = (value, language) =>
  typeof value === 'string' ? value : value?.[language] || value?.es || '';

export function NearbyGalaxyControls({
  language = 'es',
  selectedKey,
  onSelect,
  onFocus,
  onInfo,
  onReturn,
}) {
  const selected = NEARBY_GALAXIES.find((item) => item.key === selectedKey) || NEARBY_GALAXIES[0];
  const en = language === 'en';
  return (
    <aside
      className="nearbyGalaxyControls"
      aria-label={en ? 'Nearby galaxies map' : 'Mapa de galaxias cercanas'}
    >
      <div className="nearbyGalaxyEyebrow">
        {en ? 'DEEP SPACE ATLAS' : 'ATLAS DEL ESPACIO PROFUNDO'}
      </div>
      <h2>{en ? 'Galactic neighborhood' : 'Vecindario galáctico'}</h2>
      <label className="nearbyGalaxySelectLabel" htmlFor="nearby-galaxy-select">
        {en ? 'Galaxy or group' : 'Galaxia o grupo'}
      </label>
      <select
        id="nearby-galaxy-select"
        value={selected.key}
        onChange={(event) => onSelect(event.target.value)}
      >
        {NEARBY_GALAXIES.map((item) => (
          <option value={item.key} key={item.key}>
            {text(item.name, language)}
          </option>
        ))}
      </select>
      <div className="nearbyGalaxyQuickFact">
        <span>
          {selected.kind === 'group' ? (en ? 'GROUP' : 'GRUPO') : en ? 'GALAXY' : 'GALAXIA'}
        </span>
        <b>
          {selected.distanceText?.[language] ||
            (selected.distanceSummary
              ? en
                ? 'Several million light-years'
                : 'Varios millones de años luz'
              : en
                ? 'Map origin'
                : 'Origen del mapa')}
        </b>
      </div>
      <div className="nearbyGalaxyActions">
        <button type="button" onClick={() => onFocus(selected.key)}>
          {en ? 'Center view' : 'Centrar vista'}
        </button>
        <button type="button" onClick={() => onInfo(selected.key)}>
          {en ? 'Object details' : 'Ficha del objeto'}
        </button>
      </div>
      <p className="nearbyGalaxyDisclaimer">
        {en
          ? 'Schematic map. Marker directions are approximate and visual distances are compressed; real distance estimates are shown in object details.'
          : 'Mapa esquemático. Las direcciones de los marcadores son aproximadas y las distancias visuales están comprimidas; las estimaciones reales aparecen en cada ficha.'}
      </p>
      <button type="button" className="nearbyGalaxyReturn" onClick={onReturn}>
        {en ? 'Return to the Milky Way / Solar System' : 'Volver a la Vía Láctea / sistema solar'}
      </button>
    </aside>
  );
}

export function NearbyGalaxyInfoModal({ galaxy, language = 'es', onClose, onFocus }) {
  if (!galaxy) return null;
  const en = language === 'en';
  return (
    <div className="modalShade" onClick={onClose}>
      <article
        className="infoCard nearbyGalaxyInfo"
        role="dialog"
        aria-modal="true"
        aria-label={text(galaxy.name, language)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="infoHeader">
          <div>
            <h2>{text(galaxy.name, language)}</h2>
            <p>{text(galaxy.type, language)}</p>
          </div>
          <button type="button" onClick={onClose}>
            {en ? 'Close ✕' : 'Cerrar ✕'}
          </button>
        </div>
        <div className="nearbyGalaxyFacts">
          <div>
            <small>{en ? 'CATALOG DESIGNATIONS' : 'DESIGNACIONES DE CATÁLOGO'}</small>
            <b>{galaxy.catalog}</b>
          </div>
          {galaxy.distanceText && (
            <div>
              <small>{en ? 'APPROXIMATE DISTANCE' : 'DISTANCIA APROXIMADA'}</small>
              <b>{galaxy.distanceText[language]}</b>
            </div>
          )}
          {galaxy.distanceSummary && (
            <div>
              <small>{en ? 'DISTANCE CONTEXT' : 'CONTEXTO DE DISTANCIA'}</small>
              <b>{text(galaxy.distanceSummary, language)}</b>
            </div>
          )}
          <div>
            <small>{en ? 'SKY REGION' : 'REGIÓN DEL CIELO'}</small>
            <b>{text(galaxy.constellation, language)}</b>
          </div>
          {Number.isFinite(galaxy.raDeg) && (
            <div>
              <small>{en ? 'J2000 / ICRS COORDINATES' : 'COORDENADAS J2000 / ICRS'}</small>
              <b>
                RA {galaxy.raDeg.toFixed(4)}° · Dec {galaxy.decDeg.toFixed(4)}°
              </b>
            </div>
          )}
        </div>
        <p className="nearbyGalaxyDescription">{text(galaxy.description, language)}</p>
        <p className="nearbyGalaxyDisclaimer">
          {en
            ? 'Map positions and separations are schematic. Distances are approximate catalog or literature values.'
            : 'Las posiciones y separaciones del mapa son esquemáticas. Las distancias son valores aproximados de catálogos o literatura.'}
        </p>
        <div className="nearbyGalaxySources">
          <b>{en ? 'Sources' : 'Fuentes'}</b>
          {galaxy.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
              {source.label} ↗
            </a>
          ))}
        </div>
        <div className="infoActions">
          <button type="button" className="infoExploreButton" onClick={() => onFocus(galaxy.key)}>
            {en ? 'Center on map ↗' : 'Centrar en el mapa ↗'}
          </button>
          <button type="button" onClick={onClose}>
            {en ? 'Close details' : 'Cerrar ficha'}
          </button>
        </div>
      </article>
    </div>
  );
}
