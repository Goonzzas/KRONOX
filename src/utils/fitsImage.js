const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function parseWcs(values) {
  if (!values) return null;
  const crpix1 = Number(values.CRPIX1);
  const crpix2 = Number(values.CRPIX2);
  const crval1 = Number(values.CRVAL1);
  const crval2 = Number(values.CRVAL2);
  if (
    !Number.isFinite(crpix1) ||
    !Number.isFinite(crpix2) ||
    !Number.isFinite(crval1) ||
    !Number.isFinite(crval2)
  ) {
    return null;
  }

  const cdelt1 = Number(values.CDELT1 ?? 1);
  const cdelt2 = Number(values.CDELT2 ?? 1);
  const hasCd =
    values.CD1_1 !== undefined ||
    values.CD1_2 !== undefined ||
    values.CD2_1 !== undefined ||
    values.CD2_2 !== undefined;
  const cd11 = hasCd ? Number(values.CD1_1 || 0) : cdelt1 * Number(values.PC1_1 ?? 1);
  const cd12 = hasCd ? Number(values.CD1_2 || 0) : cdelt1 * Number(values.PC1_2 ?? 0);
  const cd21 = hasCd ? Number(values.CD2_1 || 0) : cdelt2 * Number(values.PC2_1 ?? 0);
  const cd22 = hasCd ? Number(values.CD2_2 || 0) : cdelt2 * Number(values.PC2_2 ?? 1);

  const det = cd11 * cd22 - cd12 * cd21;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-25) {
    return null;
  }
  const inv11 = cd22 / det;
  const inv12 = -cd12 / det;
  const inv21 = -cd21 / det;
  const inv22 = cd11 / det;

  const readSip = (prefix, orderKey) => {
    const order = Number(values[orderKey] ?? -1);
    if (!Number.isFinite(order) || order < 0) return null;
    const terms = [];
    for (let p = 0; p <= order; p++) {
      for (let q = 0; q <= order - p; q++) {
        const coeff = Number(values[`${prefix}_${p}_${q}`] || 0);
        if (coeff !== 0) terms.push({ p, q, coeff });
      }
    }
    return terms.length ? terms : null;
  };

  const aSip = readSip('A', 'A_ORDER');
  const bSip = readSip('B', 'B_ORDER');
  const apSip = readSip('AP', 'AP_ORDER');
  const bpSip = readSip('BP', 'BP_ORDER');

  const evalSip = (terms, u, v) => {
    if (!terms) return 0;
    let sum = 0;
    for (let i = 0; i < terms.length; i++) {
      const { p, q, coeff } = terms[i];
      let powU = 1;
      for (let k = 0; k < p; k++) powU *= u;
      let powV = 1;
      for (let k = 0; k < q; k++) powV *= v;
      sum += coeff * powU * powV;
    }
    return sum;
  };

  const alpha0 = crval1 * DEG2RAD;
  const delta0 = crval2 * DEG2RAD;
  const sinD0 = Math.sin(delta0);
  const cosD0 = Math.cos(delta0);

  const pixelToWorld = (xFits, yFits) => {
    const u = xFits - crpix1;
    const v = yFits - crpix2;
    const uPrime = u + evalSip(aSip, u, v);
    const vPrime = v + evalSip(bSip, u, v);
    const xi = (cd11 * uPrime + cd12 * vPrime) * DEG2RAD;
    const eta = (cd21 * uPrime + cd22 * vPrime) * DEG2RAD;
    const denom = cosD0 - eta * sinD0;
    const raRad = alpha0 + Math.atan2(xi, denom);
    const decRad = Math.atan2(sinD0 + eta * cosD0, Math.hypot(xi, denom));
    return {
      ra: (((raRad * RAD2DEG) % 360) + 360) % 360,
      dec: decRad * RAD2DEG,
    };
  };

  const worldToPixel = (ra, dec) => {
    const alpha = ra * DEG2RAD;
    const delta = dec * DEG2RAD;
    const dAlpha = alpha - alpha0;
    const sinD = Math.sin(delta);
    const cosD = Math.cos(delta);
    const cosDcosA = cosD * Math.cos(dAlpha);
    const denom = sinD * sinD0 + cosDcosA * cosD0;
    if (denom <= 0) return null;
    const xi = ((cosD * Math.sin(dAlpha)) / denom) * RAD2DEG;
    const eta = ((sinD * cosD0 - cosDcosA * sinD0) / denom) * RAD2DEG;
    const uPrime = inv11 * xi + inv12 * eta;
    const vPrime = inv21 * xi + inv22 * eta;

    let u = uPrime + evalSip(apSip, uPrime, vPrime);
    let v = vPrime + evalSip(bpSip, uPrime, vPrime);
    if (aSip || bSip) {
      for (let iter = 0; iter < 3; iter++) {
        const fu = u + evalSip(aSip, u, v) - uPrime;
        const fv = v + evalSip(bSip, u, v) - vPrime;
        u -= fu;
        v -= fv;
      }
    }
    return { xFits: u + crpix1, yFits: v + crpix2 };
  };

  const pixelScaleDeg = Math.sqrt(Math.abs(det));
  const rotationDeg = Math.atan2(cd12, -cd11) * RAD2DEG;

  return {
    crpix1,
    crpix2,
    crval1,
    crval2,
    cd11,
    cd12,
    cd21,
    cd22,
    ctype1: values.CTYPE1 || 'RA---TAN',
    ctype2: values.CTYPE2 || 'DEC--TAN',
    hasSip: Boolean(aSip || bSip),
    pixelScaleDeg,
    pixelScaleArcsec: pixelScaleDeg * 3600,
    rotationDeg,
    pixelToWorld,
    worldToPixel,
  };
}

