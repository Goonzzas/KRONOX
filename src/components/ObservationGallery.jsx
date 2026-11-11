import React, { useEffect, useRef, useState } from 'react';
import {
  chronologicalShowcase,
  observationMjd,
  recordDateRange,
  preferredProducts,
} from '../utils/temporalObservations.js';
const date = (r) => {
  const mjd = observationMjd(r);
  return Number.isFinite(mjd)
    ? new Date((mjd - 40587) * 86400000).toLocaleDateString('es', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Sin fecha';
};
function Thumbnail({ record, loadFits, selected, onOpen, onA, onB }) {
  const [src, setSrc] = useState(''),
    [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(loadFits);
  loader.current = loadFits;
  useEffect(() => {
    const ctrl = new AbortController();
    setSrc('');
    setError('');
    loader
      .current(record, ctrl.signal)
      .then((f) => {
        if (!ctrl.signal.aborted) setSrc(f.src);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [record.url, record.cutoutSizeDeg, record.localFile, attempt]);
  return (
    <article className={'observationCard' + (selected ? ' selected' : '')}>
      <button
        className="observationCardImage"
        onClick={onOpen}
        aria-label={'Abrir imagen ' + date(record) + ' ' + record.band}
      >
        {src ? (
          <img src={src} alt={record.band + ' · ' + date(record)} loading="lazy" />
        ) : (
          <span>{error ? 'No se pudo cargar' : 'Cargando FITS…'}</span>
        )}
      </button>
      <div>
        <b>{date(record)}</b>
        <span>
          {record.band} · {record.release?.replace('spherex_', '').toUpperCase()}
        </span>
        <small>{record.id}</small>
        {error && <small role="status">{error}</small>}
      </div>
      <footer>
        {error && <button onClick={() => setAttempt((v) => v + 1)}>Reintentar imagen</button>}
        <button onClick={onOpen}>Abrir</button>
        {onA && <button onClick={onA}>Usar A</button>}
        {onB && <button onClick={onB}>Usar B</button>}
      </footer>
    </article>
  );
}
export default function ObservationGallery({
  records,
  loadFits,
  selectedUrl,
  onSelect,
  onCompareA,
  onCompareB,
  band = 'ALL',
  onBandChange,
  year = 'ALL',
  onYearChange,
  bands = [],
  years = [],
}) {
  const [mode, setMode] = useState('epochs'),
    [page, setPage] = useState(0);
  const filtered = records.filter((r) => band === 'ALL' || r.band === band),
    range = recordDateRange(filtered),
    rows =
      mode === 'epochs'
        ? chronologicalShowcase(filtered, { count: 18 })
        : mode === 'versions'
          ? filtered
          : preferredProducts(filtered),
    pages = Math.max(1, Math.ceil(rows.length / 9)),
    visible = rows.slice(Math.min(page, pages - 1) * 9, (Math.min(page, pages - 1) + 1) * 9);
  useEffect(() => setPage(0), [mode, band]);
  return (
    <section className="observationGallery" aria-label="Galería de imágenes reales por fecha">
      <header>
        <div>
          <h3>Imágenes del archivo</h3>
          <p>
            {range
              ? `${new Date((range.first - 40587) * 86400000).toLocaleDateString('es', { timeZone: 'UTC' })} — ${new Date((range.last - 40587) * 86400000).toLocaleDateString('es', { timeZone: 'UTC' })} · ${range.days.toFixed(0)} días de cobertura`
              : 'Esperando productos'}{' '}
            · Cada tarjeta abre una imagen individual.
          </p>
        </div>
        <label>
          Organizar
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="epochs">Recorrido de fechas (selección distribuida)</option>
            <option value="exposures">Todas las exposiciones y detectores</option>
            <option value="versions">Todos los productos y versiones</option>
          </select>
        </label>
      </header>
      <div className="observationGalleryFilters">
        {onYearChange && (
          <label>
            Año
            <select
              aria-label="Año de la galería"
              value={year}
              onChange={(e) => onYearChange(e.target.value)}
            >
              <option value="ALL">Todos los años</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        )}
        {onBandChange && (
          <label>
            Detector
            <select
              aria-label="Detector de la galería"
              value={band}
              onChange={(e) => onBandChange(e.target.value)}
            >
              <option value="ALL">Todos los detectores</option>
              {bands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="observationGalleryGrid">
        {visible.map((r) => (
          <Thumbnail
            key={r.url + '|' + r.cutoutSizeDeg}
            record={r}
            loadFits={loadFits}
            selected={r.url === selectedUrl}
            onOpen={() => onSelect(r.url)}
            onA={onCompareA ? () => onCompareA(r.url) : null}
            onB={onCompareB ? () => onCompareB(r.url) : null}
          />
        ))}
      </div>
      <nav aria-label="Páginas de imágenes">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Imágenes anteriores
        </button>
        <span>
          {page + 1} / {pages} · {rows.length} imágenes en esta vista · {records.length} productos
          consultados
        </span>
        <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
          Más imágenes
        </button>
      </nav>
      <p className="juanScienceNote">
        La vista distribuida facilita recorrer el intervalo completo. Todas las exposiciones y sus
        versiones siguen disponibles en el selector. Distintos detectores o λ no demuestran un
        cambio temporal.
      </p>
    </section>
  );
}
