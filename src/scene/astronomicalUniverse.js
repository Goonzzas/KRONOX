import * as THREE from 'three';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { NEARBY_GALAXIES } from '../data/nearbyGalaxies.js';
import { NAVIGATION_CATALOG } from '../data/navigationCatalog.js';
import { RESEARCH_CATALOG } from '../data/researchCatalog.js';
import { P } from '../data/planetData.js';
import {
  ASTRONOMICAL_PROVENANCE_MANIFEST,
  getObjectProvenance,
} from './astronomicalProvenanceManifest.js';

export { ASTRONOMICAL_PROVENANCE_MANIFEST, getObjectProvenance };

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const LY_PER_PC = 3.261563777;

/**
 * Jerarquía espacial explícita de Kronox (Sección 8):
 * Universo observable -> estructuras extragalácticas -> Grupo Local -> Vía Láctea ->
 * regiones galácticas -> vecindario solar -> sistema solar.
 */
export const COSMIC_HIERARCHY = [
  {
    id: 'observable-universe',
    name: 'Universo observable',
    parentId: null,
    scaleId: 'extragalactic',
    characteristicRadiusPc: 1.4e10,
  },
  {
    id: 'extragalactic-structures',
    name: 'Estructuras extragalácticas y grupos cercanos',
    parentId: 'observable-universe',
    scaleId: 'extragalactic',
    characteristicRadiusPc: 4.5e6,
  },
  {
    id: 'local-group',
    name: 'Grupo Local',
    parentId: 'extragalactic-structures',
    scaleId: 'extragalactic',
    characteristicRadiusPc: 1.0e6,
  },
  {
    id: 'milky-way',
    name: 'Vía Láctea',
    parentId: 'local-group',
    scaleId: 'milkyway',
    characteristicRadiusPc: 16000,
  },
  {
    id: 'galactic-regions',
    name: 'Regiones galácticas · Espolón de Orión (10–300 pc)',
    parentId: 'milky-way',
    scaleId: 'regional',
    characteristicRadiusPc: 300,
  },
  {
    id: 'solar-neighborhood',
    name: 'Vecindario solar (0–10 pc)',
    parentId: 'galactic-regions',
    scaleId: 'stellar',
    characteristicRadiusPc: 10,
  },
  {
    id: 'solar-system',
    name: 'Sistema Solar',
    parentId: 'solar-neighborhood',
    scaleId: 'solar',
    characteristicRadiusPc: 0.002,
  },
];

/**
 * Matriz de rotación ortonormal ICRS (J2000) -> Coordenadas Galácticas (IAU 1958 / Hipparcos):
 * Polo norte galáctico: RA = 192.85948°, Dec = +27.12825°
 * Centro galáctico (l=0, b=0): RA = 266.40500°, Dec = -28.93617°
 */
const ICRS_TO_GAL_MATRIX = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];

export function icrsToCartesianPc(raDeg = 0, decDeg = 0, distancePc = 0) {
  const ra = Number(raDeg) * DEG2RAD;
  const dec = Number(decDeg) * DEG2RAD;
  const d = Math.max(0, Number(distancePc) || 0);
  const cosDec = Math.cos(dec);
  return {
    x: d * cosDec * Math.cos(ra),
    y: d * Math.sin(dec),
    z: d * cosDec * Math.sin(ra),
  };
}

export function cartesianPcToIcrs(x = 0, y = 0, z = 0) {
  const r = Math.hypot(x, y, z);
  if (r < 1e-12) {
    return { raDeg: 0, decDeg: 0, distancePc: 0 };
  }
  let raDeg = Math.atan2(z, x) * RAD2DEG;
  if (raDeg < 0) raDeg += 360;
  const decDeg = Math.asin(Math.max(-1, Math.min(1, y / r))) * RAD2DEG;
  return { raDeg, decDeg, distancePc: r };
}

export function icrsToGalacticDeg(raDeg = 0, decDeg = 0) {
  const ra = Number(raDeg) * DEG2RAD;
  const dec = Number(decDeg) * DEG2RAD;
  const ux = Math.cos(dec) * Math.cos(ra);
  const uy = Math.cos(dec) * Math.sin(ra);
  const uz = Math.sin(dec);

  const gx =
    ICRS_TO_GAL_MATRIX[0][0] * ux +
    ICRS_TO_GAL_MATRIX[0][1] * uy +
    ICRS_TO_GAL_MATRIX[0][2] * uz;
  const gy =
    ICRS_TO_GAL_MATRIX[1][0] * ux +
    ICRS_TO_GAL_MATRIX[1][1] * uy +
    ICRS_TO_GAL_MATRIX[1][2] * uz;
  const gz =
    ICRS_TO_GAL_MATRIX[2][0] * ux +
    ICRS_TO_GAL_MATRIX[2][1] * uy +
    ICRS_TO_GAL_MATRIX[2][2] * uz;

  let lDeg = Math.atan2(gy, gx) * RAD2DEG;
  if (lDeg < 0) lDeg += 360;
  const bDeg = Math.asin(Math.max(-1, Math.min(1, gz))) * RAD2DEG;
  return { lDeg, bDeg };
}

export function galacticToIcrsDeg(lDeg = 0, bDeg = 0) {
  const l = Number(lDeg) * DEG2RAD;
  const b = Number(bDeg) * DEG2RAD;
  const gx = Math.cos(b) * Math.cos(l);
  const gy = Math.cos(b) * Math.sin(l);
  const gz = Math.sin(b);

  const ux =
    ICRS_TO_GAL_MATRIX[0][0] * gx +
    ICRS_TO_GAL_MATRIX[1][0] * gy +
    ICRS_TO_GAL_MATRIX[2][0] * gz;
  const uy =
    ICRS_TO_GAL_MATRIX[0][1] * gx +
    ICRS_TO_GAL_MATRIX[1][1] * gy +
    ICRS_TO_GAL_MATRIX[2][1] * gz;
  const uz =
    ICRS_TO_GAL_MATRIX[0][2] * gx +
    ICRS_TO_GAL_MATRIX[1][2] * gy +
    ICRS_TO_GAL_MATRIX[2][2] * gz;

  let raDeg = Math.atan2(uy, ux) * RAD2DEG;
  if (raDeg < 0) raDeg += 360;
  const decDeg = Math.asin(Math.max(-1, Math.min(1, uz))) * RAD2DEG;
  return { raDeg, decDeg };
}

export function estimateDistancePcWithUncertainty({
  parallaxMas,
  parallaxErrorMas = 0,
  publishedDistancePc = null,
  distanceMethod = 'trigonometric-parallax',
} = {}) {
  const p = Number(parallaxMas);
  const err = Math.max(0, Number(parallaxErrorMas) || 0);
  if (Number.isFinite(p) && p > 0) {
    const fractionalUncertainty = err / p;
    if (fractionalUncertainty <= 0.2) {
      const distancePc = 1000 / p;
      return {
        distancePc,
        distanceLy: distancePc * LY_PER_PC,
        fractionalUncertainty,
        method: 'trigonometric-parallax',
        reliableParallax: true,
        uncertaintyPc: distancePc * fractionalUncertainty,
      };
    }
    const fallbackPc =
      Number.isFinite(publishedDistancePc) && publishedDistancePc > 0
        ? publishedDistancePc
        : 1000 / p;
    return {
      distancePc: fallbackPc,
      distanceLy: fallbackPc * LY_PER_PC,
      fractionalUncertainty,
      method: 'bayesian-photogeometric-fallback',
      reliableParallax: false,
      uncertaintyPc: fallbackPc * Math.min(0.5, fractionalUncertainty),
    };
  }
  const dPc = Math.max(0, Number(publishedDistancePc) || 0);
  return {
    distancePc: dPc,
    distanceLy: dPc * LY_PER_PC,
    fractionalUncertainty: 0.08,
    method: distanceMethod || 'catalog-published',
    reliableParallax: false,
    uncertaintyPc: dPc * 0.08,
  };
}

/**
 * Convierte temperatura efectiva (K) o tipo espectral a color físico estelar en el espacio exterior.
 * - Sol (G2V, 5772 K): blanco solar cálido natural (#fff9f2), evitando saturación naranja artificial.
 * - Enanas rojas M (Barnard 3220 K, Próxima 3042 K): rojo-anaranjado cálido convectivo (#ff6e30 / #ff5a22) — NUNCA blanco.
 * - Estrellas A/B/O calientes (Sirio 9940 K, Rígel 12100 K, Espiga 25300 K): blanco-azulado intenso (#9ec4ff / #78aaff).
 */
export function temperatureToSpaceColorHex(temperatureK = 5772, spectralType = 'G2V') {
  const sp = String(spectralType || '').toUpperCase();
  const T = Number(temperatureK) || 5772;
  if (sp.startsWith('Y') || T < 500) return '#8c2d52'; // Subenana marrón Y2 (emisión térmica IR en falso color)
  if (sp.startsWith('T') || T < 1450) return '#c43c2c'; // Enana marrón de metano T
  if (sp.startsWith('L') || T < 2300) return '#de5228'; // Enana marrón L
  if (T < 3150) return '#ff5c26'; // M5V–M9V / Mira (Próxima Centauri, R Draconis)
  if (T < 3550) return '#ff7340'; // M2V–M4V (Estrella de Barnard: rojo-anaranjado cálido)
  if (T < 4000) return '#ff9250'; // M0V–M1V
  if (T < 5250) return '#ffc478'; // K0V–K7V (RW Aurigae, Epsilon Eridani)
  if (T < 6100) return '#fff9f2'; // G0V–G9V (Sol: blanco solar integrado en el espacio)
  if (T < 7500) return '#f2f7ff'; // F0V–F9V (Procyon)
  if (T < 10500) return '#bfd8ff'; // A0V–A9V (Sirio A, Vega, Altair)
  if (T < 18000) return '#92beff'; // B5–B9 (Rígel)
  return '#74a8ff'; // O / B0–B4 (Espiga)
}

/**
 * Parámetros físicos curados de alta precisión (Gaia DR3, SIMBAD, NASA Exoplanet Archive, IRSA/SPHEREx)
 */
