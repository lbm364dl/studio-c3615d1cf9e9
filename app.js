import * as THREE from 'three';
import { furnish, bakeTexture } from './decor.mjs?v=8e1813613bdb'; // subir el número al cambiar decor.mjs: el navegador lo guarda en caché
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
  bed1Layout: 'work',
  bed2Layout: 'window',
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
    name: 'Tele Hisense 65U7S Pro, 65" Mini LED',
    seller: 'Amazon',
    price: 729,
    dims: '144,6 × 83,7 × 5,2 cm · 19,6 kg · VESA 400 × 300',
    note: 'A 2–2,2 m del sofá llena unos 36–39° de la vista, lo recomendado para cine.',
    url: 'https://www.amazon.es/dp/B0GT2HY84T',
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
    id: 'ceilinglight',
    name: 'Panel LED de techo JETSTRÖM 60 × 60',
    seller: 'IKEA',
    price: 79.99,
    dims: '60 × 60 × 5,5 cm · 4600 lm · 38 W · de 2200 a 4000 K',
    note: 'Regulable. Va en el punto de luz del techo; el mando se compra aparte.',
    url: 'https://www.ikea.com/es/es/p/jetstrom-panel-iluminacion-led-techo-inteligente-regulacion-intensidad-luminosa-espectro-blanco-60536008/',
  },
  {
    id: 'remote',
    name: 'Mando BILRESA con rueda',
    seller: 'IKEA',
    price: 8.99,
    dims: 'Para encender, regular y cambiar el tono de la luz',
    url: 'https://www.ikea.com/es/es/p/bilresa-mando-distancia-blanco-inteligente-rueda-desplazamiento-70604172/',
  },
  {
    id: 'ledstrip',
    name: 'Tira LED ORMANÄS, 4 m',
    seller: 'IKEA',
    price: 34.99,
    dims: '4 m · 640 lm · 5 W',
    note: 'Pegada detrás de la tele: luz indirecta en la pared.',
    url: 'https://www.ikea.com/es/es/p/ormanas-tira-iluminacion-led-inteligente-regulac-lumin-inalambr-color-espectro-blanco-40497395/',
  },
  // Cocina: electrodomésticos de El Corte Inglés (fichas leídas el 16/11/2026).
  {
    id: 'washer',
    name: 'Lavadora Bosch WGE03400EP, 8 kg',
    seller: 'El Corte Inglés',
    price: 499,
    dims: '59,8 × 84,8 × 58,8 cm · clase A · 72 dB al centrifugar',
    note: 'En el hueco junto a la ventana. Solo 1 cm de margen de alto si la encimera está a 86 cm: medir.',
    url: 'https://www.elcorteingles.es/electrodomesticos/A50964273-4242005476565-pr-lavadora-bosch-8-kg-1400-rpm-wge03400ep-blanco/',
  },
  {
    id: 'fridge',
    name: 'Frigorífico combi Hisense RB390N4DWD',
    seller: 'El Corte Inglés',
    price: 549,
    dims: '59,5 × 186 × 59 cm · 304 L · No Frost · clase D · 36 dB',
    note: 'Al final de la encimera, junto a la puerta.',
    url: 'https://www.elcorteingles.es/electrodomesticos/A47016872-6921727072672-pr-frigorifico-combi-hisense-no-frost-multi-air-flow-rb390n4dwd-blanco/',
  },
  {
    id: 'microwave',
    name: 'Microondas LG MS2082H, 20 L',
    seller: 'El Corte Inglés',
    price: 75.65,
    dims: '43,9 × 25,8 × 33,9 cm · 700 W',
    note: 'En el hueco bajo el mueble alto de la ventana. Medir el hueco, sobre todo el fondo.',
    url: 'https://www.elcorteingles.es/electrodomesticos/A200279870-8806096596043-pr-microondas-lg-20-litros-con-5-niveles-de-potencia-ms2082h/',
  },
  {
    id: 'dishwasher',
    name: 'Lavavajillas Fagor 4LVF-435AD, 45 cm',
    seller: 'El Corte Inglés',
    price: 355,
    dims: '45 × 84,5 × 60 cm (81,5 sin tapa) · 10 servicios · clase C · 46 dB',
    note: 'Sin colocar: depende de que el mueble junto al horno mida 45 cm.',
    url: 'https://www.elcorteingles.es/electrodomesticos/A51162751-8435582503526-pr-lavavajillas-fagor-10-servicios-bandeja-para-cubiertos-45-cm-4lvf-435ad-blanco/',
    optional: true,
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
// Dormitorio 2: todo de IKEA, para juntarlo con el pedido del salón.
PRODUCTS.push(
  {
    id: 'bed',
    name: 'Canapé TJÅLLE 135 × 190, Bomstad blanco',
    seller: 'IKEA',
    price: 399,
    dims: '197 × 142 × 41 cm · arcón que abre desde los pies',
    note: 'En 2,10 m de ancho deja 13 cm: medir antes.',
    url: 'https://www.ikea.com/es/es/p/tjalle-canape-tapizado-bomstad-blanco-40586853/',
  },
  {
    id: 'mattress',
    name: 'Colchón VALEVÅG 135 × 190, firme',
    seller: 'IKEA',
    price: 229,
    dims: 'Muelles ensacados, 24 cm · se duerme a 65 cm',
    note: 'Precio de oferta hasta el 31/12/2026.',
    url: 'https://www.ikea.com/es/es/p/valevag-colchon-muelles-ensacados-firme-azul-claro-80531731/',
  },
  {
    id: 'wardrobe',
    name: 'Armario PAX / MEHAMN / AULI, blanco y espejo',
    seller: 'IKEA',
    price: 730,
    dims: '200 × 66 × 236 cm · correderas, una hoja de espejo',
    note: '610 € la combinación, más 3 cajones (111 €) y una barra (9 €).',
    url: 'https://www.ikea.com/es/es/p/pax-mehamn-auli-armario-con-puertas-correderas-blanco-ambos-lados-blanco-espejo-s69561362/',
  },
  {
    id: 'desk',
    name: 'Mesa abatible de pared NORBERG, blanca',
    seller: 'IKEA',
    price: 35,
    qty: 2,
    dims: '74 × 60 cm abierta · recogida cuelga pegada a la pared',
    note: 'Una en cada dormitorio. Va atornillada: comprobar de qué es cada pared.',
    url: 'https://www.ikea.com/es/es/p/norberg-mesa-plegable-pared-blanco-30180504/',
  },
  {
    id: 'foldchair',
    name: 'Silla plegable FRÖSVI, blanco / Knisa gris claro',
    seller: 'IKEA',
    price: 29.99,
    qty: 2,
    dims: '43 × 49 × 78 cm · asiento a 48 · plegada 88 × 8 cm',
    note: 'Asiento y respaldo acolchados. Una en cada dormitorio.',
    url: 'https://www.ikea.com/es/es/p/frosvi-silla-plegable-blanco-knisa-gris-claro-20534332/',
  },
);
// Dormitorio 1 (con la cama de 160 × 200), también de IKEA.
PRODUCTS.push(
  {
    id: 'bed1-bed',
    name: 'Canapé TJÅLLE 160 × 200, Bomstad blanco',
    seller: 'IKEA',
    price: 449,
    dims: '207 × 167 × 41 cm · arcón que abre desde los pies',
    note: 'Con el cabecero, en 2,60 m de ancho deja 47 cm de paso a los pies.',
    url: 'https://www.ikea.com/es/es/p/tjalle-canape-tapizado-bomstad-blanco-70586861/',
  },
  {
    id: 'bed1-mattress',
    name: 'Colchón VALEVÅG 160 × 200, firme',
    seller: 'IKEA',
    price: 299,
    dims: 'Muelles ensacados, 24 cm · se duerme a 65 cm',
    url: 'https://www.ikea.com/es/es/p/valevag-colchon-muelles-ensacados-firme-azul-claro-40450680/',
  },
  {
    id: 'nightstand',
    name: 'Mesita de noche FÅGELFJÄLLET, hueso',
    seller: 'IKEA',
    price: 39.99,
    dims: '42 × 41 × 56 cm',
    url: 'https://www.ikea.com/es/es/p/fagelfjallet-mesita-noche-hueso-40627684/',
  },
  {
    id: 'projector',
    name: 'Proyector Anker Nebula P1i, 1080p',
    seller: 'Amazon',
    price: 289.99,
    dims: '18,3 × 20,4 × 22,8 cm · 380 lúmenes ANSI · altavoces 2 × 10 W',
    note: 'En la balda sobre el cabecero, centrado: imagen de unos 1,89 × 1,06 m (85") en la pared de los pies. Solo se ve bien a oscuras.',
    url: 'https://www.amazon.es/dp/B0FPFLL4WN',
  },
  {
    id: 'shelf',
    name: 'Estante de pared LACK 110 × 26, blanco',
    seller: 'IKEA',
    price: 14.99,
    dims: '110 × 26 × 5 cm · hasta 10 kg',
    note: 'Sobre el cabecero, a 1,75 m, para el proyector.',
    url: 'https://www.ikea.com/es/es/p/lack-estante-pared-blanco-90282180/',
  },
  {
    id: 'headboard',
    name: 'Cabecero LJUSFJÄLLET 160, Knisa beige claro',
    seller: 'IKEA',
    price: 179,
    dims: '165 cm de ancho · 5 cm de grosor · altura regulable desde 104 cm',
    note: 'Acolchado, con funda lavable. Alarga la cama 5 cm.',
    url: 'https://www.ikea.com/es/es/p/ljusfjallet-cabecero-incluye-pata-knisa-beige-claro-s09610841/',
  },
);
// Estancia de cada producto, para la lista de la compra.
const ROOM_OF = {
  'Dormitorio 1': ['bed1-bed', 'bed1-mattress', 'headboard', 'nightstand', 'projector', 'shelf'],
  'Dormitorio 2': ['bed', 'mattress', 'wardrobe', 'desk', 'foldchair'],
  Cocina: ['washer', 'fridge', 'microwave', 'dishwasher'],
};
for (const p of PRODUCTS)
  p.room = Object.keys(ROOM_OF).find((room) => ROOM_OF[room].includes(p.id)) || 'Salón';
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
const BED2_LAYOUTS = [
  {
    id: 'window',
    name: 'Cama en la ventana',
    note: 'Elegida. Armario con espejo y mesa abatible: pulsa la mesa para abrirla o recogerla.',
  },
  {
    id: 'couple',
    name: 'Cama a lo largo',
    note: 'Cabeza bajo la ventana: pasillo de 68 cm y salida por los pies; armario de 150, sin escritorio.',
  },
];
if (!LAYOUTS.some((l) => l.id === state.livingLayout)) state.livingLayout = defaults.livingLayout;
const BED1_LAYOUTS = [
  {
    id: 'work',
    name: 'Cama de 160 × 200',
    note: 'Recomendada por tu estatura. Quedan 47 cm de paso a los pies.',
  },
  {
    id: 'queen',
    name: 'Cama de 135 × 190',
    note: 'Quedan 57 cm de paso y más pasillo, pero el colchón es corto para 1,85 m.',
  },
];
if (!BED2_LAYOUTS.some((l) => l.id === state.bed2Layout)) state.bed2Layout = defaults.bed2Layout;
if (!BED1_LAYOUTS.some((l) => l.id === state.bed1Layout)) state.bed1Layout = defaults.bed1Layout;
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
const daylight = { date: '2026-10-18', hour: 10, facade: 75 };
// Tono del panel del salón (regulable de 2200 a 4000 K según su ficha).
// Color de la luz según su temperatura en kelvin, interpolado entre tres referencias.
const LAMP_STOPS = [
  [2200, new THREE.Color(0xffc27a)],
  [2700, new THREE.Color(0xffe0b8)],
  [4000, new THREE.Color(0xf6f8ff)],
];
const lampColor = (kelvin) => {
  const i = kelvin <= 2700 ? 0 : 1,
    [k0, c0] = LAMP_STOPS[i],
    [k1, c1] = LAMP_STOPS[i + 1];
  return c0.clone().lerp(c1, Math.min(1, Math.max(0, (kelvin - k0) / (k1 - k0))));
};
let lampTone = 2700;
let skyLights = [],
  stripLights = [];
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
    info: '0,92 × 2,45 m en el modelo; el plano también da 2,40 m. Lavabo e inodoro en la pared de la izquierda según se entra y ducha al fondo, según las fotos. Ese ancho tan estrecho hay que comprobarlo.',
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
// En móviles y tabletas (puntero táctil) se aligera la luz: sin las segundas luces de relleno y
// con mapas de sombra más pequeños. Muchos móviles admiten menos texturas a la vez y menos carga.
const LOW_POWER = matchMedia('(pointer: coarse)').matches;
// Las sombras suaves cuestan muchas lecturas por píxel y por luz; en móvil, sombras simples.
renderer.shadowMap.type = LOW_POWER ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
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
  const tx = bakeTexture(c);
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
  const t = bakeTexture(c);
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
      // Solo el marco: las hojas de cristal las pone addBalconyDoor, porque una se abre.
      for (const v of [o.a, o.b]) part(v - 0.025, v + 0.025, 0, Math.min(head, H), mats.white, 0.08);
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
  interactives = [];
  // La base de la maqueta está a ras del piso: en el recorrido taparía la calle, que queda 5,8 m
  // más abajo, así que se oculta cuando se dibuja el exterior.
  ground.visible = !(inside && exterior);
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
      { a: 1.27, b: 2.02, type: 'balcony' },
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
  // Cocina existente, según las dos fotos (anuncio y tasación). Módulos medidos sobre la foto de
  // la tasación tomando el horno como patrón de 60 cm; error estimado de ±5 cm por módulo.
  // Desde la ventana (z = 0): hueco libre de 62 para la lavadora, mueble de fregadero de dos
  // puertas (≈ 100 en total; el reparto 60 + 40 es lo que parece, sin medir), horno de 60 y
  // cajonera de 60. La encimera acaba en z ≈ 2,89; hasta la pared de la puerta quedan ≈ 81 cm
  // sin muebles: hueco de nevera de 60 y unos 20 cm más.
  {
    // Acabados de las fotos: frentes gris verdoso con marco (tipo shaker) y tirador de barra,
    // encimera de roble rústico y frente de azulejo grande imitación mármol.
    const kitchen = material('#a9aca3', { roughness: 0.5 }),
      recess = material('#9fa299', { roughness: 0.55 }),
      steel = material('#c9ccce', { metalness: 0.7, roughness: 0.3 }),
      base = (z0, z1) => box(6.08, 0.44, (z0 + z1) / 2, 0.6, 0.76, z1 - z0 - 0.004, kitchen),
      // Frente con panel rehundido; `x` es la cara vista (5,772 abajo, 6,022 en los muebles altos).
      front = (z0, z1, y0, y1, x = 5.772) => {
        box(x, (y0 + y1) / 2, (z0 + z1) / 2, 0.018, y1 - y0 - 0.006, z1 - z0 - 0.006, kitchen);
        if (y1 - y0 > 0.25)
          box(x - 0.0085, (y0 + y1) / 2, (z0 + z1) / 2, 0.003, y1 - y0 - 0.13, z1 - z0 - 0.13, recess);
      },
      bar = (y, z, vertical, x = 5.745) => {
        box(x, y, z, 0.012, vertical ? 0.16 : 0.012, vertical ? 0.012 : 0.2, steel);
      };
    if (!mats.worktop) {
      // Roble rústico claro: veta a lo largo de la encimera, con algunas manchas y nudos oscuros.
      const w = document.createElement('canvas');
      w.width = 128;
      w.height = 512;
      const k = w.getContext('2d');
      k.fillStyle = '#d7b07c';
      k.fillRect(0, 0, 128, 512);
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 260; i++) {
        const x = rnd() * 128,
          y = rnd() * 512,
          len = 40 + rnd() * 160,
          dark = rnd() < 0.5;
        k.strokeStyle = dark
          ? `rgba(120,84,48,${0.05 + rnd() * 0.12})`
          : `rgba(240,214,170,${0.05 + rnd() * 0.12})`;
        k.lineWidth = 0.6 + rnd() * 1.6;
        k.beginPath();
        k.moveTo(x, y);
        k.bezierCurveTo(
          x + rnd() * 4 - 2,
          y + len / 3,
          x + rnd() * 4 - 2,
          y + (2 * len) / 3,
          x + rnd() * 3 - 1.5,
          y + len,
        );
        k.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const x = rnd() * 128,
          y = rnd() * 512,
          blot = k.createRadialGradient(x, y, 0, x, y, 5 + rnd() * 9);
        blot.addColorStop(0, 'rgba(84,58,36,0.5)');
        blot.addColorStop(1, 'rgba(84,58,36,0)');
        k.fillStyle = blot;
        k.fillRect(x - 16, y - 30, 32, 60);
      }
      const wood = bakeTexture(w);
      wood.colorSpace = THREE.SRGBColorSpace;
      mats.worktop = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 });
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#e9e7e3';
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(120,120,125,0.35)';
      for (let i = 0; i < 7; i++) {
        g.lineWidth = 0.6 + (i % 3) * 0.7;
        g.beginPath();
        g.moveTo(-20 + i * 37, 0);
        g.bezierCurveTo(40 + i * 30, 70, i * 45 - 60, 160, 30 + i * 41, 256);
        g.stroke();
      }
      g.strokeStyle = 'rgba(150,150,150,0.5)';
      g.lineWidth = 1;
      g.strokeRect(0.5, 0.5, 255, 255);
      const marble = bakeTexture(c);
      marble.wrapS = marble.wrapT = THREE.RepeatWrapping;
      marble.repeat.set(2.4, 1);
      marble.colorSpace = THREE.SRGBColorSpace;
      mats.marble = new THREE.MeshStandardMaterial({ map: marble, roughness: 0.25 });
    }
    // Zócalo retranqueado bajo los muebles (no bajo el hueco de la lavadora).
    box(6.1, 0.03, 1.755, 0.5, 0.06, 2.27, kitchen);
    base(0.62, 1.62);
    front(0.62, 1.22, 0.06, 0.82);
    front(1.22, 1.62, 0.06, 0.82);
    bar(0.6, 1.17, true);
    bar(0.6, 1.27, true);
    base(1.62, 2.22);
    // Horno: panel de mandos, puerta de cristal oscuro con tirador y rejilla inferior.
    box(5.772, 0.75, 1.92, 0.018, 0.1, 0.594, mats.dark);
    for (const dz of [-0.2, -0.13, 0.13, 0.2])
      cylinder(5.758, 0.75, 1.92 + dz, 0.018, 0.02, mats.metal).rotation.z = Math.PI / 2;
    box(5.772, 0.42, 1.92, 0.018, 0.52, 0.594, mats.dark);
    box(5.745, 0.66, 1.92, 0.014, 0.014, 0.48, mats.metal);
    box(5.772, 0.11, 1.92, 0.018, 0.08, 0.594, mats.metal);
    base(2.22, 2.82);
    [0.06, 0.25, 0.44, 0.63].forEach((y) => {
      front(2.22, 2.82, y, y + 0.19);
      bar(y + 0.13, 2.52, false);
    });
    // Costado final: acaba bajo la encimera (si llegara a su cara de arriba, parpadearían).
    box(6.08, 0.42, 2.855, 0.6, 0.84, 0.07, kitchen);
    // Encimera de roble rústico de pared a pared de la ventana, fregadero de un seno con
    // escurridor y grifo alto, y placa sobre el horno.
    box(6.07, 0.86, 1.445, 0.63, 0.04, 2.89, mats.worktop);
    box(6.05, 0.883, 0.95, 0.44, 0.006, 0.62, steel);
    box(6.05, 0.887, 0.8, 0.34, 0.004, 0.27, material('#8e9296', { metalness: 0.6, roughness: 0.45 }));
    for (let i = 0; i < 6; i++) box(6.05, 0.888, 1.03 + i * 0.04, 0.3, 0.004, 0.008, material('#aeb2b5'));
    cylinder(6.27, 1.02, 0.97, 0.012, 0.28, steel);
    box(6.19, 1.16, 0.97, 0.17, 0.02, 0.02, steel);
    box(6.04, 0.883, 1.92, 0.51, 0.008, 0.58, mats.dark);
    // Muebles altos (foto del anuncio), de la ventana hacia la puerta: uno corto con un hueco
    // abierto debajo, uno de dos puertas, el de la campana y uno ancho. Anchos estimados.
    if (inside || state.walls > 1.45) {
      const wall = (z0, z1, y0, y1) =>
        box(6.2, (y0 + y1) / 2, (z0 + z1) / 2, 0.34, y1 - y0, z1 - z0 - 0.004, kitchen);
      wall(0.4, 1.0, 1.86, 2.2);
      front(0.4, 1.0, 1.86, 2.2, 6.022);
      bar(1.92, 0.7, false, 5.995);
      // Hueco abierto bajo el primer mueble: costados y balda; candidato para el microondas.
      for (const z of [0.409, 0.991]) box(6.2, 1.675, z, 0.34, 0.37, 0.018, kitchen);
      box(6.2, 1.499, 0.7, 0.34, 0.018, 0.6, kitchen);
      wall(1.0, 1.62, 1.49, 2.2);
      front(1.0, 1.31, 1.49, 2.2, 6.022);
      front(1.31, 1.62, 1.49, 2.2, 6.022);
      bar(1.62, 1.27, true, 5.995);
      bar(1.62, 1.35, true, 5.995);
      wall(1.62, 2.22, 1.72, 2.2);
      front(1.62, 2.22, 1.72, 2.2, 6.022);
      wall(2.22, 2.89, 1.49, 2.2);
      front(2.22, 2.89, 1.49, 2.2, 6.022);
      bar(1.62, 2.28, true, 5.995);
    }
  }
  // Baño según las fotos de la tasación, visto desde la puerta: mueble de lavabo de madera con
  // espejo redondo a la izquierda (pared este), inodoro a continuación en la misma pared y ducha
  // al fondo con mampara. Posiciones a ojo; el ancho del baño (0,92 m) está sin medir.
  box(5.18, 0.045, 6.84, 0.86, 0.09, 0.75, mats.white);
  box(5.19, 1.0, 6.44, 0.84, 1.95, 0.025, mats.glass);
  box(5.19, 1.99, 6.44, 0.86, 0.035, 0.035, mats.metal);
  box(5.44, 0.5, 5.53, 0.4, 0.76, 0.57, mats.oak);
  box(5.42, 0.91, 5.53, 0.43, 0.08, 0.6, mats.white);
  box(5.42, 0.956, 5.53, 0.22, 0.012, 0.3, mats.tile);
  box(5.58, 1.04, 5.53, 0.025, 0.2, 0.025, mats.metal);
  const mirror = new Reflector(new THREE.CircleGeometry(0.27, 64), {
    textureWidth: 512,
    textureHeight: 512,
    color: 0xd8dcda,
    clipBias: 0.003,
    multisample: 0,
  });
  mirror.position.set(5.634, 1.55, 5.53);
  mirror.rotation.y = -Math.PI / 2;
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
  // Inodoro: cisterna contra la pared este, taza hacia el paso.
  bowl.position.set(5.22, 0.36, 6.14);
  bowl.scale.set(0.2, 0.22, 0.28);
  model.add(bowl);
  cylinder(5.22, 0.16, 6.14, 0.12, 0.3, mats.white);
  box(5.51, 0.54, 6.14, 0.18, 0.62, 0.41, mats.white);
  cylinder(5.18, 0.54, 6.14, 0.19, 0.045, mats.white).scale.z = 1.3;
  if (state.furniture)
    furnish(
      model,
      mats,
      { living: state.livingLayout, bed1: state.bed1Layout, bed2: state.bed2Layout },
      registerInteractive,
    );
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
  updateClosedDoors();
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

