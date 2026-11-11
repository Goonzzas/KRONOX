import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { resolveConfig } from 'vite';
function startup() {
  const html = fs.readFileSync('index.html', 'utf8'),
    script = html.match(/<script\s+id="kronox-startup-guard"\s*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const nodes = new Map(
      [...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [
        id,
        {
          hidden: id === 'kronox-startup-actions',
          textContent: '',
          attributes: { role: 'status' },
          handlers: {},
          setAttribute(k, v) {
            this.attributes[k] = v;
          },
          addEventListener(k, v) {
            this.handlers[k] = v;
          },
        },
      ]),
    ),
    timers = new Map(),
    listeners = new Map();
  let reloads = 0,
    id = 0;
  const window = {
    location: {
      reload() {
        reloads++;
      },
    },
    addEventListener(k, v) {
      listeners.set(k, v);
    },
    removeEventListener(k, v) {
      if (listeners.get(k) === v) listeners.delete(k);
    },
  };
  vm.runInNewContext(script, {
    window,
    document: { getElementById: (id) => nodes.get(id) },
    setTimeout(fn) {
      timers.set(++id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    window,
    nodes,
    timers,
    listeners,
    get reloads() {
      return reloads;
    },
  };
}
test('Module download failure before React mounts shows an error and working reload instead of an endless spinner', () => {
  const app = startup();
  app.window.__kronoxStartup.fail(Error('Failed to fetch React module'));
  assert.equal(app.nodes.get('kronox-startup').attributes.role, 'alert');
  assert.equal(app.nodes.get('kronox-startup-spinner').hidden, true);
  assert.equal(app.nodes.get('kronox-startup-actions').hidden, false);
  assert.match(app.nodes.get('kronox-startup-error').textContent, /React module/);
  assert.equal(app.timers.size, 0);
  app.nodes.get('kronox-startup-retry').handlers.click();
  assert.equal(app.reloads, 1);
});
test('A stalled startup has a finite timeout; a successful import cancels the guard and its error listeners', () => {
  const stalled = startup();
  [...stalled.timers.values()][0]();
  assert.match(stalled.nodes.get('kronox-startup-error').textContent, /12 segundos/);
  assert.equal(stalled.nodes.get('kronox-startup-actions').hidden, false);
  const ready = startup();
  ready.window.__kronoxStartup.ready();
  assert.equal(ready.timers.size, 0);
  assert.equal(ready.listeners.size, 0);
  ready.window.__kronoxStartup.fail(Error('unrelated later error'));
  assert.equal(ready.nodes.get('kronox-startup-actions').hidden, true);
});
test('Node test workers and a second dev process resolve isolated Vite dependency caches', async () => {
  const config = await resolveConfig({}, 'serve');
  assert.ok(config.cacheDir.replaceAll('\\', '/').includes('/.cache/vite/tests-' + process.pid));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {resolveConfig} from 'vite';const c=await resolveConfig({},'serve');console.log('CACHE='+c.cacheDir);console.log('CLIENT='+c.optimizeDeps.include.includes('react-dom/client'));",
    ],
    { cwd: process.cwd(), env, encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr);
  const cache = child.stdout.match(/CACHE=(.+)/)?.[1];
  assert.ok(cache);
  assert.notEqual(cache, config.cacheDir);
  assert.ok(cache.replaceAll('\\', '/').includes('/.cache/vite/runtime-'));
  assert.match(child.stdout, /CLIENT=true/);
});
