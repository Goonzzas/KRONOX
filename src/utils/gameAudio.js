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
