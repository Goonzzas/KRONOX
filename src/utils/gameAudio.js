import { createCosmicMusicEngine } from './cosmicMusicEngine.js';

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function setParamSmooth(param, value, now, tc = 0.2) {
  if (!param) return;
  if (typeof param.setTargetAtTime === 'function') {
    param.setTargetAtTime(value, now, tc);
  } else {
    param.value = value;
  }
}

function createNoiseBuffer(context, durationSec = 2.4, color = 'brown') {
  if (
    typeof context.createBuffer !== 'function' ||
    !Number.isFinite(context.sampleRate)
  ) {
    return null;
  }
  const length = Math.max(256, Math.floor(context.sampleRate * durationSec));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  if (color === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  let lastOut = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
    } else {
      lastOut = (lastOut + 0.028 * white) / 1.028;
      data[i] = lastOut * 2.8;
    }
  }
  // Crossfade suave en bordes para bucle continuo sin clics
  const fadeSamples = Math.min(2048, Math.floor(length * 0.08));
  for (let i = 0; i < fadeSamples; i++) {
    const w = i / fadeSamples;
    data[i] = data[i] * w + data[length - fadeSamples + i] * (1 - w);
  }
  return buffer;
}

function createSpaceImpulseBuffer(context, durationSec = 1.85, decay = 2.6) {
  if (
    typeof context.createBuffer !== 'function' ||
    typeof context.createConvolver !== 'function' ||
    !Number.isFinite(context.sampleRate)
  ) {
    return null;
  }
  const length = Math.max(512, Math.floor(context.sampleRate * durationSec));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const channel = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      lp = lp * 0.65 + white * 0.35;
      channel[i] = lp * Math.pow(1 - t, decay) * 0.55;
    }
  }
  return impulse;
}

const CUE_COOLDOWN_MS = {
  'vr-hover': 68,
  'ui-hover': 68,
  footstep: 190,
  tap: 35,
  switch: 50,
  grab: 90,
  thruster: 160,
};

/**
 * Sistema unificado de audio procedural de KRONOX:
 * - Bus independiente de música adaptativa (silenciado automáticamente en intro MP3 y atenuado durante voz)
 * - Paisaje sonoro continuo multi-zona (cubiertas 01-04, reposo, exterior 120m, ascensor e hiperespacio)
 * - Librería completa de efectos táctiles, mecánicos, científicos y cinemáticos con reverberación espacial
 */
