import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import handler,{querySiaCollection} from '../api/spherex.js';
import {parseCsvTable,buildSearchPlan} from '../api/_lib/archivePlan.js';
import {cachedIrsaBytes} from '../api/_lib/irsaCache.js';
import {collectArchive,observationStats,FrameLru,fitsCacheKey} from '../src/utils/archiveClient.js';
test('Archive parses quoted lines and real Barnard responses without a 1000-row cap or version loss',async()=>{
 assert.equal(parseCsvTable('a,b\n"x,y","line1\nline2"\n').rows[0].b,'line1\nline2');assert.throws(()=>parseCsvTable('a\n"unfinished'));
 const original=globalThis.fetch;const queries=[];try{globalThis.fetch=async url=>{queries.push(new URL(url));return new Response(fs.readFileSync('docs/repair-2026-11-07/barnard-'+new URL(url).searchParams.get('COLLECTION')+'.csv'));};const records=[];
 for(const collection of ['spherex_qr2','spherex_qr3']){const r=await querySiaCollection(collection,269.446312,4.767646,.03);assert.equal(r.droppedRows,0);records.push(...r.records);}
 assert.equal(records.length,380);assert.equal(records.filter(r=>r.release==='spherex_qr2').length,252);assert.ok(records.every(r=>r.id&&r.url&&r.facility==='SPHEREx'));assert.ok(queries.every(u=>!u.searchParams.has('MAXREC')));assert.ok(observationStats(records).exposures<380);
 globalThis.fetch=async()=>new Response('obs_id,access_url,t_min,t_max,energy_bandpassname\n'+Array.from({length:1250},(_,i)=>'exposure'+i+',https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/'+i+'.fits,61100,61101,SPHEREx-D1').join('\n'));assert.equal((await querySiaCollection('spherex_qr2',1,2,.03)).records.length,1250);
 }finally{globalThis.fetch=original;}
});
test('Progressive archive preserves same-exposure versions, reports partial failures and publishes intermediate results',async()=>{
 const a={id:'exposure',url:'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/a.fits',band:'D1',date:'61100'},b={...a,url:a.url.replace('/a.fits','/retry.fits')},pages=[];
 const result=await collectArchive({ra:1,dec:2,onPage:r=>pages.push(r),request:async url=>{const i=Number(new URL(url,'http://localhost').searchParams.get('cursor'));return i===0?{records:[a,b],pageCount:2,nextCursor:1}:{records:[a],partial:true,failedCollections:['spherex_qr3'],pageCount:2,nextCursor:null};}});
 assert.equal(pages.length,2);assert.equal(result.records.length,2);assert.equal(result.stats.exposures,1);assert.equal(result.partial,true);assert.deepEqual(result.failedCollections,['spherex_qr3']);assert.equal(result.complete,true);assert.deepEqual(result.records[0].queryCenter,{ra:1,dec:2});
});
test('Segmented query plan uses documented TIME, includes open ends, and bounded frame LRU evicts oldest frame',()=>{
 const plan=buildSearchPlan({segmented:true,now:new Date('2026-11-07')});assert.ok(plan.length>30);for(const name of ['spherex_qr2','spherex_qr3']){const tasks=plan.filter(p=>p.collection===name);assert.ok(tasks[0].time.startsWith('-Inf '));assert.ok(tasks.at(-1).time.endsWith(' Inf'));for(let i=1;i<tasks.length;i++)assert.equal(tasks[i-1].time.split(' ')[1],tasks[i].time.split(' ')[0]);}
 const product={url:'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/test.fits'},target={ra:1,dec:2};const key=fitsCacheKey(product,target);assert.notEqual(key,fitsCacheKey({...product,cutoutSizeDeg:.08},target));assert.notEqual(key,fitsCacheKey({...product,localFile:'test.fits',localSha256:'sha'},target));assert.notEqual(key,fitsCacheKey(product,{ra:2,dec:2}));
 const cache=new FrameLru(2);cache.set('a',{});cache.set('b',{});cache.get('a');cache.set('c',{});assert.equal(cache.size,2);assert.equal(cache.has('b'),false);
});
test('Cached IRSA backend renews timeout signals and progressive handler exposes failed collection',async()=>{
 const original=globalThis.fetch,signals=[];try{globalThis.fetch=async(_,{signal})=>{signals.push(signal);if(signals.length===1)throw new DOMException('timeout','TimeoutError');assert.equal(signal.aborted,false);return new Response('ok');};assert.equal((await cachedIrsaBytes('https://irsa.ipac.caltech.edu/fresh-signal',{timeoutMs:1000,attempts:2})).bytes.toString(),'ok');assert.notEqual(signals[0],signals[1]);
 globalThis.fetch=async()=>new Response('not available',{status:404});let body,code;await handler({method:'GET',url:'http://localhost/api/spherex?action=search&ra=1&dec=2&progressive=1&cursor=1'},{setHeader(){},status(c){code=c;return this;},json(b){body=b;return this;}});assert.equal(code,200);assert.equal(body.partial,true);assert.deepEqual(body.failedCollections,['spherex_qr3']);assert.equal(body.nextCursor,null);
 }finally{globalThis.fetch=original;}
});
