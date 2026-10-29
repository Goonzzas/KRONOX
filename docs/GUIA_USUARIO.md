# Guía de usuario

## Instalación y arranque

Necesitas Node.js 20.19+ o 22.12+ y npm. Desde la carpeta del proyecto ejecuta:

```bash
npm ci
npm run dev
```

Abre en el navegador la dirección local que Vite muestra en la terminal. Para generar y revisar el sitio de producción:

```bash
npm run build
npm run preview
```

La aplicación necesita internet para descargar imágenes planetarias y generar la voz de Kronox.

## Escalas y tiempo

- **Escala visual:** comprime las distancias y exagera el tamaño aparente de los cuerpos.
- **Escala física:** muestra radios y distancias usando millones de kilómetros.
- **Fecha simulada:** cambia la fecha que usa el cálculo orbital.
- **Velocidad de simulación:** ajusta cuánto tiempo transcurre por segundo.
- **Pausar/Reanudar** detiene o continúa la simulación; **Restablecer** devuelve sus valores iniciales.
- **Órbitas, Etiquetas, Ejes, Velocidad y Movimiento galáctico** activan o desactivan elementos visuales.

## Cámara orbital

- Arrastra con el botón principal para orbitar la escena.
- Usa la rueda del ratón para acercar o alejar.
- Arrastra con el botón derecho para desplazar la cámara.
- Selecciona un planeta en el menú inferior para enfocarlo.

## Nave planetaria

Pulsa **Ingresar en nave planetaria** para pilotar desde la ubicación actual. El panel permite elegir primera o tercera persona y ajustar el campo de visión.

- `W` / `S`: avanzar / retroceder.
- `A` / `D`: movimiento lateral.
- `Q` / `E`: bajar / subir.
- `Shift`: aumentar temporalmente la velocidad.
- Arrastrar: orientar la vista.
- Rueda: ajustar la velocidad de vuelo.
- Los botones de marcha cambian la velocidad sin reubicar la nave.

**Estela**, **Inercia** y **Piloto auto.** modifican el comportamiento visual y de vuelo.

## Cámara libre

Pulsa **Cámara libre** para observar la nave en 3D. La nave permanece inmóvil mientras la cámara la rodea. **Regresar a la nave** te devuelve a su posición y orientación actuales.

## Viajes rápidos

Abre el menú inferior para elegir entre órbita próxima al Sol, cinturón de asteroides, Brazo de Orión, centro galáctico o un planeta. Kronox presenta una cuenta atrás; un destino largo usa el efecto de salto.

## Kronox y datos planetarios

Kronox anuncia por separado cambios de velocidad, vista, escala y navegación. En la nave, al entrar en la zona de proximidad de un planeta, anuncia el acercamiento una vez y muestra un botón para abrir la ficha.

Pulsa **Activar voz** para habilitar el audio. El navegador puede bloquear la reproducción hasta que pulses ese botón. El selector permite elegir acento **Latino** o **España**. La voz requiere conexión y envía el texto del aviso a Google Translate. El endpoint actual no permite seleccionar voz masculina/femenina.

Las fichas reúnen descripción, estructura/superficie, composición, atmósfera, temperatura, clima y un dato curioso, con imágenes y enlaces de NASA. En gigantes gaseosos y helados, ciertas temperaturas describen capas atmosféricas de referencia, no una superficie sólida.

## Misión SPHEREx: Ecos en infrarrojo

Pulsa **Misión** en el panel para abrir el observatorio. Elige la estrella de Barnard, Epsilon Indi B, WISE 0855, RW Aurigae o R Draconis, o introduce ascensión recta y declinación en grados ICRS. **Consultar SPHEREx** busca observaciones públicas en NASA/IPAC IRSA. Usa QR2 para la colección con mayor cobertura acumulada o QR3 para los productos más recientes.

Cuando haya resultados, la misión carga recortes infrarrojos, permite filtrar por banda espectral y recorrer las fechas con la línea de tiempo o **Reproducir**. El brillo se convierte a una escala azulada para visualizarlo en el navegador; no representa colores visibles. La secuencia conserva el contraste del primer fotograma para ayudar a comparar imágenes, pero no sustituye una medición fotométrica calibrada. La cobertura cambia según la posición y el lanzamiento, así que algunos objetivos pueden tener una sola fecha o no tener observaciones todavía. Se necesita publicar la aplicación con las funciones serverless de Vercel para que la consulta y los recortes estén disponibles.
