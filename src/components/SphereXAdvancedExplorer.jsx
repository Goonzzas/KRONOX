import React, { useEffect, useMemo, useRef } from 'react';
import originalVisualizerHtml from '../../SphereX-Visualizations-main/kronox_visor_cientifico.html?raw';
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

export default function SphereXAdvancedExplorer({ targetName, ra, dec, onClose }) {
  const visorRootRef = useRef(null);
  const parsedVisor = useMemo(() => parseVisorDocument(originalVisualizerHtml), []);

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
        </div>
      </section>
    </div>
  );
}
