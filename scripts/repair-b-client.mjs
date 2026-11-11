import fs from 'node:fs';
function edit(file,fn){const s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),n=fn(s);if(n===s)throw Error('No edit '+file);fs.writeFileSync(file,n);}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,100));return s.replace(a,b);}
fs.appendFileSync('src/utils/archiveClient.js',`
/** All products remain accessible. A cursor indexes documented collection/TIME requests, not an invented SIA OFFSET. */
export function observationStats(records){return {products:records.length,exposures:new Set(records.map(r=>r.id)).size,detectorExposures:new Set(records.map(r=>r.id+'|'+r.band)).size,epochs:new Set(records.map(r=>r.dateAvg||r.date).filter(Boolean)).size,bands:new Set(records.map(r=>r.band)).size};}
export async function collectArchive({ra,dec,signal,segmented=false,deep=false,refresh=false,onPage=()=>{},request=fetchResource,base='/api/spherex'}={}){
 let cursor=0,finished=false;const merged=new Map(),failures=new Set();let pages=0,total=0;
 while(!finished){if(signal?.aborted)throw Error('Consulta cancelada.');const params=new URLSearchParams({action:'search',ra:String(ra),dec:String(dec),release:'all',progressive:'1',cursor:String(cursor),segmented:segmented?'1':'0',deep:deep?'1':'0',refresh:refresh?'1':'0'});
 const data=await request(base+'?'+params,{signal,timeoutMs:65000});if(!Array.isArray(data.records))throw Error('Respuesta IRSA sin lista de productos.');
 for(const record of data.records)if(record.url)merged.set(record.url,{...record,queryCenter:{ra,dec}});for(const name of data.failedCollections||[])failures.add(name);if(data.partial&&!data.failedCollections?.length)failures.add(data.collection||'consulta');
 pages++;total=data.pageCount||pages;finished=data.nextCursor===null||data.nextCursor===undefined;const records=[...merged.values()].sort((a,b)=>Number(a.dateAvg||a.date)-Number(b.dateAvg||b.date)||a.url.localeCompare(b.url));
 const result={records,partial:failures.size>0,failedCollections:[...failures],page:pages,pageCount:total,complete:finished,stats:observationStats(records),queriedAt:data.queriedAt};onPage(result);
 if(finished)return result;if(!Number.isInteger(data.nextCursor)||data.nextCursor<=cursor)throw Error('El archivo devolvió un cursor inválido.');cursor=data.nextCursor;
 }
}
export class FrameLru{
 constructor(limit=20){this.limit=limit;this.items=new Map();}
 has(k){return this.items.has(k);}get(k){const v=this.items.get(k);if(v){this.items.delete(k);this.items.set(k,v);}return v;}
 set(k,v){this.items.delete(k);this.items.set(k,v);while(this.items.size>this.limit)this.items.delete(this.items.keys().next().value);return v;}
 clear(){this.items.clear();}get size(){return this.items.size;}
}
`);
edit('src/components/SpherexMission.jsx',s=>{
 s=rep(s,"import {fetchResource,archiveStatus}","import {fetchResource,archiveStatus,collectArchive,observationStats,FrameLru}");
 s=rep(s,"  initialStage = 'arrival',","  initialStage = 'arrival',\n  initialDataSource = 'archive',");
 s=s.replaceAll("setDataSource(TARGETS[idx].localRecords?.length?'local':'archive');","setDataSource(navParams?.get('data')==='local'||initialDataSource==='local'?'local':'archive');").replaceAll("setDataSource(TARGETS[newIdx].localRecords?.length?'local':'archive');","setDataSource(navParams?.get('data')==='local'||initialDataSource==='local'?'local':'archive');");
 s=rep(s,"useState(()=>target.localRecords?.length?'local':'archive')","useState(()=>navParams?.get('data')==='local'||initialDataSource==='local'?'local':'archive')");
 s=rep(s,"  const [reloadToken,setReloadToken]=useState(0);","  const [reloadToken,setReloadToken]=useState(0);\n  const [segmented,setSegmented]=useState(false),[deepSearch,setDeepSearch]=useState(false),[galleryPage,setGalleryPage]=useState(0);\n  const selectedProducts=useRef({a:null,b:null});");
 s=rep(s,"const frameCacheRef = useRef(new Map());","const frameCacheRef = useRef(new FrameLru(20));");
 const start=s.indexOf('        const data = await fetchResource(`/api/spherex?action=search'),end=s.indexOf('\n      } catch (err)',start);if(start<0||end<0)throw Error('archive block');
 s=s.slice(0,start)+`        await collectArchive({ra:target.ra,dec:target.dec,signal:controller.signal,segmented,deep:deepSearch,refresh:reloadToken>0,onPage:data=>{
          if(!active||searchToken!==searchTokenRef.current)return;
          const stats=data.stats;
          setArchiveNotice(\`\${data.page}/\${data.pageCount} consultas · \${stats.products} productos · \${stats.exposures} exposiciones · \${stats.epochs} instantes MJD · \${stats.bands} detectores. \${archiveStatus(data).text}\`);
          setRecords(data.records);
          const a=data.records.findIndex(r=>r.url===selectedProducts.current.a),b=data.records.findIndex(r=>r.url===selectedProducts.current.b);
          setFrameIndex(a<0?0:a);setCompareIndex(b<0?Math.max(0,data.records.length-1):b);
        }});
        setFilterBand('ALL');`+s.slice(end);
 s=rep(s,'      setRecords([]);','      selectedProducts.current={a:null,b:null};setGalleryPage(0);setFilterBand(\'ALL\');setFilterYear(\'ALL\');\n      setRecords([]);');
 s=rep(s,'[selectedTargetIndex,dataSource,reloadToken]','[selectedTargetIndex,dataSource,reloadToken,segmented,deepSearch]');
 s=rep(s,'    loadFits(rec)\n','    loadFits(rec,controller.signal)\n');
 s=rep(s,'  // Load Primary Frame (Frame A)','  // Load Primary Frame (Frame A)'); // case checked below
 return s;
});
