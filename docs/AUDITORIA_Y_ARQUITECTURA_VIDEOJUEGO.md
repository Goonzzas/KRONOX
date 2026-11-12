# KRONOX — AUDITORÍA TÉCNICA COMPLETA Y ARQUITECTURA DE TRANSFORMACIÓN EN VIDEOJUEGO

## 1. DIAGNÓSTICO DE LA ARQUITECTURA ACTUAL

### 1.1. Motor y Tecnología de Renderizado 3D
- **Motor 3D**: `Three.js v0.128.0` con `WebGLRenderer` (`antialias: true`, `powerPreference: 'high-performance'`, `logarithmicDepthBuffer: true`, `ACESFilmicToneMapping`, `toneMappingExposure: 0.96`, `sRGBEncoding`).
- **Framework UI y Estado**: `React 18.3.1` sobre `Vite 8.3.5`. No utiliza Redux ni Zustand; el estado se reparte entre el componente raíz `src/App.jsx` (~3,110 líneas), variables en clausura dentro de `src/scene/createScene.js` (~4,575 líneas) y persistencia en `localStorage`.
- **Comunicación React ↔ Three.js**: Se realiza mediante un puente imperativo global `window.__KRONOX_SCENE_API` (accesible por `A()`) y callbacks inyectados en `createScene(host, callbacks)`.

### 1.2. Arquitectura de Escenas y Jerarquía de Objetos
Todo el universo se instancia dentro de una única escena `THREE.Scene` (`sc` en `src/scene/createScene.js`) con los siguientes subgrafos principales:
1. **`observerFirmament.root` (`src/scene/observerSkyAndUnification.js`)**: Bóveda celeste anclada a la posición de la cámara con 3 capas (catálogo estelar brillante J2000, campo estelar profundo procedural de 4,500 estrellas y banda difusa galáctica en coordenadas ecuatoriales).
2. **Sistema Solar (`bs[]`, `os[]`, `ss[]`, `ast`, `kui`)**:
   - Sol (`sun`, `sunGlow`, `cor`, `pl` `PointLight`, `sunDirLight` `DirectionalLight`).
   - 8 planetas (`P` en `src/data/planetData.js`) con elementos keplerianos referidos a **J2000.0 (`2000-01-01T12:00:00Z`)**, anillos de Saturno/Urano y 8 lunas principales (`MN`: Luna, Fobos, Deimos, Ío, Europa, Ganímedes, Calisto, Titán).
   - Cinturón principal de asteroides (`ast`, 2,000 puntos) y Cinturón de Kuiper (`kui`, 1,800 puntos).
3. **`galaxyGroup` y `deepFieldGroup`**: Representaciones para escalas cartográficas regional, estelar, galáctica y extragaláctica (`src/scene/navigationScale.js`).
4. **`ship` (`THREE.Group`, `src/scene/createScene.js:2112–2232`)**: Modelo exterior del crucero científico de exploración (`SHIP_LENGTH_METERS = 120`).
5. **`localCabinWorld` (`src/scene/habitableShipWorld.js`)**: Interior habitable del puente de mando construido en escala métrica local (`1 unidad = 1 metro`, dimensiones `14 m × 4.3 m × 24 m`), con 5 consolas físicas (`nav`, `science`, `comms`, `mission`, `windows`), astronauta articulado de `1.75 m` (`astronautRig`) y núcleo lumínico 3D de Kronox IA (`kronoxEntity`).

### 1.3. Escalas, Unidades y Sistema de Coordenadas (Origen de la Colisión de Escalas)
El sistema actual mezcla **tres convenciones de escala incompatibles** dentro del mismo `THREE.Scene`:
- **Modo Visual Comprimido (`real = false`, activo por defecto)**:
  - Radio planetario: `Rd(p) = Math.max(0.18, Math.min(4.2, Math.pow(p.km / 6371, 0.92) * 0.35))` → La Tierra mide **`0.35` unidades** (`6,371 km` reales) y Júpiter **`3.84` unidades** (`69,911 km` reales).
  - Distancia heliocéntrica: `Dd(au) = 14 + 20 * Math.pow(au, 0.68)` → `1 AU = 34` unidades de escena.
- **Modo Escala Real (`real = true`)**:
  - `1 unidad de escena = 1,000,000 km` (`10^9 m`).
  - La Tierra tiene radio `0.006371` unidades y `1 AU = 149.59787` unidades.
- **Modo Métrico de Cabina (`localCabinWorld`)**:
  - `1 unidad de escena = 1 metro`.
  - El puente habitable mide **`24.0` unidades de largo** (`24 metros`), pero al insertarse directamente en `sc` sin conversión de espacio ni pase de cámara separado, en unidades de escena es **34 veces más grande que el diámetro de la Tierra (`0.70` u)** en modo visual, y **1,883 veces más grande que la Tierra (`0.0127` u)** en modo `real = true`.

