import * as THREE from 'three';
import { furnish } from './decor.mjs?v=3647bcdb55f6'; // subir el número al cambiar decor.mjs: el navegador lo guarda en caché
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { Walker } from './walking.mjs?v=9880ceebedd4';
import { Reflector } from './vendor/Reflector.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';

// ───────────────────────────── Estado y preferencias ─────────────────────────────
// Todo el modelo está en metros: x de izquierda a derecha tal como está dibujado el plano,
// z desde la fachada de dormitorios y cocina hacia la puerta de entrada.
const $ = (id) => document.getElementById(id),
  BASE_AREA = 36.2958; // suma de suelos del modelo, sin muros ni balcón
const STORAGE_KEY = 'homestudio.studio.v5';
const defaults = {
  scale: 100,
  walls: 1.05,
  palette: 'existing',
  furniture: true,
  labels: true,
  livingLayout: 'daily',
  measured: {},
};
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {}
const state = { ...defaults, ...saved };
// Muebles reales del salón (precios vistos el 16/11/2026). De aquí salen la lista del panel
// lateral y la ficha que aparece al pulsar un mueble en 3D; decor.mjs etiqueta cada malla con `id`.
const PRODUCTS = [
  {
    id: 'sofa',
    name: 'Sofá cama Nalui Nest 3, gris claro',
    seller: 'Nalui',
    price: 569,
    dims: '211 × 86 × 88 cm · abierto 140 de fondo · cama 128 × 190',
    note: 'Envío gratis, a pie de calle.',
    url: 'https://naluibrand.com/producto/sofa-cama-3-plazas-nalui-nest-3-gris-claro/',
  },
  {
    id: 'table',
    name: 'Mesa extensible TONSTAD, chapa de roble',
    seller: 'IKEA',
    price: 199,
    dims: '70 × 80 → 120 cm · 75 de alto',
    url: 'https://www.ikea.com/es/es/p/tonstad-mesa-extensible-chapa-roble-10562504/',
  },
  {
    id: 'chair',
    name: 'Silla VIHALS, verde',
    seller: 'IKEA',
    price: 35,
    qty: 2,
    dims: '49 × 55 × 81 cm · asiento a 48',
    url: 'https://www.ikea.com/es/es/p/vihals-silla-verde-tibbleby-verde-grisaceo-80592767/',
  },
  {
    id: 'pouf',
    name: 'Puf FÖRLUNDA con almacenaje, beige',
    seller: 'IKEA',
    price: 49,
    qty: 2,
    dims: 'Ø44 × 41 cm',
    url: 'https://www.ikea.com/es/es/p/forlunda-puf-con-almacenaje-vissle-beige-30552764/',
  },
  {
    id: 'shoe',
    name: 'Zapatero BISSA, efecto roble',
    seller: 'IKEA',
    price: 39.99,
    dims: '49 × 28 × 93 cm',
    note: 'Hay que fijarlo a la pared.',
    url: 'https://www.ikea.com/es/es/p/bissa-zapatero-2-compartimentos-efecto-roble-70530218/',
  },
  {
    id: 'tv',
    name: 'Tele Hisense 50E8S, 50"',
    seller: 'Amazon',
    price: 473,
    dims: '111 × 64,8 × 5,9 cm',
    url: 'https://www.amazon.es/dp/B0GQDSSGNB',
  },
  {
    id: 'mount',
    name: "Soporte Vogel's TVM 5405",
    seller: 'Amazon',
    price: 59.99,
    dims: 'Fijo, a 1,5 cm de la pared',
    url: 'https://www.amazon.es/dp/B09ZY4FRMN',
  },
  {
    id: 'floorchair',
    name: 'Silla de suelo tectake, beige',
    seller: 'Amazon',
    price: 52.9,
    qty: 2,
    dims: '57 cm de ancho · plegable, con respaldo',
    url: 'https://www.amazon.es/dp/B0DGLQZMHY',
  },
];
const euro = (n) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
const lineTotal = (p) => p.price * (p.qty || 1);

// Disposiciones del salón que se pueden ver; decor.mjs coloca los muebles de cada una.
const LAYOUTS = [
  { id: 'daily', name: 'A diario', note: 'Mesa de 80 × 70 bajo la tele, puesta para dos.' },
  {
    id: 'tv',
    name: 'Ver la tele',
    note: 'Tres en el sofá; los pufs, de reposapiés para los dos extremos.',
  },
  {
    id: 'lounge',
    name: 'Tele tumbados',
    note: 'Arrastre sacado (140 cm de fondo): 112 cm de asiento con respaldo.',
  },
  {
    id: 'tvfull',
    name: 'Tele con invitados',
    note: 'Seis: tres en el sofá, dos en sillas de suelo con respaldo y uno en la silla.',
  },
  { id: 'guests', name: 'Comida con invitados', note: 'Mesa extendida a 120 junto al sofá: cinco personas.' },
  { id: 'bed', name: 'Noche', note: 'Arrastre abierto sin cojines de respaldo: cama de 128 × 190 cm.' },
];
if (!LAYOUTS.some((l) => l.id === state.livingLayout)) state.livingLayout = defaults.livingLayout;
if (!state.measured || typeof state.measured !== 'object') state.measured = {};
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
state.scale = Math.max(95, Math.min(110, Number(state.scale) || 100));
state.walls = Math.max(0.15, Math.min(2.6, Number(state.walls) || 1.05));
let mode = 'orbit',
  inside = false;
const EYE_HEIGHT = 1.74,
  BODY_RADIUS = 0.18;
let yaw = 0,
  pitch = 0,
  colliders = [],
  lastTime = 0,
  dragging = false,
  walkPaused = false;
const keys = new Set();
let audioContext = null;
const walker = new Walker({ eyeHeight: EYE_HEIGHT, onFootfall: playFootstep });
function unlockAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
}
function playFootstep({ foot, speed, x, z }) {
  if (!audioContext || audioContext.state !== 'running' || speed < 0.08) return;
  const time = audioContext.currentTime,
    ceramic = x > world(4.74, 0, 0).x && z > world(0, 0, 4.79).z;
  const length = 0.13,
    buffer = audioContext.createBuffer(
      1,
      Math.ceil(audioContext.sampleRate * length),
      audioContext.sampleRate,
    ),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.16));
  const source = audioContext.createBufferSource(),
    filter = audioContext.createBiquadFilter(),
    gain = audioContext.createGain(),
    pan = audioContext.createStereoPanner();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = ceramic ? 2100 : 850;
  gain.gain.setValueAtTime(Math.min(0.16, speed * 0.11), time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + length);
  pan.pan.value = foot === 'left' ? -0.18 : 0.18;
  source.connect(filter).connect(gain).connect(pan).connect(audioContext.destination);
  source.start(time);
  source.stop(time + length);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    pan.disconnect();
  };
  const thud = audioContext.createOscillator(),
    g = audioContext.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(ceramic ? 140 : 95, time);
  thud.frequency.exponentialRampToValueAtTime(48, time + 0.09);
  g.gain.setValueAtTime(0.035 * Math.min(1, speed), time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
  thud.connect(g).connect(audioContext.destination);
  thud.start(time);
  thud.stop(time + 0.11);
  thud.onended = () => {
    thud.disconnect();
    g.disconnect();
  };
}

