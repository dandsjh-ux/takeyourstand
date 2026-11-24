// Procedural canvas textures & shared materials (linen weave, emblems, patterns, metals).
import * as THREE from 'three';

const texCache = new Map();
const matCache = new Map();

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function finish(c, { repeat = null, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function keep(m) { m.userData.keep = true; return m; }
function cached(key, fn) {
  if (!texCache.has(key)) texCache.set(key, fn());
  return texCache.get(key);
}
export const shade = (hex, amt) => {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return `#${c.getHexString()}`;
};
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---- base detail textures -------------------------------------------------
// Linen: slubby threads + mottling. Near-white so it multiplies a material colour.
export function weaveTexture() {
  return cached('weave', () => {
    const S = 256;
    const [c, g] = canvas(S);
    g.fillStyle = '#efefef'; g.fillRect(0, 0, S, S);
    const r = rng(7);
    for (let i = 0; i < 60; i++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 50;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.03 + r() * 0.04;
      grd.addColorStop(0, r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 1.5})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let y = 0; y < S; y += 3) { g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`; g.fillRect(0, y, S, 1); }
    for (let x = 0; x < S; x += 3) { g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`; g.fillRect(x, 0, 1, S); }
    for (let i = 0; i < 160; i++) {
      const horiz = r() < 0.6, len = 10 + r() * 60, x = r() * S, y = r() * S;
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.06 + r() * 0.08})`;
      if (horiz) g.fillRect(x, y, len, 1 + r() * 1.5); else g.fillRect(x, y, 1 + r() * 1.5, len);
    }
    return finish(c, { repeat: [3, 3] });
  });
}
export function weaveBump() {
  return cached('weaveBump', () => {
    const t = weaveTexture().clone();
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.needsUpdate = true;
    return t;
  });
}
export function noiseBump() {
  return cached('bump', () => {
    const S = 256;
    const [c, g] = canvas(S);
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    const r = rng(3);
    for (let i = 0; i < 900; i++) { // hammered dents
      const x = r() * S, y = r() * S, rad = 3 + r() * 10;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.12 + r() * 0.12})`); grd.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return finish(c, { repeat: [3, 3], srgb: false });
  });
}
export function leatherTexture() {
  return cached('leather', () => {
    const S = 256;
    const [c, g] = canvas(S);
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, S, S);
    const r = rng(17);
    for (let i = 0; i < 2600; i++) {
      const x = r() * S, y = r() * S;
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
      g.beginPath(); g.ellipse(x, y, 1.5 + r() * 2.5, 1 + r() * 2, r() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.1})`; g.lineWidth = 0.8 + r();
      g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},0.07)`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return finish(c, { repeat: [2, 2] });
  });
}
export function leatherBump() {
  return cached('leatherBump', () => { const t = leatherTexture().clone(); t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; });
}
// Wood grain running along V (the length of a prop).
export function woodTexture(seed = 5) {
  return cached(`wood:${seed}`, () => {
    const W = 128, H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, W, H);
    const r = rng(seed);
    for (let i = 0; i < 46; i++) {
      let x = r() * W;
      g.strokeStyle = `rgba(${r() < 0.75 ? '60,35,15' : '255,240,220'},${0.08 + r() * 0.16})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= H; y += 16) { x += (r() - 0.5) * 3 + Math.sin(y / 60 + i) * 0.6; g.lineTo(x, y); }
      g.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const x = r() * W, y = r() * H;
      for (let rr = 10; rr > 1; rr -= 2) { g.strokeStyle = 'rgba(70,40,15,0.18)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, rr * 0.6, rr * 1.8, 0, 0, 7); g.stroke(); }
    }
    return finish(c);
  });
}
export function woodBump(seed = 5) {
  return cached(`woodBump:${seed}`, () => { const t = woodTexture(seed).clone(); t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; });
}
// Rope / braided cord: twisted strands, many repeats along a tube.
export function ropeTexture(color) {
  return cached(`rope:${color}`, () => {
    const [c, g] = canvas(64, 64);
    g.fillStyle = color; g.fillRect(0, 0, 64, 64);
    for (let i = -2; i < 4; i++) {
      const grd = g.createLinearGradient(i * 24, 64, i * 24 + 40, 0);
      grd.addColorStop(0, shade(color, -0.2)); grd.addColorStop(0.5, shade(color, 0.12)); grd.addColorStop(1, shade(color, -0.2));
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(i * 24, 64); g.lineTo(i * 24 + 20, 64); g.lineTo(i * 24 + 52, 0); g.lineTo(i * 24 + 32, 0); g.fill();
    }
    return finish(c, { repeat: [14, 1] });
  });
}

// ---- skin & hair ---------------------------------------------------------
export function skinTexture() {
  return cached('skin', () => {
    const S = 256;
    const [c, g] = canvas(S);
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, S, S);
    const r = rng(23);
    for (let i = 0; i < 120; i++) {
      const x = r() * S, y = r() * S, rad = 6 + r() * 28;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, r() < 0.5 ? 'rgba(180,60,50,0.035)' : 'rgba(255,255,255,0.05)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${0.015 + r() * 0.02})`; g.fillRect(r() * S, r() * S, 1, 1); }
    return finish(c, { repeat: [2, 2] });
  });
}
export function skinBump() {
  return cached('skinBump', () => { const t = skinTexture().clone(); t.colorSpace = THREE.NoColorSpace; t.repeat.set(4, 4); t.needsUpdate = true; return t; });
}
// Hair strands: streaks along V (from the crown down). kind: 'straight' | 'curly'
export function hairTexture(kind = 'straight') {
  return cached(`hair:${kind}`, () => {
    const W = 512, H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, W, H);
    const r = rng(kind === 'curly' ? 41 : 31);
    if (kind === 'curly') {
      for (let i = 0; i < 2600; i++) {
        const x = r() * W, y = r() * H, rad = 3 + r() * 7;
        g.strokeStyle = `rgba(${r() < 0.6 ? '0,0,0' : '255,255,255'},${0.18 + r() * 0.25})`;
        g.lineWidth = 1 + r() * 1.5;
        g.beginPath(); g.arc(x, y, rad, r() * 6, r() * 6 + 3.5 + r() * 2); g.stroke();
      }
    } else {
      for (let i = 0; i < 900; i++) {
        const x = r() * W;
        const y0 = r() * H * 0.3, len = H * (0.4 + r() * 0.7), wave = 2 + r() * 4;
        g.strokeStyle = `rgba(${r() < 0.6 ? '0,0,0' : '255,255,255'},${0.08 + r() * 0.22})`;
        g.lineWidth = 0.7 + r() * 1.8;
        g.beginPath(); g.moveTo(x, y0);
        for (let y = y0; y < y0 + len; y += 12) g.lineTo(x + Math.sin(y / 40 + i) * wave, y);
        g.stroke();
      }
    }
    return finish(c, { repeat: kind === 'curly' ? [3, 2] : [2, 1] });
  });
}
export function hairBump(kind = 'straight') {
  return cached(`hairBump:${kind}`, () => { const t = hairTexture(kind).clone(); t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; });
}
// Alpha mask for the hair cap (sphere UVs: u around, v = polar angle) with a natural hairline.
// u = 0.25 is the forehead and 0.75 the nape. thetaLen = the cap's polar extent as a fraction of PI.
export function hairlineAlpha(style = 'short', thetaLen = 0.8, part = null) {
  return cached(`hairline:${style}:${thetaLen}:${part}`, () => {
    const W = 512, H = 256;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const long = style === 'long';
    // [offset from the forehead in u, polar angle as a fraction of PI]
    const ctrl = long
      ? [[0, 0.275], [0.06, 0.275], [0.11, 0.3], [0.16, 0.39], [0.2, 0.5], [0.25, 0.57], [0.31, 0.66], [0.4, 0.76], [0.5, 0.79]]
      : [[0, 0.27], [0.05, 0.262], [0.1, 0.258], [0.14, 0.31], [0.18, 0.42], [0.21, 0.5], [0.25, 0.53], [0.31, 0.6], [0.4, 0.68], [0.5, 0.71]];
    const sample = (u) => {
      let d = Math.abs(((u - 0.25 + 1.5) % 1) - 0.5); // distance from the forehead around the head, 0..0.5
      for (let i = 1; i < ctrl.length; i++) if (d <= ctrl[i][0]) {
        const [d0, t0] = ctrl[i - 1], [d1, t1] = ctrl[i];
        const k = (d - d0) / (d1 - d0), s = k * k * (3 - 2 * k);
        return t0 + (t1 - t0) * s;
      }
      return ctrl[ctrl.length - 1][1];
    };
    const r = rng(77);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 2) g.lineTo(x, (sample(x / W) / thetaLen) * H);
    g.lineTo(W, 0); g.closePath(); g.fill();
    // parting: a thin line of scalp from the hairline back towards the crown
    if (part) {
      const u = part === 'side' ? 0.19 : 0.25, x = u * W, y1 = (sample(u) / thetaLen) * H;
      g.strokeStyle = '#000'; g.lineCap = 'round';
      g.lineWidth = 3; g.beginPath(); g.moveTo(x, y1 + 2); g.lineTo(x, H * 0.14); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, H * 0.14); g.lineTo(x, H * 0.06); g.stroke();
    }
    // wispy edge
    for (let x = 0; x < W; x += 1.5) {
      const y = (sample(x / W) / thetaLen) * H;
      g.strokeStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + (r() - 0.5) * 1.5, y + r() * 2.5); g.stroke();
    }
    return finish(c, { srgb: false });
  });
}
// Iris for a sphere-cap eye (v runs from the pupil centre outwards).
export function irisTexture(color) {
  return cached(`iris:${color}`, () => {
    const W = 128, H = 256;
    const [c, g] = canvas(W, H);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#050403'); grd.addColorStop(0.34, '#0a0806');
    grd.addColorStop(0.38, shade(color, -0.14)); grd.addColorStop(0.62, shade(color, 0.12));
    grd.addColorStop(0.84, color); grd.addColorStop(0.92, shade(color, -0.3)); grd.addColorStop(1, '#1a120c');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const r = rng(19);
    for (let i = 0; i < 160; i++) {
      const x = r() * W;
      g.strokeStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,230'},${0.1 + r() * 0.15})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, H * 0.4); g.lineTo(x + (r() - 0.5) * 3, H * (0.7 + r() * 0.2)); g.stroke();
    }
    return finish(c);
  });
}

