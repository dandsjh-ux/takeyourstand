// Procedural stylised character rig (no skinning: a hierarchy of joints with meshes attached).
import * as THREE from 'three';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, ITEM_MAP } from './catalog.js';
import { plain, shade, skinTexture, skinBump, hairTexture, hairBump, hairlineAlpha, irisTexture, radialGlow } from './textures.js';
import { buildItem, disposeTree } from './wardrobe.js';

export const ZS = 0.74; // torso depth ratio

export const PROFILES = {
  boy: {
    torso: [[0.128, -0.03], [0.13, 0.05], [0.137, 0.15], [0.15, 0.27], [0.158, 0.36], [0.155, 0.42], [0.13, 0.47], [0.075, 0.51], [0.05, 0.53]],
    pelvis: [[0.05, -0.17], [0.115, -0.13], [0.138, -0.06], [0.136, 0.0], [0.13, 0.06]],
    shoulderX: 0.18, armR: 0.052, foreR: 0.046, thighR: 0.07, shinR: 0.054, hipX: 0.082,
  },
  girl: {
    torso: [[0.124, -0.03], [0.118, 0.05], [0.12, 0.15], [0.136, 0.27], [0.142, 0.36], [0.14, 0.42], [0.118, 0.47], [0.07, 0.51], [0.046, 0.53]],
    pelvis: [[0.05, -0.17], [0.118, -0.13], [0.142, -0.06], [0.138, 0.0], [0.126, 0.06]],
    shoulderX: 0.166, armR: 0.048, foreR: 0.042, thighR: 0.067, shinR: 0.051, hipX: 0.08,
  },
};


// ---- head shape -----------------------------------------------------------
export const HEAD_R = 0.165;
export const HEAD_C = new THREE.Vector3(0, 0.13, 0);
export const HEAD_SCALE = new THREE.Vector3(1, 1.06, 0.98);
const smooth01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
// narrower towards the jaw/chin (yr = unit-sphere height, 1 = crown, -1 = chin)
export const jawTaper = (yr) => 1 - 0.12 * Math.pow(smooth01((0.1 - yr) / 1.1), 1.5);
export const frontTaper = (yr) => 1 - 0.03 * smooth01((0.1 - yr) / 1.1);
const backTaper = (yr) => 1 - 0.1 * smooth01((0.15 - yr) / 1.15);
export function deformHead(geo, R) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const yr = pos.getY(i) / R;
    pos.setX(i, pos.getX(i) * jawTaper(yr));
    const z = pos.getZ(i);
    pos.setZ(i, z * (z > 0 ? frontTaper(yr) : backTaper(yr)));
  }
  geo.computeVertexNormals();
}
// thin a TubeGeometry towards its outer end (for brows)
function taperTube(geo) {
  const { tubularSegments: ts, radialSegments: rs, path } = geo.parameters;
  const pos = geo.attributes.position;
  for (let i = 0; i <= ts; i++) {
    const t = i / ts, c = path.getPointAt(t), f = 1.15 - t * 0.7;
    for (let k = 0; k <= rs; k++) {
      const idx = i * (rs + 1) + k;
      pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * f, c.y + (pos.getY(idx) - c.y) * f * 0.75, c.z + (pos.getZ(idx) - c.z) * f * 0.6);
    }
  }
  geo.computeVertexNormals();
}
const mixHex = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

