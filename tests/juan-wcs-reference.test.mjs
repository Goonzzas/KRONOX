import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseFits} from '../src/utils/fitsImage.js';
const reference=JSON.parse(fs.readFileSync(new URL('../docs/juan/wcs-reference.json',import.meta.url),'utf8'));
test('Independent Astropy/WCSLIB reference: 39 spatial and LVF wavelength positions in 13 real FITS',()=>{for(const product of reference.products){const bytes=fs.readFileSync(new URL('../'+product.file,import.meta.url));const f=parseFits(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),null,null,{gridSize:32,fovDeg:.08});for(const expected of product.samples){const actual=f.wcsWave.evaluateAtCutoutPixel(expected.xFits,expected.yFits);assert.ok(Math.abs(actual.wavelengthUm-expected.wave)<.0001,product.file+' wavelength');assert.ok(Math.abs(actual.bandwidthUm-expected.bandwidth)<.0001,product.file+' bandwidth');const sky=f.wcs.pixelToWorld(expected.xFits,expected.yFits);assert.ok(Math.abs(sky.ra-expected.ra)<1e-7,product.file+' RA');assert.ok(Math.abs(sky.dec-expected.dec)<1e-7,product.file+' Dec');}}});