// ---- materials -----------------------------------------------------------
export const METALS = {
  bronze: '#b6804a', brass: '#cfa64e', gold: '#dcb453', copper: '#be6a3d', pewter: '#a3a6ad',
  bluebronze: '#76869a', olivebronze: '#9a9150', slate: '#64739c', silver: '#c9ccd2',
};
export const isMetal = (v) => typeof v === 'string' && METALS[v] != null;

export function metal(name, opts = {}) {
  const key = `metal:${name}:${opts.rough ?? ''}`;
  if (!matCache.has(key)) {
    matCache.set(key, keep(new THREE.MeshStandardMaterial({
      color: METALS[name] || name, metalness: 0.85, roughness: opts.rough ?? 0.34,
      bumpMap: noiseBump(), bumpScale: 0.6,
    })));
  }
  return matCache.get(key);
}
export function fabric(color, opts = {}) {
  const key = `fabric:${color}:${opts.rough ?? ''}:${opts.side ?? ''}`;
  if (!matCache.has(key)) {
    matCache.set(key, keep(new THREE.MeshStandardMaterial({
      color, map: weaveTexture(), roughness: opts.rough ?? 0.9, metalness: 0,
      bumpMap: weaveBump(), bumpScale: 1.4,
      side: opts.side ?? THREE.FrontSide,
    })));
  }
  return matCache.get(key);
}
export function leather(color) {
  const key = `leather:${color}`;
  if (!matCache.has(key)) {
    matCache.set(key, keep(new THREE.MeshStandardMaterial({ color, map: leatherTexture(), roughness: 0.6, metalness: 0.02, bumpMap: leatherBump(), bumpScale: 1.6 })));
  }
  return matCache.get(key);
}
export function wood(color, seed = 5) {
  const key = `wood:${color}:${seed}`;
  if (!matCache.has(key)) {
    matCache.set(key, keep(new THREE.MeshStandardMaterial({ color, map: woodTexture(seed), roughness: 0.62, bumpMap: woodBump(seed), bumpScale: 1.2 })));
  }
  return matCache.get(key);
}
export function rope(color) {
  const key = `rope:${color}`;
  if (!matCache.has(key)) matCache.set(key, keep(new THREE.MeshStandardMaterial({ map: ropeTexture(color), roughness: 0.85, bumpMap: ropeTexture(color), bumpScale: 2 })));
  return matCache.get(key);
}
export function plain(color, opts = {}) {
  const key = `plain:${color}:${JSON.stringify(opts)}`;
  if (!matCache.has(key)) matCache.set(key, keep(new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...opts })));
  return matCache.get(key);
}
export function gemMat(color) {
  const key = `gem:${color}`;
  if (!matCache.has(key)) {
    matCache.set(key, keep(new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, emissive: color, emissiveIntensity: 0.12 })));
  }
  return matCache.get(key);
}
export const matFor = (v, kind = 'fabric') => (isMetal(v) ? metal(v) : kind === 'leather' ? leather(v) : fabric(v));
export const colorOf = (v) => METALS[v] || v;

