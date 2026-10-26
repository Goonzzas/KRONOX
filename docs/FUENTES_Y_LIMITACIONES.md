# Fuentes, datos y limitaciones

## Referencias usadas por la experiencia

Las fichas enlazan a las páginas de NASA Solar System Exploration para consultar los datos de cada mundo:

- [Mercurio](https://science.nasa.gov/mercury/facts/)
- [Venus](https://science.nasa.gov/venus/facts/)
- [Tierra](https://science.nasa.gov/earth/facts/)
- [Marte](https://science.nasa.gov/mars/facts/)
- [Júpiter](https://science.nasa.gov/jupiter/jupiter-facts/)
- [Saturno](https://science.nasa.gov/saturn/facts/)
- [Urano](https://science.nasa.gov/uranus/facts/)
- [Neptuno](https://science.nasa.gov/neptune/neptune-facts/)
- [Temperaturas del sistema solar](https://science.nasa.gov/resource/solar-system-temperatures/)

La interfaz presenta enlaces a las referencias junto a la ficha de cada planeta. Las imágenes también se solicitan a dominios de NASA.

## Escalas y órbitas

- La **escala física** expresa radios y distancias con una unidad de escena equivalente a un millón de kilómetros.
- La **escala visual** exagera los radios y comprime las distancias para hacer los cuerpos y recorridos legibles en pantalla. No debe usarse para medir tamaños o distancias reales.
- Las posiciones orbitales se calculan con elementos keplerianos aproximados atribuidos en la interfaz a JPL (Standish, intervalo indicado: 1800–2050). Son una aproximación educativa, no una consulta a JPL Horizons ni efemérides de alta precisión.
- La órbita de la Luna es circular y simplificada, con rotación sincronizada.
- La orientación de los ejes planetarios está simplificada; el propio panel informa esta limitación.
- El tiempo de movimiento galáctico se escala visualmente para representar una órbita solar de aproximadamente 230 millones de años.

## Representación de la Vía Láctea

La galaxia es un modelo esquemático generado para visualización, con brazos, polvo y estrellas representados de forma procedimental. No es una imagen astronómica ni una reconstrucción completa de la estructura galáctica. La posición del Sol y la dirección aproximada del centro se describen en el panel de fuentes de la aplicación.

## Voz, red y privacidad

La voz de Kronox usa solicitudes de audio de Google Translate. Para convertir el aviso en voz, el texto de ese aviso se envía al servicio. Se necesita conexión y reproducción de audio permitida por el navegador. El selector de acento no cambia el género de la voz.

React, ReactDOM, Three.js y OrbitControls se descargan de jsDelivr. Las fichas cargan imágenes desde NASA. Por tanto, la primera carga y estas funciones dependen de terceros y no están disponibles completamente sin conexión.

## Uso previsto

KRONOX es una experiencia educativa y visual. No es un planetario de precisión, una herramienta de navegación espacial ni una fuente primaria de datos científicos. Para trabajos científicos, consulta las referencias enlazadas directamente.
