import { Vector3 } from 'three';

/**
 * Compute the Float64 floating-origin offset for a camera or XR rig position.
 */
export function resolveOriginRebase64(position, position64 = null, cellSize = 1024) {
  const origin64 = new Float64Array(3);
  if (cellSize > 0) {
    origin64[0] = Math.round(position.x / cellSize) * cellSize;
    origin64[1] = Math.round(position.y / cellSize) * cellSize;
    origin64[2] = Math.round(position.z / cellSize) * cellSize;
  } else {
    origin64[0] = Number(position64?.[0] ?? position.x);
    origin64[1] = Number(position64?.[1] ?? position.y);
    origin64[2] = Number(position64?.[2] ?? position.z);
  }
  return origin64;
}

/**
 * Compensate planetary pivot positions in Float64 after `scene.position` has been shifted by `-origin64`.
 */
export function rebaseHighPrecisionBodies(scene, highPrecisionBodies, origin64) {
  const savedBodyPositions = [];
  if (!Array.isArray(highPrecisionBodies) || highPrecisionBodies.length === 0) {
    return savedBodyPositions;
  }
  for (let i = 0; i < highPrecisionBodies.length; i++) {
    const b = highPrecisionBodies[i];
    if (!b?.pivot || !b.heliocentricScene64) continue;
    savedBodyPositions.push([b.pivot, b.pivot.position.clone()]);
    // Since scene.position is shifted by -origin, set pivot local position so that
    // scene.position + pivot.position equals the exact Float64 difference (pos64 - origin64):
    const relX = b.heliocentricScene64[0] - origin64[0];
    const relY = b.heliocentricScene64[1] - origin64[1];
    const relZ = b.heliocentricScene64[2] - origin64[2];
    b.pivot.position.set(
      relX - scene.position.x,
      relY - scene.position.y,
      relZ - scene.position.z,
    );
  }
  return savedBodyPositions;
}

export function restoreHighPrecisionBodies(savedBodyPositions) {
  for (let i = 0; i < savedBodyPositions.length; i++) {
    const [pivot, savedPos] = savedBodyPositions[i];
    pivot.position.copy(savedPos);
  }
}

/**
 * Draw in a camera-relative frame (Floating Origin), subtracting the camera origin
 * in IEEE 754 double precision (Float64) when `highPrecisionBodies` or `cellSize === 0`
 * is provided, then restore all simulation coordinates in `finally`.
 */
export function renderWithOriginRebase(
  renderer,
  scene,
  camera,
  { threshold = 10000, cellSize = 1024, highPrecisionBodies = null } = {},
) {
  if (camera.parent || camera.position.length() < threshold) {
    renderer.render(scene, camera);
    return { rebased: false, origin: [0, 0, 0], precisionBits: 32 };
  }
  const position = camera.position.clone(),
    root = scene.position.clone();
  const origin64 = resolveOriginRebase64(position, camera.position64, cellSize);
  const origin = new Vector3(origin64[0], origin64[1], origin64[2]);
  let savedBodyPositions = [];
  try {
    scene.position.sub(origin);
    camera.position.sub(origin);
    savedBodyPositions = rebaseHighPrecisionBodies(scene, highPrecisionBodies, origin64);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);
    return {
      rebased: true,
      origin: [origin64[0], origin64[1], origin64[2]],
      precisionBits: 64,
    };
  } finally {
    restoreHighPrecisionBodies(savedBodyPositions);
    scene.position.copy(root);
    camera.position.copy(position);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
  }
}