### 1.4. Cámaras, Control del Astronauta y Colisiones
- **Cámara única (`cam = new THREE.PerspectiveCamera(42, W/H, 0.00001, 500000)`)**:
  - Con `near = 1e-5` y `far = 5e5`, el rango dinámico de profundidad es de $5 \times 10^{10}$, mitigado parcialmente por `logarithmicDepthBuffer: true`, pero vulnerable a pérdida de precisión `Float32` en CPU/GPU cuando un modelo se escala a `1e-6` lejos del origen.
- **Modos de vista (`pv`)**:
  - `pv === 1`: Puente habitable en primera persona (`cabinFirstPerson === true`) o tercera persona (`cabinFirstPerson === false`).
  - `pv === 3`: Vista exterior / vuelo (`exteriorCameraMode` o persecución).
  - `pv === 0` / `2`: Vistas orbitales heredadas.
- **Astronauta (`habitableShipWorld.js`)**:
  - Movimiento cinemático en coordenadas locales del puente (`astronautState.pos`), velocidad `3.35 m/s`, amortiguamiento exponencial y resolución de colisiones 2D en el plano XZ (`resolveCabinPosition`) contra los límites del casco (`x ∈ [-5.8, 5.8]`, `z ∈ [-10.6, 8.8]`) y los cilindros de colisión de las 5 estaciones (`r + 0.42 m`).

### 1.5. Sistema de Interfaz, Narrativa y Kronox IA
- **Interfaz actual (`src/App.jsx`, `src/components/SpaceshipCockpit.jsx`, `src/components/NavigationDock.jsx`, `src/components/KronoxWidget.tsx`)**:
  - Acumula capas históricas de UI: dock izquierdo permanente (`NavigationDock`), barra superior completa (`kronoxBridgeTopBar`), widget de esquina + tarjeta de diálogo permanente (`KronoxWidget`), tarjeta heredada de planeta (`.in`), inspector flotante (`kronoxObjectInspector`), catálogo estelar (`StellarCatalogPanel`), notificaciones emergentes (`ToastNotification`) y objetivos centrales (`guideObjectiveHud`).
- **Kronox IA (`src/utils/kronoxAI.js`, `src/state/kronoxMessages.ts`)**:
  - Opera actualmente mediante un motor determinista de expresiones regulares (`askKronox`) y mensajes predefinidos (`KRONOX_MESSAGES`). No cuenta aún con el endpoint backend hacia Gemini para consultas abiertas contextualizadas.
- **Voz (`src/utils/voiceProvider.js`, `src/server/fishAudioTts.js`, `api/voice.js`)**:
  - Cola secuencial de síntesis de voz en cliente que consume `/api/fish-tts` (Fish Audio S2-Pro con caché en disco `.cache/fish-tts`) y `/api/voice` (Google Translate TTS con caché en memoria).

### 1.6. Sistema Científico SPHEREx y Guardado
- **SPHEREx (`src/components/SpherexMission.jsx`, `src/components/EvidenceLab.jsx`, `src/utils/fitsImage.js`, `src/utils/differentialImaging.js`, `src/utils/scientificEvidence.js`)**:
  - Procesa recortes FITS reales de NASA/IPAC IRSA (`public/spherex-data/real/`), astrometría WCS (`CRVAL`, `CRPIX`, matriz `CD`), fotometría diferencial, métricas de incertidumbre y validación honesta (preservando el estado `WARNING` en `WISE 0855`).
- **Persistencia (`src/utils/findingsStorage.js`)**:
  - Almacena hallazgos en `localStorage` bajo `kronox_scientific_findings_v1` y preferencias de usuario dispersas en claves `kronox_*`.

---

## 2. CAUSAS RAÍZ EXACTAS DE LOS 10 PROBLEMAS OBSERVADOS

### Problema 1: La nave desaparece al seleccionar la vista exterior
- **Archivos**: `src/scene/createScene.js` (`líneas 1584–1588`, `3136`, `3208`, `3835`, `3896`, `4486–4509`) y `src/App.jsx` (`línea 2669`).
- **Causa Técnica Triple**:
  1. **Escala microscópica incompatible**: `shipScale()` calcula `(Rd(P[3]) * (120 / 1000)) / (6371 * 2.5) = 0.0000026369` unidades en modo visual (y `4.8e-8` en modo real). A `34` unidades del origen (órbita terrestre), los vértices del modelo `ship` sufren cuantización severa en precisión simple `Float32` y quedan por debajo del umbral de recorte/subpíxel.
  2. **Temporizador de ocultación forzada (`kk`)**: Al activar vuelo libre (`setFree(true)`), `ti` se reinicia a `0`. En `tick()`, `kk = Math.min(1, Math.max(0, (ti - 2.6) / 2.4))` vale **`0` durante los primeros 2.6 segundos**. La línea `3896` ejecuta `ship.visible = (pv == 3 && (exteriorCameraMode || kk > 0.02))`, ocultando literalmente la nave durante 2.6 segundos y colocando la cámara en `sp + shipOffset * 0 = sp` (dentro del origen de la nave invisible).
  3. **Desactivación de `exteriorCameraMode` al pulsar `Exterior`**: En `App.jsx:2669`, el botón `Exterior` invoca `A().view(3)`, que en `createScene.js:4489` ejecuta `if (wasExteriorInspection) leaveExteriorCamera(true)`, saliendo del modo de inspección exterior en lugar de encuadrar la nave de 120 m.

