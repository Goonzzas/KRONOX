# Arquitectura y desarrollo

## Resumen

KRONOX es una aplicación web estática de una sola página. `index.html` contiene la estructura, estilos, datos del sistema solar, lógica de simulación y componentes de interfaz. No usa servidor de aplicación ni paso de compilación.

## Tecnologías

- HTML y CSS nativos.
- React y ReactDOM 18.3.1 en builds UMD, usados sin JSX.
- Three.js 0.128.0 para la escena y renderizado WebGL.
- `OrbitControls.js` de Three.js para la cámara orbital.
- APIs del navegador para entrada, animación, fecha, audio HTML y eventos.

Las bibliotecas se importan desde jsDelivr. Las fichas cargan imágenes de NASA y la voz reproduce MP3 generados por el endpoint de Google Translate.

## Organización de `index.html`

- **Estilos iniciales:** paneles, HUD, avisos, ficha planetaria y animaciones CSS.
- **Dependencias y datos:** bibliotecas externas, constantes físicas, planetas, órbitas y contenido de las fichas.
- **`App`:** estado de React y composición del panel, menú de viajes, controles, avisos y modales.
- **`setup`:** escena Three.js, cuerpos celestes, iluminación, cámara, teclado, puntero y bucle de animación.
- **Voz de Kronox:** genera solicitudes de audio en español, las divide en fragmentos breves, reproduce los fragmentos en orden y cancela la reproducción anterior al anunciar otro mensaje.

La app conserva el estado principalmente en memoria; recargar la página vuelve a iniciar la experiencia.

## Modificar el proyecto

1. Edita `index.html`.
2. Mantén actualizados README, las guías y el registro de cambios si cambia el comportamiento visible.
3. Comprueba que el JavaScript incrustado parsea correctamente y abre la página en un navegador para revisar la escena y los controles.
4. Comprueba separadamente dependencias de CDN, imágenes externas y reproducción de voz, ya que dependen de red y de políticas del navegador.

No se requiere `npm install` ni un proceso de build. Si el proyecto crece, conviene separar el HTML, CSS, módulos de simulación y datos en archivos independientes, y fijar una estrategia de dependencias antes de incorporar un bundler.

## Publicación

El sitio puede publicarse con GitHub Pages desde la rama `main` y la carpeta raíz (`/`). `index.html` es el punto de entrada. La publicación requiere acceso a internet para descargar dependencias y recursos externos.
