// Dress-up studio: the character on a pedestal with category-aware zoom, drag-to-turn and pinch-to-zoom.
import * as THREE from 'three';
import { Character } from './character.js';
import { Animator } from './poses.js';
import { floorTexture, metal, mosaicTexture } from './textures.js';

const PRESETS = {
  full: { target: [0, 0.93, 0], h: 2.1, w: 1.25, yaw: 0, pitch: 0.06 },
  head: { target: [0, 1.62, 0], h: 0.62, w: 0.62, yaw: 0, pitch: 0.04 },
  prayer: { target: [0, 1.68, 0], h: 1.05, w: 1.0, yaw: 0, pitch: 0.02 },
  chest: { target: [0, 1.23, 0], h: 0.86, w: 0.86, yaw: 0.12, pitch: 0.05 },
  waist: { target: [0, 0.98, 0], h: 0.72, w: 0.78, yaw: 0.1, pitch: 0.1 },
  feet: { target: [0, 0.1, 0.06], h: 0.5, w: 0.6, yaw: 0.35, pitch: 0.42 },
  shield: { joint: 'fArmL', local: [0.1, -0.15, 0.05], h: 0.9, w: 0.85, yaw: 0.55, pitch: 0.08 },
  sword: { joint: 'handR', local: [0, -0.05, 0.2], h: 1.0, w: 0.95, yaw: -0.45, pitch: 0.1 },
};

export class Studio {
  constructor(stage) {
    this.stage = stage;
    const scene = new THREE.Scene();
    scene.environment = stage.envTex;
    scene.environmentIntensity = 0.55;
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

    scene.add(new THREE.HemisphereLight('#fff7ea', '#cdb28c', 1.1));
    const key = new THREE.DirectionalLight('#fff4e2', 2.4);
    key.position.set(-1.6, 3.2, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2; key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -0.3;
    key.shadow.bias = -0.0005; key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#ffe2b8', 1.3); rim.position.set(2, 2.2, -2.5); scene.add(rim);
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.5); fill.position.set(2.5, 1, 2); scene.add(fill);

    // floor & pedestal
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.069; scene.add(floor);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.07, 64), [
      new THREE.MeshStandardMaterial({ color: '#d9bf92', roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: '#d9bf92' }),
    ]);
    ped.position.y = -0.035; ped.receiveShadow = true; scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.012, 8, 80), metal('gold'));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.0; scene.add(ring);
    const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.ShadowMaterial({ opacity: 0.22 }));
    shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.001; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);

    this.turntable = new THREE.Group();
    scene.add(this.turntable);
    this.character = null;
    this.animator = null;

    // camera state
    this.preset = 'full';
    this.cam = { target: new THREE.Vector3(0, 0.93, 0), dist: 4, yaw: 0, pitch: 0.06 };
    this.user = { zoom: 1, panY: 0, rot: 0, rotVel: 0 };
    this.bindInput(stage.canvas);
  }

  setOutfit(outfit) {
    if (!this.character) {
      this.character = new Character(outfit);
      this.turntable.add(this.character.root);
      this.animator = new Animator(this.character);
    } else this.character.setOutfit(outfit);
  }

  focus(name, keepUser = false) {
    this.preset = PRESETS[name] ? name : 'full';
    if (!keepUser) { this.user.zoom = 1; this.user.panY = 0; this.user.rotTarget = 0; }
  }

  goal() {
    const p = PRESETS[this.preset];
    let target;
    if (p.joint && this.character) {
      this.turntable.updateMatrixWorld(true);
      target = this.character.j[p.joint].localToWorld(new THREE.Vector3(...p.local));
      target.y = Math.max(0.7, target.y);
    } else target = new THREE.Vector3(...p.target);
    target.y += this.user.panY;
    const dist = this.stage.fitDistance(this.camera, p.h, p.w) * this.user.zoom;
    return { target, dist, yaw: p.yaw, pitch: p.pitch };
  }

  update(dt) {
    if (this.animator) this.animator.update(dt);
    // turntable inertia + spring back when not touching
    if (!this.dragging) {
      if (this.user.rotTarget === 0 && Math.abs(this.user.rotVel) < 0.02) this.user.rot += (0 - this.user.rot) * Math.min(1, dt * 1.2);
      this.user.rot += this.user.rotVel * dt;
      this.user.rotVel *= Math.exp(-dt * 3);
    }
    this.turntable.rotation.y = this.user.rot;
    const g = this.goal();
    const k = 1 - Math.exp(-dt * 5);
    this.cam.target.lerp(g.target, k);
    this.cam.dist += (g.dist - this.cam.dist) * k;
    this.cam.yaw += (g.yaw - this.cam.yaw) * k;
    this.cam.pitch += (g.pitch - this.cam.pitch) * k;
    const { target, dist, yaw, pitch } = this.cam;
    this.camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.lookAt(target);
    this.onFrame?.();
  }

  headScreenPos(extraY = 0.42) {
    if (!this.character) return null;
    const p = this.character.worldPos('head', [0, extraY, 0]);
    return toScreen(p, this.camera, this.stage);
  }

  bindInput(el) {
    const pts = new Map();
    let pinch = null, lastTap = 0, last = null;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (this.stage.active !== this) return;
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragging = true;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.user.zoom, my: (a.y + b.y) / 2, panY: this.user.panY };
      } else {
        const now = performance.now();
        if (now - lastTap < 300) { this.user.zoom = 1; this.user.panY = 0; this.user.rotVel = 0; this.user.rotTarget = 0; }
        lastTap = now;
        last = { x: e.clientX, y: e.clientY, t: now };
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || this.stage.active !== this) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.user.zoom = THREE.MathUtils.clamp(pinch.zoom * (pinch.d / Math.max(20, d)), 0.35, 2.4);
        const my = (a.y + b.y) / 2;
        this.user.panY = THREE.MathUtils.clamp(pinch.panY + (my - pinch.my) * 0.0025 * this.cam.dist, -1.2, 1.2);
      } else if (pts.size === 1 && last) {
        const now = performance.now();
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        this.user.rot += dx * 0.011;
        this.user.rotVel = (dx * 0.011) / Math.max(0.008, (now - last.t) / 1000);
        this.user.rotTarget = 1;
        this.user.panY = THREE.MathUtils.clamp(this.user.panY + dy * 0.0016 * this.cam.dist, -1.2, 1.2);
        last = { x: e.clientX, y: e.clientY, t: now };
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) { this.dragging = false; last = null; this.user.rotVel = THREE.MathUtils.clamp(this.user.rotVel, -8, 8); }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      if (this.stage.active !== this) return;
      e.preventDefault();
      this.user.zoom = THREE.MathUtils.clamp(this.user.zoom * Math.exp(e.deltaY * 0.0012), 0.35, 2.4);
    }, { passive: false });
  }
}

export function toScreen(p, camera, stage) {
  const v = p.clone().project(camera);
  const { w, h } = stage.size;
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind: v.z > 1 };
}
