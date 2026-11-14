/** Provider contract for existing voice and server-side Fish Audio / Gemini TTS adapters. No keys in client. */
export const FISH_AUDIO_VOICE_ID = '8150d8bf74d245cd84a154b785aa7fab';

export const GEMINI_TTS_VOICES = Object.freeze([
  { id: 'Charon', label: 'Charon · Voz Oficial KRONOX IA' },
]);

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
} = {}) {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//'))
    throw Error('Fish Audio provider must use a same-origin backend');
  if (!fallbackEndpoint.startsWith('/') || fallbackEndpoint.startsWith('//'))
    throw Error('Fallback voice provider must use a same-origin backend');
  return {
    id: 'fish-audio-cronos',
    referenceId,
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
