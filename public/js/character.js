// Procedural stylised character rig (no skinning: a hierarchy of joints with meshes attached).
import * as THREE from 'three';
import { SKIN_TONES, HAIR_COLORS, ITEM_MAP } from './catalog.js';
import { plain, shade } from './textures.js';
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
    const skin = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.68 });
    this.skinMat = skin;
    const add = (parent, mesh) => { mesh.castShadow = true; parent.add(mesh); this.bodyMeshes.push(mesh); return mesh; };

    add(j.torso, new THREE.Mesh(ellipticLathe(P.torso), skin));
    add(j.hips, new THREE.Mesh(ellipticLathe(P.pelvis, { zs: 0.78 }), skin));
    const neck = add(j.neck, new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.048, 0.12, 14), skin)); neck.position.y = 0.0;

    // head
    const R = 0.165;
    const headM = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), skin));
    headM.position.y = 0.13; headM.scale.set(1, 1.06, 0.98);
    for (const s of [-1, 1]) {
      const ear = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), skin));
      ear.position.set(s * 0.162, 0.12, -0.005); ear.scale.set(0.7, 1.4, 0.9);
    }
    // face
    const eyeMat = plain('#2a1a12', { roughness: 0.25 });
    const white = plain('#ffffff', { roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.25 });
    const browMat = plain(HAIR_COLORS[o.hairColor] || '#2a1a12', { roughness: 0.8 });
    const eyeScale = girl ? 1.12 : 1;
    for (const s of [-1, 1]) {
      const eye = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.024 * eyeScale, 16, 12), eyeMat));
      eye.position.set(s * 0.058, 0.128, 0.148); eye.scale.set(0.95, 1.25, 0.6);
      const hl = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), white));
      hl.position.set(s * 0.058 + 0.008, 0.142, 0.162);
      const brow = add(j.head, new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.04, 4, 8), browMat));
      brow.position.set(s * 0.06, 0.183, 0.15); brow.rotation.z = Math.PI / 2 + s * 0.12; brow.rotation.y = s * 0.25;
      if (girl) {
        const lash = add(j.head, new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.014, 3, 6), eyeMat));
        lash.position.set(s * 0.083, 0.152, 0.142); lash.rotation.z = s * -0.9;
      }
      const cheek = add(j.head, new THREE.Mesh(new THREE.CircleGeometry(0.026, 16),
        new THREE.MeshBasicMaterial({ color: '#ff8f86', transparent: true, opacity: 0.28, depthWrite: false })));
      cheek.position.set(s * 0.093, 0.09, 0.137); cheek.rotation.y = s * 0.6;
    }
    const nose = add(j.head, new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), plain(shade(skinHex, -0.04), { roughness: 0.7 })));
    nose.position.set(0, 0.095, 0.168); nose.scale.set(1, 0.9, 0.8);
    const mouth = add(j.head, new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0065, 6, 16, Math.PI), plain('#8a3a30', { roughness: 0.5 })));
    mouth.position.set(0, 0.058, 0.152); mouth.rotation.z = Math.PI; mouth.rotation.x = -0.25;

    // arms
    for (const s of ['L', 'R']) {
      add(j[`uArm${s}`], capsule(P.armR, 0.22, skin));
      add(j[`fArm${s}`], capsule(P.foreR, 0.2, skin));
      const palm = add(j[`hand${s}`], new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), skin));
      palm.position.y = -0.045; palm.scale.set(0.62, 1.2, 0.85);
      const thumb = add(j[`hand${s}`], new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.03, 4, 8), skin));
      thumb.position.set(0, -0.03, 0.034); thumb.rotation.x = 0.7;
      // legs
      add(j[`thigh${s}`], capsule(P.thighR, 0.3, skin));
      const shin = add(j[`shin${s}`], capsule(P.shinR, 0.33, skin)); shin.position.y = -0.2;
      const foot = add(j[`foot${s}`], new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), skin));
      foot.position.set(0, -0.04, 0.045); foot.scale.set(0.95, 0.68, 2.0);
      foot.name = 'bareFoot';
    }
  }

  buildHair(o) {
    for (const m of this.hairParts) { m.parent?.remove(m); m.geometry.dispose(); }
    this.hairParts = [];
    const color = HAIR_COLORS[o.hairColor] || HAIR_COLORS[1];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    this.hairMat = mat;
    const head = this.j.head;
    const R = 0.165, C = new THREE.Vector3(0, 0.13, 0);
    const add = (geo, pos, scale, top = false, rot = null) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos); if (scale) m.scale.copy(scale); if (rot) m.rotation.set(...rot);
      m.castShadow = true; m.userData.top = top;
      head.add(m); this.hairParts.push(m); return m;
    };
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // base cap (tilted dome that leaves the face open)
    const cap = add(new THREE.SphereGeometry(R * 1.06, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.58), C.clone().add(v(0, 0.012, -0.012)), v(1.02, 1.06, 1.02));
    cap.rotation.x = -0.42;
    const sideburns = () => {
      for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.05, 12, 10), C.clone().add(v(s * 0.145, 0.02, -0.02)), v(0.45, 1.1, 0.9));
    };
    const ball = (r, x, y, z, top = true, sc = null) => add(new THREE.SphereGeometry(r, 12, 10), C.clone().add(v(x, y, z)), sc, top);
    const bumpsOnDome = (n, r, minY = 0.02, top = true, spread = 1.0) => {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const phi = Math.acos(1 - t * (1.1 * spread));
        const th = i * 2.39996;
        const d = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        d.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.42);
        if (d.y * R < minY - 0.06 && d.z > -0.2) continue;
        if (d.z > 0.55 && d.y < 0.55) continue; // keep the face clear
        ball(r, d.x * R * 1.08, d.y * R * 1.1 + 0.01, d.z * R * 1.06 - 0.01, top);
      }
    };
    switch (o.hair) {
      case 'crop': bumpsOnDome(16, 0.045); sideburns(); break;
      case 'coils': bumpsOnDome(36, 0.032); break;
      case 'curly': bumpsOnDome(22, 0.052, -0.04); for (const s of [-1, 1]) ball(0.05, s * 0.15, 0.03, -0.05, false); break;
      case 'wavy': {
        const fr = add(new THREE.SphereGeometry(0.1, 16, 12), C.clone().add(v(0.03, 0.135, 0.105)), v(1.4, 0.45, 0.7), true);
        fr.rotation.z = 0.25;
        bumpsOnDome(10, 0.05);
        sideburns();
        break;
      }
      case 'shoulder': {
        const back = add(new THREE.SphereGeometry(0.17, 24, 16), C.clone().add(v(0, -0.07, -0.06)), v(1.08, 1.05, 0.85));
        back.userData.top = false;
        for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.045, 0.14, 6, 10), C.clone().add(v(s * 0.14, -0.06, 0.01)), v(1, 1, 0.8));
        bumpsOnDome(8, 0.05);
        break;
      }
      case 'braidcrown': {
        const t = add(new THREE.TorusGeometry(R * 0.98, 0.028, 10, 40), C.clone().add(v(0, 0.07, -0.02)), null, false);
        t.rotation.x = Math.PI / 2 - 0.42;
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2;
          const p = new THREE.Vector3(Math.cos(a) * R * 0.98, 0, Math.sin(a) * R * 0.98).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.42);
          ball(0.03, p.x, p.y + 0.07, p.z - 0.02, false, v(1, 0.8, 1.2));
        }
        break;
      }
      case 'lowknot': {
        ball(0.075, 0, -0.03, -0.17, false);
        for (const s of [-1, 1]) ball(0.03, s * 0.13, 0.08, 0.1, false, v(0.7, 1.4, 0.7));
        break;
      }
      case 'braid': {
        let y = -0.02, z = -0.16, r = 0.05;
        for (let i = 0; i < 9; i++) { ball(r, 0, y, z, false, v(1, 1.15, 0.9)); y -= 0.055; z -= 0.012; r *= 0.93; }
        sideburns();
        break;
      }
      case 'lowbun': {
        const bun = add(new THREE.TorusGeometry(0.045, 0.03, 10, 20), C.clone().add(v(0, -0.02, -0.175)), null, false);
        ball(0.048, 0, -0.02, -0.18, false);
        bun.rotation.y = 0;
        break;
      }
      case 'twists': {
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
          const tw = add(new THREE.CapsuleGeometry(0.022, 0.09, 4, 8), C.clone().add(v(s * (0.15 - k * 0.005), -0.02 - k * 0.012, 0.03 - k * 0.07)), null, false);
          tw.rotation.z = s * 0.15;
        }
        ball(0.05, 0, 0.0, -0.17, false);
        break;
      }
      case 'loop': {
        const l = add(new THREE.TorusGeometry(0.06, 0.026, 10, 24), C.clone().add(v(0, -0.06, -0.17)), null, false);
        l.rotation.y = Math.PI / 2;
        break;
      }
      case 'puffs': {
        for (const s of [-1, 1]) ball(0.09, s * 0.13, 0.15, -0.04, true);
        bumpsOnDome(10, 0.035);
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
    const bk = `${o.body}|${o.skin}|${o.hairColor}`;
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
    this.root.position.y = p.rootY || 0;
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
