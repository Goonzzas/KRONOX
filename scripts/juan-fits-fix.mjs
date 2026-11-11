import fs from 'node:fs';
const file='src/utils/fitsImage.js';let s=fs.readFileSync(file,'utf8');
s=s.replace('const detX = crpix1w !== 0 ? xFits - crpix1w : xFits;','const detX = Number(imageHeaderValues.CRVAL1W ?? 1) + Number(imageHeaderValues.CDELT1W ?? 1) * (xFits - crpix1w);');
s=s.replace('const detY = crpix2w !== 0 ? yFits - crpix2w : yFits;','const detY = Number(imageHeaderValues.CRVAL2W ?? 1) + Number(imageHeaderValues.CDELT2W ?? 1) * (yFits - crpix2w);');
s=s.replace('const bx = findBracket(xGrid, detX);','if(detX < xGrid[0] || detX > xGrid[nx-1] || detY < yGrid[0] || detY > yGrid[ny-1]) return null;\n    const bx = findBracket(xGrid, detX);');
s=s.replace('gridSize: 300,\n      fovDeg: 0.5,','gridSize: options.gridSize || 300,\n      fovDeg: options.fovDeg || 0.5,');
s=s.replace("let regime = 'comparable';","let regime = 'comparable';");
s=s.replace("if (!sameDetector) {\n    regime = 'different-detector';","if (!Number.isFinite(lamA) || !Number.isFinite(lamB) || !sameDetector && !detA && !detB) {\n    regime = 'unknown';\n    reasonEs = 'Falta calibración espectral: no se puede afirmar comparabilidad temporal.';\n    reasonEn = 'Spectral calibration is missing; temporal comparability cannot be asserted.';\n  } else if (!sameDetector) {\n    regime = 'different-detector';");
fs.writeFileSync(file,s);