const CURATED_STAR_PHYSICS = {
  sun: {
    id: 'sun',
    canonicalName: 'Sol',
    catalogIds: ['Sol', 'IAU Sun', 'G2V Reference'],
    spectralType: 'G2V',
    temperatureK: 5772,
    luminositySolar: 1.0,
    radiusSolar: 1.0,
    massSolar: 1.0,
    apparentMagnitude: -26.74,
    absoluteMagnitude: 4.83,
    bpRp: 0.82,
    parallaxMas: null,
    parallaxErrorMas: 0,
    distancePc: 0,
    pmRaMasYr: 0,
    pmDecMasYr: 0,
    radialVelocityKms: 0,
    variability: 'Ciclo magnético solar de 11 años (~0.1% TSI)',
    multiplicity: 'Estrella única (8 planetas mayores)',
    circumstellarDisk: 'Cinturón Principal de Asteroides y Cinturón de Kuiper',
    exoplanetCount: 8,
    provenance: 'IAU 2015 Resolution B3 / NASA Solar System Exploration',
  },
  barnard: {
    id: 'barnard',
    canonicalName: 'Estrella de Barnard',
    catalogIds: ['GJ 699', 'HIP 87937', 'Gaia DR3 4472832130942575872'],
    spectralType: 'M4.0Ve',
    temperatureK: 3220,
    luminositySolar: 0.00346,
    radiusSolar: 0.187,
    massSolar: 0.162,
    apparentMagnitude: 9.51,
    absoluteMagnitude: 13.21,
    bpRp: 2.83,
    parallaxMas: 546.9759,
    parallaxErrorMas: 0.0401,
    distancePc: 1.828,
    pmRaMasYr: -801.55,
    pmDecMasYr: 10362.39,
    radialVelocityKms: -110.51,
    variability: 'BY Draconis / Fulguraciones cromosféricas ocasionales',
    multiplicity: 'Estrella individual con sistema planetario sub-terrestre (Barnard b)',
    circumstellarDisk: 'Sin disco masivo; baja emisión de polvo en IR',
    exoplanetCount: 1,
    provenance: 'Gaia DR3 / SIMBAD / ESO Espresso 2024 / NASA SPHEREx IRSA',
  },
  'wise-0855': {
    id: 'wise-0855',
    canonicalName: 'WISE 0855−0714',
    catalogIds: ['WISE J085510.83-071442.5', 'Luhman-WISE 0855'],
    spectralType: 'Y2',
    temperatureK: 260,
    luminositySolar: 0.0000012,
    radiusSolar: 0.095,
    massSolar: 0.006,
    apparentMagnitude: 25.0,
    absoluteMagnitude: 28.2,
    bpRp: 4.6,
    parallaxMas: 438.9,
    parallaxErrorMas: 3.0,
    distancePc: 2.278,
    pmRaMasYr: -8118.0,
    pmDecMasYr: 680.0,
    radialVelocityKms: 24.0,
    variability: 'Modulación rotacional en bandas infrarrojas de vapor de agua y metano',
    multiplicity: 'Objeto subestelar aislado de masa planetaria',
    circumstellarDisk: 'No detectado',
    exoplanetCount: 0,
    provenance: 'Kirkpatrick et al. 2021 / JWST NIRSpec / NASA SPHEREx IRSA',
  },
  'epsilon-indi-b': {
    id: 'epsilon-indi-b',
    canonicalName: 'Epsilon Indi Ba/Bb',
    catalogIds: ['Eps Ind B', 'Scholz-EpsIndB', 'HD 209100 B'],
    spectralType: 'T1V + T6V',
    temperatureK: 1320,
    luminositySolar: 0.000021,
    radiusSolar: 0.091,
    massSolar: 0.068,
    apparentMagnitude: 18.7,
    absoluteMagnitude: 20.9,
    bpRp: 3.9,
    parallaxMas: 274.84,
    parallaxErrorMas: 0.12,
    distancePc: 3.639,
    pmRaMasYr: 3966.7,
    pmDecMasYr: -2536.2,
    radialVelocityKms: -40.4,
    variability: 'Rotación atmosférica de par binario T1 + T6',
    multiplicity: 'Par binario de enanas marrones en órbita amplia alrededor de ε Indi A',
    circumstellarDisk: 'No detectado',
    exoplanetCount: 0,
    provenance: 'Gaia DR3 / Chen et al. 2022 / NASA SPHEREx IRSA',
  },
  'rw-aurigae': {
    id: 'rw-aurigae',
    canonicalName: 'RW Aurigae',
    catalogIds: ['RW Aur', 'HD 240764', 'Gaia DR3 156430822214451712'],
    spectralType: 'K1Ve–K4Ve (T Tauri)',
    temperatureK: 4900,
    luminositySolar: 1.75,
    radiusSolar: 1.6,
    massSolar: 1.35,
    apparentMagnitude: 10.4,
    absoluteMagnitude: 4.34,
    bpRp: 1.32,
    parallaxMas: 6.13,
    parallaxErrorMas: 0.07,
    distancePc: 163.0,
    pmRaMasYr: 4.1,
    pmDecMasYr: -24.5,
    radialVelocityKms: 15.8,
    variability: 'Variable T Tauri clásica con eventos de oscurecimiento circunestelar y acreción',
    multiplicity: 'Sistema binario joven (RW Aur A + RW Aur B)',
    circumstellarDisk: 'Disco protoplanetario perturbado por marea y chorro bipolar',
    exoplanetCount: 0,
    provenance: 'Gaia DR3 / SIMBAD / AAVSO / NASA SPHEREx IRSA',
  },
  'r-draconis': {
    id: 'r-draconis',
    canonicalName: 'R Draconis',
    catalogIds: ['R Dra', 'HD 149880', 'HIP 81014', 'Gaia DR3 1646273923920042752'],
    spectralType: 'M5e–M9e III (Mira)',
    temperatureK: 2950,
    luminositySolar: 3400.0,
    radiusSolar: 215.0,
    massSolar: 1.1,
    apparentMagnitude: 7.6,
    absoluteMagnitude: 0.77,
    bpRp: 3.45,
    parallaxMas: 4.31,
    parallaxErrorMas: 0.14,
    distancePc: 232.0,
    pmRaMasYr: -11.3,
    pmDecMasYr: -25.1,
    radialVelocityKms: -133.0,
    variability: 'Variable pulsante tipo Mira (período ≈ 245.6 días, rango V 6.7–13.2 mag)',
    multiplicity: 'Gigante roja AGB evolucionada',
    circumstellarDisk: 'Envoltura circunestelar rica en polvo de silicatos y vapor de agua',
    exoplanetCount: 0,
    provenance: 'Gaia DR3 / GCVS / AAVSO / NASA SPHEREx IRSA',
  },
  'proxima-centauri': {
    id: 'proxima-centauri',
    canonicalName: 'Próxima Centauri',
    catalogIds: ['Alpha Centauri C', 'GJ 551', 'HIP 70890', 'Gaia DR3 5853498713190525696'],
    spectralType: 'M5.5Ve',
    temperatureK: 3042,
    luminositySolar: 0.00155,
    radiusSolar: 0.154,
    massSolar: 0.122,
    apparentMagnitude: 11.13,
    absoluteMagnitude: 15.6,
    bpRp: 3.62,
    parallaxMas: 768.0665,
    parallaxErrorMas: 0.0499,
    distancePc: 1.302,
    pmRaMasYr: -3781.7,
    pmDecMasYr: 769.5,
    radialVelocityKms: -22.4,
    variability: 'Estrella fulgurante UV Ceti',
    multiplicity: 'Miembro exterior del sistema triple Alfa Centauri',
    circumstellarDisk: 'Cinturón de polvo frío tenue',
    exoplanetCount: 2,
    provenance: 'Gaia DR3 / CNS5 / NASA Exoplanet Archive',
  },
  'alpha-centauri-a': {
    id: 'alpha-centauri-a',
    canonicalName: 'Alfa Centauri A',
    catalogIds: ['Rigil Kentaurus', 'HD 128620', 'HIP 71683'],
    spectralType: 'G2V',
    temperatureK: 5790,
    luminositySolar: 1.519,
    radiusSolar: 1.223,
    massSolar: 1.1,
    apparentMagnitude: -0.01,
    absoluteMagnitude: 4.38,
    bpRp: 0.84,
    parallaxMas: 747.1,
    parallaxErrorMas: 1.2,
    distancePc: 1.338,
    pmRaMasYr: -3679.3,
    pmDecMasYr: 473.7,
    radialVelocityKms: -21.4,
    variability: 'Estable (tipo solar)',
    multiplicity: 'Binaria central AB + Próxima Centauri',
    circumstellarDisk: 'Baja emisión zodiacal',
    exoplanetCount: 0,
    provenance: 'CNS5 / HIPPARCOS / SIMBAD',
  },
  sirius: {
    id: 'sirius',
    canonicalName: 'Sirio',
    catalogIds: ['Alpha Canis Majoris', 'HD 48915', 'HIP 32349'],
    spectralType: 'A1V + DA2',
    temperatureK: 9940,
    luminositySolar: 25.4,
    radiusSolar: 1.711,
    massSolar: 2.063,
    apparentMagnitude: -1.46,
    absoluteMagnitude: 1.42,
    bpRp: -0.01,
    parallaxMas: 379.21,
    parallaxErrorMas: 1.58,
    distancePc: 2.637,
    pmRaMasYr: -546.01,
    pmDecMasYr: -1223.07,
    radialVelocityKms: -5.5,
    variability: 'Estable en secuencia principal',
    multiplicity: 'Binaria Sirio A (A1V) + Sirio B (enana blanca DA2)',
    circumstellarDisk: 'No detectado',
    exoplanetCount: 0,
    provenance: 'CNS5 / HIPPARCOS / Bond et al. 2017',
  },
  rigel: {
    id: 'rigel',
    canonicalName: 'Rígel',
    catalogIds: ['Beta Orionis', 'HD 34085', 'HIP 24436'],
    spectralType: 'B8Ia',
    temperatureK: 12100,
    luminositySolar: 120000,
    radiusSolar: 78.9,
    massSolar: 21.0,
    apparentMagnitude: 0.13,
    absoluteMagnitude: -7.84,
    bpRp: -0.03,
    parallaxMas: 3.78,
    parallaxErrorMas: 0.34,
    distancePc: 264.5,
    pmRaMasYr: 1.31,
    pmDecMasYr: 0.5,
    radialVelocityKms: 17.8,
    variability: 'Supergigante pulsante Alfa Cygni',
    multiplicity: 'Sistema múltiple dominado por Rígel A (B8Ia)',
    circumstellarDisk: 'Viento estelar ionizado de supergigante azul',
    exoplanetCount: 0,
    provenance: 'HIPPARCOS / SIMBAD',
  },
  spica: {
    id: 'spica',
    canonicalName: 'Espiga',
    catalogIds: ['Alpha Virginis', 'HD 116658', 'HIP 65474'],
    spectralType: 'B1III-IV + B2V',
    temperatureK: 25300,
    luminositySolar: 20512,
    radiusSolar: 7.47,
    massSolar: 11.43,
    apparentMagnitude: 0.97,
    absoluteMagnitude: -3.55,
    bpRp: -0.23,
    parallaxMas: 13.06,
    parallaxErrorMas: 0.7,
    distancePc: 76.6,
    pmRaMasYr: -42.35,
    pmDecMasYr: -30.67,
    radialVelocityKms: 1.0,
    variability: 'Variable elipsoidal rotante y Beta Cephei',
    multiplicity: 'Binaria espectroscópica cercana de estrellas B masivas',
    circumstellarDisk: 'No detectado',
    exoplanetCount: 0,
    provenance: 'HIPPARCOS / SIMBAD',
  },
};

export function derivePhysicalStarProperties(rawStar) {
  const key = rawStar.key || rawStar.id || 'unknown-star';
  const curated = CURATED_STAR_PHYSICS[key] || null;

  const raDeg = Number(rawStar.ra ?? curated?.raDeg ?? 0);
  const decDeg = Number(rawStar.dec ?? curated?.decDeg ?? 0);
  const publishedDistancePc = Number(rawStar.distancePc ?? curated?.distancePc ?? 0);
  const parallaxMas =
    curated?.parallaxMas ??
    (publishedDistancePc > 0 ? Number((1000 / publishedDistancePc).toFixed(4)) : null);
  const parallaxErrorMas = curated?.parallaxErrorMas ?? (parallaxMas ? parallaxMas * 0.008 : 0);

  const distEstimate = estimateDistancePcWithUncertainty({
    parallaxMas,
    parallaxErrorMas,
    publishedDistancePc,
    distanceMethod: publishedDistancePc === 0 ? 'heliocentric-origin' : 'trigonometric-parallax',
  });

  // Si el catálogo no trae temperatureK explícita, inferir según tipo espectral o clase de población
  let inferredTemp = 3350;
  const rawSp = String(curated?.spectralType || rawStar.spectralType || '').toUpperCase();
  if (rawSp.startsWith('O')) inferredTemp = 32000;
  else if (rawSp.startsWith('B')) inferredTemp = 16500;
  else if (rawSp.startsWith('A')) inferredTemp = 9200;
  else if (rawSp.startsWith('F')) inferredTemp = 6650;
  else if (rawSp.startsWith('G')) inferredTemp = 5772;
  else if (rawSp.startsWith('K')) inferredTemp = 4600;
  else if (rawSp.startsWith('M')) inferredTemp = 3250;
  else if (rawSp.startsWith('L')) inferredTemp = 1850;
  else if (rawSp.startsWith('T')) inferredTemp = 1100;
  else if (rawSp.startsWith('Y')) inferredTemp = 260;
  else if (publishedDistancePc === 0) inferredTemp = 5772;
  else if (publishedDistancePc > 45) inferredTemp = 8800; // Estrellas brillantes de referencia regional suelen ser A/B/K gigantes

  const temperatureK = Number(curated?.temperatureK || rawStar.temperatureK || inferredTemp);

  let spectralType = curated?.spectralType || rawStar.spectralType || null;
  if (!spectralType) {
    if (temperatureK < 500) spectralType = 'Y2';
    else if (temperatureK < 1450) spectralType = 'T3V';
    else if (temperatureK < 2350) spectralType = 'L4V';
    else if (temperatureK < 3300) spectralType = 'M4.0V';
    else if (temperatureK < 3850) spectralType = 'M1.5V';
    else if (temperatureK < 5200) spectralType = 'K2V';
    else if (temperatureK < 6050) spectralType = 'G2V';
    else if (temperatureK < 7500) spectralType = 'F5V';
    else if (temperatureK < 11000) spectralType = 'A1V';
    else spectralType = 'B2V';
  }

  const radiusSolar = Number(
    curated?.radiusSolar ||
      rawStar.radiusSolar ||
      (temperatureK < 3600
        ? 0.22
        : temperatureK < 5200
          ? 0.76
          : temperatureK < 6200
            ? 1.0
            : temperatureK < 11000
              ? 1.7
              : 5.2),
  );

  const tRatio = temperatureK / 5772;
  const luminositySolar = Number(
    curated?.luminositySolar ||
      Number((radiusSolar * radiusSolar * Math.pow(tRatio, 4)).toFixed(6)),
  );

  const absoluteMagnitude = Number(
    curated?.absoluteMagnitude ??
      Number((4.83 - 2.5 * Math.log10(Math.max(1e-7, luminositySolar))).toFixed(2)),
  );

  const distanceModulus =
    distEstimate.distancePc > 0 ? 5 * Math.log10(distEstimate.distancePc / 10) : -31.57;
  const apparentMagnitude = Number(
    curated?.apparentMagnitude ?? Number((absoluteMagnitude + distanceModulus).toFixed(2)),
  );

  const massSolar = Number(
    curated?.massSolar ??
      Number(
        (radiusSolar < 0.8 ? Math.pow(radiusSolar, 0.9) : Math.pow(luminositySolar, 0.25)).toFixed(
          3,
        ),
      ),
  );

  const bpRp = Number(
    curated?.bpRp ??
      Number(
        (temperatureK < 3400
          ? 2.85
          : temperatureK < 4500
            ? 1.65
            : temperatureK < 6000
              ? 0.82
              : temperatureK < 10000
                ? 0.02
                : -0.22).toFixed(2),
      ),
  );

  const coordsPc = icrsToCartesianPc(raDeg, decDeg, distEstimate.distancePc);
  const galacticDeg = icrsToGalacticDeg(raDeg, decDeg);
  const spaceColorHex = temperatureToSpaceColorHex(temperatureK, spectralType);

  return {
    id: key,
    key,
    name: rawStar.name || curated?.canonicalName || key,
    canonicalName: curated?.canonicalName || rawStar.name || key,
    catalogIds: curated?.catalogIds || [rawStar.name || key],
    hierarchyNodeId:
      distEstimate.distancePc === 0
        ? 'solar-system'
        : distEstimate.distancePc <= 10.5
          ? 'solar-neighborhood'
          : 'galactic-regions',
    raDeg,
    decDeg,
    lDeg: Number(galacticDeg.lDeg.toFixed(4)),
    bDeg: Number(galacticDeg.bDeg.toFixed(4)),
    positionPc: coordsPc,
    distancePc: Number(distEstimate.distancePc.toFixed(4)),
    distanceLy: Number(distEstimate.distanceLy.toFixed(3)),
    distanceUncertaintyPc: Number(distEstimate.uncertaintyPc.toFixed(5)),
    distanceMethod: distEstimate.method,
    reliableParallax: distEstimate.reliableParallax,
    parallaxMas,
    parallaxErrorMas,
    pmRaMasYr: curated?.pmRaMasYr ?? rawStar.pmRa ?? null,
    pmDecMasYr: curated?.pmDecMasYr ?? rawStar.pmDec ?? null,
    radialVelocityKms: curated?.radialVelocityKms ?? null,
    spectralType,
    temperatureK,
    luminositySolar,
    radiusSolar,
    massSolar,
    apparentMagnitude,
    absoluteMagnitude,
    bpRp,
    spaceColorHex,
    variability: curated?.variability || 'Flujo fotométrico estable en catálogo',
    multiplicity:
      curated?.multiplicity ||
      (rawStar.planetCount
        ? `Estrella anfitriona con ${rawStar.planetCount} planeta(s) confirmado(s)`
        : 'Sistema estelar de catálogo'),
    circumstellarDisk: curated?.circumstellarDisk || 'No reportado en catálogo base',
    exoplanetCount: Number(curated?.exoplanetCount ?? rawStar.planetCount ?? 0),
    provenance:
      curated?.provenance || rawStar.sourceTitle || 'Gaia DR3 / CNS5 / NASA Exoplanet Archive',
    sourceUrl: rawStar.source || 'https://gea.esac.esa.int/archive/',
    inferredFields: curated
      ? []
      : [
          ...(rawStar.temperatureK ? [] : ['temperatureK']),
          ...(rawStar.radiusSolar ? [] : ['radiusSolar']),
          'luminositySolar',
          'massSolar',
        ],
    visualMagnificationNote:
      'El disco 3D cercano representa la atmósfera estelar y su color físico por temperatura efectiva (Teff) con oscurecimiento de limbo y granulación convectiva; el radio está ampliado respecto a las distancias interestelares para permitir su inspección visual.',
  };
}

