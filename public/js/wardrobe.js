// Procedural 3D builders for every wardrobe item. Each builder returns [{joint, obj}].
import * as THREE from 'three';
import {
  fabric, leather, metal, plain, gemMat, isMetal, colorOf, METALS, shade,
  clothTexture, emblemTexture, emblemBump, wrapTexture, textLinesTexture, radialGlow,
} from './textures.js';
import { ellipticLathe, profileR, ZS } from './character.js';
import { ITEM_MAP } from './catalog.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P2 = (x, y) => new THREE.Vector2(x, y);

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (!m.userData?.keep) m.dispose();
  });
}

function mesh(geo, mat, pos, rot, scl) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.copy(pos);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scl) m.scale.copy(scl);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}
const grp = (...kids) => { const g = new THREE.Group(); for (const k of kids) g.add(k); return g; };
const part = (joint, obj) => ({ joint, obj });
const clothMat = (spec, opts = {}) => new THREE.MeshStandardMaterial({ map: clothTexture(spec), roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0, side: opts.side ?? THREE.FrontSide });
const matOf = (v, kind) => (isMetal(v) ? metal(v) : kind === 'leather' ? leather(v) : fabric(v));

// ---------------------------------------------------------------- clothing geometry helpers
const HIP_Y = 0.92;
function bodicePoints(P, yBottom = -0.03, yTop = 0.47, neck = 0.07) {
  const pts = P.torso.filter(([, y]) => y >= yBottom && y <= yTop).map((p) => p.slice());
  if (pts[0][1] > yBottom) pts.unshift([profileR(P.torso, yBottom), yBottom]);
  pts.push([neck, 0.505]);
  return pts;
}
function skirtPoints(hemWorld, hemR, topR = 0.138, topY = 0.09, steps = 8) {
  const hemY = hemWorld - HIP_Y;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = hemY + (topY - hemY) * t;
    const r = topR + (hemR - topR) * Math.pow(1 - t, 1.45);
    pts.push([r, y]);
  }
  return pts;
}
const HEM = { knee: 0.46, calf: 0.31, ankle: 0.115, thigh: 0.66, hip: 0.76 };

function sleeve(P, mat, { len = 'short', off = 0, band = null, flare = 0 } = {}) {
  const parts = [];
  const h = len === 'short' ? 0.13 : len === 'elbow' ? 0.23 : 0.27;
  const r0 = P.armR + 0.017 + off, r1 = P.armR + (len === 'short' ? 0.024 : 0.03) + off + flare;
  for (const s of ['L', 'R']) {
    const g = new THREE.Group();
    const cyl = mesh(new THREE.CylinderGeometry(r0, r1, h, 18, 1, true), mat, V(0, -h / 2 + 0.01, 0));
    cyl.material = mat; g.add(cyl);
    const cap = mesh(new THREE.SphereGeometry(r0 + 0.008, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat, V(0, 0.0, 0), null, V(1, 0.9, 1));
    g.add(cap);
    if (band) g.add(mesh(new THREE.TorusGeometry(r1, 0.008, 6, 20), band, V(0, -h + 0.012, 0), [Math.PI / 2, 0, 0]));
    parts.push(part(`uArm${s}`, g));
  }
  return parts;
}
function forearmSleeves(P, mat, { flare = 0.035, band = null, off = 0 } = {}) {
  const parts = [];
  for (const s of ['L', 'R']) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(P.foreR + 0.03 + off, P.foreR + 0.03 + flare + off, 0.21, 18, 1, true), mat, V(0, -0.1, 0)));
    if (band) g.add(mesh(new THREE.TorusGeometry(P.foreR + 0.03 + flare + off, 0.009, 6, 20), band, V(0, -0.205, 0), [Math.PI / 2, 0, 0]));
    parts.push(part(`fArm${s}`, g));
  }
  return parts;
}

// ---------------------------------------------------------------- TUNICS
function buildTunic(L, ctx) {
  const P = ctx.P, parts = [];
  const dress = L.kind === 'dress';
  const trim = L.trim || shade(L.color, -0.1);
  const bodSpec = { base: L.drape || L.color, bands: [{ v0: 0.9, v1: 1, color: L.collar || trim, pattern: L.beads ? 'beads' : null, fg: L.beads }] };
  if (L.stripes) bodSpec.clavi = L.stripes;
  if (L.drape) bodSpec.diagonal = true;
  const bod = mesh(ellipticLathe(bodicePoints(P), { off: 0.012 }), clothMat(bodSpec));
  parts.push(part('torso', bod));

  // sleeves
  const sleeveBand = L.sleeveBand === 'olive'
    ? null : (dress ? null : fabric(trim));
  const sleeveMat = L.sleeveBand === 'olive'
    ? clothMat({ base: L.color, bands: [{ v0: 0.0, v1: 0.3, color: shade(L.color, -0.05), pattern: 'olive', fg: '#c9a24a' }] })
    : fabric(L.color);
  parts.push(...sleeve(P, sleeveMat, { len: L.sleeve, band: sleeveBand }));

  // skirt(s)
  const hemW = HEM[L.len] ?? HEM.knee;
  const hemR = dress ? 0.29 : 0.235;
  const skSpec = { base: L.color, bands: [], pleats: !!L.pleats };
  if (L.stripes) skSpec.clavi = L.stripes;
  if (L.panel) skSpec.panel = L.panel;
  if (!dress) skSpec.bands.push({ v0: 0, v1: 0.07, color: trim });
  if (L.hem === 'geo') skSpec.bands.push({ v0: 0.03, v1: 0.15, color: shade(L.color, -0.06), pattern: 'geo', fg: L.trim });
  if (L.hem === 'leaf') skSpec.bands.push({ v0: 0.03, v1: 0.12, color: L.layer ? shade(L.layer, -0.03) : L.color, pattern: 'leaf', fg: L.trim });

  if (L.drape) {
    // cream underdress + mulberry draped overskirt + diagonal sash
    parts.push(part('hips', mesh(ellipticLathe(skirtPoints(hemW, hemR), { off: 0.012, zs: 1.02, zsTop: 0.8 }), fabric(L.color))));
    const over = mesh(ellipticLathe(skirtPoints(HEM.calf + 0.06, 0.29, 0.152), { off: 0.028, zs: 1.02, zsTop: 0.8 }), clothMat({ base: L.drape, diagonal: true }));
    parts.push(part('hips', over));
    const sash = mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 32), fabric(shade(L.drape, -0.04)), V(0, 0.2, 0.0), [0.15, 0, 0.85], V(1.0, 1.25, 0.82));
    parts.push(part('torso', sash));
  } else if (L.layer) {
    parts.push(part('hips', mesh(ellipticLathe(skirtPoints(hemW, hemR), { off: 0.012, zs: 1.02, zsTop: 0.8 }), clothMat({ base: L.layer, bands: [{ v0: 0.02, v1: 0.1, color: shade(L.layer, -0.04), pattern: 'leaf', fg: L.trim }] }))));
    parts.push(part('hips', mesh(ellipticLathe(skirtPoints(HEM.calf + 0.05, 0.28, 0.152), { off: 0.026, zs: 1.02, zsTop: 0.8 }), clothMat({ base: L.color, bands: [{ v0: 0.03, v1: 0.12, color: L.color, pattern: 'leaf', fg: L.trim }] }))));
  } else {
    parts.push(part('hips', mesh(ellipticLathe(skirtPoints(hemW, hemR), { off: 0.014, zs: 1.02, zsTop: 0.8 }), clothMat(skSpec))));
  }
  if (L.under) {
    const under = mesh(ellipticLathe([[0.215, HEM.calf - HIP_Y], [0.205, -0.5], [0.19, -0.38]], { off: 0, zs: 0.9 }), fabric(L.under));
    parts.push(part('hips', under));
  }
  return parts;
}

