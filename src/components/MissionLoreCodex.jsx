import React, { useEffect, useState } from 'react';

const LORE_CHAPTERS = [
  {
    id: 'cosmos',
    number: '01',
    badge: 'CAPÍTULO 01 / 04 · LA PREGUNTA CÓSMICA',
    tabLabel: '01 · Luz Oculta',
    title: 'Más Allá de Nuestros Ojos',
    quote: '«Durante siglos miramos el cielo solo en luz visible, dejando el noventa por ciento de las cunas estelares escondido tras el polvo.»',
    paragraphs: [
      'Desde la Tierra, la luz óptica apenas atraviesa las densas nubes moleculares donde nacen las estrellas y los sistemas planetarios.',
      'Lo que parecía espacio vacío resultó estar repleto de reservorios helados de agua, monóxido de carbono, discos protoplanetarios y galaxias cuyo rastro solo brilla en el infrarrojo.',
    ],
    facts: [
      { label: 'Luz Visible', value: '0.40 – 0.70 μm' },
      { label: 'Ventana Oculta', value: 'Polvo y Hielos Fríos' },
    ],
  },
  {
    id: 'spherex',
    number: '02',
    badge: 'CAPÍTULO 02 / 04 · OBSERVATORIO ESPACIAL',
    tabLabel: '02 · NASA SPHEREx',
    title: 'La Revolución Espectral Infrarroja',
    quote: '«En cada longitud de onda infrarroja, una misma región del cielo revela moléculas distintas y épocas perdidas del universo.»',
    paragraphs: [
      'Inspirado en la misión NASA SPHEREx (0.75–5.0 μm), el cartografiado en 102 bandas espectrales permitió separar firmas químicas de H₂O, CO₂ y metano sin sesgos de polvo interestelar.',
      'Gracias a sus escudos térmicos en forma de triple cono, el observatorio escanea todo el firmamento desde una órbita polar heliosíncrona.',
    ],
    facts: [
      { label: 'Cobertura', value: '102 Bandas IR (0.75–5.0 μm)' },
      { label: 'Órbita Polar', value: '~650 km · Cielo Completo' },
    ],
  },
  {
    id: 'frontier',
    number: '03',
    badge: 'CAPÍTULO 03 / 04 · ENIGMAS ABIERTOS',
    tabLabel: '03 · Confines Fríos',
    title: 'Mundos Helados e Hipótesis Abiertas',
    quote: '«Entre el cinturón exterior y las estrellas vecinas persisten anomalías orbitales y enanas marrones tan frías que desafían nuestra detección.»',
    paragraphs: [
      'Objetos subestelares de clase Y como WISE 0855 (~250 K) o posibles cuerpos distantes en la periferia solar emiten su escaso calor únicamente en el infrarrojo lejano y medio.',
      'En KRONOX nunca confundirás una hipótesis abierta —como la búsqueda de un Planeta IX— con un hallazgo confirmado: cada medición exige contraste real con catálogos IRSA, Gaia DR3 y CatWISE2020.',
    ],
    facts: [
      { label: 'Mundos Subestelares', value: 'Clases L, T e Y (~250 K)' },
      { label: 'Rigor Epistémico', value: 'Hipótesis vs. Confirmado' },
    ],
  },
  {
    id: 'kronox',
    number: '04',
    badge: 'CAPÍTULO 04 / 04 · PROYECTO HORIZONTE',
    tabLabel: '04 · Nave KRONOX',
    title: 'El Crucero Científico de 120 Metros',
    quote: '«Para llevar el observatorio y la experimentación directa al espacio profundo, el Proyecto Horizonte ensambló KRONOX.»',
    paragraphs: [
      'Estructurado en cuatro cubiertas habitables en microgravedad 6-DOF, KRONOX combina el Puente de Mando (C01), Laboratorio y Criostato SPHEREx (C02), Hábitat y Fitotrón (C03) e Ingeniería con Reactor Tokamak D-³He (C04).',
      'Junto a la entidad luminosa KRONOX IA, tu misión comienza calibrando el acoplador óptico averiado y analizando espectros reales en la frontera interestelar.',
    ],
    facts: [
      { label: 'Arquitectura', value: '120 m · 4 Cubiertas Modulares' },
      { label: 'Asistencia', value: 'KRONOX IA + Propulsión MPD' },
    ],
  },
];

