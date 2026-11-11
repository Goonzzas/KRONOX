import fs from 'node:fs';const file='src/scene/createScene.js';let s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');function rep(a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,75));s=s.replace(a,b);}
s="import {scaleContext,scaleForTarget,macroGalacticVisible} from './navigationScale.js';\nimport {renderWithOriginRebase} from './originRebase.js';\n"+s;
rep('  const gal = new THREE.Group(),','  const macroGalacticGroup=new THREE.Group();macroGalacticGroup.name=\'Milky Way macro structure including Orion spur\';\n  const gal = new THREE.Group(),');
const start=s.indexOf('  const gp ='),end=s.indexOf('  sc.add(gal);',start);if(start<0||end<0)throw Error('macro span');s=s.slice(0,start)+s.slice(start,end).replaceAll('gal.add(','macroGalacticGroup.add(')+s.slice(end);rep('  sc.add(gal);','  gal.add(macroGalacticGroup);\n  sc.add(gal);');
rep("  let foc = null,",`  let navigationContext=scaleContext('solar'),originRebaseState={rebased:false,origin:[0,0,0]};
  function publishScale(id,target=null){navigationContext=scaleContext(id,target);S.onNavigationScale?.(navigationContext);}
  function setNavigationScale(id){
    if(realTimeIntro||launchSequence||launchCameraBlend||cabinReentryBlend)return false;
    releaseInputs();vel.set(0,0,0);nav=null;activeMissionKey=null;
    if(nearbyMapState)returnFromNearbyMap();
    if(id==='extragalactic'){nearbyMap();return true;}
    if(id==='solar')lvl(1);else if(id==='stellar')lvl(2);else if(id==='milkyway')lvl(3);else if(id==='regional'){if(free){setFree(false);S.fr(false);}foc=null;ct.maxDistance=4e5;fly([0,18000,35000]);}else return false;
    publishScale(id);return true;
  }
  let foc = null,`);
rep('    nearbyMapState = {','    publishScale(\'extragalactic\');\n    nearbyMapState = {');
rep('      camera: cam.position.clone(),','      scale:navigationContext.id,\n      camera: cam.position.clone(),'); // store prior below repaired
rep("    publishScale('extragalactic');\n    nearbyMapState = {\n      scale:navigationContext.id,","    const previousScale=navigationContext.id;publishScale('extragalactic');\n    nearbyMapState = {\n      scale:previousScale,");
rep('    const saved = nearbyMapState;','    const saved = nearbyMapState;publishScale(saved.scale||\'stellar\');');
rep('  function focus(n, k) {','  function focus(n, k) {\n    publishScale(\'solar\');');
rep("    if (k === 'orion') {","    if (k === 'orion') {\n      publishScale('milkyway');");rep("    } else if (k === 'core') {","    } else if (k === 'core') {\n      publishScale('milkyway');");
rep("    activeMissionKey = key;","    activeMissionKey = key;publishScale(scaleForTarget(found.target),found.target);");
rep('  function lvl(k) {','  function lvl(k) {\n    publishScale(k>=3?\'milkyway\':k===2?\'stellar\':\'solar\');\n    ct.maxDistance=4e5;');
rep('  function startRealTimeIntroSequence(onCompleteCallback) {',"  function startRealTimeIntroSequence(onCompleteCallback) {\n    publishScale('solar');");
rep('    const introOwnedThisFrame=!!realTimeIntro;','    const introOwnedThisFrame=!!realTimeIntro;');
rep('    if (tw) {\n      tw.k', '    if (tw&&!introOwnedThisFrame&&!realTimeIntro&&!cabinReentryBlend) {\n      tw.k');
rep('    if (!free || exteriorCameraMode) ct.update();','    if ((!free || exteriorCameraMode)&&!introOwnedThisFrame&&!realTimeIntro&&!cabinReentryBlend) ct.update();');
rep('    R.render(sc, cam);',`    macroGalacticGroup.visible=macroGalacticVisible(navigationContext.id,{cinematic:!!realTimeIntro,nearbyMap:!!nearbyMapState});
    deepGalaxyBackdrop.visible=navigationContext.id==='extragalactic'&&!nearbyMapState&&!realTimeIntro;
    originRebaseState=renderWithOriginRebase(R,sc,cam);`);
rep('  return {\n    startPerformanceCapture:',`  return {
    setNavigationScale,
    navigationScale:()=>navigationContext,
    startPerformanceCapture:`);
rep('target:activeMissionKey};','target:activeMissionKey,scale:navigationContext.id};');
rep('renderer:{calls:R.info.render.calls','originRebase:originRebaseState,navigationScale:navigationContext,renderer:{calls:R.info.render.calls');
fs.writeFileSync(file,s);