function buildCanonicalStarsRegistry() {
  const map = new Map();

  for (const [key, curated] of Object.entries(CURATED_STAR_PHYSICS)) {
    map.set(
      key,
      derivePhysicalStarProperties({
        ...curated,
        key,
        name: curated.canonicalName,
        ra: curated.raDeg ?? 0,
        dec: curated.decDeg ?? 0,
      }),
    );
  }

  for (const star of NAVIGATION_CATALOG.stars) {
    map.set(star.key, derivePhysicalStarProperties(star));
  }

  for (const target of SPHEREX_TARGETS) {
    if (target.type === 'galaxia') continue;
    const existing = map.get(target.key) || {};
    map.set(
      target.key,
      derivePhysicalStarProperties({
        ...existing,
        ...target,
        key: target.key,
        name: target.name,
      }),
    );
  }

  return map;
}

export const CANONICAL_STARS_BY_ID = buildCanonicalStarsRegistry();

export function getCanonicalStar(key) {
  if (!key) return null;
  const k = String(key).toLowerCase();
  if (k === 'sol' || k === 'sun') return CANONICAL_STARS_BY_ID.get('sun');
  return CANONICAL_STARS_BY_ID.get(key) || CANONICAL_STARS_BY_ID.get(k) || null;
}

/**
 * Generador determinista ligero para texturas y distribuciones reproducibles.
 */
function createDeterministicRng(seedString = 'kronox') {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedString.length; i++) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Textura procedural de alta definición para fotosfera estelar con:
 * - Color físico real por Teff SIN saturación blanca aditiva.
 * - Celdas de granulación convectiva profundas en enanas rojas M y gigantes Mira.
 * - Bandas atmosféricas en enanas marrones Y/T/L.
 * - Oscurecimiento de limbo latitudinal para dar volumen esférico inmediato.
 */
