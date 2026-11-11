import fs from 'node:fs';
const edit=(file,fn)=>{const before=fs.readFileSync(file,'utf8'),after=fn(before);if(before===after)throw Error('No change: '+file);fs.writeFileSync(file,after);};
fs.writeFileSync('src/data/verifiedObservations.js',`import {LOCAL_OBSERVATIONS} from './localObservations.js';
import {M101_OBSERVATIONS} from './m101Observations.js';
import {TEMPORAL_OBSERVATIONS} from './temporalObservationsData.js';
// Deduplicate products by their archive URL, never reuse an image between targets.
export const VERIFIED_OBSERVATIONS={...LOCAL_OBSERVATIONS,version:'real-temporal-v3',targets:[...LOCAL_OBSERVATIONS.targets,M101_OBSERVATIONS].map(target=>{
 const temporal=TEMPORAL_OBSERVATIONS.targets.find(entry=>entry.key===target.key);
 const records=new Map(target.records.map(record=>[record.url,record]));
 for(const record of temporal?.records||[])records.set(record.url,record);
 const pair=temporal?.bestPair;
 const temporalPair=pair?{...pair,a:pair.measurements[0].date<=pair.measurements[1].date?pair.a:pair.b,b:pair.measurements[0].date<=pair.measurements[1].date?pair.b:pair.a}:null;
 return {...target,records:[...records.values()].sort((a,b)=>Number(a.dateAvg||a.date)-Number(b.dateAvg||b.date)),temporalPair};
})};
`);
edit('src/data/spherexTargets.js',s=>s.replace('    localRecords: local?.records || [],','    localRecords: local?.records || [],\n    temporalPair: local?.temporalPair || null,'));
edit('src/components/SpherexMission.jsx',s=>s.replace('Conjunto local versionado: productos reales QR2.','Conjunto local versionado: productos reales QR2/QR3.').replace('<ObservationGallery records=','<ObservationGallery key={target.key+\'|\'+dataSource+\'|\'+fieldSize} records='));
edit('src/components/SpaceshipCockpit.jsx',s=>s.replace("            ) : (\n              <>\n                <button\n                  type=\"button\"\n                  className=\"kronoxInspectorBtn primary\"\n                  onClick={() => onTravelToPlanet(objectCard.planetName)}",`            ) : objectCard.kind === 'catalog-star' ? (
              <><a className="kronoxInspectorBtn secondary" href={objectCard.source} target="_blank" rel="noreferrer">Consultar catálogo de origen</a><button className="kronoxInspectorBtn primary" onClick={onCloseObjectInspector}>Continuar explorando</button></>
            ) : (
              <>
                <button
                  type="button"
                  className="kronoxInspectorBtn primary"
                  onClick={() => onTravelToPlanet(objectCard.planetName)}`));
edit('src/components/useObservationSamples.js',s=>s.replace('const loadBatch = async () => {','const loadBatch = async ({limit=6}={}) => {').replace('.slice(0, 6);','.slice(0, limit);').replace('remaining: records.filter((r) => !data.current.has(r.url)).length','remaining: spectralCandidates(records).filter((r) => !data.current.has(r.url)).length'));
edit('src/components/EvidenceLab.jsx',s=>s.replace('automaticStarted.current=true;loadBatch();','automaticStarted.current=true;loadBatch({limit:12});'));
edit('src/utils/scientificEvidence.js',s=>s.replace("const unit=frame.extensions.imageUnit?.toLowerCase().replaceAll(' ','');if(unit!=='mjy/sr')","const unit=frame.extensions.imageUnit?.replace(/\\s/g,'');if(unit!=='MJy/sr')").replace("if(a.unit!==b.unit||a.unit===null)","if(!a.unit||!b.unit||a.unit.replace(/\\s/g,'')!==b.unit.replace(/\\s/g,''))").replace("if(a.date===b.date)","if(Math.abs(Number.parseFloat(a.date)-Number.parseFloat(b.date))<1e-7)"));
edit('src/scene/createScene.js',s=>s.replace("returnToStarMap:()=>{if(realTimeIntro||launchSequence||launchCameraBlend)return false;nav=null;vel.set(0,0,0);activeMissionKey=null;lvl(2);}","returnToStarMap:()=>setNavigationScale('stellar')"));
edit('tests/juan-component.test.mjs',s=>s.replace("button('Exploración')","button('Imágenes')").replace("  assert.ok(text().includes('De observar a justificar'));",`  assert.ok(text().includes('Galería de imágenes reales por fecha'));
  assert.equal(render.root.findAll(n=>n.props.className==='juanEvidenceLab').length,0,'Images precede analysis');
  await act(async()=>{button('Análisis espectral').props.onClick();await new Promise(r=>setTimeout(r,60));});
  assert.ok(text().includes('Análisis espectral · de observar a justificar'));`));
edit('tests/repair-d.test.mjs',s=>s.replace("assert.equal(target.localRecords.length,6);assert.equal(new Set(target.localRecords.map(r=>r.url)).size,6);","assert.ok(target.localRecords.length>=6);assert.equal(new Set(target.localRecords.map(r=>r.url)).size,target.localRecords.length);"));
console.log('Temporal data integrated; gallery, inspector and analysis corrected.');
