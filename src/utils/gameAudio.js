/** Lightweight, opt-in synthesized ambience and interface cues. */
export function createGameAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  let context;
  try {
    context = new AudioContextClass();
  } catch {
    return null;
  }
  const master = context.createGain();
  master.gain.value = 0.24;
  master.connect(context.destination);
  const ambient = context.createGain();
  ambient.gain.value = 0;
  ambient.connect(master);

  const oscillators = [55, 82.41, 110].map((frequency, index) => {
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const voice = context.createGain();
    oscillator.type = index === 2 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index === 1 ? -5 : 3;
    filter.type = 'lowpass';
    filter.frequency.value = index === 2 ? 420 : 180;
    voice.gain.value = index === 2 ? 0.12 : 0.2;
    oscillator.connect(filter).connect(voice).connect(ambient);
    oscillator.start();
    return oscillator;
  });

  let disposed = false;
  const resume = () => context.state === 'suspended' && context.resume().catch(() => {});

  return {
    setEnabled(enabled) {
      if (disposed) return;
      resume();
      ambient.gain.setTargetAtTime(enabled ? 0.16 : 0, context.currentTime, 0.7);
    },
    setVolume(value) {
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), context.currentTime, 0.08);
    },
    cue(kind = 'tap') {
      if (disposed) return;
      resume();
      const now = context.currentTime;

      if (kind === 'footstep') {
        const length = Math.floor(context.sampleRate * 0.16);
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
        const noise = context.createBufferSource();
        noise.buffer = buffer;
        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(520, now);
        filter.Q.setValueAtTime(0.8, now);
        const impact = context.createGain();
        impact.gain.setValueAtTime(0.0001, now);
        impact.gain.exponentialRampToValueAtTime(0.12, now + 0.009);
        impact.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        noise.connect(filter).connect(impact).connect(master);
        noise.start(now);

        const resonance = context.createOscillator();
        const metal = context.createGain();
        resonance.type = 'triangle';
        resonance.frequency.setValueAtTime(185, now);
        resonance.frequency.exponentialRampToValueAtTime(118, now + 0.11);
        metal.gain.setValueAtTime(0.0001, now);
        metal.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
        metal.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
        resonance.connect(metal).connect(master);
        resonance.start(now);
        resonance.stop(now + 0.14);
        return;
      }

      if (kind === 'interface-open') {
        [0, 0.075].forEach((offset, index) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          const start = now + offset;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(index ? 1040 : 680, start);
          osc.frequency.exponentialRampToValueAtTime(index ? 1320 : 920, start + 0.12);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
          osc.connect(gain).connect(master);
          osc.start(start);
          osc.stop(start + 0.2);
        });
        return;
      }

      if (kind === 'switch') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.055);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + 0.09);
        return;
      }

      if (kind === 'door') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(215, now + 0.28);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
        osc.connect(filter).connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + 0.36);
        return;
      }

      if (kind === 'pickup') {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          const t0 = now + i * 0.055;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
          osc.connect(gain).connect(master);
          osc.start(t0);
          osc.stop(t0 + 0.16);
        });
        return;
      }

      if (kind === 'grab') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.085, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + 0.11);
        return;
      }

      if (kind === 'chime') {
        [587.33, 880].forEach((freq, i) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          const t0 = now + i * 0.09;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.065, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
          osc.connect(gain).connect(master);
          osc.start(t0);
          osc.stop(t0 + 0.36);
        });
        return;
      }

      if (kind === 'thruster') {
        const len = Math.floor(context.sampleRate * 0.14);
        const buf = context.createBuffer(1, len, context.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const src = context.createBufferSource();
        src.buffer = buf;
        const hp = context.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(980, now);
        hp.Q.setValueAtTime(1.1, now);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        src.connect(hp).connect(gain).connect(master);
        src.start(now);
        return;
      }

      if (kind === 'error') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(145, now + 0.18);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + 0.22);
        return;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const notes = kind === 'arrival' ? [440, 660, 880] : kind === 'travel' ? [330, 494] : [620];
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(notes[0], now);
      if (notes.length > 1)
        oscillator.frequency.exponentialRampToValueAtTime(notes.at(-1), now + 0.32);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === 'tap' ? 0.045 : 0.07, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'tap' ? 0.11 : 0.42));
      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.45);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      oscillators.forEach((oscillator) => oscillator.stop());
      context.close().catch(() => {});
    },
  };
}