// ───────────────────────────── Piezas que se abren ─────────────────────────────
// Puertas, hojas de armario, frentes abatibles y la tele: se pulsan para abrir o cerrar.
// Cada pieza es `{ id, kind, object, ... }`; `openState` recuerda si está abierta entre
// reconstrucciones y `value` (0 cerrada … 1 abierta) se anima hacia ese estado.
//  · 'hinge': gira `object` en vertical hasta `open` radianes (puertas de paso).
//  · 'tilt': bascula `object` hasta `open` radianes (frentes abatibles).
//  · 'slide': desplaza `object` `distance` metros en el eje `axis` (hojas correderas).
//  · 'custom': llama a `apply(value)`.
// Las puertas interiores empiezan abiertas, para poder recorrer la casa; lo demás, cerrado.
const openState = {},
  shade = {};
let interactives = [],
  closedDoors = [];
const isOpen = (spec) => Boolean(openState[spec.id] ?? spec.startsOpen);
// Cortinas y estores tienen posiciones intermedias (`levels`): su estado es un número de 0 a 1.
const targetOf = (spec) =>
  typeof openState[spec.id] === 'number' ? openState[spec.id] : isOpen(spec) ? 1 : 0;
function applyInteractive(spec) {
  const v = spec.value;
  if (spec.kind === 'hinge') spec.object.rotation.y = spec.open * v;
  else if (spec.kind === 'tilt') spec.object.rotation[spec.axis || 'x'] = spec.open * v;
  else if (spec.kind === 'slide') spec.object.position[spec.axis] = spec.distance * v;
  else spec.apply(v);
  // Cortinas y estores: cuánto tapan la luz de su estancia (0 nada … 1 todo).
  if (spec.shade) shade[spec.id] = [spec.shade, v * (spec.blocks ?? 0.92)];
}
function registerInteractive(spec) {
  spec.value = targetOf(spec);
  spec.object.userData.toggleId = spec.id;
  applyInteractive(spec);
  interactives.push(spec);
}
// Una puerta cerrada corta el paso: su hueco cuenta como obstáculo mientras no se abra.
function updateClosedDoors() {
  closedDoors = interactives
    .filter((spec) => (spec.doorway && (spec.exit || !isOpen(spec))) || (spec.obstacle && isOpen(spec)))
    .map((spec) => {
      const [x0, z0, x1, z1] = spec.doorway || spec.obstacle;
      return new THREE.Box3(world(x0, 0, z0), world(x1, 2, z1));
    });
}
function toggleInteractive(id) {
  const spec = interactives.find((x) => x.id === id);
  if (!spec) return;
  if (spec.dimmer) {
    // Luz regulable: al pulsarla solo se apaga o vuelve a la intensidad que tenía; la intensidad
    // se elige con su deslizador en «Luces de la casa».
    const now = targetOf(spec);
    if (now > 0.001) spec.dimmer = now;
    openState[id] = now > 0.001 ? 0 : spec.dimmer === true ? 1 : spec.dimmer;
  } else if (spec.levels) {
    // Cada pulsación pasa a la posición siguiente: abierto → a medias → cerrado → abierto.
    // Desde una posición intermedia cualquiera (un regulador) sube a la siguiente; al final, a 0.
    openState[id] = spec.levels.find((level) => level > targetOf(spec) + 0.001) ?? spec.levels[0];
  } else openState[id] = !isOpen(spec);
  // Hojas correderas del mismo armario: al abrir una se cierra la otra, porque se solapan.
  if (openState[id] && spec.exclusive)
    for (const other of interactives)
      if (other !== spec && other.exclusive === spec.exclusive) openState[other.id] = false;
  updateClosedDoors();
  syncLampControls();
}
function animateInteractives(dt) {
  let moving = false;
  for (const spec of interactives) {
    const target = targetOf(spec);
    if (Math.abs(target - spec.value) < 0.002) continue;
    spec.value += (target - spec.value) * Math.min(1, dt * 7);
    if (Math.abs(target - spec.value) < 0.002) spec.value = target;
    applyInteractive(spec);
    moving = true;
  }
  // Mientras algo se mueve cambia la luz: sombras del sol y claridad de cada estancia.
  if (moving) updateDaylight();
  if (moving) renderer.shadowMap.needsUpdate = true;
}
// Puertas de paso. `hinge` es la bisagra (x, z) en el plano; la hoja cerrada va hacia +x.
// Sentido de apertura tomado del croquis y, en la entrada, de la foto (manilla del lado de
// la ventana); ninguno está comprobado en el piso.
const DOORS = [
  // `flip`: la hoja cerrada va hacia −x. La del dormitorio 1 abre contra la pared derecha (foto).
  { id: 'door-bed1', hinge: [2.58, 3.77], width: 0.56, flip: true, open: -Math.PI / 2, startsOpen: true },
  { id: 'door-bed2', hinge: [2.8, 3.77], width: 0.71, open: Math.PI / 2, startsOpen: true },
  { id: 'door-kitchen', hinge: [5.07, 3.77], width: 0.68, open: Math.PI / 2, startsOpen: true },
  { id: 'door-bath', hinge: [4.79, 4.72], width: 0.63, open: -1.25, startsOpen: true },
  // `exit`: aunque se abra, no se puede salir andando del piso.
  { id: 'door-entry', hinge: [2.75, 7.3], width: 0.76, open: Math.PI / 2, dark: true, exit: true },
];
function addDoors() {
  const h = Math.min(2.04, inside ? 2.6 : state.walls);
  for (const door of DOORS) {
    const leaf = new THREE.Group(),
      w = door.width - 0.012,
      dir = door.flip ? -1 : 1,
      mat = door.dark ? mats.dark : mats.white;
    leaf.position.set(door.hinge[0], 0, door.hinge[1]);
    model.add(leaf);
    const panel = box(dir * (w / 2 + 0.006), h / 2, 0, w, h, 0.04, mat, leaf);
    panel.userData.nonSolid = true;
    if (h > 1.05)
      for (const dz of [-0.035, 0.035]) {
        const handle = box(dir * (w - 0.07), 1.02, dz, 0.11, 0.02, 0.022, mats.metal, leaf);
        handle.userData.nonSolid = true;
      }
    const x0 = door.hinge[0] - (door.flip ? door.width : 0);
    registerInteractive({
      ...door,
      kind: 'hinge',
      object: leaf,
      doorway: [x0, door.hinge[1] - 0.12, x0 + door.width, door.hinge[1] + 0.12],
    });
  }
  addBuiltInWardrobe();
  addBalconyDoor();
  addShutters();
}
// Puerta del balcón del dormitorio 1 (foto de la tasación): una sola hoja acristalada abatible,
// de unos 75 cm, con persiana. Posición en la pared, ancho y lado de las bisagras son
// estimados: en la foto no se distinguen.
function addBalconyDoor() {
  const h = Math.min(2.08, inside ? 2.6 : state.walls);
  if (h < 0.3) return;
  const quiet = (m) => ((m.userData.nonSolid = true), m),
    leaf = new THREE.Group(),
    w = 0.73;
  leaf.position.set(1.89, 0, -0.1);
  model.add(leaf);
  quiet(box(-w / 2, h / 2, 0, w - 0.1, h - 0.12, 0.012, mats.glass, leaf));
  for (const x of [-0.03, -w + 0.03]) quiet(box(x, h / 2, 0, 0.06, h, 0.045, mats.white, leaf));
  quiet(box(-w / 2, 0.04, 0, w, 0.08, 0.045, mats.white, leaf));
  if (h >= 2.08) quiet(box(-w / 2, h - 0.03, 0, w, 0.06, 0.045, mats.white, leaf));
  if (h > 1.1) quiet(box(-w + 0.05, 1.02, 0.04, 0.02, 0.13, 0.03, mats.metal, leaf));
  registerInteractive({
    id: 'door-balcony',
    kind: 'hinge',
    object: leaf,
    open: 1.45,
    doorway: [1.15, -0.24, 1.9, 0],
  });
}
// Persianas enrollables existentes (fotos de la tasación) en la puerta del balcón y en las
// ventanas del dormitorio 2 y la cocina. Se bajan pulsando su cajón, encima del hueco: cada
// pulsación pasa de subida a media altura y a bajada, y oscurecen la estancia casi del todo.
function addShutters() {
  if (!inside) return;
  const slats = new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.7 });
  for (const [id, room, x0, x1, sill, head] of [
    ['shutter-bed1', 'bed1', 1.15, 1.9, 0, 2.1],
    ['shutter-bed2', 'bed2', 3.2, 4.3, 0.88, 2.18],
    ['shutter-kitchen', 'kitchen', 5.22, 5.98, 0.88, 2.18],
  ]) {
    const curtain = new THREE.Group(),
      drop = box((x0 + x1) / 2, -(head - sill) / 2, 0, x1 - x0, head - sill, 0.012, slats, curtain),
      housing = box((x0 + x1) / 2, head + 0.1, 0.03, x1 - x0 + 0.1, 0.19, 0.06, mats.white);
    curtain.position.set(0, head, -0.19);
    model.add(curtain);
    drop.userData.nonSolid = housing.userData.nonSolid = true;
    registerInteractive({
      id,
      kind: 'custom',
      object: drop,
      levels: [0, 0.5, 1],
      shade: room,
      blocks: 0.97,
      apply: (v) => {
        curtain.scale.y = Math.max(0.02, v);
        drop.castShadow = v > 0.1;
      },
    });
    housing.userData.toggleId = id;
  }
}
// Armario empotrado existente del dormitorio 1 (foto): hueco de 170 × 50 cm en la pared del fondo
// con dos hojas correderas blancas y una franja de madera a media altura. Las hojas se abren al
// pulsarlas (al abrir una se cierra la otra) y dejan ver balda, barra y ropa.
function addBuiltInWardrobe() {
  const cut = inside ? 2.6 : state.walls,
    h = Math.min(2.08, cut),
    quiet = (m) => ((m.userData.nonSolid = true), m);
  quiet(box(0.85, h / 2, 4.33, 1.68, h, 0.012, mats.white));
  if (cut > 1.9) {
    quiet(box(0.85, 1.82, 4.09, 1.68, 0.02, 0.46, mats.white));
    quiet(box(0.85, 1.72, 4.09, 1.6, 0.02, 0.02, mats.metal));
  }
  const clothes = [mats.dark, mats.linen, mats.green, mats.oak, mats.cabinet, mats.tile];
  for (let i = 0, x = 0.12; x < 1.6; x += 0.085, i++) {
    const len = Math.min(1.0 - (i % 3) * 0.08, h - 0.2);
    if (len > 0.2)
      quiet(box(x, Math.min(1.7, h) - len / 2, 4.09, 0.04, len, 0.4, clothes[i % clothes.length]));
  }
  // Nadie entra andando en el armario, esté abierto o cerrado.
  box(0.85, 1, 3.85, 1.7, 2, 0.1, mats.white).visible = false;
  [
    [0.43, 3.79, 1],
    [1.27, 3.82, -1],
  ].forEach(([x, z, dir], k) => {
    const leaf = new THREE.Group();
    model.add(leaf);
    quiet(box(x, h / 2 + 0.01, z, 0.86, h - 0.02, 0.022, mats.white, leaf));
    if (h > 1.2) quiet(box(x, 1.08, z - 0.012, 0.86, 0.17, 0.004, mats.oak, leaf));
    quiet(
      box(
        x + dir * 0.4,
        Math.min(1.08, h / 2),
        z - 0.014,
        0.012,
        Math.min(0.5, h - 0.1),
        0.006,
        mats.metal,
        leaf,
      ),
    );
    registerInteractive({
      id: `bed1-builtin-${k}`,
      exclusive: 'bed1-builtin',
      kind: 'slide',
      object: leaf,
      axis: 'x',
      distance: dir * 0.8,
    });
  });
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
  addDoors();
  addExterior();
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
  // Aire acondicionado existente sobre la ventana del dormitorio 2 (foto del piso); posición aproximada.
  if (inside) box(3.75, 2.44, 0.11, 0.8, 0.27, 0.2, mats.white);
  // Y otro en el dormitorio 1, arriba a la izquierda de la puerta del balcón (foto de la tasación).
  if (inside) box(0.72, 2.36, 0.11, 0.8, 0.27, 0.2, mats.white);
  // Kitchen splashback, extraction hood and a warm under-cabinet strip.
  box(6.375, 1.18, 1.445, 0.012, 0.6, 2.89, mats.marble || mats.tile);
  if (inside) {
    box(6.13, 1.69, 1.92, 0.48, 0.06, 0.6, mats.metal);
    // Dos enchufes en el frente de azulejo, entre el fregadero y la placa (foto).
    box(6.366, 1.12, 1.4, 0.012, 0.085, 0.16, mats.white);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffecd2,
      emissive: 0xffdab2,
      emissiveIntensity: 1.2,
    });
    mats.strip = stripMat;
    // La tira bajo los muebles altos alumbra de verdad la encimera (dos puntos de luz).
    stripLights = [1.0, 2.3].map((z) => {
      const l = new THREE.PointLight(0xfff4e6, 0, 1.9, 2);
      l.position.set(6.2, 1.4, z);
      model.add(l);
      return l;
    });
    box(6.34, 1.47, 1.755, 0.03, 0.012, 2.27, stripMat);
  }
  // Flush ceiling luminaires, using warm local illumination rather than an open roof.
  if (inside) {
    // Un plafón por estancia (genéricos, sin producto); cada uno se enciende por separado,
    // pulsándolo o desde «Luces de la casa». El de la cocina lleva también la tira bajo los muebles.
    for (const [x, z, power, id, fillAt] of [
      // Potencia proporcionada a la superficie de cada estancia: la misma lámpara deslumbra en
      // la cocina (5 m², paredes blancas a 70 cm) y se queda corta en un dormitorio.
      [1.3, 1.85, 12, 'lamp-bed1', [2.05, 1.5, 3.1]],
      [3.79, 1.85, 10, 'lamp-bed2', [3.25, 1.5, 3.1]],
      [5.38, 1.85, 6.5, 'lamp-kitchen'],
      [5.2, 5.8, 4.5, 'lamp-bath'],
      [4.9, 4.2, 5, 'lamp-hall'],
    ]) {
      const glow = new THREE.MeshStandardMaterial({
          color: 0xfff6e8,
          emissive: 0xffe6c4,
          emissiveIntensity: 0,
        }),
        rim = cylinder(x, 2.565, z, 0.13, 0.035, mats.white),
        disc = cylinder(x, 2.54, z, 0.11, 0.012, glow),
        // Punto de luz con sombras justo bajo el techo: las paredes y las puertas cerradas la
        // cortan, así que solo sale de la estancia por los huecos abiertos. Apagada no se calcula.
        light = roomLamp(0xffedda, x, 2.45, z),
        // En las estancias grandes, una segunda luz más débil desde otro punto, también con
        // sombras: hace de luz rebotada en las paredes, para que la sombra de un mueble no quede
        // negra, y tampoco atraviesa tabiques.
        fill = fillAt && !LOW_POWER && roomLamp(0xfff1e2, ...fillAt),
        // Y un resplandor muy corto a ras de suelo, sin sombras: aclara el suelo y los bajos de
        // los muebles, que es donde se juntan las sombras de las otras dos. Su alcance (1,9 m)
        // apenas pasa de los tabiques.
        low = fillAt && floorGlow(x, z);
      registerInteractive({
        id,
        kind: 'custom',
        object: disc,
        apply: (v) => {
          light.intensity = power * 0.5 * v;
          light.visible = v > 0.001;
          if (fill) {
            fill.intensity = power * 0.16 * v;
            fill.visible = light.visible;
          }
          // Sin la luz de relleno, el resplandor del suelo sube un poco para compensar.
          if (low) low.intensity = power * (fill ? 0.06 : 0.11) * v;
          glow.emissiveIntensity = 1.6 * v;
          if (id === 'lamp-kitchen' && mats.strip) {
            mats.strip.emissiveIntensity = 1.2 * v;
            for (const l of stripLights) l.intensity = 0.9 * v;
          }
        },
      });
      rim.userData.toggleId = id;
    }
    // Salón: panel LED de techo IKEA JETSTRÖM de 60 × 60 cm (4600 lm, 38 W, de 2200 a 4000 K,
    // regulable), en el punto de luz del centro. Al pulsarlo se enciende o se apaga; la
    // intensidad y el tono se eligen en «Luces de la casa».
    const frame = box(3.25, 2.5725, 5.5, 0.6, 0.055, 0.6, mats.white),
      faceMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0xfff0dc, emissiveIntensity: 0 }),
      face = box(3.25, 2.543, 5.5, 0.56, 0.006, 0.56, faceMat),
      panelLight = roomLamp(0xfff0dc, 3.25, 2.45, 5.5),
      panelFill = LOW_POWER ? new THREE.PointLight(0xfff0dc, 0, 0.01) : roomLamp(0xfff0dc, 3.7, 1.5, 4.5),
      panelLow = floorGlow(3.25, 5.5);
    frame.userData.product = face.userData.product = 'ceilinglight';
    frame.castShadow = face.castShadow = false;
    registerInteractive({
      id: 'living-light',
      kind: 'custom',
      object: face,
      dimmer: true,
      apply: (v) => {
        panelLight.intensity = 9 * v;
        panelLight.visible = v > 0.001;
        panelFill.intensity = 2.6 * v;
        panelLow.intensity = 0.8 * v;
        panelFill.visible = panelLight.visible;
        panelFill.color.copy(lampColor(lampTone));
        panelLight.color.copy(lampColor(lampTone));
        faceMat.emissive.copy(lampColor(lampTone));
        faceMat.emissiveIntensity = 2.2 * v;
      },
    });
    frame.userData.toggleId = 'living-light';
  }
}
// Exterior visto desde el balcón y las ventanas: los edificios vecinos como volúmenes con sus
// alturas (plantas del Catastro × 3 m), la calle y el resto del propio edificio por debajo y por
// encima del piso. Los datos están en exterior.json, que es privado y opcional: sin él no se
// dibuja nada. Solo en el recorrido; no dan sombra (de eso se encarga SKYLINE).
let exterior = null;
let facadeMap = null;
function addExterior() {
  if (!inside || !exterior) return;
  if (!facadeMap) {
    // Un vano de 3 × 3 m: paño de fachada con una ventana oscura y su marco.
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#e6e2da';
    g.fillRect(0, 88, 96, 8);
    g.fillStyle = '#d9d5cc';
    g.fillRect(31, 24, 34, 42);
    g.fillStyle = '#4a555e';
    g.fillRect(33, 26, 30, 38);
    g.fillStyle = '#687580';
    g.fillRect(33, 26, 14, 38);
    facadeMap = bakeTexture(c);
    facadeMap.wrapS = facadeMap.wrapT = THREE.RepeatWrapping;
    facadeMap.repeat.set(1 / 3, 1 / 3);
    facadeMap.colorSpace = THREE.SRGBColorSpace;
  }
  const tones = ['#c2ad96', '#d2c5b2', '#a9836b', '#ddd5c6', '#b48f76', '#cbbfae'],
    // Algo de luz propia: las fachadas de enfrente están a contraluz por la mañana y, sin ella,
    // quedarían negras (aquí no hay luz rebotada de la calle).
    walls = tones.map(
      (color) =>
        new THREE.MeshLambertMaterial({
          color,
          map: facadeMap,
          emissive: color,
          emissiveMap: facadeMap,
          emissiveIntensity: 0.3,
        }),
    ),
    roof = new THREE.MeshLambertMaterial({ color: '#8d7f74', emissive: '#8d7f74', emissiveIntensity: 0.2 }),
    street = -exterior.flatFloor,
    quiet = (mesh) => {
      mesh.userData.nonSolid = true;
      mesh.castShadow = mesh.receiveShadow = false;
      model.add(mesh);
      for (const m of [mesh.material].flat()) m.userData.outdoor ??= m.emissiveIntensity;
      return mesh;
    },
    block = (ring, y0, y1, wall) => {
      if (y1 - y0 < 0.3) return;
      const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z))),
        geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      quiet(new THREE.Mesh(geo, [roof, wall])).position.y = y0;
    };
  exterior.parts.forEach((part, i) => {
    // En móvil solo los edificios de las calles inmediatas: lo de detrás apenas se ve.
    if (LOW_POWER && Math.min(...part.ring.map(([x, z]) => Math.hypot(x - 3.4, z))) > 60) return;
    const top = street + part.floors * exterior.floorHeight,
      wall = walls[Math.round(Math.abs(part.ring[0][0] * 0.11 + part.ring[0][1] * 0.07)) % walls.length];
    if (part.own) {
      // El propio edificio: solo lo que queda por debajo del suelo del piso y por encima del techo.
      block(part.ring, street, -0.2, walls[1]);
      block(part.ring, 2.78, top, walls[1]);
    } else block(part.ring, street, top, wall);
  });
  const ground = quiet(
    new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420),
      new THREE.MeshLambertMaterial({ color: '#a19d94', emissive: '#a19d94', emissiveIntensity: 0.25 }),
    ),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(3, street - 0.02, 0);
  // Calles (trazado de OpenStreetMap): calzada de asfalto sobre el plano de aceras, y coches
  // genéricos aparcados en un lado. Los anchos son supuestos: OSM no los da.
  const lit = (color) => {
      const m = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 });
      m.userData.outdoor = 0.25;
      return m;
    },
    asphalt = lit('#4d4d4c'),
    glass = lit('#2b3238'),
    paints = ['#b9bcc0', '#2f3338', '#e8e6e1', '#7d2b2a', '#31506e', '#8b8f94', '#1d1f22'].map(lit),
    bodyGeo = new THREE.BoxGeometry(4.3, 0.7, 1.75),
    cabinGeo = new THREE.BoxGeometry(2.3, 0.55, 1.6);
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const road of exterior.roads || []) {
    const total = road.width + (road.park ? 1.5 : 0);
    road.line.forEach(([x1, z1], i) => {
      const joint = quiet(
        new THREE.Mesh(new THREE.CylinderGeometry(total / 2, total / 2, 0.02, 20), asphalt),
      );
      joint.position.set(x1, street, z1);
      if (i === road.line.length - 1) return;
      const [x2, z2] = road.line[i + 1],
        length = Math.hypot(x2 - x1, z2 - z1),
        angle = -Math.atan2(z2 - z1, x2 - x1),
        strip = quiet(new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, total), asphalt));
      strip.position.set((x1 + x2) / 2, street, (z1 + z2) / 2);
      strip.rotation.y = angle;
      if (!road.park || Math.hypot((x1 + x2) / 2 - 3.4, (z1 + z2) / 2) > (LOW_POWER ? 40 : 90)) return;
      const ux = (x2 - x1) / length,
        uz = (z2 - z1) / length,
        side = total / 2 - 1;
      for (let at = 7; at < length - 7; at += 5.4) {
        if (random() < 0.2) continue;
        const cx = x1 + ux * at - uz * side,
          cz = z1 + uz * at + ux * side,
          paint = paints[Math.floor(random() * paints.length)];
        for (const [geo, mat, y, shift] of [
          [bodyGeo, paint, 0.5, 0],
          [cabinGeo, glass, 1.1, -0.2],
        ]) {
          const mesh = quiet(new THREE.Mesh(geo, mat));
          mesh.position.set(cx + ux * shift, street + y, cz + uz * shift);
          mesh.rotation.y = angle;
        }
      }
    });
  }
}
fetch('./exterior.json')
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    exterior = data;
    if (data && inside) build();
  })
  .catch(() => {});
