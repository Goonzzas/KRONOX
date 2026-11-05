import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pathToFileURL } from 'url';

function apiDevServerPlugin() {
  const handleApi = async (req, res, next) => {
    const rawUrl = req.url || '';
    const match = rawUrl.match(/(?:\/KRONOX)?\/api\/([a-zA-Z0-9_-]+)(?:\?.*)?$/);
    if (!match) return next();

    const endpoint = match[1];
    try {
      const fullPath = path.resolve(process.cwd(), 'api', `${endpoint}.js`);
      const { default: handler } = await import(pathToFileURL(fullPath).href);
      if (typeof handler !== 'function') return next();

      const parsedUrl = new URL(rawUrl, 'http://localhost');
      const query = Object.fromEntries(parsedUrl.searchParams.entries());

      const mockedReq = {
        method: req.method || 'GET',
        query,
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
      server.middlewares.use(handleApi);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApi);
    },
  };
}

export default defineConfig({
  base: process.env.VERCEL === '1' ? '/' : '/KRONOX/',
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
});
