// Take Your Stand — client controller (players + routing). Host dashboard lives in host.js.
import { Stage } from './stage.js';
import { Studio } from './studio.js';
import { Runway, timeline } from './runway.js';
import {
  CATEGORIES, ITEMS, ITEM_MAP, SKIN_TONES, HAIR_COLORS, HAIR_STYLES, POSES, WALKS, POSE_MAP, WALK_MAP,
  MAX_POSES, PRAYER_MAX, PRAYER_STARTERS, ARMOR_SLOTS, defaultOutfit, priceFor, armorCount,
} from './catalog.js';
import { $, $$, h, toast, modal, closeModal, modalOpen, fmtTime, unlockAudio, sfx } from './ui.js';
import { createHost } from './host.js';

// ------------------------------------------------------------------ state
const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};
const SS = {
  get(k, d = null) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* */ } },
};
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
// one player identity per browser tab (survives refresh, separate tabs = separate players)
let clientId = SS.get('tys_client');
if (!clientId) { clientId = rid(); SS.set('tys_client', clientId); }

const S = {
  role: null, // 'player' | 'host'
  code: null,
  room: null,
  me: null,
  outfit: null,
  owned: new Set(),
  coins: 0,
  offset: 0,
  entries: [],
  cat: 'me',
  body: 'boy',
  round: -1,
  myVotes: {},
  lastScreen: '',
};
export const now = () => Date.now() + S.offset;

const socket = io({ transports: ['websocket', 'polling'] });
const stage = new Stage($('#gl'));
const studio = new Studio(stage);
const runway = new Runway(stage);
const host = createHost({ socket, S, stage, now, showScreen, LS, SS });
window.__tys = { S, stage, studio, runway, updateInsets, host, setOutfit: (o) => setOutfit(o) };

// ------------------------------------------------------------------ screens
function showScreen(id) {
  for (const s of $$('.screen')) s.classList.toggle('active', s.id === id);
  S.lastScreen = id;
  if (id === 'play') { stage.setScene(studio); requestAnimationFrame(updateInsets); }
  else if (id === 'show') stage.setScene(runway);
  else stage.setScene(null);
  document.body.style.background = id === 'show' ? '#e9c79b' : '';
}

function updateInsets() {
  if (S.lastScreen === 'play') {
    const top = $('.topbar').getBoundingClientRect().bottom;
    const d = $('#drawer').getBoundingClientRect();
    const wide = d.width < window.innerWidth * 0.8;
    if (wide) stage.setInsets(top, 0, 0, d.width);
    else stage.setInsets(top, window.innerHeight - d.top, 0, 0);
    document.documentElement.style.setProperty('--drawer-px', `${window.innerHeight - d.top}px`);
  } else if (S.lastScreen === 'show') {
    const panel = !$('#results').classList.contains('hidden') ? $('#results') : !$('#vote').classList.contains('hidden') ? $('#vote') : null;
    stage.setInsets(50, panel ? window.innerHeight - panel.getBoundingClientRect().top : 0, 0, 0);
  }
}
window.addEventListener('resize', () => setTimeout(updateInsets, 50));

// ------------------------------------------------------------------ home / join
const params = new URLSearchParams(location.search);
if (params.get('join')) $('#join-code').value = params.get('join').toUpperCase().slice(0, 4);
const savedName = LS.get('tys_name');
if (savedName) $('#join-name').value = savedName;
S.body = LS.get('tys_body', 'boy');
const paintBody = () => $$('.body-opt').forEach((b) => b.classList.toggle('on', b.dataset.body === S.body));
paintBody();
$$('.body-opt').forEach((b) => b.addEventListener('click', () => { S.body = b.dataset.body; LS.set('tys_body', S.body); paintBody(); sfx.tap(); }));
$('#join-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });

$('#join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  unlockAudio();
  const code = $('#join-code').value.trim().toUpperCase();
  const name = $('#join-name').value.trim();
  if (code.length !== 4) return showJoinError('The game code has 4 letters.');
  if (!name) return showJoinError('Please type your name.');
  LS.set('tys_name', name);
  joinGame(code, name, S.body);
});
function showJoinError(msg) { $('#join-error').textContent = msg; }

