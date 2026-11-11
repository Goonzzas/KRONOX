import React from 'react';
const bands = [
  [0.75, 1.09, 'D1'],
  [1.1, 1.62, 'D2'],
  [1.63, 2.41, 'D3'],
  [2.42, 3.82, 'D4'],
  [3.83, 4.41, 'D5'],
  [4.42, 5, 'D6'],
];
const fmt = (v, n = 3) => (Number.isFinite(v) ? v.toPrecision(n) : 'Sin datos');
export default function SpectrumPlot({ measurements, selected, onSelect, domain }) {
  const valid = measurements
    .map((m, i) => ({ ...m, index: i }))
    .filter(
      (m) =>
        Number.isFinite(m.flux) &&
        Number.isFinite(m.wave) &&
        m.wave >= domain[0] &&
        m.wave <= domain[1],
    );
  const ymin = Math.min(0, ...valid.map((m) => m.flux - (m.sigma || 0))),
    ymax = Math.max(1e-4, ...valid.map((m) => m.flux + (m.sigma || 0)));
  const xp = (w) => 70 + ((w - domain[0]) / (domain[1] - domain[0])) * 720,
    yp = (f) => 215 - ((f - ymin) / (ymax - ymin || 1)) * 165;
  if (!valid.length)
    return (
      <div className="juanSpectrumEmpty" role="status">
        <b>
          {measurements.length
            ? 'Sin mediciones válidas en este intervalo'
            : 'Todavía no se ha medido una apertura'}
        </b>
        <p>
          {measurements.length
            ? [
                ...new Set(
                  measurements.map(
                    (m) => m.reason || 'La longitud de onda queda fuera del zoom actual.',
                  ),
                ),
              ].join(' · ')
            : 'Abre un producto o carga el siguiente lote. Una imagen produce una muestra espectral local; no equivale a un espectro completo.'}
        </p>
      </div>
    );
  return (
    <svg
      className="juanSpectrum"
      viewBox="0 0 840 285"
      role="img"
      aria-label={`${valid.length} muestras de brillo superficial frente a longitud de onda; puntos discontinuos con incertidumbres. Tabla accesible debajo.`}
    >
      <defs>
        <clipPath id="spectrumArea">
          <rect x="68" y="27" width="726" height="191" />
        </clipPath>
      </defs>
      <text x="70" y="19">
        Brillo superficial ({valid[0].unit || 'unidad desconocida'})
      </text>
      {[0, 1, 2, 3, 4].map((i) => {
        const f = ymin + ((ymax - ymin) * i) / 4;
        return (
          <g key={i}>
            <line x1="70" x2="790" y1={yp(f)} y2={yp(f)} />
            <text x="4" y={yp(f) + 4}>
              {fmt(f)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: 6 }, (_, i) => domain[0] + (i * (domain[1] - domain[0])) / 5).map(
        (w) => (
          <text key={w} x={xp(w) - 12} y="237">
            {w.toFixed(2)}
          </text>
        ),
      )}
      <g clipPath="url(#spectrumArea)">
        {valid.map((m) => (
          <g
            key={m.index}
            className={selected === m.index ? 'selected' : 'sample'}
            role="button"
            tabIndex="0"
            aria-label={`Seleccionar muestra ${m.index + 1}: ${fmt(m.flux)} más menos ${fmt(m.sigma)} a ${fmt(m.wave)} micrómetros`}
            onClick={() => onSelect(m.index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(m.index);
              }
            }}
          >
            <title>{`Muestra ${m.index + 1} · ${m.band} · ${m.wave} μm · ${m.flux} ± ${m.sigma} ${m.unit}`}</title>
            <line
              x1={xp(m.wave)}
              x2={xp(m.wave)}
              y1={yp(m.flux - (m.sigma || 0))}
              y2={yp(m.flux + (m.sigma || 0))}
            />
            <line
              x1={xp(m.wave - (m.bandwidth || 0) / 2)}
              x2={xp(m.wave + (m.bandwidth || 0) / 2)}
              y1={yp(m.flux)}
              y2={yp(m.flux)}
            />
            <circle cx={xp(m.wave)} cy={yp(m.flux)} r="5" />
            <text x={xp(m.wave) + 7} y={yp(m.flux) - 7}>
              {m.index + 1}
            </text>
          </g>
        ))}
      </g>
      {bands
        .filter(([a, b]) => b >= domain[0] && a <= domain[1])
        .map(([a, b, label], i) => (
          <g key={label}>
            <rect
              x={xp(Math.max(a, domain[0]))}
              y="246"
              width={xp(Math.min(b, domain[1])) - xp(Math.max(a, domain[0]))}
              height="13"
              fill={['#23475e', '#31596b', '#426975', '#537880', '#6b827f', '#858b7d'][i]}
            />
            <text x={xp((Math.max(a, domain[0]) + Math.min(b, domain[1])) / 2) - 8} y="257">
              {label}
            </text>
          </g>
        ))}
      <text x="320" y="278">
        Longitud de onda (μm)
      </text>
    </svg>
  );
}
