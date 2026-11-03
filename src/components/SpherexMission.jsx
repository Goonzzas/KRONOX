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
import { t } from '../i18n.js';

const BAND_SPECS_BY_NAME = Object.fromEntries(
  Object.values(SPHEREX_DETECTOR_SPECS).map((spec) => [spec.band, spec]),
);

function formatBandLabel(bandName) {
  const spec = BAND_SPECS_BY_NAME[bandName];
  if (!spec) return bandName;
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
  const img = event.currentTarget;
  const rect = img.getBoundingClientRect();
  const ratio = img.naturalWidth / img.naturalHeight || rect.width / rect.height;
  const boxRatio = rect.width / rect.height;
  const width = ratio > boxRatio ? rect.width : rect.height * ratio;
  const height = ratio > boxRatio ? rect.width / ratio : rect.height;
  const x = (event.clientX - (rect.left + (rect.width - width) / 2)) / width;
  const y = (event.clientY - (rect.top + (rect.height - height) / 2)) / height;
  return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x: x * 100, y: y * 100 };
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
  const initialTargetIndex = Math.max(
    0,
    TARGETS.findIndex((target) => target.key === initialTargetKey),
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
  const [playing, setPlaying] = useState(false);
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
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareIndex, setCompareIndex] = useState(0);
  const [compareImage, setCompareImage] = useState('');
  const [compareDiagnostics, setCompareDiagnostics] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [primaryImageRatio, setPrimaryImageRatio] = useState(1);
  const [compareImageRatio, setCompareImageRatio] = useState(1);
  const [marking, setMarking] = useState(false);
  const [marker, setMarker] = useState(null);
  const [findingNote, setFindingNote] = useState('');
  const [findings, setFindings] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  // Phase 2: View Modes, Blink Comparator, Side-by-Side & Differential Imaging
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'blink' | 'sideBySide' | 'differential' | 'candidates'
  const [blinkSpeed, setBlinkSpeed] = useState(600); // ms per frame in blink mode
  const [blinkLoop, setBlinkLoop] = useState(true);
  const [blinkFrameList, setBlinkFrameList] = useState([]); // indices included in blink rotation
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

  const requestRef = useRef(0);
  const compareRequestRef = useRef(0);
  const searchRef = useRef(0);
  const stretchRef = useRef(null);
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
    } else {
      setBlinkFrameList([]);
    }
  }, [visibleRecords]);

  const search = async (nextRa = ra, nextDec = dec, nextRelease = release) => {
    const searchId = ++searchRef.current;
    // Lock the common WCS sky-grid center once for the whole observation sequence
    setImageCenter({ ra: Number(nextRa), dec: Number(nextDec) });
    stretchRef.current = null;
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
    setCompareIndex(0);
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
      const bandCounts = new Map();
      for (const record of sorted)
        bandCounts.set(record.band, (bandCounts.get(record.band) || 0) + 1);
      const mostObservedBand = [...bandCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      setRecords(sorted);
      setBand(mostObservedBand);
      setTruncated(body.truncated);
      setStatus(
        sorted.length
          ? `Se encontraron ${sorted.length} imágenes en ${new Set(sorted.map((row) => new Date((Number(row.dateAvg || row.date) - 40587) * 86400000).toISOString().slice(0, 10))).size} días distintos.`
          : 'No hay imágenes SPHEREx disponibles para estas coordenadas en este lanzamiento.',
      );
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
    search();
    // Load the first target as soon as Kronox arrives at the observatory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseTarget = (index) => {
    setSelected(index);
    setRa(String(TARGETS[index].ra));
    setDec(String(TARGETS[index].dec));
    stretchRef.current = null;
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
    const rendered = parseFits(buffer, stretchRef.current, imageCenter, {
      zodiMode,
      flagPolicy,
    });
    if (!stretchRef.current) stretchRef.current = rendered.range;
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
      viewMode === 'candidates';
    if (!isCompareActive || !image || !compareFrame) {
      setCompareImage('');
      setCompareDiagnostics(null);
      setCompareLoading(false);
      return undefined;
    }
    if (compareIndex === frameIndex) {
      setCompareImage('');
      setCompareDiagnostics(null);
      setCompareLoading(false);
      setCompareIndex(
        frameIndex > 0 ? frameIndex - 1 : Math.min(frameIndex + 1, visibleRecords.length - 1),
      );
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
  }, [playing, frameLoading, viewMode, blinkSpeed, blinkLoop, blinkFrameList, visibleRecords, frameIndex]);

  const step = (amount) => {
    const isBlinkMode = viewMode === 'blink';
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

  const markImagePosition = (event) => {
    if (!marking || !image) return;
    const point = imagePoint(event);
    if (!point) return;
    setMarker({
      ...point,
      frameId: frame?.id,
    });
    setMarking(false);
  };

  const markComparisonPosition = (event, record) => {
    if (!marking) return;
    const point = imagePoint(event);
    if (!point) return;
    setMarker({ ...point, frameId: record.id });
    setMarking(false);
  };

  const saveFinding = () => {
    if (!marker || !findingNote.trim() || !frame) return;
    setFindings((items) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        note: findingNote.trim(),
        target: t(selectedTarget.name, language),
        band: frame.band,
        previousDate:
          compareFrame
            ? formatDate(frame.dateAvg || frame.date, language)
            : previousFrame
              ? formatDate(previousFrame.dateAvg || previousFrame.date, language)
              : t('Sin observación anterior', language),
        currentDate:
          compareFrame
            ? formatDate(compareFrame.dateAvg || compareFrame.date, language)
            : formatDate(frame.dateAvg || frame.date, language),
        frameId: marker.frameId || frame.id,
        markerNumber: findings.length + 1,
        x: marker.x,
        y: marker.y,
      },
      ...items,
    ]);
    setFindingNote('');
    setMarker(null);
  };

  const exportFindings = () => {
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      [
        'Objetivo',
        'Banda',
        'Fecha anterior',
        'Fecha actual',
        'X del visor (%)',
        'Y del visor (%)',
        'Hallazgo',
      ].map((label) => t(label, language)),
      ...findings.map((finding) => [
        finding.target,
        finding.band,
        finding.previousDate,
        finding.currentDate,
        finding.x.toFixed(2),
        finding.y.toFixed(2),
        finding.note,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(quote).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hallazgos-spherex-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`spherexShade${image && viewMode === 'single' ? ' hasFullImage' : ''}`}
      role="presentation"
    >
      <section
        className={`spherexMission${image && viewMode === 'single' ? ' imageExpanded' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spherex-title"
      >
        <header className="spherexHeader">
          <div>
            <span className="spherexKicker">
              {t('MISIÓN 01 · OBSERVATORIO INFRARROJO', language)}
            </span>
            <h2 id="spherex-title">{t('Ecos en infrarrojo', language)}</h2>
            <p>
              {t(
                'Compara observaciones reales de SPHEREx y busca objetos que cambian de posición o brillo.',
                language,
              )}
            </p>
            <div className="spherexObjective">
              <small>{t('KRONOX · OBJETIVO DE MISIÓN', language)}</small>
              <b>{t(selectedTarget.name, language)}</b>
              <span>{missionObjective}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('Cerrar misión', language)}>
            Cerrar ✕
          </button>
        </header>

        <div
          className={`spherexBody${viewMode !== 'single' ? ' comparing' : ''}${image && viewMode === 'single' ? ' imageExpanded' : ''}`}
        >
          <aside className="spherexControls">
            <div className="spherexSectionTitle">{t('Objetivos de la misión', language)}</div>
            <div className="spherexTargets">
              {TARGETS.map((target, index) => (
                <button
                  key={t(target.name, language)}
                  className={selected === index ? 'selected' : ''}
                  onClick={() => chooseTarget(index)}
                >
                  <b>{t(target.name, language)}</b>
                  <small>{t(target.note, language)}</small>
                </button>
              ))}
            </div>

            <div className="spherexSectionTitle">{t('Coordenadas ICRS · grados', language)}</div>
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

            <p className="spherexTargetHint">
              {t(selectedTarget.note, language)}
              {selectedTarget.astrometry && (
                <small className="spherexAstrometryMeta">
                  {`J${selectedTarget.referenceEpoch} (${selectedTarget.astrometry.source}) · μ = ${Math.hypot(selectedTarget.astrometry.pmRa, selectedTarget.astrometry.pmDec).toFixed(0)} mas/yr`}
                </small>
              )}
            </p>

            {/* Scientific Accordion for Calibration & Quality Options */}
            <div className="spherexAccordion">
              <div
                className="spherexAccordionSummary"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>⚙ {t(showAdvanced ? 'Ocultar controles avanzados' : 'Controles científicos avanzados', language)}</span>
                <span>{showAdvanced ? '▲' : '▼'}</span>
              </div>
              {showAdvanced && (
                <div className="spherexAccordionBody">
                  <label title={t('Procesamiento del fondo zodiacal (HDU 4: ZODI)', language)}>
                    {t('Fondo', language)}{' '}
                    <select
                      value={zodiMode}
                      onChange={(event) => {
                        stretchRef.current = null;
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
                        stretchRef.current = null;
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

            <div className="spherexStatus" aria-live="polite">
              {t(status, language)}
              {truncated ? t(' Se muestran los registros disponibles.', language) : ''}
            </div>
          </aside>

          <main className="spherexViewer">
            {/* View Mode Selector Tabs */}
            <nav className="spherexViewModeTabs" aria-label={t('Modo de visualización', language)}>
              <button
                type="button"
                className={`spherexViewModeTab${viewMode === 'single' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('single');
                  setCompareEnabled(false);
                }}
              >
                🎞 {t('Secuencia', language)}
              </button>
              <button
                type="button"
                className={`spherexViewModeTab${viewMode === 'blink' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('blink');
                  setCompareEnabled(false);
                  setPlaying(true);
                }}
                disabled={visibleRecords.length < 2}
              >
                ⚡ {t('Blink Comparator', language)}
              </button>
              <button
                type="button"
                className={`spherexViewModeTab${viewMode === 'sideBySide' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('sideBySide');
                  setCompareEnabled(true);
                  setPlaying(false);
                  if (compareIndex === frameIndex) {
                    setCompareIndex(
                      frameIndex > 0 ? frameIndex - 1 : Math.min(1, visibleRecords.length - 1),
                    );
                  }
                }}
                disabled={visibleRecords.length < 2}
              >
                ◫ {t('Lado a lado', language)}
              </button>
              <button
                type="button"
                className={`spherexViewModeTab${viewMode === 'differential' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('differential');
                  setCompareEnabled(true);
                  setPlaying(false);
                  if (compareIndex === frameIndex) {
                    setCompareIndex(
                      frameIndex > 0 ? frameIndex - 1 : Math.min(1, visibleRecords.length - 1),
                    );
                  }
                }}
                disabled={visibleRecords.length < 2}
              >
                ⊖ {t('Resta diferencial', language)}
              </button>
              <button
                type="button"
                className={`spherexViewModeTab${viewMode === 'candidates' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('candidates');
                  setCompareEnabled(true);
                  setPlaying(false);
                  if (compareIndex === frameIndex) {
                    setCompareIndex(
                      frameIndex > 0 ? frameIndex - 1 : Math.min(1, visibleRecords.length - 1),
                    );
                  }
                }}
                disabled={visibleRecords.length < 2}
              >
                ★ {t('Candidatos', language)} ({candidates.length})
              </button>
            </nav>

            {/* Top Toolbar: Band selector, Epoch Hint & Zoom Reset */}
            <div className="spherexViewMeta">
              <span>
                {frame
                  ? formatDate(
                      frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date,
                      language,
                    )
                  : t('SECUENCIA DE OBSERVACIONES', language)}
              </span>
              <label>
                {t('Banda', language)}{' '}
                <select
                  value={band}
                  onChange={(event) => {
                    stretchRef.current = null;
                    frameCacheRef.current.clear();
                    setBand(event.target.value);
                    setFrameIndex(0);
                    setCompareIndex(visibleRecords.length > 1 ? 1 : 0);
                    setPlaying(false);
                  }}
                  disabled={!bands.length}
                >
                  <option value="">{t('Todas', language)}</option>
                  {bands.map((name) => (
                    <option key={name} value={name}>
                      {formatBandLabel(name)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Synchronized Zoom Controls */}
              {(viewMode === 'sideBySide' || viewMode === 'differential' || viewMode === 'candidates') && (
                <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    type="button"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleZoom(0.25)}
                    title={t('Acercar encuadre', language)}
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleZoom(-0.25)}
                    title={t('Alejar encuadre', language)}
                  >
                    －
                  </button>
                  <button
                    type="button"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={resetZoom}
                    title={t('Restablecer encuadre', language)}
                  >
                    1:1
                  </button>
                </div>
              )}

              <button
                type="button"
                className="spherexExpandButton"
                onClick={() => setExpanded(true)}
                disabled={!image}
              >
                {t('⤢ Ampliar', language)}
              </button>
            </div>

            {/* Comparability Warning Banner */}
            {frame && (viewMode !== 'single') && (
              <div className="spherexCompareHint">
                <b>{t('Comparando:', language)}</b>{' '}
                {compareFrame
                  ? `${formatDate(frame.dateAvg || frame.date, language)} ↔ ${formatDate(compareFrame.dateAvg || compareFrame.date, language)}`
                  : formatDate(frame.dateAvg || frame.date, language)}
                <span>
                  {comparability
                    ? ` · ${language === 'en' ? comparability.reasonEn : comparability.reasonEs}`
                    : t(
                        ' · alineado por WCS (N ↑ E ←) · la escala de brillo se mantiene fija en la secuencia',
                        language,
                      )}
                </span>
              </div>
            )}

            {/* Mode-specific Controls */}
            {viewMode === 'blink' && (
              <div className="spherexBlinkToolbar">
                <button
                  type="button"
                  className={playing ? 'active' : ''}
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? `⏸ ${t('Pausar parpadeo', language)}` : `▶ ${t('Iniciar parpadeo', language)}`}
                </button>
                <button type="button" onClick={() => step(-1)} title={t('Fotograma anterior', language)}>
                  ◀
                </button>
                <button type="button" onClick={() => step(1)} title={t('Fotograma siguiente', language)}>
                  ▶
                </button>
                <label>
                  {t('Velocidad de parpadeo', language)}:{' '}
                  <select
                    value={blinkSpeed}
                    onChange={(e) => setBlinkSpeed(Number(e.target.value))}
                  >
                    <option value={200}>200 ms ({t('Rápido', language)})</option>
                    <option value={400}>400 ms</option>
                    <option value={600}>600 ms ({t('Normal', language)})</option>
                    <option value={1000}>1000 ms</option>
                    <option value={1500}>1500 ms ({t('Lento', language)})</option>
                  </select>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={blinkLoop}
                    onChange={(e) => setBlinkLoop(e.target.checked)}
                  />
                  {t('Bucle continuo', language)}
                </label>
              </div>
            )}

            {(viewMode === 'sideBySide' || viewMode === 'differential' || viewMode === 'candidates') && (
              <div className="spherexCompareControls">
                <label>
                  {t('Primera fecha', language)} (I₁):{' '}
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
                <label>
                  {t('Segunda fecha', language)} (I₂):{' '}
                  <select
                    value={compareIndex}
                    onChange={(e) => setCompareIndex(Number(e.target.value))}
                  >
                    {visibleRecords.map((rec, i) => (
                      <option key={`${rec.id}-${i}`} value={i} disabled={i === frameIndex}>
                        {formatDate(rec.dateAvg || rec.date, language)} · {rec.band}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={marking ? 'active' : ''}
                  onClick={() => {
                    setMarker(null);
                    setMarking((val) => !val);
                  }}
                  disabled={!image || compareLoading}
                >
                  {marking
                    ? t('Haz clic en cualquiera de las imágenes', language)
                    : t('＋ Marcar cambio', language)}
                </button>
              </div>
            )}

            {/* Differential Controls toolbar */}
            {(viewMode === 'differential' || viewMode === 'candidates') && diffResult && (
              <div className="spherexDiffControls">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label>
                    <input
                      type="radio"
                      name="diffMode"
                      value="diff"
                      checked={diffMode === 'diff'}
                      onChange={() => setDiffMode('diff')}
                    />{' '}
                    {t('Diferencia de intensidad', language)} (D = I₂ − αI₁ − B)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="diffMode"
                      value="snr"
                      checked={diffMode === 'snr'}
                      onChange={() => setDiffMode('snr')}
                    />{' '}
                    {t('Mapa de significancia', language)} (SNR = D / σ_D)
                  </label>
                </div>
                <div className="spherexColormapLegend">
                  <span>− {t('Disminución', language)}</span>
                  <div className="spherexColormapGradient" />
                  <span>+ {t('Aumento', language)}</span>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {t('Umbral', language)}:
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

            {/* Normalization & PSF Summary Card */}
            {(viewMode === 'differential' || viewMode === 'candidates') && diffResult && (
              <div className="spherexNormCard">
                <span>α = <b>{diffResult.scaleNorm.alpha}</b> ± {Math.sqrt(diffResult.scaleNorm.alphaVariance).toFixed(4)} ({diffResult.scaleNorm.method === 'stellar_sources' ? `Fuentes N=${diffResult.scaleNorm.validReferencePixelCount}` : 'Sin reescalar'})</span>
                <span>B = <b>{diffResult.scaleNorm.backgroundOffset}</b> MJy/sr</span>
                <span>{t('Correlación r', language)} = <b>{diffResult.scaleNorm.correlation}</b></span>
                {diffResult.empiricalCalibration && (
                  <span>η_cielo = <b>{diffResult.empiricalCalibration.etaSky}×</b> (σ_emp={diffResult.empiricalCalibration.sigmaEmp} MJy/sr, residuo cielo={diffResult.empiricalCalibration.robustSigmaSkyCal}σ)</span>
                )}
                <span>ΔFWHM = <b>{diffResult.psfAssessment.deltaFwhm}"</b> ({diffResult.psfAssessment.quantitativeInterpretationAllowed ? '✓ PSF compatible' : '⚠ No cuantitativo'})</span>
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

            {/* 1. SINGLE / BLINK VIEWPORT */}
            {(viewMode === 'single' || viewMode === 'blink') && (
              <div
                className={`spherexImageFrame${image ? ' hasImage' : ''}`}
                style={{ '--spherex-image-ratio': primaryImageRatio }}
              >
                {image && (
                  <div className="spherexSkyStage">
                    <img
                      src={image}
                      alt={`Recorte infrarrojo SPHEREx ${frame?.band}`}
                      className={marking ? 'markable' : ''}
                      onClick={markImagePosition}
                      onLoad={(e) =>
                        setPrimaryImageRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
                      }
                    />
                    <SkyReticle
                      imageCenter={imageCenter}
                      predictedMarker={primaryEpochMarker}
                      language={language}
                    />
                    {viewMode === 'blink' && frame && (
                      <div className="spherexBlinkHud">
                        <span className="badge">⚡ BLINK [{frameIndex + 1}/{visibleRecords.length}]</span>
                        <span>MJD-AVG: {Number(frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date).toFixed(5)}</span>
                        <span>{formatDate(frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date, language)}</span>
                        <span>{formatBandLabel(frame.band)} {formatSpectralBadge(frameDiagnostics)}</span>
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
                    ) : (
                      t('Aquí aparecerán los recortes del cielo', language)
                    )}
                  </div>
                )}
                {frame && viewMode === 'single' && (
                  <span className="spherexFrameLabel">
                    {formatBandLabel(frame.band)} · {frame.release.replace('spherex_', '').toUpperCase()}
                    {formatSpectralBadge(frameDiagnostics)}
                    {formatZodiBadge(frameDiagnostics)}
                    {formatFlagBadge(frameDiagnostics)} · N ↑ E ←
                  </span>
                )}
              </div>
            )}

            {/* 2. SIDE-BY-SIDE DUAL VIEWPORT (SYNCHRONIZED ZOOM & PAN) */}
            {viewMode === 'sideBySide' && compareFrame && (
              <div className="spherexDualViewport">
                <article className="spherexDualPane">
                  <header className="spherexDualHeader">
                    <span><b>Época A (I₁)</b> · {frame ? formatDate(frame.dateAvg || frame.date, language) : ''}</span>
                    <small>{frame?.band}</small>
                  </header>
                  <div
                    className="spherexComparisonCanvas"
                    style={{ overflow: 'hidden', cursor: syncZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    <div style={{ transform: `translate(${syncPan.x}px, ${syncPan.y}px) scale(${syncZoom})`, transformOrigin: 'center center', width: '100%', height: '100%' }}>
                      {image && (
                        <>
                          <img
                            src={image}
                            alt="Época A"
                            onClick={(e) => markComparisonPosition(e, frame)}
                          />
                          <SkyReticle
                            imageCenter={imageCenter}
                            predictedMarker={primaryEpochMarker}
                            language={language}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="spherexDualMeta">
                    <div>MJD-AVG: {Number(frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date).toFixed(5)}</div>
                    <div>λ = {frameDiagnostics?.spectral?.wavelengthUm ?? '?'} μm (Δλ = {frameDiagnostics?.spectral?.bandwidthUm ?? '?'} μm)</div>
                    <div>Versión: {frame?.pipelineVersion || frame?.release}</div>
                    <div>Centro WCS: RA {imageCenter.ra.toFixed(4)}°, Dec {imageCenter.dec.toFixed(4)}°</div>
                  </div>
                </article>

                <article className="spherexDualPane">
                  <header className="spherexDualHeader">
                    <span><b>Época B (I₂)</b> · {formatDate(compareFrame.dateAvg || compareFrame.date, language)}</span>
                    <small>{compareFrame.band}</small>
                  </header>
                  <div
                    className="spherexComparisonCanvas"
                    style={{ overflow: 'hidden', cursor: syncZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    <div style={{ transform: `translate(${syncPan.x}px, ${syncPan.y}px) scale(${syncZoom})`, transformOrigin: 'center center', width: '100%', height: '100%' }}>
                      {compareImage && (
                        <>
                          <img
                            src={compareImage}
                            alt="Época B"
                            onClick={(e) => markComparisonPosition(e, compareFrame)}
                          />
                          <SkyReticle
                            imageCenter={imageCenter}
                            predictedMarker={compareEpochMarker}
                            language={language}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="spherexDualMeta">
                    <div>MJD-AVG: {Number(compareDiagnostics?.temporal?.mjdAvg ?? compareFrame.dateAvg ?? compareFrame.date).toFixed(5)}</div>
                    <div>λ = {compareDiagnostics?.spectral?.wavelengthUm ?? '?'} μm (Δλ = {compareDiagnostics?.spectral?.bandwidthUm ?? '?'} μm)</div>
                    <div>Versión: {compareFrame.pipelineVersion || compareFrame.release}</div>
                    <div>Centro WCS: RA {imageCenter.ra.toFixed(4)}°, Dec {imageCenter.dec.toFixed(4)}°</div>
                  </div>
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
                    <img src={diffDataUrl} alt="Mapa diferencial de intensidad / SNR" />
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
                  {selectedCandidate && (
                    <span
                      style={{
                        position: 'absolute',
                        left: `${((selectedCandidate.col + 0.5) / 300) * 100}%`,
                        top: `${((selectedCandidate.row + 0.5) / 300) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '22px',
                        height: '22px',
                        border: '2px solid #38bdf8',
                        borderRadius: '50%',
                        boxShadow: '0 0 10px #38bdf8',
                        pointerEvents: 'none',
                        zIndex: 4,
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 4. CANDIDATE DISCOVERY PANEL */}
            {viewMode === 'candidates' && (
              <section className="spherexCandidatePanel">
                <div className="spherexCandidateHeader">
                  <h4>★ {t('Lista de candidatos identificados', language)} ({candidates.length})</h4>
                  <small style={{ color: '#94a3b8' }}>
                    {t('Filtrado por significancia', language)} ≥ {diffThreshold}σ
                  </small>
                </div>
                {candidates.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '11px' }}>
                    {t('No se detectaron candidatos que superen el umbral', language)} ({diffThreshold}σ).
                  </p>
                ) : (
                  <div className="spherexCandidateList">
                    {candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className={`spherexCandidateCard${cand.matchesTarget ? ' matched' : ''}`}
                        onClick={() => setSelectedCandidate(cand)}
                      >
                        <div>
                          <span
                            className={`spherexCandidateBadge ${
                              cand.taxonomyType === 'KNOWN_OBJECT_MATCH'
                                ? 'targetMatch'
                                : cand.taxonomyType === 'MOVING_OBJECT_CANDIDATE'
                                  ? 'dipole'
                                  : cand.taxonomyType === 'TRANSIENT_ANOMALY'
                                    ? 'transient'
                                    : cand.taxonomyType === 'INSTRUMENTAL_ARTIFACT'
                                      ? 'artifact'
                                      : 'variable'
                            }`}
                          >
                            {cand.taxonomyType === 'KNOWN_OBJECT_MATCH'
                              ? t('★ Correspondencia con objeto conocido', language)
                              : cand.taxonomyType === 'MOVING_OBJECT_CANDIDATE'
                                ? t('⤢ Candidato a objeto móvil', language)
                                : cand.taxonomyType === 'TRANSIENT_ANOMALY'
                                  ? t('⚠ Anomalía transitoria', language)
                                  : cand.taxonomyType === 'INSTRUMENTAL_ARTIFACT'
                                    ? t('✕ Artefacto instrumental', language)
                                    : cand.snr > 0
                                      ? t('⚡ Variable (aumento)', language)
                                      : t('⚡ Variable (atenuación)', language)}
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
                          {cand.snrTheoretical !== undefined && (
                            <div style={{ color: '#64748b', fontSize: '10px' }}>
                              teo: {cand.snrTheoretical > 0 ? `+${cand.snrTheoretical}` : cand.snrTheoretical}σ
                            </div>
                          )}
                          <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                            RA {cand.ra.toFixed(4)}°, Dec {cand.dec.toFixed(4)}°
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Note form for recorded findings */}
            {marker && (
              <div className="spherexCompareNoteForm">
                <input
                  value={findingNote}
                  onChange={(event) => setFindingNote(event.target.value)}
                  placeholder={t('Describe el cambio entre las dos fechas…', language)}
                  maxLength={240}
                  aria-label={t('Descripción del cambio observado', language)}
                />
                <button type="button" onClick={saveFinding} disabled={!findingNote.trim()}>
                  {t('Guardar hallazgo', language)}
                </button>
              </div>
            )}

            {error && (
              <p className="spherexError" role="alert">
                {t(error, language)}
              </p>
            )}

            {/* Single sequence playback toolbar */}
            {viewMode === 'single' && (
              <>
                <div className="spherexPlayback">
                  <button
                    disabled={!visibleRecords.length}
                    onClick={() => step(-1)}
                    aria-label={t('Imagen anterior', language)}
                  >
                    ◀
                  </button>
                  <button
                    className="spherexPlay"
                    disabled={visibleRecords.length < 2}
                    onClick={() => setPlaying(!playing)}
                  >
                    {playing ? 'Pausar' : '▶ Reproducir'}
                  </button>
                  <button
                    disabled={!visibleRecords.length}
                    onClick={() => step(1)}
                    aria-label={t('Imagen siguiente', language)}
                  >
                    ▶
                  </button>
                  <span>
                    {visibleRecords.length ? `${frameIndex + 1} / ${visibleRecords.length}` : '0 / 0'}
                  </span>
                </div>
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
              </>
            )}

            {viewMode === 'single' && (
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
            )}

            <p className="spherexFootnote">
              {language === 'es'
                ? 'KRONOX Fase 2: Blink Comparator sincronizado, vista dual lado a lado, resta diferencial D(x,y) = I₂(x,y) − αI₁(x,y) − B con propagación de varianza Var(D) y mapa de significancia SNR = D / σ_D. Detección automática de candidatos a movimiento propio, variabilidad y transitorios sobre la cuadrícula común WCS TAN-SIP.'
                : 'KRONOX Phase 2: Synchronized Blink Comparator, side-by-side dual view, differential imaging D(x,y) = I₂(x,y) − αI₁(x,y) − B with variance propagation Var(D) and significance SNR = D / σ_D. Automated discovery of proper motion dipoles, variable sources, and transients on a common WCS TAN-SIP grid.'}
            </p>
          </main>
        </div>
      </section>

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
                · {frame ? formatBandLabel(frame.band) : ''}
                {formatSpectralBadge(frameDiagnostics)}
              </span>
            </div>
            <button type="button" onClick={() => setExpanded(false)}>
              {t('Cerrar ✕', language)}
            </button>
          </header>
          <img src={image} alt={`Imagen SPHEREx ampliada de ${t(selectedTarget.name, language)}`} />
        </div>
      )}
    </div>
  );
}
