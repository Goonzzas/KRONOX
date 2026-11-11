import React, { useState, useEffect, useRef } from 'react';

function getAssetUrl(p) {
  if (!p) return null;
  const base = import.meta.env.BASE_URL || '/';
  const clean = p.startsWith('/') ? p.slice(1) : p;
  return `${base}${clean}`;
}

export const SPHEREX_DOCUMENTARY_SCENES = [
  {
    id: 1,
    title: 'UNA NUEVA FORMA DE OBSERVAR',
    subtitle: 'El observatorio espacial de los 102 colores',
    date: 'Misión Activa en Órbita Polar',
    institution: 'NASA · Astrophysics Division',
    image: '/spherex-documentary/spherex_orbit_concept_pia26531.jpg',
    narration:
      'SPHEREx es un observatorio espacial de la NASA diseñado para explorar el universo mediante la luz infrarroja. Su nombre resume una ambiciosa misión: estudiar la historia del cosmos, la evolución de las galaxias y los ingredientes de los que pueden surgir nuevos mundos.',
    details: [
      'Nombre completo: Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer',
      'Órbita polar heliosíncrona a ~650 km de altitud (período ~98 min)',
      'Telescopio de gran campo con 3 escudos fotónicos concéntricos reflectantes',
    ],
    credits: 'NASA / JPL-Caltech · Concepto orbital del observatorio SPHEREx (PIA26531)',
  },
  {
    id: 2,
    title: 'EL ORIGEN DEL PROYECTO',
    subtitle: '2019 — Selección de la misión',
    date: 'Febrero de 2019',
    institution: 'NASA Headquarters · Programa Explorers (MIDEX)',
    image: '/spherex-documentary/spherex_photon_shield_pia25784.jpg',
    narration:
      'La misión nació de una pregunta que acompaña a la astronomía moderna: ¿qué podemos aprender de la luz que recibimos de los lugares más lejanos del universo?',
    details: [
      'Seleccionado competitivamente por NASA en febrero de 2019 dentro del programa Explorers',
      'Propósito: cartografiar la esfera celeste completa en 102 colores espectrales infrarrojos',
      'Diseñado para resolver simultáneamente preguntas cosmológicas, galácticas y planetarias',
    ],
    credits: 'NASA / JPL-Caltech · Escudos Fotónicos Cónicos y Selección MIDEX (PIA25784)',
  },
  {
    id: 3,
    title: 'QUIÉNES LO CONSTRUYERON',
    subtitle: 'Liderazgo científico y colaboración internacional',
    date: '2019 – 2024',
    institution: 'Caltech · JPL · BAE Systems · KASI',
    image: '/spherex-documentary/spherex_team_caltech_pia26534.jpg',
    narration:
      'Detrás de SPHEREx hay un esfuerzo colectivo de científicos, ingenieros y especialistas de diferentes instituciones y países. Cada componente debió superar exigentes pruebas antes de viajar al espacio.',
    details: [
      'NASA: Agencia responsable de la misión',
      'JPL (administrado por Caltech): Gestión general del proyecto y operaciones',
      'Caltech: Institución del Investigador Principal (PI Jamie Bock) y ciencia del instrumento',
      'BAE Systems (anteriormente Ball Aerospace): Telescopio, plataforma espacial e integración',
      'KASI (Corea del Sur): Criocámara de ensayos no ópticos y participación científica',
      'Líderes: Jamie Bock (PI), Olivier Doré (Project Scientist, JPL), James Fanson (Project Manager, JPL)',
    ],
    credits: 'NASA / JPL-Caltech · Caltech Cleanroom (PIA26534)',
  },
  {
    id: 4,
    title: 'LA CONSTRUCCIÓN Y ENSAYOS',
    subtitle: 'Protección térmica pasiva y pruebas criogénicas extremas',
    date: '2023 – 2024',
    institution: 'Cámara de vacío térmico · KASI / JPL',
    image: '/spherex-documentary/spherex_thermal_vacuum_test.jpg',
    narration:
      'Para medir señales infrarrojas extremadamente débiles, SPHEREx necesita mantener sus detectores fríos y protegidos de fuentes de calor. Su característica estructura de escudos contribuye a esa tarea.',
    details: [
      'Tres escudos cónicos concéntricos de aluminio disipan el calor solar y terrestre',
      'Refrigeración pasiva radiativa que mantiene los detectores a temperaturas < 55 K (-218 °C)',
      'Pruebas exhaustivas de vacío térmico, vibración acústica y compatibilidad electromagnética',
    ],
    credits: 'NASA / JPL-Caltech · Thermal Vacuum Testing Facility',
  },
  {
    id: 5,
    title: 'EL LANZAMIENTO',
    subtitle: '11 de marzo de 2025 · SpaceX Falcon 9',
    date: '11 de Marzo de 2025',
    institution: 'Vandenberg Space Force Base, California · SpaceX',
    image: '/spherex-documentary/spherex_falcon9_fairing_launch.jpg',
    narration:
      'El 11 de marzo de 2025, SPHEREx inició su viaje al espacio. Desde California, un Falcon 9 lo llevó hacia una órbita terrestre desde la que comenzaría su ambiciosa exploración del cielo.',
    details: [
      'Despegue a bordo de un cohete Falcon 9 de SpaceX desde SLC-4E en Vandenberg, California',
      'Lanzamiento compartido (rideshare) con la misión PUNCH de la NASA',
      'Despliegue exitoso en órbita polar y verificación nominal de subsistemas y telemetría',
    ],
    credits: 'NASA / SpaceX · Falcon 9 Payload Fairing Integration',
  },
  {
    id: 6,
    title: 'LA CIENCIA DETRÁS DE LA MISIÓN',
    subtitle: '102 canales infrarrojos cartografiando el cosmos',
    date: 'Fase Científica Activa (2025–2027)',
    institution: 'NASA IRSA / IPAC · SPHEREx Science Archive',
    image: '/spherex-documentary/spherex_spacecraft_payload.jpg',
    narration:
      'SPHEREx no observa el universo como nuestros ojos. Lo estudia en numerosos intervalos del infrarrojo, permitiéndonos reconocer señales que la luz visible no revela por sí sola.',
    details: [
      '102 longitudes de onda entre 0.75 y 5.0 micrómetros (filtros variables lineales LVF)',
      'Pilar 1: Huellas de la inflación en la distribución 3D de cientos de millones de galaxias',
      'Pilar 2: Luz extragaláctica de fondo (EBL) para medir la producción estelar total en la historia',
      'Pilar 3: Hielo de agua, CO y CO₂ en nubes interestelares donde nacen nuevos sistemas planetarios',
    ],
    credits: 'NASA / IPAC / Caltech Science Archive',
  },
  {
    id: 7,
    title: 'DE SPHEREx A KRONOX',
    subtitle: 'Exploración interactiva en el simulador espacial',
    date: 'Misión en Curso',
    institution: 'Astral Sentinels · KRONOX',
    image: null,
    narration:
      'Y aquí comienza nuestra misión. En Kronox podemos explorar las observaciones, comparar longitudes de onda e investigar los objetos que SPHEREx ayuda a estudiar.',
    details: [
      'Accede a recortes FITS auténticos de SPHEREx QR2/QR3 alojados en IRSA',
      'Inspecciona las 6 bandas espectrales (D1 a D6) y mide desplazamientos astrométricos',
      'Explora las estrellas y galaxias objetivo desde el puente de mando de la nave',
    ],
    credits: 'KRONOX · Astral Sentinels for NASA Space Apps Challenge',
  },
];
export const SPHEREx_DOCUMENTARY_SCENES = SPHEREX_DOCUMENTARY_SCENES;

