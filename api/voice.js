import { createSign } from 'node:crypto';

const SUPPORTED_LANGUAGES = new Set(['es-US', 'es-ES']);

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getGoogleAccessToken() {
  const serializedAccount = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON;
  if (!serializedAccount) return null;

  const account = JSON.parse(serializedAccount);
  if (!account.client_email || !account.private_key) {
    throw new Error('Google TTS service account credentials are incomplete.');
  }

  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = [
    encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    encodeBase64Url(JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })),
  ].join('.');
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const assertion = `${unsignedToken}.${signer.sign(account.private_key, 'base64url')}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const tokenResult = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenResult.access_token) {
    throw new Error('Google Cloud could not authorize the TTS service account.');
  }
  return tokenResult.access_token;
}

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

    const googleAccessToken = await getGoogleAccessToken();

    if (googleAccessToken) {
      const voice = getCloudVoice(language);
      audioResponse = await fetch(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json',
          },
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

    // Keep a working voice until the Cloud TTS service account is configured.
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
