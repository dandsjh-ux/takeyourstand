// Runway walks, poses and a smoothing animator for the Character rig.
import { JOINT_NAMES } from './character.js';

const R = (x = 0, y = 0, z = 0) => [x, y, z];
export const REST = {
  hips: R(), torso: R(), neck: R(), head: R(),
  uArmL: R(0.05, 0, 0.22), fArmL: R(-0.22, 0, 0), handL: R(),
  uArmR: R(0.05, 0, -0.22), fArmR: R(-0.28, 0, 0), handR: R(),
  thighL: R(0, 0, 0.03), shinL: R(), footL: R(0, 0, -0.03),
  thighR: R(0, 0, -0.03), shinR: R(), footR: R(0, 0, 0.03),
  hipsY: 0, rootY: 0, rootRotY: 0,
};

const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const breathe = (t) => Math.sin(t * 1.7) * 0.02;

// Arm helpers (left arm = +x side). Values found by eye for this rig.
const HAND_ON_HIP_L = { uArmL: R(0.3, 0, 0.85), fArmL: R(0, 0, -1.55), handL: R(0, 0, 0.3) };
const HAND_ON_HIP_R = { uArmR: R(0.3, 0, -0.85), fArmR: R(0, 0, 1.55), handR: R(0, 0, -0.3) };
const SHIELD_FRONT = { uArmL: R(-0.75, 0.2, 0.45), fArmL: R(-0.35, 0.9, -1.4), handL: R() };
const LEGS_APART = { thighL: R(0, 0, 0.13), thighR: R(0, 0, -0.13), footL: R(0, 0, -0.13), footR: R(0, 0, 0.13) };

