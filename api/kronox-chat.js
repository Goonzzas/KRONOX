/**
 * KRONOX IA — BACKEND CONVERSACIONAL DINÁMICO Y EXPLICACIÓN CIENTÍFICA (ETAPA 5)
 *
 * Reglas de seguridad e ingeniería:
 * 1. Las claves GEMINI_API_KEY* residen exclusivamente en el servidor (.env.local / variables de entorno).
 * 2. Nunca se expone ninguna clave ni fragmento de clave al cliente.
 * 3. Rotación automática entre GEMINI_API_KEY .. GEMINI_API_KEY_8 ante cuota agotada (429) o error transitorio.
 * 4. Caché LRU en servidor para evitar llamadas repetidas ante la misma consulta y contexto.
 * 5. Limitación de frecuencia (Rate Limiting) y validación estricta de entrada y acciones permitidas.
 */

import fs from 'fs';
import path from 'path';

const ENV_KEY_NAMES = [
  'GEMINI_API_KEY',
  'GEMINI_API_KEY_SECONDARY',
  'GEMINI_API_KEY_TERTIARY',
  'GEMINI_API_KEY_QUATERNARY',
  'GEMINI_API_KEY_5',
  'GEMINI_API_KEY_6',
  'GEMINI_API_KEY_7',
  'GEMINI_API_KEY_8',
];

const ALLOWED_ACTION_TYPES = new Set([
  'ENTER_COCKPIT',
  'SET_VIEW_MODE',
  'SET_OPTICAL_TELESCOPE',
  'TRAVEL_PLANET',
  'TRAVEL_SPHEREX',
  'OPEN_MISSION_SELECTOR',
  'OPEN_OBSERVATORY',
]);

const VALID_PLANETS = new Set([
  'Sol',
  'Mercurio',
  'Venus',
  'Tierra',
  'Luna',
  'Marte',
  'Júpiter',
  'Saturno',
  'Urano',
  'Neptuno',
  'Plutón',
  'Ceres',
]);

const VALID_SPHEREX_KEYS = new Set([
  'barnard',
  'epsilon-indi-b',
  'wise-0855',
  'rw-aurigae',
  'r-draconis',
]);

// Caché LRU en memoria del servidor
const RESPONSE_CACHE = new Map();
const MAX_CACHE_ENTRIES = 200;

// Rate limit por IP
const RATE_LIMIT_MAP = new Map();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 24;

let envFileLoaded = false;

function ensureLocalEnvLoaded() {
  if (envFileLoaded) return;
  envFileLoaded = true;
  try {
    const candidates = [
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), 'KRONOX', '.env.local'),
    ];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (ENV_KEY_NAMES.includes(key) && val && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignorar silenciosamente si el sistema de archivos es de solo lectura
  }
}

export function getConfiguredGeminiKeys() {
  ensureLocalEnvLoaded();
  const keys = [];
  for (const envName of ENV_KEY_NAMES) {
    const val = (process.env[envName] || '').trim();
    if (val && !keys.includes(val)) {
      keys.push(val);
    }
  }
  return keys;
}

function checkRateLimit(clientKey) {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(clientKey);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    RATE_LIMIT_MAP.set(clientKey, { windowStart: now, count: 1 });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}

export function sanitizeUserMessage(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 480);
}

export function sanitizeActionDescriptor(action) {
  if (!action || typeof action !== 'object') return null;
  const type = String(action.type || '').trim();
  if (!ALLOWED_ACTION_TYPES.has(type)) return null;

  if (type === 'TRAVEL_PLANET') {
    const planetName = String(action.planetName || '').trim();
    return VALID_PLANETS.has(planetName) ? { type, planetName } : null;
  }
  if (type === 'TRAVEL_SPHEREX') {
    const targetKey = String(action.targetKey || '').trim();
    return VALID_SPHEREX_KEYS.has(targetKey) ? { type, targetKey } : null;
  }
  if (type === 'SET_VIEW_MODE') {
    const view = Number(action.view);
    return view === 1 || view === 3 ? { type, view } : null;
  }
  if (type === 'SET_OPTICAL_TELESCOPE') {
    const magnification = Math.max(1, Math.min(300, Number(action.magnification) || 50));
    return { type, enabled: magnification > 1, magnification };
  }
  return { type };
}

