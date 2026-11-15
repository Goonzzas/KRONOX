/** Provider contract for existing voice and server-side Fish Audio / Gemini TTS adapters. No keys in client. */
export const FISH_AUDIO_VOICE_ID = '8150d8bf74d245cd84a154b785aa7fab';

export const GEMINI_TTS_VOICES = Object.freeze([
  { id: 'Charon', label: 'Charon · Voz Oficial KRONOX IA' },
]);

export const PREDEFINED_VOICE_CLIPS = Object.freeze({
  'Durante siglos, contemplamos el universo desde un pequeño mundo azul, buscando respuestas sobre nuestro origen entre millones de estrellas.':
    '/audio/voice/intro_01_opening.wav',
  'Misiones reales como el telescopio espacial NASA SPHEREx abrieron una nueva ventana infrarroja al cosmos, revelando luces ocultas al ojo humano.':
    '/audio/voice/intro_02_spherex.wav',
  'En cada longitud de onda infrarroja detectamos hielos primordiales, viveros de estrellas y enigmas gravitacionales más allá de los gigantes gaseosos.':
    '/audio/voice/intro_03_conocimiento.wav',
  'Para descifrar esa historia escrita entre anillos planetarios y brazos galácticos, la humanidad puso en marcha el Proyecto Horizonte.':
    '/audio/voice/intro_04_galaxia.wav',
  'El Proyecto Horizonte construyó KRONOX Aurora-120: un crucero científico modular de ciento veinte metros diseñado para explorar desde la órbita hasta el espacio profundo.':
    '/audio/voice/intro_05_nave.wav',
  'En el puente de mando coordinamos la astrometría J2000, el rumbo interestelar y los sistemas de observación de toda la expedición.':
    '/audio/voice/intro_06_puente.wav',
  'La cubierta científica combina espectroscopía inspirada en NASA SPHEREx y bancos ópticos de calibración para investigar cada archivo real sin conjeturas.':
    '/audio/voice/intro_07_spherex.wav',
  'El módulo de habitabilidad mantiene a la tripulación en microgravedad durante largas travesías con soporte vital de ciclo cerrado y gravedad anular asistida.':
    '/audio/voice/intro_08_habitabilidad.wav',
  'En ingeniería, el reactor toroidal de fusión y sus propulsores magnetoplasmadinámicos suministran la energía limpia que impulsa a KRONOX entre mundos.':
    '/audio/voice/intro_09_ingenieria.wav',
  'Soy KRONOX IA, tu inteligencia de a bordo. El puente es tuyo, comandante: calibra tus instrumentos y comienza tu primera investigación espacial.':
    '/audio/voice/intro_10_inicio.wav',
  'Bienvenido al puente de mando de KRONOX-1, Comandante. Todos los sistemas orbitales están en línea. Pulsa WASD o la tecla E para levantarte del sillón de mando.':
    '/audio/voice/tut_stand_up.wav',
  'Mueve el ratón para orientar tu mirada y desplázate con WASD. Pulsa la tecla V o los botones superiores para alternar entre primera y tercera persona, o ESC para liberar el cursor.':
    '/audio/voice/tut_look_camera.wav',
  'Dirígete a la consola de control y navegación iluminada en el Puente de Mando y pulsa E para inspeccionar los sistemas de vuelo.':
    '/audio/voice/tut_nav.wav',
  'Desde el puente puedes activar el Telescopio Óptico con la tecla T, inspeccionar el casco en vista Exterior o elegir un planeta o estrella para viajar hacia él.':
    '/audio/voice/tut_astro_obs.wav',
  'Excelente. Ahora entra al Ascensor Central en el eje del puente y pulsa el botón C02 o la tecla 2 para descender a la Cubierta Habitacional e inspeccionar los camarotes y el comedor.':
    '/audio/voice/tut_elevator_c02.wav',
  'Módulo habitacional verificado. Usa el Ascensor Central y pulsa la tecla 3 para bajar a la Cubierta Científica e Ingeniería, donde operan el reactor Tokamak y el Laboratorio SPHEREx.':
    '/audio/voice/tut_elevator_c03.wav',
  'Has llegado a la Cubierta Científica. Sigue la baliza luminosa hacia babor hasta el Laboratorio Espectral SPHEREx y pulsa E para iniciar el análisis.':
    '/audio/voice/tut_science.wav',
  'Análisis científico registrado. En el nivel inferior cuentas además con la Bodega y el Hangar. Pulsa la tecla J para abrir tu Bitácora y Manual Operativo y completar el entrenamiento.':
    '/audio/voice/tut_manual_journal.wav',
  'Análisis científico registrado. Abre «Mapa · Guía» en la barra superior para revisar el Manual operativo y completar el tutorial.':
    '/audio/voice/tut_manual_journal.wav',
  'Entrenamiento operativo completado. Tienes acceso libre a las cuatro cubiertas, a la Bitácora Personal y a la navegación interestelar.':
    '/audio/voice/tut_completed.wav',
  'Entrenamiento operativo completado. Tienes acceso libre a las cuatro cubiertas, al Mapa Galáctico y a la navegación interestelar.':
    '/audio/voice/tut_completed.wav',
  'Cubierta 01 — Puente de Mando. Desde este recinto en punta de flecha gobiernas los ventanales panorámicos, el chevrón de navegación y la mesa holográfica.':
    '/audio/voice/deck_ctx_01.wav',
  'Cubierta 02 — Habitacional y Esclusa EVA. Ocho camarotes radiales, comedor circular alrededor del núcleo central y esclusa de proa.':
    '/audio/voice/deck_ctx_02.wav',
  'Cubierta 03 — Ingeniería y Laboratorio SPHEREx. Aquí operan el reactor principal, tanques criogénicos, estación SPHEREx y el banco óptico de calibración.':
    '/audio/voice/deck_ctx_03.wav',
  'Cubierta 04 — Bodega y Hangar. Contenedores modulares presurizados y el transbordador auxiliar de servicio en proa.':
    '/audio/voice/deck_ctx_04.wav',
  'Soy KRONOX IA. Todos los sistemas científicos y de navegación están en línea bajo tu mando.':
    '/audio/voice/voice_test_menu.wav',
  'Hola Comandante, sistemas en línea.': '/audio/voice/voice_test.wav',
});

