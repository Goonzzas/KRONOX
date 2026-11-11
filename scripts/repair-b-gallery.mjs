import fs from 'node:fs';
const file='src/components/SpherexMission.jsx';let s=fs.readFileSync(file,'utf8');function rep(a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,90));s=s.replace(a,b);}
rep('  // Load Primary Frame (Frame A)',`  const primaryUrl=records[Math.min(frameIndex,records.length-1)]?.url,comparisonUrl=records[Math.min(compareIndex,records.length-1)]?.url;
  useEffect(()=>{selectedProducts.current={a:primaryUrl,b:comparisonUrl};},[primaryUrl,comparisonUrl]);
  useEffect(()=>{setGalleryPage(0);},[filterYear,filterBand,target.key]);
  const galleryPages=Math.max(1,Math.ceil(filteredRecordEntries.length/24));
  const visibleEntries=filteredRecordEntries.slice(Math.min(galleryPage,galleryPages-1)*24,(Math.min(galleryPage,galleryPages-1)+1)*24);
  const productStats=observationStats(records);
  // Load Primary Frame (Frame A)`);
rep('}, [records, frameIndex]);','}, [primaryUrl,target.key]);');rep('}, [records, compareIndex]);','}, [comparisonUrl,target.key]);');
rep('Archivo Temporal SPHEREx ({filteredRecordEntries.length} de {records.length} observaciones reales):','Archivo SPHEREx ({filteredRecordEntries.length} de {records.length} productos reales; {productStats.exposures} exposiciones):');
rep('{filteredRecordEntries.map(({ record: r, originalIndex: idx }) => (','{visibleEntries.map(({ record: r, originalIndex: idx }) => (');rep('key={r.id || idx}','key={r.url || idx}');
rep('<small className="kronoxChipBand">{r.band}</small>','<small className="kronoxChipBand">{r.band} · {r.release} · {r.pipelineVersion}</small>');
rep('                <div className="kronoxTimelineChips">',`                <div className="juanGalleryPager"><button disabled={galleryPage===0} onClick={()=>setGalleryPage(p=>p-1)}>Página anterior</button><span>Página {Math.min(galleryPage,galleryPages-1)+1} / {galleryPages} · 24 productos por página</span><button disabled={galleryPage>=galleryPages-1} onClick={()=>setGalleryPage(p=>p+1)}>Página siguiente</button></div>
                <p className="juanScienceNote">Un producto corresponde a un detector, una exposición y una versión de procesamiento. Varias versiones o detectores de la misma exposición no son épocas independientes. El solapamiento SIA indica cobertura, no una detección del objeto.</p>
                <div className="kronoxTimelineChips">`);
rep("<button onClick={()=>setDataSource('archive')}>Consultar archivo en vivo</button>","<button onClick={()=>setDataSource('archive')}>Consultar archivo en vivo</button><label><input type=\"checkbox\" checked={segmented} onChange={e=>setSegmented(e.target.checked)}/> Consultar por intervalos mensuales (recuperación de consultas grandes)</label><label><input type=\"checkbox\" checked={deepSearch} onChange={e=>setDeepSearch(e.target.checked)}/> Incluir campos profundos QR2/QR3</label>");
rep('records={records} loadFits={loadFits} marker={activeMarker}', 'records={records} loadFits={loadFits} marker={activeMarker} onSelectRecord={url=>{const i=records.findIndex(r=>r.url===url);if(i>=0){setFrameIndex(i);setGalleryPage(Math.floor(i/24));}}}');
fs.writeFileSync(file,s);
const t='tests/juan-component.test.mjs';let test=fs.readFileSync(t,'utf8').replaceAll("{initialTargetKey:'m31',initialStage:","{initialDataSource:'local',initialTargetKey:'m31',initialStage:");fs.writeFileSync(t,test);
