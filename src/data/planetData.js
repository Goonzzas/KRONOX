import * as THREE from 'three';

export const P = [
  { n: 'Sol', km: 696340, sun: 1, rot: 609, t: 'sun' },
  {
    n: 'Mercurio',
    km: 2440,
    au: 0.387,
    per: 87.969,
    rot: 1407.5,
    tilt: 0.03,
    e: 0.2056,
    i: 7,
    L: 252.25,
    w: 77.46,
    O: 48.33,
    t: 'rock',
    c: [150, 140, 130],
  },
  {
    n: 'Venus',
    km: 6052,
    au: 0.723,
    per: 224.701,
    rot: 5832.5,
    tilt: 177.4,
    e: 0.0068,
    i: 3.39,
    L: 181.98,
    w: 131.53,
    O: 76.68,
    t: 'venus',
    c: [225, 195, 135],
  },
  {
    n: 'Tierra',
    km: 6371,
    au: 1,
    per: 365.256,
    rot: 23.934,
    tilt: 23.44,
    e: 0.0167,
    i: 0,
    L: 100.46,
    w: 102.94,
    O: 0,
    t: 'earth',
  },
  {
    n: 'Luna',
    km: 1737,
    moon: 1,
    per: 27.32,
    rot: 655.7,
    tilt: 1.5,
    t: 'rock',
    c: [175, 175, 175],
  },
  {
    n: 'Marte',
    km: 3390,
    au: 1.524,
    per: 686.98,
    rot: 24.623,
    tilt: 25.2,
    e: 0.0934,
    i: 1.85,
    L: 355.45,
    w: 336.04,
    O: 49.56,
    t: 'rock',
    c: [190, 100, 60],
  },
  {
    n: 'Júpiter',
    km: 69911,
    au: 5.203,
    per: 4332.59,
    rot: 9.925,
    tilt: 3.1,
    e: 0.0484,
    i: 1.3,
    L: 34.4,
    w: 14.75,
    O: 100.46,
    t: 'bands',
    c: [
      [215, 180, 140],
      [165, 115, 80],
      [235, 215, 190],
      [190, 140, 100],
    ],
  },
  {
    n: 'Saturno',
    km: 58232,
    au: 9.537,
    per: 10759.22,
    rot: 10.56,
    tilt: 26.7,
    e: 0.0539,
    i: 2.49,
    L: 49.94,
    w: 92.43,
    O: 113.67,
    t: 'bands',
    ring: 1,
    c: [
      [230, 210, 160],
      [205, 180, 130],
      [240, 225, 185],
      [190, 165, 120],
    ],
  },
  {
    n: 'Urano',
    km: 25362,
    au: 19.19,
    per: 30688.5,
    rot: 17.24,
    tilt: 97.8,
    e: 0.0473,
    i: 0.77,
    L: 313.23,
    w: 170.96,
    O: 74.02,
    t: 'bands',
    c: [
      [150, 215, 225],
      [140, 205, 220],
      [160, 222, 230],
      [145, 210, 222],
    ],
  },
  {
    n: 'Neptuno',
    km: 24622,
    au: 30.07,
    per: 60182,
    rot: 16.11,
    tilt: 28.3,
    e: 0.0086,
    i: 1.77,
    L: 304.88,
    w: 44.97,
    O: 131.78,
    t: 'bands',
    c: [
      [50, 85, 200],
      [60, 100, 215],
      [45, 75, 180],
      [70, 110, 220],
    ],
  },
];
export const D2R = Math.PI / 180,
  TAU = Math.PI * 2,
  T0 = () => (Date.now() - Date.UTC(2000, 0, 1, 12)) / 864e5;
export function kep(p, E) {
  const a = p.au,
    x = a * (Math.cos(E) - p.e),
    y = a * Math.sqrt(1 - p.e * p.e) * Math.sin(E),
    w = (p.w - p.O) * D2R,
    i = p.i * D2R,
    O = p.O * D2R,
    x1 = x * Math.cos(w) - y * Math.sin(w),
    y1 = x * Math.sin(w) + y * Math.cos(w);
  return new THREE.Vector3(
    x1 * Math.cos(O) - y1 * Math.cos(i) * Math.sin(O),
    y1 * Math.sin(i),
    -(x1 * Math.sin(O) + y1 * Math.cos(i) * Math.cos(O)),
  );
}
export function pos(p, d) {
  const M = ((p.L - p.w) * D2R + (d / p.per) * TAU) % TAU;
  let E = M;
  for (let k = 0; k < 7; k++) E -= (E - p.e * Math.sin(E) - M) / (1 - p.e * Math.cos(E));
  return kep(p, E);
}