function joinGame(code, name, body, silent = false) {
  socket.emit('player:join', { code, clientId, name, body, team: LS.get('tys_team') }, (res) => {
    if (!res?.ok) {
      if (!silent) showJoinError(res?.error || 'Could not join.');
      else {
        SS.del('tys_session');
        if (S.role === 'player') {
          // the game is gone (ended or the server restarted)
          S.role = null; S.room = null;
          closeModal(); showScreen('home');
          showJoinError('That game has ended. Ask your teacher for a new code!');
        }
      }
      return;
    }
    S.role = 'player';
    S.code = res.code;
    SS.set('tys_session', { code: res.code, name, body });
    history.replaceState(null, '', `/?join=${res.code}`);
    onMe(res.me, true);
    onState(res.state);
  });
}

$('#host-btn').addEventListener('click', () => { unlockAudio(); host.start(); });

// auto-resume after refresh
const hostSession = LS.get('tys_host');
const playerSession = SS.get('tys_session');
if (location.hash === '#host' && hostSession) host.resume(hostSession);
else if (playerSession && (!params.get('join') || params.get('join') === playerSession.code)) joinGame(playerSession.code, playerSession.name, playerSession.body, true);

socket.on('connect', () => {
  if (S.role === 'player' && S.code) joinGame(S.code, LS.get('tys_name'), S.body, true);
  if (S.role === 'host') host.reconnect();
});
socket.on('disconnect', () => { if (S.role) toast('Reconnecting…', 4000); });
socket.on('kicked', () => {
  SS.del('tys_session'); S.role = null;
  showScreen('home'); showJoinError('You were removed from the game by the teacher.');
});

// ------------------------------------------------------------------ server events
socket.on('room:state', onState);
socket.on('me', (m) => onMe(m));
socket.on('runway:entries', ({ entries }) => { S.entries = entries; });
socket.on('host:extra', (x) => host.onExtra(x));

function onMe(m, initial = false) {
  const prevCoins = S.coins;
  S.me = m;
  S.coins = m.coins;
  S.owned = new Set(m.owned);
  if (initial || !S.outfit || m.forceOutfit || m.round !== S.outfitRound) {
    S.outfitRound = m.round;
    S.outfit = m.outfit;
    studio.setOutfit(S.outfit);
  }
  $('#coins-val').textContent = S.coins;
  if (!initial && S.coins > prevCoins) { $('#coins-btn').classList.remove('bump'); void $('#coins-btn').offsetWidth; $('#coins-btn').classList.add('bump'); }
  if (S.lastScreen === 'play') renderPanel();
}

function onState(st) {
  const prevPhase = S.room?.phase;
  S.room = st;
  S.offset = st.serverNow - Date.now();
  if (S.role === 'host') { host.onState(st, prevPhase); routeShow(st, prevPhase); return; }
  if (S.role !== 'player') return;
  // new round → server reset the wardrobe
  const me = st.players.find((p) => p.id === S.me?.playerId);
  if (me) {
    const team = st.teams.find((t) => t.id === me.team);
    $('#me-name').textContent = me.name;
    $('#me-team-dot').style.background = team?.color || '#999';
    if (team) LS.set('tys_team', team.id);
  }
  if (st.phase === 'lobby' || st.phase === 'styling') {
    if (S.lastScreen !== 'play') { showScreen('play'); S.cat = st.phase === 'lobby' ? 'me' : S.cat; selectCat(S.cat); }
    if (prevPhase === 'lobby' && st.phase === 'styling') {
      selectCat('tunic');
      sfx.fanfare();
      modal(h('h3', 'Time to suit up! 🛡️'), h('p', 'Pick your clothes and put on every piece of the Armor of God. Answer Bible questions to earn coins and unlock more styles!'),
        h('div.modal-actions', h('button.btn.primary', { on: { click: closeModal } }, 'Let\'s go!')));
    }
    $('#lobby-banner').classList.toggle('hidden', st.phase !== 'lobby');
    renderTeamPick();
    renderTabs();
    if (prevPhase !== st.phase) renderPanel();
  } else routeShow(st, prevPhase);
}

// ------------------------------------------------------------------ dressing room
const tabsEl = $('#tabs');
function catLocked(id) { return S.room?.phase === 'lobby' && id !== 'me'; }
function catDone(id) {
  const o = S.outfit; if (!o) return false;
  if (ARMOR_SLOTS.includes(id)) return !!o[id];
  if (id === 'prayer') return !!o.prayer?.trim();
  if (id === 'tunic') return true;
  if (id === 'bonus') return !!(o.outer || o.head || o.acc?.length);
  if (id === 'runway') return !!S.room?.players.find((x) => x.id === S.me?.playerId)?.ready;
  return false;
}
function renderTabs() {
  tabsEl.replaceChildren(...CATEGORIES.map((c) => h('button.tab', {
    class: `${S.cat === c.id ? 'on' : ''} ${catDone(c.id) ? 'done' : ''} ${catLocked(c.id) ? 'locked' : ''}`,
    'data-cat': c.id,
    on: { click: () => { sfx.tap(); if (catLocked(c.id)) return toast('Opens when your teacher starts the game!'); selectCat(c.id); } },
  }, h('span.ti', c.icon), c.label)));
  const on = tabsEl.querySelector('.tab.on');
  on?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}
