# Astral Sentinels — copia independiente de Juan

Preparada el **7 de noviembre de 2026** para la hackatón del 14–15 de noviembre.

**Carpeta de trabajo:** `C:\Users\OPPENHEIMER\Desktop\kronox-juan`

**Original, solo lectura:** `C:\Users\OPPENHEIMER\Desktop\KRONOX-main`

Windows indicó que el Escritorio real era `C:\Users\OPPENHEIMER\Desktop`; no estaba redirigido a OneDrive. No existía una carpeta literalmente llamada `kronox`; `KRONOX-main` contenía los archivos, componentes y funciones descritos en la solicitud. Se copió a una carpeta hermana nueva, excluyendo `.git`, dependencias instaladas y compilaciones regenerables. Se verificaron los ancestros antes de instalar o editar. No se inicializó Git, ni se hicieron commits, push, PR o despliegues.

## Arranque exacto en Windows

Esta copia ya tiene sus dependencias instaladas. En PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Users\OPPENHEIMER\Desktop\kronox-juan'
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir: **http://127.0.0.1:5173/KRONOX/?welcome=false&voice=false**

Si el servidor de esta sesión sigue ejecutándose, la dirección ya está disponible. No inicies otro en el mismo puerto; Ctrl+C en la terminal que lo inició lo detiene. Alternativa: sustituir el puerto por `5174` y abrir esa dirección.

Si se extrae el paquete en otro equipo o faltan dependencias, ejecutar primero:

```powershell
npm.cmd ci
```

También se incluye `INICIAR-DEMO.ps1`, sin necesidad de cambiar políticas de ejecución de Windows. Los comandos manuales anteriores evitan depender de esa política.

Probado aquí con **Node v24.16.0 y npm 11.13.0**. El juego utiliza React 18, Vite 8 y Three.js 0.128. Las funciones Node de `api/` se sirven localmente mediante el plugin existente de Vite. No requiere Vercel, Python, claves de IA ni acceso al repositorio para jugar. Python/Astropy se empleó únicamente como verificador independiente de la calibración; las referencias generadas están incluidas.

## Recorrido de demostración de tres minutos

Este es un guion para ejecutar manualmente; el recorrido visual completo no pudo verificarse con automatización de Windows.

| Tiempo | Acción | Qué mostrar |
|---|---|---|
| 0:00–0:30 | Abre la dirección principal y pulsa **Misiones científicas**. En **Evidencia y espectros**, elige **M31 · Andrómeda (núcleo)**. | Destino, viaje automático y llegada en la escena existente. |
| 0:30–0:50 | Usa **Frenar e inspeccionar** para orbitar el destino, o **Empezar misión** al llegar. Si vuelves al espacio, **Abrir observación del destino** conserva el objetivo. | Galaxia ilustrativa; no una reconstrucción de volumen desde FITS. |
| 0:50–1:15 | En el observatorio, pulsa **Abrir primera observación infrarroja**. Mantén **Usar productos locales verificados**. | Nombre, fecha, banda, λ local, unidades y producto IRSA. La retícula es una posición de catálogo, no una detección automática. |
| 1:15–1:45 | Baja hasta **De observar a justificar**, pulsa **Cargar muestras disponibles**, luego **Inspeccionar 1**. | Tres mediciones reales del núcleo, barras de error, ancho del filtro y número de píxeles válidos. No forman un espectro continuo. |
| 1:45–2:15 | Abre el laboratorio RGB y asigna muestras a R/G/B. También puedes verlas individualmente en la línea de tiempo. | Falso color explícito, leyenda y patrón de cobertura ausente. No atribuir diferencias de λ al paso del tiempo. |
| 2:15–2:45 | Elige **Evidencia insuficiente**, escribe una justificación y pulsa **Guardar conclusión con evidencia en el cuaderno**. | Ejemplo: «Las 3 muestras son de diferentes longitudes de onda. Faltan épocas con banda compatible y una PSF común para demostrar variabilidad». |
| 2:45–3:00 | Entra en **Cierre de misión** y exporta el cuaderno CSV. | Ahora sí aparece **Investigación completada**. Sin conclusión con evidencia solo se permite **Recorrido libre finalizado**. |

Prueba científica directa, para revisar el laboratorio sin viajar: **http://127.0.0.1:5173/KRONOX/?target=m31&voice=false**. Esta entrada **no valida el vuelo**.

Barnard y RW Aurigae están disponibles en el mismo selector. En Barnard la apertura estricta inicial utilizable corresponde a D6; otras muestras conservadas pueden carecer de píxeles limpios en la apertura de la estrella. Eso se muestra como ausencia de medición y es una oportunidad para justificar «Evidencia insuficiente».

## Hitos y cómo revisarlos por separado

Consulta [HITOS.md](docs/juan/HITOS.md) para archivos, dependencias, acciones en la interfaz y resultados comprobados.

