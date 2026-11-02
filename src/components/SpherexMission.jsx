import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseFits } from '../utils/fitsImage.js';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS as TARGETS } from '../data/spherexTargets.js';

function formatDate(mjd) {
  const date = new Date((Number(mjd) - 40587) * 86400000);
  return Number.isNaN(date.getTime())
    ? 'Fecha desconocida'
    : date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) +
        ' UTC';
}

export default function SpherexMission({ onClose, initialTargetKey = 'barnard' }) {
  const initialTargetIndex = Math.max(0, TARGETS.findIndex((target) => target.key === initialTargetKey));
  const initialTarget = TARGETS[initialTargetIndex];
  const [selected, setSelected] = useState(initialTargetIndex);
  const [ra, setRa] = useState(String(initialTarget.ra));
  const [dec, setDec] = useState(String(initialTarget.dec));
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
  const [release, setRelease] = useState('qr2');
  const [band, setBand] = useState('');
  const [image, setImage] = useState('');
  const [comparisonImage, setComparisonImage] = useState('');
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonMode, setComparisonMode] = useState('split');
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [marking, setMarking] = useState(false);
  const [marker, setMarker] = useState(null);
  const [findingNote, setFindingNote] = useState('');
  const [findingCategory, setFindingCategory] = useState('movement');
  const [findings, setFindings] = useState([]);
  const [guidedDemo, setGuidedDemo] = useState(false);
  const [guideIndex, setGuideIndex] = useState(initialTargetIndex);
  const [truncated, setTruncated] = useState(false);
  const requestRef = useRef(0);
  const searchRef = useRef(0);
  const stretchRef = useRef(null);
  const bands = useMemo(() => [...new Set(records.map((record) => record.band))].sort(), [records]);
  const visibleRecords = useMemo(
    () => (band ? records.filter((record) => record.band === band) : records),
    [records, band],
  );

  const search = async (nextRa = ra, nextDec = dec) => {
    const searchId = ++searchRef.current;
    setImageCenter({ ra: Number(nextRa), dec: Number(nextDec) });
    stretchRef.current = null;
    setLoading(true);
    setError('');
    setImage('');
    setComparisonImage('');
    setFrameLoading(false);
    setRecords([]);
    setFrameIndex(0);
    setBand('');
    setPlaying(false);
    setStatus('Consultando las observaciones públicas de IRSA…');
    try {
      const response = await fetch(
        `/api/spherex?action=search&ra=${encodeURIComponent(nextRa)}&dec=${encodeURIComponent(nextDec)}&release=${release}`,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falló la consulta al archivo.');
      if (searchId !== searchRef.current) return;
      const unique = new Map();
      for (const record of body.records) {
        const key = `${record.id}|${record.band}|${record.date}`;
        if (!unique.has(key)) unique.set(key, record);
      }
      const sorted = [...unique.values()].sort((a, b) => Number(a.date) - Number(b.date));
      const bandCounts = new Map();
      for (const record of sorted)
        bandCounts.set(record.band, (bandCounts.get(record.band) || 0) + 1);
      const mostObservedBand = [...bandCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      setRecords(sorted);
      setBand(mostObservedBand);
      setTruncated(body.truncated);
      setStatus(
        sorted.length
          ? `Se encontraron ${sorted.length} imágenes en ${new Set(sorted.map((row) => new Date((Number(row.date) - 40587) * 86400000).toISOString().slice(0, 10))).size} días distintos.`
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

  const chooseTarget = (index, fromGuide = false) => {
    if (!fromGuide) setGuidedDemo(false);
    setSelected(index);
    setRa(String(TARGETS[index].ra));
    setDec(String(TARGETS[index].dec));
    stretchRef.current = null;
    setRecords([]);
    setImage('');
    setComparisonImage('');
    setFrameLoading(false);
    setPlaying(false);
    setStatus(`Buscando observaciones de ${TARGETS[index].name}…`);
    search(String(TARGETS[index].ra), String(TARGETS[index].dec));
  };

  const guideInstructions = [
    'Compara las dos fechas y busca una fuente que se haya desplazado frente al fondo estelar.',
    'Este sistema contiene dos enanas marrones; observa si alguna fuente cambia de posición.',
    'Busca el objeto tenue y comprueba si su posición cambia en las observaciones.',
    'En esta estrella joven, compara la intensidad de las fuentes entre fechas.',
    'Busca cambios de brillo propios de una estrella variable de largo período.',
  ];

  const startGuidedDemo = () => {
    setGuidedDemo(true);
    setGuideIndex(0);
    chooseTarget(0, true);
  };

  const advanceGuidedDemo = () => {
    if (guideIndex >= TARGETS.length - 1) {
      setGuidedDemo(false);
      return;
    }
    const nextIndex = guideIndex + 1;
    setGuideIndex(nextIndex);
    chooseTarget(nextIndex, true);
  };

  useEffect(() => {
    if (!visibleRecords.length) {
      setImage('');
      setFrameLoading(false);
      return undefined;
    }
    const record = visibleRecords[Math.min(frameIndex, visibleRecords.length - 1)];
    if (!record) return undefined;
    const token = ++requestRef.current;
    setFrameLoading(true);
    setError('');
    setImage('');
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
          const rendered = parseFits(buffer, stretchRef.current);
          stretchRef.current = rendered.range;
          setImage(rendered.src);
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
  }, [visibleRecords, frameIndex, imageCenter]);

  useEffect(() => {
    const current = visibleRecords[frameIndex];
    const previous = current
      ? visibleRecords.slice(0, frameIndex).filter((record) => record.band === current.band).at(-1)
      : null;
    if (!previous) {
      setComparisonImage('');
      setComparisonLoading(false);
      return undefined;
    }

    let cancelled = false;
    setComparisonLoading(true);
    const params = new URLSearchParams({
      action: 'frame',
      url: previous.url,
      center: `${imageCenter.ra},${imageCenter.dec}`,
    });
    fetch(`/api/spherex?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar la fecha de referencia.');
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!cancelled) setComparisonImage(parseFits(buffer, stretchRef.current).src);
      })
      .catch(() => {
        if (!cancelled) setComparisonImage('');
      })
      .finally(() => {
        if (!cancelled) setComparisonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visibleRecords, frameIndex, imageCenter]);

  useEffect(() => {
    if (!playing || frameLoading || visibleRecords.length < 2) return undefined;
    const timer = setTimeout(
      () => setFrameIndex((index) => (index + 1) % visibleRecords.length),
      1200,
    );
    return () => clearTimeout(timer);
  }, [playing, frameLoading, visibleRecords.length, image]);

  const step = (amount) =>
    setFrameIndex((index) => (index + amount + visibleRecords.length) % visibleRecords.length);
  const frame = visibleRecords[frameIndex];
  const previousFrame = frame
    ? visibleRecords.slice(0, frameIndex).filter((record) => record.band === frame.band).at(-1)
    : null;
  const selectedTarget = TARGETS[selected];
  const missionObjective =
    SPHEREX_MISSION_TYPES.find((mission) => mission.key === selectedTarget.mission)?.objective || '';

  const markImagePosition = (event) => {
    if (!marking || !image) return;
    const imageRect = event.currentTarget.getBoundingClientRect();
    const frameRect = event.currentTarget.parentElement.getBoundingClientRect();
    setMarker({
      x: ((event.clientX - imageRect.left + imageRect.left - frameRect.left) / frameRect.width) * 100,
      y: ((event.clientY - imageRect.top + imageRect.top - frameRect.top) / frameRect.height) * 100,
    });
    setMarking(false);
  };

  const saveFinding = () => {
    if (!marker || !findingNote.trim() || !frame) return;
    setFindings((items) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        note: findingNote.trim(),
        target: selectedTarget.name,
        band: frame.band,
        category: findingCategory,
        previousDate: previousFrame ? formatDate(previousFrame.date) : 'Sin observación anterior',
        currentDate: formatDate(frame.date),
        frameId: frame.id,
        markerNumber: findings.length + 1,
        x: marker.x,
        y: marker.y,
      },
      ...items,
    ]);
    setFindingNote('');
    setMarker(null);
  };

  const compatibleFindingCount = findings.filter((finding) => {
    const expected = TARGETS.find((target) => target.name === finding.target)?.mission;
    return (expected === 'motion' && finding.category === 'movement') ||
      (expected === 'variable' && finding.category === 'brightness');
  }).length;

  const exportFindings = () => {
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ['Objetivo', 'Banda', 'Tipo de cambio', 'Fecha anterior', 'Fecha actual', 'X del visor (%)', 'Y del visor (%)', 'Hallazgo'],
      ...findings.map((finding) => [
        finding.target,
        finding.band,
        finding.category,
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
      className="spherexShade"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="spherexMission"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spherex-title"
      >
        <header className="spherexHeader">
          <div>
            <span className="spherexKicker">MISIÓN 01 · OBSERVATORIO INFRARROJO</span>
            <h2 id="spherex-title">Ecos en infrarrojo</h2>
            <p>
              Compara observaciones reales de SPHEREx y busca objetos que cambian de posición o
              brillo.
            </p>
            <div className="spherexObjective">
              <small>KRONOX · OBJETIVO DE MISIÓN</small>
              <b>{selectedTarget.name}</b>
              <span>{missionObjective}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar misión">
            Cerrar ✕
          </button>
        </header>
        <div className="spherexBody">
          <aside className="spherexControls">
            <div className="spherexSectionTitle">Objetivos de la misión</div>
            <div className="spherexTargets">
              {TARGETS.map((target, index) => (
                <button
                  key={target.name}
                  className={selected === index ? 'selected' : ''}
                  onClick={() => chooseTarget(index)}
                >
                  <b>{target.name}</b>
                  <small>{target.note}</small>
                </button>
              ))}
            </div>
            <section className="spherexGuidedDemo">
              <div>
                <b>Recorrido guiado</b>
                <small>Explora los cinco objetivos del reto paso a paso.</small>
              </div>
              {!guidedDemo ? (
                <button type="button" onClick={startGuidedDemo}>
                  Iniciar recorrido
                </button>
              ) : (
                <>
                  <p>
                    <strong>{guideIndex + 1} / {TARGETS.length} · {TARGETS[guideIndex].name}</strong>
                    {guideInstructions[guideIndex]}
                  </p>
                  <button type="button" onClick={advanceGuidedDemo}>
                    {guideIndex === TARGETS.length - 1 ? 'Terminar recorrido' : 'Siguiente objetivo →'}
                  </button>
                </>
              )}
            </section>
            <div className="spherexSectionTitle">Coordenadas ICRS · grados</div>
            <form
              className="spherexCoordinates"
              onSubmit={(event) => {
                event.preventDefault();
                search();
              }}
            >
              <label>
                Ascensión recta (RA)
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
                Declinación (Dec)
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
                Lanzamiento
                <select value={release} onChange={(event) => setRelease(event.target.value)}>
                  <option value="qr3">QR3 · más reciente</option>
                  <option value="qr2">QR2 · archivo anterior</option>
                </select>
              </label>
              <button className="spherexSearch" type="submit" disabled={loading}>
                {loading ? 'Buscando…' : 'Consultar SPHEREx'}
              </button>
            </form>
            <p className="spherexTargetHint">{selectedTarget.note}</p>
            <div className="spherexStatus" aria-live="polite">
              {status}
              {truncated ? ' Se muestran como máximo 250 resultados.' : ''}
            </div>
          </aside>
          <main className="spherexViewer">
            <div className="spherexViewMeta">
              <span>{frame ? formatDate(frame.date) : 'SECUENCIA DE OBSERVACIONES'}</span>
              <label>
                Banda{' '}
                <select
                  value={band}
                  onChange={(event) => {
                    stretchRef.current = null;
                    setBand(event.target.value);
                    setFrameIndex(0);
                    setPlaying(false);
                  }}
                  disabled={!bands.length}
                >
                  <option value="">Todas</option>
                  {bands.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {frame && (
              <div className="spherexCompareHint">
                <b>Comparando:</b>{' '}
                {previousFrame ? formatDate(previousFrame.date) : 'primera observación'}
                {' → '}
                {formatDate(frame.date)}
                <span> · la escala de brillo se mantiene fija en la secuencia</span>
              </div>
            )}
            <div className="spherexImageFrame">
              {image && (
                <img
                  src={image}
                  alt={`Recorte infrarrojo SPHEREx ${frame?.band}, ${frame ? formatDate(frame.date) : ''}`}
                  className={marking ? 'markable' : ''}
                  onClick={markImagePosition}
                />
              )}
              {findings
                .filter((finding) => finding.frameId === frame?.id)
                .map((finding) => (
                  <span
                    key={finding.id}
                    className="spherexMarker saved"
                    style={{ left: `${finding.x}%`, top: `${finding.y}%` }}
                    aria-label={`Hallazgo ${finding.markerNumber}`}
                  >
                    <b>{finding.markerNumber}</b>
                  </span>
                ))}
              {marker && (
                <span
                  className="spherexMarker"
                  style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  aria-label="Posición del hallazgo"
                >
                  <b>+</b>
                </span>
              )}
              {!image && (
                <div className="spherexImagePlaceholder">
                  {frameLoading ? (
                    <>
                      <span className="spherexSpinner" /> Procesando recorte de la imagen…
                    </>
                  ) : loading ? (
                    'Buscando en el archivo…'
                  ) : (
                    'Aquí aparecerán los recortes del cielo'
                  )}
                </div>
              )}
              {frame && (
                <span className="spherexFrameLabel">
                  {frame.band} · {frame.release.toUpperCase()}
                </span>
              )}
            </div>
            <section className="spherexComparisonPanel" aria-label="Comparación entre fechas">
              <div className="spherexComparisonHeading">
                <div>
                  <b>Comparación temporal</b>
                  <small>
                    {previousFrame
                      ? `${formatDate(previousFrame.date)} frente a ${formatDate(frame.date)}`
                      : 'Avanza a una fecha posterior para elegir una observación de referencia.'}
                  </small>
                </div>
                <div className="spherexComparisonModes">
                  <button
                    type="button"
                    className={comparisonMode === 'split' ? 'active' : ''}
                    onClick={() => setComparisonMode('split')}
                    disabled={!previousFrame}
                  >
                    Lado a lado
                  </button>
                  <button
                    type="button"
                    className={comparisonMode === 'overlay' ? 'active' : ''}
                    onClick={() => setComparisonMode('overlay')}
                    disabled={!previousFrame}
                  >
                    Superponer
                  </button>
                </div>
              </div>
              {previousFrame && (
                comparisonLoading ? (
                  <div className="spherexComparisonPlaceholder">
                    <span className="spherexSpinner" /> Cargando la fecha de referencia…
                  </div>
                ) : comparisonImage && image ? (
                  comparisonMode === 'split' ? (
                    <div className="spherexComparisonSplit">
                      <figure>
                        <img src={comparisonImage} alt={`SPHEREx ${formatDate(previousFrame.date)}`} />
                        <figcaption>ANTES · {formatDate(previousFrame.date)}</figcaption>
                      </figure>
                      <figure>
                        <img src={image} alt={`SPHEREx ${formatDate(frame.date)}`} />
                        <figcaption>AHORA · {formatDate(frame.date)}</figcaption>
                      </figure>
                    </div>
                  ) : (
                    <div className="spherexOverlayWrap">
                      <div className="spherexOverlayImages">
                        <img src={comparisonImage} alt={`Imagen base ${formatDate(previousFrame.date)}`} />
                        <img
                          className="spherexOverlayTop"
                          src={image}
                          alt={`Imagen superpuesta ${formatDate(frame.date)}`}
                          style={{ clipPath: `inset(0 ${100 - overlayOpacity}% 0 0)` }}
                        />
                        <span className="spherexOverlayLabel before">ANTES</span>
                        <span className="spherexOverlayLabel after">AHORA</span>
                      </div>
                      <label className="spherexOverlaySlider">
                        Opacidad de imagen actual
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={overlayOpacity}
                          onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                        />
                        <span>{overlayOpacity}%</span>
                      </label>
                    </div>
                  )
                ) : (
                  <div className="spherexComparisonPlaceholder">No se pudo abrir la imagen anterior.</div>
                )
              )}
            </section>
            {error && (
              <p className="spherexError" role="alert">
                {error}
              </p>
            )}
            <div className="spherexPlayback">
              <button
                disabled={!visibleRecords.length}
                onClick={() => step(-1)}
                aria-label="Imagen anterior"
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
                aria-label="Imagen siguiente"
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
              aria-label="Fecha de observación"
            />
            <div className="spherexFrameDate">
              {frame
                ? `${formatDate(frame.date)} · ${frame.id}`
                : 'Las observaciones disponibles aparecerán ordenadas por fecha.'}
            </div>
            <section className="spherexFindings" aria-label="Registrar hallazgo">
              <div className="spherexFindingsTitle">
                <div>
                  <b>¿Qué cambió?</b>
                  <small>Marca una fuente en la imagen y anota lo que observas.</small>
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
                  {marking ? 'Haz clic en una fuente…' : '＋ Marcar objeto'}
                </button>
                {findings.length > 0 && (
                  <button type="button" onClick={exportFindings}>
                    Descargar CSV
                  </button>
                )}
              </div>
              {marker && (
                <div className="spherexFindingForm">
                  <select
                    value={findingCategory}
                    onChange={(event) => setFindingCategory(event.target.value)}
                    aria-label="Tipo de cambio detectado"
                  >
                    <option value="movement">Movimiento de posición</option>
                    <option value="brightness">Cambio de brillo</option>
                    <option value="no-change">Sin cambio visible</option>
                  </select>
                  <input
                    value={findingNote}
                    onChange={(event) => setFindingNote(event.target.value)}
                    placeholder="Ej.: la fuente se desplazó hacia el borde…"
                    maxLength={240}
                    aria-label="Descripción del cambio observado"
                  />
                  <button type="button" onClick={saveFinding} disabled={!findingNote.trim()}>
                    Guardar hallazgo
                  </button>
                </div>
              )}
              {findings.length > 0 && (
                <div className="spherexFindingSummary" role="status">
                  <b>Resumen de hallazgos</b>
                  <span>{findings.length} registrados · {compatibleFindingCount} compatibles con el tipo de objetivo</span>
                  <small>La compatibilidad es orientativa según la misión seleccionada; no confirma una medición científica.</small>
                </div>
              )}
              {findings.length > 0 && (
                <ul className="spherexFindingList">
                  {findings.map((finding, index) => (
                    <li key={finding.id}>
                        <span className="spherexFindingNumber">{finding.markerNumber}</span>
                      <div>
                        <b>{finding.target} · {finding.band}</b>
                        <p><strong>{finding.category === 'movement' ? 'Movimiento' : finding.category === 'brightness' ? 'Cambio de brillo' : 'Sin cambio visible'}:</strong> {finding.note}</p>
                        <small>{finding.previousDate} → {finding.currentDate}</small>
                      </div>
                      <button
                        type="button"
                        aria-label="Eliminar hallazgo"
                        onClick={() => setFindings((items) => items.filter((item) => item.id !== finding.id))}
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
                    <b>{formatDate(record.date).replace(' UTC', '')}</b>
                    <small>{record.band}</small>
                  </button>
                ))}
              </div>
            )}
            <p className="spherexFootnote">
              Los recortes y fechas proceden del archivo público NASA/IPAC IRSA. SPHEREx observa en
              infrarrojo; el color y el halo suave de las fuentes brillantes son ayudas visuales, no
              luz visible ni detalle añadido a la medición. El campo mostrado es de 0,5° y se
              conserva el contraste del primer fotograma para comparar la secuencia. Puedes marcar
              una fuente y guardar una descripción del cambio entre fechas. Esto ayuda a explorar,
              pero no reemplaza una medición fotométrica calibrada. La cobertura y cadencia dependen
              del objetivo.
            </p>
          </main>
        </div>
      </section>
    </div>
  );
}