// ---- emblem drawing ------------------------------------------------------
// Draws an emblem centred at (0,0) in a unit space roughly [-1,1].
export function drawEmblem(g, type, color) {
  g.save();
  g.fillStyle = color; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  const leaf = (x, y, len, w, ang) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(w, -len * 0.5, 0, -len);
    g.quadraticCurveTo(-w, -len * 0.5, 0, 0);
    g.fill(); g.restore();
  };
  switch (type) {
    case 'sun': {
      g.beginPath(); g.arc(0, 0, 0.3, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.save(); g.rotate(a);
        g.beginPath(); g.moveTo(-0.07, -0.4); g.lineTo(0, i % 2 ? -0.62 : -0.72); g.lineTo(0.07, -0.4); g.fill();
        g.restore();
      }
      break;
    }
    case 'sunburst': {
      g.lineWidth = 0.045;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        g.beginPath(); g.moveTo(Math.cos(a) * 0.24, Math.sin(a) * 0.24);
        g.lineTo(Math.cos(a) * (i % 2 ? 0.66 : 0.82), Math.sin(a) * (i % 2 ? 0.66 : 0.82)); g.stroke();
      }
      g.lineWidth = 0.05; g.beginPath(); g.arc(0, 0, 0.22, 0, Math.PI * 2); g.stroke();
      break;
    }
    case 'olive': {
      g.lineWidth = 0.05;
      g.beginPath(); g.moveTo(-0.1, 0.75); g.bezierCurveTo(0.05, 0.3, -0.05, -0.2, 0.08, -0.75); g.stroke();
      const L = [[-0.02, 0.45, -0.9], [0.0, 0.45, 0.9], [0.0, 0.1, -0.8], [0.0, 0.05, 0.85], [0.02, -0.25, -0.75], [0.03, -0.3, 0.8], [0.07, -0.65, 0.1]];
      for (const [x, y, a] of L) leaf(x, y, 0.36, 0.09, a);
      g.beginPath(); g.arc(-0.2, 0.25, 0.07, 0, 7); g.fill();
      g.beginPath(); g.arc(0.2, -0.05, 0.07, 0, 7); g.fill();
      break;
    }
    case 'laurel': {
      for (const s of [-1, 1]) {
        g.lineWidth = 0.04;
        g.beginPath(); g.arc(0, 0.05, 0.62, Math.PI / 2 + s * 0.15, Math.PI / 2 + s * 2.3, s < 0); g.stroke();
        for (let i = 0; i < 7; i++) {
          const a = Math.PI / 2 + s * (0.35 + i * 0.3);
          const x = Math.cos(a) * 0.62, y = 0.05 + Math.sin(a) * 0.62;
          leaf(x, y, 0.26, 0.08, a + Math.PI / 2 + s * 0.6);
          leaf(x, y, 0.22, 0.07, a + Math.PI / 2 - s * 0.5 + Math.PI);
        }
      }
      break;
    }
    case 'rosette': {
      for (let i = 0; i < 8; i++) {
        g.save(); g.rotate((i / 8) * Math.PI * 2);
        g.beginPath(); g.ellipse(0, -0.38, 0.16, 0.28, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(0, 0, 0.17, 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.beginPath(); g.arc(0, 0, 0.12, 0, 7); g.fill();
      break;
    }
    case 'petal8': {
      for (let i = 0; i < 8; i++) {
        g.save(); g.rotate((i / 8) * Math.PI * 2);
        g.beginPath(); g.moveTo(0, -0.1); g.quadraticCurveTo(0.17, -0.42, 0, -0.75); g.quadraticCurveTo(-0.17, -0.42, 0, -0.1); g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, 0.13, 0, 7); g.fill();
      break;
    }
    case 'lily': {
      g.beginPath(); g.moveTo(0, 0.35); g.bezierCurveTo(0.22, 0, 0.12, -0.45, 0, -0.75); g.bezierCurveTo(-0.12, -0.45, -0.22, 0, 0, 0.35); g.fill();
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(0, 0.3);
        g.bezierCurveTo(s * 0.35, 0.2, s * 0.6, -0.1, s * 0.5, -0.45);
        g.bezierCurveTo(s * 0.42, -0.2, s * 0.2, 0.05, 0, 0.3); g.fill();
      }
      g.fillRect(-0.3, 0.32, 0.6, 0.1);
      g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, 0.42); g.lineTo(0, 0.75); g.stroke();
      break;
    }
    case 'lotus': {
      for (let i = -2; i <= 2; i++) {
        g.save(); g.translate(0, 0.4); g.rotate(i * 0.38);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(0.2, -0.45, 0, -0.85 + Math.abs(i) * 0.12); g.quadraticCurveTo(-0.2, -0.45, 0, 0); g.fill();
        g.restore();
      }
      g.beginPath(); g.ellipse(0, 0.48, 0.42, 0.1, 0, 0, 7); g.fill();
      break;
    }
    case 'pomegranate': {
      g.beginPath(); g.arc(0, 0.12, 0.48, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-0.2, -0.3); g.lineTo(-0.24, -0.6); g.lineTo(-0.1, -0.45); g.lineTo(0, -0.66); g.lineTo(0.1, -0.45); g.lineTo(0.24, -0.6); g.lineTo(0.2, -0.3); g.fill();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = 0.12 + (i % 3) * 0.1;
        g.beginPath(); g.ellipse(Math.cos(a) * r, 0.15 + Math.sin(a) * r, 0.05, 0.07, a, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'seeds': {
      for (let i = 0; i < 13; i++) {
        const a = i * 2.39996, r = Math.sqrt(i / 13) * 0.55;
        g.beginPath(); g.ellipse(Math.cos(a) * r, Math.sin(a) * r, 0.07, 0.1, a, 0, 7); g.fill();
      }
      break;
    }
    case 'stitch': {
      g.lineWidth = 0.035; g.setLineDash([0.07, 0.06]);
      g.beginPath(); g.arc(0, 0, 0.86, 0, 7); g.stroke();
      g.beginPath(); g.arc(0, 0, 0.5, 0, 7); g.stroke();
      g.setLineDash([]);
      break;
    }
    case 'fish': {
      g.lineWidth = 0.1;
      g.beginPath(); g.moveTo(-0.7, -0.3); g.quadraticCurveTo(0.05, -0.75, 0.62, 0.22); g.stroke();
      g.beginPath(); g.moveTo(-0.7, 0.3); g.quadraticCurveTo(0.05, 0.75, 0.62, -0.22); g.stroke();
      break;
    }
    case 'dove': {
      g.beginPath();
      g.moveTo(-0.6, 0.1);
      g.bezierCurveTo(-0.3, 0.05, -0.1, 0.0, 0.1, 0.05);
      g.bezierCurveTo(0.2, -0.3, 0.3, -0.6, 0.65, -0.7);
      g.bezierCurveTo(0.5, -0.4, 0.45, -0.15, 0.3, 0.08);
      g.bezierCurveTo(0.45, 0.1, 0.55, 0.2, 0.7, 0.12);
      g.bezierCurveTo(0.6, 0.35, 0.3, 0.4, 0.05, 0.35);
      g.bezierCurveTo(-0.2, 0.45, -0.45, 0.4, -0.6, 0.55);
      g.bezierCurveTo(-0.55, 0.35, -0.65, 0.25, -0.6, 0.1);
      g.fill();
      g.beginPath(); g.moveTo(-0.62, 0.12); g.lineTo(-0.8, 0.18); g.lineTo(-0.6, 0.2); g.fill();
      break;
    }
    case 'star': {
      for (let k = 0; k < 2; k++) {
        g.save(); g.rotate(k * Math.PI / 4);
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, r = i % 2 ? 0.28 : (k ? 0.55 : 0.78);
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath(); g.fill(); g.restore();
      }
      break;
    }
    case 'cross': {
      g.fillRect(-0.09, -0.7, 0.18, 1.4); g.fillRect(-0.45, -0.35, 0.9, 0.18);
      break;
    }
    case 'wavysun': { // flame-like wavy rays around a disc (Indigo / Radiant Sun shields)
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, L = i % 2 ? 0.72 : 0.9;
        g.save(); g.rotate(a);
        g.beginPath();
        g.moveTo(-0.075, -0.25);
        g.bezierCurveTo(-0.16, -0.42, 0.06, -0.55, -0.02, -L);
        g.bezierCurveTo(0.12, -0.56, -0.04, -0.42, 0.075, -0.25);
        g.closePath(); g.fill(); g.restore();
      }
      g.beginPath(); g.arc(0, 0, 0.28, 0, 7); g.fill();
      break;
    }
    case 'sprig': { // upright branching sprig with leaves and berries
      g.lineWidth = 0.045;
      g.beginPath(); g.moveTo(0, 0.88); g.bezierCurveTo(0.07, 0.42, -0.07, 0.02, 0.02, -0.82); g.stroke();
      const L = [[0.02, 0.58, -1.05, 0.36], [0.01, 0.52, 1.0, 0.34], [0.0, 0.22, -0.95, 0.38], [0.0, 0.16, 0.95, 0.36],
        [-0.01, -0.14, -0.8, 0.32], [0.0, -0.2, 0.85, 0.32], [0.02, -0.5, -0.6, 0.26], [0.02, -0.52, 0.6, 0.26], [0.02, -0.78, 0, 0.22]];
      for (const [x, y, a, l] of L) leaf(x, y, l, 0.11, a);
      for (const [x, y] of [[-0.2, 0.34], [0.22, 0.02], [-0.19, -0.3], [0.16, -0.62], [-0.1, -0.7]]) { g.beginPath(); g.arc(x, y, 0.055, 0, 7); g.fill(); }
      break;
    }
    case 'lilystem': { // lily flower with stamens on a stem with two leaves
      g.lineWidth = 0.055;
      g.beginPath(); g.moveTo(0, 0.18); g.quadraticCurveTo(0.06, 0.55, 0, 0.9); g.stroke();
      leaf(0, 0.82, 0.48, 0.13, -0.95); leaf(0, 0.82, 0.48, 0.13, 0.95);
      g.beginPath(); g.moveTo(0, 0.22); g.bezierCurveTo(0.17, -0.05, 0.11, -0.36, 0, -0.52); g.bezierCurveTo(-0.11, -0.36, -0.17, -0.05, 0, 0.22); g.fill();
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(0, 0.2);
        g.bezierCurveTo(s * 0.26, 0.16, s * 0.58, -0.04, s * 0.64, -0.36);
        g.bezierCurveTo(s * 0.48, -0.12, s * 0.27, 0.0, s * 0.05, 0.06); g.fill();
      }
      g.lineWidth = 0.025;
      for (const s of [-1, 0, 1]) {
        const ex = s * 0.15, ey = -0.66 + Math.abs(s) * 0.08;
        g.beginPath(); g.moveTo(0, 0.0); g.lineTo(ex, ey); g.stroke();
        g.beginPath(); g.arc(ex, ey, 0.045, 0, 7); g.fill();
      }
      break;
    }
    case 'pomseed': { // pomegranate outline with crown, seed drops and leaves
      g.lineWidth = 0.085;
      g.beginPath(); g.arc(0, 0.02, 0.42, -Math.PI * 0.34, Math.PI * 1.34); g.stroke();
      g.beginPath(); g.moveTo(-0.17, -0.36); g.lineTo(-0.23, -0.62); g.lineTo(-0.08, -0.5); g.lineTo(0, -0.72); g.lineTo(0.08, -0.5); g.lineTo(0.23, -0.62); g.lineTo(0.17, -0.36); g.closePath(); g.fill();
      for (const [x, y] of [[0, -0.2], [-0.13, -0.04], [0.13, -0.04], [-0.24, 0.13], [0, 0.11], [0.24, 0.13], [-0.12, 0.27], [0.12, 0.27]]) {
        g.beginPath(); g.moveTo(x, y - 0.085); g.quadraticCurveTo(x + 0.065, y + 0.035, x, y + 0.065); g.quadraticCurveTo(x - 0.065, y + 0.035, x, y - 0.085); g.fill();
      }
      g.lineWidth = 0.045; g.beginPath(); g.moveTo(0, 0.44); g.lineTo(0, 0.68); g.stroke();
      leaf(0, 0.6, 0.46, 0.13, -1.25); leaf(0, 0.6, 0.46, 0.13, 1.25);
      break;
    }
    case 'lotusline': { // line-art lotus (stroked petals) with stem and leaves
      g.lineWidth = 0.055;
      const pet = (ang, len, w) => { g.save(); g.translate(0, 0.14); g.rotate(ang); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w, -len * 0.5, 0, -len); g.quadraticCurveTo(-w, -len * 0.5, 0, 0); g.stroke(); g.restore(); };
      pet(0, 0.66, 0.21); pet(-0.55, 0.54, 0.19); pet(0.55, 0.54, 0.19); pet(-1.12, 0.38, 0.15); pet(1.12, 0.38, 0.15);
      g.beginPath(); g.moveTo(-0.46, 0.15); g.quadraticCurveTo(0, 0.34, 0.46, 0.15); g.stroke();
      g.beginPath(); g.moveTo(0, 0.24); g.lineTo(0, 0.78); g.stroke();
      leaf(0, 0.64, 0.38, 0.12, -1.1); leaf(0, 0.64, 0.38, 0.12, 1.1);
      g.beginPath(); g.arc(0, 0.84, 0.045, 0, 7); g.fill();
      break;
    }
    case 'rosette8': { // hammered 8-petal rosette with a domed centre
      for (let i = 0; i < 8; i++) {
        g.save(); g.rotate((i / 8) * Math.PI * 2);
        g.beginPath(); g.ellipse(0, -0.42, 0.2, 0.3, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, 0.24, 0, 7); g.fill();
      break;
    }
    default: break;
  }
  g.restore();
}

