/**
 * Curated nearby-galaxy markers for the schematic neighborhood map.
 * Celestial positions use the NED preferred J2000/ICRS coordinates where available.
 * Distances are approximate, independent of the compressed display coordinates.
 */
export const NEARBY_GALAXIES = [
  {
    key: 'milky-way',
    kind: 'galaxy',
    name: { es: 'Vía Láctea', en: 'Milky Way' },
    catalog: 'Galaxy / Vía Láctea',
    type: { es: 'Galaxia espiral barrada', en: 'Barred spiral galaxy' },
    constellation: { es: 'Sagitario (centro galáctico)', en: 'Sagittarius (galactic center)' },
    distanceMly: 0,
    description: {
      es: 'Nuestra galaxia sirve como origen del mapa. La escena muestra un marcador esquemático, no una reconstrucción de su estructura interna.',
      en: 'Our galaxy is the map origin. The scene shows a schematic marker, not a reconstruction of its internal structure.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · catálogo',
        url: 'https://ned.ipac.caltech.edu/byname?objname=Milky+Way',
      },
    ],
  },
  {
    key: 'sagittarius-dwarf',
    kind: 'galaxy',
    name: { es: 'Enana de Sagitario', en: 'Sagittarius Dwarf' },
    catalog: 'Sagittarius dSph · Sag DEG',
    type: { es: 'Enana esferoidal', en: 'Dwarf spheroidal' },
    constellation: { es: 'Sagitario', en: 'Sagittarius' },
    raDeg: 283.83,
    decDeg: -30.55,
    distanceMly: 0.085,
    distanceText: { es: '≈ 85.000 años luz', en: '≈ 85,000 light-years' },
    description: {
      es: 'Galaxia enana satélite en proceso de interacción con la Vía Láctea. Su posición y distancia en el mapa son aproximadas.',
      en: 'A dwarf satellite galaxy interacting with the Milky Way. Its position and map distance are approximate.',
    },
    sources: [
      {
        label: 'NED · identificación',
        url: 'https://ned.ipac.caltech.edu/byname?objname=Sgr+dSph',
      },
      {
        label: 'MNRAS · centro y distancia adoptada',
        url: 'https://academic.oup.com/mnras/article/541/2/1016/8191267',
      },
    ],
  },
  {
    key: 'lmc',
    kind: 'galaxy',
    name: { es: 'Gran Nube de Magallanes', en: 'Large Magellanic Cloud' },
    catalog: 'LMC · PGC 17223',
    type: { es: 'Enana irregular', en: 'Irregular dwarf galaxy' },
    constellation: { es: 'Dorado y Mensa', en: 'Dorado and Mensa' },
    raDeg: 80.89416667,
    decDeg: -69.75611111,
    distanceMly: 0.16,
    distanceText: { es: '≈ 160.000 años luz', en: '≈ 160,000 light-years' },
    description: {
      es: 'Una de las galaxias satélite más cercanas y activas en formación estelar del Grupo Local.',
      en: 'One of the nearest satellite galaxies and an active site of star formation in the Local Group.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=LARGE+MAGELLANIC+CLOUD',
      },
      {
        label: 'NASA · distancia aproximada',
        url: 'https://science.nasa.gov/universe/galaxies/large-magellanic-cloud/',
      },
    ],
  },
  {
    key: 'smc',
    kind: 'galaxy',
    name: { es: 'Pequeña Nube de Magallanes', en: 'Small Magellanic Cloud' },
    catalog: 'SMC · NGC 292',
    type: { es: 'Enana irregular', en: 'Irregular dwarf galaxy' },
    constellation: { es: 'Tucana', en: 'Tucana' },
    raDeg: 13.18666667,
    decDeg: -72.82861111,
    distanceMly: 0.21,
    distanceText: { es: '≈ 210.000 años luz', en: '≈ 210,000 light-years' },
    description: {
      es: 'Galaxia satélite de la Vía Láctea y miembro del Grupo Local.',
      en: 'A satellite galaxy of the Milky Way and a member of the Local Group.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=SMC',
      },
      {
        label: 'NASA/Hubble · distancia y región',
        url: 'https://science.nasa.gov/missions/hubble/galactic-building-blocks/',
      },
    ],
  },
  {
    key: 'm31',
    kind: 'galaxy',
    name: { es: 'Andrómeda', en: 'Andromeda' },
    catalog: 'M31 · NGC 224',
    type: { es: 'Galaxia espiral', en: 'Spiral galaxy' },
    constellation: { es: 'Andrómeda', en: 'Andromeda' },
    raDeg: 10.68479292,
    decDeg: 41.269065,
    distanceMly: 2.5,
    distanceText: { es: '≈ 2,5 millones de años luz', en: '≈ 2.5 million light-years' },
    description: {
      es: 'La galaxia espiral grande más cercana a la Vía Láctea y uno de los miembros dominantes del Grupo Local.',
      en: 'The nearest large spiral galaxy to the Milky Way and one of the dominant members of the Local Group.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=M31',
      },
      {
        label: 'NASA/Hubble · distancia y descripción',
        url: 'https://science.nasa.gov/missions/hubble/nasas-hubble-traces-hidden-history-of-andromeda-galaxy/',
      },
    ],
  },
  {
    key: 'm33',
    kind: 'galaxy',
    name: { es: 'Galaxia del Triángulo', en: 'Triangulum Galaxy' },
    catalog: 'M33 · NGC 598',
    type: { es: 'Galaxia espiral', en: 'Spiral galaxy' },
    constellation: { es: 'Triángulo', en: 'Triangulum' },
    raDeg: 23.46204167,
    decDeg: 30.66022222,
    distanceMly: 3,
    distanceText: { es: '≈ 3 millones de años luz', en: '≈ 3 million light-years' },
    description: {
      es: 'Una de las galaxias espirales principales del Grupo Local, en la constelación del Triángulo.',
      en: 'One of the principal spiral galaxies in the Local Group, in the constellation Triangulum.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=M33',
      },
      {
        label: 'NASA/Hubble · distancia y tipo',
        url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/',
      },
    ],
  },
  {
    key: 'ngc-6822',
    kind: 'galaxy',
    name: { es: 'Galaxia de Barnard', en: "Barnard's Galaxy" },
    catalog: 'NGC 6822 · Caldwell 57',
    type: { es: 'Enana irregular', en: 'Irregular dwarf galaxy' },
    constellation: { es: 'Sagitario', en: 'Sagittarius' },
    raDeg: 296.2404167,
    decDeg: -14.80333333,
    distanceMly: 2,
    distanceText: { es: '≈ 2 millones de años luz', en: '≈ 2 million light-years' },
    description: {
      es: 'Galaxia enana irregular del Grupo Local, distinta de la estrella Barnard.',
      en: 'An irregular dwarf galaxy in the Local Group, distinct from Barnard’s Star.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=NGC+6822',
      },
      {
        label: 'NASA/Hubble · distancia y tipo',
        url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-57/',
      },
    ],
  },
  {
    key: 'ngc-253',
    kind: 'galaxy',
    name: { es: 'Galaxia del Escultor', en: 'Sculptor Galaxy' },
    catalog: 'NGC 253 · Caldwell 65',
    type: { es: 'Espiral con intensa formación estelar', en: 'Starburst spiral galaxy' },
    constellation: { es: 'Escultor', en: 'Sculptor' },
    raDeg: 11.88804167,
    decDeg: -25.28808333,
    distanceMly: 13,
    distanceText: { es: '≈ 13 millones de años luz', en: '≈ 13 million light-years' },
    description: {
      es: 'Galaxia dominante del grupo de Escultor; su distancia y la del grupo se presentan de forma aproximada.',
      en: 'The dominant galaxy in the Sculptor Group; the displayed galaxy and group distances are approximate.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=NGC+253',
      },
      {
        label: 'NASA/Hubble · distancia y grupo',
        url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-65/',
      },
    ],
  },
  {
    key: 'm81',
    kind: 'galaxy',
    name: { es: 'Galaxia de Bode', en: "Bode's Galaxy" },
    catalog: 'M81 · NGC 3031',
    type: { es: 'Galaxia espiral', en: 'Spiral galaxy' },
    constellation: { es: 'Osa Mayor', en: 'Ursa Major' },
    raDeg: 148.888221,
    decDeg: 69.06529461,
    distanceMly: 11.6,
    distanceText: { es: '≈ 11,6 millones de años luz', en: '≈ 11.6 million light-years' },
    description: {
      es: 'Una de las galaxias brillantes del grupo de M81 y vecina de M82.',
      en: 'One of the bright galaxies in the M81 Group and a neighbor of M82.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=M81',
      },
      {
        label: 'NASA/Hubble · distancia y tipo',
        url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-81/',
      },
    ],
  },
  {
    key: 'm82',
    kind: 'galaxy',
    name: { es: 'Galaxia del Cigarro', en: 'Cigar Galaxy' },
    catalog: 'M82 · NGC 3034',
    type: {
      es: 'Galaxia irregular con estallido de formación estelar',
      en: 'Irregular starburst galaxy',
    },
    constellation: { es: 'Osa Mayor', en: 'Ursa Major' },
    raDeg: 148.9705,
    decDeg: 69.67948333,
    distanceMly: 12,
    distanceText: { es: '≈ 12 millones de años luz', en: '≈ 12 million light-years' },
    description: {
      es: 'Galaxia vecina de M81, cuya interacción contribuye a su intensa actividad de formación estelar.',
      en: 'A neighbor of M81; interactions with nearby galaxies contribute to its intense star formation.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · coordenadas',
        url: 'https://ned.ipac.caltech.edu/byname?objname=M82',
      },
      {
        label: 'NASA/Hubble · distancia y descripción',
        url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-82/',
      },
    ],
  },
  {
    key: 'local-group',
    kind: 'group',
    name: { es: 'Grupo Local', en: 'Local Group' },
    catalog: 'Local Group',
    type: { es: 'Grupo de galaxias', en: 'Galaxy group' },
    constellation: { es: 'Región de Andrómeda y la Vía Láctea', en: 'Milky Way–Andromeda region' },
    anchorKey: 'milky-way',
    distanceSummary: {
      es: 'Incluye la Vía Láctea; sus miembros destacados se encuentran desde cientos de miles hasta unos 3 millones de años luz.',
      en: 'Includes the Milky Way; its notable members range from hundreds of thousands to about 3 million light-years away.',
    },
    description: {
      es: 'Grupo al que pertenecen la Vía Láctea, Andrómeda, M33 y las Nubes de Magallanes. El contorno dibujado es orientativo.',
      en: 'The group containing the Milky Way, Andromeda, M33, and the Magellanic Clouds. Its drawn boundary is illustrative.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · galaxias del Grupo Local',
        url: 'https://ned.ipac.caltech.edu/level5/Dev2/Dev4.html',
      },
      {
        label: 'NASA/Hubble · Nube Mayor',
        url: 'https://science.nasa.gov/universe/galaxies/large-magellanic-cloud/',
      },
    ],
  },
  {
    key: 'sculptor-group',
    kind: 'group',
    name: { es: 'Grupo de Escultor', en: 'Sculptor Group' },
    catalog: 'Sculptor Group · Sculptor filament',
    type: { es: 'Grupo de galaxias', en: 'Galaxy group' },
    constellation: { es: 'Escultor', en: 'Sculptor' },
    raDeg: 11.88804167,
    decDeg: -25.28808333,
    distanceMly: 13,
    distanceText: { es: '≈ 13 millones de años luz', en: '≈ 13 million light-years' },
    representative: 'ngc-253',
    description: {
      es: 'Grupo vecino representado mediante NGC 253, su miembro dominante. El marcador no define un centro ni una frontera exactos.',
      en: 'A neighboring group represented by NGC 253, its dominant member. The marker does not define an exact center or boundary.',
    },
    sources: [
      {
        label: 'NASA/Hubble · NGC 253 y grupo',
        url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-65/',
      },
      {
        label: 'NASA/IPAC NED · galaxias cercanas',
        url: 'https://ned.ipac.caltech.edu/level5/Dev2/Dev4.html',
      },
    ],
  },
  {
    key: 'm81-group',
    kind: 'group',
    name: { es: 'Grupo de M81', en: 'M81 Group' },
    catalog: 'M81 Group · NGC 3031 Group',
    type: { es: 'Grupo de galaxias', en: 'Galaxy group' },
    constellation: { es: 'Osa Mayor', en: 'Ursa Major' },
    raDeg: 148.929,
    decDeg: 69.37,
    distanceMly: 11.8,
    distanceText: { es: '≈ 11,8 millones de años luz', en: '≈ 11.8 million light-years' },
    representative: 'm81',
    description: {
      es: 'Grupo cercano cuyo núcleo brillante incluye M81 y M82. Su marcador es el centro aproximado de ambas, no un centro de masa medido.',
      en: 'A nearby group whose bright core includes M81 and M82. Its marker is an approximate midpoint, not a measured center of mass.',
    },
    sources: [
      {
        label: 'NASA/IPAC NED · identificación del grupo',
        url: 'https://ned.ipac.caltech.edu/byname?objname=M81+Group',
      },
      {
        label: 'MNRAS · distancia al grupo',
        url: 'https://academic.oup.com/mnras/article/467/1/273/2804510',
      },
    ],
  },
];

export const nearbyGalaxyByKey = (key) => NEARBY_GALAXIES.find((object) => object.key === key);