// ---------------------------------------------------------------- OUTER (bonus robes)
function buildOuter(L, ctx) {
  const P = ctx.P, parts = [];
  switch (L.kind) {
    case 'robe': {
      const gap = L.open ? 0.75 : 0;
      const spec = L.stripes ? { base: L.stripes[0], stripesV: L.stripes, bands: [{ v0: 0, v1: 0.05, color: '#e8dcc4', pattern: 'geo', fg: '#a33b2c' }] } : { base: L.color, bands: [] };
      const side = gap ? THREE.DoubleSide : THREE.FrontSide;
      const offB = L.open ? 0.052 : 0.022;
      parts.push(part('torso', mesh(ellipticLathe(bodicePoints(P, -0.04, 0.47, 0.085), { off: offB, phiStart: gap / 2, phiLength: Math.PI * 2 - gap }), clothMat({ ...spec, bands: [] }, { side }))));
      parts.push(part('hips', mesh(ellipticLathe(skirtPoints(HEM[L.len], 0.32, 0.17, 0.12), { off: L.open ? 0.05 : 0.03, zs: 1.02, zsTop: 0.8, phiStart: gap * 0.6, phiLength: Math.PI * 2 - gap * 1.2 }), clothMat(spec, { side }))));
      const sm = L.stripes ? clothMat({ base: L.stripes[0], stripesH: L.stripes }) : fabric(L.color);
      const band = L.stripes ? fabric('#e8dcc4') : null;
      parts.push(...sleeve(P, sm, { len: L.sleeves === 'long' ? 'long' : 'elbow', off: 0.012 }));
      if (L.sleeves === 'long') parts.push(...forearmSleeves(P, sm, { band, off: 0.004 }));
      if (L.bells) {
        const hemY = HEM[L.len] - HIP_Y + 0.01;
        const g = new THREE.Group();
        const cols = ['#2c4a9a', '#6a2f7a', '#b02a2a'];
        const N = 22;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          const x = Math.sin(a) * 0.35, z = Math.cos(a) * (0.32 * 0.92 + 0.03);
          if (i % 2) {
            const b = mesh(new THREE.SphereGeometry(0.02, 10, 8), metal('gold'), V(x, hemY - 0.015, z), null, V(1, 1.1, 1));
            g.add(b);
          } else {
            g.add(mesh(new THREE.SphereGeometry(0.021, 10, 8), fabric(cols[(i / 2) % 3]), V(x, hemY - 0.018, z)));
            g.add(mesh(new THREE.ConeGeometry(0.01, 0.02, 6), fabric(cols[(i / 2) % 3]), V(x, hemY + 0.006, z)));
          }
        }
        parts.push(part('hips', g));
      }
      break;
    }
    case 'mantle': {
      const pts = [[0.36, HEM.calf - 0.96], [0.34, -0.3], [0.31, 0.0], [0.29, 0.22], [0.26, 0.37], [0.19, 0.46], [0.1, 0.51]];
      const gap = 1.3;
      const m = mesh(ellipticLathe(pts, { zs: 0.82, phiStart: gap / 2, phiLength: Math.PI * 2 - gap }), clothMat({ base: L.color, rough: true, bands: [{ v0: 0, v1: 0.05, color: shade(L.color, -0.05), pattern: 'stitch', fg: L.stitch }] }, { side: THREE.DoubleSide }));
      parts.push(part('torso', m));
      const tie = grp(
        mesh(new THREE.SphereGeometry(0.018, 10, 8), leather('#3a2418'), V(0, 0.475, 0.1)),
        mesh(new THREE.CapsuleGeometry(0.006, 0.06, 4, 6), leather('#3a2418'), V(-0.01, 0.43, 0.105), [0, 0, 0.2]),
        mesh(new THREE.CapsuleGeometry(0.006, 0.05, 4, 6), leather('#3a2418'), V(0.012, 0.435, 0.105), [0, 0, -0.25]),
      );
      parts.push(part('torso', tie));
      break;
    }
    case 'rough': {
      const mat = clothMat({ base: L.color, rough: true });
      parts.push(part('torso', mesh(ellipticLathe(bodicePoints(P, -0.04), { off: 0.024 }), mat)));
      parts.push(part('hips', mesh(ellipticLathe(skirtPoints(HEM[L.len], 0.27, 0.165), { off: 0.03, zs: 1.02, zsTop: 0.8 }), mat)));
      parts.push(...sleeve(P, mat, { len: 'elbow', off: 0.01 }));
      const belt = mesh(new THREE.CylinderGeometry(1, 1, 0.055, 40, 1, true), leather(L.belt), V(0, 0.02, 0), null, V(0.185, 1, 0.168));
      parts.push(part('hips', belt));
      break;
    }
    case 'ephod': {
      const spec = { base: L.stripes[0], stripesV: L.stripes };
      parts.push(part('torso', mesh(ellipticLathe(bodicePoints(P, -0.04, 0.42, 0.11), { off: 0.024 }), clothMat(spec))));
      parts.push(part('hips', mesh(ellipticLathe(skirtPoints(HEM.hip - 0.04, 0.2, 0.165), { off: 0.032, zs: 1.02, zsTop: 0.8 }), clothMat(spec))));
      const wb = mesh(new THREE.CylinderGeometry(1, 1, 0.06, 40, 1, true), clothMat({ base: L.stripes[3], stripesH: L.stripes }), V(0, 0.03, 0), null, V(0.19, 1, 0.172));
      parts.push(part('hips', wb));
      for (const s of [-1, 1]) {
        const sh = grp(
          mesh(new THREE.BoxGeometry(0.07, 0.03, 0.15), clothMat(spec), V(0, 0, 0)),
          mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 18), metal('gold'), V(0, 0.018, 0.03), [Math.PI / 2, 0, 0]),
          mesh(new THREE.SphereGeometry(0.023, 14, 10), gemMat('#18181c'), V(0, 0.02, 0.03), null, V(1, 0.5, 1)),
        );
        sh.position.set(s * 0.1, 0.48, 0);
        sh.rotation.z = -s * 0.25;
        parts.push(part('torso', sh));
      }
      break;
    }
    case 'shawl': {
      const pts = [[0.27, 0.12], [0.27, 0.25], [0.25, 0.38], [0.19, 0.46], [0.1, 0.51]];
      const gap = 0.9;
      parts.push(part('torso', mesh(ellipticLathe(pts, { zs: 0.86, phiStart: gap / 2, phiLength: Math.PI * 2 - gap }),
        clothMat({ base: L.color, diagonal: true, bands: [{ v0: 0, v1: 0.12, color: L.trim, pattern: 'geo', fg: L.color }] }, { side: THREE.DoubleSide }))));
      parts.push(part('torso', mesh(new THREE.SphereGeometry(0.022, 10, 8), metal('gold'), V(0, 0.44, 0.13))));
      break;
    }
    case 'fleece': {
      const mat = new THREE.MeshStandardMaterial({ map: clothTexture({ base: L.color, wool: true }), roughness: 1, bumpMap: clothTexture({ base: '#808080', wool: true }), bumpScale: 3 });
      parts.push(part('torso', mesh(ellipticLathe(bodicePoints(P, -0.05, 0.44, 0.12), { off: 0.055 }), mat)));
      parts.push(part('hips', mesh(ellipticLathe(skirtPoints(HEM.hip, 0.22, 0.19), { off: 0.04, zs: 1.02, zsTop: 0.8 }), mat)));
      for (const s of [-1, 1]) {
        const ring = mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 18), mat, V(s * (P.shoulderX - 0.005), 0.4, 0), [0, Math.PI / 2, 0], V(1, 1.1, 1));
        parts.push(part('torso', ring));
      }
      break;
    }
    default: break;
  }
  return parts;
}

