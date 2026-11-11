import fs from 'node:fs';let p='src/scene/createScene.js',s=fs.readFileSync(p,'utf8');s="import {heliocentricMapPosition,SOLAR_GALACTIC_ANCHOR} from './astronomicalPositions.js';\n"+s;
const a=s.indexOf('// A single scale cannot'),b=s.indexOf('const PLANET_TEXTURE_FILES',a);if(a<0||b<0)throw Error('old scale constants');s=s.slice(0,a)+s.slice(b);
const c=s.indexOf('function visualDistanceInMapUnits('),d=s.indexOf('\nconst hs =',c);if(c<0||d<0)throw Error('old coords span');s=s.slice(0,c)+s.slice(d);
s=s.replace('  sc.add(gal);','  gal.quaternion.normalize();\n  sc.add(gal);');
s=s.replace('  const missionMarkers = new Map();',`  const missionDestinationGroup=new THREE.Group();missionDestinationGroup.name='ICRS destinations relative to Solar origin';missionDestinationGroup.quaternion.copy(gal.quaternion);sc.add(missionDestinationGroup);
  const missionMarkers = new Map();`);
s=s.replace('marker.position.copy(localGalacticPosition(target));','marker.position.fromArray(heliocentricMapPosition(target));');s=s.replace('    gal.add(marker);missionMarkers.set','    missionDestinationGroup.add(marker);missionMarkers.set');
const old=`      gal.position
        .set(RG * Math.cos(ph), 0, RG * Math.sin(ph))
        .applyQuaternion(gal.quaternion)
        .negate();`;
if(!s.includes(old))throw Error('gal anchor');s=s.replace(old,`      gal.position.fromArray(SOLAR_GALACTIC_ANCHOR).applyAxisAngle(new V(0,1,0),-ph).applyQuaternion(gal.quaternion).negate();`);
s=s.replace('      GU.uT.value += dt * 0.004;',"      if(fl.gal&&navigationContext.id==='milkyway')GU.uT.value += dt * 0.004;");fs.writeFileSync(p,s);
p='tests/repair-d.test.mjs';s=fs.readFileSync(p,'utf8').replace("source.includes('gal.add(marker)')","source.includes('missionDestinationGroup.add(marker)')");s="import {heliocentricMapPosition,visualDistanceInMapUnits} from '../src/scene/astronomicalPositions.js';\n"+s;s+=`\ntest('Solar-origin target frame has no galactic-anchor offset and preserves ICRS angular separations',()=>{const a={ra:0,dec:0,distanceLy:6},b={ra:90,dec:0,distanceLy:6};const pa=new THREE.Vector3(...heliocentricMapPosition(a)),pb=new THREE.Vector3(...heliocentricMapPosition(b));assert.ok(Math.abs(pa.length()-visualDistanceInMapUnits(6))<1e-5);assert.ok(Math.abs(pa.angleTo(pb)-Math.PI/2)<1e-8);assert.ok(new THREE.Vector3(...heliocentricMapPosition({...a,distanceLy:0})).length()<1e-12);const source=fs.readFileSync('src/scene/createScene.js','utf8');assert.match(source,/missionDestinationGroup.quaternion.copy\\(gal.quaternion\\)/);});\n`;fs.writeFileSync(p,s);
