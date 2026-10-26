// Metric walking simulation independent of rendering and keyboard event repeat.
export class Walker {
  constructor({eyeHeight=1.74,stepLength=.62,onFootfall=()=>{}}={}) {
    this.eyeHeight=eyeHeight; this.stepLength=stepLength; this.onFootfall=onFootfall;
    this.reset(0,0,0);
  }
  reset(x,z,yaw=0) {
    Object.assign(this,{x,z,yaw,vx:0,vz:0,turnVelocity:0,distance:0,steps:0,phase:0,bob:0,sway:0,roll:0,activity:0});
  }
  stop() { this.vx=this.vz=this.turnVelocity=this.bob=this.sway=this.roll=this.activity=0; }
  update(dt,input,canStand=()=>true) {
    // Small integration increments keep collisions and cadence stable at varying frame rates.
    let remaining=Math.min(Math.max(dt,0),.25);
    while(remaining>1e-7){const h=Math.min(remaining,1/120);this.integrate(h,input,canStand);remaining-=h;}
    return this;
  }
  integrate(dt,{forward=0,side=0,turn=0,slow=false},canStand) {
    const follow=(a,b,rate)=>a+(b-a)*(1-Math.exp(-rate*dt));
    this.turnVelocity=follow(this.turnVelocity,turn*1.35,12);this.yaw+=this.turnVelocity*dt;
    const norm=Math.max(1,Math.hypot(forward,side));
    // Shorter, slower indoor steps backwards/sideways; Shift is careful walking.
    const speed=(slow?.48:forward<0?.72:side&&!forward?.75:1.12);
    const targetX=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)/norm*speed;
    const targetZ=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)/norm*speed;
    const rate=forward||side?6:13;
    this.vx=follow(this.vx,targetX,rate);this.vz=follow(this.vz,targetZ,rate);
    const pulse=1+.14*Math.cos(this.phase*2*Math.PI);
    const dx=this.vx*pulse*dt,dz=this.vz*pulse*dt;
    const oldX=this.x,oldZ=this.z;
    if(canStand(this.x+dx,this.z))this.x+=dx;else this.vx=0;
    if(canStand(this.x,this.z+dz))this.z+=dz;else this.vz=0;
    const distance=Math.hypot(this.x-oldX,this.z-oldZ);
    this.distance+=distance;this.phase=this.distance/this.stepLength;
    const count=Math.floor(this.phase);
    while(this.steps<count){this.steps++;this.onFootfall({foot:this.steps%2?'left':'right',speed:distance/dt,x:this.x,z:this.z});}
    const moving=distance/dt;
    this.activity=follow(this.activity,Math.min(1,moving/.85),12);
    // About 3 cm peak-to-peak vertical excursion; sway alternates between feet.
    this.bob=follow(this.bob,-Math.cos(this.phase*2*Math.PI)*.015*this.activity,25);
    this.sway=follow(this.sway,Math.sin(this.phase*Math.PI)*.009*this.activity,18);
    this.roll=follow(this.roll,Math.sin(this.phase*Math.PI)*.004*this.activity,18);
    if(!forward&&!side&&Math.hypot(this.vx,this.vz)<.003){this.vx=this.vz=0;}
  }
  get eyeY(){return this.eyeHeight+this.bob;}
}
