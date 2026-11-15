/**
 * Motor procedural de música espacial adaptativa para KRONOX.
 * Genera colchones armónicos en estéreo, sub-graves cálidos y destellos melódicos
 * orgánicos adaptados al estado de la misión, cubierta y vuelo, sin assets externos.
 */

const MOOD_PROFILES = {
  menu: {
    stepMs: 4600,
    cutoffHz: 920,
    padLevel: 0.44,
    melodyChance: 0.65,
    chords: [
      [73.42, 110.0, 164.81, 220.0, 293.66], // Dadd9
      [55.0, 110.0, 164.81, 207.65, 246.94], // A(add11)/A
      [65.41, 98.0, 146.83, 196.0, 246.94],  // Cmaj9
      [58.27, 87.31, 130.81, 174.61, 220.0], // Bbmaj7#11 feel warm
    ],
    scaleHz: [293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25],
  },
  bridge: {
    stepMs: 4800,
    cutoffHz: 760,
    padLevel: 0.36,
    melodyChance: 0.48,
    chords: [
      [65.41, 98.0, 146.83, 196.0, 233.08],  // Cm9 / warm focus
      [58.27, 87.31, 130.81, 196.0, 261.63], // F/Bb
      [55.0, 110.0, 164.81, 196.0, 261.63],  // Am7
      [61.74, 98.0, 146.83, 196.0, 246.94],  // G/B
    ],
    scaleHz: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33],
  },
  hab: {
    stepMs: 5100,
    cutoffHz: 680,
    padLevel: 0.35,
    melodyChance: 0.55,
    chords: [
      [65.41, 130.81, 164.81, 196.0, 246.94], // Cmaj7 cozy
      [55.0, 110.0, 146.83, 196.0, 261.63],   // Am9
      [87.31, 130.81, 164.81, 220.0, 261.63], // Fmaj7
      [73.42, 110.0, 146.83, 196.0, 246.94],  // Dm11
    ],
    scaleHz: [261.63, 293.66, 329.63, 392.0, 440.0, 493.88, 523.25],
  },
  lab: {
    stepMs: 4200,
    cutoffHz: 1120,
    padLevel: 0.36,
    melodyChance: 0.72,
    chords: [
      [82.41, 123.47, 164.81, 246.94, 311.13], // Emaj7 crystalline
      [69.3, 103.83, 164.81, 220.0, 277.18],   // C#m9
      [73.42, 110.0, 164.81, 220.0, 277.18],   // Dmaj9#11
      [61.74, 123.47, 185.0, 246.94, 293.66],  // Bm11
    ],
    scaleHz: [329.63, 369.99, 440.0, 493.88, 554.37, 659.25, 739.99],
  },
  eng: {
    stepMs: 5400,
    cutoffHz: 520,
    padLevel: 0.4,
    melodyChance: 0.28,
    chords: [
      [49.0, 98.0, 146.83, 196.0, 220.0], // Gsus2 deep reactor
      [43.65, 87.31, 130.81, 174.61, 220.0], // Fsus2/Fmaj9
      [55.0, 110.0, 146.83, 196.0, 220.0],   // Asus4
      [49.0, 73.42, 110.0, 146.83, 196.0],   // G6/D
    ],
    scaleHz: [196.0, 220.0, 261.63, 293.66, 329.63, 392.0],
  },
  exterior: {
    stepMs: 4500,
    cutoffHz: 1050,
    padLevel: 0.46,
    melodyChance: 0.7,
    chords: [
      [65.41, 98.0, 146.83, 196.0, 293.66],  // Csus2/9 vast orbit
      [55.0, 82.41, 130.81, 196.0, 246.94],  // Am9
      [73.42, 110.0, 164.81, 220.0, 329.63], // D9sus4
      [87.31, 130.81, 174.61, 246.94, 329.63], // Fmaj7#11
    ],
    scaleHz: [261.63, 293.66, 329.63, 392.0, 493.88, 587.33, 659.25],
  },
  hyperspace: {
    stepMs: 1850,
    cutoffHz: 1650,
    padLevel: 0.52,
    melodyChance: 0.92,
    chords: [
      [73.42, 110.0, 146.83, 220.0, 329.63],
      [82.41, 123.47, 164.81, 246.94, 369.99],
      [98.0, 146.83, 196.0, 293.66, 440.0],
      [87.31, 130.81, 174.61, 261.63, 392.0],
    ],
    scaleHz: [293.66, 369.99, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0],
  },
  science: {
    stepMs: 4100,
    cutoffHz: 1180,
    padLevel: 0.38,
    melodyChance: 0.76,
    chords: [
      [69.3, 103.83, 155.56, 220.0, 311.13],
      [65.41, 98.0, 146.83, 207.65, 293.66],
      [58.27, 87.31, 130.81, 196.0, 261.63],
      [73.42, 110.0, 164.81, 246.94, 329.63],
    ],
    scaleHz: [311.13, 349.23, 392.0, 466.16, 523.25, 622.25, 783.99],
  },
  arrival: {
    stepMs: 3600,
    cutoffHz: 1320,
    padLevel: 0.5,
    melodyChance: 0.85,
    chords: [
      [65.41, 130.81, 164.81, 196.0, 293.66],
      [73.42, 146.83, 185.0, 220.0, 329.63],
    ],
    scaleHz: [329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99],
  },
  sleep: {
    stepMs: 6200,
    cutoffHz: 390,
    padLevel: 0.32,
    melodyChance: 0.22,
    chords: [
      [55.0, 110.0, 164.81, 196.0, 246.94],
      [51.91, 103.83, 155.56, 196.0, 233.08],
      [49.0, 98.0, 146.83, 174.61, 220.0],
    ],
    scaleHz: [220.0, 246.94, 293.66, 329.63, 392.0],
  },
};

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function setParamSmooth(param, value, now, tc = 0.25) {
  if (!param) return;
  if (typeof param.setTargetAtTime === 'function') {
    param.setTargetAtTime(value, now, tc);
  } else {
    param.value = value;
  }
}