export function sampleDetectorBilinear(pixels, width, height, xFits, yFits) {
  const x = xFits - 1;
  const y = yFits - 1;
  if (x < -0.5 || x > width - 0.5 || y < -0.5 || y > height - 0.5) {
    return NaN;
  }
  const xClamped = Math.max(0, Math.min(width - 1, x));
  const yClamped = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(xClamped);
  const y0 = Math.floor(yClamped);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = xClamped - x0;
  const fy = yClamped - y0;

  const v00 = pixels[y0 * width + x0];
  const v10 = pixels[y0 * width + x1];
  const v01 = pixels[y1 * width + x0];
  const v11 = pixels[y1 * width + x1];

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  let sum = 0;
  let weight = 0;
  if (Number.isFinite(v00)) {
    sum += v00 * w00;
    weight += w00;
  }
  if (Number.isFinite(v10)) {
    sum += v10 * w10;
    weight += w10;
  }
  if (Number.isFinite(v01)) {
    sum += v01 * w01;
    weight += w01;
  }
  if (Number.isFinite(v11)) {
    sum += v11 * w11;
    weight += w11;
  }
  return weight > 0 ? sum / weight : NaN;
}

export function reprojectToCommonSkyGrid(
  pixels,
  width,
  height,
  wcs,
  center,
  options = {},
) {
  const gridSize = options.gridSize || 300;
  const fovDeg = options.fovDeg || 0.5;
  const scaleDeg = fovDeg / gridSize;
  const alphaCenter = center.ra * DEG2RAD;
  const deltaCenter = center.dec * DEG2RAD;
  const sinDc = Math.sin(deltaCenter);
  const cosDc = Math.cos(deltaCenter);
  const cx = (gridSize - 1) / 2;
  const cy = (gridSize - 1) / 2;

  const out = new Float32Array(gridSize * gridSize);
  out.fill(NaN);
  let validPixelCount = 0;

  const gridToWorld = (col, row) => {
    const xi = -(col - cx) * scaleDeg * DEG2RAD;
    const eta = -(row - cy) * scaleDeg * DEG2RAD;
    const denom = cosDc - eta * sinDc;
    const raRad = alphaCenter + Math.atan2(xi, denom);
    const decRad = Math.atan2(sinDc + eta * cosDc, Math.hypot(xi, denom));
    return {
      ra: (((raRad * RAD2DEG) % 360) + 360) % 360,
      dec: decRad * RAD2DEG,
    };
  };

  const worldToGrid = (ra, dec) => {
    const alpha = ra * DEG2RAD;
    const delta = dec * DEG2RAD;
    const dAlpha = alpha - alphaCenter;
    const sinD = Math.sin(delta);
    const cosD = Math.cos(delta);
    const cosDcosA = cosD * Math.cos(dAlpha);
    const denom = sinD * sinDc + cosDcosA * cosDc;
    if (denom <= 0) return null;
    const xiDeg = ((cosD * Math.sin(dAlpha)) / denom) * RAD2DEG;
    const etaDeg = ((sinD * cosDc - cosDcosA * sinDc) / denom) * RAD2DEG;
    const col = cx - xiDeg / scaleDeg;
    const row = cy - etaDeg / scaleDeg;
    return {
      col,
      row,
      xPercent: ((col + 0.5) / gridSize) * 100,
      yPercent: ((row + 0.5) / gridSize) * 100,
    };
  };

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const sky = gridToWorld(col, row);
      const det = wcs.worldToPixel(sky.ra, sky.dec);
      if (!det) continue;
      const value = sampleDetectorBilinear(pixels, width, height, det.xFits, det.yFits);
      if (Number.isFinite(value)) {
        out[row * gridSize + col] = value;
        validPixelCount++;
      }
    }
  }

  return {
    pixels: out,
    width: gridSize,
    height: gridSize,
    fovDeg,
    scaleDeg,
    validPixelCount,
    coverageFraction: validPixelCount / (gridSize * gridSize),
    gridToWorld,
    worldToGrid,
  };
}

