import fs from 'node:fs';
import crypto from 'node:crypto';
import {LOCAL_OBSERVATIONS}from '../src/data/localObservations.js';
const root='http://127.0.0.1:5173/KRONOX/';const results=[];
const html=await fetch(root);if(!html.ok)throw Error('Local app unavailable');results.push({url:root,status:html.status});
for(const t of LOCAL_OBSERVATIONS.targets)for(const record of t.records){const url=root+'demo/'+record.localFile;const response=await fetch(url);const bytes=Buffer.from(await response.arrayBuffer());if(!response.ok||crypto.createHash('sha256').update(bytes).digest('hex')!==record.localSha256)throw Error('Bad local product '+url);results.push({file:record.localFile,status:response.status,bytes:bytes.length,sha256:record.localSha256});}
const bad=await fetch('http://127.0.0.1:5173/api/spherex?action=search&ra=999&dec=0');if(bad.status!==400)throw Error('API validation failed');results.push({check:'invalid-coordinates',status:bad.status});
fs.writeFileSync('docs/juan/http-local.json',JSON.stringify({date:new Date().toISOString(),scope:'Actual HTTP delivery on loopback, not browser UI or GPU validation',requests:results},null,2));console.log('HTTP verified: root, 13 byte-identical FITS, API invalid-input error');
