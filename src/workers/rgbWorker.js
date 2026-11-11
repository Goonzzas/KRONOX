import { composeRgb } from '../utils/rgbComposite.js';
self.onmessage = (e) => {
  try {
    const result = composeRgb(e.data);
    self.postMessage(result, [result.rgba.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