export const POSE_FNS = {
  standfirm: (t) => ({
    ...LEGS_APART, ...HAND_ON_HIP_L,
    uArmR: R(-0.3, 0, -0.3), fArmR: R(-0.35, 0, 0), handR: R(0.95, 0, 0),
    torso: R(-0.05 + breathe(t), 0, 0), head: R(-0.08, 0.15 * Math.sin(t * 0.8), 0),
  }),
  shieldup: (t) => ({
    ...LEGS_APART, ...SHIELD_FRONT,
    uArmR: R(-0.2, 0, -0.55), fArmR: R(-1.2, 0, 0), handR: R(-0.6, 0, 0),
    thighL: R(-0.25, 0, 0.12), shinL: R(0.2, 0, 0), thighR: R(0.12, 0, -0.12),
    torso: R(0.05, -0.15, 0), head: R(0, 0.1, 0),
  }),
  wave: (t) => ({
    uArmR: R(0, 0, -2.55), fArmR: R(0, 0, 0.45 + Math.sin(t * 9) * 0.45), handR: R(-1.2, 0, 0),
    torso: R(0, 0.06 * Math.sin(t * 4.5), 0.03 * Math.sin(t * 4.5)), head: R(-0.05, 0, 0.08),
    thighL: R(0, 0, 0.06), thighR: R(0, 0, -0.06),
  }),
  swordsky: (t) => ({
    ...LEGS_APART,
    uArmR: R(0, 0, -2.95), fArmR: R(0, 0, 0.05), handR: R(-1.6, 0, 0),
    ...SHIELD_FRONT,
    head: R(-0.35, 0, 0), torso: R(-0.08, 0, 0), hipsY: -0.01 + Math.sin(t * 2) * 0.005,
  }),
  praise: (t) => ({
    uArmL: R(-0.2, 0, 2.45 + Math.sin(t * 2.4) * 0.1), fArmL: R(-0.1, 0, -0.2),
    uArmR: R(-0.2, 0, -2.45 - Math.sin(t * 2.4) * 0.1), fArmR: R(-0.1, 0, 0.2), handR: R(-1.3, 0, 0),
    head: R(-0.3, 0, 0), torso: R(-0.06, 0, Math.sin(t * 1.6) * 0.06), hips: R(0, 0, -Math.sin(t * 1.6) * 0.03),
  }),
  prayer: (t) => ({
    uArmL: R(-0.55, 0, 0.35), fArmL: R(-1.75, 0.2, -0.55), handL: R(0, 0, -0.4),
    uArmR: R(-0.55, 0, -0.35), fArmR: R(-1.75, -0.2, 0.55), handR: R(1.4, 0, 0.4),
    head: R(0.35 - ease(t / 2.5) * 0.25, 0, 0), torso: R(0.08 + breathe(t), 0, 0),
  }),
  pointup: (t) => ({
    ...HAND_ON_HIP_L,
    uArmR: R(-0.4, 0, -2.6), fArmR: R(-0.15, 0, 0.1), handR: R(-1.5, 0, 0),
    head: R(-0.3, -0.15, 0), torso: R(-0.05, -0.1, 0),
    thighR: R(-0.12, 0, -0.08), shinR: R(0.18, 0, 0),
  }),
  bow: (t) => {
    const k = Math.min(1, t / 0.7) * (t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.7));
    return {
      torso: R(0.65 * ease(k), 0, 0), head: R(0.25 * k, 0, 0),
      uArmR: R(-0.75 * k, 0, -0.35), fArmR: R(-1.4 * k, 0, 0.8 * k), handR: R(0.6 * k, 0, 0),
      uArmL: R(0.5 * k, 0, 0.3), fArmL: R(-0.2, 0, 0),
      thighR: R(0.25 * k, 0, -0.03), thighL: R(-0.05 * k, 0, 0.03), hipsY: -0.02 * k,
    };
  },
  spin: (t) => {
    const k = ease(Math.min(1, t / 1.4));
    return {
      rootRotY: k * Math.PI * 2,
      uArmL: R(0, 0, 0.9 + 0.3 * Math.sin(k * Math.PI)), uArmR: R(0, 0, -0.9 - 0.3 * Math.sin(k * Math.PI)), fArmR: R(-0.3, 0, 0), handR: R(-0.6, 0, 0),
      head: R(-0.1, 0, 0), hipsY: 0.02 * Math.sin(k * Math.PI),
      thighL: R(-0.1 * Math.sin(k * Math.PI), 0, 0.05), shinL: R(0.4 * Math.sin(k * Math.PI), 0, 0),
      ...(t > 1.5 ? { ...LEGS_APART, ...HAND_ON_HIP_L, uArmR: R(-0.3, 0, -0.3), fArmR: R(-0.35, 0, 0), handR: R(0.95, 0, 0), rootRotY: Math.PI * 2 } : {}),
    };
  },
  hero: (t) => ({
    thighL: R(-0.35, 0, 0.22), shinL: R(0.35, 0, 0), footL: R(0, 0, -0.2),
    thighR: R(0.25, 0, -0.22), shinR: R(0.15, 0, 0), footR: R(-0.2, 0, 0.2),
    hipsY: -0.04, ...SHIELD_FRONT,
    uArmR: R(0.2, 0, -1.3), fArmR: R(-0.9, 0, 0.3), handR: R(-0.9, 0, 0),
    torso: R(0, -0.25, 0), head: R(-0.05, 0.25, 0),
  }),
  kneel: (t) => {
    const k = ease(Math.min(1, t / 0.8));
    return {
      hipsY: -0.42 * k,
      thighL: R(-1.45 * k, 0, 0.08), shinL: R(1.45 * k, 0, 0), footL: R(0, 0, -0.08),
      thighR: R(0.12 * k, 0, -0.05), shinR: R(1.5 * k, 0, 0), footR: R(0.6 * k, 0, 0.05),
      uArmR: R(-0.6, 0, -0.15), fArmR: R(-0.6, 0, 0), handR: R(0.9, 0, 0),
      uArmL: R(-0.3, 0, 0.45), fArmL: R(-0.6, 0.3, -0.6),
      head: R(t > 1.8 ? -0.15 : 0.35 * k, 0, 0), torso: R(0.05, 0, 0),
    };
  },
  jump: (t) => {
    const c = (t % 1.1) / 1.1;
    const air = c < 0.55 ? Math.sin((c / 0.55) * Math.PI) : 0;
    const crouch = c >= 0.55 ? Math.sin(((c - 0.55) / 0.45) * Math.PI) : 0;
    return {
      rootY: air * 0.28, hipsY: -crouch * 0.08,
      thighL: R(-0.3 * air - 0.3 * crouch, 0, 0.1), shinL: R(0.9 * air + 0.6 * crouch, 0, 0),
      thighR: R(-0.3 * air - 0.3 * crouch, 0, -0.1), shinR: R(0.9 * air + 0.6 * crouch, 0, 0),
      footL: R(0.4 * air, 0, 0), footR: R(0.4 * air, 0, 0),
      uArmL: R(-0.2, 0, 0.4 + 2.2 * air), uArmR: R(-0.2, 0, -0.4 - 2.2 * air), fArmR: R(-0.3, 0, 0), handR: R(-1.0 * air, 0, 0),
      head: R(-0.2 * air, 0, 0),
    };
  },
};

