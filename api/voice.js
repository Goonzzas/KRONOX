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
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
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
      } catch (err) {
        lastErr = err;
      }
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Kronox-Voice-Name', voiceName);
    return response.status(503).json({
      error: lastErr?.message || 'Gemini TTS temporarily unavailable',
      voiceName,
      singleVoiceLocked: true,
    });
  }

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Kronox-Voice-Name', voiceName);
  return response.status(503).json({
    error: 'Official KRONOX IA voice backend is not configured.',
    voiceName,
    singleVoiceLocked: true,
  });
}
