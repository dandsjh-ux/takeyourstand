// One WebGL renderer shared by the dress-up studio, the runway and the item thumbnails.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from './character.js';
import { defaultOutfit, ITEM_MAP } from './catalog.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping; // keeps costume colours true to the reference art
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.active = null;
    this.clock = new THREE.Clock();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onResize);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.active) { r.clear(); return; }
      this.active.update(dt);
      this.applyView(this.active.camera);
      r.render(this.active.scene, this.active.camera);
      this.active.afterRender?.(dt);
    };
    loop();
  }

  get size() { return { w: this.canvas.clientWidth || window.innerWidth, h: this.canvas.clientHeight || window.innerHeight }; }

  resize() {
    const { w, h } = this.size;
    this.renderer.setSize(w, h, false);
    if (this.active?.camera) this.applyView(this.active.camera);
  }

  setInsets(top, bottom, left = 0, right = 0) { this.insets = { top, bottom, left, right }; }

  setScene(s) {
    if (this.active === s) return;
    this.active?.onHide?.();
    this.active = s;
    s?.onShow?.();
    this.resize();
  }

  applyView(cam) {
    const { w, h } = this.size;
    cam.aspect = w / h;
    const off = (this.insets.bottom - this.insets.top) / 2;
    const offX = (this.insets.right - this.insets.left) / 2;
    cam.setViewOffset(w, h, offX, off, w, h);
    cam.updateProjectionMatrix();
  }

  // camera distance so a box of frameH x frameW fits the visible (non-occluded) area
  fitDistance(cam, frameH, frameW) {
    const { w, h } = this.size;
    const vis = Math.max(120, h - this.insets.top - this.insets.bottom);
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const dh = (frameH * h) / (vis * 2 * t);
    const visW = Math.max(120, w - this.insets.left - this.insets.right);
    const dw = (frameW * w) / (visW * 2 * t * (w / h));
    return Math.max(dh, dw);
  }

  // ------- thumbnails for items without reference art
  thumb(itemId, size = 192) {
    this.thumbs ||= new Map();
    if (this.thumbs.has(itemId)) return this.thumbs.get(itemId);
    const item = ITEM_MAP[itemId];
    if (!item) return '';
    if (!this.thumbScene) {
      const sc = new THREE.Scene();
      sc.environment = this.envTex;
      sc.add(new THREE.HemisphereLight('#fff6e8', '#b59a76', 0.4));
      const d = new THREE.DirectionalLight('#ffffff', 0.95); d.position.set(1.5, 2.5, 3); sc.add(d);
      sc.environmentIntensity = 0.3;
      this.thumbScene = sc;
      this.thumbCam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
      this.thumbRT = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
      this.thumbRT.texture.colorSpace = THREE.SRGBColorSpace;
    }
    const o = defaultOutfit(/-g\d/.test(itemId) || item.look.kind === 'dress' ? 'girl' : 'boy');
    o.tunic = item.cat === 'tunic' ? itemId : null;
    const showBody = item.cat === 'tunic';
    if (item.cat === 'acc') o.acc = [itemId];
    else if (item.cat !== 'tunic') o[item.cat] = itemId;
    const c = new Character(o);
    if (!showBody) {
      for (const m of c.bodyMeshes) m.visible = false;
      for (const m of c.hairParts) m.visible = false;
      if (!o.tunic) { /* nothing */ }
    }
    c.applyPose({ uArmL: [0, 0, 0.25], uArmR: [0, 0, -0.25], fArmL: [-0.2, 0, 0], fArmR: [-0.2, 0, 0] });
    this.thumbScene.add(c.root);
    c.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    c.root.traverse((m) => { if (m.isMesh && m.visible && isVisibleChain(m)) box.expandByObject(m); });
    const ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const rad = Math.max(sz.x, sz.y, sz.z) * (showBody ? 0.5 : 0.62);
    const cam = this.thumbCam;
    const dir = new THREE.Vector3(item.cat === 'shield' ? 0.9 : 0.35, 0.25, 1).normalize();
    cam.position.copy(ctr).addScaledVector(dir, rad / Math.tan(THREE.MathUtils.degToRad(15)));
    cam.lookAt(ctr);
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearAlpha();
    r.setRenderTarget(this.thumbRT);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.thumbScene, cam);
    const buf = new Uint8Array(size * size * 4);
    r.readRenderTargetPixels(this.thumbRT, 0, 0, size, size, buf);
    r.setRenderTarget(prevTarget);
    r.setClearAlpha(prevClear);
    this.thumbScene.remove(c.root);
    c.dispose();
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g.putImageData(img, 0, 0);
    const url = cv.toDataURL('image/png');
    this.thumbs.set(itemId, url);
    return url;
  }
}

function isVisibleChain(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