export default function SpherexDocumentary({
  onClose,
  onOpenObservatory,
  speakNarrator,
  stopNarrator,
  language = 'es',
}) {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const scene = SPHEREX_DOCUMENTARY_SCENES[currentSceneIdx];
  const totalScenes = SPHEREX_DOCUMENTARY_SCENES.length;

  // Calculate dynamic slide duration so Cronos has time to finish speaking comfortably:
  // ~65ms per character + 3500ms breathing margin, clamped between 12s and 22s
  const narrationLength = scene?.narration ? scene.narration.length : 120;
  const currentSlideDuration = Math.max(12000, Math.min(22000, narrationLength * 65 + 3500));

  // Voice narration by Cronos for each scene
  useEffect(() => {
    if (!isPlaying) {
      if (stopNarrator) stopNarrator();
      return;
    }
    if (speakNarrator && scene?.narration) {
      speakNarrator(scene.narration);
    }
  }, [currentSceneIdx, isPlaying]);

  // Clean up narration when closing or unmounting
  useEffect(() => {
    return () => {
      if (stopNarrator) stopNarrator();
    };
  }, []);

  // Automatic slideshow transition timer
  useEffect(() => {
    if (!isPlaying) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / currentSlideDuration) * 100);
      setProgress(pct);
      if (elapsed >= currentSlideDuration) {
        setProgress(0);
        setCurrentSceneIdx((prev) => {
          if (prev < totalScenes - 1) return prev + 1;
          setIsPlaying(false);
          return prev;
        });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [currentSceneIdx, isPlaying, totalScenes, currentSlideDuration]);

  const handleNext = () => {
    setProgress(0);
    if (currentSceneIdx < totalScenes - 1) {
      setCurrentSceneIdx((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentSceneIdx > 0) {
      setCurrentSceneIdx((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    if (stopNarrator) stopNarrator();
    if (onClose) onClose();
  };

  return (
    <div className="spherexDocumentaryOverlay" role="dialog" aria-modal="true" aria-label="Archivo histórico SPHEREx">
      <div className="spherexDocModal spherexDocumentaryContainer">
        {/* Top Header Bar */}
        <header className="spherexDocHeader">
          <div className="spherexDocTitleGroup">
            <span className="spherexDocBadge">ARCHIVO HISTÓRICO · MISIÓN SPHEREx</span>
            <h2>SPHEREx — El observatorio de los 102 colores</h2>
          </div>
          <div className="spherexDocControls">
            <button
              type="button"
              className="spherexDocBtn"
              onClick={() => setIsPlaying((p) => !p)}
              title={isPlaying ? 'Pausar avance automático' : 'Reanudar avance automático'}
            >
              {isPlaying ? '⏸ Pausa' : '▶ Reproducir'}
            </button>
            <button
              type="button"
              className="spherexDocCloseBtn"
              onClick={handleClose}
              title="Volver a la cabina de Kronox"
              aria-label="Cerrar documental"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Scene Content Body */}
        <main className="spherexDocBody">
          <div className="spherexDocVisualPane">
            {scene.image ? (
              <div className="spherexDocMediaWrapper">
                <img
                  src={getAssetUrl(scene.image)}
                  alt={scene.title}
                  className="spherexDocImg"
                />
                <div className="spherexDocOverlayGrad" />
                <div className="spherexDocDateBadge">{scene.date}</div>
                <div className="spherexDocCaption">
                  <strong>{scene.title}</strong> — {scene.credits}
                </div>
              </div>
            ) : (
              <div className="spherexDoc3DCard" style={{ padding: '36px', textAlign: 'center' }}>
                <span className="spherexDocBadge" style={{ marginBottom: 12 }}>{scene.institution}</span>
                <h3 style={{ fontSize: '1.4rem', color: '#38bdf8', margin: '14px 0 8px' }}>{scene.subtitle}</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{scene.date}</p>
              </div>
            )}
          </div>

          <aside className="spherexDocTextPane">
            <div>
              <div className="spherexDocNarrativeHeader">
                <span className="spherexDocNarrativeTag">{scene.institution}</span>
                <span className="spherexDocNarratorStatus">{isPlaying ? '● Cronos en emisión' : '⏸ En pausa'}</span>
              </div>
              <h2 style={{ fontSize: '1.35rem', margin: '0 0 4px', color: '#f8fafc', fontWeight: 700 }}>
                {scene.title}
              </h2>
              <p style={{ fontSize: '0.88rem', margin: '0 0 16px', color: '#38bdf8', fontWeight: 500 }}>
                {scene.subtitle}
              </p>
              <p className="spherexDocNarrative">{scene.narration}</p>
            </div>

            <div className="spherexDocKeyFact">
              {scene.details.map((point, idx) => (
                <div key={idx} style={{ marginBottom: idx < scene.details.length - 1 ? 6 : 0 }}>
                  ✦ {point}
                </div>
              ))}
            </div>

            {/* Special Final Scene Navigation Options */}
            {scene.id === 7 && (
              <div className="spherexDocFinalChoices">
                <button
                  type="button"
                  className="spherexDocChoiceBtn primary"
                  onClick={() => {
                    handleClose();
                    if (onOpenObservatory) onOpenObservatory();
                  }}
                >
                  🔭 ABRIR OBSERVATORIO SPHEREx
                </button>
                <button
                  type="button"
                  className="spherexDocChoiceBtn secondary"
                  onClick={handleClose}
                >
                  🚀 VOLVER A LA CABINA DE EXPLORACIÓN
                </button>
              </div>
            )}
          </aside>
        </main>

        {/* Bottom Timeline Footer with Progress Indicator */}
        <footer className="spherexDocFooter">
          <div className="spherexDocTimelineDots">
            {SPHEREX_DOCUMENTARY_SCENES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`spherexDocTimelineDot ${idx === currentSceneIdx ? 'active' : idx < currentSceneIdx ? 'passed' : ''}`}
                onClick={() => {
                  setProgress(0);
                  setCurrentSceneIdx(idx);
                }}
                title={`Escena ${s.id}: ${s.title}`}
                aria-label={`Escena ${s.id}`}
              />
            ))}
          </div>

          <div className="spherexDocControls">
            <button
              type="button"
              className="spherexDocBtn"
              onClick={handlePrev}
              disabled={currentSceneIdx === 0}
            >
              ◀ Anterior
            </button>
            <button
              type="button"
              className="spherexDocBtn primary"
              onClick={handleNext}
            >
              {currentSceneIdx === totalScenes - 1 ? 'Finalizar ✓' : 'Siguiente ▶'}
            </button>
            <button
              type="button"
              className="spherexDocBtn"
              onClick={handleClose}
            >
              Omitir
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