// Face texture: background colour + optional emblem + optional rim stitching, with soft vignette.
export function emblemTexture(bg, emblem, fg, opts = {}) {
  const key = `emb:${bg}:${emblem}:${fg}:${JSON.stringify(opts)}`;
  return cached(key, () => {
    const S = 512;
    const [c, g] = canvas(S);
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    // fabric/leather grain
    const r = rng(11);
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + r() * 0.05})`;
      g.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 2);
    }
    const grad = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.72);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)'); grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    if (emblem) {
      g.save(); g.translate(S / 2, S / 2); g.scale(S * (opts.scale ?? 0.4), S * (opts.scale ?? 0.4));
      // shadow for relief
      g.save(); g.translate(0.02, 0.025); drawEmblem(g, emblem, 'rgba(0,0,0,0.35)'); g.restore();
      drawEmblem(g, emblem, fg);
      g.save(); g.translate(-0.012, -0.012); g.globalAlpha = 0.25; drawEmblem(g, emblem, '#ffffff'); g.restore();
      g.restore();
    }
    return finish(c);
  });
}
export function emblemBump(emblem, scale = 0.4) {
  return cached(`embBump:${emblem}:${scale}`, () => {
    const S = 256;
    const [c, g] = canvas(S);
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    if (emblem) {
      g.translate(S / 2, S / 2); g.scale(S * scale, S * scale);
      drawEmblem(g, emblem, '#fff');
    }
    return finish(c, { srgb: false });
  });
}

// ---- prop faces (swords, shields) ------------------------------------------
function goldGradient(g, base) {
  const grd = g.createLinearGradient(-0.7, -0.8, 0.7, 0.8);
  grd.addColorStop(0, shade(base, 0.22)); grd.addColorStop(0.45, base); grd.addColorStop(0.55, shade(base, 0.12)); grd.addColorStop(1, shade(base, -0.2));
  return grd;
}
function grain(g, W, H, kind, r) {
  if (kind === 'wood' || kind === 'painted') {
    const a = kind === 'wood' ? 1 : 0.45;
    for (let i = 0; i < 40; i++) {
      let x = r() * W;
      g.strokeStyle = `rgba(${r() < 0.75 ? '60,35,15' : '255,240,220'},${(0.07 + r() * 0.14) * a})`;
      g.lineWidth = 0.6 + r() * 2;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= H; y += 14) { x += (r() - 0.5) * 2.5 + Math.sin(y / 50 + i) * 0.5; g.lineTo(x, y); }
      g.stroke();
    }
  } else if (kind === 'metal') {
    for (let i = 0; i < 260; i++) {
      const x = r() * W;
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + r() * 0.08})`;
      g.fillRect(x, r() * H * 0.3, 0.6 + r() * 1.2, H * (0.4 + r() * 0.6));
    }
  } else if (kind === 'linen') {
    for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.05})`; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 3) { g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.06})`; g.fillRect(x, 0, 1, H); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.07})`; g.fillRect(r() * W, r() * H, 10 + r() * 40, 1.5); }
  } else if (kind === 'leather') {
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`;
      g.beginPath(); g.ellipse(r() * W, r() * H, 1.5 + r() * 3, 1 + r() * 2, r() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 30; i++) {
      const x = r() * W, y = r() * H, rad = 20 + r() * 60;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${r() < 0.6 ? '90,60,30' : '255,255,255'},0.08)`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
}

// Blade face: u across the width, v from the guard (0) to the tip (1).
export function bladeTexture(color, kind, emblem, emblemC) {
  return cached(`blade:${color}:${kind}:${emblem}:${emblemC}`, () => {
    const W = 128, H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    const r = rng(13);
    grain(g, W, H, kind, r);
    // edge shading: darker bevels, brighter centre
    const eg = g.createLinearGradient(0, 0, W, 0);
    eg.addColorStop(0, 'rgba(0,0,0,0.28)'); eg.addColorStop(0.18, 'rgba(0,0,0,0.04)'); eg.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    eg.addColorStop(0.82, 'rgba(0,0,0,0.04)'); eg.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = eg; g.fillRect(0, 0, W, H);
    // central fuller groove (metal) or painted centre line (wood)
    if (kind === 'metal') {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(W / 2 - 5, H * 0.12, 10, H * 0.7);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(W / 2 + 3, H * 0.12, 2, H * 0.7);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(W / 2 - 1.5, H * 0.08, 3, H * 0.72);
    }
    // worn tip
    const tg = g.createLinearGradient(0, 0, 0, H * 0.15);
    tg.addColorStop(0, 'rgba(0,0,0,0.12)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = tg; g.fillRect(0, 0, W, H * 0.15);
    if (emblem) {
      const cx = W / 2, cy = H * 0.78, sc = W * 0.34;
      g.save(); g.translate(cx, cy); g.scale(sc, sc);
      g.save(); g.translate(0.03, 0.04); drawEmblem(g, emblem, 'rgba(0,0,0,0.35)'); g.restore();
      drawEmblem(g, emblem, kind === 'metal' ? shade(color, -0.3) : goldGradient(g, emblemC || '#d2a84f'));
      g.restore();
    }
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

// Shield face drawn inside its real outline (pts in 0..1 UV space). Returns a colour map and a
// mask (white = gilded metal relief) used for metalness and bump.
// deco: list of extra ornaments seen on the reference sheets.
function smallSprig(g, x, y, size, ang, color) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(size, size);
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = 0.08; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0.9); g.quadraticCurveTo(0.08, 0, 0, -0.9); g.stroke();
  for (let k = 0; k < 4; k++) {
    for (const sd of [-1, 1]) {
      g.save(); g.translate(0, 0.55 - k * 0.42); g.rotate(sd * 0.9);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(0.16, -0.22, 0, -0.42); g.quadraticCurveTo(-0.16, -0.22, 0, 0); g.fill();
      g.restore();
    }
  }
  g.restore();
}
export function shieldFace(key, pts, opts) {
  return cached(`shieldface:${key}`, () => {
    const { face, kind = 'painted', emblem = null, emblemC = '#d2a84f', scale = 0.36, stitch = false, deco = [], band = '#d9a441' } = opts;
    const S = 512;
    const path = (g, k = 1) => {
      g.beginPath();
      pts.forEach(([u, v], i) => {
        const x = (0.5 + (u - 0.5) * k) * S, y = (1 - (0.5 + (v - 0.5) * k)) * S;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.closePath();
    };
    const ornaments = (g, col, mask) => {
      g.save(); path(g, 1.0); g.clip();
      if (deco.includes('innerLine')) { g.lineWidth = 5; g.strokeStyle = col; path(g, 0.84); g.stroke(); }
      if (deco.includes('chevron')) {
        g.lineWidth = 12; g.strokeStyle = mask ? '#fff' : '#b9823f'; path(g, 0.8); g.stroke();
        g.lineWidth = 22; g.beginPath(); g.moveTo(S * 0.06, S * 0.4); g.quadraticCurveTo(S * 0.5, S * 0.1, S * 0.94, S * 0.4); g.stroke();
      }
      if (deco.includes('wreath')) {
        const R = S * 0.31;
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2 + Math.PI / 20;
          if (i % 5 === 4) continue; // gaps between four leafy arcs
          smallSprig(g, S / 2 + Math.cos(a) * R, S / 2 + Math.sin(a) * R, S * 0.06, a, col);
        }
      }
      if (deco.includes('sprigsTB')) {
        smallSprig(g, S / 2, S * 0.17, S * 0.05, 0, col);
        smallSprig(g, S / 2, S * 0.83, S * 0.05, Math.PI, col);
      }
      if (deco.includes('corners')) {
        for (const [x, y, a] of [[0.24, 0.24, -0.78], [0.76, 0.24, 0.78], [0.24, 0.76, -2.35], [0.76, 0.76, 2.35]]) smallSprig(g, S * x, S * y, S * 0.04, a, col);
      }
      g.restore();
    };
    const relief = (g, col, mask) => {
      if (!emblem) return;
      g.save(); g.translate(S / 2, S / 2); g.scale(S * scale, S * scale);
      if (!mask) { g.save(); g.translate(0.025, 0.03); drawEmblem(g, emblem, 'rgba(30,15,5,0.45)'); g.restore(); }
      drawEmblem(g, emblem, mask ? '#fff' : goldGradient(g, col));
      if (!mask) { g.save(); g.translate(-0.012, -0.014); g.globalAlpha = 0.3; drawEmblem(g, emblem, '#fff8e0'); g.restore(); }
      g.restore();
    };
    // colour
    const [c, g] = canvas(S);
    g.fillStyle = face; g.fillRect(0, 0, S, S);
    const r = rng(29);
    grain(g, S, S, kind, r);
    if (deco.includes('sideBands')) {
      g.save(); path(g); g.clip();
      g.fillStyle = band; g.fillRect(0, 0, S * 0.28, S); g.fillRect(S * 0.72, 0, S * 0.28, S);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(S * 0.28 - 3, 0, 3, S); g.fillRect(S * 0.72, 0, 3, S);
      grain(g, S, S, 'painted', rng(31));
      g.restore();
    }
    if (deco.includes('lacing')) {
      g.save(); g.strokeStyle = '#efe2c2'; g.lineWidth = 5; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const [u, v] = pts[Math.floor((i / 8) * pts.length)];
        const x = u * S, y = (1 - v) * S, dx = x - S / 2, dy = y - S / 2, d = Math.hypot(dx, dy);
        const nx = dx / d, ny = dy / d, tx = -ny, ty = nx;
        for (const o of [-8, 0, 8]) { g.beginPath(); g.moveTo(x - nx * 22 + tx * o, y - ny * 22 + ty * o); g.lineTo(x + tx * o, y + ty * o); g.stroke(); }
      }
      g.restore();
    }
    g.save(); path(g); g.clip();
    g.shadowColor = 'rgba(40,20,5,0.55)'; g.shadowBlur = 38;
    g.lineWidth = 30; g.strokeStyle = 'rgba(40,20,5,0.3)'; path(g, 1.02); g.stroke();
    g.shadowBlur = 0;
    const hg = g.createRadialGradient(S * 0.4, S * 0.34, 10, S * 0.5, S * 0.5, S * 0.62);
    hg.addColorStop(0, 'rgba(255,255,255,0.2)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg; g.fillRect(0, 0, S, S);
    g.restore();
    if (stitch) {
      g.setLineDash([9, 7]); g.lineWidth = 3.5; g.lineCap = 'round';
      g.strokeStyle = shade(face, -0.3); path(g, deco.includes('chevron') ? 0.72 : 0.88); g.stroke();
      g.setLineDash([]);
    }
    ornaments(g, emblemC, false);
    relief(g, emblemC, false);
    const map = finish(c);
    // metal mask
    const [cm, gm] = canvas(S);
    gm.fillStyle = '#000'; gm.fillRect(0, 0, S, S);
    ornaments(gm, '#fff', true);
    relief(gm, '#fff', true);
    const mask = finish(cm, { srgb: false });
    return { map, mask };
  });
}

// Emblem decal for a chest piece: transparent background + metal mask.
export function decalTextures(emblem, color, { scale = 0.42 } = {}) {
  return cached(`decal:${emblem}:${color}:${scale}`, () => {
    const S = 512;
    const [c, g] = canvas(S);
    g.translate(S / 2, S / 2); g.scale(S * scale, S * scale);
    g.save(); g.translate(0.025, 0.035); drawEmblem(g, emblem, 'rgba(30,15,5,0.5)'); g.restore();
    drawEmblem(g, emblem, goldGradient(g, color));
    g.save(); g.translate(-0.012, -0.015); g.globalAlpha = 0.35; drawEmblem(g, emblem, '#fff8e0'); g.restore();
    const [cm, gm] = canvas(S);
    gm.fillStyle = '#000'; gm.fillRect(0, 0, S, S);
    gm.translate(S / 2, S / 2); gm.scale(S * scale, S * scale);
    drawEmblem(gm, emblem, '#fff');
    return { map: finish(c), mask: finish(cm, { srgb: false }) };
  });
}

// Broad gold yoke collar with an engraved lotus and laurel (Pearl Lotus Shell). u around (0.5 = front).
export function yokeTexture() {
  return cached('yoke', () => {
    const W = 1024, H = 160;
    const [c, g] = canvas(W, H);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#f0cf73'); grd.addColorStop(0.5, '#d9ae4f'); grd.addColorStop(1, '#b88a35');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const eng = 'rgba(110,70,20,0.75)';
    g.save(); g.translate(W * 0.5, H * 0.52); g.scale(H * 0.42, H * 0.42); g.strokeStyle = eng; g.fillStyle = eng;
    drawEmblem(g, 'lotusline', eng); g.restore();
    for (const [x, a] of [[0.4, -1.57], [0.6, 1.57], [0.33, -1.57], [0.67, 1.57]]) smallSprig(g, W * x, H * 0.5, H * 0.16, a, eng);
    g.fillStyle = 'rgba(110,70,20,0.5)'; g.fillRect(0, 6, W, 3); g.fillRect(0, H - 9, W, 3);
    return finish(c);
  });
}

// ---- clothing patterns (mapped onto lathe UVs: u around (0.5 = front), v up from hem) ----
export function clothTexture(spec) {
  const key = `cloth:${JSON.stringify(spec)}`;
  return cached(key, () => {
    const W = 512, H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = spec.base; g.fillRect(0, 0, W, H);
    const r = rng(5);
    if (spec.stripesV) { // vertical stripe bands around (Joseph's coat / ephod)
      const cols = spec.stripesV; const n = cols.length * 4;
      for (let i = 0; i < n; i++) {
        g.fillStyle = cols[i % cols.length]; g.fillRect((i / n) * W, 0, W / n + 1, H);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect((i / n) * W, 0, 2, H);
      }
    }
    if (spec.stripesH) {
      const cols = spec.stripesH; const n = cols.length * 3;
      for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(0, (i / n) * H, W, H / n + 1); }
    }
    if (spec.clavi) { // two vertical stripes at the front
      g.fillStyle = spec.clavi;
      for (const u of [0.44, 0.56]) g.fillRect(u * W - 7, 0, 14, H);
      for (const u of [0.06, 0.94]) g.fillRect(u * W - 7, 0, 14, H);
    }
    if (spec.panel) { // side pleated panel (character's left side)
      g.fillStyle = spec.panel; g.fillRect(W * 0.58, 0, W * 0.2, H);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = W * 0.58; x < W * 0.78; x += 8) g.fillRect(x, 0, 2, H);
    }
    if (spec.diagonal) { // draped folds
      g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 5;
      for (let i = -6; i < 12; i++) { g.beginPath(); g.moveTo(i * 60, H); g.lineTo(i * 60 + 260, 0); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 10;
      for (let i = -6; i < 12; i++) { g.beginPath(); g.moveTo(i * 60 + 18, H); g.lineTo(i * 60 + 278, 0); g.stroke(); }
    }
    if (spec.pleats) {
      for (let x = 0; x < W; x += 16) {
        const grd = g.createLinearGradient(x, 0, x + 16, 0);
        grd.addColorStop(0, 'rgba(0,0,0,0.10)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.06)'); grd.addColorStop(1, 'rgba(0,0,0,0.10)');
        g.fillStyle = grd; g.fillRect(x, 0, 16, H * (spec.pleatsTop ?? 1));
      }
    }
    if (spec.quilt === 'vertical') { // padded vertical channels
      for (let x = 0; x < W; x += 40) {
        const grd = g.createLinearGradient(x, 0, x + 40, 0);
        grd.addColorStop(0, 'rgba(0,0,0,0.16)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.16)');
        g.fillStyle = grd; g.fillRect(x, 0, 40, H);
      }
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2.5; g.setLineDash([7, 6]);
      for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      g.setLineDash([]);
    } else if (spec.quilt === 'lotus') { // overlapping pointed petals
      for (let row = 0; row < 6; row++) {
        const y = H - row * 92 + 30;
        for (let x = row % 2 ? 0 : 42; x < W + 84; x += 84) {
          const grd = g.createLinearGradient(x, y - 110, x, y);
          grd.addColorStop(0, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.12)');
          g.fillStyle = grd;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 46, y - 50, x, y - 118); g.quadraticCurveTo(x - 46, y - 50, x, y); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.26)'; g.lineWidth = 2.5; g.setLineDash([7, 5]); g.stroke(); g.setLineDash([]);
        }
      }
    } else if (spec.quilt) {
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3; g.setLineDash([8, 6]);
      if (spec.quilt === 'petal') {
        for (let y = 0; y < H + 40; y += 46) for (let x = (y / 46) % 2 ? 23 : 0; x < W + 46; x += 46) { g.beginPath(); g.arc(x, y, 26, 0, Math.PI); g.stroke(); }
      } else {
        for (let x = 0; x < W; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
        for (let y = 0; y < H; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      }
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let x = 0; x < W; x += 42) for (let y = 0; y < H; y += 42) g.fillRect(x + 8, y + 8, 18, 18);
    }
    if (spec.scales) { // large rounded scales, bottom row first so upper rows overlap
      const sc = spec.scales, SW = 46, SH = 58, hw = SW / 2 - 1;
      for (let row = 0; row < 11; row++) {
        const y = H + 8 - row * (SH * 0.78);
        for (let x = row % 2 ? 0 : SW / 2; x < W + SW; x += SW) {
          const grd = g.createRadialGradient(x - 8, y - SH * 0.55, 2, x, y - SH * 0.3, SH * 0.6);
          grd.addColorStop(0, shade(sc, 0.2)); grd.addColorStop(1, shade(sc, -0.14));
          g.fillStyle = grd;
          g.beginPath(); g.moveTo(x - hw, y - SH); g.lineTo(x - hw, y - SH * 0.45); g.quadraticCurveTo(x - hw, y + 2, x, y + 4); g.quadraticCurveTo(x + hw, y + 2, x + hw, y - SH * 0.45); g.lineTo(x + hw, y - SH); g.fill();
          g.strokeStyle = spec.scaleEdge || 'rgba(0,0,0,0.35)'; g.lineWidth = spec.scaleEdge ? 4 : 2.5; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x - 3, y - SH * 0.8, 2, SH * 0.5);
        }
      }
    }
    if (spec.plates) {
      for (let row = 0; row < 6; row++) {
        const y = H - row * 88;
        for (let x = row % 2 ? 0 : 60; x < W + 120; x += 120) {
          g.fillStyle = shade(spec.base, row % 2 ? 0.05 : -0.03);
          g.beginPath(); g.ellipse(x, y - 40, 66, 52, 0, 0, 7); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.stroke();
          g.fillStyle = METALS.bronze;
          for (const dx of [-40, 0, 40]) { g.beginPath(); g.arc(x + dx, y - 80, 6, 0, 7); g.fill(); }
        }
      }
    }
    if (spec.wool) {
      for (let i = 0; i < 900; i++) {
        const x = r() * W, y = r() * H;
        g.fillStyle = shade(spec.base, -0.08 + r() * 0.12);
        g.beginPath(); g.arc(x, y, 6 + r() * 8, 0, 7); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2; g.stroke();
      }
    }
    if (spec.rough) {
      for (let i = 0; i < 5000; i++) {
        g.strokeStyle = `rgba(${r() < 0.5 ? '40,25,10' : '255,240,220'},${0.03 + r() * 0.05})`;
        g.lineWidth = 1 + r() * 1.5;
        const x = r() * W, y = r() * H, a = r() * 6.3;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke();
      }
    }
    // bands: [{v0, v1, color, pattern}]
    for (const b of spec.bands || []) {
      const y0 = H * (1 - b.v1), y1 = H * (1 - b.v0);
      g.fillStyle = b.color; g.fillRect(0, y0, W, y1 - y0);
      const hh = y1 - y0;
      if (b.pattern === 'geo') {
        g.fillStyle = b.fg || '#e8d29a';
        for (let x = 0; x < W; x += hh * 1.2) {
          g.beginPath(); g.moveTo(x + hh * 0.6, y0 + hh * 0.15); g.lineTo(x + hh * 1.0, y0 + hh * 0.5); g.lineTo(x + hh * 0.6, y0 + hh * 0.85); g.lineTo(x + hh * 0.2, y0 + hh * 0.5); g.fill();
          g.fillStyle = b.color; g.beginPath(); g.arc(x + hh * 0.6, y0 + hh * 0.5, hh * 0.12, 0, 7); g.fill(); g.fillStyle = b.fg || '#e8d29a';
        }
        g.fillRect(0, y0 + 2, W, 3); g.fillRect(0, y1 - 5, W, 3);
      } else if (b.pattern === 'leaf') {
        g.strokeStyle = b.fg || '#c9a24a'; g.fillStyle = b.fg || '#c9a24a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, y0 + hh / 2);
        for (let x = 0; x <= W; x += 20) g.lineTo(x, y0 + hh / 2 + Math.sin(x / 20) * hh * 0.15);
        g.stroke();
        for (let x = 10; x < W; x += 40) { g.beginPath(); g.ellipse(x, y0 + hh * 0.3, 6, 11, 0.6, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 20, y0 + hh * 0.7, 6, 11, -0.6, 0, 7); g.fill(); }
      } else if (b.pattern === 'olive') {
        g.fillStyle = b.fg || '#5e6a35';
        for (let x = 8; x < W; x += 26) { g.beginPath(); g.ellipse(x, y0 + hh * 0.5, 5, 10, (x / 26) % 2 ? 0.7 : -0.7, 0, 7); g.fill(); }
        g.fillStyle = '#6a3f5a';
        for (let x = 21; x < W; x += 52) { g.beginPath(); g.arc(x, y0 + hh * 0.5, 4, 0, 7); g.fill(); }
      } else if (b.pattern === 'beads') {
        g.fillStyle = b.fg || '#f3ecdc';
        for (let x = 6; x < W; x += 14) { g.beginPath(); g.arc(x, y0 + hh * 0.5, Math.min(5, hh * 0.35), 0, 7); g.fill(); }
      } else if (b.pattern === 'stitch') {
        g.strokeStyle = b.fg || '#efe6d2'; g.lineWidth = 3; g.setLineDash([10, 8]);
        g.beginPath(); g.moveTo(0, y0 + hh * 0.5); g.lineTo(W, y0 + hh * 0.5); g.stroke(); g.setLineDash([]);
      }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y0, W, 2); g.fillRect(0, y1 - 2, W, 2);
    }
    // weave overlay
    for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(0,0,0,${0.025 + r() * 0.03})`; g.fillRect(0, y, W, 1); }
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + r() * 0.05})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 3, 1);
    }
    return finish(c);
  });
}

