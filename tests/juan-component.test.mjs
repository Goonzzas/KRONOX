import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

test('React mission component: real local observation, inspect, justify, save, closure and restore without Internet', async () => {
  const previous = {
    fetch: globalThis.fetch,
    window: globalThis.window,
    Worker: globalThis.Worker,
  };
  const storage = new Map();
  let requests = [];
  let render;
  globalThis.window = {
    location: { search: '' },
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
    },
  };
  globalThis.Worker = class {
    postMessage() {}
    terminate() {}
  };
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (!String(url).startsWith('/KRONOX/demo/'))
      throw Error('Network disabled; unexpected request ' + url);
    const relative = String(url).slice('/KRONOX/'.length);
    const bytes = fs.readFileSync('public/' + relative);
    return new Response(bytes, { headers: { 'Content-Type': 'application/fits' } });
  };
  const server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const { default: Mission } = await server.ssrLoadModule('/src/components/SpherexMission.jsx');
    await act(async () => {
      render = TestRenderer.create(
        React.createElement(Mission, {
          initialDataSource: 'local',
          initialTargetKey: 'm31',
          initialStage: 'summary',
          onClose() {},
        }),
      );
      await new Promise((r) => setTimeout(r, 80));
    });
    const text = () => JSON.stringify(render.toJSON());
    assert.ok(text().includes('Recorrido libre finalizado'), 'No false investigation completed');
    const innerText = (node) =>
      typeof node === 'string' ? node : (node.children || []).map(innerText).join('');
    function button(label) {
      const found = render.root.findAllByType('button').find((b) => innerText(b).includes(label));
      assert.ok(found, 'button ' + label);
      return found;
    }
    await act(async () => {
      button('Imágenes').props.onClick();
      await new Promise((r) => setTimeout(r, 30));
    });
    assert.ok(text().includes('Galería de imágenes reales por fecha'));
    assert.equal(
      render.root.findAll((n) => n.props.className === 'juanEvidenceLab').length,
      0,
      'Images precede analysis',
    );
    await act(async () => {
      button('Análisis espectral').props.onClick();
      await new Promise((r) => setTimeout(r, 60));
    });
    assert.ok(text().includes('Análisis espectral · de observar a justificar'));
    await act(async () => {
      await button('Cargar muestras disponibles').props.onClick();
    });
    assert.equal(
      render.root
        .findAllByType('button')
        .filter((b) =>
          b.children.some((c) => typeof c === 'string' && c.startsWith('Inspeccionar ')),
        ).length,
      3,
    );
    await act(async () => {
      button('Inspeccionar 1').props.onClick();
    });
    const select = render.root
      .findAllByType('select')
      .find((s) =>
        s.findAllByType('option').some((o) => o.children.includes('Evidencia insuficiente')),
      );
    await act(async () => {
      select.props.onChange({ target: { value: 'Evidencia insuficiente' } });
    });
    const textarea = render.root.findAllByType('textarea')[0];
    await act(async () => {
      textarea.props.onChange({
        target: {
          value:
            'Las 3 muestras pertenecen a distintas longitudes de onda; falta un par temporal compatible y una PSF común para demostrar variabilidad.',
        },
      });
    });
    await act(async () => {
      button('Guardar conclusión con evidencia').props.onClick();
    });
    const saved = JSON.parse(storage.get('kronox_findings_v1'));
    assert.equal(saved[0].conclusion, 'Evidencia insuficiente');
    assert.equal(saved[0].evidence.measurements.length, 3);
    await act(async () => {
      button('Cierre de misión').props.onClick();
    });
    assert.ok(text().includes('Investigación completada'));
    const savedDocument = globalThis.document,
      makeUrl = URL.createObjectURL,
      revokeUrl = URL.revokeObjectURL;
    let exported;
    globalThis.document = {
      createElement() {
        return { click() {} };
      },
    };
    URL.createObjectURL = (blob) => {
      exported = blob;
      return 'blob:local-test';
    };
    URL.revokeObjectURL = () => {};
    try {
      await act(async () => button('Exportar cuaderno (.CSV)').props.onClick());
      const csv = await exported.text();
      assert.ok(csv.includes('Evidencia insuficiente'));
      assert.ok(csv.includes('https://irsa.ipac.caltech.edu/'));
      assert.ok(csv.includes('Conclusión'));
    } finally {
      globalThis.document = savedDocument;
      URL.createObjectURL = makeUrl;
      URL.revokeObjectURL = revokeUrl;
    }

    await act(async () => render.unmount());
    await act(async () => {
      render = TestRenderer.create(
        React.createElement(Mission, {
          initialDataSource: 'local',
          initialTargetKey: 'm31',
          initialStage: 'summary',
          onClose() {},
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
    });
    assert.ok(text().includes('Observación y conclusión registradas'));
    assert.ok(requests.every((u) => u.startsWith('/KRONOX/demo/')));
  } finally {
    if (render) await act(async () => render.unmount());
    await server.close();
    globalThis.fetch = previous.fetch;
    globalThis.window = previous.window;
    globalThis.Worker = previous.Worker;
  }
});

test('A failed image selection clears the previous frame and shows its error instead of reusing another exposure', async () => {
  const previous = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    window: globalThis.window,
    Worker: globalThis.Worker,
  };
  let renderer;
  const server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    globalThis.window = {
      location: { search: '' },
      localStorage: { getItem: () => null, setItem() {} },
    };
    globalThis.Worker = undefined;
    globalThis.document = {
      createElement() {
        return {
          getContext() {
            return {
              createImageData: (width, height) => ({
                data: new Uint8ClampedArray(width * height * 4),
              }),
              putImageData() {},
              fillRect() {},
            };
          },
          toDataURL() {
            return 'data:image/png;base64,fixture';
          },
        };
      },
    };
    const { SPHEREX_TARGETS } = await server.ssrLoadModule('/src/data/spherexTargets.js'),
      target = SPHEREX_TARGETS.find((t) => t.key === 'm31'),
      bad = target.localRecords[1].localFile;
    globalThis.fetch = async (url) => {
      if (!String(url).startsWith('/KRONOX/demo/')) throw Error('Network disabled');
      if (String(url).endsWith(bad)) throw Error('Failed exposure fixture');
      const bytes = fs.readFileSync('public/' + String(url).slice('/KRONOX/'.length));
      return new Response(bytes);
    };
    const { default: Mission } = await server.ssrLoadModule('/src/components/SpherexMission.jsx');
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Mission, {
          initialDataSource: 'local',
          initialTargetKey: 'm31',
          initialStage: 'explore',
          onClose() {},
        }),
      );
      await new Promise((r) => setTimeout(r, 100));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const mainImages = () =>
      renderer.root
        .findAllByType('img')
        .filter((n) => String(n.props.className).includes('kronoxFitsImage'));
    assert.equal(mainImages().length, 1);
    await act(async () => {
      renderer.root
        .findAllByType('button')
        .filter((n) => String(n.props.className).includes('kronoxDateChip'))[1]
        .props.onClick();
      await new Promise((r) => setTimeout(r, 40));
    });
    assert.equal(mainImages().length, 0);
    assert.ok(JSON.stringify(renderer.toJSON()).includes('Failed exposure fixture'));
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await server.close();
    globalThis.document = previous.document;
    globalThis.fetch = previous.fetch;
    globalThis.window = previous.window;
    globalThis.Worker = previous.Worker;
  }
});
