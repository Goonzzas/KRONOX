import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
function edit(file,fn){const before=read(file);const after=fn(before);fs.writeFileSync(file,after);}
function replace(s,a,b){if(!s.includes(a))throw Error('Patch not found: '+a.slice(0,90));return s.replace(a,b);}
edit('src/utils/fitsImage.js',s=>{s=s.replace('gridSize: 300,\n      fovDeg: 0.5,','gridSize: options.gridSize || 300,\n      fovDeg: options.fovDeg || 0.5,');s=s.replace("if (!sameDetector) {\n    regime = 'different-detector';","if (!Number.isFinite(lamA) || !Number.isFinite(lamB)) {\n    regime = 'unknown';\n    reasonEs = 'Falta calibración espectral: no se puede afirmar comparabilidad temporal.';\n    reasonEn = 'Missing spectral calibration; temporal comparability is unknown.';\n  } else if (!sameDetector) {\n    regime = 'different-detector';");return s;});
edit('src/data/spherexTargets.js',s=>{
 s="import { LOCAL_OBSERVATIONS } from './localObservations.js';\n"+s;
 s=replace(s,'export const SPHEREX_TARGETS = RAW_TARGETS.map((target) => {',`const m31 = LOCAL_OBSERVATIONS.targets.find(t=>t.key==='m31');
if(m31?.records.length) RAW_TARGETS.push({key:'m31',mission:'spectral',name:'M31 · Andrómeda (núcleo)',ra:m31.ra,dec:m31.dec,type:'galaxia',distanceLy:m31.distanceLy,distanceLabel:'≈ 2.5 millones de años luz (NASA)',distanceSource:m31.distanceSource,note:'Región central de una galaxia espiral; el recorte no contiene toda M31.',preferredBand:m31.records[0].band,scientificStatus:'ARCHIVO',statusBadge:'FITS LOCALES',scientificLimitations:'Cobertura verificada; no equivale a detección de una línea o variabilidad. Volumen 3D ilustrativo.',observationSummary:'Recortes SPHEREx QR2 identificados; apertura extendida definida.'});
SPHEREX_MISSION_TYPES.push({key:'spectral',title:'Evidencia y espectros',description:'Contrasta brillo, incertidumbres y cobertura de una estrella y una galaxia.',objective:'Identifica el objetivo, inspecciona una medición y justifica una conclusión.',targetKeys:['barnard',...(m31?.records.length?['m31']:[]),'rw-aurigae']});
export const SPHEREX_TARGETS = RAW_TARGETS.map((target) => {`);
 s=s.replace('const propagated = propagateCoordinates(target.astrometry, SPHEREX_REFERENCE_EPOCH);','const propagated = propagateCoordinates(target.astrometry, SPHEREX_REFERENCE_EPOCH) || {ra:target.ra,dec:target.dec};\n  const local=LOCAL_OBSERVATIONS.targets.find(t=>t.key===target.key);');
 s=s.replace('    referenceEpoch: SPHEREX_REFERENCE_EPOCH,','    type: target.type || (target.key===\'rw-aurigae\'?\'estrella joven\':\'estrella\'),\n    identifier: local?.identifier || target.astrometry?.source || target.key,\n    question: local?.question || \'¿Qué evidencia permiten realmente estas observaciones?\',\n    localRecords: local?.records || [],\n    dataProvenance: local || null,\n    archiveVerified: !!local?.records.length,\n    referenceEpoch: SPHEREX_REFERENCE_EPOCH,');return s;
});
edit('src/scene/createScene.js',s=>s.replace('const visual = SPHEREX_VISUALS[target.key];',"const visual = SPHEREX_VISUALS[target.key] || {type:'young-variable',radiusSolar:1,color:'#e7c899',seed:83};"));
edit('src/components/SpherexMission.jsx',s=>{
 s="import EvidenceLab from './EvidenceLab.jsx';\nimport {fetchResource,archiveStatus} from '../utils/archiveClient.js';\nimport {researchState} from '../utils/scientificEvidence.js';\n"+s;
 s=replace(s,"  const [records, setRecords] = useState([]);",`  const [records, setRecords] = useState([]);
  const [dataSource,setDataSource]=useState(()=>target.localRecords?.length?'local':'archive');
  const [archiveNotice,setArchiveNotice]=useState('');
  const [reloadToken,setReloadToken]=useState(0);
  const [scienceContext,setScienceContext]=useState(null);`);
 s=replace(s,'      findings,\n    });','      findings,\n      scienceContext,\n    });');
 s=s.replace('  }, [target.key, stage, records, findings]);','  }, [target.key, stage, records, findings, scienceContext]);');
 s=replace(s,'    let active = true;\n    const fetchTargetObservations', '    let active = true;\n    const controller=new AbortController();\n    const fetchTargetObservations');
 s=replace(s,"      setMarkingActive(false);\n\n      try {",`      setMarkingActive(false);
      if(dataSource==='local'){
        const local=target.localRecords||[];
        setRecords(local);setCompareIndex(Math.max(0,local.length-1));
        setArchiveNotice(local.length?'Conjunto local versionado: productos reales QR2. No es el archivo completo ni un cubo espectral.':'Este destino no tiene productos locales verificados.');
        setLoadingRecords(false);return;
      }
      try {`);
 const start=s.indexOf('        const res = await fetch(');const end=s.indexOf('        if (!active || searchToken',start);
 if(start<0||end<0)throw Error('search block missing');
 s=s.slice(0,start)+`        const data = await fetchResource(\`/api/spherex?action=search&ra=\${encodeURIComponent(target.ra)}&dec=\${encodeURIComponent(target.dec)}&release=all\`,{signal:controller.signal,timeoutMs:60000});
        setArchiveNotice(archiveStatus(data).text);
`+s.slice(end);
 s=replace(s,'      active = false;\n    };\n  }, [selectedTargetIndex]);','      active = false;controller.abort();\n    };\n  }, [selectedTargetIndex,dataSource,reloadToken]);');
 s=s.replace('const loadFits = async (record) => {','const loadFits = async (record, signal) => {');
 const a=s.indexOf('    const res = await fetch(`/api/spherex?${params}`);');const b=s.indexOf('    const fixedRange =',a);
 if(a<0||b<0)throw Error('frame block missing');
 s=s.slice(0,a)+`    params.set('size',String(record.cutoutSizeDeg||0.12));
    const localUrl=record.localFile?import.meta.env.BASE_URL+'demo/'+record.localFile:null;
    const buffer = await fetchResource(localUrl||\`/api/spherex?\${params}\`,{kind:'buffer',timeoutMs:40000,signal});
    if(record.localSha256&&globalThis.crypto?.subtle){const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==record.localSha256)throw Error('El FITS local no coincide con su hash de procedencia.');}
`+s.slice(b);
 s=replace(s,"      flagPolicy: 'measurement',\n    });","      flagPolicy: 'measurement',\n      gridSize: 96, fovDeg: record.cutoutSizeDeg || 0.12,\n    });\n    parsed.center={ra:target.ra,dec:target.dec};");
 s=s.replace('    if (!records.length) {\n      setFrameA(null);','    if (!records.length) {\n      setLoadingFrameA(false);\n      setFrameA(null);');
 s=s.replace('    if (records.length < 2) {\n      setFrameB(null);','    if (records.length < 2) {\n      setLoadingFrameB(false);\n      setFrameB(null);');
 s=s.replace("if (!cancelled) console.warn('Could not load compare frame:', err);","if (!cancelled) setRecordError('Segunda observación: '+err.message);");
 s=replace(s,'      const res = computeDifferentialImage(frameA, frameB, { manualAlpha: 1.0, manualBackground: 0.0 });',"      const compatibility=assessPhotometricComparability(frameA,frameB);\n      if(compatibility?.regime!=='comparable')return null;\n      const res = computeDifferentialImage(frameA, frameB);");
 s=replace(s,"    setSelectedTargetIndex(newIdx);","    setSelectedTargetIndex(newIdx);\n    setDataSource(TARGETS[newIdx].localRecords?.length?'local':'archive');\n    setScienceContext(null);frameCacheRef.current.clear();stretchByBandRef.current.clear();");
 s=replace(s,'        {/* PROGRESSIVE JOURNEY ROADMAP */}',`        <div className="juanArchiveBanner" role="status"><b>{dataSource==='local'?'DATOS REALES GUARDADOS · DEMO SIN RED':'CONSULTA EN VIVO · IRSA'}</b><p>{archiveNotice||'Preparando consulta…'} {loadingRecords?'Buscando productos…':''}</p><button onClick={()=>{setRecordError('');frameCacheRef.current.clear();setReloadToken(v=>v+1);}}>Reintentar</button><button disabled={!target.localRecords?.length} onClick={()=>setDataSource('local')}>Usar productos locales verificados</button><button onClick={()=>setDataSource('archive')}>Consultar archivo en vivo</button>{recordError&&<p>{recordError}</p>}</div>
        {/* PROGRESSIVE JOURNEY ROADMAP */}`);
 s=replace(s,"const isCompleted = idx < stageIndex;","const isCompleted = s.id==='summary' ? researchState(findings,target.key)==='investigation-completed' : idx<stageIndex;");
 s=replace(s,'          {/* ========================================================= */}\n          {/* ETAPA E: CUADERNO DE APRENDIZAJE */}',`          {['explore','investigate','learn'].includes(stage)&&<EvidenceLab key={target.key} target={target} frame={frameA} records={records} loadFits={loadFits} marker={activeMarker} onContext={setScienceContext} onSave={({conclusion,description,question,evidence})=>{
            const record=createFindingRecord({target,frame:frameA?.record,compareFrame:frameB?.record,marker:activeMarker,description,conclusion,question,evidence,viewMode:'scientific-evidence',diagnostics:frameA,timeDeltaDays});
            const next=[record,...findings];if(!saveFindingsToStorage(next))throw Error('No se pudo persistir el cuaderno. Exporta la evidencia antes de cerrar.');setFindings(next);setToastMessage('Investigación registrada: conclusión y evidencia guardadas.');
          }}/>} 
          {/* ========================================================= */}
          {/* ETAPA E: CUADERNO DE APRENDIZAJE */}`);
 s=s.replace('Expedición Completada: {t(target.name, language)}',"{researchState(findings,target.key)==='investigation-completed'?'Investigación completada':'Recorrido libre finalizado'}: {t(target.name, language)}");
 s=s.replace('<b>Misión exploratoria completada con éxito</b>',"<b>{researchState(findings,target.key)==='investigation-completed'?'Observación y conclusión registradas':'Exploración libre; falta conclusión con evidencia'}</b>");
 s=s.replace('{records.length} productos FITS reales de SPHEREx','{records.length} productos encontrados; {frameA?1:0} vista principal abierta');
 const ca=s.indexOf("                    {target.scientificStatus === 'VALIDADO'",s.indexOf('VALIDACIÓN CIENTÍFICA OFICIAL'));
 const cb=s.indexOf('                  </b>',ca);if(ca>0)s=s.slice(0,ca)+"                    El catálogo identifica el objetivo; la conclusión del jugador requiere evidencia.\n"+s.slice(cb);
 s=s.replace('VALIDACIÓN CIENTÍFICA OFICIAL','ALCANCE DE LA EVIDENCIA');
 s=s.replace('Tu objetivo es examinar las variaciones temporales en el brillo y flujo infrarrojo de esta estrella variable.',"Examina el brillo, las longitudes de onda y sus límites; una diferencia de color no demuestra variación temporal.");
 const officialStart=s.indexOf("                      {target.scientificStatus === 'WARNING'",s.indexOf('Estado científico:'));
 const officialEnd=s.indexOf('                    </span>',officialStart);if(officialStart>0)s=s.slice(0,officialStart)+"                      {target.archiveVerified?'Productos reales guardados y verificados; no es una detección científica automática.':'Objetivo de catálogo; esta sesión debe verificar sus productos y calidad.'}\n"+s.slice(officialEnd);
 s=s.replace('<span>Calculando sustracción de imágenes...</span>',"<span>{assessPhotometricComparability(frameA,frameB)?.reasonEs||'Faltan dos FITS válidos; reintenta la carga.'} No se calcula una diferencia temporal sin compatibilidad.</span>");
 // Metadata is attached to the displayed observation, including a blinking B frame.
 s=replace(s,'              {/* BLOQUE 4.2: ARCHIVO TEMPORAL',`              <div className="juanViewMeta">{(()=>{const f=stage==='compare'&&compareStyle==='blink'&&blinkToggle?frameB:frameA;return f?<><b>{target.name}</b> · {f.temporal?.dateAvg||f.temporal?.dateObs||formatDate(f.record.dateAvg||f.record.date)} · {f.record.band} · λ centro {f.spectral?.wavelengthUm??'sin calibración'} μm (variable espacialmente) · {f.extensions?.imageUnit||'unidad no disponible'} · {f.extensions?.zodiSubtracted?'IMAGE − ZODI':'IMAGE'}<br/><a href={f.record.url} target="_blank" rel="noreferrer">{f.record.productId||f.record.id}</a><br/>Reproyección TAN/SIP para visualización. Posición de catálogo ≠ detección independiente.</>:null;})()}</div>
              {stage==='compare'&&<p className="juanArchiveBanner">{assessPhotometricComparability(frameA,frameB)?.reasonEs||'Faltan dos observaciones comparables.'} Aun con λ próxima, se requiere comprobar PSF, épocas y calidad. Escala visual común solo dentro de la misma banda.</p>}
              {/* BLOQUE 4.2: ARCHIVO TEMPORAL`);
 s=s.replace('        setRecords(sorted);','        setRecords(sorted);\n        setFilterBand(target.preferredBand||\'ALL\');');
 s=s.replace('<p className="kronoxFindingDesc">{f.description}</p>','<p className="kronoxFindingDesc">{f.conclusion&&<b>{f.conclusion}: </b>}{f.description}{f.evidence&&<small> · Evidencia: {f.evidence.measurements?.length||0} muestras; producto {f.frameId1}</small>}</p>');
 return s;
});
edit('api/spherex.js',s=>s.replace("cutoutUrl.searchParams.set('size', '0.5');","const size=Math.max(0.01,Math.min(0.5,Number(query.get('size'))||0.12));\n      cutoutUrl.searchParams.set('size',String(size));"));
console.log('Milestone 1 wired');
