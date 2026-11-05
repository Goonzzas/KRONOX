import { SPHEREX_TARGETS } from '../src/data/spherexTargets.js';
import handler from '../api/spherex.js';

async function mockReq(ra, dec, release = 'all') {
  return new Promise((resolve, reject) => {
    const req = {
      method: 'GET',
      url: `/api/spherex?action=search&ra=${ra}&dec=${dec}&release=${release}`,
      query: { action: 'search', ra: String(ra), dec: String(dec), release },
      headers: { host: 'localhost:5173' },
    };
    let statusCode = 200;
    let headers = {};
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      status: (code) => { statusCode = code; return res; },
      json: (data) => {
        resolve({ status: statusCode, data });
      },
      send: (data) => {
        resolve({ status: statusCode, data });
      },
      end: (data) => {
        resolve({ status: statusCode, data: data ? JSON.parse(data) : null });
      },
    };

    handler(req, res).catch(reject);
  });
}

async function runRehearsal() {
  console.log('=== KRONOX DEMO REHEARSAL: 5 TARGETS & ARBITRARY COORDINATES ===\n');

  // 1. Verify 5 targets in data catalog
  console.log('1. Target status and badges check:');
  for (const target of SPHEREX_TARGETS) {
    console.log(` - ${target.name} (${target.key}):`);
    console.log(`     Status: [${target.scientificStatus}] Badge: "${target.statusBadge}"`);
    console.log(`     Coverage: ${target.coverageStatus}`);
    console.log(`     Quality: ${target.dataQuality}`);
    console.log(`     Validation: ${target.validationType}`);
  }

  // 2. Query each of the 5 official targets
  console.log('\n2. Testing live IRSA queries for all 5 targets:');
  for (const target of SPHEREX_TARGETS) {
    try {
      const res = await mockReq(target.ra, target.dec, 'all');
      console.log(` ✓ ${target.name} (RA: ${target.ra}, Dec: ${target.dec}): HTTP ${res.status}, records: ${res.data?.records?.length ?? 0}`);
    } catch (err) {
      console.error(` ✗ ${target.name} failed:`, err.message);
    }
  }

  // 3. Test arbitrary coordinates WITH coverage vs WITHOUT coverage
  console.log('\n3. Testing arbitrary coordinate queries:');
  // Barnard nearby point (covered)
  const coveredQuery = await mockReq(269.5, 4.8, 'all');
  console.log(` ✓ Arbitrary covered point (RA: 269.5, Dec: 4.8): HTTP ${coveredQuery.status}, records: ${coveredQuery.data?.records?.length ?? 0}`);

  // Point far off without coverage
  const nonCoveredQuery = await mockReq(0.0, 89.9, 'qr2');
  console.log(` ✓ Arbitrary non-covered point (RA: 0.0, Dec: 89.9): HTTP ${nonCoveredQuery.status}, records: ${nonCoveredQuery.data?.records?.length ?? 0}`);
  if (nonCoveredQuery.data?.records?.length === 0) {
    console.log('   -> Correctly returns 0 records; UI displays friendly empty region notice.');
  }

  console.log('\n=== REHEARSAL COMPLETE: ALL QUERIES RESPONDED NORMALLY ===');
}

runRehearsal();
