import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCinematicSoundtrack} from '../src/utils/cinematicSoundtrack.js';
import {synthesizeWithFishAudio,FISH_AUDIO_VOICE_ID} from '../src/server/fishAudioTts.js';
import {createSceneHarness} from '../scripts/test-support/sceneHarness.mjs';

const player=()=>({currentTime:0,volume:1,paused:true,plays:0,pauses:0,play(){this.plays++;this.paused=false;return Promise.resolve();},pause(){this.pauses++;this.paused=true;},removeAttribute(){},load(){}});
test('One score continues across scene changes, ducks under voice and stops/resets on completion or skip',async()=>{
 const audio=player(),track=createCinematicSoundtrack({src:'/KRONOX/audio/intro-score.mp3',audioFactory:()=>audio});
 await track.start();audio.currentTime=12;
 track.start();track.start();assert.equal(audio.plays,1);assert.equal(audio.currentTime,12);assert.equal(audio.loop,true);
 const normal=audio.volume;track.setSpeaking(true);assert.ok(audio.volume<normal);track.setSpeaking(false);assert.equal(audio.volume,normal);
 track.stop();assert.ok(audio.paused);assert.equal(audio.currentTime,0);
 await track.start();assert.equal(audio.plays,2);track.dispose();assert.ok(audio.paused);
});
test('An autoplay block can be retried by a gesture without holding the camera or stacking tracks',async()=>{
 const audio=player(),blocked=[];let permitted=false;
 audio.play=function(){this.plays++;return permitted?Promise.resolve():Promise.reject(Object.assign(new Error('Gesture required'),{name:'NotAllowedError'}));};
 const track=createCinematicSoundtrack({audioFactory:()=>audio,onBlocked:value=>blocked.push(value)});
 await track.start();assert.deepEqual(blocked,[true]);permitted=true;await track.unlock();assert.deepEqual(blocked,[true,false]);
 await track.unlock();assert.equal(audio.plays,2);track.dispose();
});
test('A late play promise from a skipped intro cannot alter its immediate replay',async()=>{
 const audio=player();const resolves=[];audio.play=()=>new Promise(resolve=>resolves.push(resolve));
 const track=createCinematicSoundtrack({audioFactory:()=>audio});const first=track.start();track.stop();const replay=track.start();
 resolves[1]();await replay;const pauses=audio.pauses;resolves[0]();await first;assert.equal(audio.pauses,pauses);track.dispose();
});
test('Fish uses the requested voice and a documented model and latency; credentials stay server-side',async()=>{
 const previous=process.env.FISH_AUDIO_API_KEY;process.env.FISH_AUDIO_API_KEY='test-only-key';
 try{
  const result=await synthesizeWithFishAudio({text:'Bienvenido a bordo.',fetchImpl:async(url,opts)=>{
   assert.equal(url,'https://api.fish.audio/v1/tts');assert.equal(opts.headers.model,process.env.FISH_AUDIO_MODEL||'s2.1-pro-free');
   assert.equal(JSON.parse(opts.body).reference_id,FISH_AUDIO_VOICE_ID);assert.equal(JSON.parse(opts.body).latency,'balanced');
   assert.ok(opts.headers.Authorization.startsWith('Bearer '));return{ok:true,headers:{get:()=> 'audio/mpeg'},arrayBuffer:async()=>new Uint8Array(256).buffer};
  }});assert.equal(result.referenceId,'8150d8bf74d245cd84a154b785aa7fab');
 }finally{if(previous===undefined)delete process.env.FISH_AUDIO_API_KEY;else process.env.FISH_AUDIO_API_KEY=previous;}
});
test('Production intro timings finish without audio; first satellite framing blends from the preceding pose',async()=>{
 // Exercise the actual production timeline, rather than the legacy shorter harness preset.
 const source=fs.readFileSync('src/scene/createScene.js','utf8').replace('Boolean(globalThis.__KRONOX_SCENE_HARNESS__)','false');
 const stages=[],h=await createSceneHarness({sourceOverride:source,stateOverrides:{reducedMotion:()=>false,onIntroStageChange:key=>stages.push(key),shouldHoldIntroStage:()=>false}});
 try{
  const api=await h.start();api.startRealTimeIntro();
  let previous=h.renderers[0].camera.position.clone(),previousPhase='opening',openingEnd,transitionStep;
  let frames=0;
  while(api.introSnapshot().active&&frames++<1800){
   h.stepFrames(1);const snap=api.introSnapshot(),camera=h.renderers[0].camera;
   if(previousPhase==='opening'&&snap.phase==='cinematic')openingEnd=previous.clone();
   if(snap.stageNotified===1&&transitionStep===undefined)transitionStep=camera.position.distanceTo(openingEnd);
   previousPhase=snap.phase;previous.copy(camera.position);
  }
  assert.equal(api.introSnapshot().active,false);
  assert.ok(frames/30<53);assert.ok(frames/30>47);assert.ok(api.introSnapshot().cabinVisible);
  assert.deepEqual(stages,['opening','escena2_spherex','escena3_conocimiento','escena4_galaxia','escena5_nave','escena6_puente','escena7_spherex','escena8_habitabilidad','escena9_ingenieria','escena10_inicio']);
  assert.ok(transitionStep<0.05,'The first camera movement must blend, not teleport');
 }finally{await h.close();}
});
