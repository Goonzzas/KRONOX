import fs from 'node:fs';
const p='src/App.jsx';let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');s="import {NAVIGATION_SCALES,scaleContext} from './scene/navigationScale.js';\n"+s;
function rep(a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,70));s=s.replace(a,b);}
rep('    [performanceReport,setPerformanceReport]=useState(null),',"    [navigationScale,setNavigationScale]=useState(()=>scaleContext('solar')),\n    [performanceReport,setPerformanceReport]=useState(null),");
rep('      quality,','      quality,\n      onNavigationScale:setNavigationScale,\n      onNearbyMapChange:setNearbyMapActive,');
rep("    !welcomeOpen&&!missionOpen&&!realTimeIntroActive&&h('div',{className:'juanLabFlightBar'},",`    !welcomeOpen&&!missionOpen&&!realTimeIntroActive&&h('aside',{className:'juanScaleContext','aria-label':'Escala astronómica'},
      h('b',null,\`Nivel \${navigationScale.level} · \${navigationScale.label}\`),
      h('span',null,navigationScale.targetName?\`Destino: \${navigationScale.targetName}\${navigationScale.distancePc!==null?' · '+navigationScale.distancePc.toLocaleString('es',{maximumFractionDigits:2})+' pc de catálogo':''}\`:'Selecciona una escala para situarte'),
      h('small',null,navigationScale.description),
      h('nav',null,...NAVIGATION_SCALES.map(scale=>h('button',{key:scale.id,'aria-pressed':navigationScale.id===scale.id,onClick:()=>{A()?.setNavigationScale?.(scale.id);setFr(false);setMissionTraveling(false);}},\`\${scale.level}. \${scale.label}\`))),
    ),
    !welcomeOpen&&!missionOpen&&!realTimeIntroActive&&h('div',{className:'juanLabFlightBar'},`);
fs.writeFileSync(p,s);
const scene='src/scene/createScene.js';s=fs.readFileSync(scene,'utf8');
s=s.replace("    const previousScale=navigationContext.id;publishScale('extragalactic');","    const previousScale=navigationContext.id;publishScale('extragalactic');S.onNearbyMapChange?.(true);");
s=s.replace("    const saved = nearbyMapState;publishScale(saved.scale||'stellar');","    const saved = nearbyMapState;publishScale(saved.scale||'stellar');S.onNearbyMapChange?.(false);");
s=s.replace('  function missionTarget(key, onArrive) {','  function missionTarget(key, onArrive) {\n    if(realTimeIntro||launchSequence||launchCameraBlend)return false;\n    if(nearbyMapState)returnFromNearbyMap();');
fs.writeFileSync(scene,s);
