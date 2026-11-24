// Procedural 3D builders for every wardrobe item. Each builder returns [{joint, obj}].
import * as THREE from 'three';
import {
  fabric, leather, metal, plain, gemMat, isMetal, colorOf, METALS, shade,
  clothTexture, emblemTexture, emblemBump, wrapTexture, textLinesTexture, radialGlow,
  weaveBump, leatherBump, noiseBump, woodBump, rope, wood, bladeTexture, shieldFace, decalTextures, yokeTexture,
} from './textures.js';
import { ellipticLathe, profileR, ZS, footSection, footGeometry, SOLE_Y, FOOT_Z0, FOOT_Z1 } from './character.js';
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
const clothMat = (spec, opts = {}) => new THREE.MeshStandardMaterial({ map: clothTexture(spec), roughness: opts.rough ?? 0.88, metalness: opts.metal ?? 0, side: opts.side ?? THREE.FrontSide, bumpMap: weaveBump(), bumpScale: 1.3 });
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

// Emblem embossed straight onto the chest: a patch of the torso surface carrying a transparent decal.
function chestDecal(P, off, emblem, color, { y = 0.27, h = 0.18, x = 0, scale = 0.42, metalness = 1 } = {}) {
  const pts = [];
  for (let k = 0; k <= 10; k++) { const yy = y - h / 2 + (k / 10) * h; pts.push([profileR(P.torso, yy), yy]); }
  const r = profileR(P.torso, y) + off;
  const phiLen = h / r, phiC = Math.asin(Math.max(-0.9, Math.min(0.9, x / r)));
  const geo = ellipticLathe(pts, { off: off + 0.004, phiStart: phiC - phiLen / 2, phiLength: phiLen, segs: 18 });
  const { map, mask } = decalTextures(emblem, color, { scale });
  return mesh(geo, new THREE.MeshStandardMaterial({
    map, alphaTest: 0.45, metalness, metalnessMap: metalness ? mask : null, roughness: metalness ? 0.32 : 0.55,
    bumpMap: mask, bumpScale: 5, polygonOffset: true, polygonOffsetFactor: -2,
  }));
}

