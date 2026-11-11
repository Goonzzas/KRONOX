import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
/** Fetch and LINK the served browser modules, without executing a browser, DOM or GPU. */
export async function checkClientModules(
  origin,
  {
    roots = [
      '/KRONOX/src/main.jsx',
      '/KRONOX/src/components/SpherexMission.jsx',
      '/KRONOX/src/bootstrap.js',
    ],
  } = {},
) {
  const modules = new Map(),
    checks = [];
  const getModule = (url) => {
    if (modules.has(url)) return modules.get(url);
    const pending = (async () => {
      const start = Date.now(),
        response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { Accept: '*/*', 'Sec-Fetch-Dest': 'script' },
        }),
        source = await response.text();
      checks.push({
        url,
        status: response.status,
        ms: Date.now() - start,
        bytes: source.length,
        type: response.headers.get('content-type'),
      });
      if (!response.ok) throw Error('HTTP ' + response.status + ' ' + url);
      if (!/javascript/.test(response.headers.get('content-type') || ''))
        throw Error('Not a JavaScript module: ' + url);
      return new vm.SourceTextModule(source, { identifier: url });
    })();
    modules.set(url, pending);
    return pending;
  };
  const linker = (specifier, ref) => getModule(new URL(specifier, ref.identifier).href);
  for (const root of roots) {
    const module = await getModule(new URL(root, origin).href);
    if (module.status === 'unlinked') await module.link(linker);
  }
  return { origin, passed: true, modules: modules.size, checks };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = [];
  for (const port of [5173, 5174]) {
    try {
      const result = await checkClientModules('http://127.0.0.1:' + port);
      results.push(result);
      console.log(port, result.modules, 'modules linked with all imports and exports resolved');
    } catch (error) {
      results.push({ port, passed: false, error: error.message });
      console.error(error.message);
      process.exitCode = 1;
    }
  }
  fs.writeFileSync(
    'docs/hotfix-loading-2026-11-07/client-modules.json',
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
  );
}
