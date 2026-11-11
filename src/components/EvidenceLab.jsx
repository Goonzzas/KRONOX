import React, { useEffect, useMemo, useRef, useState } from 'react';
import { compareEpochs, continuumExercise } from '../utils/scientificEvidence.js';
import { compatibleRgb, rgbChannels } from '../utils/rgbComposite.js';
import { useObservationSamples } from './useObservationSamples.js';
import SpectrumPlot from './SpectrumPlot.jsx';
import '../styles/evidenceLab.css';
const fmt = (v, n = 4) => (Number.isFinite(v) ? v.toPrecision(n) : 'Sin datos');
function saveFile(name, content, type) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export default function EvidenceLab({
  target,
  frame,
  records,
  loadFits,
  marker,
  onSave,
  onContext,
  onSelectRecord,
  onShowImage,
  autoLoad = false,
}) {
  const [selected, setSelected] = useState(null),
    [conclusion, setConclusion] = useState(''),
    [reason, setReason] = useState(''),
    [radius, setRadius] = useState(target.type === 'galaxia' ? 24.6 : 12.3);
  const [rgb, setRgb] = useState(['', '', '']),
    [intervals, setIntervals] = useState([
      [0.75, 5],
      [0.75, 5],
      [0.75, 5],
    ]),
    [stretch, setStretch] = useState('asinh'),
    [gain, setGain] = useState(1),
    [contrast, setContrast] = useState(1),
    [normalization, setNormalization] = useState('common');
  const [rgbUrl, setRgbUrl] = useState(''),
    [rgbInfo, setRgbInfo] = useState(''),
    [chemistry, setChemistry] = useState(false),
    [depth, setDepth] = useState(0.25),
    [error, setError] = useState(''),
    [domain, setDomain] = useState([0.75, 5]);
  const canvas = useRef(null);
  const selection = useMemo(
    () =>
      marker && Number.isFinite(marker.ra) && Number.isFinite(marker.dec)
        ? { ra: marker.ra, dec: marker.dec }
        : null,
    [marker?.ra, marker?.dec],
  );
  const { samples, frames, busy, status, progress, loadBatch, cancel, retry, remaining } =
    useObservationSamples({ target, frame, records, loadFits, radius, selection });
  const automaticStarted = useRef(false);
  useEffect(() => {
    if (autoLoad && records.length && !automaticStarted.current) {
      automaticStarted.current = true;
      loadBatch({ limit: 12 });
    }
  }, [autoLoad, records.length]);
  const measurements = useMemo(() => samples.map((s) => s.measurement), [samples]),
    valid = measurements.filter((m) => Number.isFinite(m.flux) && Number.isFinite(m.wave));
  useEffect(() => {
    setSelected(null);
  }, [radius, selection?.ra, selection?.dec]);
  useEffect(() => {
    onContext?.({
      targetKey: target.key,
      screen: 'observatory',
      hasSpectrum: valid.length > 0,
      unit: valid[0]?.unit || null,
      selected: selected === null ? null : measurements[selected],
      selection,
      radiusArcsec: radius,
      measurements,
      band: frame?.record?.band || null,
      productId: frame?.record?.productId || frame?.record?.id || null,
      dataKind: 'real-observation',
      activeTool: chemistry ? 'synthetic-chemistry' : 'observations',
      uncertaintyMethod: 'Mean sigma; systematic PSF and ZODI uncertainty not included',
    });
  }, [target.key, frame, measurements, selected, chemistry]);
  const inspect = (i) => {
    setSelected(i);
    onSelectRecord?.(samples[i]?.record.url);
  };
  const chosen = rgb.map(
    (url, i) => frames.find((f) => f.record.url === url) || (!url ? frames[i] : null),
  );
  const chosenKey = chosen.map((f) => f?.record?.url || '').join('|');
  useEffect(() => {
    setRgbUrl('');
    if (chosen.some((f) => !f)) {
      setRgbInfo(
        'Se requieren tres productos retenidos en memoria. Vuelve a inspeccionar una muestra antigua para recargar su imagen.',
      );
      return;
    }
    if (!compatibleRgb(chosen)) {
      setRgbInfo('No se combinan: coordenadas, unidades o cuadrícula incompatibles.');
      return;
    }
    if (intervals.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b) || a >= b)) {
      setRgbInfo('Cada intervalo debe tener λ mínima menor que λ máxima.');
      return;
    }
    if (typeof document === 'undefined') return;
    let channels;
    try {
      channels = rgbChannels(chosen, intervals);
    } catch (e) {
      setRgbInfo(e.message);
      return;
    }
    const worker = new Worker(new URL('../workers/rgbWorker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e) => {
      const r = e.data;
      if (r.error) {
        setRgbInfo(r.error);
        return;
      }
      const c = canvas.current;
      if (!c) return;
      c.width = r.width;
      c.height = r.height;
      c.getContext('2d').putImageData(new ImageData(r.rgba, r.width, r.height), 0, 0);
      setRgbUrl(c.toDataURL());
      setRgbInfo(
        `${r.missing}/${r.width * r.height} píxeles sin datos válidos simultáneos en los tres canales. Normalización ${normalization === 'common' ? 'común' : 'independiente por canal'}. PSF sin homogeneizar: composición exploratoria. Los ajustes visuales no alteran las mediciones.`,
      );
    };
    worker.onerror = () =>
      setRgbInfo('No se pudo componer RGB. Reintenta o conserva las vistas individuales.');
    worker.postMessage(
      {
        channels,
        width: chosen[0].width,
        height: chosen[0].height,
        stretch,
        gain,
        contrast,
        normalization,
      },
      channels.map((a) => a.buffer),
    );
    return () => worker.terminate();
  }, [chosenKey, intervals, stretch, gain, contrast, normalization]);
  const evidence = () => ({
    version: 'kronox-evidence-v2',
    dataKind: 'real-observation',
    inspected: selected !== null,
    inspectedSample: selected,
    measurements,
    products: samples.map((s) => s.record),
    selection: measurements[selected]?.selection || selection || { ra: target.ra, dec: target.dec },
    radiusArcsec: radius,
    method: measurements[selected]?.method,
    rgb: {
      channels: chosen.map((f) => f?.record || null),
      intervals,
      stretch,
      gain,
      contrast,
      normalization,
    },
    limitations: [
      'PSF no homogeneizada',
      'CWAVE/CBAND no aplicados',
      'Sin fondo local; revisar sustracción ZODI',
      'Muestras discontinuas; versiones de una exposición no son épocas independientes',
    ],
  });
  const recordConclusion = () => {
    try {
      if (selected === null)
        throw Error(
          'Inspecciona una fila de medición, incluida una ausencia de datos, antes de concluir.',
        );
      if (!conclusion || reason.trim().length < 30)
        throw Error(
          'Elige una conclusión y explica la evidencia o sus límites (mínimo 30 caracteres).',
        );
      onSave({
        conclusion,
        description: reason,
        question: target.question || '¿Qué permiten concluir estas mediciones?',
        evidence: evidence(),
      });
      setError('Conclusión guardada en el cuaderno con observación y evidencia.');
    } catch (e) {
      setError(e.message);
    }
  };
  const comparison =
    measurements.length > 1
      ? compareEpochs(measurements[selected ?? 0], measurements[measurements.length - 1])
      : { ok: false, reason: 'Carga otra observación antes de comparar fechas.' };
  const exercise = continuumExercise(depth);
  return (
    <section className="juanEvidenceLab" aria-label="Laboratorio de evidencia científica">
      <header>
        <div>
          <small>ASTRAL SENTINELS · EVIDENCIA REPRODUCIBLE</small>
          <h3>Análisis espectral · de observar a justificar</h3>
        </div>
        <span className="juanDataBadge">OBSERVACIÓN REAL / PROCESAMIENTO</span>
      </header>
      <p>
        <b>Pregunta investigable:</b>{' '}
        {target.question ||
          '¿Qué medición respalda tu interpretación y qué incertidumbre queda abierta?'}
      </p>
      <div className="juanEvidenceToolbar">
        <button onClick={onShowImage}>Volver al visor de imágenes</button>
        <button onClick={loadBatch} disabled={busy || !remaining}>
          {busy
            ? `Cargando ${progress.done}/${progress.total}…`
            : `Cargar muestras disponibles (siguiente lote de hasta 6 · ${remaining} pendientes)`}
        </button>
        {busy && <button onClick={cancel}>Cancelar</button>}
        <button onClick={retry}>Reintentar productos fallidos</button>
        <label>
          Radio de apertura (arcsec)
          <select value={radius} onChange={(e) => setRadius(+e.target.value)}>
            <option>6.15</option>
            <option>12.3</option>
            <option>24.6</option>
          </select>
        </label>
        <button
          onClick={() =>
            saveFile(
              `evidencia-${target.key}.json`,
              JSON.stringify(
                {
                  target: {
                    identifier: target.identifier || target.astrometry?.source,
                    key: target.key,
                    ra: target.ra,
                    dec: target.dec,
                  },
                  ...evidence(),
                },
                null,
                2,
              ),
              'application/json',
            )
          }
        >
          Exportar evidencia JSON
        </button>
      </div>
      <p role="status">
        {samples.length} productos medidos · {valid.length} aperturas válidas · {frames.length}/18
        imágenes retenidas · {status}
      </p>
      <p className="juanScienceNote">
        Apertura{' '}
        {selection
          ? 'fija en la selección WCS'
          : 'centrada en el objetivo; movimiento propio propagado cuando existe'}
        . Media de brillo superficial IMAGE−ZODI en píxeles nativos con máscara estricta. No es
        flujo integrado ni un espectro continuo. Cambiar de imagen conserva las mediciones; cambiar
        la apertura o posición inicia una extracción nueva.
      </p>
      <div className="juanEvidenceToolbar">
        <label>
          Zoom λ mínima (μm)
          <input
            aria-label="Zoom longitud mínima"
            type="number"
            min=".75"
            max="4.99"
            step=".05"
            value={domain[0]}
            onChange={(e) => {
              const v = +e.target.value;
              if (v >= 0.75 && v < domain[1]) setDomain([v, domain[1]]);
            }}
          />
        </label>
        <label>
          Zoom λ máxima (μm)
          <input
            aria-label="Zoom longitud máxima"
            type="number"
            min=".76"
            max="5"
            step=".05"
            value={domain[1]}
            onChange={(e) => {
              const v = +e.target.value;
              if (v <= 5 && v > domain[0]) setDomain([domain[0], v]);
            }}
          />
        </label>
        <button onClick={() => setDomain([0.75, 5])}>Restablecer 0.75–5 μm</button>
        {selected !== null && measurements[selected]?.wave && (
          <button
            onClick={() => {
              const w = measurements[selected].wave;
              setDomain([Math.max(0.75, w - 0.15), Math.min(5, w + 0.15)]);
            }}
          >
            Ampliar muestra seleccionada
          </button>
        )}
      </div>
      <SpectrumPlot
        measurements={measurements}
        selected={selected}
        onSelect={inspect}
        domain={domain}
      />
      <p className="juanScienceNote">
        Barras verticales: σ conservadora = media de σ por píxel; no incluye sistemáticos de PSF,
        calibración ni ZODI. Barras horizontales: ancho medio del filtro. No se unen puntos de
        exposiciones distintas. Una ausencia de señal no se sustituye por cero.
      </p>
      <div className="juanTableWrap">
        <table>
          <caption>Selecciona una muestra para inspeccionar su evidencia y abrir su imagen</caption>
          <thead>
            <tr>
              <th>Muestra / fecha MJD</th>
              <th>λ / ancho (μm)</th>
              <th>Brillo / σ</th>
              <th>Píxeles válidos</th>
              <th>Calidad / procedencia</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((m, i) => (
              <tr key={m.url}>
                <td>
                  <button onClick={() => inspect(i)} aria-pressed={selected === i}>
                    Inspeccionar {i + 1}
                  </button>{' '}
                  {m.band}
                  <br />
                  {m.date || 'Fecha desconocida'}
                </td>
                <td>
                  {fmt(m.wave)} / {fmt(m.bandwidth)}
                </td>
                <td>
                  {fmt(m.flux)} ± {fmt(m.sigma)}
                  <br />
                  {m.unit || 'Sin unidad válida'}
                </td>
                <td>
                  {m.valid}/{m.total}
                </td>
                <td>
                  OR={m.flags}
                  <br />
                  {m.reason || 'Banderas no informativas excluidas'}
                  <br />
                  {samples[i].record.release} ·{' '}
                  {samples[i].record.pipelineVersion || 'versión en URL'}
                  <br />
                  <a href={m.url} target="_blank" rel="noreferrer">
                    Producto IRSA
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected !== null && measurements[selected] && (
        <p role="status">
          Muestra {selected + 1}:{' '}
          {measurements[selected].reason ||
            `${fmt(measurements[selected].flux)} ± ${fmt(measurements[selected].sigma)} ${measurements[selected].unit} a ${fmt(measurements[selected].wave)} μm`}
          . Producto: {measurements[selected].productId}.
        </p>
      )}
      <p className="juanComparison">
        <b>Comparación de fechas:</b> {comparison.reason} Compara la selección con la última
        muestra. Fechas, versiones y longitudes de onda distintas tienen significados diferentes.
      </p>
      <details>
        <summary>Laboratorio RGB · falso color y vistas individuales</summary>
        <p>
          Asignación visual de tres productos infrarrojos alineados en la misma cuadrícula TAN
          mediante WCS. El intervalo de cada canal selecciona los píxeles cuya λ calibrada está
          dentro de esos límites; no integra un cubo ni rellena cobertura ausente.
        </p>
        <div className="juanRgbChannels">
          {['R', 'G', 'B'].map((c, i) => (
            <fieldset key={c}>
              <legend>Canal {c}</legend>
              <label>
                Producto
                <select
                  aria-label={`Producto ${c}`}
                  value={rgb[i] || chosen[i]?.record.url || ''}
                  onChange={(e) =>
                    setRgb((old) => old.map((v, j) => (i === j ? e.target.value : v)))
                  }
                >
                  <option value="">Seleccionar</option>
                  {frames.map((f) => (
                    <option value={f.record.url} key={f.record.url}>
                      {f.record.band} · {f.spectral?.wavelengthUm ?? 'λ desconocida'} μm · MJD{' '}
                      {f.record.dateAvg || f.record.date}
                    </option>
                  ))}
                </select>
              </label>
              {[0, 1].map((j) => (
                <label key={j}>
                  λ {j ? 'máxima' : 'mínima'} (μm)
                  <input
                    type="number"
                    min=".75"
                    max="5"
                    step=".01"
                    value={intervals[i][j]}
                    onChange={(e) =>
                      setIntervals((old) =>
                        old.map((v, k) =>
                          k === i ? v.map((x, h) => (h === j ? +e.target.value : x)) : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <small>
                {chosen[i]
                  ? `${chosen[i].extensions.imageUnit} · ${chosen[i].record.release} · ${chosen[i].spectral?.bandwidthUm ?? 'ancho desconocido'} μm de ancho local`
                  : 'Sin producto'}
              </small>
            </fieldset>
          ))}
        </div>
        <div className="juanEvidenceToolbar">
          <label>
            Estiramiento
            <select value={stretch} onChange={(e) => setStretch(e.target.value)}>
              <option>asinh</option>
              <option value="linear">lineal</option>
              <option>log</option>
            </select>
          </label>
          <label>
            Brillo visual
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={gain}
              onChange={(e) => setGain(+e.target.value)}
            />
          </label>
          <label>
            Contraste visual
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={contrast}
              onChange={(e) => setContrast(+e.target.value)}
            />
          </label>
          <label>
            Normalización
            <select value={normalization} onChange={(e) => setNormalization(e.target.value)}>
              <option value="common">Escala común</option>
              <option value="channel">Independiente por canal</option>
            </select>
          </label>
        </div>
        <canvas ref={canvas} hidden />
        {rgbUrl ? (
          <>
            <img
              className="juanRgb"
              src={rgbUrl}
              alt="Composición infrarroja de falso color; patrón cuadriculado indica datos ausentes"
            />
            <p>
              {chosen
                .map(
                  (f, i) =>
                    `${'RGB'[i]} = ${f?.record.band || 'SIN COBERTURA'} · ${intervals[i].join('–')} μm`,
                )
                .join(' · ')}
            </p>
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = rgbUrl;
                a.download = target.key + '-RGB.png';
                a.click();
                saveFile(
                  target.key + '-RGB-procedencia.json',
                  JSON.stringify(evidence(), null, 2),
                  'application/json',
                );
              }}
            >
              Guardar RGB y procedencia JSON
            </button>
          </>
        ) : (
          <p>Se necesitan tres planos compatibles. No se generan canales artificiales.</p>
        )}
        <p className="juanScienceNote">
          {rgbInfo} La normalización independiente cambia las razones entre canales; asinh y log
          también son transformaciones visuales. No inferir colores físicos, variabilidad ni
          moléculas. PSF y tiempos de exposición pueden diferir.
        </p>
      </details>
      <details onToggle={(e) => setChemistry(e.currentTarget.open)}>
        <summary>Astroquímica guiada · ejemplo sintético identificado</summary>
        <p>
          <b>{exercise.label}</b>. Absorción gaussiana educativa próxima a 3.05 μm; no es una
          identificación molecular de los datos reales.
        </p>
        <label>
          Profundidad simulada
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={depth}
            onChange={(e) => setDepth(+e.target.value)}
          />
        </label>
        <svg
          viewBox="0 0 840 150"
          className="juanChemistry"
          role="img"
          aria-label="Continuo sintético discontinuo y absorción simulada continua"
        >
          <polyline
            className="continuum"
            points={exercise.rows
              .map((r) => `${40 + (r.wave - 2.5) * 750},${120 - r.continuum * 80}`)
              .join(' ')}
          />
          <polyline
            points={exercise.rows
              .map((r) => `${40 + (r.wave - 2.5) * 750},${120 - r.flux * 80}`)
              .join(' ')}
          />
          <text x="260" y="145">
            λ (μm), 2.5–3.5 · brillo relativo
          </text>
        </svg>
        <p>
          Alternativas a una absorción: continuo mal estimado, ruido, respuesta instrumental y
          mezcla de fuentes.
        </p>
        <a href={exercise.reference} target="_blank" rel="noreferrer">
          Referencia NASA/Webb sobre hielos interestelares (otro observatorio)
        </a>
      </details>
      <p>
        <a
          href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
          target="_blank"
          rel="noreferrer"
        >
          Herramientas oficiales IRSA y espectrofotometría
        </a>{' '}
        · Esta aplicación realiza una extracción exploratoria de brillo superficial; no sustituye la
        fotometría de fuentes con modelado PSF de IRSA.
      </p>
      <div className="juanConclusion">
        <h4>Registrar una conclusión sustentada</h4>
        <label>
          Conclusión
          <select value={conclusion} onChange={(e) => setConclusion(e.target.value)}>
            <option value="">Elige…</option>
            <option>Evidencia insuficiente</option>
            <option>Compatible con la hipótesis, sin detección concluyente</option>
            <option>Debo corregir mi hipótesis</option>
          </select>
        </label>
        <label>
          Justificación, evidencia y límites
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cita una muestra, su incertidumbre o por qué faltan datos comparables."
            maxLength="2000"
          />
        </label>
        <button onClick={recordConclusion} disabled={!samples.length}>
          Guardar conclusión con evidencia en el cuaderno
        </button>
      </div>
      <p role="status" aria-live="polite">
        {error}
      </p>
    </section>
  );
}
