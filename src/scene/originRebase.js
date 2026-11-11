import { Vector3 } from 'three';
/** Draw in a camera-relative frame, then restore all simulation coordinates. No astronomical metadata changes. */
export function renderWithOriginRebase(
  renderer,
  scene,
  camera,
  { threshold = 10000, cellSize = 1024 } = {},
) {
  if (camera.parent || camera.position.length() < threshold) {
    renderer.render(scene, camera);
    return { rebased: false, origin: [0, 0, 0] };
  }
  const position = camera.position.clone(),
    root = scene.position.clone(),
    origin = new Vector3(...position.toArray().map((v) => Math.round(v / cellSize) * cellSize));
  try {
    scene.position.sub(origin);
    camera.position.sub(origin);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);
    return { rebased: true, origin: origin.toArray() };
  } finally {
    scene.position.copy(root);
    camera.position.copy(position);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
  }
}
