import React from 'react';

const TUTORIAL_PILLARS = [
  { id: 'stand_up', short: '1. Cabina', match: ['stand_up'] },
  { id: 'look_camera', short: '2. Cámara y WASD', match: ['look_camera'] },
  { id: 'nav', short: '3. Consolas [E]', match: ['nav', 'bridge', 'missions', 'comms', 'windows'] },
  { id: 'astro_obs', short: '4. Control y Óptica', match: ['astro_obs'] },
  { id: 'galactic_map', short: '5. Mapa Galáctico', match: ['galactic_map'] },
  { id: 'elevator', short: '6. Ascensor y SPHEREx', match: ['elevator_c02', 'elevator_c03', 'science'] },
  { id: 'inventory', short: '7. Mapa y Manual', match: ['manual_journal', 'inventory_hub'] },
];

const STEP_COPY = {
  stand_up: {
    badge: 'PASO 1 · PUENTE DE MANDO',
    title: 'Levántate del puesto de pilotaje',
    body: 'Pulsa [WASD] o [E] para ponerte de pie y explorar la Cabina 1 (Puente de Mando).',
    keys: ['W A S D', 'E'],
  },
  look_camera: {
    badge: 'PASO 2 · MOVIMIENTO Y CÁMARA',
    title: 'Camina y alterna perspectivas',
    body: 'Desplázate con [WASD], apunta con el mouse y prueba Cabina 1P, 3P o vista Exterior arriba (tecla [V]).',
    keys: ['W A S D', 'Mouse', 'V'],
  },
  nav: {
    badge: 'PASO 3 · CONSOLAS E INTERACCIÓN',
    title: 'Opera las estaciones del puente',
    body: 'Acércate al timón central o a una consola iluminada del puente y pulsa [E] para usar los sistemas de la nave.',
    keys: ['E'],
  },
  bridge: {
    badge: 'PASO 3 · CONSOLAS E INTERACCIÓN',
    title: 'Opera las estaciones del puente',
    body: 'Acércate al timón central o a una consola iluminada del puente y pulsa [E] para usar los sistemas de la nave.',
    keys: ['E'],
  },
  astro_obs: {
    badge: 'PASO 4 · CONTROL DE NAVE Y ÓPTICA',
    title: 'Observa el espacio y controla la nave',
    body: 'Usa el mirador panorámico, pulsa [T] para activar el instrumento óptico o abre la vista Exterior para pilotar.',
    keys: ['T', 'Exterior'],
  },
  galactic_map: {
    badge: 'PASO 5 · MAPA GALÁCTICO',
    title: 'Explora las escalas del cosmos',
    body: 'Abre «Mapa · Guía» en la barra superior y entra a «Mapa galáctico» para cambiar entre Sistema Solar, Vecindario Estelar y Galaxias y trazar un salto.',
    keys: ['Mapa · Guía'],
  },
  elevator_c02: {
    badge: 'PASO 6 · ASCENSOR CENTRAL',
    title: 'Desciende a la Cubierta Habitacional',
    body: 'Entra al núcleo del Ascensor Central en el centro del puente y pulsa [E] o la tecla [2] para ir a C02.',
    keys: ['E', '2'],
  },
  elevator_c03: {
    badge: 'PASO 6 · CUBIERTA CIENTÍFICA',
    title: 'Baja al Laboratorio SPHEREx',
    body: 'Usa el Ascensor Central hacia la Cubierta 3 (tecla [3]) para acceder al reactor e instrumentación infrarroja.',
    keys: ['E', '3'],
  },
  science: {
    badge: 'PASO 6 · EXPLORACIÓN SPHEREx',
    title: 'Analiza el cielo infrarrojo',
    body: 'Acércate al Laboratorio Espectral SPHEREx en C03 y pulsa [E] para examinar espectros y misiones.',
    keys: ['E'],
  },
  manual_journal: {
    badge: 'PASO 7 · MAPA Y MANUAL OPERATIVO',
    title: 'Domina tu centro táctico',
    body: 'Abre «Mapa · Guía» en la barra superior para consultar el Manual de la Nave, Misiones, Exploración y Sistemas y completar el tutorial.',
    keys: ['Mapa · Guía'],
  },
  inventory_hub: {
    badge: 'PASO 7 · MAPA Y MANUAL OPERATIVO',
    title: 'Domina tu centro táctico',
    body: 'Abre «Mapa · Guía» en la barra superior para consultar el Manual de la Nave, Misiones, Exploración y Sistemas y completar el tutorial.',
    keys: ['Mapa · Guía'],
  },
};

export default function KronoxTutorialOverlay({
  guideState,
  onSkipStep,
  onDismiss,
  onOpenInventoryTab,
}) {
  if (!guideState?.active || !guideState.step || guideState.step === 'free') {
    return null;
  }

  const stepInfo = STEP_COPY[guideState.step] || {
    badge: 'ENTRENAMIENTO ACTIVO',
    title: 'Guía progresiva KRONOX',
    body: 'Sigue la baliza azul dentro de la cubierta o interactúa con la estación indicada.',
    keys: ['E'],
  };

  const activePillarIdx = Math.max(
    0,
    TUTORIAL_PILLARS.findIndex((p) => p.match.includes(guideState.step)),
  );

  return (
    <aside
      className="kronoxFloatingTutorialCard"
      role="region"
      aria-label="Tutorial interactivo de KRONOX"
    >
      <div className="kronoxTutorialCardHeader">
        <span className="kronoxTutorialBadge">{stepInfo.badge}</span>
        <button
          type="button"
          className="kronoxTutorialCloseBtn"
          onClick={onDismiss}
          title="Ocultar tutorial (puedes reabrirlo desde ? Tutorial)"
          aria-label="Cerrar tutorial"
        >
          ✕
        </button>
      </div>

      <h4 className="kronoxTutorialTitle">{stepInfo.title}</h4>
      <p className="kronoxTutorialBody">{stepInfo.body}</p>

      {stepInfo.keys?.length > 0 && (
        <div className="kronoxTutorialKeyRow">
          {stepInfo.keys.map((k) => (
            <kbd key={k} className="kronoxTutorialKeyChip">
              {k}
            </kbd>
          ))}
        </div>
      )}

      <div className="kronoxTutorialProgressDots" aria-hidden="true">
        {TUTORIAL_PILLARS.map((p, idx) => (
          <span
            key={p.id}
            title={p.short}
            className={`kronoxTutorialDot ${idx === activePillarIdx ? 'is-current' : ''} ${idx < activePillarIdx ? 'is-done' : ''}`}
          />
        ))}
      </div>

      <div className="kronoxTutorialActions">
        {guideState.step === 'galactic_map' && onOpenInventoryTab && (
          <button
            type="button"
            className="kronoxTutorialPrimaryBtn"
            onClick={() => onOpenInventoryTab('map')}
          >
            Abrir Mapa galáctico
          </button>
        )}
        {(guideState.step === 'manual_journal' || guideState.step === 'inventory_hub') &&
          onOpenInventoryTab && (
            <button
              type="button"
              className="kronoxTutorialPrimaryBtn"
              onClick={() => onOpenInventoryTab('manual')}
            >
              Abrir Manual operativo
            </button>
          )}
        <button
          type="button"
          className="kronoxTutorialGhostBtn"
          onClick={onSkipStep}
        >
          Siguiente paso ⏭
        </button>
      </div>
    </aside>
  );
}