// Luz de una lámpara de techo: punto de luz con sombras, apagado (e invisible) al crearse.
function roomLamp(color, x, y, z) {
  const light = new THREE.PointLight(color, 0, 7, 1.8);
  light.position.set(x, y, z);
  light.castShadow = true;
  light.shadow.mapSize.set(LOW_POWER ? 256 : 512, LOW_POWER ? 256 : 512);
  light.shadow.bias = -0.001;
  light.shadow.normalBias = 0.015;
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 8;
  light.visible = false;
  model.add(light);
  return light;
}
function floorGlow(x, z) {
  const light = new THREE.PointLight(0xfff1e2, 0, 1.9, 1);
  light.position.set(x, 0.45, z);
  model.add(light);
  return light;
}
function addDaylight() {
  // Diffuse sky contribution enters at the openings; room brightness is not uniform.
  if (!inside) return;
  // Approximate diffuse bounces from the larger street openings, locally per room.
  for (const [x, z, power, room] of [
    [1.3, 1.5, 4.8, 'bed1'],
    [3.79, 1.5, 3.8, 'bed2'],
    [5.45, 1.5, 2.6, 'kitchen'],
    [3.32, 5.45, 2.1, 'living'],
  ]) {
    const l = new THREE.PointLight(z > 4 ? 0xffefd9 : 0xf1f3f4, power, 4.4, 2);
    l.position.set(x, 1.7, z);
    l.userData.base = power;
    l.userData.room = room;
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
    if (LOW_POWER && power < 1) continue;
    const l = new THREE.SpotLight(0xe6edf5, power, 9, Math.PI * 0.39, 1, 2);
    l.position.set(x, y, z);
    l.target.position.set(tx, 0.65, tz);
    // Solo las dos entradas de luz grandes proyectan sombra: el número de mapas de sombra es limitado.
    l.castShadow = power > 6 && !LOW_POWER;
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
// Perfil del cielo visto desde las ventanas de la fachada: altura (en grados) a la que hay que
// subir la vista para ver por encima de los edificios de enfrente, cada 5° de rumbo desde el
// norte. Calculado con las plantas y el número de pisos de los edificios vecinos del Catastro,
// suponiendo 3 m por piso y las ventanas a 7,2 m de la calle; 90 = detrás de la propia fachada.
// prettier-ignore
const SKYLINE = [6, 5, 5, 6, 6, 6, 5, 5, 4, 5, 4, 10, 10, 12, 13, 20, 23, 23, 22, 22, 19, 18, 19, 23, 27, 28, 25, 22, 19, 16, 12, 6, 7, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 3, 6];
function skylineAt(azimuth) {
  const at = (((azimuth % 360) + 360) % 360) / 5,
    i = Math.floor(at),
    a = SKYLINE[i % 72],
    b = SKYLINE[(i + 1) % 72];
  return a === 90 || b === 90 ? Math.min(a, b) : a + (b - a) * (at - i);
}
// Cuánto sol directo llega a la fachada (0 tapado … 1 despejado), con un margen de 2°.
function sunClear(p) {
  const elevation = (p.elevation * 180) / Math.PI;
  return Math.min(1, Math.max(0, (elevation - skylineAt(p.azimuth)) / 2));
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
    // Los edificios de enfrente tapan el sol bajo: sin sol directo hasta que los supera.
    sun.intensity = p.elevation > 0 ? 2.8 * Math.pow(above, 0.4) * sunClear(p) : 0;
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
  hemi.color.set(inside ? 0xeef2f7 : 0xffffff);
  hemi.groundColor.set(inside ? 0x8e8273 : 0xcfcac2);
  // Con lámparas encendidas, un poco de claridad general hace de luz rebotada: la estancia de
  // al lado queda en penumbra en vez de en negro. Es muy poca y no distingue estancias.
  const lampsOn = interactives.reduce(
    (sum, spec) => sum + (/^lamp-|^living-light$/.test(spec.id) ? spec.value : 0),
    0,
  );
  hemi.intensity = inside ? 0.025 + 0.4 * sky + Math.min(0.1, 0.035 * lampsOn) : 2.2;
  fill.intensity = inside ? 0 : 0.45;
  scene.background.set(inside ? (sky > 0.3 ? '#aebfcb' : '#293541') : '#e9ece4');
  // Claridad difusa de cada estancia: baja con su cortina o estor corridos. El salón apenas
  // tiene ventana y la recibe de los dormitorios y la cocina a través de sus puertas, así que
  // depende de que estén abiertas y de que esas estancias no estén a oscuras.
  const doorOpen = (id) => interactives.find((spec) => spec.id === id)?.value ?? 1,
    // Persiana y cortina de una misma estancia se combinan: cada una deja pasar su parte.
    lit = (room) =>
      Object.values(shade).reduce(
        (light, [where, blocked]) => (where === room ? light * (1 - blocked) : light),
        1,
      ),
    living =
      0.3 +
      0.7 *
        ((doorOpen('door-bed1') * lit('bed1') +
          doorOpen('door-bed2') * lit('bed2') +
          doorOpen('door-kitchen')) /
          3);
  // Fachadas y calle llevan algo de luz propia de día; de noche se apaga casi del todo.
  model.traverse((o) => {
    for (const m of o.isMesh ? [o.material].flat() : [])
      if (m.userData.outdoor) m.emissiveIntensity = m.userData.outdoor * (0.06 + 0.94 * sky);
  });
  for (const l of skyLights) {
    const room = l.userData.room;
    l.intensity = l.userData.base * sky * (room === 'living' ? living : room ? lit(room) : 1);
  }
  // Imagen de un proyector: con luz de día en la estancia se ve lavada; a oscuras, entera.
  for (const spec of interactives)
    if (spec.screen)
      spec.image.material.opacity =
        spec.value * (inside ? Math.max(0.12, 1 - 0.9 * lit(spec.screen) * sky) : 0.9);
  const compass = ['norte', 'nordeste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'][
      Math.round(p.azimuth / 45) % 8
    ],
    onFacade = p.elevation > 0 && Math.cos(delta) > 0;
  $('sunInfo').textContent =
    p.elevation <= 0
      ? 'Es de noche.'
      : `Sol al ${compass}, a ${((p.elevation * 180) / Math.PI).toFixed(0)}° de altura: ${
          !onFacade
            ? 'ya no da en la fachada'
            : sunClear(p) < 0.5
              ? 'lo tapan los edificios de enfrente'
              : 'da en la fachada de dormitorios y cocina'
        }.`;
  // Una luz a cero se sigue calculando en cada píxel: se desactiva mientras no alumbra.
  model.traverse((o) => {
    if (o.isPointLight || o.isSpotLight) o.visible = o.intensity > 0.0005;
  });
  $('dayHourValue').textContent =
    `${String(Math.floor(daylight.hour)).padStart(2, '0')}:${daylight.hour % 1 ? '30' : '00'} Madrid`;
  renderer.shadowMap.needsUpdate = true;
}
for (const [id, key] of [
  ['dayDate', 'date'],
  ['dayHour', 'hour'],
]) {
  $(id).value = daylight[key];
  $(id).oninput = (e) => {
    if (key === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
    daylight[key] = key === 'date' ? e.target.value : Number(e.target.value);
    updateDaylight();
  };
}
// «Luces de la casa»: cada luz es una pieza pulsable más; aquí se encienden, se apagan y se
// regulan sin tener que apuntarles. El panel del salón y la tira son regulables; el resto, no.
const LAMPS = [
  { id: 'living-light', name: 'Salón · panel del techo', dim: true },
  { id: 'living-strip', name: 'Salón · tira tras la tele', dim: true },
  { id: 'lamp-hall', name: 'Paso' },
  { id: 'lamp-bed1', name: 'Dormitorio 1' },
  { id: 'lamp-bed2', name: 'Dormitorio 2' },
  { id: 'lamp-kitchen', name: 'Cocina' },
  { id: 'lamp-bath', name: 'Baño' },
];
const lampLevel = (id) => (typeof openState[id] === 'number' ? openState[id] : openState[id] ? 1 : 0);
for (const lamp of LAMPS) {
  const row = document.createElement('label');
  row.className = lamp.dim ? 'lamp-row dim' : 'lamp-row check';
  const input = document.createElement('input');
  input.id = `lamp-${lamp.id}`;
  if (lamp.dim) {
    Object.assign(input, { type: 'range', min: 0, max: 100, step: 1, value: 0 });
    const out = document.createElement('output');
    row.append(lamp.name + ' ', out, input);
    input.oninput = () => {
      openState[lamp.id] = input.value / 100;
      out.textContent = input.value > 0 ? `${input.value} %` : 'apagada';
    };
  } else {
    input.type = 'checkbox';
    row.append(input, ' ' + lamp.name);
    input.onchange = () => (openState[lamp.id] = input.checked ? 1 : 0);
  }
  $('lampList').append(row);
}
function syncLampControls() {
  for (const lamp of LAMPS) {
    const input = $(`lamp-${lamp.id}`),
      level = lampLevel(lamp.id);
    if (!input) continue;
    if (lamp.dim) {
      input.value = Math.round(level * 100);
      input.previousElementSibling.textContent = level > 0 ? `${input.value} %` : 'apagada';
    } else input.checked = level > 0;
  }
}
syncLampControls();
for (const [button, level] of [
  ['lampsOn', 1],
  ['lampsOff', 0],
]) {
  $(button).onclick = () => {
    for (const lamp of LAMPS) openState[lamp.id] = level;
    syncLampControls();
  };
}
$('lampTone').oninput = (e) => {
  lampTone = Number(e.target.value);
  $('lampToneValue').textContent =
    `${lampTone} K · ${lampTone < 2500 ? 'muy cálida' : lampTone < 3100 ? 'cálida' : lampTone < 3600 ? 'neutra' : 'fría'}`;
  const panel = interactives.find((spec) => spec.id === 'living-light');
  if (panel) applyInteractive(panel);
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
  showProduct(null);
  posture = null;
  avatar.visible = true;
  document.body.classList.remove('seated');
  $('standUp').hidden = true;
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
  for (const b of [...colliders, ...closedDoors]) {
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
// Sentarse y tumbarse: al tocar un asiento o una cama en el recorrido, su ficha ofrece hacerlo.
// Cada mueble se usa como en la realidad, no «donde estabas mirando»:
//  · sofá: sentado contra el respaldo, de cara a la tele. Tumbarse solo con el arrastre sacado
//    («Tele tumbados»: recostado hacia la tele) o hecho cama («Noche»: a lo largo, 128 × 190);
//  · camas: sentado contra el cabecero o tumbado con la cabeza en la almohada, mirando a los pies;
//  · sillas: en el asiento, de cara a donde mira la silla;
//  · pufs y sillas de suelo: de cara a la tele.
// Cualquier flecha (o «Levantarse») te pone de pie donde estabas.
const SEATS = [
  'sofa',
  'chair',
  'foldchair',
  'pouf',
  'floorchair',
  'bed',
  'mattress',
  'bed1-bed',
  'bed1-mattress',
];
let posture = null,
  seatHit = null;
const sofaOpen = () => ['lounge', 'bed'].includes(state.livingLayout);
// Un mueble abierto no se usa: con el canapé levantado no hay cama, y la silla plegable solo
// existe como asiento cuando está desplegada (entonces tiene `seat`; plegada contra la pared, no).
const pieceOpen = (id) => {
  const spec = interactives.find((x) => x.id === id);
  return Boolean(spec) && isOpen(spec);
};
const canSit = (hit) => {
  if (hit.root?.userData.seat.kind === 'bed') return !pieceOpen(hit.toggle);
  if (['chair', 'foldchair'].includes(hit.id)) return Boolean(hit.root);
  return ['sofa', 'pouf', 'floorchair'].includes(hit.id);
};
const canLie = (hit) =>
  hit.root?.userData.seat.kind === 'bed' ? !pieceOpen(hit.toggle) : hit.id === 'sofa' && sofaOpen();
// Texto del botón de una pieza que se abre o se enciende, según lo que sea y cómo esté.
function toggleLabel(id) {
  const on = isOpen(interactives.find((spec) => spec.id === id) || { id }),
    words = /^(tv|bed1-projector|living-)/.test(id)
      ? ['Encender', 'Apagar']
      : /canape/.test(id)
        ? ['Abrir el arcón', 'Cerrar el arcón']
        : /-desk$/.test(id)
          ? ['Abrir mesa y silla', 'Recoger mesa y silla']
          : ['Abrir', 'Cerrar'];
  return words[on ? 1 : 0];
}
let cardToggle = null;
const facing = (dx, dz) => Math.atan2(-dx, -dz);
function takeSeat(lying) {
  if (!seatHit) return;
  const k = state.scale / 100,
    seat = seatHit.root?.userData.seat,
    at = seatHit.point,
    local = model.worldToLocal(at.clone()); // punto tocado, en metros del plano
  let eye,
    look,
    tilt = lying ? 0.2 : -0.05;
  if (seat?.kind === 'bed') {
    // Almohada más cercana al punto tocado; los pies quedan hacia el centro de la cama.
    const pillows = seat.pillows.map((p) => p.getWorldPosition(new THREE.Vector3())),
      head = pillows.sort((a, b) => a.distanceTo(at) - b.distanceTo(at))[0],
      centre = seatHit.root.getWorldPosition(new THREE.Vector3()),
      dir = new THREE.Vector3(
        centre.x - (pillows[0].x + pillows[1].x) / 2,
        0,
        centre.z - (pillows[0].z + pillows[1].z) / 2,
      ).normalize();
    // Tumbado: cabeza sobre la almohada, ojos por encima del nórdico. Sentado: espalda en el
    // cabecero, ojos 55 cm por encima de la almohada.
    eye = lying
      ? new THREE.Vector3(head.x + dir.x * 0.1 * k, head.y + 0.22 * k, head.z + dir.z * 0.1 * k)
      : new THREE.Vector3(head.x + dir.x * 0.08 * k, head.y + 0.55 * k, head.z + dir.z * 0.08 * k);
    look = facing(dir.x, dir.z);
  } else if (seat?.kind === 'chair') {
    const front = new THREE.Vector3(0, 0, -1).applyQuaternion(
        seatHit.root.getWorldQuaternion(new THREE.Quaternion()),
      ),
      centre = seatHit.root.getWorldPosition(new THREE.Vector3());
    eye = new THREE.Vector3(centre.x, 1.23 * k, centre.z);
    look = facing(front.x, front.z);
  } else if (seatHit.id === 'sofa') {
    const z = Math.max(4.87, Math.min(6.56, local.z));
    if (lying && state.livingLayout === 'bed') {
      // Hecho cama: se duerme a lo largo del sofá, con la cabeza en el extremo más cercano.
      const headNorth = local.z < 5.715;
      eye = world(3.9, 0.62, headNorth ? 4.95 : 6.48);
      look = facing(0, headNorth ? 1 : -1);
      tilt = 0.3;
    } else {
      // Espalda en el respaldo; recostado, la cabeza baja y se va hacia atrás.
      eye = world(lying ? 4.32 : 4.22, lying ? 0.88 : 1.2, z);
      look = facing(-1, 0);
      tilt = lying ? 0.02 : -0.04;
    }
  } else {
    // Puf o silla de suelo: en el punto tocado, de cara a la pared de la tele.
    eye = new THREE.Vector3(at.x, (seatHit.id === 'floorchair' ? 0.85 : 1.16) * k, at.z);
    look = facing(-1, 0);
  }
  posture = { x: eye.x, y: eye.y, z: eye.z };
  yaw = look;
  pitch = tilt;
  walker.stop();
  avatar.visible = false; // el cuerpo se queda donde estabas de pie: no debe verse delante
  showProduct(null);
  document.body.classList.add('seated');
  $('standUp').hidden = false;
}
function standUp() {
  posture = null;
  avatar.visible = true;
  document.body.classList.remove('seated');
  $('standUp').hidden = true;
  yaw = walker.yaw;
  pitch = -0.1;
}
function stepWalk(dt) {
  if (posture) {
    if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].some((key) => keys.has(key))) standUp();
    else {
      camera.position.set(posture.x, posture.y, posture.z);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      return;
    }
  }
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
  lookY = 0,
  pinchAt = 0;
// Pellizco con dos dedos en el recorrido: acerca o aleja la imagen (zoom óptico, de 25° a 80°).
{
  const fingers = new Map();
  let startGap = 0,
    startFov = 65;
  const gap = () => {
    const [a, b] = [...fingers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!inside || e.pointerType !== 'touch') return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      startGap = gap();
      startFov = camera.fov;
      dragging = false;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {}
    }
  });
  document.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size !== 2 || !startGap) return;
    pinchAt = performance.now();
    camera.fov = Math.max(25, Math.min(80, (startFov * startGap) / gap()));
    camera.updateProjectionMatrix();
  });
  const lift = (e) => {
    if (!fingers.delete(e.pointerId)) return;
    startGap = 0;
    // Al soltar un dedo, el que queda no debe dar un salto de cámara ni contar como toque.
    lookPointer = null;
    dragging = false;
    if (fingers.size) pinchAt = performance.now();
  };
  document.addEventListener('pointerup', lift);
  document.addEventListener('pointercancel', lift);
}
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
  if (performance.now() - pinchAt < 120) return;
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
// En el recorrido, el panel de disposiciones muestra solo las de la estancia donde estás.
const ROOM_NAMES = {
  living: 'Salón',
  bed1: 'Dormitorio 1',
  bed2: 'Dormitorio 2',
  kitchen: 'Cocina',
  bath: 'Baño',
  balcony: 'Balcón',
};
function roomAt(wx, wz) {
  const k = state.scale / 100,
    x = wx / k + 3.19,
    z = wz / k + 3.62;
  if (z < -0.06 && x < 2.1) return 'balcony';
  if (z < 3.77) return x < 2.67 ? 'bed1' : x < 4.91 ? 'bed2' : 'kitchen';
  return x > 4.67 && z > 4.72 ? 'bath' : 'living';
}
let menuRoom = null;
function showRoomMenu() {
  const room = roomAt(walker.x, walker.z);
  if (room === menuRoom) return;
  menuRoom = room;
  let any = false;
  for (const el of document.querySelectorAll('.layout-group')) {
    el.hidden = el.dataset.room !== room;
    any ||= !el.hidden;
  }
  // El menú solo aparece donde hay algo que elegir; el nombre de la estancia ya está arriba.
  $('roomMenuTitle').textContent = 'Distribución';
  document.querySelector('.walking-options').hidden = !any;
  $('noLayouts').hidden = any;
}
// Cada estancia con varias disposiciones tiene un desplegable en el panel lateral y un grupo de
// botones en el recorrido; los dos salen de la misma lista y se mantienen sincronizados.
const layoutGroups = [
  {
    key: 'livingLayout',
    list: LAYOUTS,
    select: 'livingLayoutPlan',
    buttons: 'layoutButtons',
    note: 'layoutNote',
    start: 'livingDecor',
  },
  {
    key: 'bed1Layout',
    list: BED1_LAYOUTS,
    select: 'bed1LayoutPlan',
    buttons: 'bed1Buttons',
    note: 'bed1Note',
    start: 'bed1',
  },
  {
    key: 'bed2Layout',
    list: BED2_LAYOUTS,
    select: 'bed2LayoutPlan',
    buttons: 'bed2Buttons',
    note: 'bed2Note',
    start: 'bed2',
  },
];
function showLayout() {
  for (const group of layoutGroups) {
    $(group.select).value = state[group.key];
    for (const b of $(group.buttons).children)
      b.classList.toggle('active', b.dataset.layout === state[group.key]);
    $(group.note).textContent = group.list.find((l) => l.id === state[group.key]).note;
  }
}
function setLayout(id, group = layoutGroups[0]) {
  state[group.key] = id;
  state.furniture = true;
  $('furniture').checked = true;
  showLayout();
  build();
  if (inside && !canStand(walker.x, walker.z)) enterWalk(group.start);
}
for (const group of layoutGroups) {
  for (const { id, name } of group.list) {
    $(group.select).append(new Option(name, id));
    const button = document.createElement('button');
    button.dataset.layout = id;
    button.textContent = name;
    button.onclick = () => {
      setLayout(id, group);
      button.blur();
      if (inside) renderer.domElement.focus({ preventScroll: true });
    };
    $(group.buttons).append(button);
  }
  $(group.select).onchange = (e) => {
    setLayout(e.target.value, group);
    e.target.blur();
  };
}
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
  const listed = PRODUCTS.filter((p) => !p.optional),
    total = listed.reduce((sum, p) => sum + lineTotal(p), 0);
  $('shoppingTotal').textContent = euro(Math.round(total));
  for (const seller of [...new Set(listed.map((p) => p.seller))]) {
    const items = listed.filter((p) => p.seller === seller);
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
      detail.textContent = [p.room, p.dims, p.qty ? `${euro(p.price)} cada uno` : '', p.note]
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
  if (!p) cardToggle = null;
  const seat = p && inside && seatHit && seatHit.id === id,
    sit = seat && canSit(seatHit),
    lie = seat && canLie(seatHit),
    toggle = p && cardToggle;
  $('sitHere').hidden = !sit;
  $('lieHere').hidden = !lie;
  $('toggleHere').hidden = !toggle;
  if (toggle) $('toggleHere').textContent = toggleLabel(cardToggle);
  $('productActions').hidden = !(sit || lie || toggle);
  $('productCard').dataset.product = p ? id : '';
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
  // Se usa `click` y no `pointerup`: en pantallas táctiles un toque corto llega siempre como
  // clic, aunque el navegador no entregue el par pulsar/soltar. Con ratón, un arrastre también
  // acaba en clic, así que se descarta si el puntero se movió.
  canvas.addEventListener('click', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    down = null;
    if (performance.now() - pinchAt < 350) return;
    const rect = canvas.getBoundingClientRect(),
      point = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    raycaster.setFromCamera(point, camera);
    // Visible de verdad: ni la pieza ni ningún grupo que la contenga están ocultos (la silla
    // plegable desplegada, por ejemplo, sigue en la escena pero oculta mientras está recogida).
    const shown = (o) => {
      for (; o; o = o.parent) if (!o.visible) return false;
      return true;
    };
    const hit = raycaster.intersectObject(model, true).find((h) => shown(h.object));
    let productId = null,
      toggleId = null;
    for (let o = hit && hit.object; o && o !== model; o = o.parent) {
      productId ??= o.userData.product;
      toggleId ??= o.userData.toggleId;
    }
    // Si lo tocado tiene ficha, no se abre ni se enciende solo: la ficha ofrece cada acción por
    // separado (abrir, sentarse, tumbarse). Así tocar una cama para sentarte no levanta el
    // canapé. Lo que no tiene ficha (puertas, persianas, lámparas) responde al toque directo.
    if (toggleId && !productId) toggleInteractive(toggleId);
    cardToggle = productId ? toggleId : null;
    let seatRoot = null;
    for (let o = hit && hit.object; o && o !== model; o = o.parent) if (o.userData.seat) seatRoot ??= o;
    seatHit =
      hit && SEATS.includes(productId)
        ? { id: productId, point: hit.point.clone(), root: seatRoot, toggle: toggleId }
        : null;
    showProduct(productId);
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
    } else if (fps > 50 && qualityScale < Math.min(devicePixelRatio, 1.25)) {
      // Si vuelve a ir sobrado (por ejemplo, al apagar luces), recupera nitidez poco a poco.
      qualityScale = Math.min(devicePixelRatio, 1.25, qualityScale + 0.15);
      renderer.setPixelRatio(qualityScale);
      size();
    }
    qualityTime = 0;
    qualityFrames = 0;
  }
  if (inside) stepWalk(dt);
  else controls.update();
  animateInteractives(dt);
  if (inside) showRoomMenu();
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
  // Para pruebas: orienta la mirada del recorrido (cabeceo y giro, en radianes).
  look: (newPitch, newYaw) => {
    pitch = newPitch;
    yaw = walker.yaw = newYaw;
  },
  solarState,
  sunClear,
  state,
  rooms,
  baseArea: BASE_AREA,
  scene,
  renderer,
  camera,
  controls,
  enterWalk,
  setLayout,
  layoutGroups,
  toggleInteractive,
  get interactives() {
    return interactives;
  },
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
    // En pantallas pequeñas un menú abierto ocupa casi todo: se cierra la ficha de producto.
    if (panel.open) showProduct(null);
    if (panel.open)
      for (const other of document.querySelectorAll('.walking-options,.daylight-panel'))
        if (other !== panel) other.open = false;
  });
