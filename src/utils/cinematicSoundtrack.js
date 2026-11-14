/** One soundtrack for the whole intro; scene changes never recreate or restart it. */
export function createCinematicSoundtrack({src, audioFactory, onBlocked = () => {}, volume = 0.24} = {}) {
  const factory = audioFactory || (typeof Audio !== 'undefined' ? () => new Audio() : null);
  if (!factory) return null;
  const audio = factory();
  if (!audio || typeof audio.play !== 'function') return null;
  audio.src = src;
  audio.preload = 'auto';
  audio.loop = true;
  let active = false, disposed = false, playing = false, pending = null, speaking = false, generation = 0, fadeTimer = null;
  const gain = () => {audio.volume = Math.max(0, Math.min(1, volume)) * (speaking ? 0.16 : 0.44);};
  gain();
  const cancelFade = () => {
    if (fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  };
  const play = () => {
    if (!active || disposed || playing || pending) return pending;
    try {
      const currentGeneration = generation;
      const attempt = Promise.resolve(audio.play()).then(() => {
        if (currentGeneration !== generation) return;
        if (disposed || !active) {audio.pause(); return;}
        playing = true;
        onBlocked(false);
      }).catch(error => {
        if (disposed || !active || currentGeneration !== generation) return;
        playing = false;
        if (error?.name === 'NotAllowedError') onBlocked(true);
      }).finally(() => {if (pending === attempt) pending = null;});
      pending = attempt;
    } catch (error) {
      if (error?.name === 'NotAllowedError') onBlocked(true);
    }
    return pending;
  };
  const stop = () => {
    cancelFade();
    active = false;
    generation++;
    playing = false;
    pending = null;
    audio.pause();
    audio.currentTime = 0;
    if (!disposed) onBlocked(false);
  };
  const fadeOut = (durationSeconds = 2.5) => {
    cancelFade();
    active = false;
    if (disposed || audio.paused || audio.volume <= 0.005) {
      stop();
      return;
    }
    const startVolume = audio.volume;
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const durationMs = Math.max(100, durationSeconds * 1000);
    fadeTimer = setInterval(() => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const progress = Math.min(1, (now - startTime) / durationMs);
      const factor = Math.max(0, 1 - progress);
      try {
        audio.volume = Math.max(0, startVolume * factor);
      } catch {
        /* ignore volume setter error */
      }
      if (progress >= 1 || audio.volume <= 0.005) {
        cancelFade();
        stop();
      }
    }, 35);
  };
  return {
    start() {
      cancelFade();
      if (disposed || active) return;
      active = true;
      audio.currentTime = 0;
      gain();
      return play();
    },
    unlock() {
      if (disposed || !active) return null;
      cancelFade();
      gain();
      return play();
    },
    stop,
    fadeOut,
    isFading() {
      return Boolean(fadeTimer);
    },
    setSpeaking(value) {
      speaking = Boolean(value);
      if (!fadeTimer) gain();
    },
    setVolume(value) {
      volume = value;
      if (!fadeTimer) gain();
    },
    dispose() {
      cancelFade();
      if (disposed) return;
      stop();
      disposed = true;
      audio.removeAttribute('src');
      audio.load?.();
    },
  };
}