// diagonal wrap for grips / braided cords
export function wrapTexture(color) {
  return cached(`wrap:${color}`, () => {
    const [c, g] = canvas(128);
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = shade(color, -0.18); g.lineWidth = 7;
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 24, 128); g.lineTo(i * 24 + 64, 0); g.stroke(); }
    g.strokeStyle = shade(color, 0.12); g.lineWidth = 3;
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 24 + 8, 128); g.lineTo(i * 24 + 72, 0); g.stroke(); }
    return finish(c, { repeat: [4, 1] });
  });
}

export function textLinesTexture() {
  return cached('scrolltext', () => {
    const [c, g] = canvas(256, 512);
    g.fillStyle = '#f2e6c8'; g.fillRect(0, 0, 256, 512);
    const r = rng(9);
    g.fillStyle = 'rgba(90,60,30,0.55)';
    for (let y = 40; y < 480; y += 22) {
      let x = 34;
      while (x < 220) { const w = 8 + r() * 26; g.fillRect(x, y, Math.min(w, 222 - x), 5); x += w + 7; }
    }
    g.strokeStyle = 'rgba(120,80,40,0.35)'; g.lineWidth = 6; g.strokeRect(16, 16, 224, 480);
    return finish(c);
  });
}

export function floorTexture(kind = 'studio') {
  return cached(`floor:${kind}`, () => {
    const S = 512;
    const [c, g] = canvas(S);
    const grd = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(190,150,100,0.55)'); grd.addColorStop(0.45, 'rgba(210,175,125,0.25)'); grd.addColorStop(1, 'rgba(230,210,180,0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    return finish(c);
  });
}

// Jerusalem limestone pavers
export function stoneTexture(seed = 1, base = '#d9c7a3') {
  return cached(`stone:${seed}:${base}`, () => {
    const S = 256;
    const [c, g] = canvas(S);
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${r() < 0.6 ? '120,90,50' : '255,250,235'},${0.04 + r() * 0.08})`;
      const s = 1 + r() * 5;
      g.fillRect(r() * S, r() * S, s, s);
    }
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(110,80,45,${0.08 + r() * 0.1})`; g.lineWidth = 1 + r();
      g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
    const grd = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75);
    grd.addColorStop(0, 'rgba(255,255,255,0.05)'); grd.addColorStop(1, 'rgba(90,60,30,0.28)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    return finish(c);
  });
}

