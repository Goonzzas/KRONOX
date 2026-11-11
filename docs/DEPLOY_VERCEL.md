# Preparación de Vercel para esta rama

Esta rama contiene el estado actual de Kronox: cinemática y escenas de Gemini, música, voz Fish Audio, catálogos, FITS locales y pruebas. No modifica main. La publicación en Vercel se hará por separado.

## Ajustes del proyecto

- Repositorio: Goonzzas/KRONOX.
- Rama: codex/kronox-actual-voz-musica-2026-11-11.
- Directorio raíz: la raíz del repositorio.
- Framework: Vite; instalación: npm ci; build: npm run build; salida: dist.
- El frontend y las funciones API están incluidos. Vite usa la base / cuando VERCEL=1; Vercel aporta esa variable de sistema.

## Variables privadas y públicas

| Nombre | Tipo en Vercel | Valor |
|---|---|---|
| FISH_AUDIO_API_KEY | Secret | Tu clave privada, conservada localmente en .env.local; no está en GitHub |
| FISH_AUDIO_MODEL | Config | s2.1-pro-free |

La referencia pública de la voz es **8150d8bf74d245cd84a154b785aa7fab**. Está configurada en src/utils/voiceProvider.js y src/server/fishAudioTts.js; no necesita ser un secreto ni otra variable. Nunca añadas el prefijo VITE_ a una clave privada.

En Vercel, abre Settings → Environment Variables y configura esas variables para el entorno que vayas a usar (Preview para una prueba de la rama; Production cuando corresponda). Después genera un nuevo despliegue para que se apliquen. No se configuró ni desplegó Vercel en esta publicación de GitHub.

## Música y archivos locales

La música está en public/audio/intro-score.mp3 y conserva el archivo proporcionado. public/audio/README.md identifica su procedencia. La cinemática usa esa ruta y la detiene al finalizar u omitir. Los productos FITS de demostración, texturas y demás recursos están en public/.

La clave auténtica, node_modules, dist, cachés y ZIP antiguos no se versionan. .env.example documenta la configuración sin incluir credenciales. Para una copia local, crea .env.local a partir de ese ejemplo, añade tu clave y ejecuta npm ci y npm run dev.

## Comprobaciones

Se conserva la suite de 169 pruebas de la copia actual. Esta publicación verifica además integridad de los recursos, compilación con la base de Vercel y ausencia de la clave en los archivos versionados. Las modificaciones de empaquetado son .gitignore, el comentario de ID en .env.example, este documento y permitir que INICIAR-DEMO.ps1 se use dentro de un clon Git.

Referencias oficiales: [variables de entorno](https://vercel.com/docs/environment-variables), [tipos Config y Secret](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types).
