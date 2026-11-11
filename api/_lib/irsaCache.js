import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
const inflight = new Map();
const root =
  process.env.VERCEL === '1'
    ? path.join(os.tmpdir(), 'kronox-cache', 'irsa-v2')
    : path.resolve(process.cwd(), '.cache', 'irsa-v2');
export async function cachedIrsaBytes(
  url,
  {
    ttlMs = 6 * 3600000,
    force = false,
    timeoutMs = 25000,
    maxBytes = 16 * 1024 * 1024,
    attempts = 3,
  } = {},
) {
  const key = crypto.createHash('sha256').update(String(url)).digest('hex'),
    file = path.join(root, key + '.bin');
  const enabled = !process.env.NODE_TEST_CONTEXT && process.env.KRONOX_CACHE !== 'off';
  if (enabled && !force) {
    try {
      const stat = await fs.stat(file);
      if (Date.now() - stat.mtimeMs < ttlMs)
        return { bytes: await fs.readFile(file), cached: true };
    } catch {}
  }
  if (inflight.has(key)) return inflight.get(key);
  const task = (async () => {
    let last;
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'User-Agent': 'Kronox-local-science/2' },
        });
        if (!response.ok) {
          const e = Error(`IRSA HTTP ${response.status}`);
          e.status = response.status;
          await response.body?.cancel();
          throw e;
        }
        const reader = response.body.getReader();
        let size = 0;
        const parts = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            throw Error('Respuesta IRSA demasiado grande: usa consultas por intervalos.');
          }
          parts.push(Buffer.from(value));
        }
        const bytes = Buffer.concat(parts);
        if (enabled) {
          try {
            await fs.mkdir(root, { recursive: true });
            await fs.writeFile(file, bytes);
            const files = (await fs.readdir(root)).filter((n) => /^[a-f0-9]{64}\.bin$/.test(n));
            let stats = await Promise.all(
              files.map(async (n) => ({
                file: path.join(root, n),
                ...(await fs.stat(path.join(root, n))),
              })),
            );
            let total = stats.reduce((s, f) => s + f.size, 0);
            for (const f of stats.sort((a, b) => a.mtimeMs - b.mtimeMs)) {
              if (total <= 192 * 1024 * 1024) break;
              if (f.file !== file && path.dirname(f.file) === root) {
                await fs.unlink(f.file);
                total -= f.size;
              }
            }
          } catch {
            // An ephemeral cache failure must never discard a successful IRSA response.
          }
        }
        return { bytes, cached: false };
      } catch (e) {
        last = e;
        if (e.status && e.status < 500 && e.status !== 429) break;
        if (i + 1 < attempts) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
      }
    }
    throw last;
  })();
  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}
