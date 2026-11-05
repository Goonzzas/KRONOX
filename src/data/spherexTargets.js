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
    preferredBand: 'SPHEREx-D2',
    scientificStatus: 'VALIDADO',
    statusBadge: 'VALIDADO',
    scienceTypeLabel: 'Astrometría confirmada',
    coverageStatus: 'Cobertura parcial de detector (134×293 px en D2)',
    dataQuality: 'Alta (campo estelar denso, fondo homogéneo)',
    validationType: 'Astrometría confirmada',
    scientificLimitations:
      'Astrometría validada: desplazamiento predicho 5.60″, medido 4.98″, residuo 0.64″ (χ² = 0.58, p = 75%). Movimiento propio ultrarrápido (10.36″/año) visible nítidamente en Blink Comparator. Cobertura parcial en bordes del detector físico.',
    observationSummary:
      'Observaciones multi-época disponibles en SPHEREx D2 (QR2/QR3). Movimiento propio observable y consistente con Gaia DR3.',
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
    preferredBand: 'SPHEREx-D5',
    scientificStatus: 'SENSIBLE',
    statusBadge: 'PARCIAL',
    scienceTypeLabel: 'Binaria no resuelta',
    coverageStatus: 'Cobertura completa (D5/D6)',
    dataQuality: 'Moderada (binaria Ba/Bb no resuelta espacialmente)',
    validationType: 'Astrometría condicionada a jitter instrumental',
    scientificLimitations:
      'Validación astrométrica condicional: sistema binario Ba/Bb (separación ≈ 0.7″) no resuelto por la PSF (~6.6″). Bajo incertidumbres nominales puras (σ = 0.69″), χ² = 6.48 (p = 0.039 [3.9% < 5% para 2 DOF], compatibilidad estricta rechazada al 95% CL). Solo alcanza consistencia (p ≥ 5%) admitiendo jitter instrumental sistemático ≥ 0.20″ o modelado conjunto del baricentro.',
    observationSummary:
      'Detección en el infrarrojo cercano disponible en SPHEREx D5/D6. Centroide representa el baricentro del par no resuelto.',
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
    preferredBand: 'SPHEREx-D6',
    scientificStatus: 'WARNING',
    statusBadge: 'WARNING',
    scienceTypeLabel: 'WARNING: Sub-umbral',
    coverageStatus: 'Cobertura completa contigua (D6)',
    dataQuality: 'Crítica (ruido correlacionado, Época 1 sub-umbral)',
    validationType: 'Advertencia: no independiente en Época 1',
    scientificLimitations:
      'ADVERTENCIA CIENTÍFICA ESTRICTA:\n• Época 1 (2025W19): Régimen sub-umbral con SNR de apertura = 1.07 y SNR de pico = 1.40. La tasa de detección ciega global al 5% FPR en simulación es de apenas 4.4% (IC 95%: 3.3%–5.9%), indistinguible de ruido puro. El centroide medido experimenta un arrastre del 72.8% hacia el prior de CatWISE2020 (solo 27.2% de información de la fuente), por lo que NO constituye una detección estadística independiente.\n• Época 2 (2026W20): SNR de apertura = 4.04 y SNR de pico = 5.28. En simulaciones Monte Carlo presenta una completitud de detección del 61.0% (IC 95%: 57.9%–64.0%) y una recuperación astrométrica conjunta del 59.1% (no debe asumirse completitud ni fiabilidad superior).\n• Cierre astrométrico: El residuo medido de 3.07″ (1.05σ) requiere corrección diferencial de sesgo por truncamiento y prior forzado.',
    observationSummary:
      '2 épocas SPHEREx D6 disponibles (2025W19 y 2026W20). Época 1 es una posición forzada asistida por catálogo; Época 2 presenta detección a 61% de completitud.',
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
    preferredBand: 'SPHEREx-D1',
    scientificStatus: 'VALIDADO',
    statusBadge: 'VALIDADO',
    scienceTypeLabel: 'Variable T Tauri',
    coverageStatus: 'Cobertura completa (D1/D2)',
    dataQuality: 'Nominal (señal estelar nítida, acreción)',
    validationType: 'Fotometría variable validada',
    scientificLimitations:
      'Validación fotométrica confirmada: estrella binaria joven tipo T Tauri con eclipses ópticos y modulación infrarroja por discos circunestelares. Astrométricamente presenta residuo de 0.76″ (χ² = 2.26, p = 32%), consistente con variaciones del centro de brillo por acreción.',
    observationSummary:
      'Observaciones multi-época disponibles en SPHEREx D1/D2. Variabilidad infrarroja y consistencia fotométrica verificadas.',
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
    preferredBand: 'SPHEREx-D4',
    scientificStatus: 'FOTOMÉTRICO',
    statusBadge: 'FOTOMÉTRICO',
    scienceTypeLabel: 'Variable Mira (Astrometría N/A)',
    coverageStatus: 'Cobertura completa (D4)',
    dataQuality: 'Asimétrica (Época 1 desvanecida < 3σ, Época 2 > 1600 MJy/sr)',
    validationType: 'Fotometría validada / Astrometría no aplicable',
    scientificLimitations:
      'Validación fotométrica confirmada como variable gigante Mira (~245 días). Sin embargo, la validación astrométrica bi-época NO ES APLICABLE: en Época 1 (mínimo profundo), el flujo cayó a 0.45 MJy/sr (< 3σ de cielo ≈ 1.50 MJy/sr), quedando completamente desvanecida / no detectada, imposibilitando medir centroide o desplazamiento.',
    observationSummary:
      'Observaciones temporales SPHEREx D4. Dipolo extremo en sustracción diferencial D = I₂ − αI₁ − B debido al desvanecimiento en Época 1 y brillo máximo en Época 2.',
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
