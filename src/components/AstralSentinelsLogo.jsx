import React from 'react';

/**
 * Logotipo Vectorizado Oficial "ASTRAL SENTINELS" para KRONOX.
 * Proporciones y geometría exactas basadas en la insignia espacial:
 * - Estrella cuádruple cian en la cúspide (apex flare)
 * - Tres agujas / pilares monolíticos en perspectiva convergente
 * - Anillo orbital elíptico en azul eléctrico y cian
 * - Tipografía geométrica espacial "ASTRAL SENTINELS"
 */
export default function AstralSentinelsLogo({
  className = '',
  width = 380,
  height = 380,
  animated = true,
  glow = true,
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={width}
      height={height}
      className={`astral-sentinels-svg ${className}`}
      role="img"
      aria-label="Astral Sentinels"
    >
      <defs>
        {/* Filtros de brillo y resplandor cósmico */}
        <filter id="asRingGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="asStarGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur2" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="30" result="blur3" />
          <feMerge>
            <feMergeNode in="blur3" />
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradiente del anillo orbital */}
        <linearGradient id="asRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="45%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>

        {/* Gradientes metálicos oscuros de los pilares espaciales */}
        <linearGradient id="asPillarCenterLeft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0c1b30" />
          <stop offset="100%" stopColor="#1a3557" />
        </linearGradient>
        <linearGradient id="asPillarCenterRight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0d1e35" />
          <stop offset="100%" stopColor="#142844" />
        </linearGradient>

        <linearGradient id="asPillarSideLeft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#17345b" />
          <stop offset="100%" stopColor="#0b1b31" />
        </linearGradient>
        <linearGradient id="asPillarSideRight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0b1b31" />
          <stop offset="100%" stopColor="#17345b" />
        </linearGradient>

        {/* Gradiente de la estrella cenital */}
        <radialGradient id="asStarGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#7dd3fc" />
          <stop offset="75%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>

        <linearGradient id="asTextGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#bae6fd" />
        </linearGradient>
      </defs>

      {/* Capa 1: Resplandor de fondo ambiental */}
      <circle cx="512" cy="434" r="320" fill="url(#asRingGradient)" opacity="0.08" filter="url(#asRingGlow)" />

      {/* Capa 2: Anillo orbital elíptico (envolvente) */}
      <ellipse
        cx="512"
        cy="434"
        rx="272"
        ry="112"
        fill="none"
        stroke="url(#asRingGradient)"
        strokeWidth="24"
        filter={glow ? 'url(#asRingGlow)' : undefined}
        className={animated ? 'as-animated-ring' : ''}
      />

      {/* Capa 3: Pilar Monolítico Izquierdo */}
      <polygon
        points="455,390 434,406 298,664 413,664"
        fill="url(#asPillarSideLeft)"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeOpacity="0.45"
      />

      {/* Capa 4: Pilar Central (Faceta izquierda y derecha para volumen 3D) */}
      <polygon
        points="512,271 480,336 461,664 512,664"
        fill="url(#asPillarCenterLeft)"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeOpacity="0.5"
      />
      <polygon
        points="512,271 512,664 563,664 544,336"
        fill="url(#asPillarCenterRight)"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeOpacity="0.4"
      />
      {/* Arista dorsal central */}
      <line x1="512" y1="271" x2="512" y2="664" stroke="#7dd3fc" strokeWidth="1.5" strokeOpacity="0.6" />

      {/* Capa 5: Pilar Monolítico Derecho */}
      <polygon
        points="569,390 590,406 726,664 611,664"
        fill="url(#asPillarSideRight)"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeOpacity="0.45"
      />

      {/* Capa 6: Arco frontal del anillo orbital (órbita con sutil profundidad) */}
      <path
        d="M 240 434 A 272 112 0 0 0 784 434"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth="7"
        strokeOpacity="0.32"
        strokeDasharray="14 12"
      />

      {/* Capa 7: Estrella cenital de 4 puntas */}
      <g className={animated ? 'as-animated-star' : ''}>
        <path
          d="M 512 175 C 510 200, 520 216, 552 219 C 520 222, 510 238, 512 263 C 510 238, 504 222, 471 219 C 504 216, 510 200, 512 175 Z"
          fill="url(#asStarGradient)"
          filter={glow ? 'url(#asStarGlow)' : undefined}
        />
        {/* Núcleo estelar blanco */}
        <circle cx="512" cy="219" r="4" fill="#ffffff" />
      </g>

      {/* Capa 8: Tipografía ASTRAL SENTINELS */}
      <g className="as-brand-text">
        <text
          x="512"
          y="765"
          textAnchor="middle"
          fill="url(#asTextGradient)"
          fontFamily="'Oxanium', 'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="80"
          fontWeight="800"
          letterSpacing="22"
          className="as-text-astral"
        >
          ASTRAL
        </text>
        <text
          x="512"
          y="852"
          textAnchor="middle"
          fill="#93c5fd"
          fontFamily="'Oxanium', 'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="64"
          fontWeight="700"
          letterSpacing="18"
          className="as-text-sentinels"
        >
          SENTINELS
        </text>
      </g>
    </svg>
  );
}

