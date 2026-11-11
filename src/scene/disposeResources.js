/** Dispose scene-owned GPU assets once, including shared maps, shader samplers and background textures. */
export function disposeSceneResources(scene, disposed = new Set()) {
  const assets = new Set();
  const add = (value) => {
    if (value?.dispose) assets.add(value);
  };
  const texture = (value) => {
    if (value?.isTexture) add(value);
    else if (Array.isArray(value)) value.forEach(texture);
  };
  scene.traverse((node) => {
    add(node.geometry);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      add(material);
      Object.values(material).forEach(texture);
      for (const uniform of Object.values(material.uniforms || {})) texture(uniform?.value);
    }
    texture(node.skeleton?.boneTexture);
  });
  texture(scene.background);
  texture(scene.environment);
  for (const asset of assets)
    if (!disposed.has(asset)) {
      asset.dispose();
      disposed.add(asset);
    }
  return disposed;
}
