import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseFits } from '../utils/fitsImage.js';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS as TARGETS } from '../data/spherexTargets.js';
import { t } from '../i18n.js';

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

export default function SpherexMission({ onClose, initialTargetKey = 'barnard', language = 'es' }) {
  const initialTargetIndex = Math.max(
    0,
    TARGETS.findIndex((target) => target.key === initialTargetKey),
  );
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

  const search = async (nextRa = ra, nextDec = dec) => {
    const searchId = ++searchRef.current;
    setImageCenter({ ra: Number(nextRa), dec: Number(nextDec) });
    stretchRef.current = null;
    setLoading(true);
    setError('');
    setImage('');
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

  const chooseTarget = (index) => {
    setSelected(index);
    setRa(String(TARGETS[index].ra));
    setDec(String(TARGETS[index].dec));
    stretchRef.current = null;
    setRecords([]);
    setImage('');
    setFrameLoading(false);
    setPlaying(false);
    setStatus(`Buscando observaciones de ${TARGETS[index].name}…`);
    search(String(TARGETS[index].ra), String(TARGETS[index].dec));
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
  const previousFrame = visibleRecords[frameIndex - 1];
  const selectedTarget = TARGETS[selected];
  const missionObjective = t(
    SPHEREX_MISSION_TYPES.find((mission) => mission.key === selectedTarget.mission)?.objective ||
      '',
    language,
  );

  const markImagePosition = (event) => {
    if (!marking || !image) return;
    const imageRect = event.currentTarget.getBoundingClientRect();
    const frameRect = event.currentTarget.parentElement.getBoundingClientRect();
    setMarker({
      x:
        ((event.clientX - imageRect.left + imageRect.left - frameRect.left) / frameRect.width) *
        100,
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
        target: t(selectedTarget.name, language),
        band: frame.band,
        previousDate: previousFrame
          ? formatDate(previousFrame.date, language)
          : t('Sin observación anterior', language),
        currentDate: formatDate(frame.date, language),
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
        <div className="spherexBody">
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
                  <option value="qr3">{t('QR3 · más reciente', language)}</option>
                  <option value="qr2">{t('QR2 · archivo anterior', language)}</option>
                </select>
              </label>
              <button className="spherexSearch" type="submit" disabled={loading}>
                {loading ? t('Buscando…', language) : t('Consultar SPHEREx', language)}
              </button>
            </form>
            <p className="spherexTargetHint">{t(selectedTarget.note, language)}</p>
            <div className="spherexStatus" aria-live="polite">
              {t(status, language)}
              {truncated ? t(' Se muestran como máximo 250 resultados.', language) : ''}
            </div>
          </aside>
          <main className="spherexViewer">
            <div className="spherexViewMeta">
              <span>
                {frame
                  ? formatDate(frame.date, language)
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
                    setPlaying(false);
                  }}
                  disabled={!bands.length}
                >
                  <option value="">{t('Todas', language)}</option>
                  {bands.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
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
                {previousFrame
                  ? formatDate(previousFrame.date, language)
                  : t('primera observación', language)}
                {' → '}
                {formatDate(frame.date, language)}
                <span>
                  {t(' · la escala de brillo se mantiene fija en la secuencia', language)}
                </span>
              </div>
            )}
            <div className="spherexImageFrame">
              {image && (
                <img
                  src={image}
                  alt={`Recorte infrarrojo SPHEREx ${frame?.band}, ${frame ? formatDate(frame.date, language) : ''}`}
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
                  {frame.band} · {frame.release.toUpperCase()}
                </span>
              )}
            </div>
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
                ? `${formatDate(frame.date, language)} · ${frame.id}`
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
              {marker && (
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
                  {findings.map((finding, index) => (
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
                    <b>{formatDate(record.date, language).replace(' UTC', '')}</b>
                    <small>{record.band}</small>
                  </button>
                ))}
              </div>
            )}
            <p className="spherexFootnote">
              {language === 'es'
                ? 'Los recortes y fechas proceden del archivo público NASA/IPAC IRSA. SPHEREx observa en infrarrojo; el color y el halo suave de las fuentes brillantes son ayudas visuales, no luz visible ni detalle añadido a la medición. El campo mostrado es de 0,5° y se conserva el contraste del primer fotograma para comparar la secuencia. Puedes marcar una fuente y guardar una descripción del cambio entre fechas. Esto ayuda a explorar, pero no reemplaza una medición fotométrica calibrada. La cobertura y cadencia dependen del objetivo.'
                : 'Image cutouts and dates come from the public NASA/IPAC IRSA archive. SPHEREx observes in infrared; color and the soft glow around bright sources are visual aids, not visible light or added measurement detail. The field shown is 0.5° and the first frame’s contrast is held constant for comparison. You can mark a source and save a description of changes between dates. This supports exploration but does not replace calibrated photometry. Coverage and cadence depend on the target.'}
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
                {frame ? formatDate(frame.date, language) : ''} · {frame?.band}
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
