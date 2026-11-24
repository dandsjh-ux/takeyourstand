// Tiny DOM + sound helpers.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// h('div.class#id', {attrs, on:{click}}, ...children)
export function h(tag, props = {}, ...kids) {
  const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m?.[1] || 'div');
  for (const part of (m?.[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = {}; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ` ${v}`;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

let toastTimer = 0;
export function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function modal(...content) {
  const m = $('#modal'), c = $('#modal-card');
  c.replaceChildren(...content.flat());
  m.classList.remove('hidden');
  m.onclick = (e) => { if (e.target === m && !m.dataset.locked) closeModal(); };
  return c;
}
export function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal').dataset.locked = '';
  $('#modal-card').replaceChildren();
}
export const modalOpen = () => !$('#modal').classList.contains('hidden');

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- sound (synthesised, no assets)
let ac = null;
export function unlockAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } }
  if (ac?.state === 'suspended') ac.resume();
}
function tone(freq, start, dur, type = 'sine', vol = 0.12) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, ac.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + start); o.stop(ac.currentTime + start + dur + 0.05);
}
export const sfx = {
  tap: () => tone(660, 0, 0.06, 'triangle', 0.05),
  equip: () => { tone(523, 0, 0.1, 'triangle', 0.08); tone(784, 0.06, 0.14, 'triangle', 0.08); },
  coin: () => { tone(988, 0, 0.08, 'square', 0.05); tone(1319, 0.08, 0.25, 'square', 0.05); },
  wrong: () => { tone(220, 0, 0.18, 'sawtooth', 0.05); tone(180, 0.12, 0.25, 'sawtooth', 0.05); },
  unlock: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.08)),
  fanfare: () => [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.09)),
  star: () => tone(880, 0, 0.12, 'sine', 0.08),
};
