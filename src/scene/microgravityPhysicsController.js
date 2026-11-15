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
  let isGrounded = true;

  const baseAccelMps2 = 5.4;
  const boostMult = 2.05;
  const maxAssistedSpeed = 3.25;
  const maxFreeSpeed = 4.65;

  // Vectores reutilizables para eliminar asignaciones por fotograma (cero presión al GC)
  const _fwdVec = new THREE.Vector3();
  const _rightVec = new THREE.Vector3();
  const _upVec = new THREE.Vector3(0, 1, 0);
  const _thrustDir = new THREE.Vector3();
  const _prevPos = new THREE.Vector3();
  const _intended = new THREE.Vector3();
  const _stepDisplacement = new THREE.Vector3();
  const _pushDelta = new THREE.Vector3();
  const _pushNormal = new THREE.Vector3();
  const _outPos = new THREE.Vector3();
  const _outVel = new THREE.Vector3();

  function setMode(nextMode) {
    if (Object.values(MICROGRAVITY_MODES).includes(nextMode)) {
      activeMode = nextMode;
    }
    return activeMode;
  }

  function setPosition(pos, preserveVelocity = false) {
    if (!pos) return position;
    position.set(Number(pos.x || 0), Number(pos.y || 0), Number(pos.z || 0));
    if (!preserveVelocity) velocity.set(0, 0, 0);
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
    const isStabilizing = Boolean(keys.x || keys.vrStabilize);
    const isBoosting = Boolean(keys.shift || keys.vrBoost);

    if (anchoredRailId) {
      velocity.set(0, 0, 0);
      _outPos.copy(position);
      _outVel.copy(velocity);
      return {
        position: _outPos,
        velocity: _outVel,
        speed: 0,
        mode: activeMode,
        anchoredRailId,
        isStabilizing: false,
        isBoosting: false,
      };
    }

    const clampAxis = (val) => (Number.isFinite(val) ? Math.max(-1, Math.min(1, val)) : 0);
    const kbFwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const kbStrafe = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const kbVert = (keys[' '] || keys.space ? 1 : 0) - (keys.control || keys.ctrl || keys.q ? 1 : 0);
    const fwd = clampAxis(kbFwd + clampAxis(keys.vrMoveFwd));
    const strafe = clampAxis(kbStrafe + clampAxis(keys.vrMoveStrafe));
    const vert = clampAxis(kbVert + clampAxis(keys.vrMoveVert));

    const isDeckWalking = typeof clampPositionFn === 'function' && activeMode === MICROGRAVITY_MODES.ASSISTED;

    if (isDeckWalking) {
      // Movimiento horizontal en el plano de la cubierta: mirar hacia arriba o abajo no levanta al astronauta
      _fwdVec.set(0, 0, -1).applyQuaternion(viewQuat);
      _fwdVec.y = 0;
      if (_fwdVec.lengthSq() > 1e-4) _fwdVec.normalize();
      else _fwdVec.set(0, 0, -1);

      _rightVec.set(1, 0, 0).applyQuaternion(viewQuat);
      _rightVec.y = 0;
      if (_rightVec.lengthSq() > 1e-4) _rightVec.normalize();
      else _rightVec.set(1, 0, 0);

      _thrustDir
        .set(0, 0, 0)
        .addScaledVector(_fwdVec, fwd)
        .addScaledVector(_rightVec, strafe);

      // Salto controlado únicamente si las botas están apoyadas en el suelo (evita salir despedido al cielo)
      if ((keys[' '] || keys.space || keys.vrJump) && isGrounded) {
        velocity.y = 2.4;
        isGrounded = false;
      }
      // Gravedad artificial simulada del casco: atrae firmemente las botas magnéticas a la cubierta
      velocity.y = Math.max(-8.0, velocity.y - 12.0 * safeDt);
    } else {
      _fwdVec.set(0, 0, -1).applyQuaternion(viewQuat).normalize();
      _rightVec.set(1, 0, 0).applyQuaternion(viewQuat).normalize();

      _thrustDir
        .set(0, 0, 0)
        .addScaledVector(_fwdVec, fwd)
        .addScaledVector(_rightVec, strafe)
        .addScaledVector(_upVec, vert);
    }

    const thrustSq = _thrustDir.lengthSq();
    const hasThrust = thrustSq > 1e-4;
    if (hasThrust) {
      const thrustMag = Math.min(1, Math.sqrt(thrustSq));
      _thrustDir.normalize();
      const accel = baseAccelMps2 * thrustMag * (isBoosting ? boostMult : 1.0);
      velocity.addScaledVector(_thrustDir, accel * safeDt);
    }

    if (isStabilizing) {
      velocity.multiplyScalar(Math.max(0, Math.exp(-safeDt * 8.5)));
    } else if (isDeckWalking && !hasThrust) {
      // Frenado horizontal inmediato y controlado al soltar las teclas de marcha
      velocity.x *= Math.max(0, Math.exp(-safeDt * 7.5));
      velocity.z *= Math.max(0, Math.exp(-safeDt * 7.5));
    } else if (activeMode === MICROGRAVITY_MODES.ASSISTED && !hasThrust) {
      // Amortiguación progresiva suave al soltar impulsores
      velocity.multiplyScalar(Math.max(0, Math.exp(-safeDt * 3.1)));
    } else if (activeMode === MICROGRAVITY_MODES.FREE) {
      velocity.multiplyScalar(Math.max(0, Math.exp(-safeDt * 0.04)));
    }

    const speedLimit = (activeMode === MICROGRAVITY_MODES.FREE ? maxFreeSpeed : maxAssistedSpeed) * (isBoosting ? 1.45 : 1.0);
    const speedSq = velocity.lengthSq();
    if (speedSq > speedLimit * speedLimit) {
      velocity.setLength(speedLimit);
    } else if (speedSq < 1.6e-5 && !hasThrust) {
      velocity.set(0, 0, 0);
    }

    _stepDisplacement.copy(velocity).multiplyScalar(safeDt);
    const displacementLen = _stepDisplacement.length();
    if (typeof clampPositionFn === 'function') {
      const maxStepDist = 0.085;
      const steps = displacementLen > 1e-5
        ? Math.min(12, Math.max(1, Math.ceil(displacementLen / maxStepDist)))
        : 1;
      const subStepDt = safeDt / steps;
      for (let s = 0; s < steps; s++) {
        _prevPos.copy(position);
        position.addScaledVector(velocity, subStepDt);
        _intended.copy(position);
        clampPositionFn(position, _prevPos);

        // Si la posición vertical fue restringida desde abajo, las botas tocaron el suelo
        if (position.y >= _intended.y - 1e-4 && velocity.y <= 0) {
          isGrounded = true;
          velocity.y = 0;
        } else if (position.y < _intended.y - 1e-4 && velocity.y > 0) {
          velocity.y = -0.2; // Tope contra el techo del puente/cubierta
        }

        _pushDelta.subVectors(position, _intended);
        const pushLenSq = _pushDelta.lengthSq();
        if (pushLenSq > 1e-8) {
          const pushLen = Math.sqrt(pushLenSq);
          _pushNormal.copy(_pushDelta).divideScalar(pushLen);
          const vn = velocity.dot(_pushNormal);
          if (vn < 0) {
            velocity.addScaledVector(_pushNormal, -vn);
          }
        }
      }
    } else {
      position.add(_stepDisplacement);
    }

    _outPos.copy(position);
    _outVel.copy(velocity);
    return {
      position: _outPos,
      velocity: _outVel,
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
