# 🧭 Arquitectura del proyecto

[← Volver a la Wiki](README.md) · [Repositorio en GitHub](https://github.com/Goonzzas/KRONOX)

---

## Vista general

KRONOX es una aplicación web de una sola página. **React** compone la interfaz, **Three.js** dibuja la escena 3D y **Vite** sirve el entorno local y genera los archivos de publicación. Las funciones de `api/` conectan la aplicación con servicios externos cuando se despliega en Vercel.

## Módulos principales

| Ruta | Responsabilidad |
|---|---|
| `src/App.jsx` | Estado compartido, composición de paneles e integración de la escena. |
| `src/scene/createScene.js` | Escena Three.js, controles, renderizado y simulación visual. |
| `src/data/planetData.js` | Catálogo planetario y datos descriptivos/orbitales aproximados. |
| `src/data/spherexTargets.js` | Objetivos celestes precargados de la misión. |
| `src/components/` | Asistente, controles móviles, fichas, viajes rápidos y misión SPHEREx. |
| `src/utils/fitsImage.js` | Lectura de imágenes FITS, WCS y reproyección para visualización. |
| `src/i18n.js` | Traducciones y preferencia de idioma. |
| `api/spherex.js` | Búsqueda de observaciones y solicitud de recortes a IRSA. |
| `api/locale.js` | Sugerencia de idioma a partir de la región disponible en Vercel. |
| `api/voice.js` | Solicitud de síntesis de voz al servicio de Google Translate. |
| `src/styles.css` | Estilos, distribución responsive y animaciones de interfaz. |

## Flujo de la aplicación

```text
React ──> Three.js / WebGL                escena local
  ├─────> catálogos del proyecto           datos planetarios y objetivos
  ├─────> /api/spherex ──> IRSA            búsqueda y recortes FITS
  ├─────> fitsImage.js                     lectura WCS y reproyección visual
  ├─────> /api/locale                      idioma regional sugerido
  └─────> /api/voice ──> Google Translate  síntesis de audio
```

## Flujo de imágenes SPHEREx

1. La interfaz envía centro celeste y parámetros de búsqueda a `api/spherex.js`.
2. La función consulta el servicio SIA de NASA/IPAC IRSA y devuelve observaciones disponibles.
3. Para cada observación, solicita un recorte FITS usando el servicio IBE de IRSA.
4. El navegador procesa el plano de imagen, interpreta WCS cuando está disponible y transforma los píxeles a una cuadrícula común para la inspección visual.

La vista reproyectada es una ayuda de comparación. Las anotaciones viven en el estado de la sesión y se exportan a CSV; no se persisten en un servidor propio.

## Datos y límites de backend

El proyecto no declara base de datos, cuentas ni servidor persistente. Las funciones Vercel actúan como proxies hacia servicios externos. Un alojamiento estático sin funciones de servidor puede mostrar la experiencia 3D, pero no necesariamente completar la búsqueda SPHEREx, la sugerencia regional o la voz.

## Más detalles

- [Arquitectura y desarrollo](../ARQUITECTURA.md)
- [Fuentes y limitaciones](../FUENTES_Y_LIMITACIONES.md)
- [Desarrollo local y publicación](Desarrollo-y-publicacion.md)
