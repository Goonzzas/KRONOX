/**
 * SPHEREx · Esfera Celeste 360° — 1,032 Objetos con Animación Temporal GIF de 10 Épocas (QR1, QR2, QR3, DR1)
 *
 * - Integra las 216 exposiciones FITS reales de SPHEREx QR1, QR2, QR3 y DR1 descargadas en disco.
 * - Los 1,032 objetos aparecen inicialmente como PUNTOS luminosos segmentados por color sobre fondo Vantablack.
 * - Al pasar el ratón (hover) sobre cualquier punto del cielo, se despliega EN GRANDE su Color Composite
 *   animado en bucle como un GIF a través de 10 imágenes temporales puras (sin suma) con velocidad ajustable:
 *     T1: QR1 (2025-W17) -> T2: DR1 (2025-W18) -> T3: QR2 (2025-W19) -> T4: QR2 (2025-W20) -> T5: QR2 (2025-W21)
 *     -> T6: DR1 (2025-W22) -> T7: QR3 (2026-W20) -> T8: QR3 (2026-W21) -> T9: QR3 (2026-W22) -> T10: QR3 (2026-W25)
 */

const TOTAL_SKY_OBJECTS = 1032;
const NUM_TEMPORAL_EPOCHS = 10;

const EPOCH_META = [
  { index: 0, code: "T1·QR1", title: "T1/10 · QR1 (2025-W17)", badge: "🎬 T1 · QR1-W17", realId: "real_qr1_2025W17_4B" },
  { index: 1, code: "T2·DR1", title: "T2/10 · DR1 (2025-W18)", badge: "🎬 T2 · DR1-W18", realId: "real_dr1_2025W18_1B" },
  { index: 2, code: "T3·QR2", title: "T3/10 · QR2 (2025-W19)", badge: "🎬 T3 · QR2-W19", realId: "real_qr2_2025W19_1B" },
  { index: 3, code: "T4·QR2", title: "T4/10 · QR2 (2025-W20)", badge: "🎬 T4 · QR2-W20", realId: "real_qr2_2025W20_1C" },
  { index: 4, code: "T5·QR2", title: "T5/10 · QR2 (2025-W21)", badge: "🎬 T5 · QR2-W21", realId: "real_qr2_2025W21_1B" },
  { index: 5, code: "T6·DR1", title: "T6/10 · DR1 (2025-W22)", badge: "🎬 T6 · DR1-W22", realId: "real_dr1_2025W22_1B" },
  { index: 6, code: "T7·QR3", title: "T7/10 · QR3 (2026-W20)", badge: "🎬 T7 · QR3-W20", realId: "real_qr3_2026W20_2A" },
  { index: 7, code: "T8·QR3", title: "T8/10 · QR3 (2026-W21)", badge: "🎬 T8 · QR3-W21", realId: "real_qr3_2026W21_1A" },
  { index: 8, code: "T9·QR3", title: "T9/10 · QR3 (2026-W22)", badge: "🎬 T9 · QR3-W22", realId: "real_qr3_2026W22_1A" },
  { index: 9, code: "T10·QR3", title: "T10/10 · QR3 (2026-W25)", badge: "🎬 T10 · QR3-W25", realId: "real_qr3_2026W25_1A" },
];

const CATEGORY_TRANSIENT_DESC = {
  nebula: [
    "T1: Inicio de onda de ionización UV/IR en cavidad central",
    "T2: Fulguración de protoestrella YSO #1 en pilar norte",
    "T3: Propagación de frente térmico PAH (3.29 µm)",
    "T4: Brote de acreción en glóbulo embebido YSO #2",
    "T5: Barrido de sombras de ionización tras nudo denso",
    "T6: Pico de fluorescencia H2 (2.12 µm) en borde sur",
    "T7: Fulguración doble de estrellas T Tauri jóvenes",
    "T8: Expansión de burbuja de viento estelar caliente",
    "T9: Onda de choque radiativa iluminando polvo exterior",
    "T10: Máxima excitación nebular multi-frente",
  ],
  black_hole: [
    "T1: Ignición de punto caliente Doppler en anillo de fotones",
    "T2: Eyección de plasmoide superlumínico Nudo A en el jet",
    "T3: Rotación relativista (108°) + fulguración coronal X/IR",
    "T4: Nudo A avanzando + lanzamiento de nuevo Nudo B",
    "T5: Pico de destello térmico en el disco de acreción interno",
    "T6: Colisión de choque interno en el jet bipolar (Nudo A+B)",
    "T7: Lanzamiento de plasmoide rápido Nudo C + precesión del jet",
    "T8: Fulguración sincrotrón intensa en la base de la corona",
    "T9: Propagación de 3 plasmoides a lo largo del chorro relativista",
    "T10: Cierre de órbita relativista (360°) y eco del disco",
  ],
  pulsar: [
    "T1: Barrido del haz sincrotrón (0°) + emisión de anillo PWN #1",
    "T2: Rotación del faro (36°) + expansión de onda relativista",
    "T3: Brote hiper-magnético de Magnetar (destello cortical)",
    "T4: Rotación (108°) + propagación de arco de plasma sincrotrón",
    "T5: Emisión del segundo anillo interior ('wisp' PWN #2)",
    "T6: Oposición del haz bipolar (180°) + nudo en el jet polar",
    "T7: Expansión simultánea de 2 anillos en el toro ecuatorial",
    "T8: Segundo destello de reconexión magnética en magnetosfera",
    "T9: Choque del viento del púlsar con el medio circunestelar",
    "T10: Rotación completa (324°) de los haces y nebulosa PWN",
  ],
  snr: [
    "T1: Onda de choque frontal impactando filamento interior",
    "T2: Encendido de perlas ecuatoriales #1–#3 (choque reverso)",
    "T3: Primer eco de luz infrarrojo barriendo nube de polvo",
    "T4: Calentamiento de nudos de Hierro/Silicio ([Fe II] 1.64 µm)",
    "T5: Encendido secuencial de perlas #4–#7 en el anillo",
    "T6: Segundo eco de luz concéntrico expandiéndose a gran radio",
    "T7: Ruptura hidro-magnética en el frente de choque norte",
    "T8: Encendido completo del collar de choque + polvo caliente",
    "T9: Expansión balística de eyecta rica en oxígeno/neón",
    "T10: Doble eco de luz exterior + máxima emisión de choque",
  ],
  cluster: [
    "T1: Eyección de nudos Herbig-Haro (HH #1) desde protoestrella",
    "T2: Pulso máximo de estrella variable Cefeida V1 del cúmulo",
    "T3: Avance del jet bipolar HH + destello en cavidad de reflexión",
    "T4: Fulguración episódica FU Orionis en disco circunestelar",
    "T5: Oscilación de variables RR Lyrae V2 y V3 + nuevo nudo HH #2",
    "T6: Choque de proa ('bow shock') brillante en el extremo del jet",
    "T7: Destello infrarrojo de estrella gigante Mira V4",
    "T8: Tren de 3 nudos Herbig-Haro viajando por el eje bipolar",
    "T9: Onda de iluminación térmica recorriendo la nube madre",
    "T10: Sincronización de variables y choque terminal del jet",
  ],
  galaxy: [
    "T1: Estado basal de brazos espirales y anillo PAH galáctico",
    "T2: ¡Explosión de Supernova Tipo Ia (SN Ia) en brazo interior!",
    "T3: Pico de luminosidad máxima de la Supernova SN Ia",
    "T4: Declive de SN Ia + inicio de fulguración AGN en el núcleo",
    "T5: Pico de evento de disrupción mareal (TDE) en el núcleo activo",
    "T6: ¡Aparición de Supernova Tipo II (SN II) en brazo exterior!",
    "T7: Pico brillante azul/IR de SN II + eco térmico en el núcleo",
    "T8: Brote de formación estelar en regiones H II espirales",
    "T9: Nuevo destello del cuásar/AGN central + remanente SN II",
    "T10: Propagación de onda de densidad espiral y eco nuclear",
  ],
};

// Los 6 Detectores HgCdTe LVF del Plano Focal de SPHEREx (Cámara NIR Corta D1-D3 y Cámara IR Larga D4-D6)
const SPHEREX_DETECTORS = [
  {
    id: "D1",
    num: 1,
    wave: "0.75–1.11 µm",
    shortWave: "0.93 µm",
    camera: "NIR Corta",
    channels: "Ch 01–03",
    color: "#3b82f6",
    role: "Continuo / Sincrotrón",
  },
  {
    id: "D2",
    num: 2,
    wave: "1.11–1.63 µm",
    shortWave: "1.37 µm",
    camera: "NIR Corta",
    channels: "Ch 04–06",
    color: "#00b4ff",
    role: "Choque [Fe II] / Paβ",
  },
  {
    id: "D3",
    num: 3,
    wave: "1.63–2.42 µm",
    shortWave: "2.02 µm",
    camera: "NIR Corta",
    channels: "Ch 07–10",
    color: "#00e5c3",
    role: "Gas H₂ 2.12 µm / Brγ",
  },
  {
    id: "D4",
    num: 4,
    wave: "2.42–3.82 µm",
    shortWave: "3.12 µm",
    camera: "IR Larga",
    channels: "Ch 11–14",
    color: "#2ee66b",
    role: "PAH 3.29 µm / Hielo H₂O",
  },
  {
    id: "D5",
    num: 5,
    wave: "3.82–4.42 µm",
    shortWave: "4.12 µm",
    camera: "IR Larga",
    channels: "Ch 15–16",
    color: "#ffd000",
    role: "Gas Brα / Hielo CO₂",
  },
  {
    id: "D6",
    num: 6,
    wave: "4.42–5.00 µm",
    shortWave: "4.71 µm",
    camera: "IR Larga",
    channels: "Ch 17–18",
    color: "#ff3b5c",
    role: "Polvo Térmico / AGN",
  },
];

const CATEGORY_DOMINANT_DETECTORS = {
  nebula: {
    dominant: ["D3", "D4", "D5"],
    summary: "D3 (H₂) · D4 (PAH 3.3µm) · D5 (Brα)",
    factorSignature: "Factores clave: Onda de fotoionización + fulguraciones YSO en D3, D4 y D5",
  },
  black_hole: {
    dominant: ["D1", "D2", "D6"],
    summary: "D1 (Jet Sincrotrón) · D2 (Corona) · D6 (Toro 4.8µm)",
    factorSignature: "Factores clave: Órbita Doppler relativista (360°) + 3 nudos en el jet (D1/D6)",
  },
  pulsar: {
    dominant: ["D1", "D2", "D3"],
    summary: "D1–D2 (Faro Sincrotrón) · D3 (Anillos PWN)",
    factorSignature: "Factores clave: Faro bipolar rotatorio + expansión de anillos PWN + brote Magnetar",
  },
  snr: {
    dominant: ["D2", "D4", "D6"],
    summary: "D2 ([Fe II] Choque) · D4 (PAH) · D6 (Eco Polvo)",
    factorSignature: "Factores clave: Doble eco de luz IR + encendido de perlas de choque (D2/D6)",
  },
  cluster: {
    dominant: ["D1", "D3", "D5"],
    summary: "D1 (Variables) · D3 (Jets HH H₂) · D5 (Disco)",
    factorSignature: "Factores clave: Pulsación de 4 estrellas variables + avance de nudos Herbig-Haro",
  },
  galaxy: {
    dominant: ["D1", "D4", "D6"],
    summary: "D1 (Supernovas Ia/II) · D4 (PAH) · D6 (Núcleo AGN/TDE)",
    factorSignature: "Factores clave: Explosiones SN Ia (T3) y SN II (T7) + evento TDE nuclear (T5)",
  },
};

function getDetectorForBand(bandId, idx, total) {
  const idStr = String(bandId || "").toLowerCase();
  for (let d = 1; d <= 6; d++) {
    if (idStr === `det${d}` || idStr.includes(`_det${d}`)) {
      return SPHEREX_DETECTORS[d - 1];
    }
  }
  const chMatch = idStr.match(/ch(\d+)/);
  const chNum = chMatch ? parseInt(chMatch[1], 10) : idx + 1;
  if (total === 6) return SPHEREX_DETECTORS[Math.min(5, Math.max(0, idx))];
  if (chNum <= 3) return SPHEREX_DETECTORS[0]; // D1: Ch 01-03 (0.75-1.11 um)
  if (chNum <= 6) return SPHEREX_DETECTORS[1]; // D2: Ch 04-06 (1.11-1.63 um)
  if (chNum <= 10) return SPHEREX_DETECTORS[2]; // D3: Ch 07-10 (1.63-2.42 um)
  if (chNum <= 14) return SPHEREX_DETECTORS[3]; // D4: Ch 11-14 (2.42-3.82 um)
  if (chNum <= 16) return SPHEREX_DETECTORS[4]; // D5: Ch 15-16 (3.82-4.42 um)
  return SPHEREX_DETECTORS[5]; // D6: Ch 17-18 (4.42-5.00 um)
}

const CATEGORY_META = {
  nebula: {
    id: "nebula",
    label: "NEBULOSA",
    plural: "Nebulosas",
    colorHex: "#00b4ff",
    rgb: [0, 180, 255],
    glowRgba: "rgba(0, 180, 255, ",
  },
  black_hole: {
    id: "black_hole",
    label: "AGUJERO NEGRO",
    plural: "Agujeros Negros",
    colorHex: "#ffd000",
    rgb: [255, 208, 0],
    glowRgba: "rgba(255, 208, 0, ",
  },
  pulsar: {
    id: "pulsar",
    label: "PÚLSAR / MAGNETAR",
    plural: "Púlsares",
    colorHex: "#d946ef",
    rgb: [217, 70, 239],
    glowRgba: "rgba(217, 70, 239, ",
  },
  snr: {
    id: "snr",
    label: "SUPERNOVA (SNR)",
    plural: "Supernovas",
    colorHex: "#ff3b5c",
    rgb: [255, 59, 92],
    glowRgba: "rgba(255, 59, 92, ",
  },
  cluster: {
    id: "cluster",
    label: "CÚMULO / PROTOESTRELLA",
    plural: "Cúmulos & Protoestrellas",
    colorHex: "#2ee66b",
    rgb: [46, 230, 107],
    glowRgba: "rgba(46, 230, 107, ",
  },
  galaxy: {
    id: "galaxy",
    label: "GALAXIA / SURVEY QR1–DR1",
    plural: "Galaxias & Espacio Profundo",
    colorHex: "#f8fafc",
    rgb: [248, 250, 252],
    glowRgba: "rgba(248, 250, 252, ",
  },
};

