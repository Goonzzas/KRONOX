import { createServer } from 'vite';
import * as THREE from 'three';

/** CPU integration fixture. Real scene/Three objects and controls; no browser, GPU, image I/O or UI automation. */
export async function createSceneHarness({ sourceOverride = null, stateOverrides = {} } = {}) {
  const keys = [
    'window',
    'document',
    'innerWidth',
    'innerHeight',
    'devicePixelRatio',
    'addEventListener',
    'removeEventListener',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    '__KRONOX_SCENE_HARNESS__',
    'localStorage',
    'navigator',
    'MutationObserver',
  ];
  const prior = new Map(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const pending = new Map(),
    events = [],
    labels = [],
    renderers = [];
  let serial = 0,
    sceneApi;
  const listeners = new Map(),
    noop = () => {};
  const add = (name, handler) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    remove = (name, handler) => listeners.get(name)?.delete(handler);
  const gradient = () => ({ addColorStop: noop });
  function context(canvas) {
    return new Proxy(
      {
        canvas,
        createLinearGradient: gradient,
        createRadialGradient: gradient,
        createPattern: () => ({}),
        createImageData: (width, height) => ({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        }),
        getImageData: (x, y, width, height) => ({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        }),
        measureText: (text) => ({ width: String(text).length * 12 }),
        fillText: (text) => labels.push(String(text)),
      },
      {
        get: (target, key) => (key in target ? target[key] : noop),
        set: (target, key, value) => ((target[key] = value), true),
      },
    );
  }
  const document = {
    hidden: false,
    activeElement: null,
    addEventListener: add,
    removeEventListener: remove,
    documentElement: { classList: { toggle: noop } },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement(tag) {
      const element = {
        tagName: tag.toUpperCase(),
        width: 0,
        height: 0,
        style: {},
        ownerDocument: document,
        clientWidth: 1280,
        clientHeight: 800,
        addEventListener: add,
        removeEventListener: remove,
        setAttribute: noop,
        getRootNode: () => document,
        setPointerCapture: noop,
        releasePointerCapture: noop,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
      };
      let ctx;
      element.getContext = (kind) => {
        if (kind !== '2d') throw Error('CPU fixture supports 2D texture contexts only');
        return (ctx ??= context(element));
      };
      return element;
    },
  };
  document.body = {
    clientWidth: 1280,
    clientHeight: 800,
    addEventListener: add,
    removeEventListener: remove,
  };
  class Renderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      this.capabilities = { getMaxAnisotropy: () => 1 };
      this.info = {
        render: { calls: 0, triangles: 0, points: 0 },
        memory: { textures: 0, geometries: 0 },
      };
      this.renderLists = { dispose: noop };
      this.ratio = 1;
      renderers.push(this);
    }
    setPixelRatio(v) {
      this.ratio = v;
    }
    getPixelRatio() {
      return this.ratio;
    }
    setSize(w, h) {
      this.domElement.width = w;
      this.domElement.height = h;
    }
    render(scene, camera) {
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      this.scene = scene;
      this.camera = camera;
      this.info.render.calls++;
    }
    dispose() {
      this.disposed = true;
    }
  }
  class TextureLoader {
    load() {
      const texture = new THREE.Texture();
      texture.image = { width: 16, height: 16 };
      return texture;
    }
  }
  class Clock {
    constructor() {
      this.elapsedTime = 0;
    }
    getDelta() {
      this.elapsedTime += 1 / 30;
      return 1 / 30;
    }
    getElapsedTime() {
      return this.elapsedTime;
    }
  }
  const storage = new Map([['kronox-language', 'es']]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const values = {
    localStorage,
    navigator: { languages: ['es-CO'], language: 'es-CO' },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    document,
    window: {
      location: { search: '' },
      localStorage,
      setTimeout,
      clearTimeout,
      innerWidth: 1280,
      innerHeight: 800,
      matchMedia: () => ({ matches: false }),
      addEventListener: add,
      removeEventListener: remove,
    },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    addEventListener: add,
    removeEventListener: remove,
    requestAnimationFrame: (callback) => {
      const id = ++serial;
      pending.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => pending.delete(id),
    __KRONOX_SCENE_HARNESS__: { Renderer, TextureLoader, Clock },
  };
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const marker = '\0kronox-cpu-three';
  const server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [
      {
        name: 'cpu-scene-fixture',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === 'virtual:kronox-cpu-three') return marker;
        },
        load(id) {
          if (id === marker)
            return `export * from 'three';export const WebGLRenderer=globalThis.__KRONOX_SCENE_HARNESS__.Renderer;export const TextureLoader=globalThis.__KRONOX_SCENE_HARNESS__.TextureLoader;export const Clock=globalThis.__KRONOX_SCENE_HARNESS__.Clock;`;
        },
        transform(source, id) {
          if (id.replaceAll('\\', '/').endsWith('/src/scene/createScene.js'))
            return {
              code: (sourceOverride || source).replace(
                "import * as THREE from 'three';",
                "import * as THREE from 'virtual:kronox-cpu-three';",
              ),
              map: null,
            };
        },
      },
    ],
  });
  const state = {
    quality: 'performance',
    speed: { current: 0 },
    pause: { current: false },
    fl: { current: { orb: 1, lab: 0, ax: 0, vel: 0, gal: 0 } },
    reducedMotion: () => true,
    onSceneDirectorEvent: (name, payload, value) => events.push({ name, payload, value }),
    onAiTourNarrative: () => 'test-narrative',
    onNavigationScale: (context) => events.push({ name: 'scale', value: context }),
  };
  const setters = ['day', 'd', 'f', 'near', 'speedNotice', 'fr', 'fv', 'intro'];
  for (const key of setters) state[key] = noop;
  Object.assign(state, stateOverrides);
  const element = {
    children: [],
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
    },
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentNode = null;
    },
  };
  async function close() {
    sceneApi?.dispose();
    pending.clear();
    await server.close();
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  return {
    events,
    labels,
    renderers,
    element,
    server,
    async start() {
      const { setupScene } = await server.ssrLoadModule('/src/scene/createScene.js');
      sceneApi = setupScene(element, state);
      return sceneApi;
    },
    stepFrames(count) {
      for (let i = 0; i < count; i++) {
        const entry = pending.entries().next().value;
        if (!entry) throw Error('Scene stopped scheduling animation frames');
        pending.delete(entry[0]);
        entry[1](performance.now());
      }
    },
    close,
  };
}