const KRONOX_DECK_HOTSPOTS = [
  { id: 'c01', code: 'C01', name: 'Puente y Timón', desc: 'Astrografía J2000.0, timón orbital y enlace con KRONOX IA.', svgX: 478 },
  { id: 'c02', code: 'C02', name: 'Lab SPHEREx', desc: 'Criostato 40 K, banco óptico FITS y espectrometría 102 canales.', svgX: 390 },
  { id: 'c03', code: 'C03', name: 'Habitabilidad', desc: 'Anillo modular presurizado, camarotes y fitotrón hidropónico.', svgX: 280 },
  { id: 'c04', code: 'C04', name: 'Reactor Tokamak', desc: 'Fusión toroidal D-³He y tobera magnetoplasmadinámica (MPD).', svgX: 176 },
];

function LoreArtworkCosmos() {
  return (
    <svg viewBox="0 0 560 340" className="kronox-lore-svg" role="img" aria-label="Ilustración animada de la luz visible vs infrarrojo cósmico">
      <defs>
        <radialGradient id="loreEarthGlow" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="48%" stopColor="#1d4ed8" />
          <stop offset="85%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <radialGradient id="loreNebulaDust" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.48" />
          <stop offset="45%" stopColor="#7c2d12" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="loreIrBeam" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.52" />
          <stop offset="60%" stopColor="#f472b6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fondo estelar con destellos espectrales */}
      <g className="lore-twinkle-group">
        {[
          [42, 48, 1.5, '#f8fafc'], [112, 34, 2.2, '#93c5fd'], [185, 78, 1.4, '#fde68a'],
          [260, 42, 2.0, '#fca5a5'], [345, 55, 1.8, '#e0f2fe'], [425, 38, 2.4, '#fb923c'],
          [498, 72, 1.6, '#f8fafc'], [520, 145, 2.0, '#bae6fd'], [470, 265, 1.8, '#fde68a'],
          [235, 290, 1.5, '#cbd5e1'], [312, 250, 2.1, '#fca5a5'], [95, 285, 1.6, '#7dd3fc'],
        ].map(([cx, cy, r, fill], idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={r}
            fill={fill}
            className="lore-star-twinkle"
            style={{ animationDelay: `${idx * 0.35}s` }}
          />
        ))}
      </g>

      {/* Nebulosa polvorienta infrarroja en respiración lenta */}
      <g className="lore-nebula-breathe">
        <ellipse cx="395" cy="175" rx="145" ry="92" fill="url(#loreNebulaDust)" />
        <ellipse cx="420" cy="160" rx="88" ry="52" fill="url(#loreNebulaDust)" opacity="0.7" />
        {/* Protoestrellas ocultas tras el polvo */}
        <circle cx="385" cy="172" r="4.5" fill="#fbbf24" />
        <circle cx="385" cy="172" r="14" fill="#f59e0b" opacity="0.28" className="lore-pulse-soft" />
        <circle cx="438" cy="150" r="3.5" fill="#fb7185" />
        <circle cx="438" cy="150" r="11" fill="#f43f5e" opacity="0.25" className="lore-pulse-soft" />
        <circle cx="352" cy="198" r="3" fill="#38bdf8" />
      </g>

      {/* Planeta Tierra iluminado en limbo + atmósfera */}
      <g transform="translate(115, 185)">
        <circle cx="0" cy="0" r="76" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.35" className="lore-pulse-soft" />
        <circle cx="0" cy="0" r="66" fill="url(#loreEarthGlow)" />
        {/* Continentes estilizados y nubes */}
        <path d="M-32,-26 C-12,-40 16,-32 28,-10 C18,6 -6,12 -24,-2 Z" fill="#34d399" fillOpacity="0.35" />
        <path d="M-8,16 C12,8 34,20 26,44 C10,54 -14,42 -12,26 Z" fill="#22c55e" fillOpacity="0.28" />
        <path d="M-48,-8 Q-8,-22 44,-4" fill="none" stroke="#e0f2fe" strokeWidth="2.4" strokeOpacity="0.45" strokeLinecap="round" />
        <path d="M-34,22 Q8,8 48,26" fill="none" stroke="#e0f2fe" strokeWidth="1.8" strokeOpacity="0.32" strokeLinecap="round" />
        {/* Sonda / arco de mirada desde la Tierra */}
        <circle cx="0" cy="0" r="88" fill="none" stroke="rgba(125,211,252,0.22)" strokeDasharray="4 6" className="lore-spin-slow" />
      </g>

      {/* Barrido infrarrojo desde la órbita terrestre hacia la nebulosa */}
      <g transform="translate(160, 145)">
        <g className="lore-scan-sweep">
          <polygon points="0,0 265,-62 275,58" fill="url(#loreIrBeam)" />
          <line x1="0" y1="0" x2="270" y2="-2" stroke="#7dd3fc" strokeWidth="1.2" strokeDasharray="6 4" strokeOpacity="0.7" />
        </g>
      </g>

      {/* Etiquetas HUD técnicas */}
      <g fontFamily="ui-monospace, monospace" fontSize="10" fill="#94a3b8">
        <text x="24" y="28" fill="#7dd3fc">ESCALA: TIERRA → NUBES MOLECULARES</text>
        <text x="305" y="295" fill="#fbbf24">POLVO OPACO EN ÓPTICO · TRANSPARENTE EN IR</text>
      </g>
    </svg>
  );
}

