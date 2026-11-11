import fs from 'node:fs';
import {performance}from 'node:perf_hooks';
import * as THREE from 'three';
import {parseFits as baseline}from 'file:///C:/Users/OPPENHEIMER/Desktop/KRONOX-main/src/utils/fitsImage.js';
import {parseFits as changed}from '../src/utils/fitsImage.js';
const bytes=fs.readFileSync('public/demo/m31/D5.fits'),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),center={ra:10.6847083,dec:41.26875};
function measure(fn,gridSize){const values=[];for(let i=0;i<8;i++){const start=performance.now();fn(buffer,null,center,{gridSize,fovDeg:.5});const elapsed=performance.now()-start;if(i>=3)values.push(elapsed);}values.sort((a,b)=>a-b);return {medianMs:values[2],minMs:values[0],maxMs:values[4],runs:5,gridSize,fovDeg:.5};}
// Alternate warmups; this measures CPU decoding/reprojection, NOT GPU/frame rate.
baseline(buffer,null,center);changed(buffer,null,center);
const result={date:new Date().toISOString(),scope:'Node CPU benchmark, identical FITS/center/300px/.5deg; no browser or GPU FPS measured',baseline300:measure(baseline,300),changed300:measure(changed,300),changed96:{...measure(changed,96),note:'Different display resolution, provided separately; not a like-for-like FPS comparison'},geometryBudget:{beforeTriangles:new THREE.SphereGeometry(1,48,32).index.count/3,afterTriangles:new THREE.SphereGeometry(1,24,16).index.count/3,scope:'Single star mesh; excludes other scene geometry'},gpuBeforeAfter:null,reason:'Windows automation stopped before visual traversal; no fabricated performance result'};
fs.writeFileSync('docs/juan/performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
