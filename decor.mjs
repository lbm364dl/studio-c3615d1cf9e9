import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { Reflector } from './vendor/Reflector.js';

// Textura a partir de un lienzo ya dibujado, guardando los píxeles en memoria propia. No se usa
// CanvasTexture porque Chrome en Android vacía los lienzos 2D de una página que pasa a segundo
// plano; si después hay que volver a subir la textura a la gráfica, saldría negra (y con ella
// todas las telas). Las filas se guardan invertidas: equivale al `flipY` de una textura de lienzo.
export function bakeTexture(canvas) {
  const { width, height } = canvas,
    src = canvas.getContext('2d').getImageData(0, 0, width, height).data,
    data = new Uint8Array(src.length);
  for (let y = 0; y < height; y++)
    data.set(src.subarray(y * width * 4, (y + 1) * width * 4), (height - 1 - y) * width * 4);
  const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Propuesta de muebles, en metros y en las mismas coordenadas que app.js.
// Orden del archivo: materiales y piezas auxiliares · salón · dormitorio 1 · dormitorio 2 · cocina · baño.
// Son piezas conceptuales para probar la distribución, no productos elegidos.
// `layout`: 'daily', 'tv', 'lounge', 'tvfull', 'guests' o 'bed' (lista LAYOUTS en app.js).
function weaveTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) {
    ctx.fillStyle = i % 8 ? '#b5b5b5' : '#949494';
    ctx.fillRect(i, 0, 1, 256);
    ctx.fillStyle = i % 8 ? '#999999' : '#c2c2c2';
    ctx.fillRect(0, i, 256, 1);
  }
  const t = bakeTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7);
  return t;
}
const weave = weaveTexture();
// Veta de roble dibujada a partir de las fotos de producto (primer plano del tablero de la
// TONSTAD): veta recta y muy fina, de poco contraste, con un dibujo ancho y suave por encima y
// poros cortos algo más oscuros. Textura de 1 m × 1 m; la veta corre a lo largo de V (vertical
// en el lienzo) salvo con `alongU`.
//  · `figure`: fuerza del dibujo ancho (bandas suaves de tono).
//  · `contrast`: fuerza de la veta fina y de los poros.
function oakTexture({ figure = 1, contrast = 1, alongU = false, seed = 5 } = {}) {
  const N = 1024,
    c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  ctx.fillStyle = '#f4f0e8';
  ctx.fillRect(0, 0, N, N);
  // Dibujo ancho: bandas difusas a lo largo de la veta, un poco más claras o más tostadas.
  for (let i = 0; i < 26; i++) {
    const x = rnd() * N,
      w = 30 + rnd() * 110,
      g = ctx.createLinearGradient(x - w, 0, x + w, 0),
      tone = rnd() > 0.5 ? '255,252,244' : '196,160,112',
      a = (0.1 + rnd() * 0.16) * figure;
    g.addColorStop(0, `rgba(${tone},0)`);
    g.addColorStop(0.5, `rgba(${tone},${a})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - w, 0, 2 * w, N);
  }
  // Veta fina: muchísimas líneas delgadas, casi rectas; la ondulación es periódica en V.
  for (let i = 0; i < 2600; i++) {
    const x0 = rnd() * N,
      amp = rnd() * 2.2,
      phase = rnd() * 6.283,
      dark = rnd() > 0.4;
    ctx.strokeStyle = dark
      ? `rgba(150,108,62,${(0.03 + rnd() * 0.08) * contrast})`
      : `rgba(255,251,240,${0.05 + rnd() * 0.12})`;
    ctx.lineWidth = 0.5 + rnd() * 0.9;
    ctx.beginPath();
    for (let y = 0; y <= N; y += 32) {
      const x = x0 + amp * Math.sin(phase + (y / N) * 6.283);
      if (y) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // Poros del roble: trazos cortos alineados con la veta.
  for (let i = 0; i < 7000 * contrast; i++) {
    const x = rnd() * N,
      y = rnd() * N,
      len = 3 + rnd() * 11;
    ctx.strokeStyle = `rgba(128,90,48,${0.08 + rnd() * 0.16})`;
    ctx.lineWidth = 0.6 + rnd() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
  const t = bakeTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (alongU) {
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
  }
  return t;
}
// TONSTAD: chapa de roble. La veta va a lo largo del tablero (el lado de 80 → 120 cm), a lo
// largo de cada faldón y a lo alto de las patas, como en las fotos. Una textura por tipo de
// pieza, porque cada geometría reparte sus coordenadas de forma distinta.
// (La losa del tablero reparte sus coordenadas con U a lo largo, de ahí `alongU`.)
const oakTop = oakTexture({ seed: 5, figure: 0.7, contrast: 0.8, alongU: true }),
  oakLeg = oakTexture({ seed: 9, figure: 0.6 }),
  oakApron = oakTexture({ seed: 13, figure: 0.8, alongU: true });
oakLeg.repeat.set(0.16, 0.75);
oakApron.repeat.set(0.08, 0.7);
// BISSA: lámina efecto roble, más pálida, con veta horizontal y bandas de tono en los frentes.
const foilFront = oakTexture({ seed: 21, figure: 1.3, contrast: 0.6, alongU: true }),
  foilBody = oakTexture({ seed: 27, figure: 0.8, contrast: 0.6 });
foilFront.repeat.set(0.4, 0.45);
foilBody.repeat.set(0.3, 0.9);
// Tela de espiga fina (como la Tibbleby de las sillas VIHALS): columnas estrechas de trazos en
// diagonal que cambian de sentido, con un jaspeado por encima. Vale de color y de relieve.
const herringbone = (() => {
  const N = 256,
    c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, 0, N, N);
  let seed = 31;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const col = 16;
  ctx.lineWidth = 2.2;
  for (let k = 0; k < N / col; k++)
    for (let y = -col; y < N + col; y += 6) {
      ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '120,120,120'},${0.35 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(k * col, y + (k % 2 ? col : 0));
      ctx.lineTo((k + 1) * col, y + (k % 2 ? 0 : col));
      ctx.stroke();
    }
  const t = bakeTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  t.anisotropy = 8;
  return t;
})();
// Tejido jaspeado: ruido fino claro/oscuro, para que el gris del sofá no se vea plano.
const melange = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d'),
    im = ctx.createImageData(256, 256);
  let seed = 77;
  for (let i = 0; i < im.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = 222 + (seed % 34);
    im.data.set([v, v, v, 255], i);
  }
  ctx.putImageData(im, 0, 0);
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 256; i += 3) {
    ctx.fillStyle = i % 6 ? '#ffffff' : '#8c8c8c';
    ctx.fillRect(i, 0, 1, 256);
    ctx.fillRect(0, i, 256, 1);
  }
  const t = bakeTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
})();
const grain = (() => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#999999';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 160; i++) {
    const x = i * 1.67;
    ctx.strokeStyle = `rgba(30,30,30,${0.08 + 0.06 * Math.sin(i * 2.3)})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + Math.sin(i) * 7, 160, x - Math.cos(i) * 6, 350, x, 512);
    ctx.stroke();
  }
  const t = bakeTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();
const shadowTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(64, 64, 15, 64, 64, 64);
  g.addColorStop(0, 'rgba(35,24,14,.27)');
  g.addColorStop(0.65, 'rgba(35,24,14,.14)');
  g.addColorStop(1, 'rgba(35,24,14,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return bakeTexture(c);
})();
// `register(spec)`: da de alta una pieza que se abre al pulsarla (ver «Piezas que se abren» en app.js).
export function furnish(parent, mats, layouts = {}, register = () => {}) {
  const layout = layouts.living || 'daily',
    bed1Layout = layouts.bed1 || 'work',
    bed2Layout = layouts.bed2 || 'window';
  const fabric = (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.96,
      bumpMap: weave,
      bumpScale: 0.006,
      sheen: 1,
      sheenRoughness: 0.85,
      sheenColor: 0xf4e8d9,
    });
  Object.assign(mats, {
    upholstery: fabric('#c9c0ae'),
    cream: fabric('#f3ece0'),
    ochre: fabric('#b48a53'),
    moss: fabric('#788576'),
    rug: fabric('#d1c0a2'),
    walnut: new THREE.MeshStandardMaterial({
      color: '#805e40',
      roughness: 0.6,
      bumpMap: grain,
      bumpScale: 0.004,
    }),
    porcelain: new THREE.MeshStandardMaterial({ color: '#e5dbcd', roughness: 0.3 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#4c6844', roughness: 0.72, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: '#819568', roughness: 0.75, side: THREE.DoubleSide }),
    terracotta: new THREE.MeshStandardMaterial({ color: '#a76e51', roughness: 0.96 }),
    soil: new THREE.MeshStandardMaterial({ color: '#342c24', roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: '#9d8559', metalness: 0.72, roughness: 0.38 }),
    paper: new THREE.MeshStandardMaterial({ color: '#e9e0ce', roughness: 1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#c0966f', roughness: 0.95 }),
    contact: new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  });
  // Cada malla recuerda a qué producto de la lista de la compra pertenece (para el clic en 3D).
  let product = null;
  const tag = (id) => {
    product = id;
  };
  const add = (geo, mat, x, y, z, solid = true, to = parent) => {
    const o = new THREE.Mesh(geo, mat);
    if (product) o.userData.product = product;
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    o.userData.nonSolid = !solid;
    to.add(o);
    return o;
  };
  const soft = (x, y, z, w, h, d, mat, r = 0.035, solid = true, to = parent) =>
    add(
      new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)),
      mat,
      x,
      y,
      z,
      solid,
      to,
    );
  // Cojín mullido: superelipsoide. w × d en planta y grosor t (en y). `e2` bajo = planta más
  // cuadrada; `e1` alto = canto más afilado, como una almohada; `e1` bajo = canto lleno, de asiento.
  // Lleva una costura perimetral fina, que es lo que hace que se lea como tela cosida.
  const SEAT = { e1: 0.38, e2: 0.17, solid: true },
    BACK = { e1: 0.72, e2: 0.27, solid: false };
  // Opciones de forma: `taper` ensancha el lado −z y estrecha el +z (asientos y respaldos en
  // trapecio); `bend` curva la pieza a lo ancho (respaldo envolvente); `seamAt` sube o baja la
  // costura (−1 … 1 del medio grosor) y `seam: false` la quita.
  const cushion = (
    x,
    y,
    z,
    w,
    d,
    t,
    mat,
    {
      e1 = 0.6,
      e2 = 0.25,
      solid = false,
      taper = 0,
      bend = 0,
      seam = true,
      seamAt = 0,
      seamMat = mats.seam,
    } = {},
    to = parent,
  ) => {
    const deform = (px, py, pz) => {
      const qx = px * (1 - (taper * pz) / (d / 2));
      return [qx, py - bend * (qx / (w / 2)) ** 2, pz];
    };
    const U = 22,
      V = 48,
      sp = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e),
      pos = [],
      uv = [],
      idx = [];
    for (let i = 0; i <= U; i++) {
      const u = -Math.PI / 2 + (Math.PI * i) / U,
        cu = sp(Math.cos(u), e1),
        su = sp(Math.sin(u), e1);
      for (let j = 0; j < V; j++) {
        const v = -Math.PI + (2 * Math.PI * j) / V,
          px = (w / 2) * cu * sp(Math.cos(v), e2),
          pz = (d / 2) * cu * sp(Math.sin(v), e2);
        pos.push(...deform(px, (t / 2) * su, pz));
        // El grosor entra en las dos coordenadas para que la tela no se estire en los cantos.
        const h = (t / 2) * su * 2.2;
        uv.push(px * 2.2 + 0.5 + h, pz * 2.2 + 0.5 + h);
      }
    }
    for (let i = 0; i < U; i++)
      for (let j = 0; j < V; j++) {
        const a = i * V + j,
          b = i * V + ((j + 1) % V),
          c = (i + 1) * V + j,
          e = (i + 1) * V + ((j + 1) % V);
        idx.push(a, c, b, b, c, e);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = add(geo, mat, x, y, z, solid, to);
    if (seam) {
      const sinU = Math.sign(seamAt) * Math.pow(Math.abs(seamAt), 1 / e1),
        cu = Math.pow(Math.sqrt(Math.max(0, 1 - sinU * sinU)), e1) * 1.004,
        ring = [];
      for (let j = 0; j < 72; j++) {
        const v = (2 * Math.PI * j) / 72;
        ring.push(
          new THREE.Vector3(
            ...deform(
              (w / 2) * cu * sp(Math.cos(v), e2),
              (t / 2) * seamAt,
              (d / 2) * cu * sp(Math.sin(v), e2),
            ),
          ),
        );
      }
      const line = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 96, 0.0035, 5, true),
        seamMat,
      );
      line.userData.nonSolid = true;
      mesh.add(line);
    }
    return mesh;
  };
  // Losa con contorno redondeado (asientos, respaldos, tableros): w × d en planta, radio r, grosor t.
  const slab = (x, y, z, w, d, r, t, mat, solid = true, to = parent) => {
    const bevel = Math.min(0.012, t / 3),
      hw = w / 2 - bevel,
      hd = d / 2 - bevel,
      rr = Math.min(r, hw, hd),
      shape = new THREE.Shape();
    shape.moveTo(-hw + rr, -hd);
    shape.lineTo(hw - rr, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + rr);
    shape.lineTo(hw, hd - rr);
    shape.quadraticCurveTo(hw, hd, hw - rr, hd);
    shape.lineTo(-hw + rr, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - rr);
    shape.lineTo(-hw, -hd + rr);
    shape.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: t - 2 * bevel,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 10,
    });
    geo.translate(0, 0, -(t - 2 * bevel) / 2);
    geo.rotateX(-Math.PI / 2);
    return add(geo, mat, x, y, z, solid, to);
  };
  const cyl = (x, y, z, rt, rb, h, mat, solid = true, to = parent) =>
    add(new THREE.CylinderGeometry(rt, rb, h, 40), mat, x, y, z, solid, to);
  const ball = (x, y, z, w, h, d, mat, solid = false, to = parent) => {
    const m = add(new THREE.SphereGeometry(1, 32, 20), mat, x, y, z, solid, to);
    m.scale.set(w, h, d);
    return m;
  };
  const contact = (x, z, w, d) => {
    const o = add(new THREE.PlaneGeometry(w, d), mats.contact, x, 0.008, z, false);
    o.rotation.x = -Math.PI / 2;
    o.castShadow = false;
    delete o.userData.product;
  };
  const rod = (a, b, r, mat, to = parent) => {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      o = add(new THREE.CylinderGeometry(r, r, av.distanceTo(bv), 12), mat, 0, 0, 0, false, to);
    o.position.copy(av).add(bv).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.sub(av).normalize());
    return o;
  };
  function vase(x, y, z, h, mat = mats.porcelain) {
    const pts = [
      [0.0, 0],
      [0.07, 0],
      [0.092, 0.05],
      [0.1, 0.13],
      [0.055, 0.23],
      [0.045, 0.28],
    ].map(([r, v]) => new THREE.Vector2((r * h) / 0.28, (v * h) / 0.28));
    return add(new THREE.LatheGeometry(pts, 40), mat, x, y, z, false);
  }
  function plant(x, z, h = 0.85, baseY = 0) {
    const r = h * 0.16;
    cyl(x, baseY + r * 0.65, z, r, r * 0.78, r * 1.3, mats.terracotta, baseY === 0);
    cyl(x, baseY + r * 1.3, z, r * 0.92, r * 0.92, 0.008, mats.soil, false);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        tip = new THREE.Vector3(
          x + Math.cos(a) * h * 0.24,
          baseY + h * (0.55 + (i % 4) * 0.11),
          z + Math.sin(a) * h * 0.24,
        );
      rod([x, baseY + r, z], tip.toArray(), 0.006, mats.leaf);
      const leaf = ball(
        tip.x,
        tip.y,
        tip.z,
        0.045 * h,
        0.18 * h,
        0.012 * h,
        i % 2 ? mats.leaf : mats.leafLight,
      );
      leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.7);
    }
  }
  // Taza: cuerpo, café y un asa en D pegada al costado. El asa es medio aro vertical cuyo plano
  // pasa por el eje de la taza (antes era un aro entero girado 90°, de canto contra la taza).
  function mug(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = (x * 7 + z * 3) % (Math.PI * 2); // cada taza con el asa hacia un lado distinto
    parent.add(g);
    cyl(0, 0.045, 0, 0.035, 0.03, 0.09, mats.porcelain, false, g);
    const handle = add(
      new THREE.TorusGeometry(0.024, 0.0055, 10, 20, Math.PI),
      mats.porcelain,
      0.031,
      0.047,
      0,
      false,
      g,
    );
    handle.rotation.z = -Math.PI / 2;
    handle.scale.y = 1.15;
    // Café: un disco oscuro justo por encima de la tapa del cilindro, dejando ver el borde.
    cyl(0, 0.0906, 0, 0.0305, 0.0305, 0.002, mats.walnut, false, g);
  }
  function books(x, y, z, count = 4, to = parent) {
    for (let i = 0; i < count; i++) {
      const o = soft(
        x + (i - count / 2) * 0.035,
        y + 0.11,
        z,
        0.027,
        0.22 - (i % 3) * 0.018,
        0.13,
        [mats.moss, mats.ochre, mats.paper, mats.accent][i % 4],
        0.002,
        false,
        to,
      );
      o.rotation.z = i === 0 ? -0.1 : 0;
    }
  }
  function art(x, y, z, w, h, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    parent.add(g);
    soft(0, 0, 0, w, h, 0.027, mats.walnut, 0.006, false, g);
    soft(0, 0, 0.019, w - 0.035, h - 0.035, 0.006, mats.paper, 0.001, false, g);
    const disc = add(
      new THREE.CircleGeometry(w * 0.2, 48),
      mats.accent,
      -w * 0.14,
      h * 0.13,
      0.024,
      false,
      g,
    );
    const arch = add(
      new THREE.CircleGeometry(w * 0.26, 48, 0, Math.PI),
      mats.moss,
      w * 0.08,
      -h * 0.2,
      0.026,
      false,
      g,
    );
    arch.rotation.z = -0.2;
    rod([-w * 0.25, -h * 0.22, 0.028], [w * 0.25, h * 0.26, 0.028], 0.003, mats.brass, g);
  }
  function curtain(x, z, width, height = 2.3) {
    const g = new THREE.PlaneGeometry(width, height, 24, 32),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i),
        py = p.getY(i);
      p.setZ(i, 0.035 * Math.sin((px / width) * Math.PI * 10) + 0.012 * Math.cos(py * 7));
      p.setY(i, py + 0.008 * Math.cos(px * 40));
    }
    g.computeVertexNormals();
    const cloth = mats.cream;
    const o = add(g, cloth, x, 2.35 - height / 2, z, false);
    o.material.side = THREE.DoubleSide;
    o.castShadow = false;
    o.userData.ceilingHung = true; // se oculta en maqueta: cuelga de una barra que el corte elimina
    return o;
  }
  // ── Salón, con los muebles reales elegidos (medidas de las fichas de producto, 16/11/2026) ──
  // Lista con enlaces y precios: README.md y panel lateral del visor.
  // Aquí solo se dibuja lo que está en esa lista: sin cuadros ni adornos inventados.
  // Reparto: la franja z 3,84–4,65 queda libre (paso entre dormitorios, cocina y baño).
  // Sofá cama en la pared del baño; tele y mesa en la pared de enfrente.
  // Disposiciones: 'daily', 'tv', 'lounge', 'tvfull', 'guests', 'bed' (lista LAYOUTS en app.js).
  const guests = layout === 'guests',
    bed = layout === 'bed',
    tvFull = layout === 'tvfull',
    lounge = layout === 'lounge',
    tv = layout === 'tv' || tvFull;
  // Colores calibrados: se ajustaron hasta que, con la luz de la maqueta, el color en pantalla
  // coincide con el color dominante de la foto de cada producto (16/11/2026).
  Object.assign(mats, {
    sofaGrey: Object.assign(fabric('#cbcecf'), { map: melange, bumpScale: 0.004 }),
    sofaGreyDark: fabric('#b4b7b5'),
    seam: new THREE.MeshStandardMaterial({ color: '#a9acaa', roughness: 1 }),
    sage: Object.assign(fabric('#8f9c8a'), { map: herringbone, bumpMap: herringbone, bumpScale: 0.004 }),
    sageSeam: new THREE.MeshStandardMaterial({ color: '#6f7b6a', roughness: 1 }),
    sageSteel: new THREE.MeshStandardMaterial({ color: '#9ba08e', roughness: 0.6 }),
    beigeWeave: Object.assign(fabric('#fffffa'), { map: melange, bumpScale: 0.009 }),
    beech: new THREE.MeshStandardMaterial({
      color: '#dcc097',
      roughness: 0.6,
      bumpMap: grain,
      bumpScale: 0.002,
    }),
    oak: new THREE.MeshStandardMaterial({ color: '#e9cfa6', roughness: 0.5, map: oakTop }),
    oakLeg: new THREE.MeshStandardMaterial({ color: '#e9cfa6', roughness: 0.5, map: oakLeg }),
    oakApron: new THREE.MeshStandardMaterial({ color: '#e9cfa6', roughness: 0.5, map: oakApron }),
    oakFoil: new THREE.MeshStandardMaterial({ color: '#f8edde', roughness: 0.6, map: foilBody }),
    oakFoilFront: new THREE.MeshStandardMaterial({ color: '#f8edde', roughness: 0.6, map: foilFront }),
    tvBody: new THREE.MeshStandardMaterial({ color: '#4c4f52', roughness: 0.5, metalness: 0.4 }),
    tvScreen: new THREE.MeshStandardMaterial({ color: '#0d0f10', roughness: 0.18, metalness: 0.2 }),
  });
  // Silla genérica del escritorio del dormitorio 2 (no es un producto elegido).
  function diningChair(x, z, rot = 0) {
    tag(null);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    parent.add(g);
    soft(0, 0.46, 0, 0.46, 0.07, 0.44, mats.moss, 0.035, true, g);
    soft(0, 0.74, 0.2, 0.46, 0.48, 0.065, mats.moss, 0.03, true, g);
    for (const dx of [-0.17, 0.17])
      for (const dz of [-0.16, 0.16]) rod([dx, 0.43, dz], [dx, 0.02, dz + 0.025], 0.016, mats.walnut, g);
  }
  // IKEA VIHALS, verde: 49 × 55 × 81 cm, asiento a 48 cm (45 × 40). Hecha a partir de las nueve
  // fotos de la ficha: asiento grueso en trapecio con el frente redondeado y costura baja;
  // respaldo ancho (42 cm) y envolvente, separado del asiento y reclinado 14°; estructura de
  // tubo verde con las patas abiertas, donde cada pata delantera sigue como larguero bajo el
  // asiento y cada trasera sube, quebrando hacia dentro, hasta el respaldo. Mira a −z con rot = 0.
  function vihalsChair(x, z, rot = 0) {
    tag('chair');
    const g = new THREE.Group();
    g.userData.seat = { kind: 'chair' }; // el respaldo está en +z: se mira hacia −z
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    parent.add(g);
    const pad = { solid: true, seamMat: mats.sageSeam };
    cushion(
      0,
      0.452,
      0,
      0.42,
      0.4,
      0.062,
      mats.sage,
      { ...pad, e1: 0.5, e2: 0.42, taper: 0.07, seamAt: -0.6 },
      g,
    );
    slab(0, 0.418, 0.01, 0.34, 0.3, 0.09, 0.014, mats.sageSteel, false, g);
    const back = cushion(
      0,
      0.668,
      0.228,
      0.4,
      0.3,
      0.046,
      mats.sage,
      { ...pad, e1: 0.42, e2: 0.36, taper: 0.05, bend: 0.024, seamAt: 0.75 },
      g,
    );
    back.rotation.x = Math.PI / 2 + 0.24;
    const r = 0.0105,
      tube = (a, b) => rod(a, b, r, mats.sageSteel, g);
    for (const sd of [-1, 1]) {
      const front = [sd * 0.2, 0.418, -0.165],
        rear = [sd * 0.2, 0.418, 0.185];
      tube([sd * 0.236, 0.006, -0.245], front);
      tube(front, rear);
      tube([sd * 0.236, 0.006, 0.31], rear);
      tube(rear, [sd * 0.118, 0.61, 0.236]);
      for (const p of [front, rear]) ball(p[0], p[1], p[2], r, r, r, mats.sageSteel, false, g);
      for (const fz of [-0.245, 0.31]) cyl(sd * 0.236, 0.004, fz, 0.011, 0.011, 0.008, mats.dark, false, g);
    }
  }
  // IKEA FÖRLUNDA con almacenaje, beige: Ø44 × 41 cm. Tambor tapizado con tapa acolchada,
  // elevado sobre cuatro patas planas de haya que abrazan el lateral.
  // Son apilables (ficha de IKEA): las patas del de arriba bajan por fuera del tambor del de
  // abajo. `y0` levanta el puf para dibujarlo apilado; la altura de la pila es estimada.
  function pouf(x, z, y0 = 0) {
    tag('pouf');
    cyl(x, y0 + 0.24, z, 0.205, 0.205, 0.26, mats.beigeWeave);
    cushion(x, y0 + 0.385, z, 0.43, 0.43, 0.09, mats.beigeWeave, { e1: 0.5, e2: 1 });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2 + (y0 ? Math.PI / 4 : 0);
      const leg = soft(
        x + Math.cos(a) * 0.205,
        y0 + 0.15,
        z + Math.sin(a) * 0.205,
        0.035,
        0.3,
        0.07,
        mats.beech,
        0.016,
        false,
      );
      leg.rotation.y = -a;
    }
  }
  // IKEA TONSTAD, chapa de roble: 70 cm de ancho, 80 → 120 cm de largo, 75 de alto. Patas
  // redondas siempre en las esquinas y faldón liso de 8 cm (65 cm libres debajo).
  // `alongZ`: el largo va en z; el ancho de 70 siempre en x.
  function table(x, z, length) {
    tag('table');
    slab(x, 0.74, z, 0.7, length, 0.03, 0.022, mats.oak);
    soft(x, 0.69, z, 0.6, 0.08, length - 0.1, mats.oakApron, 0.006, false);
    for (const dx of [-0.32, 0.32])
      for (const dz of [-length / 2 + 0.03, length / 2 - 0.03])
        cyl(x + dx, 0.365, z + dz, 0.025, 0.025, 0.73, mats.oakLeg);
  }
  const setting = (x, z, mugX, mugZ) => {
    tag(null);
    cyl(x, 0.757, z, 0.12, 0.12, 0.012, mats.porcelain, false);
    mug(x + mugX, 0.751, z + mugZ);
  };

  // Sofá cama Nalui Nest 3, gris claro: 211 × 86 × 88 cm, asiento a 46 cm, brazos de 10,5 cm
  // (62 de alto), 190 cm entre brazos. Arrastre con ruedas: abierto mide 140 cm de fondo.
  // Va de z 4,66 a 6,77: el extremo norte llega justo al borde del paso a cocina y baño.
  const sofaZ = 5.715,
    inner = 1.9,
    open = lounge || bed;
  tag('sofa');
  soft(4.53, 0.36, sofaZ, 0.14, 0.62, inner, mats.sofaGrey, 0.05);
  for (const dz of [-1.0025, 1.0025]) soft(4.17, 0.335, sofaZ + dz, 0.86, 0.57, 0.105, mats.sofaGrey, 0.05);
  soft(4.11, 0.175, sofaZ, 0.7, 0.25, inner, mats.sofaGrey, 0.02);
  for (const x of [3.8, 4.54])
    for (const dz of [-1.0, 1.0]) cyl(x, 0.025, sofaZ + dz, 0.025, 0.025, 0.05, mats.beech, false);
  contact(4.17, sofaZ, 1.0, 2.25);
  if (open) {
    // Arrastre sacado: plataforma con ruedas hasta x = 3,20 (140 cm desde la pared).
    soft(3.48, 0.19, sofaZ, 0.56, 0.22, inner, mats.sofaGrey, 0.02);
    for (const dz of [-0.85, 0.85])
      cyl(3.25, 0.04, sofaZ + dz, 0.035, 0.035, 0.03, mats.dark, false).rotation.x = Math.PI / 2;
  }
  // Tiradores de tela del frente del arrastre.
  for (const dz of [-0.55, 0.55])
    soft(open ? 3.195 : 3.755, 0.21, sofaZ + dz, 0.012, 0.11, 0.035, mats.sofaGreyDark, 0.005, false);
  if (bed) {
    // Noche: sin cojines de respaldo ni almohadas de brazo. La cama (128 × 190 cm, a 46 cm) son
    // los tres cojines de asiento más los dos del arrastre; encima, almohada y nórdico.
    for (const dz of [-0.633, 0, 0.633])
      cushion(4.11, 0.385, sofaZ + dz, 0.7, 0.63, 0.17, mats.sofaGrey, SEAT);
    for (const dz of [-0.475, 0.475])
      cushion(3.48, 0.385, sofaZ + dz, 0.56, 0.945, 0.17, mats.sofaGrey, SEAT);
    const pillow = cushion(3.86, 0.52, 5.0, 0.66, 0.4, 0.15, mats.cream, {
      e1: 0.85,
      e2: 0.35,
      solid: false,
    });
    pillow.rotation.y = 0.06;
    const duvet = cushion(3.84, 0.5, sofaZ + 0.28, 1.3, 1.32, 0.13, mats.cream, {
      e1: 0.55,
      e2: 0.16,
      solid: false,
    });
    duvet.rotation.y = -0.03;
    soft(3.84, 0.565, 6.33, 1.24, 0.025, 0.5, mats.moss, 0.012, false);
  } else {
    // Cojines como en las fotos del producto: asientos planos de canto redondeado, tres cojines
    // de respaldo mullidos y algo desiguales, y las dos almohadas (56 × 28 cm) contra los brazos.
    const lean = [-0.15, -0.11, -0.17],
      yaw = [0.035, -0.02, 0.03];
    [-0.633, 0, 0.633].forEach((dz, i) => {
      cushion(4.11, 0.385, sofaZ + dz, 0.7, 0.63, 0.17, mats.sofaGrey, SEAT);
      const back = cushion(
        4.335 - i * 0.004,
        0.695,
        sofaZ + dz * 0.985,
        0.48,
        0.62,
        0.21,
        mats.sofaGrey,
        BACK,
      );
      back.rotation.set(0, yaw[i], Math.PI / 2 + lean[i]);
    });
    for (const s of [-1, 1]) {
      const pillow = cushion(4.02, 0.575, sofaZ + s * 0.82, 0.54, 0.29, 0.13, mats.sofaGrey, {
        e1: 0.85,
        e2: 0.3,
        solid: false,
      });
      pillow.rotation.x = s * (Math.PI / 2 - 0.5);
    }
    if (lounge) {
      // Tele tumbados: respaldo puesto, 112 cm de asiento para estirar las piernas.
      for (const dz of [-0.475, 0.475])
        cushion(3.48, 0.385, sofaZ + dz, 0.56, 0.945, 0.17, mats.sofaGrey, SEAT);
      const throwBlanket = soft(3.5, 0.475, 6.2, 0.5, 0.03, 0.6, mats.moss, 0.014, false);
      throwBlanket.rotation.y = 0.05;
    }
  }

  tag('tv');
  // Tele Hisense 65U7S Pro de 65" (144,6 × 83,7 × 5,2 cm, borde inferior a 1,0 m) con soporte fijo Vogel's TVM 5405 (1,5 cm de la
  // pared). Centrada con el sofá; borde inferior a 1 m, por encima de la mesa.
  const tvSet = new THREE.Group();
  parent.add(tvSet);
  soft(1.941, 1.4185, sofaZ, 0.052, 0.837, 1.446, mats.tvBody, 0.008, false, tvSet);
  soft(1.9685, 1.4215, sofaZ, 0.004, 0.815, 1.432, mats.tvScreen, 0.001, false, tvSet);
  // Al pulsarla se enciende: la pantalla pasa de negro a una imagen azulada.
  register({
    id: 'tv',
    kind: 'custom',
    object: tvSet,
    apply: (v) => mats.tvScreen.emissive.setRGB(0.16 * v, 0.3 * v, 0.5 * v),
  });

  // Tira LED IKEA ORMANÄS (4 m, 640 lm, 5 W) pegada por detrás al contorno de la tele: no se
  // ve la tira, solo el resplandor en la pared. Se enciende y se apaga al pulsar ese resplandor
  // (el borde de la pared alrededor de la tele).
  {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const g2 = glowCanvas.getContext('2d'),
      halo = g2.createRadialGradient(128, 128, 40, 128, 128, 128);
    halo.addColorStop(0, 'rgba(255,224,178,1)');
    halo.addColorStop(0.55, 'rgba(255,214,160,0.55)');
    halo.addColorStop(1, 'rgba(255,205,150,0)');
    g2.fillStyle = halo;
    g2.fillRect(0, 0, 256, 256);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.75),
      new THREE.MeshBasicMaterial({
        map: bakeTexture(glowCanvas),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    glow.position.set(1.906, 1.4185, sofaZ);
    glow.rotation.y = Math.PI / 2;
    glow.userData.nonSolid = true;
    glow.userData.product = 'ledstrip';
    glow.castShadow = glow.receiveShadow = false;
    parent.add(glow);
    const wash = new THREE.PointLight(0xffd9a8, 0, 3.2, 2);
    wash.position.set(2.05, 1.5, sofaZ);
    parent.add(wash);
    register({
      id: 'living-strip',
      kind: 'custom',
      dimmer: true,
      object: glow,
      apply: (v) => {
        glow.material.opacity = 0.85 * v;
        wash.intensity = 0.9 * v;
      },
    });
  }

  // Pufs: guardados uno encima de otro en la esquina de la ventana (ocupan Ø44 en vez de 88 cm);
  // en 'tv' son reposapiés de las plazas extremas.
  if (tv && !tvFull) {
    pouf(3.5, sofaZ - 0.633);
    pouf(3.5, sofaZ + 0.633);
  } else {
    pouf(4.38, 7.01);
    pouf(4.38, 7.01, 0.3);
  }
  // Sillas de suelo plegables tectake (57 cm de ancho, respaldo regulable), apoyadas en el frente
  // del sofá entre las piernas de quienes están sentados. Cabeza a ≈ 85 cm, bajo la tele.
  if (tvFull)
    for (const dz of [-0.316, 0.316]) {
      tag('floorchair');
      // Colchoneta acolchada de dos tramos: asiento en el suelo y respaldo reclinado.
      cushion(3.42, 0.07, sofaZ + dz, 0.54, 0.56, 0.14, mats.beigeWeave, { e1: 0.5, e2: 0.2 });
      const back = cushion(3.68, 0.36, sofaZ + dz, 0.56, 0.56, 0.13, mats.beigeWeave, { e1: 0.5, e2: 0.2 });
      back.rotation.z = Math.PI / 2 - 0.2;
    }

  if (guests) {
    // Invitados: mesa extendida a 120 cm y arrimada al sofá, que hace de banco; dos sillas
    // enfrente. Cinco personas; detrás de las sillas quedan ≈ 50 cm hasta la pared.
    table(3.36, sofaZ, 1.2);
    for (const dz of [-0.4, 0, 0.4]) setting(3.53, sofaZ + dz, -0.02, 0.17);
    for (const dz of [-0.3, 0.3]) {
      setting(3.19, sofaZ + dz, 0.02, 0.17);
      vihalsChair(2.72, sofaZ + dz, -Math.PI / 2);
    }
    cyl(3.36, 0.78, sofaZ, 0.12, 0.09, 0.06, mats.porcelain, false);
  } else {
    // Resto de usos: mesa cerrada (80 × 70) contra la pared, bajo la tele, con dos sillas
    // enfrentadas. Con el sofá cerrado quedan 112 cm de paso; con el arrastre abierto, 58.
    table(2.27, sofaZ, 0.8);
    // Solo en 'tvfull' una silla pasa al hueco entre la mesa y el paso, girada hacia la pantalla
    // (sexto asiento, de lado). Con los pufs delante del sofá esa silla cortaría el paso.
    if (tvFull) vihalsChair(2.88, 4.72, 2.2);
    else vihalsChair(2.27, sofaZ - 0.68, Math.PI);
    vihalsChair(2.27, sofaZ + 0.68, 0);
    if (layout === 'daily') {
      setting(2.27, sofaZ - 0.24, 0.17, 0.05);
      setting(2.27, sofaZ + 0.24, -0.17, -0.05);
    }
  }

  // Zapatero IKEA BISSA, efecto roble: 49 × 28 × 93 cm, dos frentes abatibles. En la esquina
  // que queda detrás de la puerta de entrada abierta; hay que fijarlo a la pared.
  tag('shoe');
  soft(2.195, 0.465, 7.08, 0.49, 0.93, 0.28, mats.oakFoil, 0.006);
  // Los dos frentes son abatibles: al pulsarlos basculan hacia fuera desde su borde inferior.
  [0.3, 0.7].forEach((y, k) => {
    const front = new THREE.Group();
    front.position.set(2.195, y - 0.185, 6.936);
    parent.add(front);
    soft(0, 0.185, 0, 0.43, 0.37, 0.012, mats.oakFoilFront, 0.004, false, front);
    soft(0, 0.38, 0.002, 0.41, 0.012, 0.01, mats.dark, 0.003, false, front);
    soft(0, 0.12, 0.07, 0.4, 0.012, 0.13, mats.dark, 0.003, false, front);
    register({ id: `shoe-front-${k}`, kind: 'tilt', object: front, open: -0.6 });
  });
  soft(2.195, 0.03, 6.945, 0.45, 0.05, 0.006, mats.dark, 0.002, false);
  tag(null);
  // Rincón de red, encima del zapatero (atrezo, sin producto): router de pie y, a su lado, el
  // miniordenador que hace de servidor, unidos por un cable de red. Queda junto a la entrada, al
  // aire y a 93 cm del suelo. El router es genérico (no se sabe cuál dará la operadora): caja
  // gris antracita con frente brillante, fila de pilotos verdes, ranuras de ventilación y dos
  // antenas. Dónde entra la fibra en el piso está sin comprobar.
  {
    const plastic = (color, roughness) => new THREE.MeshStandardMaterial({ color, roughness }),
      shell = plastic('#3a3d42', 0.55),
      gloss = plastic('#15171a', 0.12),
      led = new THREE.MeshBasicMaterial({ color: '#4fe08f' }),
      amber = new THREE.MeshBasicMaterial({ color: '#f0b23c' }),
      lan = plastic('#e3c02f', 0.6),
      silver = plastic('#c6c8ca', 0.4),
      rx = 2.06,
      rz = 7.14;
    soft(rx, 0.945, rz, 0.13, 0.014, 0.09, shell, 0.005, false);
    soft(rx, 1.035, rz, 0.2, 0.17, 0.042, shell, 0.012, false);
    soft(rx, 1.035, rz - 0.0215, 0.184, 0.154, 0.002, gloss, 0.001, false);
    [-0.06, -0.036, -0.012, 0.012, 0.036].forEach((dx, i) =>
      soft(rx + dx, 0.985, rz - 0.0232, 0.008, 0.004, 0.001, i === 4 ? amber : led, 0.0005, false),
    );
    for (let dx = -0.07; dx < 0.075; dx += 0.014)
      soft(rx + dx, 1.1205, rz, 0.006, 0.002, 0.026, gloss, 0.0005, false);
    for (const dx of [-0.075, 0.075])
      rod([rx + dx, 1.11, rz + 0.026], [rx + dx * 1.25, 1.25, rz + 0.03], 0.006, shell);
    // Miniordenador: caja de aluminio de 12,5 cm con frente oscuro, botón y piloto.
    const px = 2.3,
      pz = 7.1;
    soft(px, 0.955, pz, 0.125, 0.042, 0.125, silver, 0.01, false);
    soft(px, 0.955, pz - 0.0625, 0.115, 0.03, 0.002, gloss, 0.001, false);
    soft(px + 0.04, 0.955, pz - 0.0642, 0.008, 0.008, 0.001, silver, 0.0005, false);
    soft(px - 0.04, 0.955, pz - 0.0642, 0.005, 0.003, 0.001, led, 0.0005, false);
    for (const [fx, fz] of [
      [-0.045, -0.045],
      [0.045, -0.045],
      [-0.045, 0.045],
      [0.045, 0.045],
    ])
      cyl(px + fx, 0.933, pz + fz, 0.008, 0.008, 0.006, gloss, false);
    // Cable de red amarillo entre los dos y cables de corriente hacia la pared.
    rod([rx + 0.03, 0.938, rz + 0.03], [px - 0.02, 0.938, pz + 0.07], 0.003, lan);
    rod([rx - 0.03, 0.938, rz + 0.03], [rx - 0.03, 0.938, 7.215], 0.003, gloss);
    rod([px + 0.03, 0.938, pz + 0.062], [px + 0.03, 0.938, 7.215], 0.003, gloss);
  }
  // ── Dormitorios ──
  // Paño de cortina que cuelga de una barra y se corre: `x0` es el extremo fijo, `dir` hacia
  // dónde se extiende, `gathered` el ancho recogido y `full` el ancho corrida. Devuelve la malla
  // y `set(v)` con v = 0 recogida … 1 corrida. Corrida da sombra: tapa el sol y la luz del hueco.
  const drape = ({ x0, dir, top, z, gathered, full, mat }) => {
    const height = top - 0.03,
      geo = new THREE.PlaneGeometry(1, height, 60, 1),
      base = geo.attributes.position.array.slice(),
      mesh = add(geo, mat, x0, top - height / 2, z, false);
    mesh.userData.ceilingHung = true; // se oculta en maqueta: la barra queda por encima del corte
    const set = (v) => {
      const width = gathered + (full - gathered) * v,
        depth = 0.045 - 0.027 * v,
        p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = base[i * 3] + 0.5;
        p.setXYZ(i, dir * u * width, base[i * 3 + 1], depth * Math.sin(u * 9 * 2 * Math.PI));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      mesh.castShadow = v > 0.15;
    };
    set(0);
    return { mesh, set };
  };
  // Zona de trabajo replegable contra una pared izquierda (en x = wallX): mesa abatible de pared
  // IKEA NORBERG (74 × 60 cm, blanca) y silla plegable acolchada IKEA FRÖSVI.
  // Recogidas, la mesa cuelga pegada a la pared y la silla queda plana (`foldedAt`: centro x, z y
  // si va contra la pared del fondo). Al pulsar la mesa o la silla se abren o se recogen las dos;
  // abierta estorba al andar y recogida no.
  const foldingDesk = ({ id, wallX, zc, foldedAt: [fx, fz, onNorthWall] }) => {
    const top = new THREE.Group();
    top.position.set(wallX + 0.025, 0.74, zc);
    parent.add(top);
    tag('desk');
    soft(wallX + 0.012, 0.7, zc, 0.02, 0.1, 0.5, mats.ikeaWhite, 0.004, false);
    soft(0.3, -0.01, 0, 0.6, 0.02, 0.74, mats.ikeaWhite, 0.005, false, top);
    soft(0.25, -0.035, 0, 0.3, 0.03, 0.04, mats.ikeaWhite, 0.004, false, top);
    // Silla plegable IKEA FRÖSVI (43 × 49 × 78 cm, asiento a 48): estructura de haya lacada en
    // blanco en tijera, asiento y travesaño alto del respaldo acolchados en gris jaspeado.
    tag('foldchair');
    const chair = new THREE.Group(),
      r = 0.011,
      lean = Math.atan2(0.42, 0.774);
    chair.position.set(wallX + 0.88, 0, zc);
    chair.rotation.y = Math.PI / 2;
    chair.userData.seat = { kind: 'chair' };
    parent.add(chair);
    soft(0, 0.47, -0.01, 0.38, 0.018, 0.36, mats.ikeaWhite, 0.004, false, chair);
    soft(0, 0.49, -0.01, 0.36, 0.028, 0.34, mats.frosvi, 0.012, false, chair);
    for (const [y, hgt, mat] of [
      [0.7, 0.13, mats.frosvi],
      [0.59, 0.035, mats.ikeaWhite],
    ])
      soft(
        0,
        y,
        -0.2 + 0.42 * (y / 0.78),
        0.37,
        hgt,
        mat === mats.frosvi ? 0.03 : 0.016,
        mat,
        0.008,
        false,
        chair,
      ).rotation.x = lean;
    for (const sd of [-1, 1]) {
      rod([sd * 0.2, 0.006, -0.2], [sd * 0.2, 0.78, 0.22], r, mats.ikeaWhite, chair);
      rod([sd * 0.185, 0.006, 0.24], [sd * 0.185, 0.47, -0.17], r, mats.ikeaWhite, chair);
    }
    for (const [y, dz] of [
      [0.13, -0.13],
      [0.13, 0.14],
    ])
      rod([-0.2, y, dz], [0.2, y, dz], 0.008, mats.ikeaWhite, chair);
    // Silla plegada: plana (88 × 43 × 8 cm) contra la pared.
    const folded = new THREE.Group();
    folded.position.set(fx, 0, fz);
    if (onNorthWall) folded.rotation.y = -Math.PI / 2;
    parent.add(folded);
    for (const dz of [-0.2, 0.2]) soft(0, 0.44, dz, 0.035, 0.88, 0.03, mats.ikeaWhite, 0.006, false, folded);
    for (const y of [0.13, 0.6]) soft(0, y, 0, 0.02, 0.035, 0.38, mats.ikeaWhite, 0.004, false, folded);
    soft(0.012, 0.36, 0, 0.04, 0.34, 0.36, mats.frosvi, 0.012, false, folded);
    soft(0.012, 0.78, 0, 0.035, 0.13, 0.36, mats.frosvi, 0.01, false, folded);
    tag(null);
    register({
      id,
      kind: 'custom',
      object: top,
      obstacle: [wallX, zc - 0.37, wallX + 0.62, zc + 0.37],
      apply: (v) => {
        top.rotation.z = (-Math.PI / 2) * (1 - v);
        chair.visible = v > 0.5;
        folded.visible = v <= 0.5;
      },
    });
    chair.userData.toggleId = folded.userData.toggleId = id;
  };
  // Canapé IKEA TJÅLLE, Bomstad blanco, con colchón VALEVÅG de 24 cm (se duerme a 65 cm). Caja
  // tapizada de L × W × 41 cm apoyada en el suelo, sin cabecero; la tapa se abre desde los pies
  // con pistones (bisagra en la cabeza) y al pulsarla sube con el colchón.
  // 135 × 190 → 197 × 142 cm; 160 × 200 → 207 × 167 cm. En local: largo en x, cabeza en +x.
  // `backCushions`: dos cojines de 65 × 65 de pie contra la pared, como respaldo.
  const tjalle = ({ x, z, rot = 0, L, W, id, bedTag, mattressTag, backCushions = false }) => {
    const g = new THREE.Group(),
      ml = L - 0.07,
      mw = W - 0.07;
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    parent.add(g);
    tag(bedTag);
    for (const sz of [-1, 1])
      soft(0, 0.205, sz * (W / 2 - 0.0175), L, 0.41, 0.035, mats.bomstad, 0.01, false, g);
    for (const sx of [-1, 1])
      soft(sx * (L / 2 - 0.0175), 0.205, 0, 0.035, 0.41, mw, mats.bomstad, 0.01, false, g);
    soft(0, 0.03, 0, ml, 0.02, mw, mats.lining, 0.004, false, g);
    for (const sz of [-1, 1])
      soft(0, 0.2, sz * (mw / 2 - 0.003), ml, 0.36, 0.006, mats.lining, 0.002, false, g);
    for (const sx of [-1, 1])
      soft(sx * (ml / 2 - 0.003), 0.2, 0, 0.006, 0.36, mw - 0.01, mats.lining, 0.002, false, g);
    // Dentro del arcón: una caja y ropa de cama guardada.
    soft(0.45, 0.16, -0.3, 0.6, 0.24, 0.4, mats.oakFoil, 0.01, false, g);
    cushion(-0.35, 0.15, 0.2, 0.7, 0.5, 0.2, mats.cream, { e1: 0.6, e2: 0.3 }, g);
    soft(0, 0.205, 0, L, 0.41, W, mats.bomstad, 0.01, true, g).visible = false;
    const lid = new THREE.Group(),
      c = -ml / 2;
    lid.position.set(ml / 2, 0.41, 0);
    g.add(lid);
    soft(c, 0.012, 0, ml, 0.025, mw, mats.lidMesh, 0.006, false, lid);
    for (const dz of [-0.25, 0.25]) rod([-ml + 0.03, 0.02, dz], [-ml + 0.03, 0.1, dz], 0.006, mats.dark, lid);
    rod([-ml + 0.03, 0.1, -0.25], [-ml + 0.03, 0.1, 0.25], 0.006, mats.dark, lid);
    tag(mattressTag);
    cushion(c, 0.145, 0, ml, mw, 0.24, mats.mattress, { e1: 0.22, e2: 0.07, seamAt: -0.7, solid: true }, lid);
    // Ropa de cama (atrezo): almohadas en la cabeza, nórdico y manta a los pies. Al pulsarla
    // sale la ficha del colchón, que es lo que hay debajo.
    const pillowX = backCushions ? -0.52 : -0.3;
    // Para sentarse o tumbarse en el recorrido (app.js): la cama y dónde están sus almohadas.
    g.userData.seat = { kind: 'bed', pillows: [] };
    for (const s of [-1, 1]) {
      const pillow = cushion(
        pillowX,
        0.325,
        (s * mw) / 4,
        0.42,
        mw / 2 - 0.08,
        0.15,
        mats.cream,
        { e1: 0.8, e2: 0.3 },
        lid,
      );
      pillow.rotation.y = s * 0.05;
      g.userData.seat.pillows.push(pillow);
    }
    if (backCushions) {
      tag('backcushion');
      for (const s of [-1, 1]) {
        const big = cushion(
          -0.15,
          0.56,
          (s * mw) / 4,
          0.64,
          0.64,
          0.2,
          mats.beigeWeave,
          { e1: 0.7, e2: 0.3 },
          lid,
        );
        big.rotation.z = Math.PI / 2 - 0.22;
      }
      tag(mattressTag);
    }
    const dl = ml - 0.45,
      duvet = cushion(
        -0.45 - dl / 2,
        0.275,
        0,
        dl,
        mw + 0.12,
        0.12,
        mats.beigeWeave,
        { e1: 0.55, e2: 0.12, seam: false },
        lid,
      );
    duvet.rotation.y = 0.012;
    soft(-ml + 0.3, 0.342, 0, 0.5, 0.02, mw + 0.09, mats.sage, 0.01, false, lid);
    tag(null);
    register({ id, kind: 'tilt', axis: 'z', object: lid, open: -0.62 });
  };
  Object.assign(mats, {
    bomstad: new THREE.MeshStandardMaterial({ color: '#efece5', roughness: 0.7 }),
    lidMesh: new THREE.MeshStandardMaterial({ color: '#8a8a86', roughness: 0.95 }),
    lining: new THREE.MeshStandardMaterial({ color: '#232323', roughness: 1 }),
    mattress: Object.assign(fabric('#f6f5f1'), { map: melange }),
    ikeaWhite: new THREE.MeshStandardMaterial({ color: '#f4f4f1', roughness: 0.45 }),
    hueso: new THREE.MeshStandardMaterial({ color: '#ece8dd', roughness: 0.5 }),
    korgmott: Object.assign(fabric('#ddd3c1'), { side: THREE.DoubleSide, shadowSide: THREE.DoubleSide }),
    knisa: Object.assign(fabric('#ddd7ca'), { map: melange }),
    // Se define aquí porque la silla plegable se dibuja ya en el dormitorio 1.
    frosvi: Object.assign(fabric('#8b8e92'), { map: melange }),
  });

  // ── Dormitorio 1 (2,60 × 3,70 m en el modelo), con muebles reales de IKEA (16/11/2026) ──
  // Datos del piso (foto): armario empotrado de dos hojas correderas en la pared del fondo,
  // puerta que abre contra la pared derecha, enchufes en la pared izquierda y balcón enfrente.
  // La cama solo puede ir atravesada con la cabeza en la pared izquierda: las otras tres paredes
  // tienen el balcón, el armario y la puerta. Se trabaja mucho desde la cama, así que lleva
  // un cabecero acolchado donde apoyar la espalda.
  // Muebles: cabecero fino LJUSFJÄLLET (5 cm), una sola mesilla (lado del armario), mesa y silla
  // plegables junto al balcón y una balda sobre el cabecero con el proyector. Lo que se compara es el tamaño de la cama (BED1_LAYOUTS en app.js):
  //  · 'work' (recomendada): 160 × 200. Quedan 47 cm de paso a los pies.
  //  · 'queen': 135 × 190. Quedan 57 cm de paso, con colchón corto para 1,85 m.
  {
    const king = bed1Layout !== 'queen',
      L = king ? 2.07 : 1.97,
      W = king ? 1.67 : 1.42,
      x0 = 0.06,
      zc = 1.855,
      z0 = zc - W / 2,
      z1 = zc + W / 2;
    tjalle({
      x: x0 + L / 2,
      z: zc,
      rot: Math.PI,
      L,
      W,
      id: 'bed1-canape',
      bedTag: king ? 'bed1-bed' : 'bed',
      mattressTag: king ? 'bed1-mattress' : 'mattress',
    });
    contact(x0 + L / 2, zc, L + 0.15, W + 0.15);
    {
      // Cabecero IKEA LJUSFJÄLLET, Knisa beige claro: panel acolchado de 5 cm de grosor con las
      // esquinas de arriba redondeadas y funda que se quita y se lava; va sobre patas, entre la
      // pared y la cama. Es donde se apoya la espalda (con las almohadas) para trabajar sentado.
      tag('headboard');
      const hw = king ? 1.65 : 1.45,
        panel = slab(0.035, 0.74, zc, 0.92, hw, 0.09, 0.05, mats.knisa);
      panel.rotation.z = Math.PI / 2;
      for (const dz of [-hw / 2 + 0.2, hw / 2 - 0.2])
        cyl(0.035, 0.14, zc + dz, 0.014, 0.014, 0.28, mats.dark, false);
      tag(null);
    }
    // Mesillas IKEA FÅGELFJÄLLET, hueso, 42 × 41 × 56 cm: hueco abierto arriba, puerta con pomo
    // dorado debajo y zócalo. Una sola, en el lado del armario.
    [z1 + 0.25].forEach((nz, k) => {
      tag('nightstand');
      const g = new THREE.Group();
      g.position.set(0.215, 0, nz);
      g.rotation.y = Math.PI / 2;
      parent.add(g);
      soft(0, 0.55, 0, 0.42, 0.02, 0.41, mats.hueso, 0.006, true, g);
      for (const sx of [-1, 1]) soft(sx * 0.2, 0.28, 0, 0.018, 0.52, 0.39, mats.hueso, 0.004, false, g);
      soft(0, 0.28, -0.19, 0.4, 0.52, 0.012, mats.hueso, 0.003, false, g);
      soft(0, 0.415, 0, 0.39, 0.016, 0.38, mats.hueso, 0.003, false, g);
      soft(0, 0.03, 0, 0.42, 0.06, 0.4, mats.hueso, 0.004, false, g);
      soft(0, 0.28, 0, 0.4, 0.56, 0.4, mats.hueso, 0.004, true, g).visible = false;
      const door = new THREE.Group();
      door.position.set(-0.19, 0, 0.195);
      g.add(door);
      soft(0.19, 0.235, 0, 0.375, 0.33, 0.016, mats.hueso, 0.004, false, door);
      soft(0.19, 0.235, 0.009, 0.27, 0.23, 0.004, mats.hueso, 0.002, false, door);
      ball(0.34, 0.25, 0.022, 0.012, 0.012, 0.012, mats.brass, false, door);
      register({ id: `bed1-nightstand-${k}`, kind: 'hinge', object: door, open: -1.7 });
      // Lámpara de mesilla (atrezo).
      cyl(0, 0.585, 0, 0.05, 0.06, 0.05, mats.porcelain, false, g);
      cyl(0, 0.71, 0, 0.09, 0.11, 0.16, mats.cream, false, g);
      tag(null);
    });
    // Zona de trabajo replegable en la pared de la cabecera, entre la cama y el balcón: misma
    // mesa abatible NORBERG y silla plegable FRÖSVI que en el dormitorio 2. Recogidas, todo el
    // lado del balcón queda libre; la silla plegada se apoya en la pared del balcón.
    foldingDesk({ id: 'bed1-desk', wallX: 0, zc: 0.52, foldedAt: [0.4, 0.035, true] });
    // Cine en la cama. Balda de pared IKEA LACK de 110 × 26 cm (hasta 10 kg) centrada sobre el
    // cabecero, con la cara de arriba a 1,75 m: queda por encima de la cabeza al sentarse en la
    // cama. En el centro, el proyector Anker Nebula P1i (18 × 20 × 23 cm con su pie basculante),
    // en el eje de la cama y de la pared de enfrente, para no tener que corregir la imagen. Las
    // películas le llegan por la red desde el miniordenador, que está en el salón.
    tag('shelf');
    soft(0.13, 1.725, zc, 0.26, 0.05, 1.1, mats.ikeaWhite, 0.004, false);
    tag(null);
    {
      tag('projector');
      const body = soft(0.14, 1.88, zc, 0.19, 0.15, 0.17, mats.dark, 0.03, false);
      soft(0.14, 1.78, zc, 0.13, 0.06, 0.13, mats.dark, 0.015, false);
      cyl(0.238, 1.89, zc, 0.032, 0.032, 0.012, mats.alu, false).rotation.z = Math.PI / 2;
      tag(null);
      // Imagen en la pared de los pies: desde 2,36 m, con relación de tiro 1,25, mide
      // 1,89 × 1,06 m (unas 85"), con el borde de abajo a 97 cm para que la cama no la tape.
      // app.js la aclara u oscurece según la luz del dormitorio (`screen`): un proyector solo
      // se ve bien a oscuras. El haz se dibuja muy tenue para ver por dónde pasa.
      const frame = document.createElement('canvas');
      frame.width = 640;
      frame.height = 360;
      const c = frame.getContext('2d'),
        dusk = c.createLinearGradient(0, 0, 0, 360);
      dusk.addColorStop(0, '#16243f');
      dusk.addColorStop(0.55, '#c8693f');
      dusk.addColorStop(0.7, '#f1b25c');
      c.fillStyle = dusk;
      c.fillRect(0, 0, 640, 360);
      c.fillStyle = '#ffe9b8';
      c.beginPath();
      c.arc(430, 235, 26, 0, Math.PI * 2);
      c.fill();
      for (const [color, base, amp, freq] of [
        ['#5b3140', 250, 34, 0.011],
        ['#2a1c2c', 285, 26, 0.02],
        ['#0e0c14', 318, 14, 0.035],
      ]) {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(0, 360);
        for (let x = 0; x <= 640; x += 8)
          c.lineTo(x, base - amp * Math.sin(x * freq + base) - amp * 0.4 * Math.sin(x * freq * 2.7));
        c.lineTo(640, 360);
        c.fill();
      }
      const film = bakeTexture(frame);
      film.colorSpace = THREE.SRGBColorSpace;
      const iw = 1.89,
        ih = 1.06,
        iy = 1.5,
        image = new THREE.Mesh(
          new THREE.PlaneGeometry(iw, ih),
          new THREE.MeshBasicMaterial({ map: film, transparent: true, opacity: 0, toneMapped: false }),
        );
      image.position.set(2.596, iy, zc);
      image.rotation.y = -Math.PI / 2;
      const lens = [0.245, 1.89, zc],
        corners = [
          [2.59, iy - ih / 2, zc - iw / 2],
          [2.59, iy - ih / 2, zc + iw / 2],
          [2.59, iy + ih / 2, zc + iw / 2],
          [2.59, iy + ih / 2, zc - iw / 2],
        ],
        beamGeo = new THREE.BufferGeometry();
      beamGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          corners.flatMap((corner, i) => [...lens, ...corner, ...corners[(i + 1) % 4]]),
          3,
        ),
      );
      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: '#fff1d6',
          transparent: true,
          opacity: 0.05,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      for (const o of [image, beam]) {
        o.userData.nonSolid = o.userData.ceilingHung = true;
        o.castShadow = o.receiveShadow = false;
        parent.add(o);
      }
      register({
        id: 'bed1-projector',
        kind: 'custom',
        object: body,
        screen: 'bed1',
        image,
        apply: (v) => (image.visible = beam.visible = v > 0.01),
      });
    }
    // Sin cortinas: la puerta del balcón tiene persiana (app.js) y el aire acondicionado ocupa el
    // sitio de la barra.
  }

  // ── Dormitorio 2 (2,10 × 3,70 m en el modelo), con muebles reales de IKEA (16/11/2026) ──
  // Datos del piso: ventana en la pared de la calle con el aire acondicionado encima, puerta
  // junto a la pared izquierda (la hoja abre contra ella) y enchufe en la pared derecha.
  //  · 'window' (elegida): cama atravesada pegada a la ventana, cabeza en la pared derecha.
  //    Armario PAX de 200 con una hoja de espejo y mesa abatible NORBERG en la pared izquierda. Solo se entra a la cama por
  //    un lado largo: a los pies quedan 13 cm, no se puede rodear.
  //  · 'couple': la misma cama a lo largo, contra la pared derecha y con la cabeza bajo la
  //    ventana. Pasillo de 68 cm y salida por los pies; armario de 150 y sin escritorio.
  const couple = bed2Layout === 'couple';
  Object.assign(mats, {
    blind: Object.assign(fabric('#e2dccd'), { side: THREE.DoubleSide }),
    alu: new THREE.MeshStandardMaterial({ color: '#c6c8ca', roughness: 0.4 }),
    mirrorTint: new THREE.MeshStandardMaterial({ color: '#d3e0e4', roughness: 0.15 }),
  });
  // Canapé TJÅLLE de 135 × 190 (197 × 142 cm) con colchón VALEVÅG.
  tjalle({
    x: couple ? 4.13 : 3.855,
    z: couple ? 1.045 : 0.77,
    rot: couple ? Math.PI / 2 : 0,
    L: 1.97,
    W: 1.42,
    id: 'bed2-canape',
    bedTag: 'bed',
    mattressTag: 'mattress',
  });
  if (couple) contact(4.13, 1.045, 1.6, 2.1);
  else contact(3.855, 0.77, 2.1, 1.6);
  if (couple) {
    // Mesilla estrecha (30 × 35) en el lado del pasillo; pieza conceptual.
    soft(3.25, 0.27, 0.26, 0.3, 0.5, 0.35, mats.oak, 0.012);
  }
  // Armario IKEA PAX con puertas correderas HASVIK, blanco: 66 de fondo (58 de casco más 7,5 de
  // raíles) y 236 de alto. Dos cascos; dentro, baldas, dos barras y tres cajones KOMPLEMENT.
  // Cada hoja lleva dos juntas horizontales y perfiles verticales de aluminio. `alongZ`: pegado
  // a la pared derecha con el frente hacia la izquierda.
  const wardrobe = (a0, a1) => {
    tag('wardrobe');
    const mid = (a0 + a1) / 2,
      len = a1 - a0,
      half = len / 2,
      H = 2.364,
      // (a lo largo de la pared, fondo medido desde el frente de las puertas)
      piece = (along, depth, y, w, h, d, mat, solid = false, to = parent) =>
        soft(4.18 + depth, y, along, d, h, w, mat, 0.003, solid, to);
    piece(mid, 0.654, H / 2, len, H, 0.008, mats.ikeaWhite);
    for (const a of [a0 + 0.009, mid - 0.009, mid + 0.009, a1 - 0.009])
      piece(a, 0.365, H / 2, 0.018, H, 0.58, mats.ikeaWhite);
    piece(mid, 0.365, H - 0.009, len, 0.018, 0.58, mats.ikeaWhite);
    piece(mid, 0.365, 0.035, len, 0.07, 0.58, mats.ikeaWhite);
    const clothes = [mats.moss, mats.cream, mats.dark, mats.ochre, mats.sofaGrey, mats.sage, mats.upholstery];
    [-1, 1].forEach((sd, k) => {
      const c = mid + (sd * half) / 2,
        w = half - 0.04;
      piece(c, 0.365, 2.0, w, 0.018, 0.56, mats.ikeaWhite);
      piece(c, 0.365, 1.9, w, 0.022, 0.022, mats.alu);
      const hang = k ? 0.8 : 1.2;
      for (let i = 0, a = c - half / 2 + 0.1; a < c + half / 2 - 0.08; a += 0.085, i++)
        piece(
          a,
          0.365,
          1.88 - hang / 2 - (i % 3) * 0.03,
          0.04,
          hang - (i % 3) * 0.06,
          0.4,
          clothes[(i + k * 3) % clothes.length],
        );
      if (k) {
        piece(c, 0.365, 0.86, w, 0.018, 0.56, mats.ikeaWhite);
        for (const y of [0.17, 0.4, 0.63]) piece(c, 0.1, y, w, 0.2, 0.018, mats.ikeaWhite);
      } else {
        piece(c, 0.365, 0.45, w, 0.018, 0.56, mats.ikeaWhite);
        for (const [a, y] of [
          [c - 0.2, 0.56],
          [c + 0.15, 0.53],
          [c - 0.1, 0.18],
        ])
          piece(a, 0.36, y, 0.34, y > 0.4 ? 0.2 : 0.22, 0.4, mats.oakFoil);
      }
    });
    piece(mid, 0.33, H / 2, len, H, 0.66, mats.ikeaWhite, true).visible = false;
    for (const y of [0.02, H - 0.02]) piece(mid, 0.035, y, len, 0.04, 0.07, mats.alu);
    // Dos hojas correderas: la del lado de la cama es MEHAMN blanca; la del lado de la puerta,
    // AULI de espejo (cuatro lunas con marco de aluminio), que es lo que más ensancha la vista.
    [
      [mid - half / 2 + 0.01, 0.05, 1, false],
      [mid + half / 2 - 0.01, 0.02, -1, true],
    ].forEach(([c, depth, dir, mirrored], k) => {
      const leaf = new THREE.Group(),
        w = half + 0.02;
      parent.add(leaf);
      piece(c, depth, H / 2, w - 0.03, H - 0.06, 0.022, mats.ikeaWhite, false, leaf);
      for (const sd of [-1, 1])
        piece(c + sd * (w / 2 - 0.008), depth, H / 2, 0.016, H - 0.06, 0.026, mats.alu, false, leaf);
      if (mirrored) {
        // Luna tintada siempre visible; el reflejo real solo se calcula con la cámara cerca.
        const mw = w - 0.05,
          mh = H - 0.1,
          tint = add(
            new THREE.PlaneGeometry(mw, mh),
            mats.mirrorTint,
            4.18 + depth - 0.0125,
            H / 2,
            c,
            false,
            leaf,
          ),
          glass = new Reflector(new THREE.PlaneGeometry(mw, mh), {
            textureWidth: 768,
            textureHeight: 1024,
            color: 0xdfe6e8,
            clipBias: 0.003,
            multisample: 0,
          });
        tint.rotation.y = -Math.PI / 2;
        tint.castShadow = false;
        glass.position.set(4.18 + depth - 0.014, H / 2, c);
        glass.rotation.y = -Math.PI / 2;
        glass.userData.nonSolid = true;
        glass.visible = false;
        leaf.add(glass);
        tint.onBeforeRender = (renderer, scene, camera) => {
          glass.visible = camera.position.distanceTo(tint.getWorldPosition(new THREE.Vector3())) < 4.2;
        };
        for (const y of [0.62, 1.18, 1.75])
          piece(c, depth - 0.016, y, w - 0.03, 0.012, 0.004, mats.alu, false, leaf);
      } else
        for (const y of [0.8, 1.58])
          piece(c, depth - 0.0125, y, w - 0.03, 0.004, 0.002, mats.seam, false, leaf);
      register({
        id: `bed2-wardrobe-${k}`,
        exclusive: 'bed2-wardrobe',
        kind: 'slide',
        object: leaf,
        axis: 'z',
        distance: dir * (half - 0.04),
      });
    });
    tag(null);
  };
  if (couple) wardrobe(2.2, 3.7);
  else {
    wardrobe(1.7, 3.7);
    // Zona de trabajo replegable en la pared izquierda; recogida, el suelo libre pasa de 84 a
    // 144 cm de ancho. La silla plegada queda entre la cama y la mesa.
    foldingDesk({ id: 'bed2-desk', wallX: 2.74, zc: 2.35, foldedAt: [2.775, 1.69, false] });
  }
  // Sin estor: la ventana tiene persiana (app.js).
  // La encimera de la cocina se deja vacía: aún no hay nada elegido para ella.
  // Microondas LG MS2082H de 20 L (43,9 × 25,8 × 33,9 cm; color sin comprobar) en el hueco abierto bajo el
  // primer mueble alto, junto a la ventana. El hueco no está medido: puede no caber de fondo.
  {
    const white = new THREE.MeshStandardMaterial({ color: '#eceae6', roughness: 0.45 }),
      glass = new THREE.MeshStandardMaterial({ color: '#16181a', roughness: 0.15 });
    tag('microwave');
    soft(6.2, 1.638, 0.7, 0.34, 0.26, 0.44, white, 0.012, false);
    soft(6.028, 1.638, 0.65, 0.006, 0.2, 0.3, glass, 0.004, false);
    soft(6.028, 1.638, 0.87, 0.006, 0.2, 0.07, glass, 0.004, false);
    soft(6.022, 1.638, 0.815, 0.012, 0.16, 0.012, white, 0.004, false);
    for (const y of [1.6, 1.68])
      cyl(6.022, y, 0.87, 0.016, 0.016, 0.012, white, false).rotation.z = Math.PI / 2;
    tag(null);
    // Lavadora Bosch WGE03400EP (59,8 × 84,8 × 58,8 cm) en el hueco libre junto a la ventana.
    // Su alto deja 1 cm de margen si la encimera está a 86 cm: hay que medirlo.
    tag('washer');
    soft(6.085, 0.42, 0.31, 0.588, 0.838, 0.598, white, 0.012, true);
    const ring = cyl(
      5.788,
      0.4,
      0.31,
      0.17,
      0.17,
      0.02,
      new THREE.MeshStandardMaterial({ color: '#c9ccce', metalness: 0.6, roughness: 0.3 }),
      false,
    );
    ring.rotation.z = Math.PI / 2;
    cyl(5.78, 0.4, 0.31, 0.125, 0.125, 0.02, glass, false).rotation.z = Math.PI / 2;
    soft(
      5.789,
      0.77,
      0.31,
      0.006,
      0.09,
      0.56,
      new THREE.MeshStandardMaterial({ color: '#dcdad6', roughness: 0.4 }),
      0.003,
      false,
    );
    cyl(5.782, 0.77, 0.36, 0.03, 0.03, 0.02, white, false).rotation.z = Math.PI / 2;
    soft(5.785, 0.77, 0.17, 0.004, 0.035, 0.1, glass, 0.002, false);
    // Combi Hisense RB390N4DWD (59,5 × 186 × 59 cm) al final de la encimera, junto a la puerta.
    // Nevera arriba y congelador abajo; quedan unos 20 cm hasta la pared.
    tag('fridge');
    soft(6.085, 0.93, 3.19, 0.59, 1.86, 0.595, white, 0.012, true);
    soft(5.787, 1.27, 3.19, 0.006, 1.16, 0.585, white, 0.004, false);
    soft(5.787, 0.36, 3.19, 0.006, 0.64, 0.585, white, 0.004, false);
    soft(5.786, 0.685, 3.19, 0.004, 0.012, 0.585, glass, 0.001, false);
    for (const y of [1.0, 0.56])
      soft(
        5.78,
        y,
        2.93,
        0.012,
        0.3,
        0.016,
        new THREE.MeshStandardMaterial({ color: '#b9bcbe', metalness: 0.5, roughness: 0.35 }),
        0.004,
        false,
      );
    tag(null);
  }
  // Baño: alfombrilla, toalla doblada y jabón sobre el lavabo, y toallero en la pared libre.
  soft(5.05, 0.018, 5.6, 0.42, 0.025, 0.57, mats.rug, 0.012, false);
  soft(5.5, 1.01, 5.66, 0.19, 0.1, 0.2, mats.cream, 0.035, false);
  cyl(5.38, 0.99, 5.33, 0.025, 0.025, 0.12, mats.porcelain, false);
  rod([5.38, 1.05, 5.33], [5.38, 1.09, 5.33], 0.004, mats.metal);
  rod([5.38, 1.09, 5.33], [5.36, 1.09, 5.33], 0.004, mats.metal);
  rod([4.775, 1.25, 5.75], [4.775, 1.25, 6.15], 0.008, mats.metal);
  soft(4.79, 1.03, 5.95, 0.022, 0.41, 0.27, mats.cream, 0.01, false);
  return { style: 'lino, nogal y verde salvia', proposal: true };
}