function LoreArtworkSpherex() {
  const spectrumBars = [
    { x: 26, h: 46, color: '#60a5fa', label: '0.8μm' },
    { x: 55, h: 62, color: '#38bdf8', label: '' },
    { x: 84, h: 52, color: '#22d3ee', label: '' },
    { x: 113, h: 28, color: '#34d399', label: 'H₂O 3.0', dip: true },
    { x: 142, h: 58, color: '#a3e635', label: '' },
    { x: 171, h: 22, color: '#fbbf24', label: 'CO₂ 4.3', dip: true },
    { x: 200, h: 24, color: '#f97316', label: 'CO 4.7', dip: true },
    { x: 229, h: 48, color: '#fb7185', label: 'PAH' },
  ];

  return (
    <svg viewBox="0 0 560 340" className="kronox-lore-svg" role="img" aria-label="Ilustración animada del observatorio NASA SPHEREx escaneando el cielo infrarrojo">
      <defs>
        <linearGradient id="spherexConeBeam" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.48" />
          <stop offset="55%" stopColor="#a855f7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="shieldMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="55%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>

      {/* Curvatura polar terrestre abajo a la izquierda */}
      <circle cx="95" cy="405" r="190" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" strokeOpacity="0.45" />
      <path d="M-20,275 Q145,212 315,295" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 5" strokeOpacity="0.4" />

      {/* Trayectoria orbital del telescopio */}
      <ellipse cx="170" cy="215" rx="190" ry="72" transform="rotate(-24 170 215)" fill="none" stroke="rgba(125,211,252,0.22)" strokeDasharray="4 6" />

      {/* Contenedor posicionado fuera de la animación CSS para no sobrescribir translate */}
      <g transform="translate(185, 165)">
        <g className="lore-float-gentle">
          {/* Haz espectral rotatorio */}
          <g transform="translate(22, -32)">
            <g className="lore-scan-sweep-tight">
              <polygon points="0,0 135,-125 225,-35" fill="url(#spherexConeBeam)" />
              <line x1="0" y1="0" x2="180" y2="-80" stroke="#7dd3fc" strokeWidth="1.2" strokeOpacity="0.7" strokeDasharray="5 4" />
            </g>
          </g>

          {/* Panel solar */}
          <polygon points="-28,36 28,22 20,76 -36,88" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.4" />
          <line x1="-10" y1="31" x2="-18" y2="83" stroke="#60a5fa" strokeWidth="0.8" strokeOpacity="0.6" />
          <line x1="10" y1="26" x2="2" y2="78" stroke="#60a5fa" strokeWidth="0.8" strokeOpacity="0.6" />

          {/* Bus hexagonal dorado */}
          <polygon points="-22,12 18,4 24,26 -16,34" fill="#d97706" stroke="#fcd34d" strokeWidth="1.2" />

          {/* Triple escudo cónico V-Groove de SPHEREx */}
          <polygon points="-44,-22 52,-46 20,8 -16,16" fill="url(#shieldMetal)" stroke="#e2e8f0" strokeWidth="1.4" />
          <polygon points="-32,-26 42,-44 18,-2 -12,5" fill="none" stroke="#475569" strokeWidth="1.2" />
          <ellipse cx="4" cy="-34" rx="48" ry="12" transform="rotate(-14 4 -34)" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.3" />
          {/* Apertura del telescopio criogénico */}
          <ellipse cx="6" cy="-34" rx="18" ry="6" transform="rotate(-14 6 -34)" fill="#0ea5e9" fillOpacity="0.55" stroke="#7dd3fc" strokeWidth="1.4" />
        </g>
      </g>

      {/* Recuadro de espectrograma animado a la derecha */}
      <g transform="translate(278, 198)">
        <rect x="0" y="0" width="262" height="118" rx="10" fill="rgba(6, 13, 28, 0.85)" stroke="rgba(56, 189, 248, 0.35)" />
        <text x="14" y="20" fontFamily="ui-monospace, monospace" fontSize="9.5" fill="#7dd3fc">ESPECTRO INFRARROJO · 0.75 – 5.0 μm</text>
        <line x1="18" y1="90" x2="248" y2="90" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
        {spectrumBars.map((bar, idx) => (
          <g key={idx}>
            <rect
              x={bar.x}
              y={90 - bar.h}
              width="14"
              height={bar.h}
              rx="3"
              fill={bar.color}
              fillOpacity={bar.dip ? 0.92 : 0.62}
              className="lore-bar-pulse"
              style={{ animationDelay: `${idx * 0.18}s` }}
            />
            {bar.label && (
              <text x={bar.x + 7} y="106" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="7.5" fill={bar.dip ? bar.color : '#94a3b8'}>
                {bar.label}
              </text>
            )}
          </g>
        ))}
      </g>

      <text x="24" y="28" fontFamily="ui-monospace, monospace" fontSize="10" fill="#7dd3fc">
        ÓRBITA POLAR HELIOSÍNCRONA (~650 KM) · BARRIDO ESPECTRAL
      </text>
    </svg>
  );
}

