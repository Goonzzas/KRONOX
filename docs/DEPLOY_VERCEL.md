# KRONOX en Vercel

Sitio oficial: **[https://astralsentinels.earth](https://astralsentinels.earth)**. `www.astralsentinels.earth` también dirige al sitio oficial.

- Equipo y proyecto: Astral Sentinels / kronox.
- Repositorio: [Goonzzas/KRONOX](https://github.com/Goonzzas/KRONOX).
- Rama de producción: `main`.
- Framework: Vite; raíz del repositorio; `npm run build`; salida `dist`.
- Vite usa `/` cuando `VERCEL=1`.
- Endpoints: `/api/fish-tts`, `/api/voice`, `/api/spherex` y `/api/locale`. Los auxiliares están en `api/_lib/` y no se publican como funciones.

## Voz y música

La voz Fish Audio usa el ID público **8150d8bf74d245cd84a154b785aa7fab**.

| Variable de producción | Tipo | Configuración |
|---|---|---|
| FISH_AUDIO_API_KEY | Secret | Guardada en Vercel y en la configuración local privada; nunca en GitHub |
| FISH_AUDIO_MODEL | Config | s2.1-pro-free |

La música proporcionada está en `public/audio/intro-score.mp3`. Se reproduce durante la cinemática y se detiene al finalizar u omitirla. El navegador requiere una primera interacción para permitir sonido; el botón de activación desbloquea música y narración.

No uses el prefijo `VITE_` para claves privadas. `.vercelignore` excluye configuraciones privadas, cachés, dependencias y auditorías de la carga. Los archivos de `public/`, las escenas y los datos de la aplicación sí se despliegan.

## Datos científicos y cachés

La consulta en vivo usa NASA/IPAC IRSA. Los FITS versionados de `public/demo/` conservan sus hashes de procedencia. La interfaz distingue los productos locales del archivo completo y mantiene las limitaciones de interpretación. Las reconstrucciones ilustrativas conservan sus fuentes; no se presentan como fotografías SPHEREx.

Las cachés de voz y archivo usan el directorio temporal del servidor en Vercel. Un fallo de caché no descarta una respuesta válida de IRSA. No se requiere almacenamiento persistente para esa caché.

## Verificación y actualizaciones

Se verificaron las 170 pruebas, TypeScript y la compilación de producción. Las comprobaciones HTTP confirmaron la voz con `X-Kronox-TTS-Provider: fish-audio`, la música original, 252 productos de Barnard y un recorte FITS real válido. La auditoría de recursos compara archivos publicados con originales mediante SHA-256. Las capturas y reportes de ejecución se conservan fuera del repositorio.

Para publicar cambios, integra el commit en `main`; la conexión Git de Vercel inicia el despliegue de producción. Confirma que el despliegue quede en estado **Ready** y que los alias de producción incluyan `astralsentinels.earth`. `.vercel/`, los tokens de acceso y `.env.local` no se versionan. Los cambios de variables requieren un nuevo despliegue.

Referencias oficiales: [variables de entorno](https://vercel.com/docs/environment-variables), [auxiliares de API](https://vercel.com/docs/functions/configuring-functions/advanced-configuration), [despliegues](https://vercel.com/docs/deployments).
