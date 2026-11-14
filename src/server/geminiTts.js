import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { getConfiguredGeminiKeys } from '../../api/kronox-chat.js';

export const DEFAULT_GEMINI_TTS_MODEL =
  process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
export const DEFAULT_GEMINI_VOICE_NAME = 'Charon';

export const GEMINI_TTS_VOICES = Object.freeze([
  {
    id: 'Charon',
    label: 'Charon · Documental Espacial',
    description: 'Timbre grave, sereno y cinematográfico (predeterminado)',
  },
  {
    id: 'Orus',
    label: 'Orus · Mando Técnico',
    description: 'Voz firme, clara y autoritativa de puente de mando',
  },
  {
    id: 'Kore',
    label: 'Kore · IA Femenina Clara',
    description: 'Voz femenina nítida, precisa y de estudio',
  },
  {
    id: 'Aoede',
    label: 'Aoede · Narradora Serena',
    description: 'Voz femenina cálida y fluida para crónicas astronómicas',
  },
  {
    id: 'Iapetus',
    label: 'Iapetus · Estudio Equilibrado',
    description: 'Locución neutra de alta inteligibilidad científica',
  },
]);

const ALLOWED_VOICE_SET = new Set(GEMINI_TTS_VOICES.map((v) => v.id));

const MAX_MEMORY_CACHE_ENTRIES = 140;
const memoryCache = new Map();
const inFlightRequests = new Map();
const keyCooldownUntil = new Map();
let nextKeyCursor = 0;

const cacheDir =
  process.env.VERCEL === '1'
    ? path.join(os.tmpdir(), 'kronox-cache', 'gemini-tts')
    : path.resolve(process.cwd(), '.cache', 'gemini-tts');

export function sanitizeGeminiVoiceName(rawVoice) {
  const clean = String(rawVoice || '').trim();
  return ALLOWED_VOICE_SET.has(clean) ? clean : DEFAULT_GEMINI_VOICE_NAME;
}

export function parseSampleRateFromMime(mimeType, fallbackRate = 24000) {
  const match = String(mimeType || '').match(/rate=(\d{4,6})/i);
  if (!match) return fallbackRate;
  const rate = Number(match[1]);
  return Number.isFinite(rate) && rate >= 8000 && rate <= 96000 ? rate : fallbackRate;
}

/**
 * Envuelve muestras PCM lineal 16-bit mono firmadas en una cabecera RIFF/WAV estándar
 * para reproducción nativa en `<audio>` HTML5 sin pérdida por compresión.
 */
export function pcmToWavBuffer(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const payload = Buffer.isBuffer(pcmBuffer) ? pcmBuffer : Buffer.from(pcmBuffer || '');
  const blockAlign = (channels * bitsPerSample) >> 3;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + payload.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // Tamaño chunk PCM
  header.writeUInt16LE(1, 20); // Formato 1 = PCM lineal
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(payload.length, 40);

  return Buffer.concat([header, payload]);
}

function setMemoryCacheEntry(cacheKey, buffer) {
  if (memoryCache.has(cacheKey)) {
    memoryCache.delete(cacheKey);
  }
  memoryCache.set(cacheKey, buffer);
  if (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey !== undefined) memoryCache.delete(oldestKey);
  }
}

function getCacheKey(model, voiceName, language, text) {
  return crypto
    .createHash('sha256')
    .update(`gemini-tts:v1:${model}:${voiceName}:${language}:${text}`)
    .digest('hex');
}

function buildKeyOrder(totalKeys) {
  const now = Date.now();
  const start = nextKeyCursor % totalKeys;
  nextKeyCursor = (nextKeyCursor + 1) % totalKeys;

  const healthy = [];
  const cooling = [];
  for (let offset = 0; offset < totalKeys; offset++) {
    const idx = (start + offset) % totalKeys;
    const until = keyCooldownUntil.get(idx) || 0;
    if (until <= now) healthy.push(idx);
    else cooling.push(idx);
  }
  return [...healthy, ...cooling];
}

export function getGeminiTtsStatus() {
  const keys = getConfiguredGeminiKeys();
  return {
    configured: keys.length > 0,
    keyCount: keys.length,
    provider: keys.length > 0 ? 'gemini-2.5-flash-tts' : 'fallback',
    model: DEFAULT_GEMINI_TTS_MODEL,
    defaultVoice: DEFAULT_GEMINI_VOICE_NAME,
    availableVoices: GEMINI_TTS_VOICES,
  };
}

