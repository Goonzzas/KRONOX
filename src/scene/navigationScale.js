export const NAVIGATION_SCALES = [
  {
    id: 'solar',
    level: 1,
    label: 'Sistema solar',
    description:
      'Órbitas y tamaños comprimidos para navegación; modo físico disponible en los controles originales.',
  },
  {
    id: 'stellar',
    level: 2,
    label: 'Vecindario estelar',
    description: 'Direcciones ICRS; distancias cercanas ampliadas en el mapa. Barnard ≈ 1.83 pc.',
  },
  {
    id: 'regional',
    level: 3,
    label: 'Región galáctica',
    description:
      'Direcciones ICRS y distancias de catálogo. La posición de RW Aur usa la paralaje Gaia incluida (≈ 156 pc).',
  },
  {
    id: 'milkyway',
    level: 4,
    label: 'Vía Láctea',
    description:
      'Disco, barra y brazo de Orión ilustrativos a escala macroscópica; no son una reconstrucción SPHEREx.',
  },
  {
    id: 'extragalactic',
    level: 5,
    label: 'Entorno extragaláctico',
    description:
      'Mapa de catálogo con distancias comprimidas; espesores y modelos de galaxias ilustrativos.',
  },
];
export const LY_PER_PC = 3.261563777;
export function scaleForTarget(target) {
  if (target?.type === 'galaxia') return 'extragalactic';
  const pc =
    target?.astrometry?.parallaxMas > 0
      ? 1000 / target.astrometry.parallaxMas
      : target?.distanceLy / LY_PER_PC;
  return Number.isFinite(pc) && pc < 25 ? 'stellar' : 'regional';
}
export function scaleContext(id, target = null) {
  const scale = NAVIGATION_SCALES.find((s) => s.id === id) || NAVIGATION_SCALES[0];
  const distancePc =
    target?.astrometry?.parallaxMas > 0
      ? 1000 / target.astrometry.parallaxMas
      : Number.isFinite(target?.distanceLy)
        ? target.distanceLy / LY_PER_PC
        : null;
  return {
    ...scale,
    targetKey: target?.key || null,
    targetName: target?.name || null,
    distancePc,
    coordinateSource: target?.coordinateSource || target?.astrometry?.source || null,
    positionKind: 'cartographic',
    macroGalacticVisible: scale.id === 'milkyway',
  };
}
export function macroGalacticVisible(id, { cinematic = false, nearbyMap = false } = {}) {
  return id === 'milkyway' && !cinematic && !nearbyMap;
}
