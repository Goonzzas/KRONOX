const SUPPORTED_LANGUAGES = new Set(['es-US', 'es-ES']);

function getCloudVoice(language) {
  // Chirp 3 HD voices sound more natural and expressive than Translate TTS.
  return language === 'es-ES'
    ? { languageCode: 'es-ES', name: 'es-ES-Chirp3-HD-Sulafat' }
    : { languageCode: 'es-US', name: 'es-US-Chirp3-HD-Sulafat' };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const text = typeof request.query.text === 'string' ? request.query.text.trim() : '';
  const requestedLanguage = request.query.lang;
  const language = SUPPORTED_LANGUAGES.has(requestedLanguage) ? requestedLanguage : 'es-US';

  if (!text || text.length > 200) {
    return response.status(400).json({ error: 'Text must contain between 1 and 200 characters.' });
  }

  try {
    let audioResponse;

    // The project's existing Google Cloud key is named GEMINI_API_KEY. Accept
    // the dedicated TTS name as well, so it can be separated later if desired.
    const googleTtsApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;

    if (googleTtsApiKey) {
      const voice = getCloudVoice(language);
      audioResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(googleTtsApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice,
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.03,
              pitch: -1.5,
            },
          }),
        },
      );

      if (!audioResponse.ok) {
        const failure = await audioResponse.json().catch(() => ({}));
        const reason = typeof failure.error?.message === 'string'
          ? failure.error.message.slice(0, 240)
          : 'Google Cloud Text-to-Speech could not create audio.';
        return response.status(502).json({ error: reason });
      }

      const result = await audioResponse.json();
      if (!result.audioContent) {
        return response.status(502).json({ error: 'Google Cloud Text-to-Speech returned no audio.' });
      }

      const audio = Buffer.from(result.audioContent, 'base64');
      response.setHeader('Content-Type', 'audio/mpeg');
      response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      response.setHeader('Content-Length', String(audio.length));
      return response.status(200).send(audio);
    }

    // Keep a working voice until the Cloud TTS API key is configured.
    const url = new URL('https://translate.google.com/translate_tts');
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('client', 'tw-ob');
    url.searchParams.set('tl', language);
    url.searchParams.set('text', text);

    audioResponse = await fetch(url, {
      headers: { Accept: 'audio/mpeg', 'User-Agent': 'Mozilla/5.0 KRONOX/1.0' },
    });

    if (!audioResponse.ok) {
      return response.status(502).json({ error: 'The speech service could not create audio.' });
    }

    const audio = Buffer.from(await audioResponse.arrayBuffer());
    response.setHeader('Content-Type', audioResponse.headers.get('content-type') || 'audio/mpeg');
    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    response.setHeader('Content-Length', String(audio.length));
    return response.status(200).send(audio);
  } catch {
    return response.status(502).json({ error: 'The speech service is temporarily unavailable.' });
  }
}
