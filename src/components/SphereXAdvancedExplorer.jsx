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

const VIEW_HELP_GUIDES = {
  spectral: [
    {
      selector: '#explorerSourcePills',
      title: 'Fuentes y productos SPHEREx',
      titleEn: 'SPHEREx sources and products',
      narration: 'Este selector cambia el producto de observación. El cubo DR1 permite recorrer hasta 102 canales infrarrojos. Las vistas RGB y los mapas de calidad ayudan a interpretar los datos, pero no sustituyen las mediciones FITS.',
      narrationEn: 'This selector changes the observation product. The DR1 cube lets you browse up to 102 infrared channels. RGB views and quality maps help interpret the data, but they do not replace FITS measurements.',
    },
    {
      selector: '#cube102Controls',
      title: 'Detectores D1–D6 y 102 canales',
      titleEn: 'D1–D6 detectors and 102 channels',
      narration: 'Elige un detector D1 a D6 y recorre el control de canal para cambiar la longitud de onda. El barrido reproduce el cambio espectral; la velocidad solo controla la reproducción, no cambia los datos ni las fechas observadas.',
      narrationEn: 'Choose detector D1 through D6 and move the channel control to change wavelength. The sweep animates the spectral change; its speed changes playback only, not the data or observation dates.',
    },
    {
      selector: '#panel1ModePills',
      title: 'Composición, señal y calidad',
      titleEn: 'Composite, signal, and quality',
      narration: 'En este panel cambias entre bandas compuestas, señal y banderas de calidad. RGB combina bandas para facilitar la lectura visual; SNR compara señal con ruido; FLAGS ayuda a localizar píxeles marcados por el procesamiento.',
      narrationEn: 'This panel switches between composite bands, signal, and quality flags. RGB combines bands for visual inspection; SNR compares signal with noise; FLAGS helps locate pixels marked by processing.',
    },
    {
      selector: '#panel2ModePills',
      title: 'Embeddings y clasificación K-NN',
      titleEn: 'Embeddings and K-NN classification',
      narration: 'Los embeddings resumen patrones de los datos para comparar píxeles. K-NN clasifica por similitud con vecinos cercanos; puedes ajustar K, añadir prototipos y activar la máscara. Es una herramienta exploratoria, no una identificación automática definitiva.',
      narrationEn: 'Embeddings summarize data patterns to compare pixels. K-NN classifies by similarity to nearby neighbors; you can adjust K, add prototypes, and enable the mask. This is an exploratory tool, not a definitive automatic identification.',
    },
    {
      selector: '#canvasIR',
      title: 'Inspecciona un píxel y sus FITS',
      titleEn: 'Inspect a pixel and its FITS data',
      narration: 'Haz clic en la imagen para consultar el píxel correspondiente. Cuando hay cobertura disponible, el panel muestra flujo en MJy por estereorradián, número de exposiciones y banderas; revisa la procedencia antes de interpretar una medición.',
      narrationEn: 'Click the image to query the corresponding pixel. When coverage is available, the panel shows flux in MJy per steradian, exposure count, and flags; check provenance before interpreting a measurement.',
    },
    {
      selector: '#btnOpenCatalog',
      title: 'Catálogo de observaciones y épocas',
      titleEn: 'Observation catalog and epochs',
      narration: 'Abre el catálogo para revisar observaciones disponibles, fechas, detectores y productos compatibles. Puedes filtrar y consultar el archivo IRSA. Las épocas corresponden a observaciones reales y no a una simulación de movimiento del objeto.',
      narrationEn: 'Open the catalog to review available observations, dates, detectors, and compatible products. You can filter results and query the IRSA archive. Epochs correspond to real observations, not a simulated object motion.',
    },
  ],
  sphere360: [
    {
      selector: '#stageContainer',
      title: 'Explora el cielo en 360°',
      titleEn: 'Explore the sky in 360°',
      narration: 'Arrastra la esfera para mirar alrededor. Usa los botones de Esfera Interior y Vista Plana para alternar entre el domo panorámico y el mapa 2D. Los puntos y etiquetas llevan a objetos del catálogo.',
      narrationEn: 'Drag the sphere to look around. Use Interior Sphere and Flat View to switch between the panoramic dome and the 2D map. Points and labels open catalog objects.',
    },
    {
      selector: '.palette-picker',
      title: 'Elige cómo combinar las bandas',
      titleEn: 'Choose how to combine bands',
      narration: '18 Bandas Integradas combina el espectro disponible; Estilo JWST/NASA aplica una paleta cromática; 3 Canales Manual permite elegir canales para rojo, verde y azul. Son composiciones infrarrojas para explorar, no colores ópticos observados por el ojo.',
      narrationEn: '18 Integrated Bands combines available spectral bands; JWST/NASA Style applies a color palette; Manual 3 Channels lets you choose red, green, and blue channels. These are infrared composites for exploration, not optical colors seen by the eye.',
    },
    {
      selector: '#categoryLegendBar',
      title: 'Filtra por tipo de objeto',
      titleEn: 'Filter by object type',
      narration: 'Estos filtros muestran todos los objetos o una categoría, como nebulosas, agujeros negros, púlsares, remanentes de supernova, cúmulos y galaxias. Los números indican cuántos objetos hay cargados en cada grupo.',
      narrationEn: 'These filters show all objects or one category, such as nebulae, black holes, pulsars, supernova remnants, clusters, and galaxies. The counts show how many objects are loaded in each group.',
    },
    {
      selector: '#datasetSelect',
      title: 'Salta a un objetivo del catálogo',
      titleEn: 'Jump to a catalog target',
      narration: 'Usa Ir a para centrar un objeto conocido en la esfera. También puedes inspeccionar los puntos directamente. La vista está pensada para navegación celeste y exploración visual.',
      narrationEn: 'Use Go to to center a known object in the sphere. You can also inspect points directly. This view is designed for sky navigation and visual exploration.',
    },
    {
      selector: '#timeScrubberRow',
      title: 'Compara las 10 épocas',
      titleEn: 'Compare the 10 epochs',
      narration: 'El control temporal cambia entre las diez épocas disponibles. Usa anterior, siguiente o la tira de miniaturas; pausa la animación y ajusta su velocidad cuando necesites comparar una fecha con otra.',
      narrationEn: 'The time control switches between ten available epochs. Use previous, next, or the thumbnail strip; pause the animation and adjust its speed when comparing one date with another.',
    },
    {
      selector: '#inspectorTabs',
      title: 'Organiza el panel de inspección',
      titleEn: 'Organize the inspection panel',
      narration: 'Todo muestra el visor temporal, telemetría y bandas. Visor y Tiempo deja más espacio a la evolución temporal y sus gráficas. Bandas FITS concentra la galería de bandas de los detectores D1 a D6.',
      narrationEn: 'All shows the temporal viewer, telemetry, and bands. Viewer & Time gives more room to temporal evolution and its charts. FITS Bands focuses on the D1–D6 detector band gallery.',
    },
    {
      selector: '#openIrsaBtn',
      title: 'Consulta el archivo y exporta',
      titleEn: 'Query the archive and export',
      narration: 'Buscar en IRSA abre herramientas del archivo NASA/IPAC para localizar datos relacionados. Guardar PNG exporta la visualización actual. Subir FITS permite cargar archivos locales compatibles para inspección en esta vista.',
      narrationEn: 'Search IRSA opens NASA/IPAC archive tools to find related data. Save PNG exports the current visualization. Upload FITS loads compatible local files for inspection in this view.',
    },
  ],
  atlas: [
    {
      selector: '#btnModeInmersiva',
      title: 'Proyección y coordenadas del atlas',
      titleEn: 'Atlas projection and coordinates',
      narration: 'Inmersiva muestra una vista direccional del cielo; Ecuatorial presenta el cielo completo en un mapa. Puedes cambiar la proyección, el marco ICRS o galáctico, la cuadrícula, el ángulo y el campo de visión.',
      narrationEn: 'Immersive shows a directional view of the sky; Equatorial presents the full sky as a map. You can change projection, ICRS or Galactic frame, grid, position angle, and field of view.',
    },
    {
      selector: '#baseSurveySelect',
      title: 'Capas astronómicas',
      titleEn: 'Astronomical layers',
      narration: 'Selecciona AllWISE, 2MASS, DSS2 o SPHEREx como capa base. Superpón SPHEREx para ver su mapa infrarrojo y Gaia DR3 para consultar posiciones estelares. La opacidad mezcla visualmente las capas, pero no convierte sus mediciones en una sola escala fotométrica.',
      narrationEn: 'Select AllWISE, 2MASS, DSS2, or SPHEREx as the base layer. Overlay SPHEREx to view its infrared map and Gaia DR3 to inspect stellar positions. Opacity blends the layers visually, but does not put their measurements on one photometric scale.',
    },
    {
      selector: '#spxChSlider',
      title: 'Recorre los 102 canales SPHEREx',
      titleEn: 'Browse the 102 SPHEREx channels',
      narration: 'El deslizador y las flechas recorren canales espectrales, detectores y longitudes de onda. Si un canal no tiene datos publicados, el atlas lo indica; no interpola una observación inexistente.',
      narrationEn: 'The slider and arrows browse spectral channels, detectors, and wavelengths. If a channel has no published data, the atlas indicates that; it does not interpolate a nonexistent observation.',
    },
    {
      selector: '#chkAllSkyCosine',
      title: 'Similitud e IA 64D en todo el cielo',
      titleEn: 'All-sky similarity and 64D AI',
      narration: 'IA 64D compara representaciones de regiones del cielo. Puedes elegir similitud coseno o K-NN, ajustar el umbral y seleccionar un prototipo. Una similitud alta señala patrones parecidos; no demuestra que los objetos sean físicamente iguales.',
      narrationEn: '64D AI compares representations of sky regions. You can choose cosine similarity or K-NN, adjust the threshold, and select a prototype. High similarity indicates similar patterns; it does not prove the objects are physically identical.',
    },
    {
      selector: '#btnSelectRegion',
      title: 'Analiza una región y su evolución',
      titleEn: 'Analyze a region and its evolution',
      narration: 'Selecciona una región del cielo para consultar cobertura SPHEREx, representaciones y épocas. En el análisis puedes comparar la época actual con la anterior y revisar diferencias. Cambios aparentes también pueden reflejar ruido o calibración.',
      narrationEn: 'Select a sky region to query SPHEREx coverage, representations, and epochs. In the analysis panel you can compare the current epoch with the previous one and inspect differences. Apparent changes may also reflect noise or calibration.',
    },
    {
      selector: '#searchObjInput',
      title: 'Busca objetos o coordenadas',
      titleEn: 'Search objects or coordinates',
      narration: 'Escribe el nombre de un objeto o coordenadas RA y Dec y pulsa Ir. Los botones de salto rápido centran destinos conocidos. La telemetría informa centro, cursor, objeto seleccionado y estado de las capas.',
      narrationEn: 'Enter an object name or RA and Dec coordinates, then press Go. Quick-jump buttons center known targets. Telemetry reports the center, cursor, selected object, and layer status.',
    },
  ],
  umap3d: [
    {
      selector: '#umapStage',
      title: 'Qué representa el mapa UMAP 3D',
      titleEn: 'What the 3D UMAP represents',
      narration: 'Cada punto representa un parche de datos convertido en una representación latente por el autoencoder. UMAP coloca patrones parecidos cerca en tres dimensiones; los ejes no son coordenadas físicas del espacio.',
      narrationEn: 'Each point represents a data patch encoded as a latent representation by the autoencoder. UMAP places similar patterns near each other in three dimensions; the axes are not physical space coordinates.',
    },
    {
      selector: '#colorModeSelect',
      title: 'Cambia la variable visualizada',
      titleEn: 'Change the displayed variable',
      narration: 'Colorea los puntos por clase astrofísica, color RGB, sensor dominante, longitud de onda, activación de una neurona o error MSE. El color ayuda a explorar relaciones; no es una clasificación confirmada por sí sola.',
      narrationEn: 'Color points by astrophysical class, RGB color, dominant sensor, wavelength, neuron activation, or MSE error. Color helps explore relationships; by itself it is not a confirmed classification.',
    },
    {
      selector: '#sensorFilterPills',
      title: 'Filtra por detectores y campos',
      titleEn: 'Filter by detectors and fields',
      narration: 'Usa Todos o D1 a D6 para limitar los parches a un detector, y el selector de campo para revisar uno de los veinte campos. Así comparas cómo cambia la distribución según la banda instrumental o la región observada.',
      narrationEn: 'Use All or D1 through D6 to limit patches to a detector, and the field selector to inspect one of twenty fields. This lets you compare distributions across instrument bands or observed regions.',
    },
    {
      selector: '#hoverTooltip',
      title: 'Inspecciona cada punto',
      titleEn: 'Inspect each point',
      narration: 'Pasa el cursor por un punto para ver campo, detector, coordenadas, imagen original, reconstrucción y error MSE. La reconstrucción es la salida del modelo y puede diferir del parche original; no es una imagen observada adicional.',
      narrationEn: 'Hover over a point to see its field, detector, coordinates, original image, reconstruction, and MSE error. The reconstruction is the model output and may differ from the original patch; it is not an additional observed image.',
    },
    {
      selector: '#btnViewGallery',
      title: 'Alterna mapa, galería y ayudas visuales',
      titleEn: 'Switch map, gallery, and visual aids',
      narration: 'La vista dividida combina puntos UMAP e inspector; la galería reúne veinte composites. Auto-Rotación mueve la cámara, Filamentos muestra conexiones del manifold, Mini-Imágenes coloca parches en puntos y Centrar restablece la cámara.',
      narrationEn: 'Split view combines UMAP points and the inspector; the gallery collects twenty composites. Auto-Rotation moves the camera, Filaments shows manifold connections, Mini-Images places patches on points, and Center resets the camera.',
    },
    {
      selector: '#masterCompositeCanvas',
      title: 'Lee el inspector del composite',
      titleEn: 'Read the composite inspector',
      narration: 'El inspector muestra el composite del parche activo, sus coordenadas, bandas, reconstrucción y métricas del modelo. El espectro y las activaciones latentes describen propiedades del conjunto procesado; revisa el error antes de comparar reconstrucciones.',
      narrationEn: 'The inspector shows the active patch composite, coordinates, bands, reconstruction, and model metrics. The spectrum and latent activations describe properties of the processed dataset; review the error when comparing reconstructions.',
    },
  ],
};

