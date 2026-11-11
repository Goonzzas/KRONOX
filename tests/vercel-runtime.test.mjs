import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Vercel IRSA requests use temporary storage and survive a failed cache write', () => {
  const env = { ...process.env, VERCEL: '1' };
  delete env.NODE_TEST_CONTEXT;
  delete env.KRONOX_CACHE;
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import os from 'node:os';
    import path from 'node:path';
    let requests = 0, attemptedCache;
    globalThis.fetch = async () => { requests++; return new Response('verified IRSA data'); };
    fs.mkdir = async p => {
      attemptedCache = p;
      throw Object.assign(new Error('Read-only filesystem'), { code: 'EROFS' });
    };
    const { cachedIrsaBytes } = await import('./api/_lib/irsaCache.js');
    const result = await cachedIrsaBytes('https://irsa.ipac.caltech.edu/runtime-cache-regression', { force: true });
    assert.equal(result.bytes.toString(), 'verified IRSA data');
    assert.equal(result.cached, false);
    assert.equal(requests, 1, 'a cache failure must not retry a successful archive request');
    assert.equal(attemptedCache, path.join(os.tmpdir(), 'kronox-cache', 'irsa-v2'));
    console.log('Vercel cache regression passed');
  `,
    ],
    { cwd: process.cwd(), env, encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.match(child.stdout, /Vercel cache regression passed/);
});
