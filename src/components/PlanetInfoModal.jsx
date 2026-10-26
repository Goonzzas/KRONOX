import React from 'react';

export default function PlanetInfoModal({ planet, data, onClose }) {
  if (!planet || !data) return null;
  return (
    <div className="modalShade" onClick={onClose}>
      <article
        className="infoCard"
        role="dialog"
        aria-modal="true"
        aria-label={`Información sobre ${planet}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="infoHeader">
          <div>
            <h2>{planet}</h2>
            <p>{data.intro}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar ficha">
            Cerrar ✕
          </button>
        </div>
        <img
          className="infoImage"
          src={data.img}
          alt={`Imagen de ${planet} — NASA`}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <div className="infoGrid">
          {[
            ['Superficie / estructura', data.superficie],
            ['Composición', data.composicion],
            ['Atmósfera', data.atmosfera],
            ['Temperatura', data.temperatura],
            ['Clima', data.clima],
            ['Dato curioso', data.dato],
          ].map(([title, value]) => (
            <div className="infoItem" key={title}>
              <b>{title}</b>
              {value}
            </div>
          ))}
        </div>
        <div className="infoFooter">
          Imagen y datos: NASA. Las temperaturas de los gigantes gaseosos y helados corresponden a
          una capa atmosférica de referencia, no a una superficie sólida.{' '}
          <a href={data.source} target="_blank" rel="noreferrer">
            Ficha de {planet} en NASA
          </a>{' '}
          ·{' '}
          <a
            href="https://science.nasa.gov/resource/solar-system-temperatures/"
            target="_blank"
            rel="noreferrer"
          >
            Temperaturas del sistema solar
          </a>
        </div>
      </article>
    </div>
  );
}