function buildBreastplate(L, ctx) {
  const P = ctx.P, parts = [];
  const off = ctx.hasOuter ? 0.05 : 0.038;
  const pts = bodicePoints(P, -0.025, 0.45, 0.1);
  const g = new THREE.Group();
  parts.push(part('torso', g));
  const front = (y, extra = 0) => ctx.front(y, off + extra);
  const ring = (y, tube, mat, extra = 0.002, tilt = 0) => {
    const r = profileR(P.torso, y);
    return mesh(new THREE.TorusGeometry(1, tube, 10, 56), mat, V(0, y, 0), [Math.PI / 2 + tilt, 0, 0], V(r + off + extra, ZS * r + off + extra, 1));
  };
  const neckRing = (mat, tube = 0.016) => mesh(new THREE.TorusGeometry(1, tube, 10, 48), mat, V(0, 0.455, 0), [Math.PI / 2 - 0.08, 0, 0], V(0.112, 0.094, 1));
  const surfZ = (x, y, extra) => { const r = profileR(P.torso, y) + off + extra; return (ZS * profileR(P.torso, y) + off + extra) * Math.sqrt(Math.max(0, 1 - (x / r) ** 2)); };
  const straps = (mat, { w = 0.058, rivet = null } = {}) => {
    for (const sd of [-1, 1]) {
      const x = sd * 0.1, zf = front(0.37, 0.01);
      g.add(ribbon([V(x, 0.34, zf), V(x, 0.44, zf * 0.8), V(x, 0.492, 0), V(x, 0.44, -zf * 0.8), V(x, 0.34, -zf)], w, 0.012, mat));
      if (rivet) for (const zz of [1, -1]) g.add(mesh(new THREE.SphereGeometry(0.011, 12, 10), metal(rivet), V(x, 0.36, zz * (zf + 0.007)), null, V(1, 1, 0.6)));
    }
  };
  let shell;
  switch (L.style) {
    case 'quilt': shell = clothMat({ base: L.color, quilt: L.quilt || 'grid' }); break;
    case 'bands': case 'leather': shell = leather(L.color); break;
    case 'scales': shell = clothMat({ base: L.color, scales: colorOf(L.scale), scaleEdge: L.edgeC }, { metal: isMetal(L.scale) || L.edgeC ? 0.45 : 0.1, rough: 0.5 }); break;
    case 'plates': shell = new THREE.MeshStandardMaterial({ map: clothTexture({ base: L.color, plates: true }), roughness: 0.6, metalness: 0.05, bumpMap: leatherBump(), bumpScale: 1.2 }); break;
    case 'cuirass': shell = metal(L.metal, { rough: 0.3 }); break;
    case 'layers': shell = clothMat({ base: L.color }); break;
    default: shell = fabric(L.color || '#ccc');
  }
  g.add(mesh(ellipticLathe(pts, { off }), shell));

  const pipeMat = L.pipingMetal ? metal(L.pipingMetal) : L.piping ? fabric(L.piping) : null;
  if (pipeMat) { g.add(ring(-0.022, 0.014, pipeMat)); g.add(neckRing(pipeMat)); }
  // vest armholes: a rolled edge around each arm opening
  const armMat = pipeMat || (L.style === 'cuirass' ? metal(L.metal, { rough: 0.28 }) : L.style === 'layers' ? fabric(shade(L.color, -0.04)) : leather(shade(L.color || '#777', -0.08)));
  for (const sd of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.068, 0.011, 8, 28), armMat, V(sd * (P.shoulderX - 0.012), 0.385, 0), [0, Math.PI / 2, 0], V(1.35, 1, 1)));

  switch (L.style) {
    case 'quilt':
      if (L.straps) straps(fabric(L.straps), { w: 0.07 });
      break;
    case 'bands': {
      // broad overlapping leather lames, each flaring slightly over the one below
      const n = L.count || 4;
      for (let k = 0; k < n; k++) {
        const y0 = -0.025 + k * 0.105, y1 = y0 + 0.118;
        const lame = [[profileR(P.torso, y0) + 0.014, y0], [profileR(P.torso, y0 + 0.02) + 0.009, y0 + 0.02], [profileR(P.torso, y1), y1]];
        g.add(mesh(ellipticLathe(lame, { off: off + 0.004 + (n - k) * 0.001 }), leather(shade(L.color, k % 2 ? 0.03 : -0.02))));
      }
      straps(leather(shade(L.color, -0.06)), { w: 0.062 });
      g.add(neckRing(leather(shade(L.color, -0.08)), 0.012));
      break;
    }
    case 'scales':
      if (L.straps) straps(fabric(L.straps), { w: 0.058, rivet: L.rivets });
      break;
    case 'plates': {
      const col = mesh(new THREE.CylinderGeometry(0.098, 0.118, 0.07, 36, 1, true), leather(shade(L.color, 0.04)), V(0, 0.48, 0.0), null, V(1, 1, 0.86));
      col.material = leather(shade(L.color, 0.04)); g.add(col);
      g.add(ring(-0.022, 0.012, leather(shade(L.color, -0.1))));
      for (let row = 0; row < 3; row++) {
        const y = 0.06 + row * 0.13;
        for (const xx of [-0.07, 0.07]) g.add(mesh(new THREE.SphereGeometry(0.011, 12, 10), metal(L.rivets || 'bronze'), V(xx, y, surfZ(xx, y, 0.006)), null, V(1, 1, 0.6)));
      }
      break;
    }
    case 'cuirass': {
      const m = metal(L.metal, { rough: 0.28 });
      g.add(ring(-0.022, 0.016, m, 0.004));
      g.add(neckRing(m, 0.018));
      if (L.seams) {
        for (const sd of [-1, 1]) {
          const cp = [];
          for (let k = 0; k <= 10; k++) { const t = k / 10, y = 0.43 - t * 0.43, x = sd * (0.095 - 0.035 * Math.sin(t * Math.PI * 0.5)); cp.push(V(x, y, surfZ(x, y, 0.002))); }
          g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 24, 0.0065, 6), m));
        }
      }
      if (L.side) {
        for (const sd of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.02, 0.44, 0.07), fabric(L.side), V(sd * (profileR(P.torso, 0.2) + off - 0.004), 0.21, 0)));
      }
      break;
    }
    case 'leather':
      if (L.straps) straps(leather(L.straps), { w: 0.06, rivet: L.rivets });
      g.add(ring(-0.022, 0.012, leather(shade(L.color, -0.1))));
      g.add(neckRing(leather(shade(L.color, -0.1)), 0.012));
      break;
    case 'layers': {
      for (const y of [0.1, 0.22]) g.add(ring(y, 0.012, fabric(shade(L.color, -0.06)), 0.004));
      g.add(ring(-0.022, 0.012, fabric(shade(L.color, -0.04))));
      if (L.yoke) {
        const yk = [[0.19, 0.38], [0.18, 0.42], [0.155, 0.46], [0.12, 0.49], [0.092, 0.505]];
        const ym = new THREE.MeshStandardMaterial({ map: yokeTexture(), metalness: 0.85, roughness: 0.32, color: '#ffffff' });
        g.add(mesh(ellipticLathe(yk, { off: off * 0.6, zs: 0.82 }), ym));
        g.add(mesh(new THREE.TorusGeometry(1, 0.008, 6, 48), metal('gold'), V(0, 0.38, 0), [Math.PI / 2, 0, 0], V(0.19 + off * 0.6, 0.19 * 0.82 + off * 0.6, 1)));
      }
      break;
    }
    default: break;
  }
  if (L.sideMetal) {
    for (let k = 0; k < 4; k++) {
      const y = 0.02 + k * 0.075, r = profileR(P.torso, y);
      for (const sd of [-1, 1]) {
        g.add(mesh(new THREE.TorusGeometry(1, 0.022, 8, 16, 1.0), metal(L.sideMetal), V(0, y, 0), [Math.PI / 2, 0, sd > 0 ? -0.5 : Math.PI - 0.5], V(r + off + 0.006, ZS * r + off + 0.006, 1.4)));
        g.add(mesh(new THREE.SphereGeometry(0.008, 8, 6), metal(L.sideMetal), V(sd * (r + off + 0.02), y + 0.01, 0.02)));
      }
    }
  }
  if (L.medallion) { // oval bronze medallion on the left chest
    const d = emblemDisc(0.05, L.metal || 'bronze', L.medallion, shade(colorOf(L.metal || 'bronze'), -0.22));
    d.scale.set(1.35, 1, 1);
    d.position.set(0.045, 0.27, surfZ(0.045, 0.27, 0.004)); d.rotation.set(-0.12, 0.25, 0);
    g.add(d);
  }
  if (L.emblem) {
    const isCuirass = L.style === 'cuirass';
    const col = L.emblemC || (isCuirass ? shade(colorOf(L.metal), 0.12) : '#d8b24c');
    g.add(chestDecal(P, off, L.emblem, col, { y: L.emblem === 'sun' ? 0.32 : 0.24, h: L.emblem === 'sun' ? 0.15 : 0.3, scale: 0.42, metalness: L.emboss ? 0 : 1 }));
  }
  if (L.gem) {
    const y = 0.3;
    g.add(mesh(new THREE.SphereGeometry(0.026, 18, 12), gemMat(L.gem), V(0, y, front(y, 0.008)), null, V(1, 1.2, 0.55)));
    g.add(mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 20), metal('gold'), V(0, y, front(y, 0.006)), null, V(1, 1.2, 1)));
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
// Straps are flat ribbons swept along curves that hug the foot's real cross-section,
// so they always sit on top of the foot instead of sinking into it.
function ribbon(points, width, thick, mat, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const sh = new THREE.Shape();
  sh.moveTo(-thick / 2, -width / 2); sh.lineTo(thick / 2, -width / 2); sh.lineTo(thick / 2, width / 2); sh.lineTo(-thick / 2, width / 2); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { steps: Math.max(12, points.length * 3), bevelEnabled: false, extrudePath: curve });
  return mesh(geo, mat);
}
function cord(points, radius, mat, closed = false) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(16, points.length * 3), radius, 8, closed), mat);
}
// arch over the foot at depth z (in the plane z, optionally swung by yaw around the vertical axis)
function archPoints(z, { lift = 0.004, widen = 1.12, yaw = 0 } = {}) {
  const { halfW, top } = footSection(z);
  const W = halfW * widen + 0.004, H = top - SOLE_Y + lift;
  const pts = [];
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * Math.PI;
    const x = Math.cos(a) * W, y = SOLE_Y + Math.sin(a) * H;
    pts.push(new THREE.Vector3(x * Math.cos(yaw), y, z - x * Math.sin(yaw)));
  }
  return pts;
}
function ringPoints(y, rx, rz, cz = 0, from = 0, to = Math.PI * 2, n = 24) {
  const pts = [];
  const full = Math.abs(to - from - Math.PI * 2) < 1e-6;
  for (let k = 0; k < (full ? n : n + 1); k++) { const a = from + (k / n) * (to - from); pts.push(new THREE.Vector3(Math.sin(a) * rx, y, cz + Math.cos(a) * rz)); }
  return pts;
}

