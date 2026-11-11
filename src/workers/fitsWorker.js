import { parseFits } from '../utils/fitsImage.js';
import {
  plainFitsFrame,
  transferBuffers,
  wavelengthPlane,
  previewPixels,
} from '../utils/fitsTransport.js';
self.onmessage = ({ data }) => {
  try {
    const started = performance.now(),
      frame = parseFits(data.buffer, data.range, data.center, data.options);
    frame.center = data.center;
    frame.wavelengthPixels = wavelengthPlane(frame);
    frame.previewPixels = previewPixels(frame);
    frame.decodeMs = performance.now() - started;
    const result = plainFitsFrame(frame);
    self.postMessage({ frame: result }, transferBuffers(result));
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
