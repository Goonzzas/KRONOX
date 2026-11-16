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
    title: '1 · LA PREGUNTA DE LA MISIÓN',
    narration:
      'Ya estamos en la cubierta científica, nivel 3, frente a la estación SPHEREx. La misión es rastrear la Estrella de Barnard, una estrella cercana que se mueve rápido frente al fondo del cielo. Buscaremos su posición y compararemos observaciones de distintas épocas. El mapa es una vista infrarroja del cielo, no un mapa de rutas espaciales.',
  },
  {
    selector: '#canvasIR',
    title: '2 · ORIENTARSE EN EL MAPA',
    narration:
      'Este es el mapa infrarrojo centrado automáticamente en {target}, en RA {ra} grados y Dec {dec} grados. RA y Dec son coordenadas celestes. Puedes arrastrar el mapa para desplazarte y usar la rueda o los botones más y menos para acercar o alejar. El campo de visión indica cuánto cielo cabe en pantalla.',
    enter: (root) => root.querySelector('#explorerSourcePills [data-src="cube102"]')?.click(),
  },
  {
    selector: '#cube102Controls',
    title: '3 · EJEMPLO: ELEGIR LA BANDA D2',
    narration:
      'Hagamos el primer paso de la misión. Seleccionamos el detector D2, que es la banda preferida para el seguimiento de Barnard. El deslizador recorre sus canales espectrales; cada canal muestra una longitud de onda infrarroja distinta. Voy a moverlo para que veas cómo cambia la vista.',
    enter: (root) => root.querySelector('#c102DetPills [data-det="2"]')?.click(),
    animate: (root, schedule) => {
      const next = root.querySelector('#c102NextCh');
      for (let i = 1; i <= 3; i += 1) schedule(() => next?.click(), i * 900);
    },
  },
  {
    selector: '#panel1ModePills',
    title: '4 · FILTROS Y CAPAS DEL MAPA',
    narration:
      'Esta fila cambia cómo leemos el mapa. RGB combina varias bandas; D1 a D6 muestran un detector por separado. SNR ayuda a distinguir señal de ruido y FLAGS resalta indicadores de calidad. Los voy a alternar y dejaré seleccionada D2 para nuestro ejemplo.',
    enter: (root) => root.querySelector('#panel1ModePills [data-p1="D2"]')?.click(),
    animate: (root, schedule) => {
      schedule(() => root.querySelector('#panel1ModePills [data-p1="snr"]')?.click(), 900);
      schedule(() => root.querySelector('#panel1ModePills [data-p1="flags"]')?.click(), 1800);
    },
    after: (root) => root.querySelector('#panel1ModePills [data-p1="D2"]')?.click(),
  },
  {
    selector: '#canvasIR',
    title: '5 · CONSULTAR UN PÍXEL',
    narration:
      'Ahora consultamos un punto del mapa. Un clic en la imagen actualiza la posición celeste y, cuando hay datos para ese píxel, muestra brillo infrarrojo, cantidad de observaciones y banderas de calidad. En este ejemplo dejamos el centro sobre Barnard y revisamos la lectura antes de sacar una conclusión.',
    enter: (root) => {
      const canvas = root.querySelector('#canvasIR');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const view = root.ownerDocument.defaultView;
      const point = { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      canvas.dispatchEvent(new view.MouseEvent('mousedown', point));
      view.dispatchEvent(new view.MouseEvent('mouseup', point));
    },
  },
  {
    selector: '#btnObsCatalogToggle',
    title: '6 · COMPARAR ÉPOCAS',
    narration:
      'La pregunta de Barnard se responde comparando su posición en épocas distintas, por ejemplo en los productos QR2 y QR3 disponibles para la misión. Aquí abrimos el catálogo para ver qué observaciones encontró el archivo. Si una época no aparece, no inventamos el dato: se consulta otro producto o se deja constancia de que falta cobertura.',
    enter: (root) => root.querySelector('#btnObsCatalogToggle')?.click(),
    after: (root) => root.querySelector('#btnCloseObsCatalog')?.click(),
  },
  {
    selector: '#headerObjectTitle',
    title: '7 · YA PUEDES EXPLORAR',
    narration:
      'Ya viste un ejemplo completo: centrar el mapa en Barnard, elegir D2, consultar un píxel y buscar observaciones de distintas épocas. La cabina queda liberada. Ahora puedes recorrer la nave y usar el visor a tu ritmo.',
  },
];

function localizedGuideNarration(step, language, targetName, ra, dec) {
  return t(step.narration, language)
    .replaceAll('{target}', targetName || 'Estrella de Barnard')
    .replace('{ra}', Number.isFinite(ra) ? ra.toFixed(4) : '269.4485')
    .replace('{dec}', Number.isFinite(dec) ? dec.toFixed(4) : '+4.7394');
}

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
  const guideStepRef = useRef(guideStep);
  const parsedVisor = useMemo(() => parseVisorDocument(originalVisualizerHtml), []);
  narrateRef.current = narrate;
  onGuidedCompleteRef.current = onGuidedComplete;
  guideStepRef.current = guideStep;

  const finishGuide = useCallback(() => {
    if (guideStepRef.current < MISSION_GUIDE_STEPS.length - 1) return;
    if (visorRootRef.current) visorRootRef.current.style.pointerEvents = '';
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
        let minimumNarrationMs = 2800;
        let narrationStartedAt = Date.now();
        const continueAfterNarration = () => {
          if (narrationCompleted || cancelled) return;
          narrationCompleted = true;
          const remaining = Math.max(500, minimumNarrationMs - (Date.now() - narrationStartedAt));
          schedule(() => {
            step.after?.(root);
            playStep(index + 1);
          }, remaining);
        };
        schedule(continueAfterNarration, 45000);
        if (narrateRef.current) {
          const narration = localizedGuideNarration(step, language, targetName, ra, dec);
          minimumNarrationMs = Math.max(
            2800,
            Math.min(7000, narration.trim().split(/\s+/).length * 170),
          );
          narrationStartedAt = Date.now();
          narrateRef.current(narration, continueAfterNarration);
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
  }, [finishGuide, guidedTutorial, language, targetName, ra, dec]);

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
              <p>
                {localizedGuideNarration(
                  MISSION_GUIDE_STEPS[guideStep],
                  language,
                  targetName,
                  ra,
                  dec,
                )}
              </p>
              {guideStep === MISSION_GUIDE_STEPS.length - 1 && (
                <button type="button" onClick={finishGuide}>
                  {t('Recorrer libremente', language)}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