// ---- feet (shared with the sandal builders) ---------------------------------
export const SOLE_Y = -0.072;                    // underside of the bare foot, in foot-joint space
export const FOOT_Z0 = -0.06, FOOT_Z1 = 0.152;   // heel .. toe tip
// [x (left foot; inner side is -x), z, radius]
export const TOES = [[-0.021, 0.128, 0.0135], [-0.0055, 0.133, 0.0105], [0.0075, 0.129, 0.0095], [0.019, 0.122, 0.0088], [0.029, 0.112, 0.008]];
const footT = (z) => (z - FOOT_Z0) / (FOOT_Z1 - FOOT_Z0);
const plan = (zu) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(zu), 4)), 0.25);
const footW = (t) => 0.043 + 0.012 * t;
const footH = (t) => 0.056 - 0.028 * t;
// cross-section of the foot at depth z: half width and top height
export function footSection(z) {
  const t = Math.min(1, Math.max(0, footT(z))), zu = t * 2 - 1;
  return { halfW: plan(zu) * footW(t), top: SOLE_Y + 0.006 + Math.sqrt(Math.max(0, 1 - zu * zu)) * footH(t) };
}
let footGeoCache = null;
export function footGeometry() {
  if (footGeoCache) return footGeoCache.clone();
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), zu = pos.getZ(i);
    const t = (zu + 1) / 2, s = Math.sqrt(Math.max(1e-6, 1 - zu * zu));
    const xn = Math.abs(s) < 1e-3 ? 0 : x / s;
    pos.setXYZ(i,
      xn * plan(zu) * footW(t) * Math.min(1, s * 4),
      SOLE_Y + 0.006 + (y > 0 ? y * footH(t) : y * 0.006 / Math.max(0.2, s)),
      FOOT_Z0 + t * (FOOT_Z1 - FOOT_Z0));
  }
  geo.computeVertexNormals();
  footGeoCache = geo;
  return geo.clone();
}

// Radius of a profile at height y (linear interpolation).
export function profileR(prof, y) {
  if (y <= prof[0][1]) return prof[0][0];
  for (let i = 1; i < prof.length; i++) {
    const [r1, y1] = prof[i], [r0, y0] = prof[i - 1];
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return prof[prof.length - 1][0];
}

// Lathe with elliptical cross-section: x radius r+off, z radius r*zs+off. u=0.5 at the front (+z).
export function ellipticLathe(points, { off = 0, zs = ZS, zsTop = null, segs = 40, phiStart = Math.PI, phiLength = Math.PI * 2, scaleR = 1 } = {}) {
  const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r * scaleR), y));
  const geo = new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
  const pos = geo.attributes.position;
  const ys = points.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    // optional depth ratio that changes from hem (zs) to top (zsTop)
    const k = zsTop == null ? zs : zs + (zsTop - zs) * ((pos.getY(i) - y0) / Math.max(1e-5, y1 - y0));
    pos.setX(i, (x / r) * (r + off));
    pos.setZ(i, (z / r) * (r * k + off));
  }
  geo.computeVertexNormals();
  return geo;
}

const capsule = (r, len, mat) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  m.position.y = -len / 2;
  m.castShadow = true;
  return m;
};

export class Character {
  constructor(outfit) {
    this.root = new THREE.Group();
    this.root.name = 'character';
    this.layers = {};
    this.layerKeys = {};
    this.bodyKey = '';
    this.outfit = null;
    this.bodyMeshes = [];
    this.hairParts = [];
    if (outfit) this.setOutfit(outfit);
  }

  get prof() { return PROFILES[this.outfit?.body === 'girl' ? 'girl' : 'boy']; }

