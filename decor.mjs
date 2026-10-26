import * as THREE from 'three';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';

// Furniture proposal, in metres. Soft furnishings use curved geometry and cloth relief.
function weaveTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#a8a8a8';ctx.fillRect(0,0,256,256);
 for(let i=0;i<256;i+=4){ctx.fillStyle=i%8?'#b5b5b5':'#949494';ctx.fillRect(i,0,1,256);ctx.fillStyle=i%8?'#999999':'#c2c2c2';ctx.fillRect(0,i,256,1)}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,7);return t;
}
const weave=weaveTexture();
const grain=(()=>{const c=document.createElement('canvas');c.width=256;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#999999';ctx.fillRect(0,0,256,512);for(let i=0;i<160;i++){const x=i*1.67;ctx.strokeStyle=`rgba(30,30,30,${.08+.06*Math.sin(i*2.3)})`;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+Math.sin(i)*7,160,x-Math.cos(i)*6,350,x,512);ctx.stroke()}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t})();
const shadowTexture=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,15,64,64,64);g.addColorStop(0,'rgba(35,24,14,.27)');g.addColorStop(.65,'rgba(35,24,14,.14)');g.addColorStop(1,'rgba(35,24,14,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)})();
export function furnish(parent,mats,layout="daily"){
 const fabric=(color)=>new THREE.MeshPhysicalMaterial({color,roughness:.96,bumpMap:weave,bumpScale:.006,sheen:1,sheenRoughness:.85,sheenColor:0xf4e8d9});
 Object.assign(mats,{
  upholstery:fabric('#c9c0ae'),cream:fabric('#f3ece0'),ochre:fabric('#b48a53'),moss:fabric('#788576'),rug:fabric('#d1c0a2'),
  walnut:new THREE.MeshStandardMaterial({color:'#805e40',roughness:.6,bumpMap:grain,bumpScale:.004}),porcelain:new THREE.MeshStandardMaterial({color:'#e5dbcd',roughness:.3}),
  leaf:new THREE.MeshStandardMaterial({color:'#4c6844',roughness:.72,side:THREE.DoubleSide}),leafLight:new THREE.MeshStandardMaterial({color:'#819568',roughness:.75,side:THREE.DoubleSide}),
  terracotta:new THREE.MeshStandardMaterial({color:'#a76e51',roughness:.96}),soil:new THREE.MeshStandardMaterial({color:'#342c24',roughness:1}),
  brass:new THREE.MeshStandardMaterial({color:'#9d8559',metalness:.72,roughness:.38}),paper:new THREE.MeshStandardMaterial({color:'#e9e0ce',roughness:1}),
  accent:new THREE.MeshStandardMaterial({color:'#c0966f',roughness:.95}),contact:new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})
 });
 const add=(geo,mat,x,y,z,solid=true,to=parent)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;o.userData.nonSolid=!solid;to.add(o);return o};
 const soft=(x,y,z,w,h,d,mat,r=.035,solid=true,to=parent)=>add(new RoundedBoxGeometry(w,h,d,4,Math.min(r,w/2-.001,h/2-.001,d/2-.001)),mat,x,y,z,solid,to);
 const cyl=(x,y,z,rt,rb,h,mat,solid=true,to=parent)=>add(new THREE.CylinderGeometry(rt,rb,h,40),mat,x,y,z,solid,to);
 const ball=(x,y,z,w,h,d,mat,solid=false,to=parent)=>{const m=add(new THREE.SphereGeometry(1,32,20),mat,x,y,z,solid,to);m.scale.set(w,h,d);return m};
 const contact=(x,z,w,d)=>{const o=add(new THREE.PlaneGeometry(w,d),mats.contact,x,.008,z,false);o.rotation.x=-Math.PI/2;o.castShadow=false};
 const rod=(a,b,r,mat,to=parent)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=add(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),12),mat,0,0,0,false,to);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return o};
 function vase(x,y,z,h,mat=mats.porcelain){const pts=[[.0,0],[.07,0],[.092,.05],[.10,.13],[.055,.23],[.045,.28]].map(([r,v])=>new THREE.Vector2(r*h/.28,v*h/.28));return add(new THREE.LatheGeometry(pts,40),mat,x,y,z,false)}
 function plant(x,z,h=.85,baseY=0){
  const r=h*.16;cyl(x,baseY+r*.65,z,r,r*.78,r*1.3,mats.terracotta,baseY===0);cyl(x,baseY+r*1.3,z,r*.92,r*.92,.008,mats.soil,false);
  for(let i=0;i<9;i++){const a=i*2.4,tip=new THREE.Vector3(x+Math.cos(a)*h*.24,baseY+h*(.55+(i%4)*.11),z+Math.sin(a)*h*.24);rod([x,baseY+r,z],tip.toArray(),.006,mats.leaf);const leaf=ball(tip.x,tip.y,tip.z,.045*h,.18*h,.012*h,i%2?mats.leaf:mats.leafLight);leaf.rotation.set(Math.sin(a)*.6, a,Math.cos(a)*.7)}
 }
 function mug(x,y,z){cyl(x,y+.045,z,.035,.03,.09,mats.porcelain,false);const handle=add(new THREE.TorusGeometry(.025,.006,8,24),mats.porcelain,x+.039,y+.049,z,false);handle.rotation.y=Math.PI/2;cyl(x,y+.091,z,.029,.029,.002,mats.dark,false)}
 function books(x,y,z,count=4,to=parent){for(let i=0;i<count;i++){const o=soft(x+(i-count/2)*.035,y+.11,z,.027,.22-(i%3)*.018,.13,[mats.moss,mats.ochre,mats.paper,mats.accent][i%4],.002,false,to);o.rotation.z=i===0?-.1:0}}
 function art(x,y,z,w,h,rot=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
  soft(0,0,0,w,h,.027,mats.walnut,.006,false,g);soft(0,0,.019,w-.035,h-.035,.006,mats.paper,.001,false,g);
  const disc=add(new THREE.CircleGeometry(w*.20,48),mats.accent,-w*.14,h*.13,.024,false,g);
  const arch=add(new THREE.CircleGeometry(w*.26,48,0,Math.PI),mats.moss,w*.08,-h*.20,.026,false,g);arch.rotation.z=-.2;
  rod([-w*.25,-h*.22,.028],[w*.25,h*.26,.028],.003,mats.brass,g);
 }
 function curtain(x,z,width,height=2.30){const g=new THREE.PlaneGeometry(width,height,24,32),p=g.attributes.position;for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i);p.setZ(i,.035*Math.sin((px/width)*Math.PI*10)+.012*Math.cos(py*7));p.setY(i,py+.008*Math.cos(px*40))}g.computeVertexNormals();const cloth=mats.cream;const o=add(g,cloth,x,2.35-height/2,z,false);o.material.side=THREE.DoubleSide;o.castShadow=false;return o}
 // Straight sofa-bed plus a separate movable ottoman; dining uses proper chairs.
 const sleeping=layout==='sleep',guests=layout==='guests';
 function diningChair(x,z,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);
  soft(0,.46,0,.46,.07,.44,mats.moss,.035,true,g);
  soft(0,.74,.20,.46,.48,.065,mats.moss,.03,true,g);
  for(const dx of [-.17,.17])for(const dz of [-.16,.16])rod([dx,.43,dz],[dx,.02,dz+.025],.016,mats.walnut,g);
 }
 // No living-room storage in the occupied second bedroom.
 const sofa=new THREE.Group();sofa.position.set(4.16,0,6.10);sofa.scale.x=1.2;sofa.rotation.y=Math.PI/2;parent.add(sofa);
 soft(0,.28,0,1.75,.27,.80,mats.upholstery,.09,true,sofa);
 for(const x of [-.71,.71])for(const z of [-.27,.27])cyl(x,.09,z,.027,.022,.18,mats.walnut,true,sofa);
 soft(0,.66,.30,1.71,.60,.21,mats.upholstery,.085,true,sofa);
 for(const x of [-.79,.79])soft(x,.52,-.02,.19,.50,.78,mats.upholstery,.08,true,sofa);
 for(const x of [-.36,.36]){soft(x,.46,-.065,.70,.18,.62,mats.cream,.08,true,sofa);const cushion=soft(x,.72,.16,.69,.42,.16,mats.upholstery,.075,true,sofa);cushion.rotation.x=-.13}
 const cushion=soft(-.51,.70,-.03,.36,.36,.15,mats.moss,.075,false,sofa);cushion.rotation.set(-.22,.15,-.16);
 const cushion2=soft(.54,.68,-.06,.32,.30,.14,mats.ochre,.065,false,sofa);cushion2.rotation.set(-.18,-.1,.20);
 contact(4.16,6.10,1.05,2.3);
 soft(3.35,.015,6.12,1.40,.025,1.90,mats.rug,.012,false);

 // Dining is independent of the sofa: two facing chairs daily, four for guests.
 if(sleeping){
  soft(3.85,.31,6.10,1.40,.20,1.95,mats.upholstery,.045);
  soft(3.85,.53,6.10,1.40,.18,1.95,mats.cream,.07);
  soft(3.85,.64,6.40,1.36,.035,1.20,mats.moss,.016,false);
  for(const z of [5.62,6.50])soft(4.16,.68,z,.38,.12,.56,mats.cream,.055,false);
  // Drop-leaf table folded beside entry; everyday chairs moved to bedroom 2.
  soft(2.12,.74,4.85,.30,.045,.80,mats.walnut,.016);
  for(const z of [4.57,5.13])for(const x of [2.03,2.21])rod([x,.02,z],[x,.72,z],.017,mats.walnut);
  diningChair(.45,3.15,0);diningChair(1.20,3.15,0);
 }else{
  const tx=guests?3.10:2.60,tz=guests?5.25:5.40,w=guests?1.20:.80,d=guests?.80:1.00;
  soft(tx,.75,tz,w,.045,d,mats.walnut,.02);
  for(const x of [tx-w/2+.08,tx+w/2-.08])for(const z of [tz-d/2+.08,tz+d/2-.08])rod([x,.02,z],[x,.73,z],.018,mats.walnut);
  const places=guests?[[2.90,4.55,Math.PI],[3.45,4.55,Math.PI],[2.90,6.05,0],[3.45,6.05,0]]:[[2.60,4.55,Math.PI],[2.60,6.25,0]];
  for(const [x,z,r] of places){diningChair(x,z,r);const pz=tz+(z<tz?-(d/2-.17):(d/2-.17));cyl(x,.78,pz,.12,.12,.015,mats.porcelain,false);mug(x+.17,.775,pz);
   rod([x-.15,.782,pz-.08],[x-.15,.782,pz+.08],.004,mats.metal);
  }
  // Shared serving space at actual scale, in addition to the individual place settings.
  cyl(tx,.80,tz,.135,.10,.065,mats.porcelain,false);
  for(let i=0;i<7;i++){const a=i*2.4;ball(tx+Math.cos(a)*.075,.838,tz+Math.sin(a)*.075,.035,.016,.025,mats.leafLight)}
  soft(tx+.25,.781,tz,.16,.012,.24,mats.walnut,.018,false);
  for(let i=0;i<3;i++)ball(tx+.25,.803,tz-.065+i*.06,.045,.021,.027,mats.ochre);

 }
 // Freestanding shallow cabinet with a TV supported by its own central pedestal.
 soft(2.07,.33,6.64,.30,.46,1.18,mats.walnut,.018);
 for(const x of [1.97,2.17])for(const z of [6.15,7.13])cyl(x,.065,z,.017,.017,.13,mats.dark);
 for(const z of [6.34,6.94]){soft(2.226,.34,z,.018,.37,.56,mats.walnut,.008);soft(2.24,.45,z,.015,.012,.13,mats.brass,.003,false)}
 soft(2.07,.578,6.64,.23,.024,.40,mats.dark,.012,false);
 soft(2.04,.66,6.64,.04,.15,.07,mats.dark,.008,false);
 soft(2.04,.99,6.64,.038,.56,.99,mats.dark,.016,false);soft(2.064,.99,6.64,.004,.515,.94,mats.metal,.001,false);
 art(4.585,1.58,5.82,.52,.68,-Math.PI/2);art(4.585,1.58,6.48,.40,.55,-Math.PI/2);
 // Both beds run across the rooms; headboards on the NW / negative-X wall.
 // 135 × 195 cm mattresses, pending confirmation against measured room widths.
 function transverseBed(x,z,accent){
  soft(x,.22,z,2.00,.30,1.40,mats.upholstery,.06);
  soft(x,.47,z,1.95,.25,1.35,mats.cream,.08);
  soft(x-1.02,.65,z,.06,1.0,1.40,mats.upholstery,.029);
  for(const dz of [-.37,.37]){const pillow=soft(x-.73,.65,z+dz,.38,.14,.55,mats.cream,.06,false);pillow.rotation.y=dz*.12}
  const geo=new THREE.PlaneGeometry(1.53,1.42,48,40),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),fall=Math.max(0,Math.abs(b)-.61)*2.1+Math.max(0,a-.65)*1.5;p.setZ(i,.013*Math.sin(a*20+b*6)+.007*Math.cos(b*27)-fall)}
  geo.computeVertexNormals();const duvet=add(geo,mats.cream,x+.20,.61,z,false);duvet.rotation.x=-Math.PI/2;
  soft(x+.60,.63,z,.57,.035,1.38,accent,.016,false);
  for(let zz=z-.64;zz<z+.65;zz+=.055)rod([x+.89,.62,zz],[x+.95,.60,zz],.0015,accent);
  contact(x,z,2.18,1.60);
 }
 // Main bedroom: NW headboard; keep the balcony approach clear in front of the bed.
 transverseBed(1.12,1.86,mats.moss);
 soft(.25,.39,.87,.36,.12,.35,mats.walnut,.018);
 for(const x of [.12,.38])for(const z of [.74,1.0])rod([x,.35,z],[x,.02,z],.013,mats.walnut);
 vase(.25,.46,.87,.18);art(.02,1.60,1.86,.57,.74,Math.PI/2);
 rod([.63,2.43,.08],[2.07,2.43,.08],.008,mats.brass);curtain(.70,.10,.17);curtain(2.0,.10,.17);
 // Bedroom 2: 135 × 190 bed, shortening only its length and keeping the head end fixed.
 const bedStart=parent.children.length;
 transverseBed(3.81,.76,mats.ochre);
 const shortBed=new THREE.Group(),lengthRatio=190/195;
 shortBed.position.x=2.79*(1-lengthRatio);shortBed.scale.x=lengthRatio;
 for(const part of parent.children.slice(bedStart))shortBed.add(part);
 parent.add(shortBed);
 // Wardrobe and desk share the right wall AFTER the bed, not in the narrow foot gap.
 // Sliding wardrobe: 100 wide × 60 deep × 210 high cm, including door tracks.
 soft(4.53,1.06,2.10,.58,2.10,1.00,mats.cabinet,.012);
 soft(4.52,.04,2.10,.54,.08,.94,mats.walnut,.008);
 // Two offset sliding leaves and their recessed vertical pulls.
 soft(4.224,1.10,1.865,.025,2.00,.52,mats.cream,.006);
 soft(4.194,1.10,2.335,.025,2.00,.52,mats.white,.006);
 for(const z of [2.07,2.13])soft(4.174,1.10,z,.014,.30,.018,mats.metal,.005,false);
 for(const y of [.10,2.10])soft(4.207,y,2.10,.065,.018,1.00,mats.metal,.005,false);
 // 100 × 50 cm desk alongside the wardrobe, towards the entrance.
 soft(4.55,.75,3.17,.50,.045,1.00,mats.walnut,.018);
 for(const x of [4.36,4.74])for(const z of [2.75,3.59])rod([x,.73,z],[x,.02,z],.016,mats.dark);
 soft(4.55,.80,3.17,.27,.022,.40,mats.metal,.008,false);
 const laptop=soft(4.66,.94,3.17,.014,.27,.40,mats.dark,.008,false);laptop.rotation.z=.15;
 mug(4.52,.78,2.79);books(4.54,.78,3.53,3);diningChair(3.96,3.17,-Math.PI/2);
 art(4.83,1.55,3.17,.52,.65,-Math.PI/2);
 rod([3.12,2.4,.08],[4.43,2.4,.08],.008,mats.brass);curtain(3.18,.10,.15,1.52);curtain(4.39,.10,.15,1.52);
 // Counter accessories stay on the worktop and out of the 80 cm kitchen aisle.
 soft(6.05,.938,1.65,.40,.015,.27,mats.walnut,.035,false);vase(6.15,.95,1.61,.19,mats.terracotta);for(let i=0;i<4;i++)rod([6.15,.98,1.61],[6.12+i*.025,1.29,1.60],.007,mats.walnut);
 cyl(6.07,.96,2.92,.16,.14,.045,mats.porcelain,false);for(let i=0;i<3;i++)ball(5.99+i*.07,1.01,2.94,.045,.045,.045,mats.ochre);plant(6.11,.37,.32,.92);
 // Bathroom: towels, soap, bath mat, without shrinking the entry passage.
 soft(5.25,.018,5.65,.50,.025,.57,mats.rug,.012,false);soft(4.89,1.01,5.56,.19,.10,.27,mats.cream,.035,false);
 cyl(5.03,.99,5.28,.025,.025,.12,mats.porcelain,false);rod([5.03,1.05,5.28],[5.03,1.09,5.28],.004,mats.metal);rod([5.03,1.09,5.28],[5.05,1.09,5.28],.004,mats.metal);
 rod([5.62,1.25,5.8],[5.62,1.25,6.14],.008,mats.metal);soft(5.05,1.03,5.96,.022,.41,.27,mats.cream,.01,false);
 return {style:'lino, nogal y verde salvia',proposal:true};
}
