import '../styles/expedition.css';
import { NAVIGATION_CATALOG } from '../data/navigationCatalog.js';
import React, { useEffect, useState } from 'react';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { P, INFO } from '../data/planetData.js';
import { PHYSICAL_CABIN_STATIONS, SHIP_WORLD_UNITS } from '../scene/habitableShipWorld.js';
import { KRONOX_SCENE_EVENTS, KRONOX_CONTROL_MODES } from '../scene/kronoxSceneDirector.js';
import { getCanonicalStar, getCanonicalGalaxy, getObjectProvenance } from '../scene/astronomicalUniverse.js';
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
  navigationActive = false,
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
  freeHelmMode = false,
  onToggleFreeHelm,
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
  visualProfile = 'cinematic',
  onToggleVisualProfile,
  onOpenPauseMenu,
  observationModeInfo = null,
  onSetOpticalTelescope,
  planetaryTelemetry = null,
  activeObjectiveText = '',
}) {
  const [navigationMode, setNavigationMode] = useState('manual');
  const [navigationTarget, setNavigationTarget] = useState('planet:Tierra');
  const [navigationExperience, setNavigationExperience] = useState('choose');
  useEffect(() => {
    if (activeStation !== 'nav') setNavigationExperience('choose');
  }, [activeStation]);

  const controlModeLabel =
    directorState?.controlMode === KRONOX_CONTROL_MODES.CINEMATIC_SEQUENCE
      ? 'Secuencia 3D de Sistemas'
      : activeStation || directorState?.controlMode === KRONOX_CONTROL_MODES.MACHINE_INTERACTION
        ? 'Operando Máquina 3D'
        : 'Control Libre Astronauta';
  const flightGear =
    flightSpeed < 5
      ? 'ÓRBITA PLANETARIA'
      : flightSpeed < 300
        ? 'SISTEMA SOLAR'
        : flightSpeed < 8000
          ? 'GALÁCTICA'
          : 'HIPERGALÁCTICA';
  const gearSteps = [1, 60, 3000, 40000];
  const currentGearIndex = gearSteps.reduce(
    (best, value, index) =>
      Math.abs(value - flightSpeed) < Math.abs(gearSteps[best] - flightSpeed) ? index : best,
    0,
  );
  const holdFlightKey = (event, key) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onFlightKey?.(key, true);
  };
  const releaseFlightKey = (key) => onFlightKey?.(key, false);
  // Contextual 3D Astronomical Object Inspector
  let objectCard = null;
  const objectProvenance = selectedObject?.key ? getObjectProvenance(selectedObject.key) : null;
  if (selectedObject?.kind === 'spherex') {
    const tgt = SPHEREX_TARGETS.find((item) => item.key === selectedObject.key);
    const canonicalStar = tgt?.type !== 'galaxia' ? getCanonicalStar(selectedObject.key) : null;
    const canonicalGal = tgt?.type === 'galaxia' ? getCanonicalGalaxy(selectedObject.key) : null;
    if (tgt) {
      objectCard = {
        kind: 'spherex',
        name: tgt.name,
        type:
          tgt.type === 'galaxia'
            ? `Galaxia · cobertura SPHEREx · ${canonicalGal?.morphologicalType || 'Espiral'}`
            : `${canonicalStar?.spectralType || 'Estrella'} · ${
                tgt.mission === 'motion'
                  ? 'Alto movimiento propio'
                  : 'Variable infrarroja'
              }`,
        coordinates: `RA ${tgt.ra.toFixed(4)}° · Dec ${tgt.dec.toFixed(4)}° (ICRS)`,
        distance: tgt.distanceLabel,
        physicalSummary: canonicalStar
          ? `Teff: ${canonicalStar.temperatureK} K · Radio: ${canonicalStar.radiusSolar} R☉ · Luminosidad: ${canonicalStar.luminositySolar} L☉ · mV: ${canonicalStar.apparentMagnitude}`
          : canonicalGal
            ? `Diámetro: ~${canonicalGal.diameterKly} kly · Inclinación: ${canonicalGal.inclinationDeg}° · PA: ${canonicalGal.positionAngleDeg}°`
            : null,
        intro: `${tgt.note} ${tgt.observationSummary}`,
        scientificMethodNote: canonicalStar
          ? canonicalStar.visualMagnificationNote
          : canonicalGal?.scientificNote || null,
        hasSpherex: true,
        spherexBadge: `Datos reales SPHEREx disponibles (${tgt.preferredBand} · ${tgt.scientificStatus})`,
        target: tgt,
      };
    }
  } else if (selectedObject?.kind === 'catalog-star') {
    const star = NAVIGATION_CATALOG.stars.find((item) => item.key === selectedObject.key);
    const canonicalStar = getCanonicalStar(selectedObject.key);
    if (star)
      objectCard = {
        kind: 'catalog-star',
        name: star.name,
        type: `${canonicalStar?.spectralType || 'Estrella'} · ${
          star.planetCount
            ? 'Sistema con ' + star.planetCount + ' planetas confirmados'
            : 'Estrella de catálogo'
        }`,
        coordinates:
          'RA ' +
          star.ra.toFixed(4) +
          '° · Dec ' +
          star.dec.toFixed(4) +
          '° (ICRS · l ' +
          (canonicalStar?.lDeg ?? 0).toFixed(1) +
          '°, b ' +
          (canonicalStar?.bDeg ?? 0).toFixed(1) +
          '°)',
        distance: star.distancePc.toFixed(2) + ' pc · ' + star.distanceLy.toFixed(2) + ' años luz',
        physicalSummary: canonicalStar
          ? `Teff: ${canonicalStar.temperatureK} K · Radio: ${canonicalStar.radiusSolar} R☉ · Luminosidad: ${canonicalStar.luminositySolar} L☉ · mV: ${canonicalStar.apparentMagnitude}`
          : null,
        intro:
          (star.temperatureK ? 'Teff de catálogo: ' + star.temperatureK + ' K. ' : '') +
          (star.radiusSolar ? 'Radio de catálogo: ' + star.radiusSolar + ' radios solares. ' : '') +
          'Radio 3D comprimido para visualización; no es un tamaño a escala con las distancias.',
        scientificMethodNote: canonicalStar?.visualMagnificationNote || null,
        hasSpherex: false,
        spherexBadge: 'Consulta SPHEREx no preparada para este sistema. ' + star.sourceTitle,
        source: star.source,
      };
  } else if (selectedObject?.kind === 'planet') {
    const pl = P.find((item) => item.n === selectedObject.key);
    const info = pl ? INFO[pl.n] : null;
    const sunPhysics = pl?.sun ? getCanonicalStar('sun') : null;
    if (pl) {
      objectCard = {
        kind: 'planet',
        name: pl.n,
        type: pl.sun
          ? 'Estrella central G2V (Sistema Solar · Teff 5772 K)'
          : pl.dwarf
            ? 'Planeta enano del Sistema Solar'
            : pl.moon
              ? 'Satélite natural terrestre'
              : 'Planeta del Sistema Solar',
        coordinates: pl.au
          ? `Semieje orbital: ${pl.au} UA · Inclinación: ${pl.i || 0}°`
          : 'Centro del Sistema Solar (0 UA · 0 pc)',
        distance: pl.au
          ? `≈ ${(pl.au * 149.6).toFixed(1)} millones de km del Sol`
          : 'Referencia heliocéntrica',
        physicalSummary: sunPhysics
          ? `Teff: ${sunPhysics.temperatureK} K (luz integrada blanca en el espacio) · Radio: 1.0 R☉ · Luminosidad: 1.0 L☉ · mV: ${sunPhysics.apparentMagnitude}`
          : null,
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
      {!freeHelmMode && (
        <header
          className="kronoxBridgeTopBar"
          role="region"
          aria-label={t('Modos de vista y puente habitable 3D', language)}
        >
          <div className="kronoxBridgeIdentity">
            {onOpenPauseMenu && (
              <button
                type="button"
                className="kronoxPauseTriggerBtn"
                onClick={onOpenPauseMenu}
                title="Abrir menú de pausa [ESC]"
                aria-label="Abrir menú de pausa"
              >
                <span className="kronoxPauseKey">ESC</span>
                <span>Pausa</span>
              </button>
            )}
            <span className="kronoxShipDot" />
            <strong>KRONOX</strong>
            <span className="kronoxScaleTag">{SHIP_WORLD_UNITS.SHIP_LENGTH_METERS} m</span>
          </div>

          <nav className="kronoxViewModeSwitcher" aria-label="Selector de cámara 3D">
            <button
              type="button"
              className={`kronoxViewBtn ${viewMode === 'cockpit' ? 'active' : ''}`}
              disabled={navigationActive}
              onClick={() => {
                onChangeViewMode('cockpit');
                onToggleCabinPerspective?.(true);
              }}
              title="Vista de cabina exclusivamente en primera persona (ojos del piloto a 1.65 m)"
            >
              <span>Cabina 1P</span>
            </button>
            <button
              type="button"
              className={`kronoxViewBtn ${viewMode === 'exterior' ? 'active' : ''}`}
              disabled={navigationActive}
              onClick={() => onChangeViewMode('exterior')}
              title="Vista exterior de la nave de 120 metros"
            >
              <span>Exterior</span>
            </button>
            <button
              type="button"
              className={`kronoxViewBtn ${viewMode === 'navigation' ? 'active' : ''}`}
              disabled={navigationActive}
              onClick={() => onChangeViewMode('navigation')}
              title="Vista del mapa cósmico 3D"
            >
              <span>Cosmos</span>
            </button>
          </nav>
          {viewMode === 'exterior' && (
            <button
              type="button"
              className="kronoxResetExteriorView"
              onClick={onResetExteriorView}
              disabled={navigationActive}
              title="Restablecer encuadre de la nave de 120 m [R]"
            >
              Inspeccionar nave [R]
            </button>
          )}

          {onSetOpticalTelescope && viewMode === 'cockpit' && (
            <div className="kronoxTelescopeHudGroup" aria-label="Control de Telescopio Óptico">
              <button
                type="button"
                className={`kronoxViewBtn ${observationModeInfo?.opticalMagnification > 1 ? 'active' : ''}`}
                onClick={() => {
                  const currentMag = observationModeInfo?.opticalMagnification || 1;
                  if (currentMag <= 1) onSetOpticalTelescope(true, 150);
                  else onSetOpticalTelescope(false, 1);
                }}
                title="Alternar entre observación a simple vista (1×) e instrumento óptico [T]"
              >
                <span>
                  {observationModeInfo?.opticalMagnification > 1
                    ? `🔭 Telescopio ${observationModeInfo.opticalMagnification}×`
                    : '👁 Simple vista 1× [T]'}
                </span>
              </button>
              {observationModeInfo?.opticalMagnification > 1 && (
                <div className="kronoxTelescopeMagRow">
                  {[50, 150, 300].map((mag) => (
                    <button
                      key={mag}
                      type="button"
                      className={`kronoxMagStepBtn ${observationModeInfo?.opticalMagnification === mag ? 'active' : ''}`}
                      onClick={() => onSetOpticalTelescope(true, mag)}
                    >
                      {mag}×
                    </button>
                  ))}
                  <select
                    aria-label="Objetivo planetario del telescopio"
                    className="kronoxTelescopeTargetSelect"
                    value={observationModeInfo?.opticalTargetBody || 'Júpiter'}
                    onChange={(e) =>
                      onSetOpticalTelescope(
                        true,
                        observationModeInfo?.opticalMagnification || 150,
                        e.target.value,
                      )
                    }
                  >
                    {['Júpiter', 'Saturno', 'Marte', 'Venus', 'Luna', 'Mercurio', 'Urano', 'Neptuno'].map(
                      (pName) => (
                        <option key={pName} value={pName}>
                          {pName}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="kronoxCruiseReadout">
            {observationModeInfo?.mode?.label && (
              <span
                className={`kronoxObsModeBadge ${observationModeInfo.mode.isCompressedScale ? 'is-compressed' : ''}`}
                title={observationModeInfo.mode.description}
              >
                {observationModeInfo.mode.label}
              </span>
            )}
            {activeObjectiveText && (
              <span className="kronoxHudObjectivePill" title="Objetivo de misión activo">
                ◎ {activeObjectiveText}
              </span>
            )}
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
                {astronautCoords.z >= 0 ? `+${astronautCoords.z}` : astronautCoords.z} m ·{' '}
                {SHIP_WORLD_UNITS.WALK_SPEED_MPS} m/s
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
            {onToggleVisualProfile && (
              <button
                type="button"
                className="kronoxBridgeSettingsBtn"
                onClick={onToggleVisualProfile}
                title="Alternar el firmamento entre Modo Científico (magnitudes y flujo estricto) y Modo Cinematográfico (mayor riqueza visual de la Vía Láctea)"
                aria-label="Alternar modo de cielo entre científico y cinematográfico"
              >
                <span>{visualProfile === 'scientific' ? '✦ Cielo: Científico' : '✦ Cielo: Cinematográfico'}</span>
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
                <span>Más ajustes</span>
              </button>
            )}
          </div>
        </header>
      )}

      {cockpitVisible && freeHelmMode && (
        <div className="kronoxFreeHelmHud" role="status" aria-label="Telemetría del timón libre">
          <aside className="kronoxFreeHelmSidePanel left">
            <small>VELOCIDAD DE VUELO</small>
            <strong>
              {consoleProjection?.speed?.toFixed?.(1) ?? '0.0'} <i>u/s</i>
            </strong>
            <span>MARCHA · {flightGear}</span>
            <div className="kronoxFreeHelmGearControls">
              <button
                type="button"
                aria-label="Reducir marcha"
                disabled={currentGearIndex === 0}
                onClick={() => onSpeedPreset?.(gearSteps[Math.max(0, currentGearIndex - 1)])}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Aumentar marcha"
                disabled={currentGearIndex === gearSteps.length - 1}
                onClick={() =>
                  onSpeedPreset?.(gearSteps[Math.min(gearSteps.length - 1, currentGearIndex + 1)])
                }
              >
                +
              </button>
            </div>
            <div className="kronoxFreeHelmThrusters">
              <button
                type="button"
                onPointerDown={(event) => holdFlightKey(event, 'w')}
                onPointerUp={() => releaseFlightKey('w')}
                onPointerCancel={() => releaseFlightKey('w')}
                onLostPointerCapture={() => releaseFlightKey('w')}
              >
                ▲ PROPULSIÓN
              </button>
              <button
                type="button"
                onPointerDown={(event) => holdFlightKey(event, 's')}
                onPointerUp={() => releaseFlightKey('s')}
                onPointerCancel={() => releaseFlightKey('s')}
                onLostPointerCapture={() => releaseFlightKey('s')}
              >
                ▼ REVERSA
              </button>
            </div>
          </aside>
          <aside className="kronoxFreeHelmSidePanel right">
            <small>ACELERACIÓN / INERCIA</small>
            <strong>
              {consoleProjection?.inertia?.toFixed?.(2) ?? '0.00'} <i>u/s²</i>
            </strong>
            <span>RUMBO · {consoleProjection?.heading ?? 0}°</span>
            <span>INCLINACIÓN · {consoleProjection?.pitch ?? 0}°</span>
            <div className="kronoxFreeHelmThrusters kronoxFreeHelmSteering">
              <button
                type="button"
                aria-label="Girar a la izquierda"
                onPointerDown={(event) => holdFlightKey(event, 'a')}
                onPointerUp={() => releaseFlightKey('a')}
                onPointerCancel={() => releaseFlightKey('a')}
                onLostPointerCapture={() => releaseFlightKey('a')}
              >
                ← RUMBO
              </button>
              <button
                type="button"
                aria-label="Girar a la derecha"
                onPointerDown={(event) => holdFlightKey(event, 'd')}
                onPointerUp={() => releaseFlightKey('d')}
                onPointerCancel={() => releaseFlightKey('d')}
                onLostPointerCapture={() => releaseFlightKey('d')}
              >
                RUMBO →
              </button>
              <button
                type="button"
                className="boost"
                onPointerDown={(event) => holdFlightKey(event, 'shift')}
                onPointerUp={() => releaseFlightKey('shift')}
                onPointerCancel={() => releaseFlightKey('shift')}
                onLostPointerCapture={() => releaseFlightKey('shift')}
              >
                IMPULSO ×5
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* OPTICAL TELESCOPE EYEPIECE & REAL ANGULAR TELEMETRY HUD */}
      {cockpitVisible &&
        viewMode === 'cockpit' &&
        observationModeInfo?.opticalMagnification > 1 &&
        planetaryTelemetry && (
          <div
            className="kronoxTelescopeEyepieceHud"
            role="status"
            aria-label="Retícula y telemetría de instrumento óptico"
          >
            <div className="kronoxTelescopeReticleRing" aria-hidden="true">
              <span className="kronoxReticleCrosshairH" />
              <span className="kronoxReticleCrosshairV" />
            </div>
            <div className="kronoxTelescopeReadoutBox">
              <div className="kronoxTelescopeReadoutHead">
                <strong>
                  INSTRUMENTO ÓPTICO · {(planetaryTelemetry.bodyName || planetaryTelemetry.name || 'PLANETA').toUpperCase()} (
                  {observationModeInfo.opticalMagnification}×)
                </strong>
                <span>Época {planetaryTelemetry.epoch || 'J2000.0'}</span>
              </div>
              <div className="kronoxTelescopeMetricsGrid">
                <span>
                  Δ Distancia: <b>{planetaryTelemetry.distanceAu?.toFixed(3)} UA</b> (
                  {Math.round(planetaryTelemetry.distanceKm || 0).toLocaleString('es-ES')} km)
                </span>
                <span>
                  Radio físico R:{' '}
                  <b>{Number(planetaryTelemetry.radiusKm || 0).toLocaleString('es-ES')} km</b>
                </span>
                <span>
                  Diámetro angular θ:{' '}
                  <b>{(planetaryTelemetry.angularDiameterArcsec ?? planetaryTelemetry.angularArcsec ?? 0).toFixed(2)}″</b>{' '}
                  (Aparente:{' '}
                  {(planetaryTelemetry.magnifiedAngularArcsec ?? planetaryTelemetry.apparentArcsec ?? 0).toFixed(0)}″)
                </span>
                <span>
                  Magnitud V: <b>{planetaryTelemetry.apparentMagnitudeV?.toFixed(2)}</b> · Fase:{' '}
                  <b>{Math.round((planetaryTelemetry.illuminatedFraction || 1) * 100)}%</b>
                </span>
              </div>
            </div>
          </div>
        )}

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
          {objectCard.physicalSummary && (
            <p className="kronoxInspectorIntro" style={{ fontSize: '0.82rem', opacity: 0.92 }}>
              <strong>Parámetros astrofísicos:</strong> {objectCard.physicalSummary}
            </p>
          )}
          {objectCard.scientificMethodNote && (
            <p className="kronoxInspectorIntro" style={{ fontSize: '0.76rem', opacity: 0.78 }}>
              {objectCard.scientificMethodNote}
            </p>
          )}
          {objectProvenance && (
            <p className="kronoxInspectorIntro" style={{ fontSize: '0.74rem', opacity: 0.82 }}>
              <strong>Procedencia y archivo:</strong> {objectProvenance.catalogSource} ·{' '}
              {objectProvenance.reconstructionMethod}
            </p>
          )}

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
                  Viajar al objeto
                </button>
                <button
                  type="button"
                  className="kronoxInspectorBtn secondary"
                  onClick={() => onOpenSpherexObservatory(objectCard.target)}
                >
                  Investigar en Consola Científica SPHEREx
                </button>
              </>
            ) : objectCard.kind === 'catalog-star' ? (
              <>
                <a
                  className="kronoxInspectorBtn secondary"
                  href={objectCard.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar catálogo de origen
                </a>
                <button className="kronoxInspectorBtn primary" onClick={onCloseObjectInspector}>
                  Continuar explorando
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
      {cockpitVisible && activeStation === 'nav' && !freeHelmMode && (
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
              <span className="kronoxDiegeticTag">
                ESTACIÓN FÍSICA DE PROA · (0.0 m, -6.2 m) · MAPA HOLOGRÁFICO 3D ACTIVO
              </span>
              <h4>CONSOLA DE NAVEGACIÓN · PROPULSIÓN Y SALTOS ESTELARES</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar consola">
              ×
            </button>
          </div>
          <div className="kronoxNavTelemetry" aria-label="Telemetría de vuelo en tiempo real">
            <div>
              <small>VELOCIDAD</small>
              <strong>
                {consoleProjection?.speed?.toFixed?.(1) ?? '0.0'} <i>u/s</i>
              </strong>
            </div>
            <div>
              <small>ACELERACIÓN</small>
              <strong>
                {consoleProjection?.inertia?.toFixed?.(2) ?? '0.00'} <i>u/s²</i>
              </strong>
            </div>
            <div>
              <small>RUMBO / INCLINACIÓN</small>
              <strong>
                {consoleProjection?.heading ?? 0}° / {consoleProjection?.pitch ?? 0}°
              </strong>
            </div>
            <div>
              <small>MASA · {consoleProjection?.flightMode ?? 'ESPERA'}</small>
              <strong>
                Sin especificar <i>kg</i>
              </strong>
            </div>
          </div>
          {navigationExperience === 'choose' ? (
            <div className="kronoxNavExperienceChoice">
              <button type="button" onClick={() => setNavigationExperience('travel')}>
                <strong>✦ Planificar viaje</strong>
                <span>Elegir un destino y pilotar manualmente o activar el piloto automático.</span>
              </button>
              <button type="button" onClick={() => onToggleFreeHelm?.(true)}>
                <strong>✈ Timón libre</strong>
                <span>Tomar el control en primera persona, sin el panel de navegación.</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="kronoxNavBack"
                onClick={() => setNavigationExperience('choose')}
              >
                ← Volver a opciones de pilotaje
              </button>
              <div className="kronoxNavModeTabs" role="tablist" aria-label="Modo de pilotaje">
                <button
                  type="button"
                  role="tab"
                  aria-selected={navigationMode === 'manual'}
                  className={navigationMode === 'manual' ? 'active' : ''}
                  onClick={() => setNavigationMode('manual')}
                >
                  ✧ Pilotaje manual
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={navigationMode === 'auto'}
                  className={navigationMode === 'auto' ? 'active' : ''}
                  onClick={() => setNavigationMode('auto')}
                >
                  ⌖ Piloto automático
                </button>
              </div>
              {navigationMode === 'manual' ? (
                <div className="kronoxNavManualPanel">
                  <div>
                    <strong>CONTROL MANUAL</strong>
                    <small>
                      W / S · avance · A / D · rumbo · Q / E · vertical · Shift · impulso ×5
                    </small>
                    <div className="kronoxNavSpeedPresets">
                      {[
                        [1, 'Órbita'],
                        [60, 'Sistema'],
                        [3000, 'Galaxia'],
                        [40000, 'Hiper'],
                      ].map(([value, label]) => (
                        <button key={value} type="button" onClick={() => onSpeedPreset(value)}>
                          {label} · {value.toLocaleString('es-ES')} u/s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="kronoxNavControlPad" aria-label="Timón manual">
                    {[
                      ['w', '↑', 'Avanzar'],
                      ['a', '←', 'Izquierda'],
                      ['s', '↓', 'Retroceder'],
                      ['d', '→', 'Derecha'],
                    ].map(([key, icon, label]) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={label}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          onFlightKey?.(key, true);
                        }}
                        onPointerUp={() => onFlightKey?.(key, false)}
                        onPointerCancel={() => onFlightKey?.(key, false)}
                        onLostPointerCapture={() => onFlightKey?.(key, false)}
                      >
                        {icon}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="Ascender"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onFlightKey?.('e', true);
                      }}
                      onPointerUp={() => onFlightKey?.('e', false)}
                      onPointerCancel={() => onFlightKey?.('e', false)}
                      onLostPointerCapture={() => onFlightKey?.('e', false)}
                    >
                      ↑ Z
                    </button>
                    <button
                      type="button"
                      aria-label="Descender"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onFlightKey?.('q', true);
                      }}
                      onPointerUp={() => onFlightKey?.('q', false)}
                      onPointerCancel={() => onFlightKey?.('q', false)}
                      onLostPointerCapture={() => onFlightKey?.('q', false)}
                    >
                      ↓ Z
                    </button>
                    <button
                      type="button"
                      className="kronoxNavBoost"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onFlightKey?.('shift', true);
                      }}
                      onPointerUp={() => onFlightKey?.('shift', false)}
                      onPointerCancel={() => onFlightKey?.('shift', false)}
                      onLostPointerCapture={() => onFlightKey?.('shift', false)}
                    >
                      IMPULSO ×5
                    </button>
                  </div>
                </div>
              ) : (
                <div className="kronoxNavAutopilotPanel">
                  <label htmlFor="kronoxNavDestination">OBJETIVO DE NAVEGACIÓN</label>
                  <select
                    id="kronoxNavDestination"
                    value={navigationTarget}
                    onChange={(event) => setNavigationTarget(event.target.value)}
                  >
                    <optgroup label="Destinos rápidos">
                      {[
                        ['quick:sunOrbit', 'Órbita próxima al Sol'],
                        ['quick:asteroids', 'Cinturón de asteroides'],
                        ['quick:orion', 'Brazo de Orión'],
                        ['quick:core', 'Centro galáctico'],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Sistema Solar">
                      {P.filter((planet) => !planet.moon).map((planet) => (
                        <option key={planet.n} value={`planet:${planet.n}`}>
                          {planet.n}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Objetivos SPHEREx">
                      {SPHEREX_TARGETS.map((target) => (
                        <option key={target.key} value={`spherex:${target.key}`}>
                          {target.name} · {target.distanceLabel}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    className="kronoxConfirmPropulsionBtn"
                    onClick={() => {
                      const [kind, key] = navigationTarget.split(':');
                      onSelectStation(null);
                      if (kind === 'quick')
                        onQuickTravel?.(
                          key,
                          key === 'sunOrbit'
                            ? 'Órbita próxima al Sol'
                            : key === 'asteroids'
                              ? 'Cinturón de asteroides'
                              : key === 'orion'
                                ? 'Brazo de Orión'
                                : 'Centro galáctico',
                        );
                      else if (kind === 'planet') onTravelToPlanet?.(key);
                      else if (kind === 'spherex') {
                        const target = SPHEREX_TARGETS.find((item) => item.key === key);
                        if (target) onTravelToSpherex?.(target);
                      }
                    }}
                  >
                    🚀 Calcular ruta y viajar automáticamente
                  </button>
                </div>
              )}
            </>
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
              <span className="kronoxDiegeticTag">
                ESTACIÓN FÍSICA DE BABOR · (-4.2 m, -2.2 m) · SENSORES 3D ACTIVOS
              </span>
              <h4>CONSOLA CIENTÍFICA · ESPECTROFOTOMETRÍA NASA SPHEREx</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar consola">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Activa el barrido volumétrico 3D de sensores o abre directamente el archivo IRSA de
            NASA/IPAC para comparar épocas temporales y verificar astrometría WCS:
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
              <span className="kronoxDiegeticTag">
                ESTACIÓN FÍSICA DE ESTRIBOR · (+4.2 m, -2.2 m)
              </span>
              <h4>CONSOLA DE MISIONES · BITÁCORA Y RETOS CIENTÍFICOS</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar consola">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Participa en misiones de identificación guiada: localiza estrellas de alto movimiento
            propio o fluctuaciones fotométricas. Hallazgos registrados:{' '}
            <strong>{findingsCount}</strong>.
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
        <div
          className="kronoxDiegeticConsole compact"
          role="dialog"
          aria-label="Mirador Panorámico de Proa"
        >
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">
                MIRADOR PANORÁMICO DE PROA · (0.0 m, -9.8 m)
              </span>
              <h4>OBSERVACIÓN VISUAL DIRECTA DEL COSMOS 3D</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar mirador">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Haz clic directamente sobre cualquier estrella o planeta a través del parabrisas
            panorámico para que Kronox IA apunte con su haz luminoso 3D y despliegue su telemetría.
          </p>
          {onToggleVisualProfile && (
            <div className="kronoxStationBtnRow" style={{ marginTop: '8px' }}>
              <button type="button" onClick={onToggleVisualProfile}>
                {visualProfile === 'scientific'
                  ? 'Cambiar a MODO CINEMATOGRÁFICO (Mayor riqueza visual de la Vía Láctea)'
                  : 'Cambiar a MODO CIENTÍFICO (Rango dinámico y flujo estelar estricto)'}
              </button>
            </div>
          )}
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
              <span className="kronoxDiegeticTag">
                ESTACIÓN FÍSICA CUÁNTICA · (-2.8 m, +2.8 m) · NÚCLEO ACTIVO
              </span>
              <h4>CONSOLA DE COMUNICACIONES · KRONOX IA</h4>
            </div>
            <button
              type="button"
              onClick={() => onSelectStation(null)}
              aria-label="Cerrar comunicaciones"
            >
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Núcleo de inteligencia de a bordo en línea. Puedes interactuar directamente con la
            entidad luminosa o solicitar un recorrido guiado por los instrumentos del puente:
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
