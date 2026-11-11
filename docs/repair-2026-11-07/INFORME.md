# Reparación e integración científica de Kronox

7 de noviembre de 2026 · Astral Sentinels · ejecución local

Se aplicaron las cinco fases en la copia `C:\Users\OPPENHEIMER\Desktop\kronox-juan`, conservando el original `C:\Users\OPPENHEIMER\Desktop\KRONOX-main`. La carpeta pedida literalmente como `Escritorio/kronox` no existía; se utilizó la copia independiente ya autorizada en la conversación. El respaldo previo contiene 76 archivos de código/configuración/scripts en `backups/pre-repair-2026-11-07.json.gz`. No se hicieron commits, push, cambios remotos ni despliegues.

## 1. Diagnóstico comprobado

- **Galería reducida:** el frontend seleccionaba automáticamente el pequeño conjunto local cuando existía. Barnard conservaba cuatro recortes, aunque el archivo devuelve cientos de productos. El laboratorio tenía además `records.slice(0,12)`, que limitaba su extracción; esa restricción no era una limitación científica de IRSA.
- **Consultas y transformación:** existía un MAXREC artificial de 1000 y se fusionaban versiones por `obs_id|detector`. Esa fusión podría ocultar productos de reprocesamiento. Ahora se preserva cada URL y se cuentan separadamente productos, exposiciones y detectores. El CSV admite comillas, comas y saltos de línea. Las respuestas sin cabecera científica válida son errores explícitos.
- **Red:** el problema de reutilizar señales ya abortadas estaba corregido en la entrega anterior y se conservó. La ruta nueva de caché/reintentos también crea una señal por intento. Se distinguen ausencia de cobertura, fallo parcial de colección, timeout, error HTTP y FITS inválido.
- **Espectro vacío:** se borraban las muestras cada vez que cambiaba la imagen principal. También se dibujaban ejes aunque ninguna apertura tuviera píxeles válidos. No se trataba simplemente de un error de estilo. Hay recortes genuinos cuya apertura estricta no admite una medición, especialmente en Barnard.
- **Contraste:** un recorte sin píxeles utilizables podía producir límites infinitos y contaminar el estiramiento compartido de su detector. Se validan los límites y no se guarda una escala inválida para otras imágenes.
- **Vuelo:** la liberación de teclas dependía de recibir todos los eventos; cambiar de ventana o entrar en un campo de texto podía dejar entradas retenidas. La inercia usaba una amortiguación demasiado lenta para el criterio de parada. La integración del desplazamiento dependía del paso de fotograma.
- **Cámara e introducción:** las secuencias originales seguían en el código. Los controles añadidos podían intervenir durante ellas y el enlace de arranque recomendado omitía la bienvenida. Se recuperó el arranque normal, se protegieron las secuencias y se añadió un reingreso con transición y eventos de Cronos.
- **Orión y origen solar:** la estructura galáctica completa se dibujaba también durante aproximaciones. El origen empleado por sus partículas no coincidía con el ancla solar de las posiciones de destinos. Los marcadores dependían además de la transformación animada del grupo galáctico. Ahora tienen un marco heliocéntrico independiente; la estructura macroscópica se muestra solo en su escala.
- **Archivos ausentes:** las 12 texturas planetarias referenciadas por nombre están tanto en el ZIP original como en la copia. No se encontró evidencia de que faltaran allí. Las observaciones SPHEREx son productos consultados en ejecución, no esas texturas. El comportamiento reducido se relaciona con la selección local, filtros/estados y consultas; no se atribuye todo al ZIP.
- **Versiones:** se compararon el ZIP/original y la copia previa respaldada. No hay historial `.git` local disponible para recuperar otra implementación. La ausencia de ese historial no se sustituyó por una supuesta restauración de commits.

