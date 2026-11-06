import React, { useState } from 'react';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { P, INFO } from '../data/planetData.js';
import { PHYSICAL_CABIN_STATIONS, SHIP_WORLD_UNITS } from '../scene/habitableShipWorld.js';
import { KRONOX_SCENE_EVENTS, KRONOX_CONTROL_MODES } from '../scene/kronoxSceneDirector.js';
import { t } from '../i18n.js';

/**
 * In-World 3D Habitable Cabin HUD & Diegetic Console Interface (Sections 2, 3, 6 & 7).
 * Replaces the rejected floating EST-01..05 dock and 2D SVG cockpit with:
 * - Physical proximity interaction prompt (`[E] Operar Consola...`)
 * - Astronaut 1st-person (1.65 m eyes) / 3rd-person (1.75 m full spacesuit) / Exterior Ship (120 m) toggle
 * - Diegetic console instrument screens anchored to physical 3D consoles inside the bridge
 * - Real-time 3D ship system events (`KronoxSceneDirector`)
 */
export default function SpaceshipCockpit({
  language = 'es',
  cockpitVisible = false,
  cabinFirstPerson = true,
  onToggleCabinPerspective,
  nearestStation = null,
  activeStation = null,
  onSelectStation,
  onWalkToStation,
  viewMode = 'cockpit', // 'cockpit' | 'exterior' | 'navigation'
  onChangeViewMode,
  onResetExteriorView,
  flightSpeed = 1,
  onSpeedPreset,
  onFlightKey,
  selectedObject = null,
  onCloseObjectInspector,
  onTravelToSpherex,
  onQuickTravel,
  onOpenSpherexObservatory,
  onTravelToPlanet,
  onOpenPlanetInfo,
  onOpenMissionSelector,
  onOpenAiConsole,
  onStartGuidedTour,
  onReplayCinematic,
  onOpenSettingsModal,
  onDispatchSceneEvent,
  onSkipDirectorSequence,
  directorState = null,
  astronautCoords = { x: 0, z: -1.8 },
  findingsCount = 0,
  consoleProjection = null,
}) {
  const [navigationMode, setNavigationMode] = useState('manual');
  const [navigationTarget, setNavigationTarget] = useState('planet:Tierra');

  const controlModeLabel =
    directorState?.controlMode === KRONOX_CONTROL_MODES.CINEMATIC_SEQUENCE
      ? 'Secuencia 3D de Sistemas'
      : activeStation || directorState?.controlMode === KRONOX_CONTROL_MODES.MACHINE_INTERACTION
        ? 'Operando Máquina 3D'
        : 'Control Libre Astronauta';
  // Contextual 3D Astronomical Object Inspector
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
        distance: pl.au
          ? `≈ ${(pl.au * 149.6).toFixed(1)} millones de km del Sol`
          : 'Referencia heliocéntrica',
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
      {/* TOP BRIDGE VIEW MODE & PHYSICAL SCALE BAR (Clean, structured sci-fi HUD) */}
      <header
        className="kronoxBridgeTopBar"
        role="region"
        aria-label={t('Modos de vista y puente habitable 3D', language)}
      >
        <div className="kronoxBridgeIdentity">
          <span className="kronoxShipDot" />
          <strong>KRONOX</strong>
          <span className="kronoxScaleTag">{SHIP_WORLD_UNITS.SHIP_LENGTH_METERS} m</span>
        </div>

        <nav className="kronoxViewModeSwitcher" aria-label="Selector de cámara 3D">
          <button
            type="button"
            className={`kronoxViewBtn ${viewMode === 'cockpit' && cabinFirstPerson ? 'active' : ''}`}
            onClick={() => {
              onChangeViewMode('cockpit');
              onToggleCabinPerspective?.(true);
            }}
            title="Vista en 1ª Persona del astronauta (1.75 m)"
          >
            <span>Cabina 1P</span>
          </button>
          <button
            type="button"
            className={`kronoxViewBtn ${viewMode === 'cockpit' && !cabinFirstPerson ? 'active' : ''}`}
            onClick={() => {
              onChangeViewMode('cockpit');
              onToggleCabinPerspective?.(false);
            }}
            title="Vista en 3ª Persona del astronauta"
          >
            <span>Cabina 3P</span>
          </button>
          <button
            type="button"
            className={`kronoxViewBtn ${viewMode === 'exterior' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('exterior')}
            title="Vista exterior de la nave de 120 metros"
          >
            <span>Exterior</span>
          </button>
          <button
            type="button"
            className={`kronoxViewBtn ${viewMode === 'navigation' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('navigation')}
            title="Vista del mapa cósmico 3D"
          >
            <span>Cosmos</span>
          </button>
        </nav>
        {viewMode === 'exterior' && (
          <button type="button" className="kronoxResetExteriorView" onClick={onResetExteriorView}>
            Inspeccionar nave
          </button>
        )}

        <div className="kronoxCruiseReadout">
          <span
            className="kronoxDirectorModePill"
            data-mode={directorState?.controlMode || 'FREE_ASTRONAUT'}
            title={`Estado de control: ${directorState?.controlMode || 'FREE_ASTRONAUT'}`}
          >
            ◈ {controlModeLabel}
          </span>
          {viewMode === 'cockpit' ? (
            <span className="kronoxCabinPosReadout" title="Posición y velocidad del astronauta">
              X {astronautCoords.x >= 0 ? `+${astronautCoords.x}` : astronautCoords.x} · Z{' '}
              {astronautCoords.z >= 0 ? `+${astronautCoords.z}` : astronautCoords.z} m · {SHIP_WORLD_UNITS.WALK_SPEED_MPS} m/s
            </span>
          ) : (
            <span className="kronoxCabinPosReadout" title="Velocidad en mapa cósmico">
              {flightSpeed >= 100 ? flightSpeed.toFixed(0) : flightSpeed.toFixed(1)} u/s
            </span>
          )}
          {directorState?.activeSequence && onSkipDirectorSequence && (
            <button
              type="button"
              className="kronoxBridgeCinemaBtn"
              onClick={onSkipDirectorSequence}
              title="Saltar secuencia activa"
            >
              ⏭ Saltar
            </button>
          )}
          {onOpenSettingsModal && (
            <button
              type="button"
              className="kronoxBridgeSettingsBtn"
              onClick={onOpenSettingsModal}
              aria-label="Abrir controles de navegación"
            >
              <span aria-hidden="true">☷</span>
              <span>Controles de navegación</span>
            </button>
          )}
        </div>
      </header>

      {/* DISCRETE MINIMAL CONTEXTUAL PROMPT WHEN ASTRONAUT IS NEAR A PHYSICAL 3D CONSOLE */}
      {cockpitVisible && nearestStation && !activeStation && (
        <div className="kronoxProximityPrompt" role="status" aria-live="polite">
          <div className="kronoxProximityKey">[E]</div>
          <div className="kronoxProximityInfo">
            <strong>{nearestStation.title}</strong>
            <span>Interactuar con consola física</span>
          </div>
          <button
            type="button"
            className="kronoxProximityActivateBtn"
            onClick={() => {
              onSelectStation(nearestStation.id);
              if (nearestStation.id === 'comms') onOpenAiConsole?.();
            }}
          >
            Interactuar
          </button>
        </div>
      )}

      {/* CONTEXTUAL 3D ASTRONOMICAL OBJECT INSPECTOR */}
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

          <div
            className={`kronoxInspectorSpherexStatus ${objectCard.hasSpherex ? 'available' : 'none'}`}
          >
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
                  Investigar en Consola Científica SPHEREx
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

      {/* DIEGETIC CONSOLE INSTRUMENT OVERLAY WHEN INTERACTING WITH A PHYSICAL 3D CONSOLE */}
      {cockpitVisible && activeStation === 'nav' && (
        <div
          className="kronoxDiegeticConsole kronoxNavConsole"
          role="dialog"
          aria-label="Consola de Navegación"
          style={
            consoleProjection?.visible
              ? {
                  left: `${consoleProjection.x}px`,
                  top: `${consoleProjection.y + 40}px`,
                  bottom: 'auto',
                  transform: `translate(-50%, -50%) scale(${consoleProjection.scale})`,
                  animation: 'none',
                }
              : undefined
          }
        >
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">ESTACIÓN FÍSICA DE PROA · (0.0 m, -6.2 m) · MAPA HOLOGRÁFICO 3D ACTIVO</span>
              <h4>CONSOLA DE NAVEGACIÓN · PROPULSIÓN Y SALTOS ESTELARES</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar consola">
              ×
            </button>
          </div>
          <div className="kronoxNavTelemetry" aria-label="Telemetría de vuelo en tiempo real">
            <div><small>VELOCIDAD</small><strong>{consoleProjection?.speed?.toFixed?.(1) ?? '0.0'} <i>u/s</i></strong></div>
            <div><small>ACELERACIÓN</small><strong>{consoleProjection?.inertia?.toFixed?.(2) ?? '0.00'} <i>u/s²</i></strong></div>
            <div><small>RUMBO / INCLINACIÓN</small><strong>{consoleProjection?.heading ?? 0}° / {consoleProjection?.pitch ?? 0}°</strong></div>
            <div><small>MASA · {consoleProjection?.flightMode ?? 'ESPERA'}</small><strong>Sin especificar <i>kg</i></strong></div>
          </div>
          <div className="kronoxNavModeTabs" role="tablist" aria-label="Modo de pilotaje">
            <button type="button" role="tab" aria-selected={navigationMode === 'manual'} className={navigationMode === 'manual' ? 'active' : ''} onClick={() => setNavigationMode('manual')}>✧ Pilotaje manual</button>
            <button type="button" role="tab" aria-selected={navigationMode === 'auto'} className={navigationMode === 'auto' ? 'active' : ''} onClick={() => setNavigationMode('auto')}>⌖ Piloto automático</button>
          </div>
          {navigationMode === 'manual' ? (
            <div className="kronoxNavManualPanel">
              <div>
                <strong>CONTROL MANUAL</strong>
                <small>W / S · avance · A / D · rumbo · Q / E · vertical · Shift · impulso ×5</small>
                <div className="kronoxNavSpeedPresets">
                  {[[1, 'Órbita'], [60, 'Sistema'], [3000, 'Galaxia'], [40000, 'Hiper']].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => onSpeedPreset(value)}>{label} · {value.toLocaleString('es-ES')} u/s</button>
                  ))}
                </div>
              </div>
              <div className="kronoxNavControlPad" aria-label="Timón manual">
                {[
                  ['w', '↑', 'Avanzar'], ['a', '←', 'Izquierda'], ['s', '↓', 'Retroceder'], ['d', '→', 'Derecha'],
                ].map(([key, icon, label]) => (
                  <button key={key} type="button" aria-label={label}
                    onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onFlightKey?.(key, true); }}
                    onPointerUp={() => onFlightKey?.(key, false)} onPointerCancel={() => onFlightKey?.(key, false)} onLostPointerCapture={() => onFlightKey?.(key, false)}>{icon}</button>
                ))}
                <button type="button" aria-label="Ascender" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onFlightKey?.('e', true); }} onPointerUp={() => onFlightKey?.('e', false)} onPointerCancel={() => onFlightKey?.('e', false)} onLostPointerCapture={() => onFlightKey?.('e', false)}>↑ Z</button>
                <button type="button" aria-label="Descender" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onFlightKey?.('q', true); }} onPointerUp={() => onFlightKey?.('q', false)} onPointerCancel={() => onFlightKey?.('q', false)} onLostPointerCapture={() => onFlightKey?.('q', false)}>↓ Z</button>
                <button type="button" className="kronoxNavBoost" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onFlightKey?.('shift', true); }} onPointerUp={() => onFlightKey?.('shift', false)} onPointerCancel={() => onFlightKey?.('shift', false)} onLostPointerCapture={() => onFlightKey?.('shift', false)}>IMPULSO ×5</button>
              </div>
            </div>
          ) : (
            <div className="kronoxNavAutopilotPanel">
              <label htmlFor="kronoxNavDestination">OBJETIVO DE NAVEGACIÓN</label>
              <select id="kronoxNavDestination" value={navigationTarget} onChange={(event) => setNavigationTarget(event.target.value)}>
                <optgroup label="Destinos rápidos">
                  {[['quick:sunOrbit', 'Órbita próxima al Sol'], ['quick:asteroids', 'Cinturón de asteroides'], ['quick:orion', 'Brazo de Orión'], ['quick:core', 'Centro galáctico']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </optgroup>
                <optgroup label="Sistema Solar">{P.filter((planet) => !planet.moon).map((planet) => <option key={planet.n} value={`planet:${planet.n}`}>{planet.n}</option>)}</optgroup>
                <optgroup label="Objetivos SPHEREx">{SPHEREX_TARGETS.map((target) => <option key={target.key} value={`spherex:${target.key}`}>{target.name} · {target.distanceLabel}</option>)}</optgroup>
              </select>
              <button type="button" className="kronoxConfirmPropulsionBtn" onClick={() => {
                const [kind, key] = navigationTarget.split(':');
                onSelectStation(null);
                if (kind === 'quick') onQuickTravel?.(key, key === 'sunOrbit' ? 'Órbita próxima al Sol' : key === 'asteroids' ? 'Cinturón de asteroides' : key === 'orion' ? 'Brazo de Orión' : 'Centro galáctico');
                else if (kind === 'planet') onTravelToPlanet?.(key);
                else if (kind === 'spherex') {
                  const target = SPHEREX_TARGETS.find((item) => item.key === key);
                  if (target) onTravelToSpherex?.(target);
                }
              }}>🚀 Calcular ruta y viajar automáticamente</button>
            </div>
          )}
        </div>
      )}

      {cockpitVisible && activeStation === 'science' && (
        <div
          className="kronoxDiegeticConsole"
          role="dialog"
          aria-label="Consola Científica"
          style={
            consoleProjection?.visible
              ? {
                  left: `${consoleProjection.x}px`,
                  top: `${consoleProjection.y + 40}px`,
                  bottom: 'auto',
                  transform: `translate(-50%, -50%) scale(${consoleProjection.scale})`,
                }
              : undefined
          }
        >
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">ESTACIÓN FÍSICA DE BABOR · (-4.2 m, -2.2 m) · SENSORES 3D ACTIVOS</span>
              <h4>CONSOLA CIENTÍFICA · ESPECTROFOTOMETRÍA NASA SPHEREx</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar consola">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Activa el barrido volumétrico 3D de sensores o abre directamente el archivo IRSA de NASA/IPAC para comparar épocas temporales y verificar astrometría WCS:
          </p>
          <div className="kronoxStationBtnRow">
            {SPHEREX_TARGETS.map((tgt) => (
              <button
                key={tgt.key}
                type="button"
                onClick={() => {
                  onDispatchSceneEvent?.(KRONOX_SCENE_EVENTS.SCIENTIFIC_SCAN_STARTED, {
                    targetKey: tgt.key,
                    targetName: tgt.name,
                    preferredBand: tgt.preferredBand,
                  });
                  onSelectStation(null);
                  onOpenSpherexObservatory(tgt);
                }}
              >
                ✦ Escanear e investigar {tgt.name} ({tgt.preferredBand} · {tgt.scientificStatus})
              </button>
            ))}
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'missions' && (
        <div
          className="kronoxDiegeticConsole"
          role="dialog"
          aria-label="Consola de Misiones"
          style={
            consoleProjection?.visible
              ? {
                  left: `${consoleProjection.x}px`,
                  top: `${consoleProjection.y + 40}px`,
                  bottom: 'auto',
                  transform: `translate(-50%, -50%) scale(${consoleProjection.scale})`,
                }
              : undefined
          }
        >
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">ESTACIÓN FÍSICA DE ESTRIBOR · (+4.2 m, -2.2 m)</span>
              <h4>CONSOLA DE MISIONES · BITÁCORA Y RETOS CIENTÍFICOS</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar consola">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Participa en misiones de identificación guiada: localiza estrellas de alto movimiento propio o fluctuaciones fotométricas. Hallazgos registrados: <strong>{findingsCount}</strong>.
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              onClick={() => {
                onSelectStation(null);
                onOpenMissionSelector();
              }}
            >
              Abrir selector táctico de expediciones ↗
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectStation(null);
                onOpenSpherexObservatory(SPHEREX_TARGETS[0]);
              }}
            >
              Iniciar entrenamiento guiado en Estrella de Barnard
            </button>
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'windows' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Mirador Panorámico de Proa">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">MIRADOR PANORÁMICO DE PROA · (0.0 m, -9.8 m)</span>
              <h4>OBSERVACIÓN VISUAL DIRECTA DEL COSMOS 3D</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar mirador">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Haz clic directamente sobre cualquier estrella o planeta a través del parabrisas panorámico para que Kronox IA apunte con su haz luminoso 3D y despliegue su telemetría.
          </p>
        </div>
      )}

      {cockpitVisible && activeStation === 'comms' && (
        <div
          className="kronoxDiegeticConsole"
          role="dialog"
          aria-label="Consola de Comunicaciones"
          style={
            consoleProjection?.visible
              ? {
                  left: `${consoleProjection.x}px`,
                  top: `${consoleProjection.y + 40}px`,
                  bottom: 'auto',
                  transform: `translate(-50%, -50%) scale(${consoleProjection.scale})`,
                }
              : undefined
          }
        >
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">ESTACIÓN FÍSICA CUÁNTICA · (-2.8 m, +2.8 m) · NÚCLEO ACTIVO</span>
              <h4>CONSOLA DE COMUNICACIONES · KRONOX IA</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar comunicaciones">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Núcleo de inteligencia de a bordo en línea. Puedes interactuar directamente con la entidad luminosa o solicitar un recorrido guiado por los instrumentos del puente:
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              className="active"
              onClick={() => {
                onOpenAiConsole?.();
              }}
            >
              ✦ Transmitir consulta o dialogar con Kronox IA
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectStation(null);
                onStartGuidedTour?.();
              }}
            >
              Iniciar recorrido guiado por el puente
            </button>
          </div>
        </div>
      )}
    </>
  );
}
