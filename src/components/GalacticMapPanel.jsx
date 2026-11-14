import React, { useMemo, useState } from 'react';
import { P, INFO } from '../data/planetData.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { NEARBY_GALAXIES } from '../data/nearbyGalaxies.js';
import { NAVIGATION_SCALES } from '../scene/navigationScale.js';
import { contextCatalog } from '../scene/navigationAtlas.js';

const PLANET_COLORS = {
  Sol: '#fbbf24',
  Mercurio: '#cbd5e1',
  Venus: '#f59e0b',
  Tierra: '#38bdf8',
  Luna: '#e2e8f0',
  Marte: '#f97316',
  Júpiter: '#fdba74',
  Saturno: '#fde68a',
  Urano: '#67e8f9',
  Neptuno: '#60a5fa',
  Plutón: '#d6d3d1',
};

function raDecToMapXY(ra = 0, dec = 0, dist = 1, maxDist = 10, mapRadius = 155) {
  const rad = ((Number(ra) || 0) * Math.PI) / 180;
  const rNorm = Math.sqrt(Math.max(0.05, Math.min(1, Number(dist) / Math.max(0.001, maxDist))));
  const tilt = 1 - Math.abs(Number(dec) || 0) / 145;
  const r = rNorm * mapRadius * Math.max(0.45, tilt);
  return {
    x: 200 + Math.cos(rad) * r,
    y: 170 + Math.sin(rad) * r * 0.78 - ((Number(dec) || 0) / 90) * 26,
  };
}

/**
 * Mapa Galáctico Interactivo conectado directamente a las escalas reales de KRONOX
 * y al catálogo astronómico (Sistema Solar, CNS5 0–10 pc, Región 10–300 pc, Vía Láctea y Entorno Extragaláctico).
 */