SIA ofrece un MAXREC opcional con valor predeterminado sin límite y filtros TIME; se usan consultas completas y, opcionalmente, particiones temporales mensuales con extremos abiertos. El cursor de la aplicación recorre estas tareas; no simula un OFFSET que el servicio no documenta. [Documentación oficial SIA de IRSA](https://irsa.ipac.caltech.edu/ibe/sia.html).

## 2. Fases aplicadas y archivos principales

| Fase | Archivos | Cambio y alcance |
|---|---|---|
| A | `src/scene/flightDynamics.js`, `src/scene/createScene.js`, `src/App.jsx` | Integración analítica de velocidad/desplazamiento, parada breve al soltar controles, limpieza por blur/visibilidad/foco/cancelación, prioridad de la cinemática, reingreso guiado y preservación de secuencias originales. |
| A | `src/utils/voiceProvider.js` | Contrato desacoplado para el proveedor HTTP existente y futuras implementaciones. No conecta Fish Audio ni incluye claves. |
| B | `api/spherex.js`, `api/lib/archivePlan.js`, `api/lib/irsaCache.js` | QR2/QR3 wide/deep, TIME segmentado, conservación de productos, errores parciales, reintentos, validación CSV/FITS y caché local del servidor. |
| B | `src/utils/archiveClient.js`, `src/utils/sharedFrameLoads.js`, `src/components/SpherexMission.jsx` | Archivo por defecto, progreso por colección, páginas de 24, contadores por nivel, solicitudes compartidas, dos tareas simultáneas y LRU de 20 frames. La clave incluye coordenadas, tamaño, origen, hash local y procesamiento. |
| B/C | `src/data/m101Observations.js`, `src/data/verifiedObservations.js`, `src/data/researchCatalog.js`, `src/data/spherexTargets.js`, `src/components/SpherexMissionSelector.jsx`, `public/demo/m101/` | M101 incorporada tras validar seis recortes; 21 casos clasificados, cuatro con productos locales validados, 11 con cobertura solo en metadatos y seis pendientes. Se conservan los destinos anteriores. |
| C | `src/components/useObservationSamples.js`, `src/components/EvidenceLab.jsx`, `src/components/SpectrumPlot.jsx` | Lotes ampliables de hasta seis, mediciones acumuladas sin límite artificial de 12, selección enlazada con imagen, zoom, incertidumbres, causas de ausencia y exportación de evidencia. Hasta 18 imágenes retenidas por el laboratorio. |
| C | `src/utils/fitsImage.js`, `src/utils/fitsTransport.js`, `src/utils/fitsDecode.js`, `src/workers/fitsWorker.js` | Decodificación/reproyección/calibración fuera del hilo principal; transferencia de arrays; reconstrucción WCS/SIP y WCS-WAVE sin alterar los valores científicos. |
| C | `src/utils/rgbComposite.js`, `src/workers/rgbWorker.js`, `src/utils/scientificEvidence.js` | RGB de tres planos reales compatibles, intervalos de λ por píxel, máscaras, brillo/contraste/normalización visual y comprobaciones de fechas/aperturas. |
| D | `src/scene/astronomicalPositions.js`, `src/scene/navigationScale.js`, `src/scene/originRebase.js` | Cinco contextos; rotación ICRS→galácticas; destinos respecto del Sol; render relativo a cámara con restauración de coordenadas de simulación; Orión solo en vista galáctica. |
| E | `src/scene/destinationVisuals.js`, `src/scene/disposeResources.js` | Geometría compartida, detalle bajo demanda, galaxias con orientación fija y 256 partículas volumétricas, discos/bulbo y limpieza de recursos compartidos una sola vez. |
| E | `src/App.jsx`, `src/styles/evidenceLab.css`, `INICIAR-DEMO.ps1`, `.gitignore`, `package.json`, `LEEME-JUAN.md` | Laboratorio cargado bajo demanda, controles de contexto, arranque con bienvenida, caché excluida y comandos de verificación. |
| Pruebas | `tests/repair-{a,b,c,d,e}.test.mjs`, pruebas de Juan conservadas/actualizadas | Regresiones de vuelo, archivo, worker real, RGB, acumulación, WCS, origen solar, M101, memoria y cancelación. |

`CAMBIOS.md` y `final-audit.json` contienen el inventario comparado con el estado previo. Los scripts `scripts/repair-*.mjs` conservan procedimientos de esta intervención; no son comandos de arranque ni una migración idempotente para volver a ejecutar indiscriminadamente.

## 3. Datos recuperados y verificados en vivo

El 7 de noviembre se consultaron las cuatro colecciones oficiales (QR2, QR3 y ambas deep) mediante el backend local actualizado. Las colecciones son las documentadas por [Caltech/IPAC IRSA](https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/).

| Objetivo | QR2 | QR3 | QR2 deep | QR3 deep | Productos | Exposiciones por obs_id | Pares exposición/detector |
|---|---:|---:|---:|---:|---:|---:|---:|
| Barnard | 252 | 128 | 0 | 0 | **380** | 192 | 380 |
| RW Aurigae | 225 | 112 | 0 | 0 | **337** | 171 | 337 |
| M101, núcleo | 375 | 0 | 0 | 0 | **375** | 190 | 375 |

Ninguna de esas consultas tuvo fallos parciales. El radio solicitado es 0.03°; se conserva el contexto de coordenadas de la consulta y la huella del producto. Son registros con cobertura de esa región, no detecciones confirmadas del objeto ni observaciones independientes en número igual al de productos. Los instantes MJD pueden variar ligeramente entre detectores de una misma exposición; por eso tampoco equivalen automáticamente a épocas independientes. En estas respuestas no hubo duplicados del mismo par exposición/detector; la preservación de versiones se verificó también con respuestas de prueba.

Para Barnard, TIME=61100…61131 recuperó **113 productos**, exactamente los del mismo intervalo en la consulta no segmentada; **0 productos perdidos**. Los resultados y URLs están en `live-verification.json`; los CSV originales de Barnard también se conservan. Los datos del servicio son dinámicos, por lo que una consulta futura puede producir otras cantidades.

Se descargaron recortes pequeños a través de la ruta HTTP real, preservando IMAGE, FLAGS, VARIANCE, ZODI y WCS-WAVE, y omitiendo PSF/EPSF por defecto. Ejemplos comprobados:

| Apertura | λ media (μm) | Brillo medio ± σ (MJy/sr) | Píxeles válidos / en apertura |
|---|---:|---:|---:|
| Barnard D6, radio 12.3″ | 4.61233 | 132.78409 ± 0.73628 | 3/13 |
| RW Aur D1, radio 12.3″ | 0.851925 | 8.13939 ± 0.08840 | 12/13 |
| RW Aur D2, radio 12.3″ | 1.47591 | 12.74011 ± 0.09888 | 10/12 |
| RW Aur D3, radio 12.3″ | 1.93708 | 11.41404 ± 0.09592 | 6/13 |
| M101 D1, radio 24.6″ | 1.10558 | 4.33318 ± 0.07161 | 47/47 |
| M101 D2, radio 24.6″ | 1.61809 | 5.68518 ± 0.07783 | 50/50 |
| M101 D3, radio 24.6″ | 1.68480 | 5.51156 ± 0.08027 | 52/52 |

Los seis detectores de M101 tienen una apertura local válida y hashes conservados. Su coordenada central (210.80227°, +54.34895°) figura como resolución NED en el [manual oficial IRSAViewer](https://irsa.ipac.caltech.edu/onlinehelp/irsaviewer/help.pdf). La distancia aproximada empleada y su clasificación espiral se documentan con [NASA/Hubble](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-101/). El recorte representa el núcleo, no toda la galaxia.

El conjunto local suma **19 FITS auténticos**: Barnard 4, RW Aurigae 6, M31 3 y M101 6. No se descargaron los 1092 productos completos para llenar memoria: la galería conserva su metadato y cada FITS se recupera al inspeccionarlo o procesar su lote.

## 4. Qué significan los análisis

Se mide la media de **brillo superficial IMAGE−ZODI** sobre píxeles nativos dentro de una apertura. La posición estelar usa el movimiento propio de catálogo propagado a la fecha; una selección manual fija usa su coordenada WCS. VARIANCE proporciona σ; se presenta la media de σ como estimación conservadora del error de la media, sin incluir sistemáticos. Se rechazan los píxeles con banderas no informativas, valores no finitos o varianza no positiva. La calibración local proviene de WCS-WAVE, no del número D1–D6 tomado como una λ única.

Un producto aporta una muestra local; no aporta automáticamente un espectro completo. No se interpolan huecos ni se conectan exposiciones como si fueran un cubo. La gráfica muestra puntos/errores cuando existen mediciones y explica la causa si no existen. Una apertura con 3/13 píxeles limpios, como el ejemplo de Barnard, no constituye por sí misma una fotometría completa o una nueva detección independiente.

El RGB utiliza planos reproyectados a una cuadrícula TAN común y comprueba centro, campo, dimensiones y unidades. Los intervalos seleccionan píxeles por su λ calibrada. La composición no integra un cubo espectral; el cuadriculado indica ausencia simultánea de cobertura válida. Las normalizaciones por canal y los estiramientos no lineales alteran las razones visuales; nunca modifican las muestras exportadas. La PSF no se ha homogeneizado.

Continúan disponibles comparación de épocas, sustracción diferencial, cuaderno, exportación y ejercicio sintético de absorción. Se bloquean comparaciones fotométricas cuando falta calibración o las bandas/respuestas no son compatibles. No se atribuyen moléculas ni picos a los datos sin evidencia. Las herramientas oficiales se enlazan desde el laboratorio; no se inventó una API de espectrofotometría. Para fotometría de fuentes con PSF/ajuste de continuo, debe recurrirse a los productos/procedimientos oficiales enlazados por [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html).

La geometría 3D usa tamaños, espesor y color ilustrativos. Los radios/temperaturas/luminosidades estelares sin verificar no se convierten en parámetros medidos; se retiraron constantes visuales de radio que estaban sin usar. No se infiere un volumen único desde un FITS. En RW Aur se conserva la paralaje Gaia incluida de 6.4062 mas (≈156 pc), en vez de forzar 140 pc. El marco de mapa comprime distancias por tramos; no pretende una escala lineal de metros a megapársecs.

Las etiquetas y cifras históricas del catálogo original se conservaron como datos heredados, con su advertencia en la interfaz. Las pruebas de regresión de esas cifras no son una nueva validación observacional de las afirmaciones originales.

## 5. Pruebas ejecutadas

- **Antes:** 114 pruebas de la copia previa aprobadas. El original tenía 98 regresiones, conservadas.
- **Fase A:** 117 pruebas y build correctos. Frenado a 30/60/144 Hz, con y sin inercia; contrato de voz; protección estructural de la cinemática.
- **Fase B:** 121 pruebas y build correctos. Respuestas reales de Barnard, 1250 filas sin recorte, versiones preservadas, CSV, fallos parciales, TIME y señales nuevas por intento.
- **Fase C:** 124 pruebas y build correctos. Un trabajador real de Node ejecuta el módulo del worker FITS; conserva pixels, varianza, máscaras, WCS/SIP y extracción. La prueba React comprueba puntos numéricos, causa de ausencia, 25 muestras acumuladas y 18 frames retenidos. Se conserva el recorrido React sin Internet de inspección→conclusión→cuaderno→cierre/restauración.
- **Fase D:** integración y pruebas de M101/origen/escala; la revisión añadió una prueba de origen solar sin desfase y separación angular ICRS conservada.
- **Fase E y final:** **132/132 pruebas**, 0 fallos, 0 omitidas; `npm run typecheck` y `npm run build` con salida 0. TypeScript cubre los dos archivos TS/TSX declarados por la configuración existente; el JavaScript se compila con Vite y se prueba con Node/React.
- Se mantienen las **39 comparaciones independientes WCS-WAVE con Astropy/WCSLIB** de los productos anteriores. Los nuevos arrays transferidos por el worker se verifican numéricamente; no se presenta esta prueba como una nueva evaluación Astropy de M101.
- HTTP real en servidor nuevo: raíz 200, cuatro colecciones para cada objetivo, siete recortes procesados, consulta mensual sin pérdida y proveedor actual de voz **200 audio/mpeg, 11712 bytes**.
- Limpieza de recursos compartidos verificada por eventos `dispose` de Three; cola con máximo dos tareas y cancelación por suscriptor; RGB reproducible y máscaras de intervalos; proyección invariante con rebasing y restauración aun si falla el render.

Logs finales: `final-tests.txt`, `final-typecheck.txt`, `final-build.txt`. Evidencias HTTP: `live-verification.json`, `voice-http-check.json`. Las pruebas iniciales que detectaron fallos durante la implementación permanecen como registro de trabajo; las salidas finales son las indicadas aquí.

El bundle inicial de aplicación pasó de 545.78 kB en la fase A a **493.30 kB** después de separar el laboratorio, que se descarga al abrirlo. Three permanece en **531.78 kB** y Vite conserva su aviso de tamaño; no se ocultó. Las esferas compartidas de destinos tienen 720 triángulos frente a los 2976 del diseño previo de mayor teselación. Son medidas estructurales/de compilación, **no mediciones de FPS o VRAM**.

## 6. Validaciones pendientes y límites

No se pudo completar el control visual de Windows: la herramienta de uso del ordenador se detuvo porque no pudo determinar con confianza la URL del navegador. Se respetó la interrupción, sin herramientas alternativas de automatización del navegador ni capturas nuevas simuladas.

Por ello, siguen pendientes una ejecución visual completa de introducción/abordaje/reingreso, sensación de frenado y transición entre las cinco escalas, disposición/respuesta del RGB en pantalla, reproducción audible y comportamiento en móvil/lectores de pantalla. Los cambios de esos caminos compilan y tienen pruebas de sus partes, pero **no se declara aprobada su aceptación visual integral**. Tampoco se midieron GPU, VRAM, FPS antes/después ni ausencia absoluta de fugas en una sesión larga de WebGL. El panel de diagnóstico permite tomar 600 fotogramas en el equipo del usuario.

También quedan fuera del alcance terminado: homogeneización PSF, sustracción de fondo local, CWAVE/CBAND, espectros continuos de fuentes con fotometría PSF oficial, detección de moléculas, y radios/luminosidades físicos calibrados para todo el catálogo. El flujo actual los identifica como límites y ofrece evidencia de brillo superficial real. Los 11 casos de cobertura y seis pendientes no se elevan a destinos científicamente validados.

Fish Audio no está conectado: el contrato de proveedor permite implementarlo posteriormente en backend. La voz actual y su alternativa del navegador permanecen; cualquier servicio remoto requiere red. La disponibilidad futura de IRSA/voz no se garantiza a partir de una prueba HTTP puntual.

## 7. Ejecución y revisión

En PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Users\OPPENHEIMER\Desktop\kronox-juan'
# Al extraer en otra máquina o si faltan dependencias:
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abre [Kronox local con bienvenida](http://127.0.0.1:5174/KRONOX/). Pulsa **Iniciar expedición** y deja terminar la entrada antes de usar controles de navegación. La opción **Reingresar a la nave con Cronos** está en la barra de vuelo. Las escalas se eligen en el panel de contexto.

En **Misiones científicas → Evidencia y espectros**, elige Barnard, RW Aurigae o M101. El archivo en vivo es la opción predeterminada. Para una demostración científica sin red, usa **Usar productos locales verificados** o [M101 local](http://127.0.0.1:5174/KRONOX/?data=local&target=m101). En el laboratorio carga lotes, inspecciona una muestra, ajusta el zoom, define canales RGB y registra una conclusión con sus límites.

```powershell
npm.cmd test
npm.cmd run test:repair
npm.cmd run typecheck
npm.cmd run build
```

Node usado: 24.16.0; npm 11.13.0. Se conservaron React 18, Vite 8 y Three 0.128. No se requieren claves de IA ni instalación de Python para ejecutar. La API local utiliza el plugin ya existente de Vite; una publicación estática sin backend no proporciona las consultas en vivo. No se publicó el sitio.

La caché regenerable del servidor está en `.cache/irsa-v2`, con TTL de seis horas para consultas, siete días para recortes y presupuesto de 192 MiB. El botón **Reintentar** solicita actualización. Las descargas cliente se limitan a dos; la LRU guarda 20 frames y el laboratorio hasta 18. El paquete no incluye caché, node_modules, dist, repositorios Git, secretos ni el ZIP anterior. Sí incluye el respaldo previo y las observaciones pequeñas verificadas.

## Corrección posterior del arranque

Se corrigió una regresión real detectada por la pantalla negra: la extracción de coordenadas había retirado accidentalmente la función de etiquetas `lab()`, aunque la escena todavía la llamaba. Se restauró la función original en `src/scene/sceneLabels.js`, importada explícitamente desde `createScene.js`. El original KRONOX-main no se modificó.

También se añadió `BootErrorBoundary` en la entrada React: ante una excepción inicial aparece un mensaje con Reintentar y detalles, en lugar de una raíz vacía. No se ocultan los errores de inicialización.

La prueba `npm run test:startup` reproduce el fallo de la versión anterior y ejecuta la escena completa corregida, 600 fotogramas simulados de la entrada, eventos de Cronos, reingreso con posición conservada, cambios de escala y montaje real de App con su bienvenida. Se usan objetos Three y lógica reales, con renderer, Canvas 2D y reloj de CPU simulados; no es una validación visual de WebGL ni automatización del navegador.

Resultado actualizado: **136 pruebas aprobadas**, TypeScript y build correctos. Los logs vigentes están en `docs/hotfix-startup/`. HTTP real comprobó 200 para raíz, entrada, escena, etiquetas y protección de arranque; se verificó que la versión servida importa el helper restaurado. La prueba visual continúa pendiente porque Computer Use se detuvo al no poder identificar la URL.

El ZIP inicial de esta entrega era anterior a esta corrección. Debe utilizarse **kronox-arranque-corregido.zip**, que incluye los archivos restaurados y estas pruebas.