// ---------------------------------------------------------------- BREASTPLATE
function emblemDisc(r, bg, emblem, fg, { metalness = 0.7, rim = null } = {}) {
  let mat;
  if (isMetal(bg)) {
    // true metal with an embossed, slightly darker emblem
    const tex = emblemTexture('#ffffff', emblem, '#b9b0a4', { scale: 0.38 });
    mat = new THREE.MeshStandardMaterial({ color: METALS[bg], map: tex, metalness: 0.85, roughness: 0.3, bumpMap: emblemBump(emblem, 0.38), bumpScale: 5 });
  } else {
    const tex = emblemTexture(colorOf(bg), emblem, colorOf(fg), { scale: 0.38 });
    mat = new THREE.MeshStandardMaterial({ map: tex, metalness, roughness: 0.4, bumpMap: emblemBump(emblem, 0.38), bumpScale: 2 });
  }
  const g = new THREE.Group();
  g.add(mesh(new THREE.CircleGeometry(r, 32), mat, V(0, 0, 0.004)));
  g.add(mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.06, 0.008, 32), rim || metal(isMetal(bg) ? bg : 'bronze'), null, [Math.PI / 2, 0, 0]));
  if (rim !== false) g.add(mesh(new THREE.TorusGeometry(r, 0.006, 6, 32), rim || metal(isMetal(bg) ? bg : 'bronze'), V(0, 0, 0.004)));
  return g;
}

function buildBreastplate(L, ctx) {
  const P = ctx.P, parts = [];
  const off = ctx.hasOuter ? 0.05 : 0.038;
  const pts = bodicePoints(P, -0.025, 0.45, 0.1);
  let mat, shoulders = false, shoulderMat;
  switch (L.style) {
    case 'quilt':
      mat = clothMat({ base: L.color, quilt: L.petal ? 'petal' : 'grid', bands: [{ v0: 0.9, v1: 1, color: L.collar ? METALS[L.collar] : shade(L.color, -0.06) }] });
      break;
    case 'vest':
      mat = L.leather ? new THREE.MeshStandardMaterial({ color: L.color, roughness: 0.6, bumpMap: emblemBump(null), bumpScale: 0.5 }) : clothMat({ base: L.color, quilt: 'grid' });
      break;
    case 'bands': mat = leather(L.color); shoulders = true; shoulderMat = leather(shade(L.color, -0.05)); break;
    case 'scales':
      mat = clothMat({ base: L.color, scales: colorOf(L.scale), scaleEdge: L.edgeC }, { metal: isMetal(L.scale) || L.edgeC ? 0.45 : 0.1, rough: 0.5 });
      shoulders = true; shoulderMat = fabric(L.color);
      break;
    case 'plates':
      mat = new THREE.MeshStandardMaterial({ map: clothTexture({ base: L.color, plates: true }), roughness: 0.6, metalness: 0.05 });
      shoulders = true; shoulderMat = leather(shade(L.color, 0.04));
      break;
    case 'cuirass':
      mat = L.metal ? metal(L.metal, { rough: 0.32 }) : new THREE.MeshStandardMaterial({ color: L.color, roughness: 0.42, metalness: 0.35 });
      shoulders = true; shoulderMat = L.sideMetal ? metal(L.sideMetal) : mat;
      break;
    default: mat = fabric(L.color || '#ccc');
  }
  const shell = mesh(ellipticLathe(pts, { off }), mat);
  parts.push(part('torso', shell));
  const deco = new THREE.Group();
  parts.push(part('torso', deco));
  const front = (y, extra = 0) => ctx.front(y, off + extra);

  // bottom edge & collar trims
  const edgeMat = L.edge ? metal(L.edge) : L.style === 'cuirass' && L.metal ? metal(L.metal) : null;
  if (edgeMat || L.style === 'cuirass' || L.style === 'plates') {
    const rB = profileR(P.torso, -0.02);
    const ring = mesh(new THREE.TorusGeometry(1, 0.012, 6, 48), edgeMat || (L.sideMetal ? metal(L.sideMetal) : leather(shade(L.color || '#555', -0.1))), V(0, -0.02, 0), [Math.PI / 2, 0, 0], V(rB + off, ZS * rB + off, 1));
    deco.add(ring);
  }
  if (L.style === 'cuirass' || L.collar || L.style === 'plates') {
    const collarMat = L.collar ? metal(L.collar) : L.style === 'plates' ? leather(shade(L.color, -0.08)) : (L.sideMetal ? metal(L.sideMetal) : mat);
    const c = mesh(new THREE.TorusGeometry(1, L.style === 'plates' ? 0.022 : 0.016, 8, 40), collarMat, V(0, 0.455, 0), [Math.PI / 2 - 0.08, 0, 0], V(0.112, 0.092, 1));
    deco.add(c);
  }
  if (L.style === 'bands') {
    for (let k = 0; k < (L.count || 4); k++) {
      const y = 0.05 + k * 0.095, r = profileR(P.torso, y);
      deco.add(mesh(new THREE.TorusGeometry(1, 0.016, 8, 48), leather(shade(L.color, 0.06)), V(0, y, 0), [Math.PI / 2, 0, 0], V(r + off + 0.004, ZS * r + off + 0.004, 1.2)));
    }
  }
  if (L.layers) {
    for (const y of [0.12, 0.25]) {
      const r = profileR(P.torso, y);
      deco.add(mesh(new THREE.TorusGeometry(1, 0.011, 6, 48), fabric(shade(L.color, -0.07)), V(0, y, 0), [Math.PI / 2, 0, 0], V(r + off + 0.003, ZS * r + off + 0.003, 1)));
    }
  }
  if (L.style === 'plates') {
    for (let i = -3; i <= 3; i++) {
      const y = 0.44 - Math.abs(i) * 0.006;
      deco.add(mesh(new THREE.SphereGeometry(0.009, 8, 6), metal('bronze'), V(i * 0.03, y - 0.03, front(y - 0.03, 0.006))));
    }
  }
  if (L.side) {
    for (const s of [-1, 1]) {
      const strip = mesh(new THREE.BoxGeometry(0.02, 0.44, 0.06), fabric(L.side), V(s * (profileR(P.torso, 0.2) + off - 0.004), 0.21, 0));
      deco.add(strip);
    }
  }
  if (L.sideMetal) {
    for (let k = 0; k < 4; k++) {
      const y = 0.02 + k * 0.05, r = profileR(P.torso, y);
      for (const s of [-1, 1]) {
        const arc = mesh(new THREE.TorusGeometry(1, 0.02, 6, 16, 1.2), metal(L.sideMetal), V(0, y, 0), [Math.PI / 2, 0, s > 0 ? -0.6 : Math.PI - 0.6], V(r + off + 0.005, ZS * r + off + 0.005, 1));
        deco.add(arc);
      }
    }
  }
  const emblem = L.emblem || L.medallion;
  if (emblem) {
    const y = L.style === 'cuirass' ? 0.28 : 0.3;
    const metalBg = L.metal || L.sideMetal || L.collar || 'bronze';
    const disc = emblemDisc(L.style === 'cuirass' ? 0.065 : 0.055, L.style === 'cuirass' && !L.metal ? L.color : metalBg, emblem, L.style === 'cuirass' && !L.metal ? '#e0b04f' : shade(colorOf(metalBg), -0.22), { rim: L.style === 'cuirass' && L.metal ? false : null });
    disc.position.set(0, y, front(y, 0.002));
    disc.rotation.x = -0.12;
    deco.add(disc);
  }
  if (L.gem) {
    const y = 0.3;
    deco.add(mesh(new THREE.SphereGeometry(0.026, 18, 12), gemMat(L.gem), V(0, y, front(y, 0.008)), null, V(1, 1.2, 0.55)));
    deco.add(mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 20), metal('gold'), V(0, y, front(y, 0.006)), null, V(1, 1.2, 1)));
  }
  if (shoulders) {
    for (const s of [-1, 1]) {
      const pad = mesh(new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), shoulderMat || mat, V(s * (P.shoulderX + 0.005), 0.44, 0), [0, 0, -s * 0.5], V(1, 0.75, 1.05));
      deco.add(pad);
      if (L.style === 'cuirass') deco.add(mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 20), shoulderMat || mat, V(s * (P.shoulderX + 0.035), 0.43, 0), [0, Math.PI / 2, -s * 0.5 + 0.1]));
    }
  } else {
    // soft shoulder bands
    for (const s of [-1, 1]) {
      deco.add(mesh(new THREE.BoxGeometry(0.075, 0.022, 0.15), mat, V(s * 0.1, 0.465, 0), [0, 0, -s * 0.32]));
    }
  }
  return parts;
}

