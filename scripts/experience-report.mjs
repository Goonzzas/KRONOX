import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';import {SPHEREX_TARGETS} from '../src/data/spherexTargets.js';import {TEMPORAL_OBSERVATIONS} from '../src/data/temporalObservationsData.js';import {contextCatalog} from '../src/scene/navigationAtlas.js';import {NEARBY_GALAXIES} from '../src/data/nearbyGalaxies.js';
const root=process.cwd(),expected=String.raw`C:\Users\OPPENHEIMER\Desktop\kronox-juan`;if(path.resolve(root)!==path.resolve(expected))throw Error('Wrong root');const out='docs/experience-repair',hash=b=>crypto.createHash('sha256').update(b).digest('hex'),sha=f=>hash(fs.readFileSync(f));
const baseline=JSON.parse(fs.readFileSync('docs/juan/source-baseline.json','utf8').replace(/^\uFEFF/,'')),originalChanges=baseline.files.filter(f=>!fs.existsSync(path.join(baseline.source,f.file))||sha(path.join(baseline.source,f.file))!==f.sha256).map(f=>f.file);
const previous=JSON.parse(zlib.gunzipSync(fs.readFileSync('backups/pre-experience-1794087694785.json.gz'))),before=new Map(previous.map(f=>[f.path,f.sha256])),current=new Map();function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=(dir+'/'+entry.name).replaceAll('\\','/');if(entry.isDirectory())walk(file);else if(entry.isFile())current.set(file,sha(file));}}for(const dir of ['src','api','tests'])walk(dir);for(const f of ['vite.config.js','package.json','package-lock.json','LEEME-JUAN.md','INICIAR-DEMO.ps1'])current.set(f,sha(f));
const changes=[...current].filter(([p,h])=>before.get(p)!==h).map(([p,h])=>({path:p,status:before.has(p)?'modified':'added',beforeSha256:before.get(p)||null,afterSha256:h}));const removed=[...before.keys()].filter(f=>!fs.existsSync(f));
const local=SPHEREX_TARGETS.filter(t=>t.localRecords.length).map(t=>({key:t.key,name:t.name,products:t.localRecords.length,records:t.localRecords}));let verified=0;for(const t of local)for(const r of t.records){const f='public/demo/'+r.localFile;if(sha(f)!==r.localSha256)throw Error('Local FITS hash mismatch '+f);verified++;}
const gitPaths=[];for(let d=root;;d=path.dirname(d)){if(fs.existsSync(path.join(d,'.git')))gitPaths.push(path.join(d,'.git'));if(path.dirname(d)===d)break;}
const date=m=>new Date((Number(m)-40587)*86400000).toISOString().slice(0,10),pairs=TEMPORAL_OBSERVATIONS.targets.map(t=>({key:t.key,days:t.bestPair.days,dates:t.bestPair.measurements.map(m=>date(m.date)).sort(),band:t.bestPair.band,valid:t.bestPair.measurements.map(m=>m.valid),total:t.bestPair.measurements.map(m=>m.total)}));
const report={checkedAt:new Date().toISOString(),originalFilesChecked:baseline.files.length,originalUnchanged:!originalChanges.length,originalChanges,backup:{file:'backups/pre-experience-1794087694785.json.gz',files:previous.length,sha256:sha('backups/pre-experience-1794087694785.json.gz')},gitPaths,changes,removed,localProductsVerified:verified,targets:local.map(({records,...t})=>t),pairs,stellarSystems:contextCatalog('stellar',SPHEREX_TARGETS).length,regionalSystems:contextCatalog('regional',SPHEREX_TARGETS).length,galaxies:NEARBY_GALAXIES.filter(t=>t.kind!=='group').length};fs.writeFileSync(out+'/integrity.json',JSON.stringify(report,null,2));if(originalChanges.length||removed.length||gitPaths.length)throw Error('Integrity failed');
const previousReadme=out+'/LEEME-anterior.md';if(!fs.existsSync(previousReadme))fs.copyFileSync('LEEME-JUAN.md',previousReadme);
const instructions=`# Kronox · visor, navegación y observación temporal corregidos

Trabaja con esta copia local: C:\\Users\\OPPENHEIMER\\Desktop\\kronox-juan. El original KRONOX-main permanece intacto. No se hicieron operaciones Git, publicaciones ni despliegues.

## Ejecutar

En PowerShell, dentro de la copia: \\npm.cmd ci\\ si faltan dependencias, y \\npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort\\. También puedes ejecutar INICIAR-DEMO.ps1. Si el servidor ya está activo, usa esa instancia.

Abre [Kronox](http://127.0.0.1:5174/KRONOX/) y recarga con Ctrl+F5 para descartar la interfaz anterior. Se conserva la entrada original con Cronos. Las instancias locales 5173 y 5174 se comprobaron con el backend progresivo actual; el informe HTTP registra su respuesta.

## Probar los cambios

1. Abre **Mapa y navegación**. Cambia entre **Vecindario estelar**, **Región galáctica**, **Vía Láctea** y **Entorno extragaláctico**. Los mapas locales/regionales contienen ${report.stellarSystems} y ${report.regionalSystems} sistemas respectivamente, además del Sol. Sus listas permiten centrarlos; cada nombre incluye distancia. El conjunto es una selección de catálogo, no un censo completo.
2. En el entorno extragaláctico, elige una galaxia por su nombre o marcador. Sus símbolos tienen radios comprimidos y distancias radiales logarítmicas; las direcciones de catálogo se conservan. Los grupos son anotaciones y no una segunda copia de sus galaxias. Puedes volver a la vista solar o reingresar a la nave.
3. Pulsa **Abrir observatorio SPHEREx** o elige una misión. Primero están **Imágenes** y **Comparar épocas**; después, **Análisis espectral**. El visor ocupa casi toda la ventana y su contenido tiene desplazamiento vertical.
4. La galería muestra hasta nueve imágenes por página. **Organizar** permite elegir recorrido de fechas, todas las exposiciones/detectores o todas las versiones. Usa los filtros de año y detector; cada tarjeta permite abrir la imagen. El índice detallado conserva los identificadores completos.
5. En **Comparar épocas**, selecciona A y B individualmente, exige una separación mínima o busca un par con apertura y longitud de onda compatibles. El selector de fecha más separada por sí solo no valida la calidad. La búsqueda tiene progreso y cancelación. Los pares de referencia locales son:

| Objetivo | Detector | Fechas UTC | Separación |
|---|---|---|---|
${pairs.map(p=>'| '+local.find(t=>t.key===p.key).name+' | '+p.band+' | '+p.dates.join(' → ')+' | '+p.days.toFixed(1)+' días |').join('\n')}

6. En **Análisis espectral**, el primer lote extrae hasta 12 productos distribuidos por detector y fecha. Los siguientes lotes añaden hasta seis; las mediciones se conservan y las imágenes retenidas están limitadas a 18. Inspecciona la tabla o un punto, vuelve al visor, justifica tu conclusión y guarda/exporta el cuaderno. Los datos ausentes conservan su motivo; no se rellenan bandas ni se conectan puntos como un espectro continuo.

## Sin conexión

En **Origen de datos y opciones de consulta**, pulsa **Usar productos locales verificados**. Hay ${verified} productos distintos con hash y procedencia: ${local.map(t=>t.name+' '+t.products).join('; ')}. Son recortes auténticos de IRSA, no todo el archivo. Puedes iniciar con [RW Aurigae local](http://127.0.0.1:5174/KRONOX/?data=local&target=rw-aurigae), abrir el observatorio y seleccionar las etapas indicadas. El parámetro selecciona los datos; conserva la experiencia de entrada.

## Límites y verificación

Las diferencias entre fechas no demuestran variabilidad por sí solas. El filtro temporal exploratorio exige al menos seis píxeles válidos y el 50% de la apertura en ambas imágenes, además de detector y λ compatibles. No sustituye una extracción con PSF común y control de fondo/calibración; Barnard tiene cobertura parcial y se advierte en pantalla. En meses o un año no se espera ver cambiar la estructura completa de una galaxia. Los modelos 3D son ilustrativos.

**145 pruebas aprobadas**, TypeScript y build correctos. Las pruebas incluyen FITS reales, recorrido React sin Internet, fallo de una exposición sin reutilización de otra, arranque completo de la escena, etiquetas limitadas en píxeles, mapas y reingreso con posición conservada. El renderer y Canvas de las pruebas de escena son simulados: no son una medición de GPU ni una validación visual del navegador. Computer Use se detuvo al no poder determinar con seguridad la URL de Edge; esa revisión sigue pendiente. Build advierte de paquetes mayores de 500 kB.

Logs vigentes: docs/experience-repair/full-tests.txt, typecheck.txt, build.txt, server-verification.json e integrity.json. Informe: docs/experience-repair/INFORME.md. Entrega vigente: **kronox-experiencia-corregida.zip**. Las entregas anteriores se conservan como historial.
`;
fs.writeFileSync('LEEME-JUAN.md',instructions.replaceAll('\\npm','`npm').replaceAll('\\ si','` si').replaceAll('\\. También','`. También'));
const details=`# Reparación de la experiencia de Kronox · 7 de noviembre de 2026

## Cambios comprobados

- El observatorio dejó de repartir altura entre imágenes, gráficas y archivo dentro de contenedores que se encogían. Ahora reserva altura al visor y utiliza un área de contenido desplazable. Cabecera, origen y etapas permanecen accesibles. Las comparaciones se apilan en pantallas estrechas.
- Una galería de imágenes reales sustituye la dependencia de dos paneles A/B para explorar cientos de productos. Incluye nueve tarjetas por página, recorrido cronológico distribuido, todas las exposiciones/detectores, versiones, filtros y reintentos. No se limita el conjunto recuperado.
- La selección inicial usa pares de referencia verificados. Se incorporaron 114 recortes temporales auténticos y se deduplicaron URLs con los productos anteriores: ${verified} productos locales distintos. El manifiesto temporal conserva URL de recorte, hash original/local, bytes, extensiones omitidas, fecha y medición. Los fallos IRSA y aperturas sin píxeles permanecen registrados.
- Separación y λ se verifican independientemente. Un par de 253 días de Barnard con solo dos píxeles válidos por imagen se descartó como selección predeterminada; se usa el par de 217 días con 8 y 10 píxeles válidos. La cobertura parcial se advierte. El filtro de seis píxeles/50% es una regla exploratoria de esta aplicación, no una validación científica de variabilidad.
- La etapa espectral se abre después de las imágenes. La carga inicial procesa hasta 12 productos equilibrando detectores y extremos de fechas, evitando que el gráfico dependa de un solo archivo. La extracción continúa sobre píxeles nativos, IMAGE−ZODI, máscaras, varianza y WCS-WAVE. La unidad distingue MJy de mJy; dos representaciones de la misma fecha numérica no se aceptan como dos épocas.
- Dos atlas independientes añaden ${report.stellarSystems} sistemas de 0–10 pc y ${report.regionalSystems} de 10–300 pc, además del Sol. Se conservan coordenadas, distancia, época y movimiento propio cuando están documentados. Los planetas confirmados se indican solo cuando existen en la consulta NASA; no se inventan sus órbitas.
- El atlas extragaláctico contiene ${report.galaxies} galaxias y anotaciones de grupos. Usa dirección ICRS y radio logarítmico; limita los radios de símbolos según la separación entre vecinos y busca una cámara con menos solapamiento proyectado. Las etiquetas se colocan evitando paneles y otras etiquetas; el catálogo lateral conserva todos los nombres y distancias.
- Las galaxias esferoidales/elípticas se representan mediante un volumen elipsoidal, las irregulares mediante agregados y las espirales mediante disco/brazos. Se comparte el constructor con los destinos del vuelo, conservando detalle diferido y el presupuesto de 256 partículas del destino cercano. No son inversiones de las imágenes FITS.
- Las etiquetas tienen tamaño fijo en píxeles, independiente del tamaño anterior del mapa y de la distancia de cámara. Se ocultan durante el viaje. Un panel plegable concentra escalas y navegación. La ficha de Sagitario identifica una galaxia y su distancia; las estrellas de catálogo no ofrecen un viaje planetario a un destino indefinido.
- Se cancela el aviso pendiente del destino anterior al cambiar de objeto/escala. Al fallar una descarga se limpia la imagen activa y se presenta el error, evitando que una exposición anterior parezca el producto nuevo.
- Vite recarga los módulos del backend de desarrollo: las dos instancias locales responden ahora con páginas progresivas, en vez de retener un handler anterior en memoria.

## Evidencias

145 pruebas pasan (full-tests.txt); typecheck y build terminan correctamente. Las pruebas usan datos FITS reales y mediciones reproducibles; las de escena usan objetos Three reales con renderer/Canvas/reloj simulados. No se midió GPU, FPS ni VRAM. El control visual de Edge se detuvo porque Computer Use no pudo verificar su URL, sin automatización alternativa.

La comprobación HTTP real verificó 5173 y 5174: página 1/4, cursor siguiente, sin fallo parcial. Los recuentos de ese momento son dependientes de la consulta y pueden variar. El nuevo paquete incluye los fuentes, datos y respaldos; las dependencias y compilaciones se regeneran.

${baseline.files.length} archivos del original conservan sus hashes. Respaldo previo de esta fase: ${previous.length} archivos; SHA-256 y cambios en integrity.json. No hay .git en la copia o sus ancestros. No hubo commits, push ni despliegue.

## Fuentes y atribución

- [CNS5 en GAVO · Golovin et al. (2023), CC BY 4.0](https://dc.g-vo.org/cns5/q/cone/info). Se utilizaron posiciones, paralajes, épocas y movimientos propios de una selección cercana. Los JSON de consulta y el script de integración están incluidos; no se presenta como catálogo completo.
- [NASA Exoplanet Archive · TAP](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html). Sistemas con planetas confirmados; se conservaron distancias, temperatura y radio disponibles. Las posiciones sin época informada no recibieron una época inventada.
- [IRSA · SPHEREx, funcionamiento del archivo y detector LVF](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html). Compartir detector no garantiza compartir la misma λ local.
- [IRSA · herramientas espectrofotométricas](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html). La extracción local aquí documentada es una media exploratoria de brillo superficial; no es flujo integrado ni un espectro continuo calibrado.
- Cada galaxia conserva sus referencias NASA/NED en src/data/nearbyGalaxies.js. Cada recorte conserva su URL oficial en temporal-verification.json.

## Comprobación visual pendiente en el equipo

Recargar con Ctrl+F5, recorrer los cinco contextos, comprobar etiquetas y separación al girar, abrir la galería en 1366×768/1920×1080 y una ventana estrecha, comparar las épocas de referencia y revisar el desplazamiento de todo el análisis. Comprobar audio y rendimiento en el navegador/GPU real. Los resultados numéricos y de integración no sustituyen esta revisión.
`;
fs.writeFileSync(out+'/INFORME.md',details);console.log(JSON.stringify({originalUnchanged:report.originalUnchanged,originalFiles:baseline.files.length,backupFiles:previous.length,localProducts:verified,changes:changes.length,removed:removed.length,stellar:report.stellarSystems,regional:report.regionalSystems,pairs}));