const CATALOG_NAMES_BY_CATEGORY = {
  nebula: [
    "Nebulosa de la Laguna (M8)",
    "Nebulosa Trífida (M20)",
    "Nebulosa Roseta (NGC 2237)",
    "Nebulosa Omega / Cisne (M17)",
    "Nebulosa Ojo de Gato (NGC 6543)",
    "Nebulosa del Anillo (M57)",
    "Nebulosa Dumbbell (M27)",
    "Nebulosa Mariposa (NGC 6302)",
    "Nebulosa Cabeza de Caballo (IC 434)",
    "Nebulosa Flama (NGC 2024)",
    "Nebulosa Norteamérica (NGC 7000)",
    "Nebulosa Pelícano (IC 5070)",
    "Nebulosa Corazón (IC 1805)",
    "Nebulosa Alma (IC 1848)",
    "Nebulosa Burbuja (NGC 7635)",
    "Nebulosa del Cono (NGC 2264)",
    "Nebulosa Saturno (NGC 7009)",
    "Nebulosa Esquimales (NGC 2392)",
    "Nebulosa Reloj de Arena (MyCn 18)",
    "Nebulosa Huevo Podrido (OH 231.8)",
    "Nebulosa Hormiga (Mz 3)",
    "Nebulosa Espirografo (IC 418)",
    "Nebulosa Fantasma de Júpiter (NGC 3242)",
    "Nebulosa Casco de Thor (NGC 2359)",
    "Nebulosa de la Quilla Sur (NGC 3576)",
    "Nebulosa Pata de Gato (NGC 6334)",
    "Nebulosa Langosta (NGC 6357)",
    "Nebulosa Gaviota (IC 2177)",
    "Nebulosa California (NGC 1499)",
    "Nebulosa Cueva (Sh2-155)",
    "Nebulosa Medusa Planetaria (Abell 21)",
    "Nebulosa Búmeran (LED 3074547)",
    "Nebulosa Rectángulo Rojo (HD 44179)",
    "Nebulosa Pistola (G0.15-0.05)",
    "Nebulosa Cabeza de Bruja (IC 2118)",
    "Nebulosa Cúpula Celeste (NGC 6888)",
    "Nebulosa Anillo del Sur (NGC 3132)",
    "Nebulosa Retina (IC 4406)",
    "Nebulosa Capullo (IC 5146)",
    "Nebulosa de la Tarántula Norte (NGC 2070)",
  ],
  black_hole: [
    "Agujero Negro Cygnus X-1 (HDE 226868)",
    "Agujero Negro Supermasivo M87* (Virgo A)",
    "Microcuásar SS 433 (Chorro Relativista)",
    "Microcuásar GRS 1915+105 (Disco de Acreción)",
    "Agujero Negro V404 Cygni (Binaria X)",
    "Núcleo Activo Centaurus A (NGC 5128 AGN)",
    "Cuásar 3C 273 (Jet Óptico/IR)",
    "Sistema Binario SMBH OJ 287",
    "Cuásar Hiperluminoso TON 618",
    "Agujero Negro Estelar LMC X-1",
    "Agujero Negro Estelar LMC X-3",
    "Microcuásar GRO J1655-40",
    "Agujero Negro GX 339-4 (Corona IR)",
    "Agujero Negro A0620-00 (V616 Mon)",
    "Blázar Markarian 421 (Jet Sincrotrón)",
    "Blázar Markarian 501",
    "Agujero Negro Supermasivo NGC 1275 (Perseus A)",
    "Disco Máser de Agujero Negro NGC 4258",
    "Agujero Negro MAXI J1820+070",
    "Cuásar Einstein Cross (Q2237+030)",
    "Agujero Negro Intermedio HLX-1 (ESO 243-49)",
    "Microcuásar Cygnus X-3",
    "Agujero Negro XTE J1550-564",
    "Agujero Negro 1A 0620-00",
    "Cuásar 3C 454.3 (Blázar)",
    "Agujero Negro Supermasivo NGC 4151 (Ojo de Sauron)",
    "Cuásar PKS 2155-304",
    "Agujero Negro Gaia BH1",
    "Agujero Negro Gaia BH2",
    "Agujero Negro Gaia BH3 (Halo Galáctico)",
    "Agujero Negro M33 X-7 (Binaria Eclipsante)",
    "Agujero Negro IC 10 X-1",
  ],
  pulsar: [
    "Púlsar del Cangrejo (PSR B0531+21 · PWN)",
    "Púlsar de Vela (PSR B0833-45 · Jet & Toro)",
    "Púlsar Mano de Dios (PSR B1509-58)",
    "Púlsar Geminga (PSR J0633+1746)",
    "Magnetar SGR 1806-20 (Brote Hipermagnético)",
    "Magnetar SGR 1900+14",
    "Magnetar 1E 2259+586 (CTB 109)",
    "Púlsar Viuda Negra (PSR B1957+20)",
    "Púlsar Doble Relativista (PSR J0737-3039)",
    "Púlsar Milisegundo PSR J0437-4715",
    "Sistema Binario Púlsar-Be PSR B1259-63",
    "Púlsar Más Rápido PSR J1748-2446ad (716 Hz)",
    "Nebulosa de Viento de Púlsar G21.5-0.9",
    "Nebulosa Sincrotrón 3C 58 (PSR J0205+6449)",
    "Púlsar de la Guitarra (PSR B2224+65)",
    "Magnetar SGR 0526-66 (N49 LMC)",
    "Púlsar del Ratón (PSR J1747-2958 · Cola Choques)",
    "Magnetar 1E 1048.1-5937",
    "Púlsar PSR B1919+21 (CP 1919)",
    "Púlsar de Rayos X Centaurus X-3",
    "Púlsar Hércules X-1 (Disco Alabeado)",
    "Magnetar SGR J1745-2900 (Centro Galáctico)",
    "Púlsar PSR J0537-6910 (N157B LMC)",
    "Púlsar Milisegundo PSR B1937+21",
    "Magnetar 4U 0142+61 (Disco de Escombros IR)",
    "Púlsar de Acreción Vela X-1",
    "Púlsar PSR J2032+4127 (Cisne OB2)",
    "Nebulosa de Viento de Púlsar G54.1+0.3",
    "Púlsar PSR B1706-44",
    "Magnetar XTE J1810-197",
  ],
  snr: [
    "Remanente Supernova SN 1987A (Anillo de Perlas)",
    "Remanente de Tycho (SN 1572 · 3C 10)",
    "Remanente de Kepler (SN 1604)",
    "Velo del Cisne Occidental (NGC 6960)",
    "Velo del Cisne Oriental (NGC 6992)",
    "Remanente IC 443 (Nebulosa Medusa SNR)",
    "Remanente SN 1006 (Choque Simétrico)",
    "Remanente W49B (Supernova Bipolar Fe II)",
    "Remanente Puppis A (Frente de Choque O/Ne)",
    "Remanente Histórico RCW 86 (SN 185)",
    "Red de Espagueti (Simeis 147 / Sh2-240)",
    "Remanente de Vela (Filamentos de Choque)",
    "Remanente W44 (Interacción Nube Molecular H2)",
    "Remanente Más Joven G1.9+0.3",
    "Remanente Rico en Oxígeno N132D (LMC)",
    "Remanente N49 (Frente de Polvo Caliente)",
    "Remanente Cygnus Loop (Triángulo de Pickering)",
    "Remanente RCW 103 (Choque IR)",
    "Remanente 3C 391 (Ruptura Molecular)",
    "Remanente DEM L71 (Cáscara de Hierro)",
    "Remanente SNR 0509-67.5",
    "Remanente HB9 (G160.9+2.6)",
    "Remanente W28 (Frente OH / H2)",
    "Remanente G292.0+1.8",
    "Remanente CTB 1 (Abell 85)",
  ],
  cluster: [
    "Cúmulo Globular Omega Centauri (NGC 5139)",
    "Cúmulo Globular 47 Tucanae (NGC 104)",
    "Cúmulo Estelar Arches (Centro Galáctico)",
    "Cúmulo Estelar Quintuplet (Estrellas Wolf-Rayet)",
    "Supercúmulo Estelar Westerlund 1",
    "Cúmulo Joven Westerlund 2 (Gum 29)",
    "Cúmulo Superestelar R136 (30 Doradus)",
    "Las Pléyades (M45 · Nebulosa de Reflexión)",
    "Cúmulo Doble de Perseo (NGC 869 / NGC 884)",
    "Gran Cúmulo de Hércules (M13)",
    "Cúmulo Globular M15 (Pegaso)",
    "Chorro Protostelar Herbig-Haro HH 46/47",
    "Jet Bipolar Simétrico HH 212 (Orión H2)",
    "Disco y Chorro Protostelar HH 30",
    "Superjet Protostelar HH 111",
    "Protoestrella Reloj de Arena L1527 IRS",
    "Cúmulo Cofre de Joyas (NGC 4755)",
    "Cúmulo Trumpler 14 (Carina)",
    "Cúmulo Abierto M11 (Pato Salvaje)",
    "Cúmulo Globular M22 (Sagitario)",
    "Cúmulo Globular M4 (Escorpio)",
    "Cúmulo Abierto NGC 3603 (Estrellas O/B)",
    "Cúmulo Estelar Embebido RCW 38",
    "Objeto Herbig-Haro HH 1/2",
    "Protoestrella Clase 0 IRAS 16293-2422",
    "Cúmulo Coronet (R Coronae Australis)",
    "Cúmulo Árbol de Navidad (NGC 2264)",
    "Cúmulo Globular M5 (Serpens)",
  ],
  galaxy: [
    "Galaxia de Andrómeda (M31 · Núcleo y Anillos PAH)",
    "Galaxia del Triángulo (M33 · Regiones H II)",
    "Galaxia del Sombrero (M104 · Anillo de Polvo IR)",
    "Galaxias Antenas en Colisión (NGC 4038/4039)",
    "Galaxia Rueda de Carro (Cartwheel · Anillo Choque)",
    "Quinteto de Stephan (Grupo Compacto HCG 92)",
    "Galaxia Espiral de Bode (M81)",
    "Galaxia Molinillo Austral (M83 · Barra Estelar)",
    "Galaxia del Molinillo (M101)",
    "Galaxia Espiral Barrada NGC 1300",
    "Galaxia Starburst del Escultor (NGC 253)",
    "Galaxias en Interacción Arp 273 (Rosa Cósmica)",
    "Galaxia Fantasma (M74 · Brazos Espirales)",
    "Galaxia Aguja vista de Canto (NGC 4565)",
    "Galaxia Girasol (M63 · NGC 5055)",
    "Galaxia Ojo Negro (M64 · Polvo Contrarrotante)",
    "Galaxia Anular Objeto de Hoag",
    "Galaxia Infrarroja Ultraluminosa Arp 220",
    "Galaxia Espiral NGC 1365 (Gran Barrada)",
    "Cúmulo de Galaxias Abell 2744 (Campo Pandora)",
    "Cúmulo de Galaxias SMACS 0723 (Lente Gravitacional)",
    "Cadena de Galaxias de Markarian (Virgo)",
    "Galaxia Enana Gran Nube de Magallanes (LMC)",
    "Galaxia Enana Pequeña Nube de Magallanes (SMC)",
    "Galaxia Espiral NGC 628",
    "Galaxia de Anillo Polar NGC 4650A",
  ],
};

function classifyBaseDatasetCategory(ds) {
  const id = ds.id.toLowerCase();
  if (id.includes("sgr_a")) return "black_hole";
  if (id.includes("cas_a")) return "snr";
  if (id.includes("rho_ophiuchi")) return "cluster";
  if (
    id.includes("orion") ||
    id.includes("carina") ||
    id.includes("m16") ||
    id.includes("ngc7023") ||
    id.includes("tarantula") ||
    id.includes("helix")
  ) {
    return "nebula";
  }
  return "galaxy";
}

const state = {
  skyObjects: [],
  spherexBands: [],

  loadedBundles: {},
  lruQueue: [],
  baseDatasetIds: new Set(),

  activeDatasetId: null,
  hoveredDatasetId: null,
  isPinned: false,
  activeCategoryFilter: "all",

  // Estado de la animación GIF temporal (10 épocas puras T1..T10 de QR1, QR2, QR3 y DR1)
  currentEpochIndex: 0,
  gifPlaying: true,
  lastEpochStepTime: 0,
  epochIntervalMs: 210,

  paletteMode: "all18", // "all18" | "jwst_gold" | "manual_rgb"
  selR: "ch18_495um",
  selG: "ch13_329um",
  selB: "ch02_092um",
  viewMode: "sphere", // "sphere" | "flat"

  yaw: 0.0,
  pitch: 0.0,
  fov: 86.0,
  targetYaw: 0.0,
  targetPitch: 0.0,
  targetFov: 86.0,
  isAnimatingCamera: false,

  currentHoverRadiusScale: 0.0,
  lastHoveredIdForScale: null,

  flatZoom: 1,
  flatPanX: 0,
  flatPanY: 0,

  isDragging: false,
  dragMoved: false,
  lastMouseX: 0,
  lastMouseY: 0,

  stars3D: [],
  activeLabelEl: null,
  galleryCardsCache: [],
};