export function sendAudioBufferWithRanges(req, res, buffer, contentType = 'audio/wav') {
  const total = buffer.length;
  const rangeHeader = req?.headers?.range || req?.headers?.Range;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');

  if (typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
    const match = rangeHeader.replace(/^bytes=/, '').match(/^(\d*)-(\d*)$/);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < total) {
        const chunk = buffer.subarray(start, end + 1);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(chunk.length));
        return res.status(206).send(chunk);
      }
    }
  }

  res.setHeader('Content-Length', String(total));
  return res.status(200).send(buffer);
}

/**
 * Sintetiza audio WAV 24 kHz de estudio con Google Gemini TTS (`gemini-2.5-flash-preview-tts`),
 * rotando en round-robin por todas las claves `GEMINI_API_KEY*` del servidor con caché en memoria y disco.
 */
export async function synthesizeWithGeminiTts({
  text,
  voiceName = DEFAULT_GEMINI_VOICE_NAME,
  language = 'es-US',
  model = DEFAULT_GEMINI_TTS_MODEL,
  fetchImpl = fetch,
} = {}) {
  const cleanText = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
  if (!cleanText) {
    const err = new Error('Missing text');
    err.statusCode = 400;
    throw err;
  }

  const cleanVoice = sanitizeGeminiVoiceName(voiceName);
  const cleanLang = String(language || 'es-US').trim() || 'es-US';
  const cacheKey = getCacheKey(model, cleanVoice, cleanLang, cleanText);
  const isCustomFetch = typeof fetchImpl === 'function' && fetchImpl !== fetch;

  if (!isCustomFetch) {
    if (memoryCache.has(cacheKey)) {
      const hitBuf = memoryCache.get(cacheKey);
      setMemoryCacheEntry(cacheKey, hitBuf);
      return {
        buffer: hitBuf,
        contentType: 'audio/wav',
        provider: 'gemini-2.5-flash-tts',
        voiceName: cleanVoice,
        model,
        cached: true,
      };
    }

    try {
      const diskPath = path.join(cacheDir, `${cacheKey}.wav`);
      if (fs.existsSync(diskPath)) {
        const diskBuf = fs.readFileSync(diskPath);
        if (diskBuf.length > 64) {
          setMemoryCacheEntry(cacheKey, diskBuf);
          return {
            buffer: diskBuf,
            contentType: 'audio/wav',
            provider: 'gemini-2.5-flash-tts',
            voiceName: cleanVoice,
            model,
            cached: true,
          };
        }
      }
    } catch {
      /* ignorar error de lectura de caché en disco */
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const keys = getConfiguredGeminiKeys();
  if (keys.length === 0) {
    const err = new Error('GEMINI_API_KEY not configured on backend');
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }

  const executeSynthesis = async () => {
    const order = buildKeyOrder(keys.length);
    let lastError = null;

    for (const kIdx of order) {
      const apiKey = keys[kIdx];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: cleanText }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: cleanVoice },
                },
              },
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          if (response.status === 429) {
            keyCooldownUntil.set(kIdx, Date.now() + 45_000);
          } else if (response.status === 401 || response.status === 403) {
            keyCooldownUntil.set(kIdx, Date.now() + 300_000);
          }
          const detail = await response.text().catch(() => '');
          const err = new Error(
            `Gemini TTS HTTP ${response.status}${detail ? `: ${detail.slice(0, 140)}` : ''}`,
          );
          err.statusCode = response.status;
          lastError = err;
          continue;
        }

        const payload = await response.json().catch(() => ({}));
        const parts = payload?.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((p) => p?.inlineData?.data);
        if (!audioPart?.inlineData?.data) {
          lastError = new Error('Gemini TTS response did not include inline audio data');
          continue;
        }

        const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
        if (pcmBuffer.length < 64) {
          lastError = new Error('Gemini TTS returned empty PCM audio');
          continue;
        }

        const mime = audioPart.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000';
        const wavBuffer = mime.toLowerCase().includes('wav')
          ? pcmBuffer
          : pcmToWavBuffer(pcmBuffer, parseSampleRateFromMime(mime, 24000), 1, 16);

        if (!isCustomFetch) {
          setMemoryCacheEntry(cacheKey, wavBuffer);
          try {
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
            const diskPath = path.join(cacheDir, `${cacheKey}.wav`);
            fs.writeFileSync(diskPath, wavBuffer);
          } catch {
            /* ignorar error al persistir en disco */
          }
        }

        return {
          buffer: wavBuffer,
          contentType: 'audio/wav',
          provider: 'gemini-2.5-flash-tts',
          voiceName: cleanVoice,
          model,
          keyIndexUsed: kIdx + 1,
          cached: false,
        };
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini TTS keys failed');
  };

  if (isCustomFetch) {
    return executeSynthesis();
  }

  const pending = executeSynthesis().finally(() => {
    inFlightRequests.delete(cacheKey);
  });
  inFlightRequests.set(cacheKey, pending);
  return pending;
}

