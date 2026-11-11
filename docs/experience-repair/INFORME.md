# Reparación de la experiencia de Kronox · 7 de noviembre de 2026

## Cambios comprobados

- El observatorio dejó de repartir altura entre imágenes, gráficas y archivo dentro de contenedores que se encogían. Ahora reserva altura al visor y utiliza un área de contenido desplazable. Cabecera, origen y etapas permanecen accesibles. Las comparaciones se apilan en pantallas estrechas.
- Una galería de imágenes reales sustituye la dependencia de dos paneles A/B para explorar cientos de productos. Incluye nueve tarjetas por página, recorrido cronológico distribuido, todas las exposiciones/detectores, versiones, filtros y reintentos. No se limita el conjunto recuperado.
- La selección inicial usa pares de referencia verificados. Se incorporaron 114 recortes temporales auténticos y se deduplicaron URLs con los productos anteriores: 131 productos locales distintos. El manifiesto temporal conserva URL de recorte, hash original/local, bytes, extensiones omitidas, fecha y medición. Los fallos IRSA y aperturas sin píxeles permanecen registrados.
- Separación y λ se verifican independientemente. Un par de 253 días de Barnard con solo dos píxeles válidos por imagen se descartó como selección predeterminada; se usa el par de 217 días con 8 y 10 píxeles válidos. La cobertura parcial se advierte. El filtro de seis píxeles/50% es una regla exploratoria de esta aplicación, no una validación científica de variabilidad.
- La etapa espectral se abre después de las imágenes. La carga inicial procesa hasta 12 productos equilibrando detectores y extremos de fechas, evitando que el gráfico dependa de un solo archivo. La extracción continúa sobre píxeles nativos, IMAGE−ZODI, máscaras, varianza y WCS-WAVE. La unidad distingue MJy de mJy; dos representaciones de la misma fecha numérica no se aceptan como dos épocas.
- Dos atlas independientes añaden 80 sistemas de 0–10 pc y 56 de 10–300 pc, además del Sol. Se conservan coordenadas, distancia, época y movimiento propio cuando están documentados. Los planetas confirmados se indican solo cuando existen en la consulta NASA; no se inventan sus órbitas.
- El atlas extragaláctico contiene 11 galaxias y anotaciones de grupos. Usa dirección ICRS y radio logarítmico; limita los radios de símbolos según la separación entre vecinos y busca una cámara con menos solapamiento proyectado. Las etiquetas se colocan evitando paneles y otras etiquetas; el catálogo lateral conserva todos los nombres y distancias.
- Las galaxias esferoidales/elípticas se representan mediante un volumen elipsoidal, las irregulares mediante agregados y las espirales mediante disco/brazos. Se comparte el constructor con los destinos del vuelo, conservando detalle diferido y el presupuesto de 256 partículas del destino cercano. No son inversiones de las imágenes FITS.
- Las etiquetas tienen tamaño fijo en píxeles, independiente del tamaño anterior del mapa y de la distancia de cámara. Se ocultan durante el viaje. Un panel plegable concentra escalas y navegación. La ficha de Sagitario identifica una galaxia y su distancia; las estrellas de catálogo no ofrecen un viaje planetario a un destino indefinido.
- Se cancela el aviso pendiente del destino anterior al cambiar de objeto/escala. Al fallar una descarga se limpia la imagen activa y se presenta el error, evitando que una exposición anterior parezca el producto nuevo.
- Vite recarga los módulos del backend de desarrollo: las dos instancias locales responden ahora con páginas progresivas, en vez de retener un handler anterior en memoria.

## Evidencias

145 pruebas pasan (full-tests.txt); typecheck y build terminan correctamente. Las pruebas usan datos FITS reales y mediciones reproducibles; las de escena usan objetos Three reales con renderer/Canvas/reloj simulados. No se midió GPU, FPS ni VRAM. El control visual de Edge se detuvo porque Computer Use no pudo verificar su URL, sin automatización alternativa.

La comprobación HTTP real verificó 5173 y 5174: página 1/4, cursor siguiente, sin fallo parcial. Los recuentos de ese momento son dependientes de la consulta y pueden variar. El nuevo paquete incluye los fuentes, datos y respaldos; las dependencias y compilaciones se regeneran.

129 archivos del original conservan sus hashes. Respaldo previo de esta fase: 76 archivos; SHA-256 y cambios en integrity.json. No hay .git en la copia o sus ancestros. No hubo commits, push ni despliegue.

## Fuentes y atribución

- [CNS5 en GAVO · Golovin et al. (2023), CC BY 4.0](https://dc.g-vo.org/cns5/q/cone/info). Se utilizaron posiciones, paralajes, épocas y movimientos propios de una selección cercana. Los JSON de consulta y el script de integración están incluidos; no se presenta como catálogo completo.
- [NASA Exoplanet Archive · TAP](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html). Sistemas con planetas confirmados; se conservaron distancias, temperatura y radio disponibles. Las posiciones sin época informada no recibieron una época inventada.
- [IRSA · SPHEREx, funcionamiento del archivo y detector LVF](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html). Compartir detector no garantiza compartir la misma λ local.
- [IRSA · herramientas espectrofotométricas](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html). La extracción local aquí documentada es una media exploratoria de brillo superficial; no es flujo integrado ni un espectro continuo calibrado.
- Cada galaxia conserva sus referencias NASA/NED en src/data/nearbyGalaxies.js. Cada recorte conserva su URL oficial en temporal-verification.json.

## Comprobación visual pendiente en el equipo

Recargar con Ctrl+F5, recorrer los cinco contextos, comprobar etiquetas y separación al girar, abrir la galería en 1366×768/1920×1080 y una ventana estrecha, comparar las épocas de referencia y revisar el desplazamiento de todo el análisis. Comprobar audio y rendimiento en el navegador/GPU real. Los resultados numéricos y de integración no sustituyen esta revisión.
