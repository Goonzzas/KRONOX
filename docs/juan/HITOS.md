# Hitos funcionales para revisar con Gonza

## 1. Misión científica y demo real sin red

**Cambio:** se conserva el cuaderno y su persistencia; ahora admite pregunta, conclusión y evidencia estructurada. Solo esos registros producen el estado «investigación completada». Una nota suelta o visitar el cierre no basta. «Evidencia insuficiente» es válida con explicación y una muestra inspeccionada, incluso si lo que se constata es falta de datos válidos.

**Archivos principales:**

- `src/components/SpherexMission.jsx`: integración, estados de archivo y cierre.
- `src/components/EvidenceLab.jsx`: extracción visible y conclusión sustentada.
- `src/utils/scientificEvidence.js`, `findingsStorage.js`, `archiveClient.js` y `fitsCard.js`.
- `src/utils/fitsImage.js`: opciones de rejilla, unidades y WCS-WAVE.
- `src/data/localObservations.js`, `public/demo/`.
- `tests/juan-science.test.mjs`, `juan-component.test.mjs`, `juan-wcs-reference.test.mjs`.

**Cómo probar:** abrir `?target=m31&voice=false`, entrar en Exploración, cargar muestras, inspeccionar una fila y guardar conclusión con justificación. Abrir Cierre. Recargar y comprobar el cuaderno. Para contrastar, abrir el cierre en un navegador/perfil sin registros: debe aparecer recorrido libre, sin investigación completada.

**Resultado comprobado:** prueba React ejecutada con solicitudes externas rechazadas: 3 productos de M31, selección, conclusión, persistencia y restauración. Prueba del núcleo también para Barnard/RW Aurigae. Los 13 FITS pasan hash y entrega HTTP.

**Dependencias:** utiliza los datos locales congelados y la corrección de unidades/calibración. No depende de las mejoras 3D ni de Cronos para completar una investigación desde el observatorio.

## 2. Representación 3D y vuelo

**Cambio:** el polvo de los destinos utilizaba `PointsMaterial` sin mapa circular y generaba una huella cuadrada; además, la esfera era muy pequeña respecto a la distancia de llegada. El nuevo destino usa superficie, halo suave y detalle creado al aproximarse. Las partículas genéricas reutilizan una textura circular. Para M31 se usa una galaxia ilustrativa de disco/bulbo, no una esfera estelar ni una reconstrucción de datos. Se añaden frenado, inspección orbital, cambio de vista, regreso al mapa y acceso al observatorio del destino activo.

**Archivos:** `src/scene/destinationVisuals.js`, `src/scene/createScene.js`, `src/App.jsx`, estilos en `src/styles/evidenceLab.css`.

**Cómo probar:** desde Misiones científicas viajar a Barnard y a M31. Al llegar, comparar el destino con el espacio circundante, frenar, orbitar e inspeccionar, alternar vista, abrir su observación y volver al mapa. Los controles de diagnóstico permiten capturar 600 fotogramas y consultar estadísticas de rAF y contadores del renderer. Mantener destino, viewport, calidad, posición y periodo de calentamiento iguales al comparar versiones.

**Resultado comprobado:** construcción de objetos Three.js con superficie diferida, ausencia de partículas cuadradas en destinos, geometría compartida, presupuesto y liberación de recursos. La esfera pasa de 2976 a 720 triángulos. Esto es un dato de geometría, no una medición de FPS. La inspección visual y el benchmark GPU siguen pendientes por el bloqueo de automatización.

**CPU medido con igual FITS, centro, rejilla 300 y FOV 0.5°:** mediana antes 63.36 ms; después 70.21 ms, cinco repeticiones tras calentamiento. No hubo mejora en ese benchmark. La opción de pantalla de 96 píxeles produjo 9.66 ms, pero cambia la resolución y no es una comparación equivalente ni de FPS. Las mediciones nativas usadas para el espectro no se reducen a esa rejilla.

**Dependencias:** necesita el modelo de destino del hito 1 y el catálogo para identificar la galaxia. No requiere el laboratorio RGB ni un proveedor de IA. No se afirma que el acercamiento original se haya reproducido visualmente; la causa identificada es de código y falta corroborarla en pantalla.

## 3. Análisis, catálogo y robustez de archivo

