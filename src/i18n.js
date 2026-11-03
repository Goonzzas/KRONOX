export const LANGUAGES = [
  { code: 'es', name: 'Español', native: 'Español', voice: 'es-US' },
  { code: 'en', name: 'English', native: 'English', voice: 'en-US' },
];

const spanishCountries = new Set([
  'AR',
  'BO',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'ES',
  'GQ',
  'GT',
  'HN',
  'MX',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SV',
  'UY',
  'VE',
]);

export function hasSavedLanguage() {
  try {
    return LANGUAGES.some((language) => language.code === localStorage.getItem('kronox-language'));
  } catch {
    return false;
  }
}

export function detectLanguage() {
  try {
    const stored = localStorage.getItem('kronox-language');
    if (LANGUAGES.some((language) => language.code === stored)) return stored;
  } catch {
    /* Use the browser's locale when storage is unavailable. */
  }
  const locales = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || 'en-US'];
  for (const locale of locales) {
    try {
      const parsed = new Intl.Locale(locale);
      if (parsed.language === 'es' || spanishCountries.has(parsed.region)) return 'es';
      if (parsed.language === 'en') return 'en';
    } catch {
      /* Ignore malformed browser locale values. */
    }
  }
  return 'en';
}

const en = {
  'Kronox, guía astral': 'Kronox, astral guide',
  'Kronox · guía astral': 'Kronox · Astral Guide',
  'transmitiendo…': 'transmitting…',
  'en línea': 'online',
  'Cerrar panel de Kronox': 'Close Kronox panel',
  'Silenciar voz': 'Mute voice',
  'Activar voz': 'Enable voice',
  'Acento de Kronox': 'Kronox voice',
  Latino: 'Latin American',
  España: 'Spain',
  'La voz alternativa requiere internet y envía los avisos de Kronox a Google para generar el audio.':
    'Voice playback requires an internet connection and sends Kronox messages to Google to generate audio.',
  'SEÑAL NUEVA · SPHEREx': 'NEW SIGNAL · SPHEREx',
  '¿Rastreamos estrellas en movimiento o comparamos el brillo de estrellas variables?':
    'Track moving stars or compare the brightness of variable stars?',
  'Preparando el salto…': 'Preparing jump…',
  'Elegir misión': 'Choose mission',
  '¿Qué misión quieres hacer?': 'Which mission would you like to take?',
  'KRONOX · PLANIFICACIÓN DE MISIÓN': 'KRONOX · MISSION PLANNING',
  'Elige un tipo de búsqueda y el objetivo. Kronox fijará el destino y preparará el salto.':
    'Choose a search type and target. Kronox will set the destination and prepare the jump.',
  MISIÓN: 'MISSION',
  'Los destinos aparecen cerca del Sol en el mapa: todos son objetivos del vecindario galáctico observado.':
    'Targets appear near the Sun on the map; all are in the observed galactic neighborhood.',
  'Rastreo de estrellas': 'Stellar motion search',
  'Sigue fuentes cercanas y busca desplazamientos frente al fondo estelar.':
    'Track nearby sources and look for motion against the stellar background.',
  'Descubre si una fuente cambia de posición con el tiempo y regístrala sobre el fondo de estrellas.':
    'Find out whether a source changes position over time and mark it against the star field.',
  'Estrellas variables': 'Variable stars',
  'Compara observaciones y detecta cambios de brillo.':
    'Compare observations and detect changes in brightness.',
  'Compara las observaciones de esta estrella variable y registra cómo cambia su brillo entre fechas.':
    'Compare observations of this variable star and record how its brightness changes over time.',
  'Estrella de Barnard': 'Barnard’s Star',
  '≈ 6 años luz': '≈ 6 light-years',
  'Enana roja cercana con gran movimiento propio.': 'A nearby red dwarf with high proper motion.',
  'Sistema de dos enanas marrones: Ba y Bb.': 'A pair of brown dwarfs: Ba and Bb.',
  '≈ 12 años luz': '≈ 12 light-years',
  '≈ 7,4 años luz': '≈ 7.4 light-years',
  'Enana marrón de rápido movimiento; coordenadas del reto.':
    'A fast-moving brown dwarf; coordinates supplied in the challenge.',
  '≈ 450 años luz': '≈ 450 light-years',
  'Sistema estelar joven y variable.': 'A young, variable stellar system.',
  'distancia aproximada': 'approximate distance',
  'Estrella variable Mira de largo período.': 'A long-period Mira variable star.',
  'Fecha desconocida': 'Unknown date',
  'Elige un objetivo o introduce coordenadas y consulta el archivo.':
    'Choose a target or enter coordinates and search the archive.',
  'Consultando las observaciones públicas de IRSA…': 'Searching public IRSA observations…',
  'Falló la consulta al archivo.': 'Archive search failed.',
  'No hay imágenes SPHEREx disponibles para estas coordenadas en este lanzamiento.':
    'No SPHEREx images are available for these coordinates in this data release.',
  'No se pudo completar la consulta.': 'The search could not be completed.',
  'No se pudo abrir el recorte.': 'Could not load the image cutout.',
  'Sin observación anterior': 'No previous observation',
  Objetivo: 'Target',
  Banda: 'Band',
  'Fecha anterior': 'Previous date',
  'Fecha actual': 'Current date',
  'X del visor (%)': 'Viewer X (%)',
  'Y del visor (%)': 'Viewer Y (%)',
  Hallazgo: 'Finding',
  'MISIÓN 01 · OBSERVATORIO INFRARROJO': 'MISSION 01 · INFRARED OBSERVATORY',
  'Objetivos de la misión': 'Mission targets',
  'Coordenadas ICRS · grados': 'ICRS coordinates · degrees',
  'Ascensión recta (RA)': 'Right ascension (RA)',
  'Declinación (Dec)': 'Declination (Dec)',
  Lanzamiento: 'Data release',
  'QR3 · más reciente': 'QR3 · latest',
  'QR2 · archivo anterior': 'QR2 · earlier archive',
  'Buscando…': 'Searching…',
  'Consultar SPHEREx': 'Search SPHEREx',
  'Se muestran como máximo 250 resultados.': 'Showing up to 250 results.',
  'SECUENCIA DE OBSERVACIONES': 'OBSERVATION SEQUENCE',
  Todas: 'All bands',
  'Comparando:': 'Comparing:',
  'Comparar 2 imágenes': 'Compare 2 images',
  'Ocultar comparación': 'Hide comparison',
  'Primera fecha': 'First date',
  'Elegir primera imagen para comparar': 'Choose the first image to compare',
  'Segunda fecha': 'Second date',
  'Elegir segunda imagen para comparar': 'Choose the second image to compare',
  '＋ Marcar cambio': '＋ Mark change',
  'Haz clic en cualquiera de las dos imágenes': 'Click either image',
  'Describe el cambio entre las dos fechas…': 'Describe the change between the two dates…',
  'Imagen actual': 'Current image',
  'Segunda imagen': 'Second image',
  'Cargando imagen…': 'Loading image…',
  'Elige otra fecha para comparar.': 'Choose another date to compare.',
  'La imagen no está disponible.': 'The image is unavailable.',
  'primera observación': 'first observation',
  ' · la escala de brillo se mantiene fija en la secuencia':
    ' · brightness scale stays fixed throughout the sequence',
  'Procesando recorte de la imagen…': 'Processing image cutout…',
  'Buscando en el archivo…': 'Searching the archive…',
  'Aquí aparecerán los recortes del cielo': 'Sky images will appear here',
  'Imagen anterior': 'Previous image',
  'Imagen siguiente': 'Next image',
  Pausar: 'Pause',
  '▶ Reproducir': '▶ Play',
  'Las observaciones disponibles aparecerán ordenadas por fecha.':
    'Available observations will be ordered by date.',
  'Registrar hallazgo': 'Record a finding',
  '¿Qué cambió?': 'What changed?',
  'Marca una fuente en la imagen y anota lo que observas.':
    'Mark a source in the image and describe what you see.',
  'Haz clic en una fuente…': 'Click a source…',
  '＋ Marcar objeto': '＋ Mark object',
  'Descargar CSV': 'Download CSV',
  'Ej.: la fuente se desplazó hacia el borde…': 'Example: the source moved toward the edge…',
  'Descripción del cambio observado': 'Describe the observed change',
  'Guardar hallazgo': 'Save finding',
  'Eliminar hallazgo': 'Delete finding',
  Ampliar: 'Expand',
  'Imagen SPHEREx ampliada': 'Expanded SPHEREx image',
  'Cerrar ✕': 'Close ✕',
  'MISIÓN 0': 'MISSION 0',
  'Objetivos de la misión': 'Mission targets',
  'Superficie / estructura': 'Surface / structure',
  Composición: 'Composition',
  Atmósfera: 'Atmosphere',
  Temperatura: 'Temperature',
  Clima: 'Climate',
  'Dato curioso': 'Did you know?',
  'Cerrar ficha': 'Close info card',
  Cerrar: 'Close',
  'Ficha de ': 'NASA factsheet for ',
  'Temperaturas del sistema solar': 'Solar system temperatures',
  'Imagen y datos: NASA. Las temperaturas de los gigantes gaseosos y helados corresponden a una capa atmosférica de referencia, no a una superficie sólida.':
    'Image and data: NASA. Temperatures for gas and ice giants refer to an atmospheric reference level, not a solid surface.',
  'Controles táctiles de vuelo': 'Touch flight controls',
  'Dirección de la nave': 'Spacecraft direction',
  Subir: 'Climb',
  Bajar: 'Descend',
  'Reducir velocidad': 'Reduce speed',
  'Aumentar velocidad': 'Increase speed',
  'Mostrar nombres': 'Show names',
  'Pulsar para habilitar mi voz y continuar.': 'Enable my voice and continue.',
  'El navegador bloqueó el audio. Pulsa «Activar voz» otra vez.':
    'Your browser blocked audio. Press “Enable voice” again.',
  'No se pudo cargar la voz en español. Revisa tu conexión a internet.':
    'Could not load the voice. Check your internet connection.',
  'No se pudo reproducir la voz en español. Revisa tu conexión a internet.':
    'Could not play the voice. Check your internet connection.',
  'Tres.': 'Three.',
  'Dos.': 'Two.',
  'Uno.': 'One.',
  'A tu lado, explorador. Soy Kronox, tu guía astral.':
    'At your side, explorer. I am Kronox, your astral guide.',
  'Sistema Solar 3D': '3D Solar System',
  Ocultar: 'Hide',
  Menú: 'Menu',
  Interfaz: 'Interface',
  'Nave espacial': 'Spaceship',
  'Misión espacial': 'Space mission',
  Móvil: 'Mobile',
  PC: 'Desktop',
  'Nivel de escala cósmica': 'Cosmic scale',
  'Tierra y Luna': 'Earth and Moon',
  'Sistema solar': 'Solar System',
  'Brazo de Orión': 'Orion Arm',
  'Vía Láctea': 'Milky Way',
  'Escala visual': 'Visual scale',
  'Escala física': 'Physical scale',
  Pausar: 'Pause',
  Reanudar: 'Resume',
  Restablecer: 'Reset',
  'Fecha simulada': 'Simulated date',
  Órbitas: 'Orbits',
  Etiquetas: 'Labels',
  Ejes: 'Axes',
  Velocidad: 'Speed',
  'Movimiento galáctico': 'Galactic motion',
  'Fuentes y metodología': 'Sources and methodology',
  'Ingresar en nave planetaria': 'Enter planetary spacecraft',
  'Regresar a la nave': 'Return to spacecraft',
  'Cámara libre': 'Free camera',
  'Salir de cámara libre': 'Exit free camera',
  Vista: 'View',
  '3ª persona': '3rd person',
  '1ª persona': '1st person',
  Planeta: 'Planet',
  Sistema: 'System',
  Galaxia: 'Galaxy',
  Hiper: 'Hyper',
  Estela: 'Trail',
  Inercia: 'Inertia',
  'Piloto auto.': 'Autopilot',
  'Campo de visión': 'Field of view',
  'Viajes rápidos': 'Quick travel',
  'Cerrar viajes rápidos ▲': 'Close quick travel ▲',
  'Viajes rápidos ▼': 'Quick travel ▼',
  'Destinos rápidos': 'Quick destinations',
  'Cinturón de asteroides': 'Asteroid Belt',
  'Centro galáctico': 'Galactic Center',
  'Vista libre': 'Free view',
  'Hola, aventurero.': 'Hello, adventurer.',
  'SEÑAL DE KRONOX · GUÍA ASTRAL': 'KRONOX SIGNAL · ASTRAL GUIDE',
  'Para acompañarte durante el viaje, habilita mi voz. Después te preguntaré desde qué dispositivo exploras para preparar la interfaz.':
    'Choose your language and whether to enable my voice for the journey. Then I will ask which device you are using so I can prepare the controls.',
  '¿En qué dispositivo estás? Adaptaré los controles y los menús para tu forma de explorar.':
    'Which device are you using? I will adapt the controls and menus for your exploration.',
  'Habilitar la voz de Kronox': 'Enable Kronox voice',
  'Entrar en la exploración': 'Start exploring',
  'El navegador podrá reproducir su voz. No se activa ni se solicita acceso al micrófono.':
    'Your browser can play Kronox’s voice. Microphone access is not requested.',
  'Podrás cambiar el modo de dispositivo desde el panel. No se activa el micrófono.':
    'You can change the device mode in the menu. Microphone access is not requested.',
  'Secciones del menú': 'Menu sections',
  'Nivel de vista': 'View level',
  'Escala física: 1 unidad = 1 millón de km. Radios y distancias a escala real.':
    'Physical scale: 1 unit = 1 million km. Radii and distances are shown to scale.',
  'Escala visual: radios exagerados y distancias comprimidas (d = 14 + 16·a^0,62). Se conservan la forma, la excentricidad y la inclinación de cada órbita.':
    'Visual scale: radii are exaggerated and distances compressed (d = 14 + 16·a^0.62). Each orbit keeps its shape, eccentricity, and inclination.',
  'Esquema: el Sol queda fijo en el centro y la galaxia se mueve respecto a él. Tiempo galáctico ×10⁶ (una vuelta = 230 millones de años; el Sol viaja a ~230 km/s). Mira desde «Brazo de Orión» o «Vía Láctea».':
    'Model: the Sun stays at the center while the galaxy moves around it. Galactic time ×10⁶ (one orbit = 230 million years; the Sun travels at ~230 km/s). View from the Orion Arm or the Milky Way.',
  'OBSERVATORIO ESPACIAL': 'SPACE OBSERVATORY',
  'Ecos en infrarrojo': 'Infrared echoes',
  'Viaja al mapa de la Vía Láctea y explora las imágenes del cielo captadas por SPHEREx a través del tiempo.':
    'Travel to the Milky Way map and explore SPHEREx images of the sky over time.',
  'Elegir misión ↗': 'Choose mission ↗',
  'Preparando viaje…': 'Preparing journey…',
  'DESTINO LOCALIZADO · SPHEREx': 'DESTINATION FOUND · SPHEREx',
  'La nave llegó al objetivo. ¿Empezamos la misión?':
    'The spacecraft has reached the target. Shall we begin the mission?',
  'Empezar misión': 'Start mission',
  'SALTO COMPLETADO': 'JUMP COMPLETE',
  'Objetivo localizado en el vecindario galáctico.': 'Target located in the galactic neighborhood.',
  '▸ ABORDANDO NAVE…': '▸ BOARDING SPACECRAFT…',
  '▸ SISTEMAS EN LÍNEA': '▸ SYSTEMS ONLINE',
  '▸ MOTORES ENCENDIDOS': '▸ ENGINES ON',
  'Voz silenciada. Mis mensajes seguirán apareciendo en pantalla.':
    'Voice muted. My messages will still appear on screen.',
  'Voz de Kronox activada.': 'Kronox voice enabled.',
  'Hola, soy Kronox, tu guía astral. Mi voz está activada.':
    'Hello, I am Kronox, your astral guide. My voice is on.',
  'Hola, aventurero. ¿Estás explorando desde un móvil o desde una computadora?':
    'Hello, adventurer. Are you exploring on a mobile device or a computer?',
  'Ajuste de interfaz': 'Interface settings',
  '¿Quieres saber más? Dale aquí': 'Want to learn more? Click here',
  'Dato astronómico': 'Astronomy fact',
  'Cambio de vista': 'View changed',
  'Cambio de escala': 'Scale changed',
  'Control activado': 'Control enabled',
  'Viaje rápido': 'Quick travel',
  'Nave planetaria': 'Planetary spacecraft',
  'Cámara libre': 'Free camera',
  'Cambio de velocidad': 'Speed changed',
  'Activando escala visual.': 'Switching to visual scale.',
  'Activando escala física.': 'Switching to physical scale.',
  'Ejes de rotación activados.': 'Rotation axes enabled.',
  'Vectores de velocidad activados.': 'Velocity vectors enabled.',
  'Modo galáctico activado.': 'Galactic mode enabled.',
  'Ingresando en la nave planetaria.': 'Entering the planetary spacecraft.',
  'Ya estás dentro de la nave planetaria.': 'You are already aboard the planetary spacecraft.',
  'Saliendo de la cámara libre.': 'Leaving free camera.',
  'Salir de cámara libre': 'Exit free camera',
  'Regresando a la nave. La nave sigue en el mismo punto y conserva su orientación.':
    'Returning to the spacecraft. It remains in the same position and keeps its orientation.',
  'Cámara libre activada. Puedes observar la nave en 3D; permanece fija mientras exploras.':
    'Free camera enabled. You can observe the spacecraft in 3D; it stays in place while you explore.',
  'Arrastra: girar. Rueda: zoom. Clic derecho: desplazar. W A S D: avanzar. Q E: subir o bajar.':
    'Drag to rotate. Scroll to zoom. Right-click to pan. W A S D to move. Q E to descend or climb.',
  'Nave planetaria (tú eres la nave): arrastra para mirar, W A S D mover, Q/E bajar/subir, Shift ×5, rueda = velocidad (':
    'Planetary spacecraft (you are the ship): drag to look, W A S D to move, Q/E to descend/climb, Shift ×5, scroll to change speed (',
  'Fuente y metodología': 'Sources and methodology',
  'Saber más': 'Learn more',
  'Diámetro: ': 'Diameter: ',
  'Distancia media: ': 'Mean distance: ',
  'Excentricidad ': 'Eccentricity ',
  ' · inclinación orbital ': ' · orbital inclination ',
  'Inclinación del eje: ': 'Axial tilt: ',
  ' (rotación retrógrada)': ' (retrograde rotation)',
  'Rotación: ': 'Rotation: ',
  'Traslación: ': 'Revolution: ',
  ' días': ' days',
  ' km': ' km',
  primera: 'first',
  tercera: 'third',
  Sol: 'Sun',
  Mercurio: 'Mercury',
  Venus: 'Venus',
  Tierra: 'Earth',
  Luna: 'Moon',
  Marte: 'Mars',
  Júpiter: 'Jupiter',
  Saturno: 'Saturn',
  Urano: 'Uranus',
  Neptuno: 'Neptune',
  'Diámetro:': 'Diameter:',
  ' UA (': ' AU (',
  ' M km)': ' million km)',
  'Datos físicos: NASA Solar System Exploration. Posiciones: elementos keplerianos aproximados de JPL (Standish, válidos 1800–2050) resueltos con la ecuación de Kepler; son aproximaciones, no efemérides de JPL Horizons. La Luna usa una órbita circular simplificada y rotación sincronizada. Todos los ejes apuntan al mismo lado del espacio (simplificación). A alta velocidad la rotación se limita visualmente. Orientación: el plano galáctico está inclinado ~60° respecto a la eclíptica y el centro galáctico queda hacia Sagitario (λ≈266°, β≈−5,6°); el Sol orbita en sentido horario visto desde el polo norte galáctico. Vía Láctea: modelo esquemático, no una fotografía; Sol a unos 26.000 años luz del centro, en el Espolón de Orión; las texturas son procedurales.':
    'Physical data: NASA Solar System Exploration. Positions: approximate JPL Keplerian elements (Standish, valid 1800–2050), solved with Kepler’s equation; these are approximations, not JPL Horizons ephemerides. The Moon uses a simplified circular orbit and synchronous rotation. All axes point in the same direction in space (a simplification). Rotation is visually limited at high speeds. Orientation: the galactic plane is tilted ~60° from the ecliptic, and the galactic center lies toward Sagittarius (λ≈266°, β≈−5.6°); the Sun orbits clockwise as seen from the north galactic pole. Milky Way: a schematic model, not a photograph; the Sun is about 26,000 light-years from the center in the Orion Spur; textures are procedural.',
  'El planeta más pequeño y cercano al Sol: un mundo rocoso de extremos térmicos.':
    'The smallest planet and closest to the Sun: a rocky world of extreme temperatures.',
  'Terreno antiguo, muy craterizado, con grandes cuencas y escarpes formados al contraerse el planeta.':
    'Ancient, heavily cratered terrain with large basins and scarps formed as the planet cooled and contracted.',
  'Gran núcleo metálico bajo un manto y una corteza de silicatos.':
    'A large metallic core beneath a silicate mantle and crust.',
  'Exosfera extremadamente tenue de oxígeno, sodio, hidrógeno, helio y potasio; casi no retiene calor.':
    'An extremely thin exosphere of oxygen, sodium, hydrogen, helium, and potassium; it holds almost no heat.',
  'Promedio aproximado: 167 °C. Puede alcanzar 430 °C de día y bajar a −180 °C de noche.':
    'Average temperature: about 167 °C. It can reach 430 °C by day and drop to −180 °C at night.',
  'Sin clima como el terrestre; la superficie alterna entre calor intenso y frío extremo. Hay hielo en cráteres polares permanentemente sombreados.':
    'No Earth-like weather; the surface swings between intense heat and extreme cold. Ice exists in permanently shadowed polar craters.',
  'Un día solar mercuriano dura 176 días terrestres.':
    'A solar day on Mercury lasts 176 Earth days.',
  'Un planeta rocoso envuelto en nubes; su intenso efecto invernadero lo convierte en el más caliente.':
    'A rocky planet wrapped in clouds; its intense greenhouse effect makes it the hottest planet.',
  'Llanuras volcánicas, montañas y estructuras volcánicas; la superficie está oculta bajo nubes espesas.':
    'Volcanic plains, mountains, and volcanic structures; the surface is hidden beneath thick clouds.',
  'Núcleo, manto y corteza rocosos.': 'A rocky core, mantle, and crust.',
  'Principalmente dióxido de carbono, con nubes de ácido sulfúrico; la presión en superficie ronda 93 veces la terrestre.':
    'Mostly carbon dioxide with sulfuric acid clouds; surface pressure is about 93 times that of Earth.',
  'Promedio aproximado: 464 °C; el calor queda atrapado por el efecto invernadero.':
    'Average temperature: about 464 °C; heat is trapped by the greenhouse effect.',
  'Atmósfera densa, seca y abrasadora. Nubes y vientos rápidos dominan las capas altas.':
    'A dense, dry, scorching atmosphere. Clouds and fast winds dominate the upper layers.',
  'Rota lentamente en sentido retrógrado: el Sol saldría por el oeste.':
    'It rotates slowly in retrograde: the Sun would rise in the west.',
  'Un planeta oceánico y rocoso, con agua líquida estable en la superficie y vida conocida.':
    'An ocean-rich rocky planet, with stable liquid water at the surface and known life.',
  'Océanos cubren cerca del 71 %; continentes y fondos marinos cambian por la tectónica de placas.':
    'Oceans cover about 71% of the surface; continents and seafloor change through plate tectonics.',
  'Corteza y manto de silicatos sobre un núcleo rico en hierro y níquel.':
    'A silicate crust and mantle over an iron- and nickel-rich core.',
  'Aproximadamente 78 % nitrógeno y 21 % oxígeno, más vapor de agua y gases traza.':
    'About 78% nitrogen and 21% oxygen, plus water vapor and trace gases.',
  'Temperatura media superficial aproximada: 15 °C.': 'Average surface temperature: about 15 °C.',
  'El agua y la atmósfera redistribuyen calor; hay climas y estaciones muy diversos.':
    'Water and the atmosphere redistribute heat, creating a wide range of climates and seasons.',
  'Es el único mundo donde se ha confirmado vida.': 'The only world where life has been confirmed.',
  'Un desierto frío y polvoriento con antiguos cauces, volcanes gigantes y reservas de hielo.':
    'A cold, dusty desert with ancient river channels, giant volcanoes, and ice deposits.',
  'Rocosa, con cráteres, cañones y volcanes; evidencia geológica de ríos y lagos antiguos.':
    'Rocky, with craters, canyons, and volcanoes; its geology preserves evidence of ancient rivers and lakes.',
  'Planeta rocoso con núcleo metálico y corteza rica en minerales de hierro, que le dan su color rojizo.':
    'A rocky planet with a metallic core and an iron-rich crust that gives it its reddish color.',
  'Muy tenue, compuesta sobre todo de dióxido de carbono, con nitrógeno y argón.':
    'Very thin, composed mostly of carbon dioxide with nitrogen and argon.',
  'Promedio aproximado: −65 °C; varía desde unos −153 °C hasta 20 °C.':
    'Average temperature: about −65 °C; it ranges from roughly −153 °C to 20 °C.',
  'Tormentas de polvo pueden abarcar grandes regiones; agua congelada permanece en polos y bajo el suelo.':
    'Dust storms can span vast regions; frozen water remains at the poles and underground.',
  'Olympus Mons es el volcán más alto conocido del sistema solar.':
    'Olympus Mons is the tallest known volcano in the solar system.',
  'El gigante gaseoso más grande: una enorme atmósfera turbulenta sin una superficie sólida definida.':
    'The largest gas giant: an enormous, turbulent atmosphere with no defined solid surface.',
  'No tiene superficie sólida accesible; al profundizar, el gas se vuelve cada vez más denso y caliente.':
    'It has no accessible solid surface; deeper down, the gas becomes increasingly dense and hot.',
  'Principalmente hidrógeno y helio; en el interior, el hidrógeno pasa a estados de alta presión.':
    'Mostly hydrogen and helium; deep inside, hydrogen enters high-pressure states.',
  'Bandas de nubes y tormentas. La Gran Mancha Roja es una tormenta longeva; se han medido vientos de hasta unos 539 km/h.':
    'Cloud bands and storms. The Great Red Spot is a long-lived storm; winds of up to about 539 km/h have been measured.',
  'Aproximadamente −110 °C en la capa atmosférica de referencia (nivel de 1 bar), no es una temperatura de superficie.':
    'About −110 °C at the 1-bar atmospheric reference level; this is not a surface temperature.',
  'Cambios rápidos de nubes, chorros y tormentas gigantes en bandas.':
    'Rapidly changing clouds, jet streams, and giant storms within bands.',
  'Su campo magnético y sistema de lunas son extraordinariamente extensos.':
    'Its magnetic field and moon system are extraordinarily vast.',
  'Gigante gaseoso famoso por sus anillos, formados sobre todo por fragmentos de hielo y roca.':
    'A gas giant famous for its rings, made mostly of fragments of ice and rock.',
  'No posee una superficie sólida definida; las capas atmosféricas se vuelven más densas hacia el interior.':
    'It has no defined solid surface; atmospheric layers become denser toward the interior.',
  'Principalmente hidrógeno y helio.': 'Mostly hydrogen and helium.',
  'Nubes en bandas, vientos intensos y tormentas; en el polo norte destaca una corriente con forma hexagonal.':
    'Cloud bands, strong winds, and storms; a hexagonal jet stream stands out at the north pole.',
  'Aproximadamente −140 °C en la capa atmosférica de referencia (nivel de 1 bar), no es una temperatura de superficie.':
    'About −140 °C at the 1-bar atmospheric reference level; this is not a surface temperature.',
  'Atmósfera fría y dinámica; las estaciones duran años por su larga órbita.':
    'A cold, dynamic atmosphere; seasons last years because of its long orbit.',
  'Sus anillos principales son muy anchos y, comparados con su extensión, extraordinariamente delgados.':
    'Its main rings are very wide and extraordinarily thin compared with their span.',
  'Un gigante helado azul verdoso que gira casi acostado respecto al plano de su órbita.':
    'A blue-green ice giant that spins almost on its side relative to its orbital plane.',
  'No tiene superficie sólida definida; bajo las nubes hay fluidos densos y calientes de agua, metano y amoníaco.':
    'It has no defined solid surface; beneath the clouds are dense, hot fluids of water, methane, and ammonia.',
  'Atmósfera de hidrógeno, helio y metano; el metano absorbe luz roja y contribuye al tono azul verdoso.':
    'An atmosphere of hydrogen, helium, and methane; methane absorbs red light and contributes to its blue-green color.',
  'Mínimo aproximado: −224 °C. Vientos de hasta unos 900 km/h.':
    'Minimum temperature: about −224 °C. Winds reach about 900 km/h.',
  'Aproximadamente −195 °C en la capa atmosférica de referencia (nivel de 1 bar); la atmósfera superior puede ser aún más fría.':
    'About −195 °C at the 1-bar atmospheric reference level; the upper atmosphere can be even colder.',
  'Estaciones extremas por su inclinación axial de 97,77°; cada polo pasa décadas orientado hacia el Sol.':
    'Extreme seasons result from its 97.77° axial tilt; each pole spends decades pointed toward the Sun.',
  'Es clasificado como gigante helado, distinto de los gigantes gaseosos Júpiter y Saturno.':
    'It is classified as an ice giant, distinct from the gas giants Jupiter and Saturn.',
  'Un gigante helado lejano, oscuro y ventoso, con nubes azuladas y sistemas de tormentas.':
    'A distant, dark, windy ice giant with blue clouds and storm systems.',
  'No hay superficie sólida definida; gran parte del interior es un fluido caliente y denso de agua, metano y amoníaco.':
    'There is no defined solid surface; much of the interior is a hot, dense fluid of water, methane, and ammonia.',
  'Atmósfera de hidrógeno y helio con metano; su interior contiene hielos a alta presión.':
    'An atmosphere of hydrogen and helium with methane; its interior contains high-pressure ices.',
  'Vientos que superan los 2.000 km/h, entre los más rápidos medidos en el sistema solar.':
    'Winds exceed 2,000 km/h, among the fastest measured in the solar system.',
  'Aproximadamente −200 °C en la capa atmosférica de referencia (nivel de 1 bar), no es una temperatura de superficie.':
    'About −200 °C at the 1-bar atmospheric reference level; this is not a surface temperature.',
  'Muy frío, con vientos veloces, nubes brillantes y tormentas que aparecen y evolucionan.':
    'Very cold, with fast winds, bright clouds, and storms that appear and evolve.',
  'La luz solar tarda más de cuatro horas en llegar desde el Sol.':
    'Sunlight takes more than four hours to arrive from the Sun.',
  'Imagen de ': 'Image of ',
  'Las observaciones disponibles aparecerán ordenadas por fecha.':
    'Available observations will be ordered by date.',
  'No se pudo cargar la voz en español. Revisa tu conexión a internet.':
    'Could not load the voice. Check your internet connection.',
  'No se pudo reproducir la voz en español. Revisa tu conexión a internet.':
    'Could not play the voice. Check your internet connection.',
  'No se pudo cargar el recorte.': 'Could not load the image cutout.',
  '·': '·',

  'Kronox, guía astral': 'Kronox, astral guide',
  'Planetas y cuerpos': 'Planets and bodies',
  'Órbita próxima al Sol': 'Near-Sun orbit',
  'Vista libre': 'Free view',
  'Fecha de observación': 'Observation date',
  'Imagen SPHEREx ampliada': 'Expanded SPHEREx image',
  Móvil: 'Mobile',
  Derecha: 'Right',
  'Estrella variable': 'Variable star',
  'la fuente se desplazó hacia el borde': 'the source shifted toward the edge',
  'Se encontraron ': 'Found ',
  ' imágenes en ': ' images across ',
  ' días distintos.': ' different days.',
  'Enana roja cercana con gran movimiento propio.': 'A nearby red dwarf with high proper motion.',
  'La voz está activada.': 'Voice is on.',
  ' · alineado por WCS (N ↑ E ←) · la escala de brillo se mantiene fija en la secuencia':
    ' · WCS aligned (N ↑ E ←) · brightness scale stays fixed throughout the sequence',
  'Coordenada de referencia': 'Reference coordinate',
  'Centro fijo de la secuencia': 'Fixed sequence center',
  'Posición astrométrica propagada': 'Propagated astrometric position',
  '≈ 510 años luz': '≈ 510 light-years',
  'QR2 + QR3 · archivo combinado': 'QR2 + QR3 · combined archive',
  Fondo: 'Background',
  'IMAGE − ZODI': 'IMAGE − ZODI',
  'IMAGE original': 'Original IMAGE',
  'Modelo ZODI': 'ZODI model',
  Modo: 'Mode',
  'Medición (Cat. A+C)': 'Measurement (Cat. A+C)',
  'Descubrimiento (Cat. A)': 'Discovery (Cat. A)',
  'Procesamiento del fondo zodiacal (HDU 4: ZODI)': 'Zodiacal background processing (HDU 4: ZODI)',
  'Política de máscaras de calidad (HDU 2: FLAGS)': 'Quality flag mask policy (HDU 2: FLAGS)',
  'Modo de visualización': 'View mode',
  Secuencia: 'Sequence',
  'Blink Comparator': 'Blink Comparator',
  'Lado a lado': 'Side by side',
  'Resta diferencial': 'Differential imaging',
  'Mapa SNR': 'SNR map',
  Candidatos: 'Candidates',
  'Velocidad de parpadeo': 'Blink speed',
  'Bucle continuo': 'Loop playback',
  'Pausar parpadeo': 'Pause blink',
  'Iniciar parpadeo': 'Start blink',
  'Fotograma anterior': 'Previous frame',
  'Fotograma siguiente': 'Next frame',
  'Primer fotograma': 'First frame',
  'Último fotograma': 'Last frame',
  'Zoom sincronizado': 'Synchronized zoom',
  'Restablecer encuadre': 'Reset framing',
  'Escala fotométrica (α)': 'Photometric scale (α)',
  'Fondo residual (B)': 'Residual background (B)',
  'Umbral de significancia': 'Significance threshold',
  'Dipolo de movimiento propio': 'Proper motion dipole',
  'Variable (aumento)': 'Variable (brightened)',
  'Variable (atenuación)': 'Variable (dimmed)',
  'Candidato a transitorio': 'Transient candidate',
  'Artefacto instrumental': 'Instrumental artifact',
  'Coincide con objetivo': 'Matches target',
  'Desplazamiento medido': 'Measured shift',
  'Posición de referencia': 'Reference position',
  'Posición astrométrica predicha': 'Predicted astrometric position',
  'Desajuste de PSF': 'PSF mismatch',
  'Comparabilidad espectral': 'Spectral comparability',
  'Normalización automática (regresión robusta)': 'Automatic normalization (robust fit)',
  'Normalización forzada (α = 1.0)': 'Forced normalization (α = 1.0)',
  'Residuos positivos (aumento / llegada)': 'Positive residuals (brightened / appeared)',
  'Residuos negativos (atenuación / partida)': 'Negative residuals (dimmed / departed)',
  'Sin cambios significativos': 'No significant change',
  'Examinar candidato': 'Inspect candidate',
  'Controles científicos avanzados': 'Advanced scientific controls',
  'Ocultar controles avanzados': 'Hide advanced controls',
  'Lista de candidatos identificados': 'Identified candidate list',
  'No se detectaron candidatos que superen el umbral': 'No candidates detected exceeding threshold',
  'Diferencia de intensidad': 'Intensity difference',
  'Mapa de significancia': 'Significance map',
  'Píxeles de referencia': 'Reference pixels',
  'Correlación r': 'Correlation r',
  'Incertidumbre de escala': 'Scale uncertainty',
};

