# Arquitectura y desarrollo

## Resumen

KRONOX es una aplicación React de una sola página, compilada con Vite. La interfaz, los datos y la escena tridimensional viven en módulos independientes. La función serverless `api/spherex.js` consulta IRSA y entrega recortes SPHEREx FITS pequeños a la misión.

## Tecnologías

- React 18 y ReactDOM 18.
- Vite 8 y `@vitejs/plugin-react` para desarrollo y build.
- Three.js 0.128.0 y `OrbitControls` para WebGL y cámara orbital.
- HTML, CSS, módulos JavaScript y JSX.

## Mapa de módulos

- `src/main.jsx`: crea el React root e inicia `App`.
- `src/App.jsx`: estado compartido, notificaciones, callbacks y composición general de la aplicación.
- `src/components/KronoxWidget.jsx`: guía persistente, control de voz y selección de acento.
- `src/components/ToastNotification.jsx`: avisos de estado separados del panel de guía.
- `src/components/PlanetInfoModal.jsx`: ficha y referencias de un planeta.
- `src/components/QuickTravelMenu.jsx`: destinos rápidos y accesos a planetas.
- `src/components/SpherexMission.jsx`: objetivos, coordenadas, secuencia temporal y representación visual de las imágenes FITS.
- `src/data/planetData.js`: catálogo de cuerpos, datos informativos y cálculo kepleriano.
- `src/scene/createScene.js`: escena Three.js, texturas procedurales, controles, movimiento y render loop.
- `api/spherex.js`: consulta imágenes en IRSA SIA y obtiene recortes FITS con validación de URL.
- `src/styles.css`: estilos de interfaz y animaciones CSS.
- `vite.config.js`: plugin React, ruta base de GitHub Pages y división de paquetes.

## Ciclo de la escena

`App` crea la escena al montar el contenedor del canvas. El módulo de escena devuelve los métodos que usa la interfaz (cambiar cámara, velocidad, opciones, foco y destinos). Al desmontar la aplicación, React cancela el render loop, retira listeners, libera los controles y elimina el renderer.

La simulación actualiza órbitas y cuerpos por frame. Los elementos visuales se generan con geometría de Three.js, CanvasTextures, shaders y puntos de estrellas. Las texturas planetarias y la Vía Láctea son procedurales; no son mapas científicos de superficie.

## Desarrollo

```bash
npm ci
npm run dev
```

Para build de producción y vista previa:

```bash
npm run build
npm run preview
```

`npm run format` aplica Prettier al proyecto. Mantén los cambios en el módulo correspondiente y actualiza README, guía de usuario y changelog si cambia el comportamiento visible. Al modificar el render loop, conserva el ciclo de limpieza para evitar listeners o animaciones duplicadas al desmontar la escena.

## Publicación

Vite genera los archivos estáticos en `dist/`. La base configurada para el sitio de proyecto es `/KRONOX/`. Para GitHub Pages, publica ese directorio con un workflow de Actions. Otros alojamientos estáticos pueden requerir ajustar `base` en `vite.config.js`.

La búsqueda y visualización de la misión SPHEREx requiere las funciones serverless de Vercel en `api/`; `vercel.json` configura el build y Vite selecciona la base `/` en Vercel. En una publicación estática sin funciones de servidor la misión no puede consultar IRSA.
