const SUPPORTED_LANGUAGES = new Set(['es-US', 'es-ES']);

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

  const url = new URL('https://translate.google.com/translate_tts');
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('client', 'tw-ob');
  url.searchParams.set('tl', language);
  url.searchParams.set('text', text);

  try {
    const audioResponse = await fetch(url, {
      headers: {
        Accept: 'audio/mpeg',
        'User-Agent': 'Mozilla/5.0 KRONOX/1.0',
      },
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
