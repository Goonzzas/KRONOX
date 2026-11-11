export function compatibleRgb(frames) {
  if (
    frames.length !== 3 ||
    frames.some((f) => !f?.scientificPixels || !f.reprojected || !f.center)
  )
    return false;
  const [first] = frames;
  return frames.every(
    (f) =>
      f.width === first.width &&
      f.height === first.height &&
      f.reprojected.fovDeg === first.reprojected.fovDeg &&
      f.extensions.imageUnit === first.extensions.imageUnit &&
      Math.abs(f.center.ra - first.center.ra) < 1e-8 &&
      Math.abs(f.center.dec - first.center.dec) < 1e-8,
  );
}
export function rgbChannels(frames, intervals) {
  if (!compatibleRgb(frames))
    throw Error('Canales incompatibles: WCS, unidad o cuadrícula diferentes.');
  return frames.map((f, c) =>
    Float32Array.from(f.scientificPixels, (v, i) => {
      const wave = f.wavelengthPixels?.[i],
        interval = intervals[c];
      return Number.isFinite(wave) &&
        wave >= interval[0] &&
        wave <= interval[1] &&
        ((f.reprojected.flagsPixels?.[i] || 0) & ~((2 ** 21) | (2 ** 12))) === 0
        ? v
        : NaN;
    }),
  );
}
export function composeRgb({
  channels,
  width,
  height,
  stretch = 'asinh',
  gain = 1,
  contrast = 1,
  normalization = 'common',
}) {
  if (channels.length !== 3 || channels.some((a) => a.length !== width * height))
    throw Error('Se requieren tres planos de dimensiones idénticas.');
  const stats = channels.map((a) => {
    const v = Array.from(a)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    return v.length
      ? [v[Math.floor(v.length * 0.02)], v[Math.min(v.length - 1, Math.floor(v.length * 0.98))]]
      : [0, 1];
  });
  const low = Math.min(...stats.map((s) => s[0])),
    high = Math.max(...stats.map((s) => s[1]));
  const rgba = new Uint8ClampedArray(width * height * 4);
  let missing = 0;
  for (let i = 0; i < width * height; i++) {
    if (channels.some((ch) => !Number.isFinite(ch[i]))) {
      missing++;
      const checker = (((i % width) >> 2) + (Math.floor(i / width) >> 2)) % 2;
      rgba.set(checker ? [42, 52, 63, 255] : [10, 17, 24, 255], i * 4);
      continue;
    }
    for (let c = 0; c < 3; c++) {
      const [lo, hi] = normalization === 'channel' ? stats[c] : [low, high];
      let z = Math.max(0, (channels[c][i] - lo) / (hi - lo || 1));
      if (stretch === 'asinh') z = Math.asinh(10 * z) / Math.asinh(10);
      if (stretch === 'log') z = Math.log1p(100 * z) / Math.log(101);
      z = Math.max(0, (z - 0.5) * contrast + 0.5);
      rgba[i * 4 + c] = Math.round(Math.min(1, z * gain) * 255);
    }
    rgba[i * 4 + 3] = 255;
  }
  return {
    rgba,
    width,
    height,
    missing,
    low,
    high,
    stats,
    normalization,
    method:
      '2–98 percentile display scale. No PSF homogenization; nonlinear display does not preserve physical flux ratios.',
  };
}
