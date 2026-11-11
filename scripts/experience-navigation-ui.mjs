import fs from 'node:fs';let p='src/App.jsx',s=fs.readFileSync(p,'utf8');s="import NavigationDock from './components/NavigationDock.jsx';\nimport './styles/navigationExperience.css';\n"+s;const a=s.indexOf("    !welcomeOpen&&!missionOpen&&!realTimeIntroActive&&h('aside',{className:'juanScaleContext'"),b=s.indexOf('    nearbyMapActive &&',a);if(a<0||b<0)throw Error('navigation span');s=s.slice(0,a)+`    !welcomeOpen&&!missionOpen&&!realTimeIntroActive&&h(NavigationDock,{
      context:navigationScale,
      onScale:id=>{if(A()?.setNavigationScale?.(id)){setFr(false);setMissionTraveling(false);setMissionArrival(null);setSelectedObject(null);setNearbyGalaxyInfoKey(null);}},
      onObserve:()=>{setMissionTargetKey(selectedObject?.kind==='spherex'?selectedObject.key:missionTargetKey);setMissionInitialStage('explore');setMissionOpen(true);},
      onReenter:()=>{A()?.reenterCabin?.();setFr(true);setPv(1);setKronoxOpen(true);},
      onStop:()=>{A()?.stopAndInspect?.();setFr(false);setMissionTraveling(false);},
      onView:()=>{A()?.view?.(pv===1?3:1);setPv(pv===1?3:1);},
      onMissions:()=>setMissionSelectorOpen(true),
      onMap:()=>{A()?.setNavigationScale?.('stellar');setFr(false);setNearbyMapActive(false);setSelectedObject(null);setMissionArrival(null);},
      onSettings:()=>setOpen(true),
      onStartPerformance:()=>{A()?.startPerformanceCapture?.();setPerformanceReport(null);},onPerformance:()=>setPerformanceReport(A()?.performanceSnapshot?.()),performanceReport,
    }),
`+s.slice(b);s=s.replace("    guideObjective &&","    guideObjective && fr && pv===1 && !nearbyMapActive && !missionTraveling &&");s=s.replace("          A().focusSolarSystemMap();","          A().setNavigationScale?.('solar');setFr(false);setNearbyMapActive(false);setSelectedObject(null);");fs.writeFileSync(p,s);
p='src/components/SpaceshipCockpit.jsx';s=fs.readFileSync(p,'utf8');s=s.replace("tgt.mission === 'motion'\n            ?", "tgt.type === 'galaxia'\n            ? 'Galaxia · cobertura SPHEREx'\n            : tgt.mission === 'motion'\n            ?");s=s.replace('Controles de navegación</span>','Más ajustes</span>').replace('Viajar hacia esta estrella','Viajar al objeto');fs.writeFileSync(p,s);
p='src/components/NearbyGalaxies.jsx';s=fs.readFileSync(p,'utf8').replace("'Galactic neighborhood' : 'Vecindario galáctico'","'Extragalactic neighborhood' : 'Entorno extragaláctico'");const start=s.indexOf('      <p className="nearbyGalaxyDisclaimer">'),end=s.indexOf('      <button type="button" className="nearbyGalaxyReturn"',start);if(start<0||end<0)throw Error('galaxy controls span');s=s.slice(0,start)+`      <div className="nearbyGalaxyCatalogList" aria-label="Galaxias y distancias">{NEARBY_GALAXIES.map(item=><button key={item.key} aria-pressed={item.key===selected.key} onClick={()=>onSelect(item.key)}><b>{text(item.name,language)}</b><span>{item.distanceMly?item.distanceMly+' Mly':item.kind==='group'?'Grupo':'Origen'}</span></button>)}</div>
      <p className="nearbyGalaxyDisclaimer">Posiciones de catálogo; distancias comprimidas con una escala logarítmica. Los radios son simbólicos y se reducen en pares próximos para evitar solapamiento. Los grupos se señalan sin duplicar sus galaxias.</p>
`+s.slice(end);fs.writeFileSync(p,s);