// ───────────────────────────── Estancias y luz ─────────────────────────────
const daylight = { date: '2026-10-18', hour: 10, facade: 75, lamps: false };
let roomLights = [],
  skyLights = [];
const rooms = [
  {
    id: 'bed1',
    name: 'Dormitorio 1',
    area: 9.62,
    x: 1.3,
    z: 1.8,
    info: '2,60 × 3,70 m en el modelo; el plano también dice 2,55 × 3,40 m. El armario empotrado suma unos 0,85 m². Fondo del balcón estimado.',
    photo: '03',
  },
  {
    id: 'bed2',
    name: 'Dormitorio 2',
    area: 7.77,
    x: 3.79,
    z: 1.8,
    info: '2,10 × 3,70 m en el modelo. Fondo deducido de las estancias contiguas; la ventana da a la calle.',
    photo: '15',
  },
  {
    id: 'kitchen',
    name: 'Cocina',
    area: 5.18,
    x: 5.68,
    z: 1.8,
    info: '1,40 × 3,70 m según plano. Muebles de ≈ 60 cm de fondo, quedan ≈ 80 cm de paso. Orden de los muebles deducido de la foto.',
    photo: '00',
  },
  {
    id: 'living',
    name: 'Salón y paso',
    area: 10.6218,
    x: 3.25,
    z: 5.4,
    info: 'Zona de estar de 2,70 × 3,40 m más el paso a cocina y baño. Ventana junto a la entrada según fotos; posición exacta estimada.',
    photo: '01',
  },
  {
    id: 'bath',
    name: 'Baño',
    area: 2.254,
    x: 5.2,
    z: 5.8,
    info: '0,92 × 2,45 m en el modelo; el plano también da 2,40 m. Lavabo, inodoro y ducha deducidos de las fotos. Ese ancho tan estrecho hay que comprobarlo.',
    photo: '05',
  },
];

