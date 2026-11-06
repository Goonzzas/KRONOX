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
import '../styles/expedition.css';

// Icons tailored to expedition/fieldwork aesthetics
const Icons = {
  Compass: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  Eye: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Layers: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.5-8.58 3.9a2 2 0 0 1-1.66 0L2 12.5" />
      <path d="m22 17.5-8.58 3.9a2 2 0 0 1-1.66 0L2 17.5" />
    </svg>
  ),
  Feather: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  ),
  Lightbulb: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  ),
  Award: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
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
  Close: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ChevronRight: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronLeft: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  Play: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Bookmark: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Trash: (props) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Download: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Info: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Warning: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Check: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

const STAGES = [
  { id: 'arrival', label: 'Llegada', icon: Icons.Compass },
  { id: 'explore', label: 'Exploración', icon: Icons.Eye },
  { id: 'compare', label: 'Observación temporal', icon: Icons.Layers },
  { id: 'investigate', label: 'Investigación', icon: Icons.Feather },
  { id: 'learn', label: 'Cuaderno de campo', icon: Icons.Lightbulb },
  { id: 'summary', label: 'Cierre de misión', icon: Icons.Award },
];

function formatDate(mjd, language = 'es') {
  const date = new Date((Number(mjd) - 40587) * 86400000);
  return Number.isNaN(date.getTime())
    ? 'Fecha desconocida'
    : date.toLocaleDateString(language === 'en' ? 'en-US' : 'es', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }) + ` (${date.toISOString().slice(11, 16)} UTC)`;
}

function imagePoint(event) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const stage = el.parentElement;
  const stageRect = stage?.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !stageRect?.width || !stageRect?.height) return null;

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

