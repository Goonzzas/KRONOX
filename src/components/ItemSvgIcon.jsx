import React from 'react';

/**
 * Iconografía vectorial SVG personalizada para objetos, herramientas EVA y muestras científicas de KRONOX.
 * Garantiza siluetas nítidas e inconfundibles dentro de cada slot del inventario.
 */
export default function ItemSvgIcon({ itemId, size = 34, className = '' }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    fill: 'none',
    className,
    'aria-hidden': 'true',
  };

  switch (itemId) {
    case 'astral-suit-mk4':
      return (
        <svg {...props}>
          <path d="M16 14c0-4.4 3.6-8 8-8s8 3.6 8 8v5H16v-5z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.2" />
          <rect x="18" y="10" width="12" height="6" rx="3" fill="#0ea5e9" fillOpacity="0.55" stroke="#bae6fd" strokeWidth="1.4" />
          <path d="M13 21l3-2h16l3 2 3 11-5 2-2-7v15H17V27l-2 7-5-2 3-11z" fill="#334155" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" />
          <rect x="20" y="24" width="8" height="6" rx="1.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.6" />
          <circle cx="24" cy="27" r="1.5" fill="#38bdf8" />
        </svg>
      );

    case 'command-keycard':
      return (
        <svg {...props}>
          <rect x="7" y="13" width="34" height="22" rx="3.5" fill="#172536" stroke="#fbbf24" strokeWidth="2.2" />
          <rect x="7" y="18" width="34" height="5" fill="#f59e0b" fillOpacity="0.32" />
          <rect x="12" y="25" width="9" height="6" rx="1.2" fill="#fcd34d" stroke="#b45309" strokeWidth="1.2" />
          <path d="M25 27h11M25 31h7" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'dosimeter-ir':
      return (
        <svg {...props}>
          <rect x="13" y="8" width="22" height="32" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="2.2" />
          <rect x="16" y="13" width="16" height="11" rx="2" fill="#061423" stroke="#38bdf8" strokeWidth="1.6" />
          <path d="M18 20l3-4 3 3 3-5 3 4" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="31" r="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.8" />
          <circle cx="24" cy="31" r="1.4" fill="#fbbf24" />
        </svg>
      );

    case 'optical-coupler':
      return (
        <svg {...props}>
          <circle cx="22" cy="24" r="11" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.4" />
          <circle cx="22" cy="24" r="6.5" fill="#0284c7" fillOpacity="0.35" stroke="#bae6fd" strokeWidth="1.6" />
          <circle cx="20" cy="22" r="2" fill="#e0f2fe" />
          <path d="M31 19l9-4v18l-9-4" fill="#334155" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );

    case 'multitool':
      return (
        <svg {...props}>
          <path d="M11 33l14-14 5 5-14 14a3.5 3.5 0 01-5-5z" fill="#334155" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
          <path d="M25 19l6-6c2-2 5-2 7 0l-5 5 3 3 5-5c2 2 2 5 0 7l-6 6" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15" cy="33" r="1.8" fill="#38bdf8" />
        </svg>
      );

    case 'scanner':
      return (
        <svg {...props}>
          <path d="M15 20h18l3 18H12l3-18z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.2" strokeLinejoin="round" />
          <rect x="18" y="9" width="12" height="11" rx="2" fill="#0c1b2e" stroke="#7dd3fc" strokeWidth="2" />
          <path d="M12 14l4 1M36 14l-4 1M24 6v3" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
          <rect x="18" y="25" width="12" height="6" rx="1.2" fill="#071322" stroke="#34d399" strokeWidth="1.5" />
        </svg>
      );

    case 'sample-bioponic-flora':
      return (
        <svg {...props}>
          <rect x="16" y="12" width="16" height="28" rx="6" fill="#082f23" fillOpacity="0.72" stroke="#34d399" strokeWidth="2.2" />
          <rect x="18" y="8" width="12" height="4" rx="1.5" fill="#94a3b8" />
          <path d="M24 35V22" stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 27c-4-1-6-4-5-7 3 0 5 2 5 7zM24 24c4-1 6-4 5-7-3 0-5 2-5 7z" fill="#34d399" />
        </svg>
      );

    case 'data-spherex-calibration':
      return (
        <svg {...props}>
          <polygon points="24,7 39,15 39,33 24,41 9,33 9,15" fill="#0f172a" stroke="#60a5fa" strokeWidth="2.2" />
          <polygon points="24,13 33,18 33,30 24,35 15,30 15,18" fill="#1d4ed8" fillOpacity="0.35" stroke="#93c5fd" strokeWidth="1.6" />
          <circle cx="24" cy="24" r="3.5" fill="#fde047" />
        </svg>
      );

    case 'sample-cryo-he3':
      return (
        <svg {...props}>
          <rect x="15" y="10" width="18" height="28" rx="4" fill="#1e293b" stroke="#22d3ee" strokeWidth="2.2" />
          <rect x="18" y="16" width="12" height="16" rx="2" fill="#083344" stroke="#67e8f9" strokeWidth="1.5" />
          <path d="M24 18v12M19 21l10 6M29 21l-10 6" stroke="#a5f3fc" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M19 7h10M19 41h10" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case 'eva-ration-pack':
      return (
        <svg {...props}>
          <rect x="10" y="12" width="28" height="24" rx="4" fill="#3b2f24" stroke="#f59e0b" strokeWidth="2.2" />
          <path d="M10 19h28" stroke="#d97706" strokeWidth="2" />
          <circle cx="24" cy="28" r="5" fill="#1e293b" stroke="#fcd34d" strokeWidth="1.6" />
          <path d="M24 25v6M21 28h6" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    default:
      return (
        <svg {...props}>
          <rect x="10" y="10" width="28" height="28" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="24" cy="24" r="5" fill="#38bdf8" />
        </svg>
      );
  }
}

