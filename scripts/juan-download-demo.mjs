import fs from 'node:fs';
import crypto from 'node:crypto';
import {SPHEREX_TARGETS} from '../src/data/spherexTargets.js';
import {parseCsv,extractScientificFits,fetchWithRetry} from '../api/spherex.js';
import {parseFits} from '../src/utils/fitsImage.js';
const old=key=>SPHEREX_TARGETS.find(t=>t.key===key);
const seeds=[{...old('barnard'),type:'estrella',identifier:'Gaia DR3 4472832130942575872',question:'¿Podemos distinguir brillo superficial de una detección de movimiento con estas muestras?'},
 {key:'m31',name:'M31 · Andrómeda (núcleo)',ra:10.6847083,dec:41.26875,type:'galaxia',identifier:'M 31 / NGC 224',distanceLy:2500000,distanceSource:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/',coordinateSource:'ICRS centro NGC 224; comprobar con WCS del recorte',question:'¿Qué brillo superficial tiene la apertura del núcleo y qué parte de la galaxia queda fuera del recorte?'},
 {...old('rw-aurigae'),type:'estrella joven',identifier:'Gaia DR3 156430822114424576',question:'¿Las muestras a distinta longitud de onda permiten demostrar variabilidad temporal o absorción?'}];
fs.mkdirSync('public/demo',{recursive:true});fs.mkdirSync('docs/juan/archive',{recursive:true});
const output={version:'juan-real-v1',queriedAt:new Date().toISOString(),origin:'NASA/IPAC IRSA SPHEREx QR2',targets:[]};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function save(){fs.writeFileSync('src/data/localObservations.js','// Generated from official IRSA responses. No synthetic observations.\nexport const LOCAL_OBSERVATIONS = '+JSON.stringify(output,null,2)+';\n');fs.writeFileSync('public/demo/manifest.json',JSON.stringify(output,null,2));}
for(const target of seeds){
 const dir='public/demo/'+target.key;fs.mkdirSync(dir,{recursive:true});
 const query=new URL('https://irsa.ipac.caltech.edu/SIA');for(const [k,v]of Object.entries({COLLECTION:'spherex_qr2',POS:`circle ${target.ra} ${target.dec} 0.01`,RESPONSEFORMAT:'CSV',MAXREC:'500'}))query.searchParams.set(k,v);
 let csv;if(target.key==='m31'&&fs.existsSync('docs/juan/m31-search.csv'))csv=fs.readFileSync('docs/juan/m31-search.csv','utf8');else{const r=await fetchWithRetry(query,{timeoutMs:25000},3);if(!r.ok){console.log(target.key,'query failed',r.status);continue;}csv=await r.text();}
 fs.writeFileSync(`docs/juan/archive/${target.key}.csv`,csv);const rows=parseCsv(csv).filter(r=>r.access_url?.startsWith('https://irsa.ipac.caltech.edu/ibe/data/spherex/'));
 const entry={key:target.key,name:target.name,identifier:target.identifier,ra:target.ra,dec:target.dec,type:target.type,question:target.question,coordinateSource:target.astrometry?.source||target.coordinateSource,distanceLy:target.distanceLy||null,distanceSource:target.distanceSource||null,queryUrl:query.href,archiveCount:rows.length,records:[],failures:[]};
 console.log(target.key,'archive',rows.length);
 // One usable sample per detector; a second D2 exposure is attempted for date-comparison diagnostics.
 for(const detector of [2,3,5,1,4,6]){
   const candidates=rows.filter(r=>r.energy_bandpassname===`SPHEREx-D${detector}`).slice(0,3);
   for(const [attempt,row]of candidates.entries()){
    const url=new URL(row.access_url);url.searchParams.set('center',`${target.ra},${target.dec}`);url.searchParams.set('size','0.08');
    try{
     const raw=await fetchWithRetry(url,{timeoutMs:25000},2);if(!raw.ok)throw Error('HTTP '+raw.status);
     const original=Buffer.from(await raw.arrayBuffer());if(original.length>15e6)throw Error('oversize');
     const slim=extractScientificFits(original);const frame=parseFits(slim.buffer.slice(slim.byteOffset,slim.byteOffset+slim.byteLength),null,null,{zodiMode:'raw',flagPolicy:'measurement',gridSize:64,fovDeg:.08});
     const pix=frame.wcs?.worldToPixel(target.ra,target.dec);const x=Math.round((pix?.xFits??-1)-1),y=Math.round((pix?.yFits??-1)-1);let usable=0;
     for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=frame.rawWidth||yy>=frame.rawHeight)continue;const i=yy*frame.rawWidth+xx;const flags=frame.rawFlagsPixels?.[i]>>>0;if((flags & ~(2**21|2**12))===0&&Number.isFinite(frame.rawImagePixels[i])&&frame.rawVariancePixels?.[i]>0)usable++;}
     if(!usable)throw Error('No unflagged samples in target aperture');
     const file=`${target.key}/D${detector}.fits`;fs.writeFileSync('public/demo/'+file,slim);
     const record={id:row.obs_id,band:row.energy_bandpassname,date:row.t_min,dateAvg:String((+row.t_min + +(row.t_max||row.t_min))/2),url:row.access_url,productId:row.obs_publisher_did,release:'spherex_qr2',localFile:file,localSha256:sha(slim),originalSha256:sha(original),originalBytes:original.length,storedBytes:slim.length,cutoutUrl:url.href,cutoutSizeDeg:.08,omittedExtensions:['PSF/EPSF'],units:frame.extensions.imageUnit,usablePixelsIn5x5:usable,wavelengthAtTargetUm:frame.spectral?.wavelengthUm,bandwidthUm:frame.spectral?.bandwidthUm,dateObs:frame.temporal.dateObs};
     entry.records.push(record);console.log(target.key,'D'+detector,'OK',usable,'pixels',record.wavelengthAtTargetUm,'um');save();break;
    }catch(e){entry.failures.push({detector,attempt,error:e.message});console.log(target.key,'D'+detector,attempt,e.message);}
   }
 }
 output.targets.push(entry);save();
}
console.log('DONE',output.targets.map(t=>[t.key,t.records.length]));
