import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

function invokePyBatch(requests) {
  const stdinLines = requests
    .map((req, idx) => {
      const bodyBytes = req.body !== undefined && req.body !== null
        ? Buffer.from(JSON.stringify(req.body), 'utf8')
        : Buffer.alloc(0);
      return JSON.stringify({
        id: idx + 1,
        method: req.method || 'GET',
        url: req.url,
        headers: req.body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body_b64: bodyBytes.toString('base64'),
      });
    })
    .join('\n') + '\n';

  const stdout = execFileSync(PYTHON_CMD, [path.join(ROOT, 'api', 'spherex_viz.py'), '--stdio-worker'], {
    cwd: ROOT,
    env: { ...process.env, VERCEL: '1', PYTHONUNBUFFERED: '1' },
    input: stdinLines,
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
    timeout: 30000,
  });

  return stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const msg = JSON.parse(line);
      const raw = Buffer.from(msg.body_b64 || '', 'base64').toString('utf8');
      return {
        status: msg.status,
        headers: msg.headers,
        body: raw ? JSON.parse(raw) : null,
      };
    });
}

function buildMinimalFitsBase64() {
  const card = (text) => text.padEnd(80, ' ');
  const cards = [
    card('SIMPLE  =                    T / Minimal valid FITS'),
    card('BITPIX  =                  -32 / 32-bit floating point'),
    card('NAXIS   =                    2 / 2D image'),
    card('NAXIS1  =                    4 / Width'),
    card('NAXIS2  =                    4 / Height'),
    card("CTYPE1  = 'RA---TAN'           / Coordinate type"),
    card("CTYPE2  = 'DEC--TAN'           / Coordinate type"),
    card('CRVAL1  =             83.82210 / RA deg'),
    card('CRVAL2  =             -5.39110 / Dec deg'),
    card('CRPIX1  =                  2.5 / Ref pixel X'),
    card('CRPIX2  =                  2.5 / Ref pixel Y'),
    card('CDELT1  =       -0.00172222222 / Deg/px'),
    card('CDELT2  =        0.00172222222 / Deg/px'),
    card('WAVELEN =                 1.50 / Wavelength um'),
    card('END'),
  ];
  const headerStr = cards.join('');
  const headerPad = Math.ceil(headerStr.length / 2880) * 2880;
  const headerBuf = Buffer.from(headerStr.padEnd(headerPad, ' '), 'ascii');

  const pixels = new Float32Array(16);
  for (let i = 0; i < 16; i++) pixels[i] = (i + 1) * 0.25;
  const dataBuf = Buffer.alloc(2880);
  for (let i = 0; i < 16; i++) {
    dataBuf.writeFloatBE(pixels[i], i * 4);
  }
  return Buffer.concat([headerBuf, dataBuf]).toString('base64');
}

test('Vercel configuration maps all SphereX visualizer routes to api/spherex_viz.py', async () => {
  const vercelRaw = await fs.readFile(path.join(ROOT, 'vercel.json'), 'utf8');
  const vercelCfg = JSON.parse(vercelRaw);

  assert.ok(vercelCfg.functions?.['api/spherex_viz.py'], 'api/spherex_viz.py must be configured in vercel.json');
  const rewrites = vercelCfg.rewrites || [];
  const requiredRoutes = [
    '/api/health',
    '/api/datasets',
    '/api/bundle',
    '/api/resolve',
    '/api/upload',
    '/api/embeddings_bundle',
    '/api/irsa/search',
    '/api/irsa/fetch',
    '/api/spherex/refresh',
    '/api/spherex/region_stats',
    '/api/spherex/fetch_target',
    '/api/hips/properties',
    '/api/hips/tile',
    '/api/catalog/overlay',
    '/api/cube/inspect',
  ];
  for (const route of requiredRoutes) {
    const found = rewrites.some((r) => r.source === route && r.destination.includes('/api/spherex_viz'));
    assert.ok(found, `Missing Vercel rewrite for ${route}`);
  }

  const vercelIgnoreRaw = await fs.readFile(path.join(ROOT, '.vercelignore'), 'utf8');
  const ignoredLines = vercelIgnoreRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  assert.equal(
    ignoredLines.some((line) => line.includes('SphereX-Visualizations-main/static')),
    false,
    '.vercelignore must not exclude SphereX-Visualizations-main/static needed by Vite and Vercel includeFiles',
  );
  assert.equal(
    ignoredLines.some((line) => line.includes('SphereX-Visualizations-main/SPHEREx_DR1_QR3')),
    false,
    '.vercelignore must not exclude SphereX-Visualizations-main/SPHEREx_DR1_QR3 needed by Vercel includeFiles',
  );
});