// ---------------------------------------------------------------- BELT
function buildBelt(L, ctx) {
  const g = new THREE.Group();
  const out = ctx.outfit?.outer && ['rough', 'ephod', 'robe'].includes(ctx.outerKind) ? 0.016 : 0;
  const rx = 0.178 + out, rz = 0.158 + out;
  const y = 0.03;
  const isCord = L.style === 'cord';
  const h = L.style === 'sash' ? 0.068 : L.wide ? 0.06 : L.style === 'double' ? 0.03 : 0.045;
  const bandMat = L.style === 'strap' ? leather(L.color) : isCord ? new THREE.MeshStandardMaterial({ map: wrapTexture(L.color), roughness: 0.8 }) : fabric(L.color);
  const trimMat = L.edge ? fabric(L.edge) : null;
  const band = (yy, hh, scale = 1) => {
    const b = mesh(new THREE.CylinderGeometry(1, 1, hh, 48, 1, true), bandMat, V(0, yy, 0), null, V(rx * scale, 1, rz * scale));
    b.material.side = THREE.DoubleSide;
    g.add(b);
    if (trimMat) for (const e of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(1, 0.0045, 4, 48), trimMat, V(0, yy + e * hh / 2, 0), [Math.PI / 2, 0, 0], V(rx * scale + 0.002, rz * scale + 0.002, 1)));
  };
  if (isCord) {
    for (const dy of [-0.012, 0.012]) g.add(mesh(new THREE.TorusGeometry(1, 0.014, 8, 48), bandMat, V(0, y + dy, 0), [Math.PI / 2, 0, 0], V(rx, rz, 1)));
    if (trimMat) g.add(mesh(new THREE.TorusGeometry(1, 0.006, 6, 48), trimMat, V(0, y, 0), [Math.PI / 2, 0, 0], V(rx + 0.012, rz + 0.012, 1)));
  } else if (L.style === 'double') {
    band(y - 0.018, 0.028); band(y + 0.016, 0.028, 1.01);
  } else band(y, h);

  const fz = rz + 0.012;
  const met = metal(L.metal || 'bronze');
  // knot / clasp
  if (L.knot) {
    const kx = L.side ? 0.07 : 0;
    g.add(mesh(new THREE.SphereGeometry(0.03, 14, 10), fabric(shade(L.color, -0.03)), V(kx, y, fz - 0.004), null, V(1.25, 0.9, 0.7)));
    if (L.rosette) g.add(emblemDisc(0.026, L.rosette, 'rosette', shade(L.rosette, -0.25), { metalness: 0, rim: false }).translateX(kx).translateY(y).translateZ(fz + 0.016));
  }
  if (L.tails) {
    const kx = L.side ? 0.07 : 0;
    for (const s of [-1, 1]) {
      const t = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.008), fabric(L.color), V(kx + s * 0.018, y - 0.07, fz + 0.002), [0.05, 0, s * 0.14]);
      g.add(t);
    }
  }
  if (L.toggle) {
    g.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 10), leather(L.toggle), V(0, y, fz + 0.006), [0, 0, Math.PI / 2]));
    for (const s of [-1, 1]) g.add(mesh(new THREE.CapsuleGeometry(0.008, 0.06, 4, 6), bandMat, V(s * 0.015, y - 0.05, fz + 0.002), [0, 0, s * 0.15]));
  }
  switch (L.buckle) {
    case 'rect': {
      const fr = mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 4), met, V(0, y, fz), [0, 0, Math.PI / 4], V(1.3, 1, 1));
      g.add(fr);
      g.add(mesh(new THREE.BoxGeometry(0.04, 0.018, 0.006), leather(L.color), V(0.04, y, fz + 0.002)));
      break;
    }
    case 'round': g.add(emblemDisc(0.03, L.metal || 'bronze', null, L.metal || 'bronze', { rim: met }).translateY(y).translateZ(fz)); break;
    case 'leaf': g.add(mesh(new THREE.SphereGeometry(0.03, 14, 10), met, V(0, y, fz), [0, 0, 0.5], V(1.6, 0.6, 0.45))); break;
    case 'almond': {
      g.add(mesh(new THREE.SphereGeometry(0.032, 16, 10), met, V(0, y, fz), null, V(1.5, 0.8, 0.4)));
      if (L.gem) g.add(mesh(new THREE.SphereGeometry(0.017, 14, 10), gemMat(L.gem), V(0, y, fz + 0.012), null, V(1.2, 1, 0.7)));
      break;
    }
    case 'lily': g.add(emblemDisc(0.032, L.metal || 'bronze', 'lily', shade(colorOf(L.metal || 'bronze'), -0.25), { rim: met }).translateY(y).translateZ(fz)); break;
    case 'loops': for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20), met, V(s * 0.014, y, fz + 0.004))); break;
    default: break;
  }
  if (L.plates) {
    for (const ang of [-0.55, 0, 0.55]) {
      if (ang === 0 && L.buckle) continue;
      const x = Math.sin(ang) * (rx + 0.008), z = Math.cos(ang) * (rz + 0.008);
      const d = emblemDisc(0.026, L.metal || 'bronze', L.tassel ? 'seeds' : null, shade(colorOf(L.metal || 'bronze'), -0.25), { rim: met });
      d.position.set(x, y, z); d.rotation.y = ang;
      g.add(d);
    }
  }
  if (L.tassel) {
    g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6), fabric(L.tassel), V(0.02, y - 0.04, fz + 0.004)));
    g.add(mesh(new THREE.ConeGeometry(0.014, 0.05, 10), fabric(L.tassel), V(0.02, y - 0.08, fz + 0.004)));
  }
  return [part('hips', g)];
}

// ---------------------------------------------------------------- SHOES
function buildShoes(L, ctx) {
  const parts = [];
  const strapMat = L.rope ? new THREE.MeshStandardMaterial({ map: wrapTexture(L.color), roughness: 0.8 }) : leather(L.color);
  const strap2 = L.color2 ? leather(L.color2) : strapMat;
  const soleMat = leather(L.sole || '#5c3d24');
  const soleShape = new THREE.Shape();
  { // footprint
    const w = 0.052, z0 = -0.06, z1 = 0.16;
    soleShape.moveTo(-w * 0.85, z0 + 0.03);
    soleShape.quadraticCurveTo(-w * 0.85, z0, 0, z0);
    soleShape.quadraticCurveTo(w * 0.85, z0, w * 0.85, z0 + 0.03);
    soleShape.lineTo(w, z1 - 0.06);
    soleShape.quadraticCurveTo(w, z1, 0, z1);
    soleShape.quadraticCurveTo(-w, z1, -w, z1 - 0.06);
    soleShape.closePath();
  }
  const soleGeo = new THREE.ExtrudeGeometry(soleShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const g = new THREE.Group();
    const sole = mesh(soleGeo, soleMat, V(0, -0.072, 0), [Math.PI / 2, 0, 0]);
    g.add(sole);
    // straps over the forefoot
    for (const [i, t] of (L.bands || []).entries()) {
      const z = -0.05 + t * 0.2;
      const w = L.wide ? 0.022 : 0.012;
      const arc = mesh(new THREE.TorusGeometry(0.05, w * 0.55, 6, 18, Math.PI), i % 2 ? strap2 : strapMat, V(0, -0.068, z), [0, 0, 0], V(1.05, 0.62 + (1 - t) * 0.3, L.wide ? 2.2 : 1));
      g.add(arc);
      if (L.cross && i === 0) {
        for (const a of [-0.55, 0.55]) g.add(mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 18, Math.PI), strapMat, V(0, -0.068, z - 0.04), [0, a, 0], V(1.05, 0.75, 1)));
      }
    }
    if (L.ankle || L.high) {
      g.add(mesh(new THREE.TorusGeometry(0.058, 0.0075, 6, 22), strapMat, V(0, -0.012, 0.0), [Math.PI / 2, 0, 0], V(1, 1.05, 1)));
      // side straps joining sole to ankle
      for (const side of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.008, 0.06, 0.018), strapMat, V(side * 0.05, -0.045, -0.005)));
    }
    for (let k = 1; k <= (L.high || 0); k++) {
      g.add(mesh(new THREE.TorusGeometry(0.056 + k * 0.002, 0.009, 6, 22), L.tie ? fabric(L.tie) : strapMat, V(0, -0.012 + k * 0.045, 0), [Math.PI / 2 + (k % 2 ? 0.12 : -0.12), 0, 0]));
    }
    if (L.wrap) {
      g.add(mesh(new THREE.SphereGeometry(0.05, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), fabric(L.color), V(0, -0.045, 0.045), null, V(1.12, 0.82, 2.15)));
      g.add(mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 22), fabric(L.tie || L.color), V(0, -0.005, 0), [Math.PI / 2, 0, 0]));
    }
    if (L.heel) g.add(mesh(new THREE.TorusGeometry(0.048, 0.008, 6, 18, Math.PI), strapMat, V(0, -0.045, -0.01), [Math.PI / 2, 0, Math.PI], V(1, 1.1, 1)));
    if (L.tie && !L.wrap && !L.high) g.add(mesh(new THREE.TorusGeometry(0.056, 0.006, 6, 22), fabric(L.tie), V(0, 0.01, 0), [Math.PI / 2, 0, 0]));
    if (L.accent) g.add(mesh(new THREE.SphereGeometry(0.013, 10, 8), metal(L.accent), V(sx * 0.057, -0.012, 0.0), null, V(0.5, 1, 1)));
    if (L.gem) g.add(mesh(new THREE.SphereGeometry(0.011, 10, 8), gemMat(L.gem), V(0, -0.012, 0.056)));
    if (L.bow) for (const b of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.014, 0.005, 6, 12), strapMat, V(b * 0.016, -0.005, 0.054), [0, 0, b * 0.5], V(1.2, 0.8, 1)));
    parts.push(part(`foot${s}`, g));
  }
  return parts;
}

