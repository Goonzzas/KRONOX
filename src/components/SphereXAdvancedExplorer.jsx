import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import originalVisualizerHtml from '../../SphereX-Visualizations-main/kronox_visor_cientifico.html?raw';
import sphere360Html from '../../SphereX-Visualizations-main/static/index.html?raw';
import sphere360Css from '../../SphereX-Visualizations-main/static/styles.css?raw';
import sphere360Js from '../../SphereX-Visualizations-main/static/app.js?raw';
import immersiveSkyHtml from '../../SphereX-Visualizations-main/kronox_cielo_inmersivo.html?raw';
import { t } from '../i18n.js';
import '../styles/spherexAdvancedExplorer.css';

function scopeCssToVisorRoot(rawCss) {
  if (!rawCss) return '';
  return rawCss
    .replace(/:root\b/g, '.kronoxNativeVisorRoot')
    .replace(/(^|\n)\s*\*\s*\{/g, '$1.kronoxNativeVisorRoot, .kronoxNativeVisorRoot * {')
    .replace(/html\s*,\s*\r?\n?\s*body\s*\{/g, '.kronoxNativeVisorRoot {')
    .replace(/(^|\n)\s*html\s*\{/g, '$1.kronoxNativeVisorRoot {')
    .replace(/(^|\n)\s*body\s*\{/g, '$1.kronoxNativeVisorRoot {')
    .replace(/(^|\n)\s*header\s*\{/g, '$1.kronoxNativeVisorRoot > header {')
    .replace(/min-height:\s*100vh\s*;/g, 'min-height: 100%;')
    .replace(/height:\s*100vh\s*;/g, 'height: 100%;');
}

function parseVisorDocument(htmlText, extraCss = '', extraScript = '') {
  const styleMatch = htmlText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const rawCss = extraCss || (styleMatch ? styleMatch[1] : '');
  const scopedCss = scopeCssToVisorRoot(rawCss);

  const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1] : '';
  const bodyHtml = rawBody.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  let scriptCode = extraScript || '';
  if (!scriptCode) {
    const inlineMatches = [...htmlText.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
    scriptCode = inlineMatches.map((m) => m[1]).join('\n');
  }

  return { scopedCss, bodyHtml, scriptCode };
}

const EXPLORER_VIEWS = [
  { id: 'spectral', label: 'Visor del Objetivo (DR1 · 102 ch)', labelEn: 'Target Visor (DR1 · 102 ch)' },
  { id: 'sphere360', label: 'Esfera 360° · 10 Épocas y Galaxias', labelEn: '360° Sphere · 10 Epochs & Galaxies' },
  { id: 'atlas', label: 'Atlas Inmersivo HiPS', labelEn: 'Immersive HiPS Atlas' },
  { id: 'umap3d', label: 'UMAP 3D (Latente)', labelEn: 'UMAP 3D (Latent)' },
];

const MISSION_GUIDE_STEPS = [
  {
    selector: '#headerObjectTitle',
    title: '1 · ESTRELLA DE BARNARD EN SPHEREx',
    narration:
      'Aquí tienes {target} (una estrella enana roja vecina a solo 6 años luz). A la izquierda ves sus capturas infrarrojas reales de NASA SPHEREx; la usamos como objetivo principal porque cruza el cielo más rápido que cualquier otra estrella conocida (10.36 segundos de arco por año).',
  },
  {
    selector: '#canvasIR',
    title: '2 · MAPA INFRARROJO CENTRADO EN BARNARD',
    narration:
      'Activamos la vista de 102 canales infrarrojos exactamente sobre {target}, en las coordenadas celestes RA {ra} grados y Dec {dec} grados. Arrastra con el ratón para recorrer el campo alrededor de Barnard o usa la rueda para acercar y alejar.',
    enter: (root) => root.querySelector('#explorerSourcePills [data-src="cube102"]')?.click(),
  },
  {
    selector: '#cube102Controls',
    title: '3 · DETECTOR D2 PARA OBSERVAR BARNARD',
    narration:
      'Para seguir {target} usamos el detector D2 (1.1 a 1.6 micrómetros), donde su brillo infrarrojo se distingue con máxima nitidez. Voy a avanzar unos canales para que observes cómo cambia la estrella al variar la longitud de onda.',
    enter: (root) => root.querySelector('#c102DetPills [data-det="2"]')?.click(),
    animate: (root, schedule) => {
      const next = root.querySelector('#c102NextCh');
      for (let i = 1; i <= 3; i += 1) schedule(() => next?.click(), i * 900);
    },
  },
  {
    selector: '#panel1ModePills',
    title: '4 · RGB, SNR Y BANDERAS FLAGS SOBRE BARNARD',
    narration:
      'Esta barra filtra los datos reales de {target}: RGB combina bandas infrarrojas, SNR mide la claridad de la señal de Barnard frente al fondo y FLAGS marca posibles rayos cósmicos o bordes. Probemos SNR y FLAGS y volvamos a D2.',
    enter: (root) => root.querySelector('#panel1ModePills [data-p1="D2"]')?.click(),
    animate: (root, schedule) => {
      schedule(() => root.querySelector('#panel1ModePills [data-p1="snr"]')?.click(), 900);
      schedule(() => root.querySelector('#panel1ModePills [data-p1="flags"]')?.click(), 1800);
    },
    after: (root) => root.querySelector('#panel1ModePills [data-p1="D2"]')?.click(),
  },
  {
    selector: '#canvasIR',
    title: '5 · MEDIR UN PÍXEL DE LA ESTRELLA DE BARNARD',
    narration:
      'Hacemos clic justo sobre {target} en el centro de la imagen. Así lees su flujo real en MJy/sr, su espectro infrarrojo y las exposiciones registradas en ese punto exacto del cielo.',
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
    selector: '#btnOpenCatalog',
    title: '6 · ÉPOCAS DE BARNARD Y ESFERA 360°',
    narration:
      'Para comprobar cómo se mueve {target} entre fechas distintas, abre el Catálogo Real (QR2, QR3, DR1 y NASA IRSA). Además, arriba tienes la nueva pestaña Esfera 360° con galaxias, nebulosas y 10 épocas temporales para explorar cuando termines.',
    enter: (root) => root.querySelector('#btnOpenCatalog')?.click(),
    after: (root) => root.querySelector('#btnCloseCatalog')?.click(),
  },
  {
    selector: '#headerObjectTitle',
    title: '7 · ¡MISIÓN DE BARNARD COMPLETADA!',
    narration:
      'Ya sabes ubicar {target}, elegir su detector D2, inspeccionar sus píxeles reales y consultar sus épocas en SPHEREx. Ahora tienes libertad total en el observatorio y en todas las cubiertas de la nave con nuevas misiones opcionales.',
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
  voiceEnabled = true,
  onEnableNarration,
  onGuidedComplete,
}) {
  const visorRootRef = useRef(null);
  const narrateRef = useRef(narrate);
  const onGuidedCompleteRef = useRef(onGuidedComplete);
  const [activeView, setActiveView] = useState('spectral');
  const [umapHtml, setUmapHtml] = useState('');
  const [umapLoading, setUmapLoading] = useState(false);
  const [guideStep, setGuideStep] = useState(-1);
  const [guideRunning, setGuideRunning] = useState(false);
  const guideStepRef = useRef(guideStep);

  const parsedVisor = useMemo(() => {
    if (activeView === 'sphere360') {
      return parseVisorDocument(sphere360Html, sphere360Css, sphere360Js);
    }
    if (activeView === 'atlas') {
      return parseVisorDocument(immersiveSkyHtml);
    }
    if (activeView === 'umap3d') {
      return umapHtml ? parseVisorDocument(umapHtml) : null;
    }
    return parseVisorDocument(originalVisualizerHtml);
  }, [activeView, umapHtml]);

  narrateRef.current = narrate;
  onGuidedCompleteRef.current = onGuidedComplete;
  guideStepRef.current = guideStep;

  const finishGuide = useCallback(() => {
    if (visorRootRef.current) visorRootRef.current.style.pointerEvents = '';
    setGuideRunning(false);
    setGuideStep(-1);
    onGuidedCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (activeView !== 'umap3d' || umapHtml) return undefined;
    const ctrl = new AbortController();
    setUmapLoading(true);
    const umapUrl = `${import.meta.env.BASE_URL || '/'}spherex-viz/umap3d.html`;
    fetch(umapUrl, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        if (text) setUmapHtml(text);
      })
      .catch(() => {})
      .finally(() => setUmapLoading(false));
    return () => ctrl.abort();
  }, [activeView, umapHtml]);

  useEffect(() => {
    const rootEl = visorRootRef.current;
    if (!rootEl || !parsedVisor) return undefined;

    rootEl.innerHTML = parsedVisor.bodyHtml;

    const winListeners = [];
    const docListeners = [];
    const domReadyCallbacks = [];
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
            if (type === 'DOMContentLoaded' && typeof listener === 'function') {
              domReadyCallbacks.push(listener);
              return undefined;
            }
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
            if (type === 'DOMContentLoaded' && typeof listener === 'function') {
              domReadyCallbacks.push(listener);
              return undefined;
            }
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

    window.__kronoxReturnToSpectralExplorer = () => {
      setActiveView('spectral');
    };

    try {
      if (activeView === 'sphere360' && Number.isFinite(ra) && Number.isFinite(dec)) {
        window.__kronoxPendingSphereTarget = { ra, dec, targetName };
      }
      const runner = new Function('window', 'document', parsedVisor.scriptCode);
      runner(visorWin, visorDoc);
      for (const cb of domReadyCallbacks) {
        try {
          cb();
        } catch (cbErr) {
          console.error('Error ejecutando DOMContentLoaded en visualizador SPHEREx:', cbErr);
        }
      }
    } catch (err) {
      console.error('Error inicializando el visor científico SPHEREx integrado:', err);
    }

    if (activeView === 'spectral' && Number.isFinite(ra) && Number.isFinite(dec)) {
      const focusTimer = window.setTimeout(() => {
        if (typeof window.__kronoxVisorFocusRegion === 'function') {
          window.__kronoxVisorFocusRegion(ra, dec, 0.5, targetName);
        }
      }, 80);
      activeTimeouts.add(focusTimer);
    } else if (activeView === 'sphere360' && Number.isFinite(ra) && Number.isFinite(dec)) {
      const focusTimer = window.setTimeout(() => {
        if (typeof window.__kronoxSphereFocusTarget === 'function') {
          window.__kronoxSphereFocusTarget(ra, dec, targetName);
        }
      }, 120);
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
      delete window.__kronoxSphereFocusTarget;
      delete window.__kronoxReturnToSpectralExplorer;
      rootEl.innerHTML = '';
    };
  }, [activeView, parsedVisor]);

  useEffect(() => {
    if (
      activeView === 'spectral' &&
      Number.isFinite(ra) &&
      Number.isFinite(dec) &&
      typeof window.__kronoxVisorFocusRegion === 'function'
    ) {
      window.__kronoxVisorFocusRegion(ra, dec, 0.5, targetName);
    } else if (
      activeView === 'sphere360' &&
      Number.isFinite(ra) &&
      Number.isFinite(dec) &&
      typeof window.__kronoxSphereFocusTarget === 'function'
    ) {
      window.__kronoxSphereFocusTarget(ra, dec, targetName);
    }
  }, [activeView, ra, dec, targetName]);

  useEffect(() => {
    if (!guidedTutorial || activeView !== 'spectral') {
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
            Math.min(7200, narration.trim().split(/\s+/).length * 165),
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
  }, [activeView, finishGuide, guidedTutorial, language, targetName, ra, dec]);

  return (
    <div className="kronoxExpeditionShade kronoxSphereXExplorerShade" role="dialog" aria-modal="true">
      <style data-kronox-visor-style="true">{parsedVisor?.scopedCss || ''}</style>
      <section className="kronoxExpeditionSheet kronoxSphereXExplorerSheet">
        <header className="kronoxExpeditionHeader kronoxSphereXExplorerHeader">
          <div className="kronoxHeaderBadge">
            <span className="kronoxCompassIcon" aria-hidden="true">
              ✦
            </span>
            <div className="kronoxHeaderText">
              <span className="kronoxHeaderSub">NEW OBSERVATORY · SPHEREx</span>
              <h2 className="kronoxHeaderTitle">
                {targetName || 'Estrella de Barnard'}
              </h2>
            </div>
          </div>

          <nav className="kronoxSphereXViewTabs" aria-label={t('Modos del visualizador SPHEREx', language)}>
            {EXPLORER_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                className={`kronoxSphereXViewTab${activeView === view.id ? ' is-active' : ''}`}
                onClick={() => setActiveView(view.id)}
              >
                {language === 'en' ? view.labelEn : view.label}
              </button>
            ))}
          </nav>

          <button type="button" className="kronoxCloseButton" onClick={onClose}>
            <span aria-hidden="true">←</span>
            <span className="kronoxCloseLabel">{t('Regresar al espacio 3D', language)}</span>
          </button>
        </header>

        <div className="kronoxSphereXExplorerNotice">
          <span className="kronoxSphereXExplorerTag">NEW OBSERVATORY · SPHEREx DR1, ESFERA 360° &amp; IRSA (/api)</span>
          <span>
            Visualizador integrado con Esfera 360° (10 épocas, galaxias y estrellas), cubo de 102 canales DR1,
            Atlas HiPS y FITS reales de NASA/IPAC IRSA sobre funciones serverless <code>/api</code>.
          </span>
          <details>
            <summary>Procedencia y lectura de los datos</summary>
            <p>
              Las imágenes y valores inspeccionados proceden de productos reales de NASA/IPAC IRSA/SPHEREx.
              La composición RGB y capas espectrales son transformaciones en infrarrojo para estudiar esos datos
              y no equivalen a fotografía óptica visible.
            </p>
          </details>
        </div>

        <div className="kronoxSphereXExplorerScreen">
          {activeView === 'umap3d' && umapLoading && !parsedVisor ? (
            <div className="kronoxSphereXLoading" role="status">
              {t('Cargando mapa latente UMAP 3D…', language)}
            </div>
          ) : (
            <div
              ref={visorRootRef}
              className="kronoxNativeVisorRoot"
              data-testid="kronox-native-spherex-visor"
              aria-label="Visor científico SPHEREx: Esfera 360°, 102 canales y datos DR1"
            />
          )}
          {guidedTutorial && guideRunning && guideStep >= 0 && (
            <div className="kronoxMissionGuideCard" role="status" aria-live="polite">
              <div className="kronoxMissionGuideProgress">
                <span>{t('MISIÓN NOVATO · ESTRELLA DE BARNARD', language)}</span>
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
              <div className="kronoxMissionGuideActions">
                <button
                  type="button"
                  className="is-listen"
                  aria-label={t('Escuchar explicación de esta misión', language)}
                  onClick={() => {
                    if (!voiceEnabled) onEnableNarration?.();
                    narrateRef.current?.(
                      localizedGuideNarration(
                        MISSION_GUIDE_STEPS[guideStep],
                        language,
                        targetName,
                        ra,
                        dec,
                      ),
                      undefined,
                      { preferBrowser: true },
                    );
                  }}
                >
                  <span aria-hidden="true">{voiceEnabled ? '🔊' : '🔈'}</span>{' '}
                  {t('Escuchar explicación', language)}
                </button>
                {guideStep === MISSION_GUIDE_STEPS.length - 1 ? (
                  <button type="button" className="is-finish" onClick={finishGuide}>
                    {t('Explorar la nave libremente', language)}
                  </button>
                ) : (
                  <button type="button" onClick={finishGuide}>
                    {t('Omitir guía y explorar libremente', language)}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