function selectCat(id) {
  S.cat = id;
  const c = CATEGORIES.find((x) => x.id === id);
  $('#panel-title').textContent = c.title;
  $('#panel-verse').textContent = c.verse;
  studio.focus(c.zoom);
  if (id !== 'runway') studio.animator?.set('idle');
  $('#drawer').classList.remove('mini');
  renderTabs();
  renderPanel();
  $('#panel').scrollTop = 0;
  const idx = CATEGORIES.findIndex((x) => x.id === id);
  $('#next-btn').classList.toggle('hidden', idx >= CATEGORIES.length - 1 || catLocked(CATEGORIES[idx + 1]?.id));
  setTimeout(updateInsets, 320);
}
$('#next-btn').addEventListener('click', () => {
  const idx = CATEGORIES.findIndex((x) => x.id === S.cat);
  if (CATEGORIES[idx + 1]) selectCat(CATEGORIES[idx + 1].id);
});
$('#drawer-grab').addEventListener('click', () => { $('#drawer').classList.toggle('mini'); setTimeout(updateInsets, 320); });
$('#coins-btn').addEventListener('click', () => { unlockAudio(); openQuiz(); });
setTimeout(() => $('#zoom-hint').classList.add('fade'), 7000);

let syncTimer = 0;
function setOutfit(patch, silent = false) {
  S.outfit = { ...S.outfit, ...patch };
  studio.setOutfit(S.outfit);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => socket.emit('player:outfit', S.outfit), 350);
  if (!silent) { renderTabs(); renderPanel(); }
}

const scale = () => S.room?.settings?.priceScale ?? 1;
const unlockAll = () => !!S.room?.settings?.unlockAll;
function isUnlocked(kind, id) {
  const p = priceFor(kind, id, scale());
  if (p === 0 || unlockAll()) return true;
  return S.owned.has(kind === 'item' ? id : `${kind}:${id}`);
}

function lockBadge(kind, id) {
  if (isUnlocked(kind, id)) return null;
  const p = priceFor(kind, id, scale());
  return h('span.lock', { class: S.coins >= p ? 'afford' : '' }, '🔒', ` ${p}`);
}

function itemCard(it, on, onPick) {
  const unlocked = isUnlocked('item', it.id);
  const src = it.icon || stage.thumb(it.id);
  return h('button.item', { class: `${on ? 'on' : ''} ${unlocked ? '' : 'locked'}`, on: { click: () => onPick(it, unlocked) } },
    h('img', { src, alt: '', loading: 'lazy', draggable: 'false' }),
    it.bonus ? h('span.bonus-tag', 'BONUS') : null,
    lockBadge('item', it.id),
    h('span.nm', it.name));
}
const sortItems = (list) => list.slice().sort((a, b) => (a.price - b.price) || a.name.localeCompare(b.name));

