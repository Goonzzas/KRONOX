import fs from 'node:fs';
const edit=(file,fn)=>{const before=fs.readFileSync(file,'utf8'),after=fn(before);if(before===after)throw Error('No change: '+file);fs.writeFileSync(file,after);};
edit('tests/experience.test.mjs',s=>s.replace("JSON.stringify(renderer.toJSON()).includes('40 imágenes')","inner(renderer.root).includes('40 imágenes')").replaceAll("radius:20,color:'#aabbcc'","radius:20,color:'#aabbcc',softMap:new THREE.Texture()"));
edit('src/App.jsx',s=>{
 const anchor='    [missionArrivalName, setMissionArrivalName] = useState(\'\'),';
 if(!s.includes(anchor))throw Error('State anchor missing');
 // Add the ref after the complete state declaration, before the first existing useRef.
 const p=s.indexOf('  const ',s.indexOf(anchor)+anchor.length);
 if(p<0)throw Error('Ref insertion missing');
 s=s.slice(0,p)+`  const missionOfferTimer=useRef(null);
  const clearMissionOffer=()=>{clearTimeout(missionOfferTimer.current);setMissionLaunchTarget(null);setMissionArrival(false);};
  useEffect(()=>()=>clearTimeout(missionOfferTimer.current),[]);
`+s.slice(p);
 s=s.replaceAll('setMissionArrival(null);','clearMissionOffer();');
 s=s.replace('setSelectedObject(obj);if(obj)clearMissionOffer();','setSelectedObject(obj);if(obj)clearMissionOffer();');
 s=s.replace('          setNearbyGalaxyKey(key);\n          A().focusNearbyGalaxy(key);','          setNearbyGalaxyKey(key);clearMissionOffer();\n          A().focusNearbyGalaxy(key);');
 s=s.replace('      setMissionTraveling(true);\n      setMissionLaunchTarget(null);','      setMissionTraveling(true);\n      clearMissionOffer();');
 s=s.replace('          setTimeout(() => {\n            setMissionArrival(false);','          missionOfferTimer.current=setTimeout(() => {\n            setMissionArrival(false);');
 s=s.replace('onObserve:()=>{setMissionTargetKey','onObserve:()=>{clearMissionOffer();setMissionTargetKey');
 return s;
});
fs.appendFileSync('src/styles/navigationExperience.css',`\n.app .guideObjectiveHud,.app .navigationGuide{top:86px;max-width:min(360px,calc(100vw - 680px))}.app .missionLaunchWindow{bottom:18px;left:16px;max-width:min(440px,calc(100vw - 32px))}@media(max-width:1100px) and (min-width:601px){.app .guideObjectiveHud,.app .navigationGuide{max-width:calc(100vw - 570px)}}@media(max-width:600px){.app .guideObjectiveHud,.app .navigationGuide{top:auto;bottom:88px;max-width:calc(100vw - 32px)}.app .missionLaunchWindow{bottom:88px;left:10px;max-width:calc(100vw - 20px)}}\n`);