export function createGameAudio(options = {}) {
  const AudioContextClass =
    options.AudioContextClass ||
    (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
  if (!AudioContextClass) return null;

  let context;
  try {
    context = new AudioContextClass();
  } catch {
    return null;
  }

  // Etapa maestra anti-clipping
  const masterOut = context.createGain();
  masterOut.gain.value = 0.92;
  let outputTarget = context.destination;
  if (typeof context.createDynamicsCompressor === 'function') {
    try {
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 4.5;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.22;
      compressor.connect(context.destination);
      outputTarget = compressor;
    } catch {
      outputTarget = context.destination;
    }
  }
  masterOut.connect(outputTarget);

  // Bus de reverberación espacial compartida
  let reverbInput = null;
  const impulseBuffer = createSpaceImpulseBuffer(context);
  if (impulseBuffer && typeof context.createConvolver === 'function') {
    try {
      const convolver = context.createConvolver();
      const wetGain = context.createGain();
      convolver.buffer = impulseBuffer;
      wetGain.gain.value = 0.28;
      convolver.connect(wetGain).connect(masterOut);
      reverbInput = convolver;
    } catch {
      reverbInput = null;
    }
  }

  // Bus maestro de Efectos + Ambiente (controlado por masterVolume * sfxVolume)
  const sfxMasterBus = context.createGain();
  sfxMasterBus.gain.value = 0.55;
  sfxMasterBus.connect(masterOut);

  const sfxCueBus = context.createGain();
  sfxCueBus.gain.value = 0.92;
  sfxCueBus.connect(sfxMasterBus);
  if (reverbInput) {
    const sfxWetSend = context.createGain();
    sfxWetSend.gain.value = 0.24;
    sfxCueBus.connect(sfxWetSend).connect(reverbInput);
  }

  const ambienceBus = context.createGain();
  ambienceBus.gain.value = 0;
  ambienceBus.connect(sfxMasterBus);
  if (reverbInput) {
    const ambWetSend = context.createGain();
    ambWetSend.gain.value = 0.14;
    ambienceBus.connect(ambWetSend).connect(reverbInput);
  }

  // Bus maestro de Música adaptativa (controlado por masterVolume * musicVolume)
  const musicBus = context.createGain();
  musicBus.gain.value = 0.9;
  musicBus.connect(masterOut);
  const musicEngine = createCosmicMusicEngine({
    context,
    destination: musicBus,
    reverbSend: reverbInput,
  });

  // ---------------------------------------------------------------------------
  // Capas continuas del paisaje sonoro de la nave y el espacio
  // ---------------------------------------------------------------------------
  const brownNoise = createNoiseBuffer(context, 2.5, 'brown');
  const pinkNoise = createNoiseBuffer(context, 2.2, 'pink');

  function makeNoiseLoop(buffer, filterType, freq, q = 0.8, initialGain = 0) {
    if (!buffer || typeof context.createBufferSource !== 'function') {
      return { gain: context.createGain(), filter: null, source: null };
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = initialGain;
    let filter = null;
    if (typeof context.createBiquadFilter === 'function') {
      filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      source.connect(filter).connect(gain).connect(ambienceBus);
    } else {
      source.connect(gain).connect(ambienceBus);
    }
    source.start();
    return { source, filter, gain };
  }

  // 1. Ventilación / Soporte Vital en cubiertas habitables
  const hvacLayer = makeNoiseLoop(pinkNoise || brownNoise, 'bandpass', 420, 0.75, 0);
  // 2. Rumor de propulsores iónicos y viento solar exterior
  const thrusterLayer = makeNoiseLoop(brownNoise || pinkNoise, 'lowpass', 240, 1.1, 0);

  // 3. Resonancia tonal por cubierta (Reactor C04 / Lab C03 / Hab C02 / Puente C01 / Vacío)
  const deckToneGain = context.createGain();
  deckToneGain.gain.value = 0.08;
  const deckToneFilter =
    typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
  if (deckToneFilter) {
    deckToneFilter.type = 'lowpass';
    deckToneFilter.frequency.value = 210;
    deckToneFilter.connect(deckToneGain).connect(ambienceBus);
  } else {
    deckToneGain.connect(ambienceBus);
  }
  const deckOscA = context.createOscillator();
  const deckOscB = context.createOscillator();
  const deckGainA = context.createGain();
  const deckGainB = context.createGain();
  deckOscA.type = 'triangle';
  deckOscB.type = 'sine';
  deckOscA.frequency.value = 65.41;
  deckOscB.frequency.value = 98.0;
  deckGainA.gain.value = 0.16;
  deckGainB.gain.value = 0.1;
  deckOscA.connect(deckGainA).connect(deckToneFilter || deckToneGain);
  deckOscB.connect(deckGainB).connect(deckToneFilter || deckToneGain);
  deckOscA.start();
  deckOscB.start();

  // 4. Motor electromagnético del ascensor intercubiertas
  const elevatorGain = context.createGain();
  elevatorGain.gain.value = 0;
  elevatorGain.connect(ambienceBus);
  const elevatorOsc = context.createOscillator();
  elevatorOsc.type = 'triangle';
  elevatorOsc.frequency.value = 94;
  elevatorOsc.connect(elevatorGain);
  elevatorOsc.start();

  // 5. Turbina armónica del motor warp (hiperespacio)
  const warpGain = context.createGain();
  warpGain.gain.value = 0;
  warpGain.connect(ambienceBus);
  const warpFilter =
    typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
  if (warpFilter) {
    warpFilter.type = 'bandpass';
    warpFilter.frequency.value = 320;
    warpFilter.Q.value = 2.2;
    warpFilter.connect(warpGain);
  }
  const warpOscA = context.createOscillator();
  const warpOscB = context.createOscillator();
  warpOscA.type = 'sawtooth';
  warpOscB.type = 'sine';
  warpOscA.frequency.value = 110;
  warpOscB.frequency.value = 220;
  const warpSawAtten = context.createGain();
  warpSawAtten.gain.value = 0.25;
  warpOscA.connect(warpSawAtten).connect(warpFilter || warpGain);
  warpOscB.connect(warpFilter || warpGain);
  warpOscA.start();
  warpOscB.start();

  // ---------------------------------------------------------------------------
  // Estado interno de mezcla y ambiente
  // ---------------------------------------------------------------------------
  let disposed = false;
  let enabled = false;
  let sfxMix = 0.55;
  let musicMix = 0.32;
  let speaking = false;
  let paused = false;
  let introActive = false;
  const lastCueTimestamps = new Map();

  const envState = {
    zone: 'menu', // 'menu' | 'cabin' | 'exterior' | 'map'
    deckId: 'deck-01',
    viewMode: 'cockpit',
    hyperspacePhase: null,
    speed: 0,
    thrustActive: false,
    elevatorMoving: false,
    sleeping: false,
    resting: false,
    missionOpen: false,
    inVr: false,
  };

  function resolveMusicMood() {
    if (envState.sleeping) return 'sleep';
    if (
      envState.hyperspacePhase === 'HYPERSPACE_ENTRY' ||
      envState.hyperspacePhase === 'HYPERSPACE_CRUISE' ||
      envState.hyperspacePhase === 'ACCELERATING'
    ) {
      return 'hyperspace';
    }
    if (envState.hyperspacePhase === 'HYPERSPACE_EXIT') return 'arrival';
    if (envState.missionOpen) return 'science';
    if (envState.zone === 'menu') return 'menu';
    if (envState.zone === 'exterior' || envState.zone === 'map') return 'exterior';
    switch (envState.deckId) {
      case 'deck-02':
        return 'hab';
      case 'deck-03':
        return 'lab';
      case 'deck-04':
        return 'eng';
      default:
        return 'bridge';
    }
  }

  function applyEnvironmentToAudio() {
    if (disposed) return;
    const now = context.currentTime || 0;
    const isInterior = envState.zone === 'cabin';
    const isExterior = envState.zone === 'exterior' || envState.zone === 'map';
    const isHyperspace = Boolean(
      envState.hyperspacePhase &&
        envState.hyperspacePhase !== 'countdown' &&
        envState.hyperspacePhase !== 'NONE',
    );
    const quietFactor = envState.sleeping ? 0.42 : paused ? 0.6 : 1.0;

    // HVAC interior (Cubiertas 01-04)
    let targetHvac = 0.008;
    let targetHvacFreq = 420;
    if (isInterior) {
      if (envState.deckId === 'deck-04') {
        targetHvac = 0.085;
        targetHvacFreq = 290;
      } else if (envState.deckId === 'deck-03') {
        targetHvac = 0.055;
        targetHvacFreq = 620;
      } else if (envState.deckId === 'deck-02') {
        targetHvac = envState.sleeping ? 0.022 : 0.036;
        targetHvacFreq = 350;
      } else {
        targetHvac = 0.048;
        targetHvacFreq = 460;
      }
    } else if (isExterior) {
      targetHvac = 0.012;
      targetHvacFreq = 220;
    }
    setParamSmooth(hvacLayer.gain.gain, targetHvac * quietFactor, now, 0.45);
    if (hvacLayer.filter) {
      setParamSmooth(hvacLayer.filter.frequency, targetHvacFreq, now, 0.5);
    }

    // Resonancia armónica por zona
    let fA = 65.41;
    let fB = 98.0;
    let deckFilterHz = 210;
    let deckLevel = 0.09;
    if (envState.zone === 'menu') {
      fA = 55.0;
      fB = 82.41;
      deckFilterHz = 180;
      deckLevel = 0.075;
    } else if (isExterior) {
      fA = 41.2;
      fB = 61.74;
      deckFilterHz = 150;
      deckLevel = 0.11;
    } else if (envState.deckId === 'deck-04') {
      fA = 54.0;
      fB = 81.0;
      deckFilterHz = 270;
      deckLevel = 0.22;
    } else if (envState.deckId === 'deck-03') {
      fA = 130.81;
      fB = 196.0;
      deckFilterHz = 380;
      deckLevel = 0.08;
    } else if (envState.deckId === 'deck-02') {
      fA = 73.42;
      fB = 110.0;
      deckFilterHz = envState.sleeping ? 120 : 190;
      deckLevel = envState.sleeping ? 0.04 : 0.065;
    }
    setParamSmooth(deckOscA.frequency, fA, now, 0.7);
    setParamSmooth(deckOscB.frequency, fB, now, 0.7);
    if (deckToneFilter) setParamSmooth(deckToneFilter.frequency, deckFilterHz, now, 0.65);
    setParamSmooth(deckToneGain.gain, deckLevel * quietFactor, now, 0.45);

    // Propulsores continuos en vuelo / microgravedad
    const speedFactor = Math.min(1, Math.log10(1 + Math.max(0, envState.speed)) / 3.4);
    const activeThrusterLevel = envState.thrustActive
      ? 0.22
      : isExterior && envState.speed > 0.25
        ? 0.04 + speedFactor * 0.12
        : 0;
    setParamSmooth(thrusterLayer.gain.gain, activeThrusterLevel * quietFactor, now, 0.16);
    if (thrusterLayer.filter) {
      setParamSmooth(
        thrusterLayer.filter.frequency,
        160 + (envState.thrustActive ? 420 : speedFactor * 260),
        now,
        0.18,
      );
    }

    // Motor electromagnético de ascensor
    setParamSmooth(elevatorGain.gain, envState.elevatorMoving ? 0.11 : 0, now, 0.18);
    setParamSmooth(elevatorOsc.frequency, envState.elevatorMoving ? 102 : 76, now, 0.25);

    // Turbina hiperespacial continua por fases
    let targetWarpGain = 0;
    let targetWarpFreq = 110;
    let targetWarpFilter = 260;
    if (isHyperspace) {
      if (envState.hyperspacePhase === 'PREPARING') {
        targetWarpGain = 0.09;
        targetWarpFreq = 92;
        targetWarpFilter = 280;
      } else if (envState.hyperspacePhase === 'ACCELERATING') {
        targetWarpGain = 0.16;
        targetWarpFreq = 138;
        targetWarpFilter = 480;
      } else if (envState.hyperspacePhase === 'HYPERSPACE_ENTRY') {
        targetWarpGain = 0.24;
        targetWarpFreq = 196;
        targetWarpFilter = 860;
      } else if (envState.hyperspacePhase === 'HYPERSPACE_CRUISE') {
        targetWarpGain = 0.18;
        targetWarpFreq = 164.81;
        targetWarpFilter = 620;
      } else if (envState.hyperspacePhase === 'HYPERSPACE_EXIT') {
        targetWarpGain = 0.12;
        targetWarpFreq = 110;
        targetWarpFilter = 340;
      }
    }
    setParamSmooth(warpGain.gain, targetWarpGain * (paused ? 0.35 : 1), now, 0.28);
    setParamSmooth(warpOscA.frequency, targetWarpFreq, now, 0.35);
    setParamSmooth(warpOscB.frequency, targetWarpFreq * 2.0, now, 0.35);
    if (warpFilter) setParamSmooth(warpFilter.frequency, targetWarpFilter, now, 0.35);

    // Música adaptativa
    if (musicEngine) {
      musicEngine.setMood(resolveMusicMood());
      musicEngine.setSuppressed(introActive);
      musicEngine.setSpeaking(speaking);
      musicEngine.setPaused(paused);
    }
  }

  // Micro-detalles espaciales aleatorios sutiles (radar de puente / destello exterior)
  const microAmbienceTimer = setInterval(() => {
    if (disposed || !enabled || paused || speaking || envState.sleeping || introActive) return;
    if (context.state === 'suspended' || sfxMix <= 0.02) return;
    if (envState.zone === 'cabin' && (envState.deckId === 'deck-01' || envState.deckId === 'deck-03')) {
      if (Math.random() < 0.55) {
        const baseHz = envState.deckId === 'deck-01' ? 1180 + Math.random() * 420 : 1480 + Math.random() * 360;
        tone(baseHz, 0.24, 'sine', 0.018, 0.04, 0, baseHz * 0.98);
      }
    } else if (envState.zone === 'exterior' && Math.random() < 0.45) {
      tone(523.25 + Math.random() * 190, 0.75, 'sine', 0.016, 0.12, 0, 587.33);
    }
  }, 9500);

  const resume = () => {
    if (disposed) return;
    if (context.state === 'suspended' && typeof context.resume === 'function') {
      context.resume().catch(() => {});
    }
  };

  // ---------------------------------------------------------------------------
  // Generadores de síntesis para efectos discretos (`cue`)
  // ---------------------------------------------------------------------------
  function tone(
    frequency,
    duration,
    type = 'sine',
    volume = 0.08,
    attack = 0.01,
    delay = 0,
    endFreq = frequency,
    pan = 0,
  ) {
    if (disposed || !context) return;
    try {
      const start = (context.currentTime || 0) + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
      if (endFreq !== frequency && typeof oscillator.frequency.exponentialRampToValueAtTime === 'function') {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFreq),
          start + Math.max(0.02, duration),
        );
      }
      gain.gain.setValueAtTime(0.0001, start);
      if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0005, volume), start + Math.max(0.004, attack));
        gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.02, duration));
      } else {
        gain.gain.value = volume;
      }

      if (pan !== 0 && typeof context.createStereoPanner === 'function') {
        try {
          const panner = context.createStereoPanner();
          panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
          oscillator.connect(gain).connect(panner).connect(sfxCueBus);
        } catch {
          oscillator.connect(gain).connect(sfxCueBus);
        }
      } else {
        oscillator.connect(gain).connect(sfxCueBus);
      }

      oscillator.start(start);
      oscillator.stop(start + Math.max(0.03, duration) + 0.04);
      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          gain.disconnect();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore transient audio error */
    }
  }

  function noiseBurst(duration, filterType = 'bandpass', freqStart = 600, freqEnd = 300, volume = 0.08, delay = 0) {
    if (disposed || (!brownNoise && !pinkNoise) || typeof context.createBufferSource !== 'function') return;
    try {
      const start = (context.currentTime || 0) + delay;
      const source = context.createBufferSource();
      source.buffer = pinkNoise || brownNoise;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.04, duration));
      }
      if (typeof context.createBiquadFilter === 'function') {
        const filter = context.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(Math.max(40, freqStart), start);
        if (freqEnd !== freqStart && typeof filter.frequency.exponentialRampToValueAtTime === 'function') {
          filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), start + duration);
        }
        source.connect(filter).connect(gain).connect(sfxCueBus);
      } else {
        source.connect(gain).connect(sfxCueBus);
      }
      source.start(start);
      source.stop(start + duration + 0.05);
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore */
    }
  }

  function cue(kind = 'tap') {
    if (disposed) return;
    resume();

    const cooldown = CUE_COOLDOWN_MS[kind] || 0;
    if (cooldown > 0) {
      const nowMs = Date.now();
      const prevMs = lastCueTimestamps.get(kind) || 0;
      if (nowMs - prevMs < cooldown) return;
      lastCueTimestamps.set(kind, nowMs);
    }

    switch (kind) {
      case 'vr-hover':
      case 'ui-hover': {
        tone(1180 + Math.random() * 140, 0.045, 'sine', 0.025, 0.004, 0, 1460);
        break;
      }
      case 'confirm':
      case 'vr-select': {
        tone(620, 0.11, 'triangle', 0.06, 0.006, 0, 740);
        tone(932.3, 0.22, 'sine', 0.06, 0.008, 0.06, 987.77);
        break;
      }
      case 'footstep': {
        const softDeck = envState.deckId === 'deck-02';
        const jit = 0.92 + Math.random() * 0.16;
        tone((softDeck ? 112 : 138) * jit, 0.075, 'triangle', softDeck ? 0.045 : 0.06, 0.004, 0, 48);
        if (!softDeck) {
          tone(360 * jit, 0.04, 'sine', 0.018, 0.003, 0.012, 180);
        }
        noiseBurst(0.055, 'bandpass', softDeck ? 420 : 880, 240, softDeck ? 0.025 : 0.036);
        break;
      }
      case 'interface-open': {
        tone(392, 0.14, 'sine', 0.05, 0.01, 0, 587.33);
        tone(783.99, 0.24, 'triangle', 0.04, 0.012, 0.065, 987.77);
        break;
      }
      case 'interface-close': {
        tone(659.25, 0.12, 'sine', 0.04, 0.008, 0, 440);
        tone(440, 0.16, 'triangle', 0.035, 0.008, 0.05, 293.66);
        break;
      }
      case 'switch': {
        tone(280, 0.06, 'square', 0.03, 0.004, 0, 420);
        tone(698.46, 0.12, 'triangle', 0.05, 0.005, 0.03, 783.99);
        break;
      }
      case 'door':
      case 'eva-airlock': {
        noiseBurst(0.32, 'bandpass', 1800, 420, 0.065, 0);
        tone(170, 0.26, 'triangle', 0.07, 0.015, 0.04, 72);
        tone(110, 0.18, 'sine', 0.06, 0.008, 0.22, 64);
        break;
      }
      case 'elevator-start': {
        tone(146.83, 0.22, 'triangle', 0.055, 0.02, 0, 220);
        tone(293.66, 0.34, 'sine', 0.04, 0.025, 0.08, 392);
        break;
      }
      case 'elevator-arrive':
      case 'chime': {
        tone(659.25, 0.34, 'sine', 0.065, 0.01, 0, 659.25, -0.2);
        tone(987.77, 0.56, 'sine', 0.055, 0.012, 0.11, 987.77, 0.2);
        break;
      }
      case 'rest-start': {
        tone(220, 0.36, 'sine', 0.055, 0.04, 0, 196);
        tone(329.63, 0.48, 'triangle', 0.04, 0.05, 0.09, 293.66);
        noiseBurst(0.22, 'lowpass', 380, 140, 0.035);
        break;
      }
      case 'rest-nap': {
        tone(392, 0.45, 'sine', 0.05, 0.03, 0, 329.63, -0.25);
        tone(293.66, 0.65, 'sine', 0.048, 0.04, 0.18, 220, 0.25);
        break;
      }
      case 'rest-complete': {
        tone(440, 0.38, 'sine', 0.06, 0.015, 0, 440, -0.3);
        tone(554.37, 0.44, 'sine', 0.06, 0.015, 0.12, 554.37, 0);
        tone(659.25, 0.72, 'triangle', 0.065, 0.02, 0.24, 880, 0.3);
        break;
      }
      case 'pickup': {
        tone(523.25, 0.12, 'triangle', 0.055, 0.008, 0);
        tone(783.99, 0.26, 'sine', 0.06, 0.01, 0.08);
        break;
      }
      case 'grab': {
        tone(220, 0.08, 'triangle', 0.065, 0.005, 0, 145);
        tone(520, 0.09, 'sine', 0.045, 0.005, 0.035, 340);
        break;
      }
      case 'thruster': {
        noiseBurst(0.28, 'lowpass', 520, 140, 0.08, 0);
        tone(96, 0.26, 'sawtooth', 0.045, 0.025, 0, 44);
        break;
      }
      case 'travel': {
        noiseBurst(0.45, 'bandpass', 260, 1400, 0.075, 0);
        tone(110, 0.5, 'sawtooth', 0.045, 0.04, 0, 293.66);
        tone(220, 0.65, 'sine', 0.06, 0.05, 0.12, 587.33);
        break;
      }
      case 'hyperspace-entry': {
        noiseBurst(0.68, 'bandpass', 180, 2400, 0.1, 0);
        tone(82.41, 0.82, 'sawtooth', 0.065, 0.03, 0, 261.63);
        tone(164.81, 0.95, 'triangle', 0.075, 0.04, 0.08, 659.25);
        tone(55.0, 0.75, 'sine', 0.12, 0.02, 0.05, 36.7);
        break;
      }
      case 'hyperspace-exit': {
        noiseBurst(0.55, 'lowpass', 1600, 110, 0.095, 0);
        tone(240, 0.52, 'triangle', 0.075, 0.01, 0, 52);
        tone(587.33, 0.42, 'sine', 0.05, 0.02, 0.18, 440);
        break;
      }
      case 'arrival': {
        musicEngine?.triggerArrivalBloom?.();
        tone(392.0, 0.44, 'triangle', 0.06, 0.02, 0, 392.0, -0.35);
        tone(493.88, 0.52, 'sine', 0.065, 0.02, 0.11, 493.88, 0.25);
        tone(587.33, 0.68, 'sine', 0.07, 0.02, 0.22, 587.33, -0.15);
        tone(783.99, 0.95, 'triangle', 0.065, 0.025, 0.34, 783.99, 0.35);
        break;
      }
      case 'scan': {
        tone(740, 0.24, 'sine', 0.045, 0.012, 0, 1480, -0.3);
        tone(1108.7, 0.26, 'sine', 0.04, 0.015, 0.1, 1661.2, 0.3);
        tone(1975.5, 0.22, 'triangle', 0.03, 0.01, 0.22, 1975.5, 0);
        break;
      }
      case 'capture': {
        noiseBurst(0.06, 'highpass', 1900, 900, 0.05, 0);
        tone(1320, 0.09, 'sine', 0.05, 0.004, 0, 1760);
        tone(880, 0.22, 'triangle', 0.05, 0.01, 0.06, 880);
        break;
      }
      case 'evidence-ok': {
        tone(493.88, 0.22, 'triangle', 0.055, 0.01, 0, 493.88, -0.2);
        tone(659.25, 0.28, 'sine', 0.06, 0.01, 0.09, 659.25, 0.2);
        tone(987.77, 0.44, 'sine', 0.06, 0.015, 0.18, 987.77, 0);
        break;
      }
      case 'mission-complete':
      case 'achievement': {
        tone(440, 0.28, 'triangle', 0.065, 0.01, 0, 440, -0.35);
        tone(554.37, 0.32, 'sine', 0.065, 0.01, 0.09, 554.37, 0.2);
        tone(659.25, 0.38, 'sine', 0.07, 0.012, 0.18, 659.25, -0.15);
        tone(880.0, 0.72, 'triangle', 0.075, 0.018, 0.28, 880.0, 0.35);
        break;
      }
      case 'error':
      case 'alert': {
        tone(220, 0.14, 'sawtooth', 0.045, 0.008, 0, 165);
        tone(165, 0.18, 'sawtooth', 0.04, 0.008, 0.12, 130);
        break;
      }
      default: {
        tone(820, 0.06, 'sine', 0.045, 0.004, 0, 960);
        break;
      }
    }
  }

  return {
    unlock() {
      resume();
    },
    setEnabled(nextEnabled) {
      if (disposed) return;
      const flag = Boolean(nextEnabled);
      enabled = flag;
      if (flag) resume();
      const now = context.currentTime || 0;
      setParamSmooth(ambienceBus.gain, flag ? 0.56 : 0, now, flag ? 0.6 : 0.3);
      musicEngine?.setEnabled(flag);
      if (flag) applyEnvironmentToAudio();
    },
    setVolume(value) {
      if (disposed) return;
      sfxMix = clamp01(value, sfxMix);
      const now = context.currentTime || 0;
      setParamSmooth(sfxMasterBus.gain, sfxMix, now, 0.08);
    },
    setMusicVolume(value) {
      if (disposed) return;
      musicMix = clamp01(value, musicMix);
      musicEngine?.setMixVolume(musicMix);
    },
    setMix({ master = 0.85, music = 0.38, sfx = 0.65 } = {}) {
      if (disposed) return;
      const m = clamp01(master, 0.85);
      sfxMix = clamp01(m * clamp01(sfx, 0.65), 0);
      musicMix = clamp01(m * clamp01(music, 0.38), 0);
      const now = context.currentTime || 0;
      setParamSmooth(sfxMasterBus.gain, sfxMix, now, 0.08);
      musicEngine?.setMixVolume(musicMix);
    },
    setMusicSuppressed(flag) {
      if (disposed) return;
      introActive = Boolean(flag);
      musicEngine?.setSuppressed(introActive);
    },
    setSpeaking(flag) {
      if (disposed) return;
      speaking = Boolean(flag);
      musicEngine?.setSpeaking(speaking);
    },
    setPaused(flag) {
      if (disposed) return;
      paused = Boolean(flag);
      applyEnvironmentToAudio();
    },
    setEnvironmentState(nextPartial = {}) {
      if (disposed || !nextPartial || typeof nextPartial !== 'object') return;
      let changed = false;
      for (const key of Object.keys(nextPartial)) {
        if (nextPartial[key] !== undefined && envState[key] !== nextPartial[key]) {
          envState[key] = nextPartial[key];
          changed = true;
        }
      }
      if (changed) applyEnvironmentToAudio();
    },
    cue,
    getStateSnapshot() {
      return {
        disposed,
        enabled,
        sfxMix,
        musicMix,
        speaking,
        paused,
        introActive,
        envState: { ...envState },
        music: musicEngine ? musicEngine.getState() : null,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(microAmbienceTimer);
      musicEngine?.dispose();
      [
        hvacLayer.source,
        thrusterLayer.source,
        deckOscA,
        deckOscB,
        elevatorOsc,
        warpOscA,
        warpOscB,
      ].forEach((node) => {
        if (!node) return;
        try {
          node.stop();
          node.disconnect();
        } catch {
          /* ignore */
        }
      });
      try {
        masterOut.disconnect();
      } catch {
        /* ignore */
      }
      if (typeof context.close === 'function') {
        context.close().catch(() => {});
      }
    },
  };
}
