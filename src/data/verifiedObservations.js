import { LOCAL_OBSERVATIONS } from './localObservations.js';
import { M101_OBSERVATIONS } from './m101Observations.js';
import { TEMPORAL_OBSERVATIONS } from './temporalObservationsData.js';
// Deduplicate products by their archive URL, never reuse an image between targets.
export const VERIFIED_OBSERVATIONS = {
  ...LOCAL_OBSERVATIONS,
  version: 'real-temporal-v3',
  targets: [...LOCAL_OBSERVATIONS.targets, M101_OBSERVATIONS].map((target) => {
    const temporal = TEMPORAL_OBSERVATIONS.targets.find((entry) => entry.key === target.key);
    const records = new Map(target.records.map((record) => [record.url, record]));
    for (const record of temporal?.records || []) records.set(record.url, record);
    const pair = temporal?.bestPair;
    const temporalPair = pair
      ? {
          ...pair,
          measurements:
            Number(pair.measurements[0].date) <= Number(pair.measurements[1].date)
              ? pair.measurements
              : [...pair.measurements].reverse(),
          a:
            Number(pair.measurements[0].date) <= Number(pair.measurements[1].date)
              ? pair.a
              : pair.b,
          b:
            Number(pair.measurements[0].date) <= Number(pair.measurements[1].date)
              ? pair.b
              : pair.a,
        }
      : null;
    return {
      ...target,
      records: [...records.values()].sort(
        (a, b) => Number(a.dateAvg || a.date) - Number(b.dateAvg || b.date),
      ),
      temporalPair,
    };
  }),
};
