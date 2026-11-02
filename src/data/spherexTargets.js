const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MAS2RAD = DEG2RAD / 3600000;
const AU_YR_TO_KMS = 4.740470463533348;

// Default reference epoch for SPHEREx QR2/QR3 temporal sequences (mid-October 2025, J2025.8).
export const SPHEREX_REFERENCE_EPOCH = 2025.8;

/**
 * Converts a Modified Julian Date (MJD) to a Julian Epoch year (e.g., 2025.8).
 * J2000.0 corresponds to JD 2451545.0 = MJD 51544.5, with 365.25 days per Julian year.
 */
export function mjdToJulianYear(mjd) {
  const numericMjd = Number(mjd);
  if (!Number.isFinite(numericMjd)) return SPHEREX_REFERENCE_EPOCH;
  return 2000.0 + (numericMjd - 51544.5) / 365.25;
}

/**
 * Propagates celestial coordinates from a reference astrometric epoch to a target Julian year
 * using rigorous 3D spherical space-motion propagation (IAU SOFA / Hipparcos / Gaia standard),
 * accounting for proper motion (pmRa = mu_alpha * cos(delta), pmDec = mu_delta), parallax,
 * and perspective foreshortening from radial velocity when available.
 *
 * @param {object} astrometry - Reference astrometric parameters
 * @param {number} targetEpoch - Target Julian year (e.g., 2025.8) or MJD if > 30000
 * @returns {{ ra: number, dec: number, epoch: number, dtYears: number, shiftArcsec: number, dRaArcsec: number, dDecArcsec: number }}
 */
export function propagateCoordinates(astrometry, targetEpoch = SPHEREX_REFERENCE_EPOCH) {
  if (!astrometry || !Number.isFinite(astrometry.raRef) || !Number.isFinite(astrometry.decRef)) {
    return null;
  }
  const rawEpoch = Number(targetEpoch);
  const epoch =
    Number.isFinite(rawEpoch) && rawEpoch > 30000
      ? mjdToJulianYear(rawEpoch)
      : Number.isFinite(rawEpoch)
        ? rawEpoch
        : SPHEREX_REFERENCE_EPOCH;

  const refEpoch = Number(astrometry.epoch || 2000.0);
  const dt = epoch - refEpoch;

  const a0 = astrometry.raRef * DEG2RAD;
  const d0 = astrometry.decRef * DEG2RAD;
  const ca = Math.cos(a0);
  const sa = Math.sin(a0);
  const cd = Math.cos(d0);
  const sd = Math.sin(d0);

  // Unit position vector r0 and local celestial triad (p0 = East, q0 = North)
  const r0x = cd * ca;
  const r0y = cd * sa;
  const r0z = sd;

  const p0x = -sa;
  const p0y = ca;
  const p0z = 0;

  const q0x = -sd * ca;
  const q0y = -sd * sa;
  const q0z = cd;

  const muAlphaRadYr = Number(astrometry.pmRa || 0) * MAS2RAD;
  const muDeltaRadYr = Number(astrometry.pmDec || 0) * MAS2RAD;

  // Perspective foreshortening factor: zeta = (Vr [km/s] * parallax [mas]) / 4.740470463533348 [mas/yr]
  let zetaRadYr = 0;
  if (
    Number.isFinite(astrometry.parallaxMas) &&
    astrometry.parallaxMas > 0 &&
    Number.isFinite(astrometry.radialVelocityKms)
  ) {
    zetaRadYr = ((astrometry.radialVelocityKms * astrometry.parallaxMas) / AU_YR_TO_KMS) * MAS2RAD;
  }

  const radialScale = 1 + zetaRadYr * dt;
  const ux = r0x * radialScale + (p0x * muAlphaRadYr + q0x * muDeltaRadYr) * dt;
  const uy = r0y * radialScale + (p0y * muAlphaRadYr + q0y * muDeltaRadYr) * dt;
  const uz = r0z * radialScale + (p0z * muAlphaRadYr + q0z * muDeltaRadYr) * dt;

  const norm = Math.hypot(ux, uy, uz) || 1;
  const nx = ux / norm;
  const ny = uy / norm;
  const nz = Math.max(-1, Math.min(1, uz / norm));

  const ra = (((Math.atan2(ny, nx) * RAD2DEG) % 360) + 360) % 360;
  const dec = Math.asin(nz) * RAD2DEG;

  const cosAngle = Math.max(-1, Math.min(1, r0x * nx + r0y * ny + r0z * nz));
  const shiftArcsec = Math.acos(cosAngle) * RAD2DEG * 3600;
  let dRaDeg = ra - astrometry.raRef;
  if (dRaDeg > 180) dRaDeg -= 360;
  if (dRaDeg < -180) dRaDeg += 360;
  const dRaArcsec = dRaDeg * Math.cos(((dec + astrometry.decRef) * 0.5) * DEG2RAD) * 3600;
  const dDecArcsec = (dec - astrometry.decRef) * 3600;

  return {
    ra: Number(ra.toFixed(6)),
    dec: Number(dec.toFixed(6)),
    epoch: Number(epoch.toFixed(4)),
    dtYears: Number(dt.toFixed(4)),
    shiftArcsec: Number(shiftArcsec.toFixed(3)),
    dRaArcsec: Number(dRaArcsec.toFixed(3)),
    dDecArcsec: Number(dDecArcsec.toFixed(3)),
  };
}