### Problema 2: La nave parece gigantesca respecto a los planetas
- **Archivos**: `src/scene/createScene.js` (`líneas 2249–2358`, `3037–3062`) y `src/scene/habitableShipWorld.js` (`líneas 20–24`).
- **Causa Técnica**:
  - `localCabinWorld` está modelado a `1 unidad = 1 metro` (`24` unidades de longitud) y se posiciona directamente en el espacio del sistema solar (`localCabinWorld.position.copy(sp)` con `scale = 1,1,1`), donde la Tierra tiene radio `0.35` unidades (`real = false`) o `0.006371` unidades (`real = true`). En consecuencia, la cabina mide 34 veces más que el planeta Tierra dentro del mismo espacio de coordenadas.

### Problema 3: Los planetas ocupan una proporción visual físicamente incorrecta
- **Archivos**: `src/scene/createScene.js` (`líneas 1311–1355`, `1567–1582`) y `src/data/planetData.js`.
- **Causa Técnica**:
  - El modo por defecto (`real = false`) infla los radios planetarios (`Rd(p)`) y comprime las distancias heliocéntricas con una ley de potencia (`Dd(au) = 14 + 20 * au^0.68`). Así, Júpiter visto desde las inmediaciones de la Tierra subtiende un diámetro angular de `~8.8°` (17 veces la Luna llena) en lugar de sus `~32–49 segundos de arco` físicos, y las lunas galileanas aparecen como esferas gigantes visibles a simple vista desde cualquier punto del sistema solar.
  - Además, no existe distinción explícita entre **observación a simple vista**, **observación con instrumento óptico (telescopio con aumento angular)** y **mapa cartográfico de navegación**.

### Problema 4: Saturno y sus anillos pueden atravesar o invadir visualmente la cabina
- **Archivos**: `src/scene/createScene.js` (`líneas 1386–1400`, `1901`, `3050–3051`).
- **Causa Técnica**:
  - Los anillos de Saturno se extienden hasta `2.4 * b.r = 7.68` unidades desde el centro del planeta, mientras la proa de la cabina (`localCabinWorld`) se extiende `12.2` unidades hacia adelante desde `sp` (suma de radios de intersección = `19.88` unidades).
  - Sin embargo, al viajar a Saturno (`focus('Saturno')`), `clearance` coloca la nave a solo `b.r * 1.45 = 4.64` unidades (o `12.5` unidades), y la línea `3051` solo oculta el planeta si `distToShip < 12.0`. Entre `12.0` y `19.88` unidades, el cuerpo y los anillos de Saturno cortan físicamente el interior del puente de mando. Adicionalmente, el material de los anillos tiene `depthWrite: false`, provocando artefactos de ordenación alfa con los cristales del mirador.

### Problema 5: Efectos de velocidad y líneas de movimiento excesivos
- **Archivos**: `src/scene/createScene.js` (`líneas 2061`, `3931–3997`) y `src/App.jsx` (`línea 2790`).
- **Causa Técnica**:
  - El canvas a pantalla completa `<canvas id="warp" className="warp" />` se activa en `createScene.js:3954` siempre que `Math.log10(fs) > 1.4` (`fs > 25`) y la nave se desplace. Como la velocidad por defecto es `fs = 60`, cualquier desplazamiento básico dibuja **480 líneas radiales brillantes cian/naranja** sobre toda la escena.

### Problema 6: Varios paneles permanentes que compiten por la atención
- **Archivos**: `src/App.jsx` (`líneas 1316`, `1408`, `2078`, `2106`, `2207`, `2285`), `src/components/SpaceshipCockpit.jsx` (`líneas 199`, `422`), `src/components/NavigationDock.jsx`.
- **Causa Técnica**:
  - La aplicación renderiza simultáneamente hasta 7 contenedores flotantes permanentes (`NavigationDock`, `kronoxBridgeTopBar`, `KronoxWidget`, `.in`, `kronoxObjectInspector`, `StellarCatalogPanel`, `guideObjectiveHud`), apoyándose en scripts correctivos de DOM (`floatingOverlayLayout.js` y `flightPanelLayout.js`) en lugar de una arquitectura limpia de HUD mínimo + Menú de Pausa unificado (`ESC`).

