// The Jerusalem stone runway: environment, presentation timeline and results podium.
import * as THREE from 'three';
import { Character } from './character.js';
import { Animator, walkSpeed } from './poses.js';
import { stoneTexture, mosaicTexture, skyTexture, radialGlow, emblemTexture, fabric, metal, leather, shade } from './textures.js';
import { toScreen } from './studio.js';

const START_Z = -20.5, END_Z = 0.55;

// Walk, then each chosen pose in turn. The walk shortens when needed so every pose
// (up to 5) gets its moment before the team's time is up.
export function timeline(entry, T) {
  const o = entry.outfit;
  const dist = END_Z - START_Z;
  const poses = Array.isArray(o.poses) ? o.poses : []; // none chosen: walk, then stand
  const n = poses.length;
  const gap = 0.2, tail = 0.6, wantPose = 2.0;
  let walkDur = Math.min(Math.max(dist / walkSpeed(o.walk), 5.5), T * 0.46);
  if (n && T - walkDur - gap - tail < n * wantPose) walkDur = Math.max(4.5, T - gap - tail - n * wantPose);
  const poseStart = walkDur + gap;
  const poseDur = n ? Math.max(1.2, (T - poseStart - tail) / n) : Math.max(0, T - poseStart);
  return { walkDur, poses, poseStart, poseDur, T };
}

export class Runway {
  constructor(stage) {
    this.stage = stage;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.environment = stage.envTex;
    scene.environmentIntensity = 0.3;
    scene.fog = new THREE.Fog('#efd6ae', 24, 70);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.buildWorld();
    this.holder = new THREE.Group();
    scene.add(this.holder);
    this.char = null; this.anim = null; this.entryId = null;
    this.podium = new THREE.Group(); scene.add(this.podium);
    this.mode = 'idle';
    this.camPos = new THREE.Vector3(0, 1.7, 6);
    this.camTarget = new THREE.Vector3(0, 1.0, 0);
    this.time = 0;
    this.petals = this.makePetals();
  }

