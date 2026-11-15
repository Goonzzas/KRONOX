import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';
import readline from 'readline';

const SPHEREX_VIZ_ROUTE_RE =
  /^(?:\/KRONOX)?(\/api\/(?:health|datasets|bundle|resolve|upload|embeddings_bundle|spherex_viz|irsa\/[a-zA-Z0-9_-]+|spherex\/[a-zA-Z0-9_-]+|hips\/[a-zA-Z0-9_-]+|catalog\/[a-zA-Z0-9_-]+|cube\/[a-zA-Z0-9_-]+)|\/spherex_(?:temporal|v2_interactive)_bundle\.json)(?:\?.*)?$/;

let pyWorker = null;
let pyReqSeq = 0;
const pyPending = new Map();

function invokePythonServerless(method, url, headers, bodyBuffer) {
  return new Promise((resolve, reject) => {
    if (!pyWorker || pyWorker.killed || pyWorker.exitCode !== null) {
      const scriptPath = path.resolve(process.cwd(), 'api', 'spherex_viz.py');
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      pyWorker = spawn(pyCmd, [scriptPath, '--stdio-worker'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'inherit'],
      });
      if (typeof pyWorker.unref === 'function') pyWorker.unref();
      const rl = readline.createInterface({ input: pyWorker.stdout });
      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line);
          const pending = pyPending.get(msg.id);
          if (pending) {
            pyPending.delete(msg.id);
            pending.resolve(msg);
          }
        } catch {
          // Ignore non-JSON lines
        }
      });
      pyWorker.on('error', (err) => {
        for (const [, p] of pyPending) p.reject(err);
        pyPending.clear();
        pyWorker = null;
      });
      pyWorker.on('exit', () => {
        for (const [, p] of pyPending) p.reject(new Error('Python serverless worker exited'));
        pyPending.clear();
        pyWorker = null;
      });
    }

    const id = ++pyReqSeq;
    pyPending.set(id, { resolve, reject });
    const payload = JSON.stringify({
      id,
      method,
      url,
      headers: headers || {},
      body_b64: bodyBuffer && bodyBuffer.length ? bodyBuffer.toString('base64') : '',
    });
    pyWorker.stdin.write(payload + '\n');
  });
}

function apiDevServerPlugin() {
  const handleApi = async (req, res, next, loadModule) => {
    const rawUrl = req.url || '';
    const vizMatch = rawUrl.match(SPHEREX_VIZ_ROUTE_RE);
    if (vizMatch) {
      try {
        let bodyBuf = Buffer.alloc(0);
        if (req.method === 'POST' && typeof req.on === 'function') {
          bodyBuf = await new Promise((resolve) => {
            const chunks = [];
            let total = 0;
            req.on('data', (chunk) => {
              const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
              if (total + b.length <= 25 * 1024 * 1024) {
                chunks.push(b);
                total += b.length;
              }
            });
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', () => resolve(Buffer.alloc(0)));
          });
        }
        const pyRes = await invokePythonServerless(req.method || 'GET', rawUrl, req.headers, bodyBuf);
        res.statusCode = pyRes.status || 200;
        for (const [k, v] of Object.entries(pyRes.headers || {})) {
          res.setHeader(k, v);
        }
        res.end(Buffer.from(pyRes.body_b64 || '', 'base64'));
      } catch (err) {
        console.error(`Local Python serverless error in ${rawUrl}:`, err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: err.message || 'Internal serverless error' }));
      }
      return;
    }

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
      // Connect treats 4-arg functions (req, res, next, loadModule) as error middleware; wrap as 3-arg.
      server.middlewares.use((req, res, next) => handleApi(req, res, next));
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
    'GEMINI_API_KEY_1',
    'GEMINI_API_KEY_2',
    'GEMINI_API_KEY_3',
    'GEMINI_API_KEY_4',
    'GEMINI_API_KEY_SECONDARY',
    'GEMINI_API_KEY_TERTIARY',
    'GEMINI_API_KEY_QUATERNARY',
    'GEMINI_API_KEY_5',
    'GEMINI_API_KEY_6',
    'GEMINI_API_KEY_7',
    'GEMINI_API_KEY_8',
    'GEMINI_API_KEY1',
    'GEMINI_API_KEY2',
    'GEMINI_API_KEY3',
    'GEMINI_API_KEY4',
    'GEMINI_API_KEY5',
    'GEMINI_API_KEY6',
    'GEMINI_API_KEY7',
    'GEMINI_API_KEY8',
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