const starTextureCache = new Map();
export function getStellarPhotosphereTexture(
  colorHex,
  spectralType = 'G2V',
  temperatureK = 5772,
) {
  const cacheKey = `${colorHex}:${spectralType}:${Math.round((Number(temperatureK) || 5772) / 100)}`;
  if (starTextureCache.has(cacheKey)) return starTextureCache.get(cacheKey);
  if (typeof document === 'undefined') return null;

  const isHarness = Boolean(globalThis.__KRONOX_SCENE_HARNESS__);
  const W = isHarness ? 64 : 256;
  const H = isHarness ? 32 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const T = Number(temperatureK) || 5772;
  const sp = String(spectralType || '').toUpperCase();

  // Paleta fotosférica física sin saturación blanca para preservar el color espectral real:
  let baseR = 255;
  let baseG = 248;
  let baseB = 238;
  let darkR = 215;
  let darkG = 190;
  let darkB = 155;
  let hotR = 255;
  let hotG = 253;
  let hotB = 248;

  if (sp.startsWith('Y') || T < 500) {
    baseR = 148; baseG = 42; baseB = 82;
    darkR = 58; darkG = 14; darkB = 34;
    hotR = 210; hotG = 78; hotB = 115;
  } else if (sp.startsWith('T') || T < 1500) {
    baseR = 198; baseG = 58; baseB = 44;
    darkR = 92; darkG = 20; darkB = 18;
    hotR = 245; hotG = 110; hotB = 68;
  } else if (T < 3150) {
    // M5–M9V / Mira (Próxima Centauri, R Draconis): rojo profundo convectivo
    baseR = 242; baseG = 78; baseB = 28;
    darkR = 138; darkG = 26; darkB = 8;
    hotR = 255; hotG = 135; hotB = 58;
  } else if (T < 3650) {
    // M2–M4V (Estrella de Barnard, 3220 K): rojo-anaranjado cálido convectivo muy distinguible
    baseR = 250; baseG = 98; baseB = 38;
    darkR = 156; darkG = 38; darkB = 12;
    hotR = 255; hotG = 158; hotB = 76;
  } else if (T < 4200) {
    // M0–M1V
    baseR = 252; baseG = 134; baseB = 64;
    darkR = 175; darkG = 68; darkB = 24;
    hotR = 255; hotG = 188; hotB = 110;
  } else if (T < 5300) {
    // K0–K7V (RW Aurigae 4900 K): ámbar dorado cálido
    baseR = 255; baseG = 188; baseB = 108;
    darkR = 198; darkG = 122; darkB = 52;
    hotR = 255; hotG = 224; hotB = 158;
  } else if (T < 6200) {
    // G0–G9V (Sol 5772 K): blanco solar cálido natural
    baseR = 255; baseG = 247; baseB = 234;
    darkR = 228; darkG = 205; darkB = 172;
    hotR = 255; hotG = 253; hotB = 248;
  } else if (T < 7600) {
    // F0–F9V
    baseR = 242; baseG = 248; baseB = 255;
    darkR = 198; darkG = 215; darkB = 242;
    hotR = 255; hotG = 255; hotB = 255;
  } else if (T < 11000) {
    // A0–A9V (Sirio 9940 K): blanco-azulado brillante
    baseR = 186; baseG = 216; baseB = 255;
    darkR = 128; darkG = 168; darkB = 238;
    hotR = 232; hotG = 244; hotB = 255;
  } else {
    // B / O estrellas calientes (Rígel 12100 K, Espiga 25300 K): azul zafiro intenso
    baseR = 132; baseG = 182; baseB = 255;
    darkR = 78; darkG = 128; darkB = 228;
    hotR = 208; hotG = 232; hotB = 255;
  }

  const img = ctx.createImageData(W, H);
  if (img && img.data) {
    const d = img.data;
    const isSubstellar = /^([YTL])/i.test(sp) || T < 1800;
    const cellFreq = T < 3800 ? 14 : T < 6200 ? 26 : 18;

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const lat = (v - 0.5) * Math.PI;
      const cosLat = Math.cos(lat);
      // Oscurecimiento suave hacia los polos para reforzar la tridimensionalidad esférica
      const limbFactor = 0.72 + 0.28 * Math.pow(Math.max(0.05, cosLat), 0.55);

      for (let x = 0; x < W; x++) {
        const u = x / W;
        let tone = 0.5;
        if (isSubstellar) {
          const band = Math.sin(v * Math.PI * 11 + Math.sin(u * Math.PI * 4) * 0.45);
          const vortex = Math.cos(u * Math.PI * 6 - v * Math.PI * 5);
          tone = 0.5 + 0.36 * band + 0.14 * vortex;
        } else {
          // Coordenadas esféricas 3D sin costuras UV para granulación convectiva orgánica
          const lon = u * Math.PI * 2;
          const sx = cosLat * Math.cos(lon);
          const sy = Math.sin(lat);
          const sz = cosLat * Math.sin(lon);
          const freq = T < 3800 ? 5.5 : T < 6200 ? 9.0 : 7.0;
          const n1 = fbmGalaxy(sx * freq + 3.1, sy * freq + sz * (freq * 0.72), 3);
          const n2 = fbmGalaxy(sz * (freq * 1.8) - 1.7, sx * (freq * 1.6) + sy * 2.3, 2);
          // Celdas convectivas brillantes separadas por carriles intergranulares más oscuros
          const cells = Math.pow(Math.min(1, Math.max(0, n1 * 0.68 + n2 * 0.32)), 0.85);
          const spotNoise =
            T < 4000
              ? fbmGalaxy(sx * 2.4 + 0.9, sy * 2.4 - sz * 1.9, 2)
              : 0;
          const spot = spotNoise > 0.68 ? Math.pow((spotNoise - 0.68) / 0.32, 1.6) * 0.45 : 0;
          tone = Math.max(0.06, Math.min(0.98, 0.24 + 0.72 * cells - spot));
        }

        let r;
        let g;
        let b;
        if (tone < 0.5) {
          const k = tone * 2;
          r = darkR + (baseR - darkR) * k;
          g = darkG + (baseG - darkG) * k;
          b = darkB + (baseB - darkB) * k;
        } else {
          const k = (tone - 0.5) * 2;
          r = baseR + (hotR - baseR) * k;
          g = baseG + (hotG - baseG) * k;
          b = baseB + (hotB - baseB) * k;
        }

        const idx = (y * W + x) * 4;
        d[idx] = Math.min(255, Math.round(r * limbFactor));
        d[idx + 1] = Math.min(255, Math.round(g * limbFactor));
        d[idx + 2] = Math.min(255, Math.round(b * limbFactor));
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  starTextureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Construye o actualiza la representación física 3D de una estrella en `missionMarkers`,
 * evitando por completo la saturación aditiva blanca y asegurando que:
 * - Estrella de Barnard (M4.0Ve, 3220 K, 0.187 R☉) se vea como una enana roja-anaranjada convectiva compacta.
 * - WISE 0855 (Y2, 260 K) se vea como una subenana marrón oscura con bandas infrarrojas.
 * - Epsilon Indi Ba/Bb (T1+T6, 1320 K) muestre el par binario de enanas marrones.
 * - RW Aurigae (K1Ve T Tauri, 4900 K) muestre su fotosfera cálida y disco circunestelar inclinado.
 * - R Draconis (M5e-M9eIII Mira, 2950 K, 215 R☉) muestre una supergigante roja extendida con envoltura AGB.
 */
export function enhancePhysicalStarMarker3D(markerGroup, starKey, glowTexture = null, effect = null) {
  const star = getCanonicalStar(starKey);
  if (!markerGroup || !star) return null;

  // Asegurar que la malla de detalle (`surface`) exista antes de aplicar materiales físicos
  if (effect && typeof effect.ensureDetail === 'function') {
    effect.ensureDetail();
  }

  markerGroup.userData.canonicalStar = star;
  markerGroup.userData.provenance = getObjectProvenance(starKey);
  markerGroup.userData.physicalParameters = {
    temperatureK: star.temperatureK,
    radiusSolar: star.radiusSolar,
    luminositySolar: star.luminositySolar,
    spectralType: star.spectralType,
  };
  markerGroup.userData.physicalReconstruction = {
    spectralType: star.spectralType,
    temperatureK: star.temperatureK,
    radiusSolar: star.radiusSolar,
    luminositySolar: star.luminositySolar,
    apparentMagnitude: star.apparentMagnitude,
    spaceColorHex: star.spaceColorHex,
  };

  // Factor de radio físico relativo: Barnard (0.187 R☉) es compacta; R Draconis (215 R☉) es extendida
  const physicalRadiusFactor =
    star.key === 'barnard'
      ? 0.62
      : star.key === 'wise-0855' || star.key === 'epsilon-indi-b'
        ? 0.54
        : star.key === 'r-draconis'
          ? 1.55
          : Math.max(0.65, Math.min(1.65, 0.72 + Math.log10(Math.max(0.08, star.radiusSolar) * 10) * 0.32));

  const photosphereTex = getStellarPhotosphereTexture(
    star.spaceColorHex,
    star.spectralType,
    star.temperatureK,
  );

  //Color de corona profundo que NO satura el canal verde/azul a blanco sobre el disco
  const deepCoronaHex =
    star.temperatureK < 500
      ? '#701c42'
      : star.temperatureK < 1500
        ? '#a82c1e'
        : star.temperatureK < 3650
          ? '#d94416' // Rojo-naranja profundo para Barnard y R Draconis
          : star.temperatureK < 5300
            ? '#e69438'
            : star.temperatureK < 6200
              ? '#fff2d8'
              : '#6ea8ff';
  const coronaColor = new THREE.Color(deepCoronaHex);

  // 1. Ajustar el Sprite `halo` exterior (`markerGroup.children[0]`) para que no lave el disco a blanco
  const haloSprite = markerGroup.children.find((ch) => ch.isSprite);
  if (haloSprite && haloSprite.material) {
    haloSprite.material.color.copy(coronaColor);
    haloSprite.material.opacity = 0.24;
    haloSprite.scale.setScalar(0.24 * physicalRadiusFactor * 3.1);
  }

  // 2. Localizar `surface` dentro de `detail` (`markerGroup.children[1]`) o directamente en `markerGroup`
  let surfaceMesh = null;
  const detailGroup = markerGroup.children.find((ch) => ch.isGroup && ch.name !== 'kronox-physical-stellar-layer');
  if (detailGroup) {
    surfaceMesh = detailGroup.children.find((ch) => ch.isMesh);
  }
  if (!surfaceMesh) {
    surfaceMesh = markerGroup.children.find((ch) => ch.isMesh);
  }

  const baseRadius = effect?.radius || 0.24;
  const starDiskRadius = baseRadius * physicalRadiusFactor;

  if (surfaceMesh && surfaceMesh.material) {
    surfaceMesh.scale.setScalar(starDiskRadius);
    surfaceMesh.material.color = new THREE.Color('#ffffff'); // La textura ya contiene el color físico exacto
    surfaceMesh.material.transparent = false;
    surfaceMesh.material.blending = THREE.NormalBlending;
    surfaceMesh.material.depthWrite = true;
    if (photosphereTex) {
      surfaceMesh.material.map = photosphereTex;
      surfaceMesh.material.needsUpdate = true;
    }
  }

  // 3. Añadir capa astrofísica (`kronox-physical-stellar-layer`) dentro de `detailGroup` (o `markerGroup`)
  const parentForDetail = detailGroup || markerGroup;
  let physicalLayer = parentForDetail.getObjectByName('kronox-physical-stellar-layer');
  if (!physicalLayer) {
    physicalLayer = new THREE.Group();
    physicalLayer.name = 'kronox-physical-stellar-layer';
    physicalLayer.userData.spherexTargetKey = star.key;

    // Halo cromosférico en el borde (BackSide / baja opacidad para nunca lavar el centro de la fotosfera)
    const chromosphere = new THREE.Mesh(
      new THREE.SphereGeometry(starDiskRadius * 1.12, 24, 20),
      new THREE.MeshBasicMaterial({
        color: coronaColor,
        transparent: true,
        opacity: star.temperatureK < 1500 ? 0.14 : 0.22,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    chromosphere.userData.spherexTargetKey = star.key;
    physicalLayer.add(chromosphere);

    if (star.key === 'rw-aurigae') {
      const accretionDisk = new THREE.Mesh(
        new THREE.RingGeometry(starDiskRadius * 1.35, starDiskRadius * 2.9, 48),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#ff9d47'),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
        }),
      );
      accretionDisk.rotation.x = 1.12;
      accretionDisk.rotation.z = 0.35;
      accretionDisk.name = 'circumstellar-accretion-disk';
      accretionDisk.userData.spherexTargetKey = star.key;
      physicalLayer.add(accretionDisk);
    } else if (star.key === 'epsilon-indi-b') {
      const companionBb = new THREE.Mesh(
        new THREE.SphereGeometry(starDiskRadius * 0.62, 16, 16),
        new THREE.MeshBasicMaterial({
          map: getStellarPhotosphereTexture('#a82c1e', 'T6V', 950),
          color: new THREE.Color('#ffffff'),
        }),
      );
      companionBb.position.set(starDiskRadius * 2.4, starDiskRadius * 0.35, -starDiskRadius * 0.9);
      companionBb.name = 'binary-companion-bb';
      companionBb.userData.spherexTargetKey = star.key;
      physicalLayer.add(companionBb);
    } else if (star.key === 'r-draconis') {
      const agbShell = new THREE.Mesh(
        new THREE.SphereGeometry(starDiskRadius * 1.48, 24, 20),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#e03c14'),
          transparent: true,
          opacity: 0.18,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      agbShell.name = 'mira-agb-envelope';
      agbShell.userData.spherexTargetKey = star.key;
      physicalLayer.add(agbShell);
    }

    parentForDetail.add(physicalLayer);
  }

  // Envolver `effect.update` para que al acercarse a la estrella el halo no sature la fotosfera
  if (effect && !effect.__kronoxStarWrapped) {
    const origUpdate = effect.update.bind(effect);
    effect.update = (camera) => {
      origUpdate(camera);
      if (haloSprite && haloSprite.material && camera) {
        const dist = camera.position.distanceTo(markerGroup.getWorldPosition(new THREE.Vector3()));
        haloSprite.material.opacity = dist < 6 ? 0.12 : dist < 25 ? 0.22 : 0.42;
      }
    };
    effect.__kronoxStarWrapped = true;
  }

  return star;
}

/**
 * Actualiza todos los marcadores de `stellarAtlas` y `regionalAtlas` para que:
 * - Ninguna estrella sin `temperatureK` en `spherexTargets.js` (como `barnard`) quede blanca (`#d7e5fa`).
 * - Cada estrella tenga su textura fotosférica convectiva real, color por `temperatureK` y radio físico relativo.
 */
export function upgradeStellarAtlasesWithPhysicalStars(atlases = []) {
  for (const atlas of atlases) {
    if (!atlas || !atlas.markers) continue;
    for (const [key, item] of atlas.markers.entries()) {
      const star = getCanonicalStar(key) || derivePhysicalStarProperties(item.target || { key });
      if (!star || !item.marker) continue;

      item.target.temperatureK = star.temperatureK;
      item.target.spectralType = star.spectralType;
      item.target.radiusSolar = star.radiusSolar;
      item.target.luminositySolar = star.luminositySolar;
      item.target.apparentMagnitude = star.apparentMagnitude;
      item.target.spaceColorHex = star.spaceColorHex;

      const bodyMesh = item.marker.children.find((ch) => ch.isMesh);
      const haloSprite = item.marker.children.find((ch) => ch.isSprite);

      const photosphereTex = getStellarPhotosphereTexture(
        star.spaceColorHex,
        star.spectralType,
        star.temperatureK,
      );
      const tintColor = new THREE.Color(star.spaceColorHex);
      const coronaHex =
        star.temperatureK < 3650
          ? '#e04819'
          : star.temperatureK < 5250
            ? '#f09c42'
            : star.temperatureK < 6150
              ? '#fff5e4'
              : '#7cb2ff';
      const coronaColor = new THREE.Color(coronaHex);

      if (bodyMesh && bodyMesh.material) {
        if (photosphereTex) {
          bodyMesh.material.map = photosphereTex;
          bodyMesh.material.color.set('#ffffff');
        } else {
          bodyMesh.material.color.copy(tintColor);
        }
        bodyMesh.material.needsUpdate = true;
      }
      if (haloSprite && haloSprite.material) {
        haloSprite.material.color.copy(coronaColor);
        haloSprite.material.opacity = 0.52;
      }

      // Ajustar el radio base en el atlas según el radio físico real de la estrella
      const radiusFactor =
        key === 'sun'
          ? 1.0
          : star.radiusSolar < 0.25
            ? 0.62 // Enanas rojas compactas (Barnard, Próxima)
            : star.radiusSolar > 20
              ? 1.55 // Gigantes/supergigantes (R Draconis, Rígel)
              : 0.92;
      item.physicalRadiusFactor = radiusFactor;
    }

    if (typeof atlas.update === 'function' && !atlas.__kronoxAtlasWrapped) {
      const origAtlasUpdate = atlas.update.bind(atlas);
      atlas.update = (camera, selectedKey = null) => {
        const labelEntries = origAtlasUpdate(camera, selectedKey);
        const camPos = camera?.position;
        for (const [key, item] of atlas.markers.entries()) {
          const bodyMesh = item.marker.children.find((ch) => ch.isMesh);
          const haloSprite = item.marker.children.find((ch) => ch.isSprite);
          const factor = item.physicalRadiusFactor || 1;
          const active = key === selectedKey;
          if (bodyMesh) {
            bodyMesh.scale.setScalar(item.radius * factor * (active ? 1.35 : 1));
          }
          if (haloSprite && haloSprite.material && camPos) {
            const worldPos = item.marker.getWorldPosition(new THREE.Vector3());
            const d = camPos.distanceTo(worldPos);
            // Al acercarse con la cámara, reducimos el halo aditivo para que la fotosfera roja/azul/solar sea 100% nítida
            const closeFade = THREE.MathUtils.smoothstep(d, item.radius * 3, item.radius * 24);
            haloSprite.material.opacity = 0.16 + 0.52 * closeFade;
            const ndcScale = 0.014 * Math.max(0.75, Math.min(1.35, factor)) * (active ? 1.4 : 1.0);
            haloSprite.scale.set(ndcScale, ndcScale, 1);
          }
        }
        return labelEntries;
      };
      atlas.__kronoxAtlasWrapped = true;
    }
  }
}

/**
 * ============================================================================
 * INVENTARIO Y RECONSTRUCCIÓN 3D MORFOLÓGICA DE TODAS LAS GALAXIAS DEL CATÁLOGO
 * (Vía Láctea, M31, M33, M101, M81, M82, NGC 253, LMC, SMC, NGC 6822, SagDEG)
 * ============================================================================
 */
export const GALAXY_MORPHOLOGY_METADATA = {
  'milky-way': {
    id: 'milky-way',
    canonicalName: 'Vía Láctea',
    morphologicalType: 'SBbc (Espiral barrada)',
    family: 'barred-spiral',
    diameterKly: 105,
    angularSizeArcmin: 10800,
    inclinationDeg: 0,
    positionAngleDeg: 0,
    barAngleDeg: 28,
    armCount: 4,
    armTightness: 0.38,
    bulgeRatio: 0.24,
    dustLaneStrength: 0.82,
    hiiKnotDensity: 0.72,
    distanceMly: 0.026,
    distanceUncertaintyMly: 0.001,
    distanceMethod: 'geometric-masers-and-gravity-vlti',
    palette: {
      core: '#fff4dc',
      bar: '#f2c888',
      arms: '#94c2ff',
      outer: '#5c8be6',
      dust: '#24140c',
      hii: '#ff6ca8',
    },
    scientificNote:
      'Modelo exterior reconstruido a partir de observaciones internas infrarrojas (Spitzer GLIMPSE sig05-010a, R. Hurt/SSC-Caltech y Gaia DR3): barra galáctica prominente a 28°, bulbo volumétrico continuo sin esfera sólida, 4 brazos espirales logarítmicos con carriles de polvo oscuros, regiones HII rosadas y el Espolón de Orión.',
  },
  m31: {
    id: 'm31',
    canonicalName: 'Galaxia de Andrómeda · M31',
    morphologicalType: 'SA(s)b (Espiral gigante inclinada)',
    family: 'grand-spiral',
    diameterKly: 152,
    angularSizeArcmin: 190,
    inclinationDeg: 74,
    positionAngleDeg: 38,
    barAngleDeg: 0,
    armCount: 2,
    armTightness: 0.29,
    bulgeRatio: 0.32,
    dustLaneStrength: 0.92,
    hiiKnotDensity: 0.52,
    distanceMly: 2.53,
    distanceUncertaintyMly: 0.07,
    distanceMethod: 'cepheid-and-trgb',
    palette: {
      core: '#fff4da',
      bar: '#ecc082',
      arms: '#8cb8ff',
      outer: '#5a8ef0',
      dust: '#28150b',
      hii: '#ff7fa2',
    },
    scientificNote:
      'Reconstrucción volumétrica 3D basada en fotografías reales y el mosaico Hubble PHAT/PHAST (heic2501a): disco altamente inclinado (~74–77°), bulbo central cálido con gradiente continuo, bandas oscuras concéntricas de polvo frío, anillo exterior azul-violeta de formación estelar y galaxias satélites M32 y M110.',
  },
  m33: {
    id: 'm33',
    canonicalName: 'Galaxia del Triángulo · M33',
    morphologicalType: 'SA(s)cd (Espiral floculenta multibrazo)',
    family: 'flocculent-spiral',
    diameterKly: 60,
    angularSizeArcmin: 70,
    inclinationDeg: 54,
    positionAngleDeg: 23,
    barAngleDeg: 0,
    armCount: 4,
    armTightness: 0.56,
    bulgeRatio: 0.11,
    dustLaneStrength: 0.42,
    hiiKnotDensity: 0.88,
    distanceMly: 2.73,
    distanceUncertaintyMly: 0.1,
    distanceMethod: 'cepheid-and-eclipsing-binaries',
    palette: {
      core: '#e8f0ff',
      bar: '#c8dcff',
      arms: '#7cb5ff',
      outer: '#4d84d8',
      dust: '#231c24',
      hii: '#ff6ca4',
    },
    scientificNote:
      'Espiral tardía SA(s)cd sin bulbo prominente ni barra fuerte, con brazos abiertos floculentos ricos en estrellas OB jóvenes y regiones HII gigantes como NGC 604.',
  },
  m101: {
    id: 'm101',
    canonicalName: 'Galaxia del Molinete · M101',
    morphologicalType: 'SAB(rs)cd (Espiral multibrazo de gran diseño)',
    family: 'multi-arm-face-on-spiral',
    diameterKly: 170,
    angularSizeArcmin: 28.8,
    inclinationDeg: 18,
    positionAngleDeg: 39,
    barAngleDeg: 15,
    armCount: 5,
    armTightness: 0.48,
    bulgeRatio: 0.14,
    dustLaneStrength: 0.55,
    hiiKnotDensity: 0.95,
    distanceMly: 21.0,
    distanceUncertaintyMly: 0.8,
    distanceMethod: 'cepheid-hst-sh0es',
    palette: {
      core: '#fff0d8',
      bar: '#f6d8aa',
      arms: '#80baff',
      outer: '#5890e8',
      dust: '#281a18',
      hii: '#ff6b9d',
    },
    scientificNote:
      'Espiral gigante vista casi de frente (i ≈ 18°), caracterizada por múltiples brazos espirales con asimetría externa inducida por interacciones de marea y grandes complejos HII.',
  },
  m81: {
    id: 'm81',
    canonicalName: 'Galaxia de Bode · M81',
    morphologicalType: 'SA(s)ab (Espiral de gran diseño)',
    family: 'grand-spiral',
    diameterKly: 90,
    angularSizeArcmin: 26.9,
    inclinationDeg: 59,
    positionAngleDeg: 157,
    barAngleDeg: 0,
    armCount: 2,
    armTightness: 0.34,
    bulgeRatio: 0.34,
    dustLaneStrength: 0.65,
    hiiKnotDensity: 0.58,
    distanceMly: 11.8,
    distanceUncertaintyMly: 0.4,
    distanceMethod: 'cepheid-and-trgb',
    palette: {
      core: '#fff1cf',
      bar: '#f4ca88',
      arms: '#96c2ff',
      outer: '#648fd4',
      dust: '#261812',
      hii: '#ff7fa2',
    },
    scientificNote:
      'Espiral simétrica de gran diseño SA(s)ab con bulbo central suave y dos brazos principales bien trazados que interactúan gravitacionalmente con M82.',
  },
  m82: {
    id: 'm82',
    canonicalName: 'Galaxia del Cigarro · M82',
    morphologicalType: 'I0 / Starburst (Irregular con superviento bipolar)',
    family: 'starburst-edge-on',
    diameterKly: 40,
    angularSizeArcmin: 11.2,
    inclinationDeg: 80,
    positionAngleDeg: 65,
    barAngleDeg: 0,
    armCount: 0,
    armTightness: 0,
    bulgeRatio: 0.28,
    dustLaneStrength: 0.92,
    hiiKnotDensity: 0.82,
    distanceMly: 11.9,
    distanceUncertaintyMly: 0.4,
    distanceMethod: 'trgb-hst',
    palette: {
      core: '#fff0d2',
      bar: '#f0b878',
      arms: '#b8cde8',
      outer: '#7f9cc4',
      dust: '#22120d',
      hii: '#ff3850',
    },
    scientificNote:
      'Galaxia prototipo con brote estelar vista casi de canto (i ≈ 80°): disco estelar denso cruzado por filamentos de polvo oscuros y un prominente superviento bicónico perpendicular rico en Hα.',
  },
  'ngc-253': {
    id: 'ngc-253',
    canonicalName: 'Galaxia del Escultor · NGC 253',
    morphologicalType: 'SAB(s)c (Espiral polvorienta con brote estelar)',
    family: 'dusty-inclined-spiral',
    diameterKly: 90,
    angularSizeArcmin: 27.5,
    inclinationDeg: 76,
    positionAngleDeg: 52,
    barAngleDeg: 18,
    armCount: 2,
    armTightness: 0.42,
    bulgeRatio: 0.2,
    dustLaneStrength: 0.9,
    hiiKnotDensity: 0.75,
    distanceMly: 11.4,
    distanceUncertaintyMly: 0.5,
    distanceMethod: 'trgb',
    palette: {
      core: '#ffe8bf',
      bar: '#e5a968',
      arms: '#9cbdff',
      outer: '#6a8fd0',
      dust: '#25140e',
      hii: '#ff6e88',
    },
    scientificNote:
      'Galaxia espiral intermedia SAB(s)c vista con alta inclinación (78°), rica en polvo interestelar filamentoso y un activo brote estelar nuclear.',
  },
  lmc: {
    id: 'lmc',
    canonicalName: 'Gran Nube de Magallanes · LMC',
    morphologicalType: 'SB(s)m (Enana irregular barrada magallánica)',
    family: 'magellanic-barred-irregular',
    diameterKly: 32,
    angularSizeArcmin: 645,
    inclinationDeg: 35,
    positionAngleDeg: 170,
    barAngleDeg: 18,
    armCount: 1,
    armTightness: 0.65,
    bulgeRatio: 0.18,
    dustLaneStrength: 0.48,
    hiiKnotDensity: 0.92,
    distanceMly: 0.163,
    distanceUncertaintyMly: 0.004,
    distanceMethod: 'eclipsing-binaries-pietrzynski-2019',
    palette: {
      core: '#ffe9c6',
      bar: '#f2c888',
      arms: '#84b8ff',
      outer: '#5688d8',
      dust: '#241a20',
      hii: '#ff6498',
    },
    scientificNote:
      'Prototipo de galaxia magallánica SB(s)m: barra estelar descentrada muy marcada, un único brazo espiral embrionario asimétrico y el complejo gigante de formación estelar 30 Doradus.',
  },
  smc: {
    id: 'smc',
    canonicalName: 'Pequeña Nube de Magallanes · SMC',
    morphologicalType: 'SB(s)m pec (Enana irregular elongada por marea)',
    family: 'dwarf-irregular',
    diameterKly: 19,
    angularSizeArcmin: 320,
    inclinationDeg: 68,
    positionAngleDeg: 45,
    barAngleDeg: 0,
    armCount: 0,
    armTightness: 0,
    bulgeRatio: 0.15,
    dustLaneStrength: 0.3,
    hiiKnotDensity: 0.68,
    distanceMly: 0.203,
    distanceUncertaintyMly: 0.005,
    distanceMethod: 'eclipsing-binaries-graczyk-2020',
    palette: {
      core: '#dce8ff',
      bar: '#b8d0ff',
      arms: '#80aeff',
      outer: '#5680c8',
      dust: '#1d1c28',
      hii: '#ff78a8',
    },
    scientificNote:
      'Galaxia enana irregular elongada a lo largo de la línea de visión y distorsionada gravitacionalmente por la LMC y la Vía Láctea.',
  },
  'ngc-6822': {
    id: 'ngc-6822',
    canonicalName: 'Galaxia de Barnard · NGC 6822',
    morphologicalType: 'IB(s)m (Enana irregular barrada)',
    family: 'dwarf-irregular',
    diameterKly: 7,
    angularSizeArcmin: 15.5,
    inclinationDeg: 42,
    positionAngleDeg: 10,
    barAngleDeg: 12,
    armCount: 0,
    armTightness: 0,
    bulgeRatio: 0.16,
    dustLaneStrength: 0.35,
    hiiKnotDensity: 0.74,
    distanceMly: 1.6,
    distanceUncertaintyMly: 0.08,
    distanceMethod: 'cepheid-and-trgb',
    palette: {
      core: '#e5eeff',
      bar: '#bfd6ff',
      arms: '#7eb2ff',
      outer: '#527ec4',
      dust: '#201c26',
      hii: '#ff6e9c',
    },
    scientificNote:
      'Enana irregular barrada aislada del Grupo Local con una barra central de estrellas jóvenes rodeada de complejos HII (Hubble V y Hubble X) y un halo extendido de estrellas antiguas.',
  },
  'sagittarius-dwarf': {
    id: 'sagittarius-dwarf',
    canonicalName: 'Enana Elíptica de Sagitario · SagDEG',
    morphologicalType: 'dSph(t) / E7 (Enana esferoidal elongada en disrupción de marea)',
    family: 'dwarf-spheroidal',
    diameterKly: 10,
    angularSizeArcmin: 450,
    inclinationDeg: 68,
    positionAngleDeg: 102,
    barAngleDeg: 0,
    armCount: 0,
    armTightness: 0,
    bulgeRatio: 0.35,
    dustLaneStrength: 0.02,
    hiiKnotDensity: 0.0,
    distanceMly: 0.085,
    distanceUncertaintyMly: 0.006,
    distanceMethod: 'rr-lyrae-and-red-clump',
    palette: {
      core: '#f5d8aa',
      bar: '#e0b478',
      arms: '#c89658',
      outer: '#946838',
      dust: '#241810',
      hii: '#e6a868',
    },
    scientificNote:
      'Galaxia satélite dSph(t)/E7 de muy bajo brillo superficial en proceso de disrupción gravitatoria por la Vía Láctea: estructura difusa fuertemente elongada (~3:1) con colas de marea estelares y población envejecida, sin núcleo esférico compacto.',
  },
};

function buildCanonicalGalaxiesRegistry() {
  const map = new Map();
  for (const item of NEARBY_GALAXIES) {
    const meta = GALAXY_MORPHOLOGY_METADATA[item.key] || null;
    const provenance = getObjectProvenance(item.key);
    const distancePc = Number.isFinite(item.distanceMly)
      ? (item.distanceMly * 1e6) / LY_PER_PC
      : meta?.distanceMly
        ? (meta.distanceMly * 1e6) / LY_PER_PC
        : 0;
    const raDeg = Number.isFinite(item.raDeg) ? item.raDeg : 266.405;
    const decDeg = Number.isFinite(item.decDeg) ? item.decDeg : -28.936;
    const galDeg = icrsToGalacticDeg(raDeg, decDeg);
    map.set(item.key, {
      ...item,
      id: item.key,
      canonicalName: meta?.canonicalName || item.name?.es || item.key,
      morphologicalType: meta?.morphologicalType || item.type?.es || 'Galaxia / Grupo',
      family: meta?.family || (item.kind === 'group' ? 'galaxy-group' : 'spiral'),
      raDeg,
      decDeg,
      lDeg: Number(galDeg.lDeg.toFixed(4)),
      bDeg: Number(galDeg.bDeg.toFixed(4)),
      distanceMly: item.distanceMly ?? meta?.distanceMly ?? 0,
      distanceUncertaintyMly: meta?.distanceUncertaintyMly ?? 0.08,
      distanceMethod: meta?.distanceMethod || 'catalog-literature',
      distancePc: Math.round(distancePc),
      diameterKly: meta?.diameterKly ?? 50,
      angularSizeArcmin: meta?.angularSizeArcmin ?? 20,
      inclinationDeg: meta?.inclinationDeg ?? item.tilt?.[0] ?? 45,
      positionAngleDeg: meta?.positionAngleDeg ?? item.tilt?.[1] ?? 0,
      scientificNote:
        meta?.scientificNote ||
        'Posición y clasificación según catálogos extragalácticos (NED / SIMBAD). El volumen 3D es una representación morfológica condicionada, no una tomografía tridimensional directa.',
      morphologyMeta: meta,
      provenance,
    });
  }
  return map;
}

export const CANONICAL_GALAXIES_BY_ID = buildCanonicalGalaxiesRegistry();
export const ALL_CATALOG_INVENTORY_SUMMARY = {
  totalStars: CANONICAL_STARS_BY_ID.size,
  totalGalaxiesAndGroups: CANONICAL_GALAXIES_BY_ID.size,
  individualGalaxies: [...CANONICAL_GALAXIES_BY_ID.values()]
    .filter((g) => g.kind !== 'group')
    .map((g) => g.id),
  researchObjectsCount: RESEARCH_CATALOG.length,
  planetsCount: P.length,
};

export function getCanonicalGalaxy(key) {
  if (!key) return null;
  return CANONICAL_GALAXIES_BY_ID.get(key) || null;
}

/**
 * Ruido fractal determinista 2D rápido para estructura fina de brazos espirales, carriles de polvo y nebulosas HII.
 */
function hash2D(ix, iy, seed = 1) {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2D(x, y, seed = 1) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmGalaxy(x, y, seed = 1, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, y * freq, seed + i * 19);
    freq *= 2.05;
    amp *= 0.5;
  }
  return val;
}

/**
 * Sintetiza píxel a píxel el mapa volumétrico de brillo superficial, temperatura de color por población estelar,
 * absorción por bandas de polvo interestelar y regiones HII rosadas para cada galaxia del catálogo.
 * Elimina por completo cualquier esfera amarilla opaca y reproduce las referencias:
 * - Vía Láctea: Spitzer/Hurt (`sig05-010a-milky-way-bar`) espiral barrada de 4 brazos + espolón de Orión + carriles de polvo en barra y brazos.
 * - Andrómeda M31: Hubble PHAT/PHAST (`heic2501a`) bulbo cálido con gradiente suave + anillos oscuros de polvo + anillo azul exterior.
 * - Enana de Sagitario: corriente dSph/E7 difusa de bajo brillo superficial y elongación de marea (~3:1).
 */
const galaxyTextureCache = new Map();
export function getGalaxyPhotographicVolumeTexture(galaxyKey) {
  if (galaxyTextureCache.has(galaxyKey)) return galaxyTextureCache.get(galaxyKey);
  if (typeof document === 'undefined') return null;

  const meta = GALAXY_MORPHOLOGY_METADATA[galaxyKey] || GALAXY_MORPHOLOGY_METADATA['milky-way'];
  const isHarness = Boolean(globalThis.__KRONOX_SCENE_HARNESS__);
  const N = isHarness ? 48 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(N, N);
  if (img && img.data) {
    const data = img.data;
    const seed = galaxyKey.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 11);
    const barRad = (meta.barAngleDeg || 0) * DEG2RAD;
    const cosB = Math.cos(barRad);
    const sinB = Math.sin(barRad);

    for (let py = 0; py < N; py++) {
      const y = (py / (N - 1)) * 2 - 1;
      for (let px = 0; px < N; px++) {
        const x = (px / (N - 1)) * 2 - 1;
        const r = Math.hypot(x, y);
        const idx = (py * N + px) * 4;

        if (r >= 0.99) {
          data[idx] = data[idx + 1] = data[idx + 2] = data[idx + 3] = 0;
          continue;
        }

        const edgeFade = Math.pow(Math.max(0, 1 - Math.pow(r / 0.96, 2.4)), 1.6);
        const turb = fbmGalaxy(x * 3.8 + 4.1, y * 3.8 - 2.3, seed, 4);
        const fine = fbmGalaxy(x * 11.5 - 1.7, y * 11.5 + 5.2, seed + 71, 3);

        let R = 0;
        let G = 0;
        let B = 0;
        let A = 0;

        if (galaxyKey === 'milky-way') {
          // ===================================================================
          // VÍA LÁCTEA (Modelo Spitzer GLIMPSE / R. Hurt sig05-010a):
          // Barra central prominente a 28°, bulbo caja/cacahuete con gradiente continuo,
          // 4 brazos espirales logarítmicos + Espolón de Orión, bandas oscuras de polvo y nodos HII rosados.
          // ===================================================================
          const xb = x * cosB + y * sinB;
          const yb = -x * sinB + y * cosB;

          // Bulbo central suave + barra estelar alargada simétrica (sin cortes ni esfera opaca)
          const rBulge = Math.hypot(xb * 0.88, yb * 1.42);
          const bulgeGlow = Math.exp(-Math.pow(rBulge / 0.16, 1.35)) * 0.88;
          const barEnv =
            Math.exp(-Math.pow(Math.abs(xb) / 0.33, 2.2) - Math.pow(Math.abs(yb) / 0.088, 1.9)) * 0.84;
          const innerRing = Math.exp(-Math.pow(Math.abs(r - 0.25) / 0.065, 2)) * 0.38;
          const warmCenter = Math.min(1.05, bulgeGlow + barEnv * 0.78 + innerRing * 0.45);

          // Carriles de polvo de choque suaves a lo largo de la barra central (rasgo diagnóstico de Hurt/Spitzer)
          const barLenFade = Math.exp(-Math.pow(Math.abs(xb) / 0.25, 2.4)) * THREE.MathUtils.smoothstep(Math.abs(xb), 0.02, 0.08);
          const barShockDust =
            Math.exp(-Math.pow(Math.abs(yb - Math.sign(xb) * 0.022) / 0.028, 2)) * 0.34 * barLenFade;

          // 4 brazos espirales logarítmicos que nacen de los extremos de la barra y envuelven 360° el disco
          const theta = Math.atan2(y, x);
          const rArm = Math.max(0.14, r);
          const pitchCot = 4.45; // ángulo de paso ~ 12.7°
          const logR = Math.log(rArm / 0.22) * pitchCot + (turb - 0.5) * 0.48;

          let armSum = 0;
          let dustSum = barShockDust;
          let hiiSum = 0;

          for (let k = 0; k < 4; k++) {
            const armOffset = barRad + (k * Math.PI) / 2;
            const dPhi = Math.atan2(
              Math.sin(theta - armOffset + logR),
              Math.cos(theta - armOffset + logR),
            );
            // Brazos principales (k=0 Escudo-Centauro, k=2 Perseo) y secundarios (k=1 Norma, k=3 Sagitario-Carina)
            const weight = k % 2 === 0 ? 1.0 : 0.82;
            const armWidth = 0.40 + 0.16 * r;
            const armProfile = Math.exp(-Math.pow(Math.abs(dPhi) / armWidth, 1.75)) * weight;
            armSum += armProfile;

            // Carril oscuro de polvo en el borde cóncavo interior del brazo
            const dustDPhi = dPhi + armWidth * 0.52;
            const laneProfile =
              Math.exp(-Math.pow(Math.abs(dustDPhi) / (armWidth * 0.36), 2)) * weight;
            dustSum += laneProfile * (0.44 + 0.42 * fine);

            // Regiones HII rosadas/magenta concentradas como nudos discretos sobre la cresta espiral
            if (r > 0.22 && r < 0.86) {
              const knotPattern =
                fine > 0.56 ? Math.pow((fine - 0.56) / 0.44, 1.8) * (0.5 + 0.5 * Math.sin(r * 28 + k * 2.1)) : 0;
              hiiSum +=
                Math.exp(-Math.pow(Math.abs(dPhi) / (armWidth * 0.28), 2)) * knotPattern * weight;
            }
          }

          // Espolón Local de Orión (puente suave interbrazos sin contrastes artificiales)
          const dOrion = Math.hypot(x - 0.04, y - 0.52);
          const orionSpur = Math.exp(-Math.pow(dOrion / 0.26, 1.6)) * 0.34;

          // Envolvente radial amplia para que todo el disco espiral 360° sea claramente visible como en Spitzer
          const radialDiskEnv =
            THREE.MathUtils.smoothstep(r, 0.11, 0.24) * Math.exp(-Math.pow(r / 0.80, 1.8));
          const underlyingDisk = Math.exp(-Math.pow(r / 0.74, 1.5)) * 0.42;
          const armIntensity =
            (armSum * (0.78 + 0.54 * fine) + orionSpur) * radialDiskEnv + underlyingDisk;

          const extinction = Math.max(
            0.28,
            1 - Math.min(0.68, dustSum * 0.62 * radialDiskEnv + barShockDust),
          );

          // Composición cromática física: bulbo/barra dorado-crema -> brazos azul-blancos -> polvo ámbar oscuro -> HII rosa
          const warmR = warmCenter * 252;
          const warmG = warmCenter * 222;
          const warmB = warmCenter * 168;

          const diskR = armIntensity * (158 + 44 * fine);
          const diskG = armIntensity * (196 + 38 * fine);
          const diskB = armIntensity * (248 + 7 * fine);

          const hiiIntensity = Math.min(1, hiiSum * radialDiskEnv * 1.45);
          const hiiR = hiiIntensity * 255;
          const hiiG = hiiIntensity * 88;
          const hiiB = hiiIntensity * 154;

          R = (warmR + diskR) * extinction + hiiR + (1 - extinction) * 42;
          G = (warmG + diskG) * extinction + hiiG + (1 - extinction) * 24;
          B = (warmB + diskB) * extinction + hiiB + (1 - extinction) * 14;

          const lum = Math.max(warmCenter * 0.95, armIntensity * 0.94, hiiIntensity * 0.88);
          A = Math.min(1, lum * edgeFade * 1.24);
        } else if (galaxyKey === 'm31') {
          // ===================================================================
          // ANDRÓMEDA M31 (Mosaico Hubble PHAT/PHAST heic2501a & astrofotografía real):
          // Geometría elíptica muy inclinada (~75°, razón de ejes ~3.1:1 rotada a PA=38°),
          // bulbo central dorado-crema suave (sin saturar a blanco), bandas oscuras de polvo
          // en el flanco cercano y anillo exterior azul-violeta de formación estelar.
          // ===================================================================
          const paRad = -38 * DEG2RAD;
          const cosPa = Math.cos(paRad);
          const sinPa = Math.sin(paRad);
          // Coordenadas en el plano proyectado inclinado de M31 (u = eje mayor, v = eje menor escorzado)
          const uMaj = x * cosPa - y * sinPa;
          const vMin = (x * sinPa + y * cosPa) * 2.85; // Inclinación ~70-75° (escorzo ~2.85:1)
          const rDeproj = Math.hypot(uMaj, vMin);

          if (rDeproj >= 0.98) {
            data[idx] = data[idx + 1] = data[idx + 2] = data[idx + 3] = 0;
            continue;
          }

          const m31EdgeFade = Math.pow(Math.max(0, 1 - Math.pow(rDeproj / 0.96, 2.2)), 1.5);
          const theta = Math.atan2(vMin, uMaj);

          // Bulbo esferoidal ligeramente menos achatado que el disco fino
          const rBulgeEllip = Math.hypot(uMaj * 1.05, vMin * 0.72);
          const bulge = Math.exp(-Math.pow(rBulgeEllip / 0.24, 1.28)) * 0.86;
          const innerDisk = Math.exp(-Math.pow(rDeproj / 0.58, 1.5)) * 0.48;

          // Brazos apretados + prominente anillo exterior azul-violeta (anillo de 10 kpc de M31)
          const pitchCot = 6.2;
          const spiralPhase =
            theta * 2 + Math.log(Math.max(0.07, rDeproj) / 0.18) * pitchCot + (turb - 0.5) * 0.62;
          const spiralWave = 0.5 + 0.5 * Math.cos(spiralPhase);
          const outerBlueRing =
            Math.exp(-Math.pow(Math.abs(rDeproj - 0.62) / 0.18, 2)) *
            (0.55 + 0.45 * spiralWave) *
            (0.68 + 0.52 * fine);
          const midSpiral =
            THREE.MathUtils.smoothstep(rDeproj, 0.16, 0.34) *
            Math.exp(-Math.pow(Math.abs(rDeproj - 0.42) / 0.22, 2)) *
            spiralWave *
            0.54;

          // Bandas oscuras de polvo concéntricas / espirales muy marcadas en el flanco cercano (vMin > -0.15)
          const nearSideBias = 0.55 + 0.65 * THREE.MathUtils.smoothstep(vMin, -0.45, 0.35);
          const dustRing1 = Math.exp(
            -Math.pow(Math.abs(rDeproj - 0.23 - 0.025 * Math.cos(theta * 2)) / 0.038, 2),
          );
          const dustRing2 = Math.exp(
            -Math.pow(Math.abs(rDeproj - 0.37 + 0.035 * Math.sin(theta * 2 + 0.8)) / 0.045, 2),
          );
          const dustRing3 = Math.exp(
            -Math.pow(Math.abs(rDeproj - 0.51 - 0.03 * Math.cos(theta * 3)) / 0.042, 2),
          );
          const spiralDust =
            THREE.MathUtils.smoothstep(rDeproj, 0.12, 0.72) *
            Math.pow(Math.max(0, -Math.sin(spiralPhase + 0.55)), 2.0) *
            0.58;
          const totalDust = Math.min(
            0.88,
            (dustRing1 * 0.78 + dustRing2 * 0.88 + dustRing3 * 0.72 + spiralDust) *
              nearSideBias *
              (0.68 + 0.52 * fine),
          );
          const extinction = 1 - totalDust * 0.82;

          // Nodos HII rosados discretos sobre la cresta espiral del anillo exterior (sin rayos radiales artificiales)
          const hiiKnot = fine > 0.62 ? Math.pow((fine - 0.62) / 0.38, 2.1) : 0;
          const hiiRing =
            Math.exp(-Math.pow(Math.abs(rDeproj - 0.59) / 0.09, 2)) *
            spiralWave *
            hiiKnot *
            0.65;

          const warmBulgeR = (bulge * 244 + innerDisk * 224) * extinction + totalDust * 58;
          const warmBulgeG = (bulge * 212 + innerDisk * 184) * extinction + totalDust * 32;
          const warmBulgeB = (bulge * 162 + innerDisk * 134) * extinction + totalDust * 16;

          const blueOuterR = (outerBlueRing * 124 + midSpiral * 164) * extinction + hiiRing * 245;
          const blueOuterG = (outerBlueRing * 172 + midSpiral * 198) * extinction + hiiRing * 92;
          const blueOuterB = (outerBlueRing * 255 + midSpiral * 246) * extinction + hiiRing * 154;

          R = warmBulgeR + blueOuterR;
          G = warmBulgeG + blueOuterG;
          B = warmBulgeB + blueOuterB;

          const lum = Math.min(
            1,
            bulge * 0.92 + innerDisk * 0.68 + outerBlueRing * 0.92 + midSpiral * 0.58,
          );
          A = Math.min(1, lum * m31EdgeFade * 1.18);
        } else if (galaxyKey === 'sagittarius-dwarf') {
          // ===================================================================
          // ENANA DE SAGITARIO (dSph/E7 en disrupción de marea):
          // Corriente difusa orgánica con gradiente continuo sin bordes cortados rectangulares
          // ===================================================================
          const streamArcY = y - 0.14 * x * x * Math.sign(x);
          const rEllip = Math.hypot(x * 0.88, streamArcY * 2.2);
          if (rEllip >= 1.0) {
            data[idx] = data[idx + 1] = data[idx + 2] = data[idx + 3] = 0;
            continue;
          }
          const feather = Math.max(0, 1 - rEllip);
          const streamDensity =
            Math.exp(-Math.pow(rEllip / 0.48, 1.8)) * (0.68 + 0.32 * turb) * (0.75 + 0.25 * fine);
          R = streamDensity * 238;
          G = streamDensity * 196;
          B = streamDensity * 142;
          A = Math.min(0.65, streamDensity * Math.pow(feather, 1.4) * 0.75);
        } else if (galaxyKey === 'm82') {
          // ===================================================================
          // M82 GALAXIA DEL CIGARRO (Starburst de canto + superviento bipolar Hα):
          // ===================================================================
          const diskProfile =
            Math.exp(-Math.pow(Math.abs(x) / 0.72, 2.0) - Math.pow(Math.abs(y) / 0.14, 1.8)) *
            (0.75 + 0.35 * fine);
          const dustFracture =
            Math.exp(-Math.pow(Math.abs(y) / 0.08, 2)) *
            Math.pow(Math.max(0, Math.sin(x * 19 + turb * 5)), 2.4) *
            0.75;
          const outflowCone =
            Math.exp(-Math.pow(Math.abs(x) / (0.12 + Math.abs(y) * 0.48), 2)) *
            Math.exp(-Math.pow(Math.abs(y) / 0.68, 1.4)) *
            (0.55 + 0.45 * turb);

          const ext = 1 - dustFracture * 0.78;
          R = diskProfile * 245 * ext + outflowCone * 252;
          G = diskProfile * 218 * ext + outflowCone * 62;
          B = diskProfile * 182 * ext + outflowCone * 88;
          A = Math.min(1, Math.max(diskProfile * 0.92, outflowCone * 0.78) * edgeFade);
        } else if (galaxyKey === 'lmc' || galaxyKey === 'smc' || galaxyKey === 'ngc-6822') {
          // ===================================================================
          // GALAXIAS ENANAS IRREGULARES / MAGALLÁNICAS (LMC, SMC, NGC 6822):
          // Barra descentrada + estructura grumosa asimétrica + complejos HII (30 Doradus / Hubble V).
          // ===================================================================
          const xb = x * cosB + y * sinB;
          const yb = -x * sinB + y * cosB;
          const barComponent =
            galaxyKey === 'smc'
              ? Math.exp(
                  -Math.pow(Math.abs(xb - 0.05) / 0.52, 1.8) -
                    Math.pow(Math.abs(yb - 0.12 * xb) / 0.24, 1.8),
                ) * 0.78
              : Math.exp(
                  -Math.pow(Math.abs(xb + 0.06) / 0.44, 2.0) - Math.pow(Math.abs(yb) / 0.14, 1.8),
                ) * 0.85;
          const oneArm =
            galaxyKey === 'lmc'
              ? Math.exp(
                  -Math.pow(
                    Math.hypot(x - 0.18 * Math.cos(r * 4), y - 0.22 * Math.sin(r * 4)) / 0.58,
                    1.8,
                  ),
                ) *
                (0.45 + 0.55 * turb)
              : Math.exp(-Math.pow(r / 0.62, 1.7)) * (0.42 + 0.58 * turb);
          // Complejo HII gigante (30 Doradus en LMC o Hubble V/X en NGC 6822)
          const dTarantula = Math.hypot(x - 0.26, y - 0.16);
          const hiiBurst = Math.exp(-Math.pow(dTarantula / 0.13, 2)) * (0.75 + 0.25 * fine);

          R = barComponent * 238 + oneArm * 150 + hiiBurst * 255;
          G = barComponent * 214 + oneArm * 192 + hiiBurst * 95;
          B = barComponent * 178 + oneArm * 252 + hiiBurst * 162;
          A = Math.min(0.95, Math.max(barComponent, oneArm * 0.85, hiiBurst) * edgeFade);
        } else {
          // ===================================================================
          // ESPIRALES DE GRAN DISEÑO / MULTIBRAZO (M101, M33, M81, NGC 253):
          // ===================================================================
          const arms = Math.max(2, meta.armCount || 2);
          const theta = Math.atan2(y, x);
          const bulge = Math.exp(-Math.pow(r / Math.max(0.1, meta.bulgeRatio * 0.85), 1.3)) * 0.92;
          const pitchCot = 2.8 / Math.max(0.24, meta.armTightness || 0.4);
          let armSum = 0;
          let dustSum = 0;
          let hiiSum = 0;
          const logR = Math.log(Math.max(0.09, r) / 0.16) * pitchCot + (turb - 0.5) * 0.72;

          for (let k = 0; k < arms; k++) {
            const aOff = (k * Math.PI * 2) / arms;
            const dPhi = Math.atan2(Math.sin(theta - aOff + logR), Math.cos(theta - aOff + logR));
            const w = 0.26 + 0.14 * r;
            const prof = Math.exp(-Math.pow(dPhi / w, 2));
            armSum += prof;
            dustSum += Math.exp(-Math.pow((dPhi + w * 0.55) / (w * 0.45), 2)) * (meta.dustLaneStrength || 0.5);
            if (r > 0.2 && r < 0.86) {
              const knot = Math.pow(Math.max(0, Math.sin(r * 28 + k * 1.9 + fine * 5)), 6);
              hiiSum += Math.exp(-Math.pow(dPhi / (w * 0.36), 2)) * knot * (meta.hiiKnotDensity || 0.6);
            }
          }

          const diskEnv = THREE.MathUtils.smoothstep(r, 0.08, 0.22) * Math.exp(-Math.pow(r / 0.72, 1.6));
          const armVal = armSum * diskEnv * (0.65 + 0.55 * fine);
          const ext = Math.max(0.22, 1 - dustSum * diskEnv * 0.65);
          const hiiVal = Math.min(1, hiiSum * diskEnv * 1.25);

          R = (bulge * 255 + armVal * 145) * ext + hiiVal * 255;
          G = (bulge * 232 + armVal * 190) * ext + hiiVal * 95;
          B = (bulge * 190 + armVal * 252) * ext + hiiVal * 158;
          A = Math.min(1, Math.max(bulge * 0.95, armVal * 0.92, hiiVal * 0.85) * edgeFade * 1.15);
        }

        data[idx] = Math.max(0, Math.min(255, Math.round(R)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(G)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(B)));
        data[idx + 3] = Math.max(0, Math.min(255, Math.round(A * 255)));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  galaxyTextureCache.set(galaxyKey, tex);
  return tex;
}

/**
 * Textura radial suave (sin bordes duros) para el resplandor volumétrico 3D del bulbo galáctico.
 */
let softBulgeGlowTexture = null;
function getSoftBulgeGlowTexture() {
  if (softBulgeGlowTexture) return softBulgeGlowTexture;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 56);
  g.addColorStop(0, 'rgba(255, 246, 224, 0.78)');
  g.addColorStop(0.22, 'rgba(246, 212, 158, 0.42)');
  g.addColorStop(0.52, 'rgba(220, 172, 114, 0.14)');
  g.addColorStop(0.82, 'rgba(180, 132, 84, 0.02)');
  g.addColorStop(1, 'rgba(140, 95, 58, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  softBulgeGlowTexture = new THREE.CanvasTexture(canvas);
  if (THREE.sRGBEncoding) softBulgeGlowTexture.encoding = THREE.sRGBEncoding;
  return softBulgeGlowTexture;
}

/**
 * Construye una reconstrucción volumétrica 3D multicapa para cada galaxia del catálogo:
 * 1. Apilado volumétrico 3D de planos fotográficos procedimentales (`getGalaxyPhotographicVolumeTexture`)
 *    con bandas de polvo oscuras, brazos espirales, barra central y regiones HII rosadas.
 * 2. Resplandor volumétrico suave del bulbo/barra SIN esferas amarillas sólidas ni cilindros geométricos duros.
 * 3. Nube 3D de poblaciones estelares, polvo interestelar y regiones HII con espesor vertical real.
 * 4. Satélites compañeros M32 y M110 en Andrómeda (M31), corrientes de marea en Sagitario y superviento bipolar en M82.
 */
export function buildGalaxyMorphologyLayer3D(galaxyKey, radius = 12, glowTexture = null) {
  const meta = GALAXY_MORPHOLOGY_METADATA[galaxyKey];
  if (!meta) return null;

  const rng = createDeterministicRng(`galaxy-morph:${galaxyKey}`);
  const group = new THREE.Group();
  group.name = `kronox-galaxy-morphology-${galaxyKey}`;
  group.userData.isMorphologyLayer = true;
  group.userData.nearbyGalaxyKey = galaxyKey;
  group.userData.morphologicalType = meta.morphologicalType;
  group.userData.morphologyFamily = meta.family;
  group.userData.diameterKly = meta.diameterKly;
  group.userData.inclinationDeg = meta.inclinationDeg;
  group.userData.positionAngleDeg = meta.positionAngleDeg;
  group.userData.provenance = getObjectProvenance(galaxyKey);

  const cCore = new THREE.Color(meta.palette.core);
  const cBar = new THREE.Color(meta.palette.bar);
  const cArms = new THREE.Color(meta.palette.arms);
  const cOuter = new THREE.Color(meta.palette.outer);
  const cDust = new THREE.Color(meta.palette.dust);
  const cHii = new THREE.Color(meta.palette.hii);

  const barAngleRad = (meta.barAngleDeg || 0) * DEG2RAD;
  const cosBar = Math.cos(barAngleRad);
  const sinBar = Math.sin(barAngleRad);

  // 1. CAPAS VOLUMÉTRICAS CONTINUAS DE DISCO Y POLVO (Planos apilados en 3D con transparencia y extinción de polvo)
  const volumeTex = getGalaxyPhotographicVolumeTexture(galaxyKey);
  if (volumeTex) {
    const planeDiameter = radius * 2.15;
    const planeGeo = new THREE.PlaneGeometry(planeDiameter, planeDiameter);
    const layerOffsets =
      meta.family === 'dwarf-spheroidal'
        ? [
            { y: 0, opacity: 0.85, scale: 1.0, rotY: 0, additive: false },
            { y: radius * 0.06, opacity: 0.42, scale: 0.96, rotY: 0.03, additive: true },
            { y: -radius * 0.06, opacity: 0.42, scale: 0.96, rotY: -0.03, additive: true },
            { y: radius * 0.12, opacity: 0.22, scale: 0.90, rotY: 0.06, additive: true },
            { y: -radius * 0.12, opacity: 0.22, scale: 0.90, rotY: -0.06, additive: true },
          ]
        : [
            // Plano principal con NormalBlending para preservar el contraste oscuro de las bandas de polvo
            { y: 0, opacity: 0.95, scale: 1.0, rotY: 0, additive: false },
            // Capas intermedias del disco estelar grueso con espesor volumétrico tangible
            { y: radius * 0.035, opacity: 0.35, scale: 0.98, rotY: 0.015, additive: true },
            { y: -radius * 0.035, opacity: 0.35, scale: 0.98, rotY: -0.015, additive: true },
            // Capas del halo exterior estelar
            { y: radius * 0.075, opacity: 0.18, scale: 0.94, rotY: 0.03, additive: true },
            { y: -radius * 0.075, opacity: 0.18, scale: 0.94, rotY: -0.03, additive: true },
          ];

    layerOffsets.forEach((layer, idx) => {
      const mat = new THREE.MeshBasicMaterial({
        map: volumeTex,
        transparent: true,
        opacity: layer.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: layer.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = layer.rotY;
      mesh.position.y = layer.y;
      mesh.scale.setScalar(layer.scale);
      mesh.name = idx === 0 ? 'galaxy-volumetric-disk-primary' : `galaxy-volumetric-disk-layer-${idx}`;
      mesh.userData.nearbyGalaxyKey = galaxyKey;
      group.add(mesh);
    });
  }

  // 2. DISTRIBUCIÓN VOLUMÉTRICA SUAVE DEL BULBO Y BARRA CENTRAL (Cero esferas sólidas opacas)
  const bulgeGlowTex = getSoftBulgeGlowTexture() || glowTexture;
  if (meta.family === 'barred-spiral' || meta.family === 'magellanic-barred-irregular') {
    // Barra galáctica volumétrica compuesta por planos cruzados suaves con gradiente continuo (sin cilindros ni esferas)
    const barGroup = new THREE.Group();
    barGroup.name = 'galactic-central-bar';
    barGroup.rotation.y = -barAngleRad;
    barGroup.userData.nearbyGalaxyKey = galaxyKey;

    if (bulgeGlowTex) {
      const barPlaneGeo = new THREE.PlaneGeometry(radius * 0.64, radius * 0.28);
      const barPlaneMat = new THREE.MeshBasicMaterial({
        map: bulgeGlowTex,
        color: cCore,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const horizBar = new THREE.Mesh(barPlaneGeo, barPlaneMat);
      horizBar.rotation.x = -Math.PI / 2;
      const vertBar = new THREE.Mesh(barPlaneGeo, barPlaneMat);
      vertBar.scale.set(0.85, 0.55, 1);
      barGroup.add(horizBar, vertBar);
    }
    group.add(barGroup);
  } else if (meta.family !== 'dwarf-spheroidal' && meta.bulgeRatio > 0.18 && bulgeGlowTex) {
    // Bulbo volumétrico 3D suave (planos cruzados difusos, nunca una esfera sólida amarilla)
    const bulgeSpan = radius * meta.bulgeRatio * 1.55;
    const bulgeGeo = new THREE.PlaneGeometry(bulgeSpan, bulgeSpan * 0.58);
    const bulgeMat = new THREE.MeshBasicMaterial({
      map: bulgeGlowTex,
      color: cCore,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const b1 = new THREE.Mesh(bulgeGeo, bulgeMat);
    const b2 = new THREE.Mesh(bulgeGeo, bulgeMat);
    b2.rotation.y = Math.PI / 2;
    b1.name = 'volumetric-bulge-glow-x';
    b2.name = 'volumetric-bulge-glow-z';
    group.add(b1, b2);
  }

  // 3. NUBE TRIDIMENSIONAL DE POBLACIONES ESTELARES, REGIONES HII Y CORRIENTES DE MAREA
  const count = meta.family === 'barred-spiral' ? 1600 : meta.family === 'grand-spiral' ? 1400 : 1050;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const u = rng();
    let x = 0;
    let y = 0;
    let z = 0;
    const col = new THREE.Color();

    if (meta.family === 'dwarf-spheroidal') {
      // Enana de Sagitario (dSph/E7): corriente difusa orgánica gaussiana sin cortes rectangulares
      const gAlong = (rng() + rng() + rng() + rng() - 2.0); // Distribución gaussiana continua
      const along = gAlong * 0.72 * radius * 1.35;
      const taper = Math.exp(-Math.pow(along / (radius * 0.95), 2));
      const radialSpread = (0.07 + 0.21 * Math.pow(rng(), 0.75)) * radius * (0.65 + 0.35 * taper);
      const angle = rng() * Math.PI * 2;
      const arcZ = 0.16 * (along / radius) * along * 0.75;
      x = along;
      y = Math.sin(angle) * radialSpread * 0.65;
      z = Math.cos(angle) * radialSpread + arcZ;
      const rFrac = Math.min(1, Math.abs(along) / (radius * 1.15));
      col.copy(cCore).lerp(cOuter, rFrac * 0.85);
    } else if (meta.family === 'starburst-edge-on') {
      if (u < 0.58) {
        const along = (rng() - 0.5) * 2 * radius * 0.95;
        const radialWidth = (rng() - 0.5) * radius * 0.22 * (1 - Math.abs(along) / (radius * 1.1));
        x = along;
        y = (rng() - 0.5) * radius * 0.08;
        z = radialWidth;
        col.copy(cCore).lerp(cArms, Math.abs(along) / radius);
      } else {
        const signY = rng() < 0.5 ? 1 : -1;
        const h = (0.06 + Math.pow(rng(), 0.82) * 0.66) * radius;
        const coneRadius = h * (0.24 + rng() * 0.38);
        const ang = rng() * Math.PI * 2;
        x = Math.cos(ang) * coneRadius;
        y = signY * h;
        z = Math.sin(ang) * coneRadius;
        col.copy(cHii).lerp(cCore, Math.max(0, 1 - h / (radius * 0.65)));
      }
    } else if (meta.family === 'dwarf-irregular') {
      if (galaxyKey === 'ngc-6822' && u < 0.38) {
        const barT = (rng() - 0.5) * radius * 0.85;
        const barW = (rng() - 0.5) * radius * 0.18;
        x = barT * cosBar - barW * sinBar;
        z = barT * sinBar + barW * cosBar;
        y = (rng() - 0.5) * radius * 0.09;
        col.copy(cBar).lerp(cHii, rng() > 0.82 ? 0.65 : 0);
      } else {
        const clumpIdx = i % 5;
        const clumpAngle = clumpIdx * 1.25 + 0.4;
        const clumpDist = (0.15 + (clumpIdx / 5) * 0.55) * radius;
        const spread = (0.18 + rng() * 0.38) * radius;
        const a = rng() * Math.PI * 2;
        x =
          Math.cos(clumpAngle) * clumpDist +
          Math.cos(a) * spread * (galaxyKey === 'smc' ? 1.35 : 1);
        z = Math.sin(clumpAngle) * clumpDist * 0.72 + Math.sin(a) * spread * 0.75;
        y = (rng() - 0.5) * radius * 0.16;
        col.copy(cArms).lerp(rng() < 0.18 ? cHii : cOuter, rng());
      }
    } else if (meta.family === 'magellanic-barred-irregular') {
      if (u < 0.42) {
        const barL = (rng() - 0.5) * radius * 0.92;
        const barW = (rng() - 0.5) * radius * 0.19;
        x = barL * cosBar - barW * sinBar;
        z = barL * sinBar + barW * cosBar;
        y = (rng() - 0.5) * radius * 0.07;
        col.copy(cCore).lerp(cBar, Math.abs(barL) / (radius * 0.5));
      } else if (u < 0.86) {
        const r = (0.22 + Math.pow(rng(), 0.78) * 0.78) * radius;
        const theta = barAngleRad + (r / radius) * 3.1 + (rng() - 0.5) * 0.65;
        x = Math.cos(theta) * r;
        z = Math.sin(theta) * r;
        y = (rng() - 0.5) * radius * 0.08;
        col.copy(cArms).lerp(cOuter, r / radius);
      } else {
        const rDor = rng() * radius * 0.16;
        const aDor = rng() * Math.PI * 2;
        x = radius * 0.28 + Math.cos(aDor) * rDor;
        z = radius * 0.16 + Math.sin(aDor) * rDor;
        y = (rng() - 0.5) * radius * 0.06;
        col.copy(cHii).lerp(new THREE.Color('#ffffff'), 0.3);
      }
    } else {
      const hasBar = meta.family === 'barred-spiral' || meta.barAngleDeg > 0;
      const barFraction = meta.family === 'barred-spiral' ? 0.24 : hasBar ? 0.12 : 0;

      if (u < meta.bulgeRatio * 0.55) {
        // Bulbo volumétrico 3D con perfil Sersic suave
        const rb = Math.pow(rng(), 1.45) * radius * meta.bulgeRatio * 0.95;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        x = rb * Math.sin(ph) * Math.cos(th);
        y = rb * Math.cos(ph) * 0.36;
        z = rb * Math.sin(ph) * Math.sin(th);
        col.copy(cCore).lerp(cBar, rb / (radius * meta.bulgeRatio));
      } else if (u < meta.bulgeRatio * 0.55 + barFraction) {
        const barLen = radius * (meta.family === 'barred-spiral' ? 0.31 : 0.2);
        const along = (rng() - 0.5) * 2 * barLen;
        const perp = (rng() - 0.5) * barLen * 0.26 * (1 - Math.abs(along) / (barLen * 1.15));
        x = along * cosBar - perp * sinBar;
        z = along * sinBar + perp * cosBar;
        y = (rng() - 0.5) * radius * 0.042;
        col.copy(cCore).lerp(cBar, Math.abs(along) / barLen);
      } else {
        const arms = Math.max(2, meta.armCount || 2);
        const armIndex = i % arms;
        const rMin = hasBar ? radius * 0.2 : radius * 0.1;
        const r = rMin + Math.pow(rng(), 0.82) * (radius - rMin);
        const rNorm = r / radius;

        const m31RingPull =
          galaxyKey === 'm31' && rng() < 0.42 ? (0.62 - rNorm) * radius * 0.5 : 0;
        const rFinal = Math.max(rMin, r + m31RingPull);
        const rFinalNorm = rFinal / radius;

        const pitchCot =
          galaxyKey === 'milky-way'
            ? 4.35
            : galaxyKey === 'm31'
              ? 6.1
              : 2.8 / Math.max(0.24, meta.armTightness || 0.38);
        const baseAngle =
          barAngleRad +
          (armIndex / arms) * Math.PI * 2 -
          Math.log(Math.max(0.15, rFinalNorm) / 0.22) * pitchCot;
        const m101Asymmetry =
          galaxyKey === 'm101' && armIndex === 0 && rFinalNorm > 0.55 ? radius * 0.14 : 0;
        const scatter = (rng() - 0.5) * (0.18 + rFinalNorm * 0.26);
        const theta = baseAngle + scatter;

        x = Math.cos(theta) * (rFinal + m101Asymmetry);
        z = Math.sin(theta) * rFinal;
        y = (rng() - 0.5) * radius * 0.036 * (1 - rFinalNorm * 0.4);

        const isHiiKnot = rng() < meta.hiiKnotDensity * 0.18 && rFinalNorm > 0.24;
        if (isHiiKnot) {
          col.copy(cHii).lerp(new THREE.Color('#ffd6e8'), 0.28);
        } else {
          col.copy(cArms).lerp(cOuter, rFinalNorm * 0.85);
        }
      }

      if (galaxyKey === 'm31') {
        // Aplicar el escorzo de inclinación (~74°) y ángulo de posición (38°) de M31 a la nube 3D
        const zShort = z / 2.85;
        const pa = 38 * DEG2RAD;
        const cPa = Math.cos(pa);
        const sPa = Math.sin(pa);
        const rx = x * cPa - zShort * sPa;
        const rz = x * sPa + zShort * cPa;
        x = rx;
        z = rz;
      }
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    colors[i3] = col.r;
    colors[i3 + 1] = col.g;
    colors[i3 + 2] = col.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: Math.min(120, Math.max(0.18, radius * 0.017)),
      map: glowTexture || null,
      vertexColors: true,
      transparent: true,
      opacity: meta.family === 'dwarf-spheroidal' ? 0.62 : 0.54,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  points.userData.nearbyGalaxyKey = galaxyKey;
  group.add(points);

  // 4. RASGOS ESPECÍFICOS:
  // En M31 (Andrómeda), añadir sus galaxias satélites compañeras M32 y M110 (visibles en las fotografías reales de M31)
  if (galaxyKey === 'm31') {
    const satellitesGroup = new THREE.Group();
    satellitesGroup.name = 'm31-satellite-companions';
    satellitesGroup.userData.nearbyGalaxyKey = galaxyKey;

    const m32Sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: bulgeGlowTex || glowTexture || null,
        color: new THREE.Color('#fff2dc'),
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    m32Sprite.scale.set(radius * 0.22, radius * 0.19, 1);
    m32Sprite.position.set(-radius * 0.18, radius * 0.03, radius * 0.28);
    m32Sprite.name = 'm31-companion-m32';

    const m110Sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: bulgeGlowTex || glowTexture || null,
        color: new THREE.Color('#e8d8c0'),
        transparent: true,
        opacity: 0.74,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    m110Sprite.scale.set(radius * 0.34, radius * 0.18, 1);
    m110Sprite.position.set(radius * 0.28, -radius * 0.04, -radius * 0.42);
    m110Sprite.name = 'm31-companion-m110';

    satellitesGroup.add(m32Sprite, m110Sprite);
    group.add(satellitesGroup);
  }

  // En M82 (`starburst-edge-on`), añadir filamentos bicónicos de superviento H-alpha
  if (meta.family === 'starburst-edge-on') {
    const coneMat = new THREE.MeshBasicMaterial({
      color: cHii,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const upperCone = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.28, radius * 0.55, 18, 1, true),
      coneMat,
    );
    upperCone.position.y = radius * 0.28;
    upperCone.rotation.x = Math.PI;
    upperCone.name = 'm82-bipolar-outflow-north';
    upperCone.userData.nearbyGalaxyKey = galaxyKey;
    const lowerCone = upperCone.clone();
    lowerCone.position.y = -radius * 0.28;
    lowerCone.rotation.x = 0;
    lowerCone.name = 'm82-bipolar-outflow-south';
    lowerCone.userData.nearbyGalaxyKey = galaxyKey;
    group.add(upperCone, lowerCone);
  }

  // En la Vía Láctea, marcar sutilmente la posición del Espolón de Orión (~8.18 kpc del centro)
  if (galaxyKey === 'milky-way') {
    const orionSpurNode = new THREE.Group();
    orionSpurNode.name = 'milky-way-orion-spur-anchor';
    orionSpurNode.position.set(0, 0, radius * 0.52);
    orionSpurNode.userData.nearbyGalaxyKey = galaxyKey;
    group.add(orionSpurNode);
  }

  return group;
}

/**
 * Construye el disco volumétrico exterior de la Vía Láctea para `macroGalacticGroup` (escala `Vía Láctea` y Escena 4),
 * aportando la barra central de 28°, los 4 brazos espirales con carriles oscuros de polvo y regiones HII rosadas
 * de acuerdo con el modelo de Spitzer/Hurt (`sig05-010a-milky-way-bar`).
 */
export function buildMacroMilkyWayVolumetricDisk(macroRadius = 45000) {
  const group = new THREE.Group();
  group.name = 'macro-milky-way-volumetric-hurt-spitzer';
  const mwTex = getGalaxyPhotographicVolumeTexture('milky-way');
  const bulgeTex = getSoftBulgeGlowTexture();

  if (mwTex) {
    const diameter = macroRadius * 2.08;
    const planeGeo = new THREE.PlaneGeometry(diameter, diameter);
    const mainPlane = new THREE.Mesh(
      planeGeo,
      new THREE.MeshBasicMaterial({
        map: mwTex,
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    mainPlane.rotation.x = -Math.PI / 2;
    mainPlane.position.y = -40;
    group.add(mainPlane);

    const glowPlane = new THREE.Mesh(
      planeGeo,
      new THREE.MeshBasicMaterial({
        map: mwTex,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.y = 45;
    group.add(glowPlane);
  }

  if (bulgeTex) {
    const barGeo = new THREE.PlaneGeometry(macroRadius * 0.46, macroRadius * 0.16);
    const barMat = new THREE.MeshBasicMaterial({
      map: bulgeTex,
      color: new THREE.Color('#ffe5b8'),
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const barVert = new THREE.Mesh(barGeo, barMat);
    barVert.rotation.y = -28 * DEG2RAD;
    group.add(barVert);
  }

  return group;
}

/**
 * Oculta las esferas amarillas opacas heredadas (`SphereGeometry` con `#e8d2a5`) creadas por `makeAtlasGalaxy`
 * y reemplaza la apariencia de todas las galaxias en `nearbyGalaxyMarkers` y `missionMarkers`
 * con la reconstrucción volumétrica 3D de alta fidelidad.
 */
export function upgradeSceneGalaxiesWithMorphology({
  nearbyGalaxyMarkers,
  missionMarkers,
  missionMarkerEffects,
  stellarAtlas,
  regionalAtlas,
  macroGalacticGroup,
  atlasRadii,
  glowTexture = null,
} = {}) {
  const upgradedKeys = [];

  // 1. Actualizar marcadores de galaxias en `nearbyGalaxyMarkers` (Mapa de Galaxias Cercanas)
  if (nearbyGalaxyMarkers) {
    for (const [key, markerGroup] of nearbyGalaxyMarkers.entries()) {
      const meta = GALAXY_MORPHOLOGY_METADATA[key];
      if (!meta || !markerGroup) continue;
      const radius = atlasRadii?.get(key) || (key === 'milky-way' ? 22 : 9);

      // Localizar el grupo `model` creado por `makeAtlasGalaxy` y ocultar su esfera amarilla opaca (`SphereGeometry`)
      // y su nube de partículas genérica, preservando `solarSystemMapMarker` dentro de `galacticMapDisk`.
      const legacyModel = markerGroup.children.find(
        (ch) => ch.isGroup && !ch.userData?.isMorphologyLayer,
      );
      if (legacyModel) {
        legacyModel.children.forEach((child) => {
          if (child.userData?.isMorphologyLayer) return;
          // Preservar `solarSystemMapMarker` (es un Group hijo de galacticMapDisk)
          if (child.isGroup) {
            // Dentro de solarSystemMapMarker, atenuar/ocultar la esfera amarilla sólida del Sol si existe
            child.children.forEach((sub) => {
              if (sub.isMesh && sub.geometry?.type === 'SphereGeometry') {
                sub.scale.setScalar(0.45);
                if (sub.material) {
                  sub.material.color = new THREE.Color('#fff9f2');
                }
              }
            });
            return;
          }
          // Ocultar la esfera amarilla opaca (`core`) y los puntos genéricos de `makeAtlasGalaxy`
          if (child.isMesh || child.isPoints) {
            child.visible = false;
          }
        });
      }

      const targetParent = legacyModel || markerGroup;
      let morphLayer = targetParent.getObjectByName(`kronox-galaxy-morphology-${key}`);
      if (!morphLayer) {
        morphLayer = buildGalaxyMorphologyLayer3D(key, radius, glowTexture);
        if (morphLayer) {
          const rotX =
            key === 'milky-way'
              ? 0
              : key === 'm31'
                ? 0.42
                : Math.min(0.55, (meta.inclinationDeg || 0) * DEG2RAD * 0.45);
          const rotY = key === 'm31' || key === 'milky-way' ? 0 : (meta.positionAngleDeg || 0) * DEG2RAD;
          if (!legacyModel) {
            morphLayer.rotation.set(rotX, rotY, 0);
          } else if (key !== 'milky-way') {
            legacyModel.rotation.set(rotX, rotY, 0);
          }
          morphLayer.traverse((n) => {
            n.userData.nearbyGalaxyKey = key;
          });
          targetParent.add(morphLayer);
        }
      }
      markerGroup.userData.canonicalGalaxy = getCanonicalGalaxy(key);
      markerGroup.userData.morphologicalType = meta.morphologicalType;
      markerGroup.userData.provenance = getObjectProvenance(key);
      upgradedKeys.push(key);
    }
  }

  // 2. Actualizar objetivos de misión en `missionMarkers` (tanto galaxias M31/M101/SagDEG como estrellas Barnard/RW Aur/etc.)
  if (missionMarkers) {
    let effectIdx = 0;
    for (const [key, entry] of missionMarkers.entries()) {
      const markerGroup = entry?.marker;
      const effect = Array.isArray(missionMarkerEffects) ? missionMarkerEffects[effectIdx++] : null;
      if (!markerGroup) continue;

      if (GALAXY_MORPHOLOGY_METADATA[key]) {
        const meta = GALAXY_MORPHOLOGY_METADATA[key];
        // Forzar `ensureDetail()` para poder ocultar la esfera amarilla opaca de `makeAtlasGalaxy` dentro de `detail`
        if (effect && typeof effect.ensureDetail === 'function') {
          effect.ensureDetail();
        }
        const galRadius = effect?.radius || 3.0;
        const haloSprite = markerGroup.children.find((ch) => ch.isSprite);
        if (haloSprite && haloSprite.material) {
          haloSprite.material.opacity = 0.08; // Evitar que el halo circular tape la morfología espiral
        }
        const detailGroup = markerGroup.children.find(
          (ch) => ch.isGroup && !ch.userData?.isMorphologyLayer,
        );
        if (detailGroup) {
          // Ocultar el volumen genérico de `makeAtlasGalaxy` (con su esfera amarilla `#e8d2a5`) y todos sus hijos
          detailGroup.children.forEach((ch) => {
            if (!ch.userData?.isMorphologyLayer) {
              ch.visible = false;
              ch.traverse((sub) => {
                if (!sub.userData?.isMorphologyLayer) {
                  sub.visible = false;
                }
              });
            }
          });
        }

        const parentForMorph = detailGroup || markerGroup;
        let morphLayer = parentForMorph.getObjectByName(`kronox-galaxy-morphology-${key}`);
        if (!morphLayer) {
          morphLayer = buildGalaxyMorphologyLayer3D(key, galRadius, glowTexture);
          if (morphLayer) {
            morphLayer.rotation.set(
              (meta.inclinationDeg || 0) * DEG2RAD,
              (meta.positionAngleDeg || 0) * DEG2RAD,
              0,
            );
            morphLayer.traverse((node) => {
              node.userData.spherexTargetKey = key;
            });
            parentForMorph.add(morphLayer);
          }
        }
        markerGroup.userData.canonicalGalaxy = getCanonicalGalaxy(key);
        markerGroup.userData.morphologicalType = meta.morphologicalType;
        markerGroup.userData.provenance = getObjectProvenance(key);
      } else {
        enhancePhysicalStarMarker3D(markerGroup, key, glowTexture, effect);
      }
    }
  }

  // 3. Actualizar todas las estrellas de `stellarAtlas` y `regionalAtlas`
  if (stellarAtlas || regionalAtlas) {
    upgradeStellarAtlasesWithPhysicalStars([stellarAtlas, regionalAtlas].filter(Boolean));
  }

  // 4. Reconstruir `macroGalacticGroup` (Vía Láctea a escala galáctica) con el modelo Hurt/Spitzer
  // ocultando la línea circular naranja (`LineLoop`) y las nubes circulares uniformes que desdibujan la barra y brazos.
  if (macroGalacticGroup && !macroGalacticGroup.getObjectByName('macro-milky-way-volumetric-hurt-spitzer')) {
    macroGalacticGroup.children.forEach((child, idx) => {
      if (child.isLine || child.isLineLoop) {
        child.visible = false;
      } else if (child.isPoints) {
        // Conservar únicamente el marcador sutil del brazo de Orión (idx === 4) y ocultar las nubes circulares ruidosas
        if (idx !== 4) {
          child.visible = false;
        }
      }
    });
    const macroDisk = buildMacroMilkyWayVolumetricDisk(45000);
    // Añadir ancla sutil del Espolón de Orión (~8.18 kpc) sin apilar múltiples discos aditivos saturados
    const orionMarker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture || null,
        color: new THREE.Color('#7dd3fc'),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    orionMarker.name = 'milky-way-orion-spur-anchor';
    orionMarker.position.set(0, 120, 45000 * 0.52);
    orionMarker.scale.set(2200, 2200, 1);
    macroDisk.add(orionMarker);
    macroGalacticGroup.add(macroDisk);
  }

  return upgradedKeys;
}