function LoreArtworkFrontier() {
  return (
    <svg viewBox="0 0 560 340" className="kronox-lore-svg" role="img" aria-label="Ilustración animada del sistema solar exterior y anomalías gravitacionales">
      <defs>
        <radialGradient id="sunCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="coldWorldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="50%" stopColor="#7e22ce" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sol y órbitas interiores */}
      <g transform="translate(175, 175)">
        <circle cx="0" cy="0" r="28" fill="url(#sunCore)" />
        <circle cx="0" cy="0" r="7" fill="#fef08a" />
        <circle cx="0" cy="0" r="36" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
        <circle cx="0" cy="0" r="64" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="1.2" />
        {/* Cinturón de Kuiper puntuado */}
        <circle cx="0" cy="0" r="98" fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth="8" strokeDasharray="1.5 6.5" className="lore-spin-very-slow" />

        {/* Órbitas excéntricas agrupadas de objetos transneptunianos */}
        <ellipse cx="48" cy="-14" rx="115" ry="52" transform="rotate(-14)" fill="none" stroke="rgba(251,191,36,0.42)" strokeWidth="1.2" strokeDasharray="4 4" />
        <ellipse cx="62" cy="18" rx="132" ry="58" transform="rotate(8)" fill="none" stroke="rgba(251,191,36,0.34)" strokeWidth="1.2" strokeDasharray="4 4" />

        {/* Órbita inclinada hipotética exterior */}
        <ellipse cx="95" cy="-6" rx="225" ry="96" transform="rotate(-5)" fill="none" stroke="#f472b6" strokeWidth="1.5" strokeOpacity="0.58" strokeDasharray="7 5" />

        {/* Planetas interiores orbitando */}
        <g className="lore-orbit-planet-a">
          <circle cx="64" cy="0" r="4.5" fill="#38bdf8" />
        </g>
        <g className="lore-orbit-planet-b">
          <circle cx="98" cy="0" r="3.5" fill="#93c5fd" />
        </g>
      </g>

      {/* Candidato / Objeto frío distante con ondas gravitacionales */}
      <g transform="translate(422, 154)">
        <circle cx="0" cy="0" r="44" fill="url(#coldWorldGlow)" />
        <circle cx="0" cy="0" r="24" fill="none" stroke="#f472b6" strokeWidth="1.2" className="lore-ripple-out" />
        <circle cx="0" cy="0" r="36" fill="none" stroke="#c084fc" strokeWidth="1" className="lore-ripple-out" style={{ animationDelay: '1.1s' }} />
        <circle cx="0" cy="0" r="9.5" fill="#a855f7" stroke="#f5d0fe" strokeWidth="1.4" />
        <text x="0" y="-32" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9.5" fill="#f9a8d4">
          HIPÓTESIS FRONTERA · T ~ 250 K
        </text>
        <text x="0" y="38" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8.5" fill="#cbd5e1">
          PERTURBACIÓN TNO / ENANAS Y
        </text>
      </g>

      <g fontFamily="ui-monospace, monospace" fontSize="10" fill="#94a3b8">
        <text x="24" y="28" fill="#7dd3fc">CONFINES EXTERIORES · RESONANCIA Y ASTROMETRÍA</text>
        <text x="24" y="318" fill="#cbd5e1">ESTADO EPISTÉMICO: CANDIDATOS PENDIENTES DE CONTRASTE CATWISE2020 / GAIA DR3</text>
      </g>
    </svg>
  );
}

