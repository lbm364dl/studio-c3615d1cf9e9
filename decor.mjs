import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

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
  const t = new THREE.CanvasTexture(c);
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
  const t = new THREE.CanvasTexture(c);
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
  const t = new THREE.CanvasTexture(c);
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
  const t = new THREE.CanvasTexture(c);
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
  const t = new THREE.CanvasTexture(c);
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
  return new THREE.CanvasTexture(c);
})();
export function furnish(parent, mats, layout = 'daily') {
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
  function mug(x, y, z) {
    cyl(x, y + 0.045, z, 0.035, 0.03, 0.09, mats.porcelain, false);
    const handle = add(
      new THREE.TorusGeometry(0.025, 0.006, 8, 24),
      mats.porcelain,
      x + 0.039,
      y + 0.049,
      z,
      false,
    );
    handle.rotation.y = Math.PI / 2;
    cyl(x, y + 0.091, z, 0.029, 0.029, 0.002, mats.dark, false);
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
  function pouf(x, z) {
    tag('pouf');
    cyl(x, 0.24, z, 0.205, 0.205, 0.26, mats.beigeWeave);
    cushion(x, 0.385, z, 0.43, 0.43, 0.09, mats.beigeWeave, { e1: 0.5, e2: 1 });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const leg = soft(
        x + Math.cos(a) * 0.205,
        0.15,
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
  // Tele Hisense 50E8S (111 × 64,8 × 5,9 cm) con soporte fijo Vogel's TVM 5405 (1,5 cm de la
  // pared). Centrada con el sofá; borde inferior a 1 m, por encima de la mesa.
  soft(1.9445, 1.324, sofaZ, 0.059, 0.648, 1.11, mats.tvBody, 0.008, false);
  soft(1.9755, 1.328, sofaZ, 0.004, 0.625, 1.095, mats.tvScreen, 0.001, false);

  // Pufs: guardados en la esquina de la ventana; en 'tv' son reposapiés de las plazas extremas.
  if (tv && !tvFull) {
    pouf(3.5, sofaZ - 0.633);
    pouf(3.5, sofaZ + 0.633);
  } else {
    pouf(3.94, 7.01);
    pouf(4.38, 7.01);
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
  for (const y of [0.3, 0.7]) soft(2.195, y, 6.936, 0.43, 0.37, 0.012, mats.oakFoilFront, 0.004, false);
  for (const y of [0.495, 0.895]) soft(2.195, y, 6.938, 0.41, 0.012, 0.01, mats.dark, 0.003, false);
  soft(2.195, 0.03, 6.945, 0.45, 0.05, 0.006, mats.dark, 0.002, false);
  tag(null);
  // ── Dormitorios ──
  // Both beds run across the rooms; headboards on the NW / negative-X wall.
  // 135 × 195 cm mattresses, pending confirmation against measured room widths.
  function transverseBed(x, z, accent) {
    soft(x, 0.22, z, 2.0, 0.3, 1.4, mats.upholstery, 0.06);
    soft(x, 0.47, z, 1.95, 0.25, 1.35, mats.cream, 0.08);
    soft(x - 1.02, 0.65, z, 0.06, 1.0, 1.4, mats.upholstery, 0.029);
    for (const dz of [-0.37, 0.37]) {
      const pillow = soft(x - 0.73, 0.65, z + dz, 0.38, 0.14, 0.55, mats.cream, 0.06, false);
      pillow.rotation.y = dz * 0.12;
    }
    const geo = new THREE.PlaneGeometry(1.53, 1.42, 48, 40),
      p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i),
        b = p.getY(i),
        fall = Math.max(0, Math.abs(b) - 0.61) * 2.1 + Math.max(0, a - 0.65) * 1.5;
      p.setZ(i, 0.013 * Math.sin(a * 20 + b * 6) + 0.007 * Math.cos(b * 27) - fall);
    }
    geo.computeVertexNormals();
    const duvet = add(geo, mats.cream, x + 0.2, 0.61, z, false);
    duvet.rotation.x = -Math.PI / 2;
    soft(x + 0.6, 0.63, z, 0.57, 0.035, 1.38, accent, 0.016, false);
    for (let zz = z - 0.64; zz < z + 0.65; zz += 0.055)
      rod([x + 0.89, 0.62, zz], [x + 0.95, 0.6, zz], 0.0015, accent);
    contact(x, z, 2.18, 1.6);
  }
  // Main bedroom: NW headboard; keep the balcony approach clear in front of the bed.
  transverseBed(1.12, 1.86, mats.moss);
  soft(0.25, 0.39, 0.87, 0.36, 0.12, 0.35, mats.walnut, 0.018);
  for (const x of [0.12, 0.38])
    for (const z of [0.74, 1.0]) rod([x, 0.35, z], [x, 0.02, z], 0.013, mats.walnut);
  vase(0.25, 0.46, 0.87, 0.18);
  art(0.02, 1.6, 1.86, 0.57, 0.74, Math.PI / 2);
  rod([0.63, 2.43, 0.08], [2.07, 2.43, 0.08], 0.008, mats.brass);
  curtain(0.7, 0.1, 0.17);
  curtain(2.0, 0.1, 0.17);
  // Bedroom 2: 135 × 190 bed, shortening only its length and keeping the head end fixed.
  const bedStart = parent.children.length;
  transverseBed(3.81, 0.76, mats.ochre);
  const shortBed = new THREE.Group(),
    lengthRatio = 190 / 195;
  shortBed.position.x = 2.79 * (1 - lengthRatio);
  shortBed.scale.x = lengthRatio;
  for (const part of parent.children.slice(bedStart)) shortBed.add(part);
  parent.add(shortBed);
  // Wardrobe and desk share the right wall AFTER the bed, not in the narrow foot gap.
  // Sliding wardrobe: 100 wide × 60 deep × 210 high cm, including door tracks.
  soft(4.53, 1.06, 2.1, 0.58, 2.1, 1.0, mats.cabinet, 0.012);
  soft(4.52, 0.04, 2.1, 0.54, 0.08, 0.94, mats.walnut, 0.008);
  // Two offset sliding leaves and their recessed vertical pulls.
  soft(4.224, 1.1, 1.865, 0.025, 2.0, 0.52, mats.cream, 0.006);
  soft(4.194, 1.1, 2.335, 0.025, 2.0, 0.52, mats.white, 0.006);
  for (const z of [2.07, 2.13]) soft(4.174, 1.1, z, 0.014, 0.3, 0.018, mats.metal, 0.005, false);
  for (const y of [0.1, 2.1]) soft(4.207, y, 2.1, 0.065, 0.018, 1.0, mats.metal, 0.005, false);
  // 100 × 50 cm desk alongside the wardrobe, towards the entrance.
  soft(4.55, 0.75, 3.17, 0.5, 0.045, 1.0, mats.walnut, 0.018);
  for (const x of [4.36, 4.74])
    for (const z of [2.75, 3.59]) rod([x, 0.73, z], [x, 0.02, z], 0.016, mats.dark);
  soft(4.55, 0.8, 3.17, 0.27, 0.022, 0.4, mats.metal, 0.008, false);
  const laptop = soft(4.66, 0.94, 3.17, 0.014, 0.27, 0.4, mats.dark, 0.008, false);
  laptop.rotation.z = 0.15;
  mug(4.52, 0.78, 2.79);
  books(4.54, 0.78, 3.53, 3);
  diningChair(3.96, 3.17, -Math.PI / 2);
  art(4.83, 1.55, 3.17, 0.52, 0.65, -Math.PI / 2);
  rod([3.12, 2.4, 0.08], [4.43, 2.4, 0.08], 0.008, mats.brass);
  curtain(3.18, 0.1, 0.15, 1.52);
  curtain(4.39, 0.1, 0.15, 1.52);
  // Counter accessories stay on the worktop and out of the 80 cm kitchen aisle.
  soft(6.05, 0.938, 1.65, 0.4, 0.015, 0.27, mats.walnut, 0.035, false);
  vase(6.15, 0.95, 1.61, 0.19, mats.terracotta);
  for (let i = 0; i < 4; i++) rod([6.15, 0.98, 1.61], [6.12 + i * 0.025, 1.29, 1.6], 0.007, mats.walnut);
  cyl(6.07, 0.96, 2.92, 0.16, 0.14, 0.045, mats.porcelain, false);
  for (let i = 0; i < 3; i++) ball(5.99 + i * 0.07, 1.01, 2.94, 0.045, 0.045, 0.045, mats.ochre);
  plant(6.11, 0.37, 0.32, 0.92);
  // Bathroom: towels, soap, bath mat, without shrinking the entry passage.
  soft(5.25, 0.018, 5.65, 0.5, 0.025, 0.57, mats.rug, 0.012, false);
  soft(4.89, 1.01, 5.56, 0.19, 0.1, 0.27, mats.cream, 0.035, false);
  cyl(5.03, 0.99, 5.28, 0.025, 0.025, 0.12, mats.porcelain, false);
  rod([5.03, 1.05, 5.28], [5.03, 1.09, 5.28], 0.004, mats.metal);
  rod([5.03, 1.09, 5.28], [5.05, 1.09, 5.28], 0.004, mats.metal);
  rod([5.62, 1.25, 5.8], [5.62, 1.25, 6.14], 0.008, mats.metal);
  soft(5.05, 1.03, 5.96, 0.022, 0.41, 0.27, mats.cream, 0.01, false);
  return { style: 'lino, nogal y verde salvia', proposal: true };
}