function renderPanel() {
  const P = $('#panel');
  if (!S.outfit) { P.replaceChildren(); return; }
  const o = S.outfit;
  const cat = S.cat;
  const kids = [];
  if (cat === 'me') {
    kids.push(h('div.section-label', 'Style'),
      h('div.seg', ...['boy', 'girl'].map((b) => h('button', { class: o.body === b ? 'on' : '', on: { click: () => { S.body = b; LS.set('tys_body', b); setOutfit({ body: b, tunic: o.tunic && ITEM_MAP[o.tunic].price === 0 ? defaultOutfit(b).tunic : o.tunic, hair: defaultOutfit(b).hair }); } } }, b === 'boy' ? '🧒🏽 Boy' : '👧🏽 Girl'))));
    kids.push(h('div.section-label', 'Skin tone'),
      h('div.swatches', ...SKIN_TONES.map((c, i) => h('button.sw', { class: o.skin === i ? 'on' : '', style: { background: c }, 'aria-label': `Skin tone ${i + 1}`, on: { click: () => setOutfit({ skin: i }) } }))));
    kids.push(h('div.section-label', 'Hair style'),
      h('div.chips', ...HAIR_STYLES.map((hs) => h('button.chip', { class: o.hair === hs.id ? 'on' : '', on: { click: () => setOutfit({ hair: hs.id }) } }, hs.name))));
    kids.push(h('div.section-label', 'Hair colour'),
      h('div.swatches', ...HAIR_COLORS.map((c, i) => h('button.sw', { class: o.hairColor === i ? 'on' : '', style: { background: c }, 'aria-label': `Hair colour ${i + 1}`, on: { click: () => setOutfit({ hairColor: i }) } }))));
  } else if (cat === 'tunic' || ARMOR_SLOTS.includes(cat)) {
    const list = sortItems(ITEMS.filter((i) => i.cat === cat));
    const cards = [];
    if (cat !== 'tunic') cards.push(h('button.item.none', { class: !o[cat] ? 'on' : '', on: { click: () => setOutfit({ [cat]: null }) } }, h('span.big-ico', '∅'), h('span.nm', 'None')));
    for (const it of list) cards.push(itemCard(it, o[cat] === it.id, pickItem));
    kids.push(h('div.grid', ...cards));
    if (cat === 'helmet' && o.head && ITEM_MAP[o.head].look.replacesHelmet) kids.unshift(h('p.muted', `Your ${ITEM_MAP[o.head].name} is covering your helmet. Remove it in Bonus to show your helmet.`));
  } else if (cat === 'bonus') {
    const sec = (label, c) => {
      kids.push(h('div.section-label', label));
      const cards = [];
      if (c !== 'acc') cards.push(h('button.item.none', { class: !o[c === 'outer' ? 'outer' : 'head'] ? 'on' : '', on: { click: () => setOutfit({ [c]: null }) } }, h('span.big-ico', '∅'), h('span.nm', 'None')));
      for (const it of sortItems(ITEMS.filter((i) => i.cat === c))) {
        const on = c === 'acc' ? o.acc.includes(it.id) : o[c] === it.id;
        cards.push(itemCard(it, on, pickItem));
      }
      kids.push(h('div.grid', ...cards));
    };
    sec('Robes & mantles', 'outer');
    sec('Crowns & headwear', 'head');
    sec('Treasures — one per spot, tap again to take off', 'acc');
  } else if (cat === 'prayer') {
    const ta = h('textarea.prayer-box', { maxLength: PRAYER_MAX, placeholder: 'Type a short prayer to share on the runway…', rows: 3 });
    ta.value = o.prayer || '';
    const count = h('span', `${(o.prayer || '').length}/${PRAYER_MAX}`);
    ta.addEventListener('input', () => {
      count.textContent = `${ta.value.length}/${PRAYER_MAX}`;
      setOutfit({ prayer: ta.value }, true);
      updateBubblePreview();
      renderTabs();
    });
    ta.addEventListener('focus', () => setTimeout(updateInsets, 400));
    ta.addEventListener('blur', () => setTimeout(updateInsets, 400));
    kids.push(ta, h('div.prayer-meta', h('span', 'Pops up in a speech bubble on the runway'), count));
    kids.push(h('div.section-label', 'Need a start?'),
      h('div.chips', ...PRAYER_STARTERS.map((s) => h('button.chip', { on: { click: () => { ta.value = s; ta.dispatchEvent(new Event('input')); ta.focus(); ta.setSelectionRange(s.length, s.length); } } }, s.trim() + '…'))));
  } else if (cat === 'runway') {
    kids.push(h('div.section-label', 'Your runway walk'));
    kids.push(h('div.grid', ...WALKS.map((w) => {
      const unlocked = isUnlocked('walk', w.id);
      return h('button.item.icon-only', { class: `${o.walk === w.id ? 'on' : ''} ${unlocked ? '' : 'locked'}`, on: { click: () => pickWalk(w, unlocked) } },
        h('span.big-ico', w.icon), lockBadge('walk', w.id), h('span.nm', w.name));
    })));
    kids.push(h('div.section-label', `Your pose sequence (up to ${MAX_POSES})`));
    const seq = o.poses || [];
    kids.push(h('div.seq', ...Array.from({ length: MAX_POSES }, (_, i) => {
      const p = POSE_MAP[seq[i]];
      return p
        ? h('div.slot.filled', h('span.n', i + 1), h('span.si', p.icon), p.name, seq.length > 1 ? h('button.x', { 'aria-label': 'Remove', on: { click: () => setOutfit({ poses: seq.filter((_, k) => k !== i) }) } }, '✕') : null)
        : h('div.slot', h('span.n', i + 1), h('span.si', '＋'), 'Tap a pose');
    })));
    kids.push(h('div.section-label', 'Poses — tap to preview & add'));
    kids.push(h('div.grid', ...POSES.map((p) => {
      const unlocked = isUnlocked('pose', p.id);
      return h('button.item.icon-only', { class: `${seq.includes(p.id) ? 'on' : ''} ${unlocked ? '' : 'locked'}`, on: { click: () => pickPose(p, unlocked) } },
        h('span.big-ico', p.icon), lockBadge('pose', p.id), h('span.nm', p.name));
    })));
    const ready = !!S.room?.players.find((x) => x.id === S.me?.playerId)?.ready;
    kids.push(h('div.ready-row',
      h('button.btn.lapis', { on: { click: previewRunway } }, '▶ Preview my runway'),
      S.room?.phase === 'styling'
        ? h('button.btn', { class: ready ? 'ok' : 'primary', on: { click: () => { socket.emit('player:ready', !ready); sfx.equip(); } } }, ready ? '✓ I\'m ready! (tap to keep styling)' : 'I\'m ready for the runway!')
        : null,
      h('p.muted', `Armor pieces on: ${armorCount(o)}/6 · Wear all six for a bonus!`)));
  }
  P.replaceChildren(...kids);
  updateBubblePreview();
}