// ---------------------------------------------------------------- SHIELD
function shieldShape(kind) {
  const s = new THREE.Shape();
  switch (kind) {
    case 'circle': s.absarc(0, 0, 0.25, 0, Math.PI * 2, false); break;
    case 'oval': s.absellipse(0, 0, 0.185, 0.275, 0, Math.PI * 2, false, 0); break;
    case 'rect': {
      const w = 0.19, h = 0.27, r = 0.06;
      s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
      s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h);
      s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
      break;
    }
    case 'squircle': {
      const N = 64;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        const x = 0.22 * Math.sign(c) * Math.pow(Math.abs(c), 0.55), y = 0.25 * Math.sign(sn) * Math.pow(Math.abs(sn), 0.55);
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
      break;
    }
    case 'teardrop': {
      s.moveTo(0, -0.29);
      s.bezierCurveTo(0.12, -0.18, 0.22, -0.02, 0.22, 0.08);
      s.absarc(0, 0.08, 0.22, 0, Math.PI, false);
      s.bezierCurveTo(-0.22, -0.02, -0.12, -0.18, 0, -0.29);
      break;
    }
    case 'egg': {
      const N = 64;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const x = 0.2 * Math.cos(a) * (1 + 0.16 * Math.sin(a)), y = 0.27 * Math.sin(a);
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
      break;
    }
    case 'scallop': {
      const N = 12, R = 0.22;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
        if (i === 0) s.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
        s.quadraticCurveTo(Math.cos(am) * R * 1.2, Math.sin(am) * R * 1.2, Math.cos(a1) * R, Math.sin(a1) * R);
      }
      break;
    }
    case 'almond': {
      s.moveTo(0, -0.29);
      s.quadraticCurveTo(0.27, 0, 0, 0.29);
      s.quadraticCurveTo(-0.27, 0, 0, -0.29);
      break;
    }
    case 'octagon': {
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * 0.26, y = Math.sin(a) * 0.26;
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
      break;
    }
    default: s.absarc(0, 0, 0.25, 0, Math.PI * 2, false);
  }
  return s;
}
function planarUV(geo, scale = 1) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox, w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, S = Math.max(w, h) * scale;
  const cx = (bb.max.x + bb.min.x) / 2, cy = (bb.max.y + bb.min.y) / 2;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - cx) / S + 0.5, (pos.getY(i) - cy) / S + 0.5);
  uv.needsUpdate = true;
}

export function makeShield(L) {
  const shape = shieldShape(L.shape);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3, curveSegments: 28 });
  planarUV(geo, 1.04);
  const faceTex = emblemTexture(colorOf(L.face), L.emblem, colorOf(L.emblemC || '#c9a24a'), { scale: 0.36 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.62, metalness: 0.05, bumpMap: emblemBump(L.emblem, 0.36), bumpScale: 3 });
  const rimMat = isMetal(L.rim) ? metal(L.rim) : leather(L.rim);
  const g = new THREE.Group();
  g.add(mesh(geo, [faceMat, rimMat]));
  const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 28 });
  const rim = mesh(rimGeo, rimMat, V(0, 0, -0.008), null, V(1.075, 1.06, 1));
  g.add(rim);
  if (L.boss) {
    g.add(mesh(new THREE.SphereGeometry(0.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal(L.boss), V(0, 0, 0.032), [Math.PI / 2, 0, 0], V(1, 0.6, 1)));
    g.add(mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 24), metal(L.boss), V(0, 0, 0.032)));
  }
  // grip strap on the back
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.16, 0.02), leather('#5a3a22'), V(0, 0, -0.02)));
  return g;
}
function buildShield(L) {
  const g = makeShield(L);
  const holder = new THREE.Group();
  holder.add(g);
  holder.position.set(0.075, -0.15, 0.02);
  holder.rotation.set(0, 0.75, 0);
  holder.userData.shield = true;
  return [part('fArmL', holder)];
}

