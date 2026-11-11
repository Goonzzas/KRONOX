import * as THREE from 'three';

/** Canvas labels use a bounded pixel footprint, independent of map units. */
export function createSceneLabel(text, _legacyScale = 0.4, fontSize = 30, documentRef = document) {
  const canvas = documentRef.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  let font = Math.min(32, Math.max(25, fontSize));
  ctx.font = `${font}px Segoe UI, sans-serif`;
  const measured = ctx.measureText?.(text)?.width;
  if (measured > 480) {
    font *= 480 / measured;
    ctx.font = `${font}px Segoe UI, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf6ff';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 5;
  ctx.fillText(text, 256, 42);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: false,
    }),
  );
  sprite.scale.set(0.24, 0.03, 1);
  sprite.center.set(0.5, 0.5);
  sprite.renderOrder = 9;
  sprite.userData.labelText = text;
  sprite.userData.pixelWidth = 220;
  sprite.userData.pixelHeight = 28;
  const scale = new THREE.Vector3();
  sprite.onBeforeRender = (renderer, scene, camera) => {
    const height = renderer.domElement?.clientHeight || globalThis.innerHeight || 800,
      focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 55) / 2));
    sprite.parent?.getWorldScale(scale);
    if (!sprite.parent) scale.set(1, 1, 1);
    sprite.scale.set(
      sprite.userData.pixelWidth / focal / Math.max(0.0001, Math.abs(scale.x)),
      sprite.userData.pixelHeight / focal / Math.max(0.0001, Math.abs(scale.y)),
      1,
    );
  };
  return sprite;
}