function decodeBase64Float32(b64) {
  const binStr = atob(b64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

function degToRad(d) {
  return (d * Math.PI) / 180.0;
}

function sphericalToVec3(azRad, elRad) {
  const cosEl = Math.cos(elRad);
  return [
    cosEl * Math.sin(azRad),
    Math.sin(elRad),
    cosEl * Math.cos(azRad),
  ];
}

function makeRng(seed) {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function generate3DStarfield(count = 1400) {
  const stars = [];
  const rand = makeRng(1337);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const x = r * Math.cos(theta);
    const y = u;
    const z = r * Math.sin(theta);

    const mag = Math.pow(rand(), 3.4);
    stars.push({
      x,
      y,
      z,
      size: 0.6 + mag * 1.1,
      alpha: 0.10 + mag * 0.35,
    });
  }
  state.stars3D = stars;
}

window.addEventListener("DOMContentLoaded", async () => {
  generate3DStarfield(1400);
  createFloatingActiveLabel();
  bindEvents();
  resizeCanvases();
  requestAnimationFrame(animationLoop);
  await loadDatasets();
});

function createFloatingActiveLabel() {
  const container = document.getElementById("sphereLabelsContainer");
  container.innerHTML = "";
  const el = document.createElement("div");
  el.className = "sphere-node-label active";
  el.style.display = "none";
  container.appendChild(el);
  state.activeLabelEl = el;
}

function mapRealDatasetToSkyObj(ds, idx) {
  const raDeg = Number(ds.ra || 0);
  const decDeg = Number(ds.dec || 0);
  const wrappedRa = ((raDeg % 360) + 360) % 360;
  const azRad = ((wrappedRa > 180 ? wrappedRa - 360 : wrappedRa) * Math.PI) / 180;
  const elRad = (Math.max(-89.5, Math.min(89.5, decDeg)) * Math.PI) / 180;
  const category = ds.category || classifyBaseDatasetCategory(ds);

  state.baseDatasetIds.add(ds.id);
  return {
    id: ds.id,
    name: ds.name,
    type: ds.type,
    category,
    ra: Number(wrappedRa.toFixed(4)),
    dec: Number(decDeg.toFixed(4)),
    azRad,
    elRad,
    centerVec: sphericalToVec3(azRad, elRad),
    width: ds.width,
    height: ds.height,
    description: ds.description,
    source: ds.source,
    seasons: ds.seasons || [],
    n_exposures: ds.n_exposures || 0,
    n_exposures_irsa: ds.n_exposures_irsa || 0,
    seed: idx + 1,
    isServerBase: true,
  };
}

async function loadDatasets(selectId = null) {
  const res = await fetch("/api/datasets");
  const data = await res.json();
  if (!data.ok) return;

  const baseDatasets = data.datasets || [];
  state.spherexBands = data.spherex_bands || [];

  const skyObjects = baseDatasets.map((ds, idx) => mapRealDatasetToSkyObj(ds, idx));
  state.skyObjects = skyObjects;
  updateCategoryBadgeCounts();
  rebuildDatasetSelectDropdown();

  if (skyObjects.length === 0) {
    document.getElementById("imageCountBadge").textContent =
      "Conectando a la API de NASA/IPAC IRSA SPHEREx...";
    return;
  }

  let firstId = selectId;
  const pend = window.__kronoxPendingSphereTarget;
  if (!firstId && pend && Number.isFinite(pend.ra) && Number.isFinite(pend.dec)) {
    let best = null;
    let bestDist = Infinity;
    for (const obj of skyObjects) {
      if (obj.type === "real_spherex_ondemand") continue;
      const dRa = Math.abs(((obj.ra - pend.ra + 540) % 360) - 180);
      const dDec = Math.abs(obj.dec - pend.dec);
      const dist = Math.hypot(dRa * Math.cos((pend.dec * Math.PI) / 180), dDec);
      if (dist < bestDist && dist <= 1.0) {
        best = obj;
        bestDist = dist;
      }
    }
    if (best) firstId = best.id;
  }
  if (!firstId) {
    firstId = (skyObjects.find((o) => o.type === "real_spherex_multiepoch") || skyObjects[0]).id;
  }
  await ensureBundleLoaded(firstId);
  setActiveDataset(firstId, Boolean(selectId || pend));

  // Precargamos solo los objetos reales ya cacheados en disco para respuesta instantánea
  const preloadIds = skyObjects
    .filter((o) => o.id !== firstId && o.type !== "real_spherex_ondemand")
    .slice(0, 14)
    .map((o) => o.id);
  await Promise.all(preloadIds.map((id) => ensureBundleLoaded(id)));

  updateImageCountBadge();

  if (!state.realRefreshTimer) {
    state.realRefreshTimer = setInterval(refreshRealObjectsFromServer, 12000);
  }
}

function updateImageCountBadge() {
  const realApiCount = state.skyObjects.filter((o) => o.type === "real_spherex_multiepoch").length;
  const totalCount = state.skyObjects.length;
  document.getElementById("imageCountBadge").textContent =
    `${totalCount} objetos 100 % reales en el cielo (${realApiCount} descargados + en vivo API IRSA SPHEREx)`;
}

async function refreshRealObjectsFromServer() {
  try {
    const r = await fetch("/api/spherex/refresh");
    const info = await r.json();
    if (!info.ok || !info.added) return;

    const res = await fetch("/api/datasets");
    const data = await res.json();
    if (!data.ok) return;

    const byId = new Map(state.skyObjects.map((o) => [o.id, o]));
    let changed = false;
    data.datasets.forEach((ds, idx) => {
      const prev = byId.get(ds.id);
      if (!prev) {
        state.skyObjects.push(mapRealDatasetToSkyObj(ds, idx));
        changed = true;
      } else if (prev.type !== ds.type) {
        prev.type = ds.type;
        prev.seasons = ds.seasons || [];
        prev.n_exposures = ds.n_exposures || 0;
        prev.description = ds.description;
        changed = true;
      }
    });
    if (changed) {
      updateCategoryBadgeCounts();
      rebuildDatasetSelectDropdown();
      updateImageCountBadge();
    }
  } catch (_) {
    // silencioso
  }
}

function updateCategoryBadgeCounts() {
  const counts = {
    nebula: 0,
    black_hole: 0,
    pulsar: 0,
    snr: 0,
    cluster: 0,
    galaxy: 0,
  };
  for (const obj of state.skyObjects) {
    if (counts[obj.category] !== undefined) counts[obj.category]++;
  }
  for (const [cat, val] of Object.entries(counts)) {
    const el = document.getElementById(`count_${cat}`);
    if (el) el.textContent = String(val);
  }
}

function rebuildDatasetSelectDropdown() {
  const sel = document.getElementById("datasetSelect");
  sel.innerHTML = "";
  const list =
    state.activeCategoryFilter === "all"
      ? state.skyObjects
      : state.skyObjects.filter((o) => o.category === state.activeCategoryFilter);

  const subset = list.slice(0, 260);
  for (const ds of subset) {
    const opt = document.createElement("option");
    opt.value = ds.id;
    opt.textContent = `[${CATEGORY_META[ds.category].label}] ${ds.name}`;
    sel.appendChild(opt);
  }
  if (state.activeDatasetId) {
    sel.value = state.activeDatasetId;
  }
}

function buildNormalizedBandArray(rawArr, width, height, isRealFits) {
  const n = rawArr.length;
  const step = Math.max(1, Math.floor(n / 4000));
  const posVals = [];
  for (let i = 0; i < n; i += step) {
    const v = rawArr[i];
    if (Number.isFinite(v) && v > 1e-7) posVals.push(v);
  }

  let vmin = 0.0;
  let vmax = 1.0;
  if (posVals.length > 10) {
    posVals.sort((a, b) => a - b);
    const lowFrac = isRealFits ? 0.56 : 0.08;
    const highFrac = isRealFits ? 0.994 : 0.988;
    vmin = posVals[Math.floor(lowFrac * (posVals.length - 1))];
    vmax = Math.max(vmin + 1e-6, posVals[Math.floor(highFrac * (posVals.length - 1))]);
  }

  const normArr = new Float32Array(n);
  const Q = isRealFits ? 12.0 : 6.5;
  const denom = Math.asinh(Q);
  const invSpan = 1.0 / (vmax - vmin);

  for (let i = 0; i < n; i++) {
    const lin = Math.max(0, (rawArr[i] - vmin) * invSpan);
    normArr[i] = Math.min(1.2, Math.asinh(Q * lin) / denom);
  }

  return { normArr, vmin, vmax };
}

const _inFlightBundles = new Map();

async function ensureBundleLoaded(datasetId) {
  if (state.loadedBundles[datasetId]) return state.loadedBundles[datasetId];
  if (_inFlightBundles.has(datasetId)) return _inFlightBundles.get(datasetId);

  const prom = (async () => {
    const skyObj = state.skyObjects.find((o) => o.id === datasetId);

    const res = await fetch(`/api/bundle?dataset_id=${encodeURIComponent(datasetId)}`);
    const data = await res.json();
    if (!data.ok) return null;

    const isRealFits =
      data.dataset.type === "real_spherex_fits" ||
      data.dataset.type === "real_spherex_multiepoch" ||
      data.dataset.type === "custom_fits";
    const images = [];
    const entries = Object.entries(data.planes);

    entries.forEach(([cid, extMap], idx) => {
      const bandInfo = state.spherexBands.find((b) => b.id === cid);
      const imgPayload = extMap["IMAGE"] || Object.values(extMap)[0];
      if (!imgPayload) return;

      const meta = imgPayload.meta || {};
      const w = meta.width;
      const h = meta.height;
      const rawImg = decodeBase64Float32(imgPayload.float32_b64);
      const { normArr, vmin, vmax } = buildNormalizedBandArray(rawImg, w, h, isRealFits);

      const chroma =
        (bandInfo && bandInfo.chroma_rgb) ||
        meta.chroma_rgb ||
        defaultChromaForIndex(idx, entries.length);

      images.push({
        id: cid,
        label: bandInfo ? bandInfo.name : meta.name || cid,
        shortLabel: bandInfo ? bandInfo.short_name : meta.short_name || cid,
        det: meta.det || null,
        season: meta.season !== undefined ? meta.season : 0,
        collection: meta.collection || data.dataset.source || "NASA/IRSA SPHEREx",
        mjd: meta.mjd || 0,
        dateObs: meta.date_obs || "",
        waveUm: meta.wave_center || (bandInfo ? bandInfo.wave_center : 2.0),
        bandwidthUm: meta.bandwidth_um || 0.1,
        fluxMJy: meta.flux_mJy !== undefined ? meta.flux_mJy : null,
        fluxErrMJy: meta.flux_err_mJy !== undefined ? meta.flux_err_mJy : null,
        bgMJysr: meta.bg_MJysr !== undefined ? meta.bg_MJysr : null,
        coreMeanMJysr: meta.core_mean_MJysr !== undefined ? meta.core_mean_MJysr : null,
        peakMJysr: meta.peak_MJysr !== undefined ? meta.peak_MJysr : null,
        fillFrac: meta.fill_frac !== undefined ? meta.fill_frac : 0,
        accessUrl: meta.access_url || "",
        floatArray: rawImg,
        normArray: normArr,
        chroma,
        width: w,
        height: h,
        bounds: { vmin, vmax },
      });
    });

    const category = skyObj ? skyObj.category : data.dataset.category || classifyBaseDatasetCategory(data.dataset);
    const azRad = skyObj ? skyObj.azRad : 0;
    const elRad = skyObj ? skyObj.elRad : 0;
    const centerVec = skyObj ? skyObj.centerVec : sphericalToVec3(azRad, elRad);

    const bundle = {
      id: datasetId,
      dataset: {
        ...data.dataset,
        category,
        ra: skyObj ? skyObj.ra : data.dataset.ra,
        dec: skyObj ? skyObj.dec : data.dataset.dec,
        seed: skyObj ? skyObj.seed : 17,
      },
      images,
      category,
      azRad,
      elRad,
      centerVec,
      compositeCanvas: document.createElement("canvas"),
      spherePatchCanvas: document.createElement("canvas"),
      epochCanvases: [],
      epochPatchCanvases: [],
      epochsMeta: [],
    };

    state.loadedBundles[datasetId] = bundle;
    buildBundleCompositeCanvas(bundle);

    if (skyObj && skyObj.type === "real_spherex_ondemand") {
      skyObj.type = "real_spherex_multiepoch";
      updateImageCountBadge();
    }

    state.lruQueue.push(datasetId);
    if (state.lruQueue.length > 48) {
      const oldestId = state.lruQueue.shift();
      if (
        oldestId &&
        oldestId !== state.activeDatasetId &&
        oldestId !== state.hoveredDatasetId
      ) {
        delete state.loadedBundles[oldestId];
      }
    }

    return bundle;
  })();

  _inFlightBundles.set(datasetId, prom);
  try {
    return await prom;
  } finally {
    _inFlightBundles.delete(datasetId);
  }
}

function defaultChromaForIndex(idx, total) {
  const t = total > 1 ? idx / (total - 1) : 0.5;
  const r = Math.min(1, Math.max(0.08, 2.2 * (t - 0.25)));
  const g = Math.max(0.12, Math.sin(Math.PI * Math.pow(t, 0.85)));
  const b = Math.min(1, Math.max(0.08, 1.0 - 1.55 * Math.max(0, t - 0.15) + 0.55 * Math.max(0, t - 0.75)));
  return [r, g, b];
}

function combineRealExposuresToRgb(imgs, w, h) {
  const npix = w * h;
  const accR = new Float32Array(npix);
  const accG = new Float32Array(npix);
  const accB = new Float32Array(npix);
  if (!imgs.length) return { accR, accG, accB };

  if (state.paletteMode === "manual_rgb" && imgs.length >= 2) {
    const imgR = imgs.find((i) => i.id === state.selR) || imgs[imgs.length - 1];
    const imgG = imgs.find((i) => i.id === state.selG) || imgs[Math.floor(imgs.length / 2)];
    const imgB = imgs.find((i) => i.id === state.selB) || imgs[0];
    const nR = imgR.normArray;
    const nG = imgG.normArray;
    const nB = imgB.normArray;
    for (let i = 0; i < npix; i++) {
      accR[i] = 1.08 * nR[i] + 0.18 * nG[i];
      accG[i] = 0.92 * nG[i] + 0.14 * nR[i] + 0.14 * nB[i];
      accB[i] = 1.08 * nB[i] + 0.14 * nG[i];
    }
    return { accR, accG, accB };
  }

  let sumWR = 0, sumWG = 0, sumWB = 0;
  const nBands = imgs.length;
  for (let bIdx = 0; bIdx < nBands; bIdx++) {
    const img = imgs[bIdx];
    let cr, cg, cb;
    if (state.paletteMode === "jwst_gold") {
      const t = Math.min(1, Math.max(0, ((img.waveUm || 2.0) - 0.75) / 4.25));
      const wBlue = Math.exp(-((t - 0.16) ** 2) / 0.085);
      const wGold = Math.exp(-((t - 0.56) ** 2) / 0.095);
      const wRuby = Math.exp(-((t - 0.90) ** 2) / 0.085);
      cr = 1.08 * wRuby + 0.95 * wGold + 0.06 * wBlue;
      cg = 0.14 * wRuby + 0.78 * wGold + 0.62 * wBlue;
      cb = 0.36 * wRuby + 0.10 * wGold + 1.08 * wBlue;
    } else {
      [cr, cg, cb] = img.chroma || defaultChromaForIndex(bIdx, nBands);
    }
    sumWR += cr;
    sumWG += cg;
    sumWB += cb;
    const na = img.normArray;
    for (let i = 0; i < npix; i++) {
      const v = na[i];
      accR[i] += v * cr;
      accG[i] += v * cg;
      accB[i] += v * cb;
    }
  }
  const invR = 1.72 / Math.max(1e-5, sumWR);
  const invG = 1.60 / Math.max(1e-5, sumWG);
  const invB = 1.72 / Math.max(1e-5, sumWB);
  for (let i = 0; i < npix; i++) {
    accR[i] *= invR;
    accG[i] *= invG;
    accB[i] *= invB;
  }
  return { accR, accG, accB };
}

/**
 * Construye las imágenes temporales y métricas fotométricas 100 % REALES
 * directamente desde los archivos FITS de NASA/IPAC IRSA SPHEREx (sin ningún píxel sintético).
 */
function buildBundleCompositeCanvas(bundle) {
  const imgs = bundle.images;
  if (!imgs.length) return;

  const w = imgs[0].width;
  const h = imgs[0].height;

  let epochGroups = [];
  if (bundle.dataset.type === "real_spherex_multiepoch") {
    // Agrupar exposiciones reales cronológicamente por ventana de observación (gap > 3.5 días o cambio DR1/QR3)
    const sortedByTime = imgs.slice().sort((a, b) => (a.mjd || 0) - (b.mjd || 0));
    const clusters = [];
    for (const im of sortedByTime) {
      const last = clusters[clusters.length - 1];
      const mjd = Number(im.mjd || 0);
      if (
        !last ||
        (mjd > 0 && last.lastMjd > 0 && Math.abs(mjd - last.lastMjd) > 3.5) ||
        last.collection !== im.collection
      ) {
        clusters.push({ lastMjd: mjd, collection: im.collection, imgs: [im] });
      } else {
        last.imgs.push(im);
        if (mjd > 0) last.lastMjd = mjd;
      }
    }

    // Si hay más de NUM_TEMPORAL_EPOCHS (10) ventanas, compactar uniformemente conservando el orden temporal
    let finalClusters = clusters;
    if (clusters.length > NUM_TEMPORAL_EPOCHS) {
      finalClusters = [];
      for (let i = 0; i < NUM_TEMPORAL_EPOCHS; i++) {
        const start = Math.floor((i * clusters.length) / NUM_TEMPORAL_EPOCHS);
        const end = Math.floor(((i + 1) * clusters.length) / NUM_TEMPORAL_EPOCHS);
        const merged = [];
        for (let j = start; j < end; j++) merged.push(...clusters[j].imgs);
        if (merged.length) finalClusters.push({ imgs: merged });
      }
    }

    epochGroups = finalClusters.map((grp, idx) => {
      const sorted = grp.imgs.slice().sort((a, b) => (a.det || 0) - (b.det || 0));
      const dates = sorted.map((g) => g.dateObs).filter(Boolean).sort();
      const colls = Array.from(new Set(sorted.map((g) => (g.collection || "spherex").replace("spherex_", "").toUpperCase())));
      const dLabel = dates.length ? dates[0].slice(0, 10) : `Época ${idx + 1}`;
      return {
        code: `T${idx + 1}`,
        dateLabel: dLabel,
        title: `T${idx + 1} · ${dLabel} (${colls.join("/")})`,
        imgs: sorted,
      };
    });
  } else {
    epochGroups = [
      {
        code: "T1",
        dateLabel: "FITS Real",
        title: `T1 · ${bundle.dataset.source || "NASA/IRSA SPHEREx"}`,
        imgs,
      },
    ];
  }

  const nEpochs = epochGroups.length;
  bundle.epochCanvases = Array.from({ length: nEpochs }, () => document.createElement("canvas"));
  bundle.epochPatchCanvases = Array.from({ length: nEpochs }, () => document.createElement("canvas"));
  bundle.epochsMeta = epochGroups.map((g) => ({
    code: g.code,
    dateLabel: g.dateLabel,
    title: g.title,
    detectors: Array.from(new Set(g.imgs.map((x) => (x.det ? `D${x.det}` : x.shortLabel)))),
    collections: Array.from(new Set(g.imgs.map((x) => x.collection))),
    nExposures: g.imgs.length,
  }));

  const totalBrightness = new Float32Array(nEpochs);
  const shortBrightness = new Float32Array(nEpochs);
  const midBrightness = new Float32Array(nEpochs);
  const longBrightness = new Float32Array(nEpochs);
  const colorRatioD6D1 = new Float32Array(nEpochs);
  const kinematicExpansion = new Float32Array(nEpochs);
  const detSharesByEpoch = [];

  for (let eIdx = 0; eIdx < nEpochs; eIdx++) {
    const grp = epochGroups[eIdx];
    const { accR, accG, accB } = combineRealExposuresToRgb(grp.imgs, w, h);

    const detTotals = [0, 0, 0, 0, 0, 0];
    const detCounts = [0, 0, 0, 0, 0, 0];
    let fluxSum = 0;
    let fluxCnt = 0;

    for (let bIdx = 0; bIdx < grp.imgs.length; bIdx++) {
      const im = grp.imgs[bIdx];
      const detIdx = im.det ? Math.max(0, Math.min(5, im.det - 1)) : Math.min(5, Math.floor((bIdx / Math.max(1, grp.imgs.length)) * 6));
      let valMJysr = im.coreMeanMJysr !== null ? Math.abs(im.coreMeanMJysr) : null;
      if (valMJysr === null) {
        let s = 0;
        const arr = im.floatArray;
        const step = Math.max(1, Math.floor(arr.length / 2000));
        let c = 0;
        for (let k = 0; k < arr.length; k += step) {
          if (Number.isFinite(arr[k])) {
            s += Math.abs(arr[k]);
            c++;
          }
        }
        valMJysr = c ? s / c : 0;
      }
      detTotals[detIdx] += valMJysr;
      detCounts[detIdx] += 1;
      if (im.fluxMJy !== null && Number.isFinite(im.fluxMJy)) {
        fluxSum += Math.abs(im.fluxMJy);
        fluxCnt++;
      }
    }

    const detMeans = detTotals.map((t, i) => (detCounts[i] > 0 ? t / detCounts[i] : 0));
    const fShort = ((detMeans[0] + detMeans[1]) / Math.max(1, (detCounts[0] > 0 ? 1 : 0) + (detCounts[1] > 0 ? 1 : 0))) || 0;
    const fMid = ((detMeans[2] + detMeans[3]) / Math.max(1, (detCounts[2] > 0 ? 1 : 0) + (detCounts[3] > 0 ? 1 : 0))) || 0;
    const fLong = ((detMeans[4] + detMeans[5]) / Math.max(1, (detCounts[4] > 0 ? 1 : 0) + (detCounts[5] > 0 ? 1 : 0))) || 0;

    const validMeans = detMeans.filter((_, i) => detCounts[i] > 0);
    const meanTotal = validMeans.length ? validMeans.reduce((a, b) => a + b, 0) / validMeans.length : 0;

    shortBrightness[eIdx] = fShort;
    midBrightness[eIdx] = fMid;
    longBrightness[eIdx] = fLong;
    totalBrightness[eIdx] = meanTotal;

    const shortRef = Math.max(1e-4, fShort || fMid || 1e-4);
    const longRef = fLong || fMid || shortRef;
    colorRatioD6D1[eIdx] = Number((longRef / shortRef).toFixed(2));
    kinematicExpansion[eIdx] = Number((fluxCnt > 0 ? fluxSum / fluxCnt : meanTotal).toFixed(2));

    const dSum = Math.max(1e-6, detMeans.reduce((a, b) => a + b, 0));
    detSharesByEpoch.push(detMeans.map((v) => (v / dSum) * 100));

    renderRgbFloatArraysToCanvases(
      accR,
      accG,
      accB,
      w,
      h,
      bundle.epochCanvases[eIdx],
      bundle.epochPatchCanvases[eIdx]
    );
  }

  let minB = Infinity;
  let maxB = -Infinity;
  let peakEpochIndex = 0;
  for (let i = 0; i < nEpochs; i++) {
    if (totalBrightness[i] < minB) minB = totalBrightness[i];
    if (totalBrightness[i] > maxB) {
      maxB = totalBrightness[i];
      peakEpochIndex = i;
    }
  }
  const deltaBrightnessPct = new Float32Array(nEpochs);
  for (let i = 0; i < nEpochs; i++) {
    deltaBrightnessPct[i] = minB > 1e-6 ? ((totalBrightness[i] - minB) / minB) * 100.0 : 0.0;
  }

  bundle.temporalMetrics = {
    totalBrightness,
    shortBrightness,
    midBrightness,
    longBrightness,
    deltaBrightnessPct,
    colorRatioD6D1,
    kinematicExpansion,
    detSharesByEpoch,
    peakEpochIndex,
    minB,
    maxB,
  };

  const curIdx = state.currentEpochIndex % nEpochs;
  bundle.compositeCanvas = bundle.epochCanvases[curIdx];
  bundle.spherePatchCanvas = bundle.epochPatchCanvases[curIdx];
}
function renderRgbFloatArraysToCanvases(accR, accG, accB, w, h, compC, patchC) {
  compC.width = w;
  compC.height = h;
  const cCtx = compC.getContext("2d");
  const imgData = cCtx.createImageData(w, h);
  const rgba = imgData.data;

  patchC.width = w;
  patchC.height = h;
  const pCtx = patchC.getContext("2d");
  const patchData = pCtx.createImageData(w, h);
  const pRgba = patchData.data;

  const cx = w * 0.5;
  const cy = h * 0.5;
  const maxR = Math.min(cx, cy);
  const satBoost = 1.52;

  for (let y = 0; y < h; y++) {
    const srcRow = h - 1 - y;
    const dy = (y - cy) / maxR;
    for (let x = 0; x < w; x++) {
      const sIdx = srcRow * w + x;
      const dIdx = (y * w + x) * 4;

      let r = accR[sIdx];
      let g = accG[sIdx];
      let b = accB[sIdx];

      r = r / (1.0 + 0.28 * r);
      g = g / (1.0 + 0.28 * g);
      b = b / (1.0 + 0.28 * b);

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.max(0, Math.min(1, lum + satBoost * (r - lum)));
      g = Math.max(0, Math.min(1, lum + satBoost * (g - lum)));
      b = Math.max(0, Math.min(1, lum + satBoost * (b - lum)));

      const rByte = Math.round(Math.pow(r, 0.88) * 255);
      const gByte = Math.round(Math.pow(g, 0.88) * 255);
      const bByte = Math.round(Math.pow(b, 0.88) * 255);

      rgba[dIdx] = rByte;
      rgba[dIdx + 1] = gByte;
      rgba[dIdx + 2] = bByte;
      rgba[dIdx + 3] = 255;

      const dx = (x - cx) / maxR;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let edgeAlpha = 1.0;
      if (dist > 0.64) {
        const t = Math.min(1.0, (dist - 0.64) / 0.34);
        edgeAlpha = 1.0 - t * t * (3.0 - 2.0 * t);
      }

      pRgba[dIdx] = Math.round(rByte * edgeAlpha);
      pRgba[dIdx + 1] = Math.round(gByte * edgeAlpha);
      pRgba[dIdx + 2] = Math.round(bByte * edgeAlpha);
      pRgba[dIdx + 3] = Math.round(edgeAlpha * 255);
    }
  }

  cCtx.putImageData(imgData, 0, 0);
  pCtx.putImageData(patchData, 0, 0);
}

function drawTemporalFilmstripThumbs(bundle) {
  if (!bundle || !bundle.epochCanvases) return;
  const nEpochs = bundle.epochCanvases.length;
  for (let eIdx = 0; eIdx < NUM_TEMPORAL_EPOCHS; eIdx++) {
    const thumb = document.getElementById(`epochThumb${eIdx}`);
    const frameBtn = thumb ? thumb.closest(".temporal-frame") : null;
    if (!thumb) continue;
    if (eIdx >= nEpochs) {
      if (frameBtn) frameBtn.style.display = "none";
      continue;
    }
    if (frameBtn) {
      frameBtn.style.display = "";
      const spanEl = frameBtn.querySelector("span");
      const em = bundle.epochsMeta && bundle.epochsMeta[eIdx];
      if (spanEl && em) {
        spanEl.textContent = `${em.code} · ${em.dateLabel}`;
      }
    }
    const tCtx = thumb.getContext("2d");
    tCtx.imageSmoothingEnabled = false;
    tCtx.clearRect(0, 0, thumb.width, thumb.height);
    tCtx.drawImage(bundle.epochCanvases[eIdx], 0, 0, thumb.width, thumb.height);
  }
}

function rebuildAllSphereComposites() {
  for (const bundle of Object.values(state.loadedBundles)) {
    buildBundleCompositeCanvas(bundle);
  }
  const activeBundle = state.loadedBundles[state.hoveredDatasetId || state.activeDatasetId];
  if (activeBundle) {
    drawTemporalFilmstripThumbs(activeBundle);
  }
  updateActiveSidePanels();
  updateHoverLensCard();
  if (state.viewMode === "flat") {
    drawFlatStage();
  }
}

function setPaletteMode(mode) {
  state.paletteMode = mode;
  document.querySelectorAll(".palette-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.palette === mode);
  });
  rebuildAllSphereComposites();
  state.sphereDirty = true;
}

function setCategoryFilter(cat) {
  state.activeCategoryFilter = cat;
  document.querySelectorAll(".cat-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === cat);
  });
  rebuildDatasetSelectDropdown();
  state.sphereDirty = true;
}

