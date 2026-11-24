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
  t.anisotropy = 4;
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

// ---- base noise / weave -------------------------------------------------
export function weaveTexture() {
  return cached('weave', () => {
    const [c, g] = canvas(256);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
    const r = rng(7);
    for (let y = 0; y < 256; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`; g.fillRect(0, y, 256, 1);
    }
    for (let x = 0; x < 256; x += 2) {
      g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; g.fillRect(x, 0, 1, 256);
    }
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.07})`;
      g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1);
    }
    return finish(c, { repeat: [3, 3] });
  });
}
export function noiseBump() {
  return cached('bump', () => {
    const [c, g] = canvas(128);
    const img = g.createImageData(128, 128);
    const r = rng(3);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + r() * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return finish(c, { repeat: [4, 4], srgb: false });
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
      color: METALS[name] || name, metalness: 0.82, roughness: opts.rough ?? 0.36,
      bumpMap: noiseBump(), bumpScale: 0.4,
    })));
  }
  return matCache.get(key);
}
export function fabric(color, opts = {}) {
  const key = `fabric:${color}:${opts.rough ?? ''}:${opts.side ?? ''}`;
  if (!matCache.has(key)) {
    matCache.set(key, keep(new THREE.MeshStandardMaterial({
      color, map: weaveTexture(), roughness: opts.rough ?? 0.92, metalness: 0,
      side: opts.side ?? THREE.FrontSide,
    })));
  }
  return matCache.get(key);
}
export function leather(color) {
  const key = `leather:${color}`;
  if (!matCache.has(key)) {
    matCache.set(key, keep(new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, bumpMap: noiseBump(), bumpScale: 0.8 })));
  }
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
    if (spec.quilt) {
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
    if (spec.scales) {
      const sc = spec.scales;
      for (let row = 0; row < 15; row++) {
        const y = H - row * 36;
        for (let x = row % 2 ? 0 : 18; x < W + 36; x += 36) {
          const grd = g.createRadialGradient(x - 6, y - 26, 2, x, y - 16, 26);
          grd.addColorStop(0, shade(sc, 0.18)); grd.addColorStop(1, shade(sc, -0.12));
          g.fillStyle = grd;
          g.beginPath(); g.moveTo(x - 17, y - 34); g.lineTo(x - 17, y - 14); g.quadraticCurveTo(x - 17, y + 2, x, y + 4); g.quadraticCurveTo(x + 17, y + 2, x + 17, y - 14); g.lineTo(x + 17, y - 34); g.fill();
          g.strokeStyle = spec.scaleEdge || 'rgba(0,0,0,0.3)'; g.lineWidth = spec.scaleEdge ? 3 : 2; g.stroke();
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
