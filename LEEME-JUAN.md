# Actualización de voz y continuidad · 10 de noviembre de 2026

Entrega vigente: **kronox-audio-continuidad-2026-11-10.zip**. Fish Audio ya responde con la voz solicitada usando s2.1-pro-free. La música acompaña toda la cinemática y termina al finalizar u omitirla. Se conservan las escenas y modelos de Gemini. Abre http://127.0.0.1:5174/KRONOX/ y pulsa el botón de activar audio si el navegador lo solicita.

La clave de API está en .env.local, solo en la copia local, y no se incluye en el ZIP. Si editas ese archivo, reinicia el proceso del servidor. .env.example muestra los nombres de las variables.

Pruebas vigentes: **169 aprobadas**, tipos y build correctos. La revisión visual final se detuvo al pulsar Escape. Informe y respaldo: docs/audio-continuity-2026-11-10/.

---

## Historial de la entrega anterior

# Kronox · navegación cinematográfica

La copia actual está en C:\Users\OPPENHEIMER\Desktop\kronox-juan. La entrega anterior es **kronox-cinematica-inicio-automatico.zip**. Conserva las reparaciones anteriores de arranque, atlas y observación científica.

## Ejecutar

En esta carpeta, ejecuta **npm.cmd ci** si faltan dependencias y después **npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort**. También puedes usar INICIAR-DEMO.ps1. Si ya hay una instancia de esta copia en 5174, utiliza esa instancia.

Abre http://127.0.0.1:5174/KRONOX/. La introducción comienza automáticamente en cada carga y termina dentro de la cabina. También se reproduce con ?welcome=false&voice=false: esos parámetros ocultan el menú y silencian la voz, pero conservan la cinemática. Puedes pulsar **Omitir introducción** o repetirla desde **Mapa y navegación → Reproducir introducción**. El menú previo sigue accesible con ?welcome=true; para omitir expresamente la secuencia y entrar a cabina utiliza ?intro=false. Los enlaces directos al observatorio conservan su acceso directo.

## Recorrido

1. Reproduce la introducción. El prólogo original de Astral Sentinels y KRONOX continúa con el despegue, la aproximación y la entrada a la cabina existente, seguida de Cronos. **Omitir introducción** entrega el control directamente. Con movimiento reducido, el prólogo estático dura 2,5 s y conduce a la cabina.
2. Abre **Mapa y navegación → Elegir misión científica**. Prueba Barnard, RW Aurigae o M31. Se muestran preparación, aceleración, entrada al corredor, crucero, salida y revelación del destino. En la vista exterior la nave permanece visible; en cabina se conserva la perspectiva elegida, en primera o tercera persona.
3. **Frenar e inspeccionar** cancela el viaje y limpia sus efectos. **Reingresar con Cronos** permite volver a la cabina. Las vistas y escalas incompatibles se desactivan durante la secuencia para conservar una sola cámara al mando.
4. El mapa ocupa la izquierda y los ajustes de vuelo la derecha, con altura y desplazamiento adaptados a la ventana. Ambos se pueden cerrar. Las tarjetas flotantes se apartan mientras los ajustes ocupan ese espacio.
5. **Abrir observatorio SPHEREx** conserva las imágenes y comparaciones temporales antes del análisis espectral. Los atlas, consultas IRSA, FITS, extracción, RGB y recursos astronómicos no se modificaron en esta intervención.

## Datos locales y límites científicos

Hay 131 productos FITS locales distintos con procedencia y hash: Barnard 47, RW Aurigae 28, M31 3 y M101 53. Selecciona **Usar productos locales verificados** en las opciones del observatorio. Los modelos espaciales son ilustrativos y sus distancias visuales están comprimidas. Comparar fechas no demuestra variabilidad por sí solo; hay que comprobar banda, apertura, fondo, PSF y calibración. El hiperespacio es un recurso narrativo.

## Verificación vigente

158 pruebas aprobadas; TypeScript y compilación correctos; 79 módulos de cliente enlazados en 5174 después de las pruebas. Se comprobó la interfaz real en Edge, incluidos prólogo, omisión, cabina, saltos a Barnard/RW/M31 y paneles a 1366×768 y 1920×1080. No se observaron errores ni avisos en la consola durante las comprobaciones registradas. La compilación mantiene el aviso de paquetes mayores de 500 kB; no impide ejecutar la aplicación.

Corrección del inicio automático, pruebas vigentes y respaldo de este cambio: **docs/intro-autostart-2026-11-07/**.

Informe anterior, respaldo previo, integridad y logs: **docs/cinematic-navigation-2026-11-07/**. Capturas: **docs/cinematic-navigation-2026-11-07/capturas/**. Las pruebas de escena usan Three.js real con renderer CPU simulado; las capturas corresponden al navegador real. No se presenta un benchmark de FPS/GPU.

El original KRONOX-main permanece sin cambios respecto a sus 129 archivos registrados. No se hicieron commits, pushes ni despliegues.