test('Python serverless handler serves real datasets, bundles, resolve, stats, and FITS upload under VERCEL=1', () => {
  const [health, datasets, bundle55, bundleM101, resolve, upload] = invokePyBatch([
    { method: 'GET', url: '/api/health' },
    { method: 'GET', url: '/api/datasets' },
    { method: 'GET', url: '/api/bundle?dataset_id=spx_ngc_55' },
    { method: 'GET', url: '/api/bundle?dataset_id=kronox_real_m101' },
    { method: 'GET', url: '/api/resolve?q=M42' },
    {
      method: 'POST',
      url: '/api/upload',
      body: {
        filename: 'test_cutout.fits',
        content_b64: buildMinimalFitsBase64(),
      },
    },
  ]);

  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.runtime, 'vercel-serverless');

  assert.equal(datasets.status, 200);
  assert.equal(datasets.body.ok, true);
  assert.ok(datasets.body.datasets.length >= 6, 'Should include SPHEREx_REAL and KRONOX public/demo real suites');
  assert.ok(
    datasets.body.datasets.some((d) => d.id === 'spx_ngc_55'),
    'Bundled SPHEREx_REAL ngc_55 suite must be present',
  );
  assert.ok(
    datasets.body.datasets.some((d) => d.id === 'kronox_real_m101'),
    'Real KRONOX public/demo M101 FITS suite must be registered',
  );

  assert.equal(bundle55.status, 200);
  assert.equal(bundle55.body.ok, true);
  assert.ok(Object.keys(bundle55.body.planes).length >= 6);

  assert.equal(bundleM101.status, 200);
  assert.equal(bundleM101.body.ok, true);
  assert.ok(Object.keys(bundleM101.body.planes).length >= 4);

  assert.equal(resolve.status, 200);
  assert.equal(resolve.body.ok, true);
  assert.ok(Math.abs(resolve.body.ra - 83.8221) < 0.05);

  assert.equal(upload.status, 200);
  assert.equal(upload.body.ok, true);
  assert.ok(upload.body.dataset_id, 'Upload should return dataset_id');
  assert.ok(upload.body.planes && Object.keys(upload.body.planes).length >= 1, 'Upload should inline planes for stateless serverless clients');
});

test('Frontend New Observatory integration embeds visualizer natively without iframes or localhost fallbacks', async () => {
  const explorerJsx = await fs.readFile(path.join(ROOT, 'src', 'components', 'SphereXAdvancedExplorer.jsx'), 'utf8');
  assert.equal(/<iframe\b/i.test(explorerJsx), false, 'SphereXAdvancedExplorer must not render an <iframe>');
  assert.match(explorerJsx, /kronoxNativeVisorRoot/);
  assert.match(explorerJsx, /__kronoxVisorFocusRegion/);

  const visorHtml = await fs.readFile(path.join(ROOT, 'SphereX-Visualizations-main', 'kronox_visor_cientifico.html'), 'utf8');
  assert.equal(/127\.0\.0\.1:876[56]|localhost:876[56]/.test(visorHtml), false, 'Visor HTML must not depend on localhost:8765/8766');
  assert.equal(/window\.open\(/.test(visorHtml), false, 'Visor HTML must not pop out into external windows');
  assert.match(visorHtml, /let SERVER_BASE = ''/);
  assert.match(visorHtml, /\/api\/upload/);
  assert.match(visorHtml, /\/api\/embeddings_bundle\?type=temporal/);

  const skyHtml = await fs.readFile(path.join(ROOT, 'SphereX-Visualizations-main', 'kronox_cielo_inmersivo.html'), 'utf8');
  assert.equal(/127\.0\.0\.1:876[56]|localhost:876[56]/.test(skyHtml), false, 'Inmersive sky HTML must not depend on localhost:8765/8766');
});

test('Vite dev server serves /api/datasets and /api/bundle directly through api/spherex_viz.py bridge', async () => {
  const port = 43123;
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(
    process.execPath,
    [viteBin, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Vite dev server timeout')), 15000);
      const onData = (chunk) => {
        const text = String(chunk);
        if (text.includes('43123') || text.includes('ready in')) {
          clearTimeout(timer);
          resolve();
        }
      };
      server.stdout.on('data', onData);
      server.stderr.on('data', onData);
      server.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const dsRes = await fetch(`http://127.0.0.1:${port}/api/datasets`);
    assert.equal(dsRes.status, 200);
    const dsJson = await dsRes.json();
    assert.equal(dsJson.ok, true);
    assert.ok(dsJson.datasets.some((d) => d.id === 'spx_ngc_55'));

    const bRes = await fetch(`http://127.0.0.1:${port}/api/bundle?dataset_id=spx_ngc_55`);
    assert.equal(bRes.status, 200);
    const bJson = await bRes.json();
    assert.equal(bJson.ok, true);
    assert.ok(Object.keys(bJson.planes).length >= 6);
  } finally {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {}
    } else {
      server.kill('SIGTERM');
    }
  }
});
