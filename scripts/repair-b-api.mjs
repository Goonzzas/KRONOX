import fs from 'node:fs';let s=fs.readFileSync('api/spherex.js','utf8').replace(/\r\n/g,'\n');s="import {parseCsvTable,buildSearchPlan} from './lib/archivePlan.js';\nimport {cachedIrsaBytes} from './lib/irsaCache.js';\nexport {parseCsv,buildSearchPlan} from './lib/archivePlan.js';\n"+s;
const a=s.indexOf('export function parseCsv('),b=s.indexOf('/**',a);if(a<0||b<0)throw Error('CSV scope');s=s.slice(0,a)+s.slice(b);s=s.replace('const MAX_SEARCH_RESULTS = 1000;','');
s=s.replace('querySiaCollection(collection, ra, dec, radius) {','querySiaCollection(collection, ra, dec, radius, options = {}) {');
s=s.replace("  url.searchParams.set('MAXREC', String(MAX_SEARCH_RESULTS));\n  const archiveResponse = await fetchWithRetry(url, { timeoutMs: 25000 });\n  if (!archiveResponse.ok) {\n    throw new Error(`El archivo IRSA (${collection}) no respondió a la búsqueda.`);\n  }\n  const rows = parseCsv(await archiveResponse.text());",`  // IRSA documents an unlimited default. Do not invent OFFSET/paging or silently cap the archive.
  if(options.time)url.searchParams.set('TIME',options.time);
  const result=await cachedIrsaBytes(url,{force:options.force,timeoutMs:18000,maxBytes:12*1024*1024,attempts:2});
  const table=parseCsvTable(result.bytes.toString('utf8'));
  if(!table.headers.includes('access_url'))throw Error('Respuesta IRSA inválida o incompleta; intenta la consulta segmentada.');
  const rows=table.rows;`);
s=s.replace('.filter((row) => row.access_url && row.t_min)',".filter((row) => row.access_url?.startsWith('https://irsa.ipac.caltech.edu/ibe/data/spherex/'))");
s=s.replace('        id: row.obs_id,','        id: row.obs_id || row.obs_publisher_did || row.access_url,\n        productId:row.obs_publisher_did||row.access_url,facility:row.facility_name||\'SPHEREx\',instrument:row.instrument_name||\'SPHEREx\',\n        queryCenter:{ra,dec},footprint:row.s_region||null,\n        accessFormat:row.access_format,estimatedSizeKb:Number(row.access_estsize)||null,');
s=s.replace('    truncated: mapped.length >= MAX_SEARCH_RESULTS,','    truncated: false, queryUrl:url.href, cached:result.cached, rawCount:rows.length, droppedRows:rows.length-mapped.length,');
const insert=s.indexOf('    const collectionsToQuery =');s=s.slice(0,insert)+`    if(query.get('progressive')==='1'){
      const plan=buildSearchPlan({release:releaseParam,deep:query.get('deep')==='1',segmented:query.get('segmented')==='1'}),cursor=Number(query.get('cursor')||0);
      if(!Number.isInteger(cursor)||cursor<0||cursor>=plan.length)return sendError(response,400,'Cursor de consulta inválido.');
      const task=plan[cursor];try{const result=await querySiaCollection(task.collection,ra,dec,radius,{time:task.time,force:query.get('refresh')==='1'});return response.status(200).json({...result,collection:task.collection,page:cursor+1,pageCount:plan.length,nextCursor:cursor+1<plan.length?cursor+1:null,partial:false,failedCollections:[],queriedAt:new Date().toISOString()});}
      catch(error){return response.status(200).json({records:[],collection:task.collection,page:cursor+1,pageCount:plan.length,nextCursor:cursor+1<plan.length?cursor+1:null,partial:true,failedCollections:[task.collection],error:error.message,queriedAt:new Date().toISOString()});}
    }
`+s.slice(insert);
s=s.replace('records: deduplicated,','records: [...new Map(rawRecords.map(r=>[r.url,r])).values()],\n        preferredRecords:deduplicated,observationCount:new Set(rawRecords.map(r=>r.id)).size,');
s=s.replace("      const imageResponse = await fetchWithRetry(cutoutUrl, { timeoutMs: 30000 });\n      if (!imageResponse.ok)\n        return sendError(response, 502, 'IRSA no pudo generar el recorte de esta observación.');","      const imageResponse = await cachedIrsaBytes(cutoutUrl,{timeoutMs:22000,ttlMs:7*86400000,force:query.get('refresh')==='1'});");
s=s.replace('const product = Buffer.from(await imageResponse.arrayBuffer());','const product = imageResponse.bytes;');
fs.writeFileSync('api/spherex.js',s);