1. **Misión científica con datos reales:** observación identificada → extracción → inspección → conclusión → cuaderno → cierre condicionado.
2. **Escena 3D y vuelo:** destinos con superficies/halos suaves, galaxia ilustrativa, detalle bajo demanda, frenado, regreso al mapa y capturas de rendimiento optativas.
3. **Análisis y catálogo:** RGB con worker, muestras discretas con calidad/varianza, contraste de fechas, ejercicio de absorción sintético y catálogo clasificado con estados de verificación.
4. **Cronos:** personaje conservado y ayuda contextual local que utiliza realmente la selección cargada. No se encontró un proveedor de IA configurado en el proyecto; no se añadió una conexión externa ni se copiaron credenciales.

## Qué está verificado y qué falta

- **114 pruebas pasan**, incluyendo las 98 heredadas. Las pruebas heredadas con cifras fijas se conservan como regresiones del proyecto; no son una nueva validación observacional de aquellas afirmaciones.
- La prueba de componentes React monta el observatorio real, carga los FITS locales, inspecciona una fila, registra una conclusión y restaura el estado del cuaderno con peticiones externas bloqueadas.
- Se recuperaron **13 recortes SPHEREx QR2 reales**: Barnard (4), núcleo de M31 (3), RW Aurigae (6). Cada misión tiene al menos una apertura con medición válida. Los identificadores, versiones en los nombres de fichero, fechas, URLs y hashes se conservan.
- Los 13 productos se entregan localmente y se verificó su entrega HTTP con hashes idénticos. La selección de demo no consulta IRSA.
- La calibración se comparó con Astropy/WCSLIB en **39 posiciones** de los productos reales.
- **Catálogo: 20 casos**, con **3 destinos validados con FITS locales**, **11 con cobertura QR2 comprobada solo en metadatos** y **6 pendientes de coordenadas/productos**. No se presentan los 20 como mediciones verificadas.
- Pasan `npm.cmd run typecheck` y `npm.cmd run build`. La compilación conserva un aviso de tamaño de chunks; no se ocultó.
- **Pendiente:** recorrer visualmente navegación, aproximación, frenado, cambio de cámara y regreso en Windows; auditoría de teclado/lectores de pantalla y comparación GPU/FPS antes/después. La automatización se detuvo porque no pudo identificar la URL del navegador con suficiente confianza. No se eludió ese bloqueo ni se presentaron capturas heredadas como nuevas.

La validación sin Internet realizada es **de componentes y núcleo**, con un guard que rechaza cualquier petición externa. No se cambió la configuración de red de Windows ni se afirmó una prueba física del navegador con Wi-Fi desconectado.

## Límites científicos que deben acompañar la demo

- Se mide **brillo superficial medio** en una apertura, en MJy/sr, sobre píxeles nativos; no es flujo integrado de toda la galaxia ni fotometría PSF de una estrella.
- Se usa `IMAGE − ZODI` cuando existe ZODI, sin sustracción de fondo local. La incertidumbre procede de VARIANCE; no incorpora incertidumbre del modelo ZODI, errores sistemáticos ni PSF.
- Se excluyen todas las banderas excepto SOURCE/FULLSAMPLE informativas para la extracción del laboratorio. Una muestra sin píxeles válidos queda ausente, nunca se sustituye por cero.
- La WCS-WAVE se evalúa por píxel y respeta los desplazamientos de recorte. Es la calibración aproximada de visualización; no se aplicaron CWAVE/CBAND.
- La reproyección es de visualización. El RGB comprueba cuadrícula, coordenadas y unidades, pero **no homogeneiza PSF**. No debe usarse para inferencia cuantitativa sobre fuentes compactas.
- Las muestras pueden proceder de diferentes exposiciones y épocas. Ni la cercanía en fecha ni el uso del mismo detector garantizan la misma respuesta espectral LVF. La comprobación de λ es conservadora y no sustituye integrar respuestas instrumentales.
- El ejercicio de absorción es sintético desde su etiqueta inicial. La referencia NASA/Webb pertenece a otro observatorio y explica el concepto; no valida una detección molecular en estos recortes.
- La escena 3D usa tamaños, colores, espesor y escala cartográfica ilustrativos. M31 conserva morfología espiral y una proyección orientativa basada en la referencia NASA. No se deduce su volumen de los datos infrarrojos ni se inventan parámetros físicos estelares ausentes.

## Pruebas y evidencias

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:juan
npm.cmd run test:juan:mission
npm.cmd run test:juan:3d
npm.cmd run test:juan:cronos
```

Los últimos tres permiten revisar hitos concretos. Los resultados y sus límites están en `docs/juan/VALIDACION.md`, `tests-final.txt`, `wcs-reference.json`, `real-measurements.json`, `http-local.json` y `performance.json`.

[Hitos](docs/juan/HITOS.md) · [Validación y fuentes](docs/juan/VALIDACION.md) · [Catálogo](docs/juan/catalog.json) · [Manifiesto real](public/demo/manifest.json)
