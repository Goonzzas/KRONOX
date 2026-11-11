/** Analytic damped flight integrator: deterministic across frame rates. */
export function integrateFlightVelocity(current,target,delta,{inertia=false,automatic=false,activeInput=false,speed=1}={}){
 const dt=Math.max(0,Math.min(.1,delta));const moving=activeInput||automatic;
 const damping=moving?(inertia?1.2:14):12,decay=Math.exp(-damping*dt);
 const velocity=current.map((v,i)=>target[i]+(v-target[i])*decay);
 const displacement=current.map((v,i)=>target[i]*dt+(v-target[i])*(1-decay)/damping);
 if(!moving&&Math.hypot(...velocity)<Math.max(1e-7,Math.abs(speed)*1e-4))velocity.fill(0);
 return {velocity,displacement};
}
export function cameraOwner({intro=false,reentry=false,navigation=false,director=false,orbit=false,cabin=false}={}){return intro?'intro':reentry?'reentry':navigation?'navigation':director?'director':orbit?'orbit':cabin?'cabin':'flight';}
