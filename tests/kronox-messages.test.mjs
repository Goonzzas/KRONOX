import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNarrativeMessage, NarrativeQueue } from '../src/state/kronoxMessages.ts';

test('narrative queue is idempotent, priority ordered, pausable, and repeatable', () => {
  const queue = new NarrativeQueue();
  const first = createNarrativeMessage('Welcome', { id: 'welcome', once: true });
  assert.equal(queue.enqueue(first), true);
  assert.equal(queue.enqueue(first), false);
  const low = createNarrativeMessage('Low priority', { id: 'low', priority: 1 });
  const high = createNarrativeMessage('High priority', { id: 'high', priority: 5 });
  queue.enqueue(low);
  queue.enqueue(high);
  assert.equal(queue.getSnapshot()?.id, 'welcome');
  assert.equal(queue.repeat()?.id, 'welcome');
  queue.pause();
  queue.complete('welcome');
  assert.equal(queue.getSnapshot()?.id, 'welcome');
  queue.resume();
  queue.complete('welcome');
  assert.equal(queue.getSnapshot()?.id, 'high');
  queue.complete('high');
  assert.equal(queue.getSnapshot()?.id, 'low');
});

test('dialogue component accepts only the narrative channel and technical phrases stay out of it', async () => {
  const widget = await readFile(new URL('../src/components/KronoxWidget.tsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const director = await readFile(new URL('../src/scene/kronoxSceneDirector.js', import.meta.url), 'utf8');
  assert.match(widget, /narrative:\s*NarrativeMessage\s*\|\s*null/);
  assert.match(app, /narrative:\s*guide/);
  assert.doesNotMatch(widget, /guide\s*[,}:]/);
  const forbidden = /entrando a cabina|personaje|1[.,]70|inicializando|cargando modelo|coordenadas internas|interpolaci[oó]n espacial suavizada|coordenadas ICRS J2025\.8/i;
  assert.doesNotMatch(app, forbidden);
  assert.doesNotMatch(director, forbidden);
});

test('guided tour advances through world events and can release into free exploration', async () => {
  const scene = await readFile(new URL('../src/scene/createScene.js', import.meta.url), 'utf8');
  const shipWorld = await readFile(new URL('../src/scene/habitableShipWorld.js', import.meta.url), 'utf8');
  assert.match(scene, /onGuidedNarrativeComplete/);
  assert.match(scene, /onGuidedStationInteraction/);
  assert.match(scene, /onGuidedScienceAction/);
  assert.match(scene, /endGuidedCabinTour/);
  assert.doesNotMatch(scene, /guidedTourState\.timer/);
  assert.match(shipWorld, /guidedTargetId/);
});
