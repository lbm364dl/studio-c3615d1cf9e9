import * as THREE from 'three';
import {furnish} from './decor.mjs';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import { Walker } from './walking.mjs';
import { Reflector } from './vendor/Reflector.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';
const $=id=>document.getElementById(id), BASE_AREA=36.2958;
const defaults={scale:100,walls:1.05,palette:'existing',furniture:true,labels:true,livingLayout:"daily"};
let saved={};try{saved=JSON.parse(localStorage.getItem('homestudio.studio.v1'))||{}}catch{}
if(saved.decorRevision!==1){saved.furniture=true;saved.decorRevision=1}
if(saved.layoutRevision!==4){saved.livingLayout="daily";saved.layoutRevision=4}
const state={...defaults,...saved}; state.scale=Math.max(95,Math.min(110,Number(state.scale)||100));state.walls=Math.max(.15,Math.min(2.6,Number(state.walls)||1.05));
let mode='orbit', inside=false;
const EYE_HEIGHT=1.74, BODY_RADIUS=.18;
let yaw=0,pitch=0,colliders=[],lastTime=0,dragging=false,walkPaused=false;
const keys=new Set();
let audioContext=null;
const walker=new Walker({eyeHeight:EYE_HEIGHT,onFootfall:playFootstep});
function unlockAudio(){if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{})}
function playFootstep({foot,speed,x,z}){
 if(!audioContext||audioContext.state!=='running'||!$('footstepSound').checked||speed<.08)return;
 const time=audioContext.currentTime,ceramic=x>world(4.74,0,0).x&&z>world(0,0,4.79).z;
 const length=.13,buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*length),audioContext.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(data.length*.16));
 const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain(),pan=audioContext.createStereoPanner();
 source.buffer=buffer;filter.type='lowpass';filter.frequency.value=ceramic?2100:850;gain.gain.setValueAtTime(Math.min(.16,speed*.11),time);gain.gain.exponentialRampToValueAtTime(.001,time+length);pan.pan.value=foot==='left'?-.18:.18;
 source.connect(filter).connect(gain).connect(pan).connect(audioContext.destination);source.start(time);source.stop(time+length);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect()};
 const thud=audioContext.createOscillator(),g=audioContext.createGain();thud.type='sine';thud.frequency.setValueAtTime(ceramic?140:95,time);thud.frequency.exponentialRampToValueAtTime(48,time+.09);g.gain.setValueAtTime(.035*Math.min(1,speed),time);g.gain.exponentialRampToValueAtTime(.0001,time+.1);thud.connect(g).connect(audioContext.destination);thud.start(time);thud.stop(time+.11);thud.onended=()=>{thud.disconnect();g.disconnect()};
}
const daylight={date:'2026-10-18',hour:10,facade:75,lamps:false};
let roomLights=[],skyLights=[];
const rooms=[
{id:'bed1',name:'Bedroom 1',area:9.62,x:1.3,z:1.8,info:'2.60 × 3.70 m assumed; the plan also says 2.55 × 3.40 m. Wardrobe adds approximately 0.85 m². Balcony depth estimated.',photo:'03'},
{id:'bed2',name:'Bedroom 2',area:7.77,x:3.79,z:1.8,info:'2.10 × 3.70 m assumed. Depth inferred from the adjacent rooms; window faces the street.',photo:'15'},
{id:'kitchen',name:'Kitchen',area:5.18,x:5.68,z:1.8,info:'1.40 × 3.70 m from plan. Cabinet depth ≈ 60 cm, leaving ≈ 80 cm aisle. Cabinet sequence inferred from photo.',photo:'00'},
{id:'living',name:'Living + passage',area:10.6218,x:3.25,z:5.4,info:'Main living area 2.70 × 3.40 m plus the passage to kitchen and bathroom. Entry-side window from photos; exact position estimated.',photo:'01'},
{id:'bath',name:'Bathroom',area:2.254,x:5.2,z:5.8,info:'0.92 × 2.45 m assumed; the plan also gives 2.40 m externally. Basin, toilet and shower inferred from photos. This narrow width needs checking.',photo:'05'}];
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){$('error').hidden=false;throw e}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#e9ece4');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;$('canvasHost').append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Interactive 3D reconstruction of Home Studio apartment');
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9ece4');
const camera=new THREE.PerspectiveCamera(40,1,.05,150);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=.3;controls.maxDistance=32;
const hemi=new THREE.HemisphereLight(0xd9e9ff,0x8e8273,.12);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff4df,2.0);sun.position.set(-4,12,-6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:50});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff,.45);fill.position.set(8,5,7);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe9ece4,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.24;ground.receiveShadow=true;scene.add(ground);
let model=new THREE.Group();scene.add(model);let mats={}, floorTex;
function woodTexture(){
 const c=document.createElement('canvas');c.width=1024;c.height=2048;const ctx=c.getContext('2d');let seed=41;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let x=0;x<1024;x+=128){let offset=Math.floor(rnd()*700);for(let y=-offset;y<2048;y+=850){const shade=rnd()*27;ctx.fillStyle=`rgb(${143+shade},${112+shade},${79+shade})`;ctx.fillRect(x,y,128,850);
 for(let j=0;j<240;j++){const xx=x+rnd()*128;ctx.strokeStyle=`rgba(${rnd()>.5?'64,43,28':'233,212,179'},${rnd()*.19})`;ctx.lineWidth=.4+rnd()*1.2;ctx.beginPath();ctx.moveTo(xx,y);ctx.bezierCurveTo(xx+7,y+250,xx-9,y+530,xx+2,y+850);ctx.stroke()}
 ctx.strokeStyle='rgba(49,35,24,.32)';ctx.lineWidth=1.5;ctx.strokeRect(x,y,128,850);
 }}const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=renderer.capabilities.getMaxAnisotropy();return tx}
function plasterTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128);let seed=9;for(let i=0;i<im.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;let v=180+(seed%45);im.data.set([v,v,v,255],i)}ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);return t}
const plaster=plasterTexture();
const textureLoader=new THREE.TextureLoader();
function loadSurface(name,color=false){const tx=textureLoader.load(`assets/materials/wood-${name}.jpg`);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;if(color)tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=renderer.capabilities.getMaxAnisotropy();return tx}
floorTex=loadSurface('color',true);const floorNormal=loadSurface('normal'),floorRough=loadSurface('rough');
function material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.8,...extra})}
function box(x,y,z,w,h,d,mat=mats.wall,parent=model){const m=new THREE.Mesh(([mats.white,mats.cabinet,mats.oak].includes(mat)&&Math.min(w,h,d)>.06?new RoundedBoxGeometry(w,h,d,2,.008):new THREE.BoxGeometry(w,h,d)),mat);m.position.set(x,y,z);m.castShadow=mat!==mats.glass;m.receiveShadow=true;parent.add(m);return m}
function cylinder(x,y,z,r,h,mat,parent=model){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),mat);m.position.set(x,y,z);m.castShadow=mat!==mats.glass;m.receiveShadow=true;parent.add(m);return m}
function floorRect(x,z,w,d,mat=mats.floor){const m=box(x+w/2,-.07,z+d/2,w,.14,d,mat);if(mat===mats.floor){const uv=m.geometry.attributes.uv,pos=m.geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+x+w/2)/1.44,(pos.getZ(i)+z+d/2)/3.0);uv.needsUpdate=true}}
// Walls follow inside faces; openings are distances along each segment in metres.
function wall(x1,z1,x2,z2,openings=[],thickness=.14){let len=Math.hypot(x2-x1,z2-z1),dx=(x2-x1)/len,dz=(z2-z1)/len,H=inside?2.6:state.walls;
 function part(a,b,bottom,top,mat=mats.wall,th=thickness){if(b<=a||top<=bottom)return;const m=box(x1+dx*(a+b)/2,(bottom+top)/2,z1+dz*(a+b)/2,b-a,top-bottom,th,mat);m.rotation.y=-Math.atan2(dz,dx)}
 let cursor=0;for(const o of openings.sort((a,b)=>a.a-b.a)){part(cursor,o.a,0,H);const sill=o.type==='window'?(o.sill??.88):0,head=o.type==='window'?(o.head??2.18):2.1;part(o.a,o.b,0,Math.min(sill,H));part(o.a,o.b,head,H);if(o.type==='window'&&H>sill){part(o.a,o.b,sill,Math.min(head,H),mats.glass,.035);part(o.a,o.b,sill,Math.min(sill+.055,H),mats.white,.10);part(o.a,o.b,head-.055,Math.min(head,H),mats.white,.10);for(const v of [o.a,(o.a+o.b)/2,o.b])part(v-.025,v+.025,sill,Math.min(head,H),mats.white,.07)}else if(o.type==='balcony'&&H>.1){part(o.a,o.b,.12,Math.min(head,H),mats.glass,.035);for(const v of [o.a,(o.a+o.b)/2,o.b])part(v-.025,v+.025,0,Math.min(head,H),mats.white,.08)}if(o.type==='door'){for(const v of [o.a-.035,o.b+.035])part(v-.025,v+.025,0,Math.min(2.13,H),mats.white,thickness+.045);part(o.a-.06,o.b+.06,2.1,Math.min(2.17,H),mats.white,thickness+.045)}cursor=o.b}part(cursor,len,0,H);
 // Skirting board is interrupted at doorways, and matches the cutaway height.
 let skips=openings.filter(o=>o.type!=='window'),c=0;for(const o of skips){part(c,o.a,0,Math.min(.075,H),mats.white,thickness+.025);c=o.b}part(c,len,0,Math.min(.075,H),mats.white,thickness+.025)
}
function build(){roomLights=[];skyLights=[];for(const child of [...model.children]){child.traverse(o=>{if(o.isReflector)o.dispose();if(o.geometry)o.geometry.dispose()});model.remove(child)}for(const m of Object.values(mats))m.dispose();
const colors={existing:['#f7f5ef','#aa9d8a'],warm:['#efe5d1','#c9ac81'],sage:['#dce4d4','#9caa93']}[state.palette]||['#f7f5ef','#aa9d8a'];
mats={wall:material(colors[0],{bumpMap:plaster,bumpScale:.002,roughness:.94}),floor:material('#ffffff',{map:floorTex,normalMap:floorNormal,normalScale:new THREE.Vector2(.45,.45),roughnessMap:floorRough,roughness:1.0}),white:material('#f8f6ef',{roughness:.35}),cabinet:material(colors[1],{roughness:.44}),oak:material('#bc9864'),dark:material('#353b36'),glass:material('#b4d1d1',{transparent:true,opacity:.32,roughness:.13,depthWrite:false}),tile:material('#b7aaa0'),green:material('#829477'),linen:material('#e6d9c5'),metal:material('#888e88',{metalness:.8,roughness:.25})};
const s=state.scale/100;model.scale.set(s,1,s);model.position.set(-3.19*s,0,-3.62*s);
floorRect(0,0,2.6,3.7);floorRect(2.74,0,2.1,3.7);floorRect(4.98,0,1.4,3.7);floorRect(0,3.84,1.7,.5);floorRect(1.9,3.84,2.7,3.4);floorRect(4.6,3.84,1.78,.81);floorRect(4.74,4.79,.92,2.45,mats.tile);floorRect(.8,-.82,1.1,.68,mats.tile);
wall(-.12,-.12,6.5,-.12,[{a:.92,b:2.02,type:'balcony'},{a:3.32,b:4.42,type:'window'},{a:5.34,b:6.1,type:'window'}],.24);
wall(-.12,0,-.12,4.46,[],.24);wall(6.5,0,6.5,4.77,[],.24);
wall(2.67,0,2.67,3.77);wall(4.91,0,4.91,3.77);
wall(0,3.77,6.38,3.77,[{a:0,b:1.7,type:'wardrobe'},{a:2.02,b:2.58,type:'door'},{a:3.37,b:4.08,type:'door'},{a:5.07,b:5.75,type:'door'}]);
wall(0,4.41,1.77,4.41);wall(1.77,3.84,1.77,4.41);wall(1.83,3.84,1.83,7.36);
wall(4.67,4.72,6.5,4.72,[{a:.12,b:.75,type:'door'}]);wall(4.67,4.79,4.67,7.24);wall(5.78,4.79,5.78,7.36,[],.24);
wall(1.83,7.36,5.78,7.36,[{a:1.97,b:2.42,type:'window',sill:1.20,head:1.90},{a:.92,b:1.68,type:'door'},{a:3.01,b:3.64,type:'window'}],.24);
// Balcony rail, the built-in wardrobe and kitchen evidenced by the photographs.
box(1.35,.52,-.83,1.18,1.04,.035,mats.green);for(const x of [.77,1.93])box(x,.52,-.49,.035,1.04,.68,mats.metal);box(1.35,1.06,-.83,1.22,.035,.045,mats.metal);for(let x=.8;x<1.95;x+=.13)box(x,.52,-.83,.016,1,.016,mats.metal);
box(.85,Math.min(2.4,inside?2.6:state.walls)/2,4.02,1.66,Math.min(2.4,inside?2.6:state.walls),.48,mats.white);box(.85,.79,3.765,1.66,.15,.025,mats.oak);box(.85,.5,3.75,.018,Math.min(inside?2.6:state.walls,1),.025,mats.metal);
for(let z=.55;z<3.4;z+=.6){box(6.07,.43,z,.6,.86,.58,mats.cabinet);box(5.755,.69,z,.018,.025,.23,mats.metal);if(inside||state.walls>1.45)box(6.2,1.78,z,.34,.64,.58,mats.cabinet)}box(6.06,.89,1.75,.64,.06,3.04,mats.oak);
box(6.04,.93,1.05,.43,.02,.49,mats.metal);box(6.04,.947,1.05,.33,.018,.38,mats.dark);box(6.25,1.08,.8,.025,.28,.025,mats.metal);box(6.14,1.21,.8,.22,.025,.025,mats.metal);
box(6.04,.931,2.22,.5,.025,.52,mats.dark);for(let x of [5.91,6.16])for(let z of [2.08,2.34])cylinder(x,.948,z,.075,.006,mats.metal);
box(5.748,.45,2.22,.022,.55,.5,mats.dark);
// Bathroom fixtures: approximate positions; rear shower inferred from the photo.
box(5.18,.045,6.84,.86,.09,.75,mats.white);box(5.19,1.0,6.44,.84,1.95,.025,mats.glass);box(5.19,1.99,6.44,.86,.035,.035,mats.metal);
box(4.96,.5,5.47,.4,.76,.57,mats.oak);box(4.98,.91,5.47,.43,.08,.6,mats.white);box(4.98,.956,5.47,.22,.012,.3,mats.tile);box(4.82,1.04,5.47,.025,.2,.025,mats.metal);
const mirror=new Reflector(new THREE.CircleGeometry(.27,64),{textureWidth:512,textureHeight:512,color:0xd8dcda,clipBias:.003,multisample:0});mirror.position.set(4.766,1.55,5.47);mirror.rotation.y=Math.PI/2;const renderReflection=mirror.onBeforeRender;mirror.onBeforeRender=function(...args){const worldPos=this.getWorldPosition(new THREE.Vector3());if(args[2].position.distanceTo(worldPos)<2.5)renderReflection.apply(this,args)};model.add(mirror);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.279,.012,8,64),mats.white);rim.position.copy(mirror.position);rim.rotation.copy(mirror.rotation);model.add(rim);
const bowl=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),mats.white);bowl.position.set(5.18,.36,6.14);bowl.scale.set(.20,.22,.28);model.add(bowl);cylinder(5.18,.16,6.14,.12,.3,mats.white);box(4.89,.54,6.14,.18,.62,.41,mats.white);cylinder(5.22,.54,6.14,.19,.045,mats.white).scale.z=1.3;
if(state.furniture)furnish(model,mats,state.livingLayout);
addDetails();addDaylight();updateDaylight();
 renderer.shadowMap.needsUpdate=true;model.updateMatrixWorld(true);colliders=[];model.traverse(o=>{if(!o.isMesh||o.isReflector||o.userData.nonSolid)return;const b=new THREE.Box3().setFromObject(o);if(b.max.y>.22 && b.min.y<1.85)colliders.push(b)});
 if(inside)unstickWalker();
 $('walls').disabled=inside;$('scale').disabled=inside;$('calibrate').disabled=inside;
 $('area').textContent=(BASE_AREA*s*s).toFixed(2);$('scaleValue').textContent=`${Number(state.scale).toFixed(1)}%`;$('wallValue').textContent=state.walls>=2.6?'Full height':`${state.walls.toFixed(2)} m cutaway`;