### Problema 7: Los diálogos de Kronox IA se duplican con la introducción
- **Archivos**: `src/App.jsx` (`líneas 465`, `791–798`, `2106`, `2130`).
- **Causa Técnica**:
  - `onIntroStageChange(stageKey, captionText)` actualiza simultáneamente:
    1. `setRealTimeIntroCaption(captionText)` → subtítulo inferior de la introducción (`CinematicOpening`).
    2. `say(captionText)` → encola el mismo texto en `KronoxWidget`.
    3. `speak(captionText)` → llama a `openKronox()`, forzando la apertura de la tarjeta de diálogo de `KronoxWidget` encima de la introducción.

### Problema 8: Los objetivos y las tarjetas informativas se superponen
- **Archivos**: `src/App.jsx` (`líneas 848–863`, `985`, `2078`, `2207`, `2285`) y `src/components/SpaceshipCockpit.jsx` (`línea 422`).
- **Causa Técnica**:
  - Seleccionar o enfocar un cuerpo celeste activa a la vez el estado `f` (tarjeta `.in` heredada) y `selectedObject` (`kronoxObjectInspector`), además de disparar notificaciones `near` (`ToastNotification`) y un temporizador de trivialidades cada 38 segundos (`App.jsx:985`) en la misma región donde se ubican los objetivos de misión.

### Problema 9: Las consolas no siempre parecen formar parte de un espacio físico coherente
- **Archivos**: `src/components/SpaceshipCockpit.jsx` (`líneas 536–982`) y `src/scene/createScene.js` (`líneas 3769–3798`).
- **Causa Técnica**:
  - Aunque existen consolas 3D físicas con pantallas `CanvasTexture` en `habitableShipWorld.js`, al interactuar se superpone un contenedor HTML (`kronoxDiegeticConsole`) posicionado mediante proyección 2D de pantalla (`consoleProjection.x, y + 40`) sin encuadre suave de cámara ni transición diegética completa.

### Problema 10: Los controles de navegación y vuelo no se sienten integrados en una experiencia de videojuego
- **Archivos**: `src/App.jsx` (`líneas 1746–2032`), `src/components/SpaceshipCockpit.jsx` (`líneas 308–398`, `590–780`) y `src/scene/createScene.js` (`líneas 3140–3147`).
- **Causa Técnica**:
  - Los controles están fragmentados en cuatro interfaces distintas (pestaña heredada de ajustes con botones `▲▼◀▶`, `NavigationDock`, asistente multipaso en consola `nav` y paneles laterales `kronoxFreeHelmHud`), mientras en cabina el teclado mueve al astronauta o el guiñada de la nave sin sincronizar la orientación visual del piloto con el vector de vuelo.

---

## 3. ARQUITECTURA OBJETIVO POR ETAPAS

### Etapa 2: Fundamentos Físicos, Escala Astronómica, Cámara Exterior e Iluminación
1. **Sistema de Coordenadas de Precisión y Separación de Escala Métrica vs. Astronómica**:
   - La nave (`120 m` de eslora) y su interior habitable (`24 m` dentro del casco de `120 m`) comparten una **escala métrica coherente (`1 unidad local = 1 metro`)**.
   - Las posiciones planetarias se calculan con efemérides keplerianas referidas a la época **J2000.0 (`2000-01-01T12:00:00 UTC`)** en kilómetros/UA reales (`src/data/planetData.js`).
   - En los modos de **observación física** (Cabina 1P/3P, Mirador, Vista Exterior e Inspección Cercana), los cuerpos celestes mantienen su **diámetro angular físicamente exacto** $\theta = 2 \arctan(R_{\text{físico}} / D_{\text{físico}})$ respecto al observador mediante proyección relativa al observador libre de desbordamiento `Float32` y libre de colisión con la geometría de la cabina.
   - **Visibilidad Astronómica Realista**: Cuando el tamaño angular $\theta$ de un planeta o luna es inferior al poder de resolución del ojo humano (~1 minuto de arco), a simple vista se representa como un **astro puntual brillante** con magnitud aparente física $V$ calculada a partir de su distancia heliocéntrica $r$, distancia al observador $\Delta$ y ángulo de fase $\alpha$.
   - **5 Modos de Observación Explícitos**:
     - `A. Observación a simple vista (1×)`: Tamaño angular real; planetas lejanos se ven como puntos brillantes en el firmamento.
     - `B. Observación mediante instrumentos ópticos (Telescopio de a bordo 10× – 500×)`: Ampliación óptica real del campo de visión que resuelve el disco planetario, las bandas y lunas galileanas de Júpiter y los anillos de Saturno desde grandes distancias, mostrando retícula óptica, aumento y diámetro angular en segundos de arco (`″`).
     - `C. Vista de navegación del sistema solar`: Vista esquemática con indicación explícita `VISTA ESQUEMÁTICA DE NAVEGACIÓN · ESCALA COMPRIMIDA`.
     - `D. Vista de mapa astronómico`: Atlas cartográfico multiescala (Vecindad Estelar, Región Galáctica, Vía Láctea, Universo Local).
     - `E. Vista de inspección cercana / órbita planetaria`: Aproximación con compresión temporal identificada (`Modo de Tránsito Interplanetario`), distancia orbital segura fuera de anillos ($R_{\text{seguro}} > 2.6 R_{\text{planeta}}$) y relación de escala física real entre la nave de 120 m y el planeta.
