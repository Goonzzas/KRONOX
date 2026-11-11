import fs from 'node:fs';
let s=fs.readFileSync('src/scene/createScene.js','utf8').replace(/\r\n/g,'\n');
s="import {createDestinationResources,summarizeFrameTimes} from './destinationVisuals.js';\n"+s;
const start=s.indexOf('  const missionMarkers = new Map();'),end=s.indexOf('  // cuerpos',start);if(start<0||end<0)throw Error('destination range');
s=s.slice(0,start)+`  const missionMarkers = new Map();
  const missionMarkerEffects = [];
  const destinationResources=createDestinationResources();
  SPHEREX_TARGETS.forEach(target=>{
    const effect=destinationResources.build(target),marker=effect.marker;
    marker.position.copy(localGalacticPosition(target));
    const label=lab(target.name+' · ilustración 3D',target.type==='galaxia'?5:1.2,22);
    label.position.set(0,effect.radius*1.3,0);label.visible=false;marker.add(label);LB.push(label);
    marker.traverse(child=>{child.userData.spherexTargetKey=target.key;});
    gal.add(marker);missionMarkers.set(target.key,{target,marker,label});missionMarkerEffects.push(effect);
  });
`+s.slice(end);
// Round point sprites in the generic particle layer, including existing galaxy markers.
s=s.replace('  const planetTextureWarnings', '  const planetTextureWarnings');
// The mission dust PointsMaterial without a map was the confirmed source-code square footprint.
// It has been removed from scientific destinations; generic particle layers get a shared round sprite.
s=s.replace('  const makeMissionStarTexture =', '  const makeMissionStarTexture =');
// Retain legacy helpers for broad scene compatibility; destination allocation is now lazy.
const a=s.indexOf('      missionMarkerEffects.forEach((effect) => {'),b=s.indexOf('      const activeMissionMarker',a);if(a<0||b<0)throw Error('effects range');s=s.slice(0,a)+'      missionMarkerEffects.forEach(effect=>effect.update(cam));\n\n'+s.slice(b);
s=s.replace('Math.max(22, Math.min(60, visualDistanceInMapUnits(found.target.distanceLy) * 0.04)),','found.marker.userData.inspectionClearance || 2,');
s=s.replace('        found.label.visible = true;\n        if (onArrive) onArrive();','        found.label.visible = true;\n        vel.set(0,0,0);fs=0.08;S.fv(fs);\n        if (onArrive) onArrive();');
// Deterministic, bounded sample capture: measurement is opt-in, not an invented FPS claim.
s=s.replace('  function tick() {','  const frameTiming={active:false,last:null,values:[],metadata:null};\n  function tick() {\n    const frameNow=performance.now();\n    if(frameTiming.active&&frameTiming.last!==null){frameTiming.values.push(frameNow-frameTiming.last);if(frameTiming.values.length>=600)frameTiming.active=false;}\n    frameTiming.last=frameNow;');
s=s.replace('  return {\n    nearbyMap,',`  return {
    startPerformanceCapture:()=>{frameTiming.active=true;frameTiming.last=null;frameTiming.values=[];frameTiming.metadata={quality:qualityMode,pixelRatio:R.getPixelRatio(),viewport:[innerWidth,innerHeight],target:activeMissionKey};},
    performanceSnapshot:()=>({...summarizeFrameTimes(frameTiming.values),metadata:frameTiming.metadata,renderer:{calls:R.info.render.calls,triangles:R.info.render.triangles,points:R.info.render.points,textures:R.info.memory.textures,geometries:R.info.memory.geometries}}),
    stopAndInspect:()=>{nav=null;tw=null;vel.set(0,0,0);for(const key of Object.keys(keys))delete keys[key];ac=0;th=0;S.onNavigation?.(null);if(free){pv=3;ship.visible=true;ct.enabled=true;exteriorCameraMode=true;ct.target.copy(sp.clone().add(new V(0,0,-2).applyQuaternion(ship.quaternion)));ct.minDistance=.02;ct.maxDistance=30;ct.update();}},
    returnToStarMap:()=>{nav=null;vel.set(0,0,0);activeMissionKey=null;lvl(2);},
    nearbyMap,`);
s=s.replace('      ct.dispose();\n      R.dispose();','      ct.dispose();\n      destinationResources.dispose();\n      R.dispose();');
fs.writeFileSync('src/scene/createScene.js',s);
s=fs.readFileSync('src/App.jsx','utf8').replace(/\r\n/g,'\n');
s=s.replace("    [missionRecordsSync, setMissionRecordsSync] = useState([]),","    [missionRecordsSync, setMissionRecordsSync] = useState([]),\n    [performanceReport,setPerformanceReport]=useState(null),\n    [missionScienceSync,setMissionScienceSync]=useState(null),");
s=s.replace('        records: missionRecordsSync,','        records: missionRecordsSync,\n        scienceContext: missionScienceSync,');
s=s.replace('onStateSync: ({ targetKey, stage, records, findings }) => {','onStateSync: ({ targetKey, stage, records, findings, scienceContext }) => {\n          if(scienceContext)setMissionScienceSync(scienceContext);');
s=s.replace("    h('div', { ref: el, style: { position: 'absolute', inset: 0 } }),",`    h('div', { ref: el, style: { position: 'absolute', inset: 0 } }),
    !welcomeOpen&&!missionOpen&&h('div',{className:'juanLabFlightBar'},
      h('button',{onClick:()=>{A()?.stopAndInspect?.();setFr(false);setMissionTraveling(false);}},'Frenar e inspeccionar'),
      h('button',{onClick:()=>{A()?.view?.(pv===1?3:1);setPv(pv===1?3:1);}},'Cambiar vista'),
      h('button',{onClick:()=>{setMissionOpen(true);setMissionInitialStage('explore');}},'Abrir observación del destino'),
      h('button',{onClick:()=>{A()?.returnToStarMap?.();setFr(false);setNearbyMapActive(false);}},'Regresar al mapa'),
      h('button',{onClick:()=>{A()?.startPerformanceCapture?.();setPerformanceReport(null);}},'Medir rendimiento (600 fotogramas)'),
      h('button',{onClick:()=>setPerformanceReport(A()?.performanceSnapshot?.())},'Ver medición'),
      performanceReport&&h('output',{className:'juanFlightMetrics'},JSON.stringify(performanceReport)),
    ),`);
fs.writeFileSync('src/App.jsx',s);
let test=fs.readFileSync('tests/product-flow.test.mjs','utf8');test=test.replace('    // Propagate to 2026.5','    if(!target.astrometry){assert.equal(target.type,\'galaxia\');continue;}\n    // Propagate to 2026.5');fs.writeFileSync('tests/product-flow.test.mjs',test);
console.log('Milestone 2 wired');