  buildRig(body) {
    // remove old rig
    if (this.j) {
      for (const slot of Object.keys(this.layers)) this.clearLayer(slot);
      this.root.remove(this.j.hips);
      disposeTree(this.j.hips);
    }
    const P = PROFILES[body];
    const j = {};
    j.hips = new THREE.Group(); j.hips.position.y = 0.92; this.root.add(j.hips);
    j.torso = new THREE.Group(); j.torso.position.y = 0.04; j.hips.add(j.torso);
    j.neck = new THREE.Group(); j.neck.position.y = 0.5; j.torso.add(j.neck);
    j.head = new THREE.Group(); j.head.position.y = 0.04; j.neck.add(j.head);
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const ua = new THREE.Group(); ua.position.set(sx * P.shoulderX, 0.43, 0); j.torso.add(ua);
      const fa = new THREE.Group(); fa.position.y = -0.27; ua.add(fa);
      const hand = new THREE.Group(); hand.position.y = -0.245; fa.add(hand);
      const th = new THREE.Group(); th.position.set(sx * P.hipX, -0.04, 0); j.hips.add(th);
      const sh = new THREE.Group(); sh.position.y = -0.41; th.add(sh);
      const ft = new THREE.Group(); ft.position.y = -0.4; sh.add(ft);
      j[`uArm${s}`] = ua; j[`fArm${s}`] = fa; j[`hand${s}`] = hand;
      j[`thigh${s}`] = th; j[`shin${s}`] = sh; j[`foot${s}`] = ft;
    }
    this.j = j;
    this.layers = {}; this.layerKeys = {};
  }

  buildBody(o) {
    const j = this.j, P = this.prof, girl = o.body === 'girl';
    for (const m of this.bodyMeshes) { m.parent?.remove(m); m.geometry.dispose(); }
    this.bodyMeshes = [];
    const skinHex = SKIN_TONES[o.skin] || SKIN_TONES[3];
    const skin = new THREE.MeshPhysicalMaterial({
      color: skinHex, map: skinTexture(), roughness: 0.62, bumpMap: skinBump(), bumpScale: 0.35,
      sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffe4d2'),
    });
    const skinDark = new THREE.MeshPhysicalMaterial({ color: shade(skinHex, -0.06), map: skinTexture(), roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#ffd9c4') });
    this.skinMat = skin;
    const add = (parent, mesh) => { mesh.castShadow = true; parent.add(mesh); this.bodyMeshes.push(mesh); return mesh; };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    add(j.torso, new THREE.Mesh(ellipticLathe(P.torso), skin));
    add(j.hips, new THREE.Mesh(ellipticLathe(P.pelvis, { zs: 0.78 }), skin));
    add(j.neck, new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.048, 0.12, 18), skin));

    // ---- head: one sculpted mesh (tapered jaw, soft chin) so there are no seams
    const R = HEAD_R, C = HEAD_C;
    const headGeo = new THREE.SphereGeometry(R, 48, 36);
    deformHead(headGeo, R);
    const headM = add(j.head, new THREE.Mesh(headGeo, skin));
    headM.position.copy(C); headM.scale.copy(HEAD_SCALE);
    // ears with an inner fold
    for (const s of [-1, 1]) {
      const ear = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 12), skin));
      ear.position.set(s * 0.152, 0.118, -0.008); ear.scale.set(0.5, 1.25, 0.85); ear.rotation.y = s * -0.35;
      const inner = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), skinDark));
      inner.position.set(s * 0.162, 0.118, -0.002); inner.scale.set(0.35, 1.1, 0.7); inner.rotation.y = s * -0.35;
    }
    // surface point on the (deformed, scaled) head in front of (x, y)
    const surfZ = (x, y) => {
      const yr = (y - C.y) / (R * HEAD_SCALE.y);
      const k = jawTaper(yr);
      const xr = x / (R * k);
      return Math.sqrt(Math.max(0, 1 - xr * xr - yr * yr)) * R * HEAD_SCALE.z * frontTaper(yr) + C.z;
    };

    // ---- eyes: sclera + textured iris cap + catch-lights + blinking upper lids with lash line
    const eyeColor = EYE_COLORS[o.eyes ?? 0] || EYE_COLORS[0];
    const sclera = new THREE.MeshPhysicalMaterial({ color: '#f7f3ee', roughness: 0.25, clearcoat: 0.6 });
    const irisMat = new THREE.MeshPhysicalMaterial({ map: irisTexture(eyeColor), roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const lashMat = plain('#1d1410', { roughness: 0.6 });
    const er = girl ? 0.029 : 0.027;
    const eyeScale = V(1, 1.12, 0.66);
    for (const s of [-1, 1]) {
      const ex = s * 0.057, ey = 0.127;
      const g = new THREE.Group();
      g.position.set(ex, ey, surfZ(ex, ey) - er * eyeScale.z * 0.7);
      g.rotation.y = s * 0.08;
      j.head.add(g);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(er, 28, 20), sclera); ball.scale.copy(eyeScale); g.add(ball); this.bodyMeshes.push(ball);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(er * 1.008, 28, 10, 0, Math.PI * 2, 0, 0.72), irisMat);
      iris.rotation.x = Math.PI / 2; iris.scale.copy(eyeScale); g.add(iris); this.bodyMeshes.push(iris);
      const front = er * eyeScale.z;
      const hl = new THREE.Mesh(new THREE.SphereGeometry(er * 0.2, 10, 8), glint); hl.position.set(er * 0.28, er * 0.42, front * 0.98); g.add(hl); this.bodyMeshes.push(hl);
      const hl2 = new THREE.Mesh(new THREE.SphereGeometry(er * 0.09, 8, 6), glint); hl2.position.set(-er * 0.22, -er * 0.3, front * 0.99); g.add(hl2); this.bodyMeshes.push(hl2);
      // upper lid (skin cap) + lash line, rotated together to blink
      const low = new THREE.Mesh(new THREE.SphereGeometry(er * 1.025, 24, 8, 0, Math.PI * 2, 0, 0.95), skin);
      low.rotation.x = Math.PI + 0.25; low.scale.copy(eyeScale); g.add(low); this.bodyMeshes.push(low);
      const lid = new THREE.Group(); lid.userData.lid = true; lid.userData.lidBase = -0.17; lid.rotation.x = -0.17; g.add(lid);
      const lidCap = new THREE.Mesh(new THREE.SphereGeometry(er * 1.035, 24, 10, 0, Math.PI * 2, 0, 1.05), skin);
      lidCap.scale.copy(eyeScale); lid.add(lidCap); this.bodyMeshes.push(lidCap);
      const edge = [];
      for (let k = 0; k <= 16; k++) {
        const ph = Math.PI * 0.08 + (k / 16) * Math.PI * 0.84;
        edge.push(new THREE.Vector3(Math.cos(ph) * Math.sin(1.05) * er * 1.07, Math.cos(1.05) * er * 1.07, Math.sin(ph) * Math.sin(1.05) * er * 1.07).multiply(eyeScale));
      }
      if (girl) { // little flick at the outer corner
        const o0 = edge[s > 0 ? 0 : edge.length - 1].clone();
        const flick = o0.clone().add(V(s * er * 0.45, er * 0.25, -er * 0.05));
        if (s > 0) edge.unshift(flick); else edge.push(flick);
      }
      const lash = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 24, girl ? 0.0034 : 0.0022, 6), lashMat);
      lid.add(lash); this.bodyMeshes.push(lash);
      // brow: tapered arch following the forehead
      const bpts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, bx = s * (0.03 + t * 0.06), by = 0.176 + Math.sin(t * Math.PI) * 0.012 - t * 0.004;
        bpts.push(V(bx, by, surfZ(bx, by) + 0.002));
      }
      const browGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bpts), 16, 0.0062, 6);
      taperTube(browGeo);
      add(j.head, new THREE.Mesh(browGeo, this.browMat(o)));
      // soft blush
      const cheek = add(j.head, new THREE.Mesh(new THREE.CircleGeometry(0.03, 20),
        new THREE.MeshBasicMaterial({ map: radialGlow('#ff8f86'), transparent: true, opacity: 0.45, depthWrite: false })));
      cheek.position.set(s * 0.088, 0.085, surfZ(s * 0.088, 0.085) + 0.002); cheek.rotation.y = s * 0.55;
      cheek.castShadow = false;
    }
    // nose: bridge + rounded tip + nostril shading
    const nb = add(j.head, new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.026, 4, 10), skin));
    nb.position.set(0, 0.112, surfZ(0, 0.112) - 0.003); nb.rotation.x = -0.32;
    const tip = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.0135, 16, 12), skin));
    tip.position.set(0, 0.093, surfZ(0, 0.093) + 0.004); tip.scale.set(1.15, 0.85, 0.85);
    for (const s of [-1, 1]) {
      const wing = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), skin));
      wing.position.set(s * 0.012, 0.089, surfZ(s * 0.012, 0.089)); wing.scale.set(1, 0.8, 0.8);
      const nos = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.0042, 8, 6), plain(shade(skinHex, -0.28), { roughness: 0.9 })));
      nos.position.set(s * 0.0075, 0.084, surfZ(s * 0.0075, 0.084) + 0.0005); nos.scale.set(1.2, 0.6, 0.7);
    }
    // mouth: smile line + lower lip
    const lip = mixHex(skinHex, '#c25a52', 0.3);
    const mpts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10 - 0.5, mx = t * 0.056, my = 0.06 - (0.25 - t * t) * 0.045 + (Math.abs(t) > 0.42 ? (Math.abs(t) - 0.42) * 0.05 : 0);
      mpts.push(V(mx, my, surfZ(mx, my) + 0.0015));
    }
    const mouthGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mpts), 20, 0.0042, 6);
    add(j.head, new THREE.Mesh(mouthGeo, plain(shade(lip, -0.22), { roughness: 0.45 })));
    const ll = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10), plain(lip, { roughness: 0.4 })));
    ll.position.set(0, 0.0475, surfZ(0, 0.0475) - 0.004); ll.scale.set(1.05, 0.34, 0.4);

    // ---- arms & hands
    for (const s of ['L', 'R']) {
      add(j[`uArm${s}`], capsule(P.armR, 0.22, skin));
      add(j[`fArm${s}`], capsule(P.foreR, 0.2, skin));
      const palm = add(j[`hand${s}`], new THREE.Mesh(new THREE.SphereGeometry(0.042, 18, 14), skin));
      palm.position.y = -0.045; palm.scale.set(0.62, 1.15, 0.86);
      // curled fingers
      for (let f = 0; f < 4; f++) {
        const fing = add(j[`hand${s}`], new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.022, 4, 8), skin));
        fing.position.set(0, -0.078 - (f === 0 || f === 3 ? -0.004 : 0), 0.022 - f * 0.015); fing.rotation.x = Math.PI / 2;
      }
      const thumb = add(j[`hand${s}`], new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.03, 4, 8), skin));
      thumb.position.set(0, -0.032, 0.036); thumb.rotation.x = 0.7;
      // legs
      add(j[`thigh${s}`], capsule(P.thighR, 0.3, skin));
      const shin = add(j[`shin${s}`], capsule(P.shinR, 0.35, skin)); shin.position.y = -0.21;
      // foot with toes (shape shared with the sandal builders)
      const sx = s === 'L' ? 1 : -1;
      const foot = add(j[`foot${s}`], new THREE.Mesh(footGeometry(), skin));
      foot.name = 'bareFoot';
      TOES.forEach(([x, z, r]) => {
        const toe = add(j[`foot${s}`], new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), skin));
        toe.position.set(sx * x, SOLE_Y + r * 1.05, z + 0.006); toe.scale.set(1, 0.9, 1.2);
      });
    }
  }

  browMat(o) {
    return plain(shade(HAIR_COLORS[o.hairColor] || '#2a1a12', -0.05), { roughness: 0.85 });
  }

  buildHair(o) {
    for (const m of this.hairParts) { m.parent?.remove(m); m.geometry.dispose(); }
    this.hairParts = [];
    const color = HAIR_COLORS[o.hairColor] || HAIR_COLORS[1];
    const curly = ['crop', 'coils', 'curly', 'puffs'].includes(o.hair);
    const kind = curly ? 'curly' : 'straight';
    const hairOpts = { color, map: hairTexture(kind), bumpMap: hairBump(kind), bumpScale: curly ? 3 : 2, roughness: 0.48, metalness: 0.0, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(shade(color, 0.25)) };
    const mat = new THREE.MeshPhysicalMaterial(hairOpts);
    const longStyle = ['shoulder', 'braid', 'lowknot', 'lowbun', 'loop', 'twists', 'braidcrown'].includes(o.hair);
    const capMat = new THREE.MeshPhysicalMaterial({ ...hairOpts, alphaMap: hairlineAlpha(longStyle ? 'long' : 'short', 0.8), alphaTest: 0.5, side: THREE.DoubleSide });
    this.hairMat = mat;
    const head = this.j.head;
    const R = HEAD_R, C = HEAD_C;
    const add = (geo, pos, scale, top = false, rot = null, m = mat) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.copy(pos); if (scale) mesh.scale.copy(scale); if (rot) mesh.rotation.set(...rot);
      mesh.castShadow = true; mesh.userData.top = top;
      head.add(mesh); this.hairParts.push(mesh); return mesh;
    };
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // scalp cap that hugs the head and is cut by a natural hairline (alpha map); u=0.25 → forehead
    const lift = curly ? 1.05 : 1.035;
    const capGeo = new THREE.SphereGeometry(R * lift, 48, 30, 0, Math.PI * 2, 0, Math.PI * 0.8);
    deformHead(capGeo, R * lift);
    add(capGeo, C.clone(), HEAD_SCALE.clone().multiplyScalar(1), false, null, capMat);
    const onScalp = (theta, phi, out = 1.06) => { // point on scalp: theta from crown, phi: 0 = front
      const yr = Math.cos(theta), s = Math.sin(theta);
      const k = jawTaper(yr);
      return v(Math.sin(phi) * s * R * out * k, yr * R * out * HEAD_SCALE.y + C.y, Math.cos(phi) * s * R * out * HEAD_SCALE.z * frontTaper(yr));
    };
    const tuft = (r, p, sc = null, top = true) => add(new THREE.SphereGeometry(r, 16, 12), p, sc, top);
    const curlsOnScalp = (n, r, maxTheta = 1.25, out = 1.04, top = true) => {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const theta = Math.acos(1 - t * (1 - Math.cos(maxTheta)));
        const phi = i * 2.39996;
        if (Math.cos(phi) > 0.55 && theta > 0.75) continue; // keep the forehead clear
        tuft(r * (0.8 + ((i * 37) % 10) / 25), onScalp(theta, phi, out), null, top);
      }
    };
    switch (o.hair) {
      case 'crop': curlsOnScalp(26, 0.036, 1.1); break;
      case 'coils': curlsOnScalp(60, 0.026, 1.25, 1.03); break;
      case 'curly': curlsOnScalp(34, 0.045, 1.45, 1.05); for (const s of [-1, 1]) tuft(0.045, onScalp(1.55, s * 1.75, 1.05), null, false); break;
      case 'wavy': {
        // side-swept fringe: flattened locks lying along the scalp, sweeping to one side
        for (let k = 0; k < 6; k++) {
          const phi = -0.75 + k * 0.3, theta = 0.5 + Math.abs(phi) * 0.12;
          const p = onScalp(theta, phi, 1.02);
          const lock = add(new THREE.SphereGeometry(0.05, 18, 12), p, v(1.25, 0.32, 0.7), true);
          lock.quaternion.setFromUnitVectors(v(0, 1, 0), p.clone().sub(C).normalize()); lock.rotateY(0.6);
        }
        for (let k = 0; k < 5; k++) {
          const p = onScalp(0.25 + k * 0.05, -2.4 + k * 1.2, 1.01);
          const lock = add(new THREE.SphereGeometry(0.055, 18, 12), p, v(1.2, 0.35, 0.8), true);
          lock.quaternion.setFromUnitVectors(v(0, 1, 0), p.clone().sub(C).normalize());
        }
        break;
      }
      case 'shoulder': {
        // curtain of hair falling to the shoulders behind the ears
        const pts = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([0.17 + Math.sin(t * Math.PI * 1.5) * 0.012 + t * 0.03, 0.06 - t * 0.3]); }
        const back = ellipticLathe(pts.reverse(), { zs: 0.9, phiStart: Math.PI * 0.35, phiLength: Math.PI * 1.3, segs: 36 });
        add(back, C.clone().add(v(0, -0.02, -0.02)), null, false, null, new THREE.MeshPhysicalMaterial({ ...hairOpts, side: THREE.DoubleSide }));
        for (const s of [-1, 1]) {
          const lock = add(new THREE.CapsuleGeometry(0.035, 0.16, 6, 12), C.clone().add(v(s * 0.15, -0.08, 0.02)), v(1, 1, 0.75), false);
          lock.rotation.z = s * 0.12;
        }
        break;
      }
      case 'braidcrown': {
        for (let i = 0; i < 26; i++) {
          const phi = (i / 26) * Math.PI * 2;
          const b = add(new THREE.SphereGeometry(0.026, 12, 10), onScalp(0.95 + (Math.cos(phi) > 0 ? -0.2 * Math.cos(phi) : 0), phi, 1.08), v(1, 0.8, 1.3), false);
          b.rotation.set(0.3 * (i % 2 ? 1 : -1), phi, 0.5 * (i % 2 ? 1 : -1));
        }
        break;
      }
      case 'lowknot': {
        tuft(0.07, C.clone().add(v(0, -0.04, -0.175)), null, false);
        for (const s of [-1, 1]) { const w = tuft(0.026, onScalp(1.25, s * 1.2, 1.02), v(0.7, 1.6, 0.7), false); w.rotation.z = s * 0.3; }
        break;
      }
      case 'braid': {
        let y = -0.03, z = -0.17, r = 0.042;
        for (let i = 0; i < 11; i++) {
          const b = tuft(r, C.clone().add(v(0, y, z)), v(1.05, 0.85, 0.75), false);
          b.rotation.z = i % 2 ? 0.55 : -0.55;
          y -= 0.042; z -= 0.006; r *= 0.955;
        }
        tuft(0.016, C.clone().add(v(0, y + 0.01, z)), v(1, 1.4, 1), false);
        break;
      }
      case 'lowbun': {
        const bun = add(new THREE.TorusGeometry(0.042, 0.026, 12, 24), C.clone().add(v(0, -0.03, -0.185)), null, false);
        bun.rotation.y = 0.2;
        tuft(0.04, C.clone().add(v(0, -0.03, -0.19)), null, false);
        break;
      }
      case 'twists': {
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
          const p = onScalp(1.45, s * (1.35 + k * 0.42), 1.02);
          for (let q = 0; q < 4; q++) {
            const seg = tuft(0.017, p.clone().add(v(0, -0.02 - q * 0.022, 0)), v(1, 1.3, 1), false);
            seg.rotation.z = q % 2 ? 0.4 : -0.4;
          }
        }
        tuft(0.048, C.clone().add(v(0, -0.01, -0.18)), null, false);
        break;
      }
      case 'loop': {
        const l = add(new THREE.TorusGeometry(0.055, 0.025, 12, 28), C.clone().add(v(0, -0.07, -0.18)), null, false);
        l.rotation.y = Math.PI / 2;
        break;
      }
      case 'puffs': {
        for (const s of [-1, 1]) tuft(0.085, onScalp(0.7, s * 1.25, 1.18), null, true);
        curlsOnScalp(18, 0.028, 1.2, 1.02);
        break;
      }
      default: break;
    }
    this.updateHairVisibility();
  }

  updateHairVisibility() {
    const o = this.outfit;
    if (!o) return;
    const head = o.head ? ITEM_MAP[o.head] : null;
    const covered = !!o.helmet || !!(head && head.look.replacesHelmet);
    for (const m of this.hairParts) m.visible = !(covered && m.userData.top);
  }

  // Apply an outfit object (see catalog.defaultOutfit). Rebuilds only what changed.
  setOutfit(outfit) {
    const o = JSON.parse(JSON.stringify(outfit));
    const prevBody = this.outfit?.body;
    this.outfit = o;
    if (!this.j || prevBody !== o.body) {
      this.buildRig(o.body);
      this.bodyKey = '';
    }
    const bk = `${o.body}|${o.skin}|${o.hairColor}|${o.eyes ?? 0}`;
    if (bk !== this.bodyKey) { this.buildBody(o); this.bodyKey = bk; this.hairKey = ''; }
    const hk = `${o.hair}|${o.hairColor}`;
    if (hk !== this.hairKey) { this.buildHair(o); this.hairKey = hk; }

    const head = o.head ? ITEM_MAP[o.head] : null;
    const hideHelmet = !!(head && head.look.replacesHelmet);
    const slots = {
      tunic: o.tunic, outer: o.outer, breastplate: o.breastplate, belt: o.belt, shoes: o.shoes,
      shield: o.shield, helmet: hideHelmet ? null : o.helmet, sword: o.sword,
      head: o.head ? `${o.head}|${o.helmet && !hideHelmet ? 'h' : ''}` : null,
    };
    for (const a of o.acc || []) slots[`acc:${a}`] = a;
    // clear accessory layers that are gone
    for (const k of Object.keys(this.layers)) if (k.startsWith('acc:') && !(k in slots)) this.clearLayer(k);
    for (const [slot, val] of Object.entries(slots)) {
      const dep = slot === 'breastplate' ? `|${o.outer || ''}` : slot === 'belt' ? `|${o.outer || ''}` : slot.startsWith('acc:') ? `|${o.breastplate ? 1 : 0}${o.outer ? 1 : 0}` : '';
      const key = val ? `${val}|${o.body}${dep}` : '';
      if (this.layerKeys[slot] === key) continue;
      this.clearLayer(slot);
      this.layerKeys[slot] = key;
      if (!val) continue;
      const id = String(val).split('|')[0];
      const item = ITEM_MAP[id];
      if (!item) continue;
      const parts = buildItem(item, this.ctx(o, slot));
      this.layers[slot] = parts;
      for (const p of parts) (this.j[p.joint] || this.root).add(p.obj);
    }
    // bare feet visible only without shoes that wrap; sandals keep toes visible
    this.updateHairVisibility();
  }

  ctx(o, slot) {
    const P = this.prof;
    return {
      body: o.body, P, slot, outfit: o,
      hasHelmet: !!o.helmet && !(o.head && ITEM_MAP[o.head]?.look.replacesHelmet),
      hasBreastplate: !!o.breastplate,
      hasOuter: !!o.outer,
      skinColor: SKIN_TONES[o.skin],
      // z of torso front surface at torso-local height y
      front: (y, off = 0) => profileR(P.torso, y) * ZS + off,
      torsoR: (y) => profileR(P.torso, y),
    };
  }

  clearLayer(slot) {
    const parts = this.layers[slot];
    if (parts) for (const p of parts) { p.obj.parent?.remove(p.obj); disposeTree(p.obj); }
    delete this.layers[slot];
    delete this.layerKeys[slot];
  }

  // Apply a pose: map of joint name -> [x,y,z] euler, plus optional hipsY, rootY, rootRotY
  applyPose(p) {
    const j = this.j;
    for (const k of JOINT_NAMES) {
      const r = p[k];
      if (r) j[k].rotation.set(r[0], r[1], r[2]);
    }
    j.hips.position.y = 0.92 + (p.hipsY || 0);
    this.root.position.y = (p.rootY || 0) + (this.outfit?.shoes ? 0.018 : 0); // sandals lift the feet by the sole
    this.root.rotation.y = p.rootRotY || 0;
  }

  dispose() {
    for (const slot of Object.keys(this.layers)) this.clearLayer(slot);
    if (this.j) disposeTree(this.j.hips);
    this.root.parent?.remove(this.root);
  }

  worldPos(joint, local = [0, 0, 0]) {
    const v = new THREE.Vector3(...local);
    this.root.updateMatrixWorld(true);
    return this.j[joint].localToWorld(v);
  }
}

export const JOINT_NAMES = ['hips', 'torso', 'neck', 'head', 'uArmL', 'fArmL', 'handL', 'uArmR', 'fArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