2. **Cámara Exterior de la Nave de 120 m**:
   - Visibilidad inmediata del casco exterior de 120 m (`ship.visible = true` sin retraso de `2.6 s`), encuadre automático basado en el bounding box real de 120 m, rotación orbital suave, zoom acotado (`75 m – 600 m`), prevención de penetración en el casco y botón/tecla de restablecimiento de cámara.
3. **Dirección Artística e Iluminación**:
   - Eliminación de líneas de velocidad permanentes (`#warp` desactivado en navegación normal).
   - Materiales planetarios PBR (`MeshStandardMaterial`) sin autoemisión artificial (`emissive: 0x000000`), iluminación solar direccional coherente con terminador día/noche y atmósfera sutil.

### Etapa 3: Reconstrucción de la Interfaz como Videojuego
- **HUD Mínimo de Exploración**:
  - Solo muestra: botón discreto de pausa (`[ESC]`), indicador discreto de modo de observación/vista, objetivo activo (si existe), indicador contextual `[E]` al acercarse a una consola, telemetría esencial de vuelo solo al pilotar, e indicador/subtítulo único de Kronox IA solo mientras se comunica.
- **Menú de Pausa Unificado (`ESC`)** (`src/components/PauseMenu.jsx`):
  - Secciones: `1. Continuar`, `2. Guardar partida`, `3. Mis observaciones`, `4. Diario de exploración`, `5. Comunidad`, `6. Ajustes` (Gráficos, Audio, Controles, Accesibilidad, Interfaz, Voz y Kronox IA), `7. Controles`, `8. Volver al menú principal`.

### Etapa 4: Nave Habitable de 120 m e Interacciones Físicas
- Transición suave de cámara al operar cada estación (`nav`, `science`, `comms`, `mission`, `windows`), activación progresiva de pantallas 3D, sonido de confirmación y salida limpia con `ESC` o al alejarse.

### Etapa 5: Kronox IA (Motor Determinista + Backend Gemini + TTS/STT)
- Separación en 5 capas:
  1. Motor narrativo determinista local conectado al estado del juego sin repeticiones ni duplicación en la introducción.
  2. Endpoint backend seguro `/api/kronox-chat` (`api/kronox-chat.js`) que consume Google Gemini usando exclusivamente variables de entorno de servidor (`GEMINI_API_KEY` con rotación automática hacia `GEMINI_API_KEY_SECONDARY`..`GEMINI_API_KEY_8`), caché LRU, limitación de tasa y lista blanca de acciones.
  3. Síntesis de voz (`/api/fish-tts` y `/api/voice`) con caché y control completo de audio.
  4. Entrada por voz opcional (`Push-to-Talk` mediante `Web Speech API`, nunca micrófono abierto permanente).
  5. Caché de respuestas y degradación elegante a modo determinista si la red o cuota fallan.

### Etapa 6: Mis Observaciones, Diario de Exploración, Comunidad y Preservación SPHEREx
- Modelo de datos estructurado en `src/utils/findingsStorage.js`, `src/utils/expeditionJournal.js` y `src/utils/communitySchema.js` con distinción estricta entre `ANOTACIÓN DEL USUARIO · PENDIENTE DE VALIDACIÓN` y `OBSERVACIÓN VALIDADA`.
- Preservación íntegra del laboratorio científico SPHEREx (FITS, WCS, fotometría diferencial y estado `WARNING` de `WISE 0855`).

---

## 4. IMPLEMENTACIÓN DE FASE 1: SEPARACIÓN DE MUNDOS, PRECISIÓN DOBLE (FLOAT64) Y ESCALAS FÍSICAS

### 4.1. Arquitectura de Dos Mundos Separados (`localShipScene` vs. `sc`)
Para erradicar en la raíz la colisión de escalas donde `localCabinWorld` (`24 m`) se insertaba directamente dentro de la escena astronómica (`sc`), se ha diseñado e implementado una arquitectura de **dos escenas independientes renderizadas en dos pasos sobre un único `THREE.WebGLRenderer` (`R`)**:

1. **Mundo Local Métrico de la Nave (`localShipScene` — `KronoxLocalMetricShipScene`)**:
   - **Unidad invariante**: `1 unidad local = 1.00 metro`.
   - **Contenido**:
     - Modelo exterior de la nave (`ship` — `KronoxExteriorShip120m`) en el origen local `(0, 0, 0)` con escala métrica constante `SHIP_METRIC_SCALE = 120.0 / 2.61 ≈ 45.977011`, garantizando exactamente `120.0 m` de eslora, `92.87 m` de envergadura y `30.34 m` de altura en cualquier punto del universo.
     - Cabina interior habitable (`localCabinWorld` — `LocalHabitableShipWorld`) en `(0, 0, 0)` con escala `(1, 1, 1)` (`24.0 m` de largo, `13.6 m` de ancho, `4.2 m` de alto), 5 consolas físicas (`nav`, `science`, `comms`, `missions`, `windows`), astronauta de `1.75 m` (`1.65 m` de altura ocular), entidad lumínica 3D `Kronox IA` y sistemas físicos del puente.
     - Iluminación local (`localShipAmbient` + `localShipSunLight` sincronizada en cada fotograma con el vector heliocéntrico hacia el Sol `-sp.normalize()`).
     - Cámara métrica dedicada (`localCam`) con `near = 0.05 m` en cabina (`0.25 m` en vista exterior) y `far = 4000–6000 m`.

2. **Mundo Astronómico Físico (`sc` — `KronoxAstronomicalScene`)**:
   - **Unidad en modos de observación física (Modos 1, 2 y 5)**: `1 unidad astronómica de escena = 1.000.000 km = 10^9 m` (`1 UA = 149.5978707 unidades`).
   - **Contenido**: Sol, planetas, lunas, cinturón de asteroides, cinturón de Kuiper, firmamento J2000, estrellas del catálogo y galaxias.
   - **Eliminación de las fórmulas comprimidas en observación física**:
     - En todos los modos de observación física (`isPhysicalObservationActive() === true`), queda eliminada la fórmula inflada `Rd(p) = 0.35 * (p.km / 6371)` y la compresión exponencial `Dd(au) = 14 + 20 * Math.pow(au, 0.68)`.
     - Cada planeta utiliza estrictamente su radio físico real `physicalPlanetSceneRadius(p) = p.km / 1e6` y su posición orbital kepleriana J2000.0 real `physicalOrbitSceneDistance(au) = au * 149.5978707`.
     - Las lunas galileanas de Júpiter (`Ío`, `Europa`, `Ganímedes`, `Calisto`) utilizan sus radios físicos (`1821.6 km`, `1560.8 km`, `2634.1 km`, `2410.3 km`) y semiejes mayores físicos (`421.700 km` a `1.882.709 km`).

3. **Composición Multipaso en un Único `WebGLRenderer`**:
   - **Paso 1**: `renderWithOriginRebase(R, sc, cam, ...)` renderiza el universo astronómico restando en doble precisión (`Float64`) el origen de la cámara antes de subir matrices `Float32` a WebGL.
   - **Paso 2**: Si `localCabinWorld.visible || ship.visible`, se ejecuta `R.autoClear = false; R.clearDepth?.(); R.render(localShipScene, localCam);`, componiendo el interior habitable de 24 m o el casco exterior de 120 m con precisión sub-milimétrica sobre el universo astronómico de fondo.

### 4.2. Precisión Numérica en Doble Precisión (`Float64`) y Floating Origin (`src/scene/originRebase.js`)
- Las posiciones heliocéntricas de todos los cuerpos del Sistema Solar se almacenan en arreglos `Float64Array(3)` (`b.heliocentricScene64`) y objetos de doble precisión (`b.heliocentricAu`).
- En `renderWithOriginRebase`, el desplazamiento relativo entre cada cuerpo celeste y la cámara se calcula en 64 bits (`b.heliocentricScene64[i] - origin64[i]`) antes de construir las matrices de mundo `Float32` en GPU.
- La función `verifyFloatingOriginPrecision` demuestra cuantitativamente que mientras `Float32` directo a `1 UA` (`1.496 × 10^11 m`) introduce errores de cuantización superiores a `4–16 metros` (destruyendo una nave de `120 m`), la arquitectura de doble precisión + `localShipScene` mantiene un error local de `0.00000 m` a `1 UA` y a `30.07 UA` (Neptuno).

