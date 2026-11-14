import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GEMINI_TTS_VOICES as SERVER_VOICES,
  DEFAULT_GEMINI_VOICE_NAME,
  pcmToWavBuffer,
  parseSampleRateFromMime,
  sanitizeGeminiVoiceName,
  synthesizeWithGeminiTts,
  sendAudioBufferWithRanges,
  getGeminiTtsStatus,
} from '../src/server/geminiTts.js';
import fishTtsHandler from '../src/server/fishAudioTts.js';
import voiceHandler from '../api/voice.js';
import { GEMINI_TTS_VOICES as CLIENT_VOICES } from '../src/utils/voiceProvider.js';

function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let body = null;
  let jsonBody = null;
  return {
    headers,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    get jsonBody() {
      return jsonBody;
    },
    setHeader(k, v) {
      headers[String(k).toLowerCase()] = v;
      return this;
    },
    status(c) {
      statusCode = c;
      return this;
    },
    json(payload) {
      jsonBody = payload;
      return this;
    },
    send(payload) {
      body = payload;
      return this;
    },
  };
}

test('Gemini TTS wraps 24 kHz linear PCM into valid RIFF/WAVE and supports HTTP byte ranges', () => {
  assert.equal(parseSampleRateFromMime('audio/L16;codec=pcm;rate=24000'), 24000);
  assert.equal(sanitizeGeminiVoiceName('Orus'), DEFAULT_GEMINI_VOICE_NAME);
  assert.equal(sanitizeGeminiVoiceName('UnknownVoice'), DEFAULT_GEMINI_VOICE_NAME);
  assert.equal(SERVER_VOICES.length, 1);
  assert.deepEqual(
    CLIENT_VOICES.map((v) => v.id),
    SERVER_VOICES.map((v) => v.id),
  );

  const rawPcm = Buffer.alloc(480, 0x22);
  const wav = pcmToWavBuffer(rawPcm, 24000, 1, 16);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.length, 44 + 480);

  const resFull = createMockRes();
  sendAudioBufferWithRanges({ headers: {} }, resFull, wav, 'audio/wav');
  assert.equal(resFull.statusCode, 200);
  assert.equal(resFull.headers['content-type'], 'audio/wav');
  assert.equal(resFull.headers['accept-ranges'], 'bytes');
  assert.equal(resFull.headers['content-length'], String(wav.length));

  const resRange = createMockRes();
  sendAudioBufferWithRanges({ headers: { range: 'bytes=0-43' } }, resRange, wav, 'audio/wav');
  assert.equal(resRange.statusCode, 206);
  assert.equal(resRange.headers['content-range'], `bytes 0-43/${wav.length}`);
  assert.equal(resRange.body.length, 44);
});

test('Gemini TTS rotates across multiple configured keys on 429 and converts audio cleanly without exposing secrets', async () => {
  const prevPrimary = process.env.GEMINI_API_KEY;
  const prevSecondary = process.env.GEMINI_API_KEY_SECONDARY;
  process.env.GEMINI_API_KEY = 'fake-test-key-one';
  process.env.GEMINI_API_KEY_SECONDARY = 'fake-test-key-two';

  const seenUrls = [];
  const fakePcm = Buffer.alloc(320, 0x11).toString('base64');

  try {
    let attempts = 0;
    const result = await synthesizeWithGeminiTts({
      text: 'Soy KRONOX IA. Sistemas nominales.',
      voiceName: 'Kore',
      fetchImpl: async (url, opts) => {
        seenUrls.push(String(url));
        attempts += 1;
        const parsedBody = JSON.parse(opts.body);
        assert.deepEqual(parsedBody.generationConfig.responseModalities, ['AUDIO']);
        assert.equal(
          parsedBody.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
          DEFAULT_GEMINI_VOICE_NAME,
        );
        if (attempts === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => 'quota exceeded',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/L16;codec=pcm;rate=24000',
                        data: fakePcm,
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      },
    });

    assert.equal(attempts, 2);
    assert.equal(seenUrls.length, 2);
    assert.notEqual(seenUrls[0], seenUrls[1]);
    assert.equal(result.provider, 'gemini-2.5-flash-tts');
    assert.equal(result.voiceName, DEFAULT_GEMINI_VOICE_NAME);
    assert.equal(result.contentType, 'audio/wav');
    assert.equal(result.buffer.toString('ascii', 0, 4), 'RIFF');
  } finally {
    if (prevPrimary === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevPrimary;
    if (prevSecondary === undefined) delete process.env.GEMINI_API_KEY_SECONDARY;
    else process.env.GEMINI_API_KEY_SECONDARY = prevSecondary;
  }
});

test('Voice status endpoints and frontend voice UI never leak credentials', async () => {
  const status = getGeminiTtsStatus();
  assert.equal(JSON.stringify(status).includes('AIzaSy'), false);

  const resFish = createMockRes();
  await fishTtsHandler({ method: 'GET', url: '/api/fish-tts?status=1', query: { status: '1' } }, resFish);
  assert.equal(resFish.statusCode, 200);
  assert.equal(JSON.stringify(resFish.jsonBody).includes('AIzaSy'), false);
  assert.ok('geminiTts' in resFish.jsonBody);

  const resVoice = createMockRes();
  await voiceHandler({ method: 'GET', url: 'http://localhost/api/voice?status=1' }, resVoice);
  assert.equal(resVoice.statusCode, 200);
  assert.equal(JSON.stringify(resVoice.jsonBody).includes('AIzaSy'), false);

  for (const clientPath of [
    'src/App.jsx',
    'src/utils/voiceProvider.js',
    'src/components/AudioSubtitleSettingsControls.jsx',
    'src/components/MainMenu.jsx',
    'src/components/PauseMenu.jsx',
  ]) {
    const content = fs.readFileSync(clientPath, 'utf8');
    assert.equal(content.includes('AIzaSy'), false, clientPath);
    assert.equal(content.includes('GEMINI_API_KEY'), false, clientPath);
  }
});