function setActiveDataset(datasetId, flyTo = false) {
  const bundle = state.loadedBundles[datasetId];
  if (!bundle) {
    return;
  }

  state.sphereDirty = true;

  const changed = state.activeDatasetId !== datasetId;
  state.activeDatasetId = datasetId;
  const sel = document.getElementById("datasetSelect");
  if (sel) sel.value = datasetId;

  document.getElementById("galleryHeaderTitle").textContent =
    `${bundle.dataset.name.replace(/^\d+\.\s*/, "")} (${bundle.images.length} bandas)`;

  if (changed) {
    populateImageSelectors(bundle);
    clearTimeout(state.galleryRenderTimer);
    state.galleryRenderTimer = setTimeout(() => {
      if (state.activeDatasetId === datasetId) renderGallery(bundle);
    }, 120);
    updateActiveSidePanels();
    drawTemporalFilmstripThumbs(bundle);
  }

  updateHoverLensCard();

  if (flyTo) {
    flyCameraTo(bundle.azRad, bundle.elRad, Math.min(state.fov, 64.0));
  }

  if (state.viewMode === "flat" && changed) {
    fitFlatStage();
    drawFlatStage();
  }
}

function getActiveDetectorsSet(bundle) {
  if (state.paletteMode !== "manual_rgb" || !bundle || !bundle.images.length) {
    return new Set(["D1", "D2", "D3", "D4", "D5", "D6"]);
  }
  const imgs = bundle.images;
  const set = new Set();
  [state.selR, state.selG, state.selB].forEach((selId) => {
    const idx = imgs.findIndex((i) => i.id === selId);
    if (idx >= 0) {
      const det = getDetectorForBand(imgs[idx].id, idx, imgs.length);
      set.add(det.id);
    }
  });
  return set.size ? set : new Set(["D1", "D3", "D6"]);
}