export const INFO = {
  Mercurio: {
    intro: 'El planeta más pequeño y cercano al Sol: un mundo rocoso de extremos térmicos.',
    superficie:
      'Terreno antiguo, muy craterizado, con grandes cuencas y escarpes formados al contraerse el planeta.',
    composicion: 'Gran núcleo metálico bajo un manto y una corteza de silicatos.',
    atmosfera:
      'Exosfera extremadamente tenue de oxígeno, sodio, hidrógeno, helio y potasio; casi no retiene calor.',
    temperatura:
      'Promedio aproximado: 167 °C. Puede alcanzar 430 °C de día y bajar a −180 °C de noche.',
    clima:
      'Sin clima como el terrestre; la superficie alterna entre calor intenso y frío extremo. Hay hielo en cráteres polares permanentemente sombreados.',
    dato: 'Un día solar mercuriano dura 176 días terrestres.',
    img: 'https://images-assets.nasa.gov/image/PIA11406/PIA11406~orig.jpg',
    source: 'https://science.nasa.gov/mercury/facts/',
  },
  Venus: {
    intro:
      'Un planeta rocoso envuelto en nubes; su intenso efecto invernadero lo convierte en el más caliente.',
    superficie:
      'Llanuras volcánicas, montañas y estructuras volcánicas; la superficie está oculta bajo nubes espesas.',
    composicion: 'Núcleo, manto y corteza rocosos.',
    atmosfera:
      'Principalmente dióxido de carbono, con nubes de ácido sulfúrico; la presión en superficie ronda 93 veces la terrestre.',
    temperatura: 'Promedio aproximado: 464 °C; el calor queda atrapado por el efecto invernadero.',
    clima: 'Atmósfera densa, seca y abrasadora. Nubes y vientos rápidos dominan las capas altas.',
    dato: 'Rota lentamente en sentido retrógrado: el Sol saldría por el oeste.',
    img: 'https://images-assets.nasa.gov/image/PIA23791/PIA23791~orig.jpg',
    source: 'https://science.nasa.gov/venus/venus-facts/',
  },
  Tierra: {
    intro:
      'Un planeta oceánico y rocoso, con agua líquida estable en la superficie y vida conocida.',
    superficie:
      'Océanos cubren cerca del 71 %; continentes y fondos marinos cambian por la tectónica de placas.',
    composicion: 'Corteza y manto de silicatos sobre un núcleo rico en hierro y níquel.',
    atmosfera: 'Aproximadamente 78 % nitrógeno y 21 % oxígeno, más vapor de agua y gases traza.',
    temperatura: 'Temperatura media superficial aproximada: 15 °C.',
    clima: 'El agua y la atmósfera redistribuyen calor; hay climas y estaciones muy diversos.',
    dato: 'Es el único mundo donde se ha confirmado vida.',
    img: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/p/i/a/1/PIA18033.jpg?crop=faces%2Cfocalpoint&fit=crop&h=900&w=1400',
    source: 'https://science.nasa.gov/earth/facts/',
  },
  Marte: {
    intro:
      'Un desierto frío y polvoriento con antiguos cauces, volcanes gigantes y reservas de hielo.',
    superficie:
      'Rocosa, con cráteres, cañones y volcanes; evidencia geológica de ríos y lagos antiguos.',
    composicion:
      'Planeta rocoso con núcleo metálico y corteza rica en minerales de hierro, que le dan su color rojizo.',
    atmosfera: 'Muy tenue, compuesta sobre todo de dióxido de carbono, con nitrógeno y argón.',
    temperatura: 'Promedio aproximado: −65 °C; varía desde unos −153 °C hasta 20 °C.',
    clima:
      'Tormentas de polvo pueden abarcar grandes regiones; agua congelada permanece en polos y bajo el suelo.',
    dato: 'Olympus Mons es el volcán más alto conocido del sistema solar.',
    img: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/p/i/a/0/PIA04304.jpg?crop=faces%2Cfocalpoint&fit=crop&h=900&w=1400',
    source: 'https://science.nasa.gov/mars/facts/',
  },
  Júpiter: {
    intro:
      'El gigante gaseoso más grande: una enorme atmósfera turbulenta sin una superficie sólida definida.',
    superficie:
      'No tiene superficie sólida accesible; al profundizar, el gas se vuelve cada vez más denso y caliente.',
    composicion:
      'Principalmente hidrógeno y helio; en el interior, el hidrógeno pasa a estados de alta presión.',
    atmosfera:
      'Bandas de nubes y tormentas. La Gran Mancha Roja es una tormenta longeva; se han medido vientos de hasta unos 539 km/h.',
    temperatura:
      'Aproximadamente −110 °C en la capa atmosférica de referencia (nivel de 1 bar), no es una temperatura de superficie.',
    clima: 'Cambios rápidos de nubes, chorros y tormentas gigantes en bandas.',
    dato: 'Su campo magnético y sistema de lunas son extraordinariamente extensos.',
    img: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/p/i/a/PIA22421-1.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1080&w=1920',
    source: 'https://science.nasa.gov/jupiter/jupiter-facts/',
  },
  Saturno: {
    intro:
      'Gigante gaseoso famoso por sus anillos, formados sobre todo por fragmentos de hielo y roca.',
    superficie:
      'No posee una superficie sólida definida; las capas atmosféricas se vuelven más densas hacia el interior.',
    composicion: 'Principalmente hidrógeno y helio.',
    atmosfera:
      'Nubes en bandas, vientos intensos y tormentas; en el polo norte destaca una corriente con forma hexagonal.',
    temperatura:
      'Aproximadamente −140 °C en la capa atmosférica de referencia (nivel de 1 bar), no es una temperatura de superficie.',
    clima: 'Atmósfera fría y dinámica; las estaciones duran años por su larga órbita.',
    dato: 'Sus anillos principales son muy anchos y, comparados con su extensión, extraordinariamente delgados.',
    img: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/p/i/a/0/PIA08838-1.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1014&w=1762',
    source: 'https://science.nasa.gov/saturn/facts/',
  },
  Urano: {
    intro: 'Un gigante helado azul verdoso que gira casi acostado respecto al plano de su órbita.',
    superficie:
      'No tiene superficie sólida definida; bajo las nubes hay fluidos densos y calientes de agua, metano y amoníaco.',
    composicion:
      'Atmósfera de hidrógeno, helio y metano; el metano absorbe luz roja y contribuye al tono azul verdoso.',
    atmosfera: 'Mínimo aproximado: −224 °C. Vientos de hasta unos 900 km/h.',
    temperatura:
      'Aproximadamente −195 °C en la capa atmosférica de referencia (nivel de 1 bar); la atmósfera superior puede ser aún más fría.',
    clima:
      'Estaciones extremas por su inclinación axial de 97,77°; cada polo pasa décadas orientado hacia el Sol.',
    dato: 'Es clasificado como gigante helado, distinto de los gigantes gaseosos Júpiter y Saturno.',
    img: 'https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg',
    source: 'https://science.nasa.gov/uranus/facts/',
  },
  Neptuno: {
    intro:
      'Un gigante helado lejano, oscuro y ventoso, con nubes azuladas y sistemas de tormentas.',
    superficie:
      'No hay superficie sólida definida; gran parte del interior es un fluido caliente y denso de agua, metano y amoníaco.',
    composicion:
      'Atmósfera de hidrógeno y helio con metano; su interior contiene hielos a alta presión.',
    atmosfera:
      'Vientos que superan los 2.000 km/h, entre los más rápidos medidos en el sistema solar.',
    temperatura:
      'Aproximadamente −200 °C en la capa atmosférica de referencia (nivel de 1 bar), no es una temperatura de superficie.',
    clima:
      'Muy frío, con vientos veloces, nubes brillantes y tormentas que aparecen y evolucionan.',
    dato: 'La luz solar tarda más de cuatro horas en llegar desde el Sol.',
    img: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/p/i/a/0/PIA01492-1.jpg?crop=faces%2Cfocalpoint&fit=crop&h=900&w=1400',
    source: 'https://science.nasa.gov/neptune/neptune-facts/',
  },
};