export function parseFits(buffer, fixedRange = null, targetCenter = null) {
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
        values,
      };
    }
    offset += dataSize;
  }
  if (!image) throw new Error('El archivo FITS no contiene una imagen legible.');
  const { offset: start, count, width: rawWidth, height: rawHeight, bitpix, bzero, bscale, values } =
    image;
  const rawPixels = new Float32Array(count);
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
    rawPixels[i] = value;
    if (Number.isFinite(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  // Compute intensity percentiles strictly from the valid measured detector pixels
  // so no-coverage padding (NaN) never biases the photometric stretch.
  const histogram = new Uint32Array(4096);
  const span = Math.max(1e-20, max - min);
  let validCount = 0;
  for (const value of rawPixels)
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
  const low = fixedRange?.low ?? percentile(0.03),
    high = fixedRange?.high ?? percentile(0.997),
    stretch = Math.max(1e-20, high - low);

  const wcs = parseWcs(values);
  const center =
    targetCenter && Number.isFinite(targetCenter.ra) && Number.isFinite(targetCenter.dec)
      ? targetCenter
      : wcs
        ? wcs.pixelToWorld((rawWidth + 1) / 2, (rawHeight + 1) / 2)
        : null;

  let renderPixels = rawPixels;
  let width = rawWidth;
  let height = rawHeight;
  let reprojected = null;

  if (wcs && center) {
    reprojected = reprojectToCommonSkyGrid(rawPixels, rawWidth, rawHeight, wcs, center, {
      gridSize: 300,
      fovDeg: 0.5,
    });
    renderPixels = reprojected.pixels;
    width = reprojected.width;
    height = reprojected.height;
  } else {
    // Fallback if a FITS file lacks WCS headers: still flip Y so FITS row 0 is at the bottom
    const flipped = new Float32Array(count);
    for (let y = 0; y < rawHeight; y++) {
      const srcRow = (rawHeight - 1 - y) * rawWidth;
      const dstRow = y * rawWidth;
      for (let x = 0; x < rawWidth; x++) {
        flipped[dstRow + x] = rawPixels[srcRow + x];
      }
    }
    renderPixels = flipped;
  }

  if (typeof document === 'undefined') {
    return {
      src: '',
      range: fixedRange || { low, high },
      width,
      height,
      rawWidth,
      rawHeight,
      wcs,
      reprojected,
      scientificPixels: renderPixels,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const frame = ctx.createImageData(width, height);
  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i++) {
    const val = renderPixels[i];
    const at = i * 4;
    if (!Number.isFinite(val)) {
      // No-coverage zone: transparent/deep space background, never confused with 0 intensity
      frame.data[at] = 3;
      frame.data[at + 1] = 6;
      frame.data[at + 2] = 14;
      frame.data[at + 3] = 0;
      continue;
    }
    const normalized = Math.max(0, Math.min(1, (val - low) / stretch));
    const scaled = Math.max(0, Math.min(255, Math.pow(normalized, 0.72) * 255));
    frame.data[at] = scaled * 0.68;
    frame.data[at + 1] = scaled * 0.82;
    frame.data[at + 2] = scaled;
    frame.data[at + 3] = 255;
  }
  ctx.putImageData(frame, 0, 0);
  // Add a restrained, explicitly visual halo around the strongest measured
  // pixels so compact sources stay easy to spot when the small FITS cutout is
  // enlarged in the browser. Pixel values and the comparison stretch remain
  // unchanged; the glow is only a viewing aid.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = renderPixels[y * width + x];
      if (!Number.isFinite(val)) continue;
      const normalized = (val - low) / stretch;
      if (!Number.isFinite(normalized) || normalized < 0.72) continue;
      const alpha = Math.min(0.34, (normalized - 0.72) * 0.8);
      const glow = ctx.createRadialGradient(x + 0.5, y + 0.5, 0, x + 0.5, y + 0.5, 2.3);
      glow.addColorStop(0, `rgba(160, 222, 255, ${alpha})`);
      glow.addColorStop(1, 'rgba(100, 180, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 2, y - 2, 5, 5);
    }
  }
  return {
    src: canvas.toDataURL('image/png'),
    range: fixedRange || { low, high },
    width,
    height,
    rawWidth,
    rawHeight,
    wcs,
    reprojected,
    scientificPixels: renderPixels,
  };
}
