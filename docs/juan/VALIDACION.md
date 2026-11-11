# Validación y procedencia

## Alcance

Fecha: 7 de noviembre de 2026. Se trabajó solo en `Desktop/kronox-juan`, fuera de Git. `source-baseline.json` registra el original antes de editar; `source-integrity.json` comprueba sus hashes al terminar.

Los 98 tests originales, typecheck y build pasaron antes de editar. Al finalizar pasan 114 tests: 16 nuevos, además de las regresiones heredadas. Se adaptaron supuestos de «exactamente cinco objetos / dos categorías / todos con movimiento propio» para permitir galaxias y catálogo ampliado; se conservaron los chequeos originales de las cinco estrellas. Las tablas/cifras heredadas de diagnóstico no se reetiquetaron como nuevas detecciones científicas.

## Datos reales

- Barnard: consulta QR2 con 241 filas; 4 recortes locales. Con máscara estricta y centro propagado, D6 conserva 3/13 píxeles en radio 12.3″ y una muestra a ~4.6123 μm. Los otros recortes pueden servir de contexto pero no tienen píxeles válidos en esa apertura. No se rellenan esos huecos.
- M31: respuesta QR2 conservada con 300 filas (limitada a MAXREC=300); 3 recortes locales utilizables. En apertura de radio 24.6″, D1 aporta 35/50 píxeles, D5 52/52 y D6 52/52. El recorte no representa toda la galaxia.
- RW Aurigae: consulta QR2 con 224 filas; 6 recortes locales. Cinco aportan una medición válida en la apertura de 12.3″; D4 está ausente en esa apertura con el criterio estricto.

Los números exactos de brillo, incertidumbre y calidad están en `real-measurements.json`; son medias IMAGE−ZODI de una apertura, no flujos integrados, detecciones moleculares ni estimaciones independientes de variabilidad.

Cada producto tiene URL de archivo, URL del recorte, versión en el nombre, fecha, tamaño, hash SHA-256 original y hash de la versión local. Se omite la extensión pesada PSF/EPSF al preparar la copia local, usando el extractor del proyecto; esa transformación se registra. IMAGE/FLAGS/VARIANCE/ZODI/WCS-WAVE se conservan. Los FITS públicos locales ocupan, con manifiesto, aproximadamente 1.5 MB. El adaptador en vivo puede solicitar PSF con su opción existente, pero el laboratorio no aplica fotometría de PSF ni homogeneización.

Las búsquedas adicionales de 11 destinos devolvieron 200 filas cada una con MAXREC=200: son resultados limitados y solo verifican cobertura de archivo QR2. No verifican píxeles de la fuente ni disponibilidad completa QR3. Las seis entradas sin coordenadas/productos comprobados permanecen pendientes en el catálogo.

## Comprobaciones ejecutadas

- Flujo React del observatorio: objetivo M31, vista de observación real, carga de tres FITS M31, selección de medición, justificación, guardado, cierre condicionado y restauración del cuaderno. Peticiones externas bloqueadas; no se simulan los datos.
- Flujo del núcleo para las tres misiones con FITS reales y guard de Internet desactivado.
- Respuestas HTTP reales del servidor local: HTML inicial, los 13 FITS con hashes idénticos y error 400 para coordenadas inválidas.
- WCS/WCS-WAVE: 39 posiciones comparadas con Astropy/WCSLIB, tolerancia espectral <0.0001 μm (redondeo de salida) y espacial <1e-7 grados. Esto comprueba la implementación, no convierte WCS-WAVE en CWAVE/CBAND de ciencia de precisión.
- Calidad, varianzas, ausencia de cobertura, RGB reproducible, cuadros de ausencia, separación de fecha y longitud de onda.
- Reintento backend con señal nueva por intento; consulta QR2/QR3 parcial; tiempo máximo frontend; respuesta inválida y fallo de red.
- Fondo diferencial independiente por imagen, invariancia ante desplazamiento común de intensidad y conservación de pares residuo/σ.
- Constructor Three.js: superficies diferidas, geometría compartida, halo con mapa circular, ausencia de Points en los destinos nuevos y liberación de recursos.
- Cronos: ausencia de espectro, ejes/unidades, muestra seleccionada con incertidumbre y ejercicio sintético; contexto de otro objetivo rechazado.
- `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test`.

## Rendimiento

`performance.json` contiene un microbenchmark CPU con el mismo FITS M31/D5, centro, FOV 0.5° y salida 300×300, cinco repeticiones tras calentamiento. Mediana original 63.36 ms; copia 70.21 ms. No se presenta como mejora ni como FPS. A 96×96 la copia midió 9.66 ms, con resolución distinta y sin reducir la extracción científica nativa.

La esfera de una estrella pasa de 2976 a 720 triángulos; las superficies se crean al acercarse y comparten geometría. Son verificaciones estructurales. La aplicación incluye captura optativa de 600 tiempos de fotograma y contadores del renderer para la comparación GPU pendiente.

## Verificación visual pendiente

La automatización Windows se detuvo antes de poder identificar con confianza la URL del navegador. No se volvió a usar para eludir esa restricción. No se completó el recorrido visual antes/después ni la medición de FPS de la escena. No hay capturas nuevas que acrediten esa parte; las imágenes de `docs/demo-evidence/` son heredadas del original.

La verificación offline ejecutada es del núcleo y de componentes React con bloqueo de solicitudes externas. No se apagó la conexión física del equipo ni se certificó una demo completa de navegador con Wi-Fi desconectado. Tampoco se hizo una auditoría WCAG o ensayo con lector de pantalla. Las pruebas de componentes no sustituyen esas comprobaciones.

## Fuentes

- [Acceso oficial SPHEREx: SIA2 y recortes](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/).
- [Productos oficiales y calibración WCS-WAVE](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/).
- [M31: NASA/Hubble](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/): galaxia espiral, distancia de 2.5 millones de años luz e inclinación aparente orientativa de 77°. Espesor, paleta y perspectiva 3D siguen siendo ilustrativos.
- [NASA/Webb: química del hielo preestelar](https://science.nasa.gov/missions/webb/webb-unveils-dark-side-of-pre-stellar-ice-chemistry/): referencia conceptual del ejercicio sintético, no observaciones de estos destinos.
- [Astropy WCS](https://docs.astropy.org/en/stable/wcs/): comprobación independiente con WCSLIB; referencia numérica incluida.
- Coordenadas/astrometría de estrellas y galaxias adicionales: se reutilizaron `spherexTargets.js` y `nearbyGalaxies.js`, con sus identificadores Gaia/CatWISE/NED y referencias. No se afirma una recalibración independiente de esos catálogos. Las distancias nuevas se omiten salvo M31, que tiene fuente explícita.

Se conservan las respuestas CSV oficiales en `docs/juan/archive/`, el manifiesto en `public/demo/manifest.json` y el catálogo con estado por objeto en `docs/juan/catalog.json`. El intento de resolución CDS no respondió; los casos sin coordenadas corroboradas permanecen pendientes.