export const SPHEREX_MISSION_TYPES = [
  {
    key: 'motion',
    title: 'Rastreo de estrellas',
    description: 'Sigue fuentes cercanas y busca desplazamientos frente al fondo estelar.',
    objective:
      'Descubre si una fuente cambia de posición con el tiempo y regístrala sobre el fondo de estrellas.',
    targetKeys: ['barnard', 'epsilon-indi-b', 'wise-0855'],
  },
  {
    key: 'variable',
    title: 'Estrellas variables',
    description: 'Compara observaciones y detecta cambios de brillo.',
    objective:
      'Compara las observaciones de esta estrella variable y registra cómo cambia su brillo entre fechas.',
    targetKeys: ['rw-aurigae', 'r-draconis'],
  },
];

const RAW_TARGETS = [
  {
    key: 'barnard',
    mission: 'motion',
    name: 'Estrella de Barnard',
    distanceLy: 5.96,
    distanceLabel: '≈ 6 años luz',
    note: 'Enana roja cercana con gran movimiento propio.',
    astrometry: {
      raRef: 269.448503,
      decRef: 4.73942,
      epoch: 2016.0,
      frame: 'ICRS',
      pmRa: -801.551,
      pmDec: 10362.394,
      parallaxMas: 546.9759,
      radialVelocityKms: -110.468,
      source: 'Gaia DR3 4472832130942575872',
      reference: 'Gaia Collaboration et al. (2023), A&A 674, A1',
    },
  },
  {
    key: 'epsilon-indi-b',
    mission: 'motion',
    name: 'Epsilon Indi B',
    distanceLy: 11.87,
    distanceLabel: '≈ 12 años luz',
    note: 'Sistema de dos enanas marrones: Ba y Bb.',
    astrometry: {
      raRef: 331.043833,
      decRef: -56.782694,
      epoch: 2000.0,
      frame: 'ICRS',
      pmRa: 3981.98,
      pmDec: -2466.83,
      parallaxMas: 270.66,
      radialVelocityKms: -40.4,
      source: '2MASS J22041052-5646577 / Gaia DR3 System',
      reference: 'Scholz et al. (2003), A&A 398, L29; McCaughrean et al. (2004); Chen et al. (2022)',
    },
  },
  {
    key: 'wise-0855',
    mission: 'motion',
    name: 'WISE 0855',
    distanceLy: 7.43,
    distanceLabel: '≈ 7,4 años luz',
    note: 'Enana marrón de rápido movimiento; coordenadas del reto.',
    challengeCoords: {
      raSexagesimal: '08h 55m 10.831s',
      decSexagesimal: '-07° 14\' 42.53"',
      ra: 133.795129,
      dec: -7.245147,
      epoch: 2010.4,
    },
    astrometry: {
      raRef: 133.795129,
      decRef: -7.245147,
      epoch: 2010.4,
      frame: 'ICRS',
      pmRa: -8123.7,
      pmDec: 673.2,
      parallaxMas: 439.0,
      radialVelocityKms: null,
      source: 'WISE J085510.83-071442.5 (CatWISE / Spitzer)',
      reference: 'Luhman (2014), ApJL 786, L18; Kirkpatrick et al. (2021), ApJS 253, 7',
    },
  },
  {
    key: 'rw-aurigae',
    mission: 'variable',
    name: 'RW Aurigae',
    distanceLy: 509,
    distanceLabel: '≈ 510 años luz',
    note: 'Sistema estelar joven y variable.',
    astrometry: {
      raRef: 76.956081,
      decRef: 30.401205,
      epoch: 2016.0,
      frame: 'ICRS',
      pmRa: 2.641,
      pmDec: -27.398,
      parallaxMas: 6.4062,
      radialVelocityKms: -20.937,
      source: 'Gaia DR3 156430822114424576',
      reference: 'Gaia Collaboration et al. (2023), A&A 674, A1',
    },
  },
  {
    key: 'r-draconis',
    mission: 'variable',
    name: 'R Draconis',
    distanceLy: 2600,
    distanceLabel: 'distancia aproximada',
    note: 'Estrella variable Mira de largo período.',
    astrometry: {
      raRef: 248.167378,
      decRef: 66.755007,
      epoch: 2016.0,
      frame: 'ICRS',
      pmRa: -20.643,
      pmDec: 6.149,
      parallaxMas: 1.2509,
      radialVelocityKms: -133.0,
      source: 'Gaia DR3 1648328016354496384',
      reference: 'Gaia Collaboration et al. (2023), A&A 674, A1',
    },
  },
];

export const SPHEREX_TARGETS = RAW_TARGETS.map((target) => {
  const propagated = propagateCoordinates(target.astrometry, SPHEREX_REFERENCE_EPOCH);
  return {
    ...target,
    ra: propagated.ra,
    dec: propagated.dec,
    referenceEpoch: SPHEREX_REFERENCE_EPOCH,
    propagated,
  };
});
