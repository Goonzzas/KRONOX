import * as THREE from 'three';

/**
 * KRONOX 3D Microgravity Physics Engine & 6-DOF Controller.
 *
 * Implements physically authentic microgravity movement for the 1.75m astronaut:
 * - 6-DOF Velocity, Acceleration, Inertia, and Damping.
 * - Controls:
 *   - WASD: Forward/Back/Left/Right planar thrust relative to camera view.
 *   - Space: Upward vertical thrust (+Y).
 *   - Ctrl: Downward vertical thrust (-Y).
 *   - Shift: Burst RCS thrust (2.2x impulse).
 *   - X: Active Position Stabilization (RCS dampeners actively brake velocity to 0).
 *   - E: Grab handrail / anchor to console (clamps position rigidly).
 * - Two selectable flight difficulty modes:
 *   - ASSISTED: Automatic soft damping (tau = 1.4s), ideal for exploration & science.
 *   - FREE: Pure Newtonian inertia (damping = 0.002/s), true space mechanics.
 */

export const MICROGRAVITY_MODES = Object.freeze({
  ASSISTED: 'ASSISTED',
  FREE: 'FREE',
});

export function createMicrogravityPhysicsController({
  initialPosition = new THREE.Vector3(0, 3.4, -30.0), // Starts on Deck 01 (Bridge)
  mode = MICROGRAVITY_MODES.ASSISTED,
  clampPositionFn = null,
} = {}) {
  const position = initialPosition.clone();
  const velocity = new THREE.Vector3(0, 0, 0);
  const acceleration = new THREE.Vector3(0, 0, 0);

  let currentMode = mode;
  let isAnchored = false;
  let anchoredPosition = new THREE.Vector3();
  let isStabilizing = false;
  let activeGrabRail = null;

  // Physical Constants in 1 unit = 1 meter
  const BASE_THRUST_ACCEL = 4.2; // m/s^2
  const BURST_MULTIPLIER = 2.4;
  const MAX_SPEED = 6.5; // m/s
  const ASSISTED_DAMPING = 2.8; // Exponential braking factor
  const FREE_DAMPING = 0.05; // Vacuum residual friction

  const update = (dt = 0.016, keys = {}, cameraQuaternion = null, nearbyGrabRail = null) => {
    // If anchored to a handrail or console via [E], fix position in space
    if (isAnchored) {
      velocity.set(0, 0, 0);
      acceleration.set(0, 0, 0);
      position.copy(anchoredPosition);
      return {
        position: position.clone(),
        velocity: velocity.clone(),
        speed: 0,
        isAnchored: true,
        isThrusting: false,
        isStabilizing: false,
        activeGrabRail,
      };
    }

    // Determine camera direction vectors in 3D
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);

    if (cameraQuaternion) {
      forward.applyQuaternion(cameraQuaternion);
      right.applyQuaternion(cameraQuaternion);
      // Up direction in camera space
      up.crossVectors(right, forward).normalize();
    }

    acceleration.set(0, 0, 0);
    let thrusting = false;

    // Evaluate Input Commands
    const thrustStrength = (keys['shift'] ? BURST_MULTIPLIER : 1.0) * BASE_THRUST_ACCEL;

    if (keys['w'] || keys['arrowup']) {
      acceleration.addScaledVector(forward, thrustStrength);
      thrusting = true;
    }
    if (keys['s'] || keys['arrowdown']) {
      acceleration.addScaledVector(forward, -thrustStrength);
      thrusting = true;
    }
    if (keys['d'] || keys['arrowright']) {
      acceleration.addScaledVector(right, thrustStrength);
      thrusting = true;
    }
    if (keys['a'] || keys['arrowleft']) {
      acceleration.addScaledVector(right, -thrustStrength);
      thrusting = true;
    }
    // Vertical Microgravity Impulses
    if (keys[' '] || keys['space']) {
      // Space: ascend (+Y)
      acceleration.y += thrustStrength * 0.9;
      thrusting = true;
    }
    if (keys['control'] || keys['c'] && keys['ctrlKey']) {
      // Ctrl: descend (-Y)
      acceleration.y -= thrustStrength * 0.9;
      thrusting = true;
    }

    // Active Stabilization Brake [X]
    isStabilizing = Boolean(keys['x']);
    if (isStabilizing && !thrusting) {
      const brakeFactor = Math.max(0, 1.0 - 5.5 * dt);
      velocity.multiplyScalar(brakeFactor);
      if (velocity.length() < 0.05) velocity.set(0, 0, 0);
    }

    // Integrate Physics Equations: V += A * dt, P += V * dt
    velocity.addScaledVector(acceleration, dt);

    // Apply Mode-Dependent Damping
    if (!thrusting && !isStabilizing) {
      const dampingRate = currentMode === MICROGRAVITY_MODES.ASSISTED ? ASSISTED_DAMPING : FREE_DAMPING;
      velocity.multiplyScalar(Math.max(0, 1.0 - dampingRate * dt));
    }

    // Clamp terminal zero-G velocity
    if (velocity.length() > MAX_SPEED) {
      velocity.setLength(MAX_SPEED);
    }

    // Apply translation
    position.addScaledVector(velocity, dt);

    // Prevent bulkhead clipping using deck spatial boundaries
    if (clampPositionFn) {
      clampPositionFn(position);
    }

    return {
      position: position.clone(),
      velocity: velocity.clone(),
      speed: velocity.length(),
      isAnchored: false,
      isThrusting: thrusting,
      isStabilizing,
      activeGrabRail,
    };
  };

  const toggleAnchor = (nearbyRail = null) => {
    if (isAnchored) {
      isAnchored = false;
      activeGrabRail = null;
    } else {
      isAnchored = true;
      activeGrabRail = nearbyRail;
      anchoredPosition.copy(position);
    }
    return isAnchored;
  };

  const setPosition = (newPos) => {
    position.copy(newPos);
    if (isAnchored) anchoredPosition.copy(newPos);
  };

  const setVelocity = (newVel) => {
    velocity.copy(newVel);
  };

  const setMode = (newMode) => {
    if (MICROGRAVITY_MODES[newMode]) {
      currentMode = newMode;
    }
  };

  return {
    getPosition: () => position.clone(),
    getVelocity: () => velocity.clone(),
    getSpeed: () => velocity.length(),
    isAnchored: () => isAnchored,
    isStabilizing: () => isStabilizing,
    getMode: () => currentMode,
    setMode,
    setPosition,
    setVelocity,
    toggleAnchor,
    update,
  };
}
