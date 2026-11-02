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
  const requestRef = useRef(0);
  const searchRef = useRef(0);
  const stretchRef = useRef(null);
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

  const search = async (nextRa = ra, nextDec = dec, nextRelease = release) => {
    const searchId = ++searchRef.current;
    // Lock the common WCS sky-grid center once for the whole observation sequence
    setImageCenter({ ra: Number(nextRa), dec: Number(nextDec) });
    stretchRef.current = null;
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
    setRecords([]);
    setImage('');
    setFrameDiagnostics(null);
    setFrameLoading(false);
    setPlaying(false);
    setStatus(`Buscando observaciones de ${TARGETS[index].name}…`);
    search(String(TARGETS[index].ra), String(TARGETS[index].dec), release);
  };

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
    setImage('');
    setFrameDiagnostics(null);
    setMarker(null);
    setMarking(false);
    const params = new URLSearchParams({
      action: 'frame',
      url: record.url,
      center: `${imageCenter.ra},${imageCenter.dec}`,
    });
    fetch(`/api/spherex?${params}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'No se pudo abrir el recorte.');
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (token === requestRef.current) {
          const rendered = parseFits(buffer, stretchRef.current, imageCenter, {
            zodiMode,
            flagPolicy,
          });
          stretchRef.current = rendered.range;
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
          });
        }
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

  useEffect(() => {
    if (!playing || frameLoading || visibleRecords.length < 2) return undefined;
    const timer = setTimeout(
      () => setFrameIndex((index) => (index + 1) % visibleRecords.length),
      1200,
    );
    return () => clearTimeout(timer);
  }, [playing, frameLoading, visibleRecords.length, image]);

  useEffect(() => {
    if (!compareEnabled || !image || !compareFrame) {
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
    let cancelled = false;
    setCompareImage('');
    setCompareDiagnostics(null);
    setCompareLoading(true);
    const params = new URLSearchParams({
      action: 'frame',
      url: compareFrame.url,
      center: `${imageCenter.ra},${imageCenter.dec}`,
    });
    fetch(`/api/spherex?${params}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'No se pudo abrir el recorte.');
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!cancelled) {
          const rendered = parseFits(buffer, stretchRef.current, imageCenter, {
            zodiMode,
            flagPolicy,
          });
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
          });
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    compareEnabled,
    compareFrame,
    compareIndex,
    frameIndex,
    image,
    imageCenter,
    visibleRecords.length,
    zodiMode,
    flagPolicy,
  ]);

  const step = (amount) =>
    setFrameIndex((index) => (index + amount + visibleRecords.length) % visibleRecords.length);
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

  // Use the authoritative FITS header midpoint MJD-AVG (falling back to MJD-OBS or SIA dateAvg)
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
      compareEnabled && frameDiagnostics && compareDiagnostics
        ? assessPhotometricComparability(frameDiagnostics, compareDiagnostics)
        : null,
    [compareEnabled, frameDiagnostics, compareDiagnostics],
  );

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
          compareEnabled && compareFrame
            ? formatDate(frame.dateAvg || frame.date, language)
            : previousFrame
              ? formatDate(previousFrame.dateAvg || previousFrame.date, language)
              : t('Sin observación anterior', language),
        currentDate:
          compareEnabled && compareFrame
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
      className={`spherexShade${image && !compareEnabled ? ' hasFullImage' : ''}`}
      role="presentation"
    >
      <section
        className={`spherexMission${image && !compareEnabled ? ' imageExpanded' : ''}`}
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
          className={`spherexBody${compareEnabled ? ' comparing' : ''}${image && !compareEnabled ? ' imageExpanded' : ''}`}
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
            <div className="spherexStatus" aria-live="polite">
              {t(status, language)}
              {truncated ? t(' Se muestran como máximo 250 resultados.', language) : ''}
            </div>
          </aside>
          <main
            className={`spherexViewer${compareEnabled ? ' comparing' : ''}${image && !compareEnabled ? ' imageExpanded' : ''}`}
          >
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
                    setBand(event.target.value);
                    setFrameIndex(0);
                    setCompareIndex(visibleRecords.length > 1 ? 1 : 0);
                    if (visibleRecords.length < 2) setCompareEnabled(false);
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
              <label title={t('Procesamiento del fondo zodiacal (HDU 4: ZODI)', language)}>
                {t('Fondo', language)}{' '}
                <select
                  value={zodiMode}
                  onChange={(event) => {
                    stretchRef.current = null;
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
                    setFlagPolicy(event.target.value);
                  }}
                  disabled={!visibleRecords.length}
                >
                  <option value="measurement">{t('Medición (Cat. A+C)', language)}</option>
                  <option value="discovery">{t('Descubrimiento (Cat. A)', language)}</option>
                </select>
              </label>
              <button
                type="button"
                className="spherexExpandButton"
                onClick={() => setExpanded(true)}
                disabled={!image}
              >
                {t('⤢ Ampliar', language)}
              </button>
            </div>
            {frame && (
              <div className="spherexCompareHint">
                <b>{t('Comparando:', language)}</b>{' '}
                {compareEnabled && compareFrame
                  ? `${formatDate(frame.dateAvg || frame.date, language)} ↔ ${formatDate(compareFrame.dateAvg || compareFrame.date, language)}`
                  : `${previousFrame ? formatDate(previousFrame.dateAvg || previousFrame.date, language) : t('primera observación', language)} → ${formatDate(frame.dateAvg || frame.date, language)}`}
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
            <div className="spherexCompareControls">
              <button
                type="button"
                className={compareEnabled ? 'active' : ''}
                onClick={() => {
                  setCompareEnabled((enabled) => !enabled);
                  setCompareIndex(
                    frameIndex > 0 ? frameIndex - 1 : Math.min(1, visibleRecords.length - 1),
                  );
                  setPlaying(false);
                  setMarking(false);
                  setMarker(null);
                }}
                disabled={visibleRecords.length < 2}
                aria-pressed={compareEnabled}
              >
                {compareEnabled
                  ? t('Ocultar comparación', language)
                  : t('Comparar 2 imágenes', language)}
              </button>
              {compareEnabled && (
                <>
                  <label>
                    {t('Primera fecha', language)}
                    <select
                      value={frameIndex}
                      onChange={(event) => {
                        setFrameIndex(Number(event.target.value));
                        setPlaying(false);
                      }}
                      aria-label={t('Elegir primera imagen para comparar', language)}
                    >
                      {visibleRecords.map((record, index) => (
                        <option
                          key={`${record.id}-${record.band}-${record.date}`}
                          value={index}
                          disabled={index === compareIndex}
                        >
                          {formatDate(record.dateAvg || record.date, language)} · {record.band}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('Segunda fecha', language)}
                    <select
                      value={compareIndex}
                      onChange={(event) => setCompareIndex(Number(event.target.value))}
                      aria-label={t('Elegir segunda imagen para comparar', language)}
                    >
                      {visibleRecords.map((record, index) => (
                        <option
                          key={`${record.id}-${record.band}-${record.date}`}
                          value={index}
                          disabled={index === frameIndex}
                        >
                          {formatDate(record.dateAvg || record.date, language)} · {record.band}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={marking ? 'active' : ''}
                    onClick={() => {
                      setMarker(null);
                      setMarking((value) => !value);
                    }}
                    disabled={!image || compareLoading}
                  >
                    {marking
                      ? t('Haz clic en cualquiera de las dos imágenes', language)
                      : t('＋ Marcar cambio', language)}
                  </button>
                </>
              )}
            </div>
            <div
              className={`spherexImageFrame${compareEnabled ? ' comparisonHidden' : ''}${image ? ' hasImage' : ''}`}
              style={{ '--spherex-image-ratio': primaryImageRatio }}
            >
              {image && (
                <div className="spherexSkyStage">
                  <img
                    src={image}
                    alt={`Recorte infrarrojo SPHEREx ${frame?.band}, ${frame ? formatDate(frame.dateAvg || frame.date, language) : ''}`}
                    className={marking ? 'markable' : ''}
                    onClick={markImagePosition}
                    onLoad={(event) =>
                      setPrimaryImageRatio(
                        event.currentTarget.naturalWidth / event.currentTarget.naturalHeight,
                      )
                    }
                  />
                  <SkyReticle
                    imageCenter={imageCenter}
                    predictedMarker={primaryEpochMarker}
                    language={language}
                  />
                  {findings
                    .filter((finding) => finding.frameId === frame?.id)
                    .map((finding) => (
                      <span
                        key={finding.id}
                        className="spherexMarker saved"
                        style={{ left: `${finding.x}%`, top: `${finding.y}%` }}
                        aria-label={t(`Hallazgo ${finding.markerNumber}`, language)}
                      >
                        <b>{finding.markerNumber}</b>
                      </span>
                    ))}
                  {marker && (
                    <span
                      className="spherexMarker"
                      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                      aria-label={t('Posición del hallazgo', language)}
                    >
                      <b>+</b>
                    </span>
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
                  ) : loading ? (
                    t('Buscando en el archivo…', language)
                  ) : (
                    t('Aquí aparecerán los recortes del cielo', language)
                  )}
                </div>
              )}
              {frame && (
                <span className="spherexFrameLabel">
                  {formatBandLabel(frame.band)} · {frame.release.replace('spherex_', '').toUpperCase()}
                  {frame.pipelineVersion && frame.pipelineVersion !== 'unknown'
                    ? ` (${frame.pipelineVersion})`
                    : ''}
                  {formatSpectralBadge(frameDiagnostics)}
                  {formatZodiBadge(frameDiagnostics)}
                  {formatFlagBadge(frameDiagnostics)} · N ↑ E ←
                </span>
              )}
            </div>
            {compareEnabled && compareFrame && (
              <div className="spherexComparisonGrid">
                <article
                  className="spherexComparisonPane"
                  style={{ aspectRatio: primaryImageRatio }}
                >
                  <header>
                    {t('Imagen actual', language)} ·{' '}
                    {frame ? formatDate(frame.dateAvg || frame.date, language) : ''} · {frame?.band}
                    {formatSpectralBadge(frameDiagnostics)}
                  </header>
                  {image ? (
                    <div className={`spherexComparisonCanvas${marking ? ' markable' : ''}`}>
                      <img
                        src={image}
                        alt={`${t('Imagen actual', language)} ${frame ? formatDate(frame.dateAvg || frame.date, language) : ''}`}
                        onLoad={(event) =>
                          setPrimaryImageRatio(
                            event.currentTarget.naturalWidth / event.currentTarget.naturalHeight,
                          )
                        }
                        onClick={(event) => markComparisonPosition(event, frame)}
                      />
                      <SkyReticle
                        imageCenter={imageCenter}
                        predictedMarker={primaryEpochMarker}
                        language={language}
                      />
                      {findings
                        .filter((finding) => finding.frameId === frame?.id)
                        .map((finding) => (
                          <span
                            key={finding.id}
                            className="spherexMarker saved"
                            style={{ left: `${finding.x}%`, top: `${finding.y}%` }}
                          >
                            <b>{finding.markerNumber}</b>
                          </span>
                        ))}
                      {marker && (
                        <span
                          className="spherexMarker"
                          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                        >
                          <b>+</b>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>{t('Cargando imagen…', language)}</span>
                  )}
                </article>
                <article
                  className="spherexComparisonPane"
                  style={{ aspectRatio: compareImageRatio }}
                >
                  <header>
                    {t('Segunda imagen', language)} ·{' '}
                    {formatDate(compareFrame.dateAvg || compareFrame.date, language)} ·{' '}
                    {compareFrame.band}
                    {formatSpectralBadge(compareDiagnostics)}
                  </header>
                  {compareLoading ? (
                    <span>{t('Cargando imagen…', language)}</span>
                  ) : compareImage ? (
                    <div className={`spherexComparisonCanvas${marking ? ' markable' : ''}`}>
                      <img
                        src={compareImage}
                        alt={`${t('Segunda imagen', language)} ${formatDate(compareFrame.dateAvg || compareFrame.date, language)}`}
                        onLoad={(event) =>
                          setCompareImageRatio(
                            event.currentTarget.naturalWidth / event.currentTarget.naturalHeight,
                          )
                        }
                        onClick={(event) => markComparisonPosition(event, compareFrame)}
                      />
                      <SkyReticle
                        imageCenter={imageCenter}
                        predictedMarker={compareEpochMarker}
                        language={language}
                      />
                      {findings
                        .filter((finding) => finding.frameId === compareFrame.id)
                        .map((finding) => (
                          <span
                            key={finding.id}
                            className="spherexMarker saved"
                            style={{ left: `${finding.x}%`, top: `${finding.y}%` }}
                          >
                            <b>{finding.markerNumber}</b>
                          </span>
                        ))}
                      {marker && (
                        <span
                          className="spherexMarker"
                          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                        >
                          <b>+</b>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>
                      {compareIndex === frameIndex
                        ? t('Elige otra fecha para comparar.', language)
                        : t('La imagen no está disponible.', language)}
                    </span>
                  )}
                </article>
              </div>
            )}
            {compareEnabled && marker && (
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
            <div className="spherexFrameDate">
              {frame
                ? `${formatDate(frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date, language)} · MJD-AVG ${Number(frameDiagnostics?.temporal?.mjdAvg ?? frame.dateAvg ?? frame.date).toFixed(5)} · ${frame.id}${formatSpectralBadge(frameDiagnostics)}`
                : t('Las observaciones disponibles aparecerán ordenadas por fecha.', language)}
            </div>
            <section className="spherexFindings" aria-label={t('Registrar hallazgo', language)}>
              <div className="spherexFindingsTitle">
                <div>
                  <b>{t('¿Qué cambió?', language)}</b>
                  <small>
                    {t('Marca una fuente en la imagen y anota lo que observas.', language)}
                  </small>
                </div>
                <button
                  type="button"
                  className={marking ? 'active' : ''}
                  onClick={() => {
                    setMarker(null);
                    setMarking(!marking);
                  }}
                  disabled={!image}
                >
                  {marking
                    ? t('Haz clic en una fuente…', language)
                    : t('＋ Marcar objeto', language)}
                </button>
                {findings.length > 0 && (
                  <button type="button" onClick={exportFindings}>
                    Descargar CSV
                  </button>
                )}
              </div>
              {marker && !compareEnabled && (
                <div className="spherexFindingForm">
                  <input
                    value={findingNote}
                    onChange={(event) => setFindingNote(event.target.value)}
                    placeholder={t('Ej.: la fuente se desplazó hacia el borde…', language)}
                    maxLength={240}
                    aria-label={t('Descripción del cambio observado', language)}
                  />
                  <button type="button" onClick={saveFinding} disabled={!findingNote.trim()}>
                    Guardar hallazgo
                  </button>
                </div>
              )}
              {findings.length > 0 && (
                <ul className="spherexFindingList">
                  {findings.map((finding) => (
                    <li key={finding.id}>
                      <span className="spherexFindingNumber">{finding.markerNumber}</span>
                      <div>
                        <b>
                          {finding.target} · {finding.band}
                        </b>
                        <p>{finding.note}</p>
                        <small>
                          {finding.previousDate} → {finding.currentDate}
                        </small>
                      </div>
                      <button
                        type="button"
                        aria-label={t('Eliminar hallazgo', language)}
                        onClick={() =>
                          setFindings((items) => items.filter((item) => item.id !== finding.id))
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {visibleRecords.length > 0 && (
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
                ? 'Los recortes y fechas proceden del archivo público NASA/IPAC IRSA (QR2 + QR3). Se conserva IMAGE original e independiente del modelo ZODI, se clasifican las banderas FLAGS en tres niveles (Cat. A exclusión instrumental, Cat. B advertencia de calidad, Cat. C candidatos transitorios) y se reproyecta mediante WCS (TAN-SIP) usando el punto medio de exposición MJD-AVG.'
                : 'Image cutouts and dates come from the public NASA/IPAC IRSA archive (QR2 + QR3). Original IMAGE data is kept separate from the ZODI model, FLAGS are classified into three tiers (Cat. A instrumental exclusion, Cat. B quality warning, Cat. C transient candidates), and frames are reprojected via WCS (TAN-SIP) using the exposure midpoint MJD-AVG.'}
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