// ---------------------------------------------------------------- SWORD
export function makeSword(L) {
  const g = new THREE.Group();
  const bladeLen = 0.44, w = L.wide ? 0.05 : 0.04, y0 = 0.07;
  const bladeMatBase = isMetal(L.blade);
  const gripMat = new THREE.MeshStandardMaterial({ map: wrapTexture(L.grip), roughness: 0.8 });
  g.add(mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.11, 12), gripMat, V(0, 0, 0)));
  if (L.scroll) {
    const paper = new THREE.MeshStandardMaterial({ map: textLinesTexture(), roughness: 0.85, side: THREE.DoubleSide });
    const sheet = mesh(new THREE.BoxGeometry(0.1, bladeLen - 0.04, 0.008), [fabric('#e8dab8'), fabric('#e8dab8'), fabric('#e8dab8'), fabric('#e8dab8'), paper, paper], V(0, y0 + bladeLen / 2, 0));
    g.add(sheet);
    for (const yy of [y0 + 0.01, y0 + bladeLen - 0.02]) {
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.115, 14), fabric('#efe3c6'), V(0, yy, 0), [0, 0, Math.PI / 2]));
      for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.016, 10, 8), leather(L.grip), V(s * 0.068, yy, 0)));
    }
  } else {
    const s = new THREE.Shape();
    const tipW = L.wide ? w * 1.2 : w;
    s.moveTo(-w * 0.9, y0); s.lineTo(w * 0.9, y0);
    s.lineTo(tipW, y0 + bladeLen - tipW);
    s.absarc(0, y0 + bladeLen - tipW, tipW, 0, Math.PI, false);
    s.lineTo(-w * 0.9, y0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 20 });
    geo.translate(0, 0, -0.007);
    // square UVs near the guard for the emblem
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const S = w * 3.2, cy = y0 + 0.12;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / S + 0.5, (pos.getY(i) - cy) / S + 0.5);
    const tex = emblemTexture(colorOf(L.blade), L.emblem || null, L.emblem ? (bladeMatBase ? shade(colorOf(L.blade), -0.25) : '#c9a24a') : '#000', { scale: 0.34 });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: bladeMatBase ? 0.32 : 0.6, metalness: bladeMatBase ? 0.8 : 0.02 });
    g.add(mesh(geo, [bm, bladeMatBase ? metal(L.blade) : leather(shade(colorOf(L.blade), -0.06))]));
    if (L.stripe) g.add(mesh(new THREE.BoxGeometry(0.008, bladeLen - 0.1, 0.03), metal(L.stripe), V(0, y0 + bladeLen / 2 - 0.02, 0)));
    if (L.dots) for (const k of [0, 1, 2]) g.add(mesh(new THREE.SphereGeometry(0.009, 8, 6), metal('gold'), V(0, y0 + 0.12 + k * 0.08, 0.012)));
    if (L.gem) g.add(mesh(new THREE.SphereGeometry(0.014, 10, 8), gemMat(L.gem), V(0, y0 + 0.02, 0.022)));
  }
  // guard
  const gm = isMetal(L.guardC) ? metal(L.guardC) : leather(L.guardC);
  switch (L.guard) {
    case 'curve': g.add(mesh(new THREE.TorusGeometry(0.09, 0.013, 8, 20, Math.PI * 0.6), gm, V(0, -0.02, 0), [0, 0, Math.PI * 0.2])); break;
    case 'petal': for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.035, 12, 8), gm, V(s * 0.04, 0.062, 0), [0, 0, s * 0.5], V(1.4, 0.55, 0.55))); break;
    case 'oval': g.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 24), gm, V(0, 0.062, 0), [Math.PI / 2, 0, 0], V(1.3, 0.8, 1))); break;
    case 'almond': g.add(mesh(new THREE.SphereGeometry(0.05, 16, 10), gm, V(0, 0.062, 0), null, V(1.8, 0.35, 0.55))); break;
    case 'scroll':
      g.add(mesh(new THREE.BoxGeometry(0.15, 0.02, 0.03), gm, V(0, 0.062, 0)));
      for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.018, 0.008, 6, 14), gm, V(s * 0.085, 0.072, 0)));
      break;
    default: g.add(mesh(new THREE.BoxGeometry(0.16, 0.022, 0.035), gm, V(0, 0.062, 0)));
  }
  // pommel
  const pm = L.pommel === 'wood' ? leather(L.grip) : L.pommel && isMetal(L.pommel) ? metal(L.pommel) : gm;
  if (L.pommel === 'sun') g.add(emblemDisc(0.03, 'pewter', 'sun', '#555b66', { rim: metal('pewter') }).translateY(-0.085));
  else g.add(mesh(new THREE.SphereGeometry(0.024, 12, 10), pm, V(0, -0.068, 0)));
  return g;
}
function buildSword(L) {
  const s = makeSword(L);
  const holder = new THREE.Group();
  holder.add(s);
  holder.position.set(0, -0.05, 0.005);
  holder.rotation.set(Math.PI / 2 + 0.55, 0, 0);
  holder.userData.sword = true;
  return [part('handR', holder)];
}

// ---------------------------------------------------------------- HELMET
function buildHelmet(L) {
  const head = new THREE.Group();
  const C = V(0, 0.13, 0), Rh = 0.198;
  const tilt = new THREE.Group();
  tilt.position.copy(C).add(V(0, 0.012, -0.008));
  tilt.rotation.x = -0.38;
  head.add(tilt);
  const outer = L.metal ? metal(L.metal, { rough: 0.33 }) : (L.dome === '#cf9494' ? fabric(L.dome, { rough: 0.85 }) : leather(L.dome));
  const domeGeo = new THREE.SphereGeometry(Rh, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const dome = mesh(domeGeo, outer, null, null, V(1, 0.98, 1.06));
  tilt.add(dome);
  tilt.add(mesh(domeGeo, new THREE.MeshStandardMaterial({ color: L.liner, roughness: 0.95, side: THREE.BackSide }), null, null, V(0.99, 0.97, 1.05)));
  const rimY = -Rh * Math.cos(Math.PI * 0.52) * 0.98;
  const accent = L.band ? metal(L.band) : L.bandC ? fabric(L.bandC) : outer;
  if (L.band || L.bandC) tilt.add(mesh(new THREE.CylinderGeometry(Rh * 1.012, Rh * 1.012, 0.04, 40, 1, true), accent, V(0, rimY + 0.022, 0), null, V(1, 1, 1.06)));
  tilt.add(mesh(new THREE.TorusGeometry(Rh * 1.005, 0.012, 8, 48), L.brow ? outer : accent, V(0, rimY, 0), [Math.PI / 2, 0, 0], V(1, 1.06, L.brow ? 1.8 : 1)));
  if (L.stitch) tilt.add(mesh(new THREE.TorusGeometry(Rh * 1.0, 0.004, 4, 48), fabric('#e8dcc4'), V(0, rimY + 0.03, 0), [Math.PI / 2, 0, 0], V(1, 1.06, 1)));
  if (L.neck) {
    const nf = mesh(new THREE.CylinderGeometry(Rh * 0.99, Rh * 1.16, 0.075, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), outer, V(0, rimY - 0.034, 0), null, V(1, 1, 1.06));
    nf.material = outer; tilt.add(nf);
    tilt.add(mesh(new THREE.CylinderGeometry(Rh * 0.98, Rh * 1.15, 0.074, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshStandardMaterial({ color: L.liner, side: THREE.BackSide, roughness: 1 }), V(0, rimY - 0.034, 0), null, V(0.99, 1, 1.05)));
  }
  if (L.ridge) tilt.add(mesh(new THREE.TorusGeometry(Rh * 1.0, 0.016, 8, 32, Math.PI), outer, V(0, rimY + 0.0, 0), [0, Math.PI / 2, 0], V(1, 0.98, 1.06)));
  if (L.bands) {
    for (let k = 1; k <= 3; k++) {
      const th = Math.PI * 0.5 * (1 - k * 0.24);
      tilt.add(mesh(new THREE.TorusGeometry(Rh * Math.sin(th) * 1.01, 0.012, 6, 40), metal(L.metalBands), V(0, Rh * Math.cos(th) * 0.98, 0), [Math.PI / 2, 0, 0], V(1, 1.06, 1)));
    }
    tilt.add(mesh(new THREE.TorusGeometry(Rh * 1.01, 0.012, 6, 32, Math.PI), metal(L.metalBands), V(0, rimY, 0), [0, Math.PI / 2, 0], V(1, 0.98, 1.06)));
  }
  if (L.crest) {
    const cm = fabric(L.crest, { rough: 1 });
    const cmD = fabric(shade(L.crest, -0.08), { rough: 1 });
    const geo = new THREE.CylinderGeometry(0.004, 0.009, 1, 5);
    for (let i = 0; i < 70; i++) {
      const a = -0.5 + (i / 69) * 1.85 + (Math.random() - 0.5) * 0.04;
      const len = 0.1 + Math.sin(((a + 0.5) / 1.85) * Math.PI) * 0.05 + Math.random() * 0.02;
      const x = (Math.random() - 0.5) * 0.024;
      const base = V(x, Math.cos(a) * Rh * 0.99, Math.sin(a) * Rh * 1.05);
      const dir = V(0, Math.cos(a), Math.sin(a) * 1.06).normalize();
      const b = mesh(geo, i % 3 ? cm : cmD, base.clone().addScaledVector(dir, len / 2), [a + (Math.random() - 0.5) * 0.08, 0, x * 3], V(1, len, 1));
      tilt.add(b);
    }
    tilt.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), L.metal ? metal(L.metal) : outer, V(0, Rh * 0.99, 0.0)));
  }
  // emblem on brow
  if (L.emblem) {
    const bg = L.bandC || (L.metal || 'bronze');
    const big = L.browPlate;
    const d = emblemDisc(big ? 0.042 : 0.03, isMetal(bg) ? bg : bg, L.emblem, isMetal(bg) ? shade(colorOf(bg), -0.28) : '#d8b24c', { rim: metal(L.emblemMetal || L.metal || 'bronze') });
    d.position.set(0, rimY + (big ? 0.04 : 0.035), Rh * 1.06 + 0.002);
    d.rotation.x = 0.05;
    if (big) d.scale.set(1.4, 1, 1);
    tilt.add(d);
  }
  if (L.gem) tilt.add(mesh(new THREE.SphereGeometry(0.016, 12, 10), gemMat(L.gem), V(0, rimY + 0.024, Rh * 1.07 + 0.006), null, V(1, 1.2, 0.7)));
  if (L.cheeks) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.035, 0.0); sh.lineTo(0.035, 0.0); sh.lineTo(0.035, -0.07);
    sh.quadraticCurveTo(0.03, -0.115, 0.0, -0.115); sh.quadraticCurveTo(-0.035, -0.11, -0.035, -0.06); sh.closePath();
    const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    for (const s of [-1, 1]) {
      const c = mesh(cg, outer, V(s * 0.188, 0.155, 0.03), [0, s * (Math.PI / 2 - 0.42), s * 0.08]);
      head.add(c);
    }
  }
  return [part('head', head)];
}