  buildWorld() {
    const s = this.scene;
    // sky dome
    const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
    s.add(sky);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow('#fff1c4'), transparent: true, depthWrite: false, fog: false }));
    sun.position.set(-30, 26, -90); sun.scale.set(40, 40, 1); s.add(sun);

    s.add(new THREE.HemisphereLight('#ffeccc', '#9c7a52', 0.5));
    const sunL = new THREE.DirectionalLight('#ffe0ad', 1.35);
    sunL.position.set(-6, 10, 6);
    sunL.castShadow = true;
    sunL.shadow.mapSize.set(1024, 1024);
    Object.assign(sunL.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 30 });
    sunL.shadow.bias = -0.0006;
    s.add(sunL); s.add(sunL.target);
    this.sunL = sunL;
    const front = new THREE.DirectionalLight('#fff7ec', 0.4); front.position.set(1, 3, 10); s.add(front);

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#cdb487', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; s.add(ground);

    // walkway pavers (instanced limestone)
    const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture(1), roughness: 0.92 });
    const rows = [], z0 = -28, z1 = 4;
    for (let z = z0; z < z1;) {
      const d = 0.42 + Math.random() * 0.3;
      let x = -1.45;
      while (x < 1.45) {
        const w = Math.min(1.45 - x, 0.45 + Math.random() * 0.55);
        if (w > 0.12) rows.push([x + w / 2, z + d / 2, w - 0.03, d - 0.03]);
        x += w;
      }
      z += d;
    }
    const paver = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 1), stoneMat, rows.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    rows.forEach(([x, z, w, d], i) => {
      m4.compose(new THREE.Vector3(x, 0.03 + Math.random() * 0.012, z), new THREE.Quaternion(), new THREE.Vector3(w, 1, d));
      paver.setMatrixAt(i, m4);
      col.setHSL(0.1 + Math.random() * 0.02, 0.32 + Math.random() * 0.1, 0.78 + Math.random() * 0.08);
      paver.setColorAt(i, col);
    });
    paver.receiveShadow = true;
    s.add(paver);
    // gutter under stones
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, z1 - z0), new THREE.MeshStandardMaterial({ color: '#8f7656', roughness: 1 }));
    bed.position.set(0, 0.0, (z0 + z1) / 2); s.add(bed);

    // low side walls of Jerusalem stone blocks
    const wallMat = new THREE.MeshStandardMaterial({ map: stoneTexture(2, '#e1cfa8'), roughness: 0.95 });
    const blocks = [];
    for (const side of [-1, 1]) {
      for (let course = 0; course < 2; course++) {
        let z = z0 + (course ? 0.3 : 0);
        while (z < z1 - 0.5) {
          const len = 0.6 + Math.random() * 0.5;
          blocks.push([side * 1.75, 0.13 + course * 0.24, z + len / 2, len - 0.03]);
          z += len;
        }
      }
    }
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.23, 1), wallMat, blocks.length);
    blocks.forEach(([x, y, z, l], i) => {
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, l));
      wall.setMatrixAt(i, m4);
      col.setHSL(0.1, 0.35, 0.8 + Math.random() * 0.08); wall.setColorAt(i, col);
    });
    wall.castShadow = true; wall.receiveShadow = true;
    s.add(wall);

    // columns with banners
    const colMat = new THREE.MeshStandardMaterial({ map: stoneTexture(3, '#eadbbb'), roughness: 0.85 });
    const bannerEmblems = ['olive', 'sun', 'lily', 'petal8', 'laurel', 'lotus', 'rosette'];
    const bannerCols = ['#3d5a96', '#9b3a26', '#6f7a45', '#7f3f5e'];
    let bi = 0;
    for (let z = -24; z <= -2; z += 4) {
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 3.0, 16), colMat); shaft.position.y = 1.6; shaft.castShadow = true;
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), colMat); base.position.y = 0.09;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.52), colMat); cap.position.y = 3.15;
        const capR = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.17, 0.16, 16), colMat); capR.position.y = 3.0;
        g.add(shaft, base, cap, capR);
        // banner
        const bcol = bannerCols[bi % bannerCols.length];
        const bm = new THREE.MeshStandardMaterial({ map: emblemTexture(bcol, bannerEmblems[bi % bannerEmblems.length], '#e8c46a', { scale: 0.32 }), roughness: 0.9, side: THREE.DoubleSide });
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.2, 1, 6), bm);
        banner.position.set(-side * 0.2, 2.25, 0); banner.rotation.y = -side * Math.PI / 2;
        banner.userData.sway = Math.random() * 6;
        g.add(banner);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), metal('bronze'));
        rod.rotation.x = Math.PI / 2; rod.rotation.z = 0; rod.position.set(-side * 0.21, 2.86, 0); rod.rotation.set(0, 0, Math.PI / 2); rod.rotation.y = Math.PI / 2;
        g.add(rod);
        g.position.set(side * 2.35, 0, z);
        s.add(g);
        this.banners ||= [];
        this.banners.push(banner);
        bi++;
      }
    }
    // olive trees & palms
    const oliveLeaf = new THREE.MeshStandardMaterial({ color: '#7d8a55', roughness: 0.9, flatShading: true });
    const bark = new THREE.MeshStandardMaterial({ color: '#6e5a45', roughness: 1 });
    const potMat = leather('#b5683e');
    const tree = (x, z, sc = 1) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.2, 7), bark); trunk.position.y = 0.6; trunk.rotation.z = 0.12; g.add(trunk);
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 + Math.random() * 0.2, 0), oliveLeaf);
        c.position.set((Math.random() - 0.5) * 0.8, 1.35 + Math.random() * 0.4, (Math.random() - 0.5) * 0.7);
        c.scale.y = 0.7; c.castShadow = true; g.add(c);
      }
      g.position.set(x, 0, z); g.scale.setScalar(sc); s.add(g);
    };
    const palm = (x, z, h = 4.5) => {
      const g = new THREE.Group();
      for (let i = 0; i < 10; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13 - i * 0.004, 0.15 - i * 0.004, h / 10, 8), bark);
        seg.position.set(Math.sin(i * 0.25) * 0.08 * i * 0.3, (i + 0.5) * (h / 10), 0); g.add(seg);
      }
      const leaf = new THREE.MeshStandardMaterial({ color: '#5f7a3a', roughness: 0.9, side: THREE.DoubleSide });
      for (let i = 0; i < 9; i++) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1.8, 1, 6), leaf);
        const pos = l.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) { const y = pos.getY(k); pos.setZ(k, -0.25 * (y + 0.9) * (y + 0.9)); }
        l.geometry.computeVertexNormals();
        l.geometry.translate(0, 0.9, 0);
        const holder = new THREE.Group(); holder.add(l);
        l.rotation.x = 1.0;
        holder.rotation.y = (i / 9) * Math.PI * 2;
        holder.position.y = h;
        g.add(holder);
      }
      g.position.set(x, 0, z); s.add(g);
    };
    for (const z of [-22, -14, -6]) { tree(-3.4, z, 1.1); tree(3.5, z + 2, 1.0); }
    palm(-4.3, -10); palm(4.4, -18, 5); palm(4.6, -3, 4); palm(-4.8, -25, 5.2);
    for (const [x, z] of [[-2.05, -1.2], [2.05, -1.2]]) {
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), potMat); pot.position.set(x, 0.26, z); pot.scale.y = 1.1; s.add(pot);
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), oliveLeaf); shrub.position.set(x, 0.72, z); s.add(shrub);
    }

    // the city gate at the far end
    const gateMat = new THREE.MeshStandardMaterial({ map: stoneTexture(4, '#dcc7a0'), roughness: 0.95 });
    const gate = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-4.2, 0); shape.lineTo(4.2, 0); shape.lineTo(4.2, 5.4); shape.lineTo(-4.2, 5.4); shape.lineTo(-4.2, 0);
    const hole = new THREE.Path();
    hole.moveTo(-1.3, 0); hole.lineTo(-1.3, 2.6); hole.absarc(0, 2.6, 1.3, Math.PI, 0, true); hole.lineTo(1.3, 0); hole.lineTo(-1.3, 0);
    shape.holes.push(hole);
    const gw = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false, curveSegments: 20 }), gateMat);
    gw.position.z = -0.6; gw.castShadow = true; gate.add(gw);
    for (let i = -4; i <= 4; i++) {
      if (i % 2) continue;
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 1.3), gateMat); c.position.set(i * 0.95, 5.65, 0); gate.add(c);
    }
    const archTrim = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.12, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#c9b088', roughness: 0.9 }));
    archTrim.position.set(0, 2.6, 0.62); gate.add(archTrim);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4), new THREE.MeshBasicMaterial({ color: '#3a2a1c' }));
    dark.position.set(0, 2, -0.5); gate.add(dark);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow('#fff0c8'), transparent: true, depthWrite: false, opacity: 0.9 }));
    glow.scale.set(3.4, 4.6, 1); glow.position.set(0, 2, -0.4); gate.add(glow);
    for (const sx of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7.2, 2.2), gateMat); tower.position.set(sx * 5.2, 3.6, 0); gate.add(tower);
      for (let i = -1; i <= 1; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.3), gateMat); c.position.set(sx * 5.2 + i * 0.8, 7.45, 0); gate.add(c); }
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.8), new THREE.MeshBasicMaterial({ color: '#4a3524' })); win.position.set(sx * 5.2, 4.8, 1.11); gate.add(win);
    }
    gate.position.set(0, 0, -27.5);
    s.add(gate);
    // city beyond
    const houseCols = ['#e8d8b6', '#dcc59c', '#efe2c6', '#d4bb90'];
    const houseMat = houseCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    for (let i = 0; i < 46; i++) {
      const w = 1.4 + Math.random() * 2.4, h = 1.6 + Math.random() * 3.5, d = 1.5 + Math.random() * 2;
      const x = (Math.random() - 0.5) * 50, z = -33 - Math.random() * 26;
      if (Math.abs(x) < 6 && z > -36) continue;
      const hs = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), houseMat[i % 4]);
      hs.position.set(x, h / 2 + (z < -45 ? 2 : 0), z); s.add(hs);
    }
    const domeM = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal('gold', { rough: 0.3 }));
    domeM.position.set(-9, 6, -48); s.add(domeM);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 3, 8), houseMat[2]); drum.position.set(-9, 4.5, -48); s.add(drum);
    const temple = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 6), houseMat[2]); temple.position.set(10, 5.5, -52); s.add(temple);
    for (let i = -3; i <= 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 6, 10), houseMat[0]); c.position.set(10 + i * 1.3, 3, -48.8); s.add(c); }
    const hillMat = new THREE.MeshStandardMaterial({ color: '#b8a274', roughness: 1, flatShading: true });
    for (const [x, z, r] of [[-30, -75, 22], [5, -85, 28], [38, -72, 20]]) {
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), hillMat); h.position.set(x, -r * 0.55, z); h.scale.y = 0.55; s.add(h);
    }

    // the stage: a round mosaic platform with braziers
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.62, 0.12, 64), [
      new THREE.MeshStandardMaterial({ color: '#d9c39b', roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: '#d9c39b' }),
    ]);
    stage.position.set(0, 0.06, END_Z); stage.receiveShadow = true;
    s.add(stage);
    this.stageTop = 0.12;
    const brazier = (x) => {
      const g = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.0, 8), metal('bronze')); leg.position.y = 0.5; g.add(leg);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), metal('bronze')); bowl.position.y = 1.1; g.add(bowl);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow('#ffb347'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.scale.set(0.9, 1.2, 1); fl.position.y = 1.35; g.add(fl);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), new THREE.MeshBasicMaterial({ color: '#ffcf5a' })); core.position.y = 1.3; g.add(core);
      g.userData.flame = [fl, core];
      g.position.set(x, 0, END_Z - 0.4);
      s.add(g);
      return g;
    };
    this.braziers = [brazier(-2.1), brazier(2.1)];
    const pl = new THREE.PointLight('#ffb35a', 6, 6, 1.6); pl.position.set(0, 1.6, END_Z + 0.4); s.add(pl);
  }

  makePetals() {
    const N = 160;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), colr = new Float32Array(N * 3);
    const palette = ['#f2c3c3', '#ffffff', '#f4d77a', '#e89aa8', '#c9e0f5'].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      const c = palette[i % palette.length]; colr.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(16, 16, 14, 8, 0.6, 0, 7); g.fill();
    const tex = new THREE.CanvasTexture(cv);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, map: tex, vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false }));
    pts.frustumCulled = false;
    pts.visible = false;
    this.scene.add(pts);
    return { pts, pos, vel, N, life: 0 };
  }
  burst(center) {
    const p = this.petals;
    for (let i = 0; i < p.N; i++) {
      p.pos.set([center.x + (Math.random() - 0.5) * 2.5, center.y + 2.2 + Math.random() * 1.5, center.z + (Math.random() - 0.5) * 2], i * 3);
      p.vel.set([(Math.random() - 0.5) * 0.6, -0.4 - Math.random() * 0.5, (Math.random() - 0.5) * 0.6], i * 3);
    }
    p.life = 6; p.pts.visible = true;
  }

  // ---------------- presentation
  showEntry(entry) {
    this.clearPodium();
    if (this.entryId === entry.id && this.char) return;
    this.disposeChar();
    this.entry = entry;
    this.entryId = entry.id;
    this.char = new Character(entry.outfit);
    this.char.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.holder.add(this.char.root);
    this.anim = new Animator(this.char);
    this.holder.position.set(0, 0, START_Z);
    this.burstDone = false;
    this.phase = '';
    this.mode = 'present';
  }
  disposeChar() {
    if (this.char) { this.char.dispose(); this.char = null; this.anim = null; this.entryId = null; }
  }

  // t: seconds since this presenter started (may be negative during the intro)
  setTime(t, T) { this.t = t; this.T = T; }

  update(dt) {
    this.time += dt;
    for (const b of this.banners || []) b.rotation.z = Math.sin(this.time * 1.3 + b.userData.sway) * 0.03;
    for (const b of this.braziers) {
      const [fl, core] = b.userData.flame;
      const f = 1 + Math.sin(this.time * 17 + b.position.x) * 0.08 + Math.sin(this.time * 7) * 0.05;
      fl.scale.set(0.9 * f, 1.2 * f, 1); core.scale.set(1, f * 1.1, 1);
    }
    // petals
    const p = this.petals;
    if (p.life > 0) {
      p.life -= dt;
      for (let i = 0; i < p.N; i++) {
        p.pos[i * 3] += (p.vel[i * 3] + Math.sin(this.time * 2 + i) * 0.25) * dt;
        p.pos[i * 3 + 1] = Math.max(0.05, p.pos[i * 3 + 1] + p.vel[i * 3 + 1] * dt);
        p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
      }
      p.pts.geometry.attributes.position.needsUpdate = true;
      if (p.life <= 0) p.pts.visible = false;
    }

    if (this.mode === 'present' && this.char) this.updatePresent(dt);
    else if (this.mode === 'podium') this.updatePodium(dt);

    const k = 1 - Math.exp(-dt * 3);
    this.camera.position.lerp(this.camGoal || this.camPos, k);
    // on slow devices the eased camera can fall behind the walker; never let them fill the screen
    if (this.mode === 'present' && this.minCamZ != null && this.camera.position.z < this.minCamZ) this.camera.position.z = this.minCamZ;
    this.camTarget.lerp(this.camTargetGoal || this.camTarget, k);
    this.camera.lookAt(this.camTarget);
    this.onFrame?.();
  }

  updatePresent(dt) {
    const e = this.entry, T = this.T || 24;
    const tl = timeline(e, T);
    const t = this.t ?? -1;
    let z = START_Z, phase = 'intro';
    if (t >= 0 && t < tl.walkDur) {
      phase = 'walk';
      const u = t / tl.walkDur;
      const eased = u < 0.9 ? u / 0.9 * 0.95 : 0.95 + (1 - Math.pow(1 - (u - 0.9) / 0.1, 2)) * 0.05;
      z = START_Z + (END_Z - START_Z) * Math.min(1, eased);
    } else if (t >= tl.walkDur) {
      z = END_Z;
      phase = 'pose';
    }
    // feet on the stage
    const onStage = z > END_Z - 1.6;
    this.holder.position.set(0, onStage ? this.stageTop * Math.min(1, (z - (END_Z - 1.6)) / 0.25) : 0.04, z);
    if (phase === 'walk') this.anim.set('walk', { style: e.outfit.walk });
    else if (phase === 'pose') {
      const idx = Math.min(tl.poses.length - 1, Math.floor((t - tl.poseStart) / tl.poseDur));
      if (t < tl.poseStart || !tl.poses.length) this.anim.set('idle');
      else this.anim.set('pose', { id: tl.poses[Math.max(0, idx)], idx });
      if (!this.burstDone) { this.burstDone = true; this.burst(new THREE.Vector3(0, 0, END_Z)); }
    } else this.anim.set('idle');
    this.phase = phase;
    this.anim.update(dt);

    // camera choreography
    if (phase === 'pose') {
      const pt = t - tl.walkDur;
      const ang = Math.sin(pt * 0.25) * 0.35;
      const d = this.stage.fitDistance(this.camera, 2.55, 1.7);
      this.camGoal = new THREE.Vector3(Math.sin(ang) * d, 1.4, END_Z + Math.cos(ang) * d);
      this.camTargetGoal = new THREE.Vector3(0, 1.05, END_Z);
      this.minCamZ = null;
    } else {
      // tracking shot: dolly backwards in front of the walker
      const d = this.stage.fitDistance(this.camera, 3.2, 2.2);
      this.camGoal = new THREE.Vector3(0.0, 1.6, z + d);
      this.minCamZ = phase === 'walk' ? z + d * 0.8 : null;
      this.camTargetGoal = new THREE.Vector3(0, 1.0, z);
      if (phase === 'intro') { this.camGoal.set(0, 1.9, START_Z + d + 1.5); this.camTargetGoal.set(0, 1.4, START_Z); }
    }
    this.sunL.position.set(-6, 10, z + 6); this.sunL.target.position.set(0, 0, z);
  }

  headScreen() {
    if (!this.char) return null;
    return toScreen(this.char.worldPos('head', [0, 0.45, 0]), this.camera, this.stage);
  }

  // ---------------- results podium
  clearPodium() {
    for (const c of this.podiumChars || []) c.char.dispose();
    this.podiumChars = [];
    while (this.podium.children.length) this.podium.remove(this.podium.children[0]);
  }
  showPodium(top) {
    this.disposeChar();
    this.clearPodium();
    this.mode = 'podium';
    const spots = [[0, 0.55], [-1.05, 0.38], [1.05, 0.24]];
    const cols = ['#d8b24c', '#c9ccd2', '#c57a45'];
    top.slice(0, 3).forEach((e, i) => {
      const [x, h] = spots[i];
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.95, h, 0.9), new THREE.MeshStandardMaterial({ map: emblemTexture(cols[i], 'star', shade(cols[i], -0.25), { scale: 0.25 }), roughness: 0.5, metalness: 0.4 }));
      block.position.set(x, h / 2 + 0.12, END_Z);
      block.castShadow = true; block.receiveShadow = true;
      this.podium.add(block);
      const c = new Character(e.outfit);
      const holder = new THREE.Group(); holder.add(c.root);
      holder.position.set(x, h + 0.12, END_Z);
      holder.rotation.y = -x * 0.15;
      this.podium.add(holder);
      const a = new Animator(c);
      a.set('pose', { id: ['praise', 'wave', 'standfirm'][i] });
      this.podiumChars.push({ char: c, anim: a });
    });
    this.burst(new THREE.Vector3(0, 0.5, END_Z));
    this.fitPodium();
    this.camera.position.copy(this.camGoal).add(new THREE.Vector3(0, 1, 3));
  }
  // frame the podium in the area left visible by the results list (call again after insets change)
  fitPodium() {
    if (this.mode !== 'podium') return;
    const d = this.stage.fitDistance(this.camera, 2.9, 3.7);
    this.camGoal = new THREE.Vector3(0, 1.5, END_Z + d);
    this.camTargetGoal = new THREE.Vector3(0, 1.25, END_Z);
  }
  updatePodium(dt) {
    for (const p of this.podiumChars) p.anim.update(dt);
    if (this.petals.life <= 0.5) this.burst(new THREE.Vector3(0, 0.5, END_Z));
  }
  podiumScreen(i) {
    const p = this.podiumChars?.[i];
    if (!p) return null;
    return toScreen(p.char.worldPos('head', [0, 0.5, 0]), this.camera, this.stage);
  }
}
