export function parseFits(buffer, fixedRange = null) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0,
    image = null;
  while (offset + 2880 <= bytes.length) {
    let header = '',
      end = false;
    while (offset + 2880 <= bytes.length && !end) {
      const block = new TextDecoder('ascii').decode(bytes.subarray(offset, offset + 2880));
      offset += 2880;
      header += block;
      end = (block.match(/.{80}/g) || []).some((card) => card.slice(0, 8).trim() === 'END');
    }
    if (!end) break;
    const cards = header.match(/.{80}/g) || [];
    const values = {};
    for (const card of cards) {
      const key = card.slice(0, 8).trim();
      if (card[8] === '=' && key)
        values[key] = card.slice(10).split('/')[0].trim().replace(/^'|'$/g, '').trim();
    }
    const bitpix = Number(values.BITPIX || 8),
      naxis = Number(values.NAXIS || 0);
    const dimensions = Array.from({ length: naxis }, (_, i) =>
      Number(values[`NAXIS${i + 1}`] || 0),
    );
    const count = dimensions.reduce((total, size) => total * size, naxis ? 1 : 0);
    const bytesPerValue = Math.abs(bitpix) / 8;
    const dataSize = Math.ceil((count * bytesPerValue + Number(values.PCOUNT || 0)) / 2880) * 2880;
    if (
      count &&
      dimensions.length >= 2 &&
      (values.EXTNAME === 'IMAGE' || (!image && values.SIMPLE === 'T'))
    ) {
      image = {
        offset,
        count,
        width: dimensions[0],
        height: dimensions[1],
        bitpix,
        bzero: Number(values.BZERO || 0),
        bscale: Number(values.BSCALE || 1),
      };
    }
    offset += dataSize;
  }
  if (!image) throw new Error('El archivo FITS no contiene una imagen legible.');
  const { offset: start, count, width, height, bitpix, bzero, bscale } = image;
  const pixels = new Float32Array(count);
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < count; i++) {
    const at = start + (i * Math.abs(bitpix)) / 8;
    let value;
    if (bitpix === -32) value = view.getFloat32(at, false);
    else if (bitpix === -64) value = view.getFloat64(at, false);
    else if (bitpix === 16) value = view.getInt16(at, false);
    else if (bitpix === 32) value = view.getInt32(at, false);
    else if (bitpix === 8) value = view.getUint8(at);
    else throw new Error(`Formato FITS BITPIX=${bitpix} no compatible.`);
    value = value * bscale + bzero;
    pixels[i] = value;
    if (Number.isFinite(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const histogram = new Uint32Array(4096);
  const span = Math.max(1e-20, max - min);
  let validCount = 0;
  for (const value of pixels)
    if (Number.isFinite(value)) {
      histogram[Math.min(4095, Math.floor(((value - min) / span) * 4096))]++;
      validCount++;
    }
  const percentile = (fraction) => {
    let sum = 0;
    for (let i = 0; i < histogram.length; i++) {
      sum += histogram[i];
      if (sum >= validCount * fraction) return min + (i / 4095) * span;
    }
    return max;
  };
  const low = fixedRange?.low ?? percentile(0.02),
    high = fixedRange?.high ?? percentile(0.995),
    stretch = Math.max(1e-20, high - low);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const frame = ctx.createImageData(width, height);
  for (let i = 0; i < count; i++) {
    const scaled = Math.max(
      0,
      Math.min(255, Math.sqrt(Math.max(0, (pixels[i] - low) / stretch)) * 255),
    );
    const at = i * 4;
    frame.data[at] = scaled * 0.68;
    frame.data[at + 1] = scaled * 0.82;
    frame.data[at + 2] = scaled;
    frame.data[at + 3] = 255;
  }
  ctx.putImageData(frame, 0, 0);
  return { src: canvas.toDataURL('image/png'), range: fixedRange || { low, high } };
}