function buildShoes(L, ctx) {
  const parts = [];
  const P = ctx.P;
  const strapMat = L.rope ? rope(L.color) : leather(L.color);
  const strap2 = L.color2 ? leather(L.color2) : strapMat;
  const soleMat = leather(L.sole || '#6b4a2e');
  const tieMat = L.tie ? fabric(L.tie) : strapMat;
  // sole outline follows the foot plan with a small margin
  const soleShape = new THREE.Shape();
  const N = 24, side = [];
  for (let k = 0; k <= N; k++) {
    const z = FOOT_Z0 - 0.006 + (k / N) * (FOOT_Z1 - FOOT_Z0 + 0.012);
    side.push([Math.max(0.012, footSection(Math.min(FOOT_Z1 - 0.004, Math.max(FOOT_Z0 + 0.004, z))).halfW + 0.008), z]);
  }
  side.forEach(([x, z], i) => (i ? soleShape.lineTo(x, z) : soleShape.moveTo(x, z)));
  for (let k = side.length - 1; k >= 0; k--) soleShape.lineTo(-side[k][0], side[k][1]);
  soleShape.closePath();
  const soleGeo = new THREE.ExtrudeGeometry(soleShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
  const ankleR = P.shinR + 0.008;
  const strapW = L.wide ? 0.02 : 0.011;
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const g = new THREE.Group();
    g.add(mesh(soleGeo, soleMat, V(0, SOLE_Y - 0.0005, 0), [Math.PI / 2, 0, 0]));
    // straps over the forefoot
    (L.bands || []).forEach((t, i) => {
      const z = FOOT_Z0 + 0.02 + t * (FOOT_Z1 - FOOT_Z0 - 0.045);
      const m = i % 2 ? strap2 : strapMat;
      g.add(L.rope ? cord(archPoints(z), 0.0065, m) : ribbon(archPoints(z), strapW, 0.004, m));
    });
    if (L.cross) {
      const zc = FOOT_Z0 + 0.075;
      for (const yaw of [-0.55, 0.55]) {
        const pts = archPoints(zc, { yaw, widen: 1.18, lift: 0.006 });
        g.add(L.rope ? cord(pts, 0.0055, strapMat) : ribbon(pts, 0.009, 0.004, strapMat));
      }
    }
    if (L.ankle || L.high) {
      g.add(ribbon(ringPoints(0.004, ankleR, ankleR), 0.011, 0.004, strapMat, true));
      // heel counter straps rising from the sole to the ankle band
      for (const sd of [-1, 1]) {
        const z = -0.012, { halfW } = footSection(z);
        g.add(ribbon([V(sd * (halfW + 0.003), SOLE_Y, z), V(sd * (halfW * 0.9 + 0.003), -0.03, z - 0.004), V(sd * ankleR * 0.98, 0.0, -0.004)], 0.01, 0.004, strapMat));
      }
    }
    for (let k = 1; k <= (L.high || 0); k++) {
      const y = 0.004 + k * 0.038;
      g.add(ribbon(ringPoints(y, ankleR - 0.001, ankleR - 0.001).map((p, i) => p.add(V(0, Math.sin(i / 3) * 0.004, 0))), 0.01, 0.004, tieMat, true));
    }
    if (L.wrap) {
      const cover = mesh(footGeometry(), fabric(L.color), null, null, V(1.12, 1.18, 1.04));
      cover.position.y = -SOLE_Y * 0.15;
      g.add(cover);
      for (const z of [0.0, 0.05, 0.1]) g.add(ribbon(archPoints(z, { widen: 1.24, lift: 0.01 }), 0.006, 0.003, tieMat));
      g.add(ribbon(ringPoints(0.008, ankleR, ankleR), 0.012, 0.004, tieMat, true));
    }
    if (L.heel) {
      const z = -0.02, { halfW } = footSection(z);
      g.add(ribbon(ringPoints(-0.042, halfW + 0.008, 0.07, 0, Math.PI / 2, Math.PI * 1.5, 16), 0.012, 0.004, strapMat));
    }
    if (L.tie && !L.wrap && !L.high) g.add(cord(ringPoints(0.016, ankleR + 0.001, ankleR + 0.001), 0.003, tieMat, true));
    if (L.accent) g.add(mesh(new THREE.SphereGeometry(0.009, 12, 10), metal(L.accent), V(sx * (ankleR + 0.004), 0.004, 0), null, V(0.5, 1, 1)));
    if (L.gem) g.add(mesh(new THREE.SphereGeometry(0.008, 12, 10), gemMat(L.gem), V(0, 0.004, ankleR + 0.004), null, V(1, 1, 0.6)));
    if (L.bow) for (const b of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 14), strapMat, V(b * 0.013, 0.008, ankleR + 0.004), [0, 0, b * 0.5], V(1.2, 0.8, 1)));
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
    case 'egg': { // teardrop with the point at the top
      const N = 64;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const x = 0.2 * Math.cos(a) * (1 - 0.22 * Math.sin(a)), y = 0.27 * Math.sin(a);
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
      break;
    }
    case 'roundsquare': {
      const w = 0.22, h = 0.23, r = 0.075;
      s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
      s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h);
      s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
      break;
    }
    case 'scallop': {
      const N = 11, R = 0.235;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
        if (i === 0) s.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
        s.quadraticCurveTo(Math.cos(am) * R * 1.1, Math.sin(am) * R * 1.1, Math.cos(a1) * R, Math.sin(a1) * R);
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
  const depth = 0.024;
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3, curveSegments: 32, steps: 1 });
  // UVs from the outline's bounding square so the face art lines up with the real shape
  const outline = shape.getPoints(72);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of outline) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const S = Math.max(x1 - x0, y1 - y0) + 0.024, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const DOME = 0.03;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    uv.setXY(i, (x - cx) / S + 0.5, (y - cy) / S + 0.5);
    // gently domed front, like the reference shields
    if (z > depth * 0.5) {
      const d = Math.min(1, ((x - cx) / hw) ** 2 + ((y - cy) / hh) ** 2);
      pos.setZ(i, z + DOME * (1 - d));
    }
  }
  geo.computeVertexNormals();
  const norm = outline.map((p) => [(p.x - cx) / S + 0.5, (p.y - cy) / S + 0.5]);
  const scale = (L.emblemScale ?? 0.36) * (0.56 / S);
  const { map, mask } = shieldFace(`${L.shape}:${L.face}:${L.emblem}:${L.emblemC}:${L.grain}:${(L.deco || []).join(',')}:${L.stitch}`, norm, {
    face: colorOf(L.face), kind: L.grain || 'painted', emblem: L.emblem || null, emblemC: colorOf(L.emblemC || '#d2a84f'),
    scale, stitch: !!L.stitch, deco: L.deco || [], band: L.band,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map, roughness: L.grain === 'leather' ? 0.72 : 0.6, metalness: 1, metalnessMap: mask,
    bumpMap: mask, bumpScale: 5,
  });
  const rimMat = isMetal(L.rim) ? metal(L.rim, { rough: 0.3 }) : leather(L.rim);
  const g = new THREE.Group();
  g.add(mesh(geo, [faceMat, rimMat]));
  // chunky rounded rim around the edge
  const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 4, curveSegments: 32 });
  const rx = 1 + 0.034 / hw, ry = 1 + 0.034 / hh;
  g.add(mesh(rimGeo, rimMat, V(cx * (1 - rx), cy * (1 - ry), -0.008), null, V(rx, ry, 1)));
  if (L.boss) { // domed boss with a flange ring
    const zb = depth + 0.01 + DOME;
    g.add(mesh(new THREE.SphereGeometry(0.048, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), metal(L.boss, { rough: 0.25 }), V(cx, cy, zb - 0.004), [Math.PI / 2, 0, 0], V(1, 0.75, 1)));
    g.add(mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.008, 32), metal(L.boss), V(cx, cy, zb - 0.004), [Math.PI / 2, 0, 0]));
    g.add(mesh(new THREE.TorusGeometry(0.068, 0.007, 8, 32), metal(L.boss), V(cx, cy, zb)));
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
  const bladeIsMetal = isMetal(L.blade);
  const gripMat = new THREE.MeshStandardMaterial({ map: wrapTexture(L.grip), roughness: 0.75, bumpMap: wrapTexture(L.grip), bumpScale: 2 });
  g.add(mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.11, 16), gripMat, V(0, 0, 0)));
  if (L.scroll) {
    const paper = new THREE.MeshStandardMaterial({ map: textLinesTexture(), roughness: 0.85, side: THREE.DoubleSide });
    const edge = fabric('#e8dab8');
    const sheet = mesh(new THREE.BoxGeometry(0.1, bladeLen - 0.04, 0.008), [edge, edge, edge, edge, paper, paper], V(0, y0 + bladeLen / 2, 0));
    g.add(sheet);
    for (const yy of [y0 + 0.01, y0 + bladeLen - 0.02]) {
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.115, 16), fabric('#efe3c6'), V(0, yy, 0), [0, 0, Math.PI / 2]));
      for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.016, 12, 10), wood(L.grip), V(s * 0.068, yy, 0)));
    }
  } else {
    const s = new THREE.Shape();
    const tipW = L.wide ? w * 1.2 : w;
    s.moveTo(-w * 0.9, y0); s.lineTo(w * 0.9, y0);
    s.lineTo(tipW, y0 + bladeLen - tipW);
    s.absarc(0, y0 + bladeLen - tipW, tipW, 0, Math.PI, false);
    s.lineTo(-w * 0.9, y0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.007, bevelSegments: 4, curveSegments: 24 });
    geo.translate(0, 0, -0.006);
    // UVs: u across the blade width, v from the guard (0) to the tip (1)
    const half = Math.max(w * 0.9, tipW) + 0.007;
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * half) + 0.5, (pos.getY(i) - y0) / bladeLen);
    const kind = bladeIsMetal ? 'metal' : 'wood';
    const tex = bladeTexture(colorOf(L.blade), kind, L.emblem || null, L.guardC && isMetal(L.guardC) ? colorOf(L.guardC) : '#d2a84f');
    const bm = bladeIsMetal
      ? new THREE.MeshStandardMaterial({ map: tex, color: '#b9b4aa', roughness: 0.32, metalness: 0.75, bumpMap: noiseBump(), bumpScale: 0.3 })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.0, bumpMap: woodBump(9), bumpScale: 1.4 });
    g.add(mesh(geo, [bm, bladeIsMetal ? metal(L.blade) : wood(shade(colorOf(L.blade), -0.08), 9)]));
    if (L.stripe) g.add(mesh(new THREE.BoxGeometry(0.008, bladeLen - 0.1, 0.03), metal(L.stripe), V(0, y0 + bladeLen / 2 - 0.02, 0)));
    if (L.dots) for (const k of [0, 1, 2]) for (const f of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.008, 10, 8), metal('gold'), V(0, y0 + 0.15 + k * 0.07, f * 0.013), null, V(1, 1, 0.5)));
    if (L.gem) for (const f of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.013, 12, 10), gemMat(L.gem), V(0, y0 + 0.02, f * 0.018), null, V(1, 1.2, 0.6)));
  }
  // guard
  const gm = isMetal(L.guardC) ? metal(L.guardC, { rough: 0.3 }) : wood(L.guardC);
  switch (L.guard) {
    case 'curve': g.add(mesh(new THREE.TorusGeometry(0.075, 0.013, 10, 24, Math.PI * 0.62), gm, V(0, 0.0, 0), [0, 0, Math.PI * 0.19])); break;
    case 'petal':
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.SphereGeometry(0.034, 16, 10), gm, V(s * 0.042, 0.064, 0), [0, 0, s * 0.45], V(1.45, 0.5, 0.5)));
        g.add(mesh(new THREE.SphereGeometry(0.016, 12, 8), gm, V(s * 0.03, 0.078, 0), [0, 0, s * 0.9], V(1.4, 0.6, 0.5)));
      }
      g.add(mesh(new THREE.SphereGeometry(0.018, 12, 10), gm, V(0, 0.066, 0), null, V(1, 0.8, 0.9)));
      break;
    case 'oval': g.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 28), gm, V(0, 0.062, 0), [Math.PI / 2, 0, 0], V(1.3, 0.8, 1))); break;
    case 'almond': g.add(mesh(new THREE.SphereGeometry(0.05, 20, 12), gm, V(0, 0.062, 0), null, V(1.8, 0.35, 0.55))); break;
    case 'scroll':
      g.add(mesh(new THREE.CapsuleGeometry(0.012, 0.13, 4, 10), gm, V(0, 0.062, 0), [0, 0, Math.PI / 2]));
      for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.017, 0.008, 8, 16, Math.PI * 1.6), gm, V(s * 0.082, 0.075, 0), [0, 0, s > 0 ? -0.6 : Math.PI + 0.6]));
      break;
    default: g.add(mesh(new THREE.CapsuleGeometry(0.013, 0.13, 4, 10), gm, V(0, 0.062, 0), [0, 0, Math.PI / 2], V(1, 1, 1.3)));
  }
  // collar where grip meets guard + pommel
  g.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.012, 16), gm, V(0, 0.05, 0)));
  const pm = L.pommel === 'wood' ? wood(L.grip) : L.pommel && isMetal(L.pommel) ? metal(L.pommel) : gm;
  if (L.pommel === 'sun') g.add(emblemDisc(0.03, 'pewter', 'sun', '#555b66', { rim: metal('pewter') }).translateY(-0.085));
  else {
    g.add(mesh(new THREE.SphereGeometry(0.024, 16, 12), pm, V(0, -0.07, 0)));
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 16), pm, V(0, -0.055, 0)));
  }
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