// ---------------------------------------------------------------- HEADWEAR (bonus)
function buildHead(L, ctx) {
  const g = new THREE.Group();
  const C = V(0, 0.13, 0);
  if (L.kind === 'crown') {
    const hh = ctx.hasHelmet;
    const r = hh ? 0.152 : 0.142;
    g.position.copy(C).add(V(0, hh ? 0.14 : 0.112, -0.012));
    g.rotation.x = -0.22;
    const gold = metal('gold', { rough: 0.28 });
    const ring = mesh(new THREE.CylinderGeometry(r, r * 1.03, 0.045, 40, 1, true), gold);
    ring.material = gold;
    g.add(ring);
    g.add(mesh(new THREE.TorusGeometry(r * 1.03, 0.007, 6, 40), gold, V(0, -0.022, 0), [Math.PI / 2, 0, 0]));
    g.add(mesh(new THREE.TorusGeometry(r, 0.006, 6, 40), gold, V(0, 0.022, 0), [Math.PI / 2, 0, 0]));
    const fan = new THREE.Shape();
    fan.moveTo(-0.03, 0);
    for (let i = 0; i <= 4; i++) { const a = Math.PI - (i / 4) * Math.PI; fan.quadraticCurveTo(Math.cos(a + 0.2) * 0.05, 0.02 + Math.sin(a + 0.2) * 0.06, Math.cos(a) * 0.035, 0.02 + Math.sin(a) * 0.05); }
    fan.lineTo(0.03, 0); fan.closePath();
    const fg = new THREE.ExtrudeGeometry(fan, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
    for (const [a, sc] of [[0, 1.25], [-0.6, 0.9], [0.6, 0.9], [-1.2, 0.75], [1.2, 0.75], [-1.9, 0.7], [1.9, 0.7], [Math.PI, 0.7]]) {
      const f = mesh(fg, gold, V(Math.sin(a) * r, 0.02, Math.cos(a) * r), [0, a, 0], V(sc, sc, 1));
      g.add(f);
    }
    for (const a of [0, -0.6, 0.6]) g.add(mesh(new THREE.SphereGeometry(a ? 0.011 : 0.015, 12, 10), gemMat('#2b4fa8'), V(Math.sin(a) * (r + 0.006), 0.0, Math.cos(a) * (r + 0.006)), null, V(1, 1.3, 0.7)));
  } else if (L.kind === 'turban') {
    const cloth = new THREE.MeshStandardMaterial({ map: wrapTexture('#f1ead9'), roughness: 0.95 });
    g.position.copy(C).add(V(0, 0.07, -0.01)); g.rotation.x = -0.3;
    const rings = [[0.172, 0.04, 0.0], [0.165, 0.04, 0.05], [0.145, 0.04, 0.1], [0.11, 0.04, 0.145]];
    for (const [r, t, y] of rings) g.add(mesh(new THREE.TorusGeometry(r, t, 10, 36), cloth, V(0, y, 0), [Math.PI / 2, 0, 0], V(1, 1.08, 1)));
    g.add(mesh(new THREE.SphereGeometry(0.15, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), cloth, V(0, 0.08, 0), null, V(1, 0.75, 1.05)));
    g.add(mesh(new THREE.TorusGeometry(0.2, 0.005, 6, 40), fabric('#2b4fa8'), V(0, 0.03, 0), [Math.PI / 2, 0, 0], V(1, 1.05, 1)));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.035, 0.008), metal('gold', { rough: 0.25 }), V(0, 0.03, 0.214), [-0.08, 0, 0]));
  } else if (L.kind === 'scarf') {
    const pts = [[0.24, -0.25], [0.22, -0.12], [0.2, 0.0], [0.205, 0.12], [0.19, 0.22], [0.14, 0.3], [0.06, 0.34], [0.001, 0.35]];
    const gap = 1.7;
    const tex = clothMat({ base: L.color, bands: [{ v0: 0.0, v1: 0.05, color: L.stripe }, { v0: 0.1, v1: 0.13, color: L.stripe }] }, { side: THREE.DoubleSide });
    const m = mesh(ellipticLathe(pts, { zs: 1.02, phiStart: gap / 2, phiLength: Math.PI * 2 - gap }), tex, V(0, 0.0, -0.02));
    g.add(m);
    g.add(mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 36), leather('#1f1a17'), V(0, 0.25, -0.02), [Math.PI / 2 - 0.25, 0, 0], V(1, 1.05, 1)));
  }
  return [part('head', g)];
}

