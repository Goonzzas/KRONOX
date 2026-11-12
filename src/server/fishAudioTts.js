import fallbackVoiceHandler from '../../api/voice.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

export const FISH_AUDIO_VOICE_ID = '8150d8bf74d245cd84a154b785aa7fab';
export const FISH_AUDIO_TTS_ENDPOINT = 'https://api.fish.audio/v1/tts';
export const FISH_AUDIO_MODEL_ENDPOINT = 'https://api.fish.audio/model';

const memoryCache = new Map();
const cacheDir =
  process.env.VERCEL === '1'
    ? path.join(os.tmpdir(), 'kronox-cache', 'fish-audio')
    : path.resolve(process.cwd(), '.cache', 'fish-audio');

function getCacheKey(referenceId, model, format, text) {
  return crypto
    .createHash('sha256')
    .update(`${referenceId}:${model}:${format}:${text}`)
    .digest('hex');
}

function getServerFishApiKey() {
  return (
    process.env.FISH_AUDIO_API_KEY ||
    process.env.FISH_API_KEY ||
    process.env.KRONOX_FISH_AUDIO_KEY ||
    ''
  ).trim();
}

function sanitizeReferenceId(rawId) {
  const clean = String(rawId || FISH_AUDIO_VOICE_ID).trim();
  return /^[a-f0-9]{24,64}$/i.test(clean) ? clean : FISH_AUDIO_VOICE_ID;
}

/**
 * Verifica en el backend si el identificador de voz de Fish Audio es accesible y autorizado
 * para la cuenta configurada, sin exponer jamás la API key al cliente.
 */
export async function verifyFishVoiceAccess(referenceId = FISH_AUDIO_VOICE_ID, fetchImpl = fetch) {
  const cleanId = sanitizeReferenceId(referenceId);
  const apiKey = getServerFishApiKey();
  if (!apiKey) {
    return {
      configured: false,
      authorized: false,
      accessible: false,
      referenceId: cleanId,
      provider: 'fallback',
      reason:
        'FISH_AUDIO_API_KEY no configurada en el entorno del servidor; usando proveedor TTS de respaldo.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetchImpl(`${FISH_AUDIO_MODEL_ENDPOINT}/${cleanId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const metadata = await response.json().catch(() => ({}));
      return {
        configured: true,
        authorized: true,
        accessible: true,
        referenceId: cleanId,
        title: metadata.title || metadata.name || 'KRONOX IA Fish Audio Voice',
        visibility: metadata.visibility || 'public',
        provider: 'fish-audio',
      };
    }

    return {
      configured: true,
      authorized: response.status !== 401 && response.status !== 403,
      accessible: false,
      referenceId: cleanId,
      statusCode: response.status,
      provider: 'fallback',
      reason: `El modelo ${cleanId} devolvió HTTP ${response.status}; se usará el proveedor TTS alternativo si la síntesis directa falla.`,
    };
  } catch (error) {
    return {
      configured: true,
      authorized: false,
      accessible: false,
      referenceId: cleanId,
      provider: 'fallback',
      reason: error?.message || 'Error de red verificando el modelo en Fish Audio.',
    };
  }
}

/**
 * Sintetiza voz con Fish Audio (`https://api.fish.audio/v1/tts`) usando `reference_id`.
 * Nunca expone credenciales fuera del backend.
 */
export async function synthesizeWithFishAudio({
  text,
  referenceId = FISH_AUDIO_VOICE_ID,
  model = process.env.FISH_AUDIO_MODEL || 's2.1-pro-free',
  format = 'mp3',
  fetchImpl = fetch,
} = {}) {
  const cleanText = String(text || '')
    .trim()
    .slice(0, 650);
  if (!cleanText) {
    const err = new Error('Missing text');
    err.statusCode = 400;
    throw err;
  }

  const cleanReferenceId = sanitizeReferenceId(referenceId);
  const cacheKey = getCacheKey(cleanReferenceId, model, format, cleanText);
  const isCustomFetch = typeof fetchImpl === 'function' && fetchImpl !== fetch;

  if (!isCustomFetch) {
    if (memoryCache.has(cacheKey)) {
      return {
        buffer: memoryCache.get(cacheKey),
        contentType: 'audio/mpeg',
        provider: 'fish-audio',
        referenceId: cleanReferenceId,
        cached: true,
      };
    }
    try {
      const diskPath = path.join(cacheDir, `${cacheKey}.${format}`);
      if (fs.existsSync(diskPath)) {
        const diskBuf = fs.readFileSync(diskPath);
        if (diskBuf.length >= 128) {
          memoryCache.set(cacheKey, diskBuf);
          return {
            buffer: diskBuf,
            contentType: 'audio/mpeg',
            provider: 'fish-audio',
            referenceId: cleanReferenceId,
            cached: true,
          };
        }
      }
    } catch {
      /* ignore cache read error */
    }
  }

  const apiKey = getServerFishApiKey();
  if (!apiKey) {
    const err = new Error('FISH_AUDIO_API_KEY not configured on backend');
    err.code = 'FISH_KEY_MISSING';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetchImpl(FISH_AUDIO_TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        model,
      },
      body: JSON.stringify({
        text: cleanText,
        reference_id: cleanReferenceId,
        format,
        normalize: true,
        latency: 'balanced',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const err = new Error(
        `Fish Audio TTS responded HTTP ${response.status}${detail ? `: ${detail.slice(0, 140)}` : ''}`,
      );
      err.statusCode = response.status;
      err.code = 'FISH_UPSTREAM_ERROR';
      throw err;
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    if (audioBuffer.length < 128) {
      const err = new Error('Fish Audio returned an empty audio stream');
      err.code = 'FISH_EMPTY_AUDIO';
      throw err;
    }

    if (!isCustomFetch) {
      memoryCache.set(cacheKey, audioBuffer);
      try {
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        const diskPath = path.join(cacheDir, `${cacheKey}.${format}`);
        fs.writeFileSync(diskPath, audioBuffer);
      } catch {
        /* ignore cache write error */
      }
    }

    return {
      buffer: audioBuffer,
      contentType: response.headers?.get?.('content-type') || 'audio/mpeg',
      provider: 'fish-audio',
      referenceId: cleanReferenceId,
      cached: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Handler HTTP para `/api/fish-tts` y `/KRONOX/api/fish-tts`.
 * Intenta Fish Audio con el `reference_id` `8150d8bf74d245cd84a154b785aa7fab` y,
 * si no hay credenciales o falla la API remota, delega de forma transparente en el
 * proveedor TTS existente (`api/voice.js`).
 */
export default async function fishTtsHandler(req, res) {
  const query =
    req.query || Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);

  if (query.status === '1' || query.verify === '1') {
    const status = await verifyFishVoiceAccess(query.reference_id || FISH_AUDIO_VOICE_ID);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(status);
  }

  const text = String(query.text || '')
    .trim()
    .slice(0, 650);
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }

  const referenceId = sanitizeReferenceId(query.reference_id || FISH_AUDIO_VOICE_ID);

  try {
    const result = await synthesizeWithFishAudio({
      text,
      referenceId,
    });
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Kronox-TTS-Provider', 'fish-audio');
    res.setHeader('X-Kronox-Voice-Reference', result.referenceId);
    res.setHeader('X-Kronox-TTS-Cache', result.cached ? 'HIT' : 'MISS');
    return res.status(200).send(result.buffer);
  } catch (_fishError) {
    res.setHeader('X-Kronox-TTS-Provider', 'fallback-voice');
    res.setHeader('X-Kronox-Voice-Reference', referenceId);
    return fallbackVoiceHandler(req, res);
  }
}
