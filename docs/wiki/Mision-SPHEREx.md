# 🔭 Misión SPHEREx · Ecos en infrarrojo

[← Volver a la Wiki](README.md) · [Abrir KRONOX](https://kronox-delta.vercel.app)

---

## Objetivo

La misión de KRONOX permite explorar cómo se ven determinadas regiones del cielo en observaciones infrarrojas de **SPHEREx** tomadas en distintas fechas. La secuencia visual ayuda a localizar cambios que merecen investigación; por sí sola no confirma movimiento, variabilidad ni la naturaleza de una fuente.

## Iniciar una exploración

1. Abre el panel **Misión espacial** y selecciona el tipo de investigación.
2. Elige un objetivo sugerido o introduce ascensión recta y declinación (RA/Dec, coordenadas ICRS).
3. Espera a que se consulten las observaciones públicas disponibles.
4. Elige una banda y recorre la línea de tiempo o inicia la reproducción.
5. Usa la comparación lado a lado para seleccionar dos fechas.
6. Marca una posición de interés, añade una nota y exporta las anotaciones a CSV.

Entre los objetivos de ejemplo están la **estrella de Barnard**, **Epsilon Indi B**, **WISE 0855**, **RW Aurigae** y **R Draconis**. La cobertura varía por posición, banda y fecha de publicación; algunos objetivos pueden tener pocos cuadros o ninguno.

## ¿Qué son QR2 y QR3?

Son colecciones de productos de datos de SPHEREx disponibles en el archivo público. En KRONOX se ofrecen como opciones de consulta: QR2 tiene una cobertura acumulada más amplia en el conjunto integrado y QR3 contiene productos de publicación más reciente. La cobertura exacta depende del objetivo y debe comprobarse en los resultados disponibles.

## ¿Qué representan las bandas?

SPHEREx observa en múltiples bandas infrarrojas. Cada selector `D` identifica un canal espectral del instrumento; la banda indica qué intervalo de longitudes de onda contribuye a la imagen. Las bandas permiten observar cómo cambia la intensidad de una fuente con la longitud de onda, pero no son colores visibles. El mapa azul de KRONOX es una paleta para mostrar intensidad en pantalla.

Los resultados de una banda pueden diferir en cobertura, sensibilidad y contenido. Para comparar, mantén la misma banda siempre que sea posible y revisa las fechas y metadatos que muestra la interfaz.

## Comparación de dos fechas

La vista comparativa muestra ambos recortes lado a lado. KRONOX lee la información WCS de los FITS y reproyecta imágenes a una cuadrícula celeste común, para facilitar la inspección de posiciones. La orientación de referencia es norte arriba y este a la izquierda; las zonas sin datos aparecen transparentes.

La comparación visual sirve para notar candidatos a cambio. Diferencias aparentes también pueden deberse a cobertura, ruido, fondo, respuesta instrumental, máscara de calidad o escala de brillo. Una fuente tenue podría no ser visible en todas las observaciones.

## Marcar hallazgos

Haz clic sobre la posición de interés en una imagen comparativa para registrar el marcador; añade una nota que explique lo observado y, si corresponde, cuál imagen muestra la señal. Las anotaciones incluyen objetivo, banda, fechas y posición del marcador. Se guardan en la sesión actual y se descargan como CSV; no se almacenan en una cuenta o base de datos.

Describe la observación con prudencia, por ejemplo: **“La fuente parece desplazada entre estas dos fechas; falta confirmación astrométrica.”** Distingue lo que ves de la explicación que propones.

## Interpretación responsable

- No interpretes el color de pantalla como color óptico ni como una medida calibrada.
- La alineación WCS facilita la comparación, pero no convierte el visor en una herramienta de astrometría de precisión.
- Para afirmar movimiento o variabilidad se requieren mediciones, incertidumbres, calibración y verificación con fuentes externas confiables.
- Consulta [Ciencia y limitaciones](Ciencia-y-limitaciones.md) y las fuentes oficiales antes de presentar una conclusión científica.

---

[Arquitectura de SPHEREx en KRONOX →](Arquitectura.md) · [Fuentes y limitaciones →](Ciencia-y-limitaciones.md)
