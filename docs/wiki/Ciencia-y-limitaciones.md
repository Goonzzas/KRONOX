# 🧪 Ciencia, datos y límites

[← Volver a la Wiki](README.md) · [Misión SPHEREx](Mision-SPHEREx.md)

---

## Para qué sirve KRONOX

KRONOX es una experiencia educativa para recorrer una representación interactiva del sistema solar y explorar imágenes públicas de SPHEREx. Ayuda a formular preguntas y ubicar candidatos a cambios. No es una herramienta de navegación espacial, un planetario de precisión ni un sistema de análisis astronómico calibrado.

## Escena y escalas

- **Escala visual:** exagera tamaños y comprime distancias para que los cuerpos y destinos quepan en la interfaz.
- **Escala física:** ofrece una representación más cercana a radios y distancias, según la conversión indicada por la interfaz.
- **Órbitas:** se calculan mediante elementos aproximados; no son una consulta en tiempo real a JPL Horizons.
- **Luna y galaxia:** ambas se simplifican para hacer legible la navegación y la orientación.

Por ello, la proximidad en pantalla y el aspecto de una órbita no deben usarse para deducir distancias astronómicas exactas.

## Imágenes infrarrojas

Los recortes FITS provienen del archivo público NASA/IPAC IRSA. Cada imagen representa datos instrumentales en bandas infrarrojas, no una fotografía en luz visible. La paleta azul es una codificación visual de intensidad; no expresa el color real de los objetos.

WCS permite relacionar píxeles con coordenadas celestes, y la reproyección ayuda a colocar dos imágenes en una cuadrícula común. Esto mejora la inspección de posiciones, pero no reemplaza calibración, modelado de incertidumbres ni astrometría precisa.

## Cambios aparentes y conclusiones

Una diferencia entre fechas puede tener causas distintas: movimiento o variabilidad real, diferente cobertura, ruido, fuentes de fondo, respuesta del instrumento, distorsión o escalado visual. Antes de concluir, se debe:

1. comparar observaciones de la misma banda y revisar sus metadatos;
2. comprobar cobertura válida y máscaras/calidad disponibles;
3. distinguir una impresión visual de una medición cuantitativa;
4. considerar incertidumbres y corroborar con catálogos o literatura apropiados.

Las marcas y notas exportadas desde KRONOX son registros de observación del usuario, no detecciones confirmadas por el sistema.

## Fuentes y privacidad

Las referencias planetarias se enlazan desde las fichas y se resumen en [Fuentes, datos y limitaciones](../FUENTES_Y_LIMITACIONES.md). Las búsquedas SPHEREx envían coordenadas a IRSA. La voz transmite el texto del aviso a Google Translate TTS para generar audio. No hay cuentas ni almacenamiento de notas en servidor.

---

[Volver a la Wiki](README.md) · [Guía de la misión](Mision-SPHEREx.md)
