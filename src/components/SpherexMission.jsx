import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  assessPhotometricComparability,
  parseFits,
  SPHEREX_DETECTOR_SPECS,
} from '../utils/fitsImage.js';
import {
  propagateCoordinates,
  SPHEREX_MISSION_TYPES,
  SPHEREX_REFERENCE_EPOCH,
  SPHEREX_TARGETS as TARGETS,
} from '../data/spherexTargets.js';
import {
  computeDifferentialImage,
  detectDifferentialCandidates,
  renderDivergingColormap,
} from '../utils/differentialImaging.js';
import {
  loadFindingsFromStorage,
  saveFindingsToStorage,
  deleteFindingFromStorage,
  createFindingRecord,
} from '../utils/findingsStorage.js';
import { t } from '../i18n.js';

const Icons = {
  Telescope: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 9v6" />
      <path d="M9 12h6" />
      <path d="m20 20-3-3" />
    </svg>
  ),
  Timeline: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Blink: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  SideBySide: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  ),
  Differential: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  ),
  Candidates: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  ),
  Bookmark: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Trash: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Warning: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Check: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Info: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Help: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Play: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  StepBack: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  ),
  StepForward: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  ),
  ZoomIn: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  ZoomOut: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  ZoomReset: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  Expand: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  ),
  Close: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Tune: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  ChevronDown: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Compass: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
};


const BAND_SPECS_BY_NAME = Object.fromEntries(
  Object.values(SPHEREX_DETECTOR_SPECS).map((spec) => [spec.band, spec]),
);

const BAND_DESCRIPTIONS = {
  'SPHEREx-D1': 'Infrarrojo cercano (0.75–1.09 μm)',
  'SPHEREx-D2': 'Infrarrojo cercano (1.10–1.62 μm)',
  'SPHEREx-D3': 'Infrarrojo de longitud media (1.63–2.40 μm)',
  'SPHEREx-D4': 'Infrarrojo medio (2.41–3.56 μm)',
  'SPHEREx-D5': 'Infrarrojo medio-largo (3.57–4.54 μm)',
  'SPHEREx-D6': 'Infrarrojo térmico (4.55–5.00 μm)',
};

function formatBandLabel(bandName, complexity = 'essential') {
  const spec = BAND_SPECS_BY_NAME[bandName];
  if (!spec) return bandName;
  if (complexity === 'essential') {
    const desc = BAND_DESCRIPTIONS[bandName] || 'Infrarrojo';
    return `${bandName.replace('SPHEREx-', 'Banda ')} · ${desc}`;
  }
  return `${bandName} (${spec.minUm.toFixed(2)}–${spec.maxUm.toFixed(2)} μm)`;
}

function formatDate(mjd, language = 'es') {
  const date = new Date((Number(mjd) - 40587) * 86400000);
  return Number.isNaN(date.getTime())
    ? 'Fecha desconocida'
    : date.toLocaleString(language === 'en' ? 'en-US' : 'es', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }) + ' UTC';
}

function imagePoint(event) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const stage = el.parentElement;
  const stageRect = stage?.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !stageRect?.width || !stageRect?.height) return null;

  // <img> can fill a landscape viewport while object-fit: contain draws a
  // square FITS image in its center. Ignore the letterboxed area when mapping
  // clicks to detector pixels, but keep marker coordinates relative to stage.
  const naturalRatio = el.naturalWidth / el.naturalHeight || rect.width / rect.height;
  const boxRatio = rect.width / rect.height;
  const contentWidth = naturalRatio > boxRatio ? rect.width : rect.height * naturalRatio;
  const contentHeight = naturalRatio > boxRatio ? rect.width / naturalRatio : rect.height;
  const contentLeft = rect.left + (rect.width - contentWidth) / 2;
  const contentTop = rect.top + (rect.height - contentHeight) / 2;
  const imageX = (event.clientX - contentLeft) / contentWidth;
  const imageY = (event.clientY - contentTop) / contentHeight;
  if (imageX < 0 || imageX > 1 || imageY < 0 || imageY > 1) return null;

  return {
    imageX,
    imageY,
    x: ((event.clientX - stageRect.left) / stageRect.width) * 100,
    y: ((event.clientY - stageRect.top) / stageRect.height) * 100,
  };
}

function SkyReticle({ imageCenter, predictedMarker, language }) {
  return (
    <>
      <div
        className="spherexReticle"
        aria-label={`${t('Coordenada de referencia', language)}: RA ${imageCenter.ra.toFixed(4)}°, Dec ${imageCenter.dec.toFixed(4)}°`}
        title={`${t('Centro fijo de la secuencia', language)} (J${SPHEREX_REFERENCE_EPOCH}): RA ${imageCenter.ra.toFixed(4)}°, Dec ${imageCenter.dec.toFixed(4)}°`}
      >
        <span className="spherexReticleRing" />
        <i className="spherexReticleTick north" />
        <i className="spherexReticleTick south" />
        <i className="spherexReticleTick east" />
        <i className="spherexReticleTick west" />
      </div>
      {predictedMarker && (
        <span
          className="spherexEpochTarget"
          style={{ left: `${predictedMarker.xPercent}%`, top: `${predictedMarker.yPercent}%` }}
          title={`${t('Posición astrométrica propagada', language)} (${predictedMarker.epochField} ${predictedMarker.mjdUsed.toFixed(5)} · J${predictedMarker.epoch.toFixed(3)}): RA ${predictedMarker.ra.toFixed(4)}°, Dec ${predictedMarker.dec.toFixed(4)}°`}
        />
      )}
    </>
  );
}