function buildSystemInstruction(context = {}) {
  const body = String(context.focusedPlanet || context.nearPlanet || 'Tierra');
  const obsMode = String(context.observationModeLabel || 'Simple vista (1×)');
  const target = String(context.activeTargetName || 'Estrella de Barnard');
  const objective = String(context.activeObjective || 'Exploración científica libre');
  const station = String(context.activeStation || 'Puente de mando');

  return [
    'Eres Kronox IA, la inteligencia científica de a bordo del crucero de exploración astrofísica KRONOX (escala física real de 120 metros).',
    'Tu tono es sereno, riguroso, inmersivo y propio de un videojuego espacial de ciencia ficción dura.',
    'Reglas científicas estrictas:',
    '1. Respeta las dimensiones físicas reales de los planetas (época de referencia J2000.0) y la diferencia entre observación a simple vista (donde planetas lejanos como Júpiter o Saturno desde la Tierra se ven como puntos brillantes con diámetro angular θ < 60″) y observación con telescopio óptico (50×-300×, que resuelve el disco planetario, los anillos de Saturno y las lunas galileanas).',
    '2. Respeta la integridad científica de la misión NASA SPHEREx (espectrofotometría infrarroja 0.75-5.0 µm, astrometría WCS ICRS, fotometría de apertura).',
    '3. Nunca afirmes que WISE 0855 está confirmado en Época 1: su estado es WARNING (SNR 1.07 sub-umbral en Época 1; 61.0% de completitud Monte Carlo en Época 2).',
    '4. Distingue siempre entre una anotación personal del explorador y un hallazgo científicamente validado.',
    `Contexto actual conciso: Ubicación=${body} | Modo de observación=${obsMode} | Estación=${station} | Objetivo SPHEREx=${target} | Misión=${objective}.`,
    'Responde en español en máximo 3 o 4 frases claras y directas, sin listas largas ni formato markdown pesado.',
  ].join('\n');
}

function getCacheKey(message, context = {}) {
  const normMsg = message.toLowerCase().trim();
  const ctxKey = [
    context.focusedPlanet || 'Tierra',
    context.observationMode || 'naked-eye',
    context.activeTargetKey || 'barnard',
    context.activeStation || 'bridge',
  ].join('|');
  return `${normMsg}::${ctxKey}`;
}

function setCacheEntry(key, value) {
  if (RESPONSE_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = RESPONSE_CACHE.keys().next().value;
    if (oldestKey) RESPONSE_CACHE.delete(oldestKey);
  }
  RESPONSE_CACHE.set(key, { value, timestamp: Date.now() });
}

async function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.on !== 'function') return {};
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk || '');
      if (raw.length > 16_384) raw = raw.slice(0, 16_384);
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const keys = getConfiguredGeminiKeys();
    return res.status(200).json({
      ok: true,
      service: 'kronox-chat',
      provider: 'gemini-server-side',
      configured: keys.length > 0,
      keyPoolCount: keys.length,
      cacheSize: RESPONSE_CACHE.size,
    });
  }

  if (method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido. Usa POST.' });
  }

  const clientIp =
    (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'local-client';
  const rate = checkRateLimit(String(clientIp));
  if (!rate.allowed) {
    return res.status(429).json({
      ok: false,
      error: 'Límite de consultas por minuto alcanzado. Intenta de nuevo en unos segundos.',
    });
  }

  const body = await readRequestBody(req);
  const message = sanitizeUserMessage(body.message || body.query || '');
  const context = body.context && typeof body.context === 'object' ? body.context : {};

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: 'El mensaje de consulta está vacío.',
    });
  }

  const cacheKey = getCacheKey(message, context);
  const cached = RESPONSE_CACHE.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      ...cached.value,
      cached: true,
    });
  }

  const keys = getConfiguredGeminiKeys();
  if (keys.length === 0) {
    return res.status(503).json({
      ok: false,
      error: 'Servicio Gemini no configurado en el entorno del servidor.',
      fallbackRecommended: true,
    });
  }

  const systemInstruction = buildSystemInstruction(context);
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastStatus = 500;
  let lastErrorText = 'No se pudo completar la consulta en Gemini.';

  for (let kIdx = 0; kIdx < keys.length; kIdx++) {
    const apiKey = keys[kIdx];
    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: message }],
              },
            ],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 280,
            },
          }),
        });

        lastStatus = response.status;
        if (!response.ok) {
          // Si la clave actual devuelve 429/401/403, rotar a la siguiente clave
          if (response.status === 429 || response.status === 401 || response.status === 403) {
            break;
          }
          continue;
        }

        const data = await response.json();
        const candidateText =
          data?.candidates?.[0]?.content?.parts
            ?.map((p) => p?.text || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim() || '';

        if (!candidateText) continue;

        const payload = {
          ok: true,
          reply: candidateText,
          role: 'Kronox IA · Astrofísica de a bordo',
          avatarState: 'EXPLAINING',
          pointDirection: 'forward',
          epistemicCategory: 'Síntesis contextual asistida por Kronox IA',
          action: sanitizeActionDescriptor(body.suggestedAction || null),
          model: modelName,
          keyIndexUsed: kIdx + 1,
          cached: false,
        };

        setCacheEntry(cacheKey, payload);
        return res.status(200).json(payload);
      } catch (err) {
        lastErrorText = err?.message || 'Error de red al contactar con el motor de IA.';
      }
    }
  }

  return res.status(lastStatus || 502).json({
    ok: false,
    error: lastErrorText,
    fallbackRecommended: true,
  });
}