function LoreArtworkKronox({ activeDeckId, onSelectDeck }) {
  const activeDeck = KRONOX_DECK_HOTSPOTS.find((d) => d.id === activeDeckId) || KRONOX_DECK_HOTSPOTS[0];
  return (
    <div className="kronox-lore-blueprint-wrap">
      <svg viewBox="0 0 560 250" className="kronox-lore-svg" role="img" aria-label="Plano esquemático animado del crucero científico KRONOX de 120 metros">
        <defs>
          <linearGradient id="kronoxHullGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <radialGradient id="plasmaPlume" cx="85%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.88" />
            <stop offset="45%" stopColor="#0284c7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Rejilla técnica de 120 m */}
        <line x1="40" y1="216" x2="522" y2="216" stroke="rgba(125,211,252,0.35)" strokeWidth="1" />
        <line x1="40" y1="210" x2="40" y2="222" stroke="rgba(125,211,252,0.55)" strokeWidth="1.2" />
        <line x1="522" y1="210" x2="522" y2="222" stroke="rgba(125,211,252,0.55)" strokeWidth="1.2" />
        <text x="280" y="233" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9.2" fill="#7dd3fc">
          ESCALA REAL DE REFERENCIA: 120 METROS (1 UNIDAD = 1 METRO)
        </text>

        {/* Silueta modular de la nave KRONOX flotando (wrapper sin animar para mantener offset exacto) */}
        <g transform="translate(0, -14)">
          <g className="lore-float-gentle">
            {/* Flujo de plasma ionizado en popa (izquierda) */}
            <ellipse cx="66" cy="140" rx="56" ry="20" fill="url(#plasmaPlume)" className="lore-pulse-soft" />
            <polygon points="94,124 132,118 132,162 94,156" fill="#475569" stroke="#94a3b8" strokeWidth="1.3" />
            {/* Anillo magnético MPD de popa */}
            <ellipse cx="102" cy="140" rx="12" ry="36" fill="none" stroke="#38bdf8" strokeWidth="4" strokeOpacity="0.72" />

            {/* Sección C04 Ingeniería & Tokamak */}
            <rect x="132" y="120" width="96" height="40" rx="4" fill="url(#kronoxHullGrad)" stroke="#cbd5e1" strokeWidth="1.2" />
            <ellipse cx="176" cy="140" rx="14" ry="11" fill="rgba(56,189,248,0.28)" stroke="#f97316" strokeWidth="2.2" className="lore-pulse-soft" />

            {/* Sección C03 Anillo centrífugo / Habitabilidad */}
            <rect x="228" y="124" width="110" height="32" rx="3" fill="#64748b" stroke="#cbd5e1" strokeWidth="1.2" />
            <ellipse cx="280" cy="140" rx="16" ry="46" fill="none" stroke="#e2e8f0" strokeWidth="7.5" />
            <ellipse cx="280" cy="140" rx="16" ry="46" fill="none" stroke="#38bdf8" strokeWidth="1.4" strokeOpacity="0.65" />

            {/* Sección C02 Laboratorio y escudo térmico SPHEREx */}
            <rect x="338" y="126" width="118" height="28" rx="3" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
            <rect x="364" y="120" width="52" height="40" rx="5" fill="#ca8a04" fillOpacity="0.75" stroke="#fde047" strokeWidth="1.2" />
            <polygon points="390,118 406,96 422,118" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1.2" />

            {/* Sección C01 Puente de Mando + Escudo deflector de proa */}
            <rect x="456" y="122" width="44" height="36" rx="4" fill="#e2e8f0" stroke="#7dd3fc" strokeWidth="1.3" />
            <polygon points="500,118 522,140 500,162" fill="#94a3b8" stroke="#f8fafc" strokeWidth="1.3" />

            {/* Entidad luminosa KRONOX IA sobre el puente */}
            <g transform="translate(478, 86)">
              <g className="lore-pulse-soft">
                <circle cx="0" cy="0" r="6" fill="#e0f2fe" />
                <ellipse cx="0" cy="0" rx="16" ry="5" transform="rotate(28)" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
                <ellipse cx="0" cy="0" rx="16" ry="5" transform="rotate(-32)" fill="none" stroke="#7dd3fc" strokeWidth="1.2" />
              </g>
            </g>

            {/* Indicadores interactivos alineados exactamente con cada cubierta */}
            {KRONOX_DECK_HOTSPOTS.map((d) => {
              const selected = d.id === activeDeckId;
              return (
                <g
                  key={d.id}
                  transform={`translate(${d.svgX}, 196)`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectDeck(d.id)}
                >
                  <line x1="0" y1="-34" x2="0" y2="-4" stroke={selected ? '#38bdf8' : 'rgba(148,163,184,0.45)'} strokeDasharray="3 3" />
                  <circle cx="0" cy="0" r={selected ? 11 : 8} fill={selected ? '#0ea5e9' : 'rgba(15,23,42,0.9)'} stroke={selected ? '#e0f2fe' : '#64748b'} strokeWidth="1.5" />
                  <text x="0" y="3.5" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8" fontWeight="700" fill="#f8fafc">
                    {d.code}
                  </text>
                </g>
              );
            })}
          </g>
        </g>

        <text x="24" y="24" fontFamily="ui-monospace, monospace" fontSize="10" fill="#7dd3fc">
          ARQUITECTURA MODULAR DE 4 CUBIERTAS · SELECCIONA UNA CUBIERTA
        </text>
      </svg>

      <div className="kronox-lore-deck-selector" role="group" aria-label="Cubiertas de KRONOX">
        {KRONOX_DECK_HOTSPOTS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`kronox-lore-deck-chip${d.id === activeDeckId ? ' is-active' : ''}`}
            onClick={() => onSelectDeck(d.id)}
          >
            <strong>{d.code}</strong> · {d.name}
          </button>
        ))}
      </div>
      <p className="kronox-lore-deck-note">
        <strong>{activeDeck.code} — {activeDeck.name}:</strong> {activeDeck.desc}
      </p>
    </div>
  );
}