function pickItem(it, unlocked) {
  if (!unlocked) return buy('item', it.id, it.name, () => pickItem(it, true));
  sfx.equip();
  const o = S.outfit;
  if (it.cat === 'acc') {
    const has = o.acc.includes(it.id);
    const place = it.look.place;
    const acc = has ? o.acc.filter((a) => a !== it.id) : [...o.acc.filter((a) => ITEM_MAP[a].look.place !== place), it.id];
    setOutfit({ acc });
    return;
  }
  setOutfit({ [it.cat]: it.id });
  if (it.cat === 'head' && it.look.replacesHelmet && o.helmet) toast('This covers your helmet on the runway (it won\'t count as armor).', 3200);
  if (ARMOR_SLOTS.includes(it.cat) && armorCount(S.outfit) === 6) toast('🛡️ Full Armor of God! Stand firm!', 2600);
}
function pickWalk(w, unlocked) {
  if (!unlocked) return buy('walk', w.id, w.name, () => pickWalk(w, true));
  sfx.tap();
  setOutfit({ walk: w.id });
  studio.animator?.set('walk', { style: w.id, restart: true });
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => studio.animator?.set('idle'), 3000);
}
let previewTimer = 0;
function pickPose(p, unlocked) {
  if (!unlocked) return buy('pose', p.id, p.name, () => pickPose(p, true));
  sfx.tap();
  const seq = [...(S.outfit.poses || [])];
  if (!seq.includes(p.id)) {
    if (seq.length >= MAX_POSES) seq[MAX_POSES - 1] = p.id; else seq.push(p.id);
    setOutfit({ poses: seq });
  }
  studio.focus('full');
  studio.animator?.set('pose', { id: p.id, restart: true });
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => studio.animator?.set('idle'), 3600);
}
function previewRunway() {
  const o = S.outfit;
  studio.focus('full');
  clearTimeout(previewTimer);
  const steps = [() => studio.animator.set('walk', { style: o.walk, restart: true }), ...o.poses.map((id) => () => studio.animator.set('pose', { id, restart: true })), () => studio.animator.set('idle')];
  let i = 0;
  const run = () => { steps[i++](); if (i < steps.length) previewTimer = setTimeout(run, i === 1 ? 2600 : 2800); };
  run();
}

function buy(kind, id, name, after) {
  const price = priceFor(kind, id, scale());
  const enough = S.coins >= price;
  if (S.room?.phase !== 'styling') return toast('The shop opens when styling starts.');
  modal(
    h('h3', `🔒 ${name}`),
    enough ? h('p', `Unlock it for `, h('b', `${price} 🪙`), `? You have ${S.coins}.`)
      : h('p', `You need `, h('b', `${price - S.coins} more coins`), `. Answer Bible questions to earn coins!`),
    h('div.modal-actions',
      h('button.btn', { on: { click: closeModal } }, 'Not now'),
      enough
        ? h('button.btn.primary', { on: { click: () => {
          socket.emit('player:buy', { kind, id }, (res) => {
            if (!res?.ok) { toast(res?.error || 'Could not unlock.'); return; }
            S.owned.add(kind === 'item' ? id : `${kind}:${id}`);
            S.coins = res.coins; $('#coins-val').textContent = S.coins;
            closeModal(); sfx.unlock(); toast(`Unlocked ${name}!`);
            after();
          });
        } } }, `Unlock · ${price} 🪙`)
        : h('button.btn.ok', { on: { click: () => { closeModal(); openQuiz(); } } }, 'Earn coins'),
    ),
  );
}

