import * as THREE from 'three';

export const MICROGRAVITY_MODES = Object.freeze({
  ASSISTED: 'ASSISTED',
  FREE: 'FREE',
});

/**
 * 6-DOF microgravity locomotion controller for KRONOX interior navigation.
 * Supports:
 * - ASSISTED mode: responsive RCS thrust + gentle inertial damping for natural ship exploration.
 * - FREE mode: pure Newtonian inertia preservation until counter-thrusted or braked with [X].
 * - Zero-G rail anchoring (`toggleAnchor`) and hull/obstacle projection (`clampPositionFn`).
 */
export function createMicrogravityPhysicsController({
  initialPosition = new THREE.Vector3(0, -1.6, -45.3),
  mode = MICROGRAVITY_MODES.ASSISTED,
  clampPositionFn = null,
} = {}) {
  const position = initialPosition.clone();
  const velocity = new THREE.Vector3(0, 0, 0);
  let activeMode = mode;
  let anchoredRailId = null;

  const baseAccelMps2 = 5.2;
  const boostMult = 2.1;
  const maxAssistedSpeed = 3.2;
  const maxFreeSpeed = 4.6;

  function setMode(nextMode) {
    if (Object.values(MICROGRAVITY_MODES).includes(nextMode)) {
      activeMode = nextMode;
    }
    return activeMode;
  }

  function setPosition(pos) {
    if (!pos) return position;
    position.set(Number(pos.x || 0), Number(pos.y || 0), Number(pos.z || 0));
    velocity.set(0, 0, 0);
    return position;
  }

  function toggleAnchor(railId = 'rail-local') {
    if (anchoredRailId) {
      anchoredRailId = null;
      return false;
    }
    anchoredRailId = railId || 'rail-local';
    velocity.set(0, 0, 0);
    return true;
  }

  function update(dt = 0.016, keys = {}, viewQuat = new THREE.Quaternion()) {
    const safeDt = Math.max(0.0005, Math.min(0.1, Number(dt) || 0.016));
    const isStabilizing = Boolean(keys.x);
    const isBoosting = Boolean(keys.shift);

    if (anchoredRailId) {
      velocity.set(0, 0, 0);
      return {
        position: position.clone(),
        velocity: velocity.clone(),
        speed: 0,
        mode: activeMode,
        anchoredRailId,
        isStabilizing: false,
        isBoosting: false,
      };
    }

    const fwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const strafe = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const vert = (keys[' '] || keys.space ? 1 : 0) - (keys.control || keys.ctrl || keys.q ? 1 : 0);

    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(viewQuat).normalize();
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(viewQuat).normalize();
    const upVec = new THREE.Vector3(0, 1, 0);

    const thrustDir = new THREE.Vector3()
      .addScaledVector(forwardVec, fwd)
      .addScaledVector(rightVec, strafe)
      .addScaledVector(upVec, vert);

    const hasThrust = thrustDir.lengthSq() > 1e-4;
    if (hasThrust) {
      thrustDir.normalize();
      const accel = baseAccelMps2 * (isBoosting ? boostMult : 1.0);
      velocity.addScaledVector(thrustDir, accel * safeDt);
    }

    if (isStabilizing) {
      velocity.multiplyScalar(Math.max(0, Math.exp(-safeDt * 6.8)));
    } else if (activeMode === MICROGRAVITY_MODES.ASSISTED && !hasThrust) {
      // Smooth RCS auto-damping brings drift gently to rest when no thrusters fire
      velocity.multiplyScalar(Math.max(0, Math.exp(-safeDt * 2.8)));
    } else if (activeMode === MICROGRAVITY_MODES.FREE) {
      // Pure Newtonian conservation (minus minuscule air-drag in pressurized cabin)
      velocity.multiplyScalar(Math.max(0, Math.exp(-safeDt * 0.04)));
    }

    const speedLimit = (activeMode === MICROGRAVITY_MODES.FREE ? maxFreeSpeed : maxAssistedSpeed) * (isBoosting ? 1.45 : 1.0);
    if (velocity.length() > speedLimit) {
      velocity.setLength(speedLimit);
    }
    if (velocity.length() < 0.004 && !hasThrust) {
      velocity.set(0, 0, 0);
    }

    const prevPos = position.clone();
    position.addScaledVector(velocity, safeDt);
    if (typeof clampPositionFn === 'function') {
      clampPositionFn(position);
      // Dampen velocity along axes blocked cleanly by walls/bulkheads to avoid jitter
      const intended = prevPos.clone().addScaledVector(velocity, safeDt);
      if (Math.abs(position.x - intended.x) > 0.002) velocity.x *= 0.15;
      if (Math.abs(position.y - intended.y) > 0.002) velocity.y *= 0.15;
      if (Math.abs(position.z - intended.z) > 0.002) velocity.z *= 0.15;
    }

    return {
      position: position.clone(),
      velocity: velocity.clone(),
      speed: Number(velocity.length().toFixed(3)),
      mode: activeMode,
      anchoredRailId,
      isStabilizing,
      isBoosting,
    };
  }

  return {
    getMode: () => activeMode,
    setMode,
    getSpeed: () => Number(velocity.length().toFixed(3)),
    getVelocity: () => velocity.clone(),
    getPosition: () => position.clone(),
    setPosition,
    isAnchored: () => Boolean(anchoredRailId),
    getAnchoredRailId: () => anchoredRailId,
    toggleAnchor,
    update,
  };
}