// ───────────────────────────── Escena, cámara y luces base ─────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
} catch (e) {
  $('error').hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor('#e9ece4');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
$('canvasHost').append(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Modelo 3D interactivo del piso de Home Studio');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9ece4');
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 0.3;
controls.maxDistance = 32;
const hemi = new THREE.HemisphereLight(0xd9e9ff, 0x8e8273, 0.12);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4df, 2.0);
sun.position.set(-4, 12, -6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
sun.shadow.normalBias = 0.025;
sun.shadow.bias = -0.00015;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(8, 5, 7);
scene.add(fill);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0xe9ece4, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.24;
ground.receiveShadow = true;
scene.add(ground);
let model = new THREE.Group();
scene.add(model);
let mats = {},
  floorTex;

// ───────────────────────────── Materiales y piezas básicas ─────────────────────────────
function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 2048;
  const ctx = c.getContext('2d');
  let seed = 41;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let x = 0; x < 1024; x += 128) {
    let offset = Math.floor(rnd() * 700);
    for (let y = -offset; y < 2048; y += 850) {
      const shade = rnd() * 27;
      ctx.fillStyle = `rgb(${143 + shade},${112 + shade},${79 + shade})`;
      ctx.fillRect(x, y, 128, 850);
      for (let j = 0; j < 240; j++) {
        const xx = x + rnd() * 128;
        ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '64,43,28' : '233,212,179'},${rnd() * 0.19})`;
        ctx.lineWidth = 0.4 + rnd() * 1.2;
        ctx.beginPath();
        ctx.moveTo(xx, y);
        ctx.bezierCurveTo(xx + 7, y + 250, xx - 9, y + 530, xx + 2, y + 850);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(49,35,24,.32)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, 128, 850);
    }
  }
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tx;
}
function plasterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d'),
    im = ctx.createImageData(128, 128);
  let seed = 9;
  for (let i = 0; i < im.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    let v = 180 + (seed % 45);
    im.data.set([v, v, v, 255], i);
  }
  ctx.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}
const plaster = plasterTexture();
const textureLoader = new THREE.TextureLoader();
function loadSurface(name, color = false) {
  const tx = textureLoader.load(`assets/materials/wood-${name}.jpg`);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  if (color) tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tx;
}
floorTex = loadSurface('color', true);
const floorNormal = loadSurface('normal'),
  floorRough = loadSurface('rough');
function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
}
function box(x, y, z, w, h, d, mat = mats.wall, parent = model) {
  const m = new THREE.Mesh(
    [mats.white, mats.cabinet, mats.oak].includes(mat) && Math.min(w, h, d) > 0.06
      ? new RoundedBoxGeometry(w, h, d, 2, 0.008)
      : new THREE.BoxGeometry(w, h, d),
    mat,
  );
  m.position.set(x, y, z);
  m.castShadow = mat !== mats.glass;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cylinder(x, y, z, r, h, mat, parent = model) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
  m.position.set(x, y, z);
  m.castShadow = mat !== mats.glass;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function floorRect(x, z, w, d, mat = mats.floor) {
  const m = box(x + w / 2, -0.07, z + d / 2, w, 0.14, d, mat);
  if (mat === mats.floor) {
    const uv = m.geometry.attributes.uv,
      pos = m.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (pos.getX(i) + x + w / 2) / 1.44, (pos.getZ(i) + z + d / 2) / 3.0);
    uv.needsUpdate = true;
  }
}
// Walls follow inside faces; openings are distances along each segment in metres.
function wall(x1, z1, x2, z2, openings = [], thickness = 0.14) {
  let len = Math.hypot(x2 - x1, z2 - z1),
    dx = (x2 - x1) / len,
    dz = (z2 - z1) / len,
    H = inside ? 2.6 : state.walls;
  function part(a, b, bottom, top, mat = mats.wall, th = thickness) {
    if (b <= a || top <= bottom) return;
    const m = box(
      x1 + (dx * (a + b)) / 2,
      (bottom + top) / 2,
      z1 + (dz * (a + b)) / 2,
      b - a,
      top - bottom,
      th,
      mat,
    );
    m.rotation.y = -Math.atan2(dz, dx);
  }
  let cursor = 0;
  for (const o of openings.sort((a, b) => a.a - b.a)) {
    part(cursor, o.a, 0, H);
    const sill = o.type === 'window' ? (o.sill ?? 0.88) : 0,
      head = o.type === 'window' ? (o.head ?? 2.18) : 2.1;
    part(o.a, o.b, 0, Math.min(sill, H));
    part(o.a, o.b, head, H);
    if (o.type === 'window' && H > sill) {
      part(o.a, o.b, sill, Math.min(head, H), mats.glass, 0.035);
      part(o.a, o.b, sill, Math.min(sill + 0.055, H), mats.white, 0.1);
      part(o.a, o.b, head - 0.055, Math.min(head, H), mats.white, 0.1);
      for (const v of [o.a, (o.a + o.b) / 2, o.b])
        part(v - 0.025, v + 0.025, sill, Math.min(head, H), mats.white, 0.07);
    } else if (o.type === 'balcony' && H > 0.1) {
      part(o.a, o.b, 0.12, Math.min(head, H), mats.glass, 0.035);
      for (const v of [o.a, (o.a + o.b) / 2, o.b])
        part(v - 0.025, v + 0.025, 0, Math.min(head, H), mats.white, 0.08);
    }
    if (o.type === 'door') {
      for (const v of [o.a - 0.035, o.b + 0.035])
        part(v - 0.025, v + 0.025, 0, Math.min(2.13, H), mats.white, thickness + 0.045);
      part(o.a - 0.06, o.b + 0.06, 2.1, Math.min(2.17, H), mats.white, thickness + 0.045);
    }
    cursor = o.b;
  }
  part(cursor, len, 0, H);
  // Skirting board is interrupted at doorways, and matches the cutaway height.
  let skips = openings.filter((o) => o.type !== 'window'),
    c = 0;
  for (const o of skips) {
    part(c, o.a, 0, Math.min(0.075, H), mats.white, thickness + 0.025);
    c = o.b;
  }
  part(c, len, 0, Math.min(0.075, H), mats.white, thickness + 0.025);
}

// ───────────────────────────── Construcción del piso ─────────────────────────────
// Se reconstruye entero en cada cambio (corte, escala, acabados, muebles, modo).
function build() {
  roomLights = [];
  skyLights = [];
  for (const child of [...model.children]) {
    child.traverse((o) => {
      if (o.isReflector) o.dispose();
      if (o.geometry) o.geometry.dispose();
    });
    model.remove(child);
  }
  for (const m of Object.values(mats)) m.dispose();
  const colors = {
    existing: ['#f7f5ef', '#aa9d8a'],
    warm: ['#efe5d1', '#c9ac81'],
    sage: ['#dce4d4', '#9caa93'],
  }[state.palette] || ['#f7f5ef', '#aa9d8a'];
  mats = {
    wall: material(colors[0], { bumpMap: plaster, bumpScale: 0.002, roughness: 0.94 }),
    floor: material('#ffffff', {
      map: floorTex,
      normalMap: floorNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: floorRough,
      roughness: 1.0,
    }),
    white: material('#f8f6ef', { roughness: 0.35 }),
    cabinet: material(colors[1], { roughness: 0.44 }),
    oak: material('#bc9864'),
    dark: material('#353b36'),
    glass: material('#b4d1d1', { transparent: true, opacity: 0.32, roughness: 0.13, depthWrite: false }),
    tile: material('#b7aaa0'),
    green: material('#829477'),
    linen: material('#e6d9c5'),
    metal: material('#888e88', { metalness: 0.8, roughness: 0.25 }),
  };
  const s = state.scale / 100;
  model.scale.set(s, 1, s);
  model.position.set(-3.19 * s, 0, -3.62 * s);
  floorRect(0, 0, 2.6, 3.7);
  floorRect(2.74, 0, 2.1, 3.7);
  floorRect(4.98, 0, 1.4, 3.7);
  floorRect(0, 3.84, 1.7, 0.5);
  floorRect(1.9, 3.84, 2.7, 3.4);
  floorRect(4.6, 3.84, 1.78, 0.81);
  floorRect(4.74, 4.79, 0.92, 2.45, mats.tile);
  floorRect(0.8, -0.82, 1.1, 0.68, mats.tile);
  wall(
    -0.12,
    -0.12,
    6.5,
    -0.12,
    [
      { a: 0.92, b: 2.02, type: 'balcony' },
      { a: 3.32, b: 4.42, type: 'window' },
      { a: 5.34, b: 6.1, type: 'window' },
    ],
    0.24,
  );
  wall(-0.12, 0, -0.12, 4.46, [], 0.24);
  wall(6.5, 0, 6.5, 4.77, [], 0.24);
  wall(2.67, 0, 2.67, 3.77);
  wall(4.91, 0, 4.91, 3.77);
  wall(0, 3.77, 6.38, 3.77, [
    { a: 0, b: 1.7, type: 'wardrobe' },
    { a: 2.02, b: 2.58, type: 'door' },
    { a: 2.8, b: 3.51, type: 'door' },
    { a: 5.07, b: 5.75, type: 'door' },
  ]);
  wall(0, 4.41, 1.77, 4.41);
  wall(1.77, 3.84, 1.77, 4.41);
  wall(1.83, 3.84, 1.83, 7.36);
  wall(4.67, 4.72, 6.5, 4.72, [{ a: 0.12, b: 0.75, type: 'door' }]);
  wall(4.67, 4.79, 4.67, 7.24);
  wall(5.78, 4.79, 5.78, 7.36, [], 0.24);
  wall(
    1.83,
    7.36,
    5.78,
    7.36,
    [
      { a: 1.97, b: 2.42, type: 'window', sill: 1.2, head: 1.9 },
      { a: 0.92, b: 1.68, type: 'door' },
      { a: 3.01, b: 3.64, type: 'window' },
    ],
    0.24,
  );
  // Balcony rail, the built-in wardrobe and kitchen evidenced by the photographs.
  box(1.35, 0.52, -0.83, 1.18, 1.04, 0.035, mats.green);
  for (const x of [0.77, 1.93]) box(x, 0.52, -0.49, 0.035, 1.04, 0.68, mats.metal);
  box(1.35, 1.06, -0.83, 1.22, 0.035, 0.045, mats.metal);
  for (let x = 0.8; x < 1.95; x += 0.13) box(x, 0.52, -0.83, 0.016, 1, 0.016, mats.metal);
  box(
    0.85,
    Math.min(2.4, inside ? 2.6 : state.walls) / 2,
    4.02,
    1.66,
    Math.min(2.4, inside ? 2.6 : state.walls),
    0.48,
    mats.white,
  );
  box(0.85, 0.79, 3.765, 1.66, 0.15, 0.025, mats.oak);
  box(0.85, 0.5, 3.75, 0.018, Math.min(inside ? 2.6 : state.walls, 1), 0.025, mats.metal);
  for (let z = 0.55; z < 3.4; z += 0.6) {
    box(6.07, 0.43, z, 0.6, 0.86, 0.58, mats.cabinet);
    box(5.755, 0.69, z, 0.018, 0.025, 0.23, mats.metal);
    if (inside || state.walls > 1.45) box(6.2, 1.78, z, 0.34, 0.64, 0.58, mats.cabinet);
  }
  box(6.06, 0.89, 1.75, 0.64, 0.06, 3.04, mats.oak);
  box(6.04, 0.93, 1.05, 0.43, 0.02, 0.49, mats.metal);
  box(6.04, 0.947, 1.05, 0.33, 0.018, 0.38, mats.dark);
  box(6.25, 1.08, 0.8, 0.025, 0.28, 0.025, mats.metal);
  box(6.14, 1.21, 0.8, 0.22, 0.025, 0.025, mats.metal);
  box(6.04, 0.931, 2.22, 0.5, 0.025, 0.52, mats.dark);
  for (let x of [5.91, 6.16]) for (let z of [2.08, 2.34]) cylinder(x, 0.948, z, 0.075, 0.006, mats.metal);
  box(5.748, 0.45, 2.22, 0.022, 0.55, 0.5, mats.dark);
  // Bathroom fixtures: approximate positions; rear shower inferred from the photo.
  box(5.18, 0.045, 6.84, 0.86, 0.09, 0.75, mats.white);
  box(5.19, 1.0, 6.44, 0.84, 1.95, 0.025, mats.glass);
  box(5.19, 1.99, 6.44, 0.86, 0.035, 0.035, mats.metal);
  box(4.96, 0.5, 5.47, 0.4, 0.76, 0.57, mats.oak);
  box(4.98, 0.91, 5.47, 0.43, 0.08, 0.6, mats.white);
  box(4.98, 0.956, 5.47, 0.22, 0.012, 0.3, mats.tile);
  box(4.82, 1.04, 5.47, 0.025, 0.2, 0.025, mats.metal);
  const mirror = new Reflector(new THREE.CircleGeometry(0.27, 64), {
    textureWidth: 512,
    textureHeight: 512,
    color: 0xd8dcda,
    clipBias: 0.003,
    multisample: 0,
  });
  mirror.position.set(4.766, 1.55, 5.47);
  mirror.rotation.y = Math.PI / 2;
  const renderReflection = mirror.onBeforeRender;
  mirror.onBeforeRender = function (...args) {
    const worldPos = this.getWorldPosition(new THREE.Vector3());
    if (args[2].position.distanceTo(worldPos) < 2.5) renderReflection.apply(this, args);
  };
  model.add(mirror);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.279, 0.012, 8, 64), mats.white);
  rim.position.copy(mirror.position);
  rim.rotation.copy(mirror.rotation);
  model.add(rim);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mats.white);
  bowl.position.set(5.18, 0.36, 6.14);
  bowl.scale.set(0.2, 0.22, 0.28);
  model.add(bowl);
  cylinder(5.18, 0.16, 6.14, 0.12, 0.3, mats.white);
  box(4.89, 0.54, 6.14, 0.18, 0.62, 0.41, mats.white);
  cylinder(5.22, 0.54, 6.14, 0.19, 0.045, mats.white).scale.z = 1.3;
  if (state.furniture) furnish(model, mats, state.livingLayout);
  addDetails();
  addDaylight();
  updateDaylight();
  renderer.shadowMap.needsUpdate = true;
  model.updateMatrixWorld(true);
  colliders = [];
  const cut = inside ? Infinity : state.walls;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    // En maqueta, lo que queda entero por encima del corte (cuadros, barras, espejo,
    // lamas del separador) flotaría sobre muros recortados: se oculta.
    if (b.min.y >= cut - 0.02 || (o.userData.ceilingHung && cut < 2.3)) o.visible = false;
    if (o.isReflector || o.userData.nonSolid) return;
    if (b.max.y > 0.22 && b.min.y < 1.85) colliders.push(b);
  });
  if (inside) unstickWalker();
  $('walls').disabled = inside;
  $('scale').disabled = inside;
  $('calibrate').disabled = inside;
  $('area').textContent = (BASE_AREA * s * s).toFixed(2);
  $('scaleValue').textContent = `${Number(state.scale).toFixed(1)}%`;
  $('wallValue').textContent = state.walls >= 2.6 ? 'Altura completa' : `corte a ${state.walls.toFixed(2)} m`;
  $('viewStatus').textContent =
    `${inside ? 'Primera persona · ojos 1,74 m' : mode === 'top' ? 'Planta' : 'Vista 3D'} · ${state.scale === 100 ? 'cotas del plano' : 'escala ajustada'}`;
  updateRoomInfo();
  persist();
}

// ───────────────────────────── Vistas de maqueta (3D y planta) ─────────────────────────────
function world(x, y, z) {
  let s = state.scale / 100;
  return new THREE.Vector3((x - 3.19) * s, y, (z - 3.62) * s);
}
function overview() {
  leaveWalk();
  state.walls = 1.05;
  $('walls').value = 1.05;
  mode = 'orbit';
  camera.up.set(0, 1, 0);
  camera.fov = 40;
  camera.updateProjectionMatrix();
  camera.position.set(8.3, 10, 10.8).multiplyScalar(Math.max(1, 1.05 / camera.aspect));
  controls.target.set(0, 0, 0);
  controls.enableRotate = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();
  setActive();
  build();
}
function top() {
  leaveWalk();
  state.walls = 1.05;
  $('walls').value = 1.05;
  mode = 'top';
  camera.fov = 40;
  camera.updateProjectionMatrix();
  camera.up.set(0, 0, -1);
  camera.position.set(0, 17, 0);
  controls.target.set(0, 0, 0);
  controls.enableRotate = false;
  controls.update();
  setActive();
  build();
}
function setActive() {
  $('orbit').classList.toggle('active', mode === 'orbit');
  $('top').classList.toggle('active', mode === 'top');
}
function updateRoomInfo() {
  let r = rooms.find((r) => r.id === $('room').value);
  $('roomInfo').textContent = r
    ? r.info
    : 'Dormitorios y cocina dan a la calle; la entrada abre directamente al salón.';
  $('inside').disabled = false;
}
function focusRoom() {
  if (inside) {
    enterWalk($('room').value);
    return;
  }
  leaveWalk();
  let r = rooms.find((r) => r.id === $('room').value);
  if (!r) {
    overview();
    return;
  }
  updateRoomInfo();
  const t = world(r.x, 0, r.z);
  controls.target.copy(t);
  if (mode === 'top') {
    camera.position.copy(t).add(new THREE.Vector3(0, 9, 0));
  } else {
    camera.up.set(0, 1, 0);
    camera.position.copy(t).add(new THREE.Vector3(3.6, 5, 4.5));
  }
  controls.update();
}

// ───────────────────────────── Detalles, luz natural y lámparas ─────────────────────────────
function addDetails() {
  // The ceiling is visible only at eye level; plan views retain an open roof.
  const ceilingRects = [
    [0, 0, 6.38, 3.84],
    [0, 3.84, 1.7, 0.5],
    [1.9, 3.84, 2.7, 3.4],
    [4.6, 3.84, 1.78, 0.81],
    [4.74, 4.79, 0.92, 2.45],
  ];
  if (inside) for (const [x, z, w, d] of ceilingRects) box(x + w / 2, 2.66, z + d / 2, w, 0.12, d, mats.wall);
  for (const [x, w] of [
    [2.02, 0.56],
    [2.8, 0.71],
    [5.07, 0.68],
  ])
    floorRect(x, 3.7, w, 0.14);
  floorRect(4.79, 4.65, 0.63, 0.14);
  // Entrance position/width remain provisional: photo supports a roughly central door, not measured coordinates.
  const doorH = Math.min(2.08, inside ? 2.6 : state.walls);
  box(3.13, doorH / 2, 7.35, 0.75, doorH, 0.055, mats.dark);
  box(3.4, 1.0, 7.3, 0.09, 0.025, 0.025, mats.metal);
  for (const [x, z] of [
    [2.57, 3.4],
    [4.8, 3.4],
    [6.36, 3.4],
    [4.59, 6.9],
  ]) {
    box(x, 1.12, z, 0.025, 0.09, 0.08, mats.white);
    box(x - 0.016, 1.12, z, 0.008, 0.05, 0.04, mats.cabinet);
  }
  for (const [x, z] of [
    [0.01, 1.3],
    [2.75, 1.2],
    [1.91, 5.2],
  ]) {
    box(x, 0.3, z, 0.024, 0.09, 0.15, mats.white);
    for (const zz of [z - 0.035, z + 0.035]) {
      const outlet = cylinder(x - 0.014, 0.3, zz, 0.016, 0.008, mats.dark);
      outlet.rotation.z = Math.PI / 2;
    }
  }
  // Kitchen splashback, extraction hood and a warm under-cabinet strip.
  box(6.375, 1.2, 1.75, 0.012, 0.54, 3.02, mats.tile);
  if (inside) {
    box(6.15, 1.5, 2.22, 0.46, 0.08, 0.6, mats.metal);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffecd2,
      emissive: 0xffdab2,
      emissiveIntensity: 1.2,
    });
    mats.strip = stripMat;
    box(6.02, 1.445, 1.75, 0.05, 0.015, 2.9, stripMat);
  }
  // Flush ceiling luminaires, using warm local illumination rather than an open roof.
  if (inside) {
    mats.light = new THREE.MeshStandardMaterial({
      color: 0xfff6e8,
      emissive: 0xffe6c4,
      emissiveIntensity: 1.6,
    });
    for (const [x, z, power] of [
      [1.3, 1.85, 35],
      [3.79, 1.85, 30],
      [5.55, 1.85, 24],
      [3.25, 5.5, 38],
      [5.2, 5.8, 16],
      [4.9, 4.2, 12],
    ]) {
      cylinder(x, 2.565, z, 0.13, 0.035, mats.white);
      cylinder(x, 2.54, z, 0.11, 0.012, mats.light);
      const light = new THREE.PointLight(0xffedda, power * 0.42, 5, 2);
      light.userData.base = power * 0.42;
      light.position.set(x, 2.35, z);
      model.add(light);
      roomLights.push(light);
    }
  }
}
function addDaylight() {
  // Diffuse sky contribution enters at the openings; room brightness is not uniform.
  if (!inside) return;
  // Approximate diffuse bounces from the larger street openings, locally per room.
  for (const [x, z, power] of [
    [1.3, 1.5, 4.8],
    [3.79, 1.5, 3.8],
    [5.45, 1.5, 2.6],
    [3.32, 5.45, 2.1],
  ]) {
    const l = new THREE.PointLight(z > 4 ? 0xffefd9 : 0xdce8f5, power, 4.4, 2);
    l.position.set(x, 1.7, z);
    l.userData.base = power;
    l.castShadow = false;
    model.add(l);
    skyLights.push(l);
  }
  for (const [x, y, z, tx, tz, power] of [
    [1.35, 1.6, -0.3, 1.35, 2.5, 9],
    [3.75, 1.6, -0.3, 3.75, 2.5, 7],
    [5.6, 1.6, -0.3, 5.6, 2.5, 5],
    [4.025, 1.55, 7.55, 4.025, 5.4, 0.9],
    [5.15, 1.5, 7.55, 5.15, 5.8, 0.7],
  ]) {
    const l = new THREE.SpotLight(0xc5dcf6, power, 9, Math.PI * 0.39, 1, 2);
    l.position.set(x, y, z);
    l.target.position.set(tx, 0.65, tz);
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512);
    l.shadow.bias = -0.0001;
    l.shadow.normalBias = 0.012;
    l.userData.base = power;
    model.add(l, l.target);
    skyLights.push(l);
  }
}
function solarState() {
  const h = Number(daylight.hour),
    probe = new Date(`${daylight.date}T12:00:00Z`),
    offsetString = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' })
      .formatToParts(probe)
      .find((x) => x.type === 'timeZoneName').value;
  const offset = Number(offsetString.match(/GMT([+-]\d+)/)?.[1] || 0);
  const d = new Date(`${daylight.date}T00:00:00Z`);
  d.setUTCMinutes(Math.round((h - offset) * 60));
  const p = SunCalc.getPosition(d, 40.3833757, -3.7321306);
  return {
    elevation: p.altitude,
    azimuth: ((p.azimuth * 180) / Math.PI + 180 + 360) % 360,
    date: d.toISOString(),
  };
}
function updateDaylight() {
  const p = solarState(),
    delta = ((p.azimuth - daylight.facade) * Math.PI) / 180,
    above = Math.max(0, Math.sin(p.elevation)),
    sky = Math.min(1, Math.max(0, (p.elevation + 0.08) / 0.35));
  if (inside) {
    sun.position.set(
      Math.sin(delta) * Math.cos(p.elevation) * 30,
      Math.sin(p.elevation) * 30,
      -Math.cos(delta) * Math.cos(p.elevation) * 30,
    );
    sun.intensity = p.elevation > 0 ? 2.8 * Math.pow(above, 0.4) : 0;
    sun.color.set(p.elevation < 0.22 ? 0xffd4a0 : 0xfff3de);
  } else {
    // Maqueta y planta: luz de estudio fija, para que el plano se lea igual a cualquier hora.
    // Es una luz envolvente y blanca, como la de una foto de catálogo: las caras en sombra
    // quedan solo un poco más oscuras y conservan su color. La hora y la orientación solo
    // afectan al recorrido interior.
    sun.position.set(-7, 26, -9);
    sun.intensity = 0.9;
    sun.color.set(0xffffff);
  }
  // En la maqueta el color en pantalla debe ser el del material (reproducción neutra); en el
  // recorrido se mantiene la respuesta de película, pensada para interiores con sol y sombra.
  renderer.toneMapping = inside ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
  renderer.toneMappingExposure = inside ? 0.96 : 1;
  hemi.color.set(inside ? 0xd9e9ff : 0xffffff);
  hemi.groundColor.set(inside ? 0x8e8273 : 0xcfcac2);
  hemi.intensity = inside ? 0.025 + 0.4 * sky : 2.2;
  fill.intensity = inside ? 0 : 0.45;
  scene.background.set(inside ? (sky > 0.3 ? '#aebfcb' : '#293541') : '#e9ece4');
  for (const l of roomLights) l.intensity = daylight.lamps ? l.userData.base : 0;
  for (const l of skyLights) l.intensity = l.userData.base * sky;
  if (mats.light) mats.light.emissiveIntensity = daylight.lamps ? 1.6 : 0;
  if (mats.strip) mats.strip.emissiveIntensity = daylight.lamps ? 1.2 : 0;
  $('sunInfo').textContent =
    `Sol: ${p.azimuth.toFixed(0)}° · altura ${((p.elevation * 180) / Math.PI).toFixed(0)}° · Fachada ${daylight.facade}° (aprox.)`;
  $('dayHourValue').textContent =
    `${String(Math.floor(daylight.hour)).padStart(2, '0')}:${daylight.hour % 1 ? '30' : '00'} Madrid`;
  renderer.shadowMap.needsUpdate = true;
}
for (const [id, key] of [
  ['dayDate', 'date'],
  ['dayHour', 'hour'],
  ['facadeAzimuth', 'facade'],
]) {
  $(id).value = daylight[key];
  $(id).oninput = (e) => {
    if (key === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
    daylight[key] = key === 'date' ? e.target.value : Number(e.target.value);
    updateDaylight();
  };
}
$('roomLamps').onchange = (e) => {
  daylight.lamps = e.target.checked;
  updateDaylight();
};

// ───────────────────────────── Recorrido en primera persona ─────────────────────────────
const avatar = new THREE.Group();
scene.add(avatar);
const trouser = new THREE.MeshStandardMaterial({ color: 0x353c40, roughness: 0.98 }),
  shoeMat = new THREE.MeshStandardMaterial({ color: 0x292c2b, roughness: 0.8 }),
  soleMat = new THREE.MeshStandardMaterial({ color: 0xbab7af, roughness: 0.95 });
const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), trouser);
pelvis.scale.set(0.18, 0.12, 0.15);
pelvis.position.set(0, 0.98, 0.13);
avatar.add(pelvis);
const shirt = new THREE.MeshStandardMaterial({ color: 0x606b71, roughness: 1 });
const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.17, 0.45, 24), shirt);
torso.scale.z = 0.68;
torso.position.set(0, 1.265, 0.15);
avatar.add(torso);
const legs = [];
for (const side of [-1, 1]) {
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.46, 14), trouser),
    shin = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.045, 0.46, 14), trouser);
  const foot = new THREE.Group(),
    shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), shoeMat),
    sole = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), soleMat);
  shoe.scale.set(0.057, 0.052, 0.143);
  shoe.position.set(0, 0.066, -0.035);
  sole.scale.set(0.058, 0.016, 0.145);
  sole.position.set(0, 0.016, -0.035);
  foot.add(shoe, sole);
  avatar.add(thigh, shin, foot);
  legs.push({ side, thigh, shin, foot });
}
function bone(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.y = a.distanceTo(b) / 0.46;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
}
function updateAvatar() {
  avatar.visible = inside;
  avatar.position.set(walker.x, 0, walker.z);
  avatar.rotation.y = yaw;
  const activity = walker.activity;
  for (const leg of legs) {
    const phase = (walker.phase / 2 + (leg.side === 1 ? 0.5 : 0)) % 1,
      swing = phase < 0.4,
      t = swing ? phase / 0.4 : (phase - 0.4) / 0.6;
    const forward = (swing ? 0.372 - 0.744 * t : -0.372 + 0.744 * t) * Math.min(1, activity * 5),
      lift = swing ? Math.sin(t * Math.PI) * 0.07 * activity : 0;
    const speed = Math.hypot(walker.vx, walker.vz),
      dx = speed > 0.01 ? (Math.cos(yaw) * walker.vx - Math.sin(yaw) * walker.vz) / speed : 0,
      dz = speed > 0.01 ? (Math.sin(yaw) * walker.vx + Math.cos(yaw) * walker.vz) / speed : -1;
    const ankle = new THREE.Vector3(leg.side * 0.105 - dx * forward, 0.1 + lift, -0.05 - dz * forward),
      hip = new THREE.Vector3(leg.side * 0.1, 0.98 + walker.bob * 0.4, 0.09);
    const mid = hip.clone().add(ankle).multiplyScalar(0.5),
      half = hip.distanceTo(ankle) / 2;
    mid.z -= Math.sqrt(Math.max(0, 0.47 * 0.47 - half * half));
    bone(leg.thigh, hip, mid);
    bone(leg.shin, mid, ankle);
    leg.foot.position.set(ankle.x, lift, ankle.z);
    leg.foot.rotation.x = swing ? Math.sin(t * Math.PI * 2) * 0.1 * activity : 0;
  }
}
function leaveWalk() {
  inside = false;
  keys.clear();
  walker.stop();
  avatar.visible = false;
  controls.enabled = true;
  document.body.classList.remove('walking');
  if (document.pointerLockElement) document.exitPointerLock();
  $('walkHud').hidden = true;
  camera.up.set(0, 1, 0);
}
function enterWalk(id = 'living') {
  const starts = {
    livingDecor: [2.95, 6.9, -0.28],
    living: [2.95, 6.9, 0],
    livingWindow: [2.94, 4.4, Math.PI],
    bed1: [2.28, 3.15, 0.55],
    bed2: [3.24, 3.2, -0.15],
    kitchen: [5.32, 3.2, 0],
    bath: [5.42, 5.08, Math.PI],
  };
  let [x, z, a] = starts[id] || starts.living;
  inside = true;
  walkPaused = false;
  keys.clear();
  renderer.domElement.focus({ preventScroll: true });
  mode = 'walk';
  controls.enabled = false;
  document.body.classList.add('walking');
  $('walkHud').hidden = false;
  $('walkRoom').value = starts[id] ? id : 'living';
  camera.up.set(0, 1, 0);
  camera.fov = 65;
  camera.updateProjectionMatrix();
  camera.position.copy(world(x, EYE_HEIGHT, z));
  yaw = a;
  walker.reset(camera.position.x, camera.position.z, a);
  pitch = id === 'livingDecor' ? -0.12 : id === 'bed1' ? -0.3 : id === 'bed2' ? -0.22 : 0;
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  $('walkMessage').textContent = '↑ ↓ avanzar / retroceder · ← → girar · arrastra para mirar';
  build();
}
function canStand(x, z) {
  const r = BODY_RADIUS;
  for (const b of colliders) {
    const nx = Math.max(b.min.x, Math.min(x, b.max.x)),
      nz = Math.max(b.min.z, Math.min(z, b.max.z));
    if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return false;
  }
  return true;
}
// A changed layout must never leave the player inside newly placed furniture.
function unstickWalker() {
  if (canStand(walker.x, walker.z)) return;
  const safe = [
    [3.15, 7.0],
    [3.25, 4.2],
    [2.28, 3.15],
    [3.78, 3.18],
    [5.32, 3.2],
  ].map(([x, z]) => world(x, EYE_HEIGHT, z));
  safe.sort(
    (a, b) => Math.hypot(a.x - walker.x, a.z - walker.z) - Math.hypot(b.x - walker.x, b.z - walker.z),
  );
  const p = safe.find((p) => canStand(p.x, p.z));
  if (p) {
    keys.clear();
    walker.reset(p.x, p.z, yaw);
    camera.position.copy(p);
    walkPaused = false;
  }
}
function stepWalk(dt) {
  if (walkPaused || $('evidence').open) {
    walker.stop();
    return;
  }
  const turn =
    (keys.has('ArrowLeft') || keys.has('KeyQ') ? 1 : 0) -
    (keys.has('ArrowRight') || keys.has('KeyE') ? 1 : 0);
  const forward =
      (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0),
    side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  walker.yaw = yaw;
  walker.update(dt, { forward, side, turn, slow: keys.has('ShiftLeft') || keys.has('ShiftRight') }, canStand);
  yaw = walker.yaw;
  const motion = true,
    offset = motion ? walker.sway : 0;
  camera.position.set(walker.x, motion ? walker.eyeY : EYE_HEIGHT, walker.z);
  const sx = walker.x + Math.cos(yaw) * offset,
    sz = walker.z - Math.sin(yaw) * offset;
  if (canStand(sx, sz)) {
    camera.position.x = sx;
    camera.position.z = sz;
  }
  camera.rotation.set(pitch, yaw, motion ? walker.roll : 0, 'YXZ');
  updateAvatar();
}

// ───────────────────────────── Teclado, ratón y táctil ─────────────────────────────
function typing(e) {
  return /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName);
}
document.addEventListener('keydown', (e) => {
  if (!inside || typing(e) || $('evidence').open) return;
  if (
    [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyQ',
      'KeyE',
      'ShiftLeft',
      'ShiftRight',
    ].includes(e.code)
  ) {
    e.preventDefault();
    unlockAudio();
    keys.add(e.code);
  }
  if (e.code === 'Escape') {
    keys.clear();
    walkPaused = true;
    walker.stop();
    $('walkMessage').textContent = 'En pausa · pulsa en la imagen para continuar';
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  walker.stop();
  dragging = false;
});
document.addEventListener('pointerlockchange', () => {
  keys.clear();
  if (!document.pointerLockElement) dragging = false;
});
document.addEventListener('visibilitychange', () => {
  keys.clear();
  walker.stop();
  lastTime = performance.now();
});
let lookPointer = null,
  lookX = 0,
  lookY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!inside || lookPointer !== null) return;
  lookPointer = e.pointerId;
  lookX = e.clientX;
  lookY = e.clientY;
  unlockAudio();
  walkPaused = false;
  dragging = true;
  renderer.domElement.focus();
  renderer.domElement.setPointerCapture(e.pointerId);
  $('walkMessage').textContent = '↑ ↓ avanzar / retroceder · ← → girar · arrastra para mirar';
});
renderer.domElement.tabIndex = 0;
const endLook = (e) => {
  if (e.pointerId === lookPointer) {
    lookPointer = null;
    dragging = false;
  }
};
renderer.domElement.addEventListener('pointerup', endLook);
renderer.domElement.addEventListener('pointercancel', endLook);
renderer.domElement.addEventListener('lostpointercapture', endLook);
document.addEventListener('pointermove', (e) => {
  if (!inside) return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && (!dragging || e.pointerId !== lookPointer)) return;
  const dx = locked ? e.movementX : e.clientX - lookX,
    dy = locked ? e.movementY : e.clientY - lookY;
  lookX = e.clientX;
  lookY = e.clientY;
  yaw -= dx * 0.0025;
  pitch = Math.max(-1.5, Math.min(1.35, pitch - dy * 0.0025));
});
$('exitWalk').onclick = overview;
$('walkRoom').onchange = (e) => {
  enterWalk(e.target.value);
  e.target.blur();
};
$('lockMouse').onclick = async () => {
  try {
    await renderer.domElement.requestPointerLock();
    renderer.domElement.focus();
    walkPaused = false;
  } catch {
    $('walkMessage').textContent = 'Arrastra sobre la imagen para mirar; flechas para caminar.';
  }
};
$('fullscreen').onclick = async () => {
  try {
    if (!document.fullscreenElement) await $('viewport').requestFullscreen();
    else await document.exitFullscreen();
    renderer.domElement.focus();
  } catch {
    $('walkMessage').textContent = 'Puedes ampliar la ventana con F11.';
  }
};
for (const b of document.querySelectorAll('[data-walk-key]')) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    unlockAudio();
    walkPaused = false;
    keys.add(b.dataset.walkKey);
    b.setPointerCapture(e.pointerId);
  };
  b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => keys.delete(b.dataset.walkKey);
}

// ───────────────────────────── Controles de la interfaz ─────────────────────────────
$('orbit').onclick = overview;
$('top').onclick = top;
$('room').onchange = focusRoom;
$('inside').onclick = () => enterWalk($('room').value);
for (const key of ['scale', 'walls']) {
  $(key).value = state[key];
  $(key).oninput = (e) => {
    state[key] = Number(e.target.value);
    build();
  };
}
for (const key of ['furniture', 'labels']) {
  $(key).checked = state[key];
  $(key).onchange = (e) => {
    state[key] = e.target.checked;
    build();
  };
}
// La disposición se elige con el desplegable del panel lateral o con los botones del recorrido;
// los dos salen de LAYOUTS y se mantienen sincronizados.
function showLayout() {
  $('livingLayoutPlan').value = state.livingLayout;
  for (const b of $('layoutButtons').children)
    b.classList.toggle('active', b.dataset.layout === state.livingLayout);
  $('layoutNote').textContent = LAYOUTS.find((l) => l.id === state.livingLayout).note;
}
function setLayout(id) {
  state.livingLayout = id;
  state.furniture = true;
  $('furniture').checked = true;
  showLayout();
  build();
  if (inside && !canStand(walker.x, walker.z)) enterWalk('livingDecor');
}
for (const { id, name } of LAYOUTS) {
  $('livingLayoutPlan').append(new Option(name, id));
  const button = document.createElement('button');
  button.dataset.layout = id;
  button.textContent = name;
  button.onclick = () => {
    setLayout(id);
    button.blur();
    if (inside) renderer.domElement.focus({ preventScroll: true });
  };
  $('layoutButtons').append(button);
}
$('livingLayoutPlan').onchange = (e) => {
  setLayout(e.target.value);
  e.target.blur();
};
showLayout();
// Lista de medidas pendientes: solo recuerda qué se ha marcado ya.
for (const input of document.querySelectorAll('[data-measure]')) {
  input.checked = Boolean(state.measured[input.dataset.measure]);
  input.onchange = () => {
    state.measured[input.dataset.measure] = input.checked;
    persist();
  };
}
$('palette').value = state.palette;
$('palette').onchange = (e) => {
  state.palette = e.target.value;
  build();
};
$('calibrate').onclick = () => {
  state.scale = Math.sqrt(38.69 / BASE_AREA) * 100;
  $('scale').value = state.scale;
  build();
};
$('reset').onclick = () => {
  Object.assign(state, defaults, { measured: state.measured });
  for (const key of ['scale', 'walls', 'palette']) $(key).value = state[key];
  for (const key of ['furniture', 'labels']) $(key).checked = state[key];
  showLayout();
  $('room').value = 'all';
  overview();
};
$('sources').onclick = () => {
  keys.clear();
  walker.stop();
  $('evidence').showModal();
};
$('closeEvidence').onclick = () => $('evidence').close();
const labels = rooms.map((r) => {
  let el = document.createElement('button');
  el.className = 'room-label';
  el.onclick = () => {
    $('room').value = r.id;
    focusRoom();
  };
  $('labelsLayer').append(el);
  return { r, el };
});
const size = () => {
  const { width, height } = $('canvasHost').getBoundingClientRect();
  renderer.setSize(width, height);
  const oldAspect = camera.aspect;
  camera.aspect = width / height;
  if (!inside && $('room').value === 'all' && mode === 'orbit') {
    const ratio = Math.max(1, 1.05 / camera.aspect) / Math.max(1, 1.05 / oldAspect);
    camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
  }
  camera.updateProjectionMatrix();
};
new ResizeObserver(size).observe($('canvasHost'));
size();
enterWalk('livingDecor');

// ───────────────────────────── Compra del salón y ficha de mueble ─────────────────────────────
{
  const total = PRODUCTS.reduce((sum, p) => sum + lineTotal(p), 0);
  $('shoppingTotal').textContent = euro(Math.round(total));
  for (const seller of [...new Set(PRODUCTS.map((p) => p.seller))]) {
    const items = PRODUCTS.filter((p) => p.seller === seller);
    const title = document.createElement('h3');
    title.textContent = `${seller} · ${euro(items.reduce((sum, p) => sum + lineTotal(p), 0))}`;
    const list = document.createElement('ul');
    for (const p of items) {
      const li = document.createElement('li'),
        link = document.createElement('a'),
        price = document.createElement('span'),
        detail = document.createElement('small');
      link.href = p.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = (p.qty ? `${p.qty} × ` : '') + p.name;
      price.textContent = euro(lineTotal(p));
      detail.textContent = [p.dims, p.qty ? `${euro(p.price)} cada uno` : '', p.note]
        .filter(Boolean)
        .join(' · ');
      li.append(link, price, detail);
      list.append(li);
    }
    $('shoppingList').append(title, list);
  }
}
function showProduct(id) {
  const p = PRODUCTS.find((x) => x.id === id);
  $('productCard').hidden = !p;
  if (!p) return;
  $('productName').textContent = p.name;
  $('productSeller').textContent = p.seller;
  $('productPrice').textContent = p.qty
    ? `${euro(p.price)} cada uno · ${p.qty} uds. ${euro(lineTotal(p))}`
    : euro(p.price);
  $('productDims').textContent = [p.dims, p.note].filter(Boolean).join(' · ');
  $('productLink').href = p.url;
  $('productLink').textContent = `Ver en ${p.seller} ↗`;
}
$('productClose').onclick = () => showProduct(null);
// Un clic sin arrastrar sobre un mueble abre su ficha, tanto en la maqueta como en el recorrido.
{
  const raycaster = new THREE.Raycaster(),
    canvas = renderer.domElement;
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = canvas.getBoundingClientRect(),
      point = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObject(model, true).find((h) => h.object.visible);
    let o = hit && hit.object;
    while (o && !o.userData.product) o = o.parent;
    showProduct(o ? o.userData.product : null);
  });
}

// ───────────────────────────── Bucle de render ─────────────────────────────
let qualityTime = 0,
  qualityFrames = 0,
  qualityScale = Math.min(devicePixelRatio, 1.25);
function animate(time = 0) {
  requestAnimationFrame(animate);
  const dt = Math.min((time - lastTime) / 1000, 0.25);
  lastTime = time;
  qualityTime += dt;
  qualityFrames++;
  if (qualityTime > 2) {
    const fps = qualityFrames / qualityTime;
    if (fps < 28 && qualityScale > 0.65) {
      qualityScale = Math.max(0.65, qualityScale - 0.15);
      renderer.setPixelRatio(qualityScale);
      size();
    }
    qualityTime = 0;
    qualityFrames = 0;
  }
  if (inside) stepWalk(dt);
  else controls.update();
  renderer.render(scene, camera);
  const w = $('canvasHost').clientWidth,
    h = $('canvasHost').clientHeight;
  for (const { r, el } of labels) {
    if (inside) {
      el.hidden = true;
      continue;
    }
    const p = world(r.x, 0.16, r.z).project(camera);
    el.hidden = !state.labels || inside || p.z > 1 || p.z < -1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
    el.style.left = `${((p.x + 1) * w) / 2}px`;
    el.style.top = `${((1 - p.y) * h) / 2}px`;
    const area = r.area * (state.scale / 100) ** 2;
    el.innerHTML = `${r.name}<small>≈ ${area.toFixed(1)} m²</small>`;
  }
}
animate();
window.homestudioDebug = {
  state,
  rooms,
  baseArea: BASE_AREA,
  scene,
  renderer,
  camera,
  controls,
  enterWalk,
  setLayout,
  canStand,
  world,
  get mats() {
    return mats;
  },
  get model() {
    return model;
  },
  get colliders() {
    return colliders;
  },
  get inside() {
    return inside;
  },
  get yaw() {
    return yaw;
  },
  eyeHeight: EYE_HEIGHT,
  walker,
  daylight,
  solarState,
  updateDaylight,
};

for (const panel of document.querySelectorAll('.walking-options,.daylight-panel'))
  panel.addEventListener('toggle', () => {
    if (panel.open && matchMedia('(max-width:850px)').matches)
      for (const other of document.querySelectorAll('.walking-options,.daylight-panel'))
        if (other !== panel) other.open = false;
  });
