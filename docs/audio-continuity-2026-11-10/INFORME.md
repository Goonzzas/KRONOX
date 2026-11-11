# Kronox: voz, música y continuidad · 10 de noviembre de 2026

Se trabajó sobre la versión actual de Gemini en **C:\Users\OPPENHEIMER\Desktop\kronox-juan**, con un respaldo previo. La otra carpeta, KRONOX-main, no se modificó. No se hicieron operaciones Git ni publicaciones.

## Resultado

- Fish Audio responde con HTTP 200 y proveedor **fish-audio** usando la voz **8150d8bf74d245cd84a154b785aa7fab**. Se generó y decodificó la respuesta como MP3; la prueba está en prueba-fish-cronos.mp3.
- La clave se carga exclusivamente en el servidor desde .env.local. El modelo s2-pro devolvió HTTP 402 por saldo insuficiente. Se probó **s2.1-pro-free** con el mismo identificador y generó audio; quedó configurado ese modelo. Su disponibilidad es externa y se puede cambiar mediante FISH_AUDIO_MODEL. No se modificó el saldo ni la cuenta.
- La música adjunta se copió sin cambios a public/audio/intro-score.mp3. Un único reproductor acompaña toda la introducción, sin reiniciarse entre escenas. Baja el volumen durante las locuciones, respeta el volumen general y se pausa/reinicia al terminar, omitir, repetir o desmontar la secuencia.
- Si el navegador bloquea el audio automático, el botón existente **INICIAR EXPLORACIÓN — AUDIO ACTIVADO** lo desbloquea con un clic. Esa situación ya no detiene la cámara.

## Video y causa de las pausas

Se revisaron los 50 segundos del video proporcionado mediante 50 fotogramas y una hoja de contacto. Aproximadamente entre los segundos 18 y 39 permanece la apertura de la Tierra. El código retenía esa fase hasta 45 segundos esperando permiso de audio y otras escenas hasta 14 segundos esperando la voz. Además, una caída a la voz alternativa podía repetir la misma espera de red.

Se eliminó la dependencia entre avance de cámara y disponibilidad de audio. La apertura tiene 6,5 s y las escenas siguientes 30 s de animación, con movimiento reducido conservado. Las esperas de servicios no añaden tiempo. Se agrupan las frases cortas en una sola solicitud, se evita repetir el fallback HTTP y el servicio alternativo tiene un timeout de 5 s. La narración de una fase nueva sustituye la anterior para no acumular texto de escenas pasadas.

Las entradas a SPHEREx, información y galaxia interpolan la posición y el quaternion durante 0,85 s dentro de sus propios intervalos. Se conservan los seis planos, los textos, los modelos y la entrada a cabina de Gemini. No se reconstruyó ni se rediseñó la escena.

## Cambios y conservación

Cambios funcionales: src/App.jsx, src/scene/createScene.js, src/server/fishAudioTts.js, api/voice.js y vite.config.js. Nuevos: src/utils/cinematicSoundtrack.js, api/fish-tts.js, public/audio/intro-score.mp3 y tests/soundtrack-behavior.test.mjs. También se actualizó la exclusión de archivos privados y la documentación. La comprobación de conservación de tests/cinematic.test.mjs excluye expresamente el adaptador de voz que ahora tiene timeout; conserva la protección de los servicios científicos.

Los **228 archivos protegidos** de la versión previa conservan sus hashes. El bloque de construcción de recursos y objetos exteriores dentro de createScene.js también es idéntico. No se tocaron los catálogos, las consultas IRSA, el procesamiento FITS, RGB, análisis o galerías. El componente CinematicOpening y su CSS se mantienen byte por byte. Respaldo: before.json.gz (11 archivos verificados).

## Verificación y límites

**169/169 pruebas aprobadas**, tipos y build correctos; **84 módulos de cliente enlazados** después de las pruebas. Los casos nuevos cubren música continua, ducking, bloqueo de autoplay, omisión/repetición inmediata, resolución tardía de play(), parámetros de Fish Audio y los tiempos/primer empalme de cámara de producción. La prueba HTTP real devolvió 67708 bytes de Fish Audio. La música conserva el hash del MP3 adjunto. La clave no aparece en los archivos compilados y queda excluida del ZIP.

La revisión final en el navegador no se completó porque el usuario detuvo Computer Use con Escape; no se retomó el control. Los casos de escena utilizan Three.js con renderer CPU y no constituyen una medición de FPS/GPU. El build conserva el aviso de paquetes grandes. No se afirma una revisión visual o auditiva del navegador que no se realizó.

## Uso

Abre **http://127.0.0.1:5174/KRONOX/**. Si aparece el botón de activar audio, púlsalo una vez. Al omitir la introducción, la música debe detenerse. La clave ya configurada permanece en la copia local; no se incluye en la entrega. En otra extracción, copia .env.example a .env.local, añade tu propia clave y reinicia el servidor para cargarla.

Documentación técnica consultada: [API TTS oficial de Fish Audio](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech) y [modalidad gratuita oficial](https://fish.audio/ar/blog/s2-1-pro-free-api/?articleLocale=en).