function updateHoverLensCard() {
  const lensEl = document.getElementById("skyHoverLens");
  const targetId = state.hoveredDatasetId || state.activeDatasetId;
  const bundle = targetId ? state.loadedBundles[targetId] : null;

  updateTemporalAnalyticsDock(bundle);

  if (!bundle || state.viewMode !== "sphere") {
    lensEl.classList.add("hidden");
    return;
  }

  lensEl.classList.remove("hidden");
  lensEl.classList.toggle("pinned", state.isPinned);

  const pinBadge = document.getElementById("lensPinBadge");
  pinBadge.classList.toggle("hidden", !state.isPinned);

  const catInfo = CATEGORY_META[bundle.category || "nebula"] || CATEGORY_META.nebula;
  const badgeEl = document.getElementById("lensTypeBadge");
  badgeEl.textContent = catInfo.label;
  badgeEl.style.color = catInfo.colorHex;
  badgeEl.style.borderColor = catInfo.colorHex;
  badgeEl.style.background = `${catInfo.glowRgba}0.16)`;

  const nEpochs = Math.max(1, (bundle.epochCanvases && bundle.epochCanvases.length) || 1);
  const epIdx = state.currentEpochIndex % nEpochs;
  const epMeta = (bundle.epochsMeta && bundle.epochsMeta[epIdx]) || EPOCH_META[0];
  document.getElementById("lensEpochBadge").textContent = epMeta.code || `T${epIdx + 1}`;
  document.getElementById("lensEpochOverlay").textContent = epMeta.title || epMeta.dateLabel || "";

  const scrubber = document.getElementById("epochScrubberSlider");
  const scrubberLbl = document.getElementById("epochScrubberLabel");
  if (scrubber) {
    scrubber.max = String(Math.max(0, nEpochs - 1));
    scrubber.value = String(epIdx);
    scrubber.disabled = nEpochs <= 1;
  }
  if (scrubberLbl) {
    const colls = epMeta.collections ? epMeta.collections.map((c) => c.replace("spherex_", "").toUpperCase()).join("/") : "";
    scrubberLbl.textContent = `T${epIdx + 1}/${nEpochs} · ${epMeta.dateLabel || ""}${colls ? ` (${colls})` : ""}`;
  }

  const verifyTxt = document.getElementById("lensArchiveVerifyText");
  if (verifyTxt) {
    if (bundle.liveIrsaStats) {
      const li = bundle.liveIrsaStats;
      verifyTxt.textContent = `IRSA vivo: ${li.total} obs (DR1: ${li.dr1} · QR3: ${li.qr3}) · ${li.seasons} temp.`;
    } else {
      const ds = bundle.dataset || {};
      const nDr1 = ds.n_dr1 ?? bundle.images.filter((im) => im.collection === "spherex_dr1").length;
      const nQr3 = ds.n_qr3 ?? bundle.images.filter((im) => im.collection === "spherex_qr3").length;
      const nIrsa = ds.n_exposures_irsa || bundle.images.length;
      verifyTxt.textContent = `Caché: DR1 ${nDr1} · QR3 ${nQr3} | IRSA: ${nIrsa} obs`;
    }
  }

  const transEl = document.getElementById("lensTransientOverlay");
  if (transEl) {
    const detsStr = epMeta.detectors ? epMeta.detectors.join(" · ") : "D1–D6";
    const nExp = epMeta.nExposures || bundle.images.length;
    transEl.textContent = `FITS Reales (${nExp} exp) · Detectores: ${detsStr}`;
    transEl.style.borderColor = `${catInfo.glowRgba}0.45)`;
    transEl.style.color = catInfo.colorHex;
  }

  // Actualizamos las píldoras de detectores SPHEREx (D1..D6) dentro del visor izquierdo
  const domMeta = CATEGORY_DOMINANT_DETECTORS[bundle.category || "nebula"] || CATEGORY_DOMINANT_DETECTORS.nebula;
  const activeDetSet = epMeta.detectors ? new Set(epMeta.detectors) : getActiveDetectorsSet(bundle);
  const domLabelEl = document.getElementById("lensDominantDetectors");
  if (domLabelEl) {
    domLabelEl.textContent =
      state.paletteMode === "manual_rgb"
        ? `Manual: ${Array.from(activeDetSet).join(" + ")}`
        : `Detectores reales en época: ${Array.from(activeDetSet).join(" · ")}`;
  }

  const pillsContainer = document.getElementById("lensDetectorsPills");
  if (pillsContainer && bundle.temporalMetrics) {
    const shares = bundle.temporalMetrics.detSharesByEpoch[epIdx] || [16, 16, 17, 17, 17, 17];
    pillsContainer.innerHTML = SPHEREX_DETECTORS.map((det, dIdx) => {
      const isAct = activeDetSet.has(det.id);
      const isDom = domMeta.dominant.includes(det.id);
      const borderCol = isDom ? det.color : isAct ? "#383838" : "#181818";
      return `<div class="lens-det-pill ${isAct ? "active" : ""} ${isDom ? "dominant" : ""}" style="border-color:${borderCol}" title="Detector SPHEREx ${det.id} (${det.wave} · ${det.role})">
        <span style="color:${isAct ? det.color : "#555"}">${isDom ? "★" : ""}${det.id}</span>
        <small>${shares[dIdx].toFixed(0)}%</small>
      </div>`;
    }).join("");
  }

  document.querySelectorAll(".temporal-frame").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.epoch) === epIdx);
  });

  const ra = Number(bundle.dataset.ra || 0).toFixed(3);
  const decNum = Number(bundle.dataset.dec || 0);
  const dec = (decNum >= 0 ? "+" : "") + decNum.toFixed(3);
  document.getElementById("lensCoords").textContent = `RA ${ra}° · Dec ${dec}° (J2000)`;

  document.getElementById("lensTitle").textContent = bundle.dataset.name;

  const lensCanvas = document.getElementById("hoverLensCanvas");
  const lCtx = lensCanvas.getContext("2d");
  lCtx.imageSmoothingEnabled = false;
  lCtx.clearRect(0, 0, lensCanvas.width, lensCanvas.height);

  const epCanvas =
    (bundle.epochCanvases && bundle.epochCanvases[epIdx]) ||
    bundle.compositeCanvas;
  lCtx.drawImage(epCanvas, 0, 0, lensCanvas.width, lensCanvas.height);
}

function updateTemporalAnalyticsDock(bundle) {
  const dockEl = document.getElementById("temporalAnalyticsDock");
  if (!dockEl) return;
  if (!bundle || !bundle.temporalMetrics) {
    dockEl.classList.add("hidden");
    return;
  }

  dockEl.classList.remove("hidden");
  const nEpochs = Math.max(1, bundle.temporalMetrics.totalBrightness.length);
  const epIdx = state.currentEpochIndex % nEpochs;
  const epMeta = (bundle.epochsMeta && bundle.epochsMeta[epIdx]) || EPOCH_META[0];
  const tm = bundle.temporalMetrics;
  const domMeta = CATEGORY_DOMINANT_DETECTORS[bundle.category || "nebula"] || CATEGORY_DOMINANT_DETECTORS.nebula;
  const activeDetSet = epMeta.detectors ? new Set(epMeta.detectors) : getActiveDetectorsSet(bundle);

  document.getElementById("analyticsObjectTitle").textContent = bundle.dataset.name;
  document.getElementById("analyticsEpochPill").textContent = epMeta.title || epMeta.dateLabel || `Época ${epIdx + 1}`;

  const modeLabelEl = document.getElementById("activeDetectorsModeLabel");
  if (modeLabelEl) {
    modeLabelEl.textContent =
      state.paletteMode === "manual_rgb"
        ? `Manual RGB: ${Array.from(activeDetSet).join(", ")}`
        : `Activos D1–D6 · Primarios: ${domMeta.dominant.join(", ")}`;
  }

  // Renderizamos la matriz de los 6 detectores SPHEREx (D1..D6)
  const gridEl = document.getElementById("spherexDetectorsGrid");
  if (gridEl) {
    const shares = tm.detSharesByEpoch[epIdx] || [16.6, 16.6, 16.6, 16.6, 16.6, 17.0];
    gridEl.innerHTML = SPHEREX_DETECTORS.map((det, idx) => {
      const isAct = activeDetSet.has(det.id);
      const isDom = domMeta.dominant.includes(det.id);
      const pct = shares[idx];
      const bCol = isDom ? det.color : isAct ? "#2b2b2b" : "#141414";
      return `<div class="detector-chip ${isAct ? "active" : "inactive"} ${isDom ? "dominant" : ""}" style="border-color:${bCol}" title="Detector SPHEREx ${det.id} (${det.camera} · ${det.wave} · ${det.channels}): ${det.role}">
        <div class="det-chip-top">
          <span class="det-chip-code">
            <i class="det-chip-dot" style="background:${det.color};box-shadow:0 0 6px ${det.color}"></i>
            ${det.id} ${isDom ? "★" : ""}
          </span>
          <span class="det-chip-share">${pct.toFixed(1)}%</span>
        </div>
        <div class="det-chip-wave">${det.wave} · ${det.channels}</div>
        <div class="det-chip-role">${det.role}</div>
        <div class="det-chip-bar-bg">
          <div class="det-chip-bar-fill" style="width:${Math.min(100, pct * 2.8)}%;background:${det.color}"></div>
        </div>
      </div>`;
    }).join("");
  }

  // KPIs numéricos en la época actual
  const curB = tm.totalBrightness[epIdx];
  const curDelta = tm.deltaBrightnessPct[epIdx];
  const curColor = tm.colorRatioD6D1[epIdx];
  const curKin = tm.kinematicExpansion[epIdx];
  const peakT = `T${tm.peakEpochIndex + 1}`;

  document.getElementById("kpiBrightnessVal").textContent = `${curB.toFixed(1)} MJy/sr`;
  const deltaEl = document.getElementById("kpiDeltaVal");
  deltaEl.textContent = `+${curDelta.toFixed(1)}% (Máx ${peakT})`;
  deltaEl.style.color = curDelta > 28 ? "#ffd000" : "#00e5c3";

  document.getElementById("kpiColorRatioVal").textContent = `${curColor.toFixed(2)} (${curColor >= 1.05 ? "Térmico D6" : "Azul D1"})`;
  document.getElementById("kpiKinematicVal").textContent = `${peakT} · ${curKin.toFixed(1)}″`;

  const noteEl = document.getElementById("factorSignatureNote");
  if (noteEl) {
    noteEl.textContent = domMeta.factorSignature;
  }

  drawBrightnessChart(bundle, epIdx);
  drawFactorsChart(bundle, epIdx);
}

