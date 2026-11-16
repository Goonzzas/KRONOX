import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import originalVisualizerHtml from '../../SphereX-Visualizations-main/kronox_visor_cientifico.html?raw';
import { t } from '../i18n.js';
import '../styles/spherexAdvancedExplorer.css';

function scopeCssToVisorRoot(rawCss) {
  if (!rawCss) return '';
  return rawCss
    .replace(/:root\b/g, '.kronoxNativeVisorRoot')
    .replace(/(^|\n)\s*\*\s*\{/g, '$1.kronoxNativeVisorRoot, .kronoxNativeVisorRoot * {')
    .replace(/(^|\n)\s*body\s*\{/g, '$1.kronoxNativeVisorRoot {')
    .replace(/(^|\n)\s*header\s*\{/g, '$1.kronoxNativeVisorRoot > header {')
    .replace(/min-height:\s*100vh\s*;/g, 'min-height: 100%;');
}

function parseVisorDocument(htmlText) {
  const styleMatch = htmlText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const rawCss = styleMatch ? styleMatch[1] : '';
  const scopedCss = scopeCssToVisorRoot(rawCss);

  const bodyStart = htmlText.search(/<body[^>]*>/i);
  const scriptStart = htmlText.search(/<script[^>]*>/i);
  const scriptEnd = htmlText.lastIndexOf('</script>');

  let bodyHtml = '';
  if (bodyStart !== -1 && scriptStart !== -1 && scriptStart > bodyStart) {
    const bodyOpenEnd = htmlText.indexOf('>', bodyStart) + 1;
    bodyHtml = htmlText.slice(bodyOpenEnd, scriptStart).trim();
  }

  let scriptCode = '';
  if (scriptStart !== -1 && scriptEnd !== -1 && scriptEnd > scriptStart) {
    const scriptOpenEnd = htmlText.indexOf('>', scriptStart) + 1;
    scriptCode = htmlText.slice(scriptOpenEnd, scriptEnd);
  }

  return { scopedCss, bodyHtml, scriptCode };
}

const MISSION_GUIDE_STEPS = [
  {
    selector: '#headerObjectTitle',
    title: '1 · OBJETIVO DE LA MISIÓN',
    narration:
      'Ya estamos en el laboratorio. Arriba aparece el objetivo y su posición en el cielo. Primero confirmamos qué región estudiamos; las imágenes que veremos vienen de observaciones reales de SPHEREx.',
  },
  {
    selector: '#explorerSourcePills',
    title: '2 · ELEGIR LOS DATOS',
    narration:
      'Esta fila cambia la fuente de datos. Datasets muestra campos y observaciones disponibles; 102 canales abre el mapa infrarrojo de todo el cielo; y Todo el Cielo presenta la composición panorámica. Voy a abrir ahora el cubo espectral.',
    after: (root) => root.querySelector('#explorerSourcePills [data-src="cube102"]')?.click(),
  },
  {
    selector: '#cube102Controls',
    title: '3 · DETECTORES Y CANALES',
    narration:
      'SPHEREx divide la luz infrarroja en seis detectores. El deslizador recorre 102 canales, desde las longitudes de onda más cortas hasta cinco micras. El detector seleccionado indica qué tramo del espectro estamos examinando.',
    enter: (root) => {
      root.querySelector('#c102DetPills [data-det="2"]')?.click();
    },
    animate: (root, schedule) => {
      const next = root.querySelector('#c102NextCh');
      for (let i = 1; i <= 5; i += 1) schedule(() => next?.click(), i * 650);
    },
  },
  {
    selector: '#panel1ModePills',
    title: '4 · LEER LA IMAGEN',
    narration:
      'Aquí comparamos la imagen RGB con cada detector. D1 a D6 separan bandas infrarrojas; ZODI muestra la contribución de luz zodiacal, SNR ayuda a valorar la señal y FLAGS identifica píxeles marcados por calidad. La composición de color sirve para explorar: no es una fotografía óptica.',
    enter: (root) => root.querySelector('#panel1ModePills [data-p1="D2"]')?.click(),
    animate: (root, schedule) => {
      schedule(() => root.querySelector('#panel1ModePills [data-p1="D4"]')?.click(), 900);
    },
    after: (root) => root.querySelector('#panel1ModePills [data-p1="ir_cal"]')?.click(),
  },
  {
    selector: '#btnObsCatalogToggle',
    title: '5 · COMPARAR OBSERVACIONES',
    narration:
      'Una misión también compara fechas. Este catálogo reúne las observaciones encontradas para el objetivo; cuando hay varias épocas compatibles, podemos recorrerlas o reproducirlas para buscar cambios. La velocidad de reproducción no modifica las fechas reales.',
    enter: (root) => root.querySelector('#btnObsCatalogToggle')?.click(),
    after: (root) => root.querySelector('#btnCloseObsCatalog')?.click(),
  },
  {
    selector: '#panel2ModePills',
    title: '6 · ANALIZAR Y COMPARAR',
    narration:
      'El panel inferior ofrece herramientas de análisis. K-NN agrupa píxeles con señales parecidas; Similitud compara su firma espectral con la región elegida; PCA RGB resume variaciones en tres componentes. Son ayudas de exploración y deben interpretarse junto con los datos y su procedencia.',
    enter: (root) => root.querySelector('#panel2ModePills [data-p2="sim"]')?.click(),
    animate: (root, schedule) => {
      schedule(() => root.querySelector('#panel2ModePills [data-p2="pca"]')?.click(), 1100);
    },
    after: (root) => root.querySelector('#panel2ModePills [data-p2="knn"]')?.click(),
  },
  {
    selector: '#canvasIR',
    title: '7 · INSPECCIONAR UN PÍXEL',
    narration:
      'Al hacer clic sobre la imagen, el visor consulta ese píxel y presenta sus valores, coordenadas, calidad y espectro cuando están disponibles. Así completamos el recorrido: objetivo, datos, canales, comparación temporal y análisis. Ahora puedes explorar la misión por tu cuenta.',
  },
];

export default function SphereXAdvancedExplorer({
  targetName,
  ra,
  dec,
  onClose,
  language = 'es',
  guidedTutorial = false,
  narrate,
  onGuidedComplete,
}) {
  const visorRootRef = useRef(null);
  const narrateRef = useRef(narrate);
  const onGuidedCompleteRef = useRef(onGuidedComplete);
  const [guideStep, setGuideStep] = useState(-1);
  const [guideRunning, setGuideRunning] = useState(false);
  const parsedVisor = useMemo(() => parseVisorDocument(originalVisualizerHtml), []);
  narrateRef.current = narrate;
  onGuidedCompleteRef.current = onGuidedComplete;

  const finishGuide = useCallback(() => {
    setGuideRunning(false);
    setGuideStep(-1);
    onGuidedCompleteRef.current?.();
  }, []);

  useEffect(() => {
    const rootEl = visorRootRef.current;
    if (!rootEl) return undefined;

    rootEl.innerHTML = parsedVisor.bodyHtml;

    const winListeners = [];
    const docListeners = [];
    const activeIntervals = new Set();
    const activeTimeouts = new Set();

    const escapeId = (id) => {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(id));
      }
      return String(id).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    };

    const visorDoc = new Proxy(document, {
      get(target, prop) {
        if (prop === 'getElementById') {
          return (id) => {
            if (!id) return null;
            return rootEl.querySelector(`#${escapeId(id)}`) || target.getElementById(id);
          };
        }
        if (prop === 'querySelector') {
          return (sel) => rootEl.querySelector(sel) || target.querySelector(sel);
        }
        if (prop === 'querySelectorAll') {
          return (sel) => {
            const scoped = rootEl.querySelectorAll(sel);
            return scoped.length > 0 ? scoped : target.querySelectorAll(sel);
          };
        }
        if (prop === 'addEventListener') {
          return (type, listener, options) => {
            docListeners.push({ type, listener, options });
            return target.addEventListener(type, listener, options);
          };
        }
        if (prop === 'removeEventListener') {
          return (type, listener, options) => target.removeEventListener(type, listener, options);
        }
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const visorWin = new Proxy(window, {
      get(target, prop) {
        if (prop === 'document') return visorDoc;
        if (prop === 'addEventListener') {
          return (type, listener, options) => {
            winListeners.push({ type, listener, options });
            return target.addEventListener(type, listener, options);
          };
        }
        if (prop === 'removeEventListener') {
          return (type, listener, options) => target.removeEventListener(type, listener, options);
        }
        if (prop === 'setInterval') {
          return (fn, delay, ...args) => {
            const id = target.setInterval(fn, delay, ...args);
            activeIntervals.add(id);
            return id;
          };
        }
        if (prop === 'clearInterval') {
          return (id) => {
            activeIntervals.delete(id);
            return target.clearInterval(id);
          };
        }
        if (prop === 'setTimeout') {
          return (fn, delay, ...args) => {
            const id = target.setTimeout(fn, delay, ...args);
            activeTimeouts.add(id);
            return id;
          };
        }
        if (prop === 'clearTimeout') {
          return (id) => {
            activeTimeouts.delete(id);
            return target.clearTimeout(id);
          };
        }
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });

    try {
      const runner = new Function('window', 'document', parsedVisor.scriptCode);
      runner(visorWin, visorDoc);
    } catch (err) {
      console.error('Error inicializando el visor científico SPHEREx integrado:', err);
    }

    if (Number.isFinite(ra) && Number.isFinite(dec)) {
      const focusTimer = window.setTimeout(() => {
        if (typeof window.__kronoxVisorFocusRegion === 'function') {
          window.__kronoxVisorFocusRegion(ra, dec, 0.5, targetName);
        }
      }, 80);
      activeTimeouts.add(focusTimer);
    }

    return () => {
      for (const { type, listener, options } of winListeners) {
        window.removeEventListener(type, listener, options);
      }
      for (const { type, listener, options } of docListeners) {
        document.removeEventListener(type, listener, options);
      }
      for (const id of activeIntervals) {
        window.clearInterval(id);
      }
      for (const id of activeTimeouts) {
        window.clearTimeout(id);
      }
      delete window.__kronoxVisorFocusRegion;
      rootEl.innerHTML = '';
    };
  }, [parsedVisor]);

  useEffect(() => {
    if (
      Number.isFinite(ra) &&
      Number.isFinite(dec) &&
      typeof window.__kronoxVisorFocusRegion === 'function'
    ) {
      window.__kronoxVisorFocusRegion(ra, dec, 0.5, targetName);
    }
  }, [ra, dec, targetName]);

  useEffect(() => {
    if (!guidedTutorial) {
      setGuideRunning(false);
      setGuideStep(-1);
      return undefined;
    }

    const root = visorRootRef.current;
    if (!root) return undefined;
    let cancelled = false;
    const timers = new Set();
    let activeHighlight = null;
    root.style.pointerEvents = 'none';
    setGuideRunning(true);

    const schedule = (callback, delay) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!cancelled) callback();
      }, delay);
      timers.add(timer);
      return timer;
    };

    const clearHighlight = () => {
      if (!activeHighlight) return;
      activeHighlight.classList.remove('kronoxMissionGuideFocus');
      activeHighlight.removeAttribute('data-kronox-guide-focus');
      activeHighlight = null;
    };

    const playStep = (index) => {
      if (cancelled) return;
      clearHighlight();
      if (index >= MISSION_GUIDE_STEPS.length) {
        finishGuide();
        return;
      }
      const step = MISSION_GUIDE_STEPS[index];
      setGuideStep(index);
      const target = root.querySelector(step.selector);
      if (target) {
        activeHighlight = target;
        target.classList.add('kronoxMissionGuideFocus');
        target.setAttribute('data-kronox-guide-focus', String(index + 1));
        target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      }
      step.enter?.(root);
      step.animate?.(root, schedule);

      schedule(() => {
        if (cancelled) return;
        let narrationCompleted = false;
        const continueAfterNarration = () => {
          if (narrationCompleted || cancelled) return;
          narrationCompleted = true;
          schedule(() => {
            step.after?.(root);
            playStep(index + 1);
          }, 500);
        };
        schedule(continueAfterNarration, 45000);
        if (narrateRef.current) {
          narrateRef.current(t(step.narration, language), continueAfterNarration);
        } else {
          continueAfterNarration();
        }
      }, index === 0 ? 1100 : 650);
    };

    schedule(() => playStep(0), 1600);
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      clearHighlight();
      root.style.pointerEvents = '';
    };
  }, [finishGuide, guidedTutorial, language]);

  return (
    <div className="kronoxExpeditionShade kronoxSphereXExplorerShade" role="dialog" aria-modal="true">
      <style data-kronox-visor-style="true">{parsedVisor.scopedCss}</style>
      <section className="kronoxExpeditionSheet kronoxSphereXExplorerSheet">
        <header className="kronoxExpeditionHeader kronoxSphereXExplorerHeader">
          <div className="kronoxHeaderBadge">
            <span className="kronoxCompassIcon" aria-hidden="true">
              ✦
            </span>
            <div className="kronoxHeaderText">
              <span className="kronoxHeaderSub">ESTACIÓN DE INVESTIGACIÓN · DR1</span>
              <h2 className="kronoxHeaderTitle">Explorador espectral de todo el cielo</h2>
            </div>
          </div>
          <button type="button" className="kronoxCloseButton" onClick={onClose}>
            <span aria-hidden="true">←</span>
            <span className="kronoxCloseLabel">Regresar al espacio 3D</span>
          </button>
        </header>

        <div className="kronoxSphereXExplorerNotice">
          <span className="kronoxSphereXExplorerTag">NEW OBSERVATORY · SPHEREx DR1 &amp; IRSA (/api)</span>
          <span>
            Cubo de 102 canales, mapas HiPS, inspección de píxel, embeddings 64D y FITS reales
            integrados nativamente en KRONOX mediante funciones serverless <code>/api</code>.
          </span>
          <details>
            <summary>Procedencia y lectura de los datos</summary>
            <p>
              Las imágenes y valores inspeccionados proceden de productos del archivo IRSA/SPHEREx.
              La composición RGB, las escalas de visualización y las capas de análisis son
              transformaciones para explorar esos datos; los colores no son ópticos y las
              representaciones de similitud no son resultados oficiales de NASA.
            </p>
          </details>
        </div>

        <div className="kronoxSphereXExplorerScreen">
          <div
            ref={visorRootRef}
            className="kronoxNativeVisorRoot"
            data-testid="kronox-native-spherex-visor"
            aria-label="Visor científico SPHEREx: 102 canales y datos DR1"
          />
          {guidedTutorial && guideRunning && guideStep >= 0 && (
            <div className="kronoxMissionGuideCard" role="status" aria-live="polite">
              <div className="kronoxMissionGuideProgress">
                <span>{t('RECORRIDO DE MISIÓN · NOVATOS', language)}</span>
                <span>{guideStep + 1} / {MISSION_GUIDE_STEPS.length}</span>
              </div>
              <h3>{t(MISSION_GUIDE_STEPS[guideStep].title, language)}</h3>
              <p>{t(MISSION_GUIDE_STEPS[guideStep].narration, language)}</p>
              <button type="button" onClick={finishGuide}>
                {t('Terminar explicación', language)}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
