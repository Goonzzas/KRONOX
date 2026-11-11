import { spectralCandidates } from '../utils/temporalObservations.js';
import { useEffect, useRef, useState } from 'react';
import { sampleAperture } from '../utils/scientificEvidence.js';
const FRAME_LIMIT = 18;
export function useObservationSamples({ target, frame, records, loadFits, radius, selection }) {
  const data = useRef(new Map()),
    images = useRef(new Map()),
    request = useRef(null),
    generation = useRef(0);
  const [samples, setSamples] = useState([]),
    [frames, setFrames] = useState([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [progress, setProgress] = useState({ done: 0, total: 0 });
  const publish = () => {
    setSamples([...data.current.values()]);
    setFrames([...images.current.values()]);
  };
  const add = (f) => {
    if (!f?.record?.url || (f.targetKey && f.targetKey !== target.key)) return;
    data.current.set(f.record.url, {
      record: f.record,
      measurement: sampleAperture(f, target, { radiusArcsec: radius, selection }),
    });
    images.current.delete(f.record.url);
    images.current.set(f.record.url, f);
    while (images.current.size > FRAME_LIMIT)
      images.current.delete(images.current.keys().next().value);
    publish();
  };
  useEffect(() => {
    generation.current++;
    request.current?.abort();
    data.current.clear();
    images.current.clear();
    setSamples([]);
    setFrames([]);
    setBusy(false);
    setStatus('');
    return () => request.current?.abort();
  }, [target.key, radius, selection?.ra, selection?.dec]);
  useEffect(() => {
    if (frame) add(frame);
  }, [frame, target.key, radius, selection?.ra, selection?.dec]);
  const loadBatch = async ({ limit = 6 } = {}) => {
    request.current?.abort();
    const controller = new AbortController(),
      current = ++generation.current;
    request.current = controller;
    const pending = spectralCandidates(records)
      .filter((r) => !data.current.has(r.url))
      .slice(0, limit);
    setBusy(true);
    setStatus('');
    setProgress({ done: 0, total: pending.length });
    let failed = 0;
    try {
      for (const [i, record] of pending.entries()) {
        try {
          const parsed = await loadFits(record, controller.signal);
          if (controller.signal.aborted || current !== generation.current) return;
          add({ ...parsed, record });
        } catch (e) {
          if (controller.signal.aborted) return;
          failed++;
          data.current.set(record.url, {
            record,
            measurement: {
              productId: record.productId || record.id,
              url: record.url,
              band: record.band,
              date: record.dateAvg || record.date,
              unit: null,
              flux: null,
              sigma: null,
              wave: null,
              bandwidth: null,
              valid: 0,
              total: 0,
              flags: 0,
              reason: 'Descarga o interpretación FITS fallida: ' + e.message,
            },
          });
          publish();
        }
        setProgress({ done: i + 1, total: pending.length });
      }
      setStatus(
        failed
          ? `${failed} productos fallaron; sus causas quedan en la tabla. Puedes reintentar.`
          : 'Lote procesado. Continúa con el siguiente para ampliar las mediciones.',
      );
    } finally {
      if (current === generation.current && !controller.signal.aborted) setBusy(false);
    }
  };
  const cancel = () => {
    generation.current++;
    request.current?.abort();
    setBusy(false);
    setStatus('Carga cancelada; se conservan las mediciones recibidas.');
  };
  const retry = () => {
    for (const [url, s] of data.current)
      if (s.measurement.reason?.startsWith('Descarga o interpretación')) data.current.delete(url);
    publish();
    setStatus('Productos fallidos habilitados para el siguiente lote.');
  };
  return {
    samples,
    frames,
    busy,
    status,
    progress,
    loadBatch,
    cancel,
    retry,
    remaining: spectralCandidates(records).filter((r) => !data.current.has(r.url)).length,
  };
}