function localizedHelpText(step, field, language) {
  const englishField = `${field}En`;
  return language === 'en' && step[englishField] ? step[englishField] : step[field];
}

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
  const [moduleGuide, setModuleGuide] = useState(null);
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

  const openModuleGuide = useCallback((viewId = activeView) => {
    const view = EXPLORER_VIEWS.some((item) => item.id === viewId) ? viewId : 'spectral';
    setActiveView(view);
    setModuleGuide({ view, step: 0 });
  }, [activeView]);

  const closeModuleGuide = useCallback(() => setModuleGuide(null), []);

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

  useEffect(() => {
    if (!moduleGuide) return undefined;
    if (moduleGuide.view !== activeView) {
      setActiveView(moduleGuide.view);
      return undefined;
    }
    if (!parsedVisor) return undefined;
    const root = visorRootRef.current;
    const step = VIEW_HELP_GUIDES[moduleGuide.view]?.[moduleGuide.step];
    if (!root || !step) return undefined;
    const target = step.selector ? root.querySelector(step.selector) : null;
    if (!target) return undefined;
    target.classList.add('kronoxMissionGuideFocus');
    target.setAttribute('data-kronox-guide-focus', String(moduleGuide.step + 1));
    target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    return () => {
      target.classList.remove('kronoxMissionGuideFocus');
      target.removeAttribute('data-kronox-guide-focus');
    };
  }, [activeView, moduleGuide, parsedVisor]);

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
                onClick={() => {
                  setActiveView(view.id);
                  setModuleGuide((current) => current ? { view: view.id, step: 0 } : null);
                }}
              >
                {language === 'en' ? view.labelEn : view.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="kronoxSphereXHelpButton"
            aria-label={language === 'en' ? 'Open guide for this SPHEREx mode' : 'Abrir guía de este modo SPHEREx'}
            title={language === 'en' ? 'Learn the controls for this mode' : 'Aprende los controles de este modo'}
            onClick={() => openModuleGuide(activeView)}
          >
            <span className="kronoxSphereXHelpIcon" aria-hidden="true">i</span>
            <span>{language === 'en' ? 'Guide' : 'Guía'}</span>
          </button>

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
          {moduleGuide && VIEW_HELP_GUIDES[moduleGuide.view]?.[moduleGuide.step] && (
            <aside className="kronoxSphereXHelpCard" role="dialog" aria-live="polite" aria-label={language === 'en' ? 'SPHEREx mode guide' : 'Guía de modos SPHEREx'}>
              {(() => {
                const steps = VIEW_HELP_GUIDES[moduleGuide.view];
                const step = steps[moduleGuide.step];
                const view = EXPLORER_VIEWS.find((item) => item.id === moduleGuide.view);
                const narration = localizedHelpText(step, 'narration', language);
                return (
                  <>
                    <div className="kronoxSphereXHelpProgress">
                      <span>{language === 'en' ? 'MODE GUIDE' : 'GUÍA DEL MODO'} · {language === 'en' ? view?.labelEn : view?.label}</span>
                      <span>{moduleGuide.step + 1} / {steps.length}</span>
                    </div>
                    <button type="button" className="kronoxSphereXHelpClose" aria-label={language === 'en' ? 'Close guide' : 'Cerrar guía'} onClick={closeModuleGuide}>×</button>
                    <h3>{localizedHelpText(step, 'title', language)}</h3>
                    <p>{narration}</p>
                    <div className="kronoxSphereXHelpActions">
                      <button
                        type="button"
                        className="is-listen"
                        onClick={() => {
                          if (!voiceEnabled) onEnableNarration?.();
                          narrateRef.current?.(narration, undefined, { preferBrowser: true });
                        }}
                      >
                        <span aria-hidden="true">{voiceEnabled ? '🔊' : '🔈'}</span>{' '}
                        {language === 'en' ? 'Listen' : 'Escuchar'}
                      </button>
                      <button
                        type="button"
                        disabled={moduleGuide.step === 0}
                        onClick={() => setModuleGuide((current) => ({ ...current, step: Math.max(0, current.step - 1) }))}
                      >
                        {language === 'en' ? 'Previous' : 'Anterior'}
                      </button>
                      {moduleGuide.step === steps.length - 1 ? (
                        <button type="button" className="is-finish" onClick={closeModuleGuide}>
                          {language === 'en' ? 'Finish' : 'Terminar'}
                        </button>
                      ) : (
                        <button type="button" className="is-finish" onClick={() => setModuleGuide((current) => ({ ...current, step: current.step + 1 }))}>
                          {language === 'en' ? 'Next' : 'Siguiente'}
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </aside>
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