### 4.3. Documentación del Catálogo Planetario (`CATALOG_DOCUMENTATION_NOTES`)
- El archivo `src/data/planetData.js` se conserva íntegro y aporta: `km` (radio ecuatorial/volumétrico medio), `au` (semieje mayor), `e` (excentricidad), `inc` (inclinación), `Om` ($\Omega$), `w` ($\omega$), `M0` (anomalía media J2000.0), `per` (periodo orbital), `rot` (periodo de rotación) y `tl` (oblicuidad axial).
- En `PLANETARY_PHYSICAL_CATALOG` y `CATALOG_DOCUMENTATION_NOTES` (`src/scene/astronomicalScaleEngine.js`) se documentan explícitamente los parámetros que no figuraban en `planetData.js`:
  1. Inclinación orbital (`5.145°`) y excentricidad (`0.0549`) de la Luna.
  2. Radios físicos en km y semiejes mayores en km de las lunas galileanas (`Ío`, `Europa`, `Ganímedes`, `Calisto`), que en el código original estaban codificados como múltiplos visuales (`2.05` a `4.75 R_Jup`).
  3. Satélites principales de Saturno (`Titán`, `Encélado`) y Marte (`Fobos`, `Deimos`).
  4. Albedo geométrico visual ($p_V$) y magnitud absoluta planetaria $H = V(1,0)$ para el cálculo fotométrico de magnitud aparente $V(r, \Delta, \alpha)$.

### 4.4. Cinco Modos Explícitos de Observación y Navegación
1. **Modo 1 — Vista a simple vista (`naked-eye`, `1×`)**:
   - Tamaño angular físico real $\theta = 2 \arctan(R / D)$. Los planetas lejanos con $\theta < 60''$ se representan como astros puntuales gobernados por su magnitud aparente $V$.
2. **Modo 2 — Vista telescópica (`optical-instrument`, `10×` a `500×`)**:
   - Pasos seleccionables `[10×, 50×, 150×, 300×, 500×]`.
   - Reduce ópticamente el campo de visión de la cámara astronómica según $\text{FOV}(M) = 2 \arctan(\tan(\text{FOV}_0 / 2) / M)$ **sin inflar jamás el radio 3D del planeta (`b.tilt.scale`)**, mostrando retícula óptica, aumento, tamaño angular en segundos de arco (`″`), inclinación axial (`axialTiltDeg`) y lunas resolubles (`resolvableMoons`).
3. **Modo 3 — Mapa de navegación (`solar-navigation`)**:
   - Vista cartográfica del sistema solar claramente identificada con el rótulo permanente `VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA`.
4. **Modo 4 — Mapa astronómico (`astronomical-map`)**:
   - Atlas multiescala (`solar`, `stellar`, `regional`, `milkyway`, `extragalactic`) identificado con `VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA`.
5. **Modo 5 — Inspección cercana (`close-inspection`)**:
   - Órbita de inspección física segura fuera de atmósferas y anillos ($R_{\text{seguro,Saturno}} = 2.85 R_{\text{Saturno}} \approx 165.961\text{ km} > R_{\text{anillos,ext}} = 139.756,8\text{ km}$), con tránsito interplanetario identificado mediante `TRÁNSITO CON COMPRESIÓN TEMPORAL`.

---

## 5. FASE 2: REDISEÑO DE LA EXPERIENCIA DE VIDEOJUEGO, MENÚ DE PAUSA Y DIRECCIÓN ARTÍSTICA

### 5.1. Bloque A: HUD Limpio de Videojuego (Despeje de Pantalla)
- **Desaparición de Elementos Permanentes Intrusivos**:
  - Se eliminaron del HUD habitual durante la exploración a pie: barra superior fija de doble fila, telemetría fija de coordenadas X/Z, velocímetro permanente en primera persona, botones saturadores de cielo y ajustes, y la caja flotante duplicada de recorrido guiado (`.guideObjectiveHud`).
- **HUD Mínimo de Exploración**:
  - Limitado exclusivamente a:
    1. Acceso discreto al menú de pausa mediante `ESC` (y botón compacto `Pausa`).
    2. Identificador discreto `KRONOX · 120m`.
    3. Conmutador de cámara `[C] Cabina 1P / Exterior 120m`.
    4. Conmutador de telescopio `[T] Simple vista 1× / Telescopio`.
    5. Indicación contextual de interacción diegética (`[E] Operar consola...`).
    6. Indicador de objetivo compacto (`◎ OBJETIVO: ...`) en una sola píldora integrada en la barra superior.
    7. Subtítulos breves cuando Kronox IA se comunica.

### 5.2. Bloque B: Menú de Pausa Centralizado (`ESC`) y Detención de Simulación
- **Pausa de la Simulación Física (`setSimulationPaused`)**:
  - Al pulsar `ESC` o hacer clic en `Pausa`, la simulación física planetaria, el desplazamiento del astronauta (`astronautVel.set(0,0,0)`), la velocidad de vuelo (`flightVel.set(0,0,0)`), las órbitas keplerianas y los inputs de ratón/teclado se pausan de forma limpia.
  - Al reanudar, el reloj consume el delta (`clk.getDelta()`) sin saltos temporales ni desplazamientos bruscos de cámara.