**Cambio:** espectro de puntos separados con unidades, varianzas, calidad, apertura y procedencia; RGB en worker con rejilla/unidades compatibles; vistas individuales; distinción entre fechas y λ; ejemplo sintético de absorción/continuo. Catálogo clasificado de 20 casos reutilizando galaxias existentes, sin promover disponibilidad de archivo a detección científica.

**Archivos:** `EvidenceLab.jsx`, `scientificEvidence.js`, `rgbComposite.js`, `workers/rgbWorker.js`, `data/researchCatalog.js`, `SpherexMissionSelector.jsx`, `api/spherex.js`, `differentialImaging.js` y pruebas `juan-*`.

**Cómo probar:** M31 → cargar muestras → inspeccionar tabla y barras → abrir RGB y cambiar canales → revisar etiquetas de λ → abrir astroquímica y cambiar profundidad. En la consulta en vivo, un fallo parcial debe conservar su advertencia. En comparación de fechas, distintos detectores/λ no habilitan una resta temporal defendible. Para archivo inválido o timeout, la carga termina con error y permite reintentar o cambiar a datos locales.

**Resultado comprobado:** 3 destinos con píxeles locales validados, 11 con productos encontrados en QR2 y 6 pendientes. RGB determinista, huecos y varianzas probados; errores de red, timeout, consulta parcial y FITS inválido cubiertos. Calibración espacial/espectral comparada independientemente en 39 posiciones.

**Auditoría de los problemas mencionados:**

- Backend de consulta parcial: **ya estaba corregido**; se añadieron regresiones. Se corrigió la interfaz, que no mostraba esos metadatos.
- Señal de timeout reutilizada: **ya estaba corregida** en el backend, que crea una señal por intento. Se verificó sin reescribirlo innecesariamente.
- Fondo diferencial: **confirmado y corregido**. Antes se seleccionaba control comparando cada intensidad con `medianDiff + 1.5`. Ahora cada entrada usa su propia mediana/NMAD y se conservan los pares residuo/σ durante la auditoría. Faltando varianzas se rechaza una significancia inventada.
- Unidades FITS: **fallo adicional confirmado y corregido**. La separación ciega por `/` truncaba `MJy / sr` a `MJy`. Ahora se respeta el contenido entre comillas.
- WCS-WAVE: se aplican CRVAL/CDELT/CRPIX de la WCS alternativa W, sin extrapolar la tabla ni tratar todo el detector como una sola longitud de onda.

**Dependencias:** extracción y cuaderno del hito 1. RGB no exige cambios de vuelo. Las seis entradas pendientes no están habilitadas como destinos científicos con coordenadas inventadas.

## 4. Cronos contextual local

**Cambio:** se conserva el personaje y la interfaz a la derecha. La ayuda recibe objetivo, pantalla, producto, banda, selección, apertura, unidades, mediciones e incertidumbres. Reconoce explícitamente la ausencia de espectro y el modo sintético. Una selección alta no se convierte en una detección molecular.

**Archivos:** `src/utils/contextualScienceHelp.js`, `src/utils/kronoxAI.js`, `src/App.jsx`, `EvidenceLab.jsx`, pruebas de integración.

**Cómo probar:** antes de cargar muestras preguntar «¿qué representa este eje?». Después de inspeccionar una fila, preguntar «¿qué puedo concluir de este pico?». Preguntar «¿qué es una banda infrarroja?». Abrir la sección sintética y preguntar qué se está viendo.

**Resultado comprobado:** respuestas locales sobre datos cargados, unidades reales, incertidumbre y ausencia de muestras; rechazo de contexto de un objetivo anterior. No hay proveedor LLM configurado, nuevas claves ni llamadas externas de chat. La voz existente sigue siendo independiente y puede depender de red; el guion de demo la deja desactivada.

**Dependencias:** contexto del hito 1. Funciona sin las mejoras 3D y sin conexión. No se configuró un proveedor de IA que no existía en el proyecto.

## Selección de cambios para incorporar

La copia completa es el resultado principal. `docs/juan/changes.patch` permite revisar diferencias textuales contra el original; los FITS son binarios y están en `public/demo/`. `changed-files.json` clasifica los archivos nuevos/modificados y excluye dependencias/compilaciones. No hay commits que cherry-pickear. Los archivos compartidos (App, misión y catálogo) contienen integración de varios hitos: Gonza debe revisar esos cambios junto con las dependencias indicadas, no aplicar un archivo compartido como si fuera un hito aislado.