export function resolvePredefinedVoiceUrl(text) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  return PREDEFINED_VOICE_CLIPS[clean] || null;
}

export function createHttpVoiceProvider({
  id = 'legacy-irsa-game-voice',
  endpoint = '/api/voice',
} = {}) {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//'))
    throw Error('Voice provider must use a same-origin backend');
  return {
    id,
    audioUrl({ text, language = 'es-US', voiceId, referenceId }) {
      const q = new URLSearchParams({ text, lang: language });
      if (voiceId) q.set('voice', voiceId);
      if (referenceId) q.set('reference_id', referenceId);
      return endpoint + '?' + q;
    },
  };
}

export function createFishAudioVoiceProvider({
  endpoint = '/api/fish-tts',
  fallbackEndpoint = '/api/voice',
  referenceId = FISH_AUDIO_VOICE_ID,
  baseUrl = '/',
} = {}) {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//'))
    throw Error('Fish Audio provider must use a same-origin backend');
  if (!fallbackEndpoint.startsWith('/') || fallbackEndpoint.startsWith('//'))
    throw Error('Fallback voice provider must use a same-origin backend');
  return {
    id: 'fish-audio-cronos',
    referenceId,
    staticAudioUrl({ text }) {
      const clipUrl = resolvePredefinedVoiceUrl(text);
      if (!clipUrl) return null;
      const normalizedBaseUrl = String(baseUrl || '/').endsWith('/')
        ? String(baseUrl || '/')
        : `${baseUrl}/`;
      return `${normalizedBaseUrl}${clipUrl.replace(/^\/+/, '')}`;
    },
    audioUrl({ text, language = 'es-US', voiceId }) {
      const q = new URLSearchParams({
        text: String(text || '').trim(),
        lang: language,
        reference_id: referenceId,
      });
      if (voiceId) q.set('voice', voiceId);
      return endpoint + '?' + q;
    },
    fallbackAudioUrl({ text, language = 'es-US', voiceId }) {
      const q = new URLSearchParams({
        text: String(text || '').trim(),
        lang: language,
      });
      if (voiceId) q.set('voice', voiceId);
      return fallbackEndpoint + '?' + q;
    },
    statusUrl() {
      const q = new URLSearchParams({
        status: '1',
        reference_id: referenceId,
      });
      return endpoint + '?' + q;
    },
  };
}

/**
 * Cola de reproducción secuencial para KRONOX IA:
 * - Evita superposiciones de locuciones.
 * - No interrumpe una frase antes de que termine (a menos que el usuario pida interrupt explícito).
 * - Nunca usa temporizadores fijos para estimar la duración de una locución: avanza al evento real `onended`.
 */
export function createSequentialVoiceQueue({ playPhrase } = {}) {
  const queue = [];
  let active = null;
  let running = false;

  async function pump() {
    if (running || queue.length === 0) return;
    running = true;
    while (queue.length > 0) {
      const item = queue.shift();
      active = item;
      try {
        await playPhrase?.(item);
      } catch (_err) {
        // Continúa con la siguiente locución de la cola si ocurre un error
      }
      active = null;
    }
    running = false;
  }

  return {
    enqueue(phrase, { interrupt = false } = {}) {
      const text = typeof phrase === 'string' ? phrase.trim() : String(phrase?.text || '').trim();
      if (!text) return false;
      const entry = typeof phrase === 'object' && phrase !== null ? { ...phrase, text } : { text };
      if (interrupt) {
        queue.length = 0;
      }
      queue.push(entry);
      pump();
      return true;
    },
    clear() {
      queue.length = 0;
    },
    isSpeaking: () => Boolean(active || running),
    pendingCount: () => queue.length,
    getActive: () => active,
  };
}

export const browserSpeechProvider = {
  id: 'browser-speech',
  available: (scope) => !!scope?.speechSynthesis,
};
