import React from 'react';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { P, INFO } from '../data/planetData.js';
import { t } from '../i18n.js';

/**
 * Interactive 3D Cockpit & Bridge Systems for KRONOX (Bloque 1, Bloque 2, Bloque 3, Bloque 6).
 * Integrates the 5 functional onboard stations and the contextual 3D object inspector.
 */
export default function SpaceshipCockpit({
  language = 'es',
  cockpitVisible = false,
  activeStation = null,
  onSelectStation,
  viewMode = 'exterior', // 'exterior' | 'cockpit' | 'navigation'
  onChangeViewMode,
  flightSpeed = 1,
  onSpeedPreset,
  selectedObject = null,
  onCloseObjectInspector,
  onTravelToSpherex,
  onOpenSpherexObservatory,
  onTravelToPlanet,
  onOpenPlanetInfo,
  onOpenMissionSelector,
  onOpenAiConsole,
  findingsCount = 0,
}) {
  // Resolve contextual 3D object metadata (Bloque 3)
  let objectCard = null;
  if (selectedObject?.kind === 'spherex') {
    const tgt = SPHEREX_TARGETS.find((item) => item.key === selectedObject.key);
    if (tgt) {
      objectCard = {
        kind: 'spherex',
        name: tgt.name,
        type:
          tgt.mission === 'motion'
            ? 'Estrella / Enana marrón cercana (Alto movimiento propio)'
            : 'Estrella variable infrarroja',
        coordinates: `RA ${tgt.ra.toFixed(4)}° · Dec ${tgt.dec.toFixed(4)}° (ICRS J2025.8)`,
        distance: tgt.distanceLabel,
        intro: `${tgt.note} ${tgt.observationSummary}`,
        hasSpherex: true,
        spherexBadge: `Datos reales SPHEREx disponibles (${tgt.preferredBand} · ${tgt.scientificStatus})`,
        target: tgt,
      };
    }
  } else if (selectedObject?.kind === 'planet') {
    const pl = P.find((item) => item.n === selectedObject.key);
    const info = pl ? INFO[pl.n] : null;
    if (pl) {
      objectCard = {
        kind: 'planet',
        name: pl.n,
        type: pl.sun
          ? 'Estrella central G2V (Sistema Solar)'
          : pl.dwarf
            ? 'Planeta enano del Sistema Solar'
            : pl.moon
              ? 'Satélite natural terrestre'
              : 'Planeta del Sistema Solar',
        coordinates: pl.au
          ? `Semieje orbital: ${pl.au} UA · Inclinación: ${pl.i || 0}°`
          : 'Centro del Sistema Solar (0 UA)',
        distance: pl.au ? `≈ ${(pl.au * 149.6).toFixed(1)} millones de km del Sol` : 'Referencia heliocéntrica',
        intro:
          info?.intro ||
          `Cuerpo del Sistema Solar con diámetro de ${(pl.km * 2).toLocaleString('es-ES')} km.`,
        hasSpherex: false,
        spherexBadge: 'Sin recortes FITS SPHEREx en esta misión (Exploración 3D planetaria)',
        planetName: pl.n,
      };
    }
  }

  return (
    <>
      {/* TOP BRIDGE VIEW MODE & TELEMETRY BAR (Siempre accesible en el universo 3D) */}
      <div className="kronoxBridgeTopBar" role="region" aria-label={t('Modos de vista y puente de mando', language)}>
        <div className="kronoxBridgeIdentity">
          <span className="kronoxShipDot" />
          <strong>NAVE KRONOX · 120 m</strong>
          <small className="kronoxScaleTag">Escala física fija</small>
        </div>

        <div className="kronoxViewModeSwitcher" role="group" aria-label="Selector de vista de nave">
          <button
            type="button"
            className={`kronoxViewBtn ${viewMode === 'cockpit' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('cockpit')}
          >
            <span>1ª Persona · Cabina</span>
          </button>
          <button
            type="button"
            className={`kronoxViewBtn ${viewMode === 'exterior' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('exterior')}
          >
            <span>Vista Exterior · Nave</span>
          </button>
          <button
            type="button"
            className={`kronoxViewBtn ${viewMode === 'navigation' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('navigation')}
          >
            <span>Vista de Navegación</span>
          </button>
        </div>

        <div className="kronoxCruiseReadout">
          <span>CRUCERO: {flightSpeed >= 100 ? flightSpeed.toFixed(0) : flightSpeed.toFixed(1)} u/s</span>
        </div>
      </div>

      {/* CONTEXTUAL 3D ASTRONOMICAL OBJECT INSPECTOR (Bloque 3) */}
      {objectCard && (
        <aside
          className="kronoxObjectInspector"
          role="dialog"
          aria-label={`Ficha astronómica de ${objectCard.name}`}
        >
          <div className="kronoxInspectorHeader">
            <div>
              <span className="kronoxInspectorType">{objectCard.type}</span>
              <h3>{t(objectCard.name, language)}</h3>
            </div>
            <button
              type="button"
              className="kronoxInspectorClose"
              onClick={onCloseObjectInspector}
              aria-label="Cerrar ficha de objeto"
            >
              ×
            </button>
          </div>

          <div className="kronoxInspectorMeta">
            <div>
              <small>POSICIÓN / ÓRBITA</small>
              <strong>{objectCard.coordinates}</strong>
            </div>
            <div>
              <small>DISTANCIA CONFIABLE</small>
              <strong>{objectCard.distance}</strong>
            </div>
          </div>

          <p className="kronoxInspectorIntro">{objectCard.intro}</p>

          <div className={`kronoxInspectorSpherexStatus ${objectCard.hasSpherex ? 'available' : 'none'}`}>
            <span>{objectCard.hasSpherex ? '✦ ' : '○ '}</span>
            <span>{objectCard.spherexBadge}</span>
          </div>

          <div className="kronoxInspectorActions">
            {objectCard.kind === 'spherex' ? (
              <>
                <button
                  type="button"
                  className="kronoxInspectorBtn primary"
                  onClick={() => onTravelToSpherex(objectCard.target)}
                >
                  Viajar hacia esta estrella
                </button>
                <button
                  type="button"
                  className="kronoxInspectorBtn secondary"
                  onClick={() => onOpenSpherexObservatory(objectCard.target)}
                >
                  Investigar archivo SPHEREx
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="kronoxInspectorBtn primary"
                  onClick={() => onTravelToPlanet(objectCard.planetName)}
                >
                  Viajar a {objectCard.planetName}
                </button>
                {INFO[objectCard.planetName] && (
                  <button
                    type="button"
                    className="kronoxInspectorBtn secondary"
                    onClick={() => onOpenPlanetInfo(objectCard.planetName)}
                  >
                    Ver dossier planetario
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      {/* INTERACTIVE COCKPIT CONSOLES DOCK (Bloque 1 y Bloque 6) */}
      {cockpitVisible && (
        <div className="kronoxCockpitStations" role="navigation" aria-label="Estaciones de la cabina">
          <div className="kronoxStationsDock">
            <button
              type="button"
              className={`kronoxStationHotspot ${activeStation === 'nav' ? 'active' : ''}`}
              onClick={() => onSelectStation(activeStation === 'nav' ? null : 'nav')}
            >
              <span className="kronoxStationCode">EST-01</span>
              <strong>Consola de Navegación</strong>
              <small>Rutas, velocidades y escalas</small>
            </button>

            <button
              type="button"
              className={`kronoxStationHotspot ${activeStation === 'science' ? 'active' : ''}`}
              onClick={() => onSelectStation(activeStation === 'science' ? null : 'science')}
            >
              <span className="kronoxStationCode">EST-02</span>
              <strong>Consola Científica</strong>
              <small>Archivo temporal SPHEREx</small>
            </button>

            <button
              type="button"
              className={`kronoxStationHotspot ${activeStation === 'missions' ? 'active' : ''}`}
              onClick={() => onSelectStation(activeStation === 'missions' ? null : 'missions')}
            >
              <span className="kronoxStationCode">EST-03</span>
              <strong>Sistema de Misiones</strong>
              <small>Expediciones ({findingsCount} hallazgos)</small>
            </button>

            <button
              type="button"
              className={`kronoxStationHotspot ${activeStation === 'comms' ? 'active' : ''}`}
              onClick={() => {
                onSelectStation('comms');
                onOpenAiConsole();
              }}
            >
              <span className="kronoxStationCode">EST-04</span>
              <strong>Comunicaciones · IA</strong>
              <small>Hablar con Kronox</small>
            </button>

            <button
              type="button"
              className={`kronoxStationHotspot ${activeStation === 'windows' ? 'active' : ''}`}
              onClick={() => onSelectStation(activeStation === 'windows' ? null : 'windows')}
            >
              <span className="kronoxStationCode">EST-05</span>
              <strong>Ventanas de Observación</strong>
              <small>Vista despejada del cosmos</small>
            </button>
          </div>

          {/* ACTIVE STATION PANEL OVERLAY */}
          {activeStation === 'nav' && (
            <div className="kronoxStationDrawer" role="dialog" aria-label="Consola de Navegación">
              <div className="kronoxStationDrawerHead">
                <h4>CONSOLA DE NAVEGACIÓN · PROPULSIÓN Y DESTINOS</h4>
                <button type="button" onClick={() => onSelectStation(null)}>×</button>
              </div>
              <p className="kronoxStationDesc">
                Selecciona régimen de velocidad de crucero (independiente de los fotogramas) o inicia un salto de larga distancia:
              </p>
              <div className="kronoxStationGrid">
                <div className="kronoxStationBlock">
                  <small>RÉGIMEN DE CRUCERO</small>
                  <div className="kronoxStationBtnRow">
                    {[
                      ['Planetaria (1 u/s)', 1],
                      ['Sistema Solar (60 u/s)', 60],
                      ['Vecindario Galáctico (3000 u/s)', 3000],
                      ['Hipervelocidad (40000 u/s)', 40000],
                    ].map(([label, val]) => (
                      <button key={label} type="button" onClick={() => onSpeedPreset(val)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="kronoxStationBlock">
                  <small>SALTO RÁPIDO A OBJETIVO SPHEREx</small>
                  <div className="kronoxStationBtnRow">
                    {SPHEREX_TARGETS.map((tgt) => (
                      <button
                        key={tgt.key}
                        type="button"
                        onClick={() => {
                          onSelectStation(null);
                          onTravelToSpherex(tgt);
                        }}
                      >
                        ⌖ {tgt.name} ({tgt.distanceLabel})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStation === 'science' && (
            <div className="kronoxStationDrawer" role="dialog" aria-label="Consola Científica">
              <div className="kronoxStationDrawerHead">
                <h4>CONSOLA CIENTÍFICA · ARCHIVO INFRARROJO NASA SPHEREx</h4>
                <button type="button" onClick={() => onSelectStation(null)}>×</button>
              </div>
              <p className="kronoxStationDesc">
                Accede directamente a los recortes FITS reales de cada estrella, filtra observaciones por fecha o banda y compara épocas:
              </p>
              <div className="kronoxStationBtnRow">
                {SPHEREX_TARGETS.map((tgt) => (
                  <button
                    key={tgt.key}
                    type="button"
                    onClick={() => {
                      onSelectStation(null);
                      onOpenSpherexObservatory(tgt);
                    }}
                  >
                    ✦ Analizar {tgt.name} ({tgt.preferredBand} · {tgt.scientificStatus})
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeStation === 'missions' && (
            <div className="kronoxStationDrawer" role="dialog" aria-label="Sistema de Misiones">
              <div className="kronoxStationDrawerHead">
                <h4>SISTEMA DE MISIONES · DESCUBRIMIENTO GUIADO</h4>
                <button type="button" onClick={() => onSelectStation(null)}>×</button>
              </div>
              <p className="kronoxStationDesc">
                Elige entre rastrear el movimiento propio de estrellas cercanas o estudiar la variabilidad de flujo infrarrojo. Llevas {findingsCount} hallazgo(s) guardado(s).
              </p>
              <div className="kronoxStationBtnRow">
                <button
                  type="button"
                  onClick={() => {
                    onSelectStation(null);
                    onOpenMissionSelector();
                  }}
                >
                  Abrir catálogo completo de misiones ↗
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectStation(null);
                    onOpenSpherexObservatory(SPHEREX_TARGETS[0]);
                  }}
                >
                  Iniciar reto guiado en Estrella de Barnard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

