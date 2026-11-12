/**
 * KRONOX — ARQUITECTURA MODULAR PARA COMUNIDAD CIENTÍFICA Y CIENCIA CIUDADANA (ETAPA 6)
 *
 * Define los esquemas, entidades, niveles de privacidad y reglas epistémicas para
 * la futura plataforma de ciencia ciudadana de KRONOX, manteniendo una separación
 * estricta entre anotaciones personales de usuarios y datos astronómicos validados.
 */

import { OBSERVATION_VALIDATION_STATES } from './findingsStorage.js';

export const COMMUNITY_MODULE_STATUS = Object.freeze({
  id: 'kronox-citizen-science-network',
  version: '1.0.0-arch',
  readiness: 'PLANNED_ARCHITECTURE',
  label: 'Módulo en preparación arquitectónica · Ciencia Ciudadana KRONOX',
  summary:
    'Infraestructura de datos local y esquemas de federación listos. La sincronización en nube y revisión por pares comunitaria se encuentran en fase de despliegue planificado.',
});

export const PRIVACY_LEVELS = Object.freeze({
  PRIVATE_BY_DEFAULT: {
    id: 'PRIVATE_BY_DEFAULT',
    label: 'Privado por defecto (Almacenamiento local)',
    description: 'Las observaciones pertenecen exclusivamente al explorador hasta que decida publicarlas.',
  },
  SHARED_LINK: {
    id: 'SHARED_LINK',
    label: 'Enlace científico verificable',
    description: 'Accesible para colaboradores con referencia directa al recorte FITS/WCS original.',
  },
  PUBLIC_CITIZEN_SCIENCE: {
    id: 'PUBLIC_CITIZEN_SCIENCE',
    label: 'Red pública de Ciencia Ciudadana',
    description: 'Visible en colecciones comunitarias tras superar moderación y verificación de metadatos WCS.',
  },
});

/**
 * Esquemas modulares de entidades para la futura red científica (Sección 8.3).
 */
export const COMMUNITY_ENTITY_SCHEMAS = Object.freeze({
  ExplorerProfile: {
    entity: 'ExplorerProfile',
    title: 'Perfiles de Exploradores',
    status: 'READY_SCHEMA',
    description: 'Identidad del observador, historial de misiones SPHEREx e índice de rigor instrumental.',
    fields: ['explorerId', 'callsign', 'affiliation', 'registeredAt', 'validatedObservationsCount', 'privacyDefault'],
  },
  ScientificPublication: {
    entity: 'ScientificPublication',
    title: 'Publicaciones y Notas de Observación',
    status: 'READY_SCHEMA',
    description: 'Informes estructurados sobre candidatos variables o residuales vinculados a archivos FITS reales.',
    fields: ['publicationId', 'authorId', 'findingIds', 'targetId', 'abstract', 'epistemicStatus', 'createdAt'],
  },
  SharedObservation: {
    entity: 'SharedObservation',
    title: 'Observaciones Compartidas',
    status: 'READY_SCHEMA',
    description: 'Recortes astrométricos (RA/Dec, MJD, banda espectral λ, SNR) exportables y reproducibles.',
    fields: [
      'observationId',
      'ownerId',
      'astronomicalObject',
      'coordinates',
      'observationDate',
      'instrument',
      'spectralBand',
      'dataReference',
      'userNotes',
      'validationStatus',
      'privacyLevel',
    ],
  },
  ObservationComment: {
    entity: 'ObservationComment',
    title: 'Comentarios y Revisión por Pares',
    status: 'PLANNED_ENDPOINT',
    description: 'Discusión técnica acotada a fotometría de apertura, artefactos ópticos y astrometría WCS.',
    fields: ['commentId', 'observationId', 'authorId', 'technicalAssessment', 'flaggedAsArtifact', 'createdAt'],
  },
  CollaborativeMission: {
    entity: 'CollaborativeMission',
    title: 'Misiones Colaborativas',
    status: 'PLANNED_ENDPOINT',
    description: 'Campañas coordinadas de seguimiento multi-época sobre catálogos infrarrojos NASA SPHEREx.',
    fields: ['campaignId', 'title', 'targetCatalogIds', 'spectralBands', 'participantsCount', 'activeWindowUtc'],
  },
  ScientificCollection: {
    entity: 'ScientificCollection',
    title: 'Colecciones Científicas',
    status: 'READY_SCHEMA',
    description: 'Agrupaciones temáticas de hallazgos (enanas marrones, galaxias activas, transitorios).',
    fields: ['collectionId', 'curatorId', 'title', 'category', 'observationIds', 'validationPolicy'],
  },
  ModerationRecord: {
    entity: 'ModerationRecord',
    title: 'Moderación y Rigor Epistémico',
    status: 'PLANNED_ENDPOINT',
    description: 'Filtro de integridad que impide presentar anotaciones personales como descubrimientos oficiales sin validación.',
    fields: ['recordId', 'targetEntityId', 'reviewerId', 'verdict', 'epistemicBadgeAssigned', 'reviewedAt'],
  },
});

/**
 * Valida y empaqueta una observación personal para futura exportación comunitaria,
 * garantizando que nunca se marque como validada científicamente de forma automática.
 */
export function buildShareableObservationEnvelope(finding, options = {}) {
  if (!finding || typeof finding !== 'object') {
    throw new Error('Se requiere una observación válida para construir el paquete de exportación.');
  }

  return {
    schemaVersion: '1.0.0',
    entity: 'SharedObservation',
    privacyLevel: options.privacyLevel || PRIVACY_LEVELS.PRIVATE_BY_DEFAULT.id,
    epistemicGuarantee: {
      validationStatus: OBSERVATION_VALIDATION_STATES.PERSONAL_ANNOTATION,
      isOfficiallyValidated: false,
      disclaimer:
        'Anotación personal generada en KRONOX sobre datos públicos NASA/IPAC SPHEREx. No constituye confirmación astronómica oficial sin revisión por pares.',
    },
    payload: {
      ownerId: finding.ownerId || 'local-commander',
      astronomicalObject: finding.astronomicalObject || finding.targetLabel || finding.targetId,
      coordinates: finding.coordinates || {
        raDeg: finding.ra,
        decDeg: finding.dec,
        frame: 'ICRS',
      },
      observationDate: finding.observationDate || finding.mjd || null,
      instrument: finding.instrument || 'NASA SPHEREx Spectrophotometer',
      spectralBand: finding.spectralBand || finding.wavelengthUm || null,
      dataReference: finding.dataReference || {
        targetId: finding.targetId,
        pairId: finding.pairId,
      },
      userNotes: finding.userNotes || finding.notes || '',
      createdAt: finding.createdAt || new Date().toISOString(),
    },
  };
}

