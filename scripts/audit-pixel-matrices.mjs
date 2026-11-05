import crypto from 'node:crypto';
import handler from '../api/spherex.js';
import { parseFits } from '../src/utils/fitsImage.js';
import { SPHEREX_TARGETS } from '../src/data/spherexTargets.js';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function hashFloatArray(arr) {
  const hash = crypto.createHash('sha256');
  let validCount = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  const sample = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      validCount++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (i % 500 === 0) sample.push(Number.isFinite(v) ? v.toFixed(4) : 'NaN');
  }
  hash.update(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
  return {
    sha: hash.digest('hex').slice(0, 16),
    validCount,
    mean: validCount > 0 ? (sum / validCount).toFixed(4) : 'N/A',
    min: Number.isFinite(min) ? min.toFixed(4) : 'N/A',
    max: Number.isFinite(max) ? max.toFixed(4) : 'N/A',
    sample: sample.slice(0, 5).join(','),
  };
}

async function getRecords(target) {
  const req = {
    method: 'GET',
    url: `/api/spherex?action=search&ra=${target.ra}&dec=${target.dec}&release=all`,
    query: { action: 'search', ra: String(target.ra), dec: String(target.dec), release: 'all' },
  };
  let data;
  const res = {
    setHeader: () => {},
    status: () => res,
    json: (d) => { data = d; },
  };
  await handler(req, res);
  const band = target.preferredBand;
  return data?.records?.filter((r) => !band || r.band === band) || [];
}

async function fetchFrame(url, centerRa, centerDec) {
  const req = {
    method: 'GET',
    url: `/api/spherex?action=frame&url=${encodeURIComponent(url)}&center=${centerRa},${centerDec}`,
    query: { action: 'frame', url, center: `${centerRa},${centerDec}` },
  };
  let buf;
  const res = {
    setHeader: () => {},
    status: (code) => {
      if (code >= 400) throw new Error(`HTTP ${code}`);
      return res;
    },
    send: (b) => { buf = b; },
  };
  await handler(req, res);
  return buf;
}

async function main() {
  console.log('=== AUDITORIA COMPLETA DE MATRICES DE PIXELES EN LOS 5 OBJETIVOS ===\n');

  for (const target of SPHEREX_TARGETS) {
    console.log(`\n================================================================`);
    console.log(`OBJETIVO: ${target.name} (${target.key}) | Banda: ${target.preferredBand}`);
    console.log(`Coordenadas: RA ${target.ra}°, Dec ${target.dec}°`);
    console.log(`================================================================`);

    const records = await getRecords(target);
    console.log(`Observaciones encontradas en ${target.preferredBand}: ${records.length}`);
    if (records.length < 2) {
      console.warn('Insuficientes observaciones para comparar.');
      continue;
    }

    // Pick 3 temporally separated observations: earliest (0), middle, latest (length - 1)
    const idxA = 0;
    const idxB = Math.floor(records.length / 2);
    const idxC = records.length - 1;

    const chosen = [
      { label: 'Obs A (Inicial)', record: records[idxA], index: idxA },
      { label: 'Obs B (Media)', record: records[idxB], index: idxB },
      { label: 'Obs C (Final)', record: records[idxC], index: idxC },
    ];

    const parsedResults = [];

    for (const item of chosen) {
      const r = item.record;
      const dateStr = new Date((Number(r.dateAvg || r.date) - 40587) * 86400000).toISOString();
      console.log(`\nDescargando ${item.label}:`);
      console.log(`  - FITS ID: ${r.id}`);
      console.log(`  - Fecha UTC: ${dateStr} (MJD ${r.dateAvg || r.date})`);
      console.log(`  - URL: ${r.url}`);

      const rawBuffer = await fetchFrame(r.url, target.ra, target.dec);
      const rawFitsHash = sha256(rawBuffer);
      console.log(`  - FITS descargado: ${rawBuffer.length} bytes | SHA256: ${rawFitsHash.slice(0, 16)}...`);

      // Parse and reproject to common target center
      const parsed = parseFits(rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.length), null, { ra: target.ra, dec: target.dec });
      const rawImgStats = hashFloatArray(parsed.rawImagePixels);
      const sciStats = hashFloatArray(parsed.scientificPixels);

      console.log(`  - HDU IMAGE bruta: ${parsed.rawWidth}x${parsed.rawHeight} | Válidos: ${rawImgStats.validCount} | SHA: ${rawImgStats.sha} | Media: ${rawImgStats.mean} [${rawImgStats.min}, ${rawImgStats.max}]`);
      console.log(`  - Reproyección WCS (${parsed.width}x${parsed.height}): Válidos: ${sciStats.validCount} | SHA: ${sciStats.sha} | Media: ${sciStats.mean} [${sciStats.min}, ${sciStats.max}]`);
      console.log(`  - MJD-AVG FITS Header: ${parsed.temporal?.mjdAvg ?? 'N/A'}`);

      parsedResults.push({
        item,
        rawFitsHash,
        rawImgStats,
        sciStats,
        parsed,
      });
    }

    // Cross-comparison
    console.log(`\n--- COMPARACION DE MATRICES (${target.name}) ---`);
    for (let i = 0; i < parsedResults.length; i++) {
      for (let j = i + 1; j < parsedResults.length; j++) {
        const p1 = parsedResults[i];
        const p2 = parsedResults[j];
        const dtDays = Math.abs(Number(p2.item.record.dateAvg || p2.item.record.date) - Number(p1.item.record.dateAvg || p1.item.record.date));

        const fitsIdentical = p1.rawFitsHash === p2.rawFitsHash;
        const rawPixelsIdentical = p1.rawImgStats.sha === p2.rawImgStats.sha;
        const reprojectedIdentical = p1.sciStats.sha === p2.sciStats.sha;

        // Calculate max absolute difference between scientific pixels
        const arr1 = p1.parsed.scientificPixels;
        const arr2 = p2.parsed.scientificPixels;
        let diffSum = 0;
        let comparedPixels = 0;
        let maxDiff = 0;
        for (let k = 0; k < arr1.length; k++) {
          const v1 = arr1[k];
          const v2 = arr2[k];
          if (Number.isFinite(v1) && Number.isFinite(v2)) {
            const d = Math.abs(v1 - v2);
            diffSum += d;
            if (d > maxDiff) maxDiff = d;
            comparedPixels++;
          }
        }
        const meanDiff = comparedPixels > 0 ? (diffSum / comparedPixels).toFixed(4) : 'N/A';

        console.log(`  * ${p1.item.label} vs ${p2.item.label}:`);
        console.log(`    - Separación temporal: ${dtDays.toFixed(1)} días (${(dtDays / 365.25).toFixed(2)} años)`);
        console.log(`    - ¿FITS idénticos?: ${fitsIdentical ? 'SI (ERROR)' : 'NO (Diferentes archivos)'}`);
        console.log(`    - ¿Píxeles brutos idénticos?: ${rawPixelsIdentical ? 'SI (ERROR)' : 'NO (Diferentes datos)'}`);
        console.log(`    - ¿Píxeles reproyectados idénticos?: ${reprojectedIdentical ? 'SI (ERROR)' : 'NO (Diferentes matrices)'}`);
        console.log(`    - Diferencia media de flujo |I2 - I1|: ${meanDiff} MJy/sr (max: ${maxDiff.toFixed(4)})`);
      }
    }
  }
}

main().catch(console.error);