export default function SpherexMission({ onClose, initialTargetKey = 'barnard', language = 'es' }) {
  const [navParams] = useState(() => {
    try {
      return typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    } catch {
      return null;
    }
  });
  const effectiveTargetKey = navParams?.get('target') || initialTargetKey;
  const initialTargetIndex = Math.max(
    0,
    TARGETS.findIndex((target) => target.key === effectiveTargetKey),
  );
  const initialTarget = TARGETS[initialTargetIndex];
  const [selected, setSelected] = useState(initialTargetIndex);
  const [ra, setRa] = useState(String(initialTarget.ra));
  const [dec, setDec] = useState(String(initialTarget.dec));
  // Fixed sky-grid reference coordinate across the entire temporal sequence
  const [imageCenter, setImageCenter] = useState({ ra: initialTarget.ra, dec: initialTarget.dec });
  const [records, setRecords] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [frameLoading, setFrameLoading] = useState(false);
  const urlViewMode = navParams?.get('view');
  const validModes = ['single', 'blink', 'sideBySide', 'differential', 'candidates'];
  const initialViewMode = validModes.includes(urlViewMode) ? urlViewMode : 'single';
  const [playing, setPlaying] = useState(initialViewMode === 'blink');
  const [error, setError] = useState('');
  const [status, setStatus] = useState(
    'Elige un objetivo o introduce coordenadas y consulta el archivo.',
  );
  // Default to combined QR2 + QR3 search so users access the full multi-epoch timeline without losing QR2 coverage
  const [release, setRelease] = useState('all');
  const [band, setBand] = useState('');
  const [zodiMode, setZodiMode] = useState('subtracted');
  const [flagPolicy, setFlagPolicy] = useState('measurement');
  const [image, setImage] = useState('');
  const [frameDiagnostics, setFrameDiagnostics] = useState(null);
  const [compareEnabled, setCompareEnabled] = useState(['sideBySide', 'differential', 'candidates'].includes(initialViewMode));
  const [compareIndex, setCompareIndex] = useState(1);
  const [compareImage, setCompareImage] = useState('');
  const [compareDiagnostics, setCompareDiagnostics] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [primaryImageRatio, setPrimaryImageRatio] = useState(1);
  const [compareImageRatio, setCompareImageRatio] = useState(1);
  const [marking, setMarking] = useState(false);
  const [marker, setMarker] = useState(null);
  const [findingNote, setFindingNote] = useState('');
  const [findings, setFindings] = useState(() => loadFindingsFromStorage());
  const [findingToast, setFindingToast] = useState('');
  const [findingError, setFindingError] = useState('');
  const [showFindingForm, setShowFindingForm] = useState(false);

  useEffect(() => {
    saveFindingsToStorage(findings);
  }, [findings]);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  // Phase 2: View Modes, Blink Comparator, Side-by-Side & Differential Imaging
  const [viewMode, setViewMode] = useState(initialViewMode); // 'single' | 'blink' | 'sideBySide' | 'differential' | 'candidates'
  const [blinkSpeed, setBlinkSpeed] = useState(600); // ms per frame in blink mode
  const [blinkLoop, setBlinkLoop] = useState(true);
  const [blinkFrameList, setBlinkFrameList] = useState([]); // indices included in blink rotation
  const [blinkType, setBlinkType] = useState('twoEpochs'); // 'twoEpochs' | 'all'
  const [blinkEpochToggle, setBlinkEpochToggle] = useState(false);
  const [candidateCategoryFilter, setCandidateCategoryFilter] = useState('all');
  const [syncZoom, setSyncZoom] = useState(1.0);
  const [syncPan, setSyncPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Phase 2: Differential Imaging options & state
  const [diffMode, setDiffMode] = useState('diff'); // 'diff' | 'snr'
  const [diffThreshold, setDiffThreshold] = useState(4.0); // sigma cutoff
  const [forceAlpha1, setForceAlpha1] = useState(false); // forced alpha = 1.0 vs auto robust
  const [diffDataUrl, setDiffDataUrl] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [complexityLevel, setComplexityLevel] = useState(() => (navParams?.get('complexity') === 'technical' ? 'technical' : 'essential')); // 'essential' | 'technical'
  const [showTechDetailsModal, setShowTechDetailsModal] = useState(navParams?.get('audit') === 'true');
  const [showHelpModal, setShowHelpModal] = useState(navParams?.get('help') === 'true');

  const requestRef = useRef(0);
  const compareRequestRef = useRef(0);
  const searchRef = useRef(0);
  // Keep a stable display stretch per detector. A single stretch shared across
  // all six infrared bands can make valid frames look almost black.
  const stretchByBandRef = useRef(new Map());
  const frameCacheRef = useRef(new Map()); // local LRU in-memory cache for parsed FITS

  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  const bands = useMemo(() => [...new Set(records.map((record) => record.band))].sort(), [records]);
  const visibleRecords = useMemo(
    () => (band ? records.filter((record) => record.band === band) : records),
    [records, band],
  );
  const frame = visibleRecords[frameIndex];
  const previousFrame = visibleRecords[frameIndex - 1];
  const compareFrame = visibleRecords[compareIndex];

  // Initialize or synchronize blink frame playlist whenever visible records change
  useEffect(() => {
    if (visibleRecords.length > 0) {
      setBlinkFrameList(visibleRecords.map((_, i) => i));
      if (
        visibleRecords.length > 1 &&
        (compareIndex === frameIndex || compareIndex >= visibleRecords.length)
      ) {
        setCompareIndex(frameIndex === visibleRecords.length - 1 ? 0 : visibleRecords.length - 1);
      }
    } else {
      setBlinkFrameList([]);
    }
  }, [visibleRecords, frameIndex, compareIndex]);

  const search = async (nextRa = ra, nextDec = dec, nextRelease = release) => {
    const searchId = ++searchRef.current;
    // Lock the common WCS sky-grid center once for the whole observation sequence
    setImageCenter({ ra: Number(nextRa), dec: Number(nextDec) });
    stretchByBandRef.current.clear();
    frameCacheRef.current.clear();
    setLoading(true);
    setError('');
    setImage('');
    setFrameDiagnostics(null);
    setFrameLoading(false);
    setRecords([]);
    setFrameIndex(0);
    setBand('');
    setPlaying(false);
    setCompareIndex(1);
    setCompareImage('');
    setCompareDiagnostics(null);
    setCompareEnabled(false);
    setDiffDataUrl('');
    setSelectedCandidate(null);
    setStatus('Consultando las observaciones públicas de IRSA…');
    try {
      const response = await fetch(
        `/api/spherex?action=search&ra=${encodeURIComponent(nextRa)}&dec=${encodeURIComponent(nextDec)}&release=${encodeURIComponent(nextRelease)}`,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falló la consulta al archivo.');
      if (searchId !== searchRef.current) return;
      const unique = new Map();
      for (const record of body.records) {
        const key = `${record.id}|${record.band}`;
        const prev = unique.get(key);
        if (!prev || Number(record.priorityScore || 0) >= Number(prev.priorityScore || 0)) {
          unique.set(key, record);
        }
      }
      const sorted = [...unique.values()].sort(
        (a, b) => Number(a.dateAvg || a.date) - Number(b.dateAvg || b.date),
      );
      setRecords(sorted);
      // Start with every returned observation visible. Users can narrow to one
      // detector when they want scientifically comparable epochs.
      setBand('');
      if (sorted.length > 1) {
        setCompareIndex(sorted.length - 1);
      }
      setTruncated(body.truncated);
      const resultStatus = sorted.length
        ? `Se encontraron ${sorted.length} imágenes en ${new Set(sorted.map((row) => new Date((Number(row.dateAvg || row.date) - 40587) * 86400000).toISOString().slice(0, 10))).size} días distintos.`
        : 'No hay imágenes SPHEREx disponibles para estas coordenadas en este lanzamiento.';
      const partialWarning = body.partial
        ? language === 'en'
          ? ` Warning: IRSA did not respond for ${body.failedCollections.join(', ')}; this timeline may be incomplete.`
          : ` Aviso: IRSA no respondió para ${body.failedCollections.join(', ')}; la línea de tiempo puede estar incompleta.`
        : '';
      setStatus(`${resultStatus}${partialWarning}`);
    } catch (cause) {
      if (searchId === searchRef.current) {
        setError(cause.message);
        setStatus('No se pudo completar la consulta.');
      }
    } finally {
      if (searchId === searchRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    search(ra, dec, release);
    // Load the first target as soon as Kronox arrives at the observatory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseTarget = (index) => {
    setSelected(index);
    setRa(String(TARGETS[index].ra));
    setDec(String(TARGETS[index].dec));
    stretchByBandRef.current.clear();
    frameCacheRef.current.clear();
    setRecords([]);
    setImage('');
    setFrameDiagnostics(null);
    setFrameLoading(false);
    setPlaying(false);
    setDiffDataUrl('');
    setSelectedCandidate(null);
    setStatus(`Buscando observaciones de ${TARGETS[index].name}…`);
    search(String(TARGETS[index].ra), String(TARGETS[index].dec), release);
  };

  // Helper to retrieve or fetch a parsed FITS frame from cache
  const loadParsedFrame = async (record, tokenRef, currentToken) => {
    const cacheKey = `${record.url}|${imageCenter.ra},${imageCenter.dec}|${zodiMode}|${flagPolicy}`;
    if (frameCacheRef.current.has(cacheKey)) {
      return frameCacheRef.current.get(cacheKey);
    }
    const params = new URLSearchParams({
      action: 'frame',
      url: record.url,
      center: `${imageCenter.ra},${imageCenter.dec}`,
    });
    const response = await fetch(`/api/spherex?${params}`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'No se pudo abrir el recorte.');
    }
    const buffer = await response.arrayBuffer();
    if (tokenRef.current !== currentToken) return null;
    const fixedRange = stretchByBandRef.current.get(record.band) || null;
    const rendered = parseFits(buffer, fixedRange, imageCenter, {
      zodiMode,
      flagPolicy,
    });
    if (!stretchByBandRef.current.has(record.band)) {
      stretchByBandRef.current.set(record.band, rendered.range);
    }
    frameCacheRef.current.set(cacheKey, rendered);
    return rendered;
  };

  // Load Primary / Frame A
  useEffect(() => {
    if (!visibleRecords.length) {
      setImage('');
      setFrameDiagnostics(null);
      setFrameLoading(false);
      return undefined;
    }
    const record = visibleRecords[Math.min(frameIndex, visibleRecords.length - 1)];
    if (!record) return undefined;
    const token = ++requestRef.current;
    setFrameLoading(true);
    setError('');
    // Do not leave the previous epoch on screen while this FITS frame loads;
    // otherwise the selected date changes while the image still looks stale.
    setImage('');
    setFrameDiagnostics(null);

    loadParsedFrame(record, requestRef, token)
      .then((rendered) => {
        if (!rendered || token !== requestRef.current) return;
        setImage(rendered.src);
        setFrameDiagnostics({
          band: record.band,
          release: record.release,
          pipelineVersion: record.pipelineVersion,
          spectral: rendered.spectral,
          temporal: rendered.temporal,
          detector: rendered.detector,
          extensions: rendered.extensions,
          reprojected: rendered.reprojected,
          scientificPixels: rendered.scientificPixels,
          rawVariancePixels: rendered.rawVariancePixels,
          rawFlagsPixels: rendered.rawFlagsPixels,
          width: rendered.width,
          height: rendered.height,
        });
      })
      .catch((cause) => {
        if (token === requestRef.current) setError(cause.message);
      })
      .finally(() => {
        if (token === requestRef.current) setFrameLoading(false);
      });

    return () => {
      requestRef.current++;
    };
  }, [visibleRecords, frameIndex, imageCenter, zodiMode, flagPolicy]);

  // Load Compare / Frame B
  useEffect(() => {
    const isCompareActive =
      compareEnabled ||
      viewMode === 'sideBySide' ||
      viewMode === 'differential' ||
      viewMode === 'candidates' ||
      (viewMode === 'blink' && blinkType === 'twoEpochs');
    if (!isCompareActive || !image || !compareFrame) {
      setCompareImage('');
      setCompareDiagnostics(null);
      setCompareLoading(false);
      return undefined;
    }
    if (compareIndex === frameIndex) {
      if (visibleRecords.length > 1) {
        setCompareIndex(frameIndex === visibleRecords.length - 1 ? 0 : visibleRecords.length - 1);
      } else {
        setCompareImage('');
        setCompareDiagnostics(null);
        setCompareLoading(false);
      }
      return undefined;
    }
    const token = ++compareRequestRef.current;
    setCompareLoading(true);

    loadParsedFrame(compareFrame, compareRequestRef, token)
      .then((rendered) => {
        if (!rendered || token !== compareRequestRef.current) return;
        setCompareImage(rendered.src);
        setCompareDiagnostics({
          band: compareFrame.band,
          release: compareFrame.release,
          pipelineVersion: compareFrame.pipelineVersion,
          spectral: rendered.spectral,
          temporal: rendered.temporal,
          detector: rendered.detector,
          extensions: rendered.extensions,
          reprojected: rendered.reprojected,
          scientificPixels: rendered.scientificPixels,
          rawVariancePixels: rendered.rawVariancePixels,
          rawFlagsPixels: rendered.rawFlagsPixels,
          width: rendered.width,
          height: rendered.height,
        });
      })
      .catch((cause) => {
        if (token === compareRequestRef.current) setError(cause.message);
      })
      .finally(() => {
        if (token === compareRequestRef.current) setCompareLoading(false);
      });

    return () => {
      compareRequestRef.current++;
    };
  }, [
    compareEnabled,
    viewMode,
    blinkType,
    compareFrame,
    compareIndex,
    frameIndex,
    image,
    imageCenter,
    visibleRecords.length,
    zodiMode,
    flagPolicy,
  ]);

  // Playback Timer for Sequence and Blink Comparator
  useEffect(() => {
    if (!playing || frameLoading) return undefined;
    const isBlinkMode = viewMode === 'blink';

    // Two-epoch instant alternation (astrometric blink comparator)
    if (isBlinkMode && blinkType === 'twoEpochs') {
      if (visibleRecords.length < 2) return undefined;
      const timer = setTimeout(() => {
        setBlinkEpochToggle((prev) => !prev);
      }, blinkSpeed);
      return () => clearTimeout(timer);
    }
    const activePlaylist =
      isBlinkMode && blinkFrameList.length >= 2
        ? blinkFrameList
        : visibleRecords.map((_, i) => i);
    if (activePlaylist.length < 2) return undefined;

    const delay = isBlinkMode ? blinkSpeed : 1200;
    const timer = setTimeout(() => {
      setFrameIndex((currentIdx) => {
        const playlistPos = activePlaylist.indexOf(currentIdx);
        if (playlistPos === -1) return activePlaylist[0];
        const nextPos = playlistPos + 1;
        if (nextPos >= activePlaylist.length) {
          if (!blinkLoop && isBlinkMode) {
            setPlaying(false);
            return currentIdx;
          }
          return activePlaylist[0];
        }
        return activePlaylist[nextPos];
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [playing, frameLoading, viewMode, blinkSpeed, blinkLoop, blinkFrameList, visibleRecords, frameIndex, blinkType, blinkEpochToggle]);

  const step = (amount) => {
    const isBlinkMode = viewMode === 'blink';

    // Two-epoch instant alternation (astrometric blink comparator)
    if (isBlinkMode && blinkType === 'twoEpochs') {
      setBlinkEpochToggle((prev) => !prev);
      return;
    }
    const activePlaylist =
      isBlinkMode && blinkFrameList.length >= 2
        ? blinkFrameList
        : visibleRecords.map((_, i) => i);
    if (!activePlaylist.length) return;
    const curPos = activePlaylist.indexOf(frameIndex);
    const newPos =
      curPos === -1
        ? 0
        : (curPos + amount + activePlaylist.length) % activePlaylist.length;
    setFrameIndex(activePlaylist[newPos]);
  };

  const selectedTarget = TARGETS[selected];
  const missionObjective = t(
    SPHEREX_MISSION_TYPES.find((mission) => mission.key === selectedTarget.mission)?.objective ||
      '',
    language,
  );

  // Check if the current fixed sky-grid center matches the selected preset target
  const isPresetCenterActive =
    Math.abs(imageCenter.ra - selectedTarget.ra) < 1e-3 &&
    Math.abs(imageCenter.dec - selectedTarget.dec) < 1e-3;

  // Compute epoch markers using MJD-AVG
  const computeEpochMarker = (record, diagnostics) => {
    if (!isPresetCenterActive || !selectedTarget.astrometry || !record || !diagnostics?.reprojected)
      return null;
    const mjdUsed = Number(
      diagnostics.temporal?.mjdAvg ??
        diagnostics.temporal?.mjdObs ??
        record.dateAvg ??
        record.date,
    );
    const epochField = diagnostics.temporal?.astrometricEpochField || 'MJD-AVG';
    const prop = propagateCoordinates(selectedTarget.astrometry, mjdUsed);
    if (!prop) return null;
    const gridPos = diagnostics.reprojected.worldToGrid(prop.ra, prop.dec);
    if (
      !gridPos ||
      gridPos.xPercent < 0 ||
      gridPos.xPercent > 100 ||
      gridPos.yPercent < 0 ||
      gridPos.yPercent > 100
    )
      return null;
    return {
      ...prop,
      mjdUsed,
      epochField,
      xPercent: gridPos.xPercent,
      yPercent: gridPos.yPercent,
    };
  };

  const primaryEpochMarker = computeEpochMarker(frame, frameDiagnostics);
  const compareEpochMarker = computeEpochMarker(compareFrame, compareDiagnostics);

  const comparability = useMemo(
    () =>
      frameDiagnostics && compareDiagnostics
        ? assessPhotometricComparability(frameDiagnostics, compareDiagnostics)
        : null,
    [frameDiagnostics, compareDiagnostics],
  );

  // Phase 2: Compute Differential Image and Candidates
  const diffResult = useMemo(() => {
    if (
      (viewMode !== 'differential' && viewMode !== 'candidates') ||
      !frameDiagnostics?.scientificPixels ||
      !compareDiagnostics?.scientificPixels
    ) {
      return null;
    }
    try {
      return computeDifferentialImage(frameDiagnostics, compareDiagnostics, {
        manualAlpha: forceAlpha1 ? 1.0 : undefined,
        manualBackground: forceAlpha1 ? 0.0 : undefined,
      });
    } catch (err) {
      console.warn('Differential image calculation error:', err);
      return null;
    }
  }, [viewMode, frameDiagnostics, compareDiagnostics, forceAlpha1]);

  // Render Diverging Colormap Canvas
  useEffect(() => {
    if (!diffResult) {
      setDiffDataUrl('');
      return;
    }
    const pixels = diffMode === 'snr' ? diffResult.snrPixels : diffResult.diffPixels;
    const url = renderDivergingColormap(pixels, diffResult.width, diffResult.height, {
      threshold: diffThreshold,
      isSnrMode: diffMode === 'snr',
    });
    setDiffDataUrl(url);
  }, [diffResult, diffMode, diffThreshold]);

  // Detect candidates in differential image
  const candidates = useMemo(() => {
    if (!diffResult || (viewMode !== 'differential' && viewMode !== 'candidates')) return [];
    return detectDifferentialCandidates(
      diffResult,
      frameDiagnostics,
      compareDiagnostics,
      selectedTarget,
      {
        propagateCoordinatesFn: true,
        propagateCoordinates,
        snrThreshold: diffThreshold,
      },
    );
  }, [diffResult, viewMode, frameDiagnostics, compareDiagnostics, selectedTarget, diffThreshold]);

  // Computed Temporal Delta & Baseline Helpers
  const timeDeltaDays = useMemo(() => {
    if (!frame || !compareFrame) return null;
    const d1 = Number(frame.dateAvg || frame.date);
    const d2 = Number(compareFrame.dateAvg || compareFrame.date);
    if (!Number.isFinite(d1) || !Number.isFinite(d2)) return null;
    return Math.abs(d2 - d1);
  }, [frame, compareFrame]);

  const selectMaxSeparation = () => {
    if (visibleRecords.length < 2) return;
    setFrameIndex(0);
    setCompareIndex(visibleRecords.length - 1);
  };

  const swapCompareFrames = () => {
    if (visibleRecords.length < 2) return;
    const prev = frameIndex;
    setFrameIndex(compareIndex);
    setCompareIndex(prev);
  };

  const handleFitImage = () => {
    setSyncZoom(1.0);
    setSyncPan({ x: 0, y: 0 });
  };

  // Rigorous 4-Category Candidate Grouping
  const candidateCategories = useMemo(() => {
    const groups = {
      all: candidates,
      candidates: [],
      variables: [],
      moving: [],
      artifacts: [],
    };
    for (const c of candidates) {
      if (c.taxonomyType === 'KNOWN_OBJECT_MATCH') {
        groups.candidates.push(c);
      } else if (
        c.taxonomyType === 'INSTRUMENTAL_ARTIFACT' ||
        c.confidence === 'ARTIFACT' ||
        c.dataQuality === 'POOR' ||
        c.taxonomyType === 'TRANSIENT_ANOMALY' ||
        c.confidence === 'SUSPECT_ANOMALY'
      ) {
        groups.artifacts.push(c);
      } else if (
        c.taxonomyType === 'MOVING_OBJECT_CANDIDATE' ||
        c.subType === 'PROPER_MOTION_DIPOLE'
      ) {
        groups.moving.push(c);
      } else if (
        c.taxonomyType === 'VARIABLE_SOURCE_CANDIDATE' ||
        c.subType === 'VARIABLE_BRIGHTENED' ||
        c.subType === 'VARIABLE_DIMMED'
      ) {
        groups.variables.push(c);
      } else {
        groups.candidates.push(c);
      }
    }
    return groups;
  }, [candidates]);

  const activeCandidates = useMemo(() => {
    return candidateCategories[candidateCategoryFilter] || candidates;
  }, [candidateCategories, candidateCategoryFilter, candidates]);

  // Synchronized Pan and Zoom handlers
  const handleZoom = (delta) => {
    setSyncZoom((z) => Math.max(1.0, Math.min(5.0, Number((z + delta).toFixed(2)))));
  };
  const resetZoom = () => {
    setSyncZoom(1.0);
    setSyncPan({ x: 0, y: 0 });
  };
  const handleMouseDown = (e) => {
    if (syncZoom <= 1.0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - syncPan.x, y: e.clientY - syncPan.y });
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setSyncPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const formatSpectralBadge = (diagnostics) => {
    const spec = diagnostics?.spectral;
    if (!spec || !Number.isFinite(spec.wavelengthUm)) return '';
    return ` · λ ${spec.wavelengthUm.toFixed(3)} ± ${(spec.bandwidthUm * 0.5).toFixed(3)} μm`;
  };

  const formatZodiBadge = (diagnostics) => {
    const ext = diagnostics?.extensions;
    if (!ext?.hasZodi) return '';
    if (ext.zodiMode === 'raw') return ' · IMAGE orig.';
    if (ext.zodiMode === 'model') return ` · ZODI (${ext.meanZodiMjySr} MJy/sr)`;
    return ' · IMAGE−ZODI';
  };

  const formatFlagBadge = (diagnostics) => {
    const ext = diagnostics?.extensions;
    if (!ext?.hasFlags) return '';
    return ext.flagPolicy === 'discovery'
      ? ` · DESCUBRIMIENTO (Cand:${ext.categoryCCandidateCount})`
      : ` · MEDICIÓN (Warn:${ext.categoryBWarningCount})`;
  };

  const formatCoverageBadge = (diagnostics) => {
    const rep = diagnostics?.extensions?.reprojected || diagnostics?.reprojected;
    if (!rep || typeof rep.coverageFraction !== 'number') return '';
    const covPct = Math.round(rep.coverageFraction * 100);
    if (covPct >= 99) return '';
    return ` · Cobertura: ${covPct}% (Borde detector)`;
  };

  const handleImageClick = (event, pane = 'single') => {
    if (!marking && !marker) return;
    const point = imagePoint(event);
    if (!point) return;

    const diag = pane === 'B' ? compareDiagnostics : frameDiagnostics;
    const width = diag?.width || 300;
    const height = diag?.height || 300;
    const pixelX = Math.min(width - 1, Math.round(point.imageX * (width - 1)));
    const pixelY = Math.min(height - 1, Math.round(point.imageY * (height - 1)));
    let ra = null;
    let dec = null;
    if (diag?.reprojected?.gridToWorld) {
      try {
        const sky = diag.reprojected.gridToWorld(pixelX, pixelY);
        if (sky && Number.isFinite(sky.ra) && Number.isFinite(sky.dec)) {
          ra = sky.ra;
          dec = sky.dec;
        }
      } catch (err) {
        console.warn('[KRONOX] WCS gridToWorld error:', err);
      }
    }

    setMarker({
      xPercent: point.x,
      yPercent: point.y,
      pixelX,
      pixelY,
      ra,
      dec,
      pane,
      frameId: pane === 'B' ? (compareFrame?.id || frame?.id) : frame?.id,
    });
    setMarking(false);
    setShowFindingForm(true);
    setFindingError('');
  };

  const toggleMarking = () => {
    if (marking) {
      setMarking(false);
    } else {
      setMarking(true);
      setShowFindingForm(true);
      setFindingError('');
    }
  };

  const handleSaveFinding = () => {
    if (!findingNote.trim()) {
      setFindingError(t('Por favor escribe una descripción para el hallazgo antes de guardar.', language));
      return;
    }
    if (!frame) {
      setFindingError(t('No hay ninguna observación activa para guardar.', language));
      return;
    }
    try {
      const newRecord = createFindingRecord({
        target: selectedTarget,
        frame,
        compareFrame,
        marker,
        description: findingNote,
        viewMode,
        diagnostics: marker?.pane === 'B' ? compareDiagnostics : frameDiagnostics,
        timeDeltaDays,
      });

      setFindings((prev) => [newRecord, ...prev]);
      setFindingNote('');
      setMarker(null);
      setShowFindingForm(false);
      setFindingError('');
      setFindingToast(t('¡Hallazgo guardado con éxito! Se ha añadido a tu registro.', language));
      setTimeout(() => setFindingToast(''), 4000);
    } catch (err) {
      setFindingError(err.message || t('No se pudo guardar el hallazgo.', language));
    }
  };

  const handleDeleteFinding = (id) => {
    const targetItem = findings.find((f) => f.id === id);
    const confirmMsg = t(
      `¿Deseas eliminar este hallazgo? "${targetItem?.description || ''}"`,
      language,
    );
    if (typeof window !== 'undefined' && window.confirm && !window.confirm(confirmMsg)) {
      return;
    }
    setFindings((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveFindingsToStorage(updated);
      return updated;
    });
    setFindingToast(t('Hallazgo eliminado correctamente.', language));
    setTimeout(() => setFindingToast(''), 3000);
  };

  const restoreFinding = (finding) => {
    const targetIndex = TARGETS.findIndex((tgt) => tgt.key === finding.targetKey);
    if (targetIndex !== -1 && targetIndex !== selected) {
      setSelected(targetIndex);
      search(String(TARGETS[targetIndex].ra), String(TARGETS[targetIndex].dec), release);
    }
    if (finding.band) {
      setBand(finding.band);
    }
    setViewMode(finding.viewMode || 'sideBySide');
    setCompareEnabled(true);
    if (finding.frameId1) {
      const idx1 = visibleRecords.findIndex((r) => r.id === finding.frameId1);
      if (idx1 !== -1) setFrameIndex(idx1);
    }
    if (finding.frameId2) {
      const idx2 = visibleRecords.findIndex((r) => r.id === finding.frameId2);
      if (idx2 !== -1) setCompareIndex(idx2);
    }
    if (finding.marker) {
      setMarker({ ...finding.marker });
      setShowFindingForm(true);
      setFindingNote(finding.description);
    } else {
      setMarker(null);
    }
    setFindingToast(t(`Hallazgo cargado en el visor: ${finding.targetName}`, language));
    setTimeout(() => setFindingToast(''), 4000);
  };

  const handleExportCSV = () => {
    if (!findings.length) return;
    const quote = (val) => `"${String(val ?? '').replaceAll('"', '""')}"`;
    const headers = [
      'ID',
      'Objetivo',
      'Fecha creación',
      'Descripción',
      'Modo visor',
      'Banda',
      'Obs 1 (I1)',
      'Fecha Obs 1',
      'Obs 2 (I2)',
      'Fecha Obs 2',
      'Delta t (días)',
      'Pixel X',
      'Pixel Y',
      'RA (deg)',
      'Dec (deg)',
    ];
    const rows = findings.map((f) => [
      quote(f.id),
      quote(f.targetName),
      quote(f.createdAt),
      quote(f.description),
      quote(f.viewMode),
      quote(f.band),
      quote(f.frameId1),
      quote(f.frameDate1),
      quote(f.frameId2 || ''),
      quote(f.frameDate2 || ''),
      quote(f.timeDeltaDays || ''),
      quote(f.marker?.pixelX ?? ''),
      quote(f.marker?.pixelY ?? ''),
      quote(f.marker?.ra ?? ''),
      quote(f.marker?.dec ?? ''),
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KRONOX_Hallazgos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`spherexShade${image && viewMode === 'single' ? ' hasFullImage' : ''}`}
      role="presentation"
    >
      <section
        className="spherexMission"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spherex-title"
      >
        {/* COMPACT REFINED OBSERVATORY HEADER */}
        <header className="spherexHeader">
          <div className="spherexHeaderBrand">
            <div className="spherexLogo">
              <Icons.Telescope className="spherexLogoIcon" />
              <span>KRONOX</span>
            </div>
            <span className="spherexHeaderDivider" />
            <h2 id="spherex-title" className="spherexObservatoryTitle">
              {t('Observatorio Digital SPHEREx', language)}
            </h2>
            <div className="spherexActiveTargetChip">
              <span className="spherexTargetDot" />
              <b>{t(selectedTarget.name, language)}</b>
              <span className={`spherexStatusPill pill-${selectedTarget.scientificStatus.toLowerCase()}`}>
                {selectedTarget.scienceTypeLabel || selectedTarget.statusBadge}
              </span>
              {frame && frameDiagnostics && (() => {
                const rep = frameDiagnostics?.extensions?.reprojected || frameDiagnostics?.reprojected;
                const covFraction = rep?.coverageFraction ?? 1;
                const covPct = Math.round(covFraction * 100);
                const isFull = covPct >= 98;
                return (
                  <span
                    className={`spherexObservationPill ${isFull ? 'pill-cov-full' : 'pill-cov-partial'}`}
                    title={
                      isFull
                        ? t('Cobertura del recorte: 100% de píxeles válidos · Objetivo centrado en detector activo · Campo completo SPHEREx: 3.5° × 7°', language)
                        : t(`Cobertura del recorte: ${covPct}% (borde físico del detector) · Objetivo en zona marginal · Campo completo SPHEREx: 3.5° × 7°`, language)
                    }
                  >
                    {isFull
                      ? t('Toma: 100% píxeles válidos', language)
                      : t(`Toma: Cobertura parcial (${covPct}% · Borde detector)`, language)}
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="spherexHeaderActions">
            {/* Complexity Level Segmented Control */}
            <div className="spherexComplexityToggle" role="group" aria-label={t('Nivel de complejidad', language)}>
              <button
                type="button"
                className={`spherexToggleBtn ${complexityLevel === 'essential' ? 'active' : ''}`}
                onClick={() => setComplexityLevel('essential')}
                title={t('Visualización clara y accesible', language)}
              >
                {t('Esencial', language)}
              </button>
              <button
                type="button"
                className={`spherexToggleBtn ${complexityLevel === 'technical' ? 'active' : ''}`}
                onClick={() => setComplexityLevel('technical')}
                title={t('Parámetros de calibración, WCS y fotometría', language)}
              >
                <Icons.Tune style={{ marginRight: '4px' }} />
                {t('Técnico', language)}
              </button>
            </div>

            {/* Quick Interactive Help */}
            <button
              type="button"
              className="spherexHelpBtn"
              onClick={() => setShowHelpModal(true)}
              title={t('Guía de uso del observatorio', language)}
            >
              <Icons.Help style={{ marginRight: '5px' }} />
              <span>{t('¿Cómo explorar?', language)}</span>
            </button>

            {/* Discreet Close Button */}
            <button
              type="button"
              className="spherexCloseBtn"
              onClick={onClose}
              aria-label={t('Cerrar misión', language)}
              title={t('Cerrar observatorio', language)}
            >
              <Icons.Close />
            </button>
          </div>
        </header>

        {/* COMPACT SCIENTIFIC WARNING STRIP WITH COLLAPSIBLE AUDIT DRAWER */}
        {(selectedTarget.scientificStatus === 'WARNING' || selectedTarget.scientificStatus === 'SENSIBLE' || selectedTarget.scientificStatus === 'FOTOMÉTRICO') && (
          <div className={`spherexStatusStrip status-${selectedTarget.scientificStatus.toLowerCase()}`}>
            <div className="spherexStatusStripContent">
              <span className="spherexStatusIcon">
                {selectedTarget.scientificStatus === 'WARNING' ? (
                  <Icons.Warning />
                ) : selectedTarget.scientificStatus === 'SENSIBLE' ? (
                  <Icons.Info />
                ) : (
                  <Icons.Check />
                )}
              </span>
              <span className="spherexStatusText">
                <strong>
                  {t(selectedTarget.name, language)} · {
                    selectedTarget.scientificStatus === 'WARNING'
                      ? t('ADVERTENCIA CIENTÍFICA', language)
                      : selectedTarget.scientificStatus === 'SENSIBLE'
                        ? t('EVALUACIÓN SENSIBLE', language)
                        : t('VALIDACIÓN FOTOMÉTRICA', language)
                  }:
                </strong>{' '}
                {selectedTarget.scientificStatus === 'WARNING'
                  ? t('Época 1 sin detección independiente confirmada; Época 2 con evidencia y limitaciones fotométricas.', language)
                  : selectedTarget.scientificStatus === 'SENSIBLE'
                    ? t('Doble no resuelto; consistencia astrométrica condicionada al jitter instrumental.', language)
                    : t('Validación fotométrica confirmada; astrometría no aplicable en Época 1.', language)}
              </span>
            </div>
            <button
              type="button"
              className="spherexDetailsToggleBtn"
              onClick={() => setShowTechDetailsModal(true)}
            >
              <Icons.Tune style={{ marginRight: '4px' }} />
              <span>{t('Ver detalles técnicos', language)}</span>
              <Icons.ChevronDown style={{ marginLeft: '4px' }} />
            </button>
          </div>
        )}

        <div className={`spherexBody${viewMode !== 'single' ? ' comparing' : ''}`}>
          {/* SIDEBAR: TARGETS & DATA SOURCES */}
          <aside className="spherexControls">
            <div className="spherexSectionTitle">{t('Objetivos disponibles', language)}</div>
            <div className="spherexTargets">
              {TARGETS.map((target, index) => {
                const isWarning = target.scientificStatus === 'WARNING';
                const isSensible = target.scientificStatus === 'SENSIBLE';
                const isPhot = target.scientificStatus === 'FOTOMÉTRICO';
                const badgeBg = isWarning ? '#f59e0b' : isSensible ? '#0284c7' : isPhot ? '#8b5cf6' : '#10b981';
                return (
                  <button
                    key={target.key}
                    type="button"
                    className={`${selected === index ? 'selected' : ''}${isWarning ? ' targetWarning' : ''}`}
                    onClick={() => chooseTarget(index)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '4px' }}>
                      <b>{t(target.name, language)}</b>
                      <span
                        style={{
                          fontSize: '9.5px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: '600',
                          letterSpacing: '0.02em',
                          background: badgeBg,
                          color: '#fff',
                        }}
                      >
                        {target.scienceTypeLabel || target.statusBadge}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '11px', color: '#94a3b8' }}>
                      <small>{t(target.note, language)}</small>
                      <small style={{ color: '#64748b', marginLeft: '6px' }}>{target.distanceLabel}</small>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Coordinates search form - Technical Mode only */}
            {complexityLevel === 'technical' && (
              <>
                <div className="spherexSectionTitle">{t('Búsqueda por coordenadas', language)}</div>
                <form
                  className="spherexCoordinates"
                  onSubmit={(event) => {
                    event.preventDefault();
                    search();
                  }}
                >
                  <label>
                    {t('Ascensión recta (RA)', language)}
                    <input
                      type="number"
                      min="0"
                      max="359.999999"
                      step="any"
                      value={ra}
                      onChange={(event) => setRa(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {t('Declinación (Dec)', language)}
                    <input
                      type="number"
                      min="-90"
                      max="90"
                      step="any"
                      value={dec}
                      onChange={(event) => setDec(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {t('Lanzamiento', language)}
                    <select value={release} onChange={(event) => setRelease(event.target.value)}>
                      <option value="all">{t('QR2 + QR3 · archivo combinado', language)}</option>
                      <option value="qr3">{t('QR3 · más reciente', language)}</option>
                      <option value="qr2">{t('QR2 · archivo anterior', language)}</option>
                    </select>
                  </label>
                  <button className="spherexSearch" type="submit" disabled={loading}>
                    {loading ? t('Buscando…', language) : t('Consultar SPHEREx', language)}
                  </button>
                </form>
              </>
            )}

            <p className="spherexTargetHint">
              {t(selectedTarget.note, language)}
              {complexityLevel === 'technical' && selectedTarget.astrometry && (
                <small className="spherexAstrometryMeta">
                  {`J${selectedTarget.referenceEpoch} (${selectedTarget.astrometry.source}) · μ = ${Math.hypot(selectedTarget.astrometry.pmRa, selectedTarget.astrometry.pmDec).toFixed(0)} mas/yr`}
                </small>
              )}
            </p>

            {/* Scientific calibration controls in technical mode */}
            {complexityLevel === 'technical' && (
              <div className="spherexAccordion">
                <div
                  className="spherexAccordionSummary"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icons.Tune />
                    {t(showAdvanced ? 'Ocultar calibración' : 'Calibración instrumental', language)}
                  </span>
                  <Icons.ChevronDown style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
                {showAdvanced && (
                  <div className="spherexAccordionBody">
                    <label title={t('Procesamiento del fondo zodiacal (HDU 4: ZODI)', language)}>
                      {t('Fondo', language)}{' '}
                      <select
                        value={zodiMode}
                        onChange={(event) => {
                          stretchByBandRef.current.clear();
                          frameCacheRef.current.clear();
                          setZodiMode(event.target.value);
                        }}
                        disabled={!visibleRecords.length}
                      >
                        <option value="subtracted">{t('IMAGE − ZODI', language)}</option>
                        <option value="raw">{t('IMAGE original', language)}</option>
                        <option value="model">{t('Modelo ZODI', language)}</option>
                      </select>
                    </label>
                    <label title={t('Política de máscaras de calidad (HDU 2: FLAGS)', language)}>
                      {t('Modo', language)}{' '}
                      <select
                        value={flagPolicy}
                        onChange={(event) => {
                          stretchByBandRef.current.clear();
                          frameCacheRef.current.clear();
                          setFlagPolicy(event.target.value);
                        }}
                        disabled={!visibleRecords.length}
                      >
                        <option value="measurement">{t('Medición (Cat. A+C)', language)}</option>
                        <option value="discovery">{t('Descubrimiento (Cat. A)', language)}</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="spherexStatus" aria-live="polite">
              {t(status, language)}
              {truncated ? t(' Se muestran los registros disponibles.', language) : ''}
            </div>
          </aside>

          {/* MAIN VIEWER: 3-REGION LAYOUT */}
          <main className="spherexViewer">
            {/* REGION 1: TOP NAVIGATION & CONTEXT BAR */}
            <div className="spherexViewerHeaderBar">
              {/* Plain-Language View Mode Tabs */}
              <nav className="spherexViewModeTabs" aria-label={t('Modo de visualización', language)}>
                <button
                  type="button"
                  className={`spherexViewModeTab${viewMode === 'single' ? ' active' : ''}`}
                  onClick={() => {
                    setViewMode('single');
                    setCompareEnabled(false);
                  }}
                  title={t('Visualiza capturas en orden cronológico', language)}
                >
                  <Icons.Timeline />
                  <span>{t('Línea de tiempo', language)}</span>
                </button>
                <button
                  type="button"
                  className={`spherexViewModeTab${viewMode === 'blink' ? ' active' : ''}`}
                  onClick={() => {
                    setViewMode('blink');
                    setCompareEnabled(true);
                    setPlaying(true);
                    if (visibleRecords.length >= 2 && compareIndex === frameIndex) {
                      setCompareIndex(visibleRecords.length - 1);
                    }
                  }}
                  disabled={visibleRecords.length < 2}
                  title={t('Parpadeo rápido entre dos observaciones', language)}
                >
                  <Icons.Blink />
                  <span>{t('Comparar épocas', language)}</span>
                </button>
                <button
                  type="button"
                  className={`spherexViewModeTab${viewMode === 'sideBySide' ? ' active' : ''}`}
                  onClick={() => {
                    setViewMode('sideBySide');
                    setCompareEnabled(true);
                    setPlaying(false);
                    if (visibleRecords.length >= 2) {
                      setFrameIndex(0);
                      setCompareIndex(visibleRecords.length - 1);
                    }
                  }}
                  disabled={visibleRecords.length < 2}
                  title={t('Inspecciona dos observaciones lado a lado', language)}
                >
                  <Icons.SideBySide />
                  <span>{t('Vista comparada', language)}</span>
                </button>
                <button
                  type="button"
                  className={`spherexViewModeTab${viewMode === 'differential' ? ' active' : ''}`}
                  onClick={() => {
                    setViewMode('differential');
                    setCompareEnabled(true);
                    setPlaying(false);
                    if (visibleRecords.length >= 2) {
                      setFrameIndex(0);
                      setCompareIndex(visibleRecords.length - 1);
                    }
                  }}
                  disabled={visibleRecords.length < 2}
                  title={t('Resta matemática de dos épocas para detectar cambios', language)}
                >
                  <Icons.Differential />
                  <span>{t('Mapa de diferencias', language)}</span>
                </button>
                <button
                  type="button"
                  className={`spherexViewModeTab${viewMode === 'candidates' ? ' active' : ''}`}
                  onClick={() => {
                    setViewMode('candidates');
                    setCompareEnabled(true);
                    setPlaying(false);
                    if (visibleRecords.length >= 2) {
                      setFrameIndex(0);
                      setCompareIndex(visibleRecords.length - 1);
                    }
                  }}
                  disabled={visibleRecords.length < 2}
                  title={t('Candidatos que superan el umbral estadístico de cambio', language)}
                >
                  <Icons.Candidates />
                  <span>{t('Candidatos automáticos', language)} ({candidates.length})</span>
                </button>
                <button
                  type="button"
                  className={`spherexViewModeTab${viewMode === 'findings' ? ' active' : ''}`}
                  onClick={() => {
                    setViewMode('findings');
                    setPlaying(false);
                  }}
                  title={t('Registros y hallazgos manuales guardados por el investigador', language)}
                >
                  <Icons.Bookmark />
                  <span>{t('Hallazgos guardados', language)} ({findings.length})</span>
                </button>
              </nav>

              {/* Observation Metadata & Zoom dock */}
              <div className="spherexViewMeta">
                <div className="spherexObservationBadge">
                  <span className="spherexDateLabel">
                    {frame
                      ? formatDate(
                          frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date,
                          language,
                        )
                      : t('SECUENCIA DE OBSERVACIONES', language)}
                  </span>
                  {complexityLevel === 'technical' && frameDiagnostics?.temporal?.mjdAvg && (
                    <span className="spherexMjdPill">
                      MJD {Number(frameDiagnostics.temporal.mjdAvg).toFixed(3)}
                    </span>
                  )}
                  {frame && (
                    <span className="spherexCoveragePill">
                      {formatBandLabel(frame.band)}
                      {formatSpectralBadge(frameDiagnostics)}
                    </span>
                  )}
                </div>

                <div className="spherexViewTools">
                  <label className="spherexBandSelector">
                    <span>{t('Banda', language)}</span>
                    <select
                      value={band}
                      onChange={(event) => {
                        setBand(event.target.value);
                        setFrameIndex(0);
                        const nextLen = event.target.value
                          ? records.filter((r) => r.band === event.target.value).length
                          : records.length;
                        setCompareIndex(nextLen > 1 ? nextLen - 1 : 0);
                        setPlaying(false);
                      }}
                      disabled={!bands.length}
                    >
                      <option value="">{t('Todas', language)} · {records.length}</option>
                      {bands.map((name) => (
                        <option key={name} value={name}>
                          {formatBandLabel(name)} · {records.filter((record) => record.band === name).length}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Synchronized Zoom Controls */}
                  <div className="spherexZoomDock">
                    <button
                      type="button"
                      className="spherexFitButton"
                      onClick={handleFitImage}
                      title={t('Ajustar imagen: encuadre óptimo automático (1:1 geometría celeste sin deformar)', language)}
                    >
                      <Icons.Expand style={{ width: 13, height: 13, marginRight: '4px' }} />
                      <span>{t('Ajustar imagen', language)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleZoom(0.25)}
                      title={t('Acercar encuadre', language)}
                    >
                      <Icons.ZoomIn />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleZoom(-0.25)}
                      title={t('Alejar encuadre', language)}
                    >
                      <Icons.ZoomOut />
                    </button>
                    <button
                      type="button"
                      onClick={resetZoom}
                      title={t('Restablecer encuadre', language)}
                    >
                      <Icons.ZoomReset />
                    </button>
                    <button
                      type="button"
                      className="spherexExpandButton"
                      onClick={() => setExpanded(true)}
                      disabled={!image}
                      title={t('Pantalla completa', language)}
                    >
                      <Icons.Expand />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PLAIN LANGUAGE ASSISTANCE CARD (Essential Mode) */}
            {complexityLevel === 'essential' && (
              <div className="spherexPlainHelpCard">
                <Icons.Info className="spherexPlainHelpIcon" />
                <span>
                  {viewMode === 'single' && t('Explora la secuencia cronológica de observaciones. Usa la barra inferior para reproducir o avanzar entre fechas.', language)}
                  {viewMode === 'blink' && t('Comparación por parpadeo: alterna velozmente entre dos fechas para advertir cualquier salto de posición o variación de brillo.', language)}
                  {viewMode === 'sideBySide' && t('Vista dual lado a lado: compara las dos observaciones simultáneamente con zoom y paneo sincronizados.', language)}
                  {viewMode === 'differential' && t('Resta matemática calibrada: los objetos fijos se anulan, mientras que las fuentes variables o con movimiento propio resaltan en color.', language)}
                  {viewMode === 'candidates' && t('Catálogo de objetos detectados: fuentes identificadas que superan el umbral de significancia estadística. Haz clic en cualquiera para enfocarlo.', language)}
                </span>
              </div>
            )}

            {/* Mode-specific Controls Toolbar */}
            {viewMode === 'blink' && (
              <div className="spherexBlinkToolbar">
                <div className="spherexBlinkControls">
                  <button
                    type="button"
                    className={`spherexPlayBtn ${playing ? 'active' : ''}`}
                    onClick={() => setPlaying(!playing)}
                  >
                    {playing ? (
                      <><Icons.Pause style={{ marginRight: '6px' }} />{t('Pausar parpadeo', language)}</>
                    ) : (
                      <><Icons.Play style={{ marginRight: '6px' }} />{t('Iniciar parpadeo', language)}</>
                    )}
                  </button>
                  <button type="button" onClick={() => step(-1)} title={t('Fotograma o época anterior', language)}>
                    <Icons.StepBack />
                  </button>
                  <button type="button" onClick={() => step(1)} title={t('Fotograma o época siguiente', language)}>
                    <Icons.StepForward />
                  </button>
                </div>

                <div className="spherexBlinkConfig">
                  <label className="spherexBlinkModeToggle">
                    <span>{t('Modo', language)}:</span>
                    <select
                      value={blinkType}
                      onChange={(e) => setBlinkType(e.target.value)}
                    >
                      <option value="twoEpochs">{t('2 épocas clave (I₁ ⇄ I₂)', language)}</option>
                      <option value="all">{t('Secuencia completa (todas)', language)}</option>
                    </select>
                  </label>

                  <label className="spherexBlinkSpeedSelect">
                    <span>{t('Velocidad', language)}:</span>
                    <select
                      value={blinkSpeed}
                      onChange={(e) => setBlinkSpeed(Number(e.target.value))}
                    >
                      <option value={200}>200 ms ({t('Rápido', language)})</option>
                      <option value={400}>400 ms</option>
                      <option value={600}>600 ms ({t('Normal', language)})</option>
                      <option value={1000}>1000 ms ({t('Lento', language)})</option>
                    </select>
                  </label>

                  {blinkType === 'twoEpochs' && visibleRecords.length >= 2 && (
                    <button
                      type="button"
                      className="spherexPresetBtn"
                      onClick={selectMaxSeparation}
                      title={t('Alinear I₁ e I₂ con la mayor separación temporal', language)}
                    >
                      {t('Δt máximo', language)}
                    </button>
                  )}

                  {blinkType === 'all' && (
                    <label className="spherexBlinkLoopCheckbox">
                      <input
                        type="checkbox"
                        checked={blinkLoop}
                        onChange={(e) => setBlinkLoop(e.target.checked)}
                      />
                      <span>{t('Bucle continuo', language)}</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {(viewMode === 'sideBySide' || viewMode === 'differential' || viewMode === 'candidates' || (viewMode === 'blink' && blinkType === 'twoEpochs')) && (
              <div className="spherexCompareControls">
                <div className="spherexCompareSelectors">
                  <label>
                    <span className="spherexCompareLabelText">{t('Primera fecha', language)} (I₁):</span>
                    <select
                      value={frameIndex}
                      onChange={(e) => setFrameIndex(Number(e.target.value))}
                    >
                      {visibleRecords.map((rec, i) => (
                        <option key={`${rec.id}-${i}`} value={i} disabled={i === compareIndex}>
                          {formatDate(rec.dateAvg || rec.date, language)} · {rec.band}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="spherexCompareSwapBtn"
                    onClick={swapCompareFrames}
                    disabled={visibleRecords.length < 2}
                    title={t('Intercambiar orden entre I₁ e I₂', language)}
                  >
                    ⇄
                  </button>

                  <label>
                    <span className="spherexCompareLabelText">{t('Segunda fecha', language)} (I₂):</span>
                    <select
                      value={compareIndex}
                      onChange={(e) => setCompareIndex(Number(e.target.value))}
                    >
                      {visibleRecords.map((rec, i) => {
                        const dtDays = frame ? Math.abs(Number(rec.dateAvg || rec.date) - Number(frame.dateAvg || frame.date)) : 0;
                        const dtMinutes = dtDays * 1440;
                        let timeLabel = '';
                        if (dtDays >= 365) {
                          timeLabel = `(Δt = ${(dtDays / 365.25).toFixed(1)} a · Época distinta)`;
                        } else if (dtDays >= 1) {
                          timeLabel = `(Δt = ${dtDays.toFixed(0)} d · Época distinta)`;
                        } else if (dtMinutes >= 0.5) {
                          timeLabel = `(Δt = ${dtMinutes.toFixed(0)} min · Misma visita)`;
                        }
                        return (
                          <option key={`${rec.id}-${i}`} value={i} disabled={i === frameIndex}>
                            {formatDate(rec.dateAvg || rec.date, language)} {timeLabel} · {rec.band}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                <div className="spherexCompareBaselineGroup">
                  {timeDeltaDays !== null && (
                    <span className="spherexTimeDeltaBadge" title={t('Separación temporal entre las dos observaciones seleccionadas', language)}>
                      {timeDeltaDays >= 365
                        ? `Δt = ${(timeDeltaDays / 365.25).toFixed(2)} años (${timeDeltaDays.toFixed(0)} días · Épocas distintas)`
                        : timeDeltaDays >= 1
                          ? `Δt = ${timeDeltaDays.toFixed(0)} días (Épocas distintas)`
                          : `Δt = ${(timeDeltaDays * 1440).toFixed(1)} min (Misma visita / Pasada consecutiva)`}
                    </span>
                  )}
                  <button
                    type="button"
                    className="spherexPresetBtn"
                    onClick={selectMaxSeparation}
                    disabled={visibleRecords.length < 2}
                    title={t('Seleccionar la primera y última observación para maximizar la detección de movimiento o variación', language)}
                  >
                    {t('Máxima separación (Δt máx)', language)}
                  </button>
                  <button
                    type="button"
                    className={`spherexMarkChangeBtn ${marking ? 'active' : ''}`}
                    onClick={toggleMarking}
                    disabled={!image || compareLoading}
                    title={t('Activar modo de marcación para registrar un punto de interés en la imagen', language)}
                  >
                    <Icons.Bookmark style={{ marginRight: '6px' }} />
                    {marking
                      ? t('Cancelar marcación', language)
                      : marker
                        ? t('Editar hallazgo', language)
                        : t('Marcar cambio', language)}
                  </button>
                </div>
              </div>
            )}

            {/* Differential Controls toolbar */}
            {(viewMode === 'differential' || viewMode === 'candidates') && diffResult && (
              <div className="spherexDiffControls">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label>
                    <input
                      type="radio"
                      name="diffMode"
                      value="diff"
                      checked={diffMode === 'diff'}
                      onChange={() => setDiffMode('diff')}
                    />{' '}
                    {t('Diferencia neta', language)} (D = I₂ − αI₁ − B)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="diffMode"
                      value="snr"
                      checked={diffMode === 'snr'}
                      onChange={() => setDiffMode('snr')}
                    />{' '}
                    {t('Significancia estadística', language)} (SNR = D / σ_D)
                  </label>
                </div>
                <div className="spherexColormapLegend">
                  <span>− {t('Atenuación', language)}</span>
                  <div className="spherexColormapGradient" />
                  <span>+ {t('Exceso', language)}</span>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {t('Umbral de detección', language)}:
                  <select
                    value={diffThreshold}
                    onChange={(e) => setDiffThreshold(Number(e.target.value))}
                  >
                    <option value={3.0}>3.0 σ</option>
                    <option value={4.0}>4.0 σ ({t('Recomendado', language)})</option>
                    <option value={5.0}>5.0 σ ({t('Estricto', language)})</option>
                    <option value={8.0}>8.0 σ</option>
                  </select>
                </label>
              </div>
            )}

            {/* Normalization & PSF Summary Card (Technical Mode) */}
            {complexityLevel === 'technical' && (viewMode === 'differential' || viewMode === 'candidates') && diffResult && (
              <div className="spherexNormCard">
                <span>α = <b>{diffResult.scaleNorm.alpha}</b> ± {Math.sqrt(diffResult.scaleNorm.alphaVariance).toFixed(4)} ({diffResult.scaleNorm.method === 'stellar_sources' ? `Fuentes N=${diffResult.scaleNorm.validReferencePixelCount}` : 'Sin reescalar'})</span>
                <span>B = <b>{diffResult.scaleNorm.backgroundOffset}</b> MJy/sr</span>
                <span>{t('Correlación r', language)} = <b>{diffResult.scaleNorm.correlation}</b></span>
                {diffResult.empiricalCalibration && (
                  <span>η_cielo = <b>{diffResult.empiricalCalibration.etaSky}×</b> (σ_emp={diffResult.empiricalCalibration.sigmaEmp} MJy/sr)</span>
                )}
                <span>ΔFWHM = <b>{diffResult.psfAssessment.deltaFwhm}"</b> ({diffResult.psfAssessment.quantitativeInterpretationAllowed ? 'PSF compatible' : 'No cuantitativo'})</span>
                <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={forceAlpha1}
                    onChange={(e) => setForceAlpha1(e.target.checked)}
                  />
                  {t('Forzar α = 1.0', language)}
                </label>
              </div>
            )}

            {/* REGION 2: HERO OBSERVATION STAGE */}
            {/* 1. SINGLE / BLINK HERO VIEWPORT */}
            {(viewMode === 'single' || viewMode === 'blink') && (
              <div
                className={`spherexImageFrame${image ? ' hasImage' : ''}`}
                style={{ '--spherex-image-ratio': primaryImageRatio }}
              >
                {image && (
                  <div className="spherexSkyStage">
                    <img
                      src={viewMode === 'blink' && blinkType === 'twoEpochs' && blinkEpochToggle ? (compareImage || image) : image}
                      alt={`Recorte infrarrojo SPHEREx ${frame?.band}`}
                      className={marking ? 'markable' : ''}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        cursor: marking ? 'crosshair' : 'default',
                      }}
                      onClick={(e) => handleImageClick(e, 'single')}
                      onDoubleClick={handleFitImage}
                      onLoad={(e) =>
                        setPrimaryImageRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
                      }
                    />
                    <SkyReticle
                      imageCenter={imageCenter}
                      predictedMarker={
                        viewMode === 'blink' && blinkType === 'twoEpochs' && blinkEpochToggle
                          ? compareEpochMarker
                          : primaryEpochMarker
                      }
                      language={language}
                    />
                    {marker && (
                      <div
                        className="spherexUserMarker"
                        style={{ left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
                      >
                        <span className="spherexMarkerPulse" />
                        <span className="spherexMarkerTarget" />
                        <span className="spherexMarkerDot" />
                        <span className="spherexMarkerCoordsBadge">
                          {marker.ra !== null ? `RA ${marker.ra.toFixed(4)}° Dec ${marker.dec.toFixed(4)}°` : `Px (${marker.pixelX}, ${marker.pixelY})`}
                        </span>
                      </div>
                    )}
                    {/* Celestial orientation badge */}
                    <div className="spherexOrientationHud" title={t('Orientación astronómica estándar', language)}>
                      <Icons.Compass style={{ marginRight: '4px' }} />
                      <span>N ↑ · E ←</span>
                    </div>
                    {viewMode === 'blink' && (
                      <div className="spherexBlinkHud">
                        {blinkType === 'twoEpochs' ? (
                          <>
                            <span className="badge">
                              BLINK [{blinkEpochToggle ? '2/2 · Época B' : '1/2 · Época A'}]
                            </span>
                            <span>
                              {blinkEpochToggle
                                ? (compareFrame ? formatDate(compareFrame.dateAvg || compareFrame.date, language) : '')
                                : (frame ? formatDate(frame.dateAvg || frame.date, language) : '')}
                            </span>
                            <span>
                              {blinkEpochToggle
                                ? (compareFrame ? formatBandLabel(compareFrame.band, complexityLevel) : '')
                                : (frame ? formatBandLabel(frame.band, complexityLevel) : '')}
                            </span>
                          </>
                        ) : (
                          frame && (
                            <>
                              <span className="badge">BLINK [{frameIndex + 1}/{visibleRecords.length}]</span>
                              <span>{formatDate(frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date, language)}</span>
                              <span>{formatBandLabel(frame.band, complexityLevel)}</span>
                            </>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!image && (
                  <div className="spherexImagePlaceholder">
                    {frameLoading ? (
                      <>
                        <span className="spherexSpinner" />{' '}
                        {t('Procesando recorte de la imagen…', language)}
                      </>
                    ) : records.length === 0 ? (
                      <div className="spherexEmptyNotice" style={{ padding: '24px', textAlign: 'center' }}>
                        <Icons.Telescope style={{ width: '32px', height: '32px', opacity: 0.6, marginBottom: '8px' }} />
                        <b>{t('Sin observaciones SPHEREx en esta región', language)}</b>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '6px', maxWidth: '340px' }}>
                          {t('No se registraron imágenes públicas para estas coordenadas en el release seleccionado. Selecciona uno de los 5 objetivos oficiales para explorar datos verificados.', language)}
                        </p>
                      </div>
                    ) : (
                      t('Aquí aparecerán los recortes del cielo', language)
                    )}
                  </div>
                )}
                {frame && viewMode === 'single' && (
                  <span className="spherexFrameLabel">
                    {formatBandLabel(frame.band, complexityLevel)}
                    {complexityLevel === 'technical' && (
                      <>
                        {' · '}
                        {frame.release.replace('spherex_', '').toUpperCase()}
                        {formatSpectralBadge(frameDiagnostics)}
                        {formatZodiBadge(frameDiagnostics)}
                        {formatFlagBadge(frameDiagnostics)}{formatCoverageBadge(frameDiagnostics)}
                      </>
                    )}
                  </span>
                )}
              </div>
            )}

            {/* 2. SIDE-BY-SIDE DUAL VIEWPORT */}
            {viewMode === 'sideBySide' && (
              <div className="spherexDualViewport">
                <article className="spherexDualPane">
                  <header className="spherexDualHeader">
                    <span>
                      <b>{t('Época A (I₁)', language)}</b> · {frame ? formatDate(frame.dateAvg || frame.date, language) : ''}
                      {frame?.id && <span style={{ opacity: 0.65, fontSize: '11px', marginLeft: '6px' }}>({frame.id})</span>}
                    </span>
                    <small>{frame ? formatBandLabel(frame.band, complexityLevel) : ''}</small>
                  </header>
                  <div
                    className="spherexDualCanvasArea"
                    style={{ cursor: syncZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    {image ? (
                      <div style={{ transform: `translate(${syncPan.x}px, ${syncPan.y}px) scale(${syncZoom})`, transformOrigin: 'center center', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div
                          className="spherexImageStageWrapper"
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            aspectRatio: '1 / 1',
                            maxHeight: '100%',
                            maxWidth: '100%',
                            height: '100%',
                          }}
                        >
                          <img
                            src={image}
                            alt="Época A"
                            className={marking ? 'markable' : ''}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block',
                              cursor: marking ? 'crosshair' : (syncZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'),
                            }}
                            onClick={(e) => handleImageClick(e, 'A')}
                          />
                          <SkyReticle
                            imageCenter={imageCenter}
                            predictedMarker={primaryEpochMarker}
                            language={language}
                          />
                          {marker && (
                            <div
                              className="spherexUserMarker"
                              style={{ left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
                              title={marker.ra !== null ? `RA ${marker.ra.toFixed(4)}°, Dec ${marker.dec.toFixed(4)}°` : `Píxel (${marker.pixelX}, ${marker.pixelY})`}
                            >
                              <span className="spherexMarkerPulse" />
                              <span className="spherexMarkerTarget" />
                              <span className="spherexMarkerDot" />
                              <span className="spherexMarkerCoordsBadge">
                                {marker.ra !== null ? `RA ${marker.ra.toFixed(4)}° Dec ${marker.dec.toFixed(4)}°` : `Px (${marker.pixelX}, ${marker.pixelY})`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="spherexImagePlaceholder">
                        {frameLoading ? (
                          <>
                            <span className="spherexSpinner" />{' '}
                            {t('Cargando Época A…', language)}
                          </>
                        ) : (
                          t('Sin imagen para Época A', language)
                        )}
                      </div>
                    )}
                  </div>
                  {complexityLevel === 'technical' && frame && (
                    <div className="spherexDualMeta">
                      <div>MJD: {Number(frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date).toFixed(5)}</div>
                      <div>λ = {frameDiagnostics?.spectral?.wavelengthUm ?? '?'} μm (Δλ = {frameDiagnostics?.spectral?.bandwidthUm ?? '?'} μm)</div>
                      <div>Centro WCS: RA {imageCenter.ra.toFixed(4)}°, Dec {imageCenter.dec.toFixed(4)}°</div>
                    </div>
                  )}
                </article>

                <article className="spherexDualPane">
                  <header className="spherexDualHeader">
                    <span>
                      <b>{t('Época B (I₂)', language)}</b> · {compareFrame ? formatDate(compareFrame.dateAvg || compareFrame.date, language) : t('Segunda observación', language)}
                      {compareFrame?.id && <span style={{ opacity: 0.65, fontSize: '11px', marginLeft: '6px' }}>({compareFrame.id})</span>}
                    </span>
                    <small>{compareFrame ? formatBandLabel(compareFrame.band, complexityLevel) : ''}</small>
                  </header>
                  <div
                    className="spherexDualCanvasArea"
                    style={{ cursor: syncZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    {compareImage ? (
                      <div style={{ transform: `translate(${syncPan.x}px, ${syncPan.y}px) scale(${syncZoom})`, transformOrigin: 'center center', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div
                          className="spherexImageStageWrapper"
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            aspectRatio: '1 / 1',
                            maxHeight: '100%',
                            maxWidth: '100%',
                            height: '100%',
                          }}
                        >
                          <img
                            src={compareImage}
                            alt="Época B"
                            className={marking ? 'markable' : ''}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block',
                              cursor: marking ? 'crosshair' : (syncZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'),
                            }}
                            onClick={(e) => handleImageClick(e, 'B')}
                          />
                          <SkyReticle
                            imageCenter={imageCenter}
                            predictedMarker={compareEpochMarker}
                            language={language}
                          />
                          {marker && (
                            <div
                              className="spherexUserMarker"
                              style={{ left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
                              title={marker.ra !== null ? `RA ${marker.ra.toFixed(4)}°, Dec ${marker.dec.toFixed(4)}°` : `Píxel (${marker.pixelX}, ${marker.pixelY})`}
                            >
                              <span className="spherexMarkerPulse" />
                              <span className="spherexMarkerTarget" />
                              <span className="spherexMarkerDot" />
                              <span className="spherexMarkerCoordsBadge">
                                {marker.ra !== null ? `RA ${marker.ra.toFixed(4)}° Dec ${marker.dec.toFixed(4)}°` : `Px (${marker.pixelX}, ${marker.pixelY})`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="spherexImagePlaceholder" style={{ padding: '20px', textAlign: 'center' }}>
                        {compareLoading ? (
                          <>
                            <span className="spherexSpinner" />{' '}
                            {t('Cargando Época B…', language)}
                          </>
                        ) : visibleRecords.length <= 1 ? (
                          <div style={{ maxWidth: '320px', margin: '0 auto', fontSize: '12px' }}>
                            <Icons.Info style={{ width: '24px', height: '24px', opacity: 0.7, marginBottom: '6px' }} />
                            <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>
                              {t('Una sola época en este filtro', language)}
                            </p>
                            <p style={{ color: '#94a3b8', fontSize: '11px', lineHeight: 1.4 }}>
                              {t('Esta banda espectral contiene 1 sola exposición en el release actual. Selecciona "Todas las bandas" en el selector para contrastar con otras épocas disponibles.', language)}
                            </p>
                          </div>
                        ) : (
                          <div style={{ maxWidth: '300px', margin: '0 auto', fontSize: '12px', color: '#94a3b8' }}>
                            <p>{t('Selecciona una observación diferente en el selector inferior de Época B.', language)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {complexityLevel === 'technical' && compareFrame && (
                    <div className="spherexDualMeta">
                      <div>MJD: {Number(compareDiagnostics?.temporal?.mjdAvg ?? compareFrame.dateAvg ?? compareFrame.date).toFixed(5)}</div>
                      <div>λ = {compareDiagnostics?.spectral?.wavelengthUm ?? '?'} μm (Δλ = {compareDiagnostics?.spectral?.bandwidthUm ?? '?'} μm)</div>
                      <div>Centro WCS: RA {imageCenter.ra.toFixed(4)}°, Dec {imageCenter.dec.toFixed(4)}°</div>
                    </div>
                  )}
                </article>
              </div>
            )}

            {/* 3. DIFFERENTIAL / SNR VIEWPORT */}
            {(viewMode === 'differential' || viewMode === 'candidates') && (
              <div
                className="spherexImageFrame hasImage"
                style={{
                  '--spherex-image-ratio': primaryImageRatio,
                  cursor: syncZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  overflow: 'hidden',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <div
                  className="spherexSkyStage"
                  style={{
                    transform: `translate(${syncPan.x}px, ${syncPan.y}px) scale(${syncZoom})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {diffDataUrl ? (
                    <img
                      src={diffDataUrl}
                      alt="Mapa diferencial de intensidad / SNR"
                      className={marking ? 'markable' : ''}
                      style={{ cursor: marking ? 'crosshair' : 'default' }}
                      onClick={(e) => handleImageClick(e, 'diff')}
                    />
                  ) : (
                    <div className="spherexImagePlaceholder">
                      <span className="spherexSpinner" /> {t('Calculando resta diferencial...', language)}
                    </div>
                  )}
                  <SkyReticle
                    imageCenter={imageCenter}
                    predictedMarker={compareEpochMarker}
                    language={language}
                  />
                  {marker && (
                    <div
                      className="spherexUserMarker"
                      style={{ left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
                    >
                      <span className="spherexMarkerPulse" />
                      <span className="spherexMarkerTarget" />
                      <span className="spherexMarkerDot" />
                      <span className="spherexMarkerCoordsBadge">
                        {marker.ra !== null ? `RA ${marker.ra.toFixed(4)}° Dec ${marker.dec.toFixed(4)}°` : `Px (${marker.pixelX}, ${marker.pixelY})`}
                      </span>
                    </div>
                  )}
                  {/* Celestial orientation badge */}
                  <div className="spherexOrientationHud">
                    <Icons.Compass style={{ marginRight: '4px' }} />
                    <span>N ↑ · E ←</span>
                  </div>
                  {selectedCandidate && (
                    <span
                      style={{
                        position: 'absolute',
                        left: `${((selectedCandidate.col + 0.5) / 300) * 100}%`,
                        top: `${((selectedCandidate.row + 0.5) / 300) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '24px',
                        height: '24px',
                        border: '2px solid #38bdf8',
                        borderRadius: '50%',
                        boxShadow: '0 0 12px #38bdf8',
                        pointerEvents: 'none',
                        zIndex: 4,
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 4. CANDIDATES PANEL (When in candidates mode) */}
            {viewMode === 'candidates' && (
              <section className="spherexCandidatePanel">
                <div className="spherexCandidateHeader">
                  <h4>
                    <Icons.Candidates style={{ marginRight: '6px' }} />
                    {t('Catálogo de fuentes candidatas', language)} ({candidates.length})
                  </h4>
                  <small style={{ color: '#94a3b8' }}>
                    {t('Filtrado por significancia', language)} ≥ {diffThreshold}σ
                  </small>
                </div>

                <div className="spherexCandidateDisclaimer">
                  <Icons.Info style={{ flexShrink: 0, width: 14, height: 14, marginTop: 2 }} />
                  <span>
                    {t('Detecciones preliminares por encima del umbral estadístico (≥ ' + diffThreshold + 'σ). No constituyen 50 objetos confirmados; la mayoría corresponden a fluctuaciones del fondo, ruido correlacionado o artefactos pendientes de confirmación independiente.', language)}
                  </span>
                </div>

                {/* 4 Category Filter Tabs */}
                <div className="spherexCandidateFilterTabs">
                  <button
                    type="button"
                    className={candidateCategoryFilter === 'all' ? 'active' : ''}
                    onClick={() => setCandidateCategoryFilter('all')}
                  >
                    {t('Todos', language)} ({candidates.length})
                  </button>
                  <button
                    type="button"
                    className={candidateCategoryFilter === 'candidates' ? 'active' : ''}
                    onClick={() => setCandidateCategoryFilter('candidates')}
                  >
                    {t('Fuentes candidatas', language)} ({candidateCategories.candidates.length})
                  </button>
                  <button
                    type="button"
                    className={candidateCategoryFilter === 'variables' ? 'active' : ''}
                    onClick={() => setCandidateCategoryFilter('variables')}
                  >
                    {t('Fuentes variables', language)} ({candidateCategories.variables.length})
                  </button>
                  <button
                    type="button"
                    className={candidateCategoryFilter === 'moving' ? 'active' : ''}
                    onClick={() => setCandidateCategoryFilter('moving')}
                  >
                    {t('Posibles en movimiento', language)} ({candidateCategories.moving.length})
                  </button>
                  <button
                    type="button"
                    className={candidateCategoryFilter === 'artifacts' ? 'active' : ''}
                    onClick={() => setCandidateCategoryFilter('artifacts')}
                  >
                    {t('Artefactos / Dudosos', language)} ({candidateCategories.artifacts.length})
                  </button>
                </div>

                {activeCandidates.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '11px', margin: '8px 0', textAlign: 'center', padding: '12px' }}>
                    {t('No se detectaron candidatos en esta categoría para el umbral actual', language)} ({diffThreshold}σ).
                  </p>
                ) : (
                  <div className="spherexCandidateList">
                    {activeCandidates.map((cand) => {
                      const isTarget = cand.taxonomyType === 'KNOWN_OBJECT_MATCH';
                      const isMoving = cand.taxonomyType === 'MOVING_OBJECT_CANDIDATE' || cand.subType === 'PROPER_MOTION_DIPOLE';
                      const isVar = cand.taxonomyType === 'VARIABLE_SOURCE_CANDIDATE' || cand.subType === 'VARIABLE_BRIGHTENED' || cand.subType === 'VARIABLE_DIMMED';
                      const isArtifact = cand.taxonomyType === 'INSTRUMENTAL_ARTIFACT' || cand.confidence === 'ARTIFACT' || cand.dataQuality === 'POOR' || cand.taxonomyType === 'TRANSIENT_ANOMALY';

                      const badgeClass = isTarget ? 'targetMatch' : isMoving ? 'dipole' : isVar ? 'variable' : 'artifact';
                      const badgeLabel = isTarget
                        ? t('Objetivo de catálogo: ' + selectedTarget.name, language)
                        : isMoving
                          ? t('Posible objeto en movimiento (dipolo)', language)
                          : isVar
                            ? cand.snr > 0 ? t('Fuente variable (exceso)', language) : t('Fuente variable (atenuación)', language)
                            : t('Artefacto instrumental / Detección dudosa', language);

                      return (
                        <div
                          key={cand.id}
                          className={`spherexCandidateCard${cand.matchesTarget ? ' matched' : ''}`}
                          onClick={() => setSelectedCandidate(cand)}
                        >
                          <div>
                            <span className={`spherexCandidateBadge ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                            {cand.dataQuality && cand.dataQuality !== 'NOMINAL' && (
                              <span className="spherexCandidateBadge caution">
                                {cand.dataQuality}
                              </span>
                            )}
                            <div style={{ marginTop: '4px', color: '#e2e8f0' }}>{cand.notesEs}</div>
                            {cand.evidence && (
                              <div style={{ marginTop: '2px', color: '#94a3b8', fontSize: '11px' }}>
                                {cand.evidence}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                            <b style={{ color: cand.snr > 0 ? '#fb923c' : '#38bdf8' }}>
                              SNR = {cand.snr > 0 ? `+${cand.snr}` : cand.snr}σ
                            </b>
                            {complexityLevel === 'technical' && cand.snrTheoretical !== undefined && (
                              <div style={{ color: '#64748b', fontSize: '10px' }}>
                                teo: {cand.snrTheoretical > 0 ? `+${cand.snrTheoretical}` : cand.snrTheoretical}σ
                              </div>
                            )}
                            <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                              RA {cand.ra.toFixed(4)}°, Dec {cand.dec.toFixed(4)}°
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Floating banner for active marking mode */}
            {marking && (
              <div className="spherexMarkingHudBanner">
                <Icons.Bookmark style={{ width: 14, height: 14, color: '#38bdf8' }} />
                <span>{t('Modo de marcación activo: Haz clic sobre cualquier punto de la imagen para señalar el cambio o región de interés.', language)}</span>
                <button type="button" onClick={() => setMarking(false)} className="spherexMiniBtn">
                  {t('Cancelar', language)}
                </button>
              </div>
            )}

            {/* Note Drawer for recorded findings */}
            {(showFindingForm || marker) && (
              <div className="spherexFindingDrawer">
                <div className="spherexFindingDrawerHeader">
                  <div className="spherexFindingDrawerTitle">
                    <Icons.Bookmark style={{ marginRight: '6px', color: '#38bdf8' }} />
                    <b>{t('Registrar Hallazgo Astronómico', language)}</b>
                  </div>
                  <div className="spherexFindingDrawerTargetInfo">
                    <span>{t(selectedTarget.name, language)}</span>
                    {frame && compareFrame && (
                      <span className="spherexFindingDrawerObs">
                        {frame.id} ⇄ {compareFrame.id} {timeDeltaDays !== null ? `(\u0394t = ${timeDeltaDays >= 365 ? (timeDeltaDays / 365.25).toFixed(1) + ' a' : timeDeltaDays.toFixed(0) + ' d'})` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="spherexCloseBtn"
                    onClick={() => {
                      setMarker(null);
                      setMarking(false);
                      setShowFindingForm(false);
                      setFindingError('');
                    }}
                    title={t('Cerrar', language)}
                  >
                    <Icons.Close />
                  </button>
                </div>

                {marker ? (
                  <div className="spherexFindingCoordsInfo">
                    <span className="badge">
                      {marker.ra !== null ? 'WCS Calibrado' : 'Coordenadas de Imagen'}
                    </span>
                    <span className="coords">
                      {marker.ra !== null
                        ? `RA ${marker.ra.toFixed(5)}°, Dec ${marker.dec.toFixed(5)}° · Píxel (${marker.pixelX}, ${marker.pixelY})`
                        : `Píxel (${marker.pixelX}, ${marker.pixelY}) · Coordenadas celestes no disponibles en este producto`}
                    </span>
                    <button
                      type="button"
                      className="spherexMiniBtn"
                      onClick={() => setMarker(null)}
                      title={t('Quitar el punto marcado', language)}
                    >
                      {t('Quitar marcador', language)}
                    </button>
                  </div>
                ) : (
                  <div className="spherexFindingCoordsNotice">
                    <Icons.Info style={{ width: 14, height: 14, marginRight: 6 }} />
                    <span>{t('Puedes hacer clic sobre la imagen para señalar una coordenada exacta o guardar un hallazgo general.', language)}</span>
                  </div>
                )}

                <div className="spherexFindingInputRow">
                  <input
                    type="text"
                    value={findingNote}
                    onChange={(e) => {
                      setFindingNote(e.target.value);
                      if (findingError) setFindingError('');
                    }}
                    placeholder={t('Describe el cambio, movimiento propio o variación observada…', language)}
                    maxLength={300}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFinding();
                    }}
                  />
                  <button
                    type="button"
                    className="spherexSaveFindingBtn"
                    onClick={handleSaveFinding}
                  >
                    <Icons.Bookmark style={{ marginRight: '6px' }} />
                    {t('Guardar hallazgo', language)}
                  </button>
                </div>

                {findingError && (
                  <div className="spherexFindingErrorNotice" role="alert">
                    <Icons.Warning style={{ width: 14, height: 14, marginRight: 6 }} />
                    <span>{findingError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Dedicated View for Saved Findings */}
            {viewMode === 'findings' && (
              <section className="spherexSavedFindingsPanel">
                <header className="spherexSavedFindingsHeader">
                  <div>
                    <h3>
                      <Icons.Bookmark style={{ marginRight: '8px', color: '#38bdf8' }} />
                      {t('Hallazgos guardados del investigador', language)} ({findings.length})
                    </h3>
                    <p>
                      {t('Registro permanente de puntos de interés, anotaciones y comparaciones astronómicas guardadas en este navegador.', language)}
                    </p>
                  </div>
                  <div className="spherexSavedFindingsGlobalActions">
                    {findings.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="spherexPresetBtn"
                          onClick={handleExportCSV}
                          title={t('Descargar todos los hallazgos en formato CSV', language)}
                        >
                          {t('Exportar CSV', language)}
                        </button>
                        <button
                          type="button"
                          className="spherexDangerBtn"
                          onClick={() => {
                            if (window.confirm(t('¿Seguro que deseas eliminar todos los hallazgos guardados?', language))) {
                              setFindings([]);
                              saveFindingsToStorage([]);
                            }
                          }}
                          title={t('Eliminar todos los hallazgos', language)}
                        >
                          <Icons.Trash style={{ marginRight: '4px' }} />
                          {t('Limpiar todos', language)}
                        </button>
                      </>
                    )}
                  </div>
                </header>

                {findings.length === 0 ? (
                  <div className="spherexEmptyNotice" style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <Icons.Bookmark style={{ width: 42, height: 42, opacity: 0.4, marginBottom: 12, color: '#38bdf8' }} />
                    <h4 style={{ color: '#e2e8f0', fontSize: 16, marginBottom: 6 }}>
                      {t('Aún no tienes hallazgos guardados', language)}
                    </h4>
                    <p style={{ color: '#94a3b8', fontSize: 13, maxWidth: 440, margin: '0 auto 16px' }}>
                      {t('Entra a la «Vista comparada» o al «Mapa de diferencias», haz clic en «Marcar cambio», señala un punto sobre la imagen y añade tu descripción.', language)}
                    </p>
                    <button
                      type="button"
                      className="spherexActionPrimary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => {
                        setViewMode('sideBySide');
                        setCompareEnabled(true);
                      }}
                    >
                      <Icons.SideBySide />
                      {t('Ir a Vista comparada', language)}
                    </button>
                  </div>
                ) : (
                  <div className="spherexFindingsGrid">
                    {findings.map((f) => (
                      <article key={f.id} className="spherexFindingCard">
                        <header className="spherexFindingCardHeader">
                          <div className="spherexFindingCardHeaderMain">
                            <span className="spherexFindingTargetBadge">{f.targetName}</span>
                            <span className="spherexCoveragePill">{f.band}</span>
                            <span className="spherexMjdPill">{f.viewMode}</span>
                          </div>
                          <time className="spherexFindingTime">
                            {new Date(f.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'es', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </time>
                        </header>

                        <p className="spherexFindingDescription">{f.description}</p>

                        <div className="spherexFindingContextBox">
                          <div className="spherexFindingContextRow">
                            <span className="label">{t('Comparación', language)}:</span>
                            <span className="val">
                              {f.frameId1} ({f.frameDate1})
                              {f.frameId2 ? ` ⇄ ${f.frameId2} (${f.frameDate2})` : ''}
                            </span>
                          </div>
                          {f.timeDeltaDays !== null && (
                            <div className="spherexFindingContextRow">
                              <span className="label">{t('Separación', language)}:</span>
                              <span className="val">
                                Δt = {f.timeDeltaDays >= 365 ? `${(f.timeDeltaDays / 365.25).toFixed(1)} años (${f.timeDeltaDays.toFixed(0)} días)` : `${f.timeDeltaDays.toFixed(0)} días`}
                              </span>
                            </div>
                          )}
                          <div className="spherexFindingContextRow">
                            <span className="label">{t('Coordenadas', language)}:</span>
                            <span className="val coordinates">
                              {f.marker?.ra !== null && f.marker?.ra !== undefined
                                ? `RA ${f.marker.ra.toFixed(5)}°, Dec ${f.marker.dec.toFixed(5)}° (píxel ${f.marker.pixelX}, ${f.marker.pixelY})`
                                : f.marker
                                  ? `Píxel (${f.marker.pixelX}, ${f.marker.pixelY}) · Coordenadas celestes no disponibles`
                                  : t('Sin marcador espacial específico', language)}
                            </span>
                          </div>
                        </div>

                        <footer className="spherexFindingCardFooter">
                          <button
                            type="button"
                            className="spherexFindingLoadBtn"
                            onClick={() => restoreFinding(f)}
                            title={t('Cargar esta observación en el visor interactivo', language)}
                          >
                            <Icons.SideBySide style={{ marginRight: '6px' }} />
                            {t('Cargar en visor', language)}
                          </button>
                          <button
                            type="button"
                            className="spherexFindingDeleteBtn"
                            onClick={() => handleDeleteFinding(f.id)}
                            title={t('Eliminar este hallazgo', language)}
                          >
                            <Icons.Trash style={{ marginRight: '4px' }} />
                            {t('Eliminar', language)}
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Toast feedback */}
            {findingToast && (
              <div className="spherexToastNotification" role="status">
                <Icons.Check style={{ width: 16, height: 16, color: '#4ade80' }} />
                <span>{findingToast}</span>
                {viewMode !== 'findings' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('findings')}
                    className="spherexToastAction"
                  >
                    {t('Ver en Hallazgos', language)}
                  </button>
                )}
              </div>
            )}

            {error && (
              <p className="spherexError" role="alert">
                {t(error, language)}
              </p>
            )}

            {/* REGION 3: BOTTOM TIMELINE & PLAYBACK CONTROL BAR */}
            {viewMode === 'single' && (
              <div className="spherexBottomTimelineBar">
                <div className="spherexPlaybackToolbar">
                  <button
                    disabled={!visibleRecords.length}
                    onClick={() => step(-1)}
                    aria-label={t('Imagen anterior', language)}
                    title={t('Fecha anterior', language)}
                  >
                    <Icons.StepBack />
                  </button>
                  <button
                    className="spherexPlay"
                    disabled={visibleRecords.length < 2}
                    onClick={() => setPlaying(!playing)}
                    title={playing ? t('Pausar', language) : t('Reproducir', language)}
                  >
                    {playing ? (
                      <><Icons.Pause style={{ marginRight: '6px' }} />{t('Pausar', language)}</>
                    ) : (
                      <><Icons.Play style={{ marginRight: '6px' }} />{t('Reproducir', language)}</>
                    )}
                  </button>
                  <button
                    disabled={!visibleRecords.length}
                    onClick={() => step(1)}
                    aria-label={t('Imagen siguiente', language)}
                    title={t('Fecha siguiente', language)}
                  >
                    <Icons.StepForward />
                  </button>

                  <div className="spherexTimelineScrubber">
                    <input
                      className="spherexTimeline"
                      type="range"
                      min="0"
                      max={Math.max(0, visibleRecords.length - 1)}
                      value={Math.min(frameIndex, Math.max(0, visibleRecords.length - 1))}
                      onChange={(event) => {
                        setFrameIndex(Number(event.target.value));
                        setPlaying(false);
                      }}
                      disabled={!visibleRecords.length}
                      aria-label={t('Fecha de observación', language)}
                    />
                  </div>

                  <span className="spherexEpochCounter">
                    {visibleRecords.length ? `${frameIndex + 1} / ${visibleRecords.length}` : '0 / 0'}
                  </span>
                </div>

                {/* Filmstrip selector */}
                <div className="spherexFilmstrip">
                  {visibleRecords.map((record, index) => (
                    <button
                      key={`${record.id}-${record.band}-${record.date}`}
                      className={index === frameIndex ? 'active' : ''}
                      onClick={() => {
                        setFrameIndex(index);
                        setPlaying(false);
                      }}
                    >
                      <b>
                        {formatDate(record.dateAvg || record.date, language).replace(' UTC', '')}
                      </b>
                      <small>
                        {record.band} · {record.release.replace('spherex_', '').toUpperCase()}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </section>

      {/* EXPANDED IMAGE LIGHTBOX */}
      {expanded && image && (
        <div
          className="spherexLightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t('Imagen SPHEREx ampliada', language)}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExpanded(false);
          }}
        >
          <header>
            <div>
              <b>{t(selectedTarget.name, language)}</b>
              <span>
                {frame
                  ? formatDate(
                      frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date,
                      language,
                    )
                  : ''}{' '}
                · {frame ? formatBandLabel(frame.band, complexityLevel) : ''}
                {complexityLevel === 'technical' && formatSpectralBadge(frameDiagnostics)}
              </span>
            </div>
            <button type="button" onClick={() => setExpanded(false)}>
              <Icons.Close style={{ marginRight: '6px' }} />
              {t('Cerrar', language)}
            </button>
          </header>
          <img src={image} alt={`Imagen SPHEREx ampliada de ${t(selectedTarget.name, language)}`} />
        </div>
      )}

      {/* TECHNICAL AUDIT & LIMITATIONS MODAL */}
      {showTechDetailsModal && (
        <div
          className="spherexModalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowTechDetailsModal(false);
          }}
        >
          <div className="spherexAuditModal">
            <div className="spherexAuditModalHeader">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Warning className="spherexWarningColor" />
                <h3 id="audit-modal-title">
                  {t('Auditoría Científica & Limitaciones de Datos', language)} · {t(selectedTarget.name, language)}
                </h3>
              </div>
              <button
                type="button"
                className="spherexCloseIconBtn"
                onClick={() => setShowTechDetailsModal(false)}
                aria-label={t('Cerrar', language)}
              >
                <Icons.Close />
              </button>
            </div>
            <div className="spherexAuditModalBody">
              <div className="spherexAuditBadgeRow">
                <span className={`spherexAuditBadge ${selectedTarget.scientificStatus.toLowerCase()}`}>
                  {selectedTarget.statusBadge}
                </span>
                {selectedTarget.coverageStatus && (
                  <span className="spherexAuditBadge">{selectedTarget.coverageStatus}</span>
                )}
                {selectedTarget.dataQuality && (
                  <span className="spherexAuditBadge">{selectedTarget.dataQuality}</span>
                )}
              </div>
              <div className="spherexAuditText">
                {t(selectedTarget.scientificLimitations, language)}
              </div>
            </div>
            <div className="spherexAuditModalFooter">
              <button
                type="button"
                className="spherexPrimaryActionBtn"
                onClick={() => setShowTechDetailsModal(false)}
              >
                {t('Cerrar auditoría', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE HELP / ONBOARDING MODAL */}
      {showHelpModal && (
        <div
          className="spherexModalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowHelpModal(false);
          }}
        >
          <div className="spherexHelpModal">
            <div className="spherexHelpModalHeader">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Telescope className="spherexPrimaryColor" />
                <h3 id="help-modal-title">{t('¿Cómo explorar el Observatorio Digital KRONOX?', language)}</h3>
              </div>
              <button
                type="button"
                className="spherexCloseIconBtn"
                onClick={() => setShowHelpModal(false)}
                aria-label={t('Cerrar', language)}
              >
                <Icons.Close />
              </button>
            </div>
            <div className="spherexHelpModalBody">
              <div className="spherexHelpGrid">
                <div className="spherexHelpCard">
                  <div className="spherexHelpCardIcon"><Icons.Telescope /></div>
                  <h4>1. {t('Selecciona un objetivo', language)}</h4>
                  <p>{t('Elige entre enanas marrones ultrafrías, sistemas binarios o estrellas variables de referencia en el panel lateral.', language)}</p>
                </div>
                <div className="spherexHelpCard">
                  <div className="spherexHelpCardIcon"><Icons.Timeline /></div>
                  <h4>2. {t('Línea de tiempo', language)}</h4>
                  <p>{t('Observa las visitas sucesivas de SPHEREx. Usa los controles inferiores para avanzar paso a paso o reproducir una animación de la evolución temporal.', language)}</p>
                </div>
                <div className="spherexHelpCard">
                  <div className="spherexHelpCardIcon"><Icons.Blink /></div>
                  <h4>3. {t('Comparar épocas & Vista dual', language)}</h4>
                  <p>{t('Alterna rápidamente entre dos fechas (Blink) o colócalas lado a lado con zoom y paneo sincronizados para apreciar desplazamientos astrométricos.', language)}</p>
                </div>
                <div className="spherexHelpCard">
                  <div className="spherexHelpCardIcon"><Icons.Differential /></div>
                  <h4>4. {t('Mapa de diferencias y detección', language)}</h4>
                  <p>{t('Resta matemáticamente dos observaciones para cancelar el fondo estático e identificar fuentes variables o dipolos de movimiento propio con significancia estadística.', language)}</p>
                </div>
              </div>
            </div>
            <div className="spherexHelpModalFooter">
              <button
                type="button"
                className="spherexPrimaryActionBtn"
                onClick={() => setShowHelpModal(false)}
              >
                {t('Entendido, comenzar a explorar', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