export const WALK_FNS = {
  march: { freq: 1.9, stride: 0.36, arm: 0.42, bob: 0.025 },
  stroll: { freq: 1.7, stride: 0.36, arm: 0.3, bob: 0.018, sway: 0.06 },
  bounce: { freq: 2.1, stride: 0.33, arm: 0.5, bob: 0.06, bounce: true },
  royal: { freq: 1.35, stride: 0.3, arm: 0.12, bob: 0.01, royal: true },
};
export const walkSpeed = (style) => {
  const w = WALK_FNS[style] || WALK_FNS.march;
  return w.freq * w.stride * 0.62; // metres per second
};
export function walkFrame(t, style) {
  const w = WALK_FNS[style] || WALK_FNS.march;
  const ph = t * w.freq * Math.PI;
  const s = Math.sin(ph), c = Math.cos(ph);
  const f = {
    thighL: R(-w.stride * s, 0, 0.03), thighR: R(w.stride * s, 0, -0.03),
    shinL: R(Math.max(0, c) * 0.7 * w.stride / 0.4, 0, 0), shinR: R(Math.max(0, -c) * 0.7 * w.stride / 0.4, 0, 0),
    footL: R(-0.15 * s, 0, -0.03), footR: R(0.15 * s, 0, 0.03),
    uArmL: R(w.arm * s, 0, 0.24), uArmR: R(-w.arm * s, 0, -0.24),
    fArmL: R(-0.3 - Math.max(0, -s) * 0.3, 0, 0), fArmR: R(-0.35 - Math.max(0, s) * 0.3, 0, 0),
    torso: R(0.03, 0.07 * s, 0), hips: R(0, -0.07 * s, (w.sway || 0) * s),
    hipsY: w.bounce ? Math.abs(Math.sin(ph)) * w.bob - 0.01 : -Math.abs(Math.sin(ph)) * w.bob,
    head: R(-0.04, -0.05 * s, 0),
  };
  if (w.royal) {
    f.uArmR = R(-0.35, 0, -1.25); f.fArmR = R(-1.1, 0, 0.35 + Math.sin(t * 5) * 0.35); f.handR = R(-1.0, 0, 0);
    f.head = R(-0.12, 0.1 * Math.sin(t * 0.7), 0); f.torso = R(-0.04, 0, 0);
  }
  if (w.bounce) { f.uArmL = R(w.arm * s, 0, 0.5); f.uArmR = R(-w.arm * s, 0, -0.5); }
  return f;
}

export function idleFrame(t) {
  return {
    torso: R(breathe(t), Math.sin(t * 0.5) * 0.03, 0),
    head: R(Math.sin(t * 0.7) * 0.03, Math.sin(t * 0.45) * 0.12, 0),
    uArmL: R(0.05, 0, 0.22 + breathe(t)), uArmR: R(0.05, 0, -0.22 - breathe(t)),
  };
}

export class Animator {
  constructor(character) {
    this.c = character;
    this.cur = JSON.parse(JSON.stringify(REST));
    this.mode = 'idle';
    this.opts = {};
    this.t = 0;
    this.time = 0;
  }
  set(mode, opts = {}) {
    if (mode === this.mode && opts.id === this.opts.id && opts.style === this.opts.style && !opts.restart) return;
    // unwind spins so the next clip doesn't rotate backwards
    this.cur.rootRotY = ((this.cur.rootRotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (this.cur.rootRotY > Math.PI) this.cur.rootRotY -= Math.PI * 2;
    this.mode = mode; this.opts = opts; this.t = 0;
  }
  target() {
    let o = {};
    if (this.mode === 'walk') o = walkFrame(this.t, this.opts.style);
    else if (this.mode === 'pose' && POSE_FNS[this.opts.id]) o = POSE_FNS[this.opts.id](this.t);
    else o = idleFrame(this.time);
    return { ...REST, ...o };
  }
  update(dt) {
    this.t += dt; this.time += dt;
    const tg = this.target();
    const k = 1 - Math.exp(-dt * (this.mode === 'walk' ? 14 : 9));
    for (const j of JOINT_NAMES) {
      const a = this.cur[j] || (this.cur[j] = [0, 0, 0]), b = tg[j];
      for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k;
    }
    for (const key of ['hipsY', 'rootY']) this.cur[key] += ((tg[key] || 0) - this.cur[key]) * Math.min(1, k * 1.6);
    // spins are applied directly so they stay crisp
    if (this.mode === 'pose' && this.opts.id === 'spin') this.cur.rootRotY = tg.rootRotY;
    else this.cur.rootRotY += ((tg.rootRotY || 0) - this.cur.rootRotY) * k;
    this.c.applyPose(this.cur);
    // blinking: a quick close every few seconds
    this.blinkIn = (this.blinkIn ?? 2 + Math.random() * 2) - dt;
    if (this.blinkIn < 0) { this.blinkT = 0; this.blinkIn = 2.2 + Math.random() * 3.5; }
    let blink = 0;
    if (this.blinkT != null) { this.blinkT += dt; blink = this.blinkT < 0.16 ? Math.sin((this.blinkT / 0.16) * Math.PI) : 0; if (this.blinkT >= 0.16) this.blinkT = null; }
    // little extras: dove bob, lamp flicker, eyelids
    this.c.root.traverse((o) => {
      if (o.userData.lid) o.rotation.x = o.userData.lidBase + blink * 1.45;
      if (o.userData.bob) o.position.y = 0.52 + Math.abs(Math.sin(this.time * 3)) * 0.012;
      if (o.userData.flame) o.scale.y = 1.6 + Math.sin(this.time * 23) * 0.25 + Math.sin(this.time * 9) * 0.2;
    });
  }
}