export default function SpherexMission({
  onClose,
  initialTargetKey = 'barnard',
  initialStage = 'arrival',
  language = 'es',
  onStateSync,
  onAskKronox,
  aiHighlightActive = false,
}) {
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
    TARGETS.findIndex((t) => t.key === effectiveTargetKey),
  );
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(initialTargetIndex);
  const target = TARGETS[selectedTargetIndex];

  // Progressive mission stage
  const [stage, setStage] = useState(initialStage || 'arrival');

  // Sync external target/stage changes triggered by AI or cockpit consoles
  useEffect(() => {
    const idx = TARGETS.findIndex((t) => t.key === initialTargetKey);
    if (idx >= 0 && idx !== selectedTargetIndex) {
      setSelectedTargetIndex(idx);
    }
  }, [initialTargetKey]);

  useEffect(() => {
    if (initialStage && STAGES.some((s) => s.id === initialStage)) {
      setStage(initialStage);
    }
  }, [initialStage]);

  // Temporal comparison style inside 'compare' stage: 'blink' | 'sideBySide' | 'diff'
  const [compareStyle, setCompareStyle] = useState('blink');
  const [blinkToggle, setBlinkToggle] = useState(false);
  const [playingBlink, setPlayingBlink] = useState(true);

  // Observations from real SPHEREx IRSA API
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [frameIndex, setFrameIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState(1);

  // Bloque 4.2: Temporal Archive Filtering (Year & Band)
  const [filterYear, setFilterYear] = useState('ALL');
  const [filterBand, setFilterBand] = useState('ALL');

  // Bloque 4.1: Progressive Discovery Challenge
  const [discoveryStep, setDiscoveryStep] = useState(1);
  const [discoveryVerification, setDiscoveryVerification] = useState(null);
  const [localAiBeacon, setLocalAiBeacon] = useState(false);

  useEffect(() => {
    if (aiHighlightActive) {
      setLocalAiBeacon(true);
    }
  }, [aiHighlightActive]);

  // Rendered FITS frames
  const [frameA, setFrameA] = useState(null);
  const [frameB, setFrameB] = useState(null);
  const [loadingFrameA, setLoadingFrameA] = useState(false);
  const [loadingFrameB, setLoadingFrameB] = useState(false);

  // Zoom and Pan
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  // Marking and Findings
  const [markingActive, setMarkingActive] = useState(false);
  const [activeMarker, setActiveMarker] = useState(null);
  const [findingText, setFindingText] = useState('');
  const [findingError, setFindingError] = useState('');
  const [findings, setFindings] = useState(() => loadFindingsFromStorage());
  const [toastMessage, setToastMessage] = useState('');
  const [showFindingsList, setShowFindingsList] = useState(false);

  // Ref caches for data queries and FITS decodes
  const searchTokenRef = useRef(0);
  const frameCacheRef = useRef(new Map());
  const stretchByBandRef = useRef(new Map());

  // Save findings whenever updated
  useEffect(() => {
    saveFindingsToStorage(findings);
  }, [findings]);

  // Synchronize live mission state with Onboard AI & Cockpit
  useEffect(() => {
    onStateSync?.({
      targetKey: target.key,
      stage,
      records,
      findings,
    });
  }, [target.key, stage, records, findings]);

  // Available years and bands in real SPHEREx records (Bloque 4.2)
  const availableYears = useMemo(() => {
    const yrs = new Set();
    records.forEach((r) => {
      const y = new Date((Number(r.dateAvg || r.date) - 40587) * 86400000).getUTCFullYear();
      if (Number.isFinite(y)) yrs.add(String(y));
    });
    return [...yrs].sort();
  }, [records]);

  const availableBands = useMemo(() => {
    const bds = new Set();
    records.forEach((r) => {
      if (r.band) bds.add(r.band);
    });
    return [...bds].sort();
  }, [records]);

  const filteredRecordEntries = useMemo(() => {
    return records
      .map((r, originalIndex) => {
        const y = String(new Date((Number(r.dateAvg || r.date) - 40587) * 86400000).getUTCFullYear());
        return { record: r, originalIndex, year: y };
      })
      .filter((entry) => {
        if (filterYear !== 'ALL' && entry.year !== filterYear) return false;
        if (filterBand !== 'ALL' && entry.record.band !== filterBand) return false;
        return true;
      });
  }, [records, filterYear, filterBand]);

  // Load observations when target changes
  useEffect(() => {
    let active = true;
    const fetchTargetObservations = async () => {
      const searchToken = ++searchTokenRef.current;
      setLoadingRecords(true);
      setRecordError('');
      setRecords([]);
      setFrameA(null);
      setFrameB(null);
      setFrameIndex(0);
      setCompareIndex(1);
      setActiveMarker(null);
      setMarkingActive(false);

      try {
        const res = await fetch(
          `/api/spherex?action=search&ra=${encodeURIComponent(target.ra)}&dec=${encodeURIComponent(target.dec)}&release=all`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudieron recuperar las observaciones.');
        if (!active || searchToken !== searchTokenRef.current) return;

        const unique = new Map();
        for (const r of data.records || []) {
          const key = `${r.id}|${r.band}`;
          const prev = unique.get(key);
          if (!prev || Number(r.priorityScore || 0) >= Number(prev.priorityScore || 0)) {
            unique.set(key, r);
          }
        }
        const sorted = [...unique.values()].sort(
          (a, b) => Number(a.dateAvg || a.date) - Number(b.dateAvg || b.date),
        );
        setRecords(sorted);
        if (sorted.length > 1) {
          setCompareIndex(sorted.length - 1);
        }
      } catch (err) {
        if (active && searchToken === searchTokenRef.current) {
          setRecordError(err.message || 'Error de conexión con el archivo astronómico.');
        }
      } finally {
        if (active && searchToken === searchTokenRef.current) {
          setLoadingRecords(false);
        }
      }
    };

    fetchTargetObservations();
    return () => {
      active = false;
    };
  }, [selectedTargetIndex]);

  // Helper to load parsed FITS frame
  const loadFits = async (record) => {
    if (!record) return null;
    const cacheKey = `${record.url}|${target.ra},${target.dec}|subtracted|measurement`;
    if (frameCacheRef.current.has(cacheKey)) {
      return frameCacheRef.current.get(cacheKey);
    }
    const params = new URLSearchParams({
      action: 'frame',
      url: record.url,
      center: `${target.ra},${target.dec}`,
    });
    const res = await fetch(`/api/spherex?${params}`);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || 'No se pudo decodificar el recorte FITS.');
    }
    const buffer = await res.arrayBuffer();
    const fixedRange = stretchByBandRef.current.get(record.band) || null;
    const parsed = parseFits(buffer, fixedRange, { ra: target.ra, dec: target.dec }, {
      zodiMode: 'subtracted',
      flagPolicy: 'measurement',
    });
    if (!stretchByBandRef.current.has(record.band)) {
      stretchByBandRef.current.set(record.band, parsed.range);
    }
    frameCacheRef.current.set(cacheKey, parsed);
    return parsed;
  };

  // Load Primary Frame (Frame A)
  useEffect(() => {
    let cancelled = false;
    if (!records.length) {
      setFrameA(null);
      return;
    }
    const rec = records[Math.min(frameIndex, records.length - 1)];
    if (!rec) return;

    setLoadingFrameA(true);
    loadFits(rec)
      .then((parsed) => {
        if (!cancelled && parsed) {
          setFrameA({
            record: rec,
            ...parsed,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setRecordError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingFrameA(false);
      });

    return () => {
      cancelled = true;
    };
  }, [records, frameIndex]);

  // Load Compare Frame (Frame B)
  useEffect(() => {
    let cancelled = false;
    if (records.length < 2) {
      setFrameB(null);
      return;
    }
    const rec = records[Math.min(compareIndex, records.length - 1)];
    if (!rec) return;

    setLoadingFrameB(true);
    loadFits(rec)
      .then((parsed) => {
        if (!cancelled && parsed) {
          setFrameB({
            record: rec,
            ...parsed,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn('Could not load compare frame:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingFrameB(false);
      });

    return () => {
      cancelled = true;
    };
  }, [records, compareIndex]);

  // Blink timer
  useEffect(() => {
    if (stage !== 'compare' || compareStyle !== 'blink' || !playingBlink || !frameB) return;
    const interval = setInterval(() => {
      setBlinkToggle((prev) => !prev);
    }, 650);
    return () => clearInterval(interval);
  }, [stage, compareStyle, playingBlink, frameB]);

  // Difference map computation
  const diffImage = useMemo(() => {
    if (stage !== 'compare' || compareStyle !== 'diff' || !frameA?.scientificPixels || !frameB?.scientificPixels) {
      return null;
    }
    try {
      const res = computeDifferentialImage(frameA, frameB, { manualAlpha: 1.0, manualBackground: 0.0 });
      const dataUrl = renderDivergingColormap(res.diffPixels, res.width, res.height, { threshold: 4.0 });
      return { ...res, dataUrl };
    } catch (e) {
      return null;
    }
  }, [stage, compareStyle, frameA, frameB]);

  // Astrometric coordinate propagation for current frames
  const predictedMarkerA = useMemo(() => {
    if (!target.astrometry || !frameA?.record || !frameA?.reprojected) return null;
    const mjd = Number(frameA.record.dateAvg || frameA.record.date);
    const prop = propagateCoordinates(target.astrometry, mjd);
    if (!prop) return null;
    const grid = frameA.reprojected.worldToGrid(prop.ra, prop.dec);
    if (!grid || grid.xPercent < 0 || grid.xPercent > 100) return null;
    return { ...prop, mjd, xPercent: grid.xPercent, yPercent: grid.yPercent };
  }, [target, frameA]);

  const predictedMarkerB = useMemo(() => {
    if (!target.astrometry || !frameB?.record || !frameB?.reprojected) return null;
    const mjd = Number(frameB.record.dateAvg || frameB.record.date);
    const prop = propagateCoordinates(target.astrometry, mjd);
    if (!prop) return null;
    const grid = frameB.reprojected.worldToGrid(prop.ra, prop.dec);
    if (!grid || grid.xPercent < 0 || grid.xPercent > 100) return null;
    return { ...prop, mjd, xPercent: grid.xPercent, yPercent: grid.yPercent };
  }, [target, frameB]);

  // Time delta between observations
  const timeDeltaDays = useMemo(() => {
    if (!frameA?.record || !frameB?.record) return null;
    const d1 = Number(frameA.record.dateAvg || frameA.record.date);
    const d2 = Number(frameB.record.dateAvg || frameB.record.date);
    return Math.abs(d2 - d1);
  }, [frameA, frameB]);

  // Drag handlers for pan
  const handleMouseDown = (e) => {
    if (zoom <= 1.0) return;
    setIsDragging(true);
    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(4.0, z * 1.3));
  const handleZoomOut = () => setZoom((z) => {
    const next = Math.max(1.0, z / 1.3);
    if (next === 1.0) setPan({ x: 0, y: 0 });
    return next;
  });
  const handleZoomReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Image click marking handler
  const handleImageClick = (event, pane = 'A') => {
    if (!markingActive && !activeMarker) return;
    const pt = imagePoint(event);
    if (!pt) return;

    const diag = pane === 'B' ? frameB : frameA;
    const w = diag?.width || 300;
    const h = diag?.height || 300;
    const pixelX = Math.min(w - 1, Math.round(pt.imageX * (w - 1)));
    const pixelY = Math.min(h - 1, Math.round(pt.imageY * (h - 1)));
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
        console.warn('WCS gridToWorld error:', err);
      }
    }

    setActiveMarker({
      xPercent: pt.x,
      yPercent: pt.y,
      pixelX,
      pixelY,
      ra,
      dec,
      pane,
      frameId: pane === 'B' ? frameB?.record?.id : frameA?.record?.id,
    });
    setMarkingActive(false);
    setFindingError('');

    // Bloque 4.1: Verificación honesta contra coordenadas propagadas del catálogo (Gaia/CatWISE)
    if (ra !== null && dec !== null) {
      const mjd = Number((pane === 'B' ? frameB : frameA)?.record?.dateAvg || target.referenceEpoch);
      const prop = propagateCoordinates(target.astrometry, mjd) || { ra: target.ra, dec: target.dec };
      const dRa = (ra - prop.ra) * Math.cos(((dec + prop.dec) * 0.5 * Math.PI) / 180) * 3600;
      const dDec = (dec - prop.dec) * 3600;
      const angularSepArcsec = Math.hypot(dRa, dDec);
      const isTargetMatch = angularSepArcsec <= 24;
      setDiscoveryVerification({
        angularSepArcsec: Number(angularSepArcsec.toFixed(1)),
        isTargetMatch,
        message: isTargetMatch
          ? `¡Verificación positiva! El punto marcado coincide a ${angularSepArcsec.toFixed(1)}″ con la posición astrométrica propagada de ${target.name} (${target.astrometry?.source || 'Catálogo'}).`
          : `Has marcado una fuente periférica de campo a ${angularSepArcsec.toFixed(1)}″ del objetivo central. Excelente como estrella fija de referencia para contrastar el fondo.`,
      });
    }
  };

  // Save finding handler
  const handleSaveFinding = () => {
    if (!findingText.trim()) {
      setFindingError('Escribe una nota breve describiendo lo que observas antes de guardar.');
      return;
    }
    if (!frameA?.record) {
      setFindingError('No hay observación cargada.');
      return;
    }

    try {
      const record = createFindingRecord({
        target,
        frame: frameA.record,
        compareFrame: frameB?.record || null,
        marker: activeMarker,
        description: findingText,
        viewMode: stage === 'compare' ? (compareStyle === 'sideBySide' ? 'sideBySide' : 'blink') : 'single',
        diagnostics: activeMarker?.pane === 'B' ? frameB : frameA,
        timeDeltaDays,
      });

      setFindings((prev) => [record, ...prev]);
      setFindingText('');
      setActiveMarker(null);
      setFindingError('');
      setToastMessage('Hallazgo anotado en tu cuaderno de expedición');
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      setFindingError(err.message || 'Error al guardar el hallazgo.');
    }
  };

  const handleDeleteFinding = (id) => {
    if (typeof window !== 'undefined' && window.confirm && !window.confirm('¿Deseas eliminar este registro de tu cuaderno?')) {
      return;
    }
    const updated = deleteFindingFromStorage(id);
    setFindings(updated);
    setToastMessage('Registro eliminado');
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleExportCSV = () => {
    if (!findings.length) return;
    const quote = (val) => `"${String(val ?? '').replaceAll('"', '""')}"`;
    const headers = ['ID', 'Estrella', 'Fecha Creación', 'Anotación', 'Modo', 'Banda', 'Obs 1', 'Fecha Obs 1', 'Obs 2', 'Fecha Obs 2', 'Delta t (días)', 'Pixel X', 'Pixel Y', 'RA (deg)', 'Dec (deg)'];
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
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KRONOX_Cuaderno_Mision_${target.key}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Active displayed image in Explore / Blink
  const activeImageSrc =
    stage === 'compare' && compareStyle === 'blink' && blinkToggle && frameB
      ? frameB.src
      : frameA?.src;

  const activeMarkerToShow =
    stage === 'compare' && compareStyle === 'blink' && blinkToggle && frameB
      ? predictedMarkerB
      : predictedMarkerA;

  // Change target
  const handleSwitchTarget = (newIdx) => {
    setSelectedTargetIndex(newIdx);
    setStage('arrival');
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="kronoxExpeditionShade" role="dialog" aria-modal="true">
      <div className="kronoxExpeditionSheet">
        {/* EXPEDITION HEADER */}
        <header className="kronoxExpeditionHeader">
          <div className="kronoxHeaderBadge">
            <span className="kronoxCompassIcon"><Icons.Compass /></span>
            <div className="kronoxHeaderText">
              <span className="kronoxHeaderSub">EXPEDICIÓN CIENTÍFICA SPHEREx</span>
              <h2 className="kronoxHeaderTitle">{t(target.name, language)}</h2>
            </div>
          </div>

          {/* Quick Target Switcher */}
          <div className="kronoxTargetSelector">
            <label htmlFor="target-select" className="sr-only">Seleccionar estrella</label>
            <select
              id="target-select"
              value={selectedTargetIndex}
              onChange={(e) => handleSwitchTarget(Number(e.target.value))}
              className="kronoxTargetDropdown"
            >
              {TARGETS.map((tgt, i) => (
                <option key={tgt.key} value={i}>
                  {t(tgt.name, language)} {tgt.scientificStatus === 'WARNING' ? '⚠' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Close Expedition Button */}
          <button
            type="button"
            className="kronoxCloseButton"
            onClick={onClose}
            title="Regresar a la nave y al universo 3D"
          >
            <Icons.Close />
            <span className="kronoxCloseLabel">Regresar al espacio 3D</span>
          </button>
        </header>

        {/* PROGRESSIVE JOURNEY ROADMAP */}
        <nav className="kronoxExpeditionStages" aria-label="Etapas de la expedición">
          {STAGES.map((s, idx) => {
            const IconComponent = s.icon;
            const isActive = stage === s.id;
            const stageIndex = STAGES.findIndex((item) => item.id === stage);
            const isCompleted = idx < stageIndex;

            return (
              <button
                key={s.id}
                type="button"
                className={`kronoxStageTab ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => setStage(s.id)}
              >
                <span className="kronoxStageStep">{idx + 1}</span>
                <span className="kronoxStageIcon"><IconComponent /></span>
                <span className="kronoxStageName">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* MAIN MISSION WORKSPACE */}
        <main className="kronoxExpeditionWorkspace">
          {/* ========================================================= */}
          {/* ETAPA A: LLEGADA */}
          {/* ========================================================= */}
          {stage === 'arrival' && (
            <div className="kronoxArrivalCard">
              <div className="kronoxArrivalPlaque">
                <span className="kronoxPlaqueEmblem"><Icons.Compass /></span>
                <span className="kronoxPlaqueSubtitle">DESTINO ALCANZADO TRAS EL SALTO</span>
                <h1 className="kronoxPlaqueTitle">{t(target.name, language)}</h1>
                <div className="kronoxPlaqueCoordinates">
                  <span>RA: {target.ra.toFixed(4)}°</span>
                  <span className="dot">·</span>
                  <span>DEC: {target.dec.toFixed(4)}°</span>
                  <span className="dot">·</span>
                  <span>Distancia: {target.distanceLabel}</span>
                </div>
              </div>

              <div className="kronoxArrivalBriefing">
                <h3>Cuaderno de Misión</h3>
                <p className="kronoxBriefingGoal">
                  {target.mission === 'motion'
                    ? 'Tu objetivo es observar y comprobar si esta estrella presenta desplazamiento o movimiento propio en el cielo entre diferentes épocas.'
                    : 'Tu objetivo es examinar las variaciones temporales en el brillo y flujo infrarrojo de esta estrella variable.'}
                </p>

                <div className="kronoxBriefingDetails">
                  <div className="kronoxBriefingItem">
                    <strong>¿Qué observarás?</strong>
                    <span>Imágenes infrarrojas tomadas por el telescopio espacial SPHEREx de la NASA en distintas fechas.</span>
                  </div>
                  <div className="kronoxBriefingItem">
                    <strong>Estado científico:</strong>
                    <span>
                      {target.scientificStatus === 'WARNING'
                        ? '⚠ Advertencia científica: objeto sub-umbral que exige análisis riguroso de ruido.'
                        : target.scientificStatus === 'SENSIBLE'
                        ? 'Binaria no resuelta espacialmente; consistencia condicionada al jitter instrumental.'
                        : 'Astrometría confirmada y calibrada con Gaia.'}
                    </span>
                  </div>
                </div>

                <div className="kronoxArrivalAction">
                  <button
                    type="button"
                    className="kronoxPrimaryActionBtn"
                    onClick={() => setStage('explore')}
                  >
                    <span>Abrir primera observación infrarroja</span>
                    <Icons.ChevronRight />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* ETAPAS B, C, D: CANVAS ASTRONÓMICO Y OBSERVACIÓN */}
          {/* ========================================================= */}
          {(stage === 'explore' || stage === 'compare' || stage === 'investigate') && (
            <div className="kronoxObservationView">
              {/* Context Ribbon for Current Stage */}
              <div className="kronoxStageRibbon">
                <div className="kronoxRibbonText">
                  {stage === 'explore' && (
                    <>
                      <strong>Etapa de Exploración:</strong> Examina la imagen astronómica real. Usa los controles de zoom para acercarte o arrastra con el ratón.
                    </>
                  )}
                  {stage === 'compare' && (
                    <>
                      <strong>Observación Temporal:</strong> {timeDeltaDays !== null ? `Comparando observaciones separadas por ${(timeDeltaDays / 365.25).toFixed(1)} años (${timeDeltaDays.toFixed(0)} días).` : 'Cargando segunda época...'}
                    </>
                  )}
                  {stage === 'investigate' && (
                    <>
                      <strong>Investigación Directa:</strong> Haz clic sobre la imagen para fijar un punto de interés o anota lo que descubres.
                    </>
                  )}
                </div>

                {/* Stage-Specific Quick Action */}
                <div className="kronoxRibbonControls">
                  {stage === 'explore' && (
                    <button
                      type="button"
                      className="kronoxRibbonBtn highlight"
                      onClick={() => setStage('compare')}
                      disabled={records.length < 2}
                    >
                      <span>Comparar con otra fecha</span>
                      <Icons.ChevronRight />
                    </button>
                  )}

                  {stage === 'compare' && (
                    <div className="kronoxCompareModes">
                      <button
                        type="button"
                        className={`kronoxMiniTab ${compareStyle === 'blink' ? 'active' : ''}`}
                        onClick={() => setCompareStyle('blink')}
                      >
                        Alternar épocas
                      </button>
                      <button
                        type="button"
                        className={`kronoxMiniTab ${compareStyle === 'sideBySide' ? 'active' : ''}`}
                        onClick={() => setCompareStyle('sideBySide')}
                      >
                        Lado a lado
                      </button>
                      <button
                        type="button"
                        className={`kronoxMiniTab ${compareStyle === 'diff' ? 'active' : ''}`}
                        onClick={() => setCompareStyle('diff')}
                      >
                        Diferencia
                      </button>
                      <button
                        type="button"
                        className="kronoxRibbonBtn highlight"
                        onClick={() => setStage('investigate')}
                      >
                        <span>Anotar hallazgo</span>
                        <Icons.ChevronRight />
                      </button>
                    </div>
                  )}

                  {stage === 'investigate' && (
                    <button
                      type="button"
                      className={`kronoxRibbonBtn ${markingActive ? 'active' : ''}`}
                      onClick={() => setMarkingActive((prev) => !prev)}
                    >
                      <Icons.Bookmark />
                      <span>{markingActive ? 'Modo marcado activado (haz clic)' : 'Marcar punto en la imagen'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ASTRONOMICAL STAGE CONTAINER */}
              <div className="kronoxCanvasArea">
                {/* Visual Canvas */}
                {/* Sección 5: Indicación visual de la IA sobre el campo estelar (visible incluso mientras carga el FITS) */}
                {(localAiBeacon || stage === 'investigate') && (
                  <div
                    className={`kronoxAiFieldBeacon ${localAiBeacon ? 'is-pulsing' : ''}`}
                    style={{
                      left: `${activeMarkerToShow ? activeMarkerToShow.xPercent : 50}%`,
                      top: `${activeMarkerToShow ? activeMarkerToShow.yPercent : 50}%`,
                    }}
                    title="Región señalada por Kronox IA"
                  >
                    <span className="kronoxBeaconRingOuter" />
                    <span className="kronoxBeaconRingInner" />
                    <small className="kronoxBeaconTag">
                      {discoveryStep === 1
                        ? 'Pista 1: Busca estrellas fijas alrededor'
                        : discoveryStep === 2
                          ? 'Pista 2: Región de movimiento / flujo'
                          : 'Pista 3: Haz clic para verificar WCS'}
                    </small>
                  </div>
                )}
                {loadingFrameA ? (
                  <div className="kronoxLoadingPlate">
                    <span className="kronoxSpinner" />
                    <span>Cargando producto FITS real de SPHEREx...</span>
                  </div>
                ) : recordError ? (
                  <div className="kronoxErrorPlate">
                    <Icons.Warning />
                    <span>{recordError}</span>
                  </div>
                ) : (
                  <>
                    {/* 1. SINGLE / BLINK VIEW */}
                    {(stage !== 'compare' || compareStyle === 'blink') && (
                      <div
                        className="kronoxSingleStage"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                      >
                        {activeImageSrc && (
                          <div
                            className="kronoxTransformWrapper"
                            style={{
                              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                              transformOrigin: 'center center',
                            }}
                          >
                            <div className="kronoxImageFrame">
                              <img
                                src={activeImageSrc}
                                alt="Observación astronómica SPHEREx"
                                className={`kronoxFitsImage ${markingActive ? 'markable' : ''}`}
                                onClick={(e) => handleImageClick(e, stage === 'compare' && blinkToggle ? 'B' : 'A')}
                              />
                              {/* Central Reticle */}
                              <div className="kronoxReticle">
                                <span className="kronoxReticleRing" />
                              </div>

                              {/* Predicted astrometric marker */}
                              {activeMarkerToShow && (
                                <span
                                  className="kronoxPredictedTarget"
                                  style={{
                                    left: `${activeMarkerToShow.xPercent}%`,
                                    top: `${activeMarkerToShow.yPercent}%`,
                                  }}
                                  title="Posición astrométrica predicha"
                                />
                              )}

                              {/* User Marked Point */}
                              {activeMarker && (
                                <div
                                  className="kronoxUserPin"
                                  style={{
                                    left: `${activeMarker.xPercent}%`,
                                    top: `${activeMarker.yPercent}%`,
                                  }}
                                >
                                  <span className="kronoxPinPulse" />
                                  <span className="kronoxPinDot" />
                                  <span className="kronoxPinBadge">
                                    {activeMarker.ra !== null
                                      ? `RA ${activeMarker.ra.toFixed(4)}°, Dec ${activeMarker.dec.toFixed(4)}°`
                                      : `Píxel (${activeMarker.pixelX}, ${activeMarker.pixelY})`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Floating Date Badge */}
                        <div className="kronoxDateStamp">
                          <span className="kronoxDateStampLabel">
                            {stage === 'compare' && compareStyle === 'blink'
                              ? (blinkToggle ? 'Época B' : 'Época A')
                              : 'Observación actual'}
                          </span>
                          <b>
                            {stage === 'compare' && compareStyle === 'blink' && blinkToggle && frameB
                              ? formatDate(frameB.record.dateAvg || frameB.record.date, language)
                              : frameA
                              ? formatDate(frameA.record.dateAvg || frameA.record.date, language)
                              : '---'}
                          </b>
                          {stage === 'compare' && compareStyle === 'blink' && (
                            <button
                              type="button"
                              className="kronoxBlinkTogglePlay"
                              onClick={() => setPlayingBlink((p) => !p)}
                            >
                              {playingBlink ? <Icons.Pause /> : <Icons.Play />}
                              <span>{playingBlink ? 'Pausar' : 'Reanudar'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. SIDE-BY-SIDE VIEW */}
                    {stage === 'compare' && compareStyle === 'sideBySide' && (
                      <div className="kronoxSideBySideStage">
                        <div className="kronoxDualPane">
                          <div className="kronoxPaneHeader">
                            <span>Época A: {frameA ? formatDate(frameA.record.dateAvg || frameA.record.date, language) : ''}</span>
                          </div>
                          <div
                            className="kronoxPaneCanvas"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                          >
                            {frameA && (
                              <div
                                className="kronoxTransformWrapper"
                                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                              >
                                <div className="kronoxImageFrame">
                                  <img
                                    src={frameA.src}
                                    alt="Época A"
                                    className={markingActive ? 'markable' : ''}
                                    onClick={(e) => handleImageClick(e, 'A')}
                                  />
                                  {predictedMarkerA && (
                                    <span
                                      className="kronoxPredictedTarget"
                                      style={{ left: `${predictedMarkerA.xPercent}%`, top: `${predictedMarkerA.yPercent}%` }}
                                    />
                                  )}
                                  {activeMarker && (
                                    <div
                                      className="kronoxUserPin"
                                      style={{ left: `${activeMarker.xPercent}%`, top: `${activeMarker.yPercent}%` }}
                                    >
                                      <span className="kronoxPinPulse" />
                                      <span className="kronoxPinDot" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="kronoxDualPane">
                          <div className="kronoxPaneHeader">
                            <span>Época B: {frameB ? formatDate(frameB.record.dateAvg || frameB.record.date, language) : ''}</span>
                          </div>
                          <div
                            className="kronoxPaneCanvas"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                          >
                            {frameB && (
                              <div
                                className="kronoxTransformWrapper"
                                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                              >
                                <div className="kronoxImageFrame">
                                  <img
                                    src={frameB.src}
                                    alt="Época B"
                                    className={markingActive ? 'markable' : ''}
                                    onClick={(e) => handleImageClick(e, 'B')}
                                  />
                                  {predictedMarkerB && (
                                    <span
                                      className="kronoxPredictedTarget"
                                      style={{ left: `${predictedMarkerB.xPercent}%`, top: `${predictedMarkerB.yPercent}%` }}
                                    />
                                  )}
                                  {activeMarker && (
                                    <div
                                      className="kronoxUserPin"
                                      style={{ left: `${activeMarker.xPercent}%`, top: `${activeMarker.yPercent}%` }}
                                    >
                                      <span className="kronoxPinPulse" />
                                      <span className="kronoxPinDot" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. DIFFERENCE VIEW */}
                    {stage === 'compare' && compareStyle === 'diff' && (
                      <div className="kronoxDiffStage">
                        {diffImage?.dataUrl ? (
                          <div
                            className="kronoxTransformWrapper"
                            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                          >
                            <div className="kronoxImageFrame">
                              <img src={diffImage.dataUrl} alt="Mapa de sustracción diferencial" />
                            </div>
                          </div>
                        ) : (
                          <div className="kronoxLoadingPlate">
                            <span className="kronoxSpinner" />
                            <span>Calculando sustracción de imágenes...</span>
                          </div>
                        )}
                        <div className="kronoxDiffLegend">
                          <span className="c-blue">■ Exceso en Época A</span>
                          <span className="c-gray">■ Fondo idéntico</span>
                          <span className="c-red">■ Exceso en Época B</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Floating Optical Navigation Controls */}
                <div className="kronoxOpticalControls">
                  <button type="button" onClick={handleZoomIn} title="Acercar">
                    <Icons.ZoomIn />
                  </button>
                  <button type="button" onClick={handleZoomOut} title="Alejar">
                    <Icons.ZoomOut />
                  </button>
                  <button type="button" onClick={handleZoomReset} title="Restablecer encuadre">
                    <Icons.ZoomReset />
                  </button>
                  <span className="kronoxZoomValue">{zoom.toFixed(1)}x</span>
                </div>
              </div>

              {/* BLOQUE 4.2: ARCHIVO TEMPORAL SPHEREx CON FILTROS POR INTERVALO Y BANDA */}
              <div className="kronoxTimelineBar">
                <div className="kronoxTimelineHeaderRow">
                  <span className="kronoxTimelineLabel">
                    Archivo Temporal SPHEREx ({filteredRecordEntries.length} de {records.length} observaciones reales):
                  </span>
                  <div className="kronoxArchiveFilters">
                    <label className="kronoxArchiveFilterLabel">
                      <span>Año:</span>
                      <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        aria-label="Filtrar observaciones por año"
                      >
                        <option value="ALL">Todos ({records.length})</option>
                        {availableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="kronoxArchiveFilterLabel">
                      <span>Banda:</span>
                      <select
                        value={filterBand}
                        onChange={(e) => setFilterBand(e.target.value)}
                        aria-label="Filtrar observaciones por banda infrarroja"
                      >
                        <option value="ALL">Todas ({availableBands.length})</option>
                        {availableBands.map((bd) => (
                          <option key={bd} value={bd}>
                            {bd}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="kronoxTimelineChips">
                  {filteredRecordEntries.map(({ record: r, originalIndex: idx }) => (
                    <button
                      key={r.id || idx}
                      type="button"
                      className={`kronoxDateChip ${idx === frameIndex ? 'primary' : ''} ${idx === compareIndex && stage === 'compare' ? 'secondary' : ''}`}
                      onClick={() => {
                        if (stage === 'compare' && idx !== frameIndex) {
                          setCompareIndex(idx);
                        } else {
                          setFrameIndex(idx);
                        }
                      }}
                    >
                      <span>{formatDate(r.dateAvg || r.date, language)}</span>
                      <small className="kronoxChipBand">{r.band}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* BLOQUE 4.1: RETO DE DESCUBRIMIENTO PROGRESIVO + REGISTRAR HALLAZGO */}
              {stage === 'investigate' && (
                <div className="kronoxFindingDrawer">
                  <div className="kronoxDiscoveryChallengeBox">
                    <div className="kronoxDiscoveryTop">
                      <strong>Reto de identificación astronómica (Paso {discoveryStep}/3)</strong>
                      <div className="kronoxDiscoveryStepBtns">
                        {[1, 2, 3].map((st) => (
                          <button
                            key={st}
                            type="button"
                            className={discoveryStep === st ? 'active' : ''}
                            onClick={() => setDiscoveryStep(st)}
                          >
                            Pista {st}
                          </button>
                        ))}
                        {onAskKronox && (
                          <button
                            type="button"
                            className="kronoxAskAiBtn"
                            onClick={() => {
                              setLocalAiBeacon(true);
                              onAskKronox('Dame una pista para identificar el objeto');
                            }}
                          >
                            Señalar en campo (Kronox IA 3D)
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="kronoxDiscoveryClue">
                      {discoveryStep === 1 &&
                        'Paso 1 (Referencia fija): Localiza una estrella periférica brillante en el campo que permanezca inmóvil y con brillo constante entre fechas.'}
                      {discoveryStep === 2 &&
                        (target.mission === 'motion'
                          ? `Paso 2 (Rastreo de movimiento): Dirige la mirada al centro del retículo (RA ${target.ra.toFixed(3)}°, Dec ${target.dec.toFixed(3)}°) y comprueba cómo ${target.name} se desplaza respecto al fondo fijo.`
                          : `Paso 2 (Variabilidad fotométrica): Observa el flujo infrarrojo central de ${target.name} y compara su radio e intensidad entre la primera y la última fecha del archivo.`)}
                      {discoveryStep === 3 &&
                        `Paso 3 (Verificación científica): Activa «Marcar punto en la imagen», haz clic sobre la fuente en el lienzo para contrastar su coordenada WCS con ${target.astrometry?.source || 'Gaia DR3'} y guarda tu hallazgo.`}
                    </p>
                    {discoveryVerification && (
                      <div
                        className={`kronoxDiscoveryVerifyBanner ${discoveryVerification.isTargetMatch ? 'match' : 'reference'}`}
                      >
                        <span>{discoveryVerification.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="kronoxDrawerHeader">
                    <Icons.Feather />
                    <span>Registrar hallazgo en tu cuaderno de expedición</span>
                  </div>

                  {activeMarker && (
                    <div className="kronoxMarkerDetails">
                      <span>Coordenada fijada:</span>
                      <b>
                        {activeMarker.ra !== null
                          ? `RA ${activeMarker.ra.toFixed(4)}°, Dec ${activeMarker.dec.toFixed(4)}°`
                          : `Píxel (${activeMarker.pixelX}, ${activeMarker.pixelY})`}
                      </b>
                      <button
                        type="button"
                        className="kronoxClearMarkerBtn"
                        onClick={() => setActiveMarker(null)}
                      >
                        Quitar marca
                      </button>
                    </div>
                  )}

                  <div className="kronoxDrawerInputRow">
                    <input
                      type="text"
                      className="kronoxDrawerInput"
                      placeholder="Describe qué cambio, brillo o movimiento observas..."
                      value={findingText}
                      onChange={(e) => {
                        setFindingText(e.target.value);
                        if (findingError) setFindingError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveFinding();
                      }}
                      maxLength={300}
                    />
                    <button
                      type="button"
                      className="kronoxSaveBtn"
                      onClick={handleSaveFinding}
                    >
                      Guardar hallazgo
                    </button>
                  </div>

                  {findingError && (
                    <div className="kronoxFindingError">
                      <Icons.Warning />
                      <span>{findingError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* ETAPA E: CUADERNO DE APRENDIZAJE */}
          {/* ========================================================= */}
          {stage === 'learn' && (
            <div className="kronoxNotebookView">
              <div className="kronoxNotebookHeader">
                <Icons.Lightbulb />
                <h2>Guía de Campo e Interpretación</h2>
                <p>Comprende la física detrás de lo observado en {t(target.name, language)}.</p>
              </div>

              <div className="kronoxNotebookCards">
                <article className="kronoxNoteCard">
                  <div className="kronoxNoteNumber">01</div>
                  <div className="kronoxNoteContent">
                    <h3>¿Por qué parpadean o se mueven los objetos?</h3>
                    <p>
                      Las estrellas más cercanas al Sistema Solar, como la <strong>Estrella de Barnard</strong> o <strong>Epsilon Indi</strong>, poseen una velocidad tangencial apreciable en la esfera celeste. Al comparar observaciones separadas por uno o dos años, su posición cambia varios píxeles respecto a las estrellas de fondo, que están a miles de años luz.
                    </p>
                  </div>
                </article>

                <article className="kronoxNoteCard">
                  <div className="kronoxNoteNumber">02</div>
                  <div className="kronoxNoteContent">
                    <h3>¿Qué revelan los cambios de brillo?</h3>
                    <p>
                      Estrellas como <strong>RW Aurigae</strong> (T Tauri joven) o <strong>R Draconis</strong> (variable pulsante Mira) cambian de temperatura y tamaño periódicamente. En el infrarrojo de SPHEREx, la cantidad de fotones captados por el detector varía notablemente, permitiendo rastrear su ciclo de luminosidad.
                    </p>
                  </div>
                </article>

                <article className="kronoxNoteCard">
                  <div className="kronoxNoteNumber">03</div>
                  <div className="kronoxNoteContent">
                    <h3>Diferencia entre ver y confirmar científicamente</h3>
                    <p>
                      Una fluctuación en una imagen puede deberse a ruido instrumental o radiación zodiacal. Para confirmar un descubrimiento, los astrónomos contrastan la detección con modelos astrométricos de referencia (como Gaia DR3) y calculan la probabilidad de falsa alarma.
                    </p>
                  </div>
                </article>
              </div>

              <div className="kronoxNotebookFooter">
                <button
                  type="button"
                  className="kronoxPrimaryActionBtn"
                  onClick={() => setStage('summary')}
                >
                  <span>Revisar balance de misión y hallazgos</span>
                  <Icons.ChevronRight />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* ETAPA F: CIERRE Y RESUMEN DE MISIÓN */}
          {/* ========================================================= */}
          {stage === 'summary' && (
            <div className="kronoxSummaryView">
              <div className="kronoxSummaryBadge">
                <Icons.Award />
                <h2>Expedición Completada: {t(target.name, language)}</h2>
                <p>Registro de actividad y hallazgos guardados en esta misión.</p>
              </div>

              {/* Status distinction */}
              <div className="kronoxSummaryStatusBox">
                <div className="kronoxStatusCol">
                  <small>ESTADO DE LA ACTIVIDAD</small>
                  <b>Misión exploratoria completada con éxito</b>
                </div>
                <div className="kronoxStatusCol">
                  <small>OBSERVACIONES CONSULTADAS</small>
                  <b>{records.length} productos FITS reales de SPHEREx</b>
                </div>
                <div className="kronoxStatusCol">
                  <small>VALIDACIÓN CIENTÍFICA OFICIAL</small>
                  <b>
                    {target.scientificStatus === 'VALIDADO'
                      ? 'Confirmado por Gaia DR3'
                      : target.scientificStatus === 'SENSIBLE'
                      ? 'Binaria condicional'
                      : 'Sub-umbral (WARNING)'}
                  </b>
                </div>
              </div>

              {/* Saved findings section */}
              <div className="kronoxSummaryFindingsSection">
                <div className="kronoxSummaryFindingsHeader">
                  <h3>Tus Hallazgos Anotados ({findings.filter((f) => f.targetKey === target.key).length} en esta estrella)</h3>
                  {findings.length > 0 && (
                    <button
                      type="button"
                      className="kronoxExportBtn"
                      onClick={handleExportCSV}
                    >
                      <Icons.Download />
                      <span>Exportar cuaderno (.CSV)</span>
                    </button>
                  )}
                </div>

                <div className="kronoxFindingsList">
                  {findings.length === 0 ? (
                    <div className="kronoxNoFindings">
                      <p>No guardaste anotaciones manuales en esta misión. Puedes volver a la etapa de Investigación para marcar cualquier punto de interés.</p>
                    </div>
                  ) : (
                    findings.map((f) => (
                      <div key={f.id} className="kronoxFindingItem">
                        <div className="kronoxFindingMeta">
                          <span className="kronoxFindingTarget">{f.targetName}</span>
                          <span className="kronoxFindingDate">{f.frameDate1}</span>
                          {f.marker?.ra !== null && f.marker?.ra !== undefined && (
                            <span className="kronoxFindingCoords">
                              RA {f.marker.ra.toFixed(4)}°, Dec {f.marker.dec.toFixed(4)}°
                            </span>
                          )}
                        </div>
                        <p className="kronoxFindingDesc">{f.description}</p>
                        <button
                          type="button"
                          className="kronoxDeleteBtn"
                          onClick={() => handleDeleteFinding(f.id)}
                          title="Eliminar este hallazgo"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="kronoxSummaryActions">
                <button
                  type="button"
                  className="kronoxSecondaryActionBtn"
                  onClick={() => setStage('explore')}
                >
                  Volver a observar este objetivo
                </button>
                <button
                  type="button"
                  className="kronoxPrimaryActionBtn"
                  onClick={onClose}
                >
                  <span>Finalizar y volver al universo 3D</span>
                  <Icons.ChevronRight />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* NOTIFICATION TOAST */}
        {toastMessage && (
          <div className="kronoxExpeditionToast" role="status">
            <Icons.Check />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
