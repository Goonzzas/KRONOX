import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameAudio } from '../src/utils/gameAudio.js';

function createMockAudioContext() {
  const stats = {
    gains: [],
    oscillatorsCreated: 0,
    oscillatorsStopped: 0,
    bufferSourcesCreated: 0,
    bufferSourcesStopped: 0,
    resumed: 0,
    closed: 0,
  };

  function makeParam(initial = 0) {
    return {
      value: initial,
      setValueAtTime(v) {
        this.value = v;
      },
      setTargetAtTime(v) {
        this.value = v;
      },
      exponentialRampToValueAtTime(v) {
        this.value = v;
      },
    };
  }

  function connectible(extra = {}) {
    return {
      ...extra,
      connect(target) {
        return target;
      },
      disconnect() {},
    };
  }

  class MockAudioContext {
    constructor() {
      this.sampleRate = 44100;
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = connectible({ kind: 'destination' });
    }
    resume() {
      stats.resumed += 1;
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      stats.closed += 1;
      this.state = 'closed';
      return Promise.resolve();
    }
    createGain() {
      const node = connectible({ gain: makeParam(1) });
      stats.gains.push(node);
      return node;
    }
    createOscillator() {
      stats.oscillatorsCreated += 1;
      const osc = connectible({
        type: 'sine',
        frequency: makeParam(440),
        detune: makeParam(0),
        onended: null,
        start() {},
        stop() {
          stats.oscillatorsStopped += 1;
        },
      });
      return osc;
    }
    createBiquadFilter() {
      return connectible({
        type: 'lowpass',
        frequency: makeParam(500),
        Q: makeParam(1),
      });
    }
    createBuffer(channels, length) {
      const buffers = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        getChannelData(ch) {
          return buffers[ch] || buffers[0];
        },
      };
    }
    createBufferSource() {
      stats.bufferSourcesCreated += 1;
      return connectible({
        buffer: null,
        loop: false,
        onended: null,
        start() {},
        stop() {
          stats.bufferSourcesStopped += 1;
        },
      });
    }
    createConvolver() {
      return connectible({ buffer: null });
    }
    createDelay() {
      return connectible({ delayTime: makeParam(0.3) });
    }
    createDynamicsCompressor() {
      return connectible({
        threshold: makeParam(-14),
        knee: makeParam(18),
        ratio: makeParam(4),
        attack: makeParam(0.01),
        release: makeParam(0.2),
      });
    }
    createStereoPanner() {
      return connectible({ pan: makeParam(0) });
    }
  }

  return { MockAudioContext, stats };
}

test('createGameAudio returns null safely when AudioContext is missing', () => {
  const prevWindow = globalThis.window;
  globalThis.window = {};
  try {
    assert.equal(createGameAudio(), null);
  } finally {
    globalThis.window = prevWindow;
  }
});

