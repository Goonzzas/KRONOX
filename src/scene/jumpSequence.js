import * as THREE from 'three';

export const JUMP_PHASES = [
  'PREPARING',
  'ACCELERATING',
  'HYPERSPACE_ENTRY',
  'HYPERSPACE_CRUISE',
  'HYPERSPACE_EXIT',
  'ARRIVING',
];
export const JUMP_DURATIONS = Object.freeze({
  PREPARING: 1.15,
  ACCELERATING: 1.4,
  HYPERSPACE_ENTRY: 1.85,
  HYPERSPACE_CRUISE: 4.8,
  HYPERSPACE_EXIT: 1.7,
  ARRIVING: 1.3,
});
export const SHIP_FORWARD = Object.freeze([0, 0, -1]); // Nose cone is at -Z; engine outlets are at +Z in the existing model.
const smooth = (t) => {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export function createJumpSequence({
  from,
  target,
  startQuaternion,
  clearance = 1.3,
  durations = {},
  reducedMotion = false,
  long = true,
}) {
  const away = from.clone().sub(target);
  if (away.lengthSq() < 1e-12) away.set(0, 0.2, 1);
  away.normalize();
  const to = target.clone().addScaledVector(away, clearance),
    look = new THREE.PerspectiveCamera();
  look.position.copy(to);
  look.lookAt(target);
  const timing = {};
  for (const phase of JUMP_PHASES) {
    const duration = Number(durations[phase] ?? JUMP_DURATIONS[phase]);
    if (!Number.isFinite(duration) || duration <= 0)
      throw Error('Duración de viaje inválida: ' + phase);
    timing[phase] = duration * (reducedMotion ? 0.5 : 1);
  }
  if (!long) {
    timing.HYPERSPACE_ENTRY *= 0.45;
    timing.HYPERSPACE_CRUISE *= 0.3;
    timing.HYPERSPACE_EXIT *= 0.45;
  }
  return {
    from: from.clone(),
    to,
    target: target.clone(),
    q: look.quaternion.clone(),
    startQuaternion: startQuaternion.clone(),
    currentQuaternion: startQuaternion.clone(),
    position: from.clone(),
    timing,
    totalDuration: Object.values(timing).reduce((a, b) => a + b, 0),
    time: 0,
    elapsed: 0,
    phase: 'PREPARING',
    phaseProgress: 0,
    progress: 0,
    long,
    reducedMotion,
    done: false,
    history: ['PREPARING'],
  };
}
export function advanceJump(nav, delta) {
  if (nav.done) return nav;
  const dt = Math.max(0, Number.isFinite(delta) ? delta : 0);
  nav.time = Math.min(nav.totalDuration, nav.time + dt);
  let elapsed = nav.time,
    phase = JUMP_PHASES.at(-1);
  for (const candidate of JUMP_PHASES) {
    phase = candidate;
    if (elapsed < nav.timing[candidate]) break;
    elapsed -= nav.timing[candidate];
  }
  const oldIndex = JUMP_PHASES.indexOf(nav.phase),
    newIndex = JUMP_PHASES.indexOf(phase);
  for (let i = oldIndex + 1; i <= newIndex; i++) nav.history.push(JUMP_PHASES[i]);
  nav.phase = phase;
  nav.elapsed = nav.time >= nav.totalDuration ? nav.timing.ARRIVING : elapsed;
  nav.phaseProgress = THREE.MathUtils.clamp(nav.elapsed / nav.timing[phase], 0, 1);
  nav.progress = nav.time / nav.totalDuration;
  const movementTime = nav.totalDuration - nav.timing.PREPARING - nav.timing.ARRIVING,
    u = THREE.MathUtils.clamp((nav.time - nav.timing.PREPARING) / movementTime, 0, 1);
  nav.position.lerpVectors(nav.from, nav.to, smooth(u));
  nav.currentQuaternion
    .copy(nav.startQuaternion)
    .slerp(nav.q, smooth(nav.time / nav.timing.PREPARING));
  if (nav.time >= nav.totalDuration) {
    nav.position.copy(nav.to);
    nav.currentQuaternion.copy(nav.q);
    nav.done = true;
  }
  return nav;
}
export function jumpVisualState(nav) {
  if (!nav || !nav.long) return { opacity: 0, stretch: 0, tunnel: 0, threshold: 0, speed: 0 };
  const t = nav.phaseProgress;
  let opacity = 0,
    stretch = 0,
    tunnel = 0,
    threshold = 0,
    speed = 0;
  if (nav.phase === 'ACCELERATING') {
    opacity = 0.15 + 0.3 * t;
    stretch = t * 0.18;
    speed = 0.12 + t * 0.3;
  }
  if (nav.phase === 'HYPERSPACE_ENTRY') {
    opacity = 0.45 + 0.5 * t;
    stretch = 0.18 + 0.82 * smooth(t);
    tunnel = smooth(t);
    threshold = Math.sin(Math.PI * t);
    speed = 0.42 + 0.58 * t;
  }
  if (nav.phase === 'HYPERSPACE_CRUISE') {
    opacity = 0.95;
    stretch = 1;
    tunnel = 1;
    speed = 1;
  }
  if (nav.phase === 'HYPERSPACE_EXIT') {
    opacity = 0.95 * (1 - smooth(t));
    stretch = 1 - smooth(t);
    tunnel = 1 - smooth(t);
    speed = 1 - 0.8 * t;
  }
  const reduced = nav.reducedMotion;
  return {
    opacity: opacity * (reduced ? 0.22 : 1),
    stretch: stretch * (reduced ? 0.2 : 1),
    tunnel: tunnel * (reduced ? 0.2 : 1),
    threshold: reduced ? 0 : threshold,
    speed: speed * (reduced ? 0.3 : 1),
  };
}
