# KRONOX — Explorador 3D del sistema solar

KRONOX es una aplicación web interactiva hecha con **React**, **Vite** y **Three.js**. Permite recorrer el sistema solar y una representación esquemática de la Vía Láctea, alternar entre cámara orbital y una nave, realizar viajes rápidos y consultar fichas planetarias. Kronox, la guía astral, presenta avisos y puede leerlos en voz alta. La misión **Ecos en infrarrojo** consulta observaciones de SPHEREx en el archivo público NASA/IPAC IRSA y reproduce recortes FITS por fecha.

## Funciones

- Escena 3D con el Sol, planetas, Luna, órbitas, etiquetas, ejes, estrellas y galaxia esquemática.
- Escala visual comprimida y escala física en millones de kilómetros.
- Simulación de fecha y velocidad, con controles para pausar y restablecer.
- Cámara orbital, cámara libre y nave con perspectiva en primera o tercera persona.
- Viajes rápidos al Sol, cinturón de asteroides, Brazo de Orión, centro galáctico y planetas.
- Cuenta atrás, salto espacial, estela, inercia y piloto automático.
- Asistente Kronox con avisos separados, voz en español y detector de proximidad planetaria.
- Fichas con datos, imágenes y referencias de NASA.
- Misión SPHEREx: búsqueda por coordenadas, cinco objetivos de prueba, selección QR2/QR3 y secuencia de recortes infrarrojos reproducible.

## Requisitos

- Node.js **20.19+** o **22.12+**.
- npm incluido con Node.js.
- Navegador moderno con soporte WebGL.

## Desarrollo local

```bash
npm ci
npm run dev
```

Vite mostrará la dirección local en la terminal. Para verificar el paquete de producción:

```bash
npm run build
npm run preview
```

El resultado se genera en `dist/`. No se necesita una compilación separada de Three.js ni otro servidor de aplicación.

## Publicación

La configuración Vite usa `/KRONOX/` como base para el sitio de proyecto en GitHub Pages. La misión SPHEREx necesita las funciones de servidor de `api/spherex.js` para consultar IRSA y servir recortes FITS; publícala en Vercel (configurado en `vercel.json`) para habilitar esa función. En un alojamiento puramente estático, la escena seguirá disponible, pero la búsqueda de SPHEREx no tendrá backend.

## Controles

- **Cámara orbital:** arrastra para girar, rueda para acercar o alejar y clic derecho para desplazar.
- **Nave:** `W`, `A`, `S`, `D` para moverte; `Q` y `E` para bajar o subir; `Shift` para acelerar. Arrastra para orientar la vista.
- **Primera / tercera persona:** selecciónala desde el panel de nave.
- **Viajes rápidos:** abre el menú inferior y elige un destino.
- **Información:** al acercarte a un planeta, Kronox anuncia la aproximación una vez y ofrece el botón para abrir la ficha.

La guía completa está en [`docs/GUIA_USUARIO.md`](docs/GUIA_USUARIO.md).

## Estructura del proyecto

```text
.
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── styles.css
│   ├── components/
│   │   ├── KronoxWidget.jsx
│   │   ├── PlanetInfoModal.jsx
│   │   ├── QuickTravelMenu.jsx
│   │   └── ToastNotification.jsx
│   ├── data/
│   │   └── planetData.js
│   └── scene/
│       └── createScene.js
├── docs/
└── CHANGELOG.md
```

## Tecnologías y servicios externos

- React 18 y ReactDOM para interfaz y estado.
- Vite 8 y `@vitejs/plugin-react` para servidor de desarrollo y compilación.
- Three.js 0.128.0 y `OrbitControls` para la simulación 3D.
- Imágenes de las fichas cargadas desde NASA.
- Voz generada con el endpoint de texto a voz de Google Translate.

La voz requiere internet y envía el texto de cada aviso hablado a Google para generar el audio. El selector permite cambiar el acento (latino o España), pero el servicio usado no permite elegir el género de la voz. Las dependencias, imágenes y audio externos limitan el uso sin conexión.

## Alcance científico

KRONOX es una experiencia visual educativa, no una herramienta de navegación ni de efemérides de alta precisión. La escala visual exagera radios y comprime distancias. Las órbitas usan elementos keplerianos aproximados; la órbita de la Luna y el modelo de la Vía Láctea están simplificados. Consulta [`docs/FUENTES_Y_LIMITACIONES.md`](docs/FUENTES_Y_LIMITACIONES.md) y las referencias de NASA enlazadas en cada ficha.

## Documentación

- [Guía de usuario](docs/GUIA_USUARIO.md)
- [Arquitectura y desarrollo](docs/ARQUITECTURA.md)
- [Fuentes, datos y limitaciones](docs/FUENTES_Y_LIMITACIONES.md)
- [Registro de cambios](CHANGELOG.md)