test('independent music & sfx mix, intro suppression, speaking ducking, and zone moods behave deterministically', () => {
  const { MockAudioContext, stats } = createMockAudioContext();
  const audio = createGameAudio({ AudioContextClass: MockAudioContext });
  assert.ok(audio, 'createGameAudio should instantiate cleanly with MockAudioContext');

  audio.setMix({ master: 0.8, music: 0.5, sfx: 0.7 });
  audio.setEnabled(true);

  const initialSnap = audio.getStateSnapshot();
  assert.equal(initialSnap.enabled, true);
  assert.ok(Math.abs(initialSnap.musicMix - 0.4) < 1e-6);
  assert.ok(Math.abs(initialSnap.sfxMix - 0.56) < 1e-6);
  assert.ok(initialSnap.music.effectiveGain > 0.15, 'music gain should be audible in menu');
  assert.equal(initialSnap.music.mood, 'menu');

  // Intro soundtrack suppression zeroes procedural music cleanly and restores afterward
  audio.setMusicSuppressed(true);
  assert.equal(audio.getStateSnapshot().music.effectiveGain, 0);
  audio.setMusicSuppressed(false);
  const fullGain = audio.getStateSnapshot().music.effectiveGain;
  assert.ok(fullGain > 0.15, 'music resumes cleanly once intro ends');

  // Speaking ducks procedural music gain
  audio.setSpeaking(true);
  const duckedGain = audio.getStateSnapshot().music.effectiveGain;
  assert.ok(duckedGain > 0 && duckedGain < fullGain * 0.5, 'speaking should duck music smoothly');
  audio.setSpeaking(false);

  // Environment mood transitions across decks, bed rest, exterior, hyperspace, and SPHEREx science
  audio.setEnvironmentState({ zone: 'cabin', deckId: 'deck-01' });
  assert.equal(audio.getStateSnapshot().music.mood, 'bridge');

  audio.setEnvironmentState({ zone: 'cabin', deckId: 'deck-02' });
  assert.equal(audio.getStateSnapshot().music.mood, 'hab');

  audio.setEnvironmentState({ zone: 'cabin', deckId: 'deck-02', sleeping: true });
  assert.equal(audio.getStateSnapshot().music.mood, 'sleep');

  audio.setEnvironmentState({ zone: 'cabin', deckId: 'deck-03', sleeping: false });
  assert.equal(audio.getStateSnapshot().music.mood, 'lab');

  audio.setEnvironmentState({ zone: 'cabin', deckId: 'deck-04' });
  assert.equal(audio.getStateSnapshot().music.mood, 'eng');

  audio.setEnvironmentState({ zone: 'exterior', speed: 12, thrustActive: true });
  assert.equal(audio.getStateSnapshot().music.mood, 'exterior');

  audio.setEnvironmentState({ hyperspacePhase: 'HYPERSPACE_ENTRY' });
  assert.equal(audio.getStateSnapshot().music.mood, 'hyperspace');

  audio.setEnvironmentState({ hyperspacePhase: 'HYPERSPACE_EXIT' });
  assert.equal(audio.getStateSnapshot().music.mood, 'arrival');

  audio.setEnvironmentState({ hyperspacePhase: null, missionOpen: true });
  assert.equal(audio.getStateSnapshot().music.mood, 'science');

  audio.dispose();
  assert.equal(audio.getStateSnapshot().disposed, true);
  assert.ok(stats.oscillatorsStopped > 0, 'dispose must stop active oscillators');
  assert.equal(stats.closed, 1, 'dispose must close the AudioContext once');
});

test('all discrete SFX cues execute cleanly and vr-hover obeys anti-spam cooldown', () => {
  const { MockAudioContext, stats } = createMockAudioContext();
  const audio = createGameAudio({ AudioContextClass: MockAudioContext });
  audio.setEnabled(true);

  const cues = [
    'tap',
    'confirm',
    'interface-open',
    'interface-close',
    'switch',
    'door',
    'eva-airlock',
    'elevator-start',
    'elevator-arrive',
    'chime',
    'rest-start',
    'rest-nap',
    'rest-complete',
    'footstep',
    'pickup',
    'grab',
    'thruster',
    'travel',
    'hyperspace-entry',
    'hyperspace-exit',
    'arrival',
    'scan',
    'capture',
    'evidence-ok',
    'mission-complete',
    'achievement',
    'error',
    'alert',
    'vr-select',
  ];

  const beforeOsc = stats.oscillatorsCreated;
  for (const kind of cues) {
    audio.cue(kind);
  }
  assert.ok(
    stats.oscillatorsCreated > beforeOsc + cues.length,
    'each cue should synthesize at least one oscillator voice',
  );

  // Rapid burst of vr-hover should only fire once inside 68ms cooldown window
  const beforeHover = stats.oscillatorsCreated;
  audio.cue('vr-hover');
  audio.cue('vr-hover');
  audio.cue('vr-hover');
  assert.equal(stats.oscillatorsCreated - beforeHover, 1);

  audio.dispose();
  // Calling cue after dispose should be a safe no-op
  const afterDisposeOsc = stats.oscillatorsCreated;
  audio.cue('arrival');
  assert.equal(stats.oscillatorsCreated, afterDisposeOsc);
});
