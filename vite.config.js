import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pathToFileURL } from 'url';

function apiDevServerPlugin() {
  const handleApi = async (req, res, next, loadModule) => {
    const rawUrl = req.url || '';
    const match = rawUrl.match(/(?:\/KRONOX)?\/api\/([a-zA-Z0-9_-]+)(?:\?.*)?$/);
    if (!match) return next();

    const endpoint = match[1];
    try {
      const isFishTts = endpoint === 'fish-tts';
      const moduleRelPath = isFishTts ? '/src/server/fishAudioTts.js' : `/api/${endpoint}.js`;
      const fullPath = isFishTts
        ? path.resolve(process.cwd(), 'src', 'server', 'fishAudioTts.js')
        : path.resolve(process.cwd(), 'api', `${endpoint}.js`);
      const { default: handler } = loadModule
        ? await loadModule(moduleRelPath)
        : await import(pathToFileURL(fullPath).href);
      if (typeof handler !== 'function') return next();

      const parsedUrl = new URL(rawUrl, 'http://localhost');
      const query = Object.fromEntries(parsedUrl.searchParams.entries());

      let parsedBody = req.body;
      if (!parsedBody && req.method === 'POST' && typeof req.on === 'function') {
        parsedBody = await new Promise((resolve) => {
          let rawBody = '';
          req.on('data', (chunk) => {
            rawBody += String(chunk || '');
            if (rawBody.length > 16384) rawBody = rawBody.slice(0, 16384);
          });
          req.on('end', () => {
            try {
              resolve(rawBody ? JSON.parse(rawBody) : {});
            } catch {
              resolve({});
            }
          });
          req.on('error', () => resolve({}));
        });
      }

      const mockedReq = {
        method: req.method || 'GET',
        url: rawUrl,
        query,
        body: parsedBody,
        headers: req.headers || {},
      };

      const mockedRes = {
        statusCode: 200,
        setHeader(key, val) {
          res.setHeader(key, val);
          return this;
        },
        status(code) {
          res.statusCode = code;
          return this;
        },
        json(data) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return this;
        },
        send(data) {
          res.end(data);
          return this;
        },
      };

      await handler(mockedReq, mockedRes);
    } catch (err) {
      console.error(`Local API error in /api/${endpoint}:`, err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal local server error' }));
    }
  };

  return {
    name: 'api-dev-server-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) =>
        handleApi(req, res, next, (id) => server.ssrLoadModule(id)),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApi);
    },
  };
}

export default defineConfig(({ mode }) => {
  const fishEnv = loadEnv(mode, process.cwd(), '');
  for (const key of [
    'FISH_AUDIO_API_KEY',
    'FISH_API_KEY',
    'KRONOX_FISH_AUDIO_KEY',
    'FISH_AUDIO_MODEL',
    'GEMINI_API_KEY',
    'GEMINI_API_KEY_SECONDARY',
    'GEMINI_API_KEY_TERTIARY',
    'GEMINI_API_KEY_QUATERNARY',
    'GEMINI_API_KEY_5',
    'GEMINI_API_KEY_6',
    'GEMINI_API_KEY_7',
    'GEMINI_API_KEY_8',
  ]) {
    if (fishEnv[key] && !process.env[key]) process.env[key] = fishEnv[key];
  }
  return {
  // Concurrent dev servers and Node test workers must never overwrite each other's optimized modules.
  cacheDir: path.resolve(
    '.cache',
    'vite',
    (process.env.NODE_TEST_CONTEXT ? 'tests-' : 'runtime-') + process.pid,
  ),
  base: process.env.VERCEL === '1' ? '/' : '/KRONOX/',
  optimizeDeps: {
    include: process.env.NODE_TEST_CONTEXT
      ? []
      : [
          'react',
          'react-dom/client',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'three',
          'three/examples/jsm/controls/OrbitControls.js',
        ],
  },
  plugins: [react(), apiDevServerPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/react/')) return 'react';
          if (id.includes('/node_modules/scheduler/')) return 'react';
        },
      },
    },
  },
  };
});
