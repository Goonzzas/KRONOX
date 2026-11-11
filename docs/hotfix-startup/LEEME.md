# Corrección de la pantalla negra

## Corrección posterior del arranque

Se corrigió una regresión real detectada por la pantalla negra: la extracción de coordenadas había retirado accidentalmente la función de etiquetas `lab()`, aunque la escena todavía la llamaba. Se restauró la función original en `src/scene/sceneLabels.js`, importada explícitamente desde `createScene.js`. El original KRONOX-main no se modificó.

También se añadió `BootErrorBoundary` en la entrada React: ante una excepción inicial aparece un mensaje con Reintentar y detalles, en lugar de una raíz vacía. No se ocultan los errores de inicialización.

La prueba `npm run test:startup` reproduce el fallo de la versión anterior y ejecuta la escena completa corregida, 600 fotogramas simulados de la entrada, eventos de Cronos, reingreso con posición conservada, cambios de escala y montaje real de App con su bienvenida. Se usan objetos Three y lógica reales, con renderer, Canvas 2D y reloj de CPU simulados; no es una validación visual de WebGL ni automatización del navegador.

Resultado actualizado: **136 pruebas aprobadas**, TypeScript y build correctos. Los logs vigentes están en `docs/hotfix-startup/`. HTTP real comprobó 200 para raíz, entrada, escena, etiquetas y protección de arranque; se verificó que la versión servida importa el helper restaurado. La prueba visual continúa pendiente porque Computer Use se detuvo al no poder identificar la URL.

El ZIP inicial de esta entrega era anterior a esta corrección. Debe utilizarse **kronox-arranque-corregido.zip**, que incluye los archivos restaurados y estas pruebas.

Recarga http://127.0.0.1:5174/KRONOX/ con Ctrl+F5. El servidor ya entrega el helper corregido.