$('viewStatus').textContent=`${inside?'Primera persona · ojos 1,74 m':mode==='top'?'Top view':'Perspective'} · ${state.scale===100?'plan scale':'scaled comparison'}`;
updateRoomInfo();try{localStorage.setItem('homestudio.studio.v1',JSON.stringify(state))}catch{}
}
function world(x,y,z){let s=state.scale/100;return new THREE.Vector3((x-3.19)*s,y,(z-3.62)*s)}
function overview(){leaveWalk();state.walls=1.05;$('walls').value=1.05;mode='orbit';camera.up.set(0,1,0);camera.fov=40;camera.updateProjectionMatrix();camera.position.set(8.3,10,10.8).multiplyScalar(Math.max(1,1.05/camera.aspect));controls.target.set(0,0,0);controls.enableRotate=true;controls.maxPolarAngle=Math.PI*.49;controls.update();setActive();build()}
function top(){leaveWalk();state.walls=1.05;$('walls').value=1.05;mode='top';camera.fov=40;camera.updateProjectionMatrix();camera.up.set(0,0,-1);camera.position.set(0,17,0);controls.target.set(0,0,0);controls.enableRotate=false;controls.update();setActive();build()}
function setActive(){$('orbit').classList.toggle('active',mode==='orbit');$('top').classList.toggle('active',mode==='top')}
function updateRoomInfo(){let r=rooms.find(r=>r.id===$('room').value);$('roomInfo').textContent=r?r.info:'Street-facing bedrooms and kitchen; entrance opens into the living room.';$('inside').disabled=false}
function focusRoom(){if(inside){enterWalk($('room').value);return}leaveWalk();let r=rooms.find(r=>r.id===$('room').value);if(!r){overview();return}updateRoomInfo();const t=world(r.x,0,r.z);controls.target.copy(t);if(mode==='top'){camera.position.copy(t).add(new THREE.Vector3(0,9,0))}else{camera.up.set(0,1,0);camera.position.copy(t).add(new THREE.Vector3(3.6,5,4.5))}controls.update()}
function addDetails(){
 // The ceiling is visible only at eye level; plan views retain an open roof.
 const ceilingRects=[[0,0,6.38,3.84],[0,3.84,1.7,.5],[1.9,3.84,2.7,3.4],[4.6,3.84,1.78,.81],[4.74,4.79,.92,2.45]];
 if(inside)for(const [x,z,w,d] of ceilingRects)box(x+w/2,2.66,z+d/2,w,.12,d,mats.wall);
 for(const [x,w] of [[2.02,.56],[3.37,.71],[5.07,.68]])floorRect(x,3.7,w,.14);floorRect(4.79,4.65,.63,.14);
 // Door at the entrance, white reveals, and wall plates seen in interior photos.
 box(3.13,1.04,7.35,.75,2.08,.055,mats.dark);box(3.4,1.0,7.30,.09,.025,.025,mats.metal);
 for(const [x,z] of [[2.57,3.4],[4.8,3.4],[6.36,3.4],[4.59,6.9]]){box(x,1.12,z,.025,.09,.08,mats.white);box(x-.016,1.12,z,.008,.05,.04,mats.cabinet)}
 for(const [x,z] of [[.01,1.3],[2.75,1.2],[1.91,5.2]]){box(x,.30,z,.024,.09,.15,mats.white);for(const zz of [z-.035,z+.035]){const outlet=cylinder(x-.014,.3,zz,.016,.008,mats.dark);outlet.rotation.z=Math.PI/2}}
 // Kitchen splashback, extraction hood and a warm under-cabinet strip.
 box(6.375,1.2,1.75,.012,.54,3.02,mats.tile);
 if(inside){box(6.15,1.5,2.22,.46,.08,.6,mats.metal);const stripMat=new THREE.MeshStandardMaterial({color:0xffecd2,emissive:0xffdab2,emissiveIntensity:1.2});mats.strip=stripMat;box(6.02,1.445,1.75,.05,.015,2.9,stripMat)}
 // Flush ceiling luminaires, using warm local illumination rather than an open roof.
 if(inside){mats.light=new THREE.MeshStandardMaterial({color:0xfff6e8,emissive:0xffe6c4,emissiveIntensity:1.6});for(const [x,z,power] of [[1.3,1.85,35],[3.79,1.85,30],[5.55,1.85,24],[3.25,5.5,38],[5.2,5.8,16],[4.9,4.2,12]]){cylinder(x,2.565,z,.13,.035,mats.white);cylinder(x,2.54,z,.11,.012,mats.light);const light=new THREE.PointLight(0xffedda,power*.42,5,2);light.userData.base=power*.42;light.position.set(x,2.35,z);model.add(light);roomLights.push(light)}}
}
function addDaylight(){
 // Diffuse sky contribution enters at the openings; room brightness is not uniform.
 if(!inside)return;
 // Approximate diffuse bounces from the larger street openings, locally per room.
 for(const [x,z,power] of [[1.3,1.5,4.8],[3.79,1.5,3.8],[5.45,1.5,2.6],[3.32,5.45,2.1]]){const l=new THREE.PointLight(z>4?0xffefd9:0xdce8f5,power,4.4,2);l.position.set(x,1.7,z);l.userData.base=power;l.castShadow=false;model.add(l);skyLights.push(l)}
 for(const [x,y,z,tx,tz,power] of [[1.35,1.6,-.30,1.35,2.5,9],[3.75,1.6,-.30,3.75,2.5,7],[5.60,1.6,-.30,5.60,2.5,5],[4.025,1.55,7.55,4.025,5.4,.9],[5.15,1.5,7.55,5.15,5.8,.7]]){
 const l=new THREE.SpotLight(0xc5dcf6,power,9,Math.PI*.39,1,2);l.position.set(x,y,z);l.target.position.set(tx,.65,tz);l.castShadow=true;l.shadow.mapSize.set(512,512);l.shadow.bias=-.0001;l.shadow.normalBias=.012;l.userData.base=power;model.add(l,l.target);skyLights.push(l)
 }
}
function solarState(){
 const h=Number(daylight.hour),probe=new Date(`${daylight.date}T12:00:00Z`),offsetString=new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',timeZoneName:'shortOffset'}).formatToParts(probe).find(x=>x.type==='timeZoneName').value;
 const offset=Number(offsetString.match(/GMT([+-]\d+)/)?.[1]||0);const d=new Date(`${daylight.date}T00:00:00Z`);d.setUTCMinutes(Math.round((h-offset)*60));
 const p=SunCalc.getPosition(d,40.4168,-3.7038);return {elevation:p.altitude,azimuth:(p.azimuth*180/Math.PI+180+360)%360,date:d.toISOString()}
}
function updateDaylight(){
 const p=solarState(),delta=(p.azimuth-daylight.facade)*Math.PI/180,above=Math.max(0,Math.sin(p.elevation)),sky=Math.min(1,Math.max(0,(p.elevation+.08)/.35));
 sun.position.set(Math.sin(delta)*Math.cos(p.elevation)*30,Math.sin(p.elevation)*30,-Math.cos(delta)*Math.cos(p.elevation)*30);sun.intensity=p.elevation>0?2.8*Math.pow(above,.4):0;sun.color.set(p.elevation<.22?0xffd4a0:0xfff3de);
 hemi.intensity=inside?.025+.40*sky:.7;fill.intensity=inside?0:.45;scene.background.set(inside?(sky>.3?'#aebfcb':'#293541'):'#e9ece4');
 for(const l of roomLights)l.intensity=daylight.lamps?l.userData.base:0;
 for(const l of skyLights)l.intensity=l.userData.base*sky;
 if(mats.light)mats.light.emissiveIntensity=daylight.lamps?1.6:0;
 if(mats.strip)mats.strip.emissiveIntensity=daylight.lamps?1.2:0;
 $('sunInfo').textContent=`Sol: ${p.azimuth.toFixed(0)}° · altura ${(p.elevation*180/Math.PI).toFixed(0)}° · Fachada ${daylight.facade}° (aprox.)`;
 $('dayHourValue').textContent=`${String(Math.floor(daylight.hour)).padStart(2,'0')}:${daylight.hour%1?'30':'00'} Madrid`;
 renderer.shadowMap.needsUpdate=true;
}
for(const [id,key] of [['dayDate','date'],['dayHour','hour'],['facadeAzimuth','facade']]){$(id).value=daylight[key];$(id).oninput=e=>{if(key==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;daylight[key]=key==='date'?e.target.value:Number(e.target.value);updateDaylight()}}
$('roomLamps').onchange=e=>{daylight.lamps=e.target.checked;updateDaylight()};
const avatar=new THREE.Group();scene.add(avatar);
const trouser=new THREE.MeshStandardMaterial({color:0x353c40,roughness:.98}),shoeMat=new THREE.MeshStandardMaterial({color:0x292c2b,roughness:.8}),soleMat=new THREE.MeshStandardMaterial({color:0xbab7af,roughness:.95});
const pelvis=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),trouser);pelvis.scale.set(.18,.12,.15);pelvis.position.set(0,.98,.13);avatar.add(pelvis);
const shirt=new THREE.MeshStandardMaterial({color:0x606b71,roughness:1});
const torso=new THREE.Mesh(new THREE.CylinderGeometry(.205,.17,.45,24),shirt);torso.scale.z=.68;torso.position.set(0,1.265,.15);avatar.add(torso);
const legs=[];
for(const side of [-1,1]){
 const thigh=new THREE.Mesh(new THREE.CylinderGeometry(.075,.062,.46,14),trouser),shin=new THREE.Mesh(new THREE.CylinderGeometry(.062,.045,.46,14),trouser);
 const foot=new THREE.Group(),shoe=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),shoeMat),sole=new THREE.Mesh(new THREE.SphereGeometry(1,20,10),soleMat);
 shoe.scale.set(.057,.052,.143);shoe.position.set(0,.066,-.035);sole.scale.set(.058,.016,.145);sole.position.set(0,.016,-.035);foot.add(shoe,sole);avatar.add(thigh,shin,foot);legs.push({side,thigh,shin,foot});
}
function bone(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b)/.46;mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())}
function updateAvatar(){
 avatar.visible=inside&&$('showLegs').checked;avatar.position.set(walker.x,0,walker.z);avatar.rotation.y=yaw;
 const activity=walker.activity;
 for(const leg of legs){const phase=(walker.phase/2+(leg.side===1?.5:0))%1,swing=phase<.4,t=swing?phase/.4:(phase-.4)/.6;
 const forward=(swing?.372-.744*t:-.372+.744*t)*Math.min(1,activity*5),lift=swing?Math.sin(t*Math.PI)*.07*activity:0;
 const speed=Math.hypot(walker.vx,walker.vz),dx=speed>.01?(Math.cos(yaw)*walker.vx-Math.sin(yaw)*walker.vz)/speed:0,dz=speed>.01?(Math.sin(yaw)*walker.vx+Math.cos(yaw)*walker.vz)/speed:-1;
 const ankle=new THREE.Vector3(leg.side*.105-dx*forward,.10+lift,-.05-dz*forward),hip=new THREE.Vector3(leg.side*.10,.98+walker.bob*.4,.09);
 const mid=hip.clone().add(ankle).multiplyScalar(.5),half=hip.distanceTo(ankle)/2;
 mid.z-=Math.sqrt(Math.max(0,.47*.47-half*half));bone(leg.thigh,hip,mid);bone(leg.shin,mid,ankle);
 leg.foot.position.set(ankle.x,lift,ankle.z);leg.foot.rotation.x=swing?Math.sin(t*Math.PI*2)*.10*activity:0;
 }
}
function leaveWalk(){inside=false;keys.clear();walker.stop();avatar.visible=false;controls.enabled=true;document.body.classList.remove('walking');if(document.pointerLockElement)document.exitPointerLock();$('walkHud').hidden=true;camera.up.set(0,1,0)}
function enterWalk(id='living'){
 const starts={livingDecor:[3.15,7.0,-.45],living:[3.2,6.8,0],livingWindow:[3.25,4.45,Math.PI],bed1:[2.28,3.15,.55],bed2:[3.24,3.20,-.15],kitchen:[5.32,3.2,0],bath:[5.42,5.08,Math.PI]};let [x,z,a]=starts[id]||starts.living;
 inside=true;walkPaused=false;keys.clear();renderer.domElement.focus({preventScroll:true});mode='walk';controls.enabled=false;document.body.classList.add('walking');$('walkHud').hidden=false;$('walkRoom').value=starts[id]?id:'living';
 camera.up.set(0,1,0);camera.fov=65;camera.updateProjectionMatrix();camera.position.copy(world(x,EYE_HEIGHT,z));yaw=a;walker.reset(camera.position.x,camera.position.z,a);pitch=id==='livingDecor'?-.12:id==='bed1'?-.30:id==='bed2'?-.22:0;camera.rotation.set(pitch,yaw,0,'YXZ');$('walkMessage').textContent='↑ ↓ avanzar / retroceder · ← → girar · arrastra para mirar';build();
}
function canStand(x,z){const r=BODY_RADIUS;for(const b of colliders){const nx=Math.max(b.min.x,Math.min(x,b.max.x)),nz=Math.max(b.min.z,Math.min(z,b.max.z));if((x-nx)**2+(z-nz)**2<r*r)return false}return true}
// A changed layout must never leave the player inside newly placed furniture.
function unstickWalker(){
 if(canStand(walker.x,walker.z))return;
 const safe=[[3.15,7.0],[3.25,4.2],[2.28,3.15],[3.78,3.18],[5.32,3.2]].map(([x,z])=>world(x,EYE_HEIGHT,z));
 safe.sort((a,b)=>Math.hypot(a.x-walker.x,a.z-walker.z)-Math.hypot(b.x-walker.x,b.z-walker.z));
 const p=safe.find(p=>canStand(p.x,p.z));
 if(p){keys.clear();walker.reset(p.x,p.z,yaw);camera.position.copy(p);walkPaused=false}
}
function stepWalk(dt){
 if(walkPaused||$('evidence').open){walker.stop();return}
 const turn=(keys.has('ArrowLeft')||keys.has('KeyQ')?1:0)-(keys.has('ArrowRight')||keys.has('KeyE')?1:0);
 const forward=(keys.has('ArrowUp')||keys.has('KeyW')?1:0)-(keys.has('ArrowDown')||keys.has('KeyS')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 walker.yaw=yaw;walker.update(dt,{forward,side,turn,slow:keys.has('ShiftLeft')||keys.has('ShiftRight')},canStand);yaw=walker.yaw;
 const motion=$('headMotion').checked,offset=motion?walker.sway:0;
 camera.position.set(walker.x, motion?walker.eyeY:EYE_HEIGHT,walker.z);
 const sx=walker.x+Math.cos(yaw)*offset,sz=walker.z-Math.sin(yaw)*offset;
 if(canStand(sx,sz)){camera.position.x=sx;camera.position.z=sz}
 camera.rotation.set(pitch,yaw,motion?walker.roll:0,'YXZ');updateAvatar();
 $('gaitStatus').textContent=walker.activity>.08?`${walker.steps} pasos · ${Math.hypot(walker.vx,walker.vz).toFixed(1)} m/s`:'De pie · ojos ≈ 1,74 m';
}
function typing(e){return /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)}
document.addEventListener('keydown',e=>{if(!inside||typing(e)||$('evidence').open)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();unlockAudio();keys.add(e.code)}if(e.code==='Escape'){keys.clear();walkPaused=true;walker.stop();$('walkMessage').textContent='En pausa · pulsa en la imagen para continuar'}});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();walker.stop();dragging=false});document.addEventListener('pointerlockchange',()=>{keys.clear();if(!document.pointerLockElement)dragging=false});document.addEventListener('visibilitychange',()=>{keys.clear();walker.stop();lastTime=performance.now()});
let lookPointer=null,lookX=0,lookY=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(!inside||lookPointer!==null)return;lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;unlockAudio();walkPaused=false;dragging=true;renderer.domElement.focus();renderer.domElement.setPointerCapture(e.pointerId);$('walkMessage').textContent='↑ ↓ avanzar / retroceder · ← → girar · arrastra para mirar'});
renderer.domElement.tabIndex=0;const endLook=e=>{if(e.pointerId===lookPointer){lookPointer=null;dragging=false}};renderer.domElement.addEventListener('pointerup',endLook);renderer.domElement.addEventListener('pointercancel',endLook);renderer.domElement.addEventListener('lostpointercapture',endLook);
document.addEventListener('pointermove',e=>{if(!inside)return;const locked=document.pointerLockElement===renderer.domElement;if(!locked&&(!dragging||e.pointerId!==lookPointer))return;const dx=locked?e.movementX:e.clientX-lookX,dy=locked?e.movementY:e.clientY-lookY;lookX=e.clientX;lookY=e.clientY;yaw-=dx*.0025;pitch=Math.max(-1.5,Math.min(1.35,pitch-dy*.0025))});
$('exitWalk').onclick=overview;$('walkRoom').onchange=e=>{enterWalk(e.target.value);e.target.blur()};$('lockMouse').onclick=async()=>{try{await renderer.domElement.requestPointerLock();renderer.domElement.focus();walkPaused=false}catch{$('walkMessage').textContent='Arrastra sobre la imagen para mirar; flechas para caminar.'}};
$('fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await $('viewport').requestFullscreen();else await document.exitFullscreen();renderer.domElement.focus()}catch{$('walkMessage').textContent='Puedes ampliar la ventana con F11.'}};
for(const b of document.querySelectorAll('[data-walk-key]')){b.onpointerdown=e=>{e.preventDefault();unlockAudio();walkPaused=false;keys.add(b.dataset.walkKey);b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(b.dataset.walkKey)}
$('orbit').onclick=overview;$('top').onclick=top;$('room').onchange=focusRoom;
$('inside').onclick=()=>enterWalk($('room').value);
for(const key of ['scale','walls']){$(key).value=state[key];$(key).oninput=e=>{state[key]=Number(e.target.value);build()}}
for(const key of ['furniture','labels']){$(key).checked=state[key];$(key).onchange=e=>{state[key]=e.target.checked;$('decorated').checked=state.furniture;build()}}
$('decorated').checked=state.furniture;$('decorated').onchange=e=>{state.furniture=e.target.checked;$('furniture').checked=state.furniture;build();if(inside&&!canStand(walker.x,walker.z))enterWalk('livingDecor')};
$('livingLayout').value=state.livingLayout;
$('livingLayout').onchange=e=>{state.livingLayout=e.target.value;build();if(inside&&!canStand(walker.x,walker.z))enterWalk('livingDecor');e.target.blur()};
$('palette').value=state.palette;$('palette').onchange=e=>{state.palette=e.target.value;build()};
$('calibrate').onclick=()=>{state.scale=Math.sqrt(38.69/BASE_AREA)*100;$('scale').value=state.scale;build()};
$('reset').onclick=()=>{Object.assign(state,defaults);for(const key of ['scale','walls','palette'])$(key).value=state[key];for(const key of ['furniture','labels'])$(key).checked=state[key];$('decorated').checked=state.furniture;$('livingLayout').value=state.livingLayout;$('room').value='all';overview()};
$('sources').onclick=()=>{keys.clear();walker.stop();$('evidence').showModal()};$('closeEvidence').onclick=()=>$('evidence').close();
const labels=rooms.map(r=>{let el=document.createElement('button');el.className='room-label';el.onclick=()=>{$('room').value=r.id;focusRoom()};$('labelsLayer').append(el);return {r,el}});
const size=()=>{const {width,height}=$('canvasHost').getBoundingClientRect();renderer.setSize(width,height);const oldAspect=camera.aspect;camera.aspect=width/height;if(!inside && $('room').value==='all' && mode==='orbit'){const ratio=Math.max(1,1.05/camera.aspect)/Math.max(1,1.05/oldAspect);camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target)}camera.updateProjectionMatrix()};new ResizeObserver(size).observe($('canvasHost'));size();enterWalk('livingDecor');
let qualityTime=0,qualityFrames=0,qualityScale=Math.min(devicePixelRatio,1.25);
function animate(time=0){requestAnimationFrame(animate);const dt=Math.min((time-lastTime)/1000,.25);lastTime=time;qualityTime+=dt;qualityFrames++;if(qualityTime>2){const fps=qualityFrames/qualityTime;if(fps<28&&qualityScale>.65){qualityScale=Math.max(.65,qualityScale-.15);renderer.setPixelRatio(qualityScale);size()}qualityTime=0;qualityFrames=0}if(inside)stepWalk(dt);else controls.update();renderer.render(scene,camera);const w=$('canvasHost').clientWidth,h=$('canvasHost').clientHeight;for(const {r,el} of labels){if(inside){el.hidden=true;continue}const p=world(r.x,.16,r.z).project(camera);el.hidden=!state.labels||inside||p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1;el.style.left=`${(p.x+1)*w/2}px`;el.style.top=`${(1-p.y)*h/2}px`;const area=r.area*(state.scale/100)**2;el.innerHTML=`${r.name}<small>≈ ${area.toFixed(1)} m²</small>`}}animate();
window.homestudioDebug={state,rooms,baseArea:BASE_AREA,scene,renderer,camera,controls,enterWalk,canStand,world,get colliders(){return colliders},get inside(){return inside},get yaw(){return yaw},eyeHeight:EYE_HEIGHT,walker,daylight,solarState,updateDaylight};

for(const panel of document.querySelectorAll('.walking-options,.daylight-panel'))panel.addEventListener('toggle',()=>{if(panel.open&&matchMedia('(max-width:850px)').matches)for(const other of document.querySelectorAll('.walking-options,.daylight-panel'))if(other!==panel)other.open=false});
