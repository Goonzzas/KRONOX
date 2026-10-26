# KRONOX — Explorador 3D del sistema solar

KRONOX es una experiencia web interactiva para recorrer el sistema solar y una representación esquemática de la Vía Láctea. Permite observar los planetas desde una cámara orbital o desde una nave, cambiar entre escalas, realizar viajes rápidos y consultar fichas informativas acompañadas de imágenes.

La guía astral **Kronox** presenta avisos sobre cambios de navegación y mundos cercanos, y puede leerlos en voz alta en español.

## Funciones

- Escena 3D con el Sol, planetas, Luna, órbitas, etiquetas, ejes y visualización esquemática de la galaxia.
- Escala visual comprimida para explorar cómodamente y escala física expresada en millones de kilómetros.
- Simulación de fecha, velocidades orbitales y controles para pausar o restablecer.
- Cámara libre y navegación en nave, con perspectiva en primera o tercera persona.
- Viajes rápidos a planetas, la órbita próxima al Sol, el cinturón de asteroides, el Brazo de Orión y el centro galáctico.
- Efecto de salto, estela, inercia y opciones de piloto automático.
- Avisos de Kronox, voz en español y fichas planetarias con datos, imágenes y enlaces a NASA.
- Diseño adaptable a distintos tamaños de pantalla.

## Cómo abrirlo

### GitHub Pages

El proyecto incluye `index.html`, por lo que puede publicarse como sitio estático:

1. Abre **Settings → Pages** en el repositorio.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona `main` y la carpeta `/ (root)` y guarda.
4. Cuando finalice la publicación, GitHub mostrará la URL del sitio en esa misma página.

### En tu computador

Abre `index.html` en un navegador moderno con conexión a internet. Para servirlo por HTTP desde la carpeta del proyecto, también puedes ejecutar:

```bash
python3 -m http.server 8000
```

Luego visita `http://localhost:8000`.

No requiere Node.js, instalación de paquetes ni un proceso de compilación. React, ReactDOM, Three.js y OrbitControls se cargan desde jsDelivr.

## Navegación

- **Cámara orbital:** arrastra para girar, usa la rueda para acercar o alejar y el clic derecho para desplazar la cámara.
- **Nave:** usa `W`, `A`, `S`, `D` para moverte; `Q` y `E` para bajar o subir; mantén `Shift` para acelerar. Arrastra para orientar la vista.
- **Primera / tercera persona:** selecciona la perspectiva en el panel de nave.
- **Viajes rápidos:** abre el menú inferior, elige un destino y sigue la cuenta atrás de Kronox.
- **Información:** al acercarte a un planeta, Kronox lo anuncia una vez al entrar en su zona de proximidad. Usa el botón del aviso para abrir su ficha.

La guía completa está en [`docs/GUIA_USUARIO.md`](docs/GUIA_USUARIO.md).

## Estructura

```text
.
├── index.html
├── README.md
├── CHANGELOG.md
└── docs/
    ├── ARQUITECTURA.md
    ├── FUENTES_Y_LIMITACIONES.md
    └── GUIA_USUARIO.md
```

## Dependencias y servicios externos

- React y ReactDOM 18.3.1 (UMD) y Three.js 0.128.0 con OrbitControls desde jsDelivr.
- Las imágenes de las fichas se solicitan a dominios de NASA.
- La voz alternativa usa el endpoint de texto a voz de Google Translate y requiere conexión. El texto de cada aviso hablado se envía a Google para generar el audio. La voz permite seleccionar acento latino o de España; el endpoint actual no ofrece selector de género.

Si alguno de esos servicios externos no está disponible, partes de la experiencia —incluidas las bibliotecas, imágenes o la voz— pueden no cargarse.

## Datos y alcance científico

La app está diseñada como exploración visual educativa, no como herramienta de navegación o efemérides de precisión. La escala visual modifica radios y distancias para hacer legible el recorrido. La simulación orbital usa elementos keplerianos aproximados descritos dentro de la app; la Luna y la Vía Láctea usan modelos simplificados. Los detalles y referencias se documentan en [`docs/FUENTES_Y_LIMITACIONES.md`](docs/FUENTES_Y_LIMITACIONES.md).

## Documentación

- [Guía de usuario](docs/GUIA_USUARIO.md)
- [Arquitectura y desarrollo](docs/ARQUITECTURA.md)
- [Fuentes, datos y limitaciones](docs/FUENTES_Y_LIMITACIONES.md)
- [Registro de cambios](CHANGELOG.md)