// ---------------------------------------------------------------- ACCESSORIES (bonus)
function buildAcc(L, ctx) {
  const P = ctx.P;
  const outOff = ctx.hasBreastplate ? 0.05 : ctx.hasOuter ? 0.06 : 0.025;
  const kind = ctx.outfit?.outer ? ITEM_MAP[ctx.outfit.outer]?.look.kind : null;
  const cloakBack = { mantle: 0.3, shawl: 0.27, fleece: 0.2, robe: 0.19, rough: 0.17, ephod: 0.17 }[kind] || 0;
  const backZ = (y, extra) => -Math.max(ctx.front(y, outOff + extra), cloakBack + extra * 0.6);
  switch (L.kind) {
    case 'breastpiece': {
      const g = new THREE.Group();
      const y = 0.27, z = ctx.front(y, outOff + 0.01);
      g.position.set(0, y, z); g.rotation.x = -0.1;
      g.add(mesh(new THREE.BoxGeometry(0.17, 0.2, 0.014), clothMat({ base: '#2c4a9a', stripesV: ['#2c4a9a', '#6a2f7a', '#b02a2a', '#d4a640'] })));
      g.add(mesh(new THREE.TorusGeometry(1, 0.005, 4, 4), metal('gold'), V(0, 0, 0.008), [0, 0, Math.PI / 4], V(0.12, 0.135, 1)));
      const gems = ['#c0432a', '#b9c23a', '#8fd0a8', '#3fbfb6', '#2b4fa8', '#1f9a5a', '#e07a2a', '#8a7a6a', '#8a4fc0', '#e0b040', '#1a1a1e', '#9a4a32'];
      gems.forEach((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = (col - 1) * 0.045, yy = 0.065 - row * 0.043;
        g.add(mesh(new THREE.SphereGeometry(0.014, 12, 10), gemMat(c), V(x, yy, 0.012), null, V(1, 1.15, 0.6)));
        g.add(mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 16), metal('gold'), V(x, yy, 0.01), null, V(1, 1.15, 1)));
      });
      for (const s of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([V(s * 0.08, 0.1, 0), V(s * 0.1, 0.16, -0.02), V(s * 0.11, 0.21, -0.06)]);
        g.add(mesh(new THREE.TubeGeometry(curve, 12, 0.005, 6), metal('gold')));
      }
      return [part('torso', g)];
    }
    case 'signet': {
      const g = new THREE.Group();
      const chainMat = new THREE.MeshStandardMaterial({ map: wrapTexture('#dcb453'), metalness: 0.85, roughness: 0.3 });
      g.add(mesh(new THREE.TorusGeometry(0.115, 0.007, 8, 48), chainMat, V(0, 0.44, 0.01), [Math.PI / 2 + 0.55, 0, 0], V(1.08, 1, 1)));
      const y = 0.37, z = ctx.front(y, outOff + 0.012);
      g.add(mesh(new THREE.TorusGeometry(0.022, 0.007, 8, 20), metal('gold', { rough: 0.25 }), V(0, y, z)));
      g.add(emblemDisc(0.017, 'gold', 'petal8', '#a07a2a', { rim: metal('gold') }).translateY(y + 0.026).translateZ(z + 0.002));
      return [part('torso', g)];
    }
    case 'barley': {
      const g = new THREE.Group();
      const straw = plain('#d9a94a', { roughness: 0.6 });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, rr = 0.016;
        const st = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.42, 5), straw, V(Math.cos(a) * rr, 0, Math.sin(a) * rr), [Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06]);
        g.add(st);
        const ear = mesh(new THREE.SphereGeometry(0.016, 8, 8), plain('#e2b354', { roughness: 0.7 }), V(Math.cos(a) * rr * 3, 0.24, Math.sin(a) * rr * 3), [0, 0, Math.cos(a) * 0.2], V(0.7, 2.6, 0.7));
        g.add(ear);
        g.add(mesh(new THREE.CylinderGeometry(0.001, 0.0015, 0.09, 3), straw, V(Math.cos(a) * rr * 3, 0.32, Math.sin(a) * rr * 3), [0, 0, Math.cos(a) * 0.3]));
      }
      g.add(mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 16), fabric('#efe6d2'), V(0, -0.05, 0), [Math.PI / 2, 0, 0]));
      g.position.set(0.06, 0.26, backZ(0.26, 0.04)); g.rotation.set(-0.15, 0, -0.55);
      return [part('torso', g)];
    }
    case 'staff': {
      const pts = [V(0, -0.62, 0), V(0, 0.2, 0), V(0, 0.55, 0), V(0.015, 0.68, 0), V(0.07, 0.74, 0), V(0.13, 0.7, 0), V(0.13, 0.62, 0)];
      const g = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.018, 8), leather('#7a5232'));
      g.position.set(0.0, 0.2, backZ(0.2, 0.05)); g.rotation.set(0, 0, -0.5);
      return [part('torso', g)];
    }
    case 'lyre': {
      const g = new THREE.Group();
      const wood = leather('#8a5a33');
      for (const s of [-1, 1]) {
        const c = new THREE.CatmullRomCurve3([V(s * 0.05, 0, 0), V(s * 0.09, 0.1, 0), V(s * 0.07, 0.2, 0), V(s * 0.09, 0.27, 0)]);
        g.add(mesh(new THREE.TubeGeometry(c, 16, 0.012, 6), wood));
      }
      g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8), wood, V(0, 0.25, 0), [0, 0, Math.PI / 2]));
      g.add(mesh(new THREE.BoxGeometry(0.14, 0.07, 0.04), wood, V(0, -0.01, 0)));
      for (let i = -2; i <= 2; i++) g.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.24, 3), plain('#efe6d2'), V(i * 0.016, 0.13, 0.012)));
      g.position.set(-0.02, 0.18, backZ(0.18, 0.05)); g.rotation.set(0.15, Math.PI, 0.35);
      return [part('torso', g)];
    }
    case 'pouch': {
      const g = new THREE.Group();
      const lm = leather('#8a5532');
      g.add(mesh(new THREE.SphereGeometry(0.055, 16, 12), lm, V(0, -0.04, 0), null, V(1, 1.05, 0.6)));
      g.add(mesh(new THREE.SphereGeometry(0.057, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lm, V(0, -0.025, 0.004), null, V(1.02, 0.8, 0.66)));
      g.add(mesh(new THREE.TorusGeometry(0.02, 0.008, 6, 12), lm, V(0, 0.03, -0.01)));
      g.position.set(-0.17, -0.02, 0.07); g.rotation.y = -0.6;
      return [part('hips', g)];
    }
    case 'casket': {
      const g = new THREE.Group();
      const wood = leather('#8a5a33'), gold = metal('gold');
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.065, 0.07), wood));
      g.add(mesh(new THREE.BoxGeometry(0.106, 0.02, 0.076), wood, V(0, 0.04, 0)));
      for (const x of [-0.03, 0.03]) g.add(mesh(new THREE.BoxGeometry(0.012, 0.09, 0.08), gold, V(x, 0.01, 0)));
      g.add(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.006), gold, V(0, 0.02, 0.038)));
      g.position.set(0.18, -0.06, 0.07); g.rotation.y = 0.6;
      return [part('hips', g)];
    }
    case 'lamp': {
      const g = new THREE.Group();
      const clay = leather('#b5683e');
      g.add(mesh(new THREE.SphereGeometry(0.045, 16, 10), clay, null, null, V(1, 0.5, 1.4)));
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.05, 8), clay, V(0, 0.005, 0.06), [Math.PI / 2 - 0.3, 0, 0]));
      const flame = mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffcf5a' }), V(0, 0.03, 0.082), null, V(1, 1.8, 1));
      flame.userData.flame = true;
      g.add(flame);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow('#ffd88a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(0.14, 0.14, 1); glow.position.set(0, 0.035, 0.082);
      g.add(glow);
      g.add(mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), clay, V(0, 0.015, -0.06), [0, Math.PI / 2, 0]));
      g.position.set(0.18, -0.07, 0.05); g.rotation.y = 0.7;
      return [part('hips', g)];
    }
    case 'tambourine': {
      const g = new THREE.Group();
      const wood = leather('#a87a4b');
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 28, 1, true), wood, null, [Math.PI / 2, 0, 0]));
      const skin = new THREE.MeshStandardMaterial({ map: emblemTexture('#efe2c4', 'petal8', '#b0603e', { scale: 0.3 }), roughness: 0.9 });
      g.add(mesh(new THREE.CircleGeometry(0.08, 28), skin, V(0, 0, 0.015)));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 12), metal('brass'), V(Math.cos(a) * 0.081, Math.sin(a) * 0.081, 0), [0, 0, a]));
      }
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.012, 0.1, 0.002), fabric(['#b02a2a', '#2c4a9a', '#d4a640'][i]), V(-0.06 + i * 0.012, -0.11, 0.0), [0, 0, 0.1]));
      g.position.set(0.19, -0.07, 0.02); g.rotation.set(0, Math.PI / 2 - 0.5, 0);
      return [part('hips', g)];
    }
    case 'dove': {
      const g = new THREE.Group();
      const w = plain('#f8f6f0', { roughness: 0.8 });
      g.add(mesh(new THREE.SphereGeometry(0.045, 16, 12), w, V(0, 0, 0), null, V(0.85, 0.75, 1.35)));
      g.add(mesh(new THREE.SphereGeometry(0.028, 14, 10), w, V(0, 0.04, 0.05)));
      g.add(mesh(new THREE.ConeGeometry(0.008, 0.022, 6), plain('#e08a3c'), V(0, 0.036, 0.083), [Math.PI / 2, 0, 0]));
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.SphereGeometry(0.006, 6, 6), plain('#111'), V(s * 0.019, 0.048, 0.07)));
        g.add(mesh(new THREE.SphereGeometry(0.04, 12, 8), w, V(s * 0.035, 0.01, -0.01), [0.2, 0, s * 0.35], V(0.25, 0.7, 1.3)));
      }
      g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), w, V(0, 0.005, -0.07), [-0.3, 0, 0], V(0.8, 0.25, 1.4)));
      g.position.set(P.shoulderX - 0.02, 0.52, -0.01);
      g.userData.bob = true;
      return [part('torso', g)];
    }
    default: return [];
  }
}

// ---------------------------------------------------------------- dispatcher
export function buildItem(item, ctx) {
  const L = item.look;
  ctx.outerKind = ctx.outfit?.outer ? ITEM_MAP[ctx.outfit.outer]?.look.kind : null;
  switch (item.cat) {
    case 'tunic': return buildTunic(L, ctx);
    case 'outer': return buildOuter(L, ctx);
    case 'breastplate': return buildBreastplate(L, ctx);
    case 'belt': return buildBelt(L, ctx);
    case 'shoes': return buildShoes(L, ctx);
    case 'shield': return buildShield(L, ctx);
    case 'sword': return buildSword(L, ctx);
    case 'helmet': return buildHelmet(L, ctx);
    case 'head': return buildHead(L, ctx);
    case 'acc': return buildAcc(L, ctx);
    default: return [];
  }
}
