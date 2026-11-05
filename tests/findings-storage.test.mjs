import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFindingRecord,
  createFindingRecord,
  loadFindingsFromStorage,
  saveFindingsToStorage,
  deleteFindingFromStorage,
  FINDINGS_STORAGE_KEY,
} from '../src/utils/findingsStorage.js';

// Mock localStorage for Node test environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.window = {
  localStorage: new MockLocalStorage(),
};

test('Findings Storage - Validation: Description is mandatory', () => {
  assert.throws(
    () => {
      createFindingRecord({
        target: { key: 'barnard', name: 'Estrella de Barnard' },
        frame: { id: '2025W34_1B_0557_1', band: 'SPHEREx-D2' },
        description: '   ',
      });
    },
    { message: /descripción del hallazgo es obligatoria/i },
  );
});

test('Findings Storage - Validation: Frame is mandatory', () => {
  assert.throws(
    () => {
      createFindingRecord({
        target: { key: 'barnard', name: 'Estrella de Barnard' },
        frame: null,
        description: 'Cambio observado',
      });
    },
    { message: /se requiere al menos una observación/i },
  );
});

test('Findings Storage - Creation with WCS: Converts pixel to true celestial RA and Dec', () => {
  const mockGridToWorld = (col, row) => ({
    ra: 269.4500 + col * 0.001,
    dec: 4.7600 + row * 0.001,
  });

  const record = createFindingRecord({
    target: { key: 'barnard', name: 'Estrella de Barnard' },
    frame: { id: '2025W34_1B_0557_1', band: 'SPHEREx-D2', date: '2025-08-20T23:03:20Z' },
    compareFrame: { id: '2026W39_1A_0371_1', band: 'SPHEREx-D2', date: '2026-09-22T15:05:18Z' },
    marker: { xPercent: 50, yPercent: 50, pixelX: 150, pixelY: 150, pane: 'A' },
    description: 'Desplazamiento visible hacia el noreste',
    viewMode: 'sideBySide',
    diagnostics: {
      reprojected: {
        gridToWorld: mockGridToWorld,
      },
    },
    timeDeltaDays: 397.7,
  });

  assert.equal(record.targetKey, 'barnard');
  assert.equal(record.frameId1, '2025W34_1B_0557_1');
  assert.equal(record.frameId2, '2026W39_1A_0371_1');
  assert.equal(record.timeDeltaDays, 397.7);
  assert.equal(record.hasMarker, true);
  assert.ok(record.marker);
  assert.equal(record.marker.pixelX, 150);
  assert.equal(record.marker.pixelY, 150);
  assert.ok(Math.abs(record.marker.ra - 269.6000) < 1e-4);
  assert.ok(Math.abs(record.marker.dec - 4.9100) < 1e-4);
});

test('Findings Storage - Creation without WCS: Preserves pixels and never invents RA/Dec', () => {
  const record = createFindingRecord({
    target: { key: 'rw-aurigae', name: 'RW Aurigae' },
    frame: { id: '2025W36_1A_0095_1', band: 'SPHEREx-D1', date: '2025-09-01T10:05:15Z' },
    compareFrame: { id: '2026W37_1A_0524_1', band: 'SPHEREx-D1', date: '2026-09-09T21:43:11Z' },
    marker: { xPercent: 20, yPercent: 40, pixelX: 60, pixelY: 120, pane: 'both' },
    description: 'Variación de brillo sin calibración WCS',
    viewMode: 'differential',
    diagnostics: null, // No WCS
    timeDeltaDays: 373.5,
  });

  assert.equal(record.hasMarker, true);
  assert.equal(record.marker.pixelX, 60);
  assert.equal(record.marker.pixelY, 120);
  assert.equal(record.marker.ra, null); // Strictly null, NEVER invented
  assert.equal(record.marker.dec, null);
});

test('Findings Storage - Persistence & Deletion in localStorage', () => {
  window.localStorage.clear();

  const record1 = createFindingRecord({
    target: { key: 'barnard', name: 'Estrella de Barnard' },
    frame: { id: 'frame_1', band: 'SPHEREx-D2' },
    description: 'Primer hallazgo',
  });
  const record2 = createFindingRecord({
    target: { key: 'wise-0855', name: 'WISE 0855' },
    frame: { id: 'frame_2', band: 'SPHEREx-D6' },
    description: 'Segundo hallazgo',
  });

  const saved = saveFindingsToStorage([record1, record2]);
  assert.equal(saved, true);

  const loaded = loadFindingsFromStorage();
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].description, 'Primer hallazgo');
  assert.equal(loaded[1].description, 'Segundo hallazgo');

  const afterDelete = deleteFindingFromStorage(record1.id);
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, record2.id);

  const reloaded = loadFindingsFromStorage();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, record2.id);
});

test('Findings Storage - Normalization: Migrates legacy format gracefully', () => {
  const legacyItem = {
    id: 'legacy-123',
    target: 'Estrella de Barnard',
    note: 'Nota antigua sin targetKey',
    x: 45.5,
    y: 55.2,
    frameId: 'obs_old',
    previousDate: '2025-08-20',
    currentDate: '2026-09-22',
  };

  const normalized = normalizeFindingRecord(legacyItem, 0);
  assert.equal(normalized.id, 'legacy-123');
  assert.equal(normalized.targetName, 'Estrella de Barnard');
  assert.equal(normalized.description, 'Nota antigua sin targetKey');
  assert.equal(normalized.hasMarker, true);
  assert.equal(normalized.marker.xPercent, 45.5);
  assert.equal(normalized.marker.yPercent, 55.2);
  assert.equal(normalized.marker.ra, null);
});