function drawBrightnessChart(bundle, activeEpochIdx) {
  const canvas = document.getElementById("brightnessChartCanvas");
  if (!canvas || !bundle || !bundle.temporalMetrics) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const tm = bundle.temporalMetrics;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const seriesList = [
    { arr: tm.shortBrightness, color: "#00b4ff", width: 1.4, fill: false },
    { arr: tm.midBrightness, color: "#2ee66b", width: 1.4, fill: false },
    { arr: tm.longBrightness, color: "#ff3b5c", width: 1.4, fill: false },
    { arr: tm.totalBrightness, color: "#ffffff", width: 2.2, fill: true },
  ];

  const nEpochs = Math.max(1, tm.totalBrightness.length);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of seriesList) {
    for (let i = 0; i < nEpochs; i++) {
      if (s.arr[i] < yMin) yMin = s.arr[i];
      if (s.arr[i] > yMax) yMax = s.arr[i];
    }
  }
  const span = Math.max(0.05, yMax - yMin);
  yMin = Math.max(0, yMin - span * 0.12);
  yMax = yMax + span * 0.15;

  // Líneas horizontales de referencia + etiquetas MJy/sr
  ctx.strokeStyle = "#141414";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6e6e6e";
  ctx.font = "8.5px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "right";
  for (let g = 0; g <= 2; g++) {
    const frac = g / 2;
    const yy = padT + plotH * (1 - frac);
    const val = yMin + (yMax - yMin) * frac;
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(w - padR, yy);
    ctx.stroke();
    ctx.fillText(val >= 10 ? val.toFixed(0) : val.toFixed(2), padL - 4, yy + 3);
  }

  // Playhead vertical de la época actual
  const xForIdx = (i) => nEpochs <= 1 ? padL + plotW * 0.5 : padL + (i / (nEpochs - 1)) * plotW;
  const yForVal = (v) => padT + (1 - (v - yMin) / Math.max(1e-5, yMax - yMin)) * plotH;

  const curX = xForIdx(activeEpochIdx);
  ctx.save();
  ctx.strokeStyle = "rgba(0, 229, 195, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(curX, padT);
  ctx.lineTo(curX, padT + plotH);
  ctx.stroke();
  ctx.restore();

  // Dibujamos cada curva de brillo por detector
  for (const s of seriesList) {
    if (s.fill && nEpochs > 1) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.18)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(xForIdx(0), padT + plotH);
      for (let i = 0; i < nEpochs; i++) {
        ctx.lineTo(xForIdx(i), yForVal(s.arr[i]));
      }
      ctx.lineTo(xForIdx(nEpochs - 1), padT + plotH);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    for (let i = 0; i < nEpochs; i++) {
      const xx = xForIdx(i);
      const yy = yForVal(s.arr[i]);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    // Puntos en cada época real
    for (let i = 0; i < nEpochs; i++) {
      const xx = xForIdx(i);
      const yy = yForVal(s.arr[i]);
      const isCur = i === activeEpochIdx;
      ctx.fillStyle = isCur ? "#ffd000" : s.color;
      ctx.beginPath();
      ctx.arc(xx, yy, isCur ? 3.3 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Etiquetas del eje X
  ctx.textAlign = "center";
  ctx.font = "8.5px ui-monospace, SFMono-Regular, monospace";
  for (let i = 0; i < nEpochs; i++) {
    const xx = xForIdx(i);
    ctx.fillStyle = i === activeEpochIdx ? "#00e5c3" : "#777777";
    ctx.fillText(`T${i + 1}`, xx, h - 4);
  }
}

function drawFactorsChart(bundle, activeEpochIdx) {
  const canvas = document.getElementById("factorsChartCanvas");
  if (!canvas || !bundle || !bundle.temporalMetrics) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const tm = bundle.temporalMetrics;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  const padL = 34;
  const padR = 12;
  const padT = 10;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const normalizeSeries = (arr) => {
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] < mn) mn = arr[i];
      if (arr[i] > mx) mx = arr[i];
    }
    const sp = Math.max(1e-4, mx - mn);
    return Array.from(arr, (v) => ((v - mn) / sp) * 85 + 8);
  };

  const normDelta = normalizeSeries(tm.deltaBrightnessPct);
  const normColor = normalizeSeries(tm.colorRatioD6D1);
  const normKin = normalizeSeries(tm.kinematicExpansion);

  const factorSeries = [
    { arr: normKin, color: "#00e5c3", width: 1.5 },
    { arr: normColor, color: "#d946ef", width: 1.5 },
    { arr: normDelta, color: "#ffd000", width: 2.0 },
  ];

  ctx.strokeStyle = "#141414";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6e6e6e";
  ctx.font = "8px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "right";
  [0, 50, 100].forEach((pct) => {
    const yy = padT + plotH * (1 - pct / 100);
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(w - padR, yy);
    ctx.stroke();
    ctx.fillText(`${pct}%`, padL - 4, yy + 3);
  });

  const nEpochs = Math.max(1, tm.totalBrightness.length);
  const xForIdx = (i) => nEpochs <= 1 ? padL + plotW * 0.5 : padL + (i / (nEpochs - 1)) * plotW;
  const yForPct = (p) => padT + (1 - p / 100) * plotH;

  const curX = xForIdx(activeEpochIdx);
  ctx.save();
  ctx.strokeStyle = "rgba(255, 208, 0, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(curX, padT);
  ctx.lineTo(curX, padT + plotH);
  ctx.stroke();
  ctx.restore();

  for (const s of factorSeries) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    for (let i = 0; i < nEpochs; i++) {
      const xx = xForIdx(i);
      const yy = yForPct(s.arr[i]);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    for (let i = 0; i < nEpochs; i++) {
      const xx = xForIdx(i);
      const yy = yForPct(s.arr[i]);
      const isCur = i === activeEpochIdx;
      ctx.fillStyle = isCur ? "#ffffff" : s.color;
      ctx.beginPath();
      ctx.arc(xx, yy, isCur ? 3.1 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.textAlign = "center";
  ctx.font = "8.5px ui-monospace, SFMono-Regular, monospace";
  for (let i = 0; i < nEpochs; i++) {
    const xx = xForIdx(i);
    ctx.fillStyle = i === activeEpochIdx ? "#ffd000" : "#777777";
    ctx.fillText(`T${i + 1}`, xx, h - 4);
  }
}

function flyCameraTo(targetYaw, targetPitch, targetFov = null) {
  let diff = targetYaw - state.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  state.targetYaw = state.yaw + diff;
  state.targetPitch = Math.max(-Math.PI * 0.46, Math.min(Math.PI * 0.46, targetPitch));
  if (targetFov !== null) {
    state.targetFov = targetFov;
  }
  state.isAnimatingCamera = true;
}

function populateImageSelectors(bundle) {
  const selR = document.getElementById("selectR");
  const selG = document.getElementById("selectG");
  const selB = document.getElementById("selectB");
  const imgs = bundle.images;

  [selR, selG, selB].forEach((sel) => {
    sel.innerHTML = "";
    imgs.forEach((img, idx) => {
      const det = getDetectorForBand(img.id, idx, imgs.length);
      const opt = document.createElement("option");
      opt.value = img.id;
      opt.textContent = `[${det.id}] ${img.shortLabel}`;
      opt.title = `Detector SPHEREx ${det.id} (${det.wave}) · ${img.label}`;
      sel.appendChild(opt);
    });
  });

  if (!imgs.some((i) => i.id === state.selR)) {
    if (imgs.length >= 18) {
      state.selR = imgs[17].id;
      state.selG = imgs[12].id;
      state.selB = imgs[1].id;
    } else if (imgs.length >= 3) {
      state.selR = imgs[imgs.length - 1].id;
      state.selG = imgs[Math.floor(imgs.length / 2)].id;
      state.selB = imgs[0].id;
    } else if (imgs.length > 0) {
      state.selR = imgs[0].id;
      state.selG = imgs[0].id;
      state.selB = imgs[0].id;
    }
  }

  selR.value = state.selR;
  selG.value = state.selG;
  selB.value = state.selB;
}

function updateActiveSidePanels() {
  const bundle = state.loadedBundles[state.activeDatasetId];
  if (!bundle) return;
  const imgs = bundle.images;
  const w = bundle.dataset.width;
  const h = bundle.dataset.height;

  const catInfo = CATEGORY_META[bundle.category || "nebula"] || CATEGORY_META.nebula;
  const domMeta = CATEGORY_DOMINANT_DETECTORS[bundle.category || "nebula"] || CATEGORY_DOMINANT_DETECTORS.nebula;
  const pinText = state.isPinned ? " 📌 [Punto Fijado]" : "";
  const nEpochs = Math.max(1, (bundle.epochCanvases && bundle.epochCanvases.length) || 1);
  const epIdx = state.currentEpochIndex % nEpochs;
  const epMeta = (bundle.epochsMeta && bundle.epochsMeta[epIdx]) || EPOCH_META[0];

  const galDetSum = document.getElementById("galleryDetectorSummary");
  if (galDetSum) {
    galDetSum.innerHTML = `Detectores SPHEREx dominantes: <b>${domMeta.summary}</b> · Activos en plano focal: <b>D1–D6</b>`;
  }

  if (state.paletteMode === "manual_rgb") {
    const idxR = Math.max(0, imgs.findIndex((i) => i.id === state.selR));
    const idxG = Math.max(0, imgs.findIndex((i) => i.id === state.selG));
    const idxB = Math.max(0, imgs.findIndex((i) => i.id === state.selB));
    const imgR = imgs[idxR] || imgs[imgs.length - 1];
    const imgG = imgs[idxG] || imgs[Math.floor(imgs.length / 2)];
    const imgB = imgs[idxB] || imgs[0];
    const detR = getDetectorForBand(imgR.id, idxR, imgs.length);
    const detG = getDetectorForBand(imgG.id, idxG, imgs.length);
    const detB = getDetectorForBand(imgB.id, idxB, imgs.length);

    drawNormArrayToCanvas(document.getElementById("thumbR"), imgR.normArray, w, h, [1.0, 0.24, 0.28]);
    drawNormArrayToCanvas(document.getElementById("thumbG"), imgG.normArray, w, h, [0.22, 0.95, 0.45]);
    drawNormArrayToCanvas(document.getElementById("thumbB"), imgB.normArray, w, h, [0.24, 0.62, 1.0]);
    document.getElementById("compositeCaption").textContent =
      `[${catInfo.label} · ${epMeta.code}] ${bundle.dataset.name}${pinText}   ·   Detectores SPHEREx: R=${detR.id} (${imgR.shortLabel}) | G=${detG.id} (${imgG.shortLabel}) | B=${detB.id} (${imgB.shortLabel})`;
  } else {
    drawNormArrayToCanvas(document.getElementById("thumbR"), bundle.synthR, w, h, [1.0, 0.25, 0.42]);
    drawNormArrayToCanvas(document.getElementById("thumbG"), bundle.synthG, w, h, [1.0, 0.78, 0.22]);
    drawNormArrayToCanvas(document.getElementById("thumbB"), bundle.synthB, w, h, [0.18, 0.72, 1.0]);
    document.getElementById("compositeCaption").textContent =
      `[${catInfo.label} · ${epMeta.title}] ${bundle.dataset.name}${pinText}   ·   Detectores SPHEREx: D1–D6 (Primarios: ${domMeta.dominant.join(", ")}) · GIF ${state.epochIntervalMs} ms`;
  }

  updateGalleryActiveButtons();
}

function renderGallery(bundle) {
  const grid = document.getElementById("imageGallery");
  const maxShow = Math.min(18, bundle.images.length);
  const imgs = bundle.images.slice(0, maxShow);

  if (state.galleryCardsCache.length !== imgs.length) {
    grid.innerHTML = "";
    state.galleryCardsCache = [];

    for (let i = 0; i < imgs.length; i++) {
      const card = document.createElement("div");
      card.className = "gallery-card";

      const thumbCanvas = document.createElement("canvas");
      card.appendChild(thumbCanvas);

      const title = document.createElement("div");
      title.className = "gallery-card-label";
      card.appendChild(title);

      const bar = document.createElement("div");
      bar.className = "rgb-assign-bar";
      const btns = {};

      ["R", "G", "B"].forEach((ch) => {
        const btn = document.createElement("button");
        btn.className = "assign-btn";
        btn.dataset.channel = ch;
        btn.textContent = ch;
        btn.addEventListener("click", () => {
          const imgId = btn.dataset.imgId;
          if (ch === "R") {
            state.selR = imgId;
            document.getElementById("selectR").value = imgId;
          } else if (ch === "G") {
            state.selG = imgId;
            document.getElementById("selectG").value = imgId;
          } else {
            state.selB = imgId;
            document.getElementById("selectB").value = imgId;
          }
          setPaletteMode("manual_rgb");
        });
        bar.appendChild(btn);
        btns[ch] = btn;
      });

      card.appendChild(bar);
      grid.appendChild(card);
      state.galleryCardsCache.push({ thumbCanvas, title, btns });
    }
  }

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const det = getDetectorForBand(img.id, i, imgs.length);
    const slot = state.galleryCardsCache[i];
    const [cr, cg, cb] = img.chroma;
    drawNormArrayToCanvas(slot.thumbCanvas, img.normArray, img.width, img.height, [
      0.35 + 0.65 * cr,
      0.35 + 0.65 * cg,
      0.35 + 0.65 * cb,
    ]);
    slot.title.innerHTML = `<span class="gallery-det-badge" style="background:${det.color}">${det.id}</span>${img.shortLabel}`;
    slot.title.title = `Detector SPHEREx ${det.id} (${det.wave} · ${det.role}) — ${img.label}`;
    slot.btns.R.dataset.imgId = img.id;
    slot.btns.G.dataset.imgId = img.id;
    slot.btns.B.dataset.imgId = img.id;
  }

  updateGalleryActiveButtons();
}

function updateGalleryActiveButtons() {
  document.querySelectorAll(".assign-btn").forEach((btn) => {
    const ch = btn.dataset.channel;
    const id = btn.dataset.imgId;
    const isManual = state.paletteMode === "manual_rgb";
    btn.classList.toggle("active-r", !isManual || (ch === "R" && id === state.selR));
    btn.classList.toggle("active-g", !isManual || (ch === "G" && id === state.selG));
    btn.classList.toggle("active-b", !isManual || (ch === "B" && id === state.selB));
  });
}

function drawNormArrayToCanvas(c, normArr, width, height, tint) {
  if (!normArr) return;
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  const idata = ctx.createImageData(width, height);
  const d = idata.data;

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const s = Math.min(1, Math.max(0, normArr[srcRow * width + x]));
      const val = Math.round(Math.pow(s, 0.88) * 255);
      const idx = (y * width + x) * 4;
      d[idx] = Math.round(val * tint[0]);
      d[idx + 1] = Math.round(val * tint[1]);
      d[idx + 2] = Math.round(val * tint[2]);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(idata, 0, 0);
}

let _cachedSphereCanvas = null;
let _cachedSphereCtx = null;
let _sphereGridPolylines = null;
const _categoryDotSprites = {};
let _lastLabelState = { visible: false, text: "", border: "", left: "", top: "" };

function getSphereCanvasAndCtx() {
  if (!_cachedSphereCanvas) {
    _cachedSphereCanvas = document.getElementById("sphereCanvas");
    if (_cachedSphereCanvas) {
      _cachedSphereCtx = _cachedSphereCanvas.getContext("2d", { alpha: false });
    }
  }
  return { canvas: _cachedSphereCanvas, ctx: _cachedSphereCtx };
}

function getSphereGridPolylines() {
  if (_sphereGridPolylines) return _sphereGridPolylines;
  const lines = [];
  for (let decDeg = -60; decDeg <= 60; decDeg += 30) {
    const el = degToRad(decDeg);
    const pts = [];
    for (let azDeg = 0; azDeg <= 360; azDeg += 6) {
      const [vx, vy, vz] = sphericalToVec3(degToRad(azDeg), el);
      pts.push(vx, vy, vz);
    }
    lines.push(new Float32Array(pts));
  }
  for (let raDeg = 0; raDeg < 360; raDeg += 30) {
    const az = degToRad(raDeg);
    const pts = [];
    for (let decDeg = -84; decDeg <= 84; decDeg += 6) {
      const [vx, vy, vz] = sphericalToVec3(az, degToRad(decDeg));
      pts.push(vx, vy, vz);
    }
    lines.push(new Float32Array(pts));
  }
  _sphereGridPolylines = lines;
  return lines;
}

function getCategoryDotSprite(catKey) {
  const key = CATEGORY_META[catKey] ? catKey : "nebula";
  if (_categoryDotSprites[key]) return _categoryDotSprites[key];
  const meta = CATEGORY_META[key];
  const size = 32;
  const half = size * 0.5;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(half, half, 1, half, half, half - 1);
  grad.addColorStop(0, meta.colorHex);
  grad.addColorStop(0.32, `${meta.glowRgba}0.75)`);
  grad.addColorStop(0.62, `${meta.glowRgba}0.24)`);
  grad.addColorStop(1, `${meta.glowRgba}0.0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(half, half, half - 1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = meta.colorHex;
  g.beginPath();
  g.arc(half, half, 4.2, 0, Math.PI * 2);
  g.fill();
  _categoryDotSprites[key] = c;
  return c;
}

function projectUnitVecToScreen(vx, vy, vz, width, height, camBasis) {
  const { rx, ry, rz, ux, uy, uz, fx, fy, fz, focal } = camBasis;
  const cx = vx * rx + vy * ry + vz * rz;
  const cy = vx * ux + vy * uy + vz * uz;
  const cz = vx * fx + vy * fy + vz * fz;

  if (cz <= 0.04) return null;

  const denom = 0.65 * cz + 0.35;
  const sx = width * 0.5 + (cx / denom) * focal;
  const sy = height * 0.5 - (cy / denom) * focal;
  return { sx, sy, cz, scale: focal / denom };
}

function getCameraBasis(width, height) {
  const cosP = Math.cos(state.pitch);
  const sinP = Math.sin(state.pitch);
  const cosY = Math.cos(state.yaw);
  const sinY = Math.sin(state.yaw);

  const fx = cosP * sinY;
  const fy = sinP;
  const fz = cosP * cosY;

  const rx = cosY;
  const ry = 0;
  const rz = -sinY;

  const ux = -sinP * sinY;
  const uy = cosP;
  const uz = -sinP * cosY;

  const fovRad = degToRad(state.fov);
  const focal = (height * 0.5) / Math.tan(fovRad * 0.5);

  return { rx, ry, rz, ux, uy, uz, fx, fy, fz, focal };
}

function renderSphereFrame() {
  const { canvas, ctx } = getSphereCanvasAndCtx();
  if (!canvas || !ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const scrHalfW = w * 0.5;
  const scrHalfH = h * 0.5;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  const cam = getCameraBasis(w, h);
  const { rx, ry, rz, ux, uy, uz, fx, fy, fz, focal } = cam;

  // 1. Grilla celeste precomputada (sin trigonometría ni asignaciones por frame)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;
  const gridLines = getSphereGridPolylines();
  for (let l = 0; l < gridLines.length; l++) {
    const arr = gridLines[l];
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < arr.length; i += 3) {
      const vx = arr[i], vy = arr[i + 1], vz = arr[i + 2];
      const cz = vx * fx + vy * fy + vz * fz;
      if (cz <= 0.04) {
        started = false;
        continue;
      }
      const inv = focal / (0.65 * cz + 0.35);
      const sx = scrHalfW + (vx * rx + vy * ry + vz * rz) * inv;
      const sy = scrHalfH - (vx * ux + vy * uy + vz * uz) * inv;
      if (sx >= -100 && sx <= w + 100 && sy >= -100 && sy <= h + 100) {
        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      } else {
        started = false;
      }
    }
    ctx.stroke();
  }

  // 2. Campo estelar 3D (proyección inline sin asignación de objetos)
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  const stars = state.stars3D;
  for (let i = 0; i < stars.length; i++) {
    const st = stars[i];
    const vx = st.x, vy = st.y, vz = st.z;
    const cz = vx * fx + vy * fy + vz * fz;
    if (cz <= 0.04) continue;
    const inv = focal / (0.65 * cz + 0.35);
    const sx = scrHalfW + (vx * rx + vy * ry + vz * rz) * inv;
    if (sx < 0 || sx > w) continue;
    const sy = scrHalfH - (vx * ux + vy * uy + vz * uz) * inv;
    if (sy < 0 || sy > h) continue;
    ctx.fillRect(sx, sy, st.size, st.size);
  }

  const focusId = state.hoveredDatasetId || state.activeDatasetId;
  const activeFilter = state.activeCategoryFilter;
  const zoomBoost = Math.max(0.85, Math.min(2.2, 86.0 / state.fov));
  const sqrtZoom = Math.sqrt(zoomBoost);

  // 3. Puntos reales del cielo con sprites pre-renderizados (cero path/arc por objeto)
  const objs = state.skyObjects;
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    if (activeFilter !== "all" && obj.category !== activeFilter) {
      obj.lastProj = null;
      continue;
    }

    const vec = obj.centerVec;
    const vx = vec[0], vy = vec[1], vz = vec[2];
    const cz = vx * fx + vy * fy + vz * fz;
    if (cz <= 0.04) {
      obj.lastProj = null;
      continue;
    }
    const inv = focal / (0.65 * cz + 0.35);
    const sx = scrHalfW + (vx * rx + vy * ry + vz * rz) * inv;
    const sy = scrHalfH - (vx * ux + vy * uy + vz * uz) * inv;
    if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) {
      obj.lastProj = null;
      continue;
    }

    if (!obj._projCache) obj._projCache = { sx: 0, sy: 0, cz: 0, scale: 0 };
    obj._projCache.sx = sx;
    obj._projCache.sy = sy;
    obj._projCache.cz = cz;
    obj._projCache.scale = inv;
    obj.lastProj = obj._projCache;

    const isFocused = obj.id === focusId;
    const sprite = getCategoryDotSprite(obj.category);
    const drawHalf = (obj.isServerBase ? 11.5 : 8.5) * sqrtZoom * (isFocused ? 1.45 : 1.0);
    ctx.drawImage(sprite, sx - drawHalf, sy - drawHalf, drawHalf * 2, drawHalf * 2);
  }

  // 4. Desplegamos el recorte real del punto enfocado/fijado
  const labelEl = state.activeLabelEl;
  const focusBundle = focusId ? state.loadedBundles[focusId] : null;
  const hideLabel = () => {
    if (labelEl && _lastLabelState.visible) {
      labelEl.style.display = "none";
      _lastLabelState.visible = false;
    }
  };

  if (!focusBundle || !focusBundle.spherePatchCanvas) {
    hideLabel();
    return;
  }

  if (state.lastHoveredIdForScale !== focusId) {
    state.lastHoveredIdForScale = focusId;
    state.currentHoverRadiusScale = 0.35;
  } else {
    state.currentHoverRadiusScale += (1.0 - state.currentHoverRadiusScale) * 0.28;
  }

  const [cx, cy, cz] = focusBundle.centerVec;
  const centerProj = projectUnitVecToScreen(cx, cy, cz, w, h, cam);

  if (!centerProj || centerProj.cz < 0.08) {
    hideLabel();
    return;
  }

  const angularRadiusRad = degToRad(25.0 * state.currentHoverRadiusScale);

  const eastX = Math.cos(focusBundle.azRad);
  const eastY = 0;
  const eastZ = -Math.sin(focusBundle.azRad);

  const northX = -Math.sin(focusBundle.elRad) * Math.sin(focusBundle.azRad);
  const northY = Math.cos(focusBundle.elRad);
  const northZ = -Math.sin(focusBundle.elRad) * Math.cos(focusBundle.azRad);

  const sinA = Math.sin(angularRadiusRad);
  const cosA = Math.cos(angularRadiusRad);

  const pEast = projectUnitVecToScreen(
    cx * cosA + eastX * sinA,
    cy * cosA + eastY * sinA,
    cz * cosA + eastZ * sinA,
    w,
    h,
    cam
  );
  const pNorth = projectUnitVecToScreen(
    cx * cosA + northX * sinA,
    cy * cosA + northY * sinA,
    cz * cosA + northZ * sinA,
    w,
    h,
    cam
  );

  if (!pEast || !pNorth) {
    if (labelEl) labelEl.style.display = "none";
    return;
  }

  const dEx = pEast.sx - centerProj.sx;
  const dEy = pEast.sy - centerProj.sy;
  const dNx = pNorth.sx - centerProj.sx;
  const dNy = pNorth.sy - centerProj.sy;
  const screenRad = Math.hypot(dEx, dEy);

  const nFocusEpochs = Math.max(1, (focusBundle.epochPatchCanvases && focusBundle.epochPatchCanvases.length) || 1);
  const focusEpIdx = state.currentEpochIndex % nFocusEpochs;
  const activePatchCanvas =
    (focusBundle.epochPatchCanvases && focusBundle.epochPatchCanvases[focusEpIdx]) ||
    focusBundle.spherePatchCanvas;

  const patchW = activePatchCanvas.width;
  const patchH = activePatchCanvas.height;
  const halfW = patchW * 0.5;
  const halfH = patchH * 0.5;

  ctx.save();
  const bgGrad = ctx.createRadialGradient(
    centerProj.sx,
    centerProj.sy,
    screenRad * 0.45,
    centerProj.sx,
    centerProj.sy,
    screenRad * 1.02
  );
  bgGrad.addColorStop(0, "rgba(0, 0, 0, 0.94)");
  bgGrad.addColorStop(0.78, "rgba(0, 0, 0, 0.82)");
  bgGrad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(centerProj.sx, centerProj.sy, screenRad * 1.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.setTransform(
    dEx / halfW,
    dEy / halfW,
    -dNx / halfH,
    -dNy / halfH,
    centerProj.sx,
    centerProj.sy
  );
  ctx.drawImage(activePatchCanvas, -halfW, -halfH, patchW, patchH);
  ctx.restore();

  const catMeta = CATEGORY_META[focusBundle.category || "nebula"] || CATEGORY_META.nebula;
  const nEpochs = Math.max(1, (focusBundle.epochCanvases && focusBundle.epochCanvases.length) || 1);
  const epIdx = state.currentEpochIndex % nEpochs;
  const epMeta = (focusBundle.epochsMeta && focusBundle.epochsMeta[epIdx]) || EPOCH_META[0];

  ctx.save();
  ctx.strokeStyle = `${catMeta.glowRgba}0.30)`;
  ctx.lineWidth = state.isPinned ? 5.2 : 3.8;
  ctx.beginPath();
  ctx.arc(centerProj.sx, centerProj.sy, screenRad * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = catMeta.colorHex;
  ctx.lineWidth = state.isPinned ? 2.2 : 1.5;
  ctx.stroke();
  ctx.restore();

  if (labelEl) {
    const labelY = centerProj.sy + Math.hypot(dNx, dNy) * 0.86 + 14;
    const labelX = centerProj.sx;
    if (labelX >= 24 && labelX <= w - 24 && labelY >= 24 && labelY <= h - 24) {
      const txt = `[${epMeta.code}] ${catMeta.label} · ${focusBundle.dataset.name}`;
      const leftStr = `${Math.round(labelX)}px`;
      const topStr = `${Math.round(labelY)}px`;
      if (_lastLabelState.text !== txt) {
        labelEl.textContent = txt;
        _lastLabelState.text = txt;
      }
      if (_lastLabelState.border !== catMeta.colorHex) {
        labelEl.style.borderColor = catMeta.colorHex;
        _lastLabelState.border = catMeta.colorHex;
      }
      if (!_lastLabelState.visible) {
        labelEl.style.display = "block";
        _lastLabelState.visible = true;
      }
      if (_lastLabelState.left !== leftStr) {
        labelEl.style.left = leftStr;
        _lastLabelState.left = leftStr;
      }
      if (_lastLabelState.top !== topStr) {
        labelEl.style.top = topStr;
        _lastLabelState.top = topStr;
      }
    } else if (_lastLabelState.visible) {
      labelEl.style.display = "none";
      _lastLabelState.visible = false;
    }
  }
}

function setGifIntervalMs(ms) {
  const clamped = Math.max(40, Math.min(1200, Math.round(Number(ms) || 210)));
  state.epochIntervalMs = clamped;

  const topSlider = document.getElementById("topGifSpeedSlider");
  const lensSlider = document.getElementById("lensGifSpeedSlider");
  if (topSlider && Number(topSlider.value) !== clamped) topSlider.value = String(clamped);
  if (lensSlider && Number(lensSlider.value) !== clamped) lensSlider.value = String(clamped);

  const mult = (420 / clamped).toFixed(1);
  const fps = (1000 / clamped).toFixed(1);

  const topVal = document.getElementById("topGifSpeedValue");
  if (topVal) topVal.textContent = `${mult}x (${clamped} ms)`;

  const lensVal = document.getElementById("lensGifSpeedLabel");
  if (lensVal) lensVal.textContent = `${fps} fps (${clamped} ms)`;

  document.querySelectorAll(".speed-chip").forEach((chip) => {
    chip.classList.toggle("active", Math.abs(Number(chip.dataset.ms) - clamped) <= 15);
  });

  updateActiveSidePanels();
}

function animationLoop(now = 0) {
  if (!document.getElementById("sphereCanvas")) return;
  // Reloj del GIF temporal: pausado durante el arrastre para que el 360° vaya a 60fps fluidos
  if (!state.isDragging && state.gifPlaying && now - state.lastEpochStepTime >= state.epochIntervalMs) {
    state.lastEpochStepTime = now;
    const focusId = state.hoveredDatasetId || state.activeDatasetId;
    const activeB = focusId ? state.loadedBundles[focusId] : null;
    const cycleLen = Math.max(1, (activeB && activeB.epochCanvases && activeB.epochCanvases.length) || 1);
    state.currentEpochIndex = (state.currentEpochIndex + 1) % cycleLen;
    updateHoverLensCard();
    updateActiveSidePanels();
    state.sphereDirty = true;
    if (state.viewMode === "flat") {
      drawFlatStage();
    }
  }

  if (state.isAnimatingCamera) {
    const dyaw = state.targetYaw - state.yaw;
    const dpitch = state.targetPitch - state.pitch;
    const dfov = state.targetFov - state.fov;
    if (Math.abs(dyaw) < 0.0008 && Math.abs(dpitch) < 0.0008 && Math.abs(dfov) < 0.05) {
      state.yaw = state.targetYaw;
      state.pitch = state.targetPitch;
      state.fov = state.targetFov;
      state.isAnimatingCamera = false;
    } else {
      state.yaw += dyaw * 0.14;
      state.pitch += dpitch * 0.14;
      state.fov += dfov * 0.14;
    }
    state.sphereDirty = true;
  }

  if (state.viewMode === "sphere") {
    const needsScaleAnim = Math.abs((state.currentHoverRadiusScale || 1) - 1.0) > 0.006;
    if (state.sphereDirty || state.isDragging || state.isAnimatingCamera || needsScaleAnim) {
      state.sphereDirty = false;
      renderSphereFrame();
    }
  }
  requestAnimationFrame(animationLoop);
}

function fitFlatStage() {
  const bundle = state.loadedBundles[state.activeDatasetId];
  if (!bundle) return;
  const canvas = document.getElementById("flatCanvas");
  const cw = canvas.width;
  const ch = canvas.height;
  const imgW = bundle.dataset.width;
  const imgH = bundle.dataset.height;
  state.flatZoom = Math.min(cw / imgW, ch / imgH) * 0.86;
  state.flatPanX = (cw - imgW * state.flatZoom) * 0.5;
  state.flatPanY = (ch - imgH * state.flatZoom) * 0.5;
}

function drawFlatStage() {
  const bundle = state.loadedBundles[state.activeDatasetId];
  if (!bundle) return;
  const canvas = document.getElementById("flatCanvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const epCanvas =
    (bundle.epochCanvases && bundle.epochCanvases[state.currentEpochIndex]) ||
    bundle.compositeCanvas;

  const drawW = epCanvas.width * state.flatZoom;
  const drawH = epCanvas.height * state.flatZoom;
  ctx.drawImage(epCanvas, state.flatPanX, state.flatPanY, drawW, drawH);
}

function resizeCanvases() {
  const stage = document.getElementById("stageContainer");
  const sphereC = document.getElementById("sphereCanvas");
  const flatC = document.getElementById("flatCanvas");
  sphereC.width = stage.clientWidth;
  sphereC.height = stage.clientHeight;
  flatC.width = stage.clientWidth;
  flatC.height = stage.clientHeight;
  state.sphereDirty = true;
  if (state.viewMode === "flat") {
    fitFlatStage();
    drawFlatStage();
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  document.getElementById("btnSphereView").classList.toggle("active", mode === "sphere");
  document.getElementById("btnFlatView").classList.toggle("active", mode === "flat");
  document.getElementById("sphereCanvas").classList.toggle("hidden", mode !== "sphere");
  document.getElementById("sphereLabelsContainer").classList.toggle("hidden", mode !== "sphere");
  document.getElementById("categoryLegendBar").classList.toggle("hidden", mode !== "sphere");
  document.getElementById("sphereHint").classList.toggle("hidden", mode !== "sphere");
  document.getElementById("flatCanvas").classList.toggle("hidden", mode !== "flat");
  updateHoverLensCard();

  if (mode === "flat") {
    fitFlatStage();
    drawFlatStage();
  }
}

function findSkyPointUnderCursor(clientX, clientY) {
  const canvas = document.getElementById("sphereCanvas");
  const rect = canvas.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;

  let closestObj = null;
  let bestDist = Infinity;
  const activeFilter = state.activeCategoryFilter;

  for (let i = 0; i < state.skyObjects.length; i++) {
    const obj = state.skyObjects[i];
    if (activeFilter !== "all" && obj.category !== activeFilter) continue;
    const p = obj.lastProj;
    if (!p) continue;
    const d = Math.hypot(mx - p.sx, my - p.sy);
    if (d < bestDist) {
      bestDist = d;
      closestObj = obj;
    }
  }

  return { closestObj, distPx: bestDist };
}

function bindEvents() {
  document.getElementById("btnSphereView").addEventListener("click", () => setViewMode("sphere"));
  document.getElementById("btnFlatView").addEventListener("click", () => setViewMode("flat"));

  document.querySelectorAll(".palette-btn").forEach((btn) => {
    btn.addEventListener("click", () => setPaletteMode(btn.dataset.palette));
  });

  document.querySelectorAll(".cat-pill").forEach((btn) => {
    btn.addEventListener("click", () => setCategoryFilter(btn.dataset.category));
  });

  const rightPanel = document.getElementById("rightInspectorPanel");
  document.querySelectorAll(".inspector-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".inspector-tab").forEach((t) => t.classList.remove("active"));
      tabBtn.classList.add("active");
      if (!rightPanel) return;
      rightPanel.classList.remove("tab-temporal", "tab-bands");
      if (tabBtn.dataset.tab === "temporal") rightPanel.classList.add("tab-temporal");
      if (tabBtn.dataset.tab === "bands") rightPanel.classList.add("tab-bands");
    });
  });

  document.getElementById("selectAllBandsBtn").addEventListener("click", () => {
    setPaletteMode("all18");
  });

  // Botón de reproducir/pausar GIF, controles de velocidad y clic en cualquiera de las 10 épocas temporales (T1..T10)
  const gifBtn = document.getElementById("toggleGifPlayBtn");
  if (gifBtn) {
    gifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.gifPlaying = !state.gifPlaying;
      gifBtn.classList.toggle("active", state.gifPlaying);
      gifBtn.textContent = state.gifPlaying ? "⏸ GIF Activo" : "▶ Reproducir GIF";
    });
  }

  const topSpeedSlider = document.getElementById("topGifSpeedSlider");
  if (topSpeedSlider) {
    topSpeedSlider.addEventListener("input", (e) => {
      setGifIntervalMs(Number(e.target.value));
    });
  }

  const lensSpeedSlider = document.getElementById("lensGifSpeedSlider");
  if (lensSpeedSlider) {
    lensSpeedSlider.addEventListener("input", (e) => {
      e.stopPropagation();
      setGifIntervalMs(Number(e.target.value));
    });
  }

  document.querySelectorAll(".speed-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      setGifIntervalMs(Number(chip.dataset.ms));
      state.gifPlaying = true;
      if (gifBtn) {
        gifBtn.classList.add("active");
        gifBtn.textContent = "⏸ GIF Activo";
      }
    });
  });

  document.querySelectorAll(".temporal-frame").forEach((frameEl) => {
    frameEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(frameEl.dataset.epoch);
      state.currentEpochIndex = idx;
      state.gifPlaying = false;
      if (gifBtn) {
        gifBtn.classList.remove("active");
        gifBtn.textContent = "▶ Reproducir GIF";
      }
      updateHoverLensCard();
      updateActiveSidePanels();
      if (state.viewMode === "flat") drawFlatStage();
    });
  });

  const applyManualEpoch = (idx) => {
    const activeB = state.loadedBundles[state.hoveredDatasetId || state.activeDatasetId];
    const nEpochs = Math.max(1, (activeB && activeB.epochCanvases && activeB.epochCanvases.length) || 1);
    state.currentEpochIndex = ((idx % nEpochs) + nEpochs) % nEpochs;
    state.gifPlaying = false;
    if (gifBtn) {
      gifBtn.classList.remove("active");
      gifBtn.textContent = "▶ Reproducir GIF";
    }
    updateHoverLensCard();
    updateActiveSidePanels();
    state.sphereDirty = true;
    if (state.viewMode === "flat") drawFlatStage();
  };

  const epochScrubber = document.getElementById("epochScrubberSlider");
  if (epochScrubber) {
    epochScrubber.addEventListener("input", (e) => {
      e.stopPropagation();
      applyManualEpoch(Number(e.target.value));
    });
  }
  const prevEpochBtn = document.getElementById("prevEpochBtn");
  if (prevEpochBtn) {
    prevEpochBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      applyManualEpoch(state.currentEpochIndex - 1);
    });
  }
  const nextEpochBtn = document.getElementById("nextEpochBtn");
  if (nextEpochBtn) {
    nextEpochBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      applyManualEpoch(state.currentEpochIndex + 1);
    });
  }

  const verifyBtn = document.getElementById("verifyRegionIrsaBtn");
  if (verifyBtn) {
    verifyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const dsId = state.hoveredDatasetId || state.activeDatasetId;
      const activeB = state.loadedBundles[dsId];
      if (!dsId || !activeB) return;
      const txtEl = document.getElementById("lensArchiveVerifyText");
      if (txtEl) txtEl.textContent = "Consultando IRSA DR1/QR3 en vivo...";
      try {
        const res = await fetch(`/api/spherex/region_stats?dataset_id=${encodeURIComponent(dsId)}&live=1`);
        const data = await res.json();
        if (data.ok && data.live_irsa) {
          activeB.liveIrsaStats = data.live_irsa;
          updateHoverLensCard();
        } else if (txtEl) {
          txtEl.textContent = `Error verificando IRSA: ${data.error || "desconocido"}`;
        }
      } catch (err) {
        if (txtEl) txtEl.textContent = `Error de red IRSA`;
      }
    });
  }

  // Clic interactivo sobre las gráficas temporales (Brillo y Factores Diferenciadores) para saltar a la época T1..T10
  ["brightnessChartCanvas", "factorsChartCanvas"].forEach((canvasId) => {
    const chCanvas = document.getElementById(canvasId);
    if (!chCanvas) return;
    chCanvas.addEventListener("click", (e) => {
      e.stopPropagation();
      const rect = chCanvas.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * chCanvas.width;
      const padL = 34;
      const padR = 12;
      const plotW = chCanvas.width - padL - padR;
      const frac = Math.max(0, Math.min(1, (relX - padL) / Math.max(1, plotW)));
      const idx = Math.round(frac * (NUM_TEMPORAL_EPOCHS - 1));
      state.currentEpochIndex = idx;
      state.gifPlaying = false;
      if (gifBtn) {
        gifBtn.classList.remove("active");
        gifBtn.textContent = "▶ Reproducir GIF";
      }
      updateHoverLensCard();
      updateActiveSidePanels();
      if (state.viewMode === "flat") drawFlatStage();
    });
  });

  document.getElementById("resetDomeBtn").addEventListener("click", () => {
    setViewMode("sphere");
    state.isPinned = false;
    const bundle = state.loadedBundles[state.activeDatasetId];
    if (bundle) {
      flyCameraTo(bundle.azRad, bundle.elRad, 86.0);
    } else {
      flyCameraTo(0, 0, 86.0);
    }
    updateHoverLensCard();
  });

  document.getElementById("datasetSelect").addEventListener("change", async (e) => {
    const id = e.target.value;
    await ensureBundleLoaded(id);
    state.isPinned = true;
    state.hoveredDatasetId = id;
    setActiveDataset(id, true);
  });

  document.getElementById("selectR").addEventListener("change", (e) => {
    state.selR = e.target.value;
    setPaletteMode("manual_rgb");
  });
  document.getElementById("selectG").addEventListener("change", (e) => {
    state.selG = e.target.value;
    setPaletteMode("manual_rgb");
  });
  document.getElementById("selectB").addEventListener("change", (e) => {
    state.selB = e.target.value;
    setPaletteMode("manual_rgb");
  });

  const sphereCanvas = document.getElementById("sphereCanvas");

  sphereCanvas.addEventListener("mousedown", (e) => {
    state.isDragging = true;
    state.dragMoved = false;
    state.isAnimatingCamera = false;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
  });

  sphereCanvas.addEventListener("mousemove", (e) => {
    if (state.isDragging || state.viewMode !== "sphere") return;
    const { closestObj, distPx } = findSkyPointUnderCursor(e.clientX, e.clientY);
    if (closestObj && distPx < 42) {
      if (state.hoveredDatasetId !== closestObj.id) {
        state.hoveredDatasetId = closestObj.id;
        clearTimeout(state.hoverFetchTimer);

        if (state.loadedBundles[closestObj.id]) {
          const hovBundle = state.loadedBundles[closestObj.id];
          drawTemporalFilmstripThumbs(hovBundle);
          if (!state.isPinned) {
            setActiveDataset(closestObj.id, false);
          } else {
            updateHoverLensCard();
          }
        } else if (closestObj.type !== "real_spherex_ondemand") {
          const targetObj = closestObj;
          state.hoverFetchTimer = setTimeout(async () => {
            if (state.hoveredDatasetId !== targetObj.id) return;
            const hovBundle = await ensureBundleLoaded(targetObj.id);
            if (!hovBundle || state.hoveredDatasetId !== targetObj.id) return;
            drawTemporalFilmstripThumbs(hovBundle);
            if (!state.isPinned) {
              setActiveDataset(targetObj.id, false);
            } else {
              updateHoverLensCard();
            }
          }, 55);
        } else {
          // Objeto aún no descargado: mostramos sus datos reales J2000 sin bloquear la red; se descarga al hacer clic
          const badgeEl = document.getElementById("imageCountBadge");
          if (badgeEl) {
            badgeEl.textContent = `📍 ${closestObj.name} (${closestObj.ra.toFixed(2)}°, ${closestObj.dec.toFixed(2)}°) · Haz clic para descargar FITS reales de API SPHEREx`;
          }
        }
      }
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!state.isDragging) return;
    const dx = e.clientX - state.lastMouseX;
    const dy = e.clientY - state.lastMouseY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.dragMoved = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;

    if (state.viewMode === "sphere") {
      const sens = degToRad(state.fov) / sphereCanvas.height;
      state.yaw -= dx * sens;
      state.pitch = Math.max(-Math.PI * 0.47, Math.min(Math.PI * 0.47, state.pitch + dy * sens));
      state.sphereDirty = true;
    } else {
      state.flatPanX += dx;
      state.flatPanY += dy;
      drawFlatStage();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (state.isDragging && !state.dragMoved && state.viewMode === "sphere" && e.target === sphereCanvas) {
      handleSphereClick(e.clientX, e.clientY);
    }
    state.isDragging = false;
    state.sphereDirty = true;
  });

  sphereCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    state.isAnimatingCamera = false;
    const factor = e.deltaY < 0 ? 0.88 : 1.14;
    state.fov = Math.max(12.0, Math.min(112.0, state.fov * factor));
    state.sphereDirty = true;
  });

  const flatCanvas = document.getElementById("flatCanvas");
  flatCanvas.addEventListener("mousedown", (e) => {
    state.isDragging = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
  });
  flatCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = flatCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nextZoom = Math.max(0.4, Math.min(25, state.flatZoom * factor));
    state.flatPanX = mx - ((mx - state.flatPanX) / state.flatZoom) * nextZoom;
    state.flatPanY = my - ((my - state.flatPanY) / state.flatZoom) * nextZoom;
    state.flatZoom = nextZoom;
    drawFlatStage();
  });

  window.addEventListener("resize", resizeCanvases);

  document.getElementById("exportPngBtn").addEventListener("click", () => {
    const bundle = state.loadedBundles[state.activeDatasetId];
    if (!bundle) return;
    const nEpochs = Math.max(1, (bundle.epochCanvases && bundle.epochCanvases.length) || 1);
    const epIdx = state.currentEpochIndex % nEpochs;
    const epCanvas =
      (bundle.epochCanvases && bundle.epochCanvases[epIdx]) ||
      bundle.compositeCanvas;
    const epMeta = (bundle.epochsMeta && bundle.epochsMeta[epIdx]) || EPOCH_META[0];
    const epCode = (epMeta.code || `T${epIdx + 1}`).replace(/\s+/g, "_");
    const a = document.createElement("a");
    a.download = `spherex_${state.activeDatasetId}_${epCode}.png`;
    a.href = epCanvas.toDataURL("image/png");
    a.click();
  });

  document.getElementById("fitsUploadInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const payloadFiles = [];
    for (const f of files) {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      payloadFiles.push({ filename: f.name, content_b64: btoa(bin) });
    }
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payloadFiles }),
    });
    const data = await res.json();
    if (data.ok) await loadDatasets(data.dataset_id);
  });

  const modal = document.getElementById("irsaModal");
  document.getElementById("openIrsaBtn").addEventListener("click", () => modal.classList.remove("hidden"));
  document.getElementById("closeIrsaModalBtn").addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("searchIrsaBtn").addEventListener("click", searchIrsa);
}

async function handleSphereClick(clientX, clientY) {
  const { closestObj, distPx } = findSkyPointUnderCursor(clientX, clientY);
  if (!closestObj || distPx > 48) {
    if (state.isPinned) {
      state.isPinned = false;
      updateActiveSidePanels();
      updateHoverLensCard();
    }
    return;
  }

  if (!state.loadedBundles[closestObj.id] && closestObj.type === "real_spherex_ondemand") {
    const badgeEl = document.getElementById("imageCountBadge");
    if (badgeEl) badgeEl.textContent = `🛰️ Descargando FITS reales desde API NASA/IPAC IRSA para ${closestObj.name}...`;
  }
  await ensureBundleLoaded(closestObj.id);
  if (state.isPinned && state.activeDatasetId === closestObj.id) {
    state.isPinned = false;
    updateActiveSidePanels();
    updateHoverLensCard();
  } else {
    state.isPinned = true;
    state.hoveredDatasetId = closestObj.id;
    setActiveDataset(closestObj.id, false);
  }
}

window.__kronoxSphereFocusTarget = async (ra, dec, targetName) => {
  window.__kronoxPendingSphereTarget = { ra, dec, targetName };
  if (!state.skyObjects.length || !Number.isFinite(ra) || !Number.isFinite(dec)) return;
  let best = null;
  let bestDist = Infinity;
  for (const obj of state.skyObjects) {
    if (obj.type === "real_spherex_ondemand") continue;
    const dRa = Math.abs(((obj.ra - ra + 540) % 360) - 180);
    const dDec = Math.abs(obj.dec - dec);
    const dist = Math.hypot(dRa * Math.cos((dec * Math.PI) / 180), dDec);
    if (dist < bestDist && dist <= 1.0) {
      best = obj;
      bestDist = dist;
    }
  }
  if (best) {
    await ensureBundleLoaded(best.id);
    setActiveDataset(best.id, true);
  }
};

async function searchIrsa() {
  const q = document.getElementById("irsaTargetInput").value.trim();
  const status = document.getElementById("irsaStatusBox");
  const list = document.getElementById("irsaResultsList");
  if (!q) return;

  status.textContent = `Resolviendo "${q}" y consultando NASA/IPAC IRSA...`;
  list.innerHTML = "";

  const resResolve = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
  const resolved = await resResolve.json();
  if (!resolved.ok) {
    status.textContent = `No se pudo resolver "${q}": ${resolved.error}`;
    return;
  }

  const resSearch = await fetch(
    `/api/irsa/search?ra=${resolved.ra}&dec=${resolved.dec}&radius=0.15&collection=auto`
  );
  const data = await resSearch.json();
  if (!data.ok || (data.error && data.count === 0)) {
    status.textContent = `No se encontraron registros SIA directos (${data.error || "sin resultados"}).`;
    return;
  }

  status.textContent = `${data.count} exposiciones reales en IRSA para ${resolved.name} (${resolved.ra.toFixed(3)}°, ${resolved.dec.toFixed(3)}°).`;

  // Botón para descargar automáticamente todas las épocas y detectores D1-D6 vía API SPHEREx
  const fullBtnWrap = document.createElement("div");
  fullBtnWrap.className = "irsa-item";
  fullBtnWrap.style.borderColor = "#00e5c3";
  fullBtnWrap.innerHTML = `
    <div>
      <strong>🛰️ Descarga Multi-Época Completa (D1–D6 + WCS-WAVE)</strong>
      <div style="color:#00e5c3">Reproyecta todas las épocas reales de ${resolved.name} desde la API IRSA</div>
    </div>
    <button class="btn btn-primary">Importar Objeto Real</button>
  `;
  fullBtnWrap.querySelector("button").addEventListener("click", async () => {
    status.textContent = `Consultando API SPHEREx y descargando recortes FITS reales D1–D6 para ${resolved.name}...`;
    const r = await fetch("/api/spherex/fetch_target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, category: "galaxy", size_deg: 0.25, per_det: 2 }),
    });
    const d = await r.json();
    if (d.ok) {
      document.getElementById("irsaModal").classList.add("hidden");
      await loadDatasets(d.dataset_id);
    } else {
      status.textContent = `Error: ${d.error}`;
    }
  });
  list.appendChild(fullBtnWrap);
  for (const rec of data.records) {
    const item = document.createElement("div");
    item.className = "irsa-item";
    item.innerHTML = `
      <div>
        <strong>${rec.obs_id}</strong>
        <div style="color:#6e6e6e">${rec.band_name} · ${rec.collection}</div>
      </div>
      <button class="btn btn-light">Cargar</button>
    `;
    item.querySelector("button").addEventListener("click", async () => {
      status.textContent = `Descargando recorte FITS de ${rec.obs_id}...`;
      const r = await fetch("/api/irsa/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_url: rec.access_url,
          obs_id: rec.obs_id,
          ra: resolved.ra,
          dec: resolved.dec,
          cutout_size_deg: 0.15,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        document.getElementById("irsaModal").classList.add("hidden");
        await loadDatasets(d.dataset_id);
      } else {
        status.textContent = `Error: ${d.error}`;
      }
    });
    list.appendChild(item);
  }
}
