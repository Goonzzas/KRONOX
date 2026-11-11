import { parseFits } from './fitsImage.js';
import { restoreFitsFrame, wavelengthPlane } from './fitsTransport.js';
export async function decodeFits(buffer, range, center, options, { signal } = {}) {
  if (signal?.aborted) throw Error('Carga cancelada.');
  if (typeof Worker === 'undefined' || typeof document === 'undefined') {
    const f = parseFits(buffer, range, center, options);
    f.center = center;
    f.wavelengthPixels = wavelengthPlane(f);
    return f;
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/fitsWorker.js', import.meta.url), {
      type: 'module',
    });
    let timer,
      settled = false;
    const finish = (error, frame) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else {
        try {
          restoreFitsFrame(frame);
          const canvas = document.createElement('canvas');
          canvas.width = frame.width;
          canvas.height = frame.height;
          const ctx = canvas.getContext('2d');
          ctx.putImageData(new ImageData(frame.previewPixels, frame.width, frame.height), 0, 0);
          frame.src = canvas.toDataURL();
          delete frame.previewPixels;
          resolve(frame);
        } catch (e) {
          reject(e);
        }
      }
    };
    const abort = () => finish(Error('Carga cancelada.'));
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (e) => finish(e.data.error ? Error(e.data.error) : null, e.data.frame);
    worker.onerror = () =>
      finish(Error('No se pudo decodificar FITS en el trabajador. Reintenta.'));
    timer = setTimeout(() => finish(Error('El procesamiento FITS excedió 30 segundos.')), 30000);
    worker.postMessage({ buffer, range, center, options }, [buffer]);
  });
}