// ------------------------------------------------------------------ quiz
function openQuiz() {
  if (S.room?.phase !== 'styling') return toast(S.room?.phase === 'lobby' ? 'Questions open when the game starts.' : 'Questions are closed now.');
  socket.emit('player:question', null, (res) => {
    if (!res?.ok) return toast(res?.error || 'No questions right now.');
    if (res.done) {
      modal(h('h3', '🎉 All done!'), h('p', 'You answered every question correctly. Amazing!'), h('div.modal-actions', h('button.btn.primary', { on: { click: closeModal } }, 'Back to styling')));
      return;
    }
    const q = res.question;
    let answered = false;
    const fb = h('div.q-feedback');
    const choices = q.choices.map((c, i) => h('button.q-choice', { on: { click: () => answer(i) } }, h('span.k', 'ABCDEF'[i]), h('span', c)));
    const actions = h('div.modal-actions', h('button.btn', { on: { click: closeModal } }, 'Back to styling'));
    modal(
      h('div.q-meta', h('span', `📜 Bible question · ${res.left} left`), h('span', `+${q.coins} 🪙`)),
      h('div.q-text', q.q),
      h('div.q-choices', ...choices),
      fb, actions,
    );
    function answer(i) {
      if (answered) return;
      answered = true;
      socket.emit('player:answer', { id: q.id, choice: i }, (r) => {
        if (!r?.ok) { answered = false; return toast(r?.error || 'Try again'); }
        choices[r.answer]?.classList.add('right');
        if (r.correct) {
          sfx.coin();
          fb.replaceChildren(`Correct! +${r.earned} 🪙`, r.ref ? h('span.ref', r.ref) : '');
          fb.style.color = 'var(--ok)';
          coinBurst(choices[i]);
          S.coins = r.coins; $('#coins-val').textContent = S.coins;
        } else {
          sfx.wrong();
          choices[i].classList.add('wrong');
          fb.replaceChildren('Not quite — the right answer is highlighted.', r.ref ? h('span.ref', r.ref) : '');
          fb.style.color = 'var(--red)';
        }
        actions.replaceChildren(
          h('button.btn', { on: { click: closeModal } }, 'Back to styling'),
          h('button.btn.ok', { on: { click: () => openQuiz() } }, 'Next question ›'),
        );
      });
    }
  });
}
function coinBurst(fromEl) {
  const a = fromEl.getBoundingClientRect(), b = $('#coins-btn').getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const c = h('div.coin-burst', '🪙');
    c.style.left = `${a.left + a.width / 2 + (Math.random() - 0.5) * 60}px`;
    c.style.top = `${a.top + a.height / 2}px`;
    c.style.setProperty('--dx', `${b.left - a.left - a.width / 2}px`);
    c.style.setProperty('--dy', `${b.top - a.top - a.height / 2}px`);
    c.style.animationDelay = `${i * 0.06}s`;
    document.body.append(c);
    setTimeout(() => c.remove(), 1400);
  }
}

// ------------------------------------------------------------------ lobby team picker
function renderTeamPick() {
  const box = $('#team-pick');
  const st = S.room;
  if (!st || st.phase !== 'lobby' || st.settings.teamMode !== 'choose' || st.teams.length < 2) { box.replaceChildren(); return; }
  const me = st.players.find((p) => p.id === S.me?.playerId);
  box.replaceChildren(h('span.muted', 'Pick your team:'), ...st.teams.map((t) => h('button.team-chip', {
    class: me?.team === t.id ? 'on' : '',
    on: { click: () => { LS.set('tys_team', t.id); joinGame(S.code, LS.get('tys_name'), S.body, true); } },
  }, h('span.team-dot', { style: { background: t.color } }), t.name)));
}

// ------------------------------------------------------------------ speech bubble preview (dressing room)
function updateBubblePreview() {
  const b = $('#bubble-preview');
  const show = S.lastScreen === 'play' && S.cat === 'prayer' && S.outfit?.prayer?.trim();
  b.classList.toggle('hidden', !show);
  if (show) b.textContent = `🙏 ${S.outfit.prayer}`;
}

