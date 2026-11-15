import '../styles/expedition.css';
import { NAVIGATION_CATALOG } from '../data/navigationCatalog.js';
import React, { useEffect, useState } from 'react';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { P, INFO } from '../data/planetData.js';
import { SHIP_WORLD_UNITS } from '../scene/habitableShipWorld.js';
import { KRONOX_SCENE_EVENTS } from '../scene/kronoxSceneDirector.js';
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
  astronautSectorState = null,
  onToggleCabinPerspective,
  onToggleMicrogravityMode,
  onToggleGrabRail,
  onTeleportToDeck,
  onOpenArchiveJournal,
  onOpenPersonalHub,
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
  onFocusPlanet,
  freeHelmMode = false,
  onToggleFreeHelm,
  onOpenPlanetInfo,
  onOpenMissionSelector,
  onOpenAiConsole,
  onStartMicConsult,
  guideState = null,
  onStartGuidedTour,
  onSkipTutorialStep,
  onEndTutorial,
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
  activeMissionId = 'barnard',
  onOpenMissionFromObjective,
  mechanismsState = null,
  onTriggerMechanism,
  onActivateNearestStation,
  onSitInCommandSeat,
  interactionFeedback = null,
  heldToolId = null,
  pointerLockState = null,
  assetLoadingState = null,
  vrState = null,
  onToggleVr,
  onRecenterVr,
}) {
  const [navigationMode, setNavigationMode] = useState('manual');
  const [navigationTarget, setNavigationTarget] = useState('planet:Tierra');
  const [navigationExperience, setNavigationExperience] = useState('choose');
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [hasInspectedConsole, setHasInspectedConsole] = useState(false);
  const [hasOpenedNavigationMap, setHasOpenedNavigationMap] = useState(false);

  const deckNumber = astronautSectorState?.deckNumber ?? 1;
  const activeMissionTarget =
    SPHEREX_TARGETS.find((tgt) => tgt.key === activeMissionId) || SPHEREX_TARGETS[0];

  useEffect(() => {
    if (activeStation) setHasInspectedConsole(true);
  }, [activeStation]);

  useEffect(() => {
    if (viewMode === 'navigation') setHasOpenedNavigationMap(true);
  }, [viewMode]);

  useEffect(() => {
    if (!activeObjectiveText && !guideState?.active) {
      setObjectiveOpen(false);
    }
  }, [activeObjectiveText, guideState?.active]);

  const objectiveSteps = [
    {
      label: 'Recorrer el Puente de Mando e inspeccionar consolas',
      done: Boolean(hasInspectedConsole || activeStation || deckNumber > 1 || findingsCount > 0),
    },
    {
      label: `Revisar ruta hacia ${activeMissionTarget?.name || 'Estrella de Barnard'} en Mapa galáctico`,
      done: Boolean(hasOpenedNavigationMap || viewMode === 'navigation' || findingsCount > 0),
    },
    {
      label: 'Bajar a Ingeniería y Laboratorio SPHEREx',
      done: Boolean(deckNumber >= 3 || findingsCount > 0),
    },
    {
      label: 'Registrar hallazgo espectral infrarrojo',
      done: findingsCount > 0,
    },
  ];
  const completedObjCount = objectiveSteps.filter((s) => s.done).length;
  const hasPendingObjective = Boolean(activeObjectiveText || guideState?.active);

  useEffect(() => {
    if (activeStation !== 'nav') setNavigationExperience('choose');
  }, [activeStation]);

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
  // Never display celestial object cards while exploring interior lower decks (C02, C03, C04) without an observation instrument
  const isInteriorNonObservation =
    viewMode === 'cockpit' &&
    (observationModeInfo?.opticalMagnification || 1) <= 1 &&
    activeStation !== 'windows' &&
    activeStation !== 'nav' &&
    Boolean(astronautSectorState?.deckId && astronautSectorState.deckId !== 'deck-01');

  let objectCard = null;
  const objectProvenance =
    !isInteriorNonObservation && selectedObject?.key
      ? getObjectProvenance(selectedObject.key)
      : null;
  if (!isInteriorNonObservation && selectedObject?.kind === 'spherex') {
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
  } else if (!isInteriorNonObservation && selectedObject?.kind === 'catalog-star') {
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
  } else if (!isInteriorNonObservation && selectedObject?.kind === 'planet') {
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
      {/* HUD SUPERIOR COMPACTO DE KRONOX */}
      {!freeHelmMode && (
        <header
          className="kronoxBridgeTopBar"
          role="region"
          aria-label={t('Barra superior mínima de KRONOX', language)}
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
            <span className="kronoxScaleTag">{`${SHIP_WORLD_UNITS.SHIP_LENGTH_METERS} m`}</span>
          </div>

          <div className="kronoxTopRightControls">
            <nav className="kronoxViewModeSwitcher" aria-label={t('Selector de cámara 3D', language)}>
              <button
                type="button"
                className={`kronoxViewBtn ${viewMode === 'cockpit' && cabinFirstPerson ? 'active' : ''}`}
                aria-pressed={viewMode === 'cockpit' && cabinFirstPerson}
                onClick={() => {
                  if (viewMode !== 'cockpit') onChangeViewMode?.('cockpit');
                  onToggleCabinPerspective?.(true);
                }}
                title="Exploración interior en primera persona [C]"
              >
                Cabina 1P
              </button>
              <button
                type="button"
                className={`kronoxViewBtn ${viewMode === 'cockpit' && !cabinFirstPerson ? 'active' : ''}`}
                aria-pressed={viewMode === 'cockpit' && !cabinFirstPerson}
                onClick={() => {
                  if (viewMode !== 'cockpit') onChangeViewMode?.('cockpit');
                  onToggleCabinPerspective?.(false);
                }}
                title="Exploración interior en tercera persona [C]"
              >
                3P
              </button>
              <button
                type="button"
                className={`kronoxViewBtn ${viewMode === 'exterior' ? 'active' : ''}`}
                aria-pressed={viewMode === 'exterior'}
                onClick={() => onChangeViewMode?.('exterior')}
                title="Vista exterior de la nave KRONOX (120 m)"
              >
                Exterior
              </button>
            </nav>

            {viewMode === 'exterior' && onResetExteriorView && (
              <button
                type="button"
                className="kronoxResetExteriorView"
                onClick={() => onResetExteriorView?.()}
                title="Inspeccionar nave desde cámara orbital libre [R]"
              >
                Inspeccionar [R]
              </button>
            )}

            <div className="kronoxTopPersonalActions">
              {onOpenPersonalHub && (
                <button
                  type="button"
                  className="kronoxHudQuickBtn"
                  onClick={() => onOpenPersonalHub('map')}
                  title="Abrir Mapa Galáctico, Misiones y Manual"
                >
                  <span>🌌</span>
                  <span>Mapa · Guía</span>
                </button>
              )}

              {onStartGuidedTour && (
                <button
                  type="button"
                  className={`kronoxHudQuickBtn${guideState?.active ? ' is-tutorial-active' : ''}`}
                  onClick={() => onStartGuidedTour()}
                  title="Abrir tutorial interactivo guiado"
                >
                  <span>?</span>
                  <span>Tutorial</span>
                </button>
              )}

              {onToggleVr && (
                <button
                  type="button"
                  className={`kronoxHudQuickBtn is-vr-toggle${vrState?.presenting ? ' is-vr-active' : ''}`}
                  aria-pressed={Boolean(vrState?.presenting)}
                  onClick={() => onToggleVr()}
                  title={
                    vrState?.presenting
                      ? 'Salir de la sesión de Realidad Virtual (WebXR)'
                      : vrState?.supported
                        ? 'Entrar en Realidad Virtual (WebXR 6DoF)'
                        : 'Modo VR (WebXR) — Consultar compatibilidad o conectar visor'
                  }
                >
                  <span>VR</span>
                  <span>
                    {vrState?.presenting
                      ? 'Salir VR'
                      : vrState?.supported
                        ? 'Entrar VR'
                        : 'Modo VR'}
                  </span>
                </button>
              )}

              {vrState?.presenting && onRecenterVr && (
                <button
                  type="button"
                  className="kronoxHudQuickBtn is-vr-toggle"
                  onClick={() => onRecenterVr()}
                  title="Centrar vista VR del casco HMD"
                >
                  <span>⌖</span>
                  <span>Centrar</span>
                </button>
              )}
            </div>

            {onOpenAiConsole && (
              <button
                type="button"
                className="kronoxHudQuickBtn is-ai-consult"
                onClick={() => onOpenAiConsole()}
                title="Abrir KRONOX IA (Micrófono o Chat escrito) [K]"
              >
                <span>✦</span>
                <span>KRONOX IA</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* INDICADOR DISCRETO E INDEPENDIENTE DE OBJETIVO ACTIVO */}
      {!freeHelmMode && !guideState?.active && hasPendingObjective && (
        <div className="kronoxObjectiveCornerDock">
          <button
            type="button"
            className={`kronoxObjectiveMiniBadge${objectiveOpen ? ' is-open' : ''}`}
            onClick={() => setObjectiveOpen((prev) => !prev)}
            aria-expanded={objectiveOpen}
            title="Ver objetivo actual, pasos requeridos y progreso"
          >
            <span className="kronoxObjDot" aria-hidden="true" />
            <span className="kronoxObjBadgeTitle">Objetivo</span>
            <span className="kronoxObjBadgeStep">{completedObjCount}/{objectiveSteps.length}</span>
          </button>

          {objectiveOpen && (
            <div className="kronoxObjectivePopover" role="region" aria-label="Detalle del objetivo activo">
              <div className="kronoxObjectivePopoverHead">
                <strong>Objetivo actual</strong>
                <button
                  type="button"
                  onClick={() => setObjectiveOpen(false)}
                  aria-label="Cerrar detalle de objetivo"
                >
                  ✕
                </button>
              </div>
              <p className="kronoxObjectivePopoverSummary">
                {activeObjectiveText || `Expedición activa: ${activeMissionTarget?.name || 'Estrella de Barnard'}.`}
              </p>
              <div className="kronoxObjectiveProgressTrack" aria-label="Progreso del objetivo">
                <div
                  className="kronoxObjectiveProgressFill"
                  style={{ width: `${Math.round((completedObjCount / objectiveSteps.length) * 100)}%` }}
                />
              </div>
              <ul className="kronoxObjectiveChecklist">
                {objectiveSteps.map((st, idx) => (
                  <li key={idx} className={st.done ? 'is-done' : ''}>
                    <span>{st.done ? '✓' : `${idx + 1}.`}</span>
                    <span>{st.label}</span>
                  </li>
                ))}
              </ul>
              <div className="kronoxObjectivePopoverActions">
                <button
                  type="button"
                  className="kronoxObjectiveResumeBtn"
                  onClick={() => {
                    setObjectiveOpen(false);
                    if (onOpenMissionFromObjective) onOpenMissionFromObjective(activeMissionTarget);
                    else onOpenPersonalHub?.('missions');
                  }}
                >
                  Retomar / Ver misión
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(cockpitVisible || viewMode === 'exterior') && freeHelmMode && (
        <div className="kronoxFreeHelmHud" role="status" aria-label="Telemetría del timón libre">
          <div className="kronoxFreeHelmTopDock">
            <span className="kronoxFreeHelmTopBadge">VISTA EXTERIOR · TIMÓN LIBRE</span>
            <span className="kronoxFreeHelmTopHint">W/S avance · A/D rumbo · Q/E altitud · Ratón órbita · Shift ×5</span>
            <div className="kronoxFreeHelmTopActions">
              <button
                type="button"
                className="kronoxFreeHelmPlanBtn"
                onClick={() => {
                  onToggleFreeHelm?.(false);
                  onSelectStation?.('nav');
                }}
              >
                Planificar ruta
              </button>
              <button
                type="button"
                className="kronoxFreeHelmReturnBtn"
                onClick={() => onToggleFreeHelm?.(false)}
              >
                ↩ Volver a Cabina 1 [ESC]
              </button>
            </div>
          </div>
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
                  <b>{Number(planetaryTelemetry.radiusKm || 0).toLocaleString('es-ES')} km</b> · Eje axial:{' '}
                  <b>{planetaryTelemetry.axialTiltDeg ?? 0}°</b>
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
                <span>
                  Lunas resueltas:{' '}
                  <b>
                    {Array.isArray(planetaryTelemetry.resolvableMoons) &&
                    planetaryTelemetry.resolvableMoons.length > 0
                      ? planetaryTelemetry.resolvableMoons
                          .map((moon) => {
                            if (typeof moon === 'string') return moon;
                            if (!moon || typeof moon !== 'object') return null;
                            const label = moon.name || 'Satélite';
                            const sep = Number(moon.maxAngularSeparationArcsec ?? moon.angularSeparationArcsec);
                            const dia = Number(moon.angularDiameterArcsec);
                            if (Number.isFinite(sep) && sep > 0) {
                              return `${label} (${sep.toFixed(1)}″${Number.isFinite(dia) && dia >= 0.05 ? `, Ø ${dia.toFixed(2)}″` : ''})`;
                            }
                            return label;
                          })
                          .filter(Boolean)
                          .join(' · ')
                      : `Ninguna resuelta a ${observationModeInfo?.opticalMagnification || 10}×`}
                  </b>
                </span>
              </div>
            </div>
          </div>
        )}

      {/* SUTIL MARCO PERIFÉRICO DE VISOR EVA EN 1ª PERSONA + RETÍCULA PRECISA DE INTERACCIÓN */}
      {cockpitVisible && viewMode === 'cockpit' && (observationModeInfo?.opticalMagnification || 1) <= 1 && (
        <>
          {cabinFirstPerson && (
            <div className="kronoxFpVisorRim" aria-hidden="true">
              <span className="kronoxFpVisorArcTop" />
              <span className="kronoxFpVisorArcBottom" />
            </div>
          )}
          {!activeStation && !freeHelmMode && (
            <div
              className={`kronoxFpCrosshair ${nearestStation ? 'is-targeted' : ''}`}
              aria-hidden="true"
            />
          )}
          {!activeStation && !freeHelmMode && pointerLockState?.eligible && (
            <div className="kronoxPointerLockHint" role="status" aria-live="polite">
              {pointerLockState.active
                ? 'Vista con ratón activa · Pulsa [L] para liberar el cursor · [ESC] Pausa'
                : pointerLockState.fallbackMode || !pointerLockState.supported
                  ? 'Arrastra con el mouse para girar la cámara · Clic para seleccionar · [ESC] Pausa'
                  : 'Pulsa [L] para activar/liberar vista con ratón (o arrastra) · Clic para elegir planeta'}
            </div>
          )}
          {assetLoadingState?.active && (
            <div className="kronoxAssetStreamPill" aria-live="polite">
              Cargando detalles planetarios ({assetLoadingState.loaded}/{assetLoadingState.total})
            </div>
          )}
        </>
      )}

      {/* CONFIRMACIÓN BREVE DIEGÉTICA AL OPERAR MECANISMOS / HERRAMIENTAS 3D DIRECTAS */}
      {cockpitVisible && interactionFeedback?.text && (
        <div className="kronoxInteractionToast" role="status" aria-live="polite">
          <span>✓</span>
          <span>{interactionFeedback.text}</span>
        </div>
      )}

      {/* DISCRETE MINIMAL CONTEXTUAL PROMPT WHEN ASTRONAUT IS NEAR A PHYSICAL 3D CONSOLE */}
      {cockpitVisible && nearestStation && nearestStation.id !== 'elevator-panel' && !activeStation && (
        <div className="kronoxProximityPrompt" role="status" aria-live="polite">
          <div className="kronoxProximityKey">[E]</div>
          <div className="kronoxProximityInfo">
            <strong>{nearestStation.title || nearestStation.label}</strong>
          </div>
          <button
            type="button"
            className="kronoxProximityActivateBtn"
            onClick={() => {
              if (onActivateNearestStation?.()) return;
              onSelectStation(nearestStation.id);
              if (nearestStation.id === 'comms') onOpenAiConsole?.();
            }}
          >
            {nearestStation.actionLabel
              ? nearestStation.actionLabel
              : String(nearestStation.id || '').startsWith('elevator-call-')
                ? 'Llamar'
                : nearestStation.id === 'elevator-panel'
                  ? 'Planta'
                  : 'Operar'}
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
                {onFocusPlanet && (
                  <button
                    type="button"
                    className="kronoxInspectorBtn secondary"
                    onClick={() => onFocusPlanet(objectCard.planetName)}
                  >
                    Enfocar en cámara
                  </button>
                )}
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
                CUBIERTA 01 · CHEVRÓN DE NAVEGACIÓN · MAPA 3D
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
                <span>Cambiar a vista exterior y pilotar la nave directamente en el espacio.</span>
              </button>
              {!astronautSectorState?.seated && onSitInCommandSeat && (
                <button
                  type="button"
                  onClick={() => {
                    onSitInCommandSeat();
                  }}
                >
                  <strong>💺 Sentarse en puesto de mando</strong>
                  <span>Ocupar el asiento de mando en Cabina 1 frente al ventanal panorámico.</span>
                </button>
              )}
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
                CUBIERTA 03 · LABORATORIO BABOR SPHEREx · SENSORES ACTIVOS
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
                CUBIERTA 01 · MESA HOLOGRÁFICA TÁCTICA
              </span>
              <h4>CONSOLA DE MISIONES · OBJETIVOS Y RETOS CIENTÍFICOS</h4>
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
                CUBIERTA 01 · VENTANAL PANORÁMICO DE PROA
              </span>
              <h4>OBSERVACIÓN VISUAL DIRECTA DEL COSMOS 3D</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar mirador">
              ×
            </button>
          </div>
          <p className="kronoxStationDesc">
            Haz clic directamente sobre cualquier estrella o planeta a través del parabrisas
            panorámico para que KRONOX IA apunte con su haz luminoso 3D y despliegue su telemetría.
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
                CUBIERTA 01 · PUESTO TÁCTICO Y ENLACE KRONOX · EN LÍNEA
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
              ✦ Transmitir consulta o dialogar con KRONOX IA
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

      {cockpitVisible && activeStation === 'archive' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Cúpula Dorsal de Archivo">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 03 · ARCHIVO ESPECTRAL IRSA</span>
              <h4>ARCHIVO ESTELAR Y REGISTRO CIENTÍFICO</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar archivo">×</button>
          </div>
          <p className="kronoxStationDesc">
            Registra y consulta tus hallazgos fotométricos y registros observacionales de SPHEREx.
            Hallazgos actuales: <strong>{findingsCount}</strong>.
          </p>
          <div className="kronoxStationBtnRow">
            <button type="button" className="active" onClick={() => { onSelectStation(null); onOpenArchiveJournal?.(); }}>
              ✦ Abrir Diario de Exploración y Hallazgos
            </button>
            <button type="button" onClick={() => { onSelectStation(null); onOpenSpherexDoc?.(); }}>
              Ver archivo histórico SPHEREx
            </button>
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'bioponics' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Módulo de Biopónica e Hidroponía">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 02 · INVERNADERO BIOPÓNICO</span>
              <h4>CÁMARA DE CULTIVO HIDROPÓNICO DE MICROGRAVEDAD</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar biopónica">×</button>
          </div>
          <p className="kronoxStationDesc">
            Humedad radicular: <strong>74%</strong> · Espectro activo:{' '}
            <strong>{mechanismsState?.bioponicsActive === false ? 'Reposado (UV bajo)' : 'FOTOSINTÉTICO ESMERALDA 445nm'}</strong>.
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              className="active"
              onClick={() => onTriggerMechanism?.('bioponics')}
            >
              {mechanismsState?.bioponicsActive === false
                ? '✦ Activar Luminarias Fotosintéticas 3D'
                : '☾ Atenuar a Ciclo Nocturno 3D'}
            </button>
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'storage-c02' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Taquilla Técnica C02">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 02 · ARMARIO LOGÍSTICO ESTANCO</span>
              <h4>TAQUILLA DE SUMINISTROS Y EQUIPO EVA</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar taquilla">×</button>
          </div>
          <p className="kronoxStationDesc">
            Compuerta física 3D:{' '}
            <strong>{mechanismsState?.storageC02Open ? 'ABIERTA' : 'SELLADA'}</strong> ·
            Contenido: <strong>Botiquín médico EVA · Célula O₂ #04 · Sellador de casco</strong>.
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              className="active"
              onClick={() => onTriggerMechanism?.('storage-c02')}
            >
              {mechanismsState?.storageC02Open
                ? '× Cerrar Compuerta de Taquilla 3D'
                : '↗ Abrir Compuerta de Taquilla 3D'}
            </button>
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'galley' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Estación de Habitabilidad">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 02 · ANILLO HABITACIONAL Y COMEDOR</span>
              <h4>COMEDOR CIRCULAR Y DISPENSADOR DE HIDRATACIÓN</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar habitabilidad">×</button>
          </div>
          <p className="kronoxStationDesc">
            Presión nominal: <strong>101.3 kPa</strong> · O₂: <strong>21.0%</strong> · Dispensador:{' '}
            <strong>{mechanismsState?.hydrationDispensing ? 'CICLO ACTIVO (H₂O MINERALIZADA)' : 'EN ESPERA'}</strong>.
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              className={mechanismsState?.hydrationDispensing ? 'active' : undefined}
              onClick={() => onTriggerMechanism?.('hydration')}
            >
              {mechanismsState?.hydrationDispensing
                ? '■ Detener Dispensador 3D'
                : '💧 Activar Dispensador de Hidratación 3D'}
            </button>
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'airlock' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Esclusa Ventral y Tránsito de Cubiertas">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 02 · ESCLUSA RADIAL EVA Y ASCENSOR</span>
              <h4>CONTROL DE PRESURIZACIÓN EVA Y TRANSPORTE VERTICAL</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar esclusa">×</button>
          </div>
          <p className="kronoxStationDesc">
            Estado de cámara EVA:{' '}
            <strong>{mechanismsState?.airlockPressurized === false ? 'DESPRESURIZADA (0.0 kPa · Ámbar)' : 'PRESURIZADA (101.3 kPa · Verde)'}</strong>.
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              className="active"
              onClick={() => onTriggerMechanism?.('airlock')}
            >
              {mechanismsState?.airlockPressurized === false
                ? '◎ Presurizar Esclusa EVA 3D'
                : '⚠ Despresurizar Cámara EVA 3D'}
            </button>
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'engineering' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Consola de Ingeniería del Reactor">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 03 · NÚCLEO DEL REACTOR AURORA</span>
              <h4>INGENIERÍA, REACTOR Y MODOS DE PLASMA</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar ingeniería">×</button>
          </div>
          <p className="kronoxStationDesc">
            Régimen actual del núcleo:{' '}
            <strong>{String(mechanismsState?.reactorMode || 'nominal').toUpperCase()}</strong> · Tanques criogénicos presurizados.
          </p>
          <div className="kronoxStationBtnRow">
            {[
              ['nominal', '◎ Régimen Nominal'],
              ['overclock', '⚡ Alta Potencia'],
              ['quiet', '☾ Modo Silencioso'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={(mechanismsState?.reactorMode || 'nominal') === mode ? 'active' : undefined}
                onClick={() => onTriggerMechanism?.('engineering', mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'hangar' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Consola de Bodega y Hangar">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 04 · BODEGA Y HANGAR DE PROA</span>
              <h4>GRÚA PÓRTICO Y ESCOTILLA DE TRANSBORDADOR</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar hangar">×</button>
          </div>
          <p className="kronoxStationDesc">
            Pórtico logístico:{' '}
            <strong>{mechanismsState?.hangarCraneDeployed ? 'DESPLEGADO EN PISTA DE PROA' : 'ESTIBADO SOBRE BAHÍA DE CARGA'}</strong> · Escotilla acoplada al estado del pórtico.
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              className="active"
              onClick={() => onTriggerMechanism?.('hangar')}
            >
              {mechanismsState?.hangarCraneDeployed
                ? '↓ Replegar Grúa y Cerrar Escotilla 3D'
                : '↑ Desplegar Grúa y Abrir Escotilla 3D'}
            </button>
          </div>
        </div>
      )}

      {cockpitVisible && activeStation === 'maintenance-c04' && (
        <div className="kronoxDiegeticConsole compact" role="dialog" aria-label="Estación de Mantenimiento C04">
          <div className="kronoxStationDrawerHead">
            <div>
              <span className="kronoxDiegeticTag">CUBIERTA 04 · TALLER Y DIAGNÓSTICO MECÁNICO</span>
              <h4>BANCO DE MANTENIMIENTO Y BRAZO ROBÓTICO</h4>
            </div>
            <button type="button" onClick={() => onSelectStation(null)} aria-label="Cerrar mantenimiento">×</button>
          </div>
          <p className="kronoxStationDesc">
            Cajón de herramientas y actuador articular:{' '}
            <strong>{mechanismsState?.maintDrawerOpen ? 'EXTENDIDO · BRAZO EN SERVICIO' : 'REPLEGADO EN BANCO'}</strong>.
          </p>
          <div className="kronoxStationBtnRow">
            <button
              type="button"
              className="active"
              onClick={() => onTriggerMechanism?.('maintenance-c04')}
            >
              {mechanismsState?.maintDrawerOpen
                ? '× Replegar Brazo y Cerrar Cajón 3D'
                : '⚙ Activar Brazo Robótico y Cajón 3D'}
            </button>
          </div>
          <p className="kronoxStationDesc">
            Banco auxiliar: lámpara {mechanismsState?.workLightActive ? 'encendida' : 'apagada'} · mordaza {mechanismsState?.benchClampLocked ? 'sujetando la pieza' : 'libre'} · bandeja de repuestos {mechanismsState?.partsTrayOpen ? 'extendida' : 'guardada'}.
          </p>
          <div className="kronoxStationBtnRow">
            <button type="button" onClick={() => onTriggerMechanism?.('maintenance-light-c04')}>
              {mechanismsState?.workLightActive ? '☼ Apagar lámpara articulada' : '☼ Encender lámpara articulada'}
            </button>
            <button type="button" onClick={() => onTriggerMechanism?.('bench-clamp-c04')}>
              {mechanismsState?.benchClampLocked ? '↔ Liberar mordaza' : '↔ Sujetar pieza'}
            </button>
            <button type="button" onClick={() => onTriggerMechanism?.('parts-tray-c04')}>
              {mechanismsState?.partsTrayOpen ? '⌄ Replegar bandeja' : '⌃ Extender bandeja'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
