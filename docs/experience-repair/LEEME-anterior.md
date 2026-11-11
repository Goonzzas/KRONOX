# Kronox — copia local reparada

Trabajo realizado exclusivamente en `C:\Users\OPPENHEIMER\Desktop\kronox-juan`. El original `C:\Users\OPPENHEIMER\Desktop\KRONOX-main` se conserva sin cambios. No se realizaron operaciones Git ni publicaciones.

Para ejecutar en PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Users\OPPENHEIMER\Desktop\kronox-juan'
# Solo si faltan dependencias:
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abre [Kronox local](http://127.0.0.1:5174/KRONOX/). Pulsa **Iniciar expedición** para conservar la entrada original y Cronos. El puerto 5174 evita confundir este backend con un servidor anterior en 5173. Si ya está iniciado en 5174, utiliza esa instancia; Ctrl+C en su terminal lo detiene. También se incluye `INICIAR-DEMO.ps1`.

Las observaciones consultan IRSA por defecto, con carga progresiva de QR2/QR3 y sus campos profundos. Las páginas de la galería contienen 24 productos, sin limitar el conjunto recuperado. **Usar productos locales verificados** permite trabajar sin conexión con 19 recortes auténticos: Barnard 4, RW Aurigae 6, M31 3 y M101 6. Para elegir esta opción desde el arranque: [M101 con datos locales](http://127.0.0.1:5174/KRONOX/?data=local&target=m101). La entrada y navegación siguen disponibles; el parámetro solo selecciona el conjunto científico.

En **Misiones científicas → Evidencia y espectros** están Barnard, RW Aurigae y M101. Al llegar, abre el observatorio y entra en **Exploración**:

1. Revisa nombre, producto, fecha MJD/UTC, detector, versión y fuente IRSA. El solapamiento de una imagen con las coordenadas no demuestra una detección.
2. Pulsa **Cargar muestras disponibles** repetidamente: cada lote procesa hasta seis productos y conserva las mediciones anteriores. La memoria retiene un máximo de 18 imágenes en el laboratorio; las mediciones numéricas permanecen.
3. Inspecciona una fila o un punto espectral para abrir su imagen. Usa los límites de λ para hacer zoom. Una muestra sin píxeles válidos informa de su causa.
4. En RGB, selecciona tres productos compatibles, define los intervalos de cada canal y ajusta brillo, contraste y normalización. El patrón cuadriculado señala ausencia de datos. Las mediciones físicas no cambian con estos ajustes.
5. Justifica una conclusión y guárdala con evidencia en el cuaderno. La conclusión puede ser **Evidencia insuficiente**. Exporta JSON/CSV y, si corresponde, RGB con su JSON de procedencia.

En la escena, **Reingresar a la nave con Cronos** conserva la ubicación y vuelve al abordaje guiado. Los cinco controles de escala indican el contexto cartográfico. El brazo de Orión aparece únicamente en la vista general de la Vía Láctea. Los modelos 3D son ilustrativos; no son reconstrucciones únicas de las imágenes FITS.

Comprobaciones:

```powershell
npm.cmd test
npm.cmd run test:repair
npm.cmd run typecheck
npm.cmd run build
```

Última verificación: **136 pruebas aprobadas**, TypeScript y compilación correctos. HTTP real: Barnard 380 productos (252 QR2 + 128 QR3), RW Aurigae 337 (225 + 112), M101 375 QR2 y 0 QR3 en la consulta registrada. Las cuatro colecciones se consultaron sin fallos parciales; sus resultados pueden cambiar. Son productos de archivo, no 380/337/375 detecciones ni espectros completos.

La validación visual de la cinemática, los controles, el RGB y la reproducción audible, así como FPS/VRAM en GPU, sigue pendiente: el control del navegador se detuvo al no poder determinar su URL. No se eludió ese bloqueo. El proveedor actual sí entregó audio por HTTP; Fish Audio queda preparado mediante un adaptador, sin credenciales ni sustitución del proveedor actual.

Consulta `docs/repair-2026-11-07/INFORME.md` para diagnóstico, archivos, evidencias, límites y comprobaciones pendientes. `docs/juan/LEEME-primera-entrega.md` conserva las instrucciones anteriores como registro histórico.

## Corrección posterior del arranque

Se corrigió una regresión real detectada por la pantalla negra: la extracción de coordenadas había retirado accidentalmente la función de etiquetas `lab()`, aunque la escena todavía la llamaba. Se restauró la función original en `src/scene/sceneLabels.js`, importada explícitamente desde `createScene.js`. El original KRONOX-main no se modificó.

También se añadió `BootErrorBoundary` en la entrada React: ante una excepción inicial aparece un mensaje con Reintentar y detalles, en lugar de una raíz vacía. No se ocultan los errores de inicialización.

La prueba `npm run test:startup` reproduce el fallo de la versión anterior y ejecuta la escena completa corregida, 600 fotogramas simulados de la entrada, eventos de Cronos, reingreso con posición conservada, cambios de escala y montaje real de App con su bienvenida. Se usan objetos Three y lógica reales, con renderer, Canvas 2D y reloj de CPU simulados; no es una validación visual de WebGL ni automatización del navegador.

Resultado actualizado: **136 pruebas aprobadas**, TypeScript y build correctos. Los logs vigentes están en `docs/hotfix-startup/`. HTTP real comprobó 200 para raíz, entrada, escena, etiquetas y protección de arranque; se verificó que la versión servida importa el helper restaurado. La prueba visual continúa pendiente porque Computer Use se detuvo al no poder identificar la URL.

El ZIP inicial de esta entrega era anterior a esta corrección. Debe utilizarse **kronox-arranque-corregido.zip**, que incluye los archivos restaurados y estas pruebas.