export default function MissionLoreCodex({
  onBack,
  onStartExpedition,
  onPlayUiCue,
}) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState('c01');

  useEffect(() => {
    if (!autoPlay) return undefined;
    const timer = setInterval(() => {
      setChapterIndex((prev) => (prev + 1) % LORE_CHAPTERS.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const chapter = LORE_CHAPTERS[chapterIndex] || LORE_CHAPTERS[0];

  const selectChapter = (idx) => {
    onPlayUiCue?.('tap');
    setChapterIndex((idx + LORE_CHAPTERS.length) % LORE_CHAPTERS.length);
  };

  return (
    <section
      className="kronox-menu-panel kronox-lore-codex-panel"
      aria-label="Historia y lore de la misión KRONOX"
    >
      <div className="kronox-menu-panel-header">
        <div>
          <span className="kronox-main-menu-badge">CRÓNICA PROYECTO HORIZONTE · ARCHIVO VISUAL</span>
          <h2>Historia y Lore de la Misión</h2>
        </div>
        <div className="kronox-lore-header-controls">
          <button
            type="button"
            className={`kronox-pause-secondary-btn${autoPlay ? ' is-active' : ''}`}
            onClick={() => {
              onPlayUiCue?.('tap');
              setAutoPlay((p) => !p);
            }}
            aria-pressed={autoPlay}
          >
            {autoPlay ? '⏸ Pausar crónica' : '▶ Auto-crónica'}
          </button>
          <button
            type="button"
            className="kronox-pause-secondary-btn"
            onClick={() => {
              onPlayUiCue?.('tap');
              onBack?.();
            }}
          >
            ← Volver al Menú
          </button>
        </div>
      </div>

      {/* Selector visual de capítulos */}
      <div className="kronox-settings-tabs" role="tablist" aria-label="Capítulos de la historia">
        {LORE_CHAPTERS.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={chapterIndex === idx}
            className={`kronox-settings-tab${chapterIndex === idx ? ' active' : ''}`}
            onClick={() => selectChapter(idx)}
          >
            {item.tabLabel}
          </button>
        ))}
      </div>

      {/* Escenario ilustrado + narración lateral */}
      <div key={chapter.id} className="kronox-lore-stage">
        <div className="kronox-lore-visual-frame">
          <button
            type="button"
            className="kronox-lore-arrow is-prev"
            aria-label="Capítulo anterior"
            onClick={() => selectChapter(chapterIndex - 1)}
          >
            ‹
          </button>

          {chapter.id === 'cosmos' && <LoreArtworkCosmos />}
          {chapter.id === 'spherex' && <LoreArtworkSpherex />}
          {chapter.id === 'frontier' && <LoreArtworkFrontier />}
          {chapter.id === 'kronox' && (
            <LoreArtworkKronox
              activeDeckId={selectedDeckId}
              onSelectDeck={(deckId) => {
                onPlayUiCue?.('tap');
                setSelectedDeckId(deckId);
              }}
            />
          )}

          <button
            type="button"
            className="kronox-lore-arrow is-next"
            aria-label="Siguiente capítulo"
            onClick={() => selectChapter(chapterIndex + 1)}
          >
            ›
          </button>
        </div>

        <article className="kronox-lore-copy">
          <span className="kronox-lore-chapter-badge">{chapter.badge}</span>
          <h3>{chapter.title}</h3>
          <blockquote className="kronox-lore-quote">{chapter.quote}</blockquote>
          <div className="kronox-lore-paragraphs">
            {chapter.paragraphs.map((text, idx) => (
              <p key={idx}>{text}</p>
            ))}
          </div>
          <div className="kronox-lore-facts">
            {chapter.facts.map((fact) => (
              <div key={fact.label} className="kronox-lore-fact-card">
                <small>{fact.label}</small>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* Pie de códice con indicadores de capítulo y CTA */}
      <div className="kronox-lore-footer">
        <div className="kronox-lore-dots" role="group" aria-label="Progreso de lectura">
          {LORE_CHAPTERS.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`kronox-lore-dot${chapterIndex === idx ? ' is-active' : ''}`}
              aria-label={`Ir al capítulo ${item.number}: ${item.title}`}
              onClick={() => selectChapter(idx)}
            />
          ))}
        </div>

        <div className="kronox-reg-actions">
          <button
            type="button"
            className="kronox-pause-secondary-btn"
            onClick={() => selectChapter(chapterIndex + 1)}
          >
            Siguiente capítulo →
          </button>
          <button
            type="button"
            className="kronox-pause-primary-btn"
            onClick={onStartExpedition}
          >
            Embarcar e Iniciar Intro →
          </button>
        </div>
      </div>
    </section>
  );
}