// En pantallas pequeñas el menú de la estancia empieza recogido (tapaba media imagen) y un botón
// sobre la maqueta lleva directo al recorrido; al volver a la maqueta se cierra la ficha abierta.
if (matchMedia('(max-width: 850px), (pointer: coarse)').matches)
  document.querySelector('.walking-options').open = false;
$('insideQuick').onclick = () => $('inside').click();
$('exitWalk').addEventListener('click', () => showProduct(null));
// Mantener pulsada una flecha o la imagen no debe abrir el menú contextual del navegador.
for (const el of [renderer.domElement, ...document.querySelectorAll('[data-walk-key]')])
  el.addEventListener('contextmenu', (e) => e.preventDefault());
$('sitHere').onclick = () => takeSeat(false);
$('lieHere').onclick = () => takeSeat(true);
$('standUp').onclick = standUp;
$('exitWalk').addEventListener('click', () => {
  posture = null;
  document.body.classList.remove('seated');
  $('standUp').hidden = true;
});
$('toggleHere').onclick = () => {
  if (!cardToggle) return;
  const id = cardToggle;
  toggleInteractive(id);
  // La ficha sigue abierta con el botón al revés y, si procede, sin «Sentarse» (arcón abierto).
  cardToggle = id;
  showProduct($('productCard').dataset.product);
};
