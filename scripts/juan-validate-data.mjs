import fs from 'node:fs';
import {LOCAL_OBSERVATIONS} from '../src/data/localObservations.js';
import {SPHEREX_TARGETS} from '../src/data/spherexTargets.js';
import {parseFits} from '../src/utils/fitsImage.js';
import {sampleAperture} from '../src/utils/scientificEvidence.js';
for(const entry of LOCAL_OBSERVATIONS.targets){const target=SPHEREX_TARGETS.find(t=>t.key===entry.key);for(const record of entry.records){const b=fs.readFileSync('public/demo/'+record.localFile);const f=parseFits(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),null,{ra:target.ra,dec:target.dec},{zodiMode:'subtracted',gridSize:96,fovDeg:.08});f.record=record;const m=sampleAperture(f,target,{radiusArcsec:entry.type==='galaxia'?24.6:12.3});record.units=f.extensions.imageUnit;record.wavelengthAtTargetUm=f.spectral?.wavelengthUm;record.bandwidthUm=f.spectral?.bandwidthUm;console.log(entry.key,record.band,JSON.stringify({flux:m.flux,sigma:m.sigma,wave:m.wave,valid:m.valid,total:m.total}));}}
fs.writeFileSync('src/data/localObservations.js','export const LOCAL_OBSERVATIONS = '+JSON.stringify(LOCAL_OBSERVATIONS,null,2)+';\n');fs.writeFileSync('public/demo/manifest.json',JSON.stringify(LOCAL_OBSERVATIONS,null,2));
