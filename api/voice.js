import {
  getGeminiTtsStatus,
  sanitizeGeminiVoiceName,
  sendAudioBufferWithRanges,
  synthesizeWithGeminiTts,
} from '../src/server/geminiTts.js';

const SUPPORTED_LANGUAGES = new Set(['es-US', 'es-ES', 'en-US']);

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const query = new URL(request.url, 'http://localhost').searchParams;

  if (query.get('status') === '1' || query.get('verify') === '1') {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json(getGeminiTtsStatus());
  }

  const text = (query.get('text') || '').trim();
  const requestedLanguage = query.get('lang');
  const language = SUPPORTED_LANGUAGES.has(requestedLanguage) ? requestedLanguage : 'es-US';
  const voiceName = sanitizeGeminiVoiceName(query.get('voice'));

  if (!text || text.length > 900) {
    return response.status(400).json({ error: 'Text must contain between 1 and 900 characters.' });
  }

  const geminiStatus = getGeminiTtsStatus();
  if (geminiStatus.configured) {
    try {
      const synth = await synthesizeWithGeminiTts({
        text,
        voiceName,
        language,
      });
      response.setHeader('X-Kronox-TTS-Provider', synth.provider);
      response.setHeader('X-Kronox-Voice-Name', synth.voiceName);
      response.setHeader('X-Kronox-TTS-Cache', synth.cached ? 'HIT' : 'MISS');
      response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      return sendAudioBufferWithRanges(request, response, synth.buffer, synth.contentType);
    } catch {
      // Si fallan todas las claves o la red hacia Gemini TTS, degradar de forma limpia al servicio heredado.
    }
  }

  const legacyText = text.slice(0, 200);
  const url = new URL('https://translate.google.com/translate_tts');
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('client', 'tw-ob');
  url.searchParams.set('tl', language);
  url.searchParams.set('text', legacyText);

  try {
    const audioResponse = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: 'audio/mpeg',
        'User-Agent': 'Mozilla/5.0 KRONOX/1.0',
      },
    });

    if (!audioResponse.ok) {
      return response.status(502).json({ error: 'The speech service could not create audio.' });
    }

    const audio = Buffer.from(await audioResponse.arrayBuffer());
    response.setHeader('X-Kronox-TTS-Provider', 'google-translate-fallback');
    response.setHeader('Content-Type', audioResponse.headers.get('content-type') || 'audio/mpeg');
    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    response.setHeader('Content-Length', String(audio.length));
    return response.status(200).send(audio);
  } catch {
    return response.status(502).json({ error: 'The speech service is temporarily unavailable.' });
  }
}