export function createCosmicMusicEngine({ context, destination, reverbSend = null } = {}) {
  if (!context || !destination || typeof context.createGain !== 'function') {
    return null;
  }

  let disposed = false;
  let enabled = false;
  let mixVolume = 0.32;
  let suppressed = false; // true mientras suena intro-score.mp3
  let speaking = false;
  let paused = false;
  let mood = 'menu';
  let chordIndex = 0;
  let noteStep = 0;
  let schedulerTimer = null;
  let arrivalLockUntil = 0;

  // Bus principal de música -> destino y envío opcional a reverberación espacial
  const busGain = context.createGain();
  busGain.gain.value = 0;
  busGain.connect(destination);
  if (reverbSend) {
    const reverbTap = context.createGain();
    reverbTap.gain.value = 0.34;
    busGain.connect(reverbTap);
    reverbTap.connect(reverbSend);
  }

  // Filtro maestro respiratorio para colchones cálidos
  const padFilter =
    typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
  const padOutGain = context.createGain();
  padOutGain.gain.value = 0.42;
  if (padFilter) {
    padFilter.type = 'lowpass';
    padFilter.frequency.value = MOOD_PROFILES.menu.cutoffHz;
    padFilter.Q.value = 0.7;
    padFilter.connect(padOutGain);
  }
  padOutGain.connect(busGain);

  // LFO lento sobre filtro del colchón para movimiento vivo no estático
  let filterLfo = null;
  let filterLfoGain = null;
  if (padFilter && typeof context.createOscillator === 'function') {
    try {
      filterLfo = context.createOscillator();
      filterLfoGain = context.createGain();
      filterLfo.type = 'sine';
      filterLfo.frequency.value = 0.085;
      filterLfoGain.gain.value = 140;
      filterLfo.connect(filterLfoGain).connect(padFilter.frequency);
      filterLfo.start();
    } catch {
      filterLfo = null;
    }
  }

  // Bus estéreo de eco sutil para notas melódicas espaciales
  const motifBus = context.createGain();
  motifBus.gain.value = 0.34;
  motifBus.connect(busGain);
  if (typeof context.createDelay === 'function' && typeof context.createBiquadFilter === 'function') {
    try {
      const delayL = context.createDelay(2.0);
      const delayR = context.createDelay(2.0);
      const fbL = context.createGain();
      const fbR = context.createGain();
      const dampFilter = context.createBiquadFilter();
      delayL.delayTime.value = 0.42;
      delayR.delayTime.value = 0.63;
      fbL.gain.value = 0.28;
      fbR.gain.value = 0.26;
      dampFilter.type = 'lowpass';
      dampFilter.frequency.value = 1750;

      motifBus.connect(delayL);
      motifBus.connect(delayR);
      delayL.connect(dampFilter);
      delayR.connect(dampFilter);
      delayL.connect(fbR).connect(delayR);
      delayR.connect(fbL).connect(delayL);
      dampFilter.connect(busGain);
    } catch {
      // Echo fallback stays dry -> busGain
    }
  }

  // Voces continuas de colchón armónico (cero fugas de nodos en ciclos largos)
  const initialChord = MOOD_PROFILES.menu.chords[0];
  const padVoices = initialChord.map((freq, idx) => {
    const oscA = context.createOscillator();
    const oscB = context.createOscillator();
    const voiceGain = context.createGain();
    oscA.type = idx === 0 ? 'sine' : idx % 2 === 1 ? 'triangle' : 'sine';
    oscB.type = 'triangle';
    oscA.frequency.value = freq;
    oscB.frequency.value = freq;
    if (oscA.detune) oscA.detune.value = idx === 0 ? 0 : (idx - 2) * 3.2;
    if (oscB.detune) oscB.detune.value = idx === 0 ? 4.0 : (2 - idx) * 4.5 + 5.5;
    voiceGain.gain.value = idx === 0 ? 0.28 : idx < 3 ? 0.16 : 0.11;

    let panNode = null;
    if (typeof context.createStereoPanner === 'function' && idx > 0) {
      try {
        panNode = context.createStereoPanner();
        panNode.pan.value = (idx % 2 === 0 ? 1 : -1) * Math.min(0.45, idx * 0.12);
      } catch {
        panNode = null;
      }
    }

    const targetNode = padFilter || padOutGain;
    if (panNode) {
      oscA.connect(voiceGain);
      oscB.connect(voiceGain);
      voiceGain.connect(panNode).connect(targetNode);
    } else {
      oscA.connect(voiceGain);
      oscB.connect(voiceGain);
      voiceGain.connect(targetNode);
    }
    oscA.start();
    oscB.start();
    return { oscA, oscB, voiceGain };
  });

  function computeEffectiveTargetGain() {
    if (!enabled || suppressed || mixVolume <= 0.004) return 0;
    let factor = 1.0;
    if (speaking) factor *= 0.34;
    if (paused) factor *= 0.52;
    return clamp01(mixVolume * factor * 0.56);
  }

  function updateMasterGain(tc = 0.55) {
    if (disposed) return;
    const now = context.currentTime || 0;
    setParamSmooth(busGain.gain, computeEffectiveTargetGain(), now, tc);
  }

  function applyChord(profile, idx, glideSec = 1.15) {
    if (disposed || !profile) return;
    const now = context.currentTime || 0;
    const chord = profile.chords[idx % profile.chords.length] || initialChord;
    padVoices.forEach((voice, vIdx) => {
      const targetFreq = chord[vIdx % chord.length];
      setParamSmooth(voice.oscA.frequency, targetFreq, now, glideSec);
      setParamSmooth(voice.oscB.frequency, targetFreq, now, glideSec * 1.12);
    });
    if (padFilter) {
      setParamSmooth(padFilter.frequency, profile.cutoffHz, now, glideSec * 0.9);
    }
    setParamSmooth(padOutGain.gain, profile.padLevel, now, 0.8);
  }

  function playSparkleNote(freq, duration = 2.6, gainLevel = 0.14, panValue = 0) {
    if (disposed || context.state === 'suspended') return;
    if (computeEffectiveTargetGain() <= 0.002) return;
    try {
      const now = context.currentTime || 0;
      const carrier = context.createOscillator();
      const overtone = context.createOscillator();
      const ovGain = context.createGain();
      const env = context.createGain();
      carrier.type = 'sine';
      overtone.type = 'triangle';
      carrier.frequency.setValueAtTime(freq, now);
      overtone.frequency.setValueAtTime(freq * 2, now);
      ovGain.gain.setValueAtTime(0.08, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(Math.max(0.001, gainLevel), now + 0.08);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      let out = env;
      if (typeof context.createStereoPanner === 'function') {
        try {
          const pan = context.createStereoPanner();
          pan.pan.value = Math.max(-0.7, Math.min(0.7, panValue));
          env.connect(pan);
          pan.connect(motifBus);
          out = null;
        } catch {
          out = env;
        }
      }
      if (out) env.connect(motifBus);

      carrier.connect(env);
      overtone.connect(ovGain).connect(env);
      carrier.start(now);
      overtone.start(now);
      carrier.stop(now + duration + 0.08);
      overtone.stop(now + duration + 0.08);
      carrier.onended = () => {
        try {
          carrier.disconnect();
          overtone.disconnect();
          ovGain.disconnect();
          env.disconnect();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore transient WebAudio node errors */
    }
  }

  function advancePhrase() {
    if (disposed) return;
    const activeMood = Date.now() < arrivalLockUntil ? 'arrival' : mood;
    const profile = MOOD_PROFILES[activeMood] || MOOD_PROFILES.bridge;
    chordIndex = (chordIndex + 1) % profile.chords.length;
    applyChord(profile, chordIndex, activeMood === 'hyperspace' ? 0.45 : 1.25);

    if (computeEffectiveTargetGain() > 0.003 && Math.random() <= profile.melodyChance) {
      const scale = profile.scaleHz;
      const pick = scale[(noteStep * 3 + chordIndex * 2 + Math.floor(Math.random() * 2)) % scale.length];
      noteStep += 1;
      const pan = Math.sin(noteStep * 1.15) * 0.45;
      const len = activeMood === 'hyperspace' ? 1.55 : 2.9;
      playSparkleNote(pick, len, activeMood === 'hyperspace' ? 0.18 : 0.13, pan);
      if (activeMood === 'hyperspace' || activeMood === 'arrival' || Math.random() < 0.36) {
        const fifth = pick * 1.5;
        if (fifth < 1100) {
          setTimeout(() => {
            if (!disposed && computeEffectiveTargetGain() > 0.003) {
              playSparkleNote(fifth, len * 0.85, 0.08, -pan * 0.8);
            }
          }, activeMood === 'hyperspace' ? 320 : 620);
        }
      }
    }
  }

  function restartScheduler() {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    if (disposed || !enabled) return;
    const activeMood = Date.now() < arrivalLockUntil ? 'arrival' : mood;
    const profile = MOOD_PROFILES[activeMood] || MOOD_PROFILES.bridge;
    schedulerTimer = setInterval(advancePhrase, profile.stepMs);
  }

  return {
    setEnabled(nextEnabled) {
      if (disposed) return;
      const flag = Boolean(nextEnabled);
      if (enabled === flag) return;
      enabled = flag;
      updateMasterGain(flag ? 0.85 : 0.4);
      if (flag) {
        const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.bridge;
        applyChord(profile, chordIndex, 0.9);
        restartScheduler();
      } else if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
    },
    setMixVolume(value) {
      if (disposed) return;
      mixVolume = clamp01(value, mixVolume);
      updateMasterGain(0.18);
    },
    setSuppressed(flag) {
      if (disposed) return;
      const next = Boolean(flag);
      if (suppressed === next) return;
      suppressed = next;
      updateMasterGain(next ? 0.35 : 1.1);
    },
    setSpeaking(flag) {
      if (disposed) return;
      const next = Boolean(flag);
      if (speaking === next) return;
      speaking = next;
      updateMasterGain(next ? 0.22 : 0.48);
    },
    setPaused(flag) {
      if (disposed) return;
      const next = Boolean(flag);
      if (paused === next) return;
      paused = next;
      updateMasterGain(0.32);
    },
    setMood(nextMood = 'bridge') {
      if (disposed) return;
      const normalized = MOOD_PROFILES[nextMood] ? nextMood : 'bridge';
      if (mood === normalized) return;
      mood = normalized;
      chordIndex = 0;
      const profile = MOOD_PROFILES[normalized];
      applyChord(profile, 0, normalized === 'hyperspace' ? 0.45 : 1.1);
      if (enabled) restartScheduler();
    },
    triggerArrivalBloom() {
      if (disposed) return;
      arrivalLockUntil = Date.now() + 7200;
      const profile = MOOD_PROFILES.arrival;
      applyChord(profile, 0, 0.6);
      if (computeEffectiveTargetGain() > 0.003) {
        [329.63, 493.88, 659.25].forEach((hz, idx) => {
          setTimeout(() => {
            if (!disposed) playSparkleNote(hz, 2.8, 0.13, (idx - 1) * 0.35);
          }, idx * 180);
        });
      }
    },
    getState() {
      return {
        disposed,
        enabled,
        mixVolume,
        suppressed,
        speaking,
        paused,
        mood,
        effectiveGain: computeEffectiveTargetGain(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      if (filterLfo) {
        try {
          filterLfo.stop();
          filterLfo.disconnect();
        } catch {
          /* ignore */
        }
      }
      padVoices.forEach((voice) => {
        try {
          voice.oscA.stop();
          voice.oscB.stop();
          voice.oscA.disconnect();
          voice.oscB.disconnect();
          voice.voiceGain.disconnect();
        } catch {
          /* ignore */
        }
      });
      try {
        busGain.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