// ------------------------------------------------------------------ runway & results (players + host)
function routeShow(st, prevPhase) {
  if (st.phase === 'runway' || st.phase === 'results') {
    if (S.lastScreen !== 'show') { showScreen('show'); closeModal(); }
    if (st.phase === 'results' && prevPhase !== 'results') showResults(st);
    if (st.phase === 'runway') $('#results').classList.add('hidden');
  }
}

let lastEntryId = null, bubbleShown = false;
function tickShow() {
  const st = S.room;
  if (!st || S.lastScreen !== 'show') return;
  const isHost = S.role === 'host';
  $('#host-runway').classList.toggle('hidden', !isHost || st.phase !== 'runway');
  if (st.phase !== 'runway' || !st.runway) {
    $('#speech').classList.add('hidden'); $('#namecard').classList.add('hidden'); $('#vote').classList.add('hidden');
    $('#intro')?.remove();
    if (st.phase === 'results') placePodiumLabels();
    return;
  }
  const rw = st.runway;
  const entry = S.entries.find((e) => e.id === rw.current);
  if (!entry) return;
  const T = rw.presentMs / 1000;
  const t = ((rw.paused ? rw.pausedAt : now()) - rw.startedAt) / 1000;
  runway.showEntry(entry);
  runway.setTime(t, T);
  const tl = timeline(entry, T);
  const team = st.teams.find((x) => x.id === entry.team);
  $('#show-progress').textContent = `${rw.paused ? '⏸ ' : ''}On the runway ${rw.index + 1}/${rw.count}`;
  $('#show-title').textContent = 'Take Your Stand';

  if (entry.id !== lastEntryId) {
    lastEntryId = entry.id; bubbleShown = false;
    const has = (s) => entry.outfit[s] && !(s === 'helmet' && entry.outfit.head && ITEM_MAP[entry.outfit.head]?.look.replacesHelmet);
    $('#namecard').replaceChildren(
      h('div.nm', entry.name),
      h('div.tm', h('span.team-dot', { style: { background: team?.color } }), ` ${team?.name || ''} · ${WALK_MAP[entry.outfit.walk]?.name || ''}`),
      h('div.armor', ...ARMOR_SLOTS.map((s) => h('span', { class: has(s) ? 'has' : '', title: s }, CATEGORIES.find((c) => c.id === s).icon))),
    );
    $('#namecard').style.borderLeftColor = team?.color || '';
    renderVote(entry);
    if (isHost) host.renderRunwayControls(entry);
  }
  // intro card
  let intro = $('#intro');
  if (t < 0) {
    if (!intro) { intro = h('div.intro-card#intro'); $('#show').append(intro); }
    intro.replaceChildren(h('div.eyebrow', 'Next on the runway'), h('div.nm', entry.name), h('div.muted', team?.name || ''));
  } else intro?.remove();
  $('#namecard').classList.toggle('hidden', t < 0);

  // prayer bubble with typewriter
  const sp = $('#speech');
  const prayer = entry.outfit.prayer?.trim();
  const bStart = tl.walkDur + 0.5;
  if (prayer && t >= bStart && t < T - 0.2) {
    const pos = runway.headScreen();
    if (pos && !pos.behind) {
      const n = Math.min(prayer.length, Math.floor((t - bStart) * 28));
      sp.textContent = `🙏 ${prayer.slice(0, n)}`;
      sp.style.left = `${Math.min(window.innerWidth - 120, Math.max(120, pos.x))}px`;
      sp.style.top = `${Math.max(150, pos.y)}px`;
      if (!bubbleShown) { bubbleShown = true; sp.classList.remove('pop'); void sp.offsetWidth; sp.classList.add('pop'); }
      sp.classList.remove('hidden');
    }
  } else sp.classList.add('hidden');
  if (isHost) host.tickRunway(entry);
}