- **Estructura Unificada de 8 Secciones**:
  1. `1. Continuar`: Reanuda la simulación inmediatamente.
  2. `2. Guardar partida`: Almacena efemérides J2000.0, posición orbital, modo de observación y estado de la nave en `localStorage`.
  3. `3. Mis observaciones`: Registro científico con distinción epistémica estricta.
  4. `4. Diario de exploración`: Bitácora de viaje con historial de inspecciones y eventos.
  5. `5. Comunidad`: Arquitectura de ciencia ciudadana federada (documentada honestamente como planificada).
  6. `6. Ajustes`: Pestañas de Gráficos (conmutación entre Cielo Científico y Cielo Cinematográfico), Audio, Controles, Accesibilidad, Interfaz y Voz.
  7. `7. Controles`: Guía completa de teclado, ratón y teclas contextuales (`[ESC]`, `[E]`, `[C]`, `[T]`, `[R]`, `[WASD]`).
  8. `8. Volver al menú principal`: Con modal de confirmación antes de salir.

### 5.3. Bloque C: Consolas Diegéticas de Cabina 3D
- **Presencia Física en el Espacio Tridimensional**:
  - La nave contiene 5 consolas habitables físicas:
    1. `nav`: Timón y cartografía estelar.
    2. `science`: Laboratorio de análisis espectral y fotometría SPHEREx.
    3. `missions`: Catálogo de misiones de exploración.
    4. `comms`: Canal de comunicaciones e interrogación de Kronox IA.
    5. `windows`: Puesto de observación panorámico hacia el ventanal exterior.
- **Interacción Contextual y Salida Limpia**:
  - Al aproximarse a una consola a menos de 2.45 m, se muestra el indicador `[E] Operar...`.
  - La tecla `ESC` cierra la consola activa y regresa al control del astronauta antes de abrir el menú de pausa.

### 5.4. Bloque D: Rediseño de la Comunicación de Kronox IA
- **Subtítulos Contextuales Auto-Dismiss**:
  - Kronox IA se comunica mediante subtítulos contextuales que aparecen durante la locución y desaparecen automáticamente al terminar (`onMessageComplete`), sin dejar tarjetas vacías en pantalla.
- **Eliminación de la Ventana de Chat Fija**:
  - El cajón de comandos y el historial solo se abren voluntariamente desde la consola `comms` o pulsando voluntariamente sobre la entidad luminosa.
- **Eliminación de Duplicados e Interrupciones**:
  - Se eliminó el registro de subtítulos de la introducción cinematográfica en la cola de Kronox IA (`say(captionText)` retirado de `onIntroStageChange`).
  - Se eliminó el intervalo de 38 segundos que interrumpía con datos astronómicos aleatorios durante la exploración a pie.

### 5.5. Bloque E: Dirección Artística de la Nave y Atmósfera Espacial
- **Materialidad PBR Sobria y Creíble**:
  - Suelo de cubierta: planchas de grafito estructurado (`0x111622`, `roughness: 0.82`, `metalness: 0.32`).
  - Pasarela central: polímero mate antirreflectante (`0x182030`, `roughness: 0.68`).
  - Mamparos interiores: titanio cepillado (`0x1a2436`, `metalness: 0.68`).
  - Arcos estructurales: acero reforzado (`0x24324a`).
  - Guías luminosas de orientación: perfiles LED empotrados discretos con emisión atenuada (`emissiveIntensity: 0.16`), eliminando el efecto de carriles de neón cegadores.
  - Ventanal de proa: cristal físico de alta transmitancia (`MeshPhysicalMaterial`, `transmission: 0.94`, `opacity: 0.08`, `roughness: 0.03`) que permite observar el universo con claridad sin velos artificiales.
- **Iluminación Cinematográfica Equilibrada**:
  - Luz hemisférica suave (`HemisphereLight(0x141f33, 0x070c16, 0.52)`) para evitar negros empastados.
  - Luces puntuales empotradas con atenuación y caída suave en puente (`0.65`), proa (`0.45`) y popa (`0.35`).

### 5.6. Bloques F y G: Mis Observaciones y Comunidad Científica
- **Distinción Epistémica Rigurosa**:
  - Las notas personales se clasifican estrictamente como `PERSONAL_ANNOTATION` (`Anotación personal del explorador — No validada`), sin confundirse con observaciones astronómicas validadas.
- **Comunidad Presentada con Honestidad**:
  - El módulo de Comunidad se describe formalmente con estado `PLANNED_ARCHITECTURE`, sin inventar usuarios falsos ni actividad simulada en backend.
  - Proporciona esquemas formales JSON Schema v1.0 para 7 entidades de federación ciudadana (`SharedObservation`, `PeerReview`, `ScientificHypothesis`, `CommunityChallenge`, `AstrometricContribution`, `TargetProposal`, `EpistemicAttestation`).