export function mosaicTexture() {
  return cached('mosaic', () => {
    const S = 1024;
    const [c, g] = canvas(S);
    g.fillStyle = '#e8d8b6'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    const ring = (r0, r1, n, cols) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        g.fillStyle = cols[i % cols.length];
        g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.fill();
      }
    };
    ring(440, 500, 64, ['#9b3a26', '#e8d8b6']);
    ring(400, 440, 1, ['#c9a24a']);
    ring(170, 400, 1, ['#efe3c8']);
    g.save(); g.scale(330, 330); drawEmblem(g, 'star', '#3d5a96'); g.restore();
    g.save(); g.scale(150, 150); drawEmblem(g, 'petal8', '#c9a24a'); g.restore();
    ring(150, 170, 32, ['#3d5a96', '#efe3c8']);
    // tesserae grid
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = 'rgba(60,40,20,0.13)'; g.lineWidth = 1.5;
    for (let x = 0; x < S; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
    for (let y = 0; y < S; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    return finish(c);
  });
}

export function skyTexture() {
  return cached('sky', () => {
    const [c, g] = canvas(16, 512);
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#5f8fc4'); grd.addColorStop(0.45, '#a9c4dc'); grd.addColorStop(0.62, '#f4d8a8'); grd.addColorStop(0.75, '#f0b97a'); grd.addColorStop(1, '#e9c79b');
    g.fillStyle = grd; g.fillRect(0, 0, 16, 512);
    return finish(c);
  });
}

export function radialGlow(color = '#fff4cf') {
  return cached(`glow:${color}`, () => {
    const [c, g] = canvas(128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return finish(c);
  });
}