const patterns = [
  [/^Información sobre (.+)$/, 'Information about $1'],
  [/^ · ≈ (.+) años luz\/s$/, ' · ≈ $1 light-years/s'],
  [
    /^Nave planetaria \(tú eres la nave\): arrastra para mirar, W A S D mover, Q\/E bajar\/subir, Shift ×5, rueda = velocidad \((.+) u\/s\)\.$/,
    'Planetary spacecraft (you are the ship): drag to look, W A S D to move, Q/E to descend/climb, Shift ×5, scroll to change speed ($1 u/s).',
  ],
  [/^Excentricidad (.+) · inclinación orbital (.+)°$/, 'Eccentricity $1 · orbital inclination $2°'],
  [/^Inclinación del eje: (.+)°( \(rotación retrógrada\))?$/, 'Axial tilt: $1°$2'],
  [/^Rotación: (.+) días$/, 'Rotation: $1 days'],
  [/^Traslación: (.+) días$/, 'Revolution: $1 days'],
  [/^(.+ u\/s)( · ≈ .+ años luz\/s)? · (3ª|1ª) persona( · piloto auto\.)?$/, '$1$2 · $3 person$4'],
  [/^(.+) de (.+): (.+)$/, '$1 on $2: $3'],
  [/^Imagen de (.+) — NASA$/, 'Image of $1 — NASA'],
  [/^Imagen de (.+) — NASA$/, 'Image of $1 — NASA'],
  [/^Hallazgo (.+)$/, 'Finding $1'],
  [/^Recorte infrarrojo SPHEREx (.+), (.+)$/, 'SPHEREx infrared cutout $1, $2'],
  [/^Imagen SPHEREx ampliada de (.+)$/, 'Expanded SPHEREx image of $1'],
  [/^Velocidad: (.+) días por segundo$/, 'Speed: $1 days per second'],
  [
    /^Se encontraron (.+) imágenes en (.+) días distintos\.$/,
    'Found $1 images across $2 different days.',
  ],
  [/^Buscando observaciones de (.+)…$/, 'Searching for observations of $1…'],
  [/^Diámetro: (.+) km$/, 'Diameter: $1 km'],
  [/^Distancia media: (.+) UA \((.+) M km\)$/, 'Mean distance: $1 AU ($2 million km)'],
  [/^Rotación: (.+) días$/, 'Rotation: $1 days'],
  [/^Traslación: (.+) días$/, 'Revolution: $1 days'],
  [/^Inclinación del eje: (.+)°$/, 'Axial tilt: $1°'],
  [/^Velocidad de vuelo: (.+) u\/s$/, 'Flight speed: $1 u/s'],
  [/^Campo de visión: (.+)°$/, 'Field of view: $1°'],
  [/^Cambiando nivel de vista a (.+)\.$/, 'Changing view to $1.'],
  [/^Cambiando velocidad a (.+)\.$/, 'Changing speed to $1.'],
  [/^Activando escala (visual|física)\.$/, 'Switching to $1 scale.'],
  [
    /^Preparando viaje rápido hacia (.+)\. Cuenta atrás: 3, 2, 1\.$/,
    'Preparing a quick trip to $1. Countdown: 3, 2, 1.',
  ],
  [/^¡Salto iniciado! Rumbo a (.+)\.$/, 'Jump started! Heading to $1.'],
  [
    /^Destino fijado: (.+)\. Prepararé el salto hasta su posición en el vecindario galáctico\.$/,
    'Destination set: $1. I will prepare the jump to its location in the galactic neighborhood.',
  ],
  [
    /^Hemos llegado a (.+)\. El objetivo está localizado; puedes iniciar la observación cuando quieras\.$/,
    'We have arrived at $1. The target is located; you can begin observing whenever you are ready.',
  ],
  [/^Tu misión: (.+)$/, 'Your mission: $1'],
  [/^Cambiando nivel de vista a (primera|tercera) persona\.$/, 'Switching to $1 person view.'],
  [
    /^Velocidad de nave ajustada a (.+) unidades por segundo\.$/,
    'Spacecraft speed set to $1 units per second.',
  ],
  [/^Dato astronómico$/, 'Astronomy fact'],
];

export function t(value, language = 'es') {
  if (typeof value !== 'string' || language !== 'en') return value;
  if (en[value] !== undefined) return en[value];
  for (const [pattern, replacement] of patterns) {
    const match = value.match(pattern);
    if (match)
      return match
        .slice(1)
        .reduce(
          (result, capture, index) =>
            result.replaceAll(`$${index + 1}`, t(capture || '', language)),
          replacement,
        );
  }
  return value;
}

export function voiceLanguage(language, accent) {
  if (language === 'en') return 'en-US';
  return accent === 'es-ES' ? 'es-ES' : 'es-US';
}