export default function GalacticMapPanel({
  navigationScaleId = 'solar',
  selectedPlanet = null,
  selectedGalaxyKey = 'milky-way',
  onSelectScale,
  onActivateSceneMapView,
  onFocusPlanet,
  onTravelToPlanet,
  onTravelToSpherex,
  onFocusStar,
  onFocusGalaxy,
  onQuickTravel,
  onCloseHub,
}) {
  const [activeLayer, setActiveLayer] = useState(
    NAVIGATION_SCALES.some((s) => s.id === navigationScaleId) ? navigationScaleId : 'solar',
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(() => ({
    kind: 'planet',
    key: selectedPlanet || 'Tierra',
    name: selectedPlanet || 'Tierra',
    subtitle: 'Sistema Solar',
    distance: '1.00 UA',
  }));

  const stellarNodes = useMemo(
    () => contextCatalog('stellar', SPHEREX_TARGETS),
    [],
  );
  const regionalNodes = useMemo(
    () => contextCatalog('regional', SPHEREX_TARGETS),
    [],
  );

  const visibleEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = [];

    if (activeLayer === 'solar') {
      list = [
        {
          kind: 'quick',
          key: 'sunOrbit',
          name: 'Sol · Centro del Sistema',
          subtitle: 'Estrella G2V',
          distance: '0.00 UA',
          color: '#fbbf24',
          x: 200,
          y: 170,
          hasSpherex: false,
        },
        ...P.map((planet, idx) => {
          const orbitRadius = 24 + ((idx + 1) / Math.max(1, P.length)) * 136;
          const angle = idx * 0.78 - 0.6;
          const spTarget = SPHEREX_TARGETS.find(
            (t) => t.name.toLowerCase() === planet.n.toLowerCase(),
          );
          return {
            kind: 'planet',
            key: planet.n,
            name: planet.n,
            subtitle: planet.dwarf ? 'Planeta enano' : INFO[planet.n]?.t || 'Planeta del Sistema Solar',
            distance: `${(planet.d ?? idx + 1).toFixed(1)} u. mapa`,
            orbitRadius,
            color: PLANET_COLORS[planet.n] || '#93c5fd',
            x: 200 + Math.cos(angle) * orbitRadius,
            y: 170 + Math.sin(angle) * orbitRadius * 0.68,
            hasSpherex: Boolean(spTarget),
            spherexTarget: spTarget || null,
          };
        }),
      ];
    } else if (activeLayer === 'stellar' || activeLayer === 'regional') {
      const sourceNodes = activeLayer === 'stellar' ? stellarNodes : regionalNodes;
      const maxPc = activeLayer === 'stellar' ? 10 : 300;
      list = sourceNodes.map((star) => {
        const spTarget =
          SPHEREX_TARGETS.find((t) => t.key === star.missionKey || t.key === star.key) || null;
        const pos = raDecToMapXY(star.ra, star.dec, star.distancePc, maxPc, 148);
        return {
          kind: 'star',
          key: star.key,
          name: star.name,
          subtitle: spTarget
            ? `Objetivo SPHEREx · ${spTarget.statusBadge || spTarget.scienceTypeLabel || spTarget.type || 'Catálogo'}`
            : star.sourceTitle || 'Sistema CNS5 / Gaia',
          distance: `${Number(star.distancePc).toFixed(2)} pc · ${Number(star.distanceLy).toFixed(1)} años luz`,
          color: spTarget ? '#fbbf24' : '#7dd3fc',
          x: pos.x,
          y: pos.y,
          ra: star.ra,
          dec: star.dec,
          hasSpherex: Boolean(spTarget),
          spherexTarget: spTarget,
          raw: star,
        };
      });
    } else if (activeLayer === 'milkyway') {
      list = [
        {
          kind: 'quick',
          key: 'orion',
          name: 'Espolón de Orión (Sol)',
          subtitle: 'Posición local · ~26 000 años luz del núcleo',
          distance: 'Sector local',
          color: '#38bdf8',
          x: 245,
          y: 215,
          hasSpherex: false,
        },
        {
          kind: 'quick',
          key: 'core',
          name: 'Centro Galáctico · Sagitario A*',
          subtitle: 'Bulbo y núcleo de la Vía Láctea (λ≈266°)',
          distance: '26 670 años luz',
          color: '#fbbf24',
          x: 200,
          y: 170,
          hasSpherex: false,
        },
        ...SPHEREX_TARGETS.filter((t) => t.type !== 'galaxia').slice(0, 6).map((t, idx) => {
          const ang = idx * 1.05 - 0.8;
          const r = 46 + (idx % 3) * 38;
          return {
            kind: 'spherex',
            key: t.key,
            name: t.name,
            subtitle: `SPHEREx · ${t.type}`,
            distance: `${t.distanceLy} años luz`,
            color: '#f59e0b',
            x: 200 + Math.cos(ang) * r,
            y: 170 + Math.sin(ang) * r * 0.72,
            hasSpherex: true,
            spherexTarget: t,
          };
        }),
      ];
    } else {
      list = NEARBY_GALAXIES.map((gal, idx) => {
        const spTarget = SPHEREX_TARGETS.find((t) => t.key === gal.key) || null;
        const pos =
          gal.key === 'milky-way'
            ? { x: 200, y: 170 }
            : raDecToMapXY(gal.raDeg || idx * 45, gal.decDeg || 0, Math.min(50, gal.distanceMly || 1.5), 35, 148);
        return {
          kind: 'galaxy',
          key: gal.key,
          name: typeof gal.name === 'string' ? gal.name : gal.name?.es || gal.key,
          subtitle: gal.catalog || (typeof gal.type === 'string' ? gal.type : gal.type?.es) || 'Galaxia cercana',
          distance:
            gal.distanceText?.es ||
            (gal.distanceMly === 0
              ? 'Origen (Vía Láctea)'
              : Number.isFinite(gal.distanceMly)
                ? `≈ ${gal.distanceMly} M al`
                : 'Conjunto extragaláctico'),
          color: gal.key === selectedGalaxyKey ? '#34d399' : '#c084fc',
          x: pos.x,
          y: pos.y,
          hasSpherex: Boolean(spTarget),
          spherexTarget: spTarget,
          raw: gal,
        };
      });
    }

    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        String(item.subtitle || '').toLowerCase().includes(q),
    );
  }, [activeLayer, searchTerm, stellarNodes, regionalNodes, selectedGalaxyKey]);

  const currentSelection =
    visibleEntries.find((item) => item.key === selectedItem?.key) || visibleEntries[0] || selectedItem;

  const activeScaleMeta = NAVIGATION_SCALES.find((s) => s.id === activeLayer) || NAVIGATION_SCALES[0];

  const handleScaleChange = (scaleId) => {
    setActiveLayer(scaleId);
    onSelectScale?.(scaleId);
  };

  const handleFocusAction = (entry) => {
    if (!entry) return;
    if (entry.kind === 'planet') {
      onFocusPlanet?.(entry.key);
    } else if (entry.kind === 'galaxy') {
      onFocusGalaxy?.(entry.key);
    } else if (entry.kind === 'quick') {
      onQuickTravel?.(entry.key, entry.name);
    } else if (entry.spherexTarget) {
      onSelectScale?.(activeLayer);
      onFocusStar?.(entry.name);
    } else {
      onSelectScale?.(activeLayer);
      onFocusStar?.(entry.name);
    }
    onCloseHub?.();
  };

  const handleTravelAction = (entry) => {
    if (!entry) return;
    if (entry.spherexTarget && onTravelToSpherex) {
      onTravelToSpherex(entry.spherexTarget);
      onCloseHub?.();
      return;
    }
    if (entry.kind === 'planet') {
      onTravelToPlanet?.(entry.key);
    } else if (entry.kind === 'galaxy') {
      onSelectScale?.('extragalactic');
      onFocusGalaxy?.(entry.key);
    } else if (entry.kind === 'quick') {
      onQuickTravel?.(entry.key, entry.name);
    } else {
      onFocusStar?.(entry.name);
    }
    onCloseHub?.();
  };

  return (
    <div className="kronoxGalacticMapWrap">
      <div className="kronoxGalacticScaleBar" role="tablist" aria-label="Escala del mapa galáctico">
        {NAVIGATION_SCALES.map((scale) => (
          <button
            key={scale.id}
            type="button"
            role="tab"
            aria-selected={activeLayer === scale.id}
            className={`kronoxGalacticScaleBtn${activeLayer === scale.id ? ' is-active' : ''}`}
            onClick={() => handleScaleChange(scale.id)}
          >
            <span>{scale.level}. {scale.label}</span>
          </button>
        ))}
      </div>

      <div className="kronoxGalacticMainGrid">
        {/* Carta espacial interactiva en tiempo real */}
        <section className="kronoxGalacticChartBox" aria-label="Carta astronómica interactiva">
          <div className="kronoxGalacticChartTop">
            <div>
              <span className="kronoxMapEyebrow">PROYECCIÓN DE ESCALA · {activeScaleMeta.label.toUpperCase()}</span>
              <p className="kronoxMapDesc">{activeScaleMeta.description}</p>
            </div>
            <button
              type="button"
              className="kronoxHubActionBtn"
              onClick={() => {
                onActivateSceneMapView?.(activeLayer);
                onCloseHub?.();
              }}
              title="Cambiar cámara principal al modo Mapa 3D interactivo"
            >
              🗺️ Ver Mapa 3D en escena
            </button>
          </div>

          <svg
            viewBox="0 0 400 340"
            className="kronoxGalacticSvg"
            role="img"
            aria-label={`Mapa de ${activeScaleMeta.label}`}
          >
            <defs>
              <radialGradient id="kronoxMapBg" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#0f2544" stopOpacity="0.88" />
                <stop offset="65%" stopColor="#071121" stopOpacity="0.96" />
                <stop offset="100%" stopColor="#030712" stopOpacity="1" />
              </radialGradient>
            </defs>
            <rect width="400" height="340" rx="12" fill="url(#kronoxMapBg)" />

            {/* Retícula cartográfica polar */}
            {[42, 84, 126, 158].map((r) => (
              <ellipse
                key={r}
                cx="200"
                cy="170"
                rx={r}
                ry={r * 0.72}
                fill="none"
                stroke="rgba(56, 189, 248, 0.14)"
                strokeDasharray={activeLayer === 'solar' ? 'none' : '3 4'}
              />
            ))}
            <line x1="25" y1="170" x2="375" y2="170" stroke="rgba(148, 163, 184, 0.14)" />
            <line x1="200" y1="16" x2="200" y2="324" stroke="rgba(148, 163, 184, 0.14)" />

            {activeLayer === 'solar' &&
              visibleEntries
                .filter((e) => e.orbitRadius)
                .map((e) => (
                  <ellipse
                    key={`orb-${e.key}`}
                    cx="200"
                    cy="170"
                    rx={e.orbitRadius}
                    ry={e.orbitRadius * 0.68}
                    fill="none"
                    stroke="rgba(125, 211, 252, 0.18)"
                    strokeWidth="1"
                  />
                ))}

            {activeLayer === 'milkyway' && (
              <g opacity="0.28">
                <ellipse cx="200" cy="170" rx="142" ry="96" fill="none" stroke="#93c5fd" strokeWidth="14" strokeDasharray="12 6" />
                <ellipse cx="200" cy="170" rx="58" ry="26" transform="rotate(-22 200 170)" fill="#fde68a" />
              </g>
            )}

            {/* Nodos astronómicos reales */}
            {visibleEntries.slice(0, 48).map((entry) => {
              const isSelected = currentSelection?.key === entry.key;
              return (
                <g
                  key={entry.key}
                  transform={`translate(${entry.x.toFixed(1)}, ${entry.y.toFixed(1)})`}
                  className="kronoxMapNode"
                  onClick={() => setSelectedItem(entry)}
                  style={{ cursor: 'pointer' }}
                >
                  {isSelected && (
                    <circle
                      r={entry.hasSpherex ? 11 : 9}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.6"
                    />
                  )}
                  <circle
                    r={entry.kind === 'planet' && entry.key === 'Júpiter' ? 6 : entry.hasSpherex ? 5 : 3.8}
                    fill={entry.color || '#7dd3fc'}
                    stroke="#040b16"
                    strokeWidth="1"
                  />
                  {(isSelected || entry.hasSpherex || entry.kind === 'planet' || entry.kind === 'quick' || visibleEntries.length <= 16) && (
                    <text
                      x="8"
                      y="3"
                      fill={isSelected ? '#ffffff' : '#cbd5e1'}
                      fontSize="9.5"
                      fontWeight={isSelected ? '700' : '500'}
                    >
                      {entry.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </section>

        {/* Catálogo filtrable + Dossier del nodo seleccionado */}
        <aside className="kronoxGalacticSidebar">
          <input
            type="search"
            className="kronoxMapSearchInput"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar estrella, planeta o galaxia..."
            aria-label="Buscar cuerpo celeste en el mapa galáctico"
          />

          <div className="kronoxMapList">
            {visibleEntries.slice(0, 40).map((entry) => {
              const isSel = currentSelection?.key === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`kronoxMapListItem${isSel ? ' is-selected' : ''}`}
                  onClick={() => setSelectedItem(entry)}
                >
                  <span className="kronoxMapDot" style={{ background: entry.color || '#38bdf8' }} />
                  <span className="kronoxMapListText">
                    <strong>{entry.name}</strong>
                    <small>{entry.distance}</small>
                  </span>
                  {entry.hasSpherex && <span className="kronoxMapSpherexBadge">SPHEREx</span>}
                </button>
              );
            })}
          </div>

          {currentSelection && (
            <div className="kronoxMapInspectorCard">
              <span className="kronoxMapEyebrow">DESTINO SELECCIONADO</span>
              <h4>{currentSelection.name}</h4>
              <p>{currentSelection.subtitle}</p>
              <div className="kronoxMapStatRow">
                <span>Distancia:</span>
                <strong>{currentSelection.distance}</strong>
              </div>
              <div className="kronoxMapActionButtons">
                <button
                  type="button"
                  className="kronoxInvPrimaryBtn"
                  onClick={() => handleTravelAction(currentSelection)}
                >
                  🚀 Viajar / Fijar rumbo
                </button>
                <button
                  type="button"
                  className="kronoxHubActionBtn"
                  onClick={() => handleFocusAction(currentSelection)}
                >
                  🔭 Enfocar vista
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

