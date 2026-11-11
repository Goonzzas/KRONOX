# Corrección del bloqueo de carga de Kronox

El mensaje «Cargando Observatorio KRONOX...» provenía del HTML inicial. React todavía no había arrancado: no era una consulta a IRSA ni una carga de FITS.

Se reprodujo el fallo en 5173 y 5174. main.jsx referenciaba react-dom_client.js en la caché optimizada compartida, pero el archivo ya no estaba disponible: devolvía 404 sin versión y 504 con el hash de la entrada. Los dos servidores y los servidores temporales de las pruebas compartían node_modules/.vite; las pruebas podían reemplazar su manifiesto por uno que solo contenía React y sus runtimes. Las comprobaciones HTTP anteriores no recorrían las dependencias; por eso no lo detectaron.

Se aisló la caché de Vite por proceso, separando runtime y pruebas en .cache/vite. Se declararon las dependencias iniciales para estabilizar la primera carga. Los servidores activos recargaron esta configuración.

El HTML ahora muestra «Iniciando Kronox» y arranca mediante bootstrap.js, sin imports estáticos de React. Un fallo de descarga se presenta con su causa y un botón Volver a cargar. Si no termina en 12 segundos, se muestra un error en lugar de mantener el indicador indefinidamente. El guardia se desactiva al cargar correctamente; BootErrorBoundary conserva el manejo de errores posteriores de React/escena.

## Verificación vigente

- 148 pruebas aprobadas, incluidos fallo previo a React, tiempo máximo y cachés de procesos independientes.
- Después de las pruebas, se descargaron y enlazaron los 74 módulos del cliente en cada puerto, resolviendo imports y exports reales. Esto comprueba dependencias además del HTTP de main.jsx. No ejecuta un navegador ni sustituye una revisión visual de WebGL.
- TypeScript y build correctos. El build conserva su advertencia sobre paquetes mayores de 500 kB.
- Los 129 hashes del original KRONOX-main permanecen intactos. Sin operaciones Git ni despliegue.

## Abrir la versión actual

Abre [Kronox actualizado](http://127.0.0.1:5174/KRONOX/?welcome=false&voice=false&inicio=2) y pulsa Ctrl+F5 si la pestaña conserva la pantalla anterior. 5173 también sirve los módulos corregidos. No hace falta reinstalar las dependencias.

Entrega vigente: kronox-arranque-estable.zip. Conserva las mejoras del observatorio y del atlas. Logs: full-tests.txt, typecheck.txt, build.txt, before-http.json y client-modules.json en este directorio. Respaldo anterior: before.json.gz.