function renderVote(entry) {
  const v = $('#vote');
  const myId = S.role === 'host' ? 'host' : S.me?.playerId;
  const me = S.room.players.find((p) => p.id === myId);
  if (S.role !== 'host' && !me) { v.classList.add('hidden'); return; }
  v.classList.remove('hidden');
  if (entry.id === myId) {
    v.replaceChildren(h('h3', '🌟 You\'re on the runway!'), h('div.muted', 'Everyone is watching your armor. Stand firm!'));
  } else {
    const cur = S.myVotes[entry.id] || 0;
    const thanks = h('div.thanks', cur ? 'Vote saved — you can change it.' : '');
    const stars = [1, 2, 3, 4, 5].map((n) => h('button.star', { class: n <= cur ? 'on' : '', 'aria-label': `${n} stars`, on: { click: () => {
      socket.emit('vote', { presenterId: entry.id, stars: n }, (r) => {
        if (!r?.ok) return toast('Voting for this one is closed.');
        S.myVotes[entry.id] = n; sfx.star();
        stars.forEach((s, i) => s.classList.toggle('on', i < n));
        thanks.textContent = n >= 4 ? 'Amazing! Vote saved.' : 'Vote saved — you can change it.';
      });
    } } }, '⭐'));
    v.replaceChildren(h('h3', `How well did ${entry.name} put on the armor?`), h('div.stars', ...stars), thanks);
  }
  requestAnimationFrame(updateInsets);
}

function showResults(st) {
  const r = st.results;
  if (!r) return;
  sfx.fanfare();
  runway.showPodium(r.scores.slice(0, 3));
  $('#vote').classList.add('hidden');
  $('#namecard').classList.add('hidden');
  $('#speech').classList.add('hidden');
  const myId = S.me?.playerId;
  const maxTeam = Math.max(0.01, ...r.teamScores.map((t) => t.score));
  const box = $('#results');
  box.replaceChildren(...[
    h('h2', '🏆 The Armor of God Awards'),
    r.teamScores.length > 1 ? h('div.team-bars', ...r.teamScores.map((t) => h('div.team-bar',
      h('span', t.name), h('div.bar', h('i', { style: { width: `${(t.score / maxTeam) * 100}%`, background: t.color } })), h('span', t.score.toFixed(2))))) : null,
    ...r.scores.map((s, i) => {
      const team = st.teams.find((t) => t.id === s.team);
      return h('div.rank-row', { class: s.id === myId ? 'me' : '' },
        h('span.rk', ['🥇', '🥈', '🥉'][i] || i + 1),
        h('div', h('div.nm', s.name), h('div.sub', `${team?.name || ''} · ${s.votes} vote${s.votes === 1 ? '' : 's'}${s.fullArmor ? ' · 🛡️ full armor' : ''}${s.outfit.prayer ? ' · 🙏' : ''}`)),
        h('span.sc', `★ ${s.total.toFixed(2)}`));
    }),
    S.role === 'host' ? h('div.modal-actions', h('button.btn.primary', { on: { click: () => socket.emit('host:again') } }, 'Play another round')) : h('p.muted', { style: { textAlign: 'center' } }, 'Great job standing firm! 🙌'),
  ].filter(Boolean));
  box.classList.remove('hidden');
  $('#show-progress').textContent = 'Results';
  requestAnimationFrame(updateInsets);
  podiumLabels = r.scores.slice(0, 3).map((s, i) => { const el = h('div.podium-label', `${['🥇', '🥈', '🥉'][i]} ${s.name}`); $('#show').append(el); return el; });
}
let podiumLabels = [];
function placePodiumLabels() {
  podiumLabels.forEach((el, i) => {
    const p = runway.podiumScreen(i);
    if (p) { el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; }
  });
}
function clearPodiumLabels() { podiumLabels.forEach((e) => e.remove()); podiumLabels = []; }

// ------------------------------------------------------------------ per-frame UI
function tickPlay() {
  const st = S.room;
  if (!st) return;
  const t = $('#timer'), tv = $('#timer-val');
  if (st.phase === 'styling') {
    const left = st.styleEndsAt - now();
    tv.textContent = fmtTime(left);
    t.classList.toggle('low', left < 30000);
  } else { tv.textContent = 'Lobby'; t.classList.remove('low'); }
  if (S.cat === 'prayer' && !$('#bubble-preview').classList.contains('hidden')) {
    const p = studio.headScreenPos(0.4);
    if (p) { const b = $('#bubble-preview'); b.style.left = `${Math.min(window.innerWidth - 120, Math.max(120, p.x))}px`; b.style.top = `${Math.max(140, p.y)}px`; }
  }
}
function frame() {
  requestAnimationFrame(frame);
  updateInsets();
  if (S.lastScreen === 'play') tickPlay();
  else if (S.lastScreen === 'show') tickShow();
  if (S.room?.phase !== 'results' && podiumLabels.length) clearPodiumLabels();
  if (S.role === 'host') host.tick();
}
frame();

// first paint
requestAnimationFrame(() => setTimeout(() => $('#loading').classList.add('done'), 300));
if (!S.role) showScreen('home');
