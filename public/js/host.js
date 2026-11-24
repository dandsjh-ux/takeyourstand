// Host (teacher) dashboard: lobby, settings, questions, voting weights, styling monitor, runway controls.
import { $, h, toast, modal, closeModal, fmtTime, sfx } from './ui.js';
import { teamWeights, DEFAULT_VOTING } from './scoring.js';
import { questionsToCSV } from './csv.js';
import { armorCount } from './catalog.js';

export function createHost({ socket, S, now, showScreen, LS, SS }) {
  let extra = { questions: [], players: [], votes: {}, questionSource: '' };
  let tab = 'players';
  let renderedTab = '';
  let pending = {};
  let sendTimer = 0;
  const main = $('#host-main');

  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

  function start() {
    let token = LS.get('tys_host')?.token || rid();
    socket.emit('host:create', { hostToken: token }, (res) => {
      if (!res?.ok) return toast(res?.error || 'Could not create a game');
      begin(res.code, token);
    });
  }
  function resume(sess) {
    socket.emit('host:resume', { code: sess.code, hostToken: sess.token }, (res) => {
      if (!res?.ok) { LS.del('tys_host'); location.hash = ''; showScreen('home'); return; }
      begin(res.code, sess.token);
    });
  }
  function reconnect() {
    const sess = LS.get('tys_host');
    if (sess) socket.emit('host:resume', { code: sess.code, hostToken: sess.token }, (res) => {
      if (!res?.ok) {
        LS.del('tys_host'); location.hash = ''; S.role = null; S.room = null;
        showScreen('home'); toast('That game has ended (the server restarted). Host a new one!', 5000);
      }
    });
  }
  function begin(code, token) {
    S.role = 'host';
    S.code = code;
    LS.set('tys_host', { code, token });
    SS.del('tys_session');
    location.hash = 'host';
    $('#host-code').textContent = code;
    renderedTab = '';
    showScreen('host');
  }

  const send = (patch) => {
    // merge nested voting patches
    pending = { ...pending, ...patch, voting: { ...(pending.voting || {}), ...(patch.voting || {}), teamMultipliers: { ...(pending.voting?.teamMultipliers || {}), ...(patch.voting?.teamMultipliers || {}) } } };
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => { socket.emit('host:settings', pending); pending = {}; }, 200);
  };

  // ------------------------------------------------------------ rendering
  function onState(st, prevPhase) {
    $('#host-phase').textContent = { lobby: '🟢 Lobby', styling: '👗 Styling', runway: '✨ Runway', results: '🏆 Results' }[st.phase];
    if (st.phase === 'lobby' || st.phase === 'styling') {
      if (S.lastScreen !== 'host') { showScreen('host'); renderedTab = ''; }
      if (prevPhase !== st.phase) { renderedTab = ''; if (st.phase === 'styling') tab = 'progress'; }
      render();
    }
  }
  function onExtra(x) {
    extra = x;
    if (S.lastScreen === 'host') render();
    if (S.lastScreen === 'show') updateTally();
  }

  function render() {
    const st = S.room;
    if (!st) return;
    // avoid clobbering an input the teacher is using
    const ae = document.activeElement;
    const busy = ae && main.contains(ae) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(ae.tagName);
    if (renderedTab !== `${st.phase}:${tab}`) {
      renderedTab = `${st.phase}:${tab}`;
      main.replaceChildren(...build(st));
    } else if (!busy) {
      refreshLive(st);
    }
  }

  function build(st) {
    const out = [];
    const url = `${location.origin}/?join=${st.code}`;
    if (st.phase === 'lobby') {
      out.push(h('div.card.h-card',
        h('div.join-box',
          h('img', { src: `/qr.svg?text=${encodeURIComponent(url)}`, alt: 'QR code to join' }),
          h('div',
            h('div.muted', 'Students join at'),
            h('div.url', url.replace(/^https?:\/\//, '')),
            h('div.muted', { style: { marginTop: '6px' } }, 'with code'),
            h('div.big-code', st.code))),
        h('div.row.between', { style: { marginTop: '12px' } },
          h('span#h-count.muted', ''),
          h('button.btn.primary.big', { on: { click: () => { sfx.fanfare(); socket.emit('host:start'); } } }, '▶ Start styling'))));
    } else {
      out.push(h('div.card.h-card',
        h('div.big-timer#h-timer', '--:--'),
        h('div.row', { style: { justifyContent: 'center' } },
          h('button.btn.small', { on: { click: () => socket.emit('host:addTime', { seconds: -60 }) } }, '−1 min'),
          h('button.btn.small', { on: { click: () => socket.emit('host:addTime', { seconds: 60 }) } }, '+1 min'),
          h('button.btn.small', { on: { click: () => socket.emit('host:giveCoins', { amount: 10 }) } }, '+10 🪙 everyone'),
          h('button.btn.small.primary', { on: { click: () => confirmBox('Start the runway now?', 'Styling will end for everyone.', () => socket.emit('host:endStyling')) } }, 'Start runway ›')),
        h('div#h-ready.muted', { style: { textAlign: 'center', marginTop: '8px' } })));
    }
    const tabs = st.phase === 'lobby'
      ? [['players', '👥 Players'], ['game', '⏱️ Game'], ['questions', '📜 Questions'], ['voting', '⚖️ Voting'], ['teams', '🏳️ Teams']]
      : [['progress', '👗 Progress'], ['players', '👥 Players'], ['game', '⏱️ Game'], ['questions', '📜 Questions'], ['voting', '⚖️ Voting']];
    if (!tabs.some(([k]) => k === tab)) tab = tabs[0][0];
    out.push(h('div.h-tabs', ...tabs.map(([k, l]) => h('button.h-tab', { class: tab === k ? 'on' : '', on: { click: () => { tab = k; renderedTab = ''; render(); } } }, l))));
    const card = h('div.card.h-card');
    card.append(...buildTab(st));
    out.push(card);
    setTimeout(() => refreshLive(st), 0);
    return out;
  }

  function buildTab(st) {
    switch (tab) {
      case 'players': return [h('div.row.between', h('h3', 'Players'), h('div.row',
        st.teams.length > 1 ? h('button.btn.small', { on: { click: () => socket.emit('host:balanceTeams') } }, '⚖️ Balance teams') : null)),
      h('p.muted', 'Tap “Teacher” to make a helper a judge — judges vote with extra weight and don’t walk the runway.'),
      h('div.plist#h-plist')];
      case 'progress': return [h('h3', 'Styling progress'), h('div.progress-grid#h-progress')];
      case 'game': return buildGame(st);
      case 'questions': return buildQuestions(st);
      case 'voting': return buildVoting(st);
      case 'teams': return buildTeams(st);
      default: return [];
    }
  }

  // ---------------- controls
  function slider(label, value, { min, max, step, fmt = (v) => v, hint, onInput, key }) {
    const val = h('span.val', fmt(value));
    const input = h('input', { type: 'range', min, max, step, value, 'data-key': key || '' });
    input.value = value;
    input.addEventListener('input', () => { val.textContent = fmt(Number(input.value)); onInput(Number(input.value)); });
    input._fmt = fmt; input._val = val;
    return h('div.field', h('span.lbl', label), val, input, hint ? h('span.hint', hint) : null);
  }
  function select(label, value, options, onChange, hint) {
    const s = h('select', ...options.map(([v, l]) => h('option', { value: v }, l)));
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    return h('div.field', h('span.lbl', label), s, hint ? h('span.hint', hint) : null);
  }
  function toggle(label, on, onChange, hint) {
    const t = h('button.toggle', { class: on ? 'on' : '', 'aria-pressed': String(on) });
    t.addEventListener('click', () => { const v = !t.classList.contains('on'); t.classList.toggle('on', v); onChange(v); });
    return h('div.field', h('span.lbl', label), t, hint ? h('span.hint', hint) : null);
  }

  function buildGame(st) {
    const s = st.settings;
    return [
      h('h3', 'Game settings'),
      slider('Styling time', s.styleSeconds, { min: 60, max: 1200, step: 30, fmt: (v) => fmtTime(v * 1000), onInput: (v) => send({ styleSeconds: v }), hint: 'How long students have to dress up and answer questions.' }),
      slider('Runway time per student', s.presentSeconds, { min: 15, max: 45, step: 1, fmt: (v) => `${v}s`, onInput: (v) => send({ presentSeconds: v }), hint: 'Walk + poses + prayer bubble + voting.' }),
      slider('Coins per correct answer', s.coinsPerCorrect, { min: 1, max: 50, step: 1, fmt: (v) => `${v} 🪙`, onInput: (v) => send({ coinsPerCorrect: v }), hint: 'A coins column in the CSV overrides this per question.' }),
      slider('Starting coins', s.startCoins, { min: 0, max: 200, step: 5, fmt: (v) => `${v} 🪙`, onInput: (v) => send({ startCoins: v }) }),
      slider('Shop prices', s.priceScale, { min: 0.25, max: 2, step: 0.25, fmt: (v) => `×${v}`, onInput: (v) => send({ priceScale: v }), hint: 'Base prices: armor 15–35, poses 15–30, bonus wardrobe 30–80 coins.' }),
      toggle('Unlock everything', s.unlockAll, (v) => send({ unlockAll: v }), 'Free-play mode: all costumes and poses open, no coins needed.'),
      select('Teams', s.teamMode, [['choose', 'Students choose their team'], ['auto', 'Auto-assign (balanced)']], (v) => send({ teamMode: v })),
    ];
  }

  function buildQuestions(st) {
    const fileReplace = h('input', { type: 'file', accept: '.csv,text/csv' });
    const fileAppend = h('input', { type: 'file', accept: '.csv,text/csv' });
    const upload = (input, mode) => input.addEventListener('change', async () => {
      const f = input.files[0]; if (!f) return;
      const text = await f.text();
      socket.emit('host:questions', { csv: text, mode }, (res) => {
        if (!res?.ok) return toast(res?.error || 'Could not read that CSV', 4000);
        toast(`Loaded ✓ ${res.count} questions${res.errors?.length ? ` (${res.errors.length} rows skipped)` : ''}`, 3500);
        if (res.errors?.length) modal(h('h3', 'Some rows were skipped'), h('ul', ...res.errors.slice(0, 12).map((e) => h('li', e))), h('div.modal-actions', h('button.btn', { on: { click: closeModal } }, 'OK')));
        renderedTab = ''; input.value = '';
      });
    });
    upload(fileReplace, 'replace'); upload(fileAppend, 'append');
    const qIn = h('textarea', { rows: 2, placeholder: 'Question' });
    const opts = [0, 1, 2, 3].map((i) => h('input', { placeholder: `Option ${'ABCD'[i]}${i > 1 ? ' (optional)' : ''}` }));
    const correct = h('select', ...[0, 1, 2, 3].map((i) => h('option', { value: i }, `Correct: ${'ABCD'[i]}`)));
    const coins = h('input', { type: 'number', min: 0, max: 500, placeholder: `Coins (default ${st.settings.coinsPerCorrect})` });
    const ref = h('input', { placeholder: 'Bible reference (optional)' });
    const add = () => {
      const choices = opts.map((o) => o.value.trim());
      const ans = Number(correct.value);
      if (!qIn.value.trim() || !choices[ans] || choices.filter(Boolean).length < 2) return toast('Add a question, at least 2 options and pick the correct one.');
      const kept = choices.map((c, i) => [c, i]).filter(([c]) => c);
      const q = { q: qIn.value.trim(), choices: kept.map(([c]) => c), answer: kept.findIndex(([, i]) => i === ans), coins: coins.value === '' ? null : Number(coins.value), ref: ref.value.trim() };
      socket.emit('host:questions', { questions: [...extra.questions, q] }, (r) => { if (r?.ok) { toast('Question added'); renderedTab = ''; } });
    };
    return [
      h('h3', 'Questions'),
      h('p.muted#h-qsrc', ''),
      h('div.row', { style: { margin: '8px 0' } },
        h('label.btn.small.primary.file-btn', '⬆ Upload CSV (replace)', fileReplace),
        h('label.btn.small.file-btn', '＋ Add from CSV', fileAppend),
        h('button.btn.small', { on: { click: () => download('take-your-stand-template.csv', TEMPLATE) } }, '⬇ Template'),
        h('button.btn.small', { on: { click: () => download('questions.csv', questionsToCSV(extra.questions)) } }, '⬇ Current'),
        h('button.btn.small.danger', { on: { click: () => confirmBox('Restore default questions?', 'This replaces the current list with the built-in Armor of God questions.', () => socket.emit('host:questions', { mode: 'default' }, () => { renderedTab = ''; })) } }, 'Reset to default')),
      h('p.muted', 'CSV columns: question, option_a, option_b, option_c, option_d, answer (A–D), coins, reference. Blooket exports and “Correct / Incorrect answer” sheets also work.'),
      h('details', h('summary', { style: { fontWeight: 800, cursor: 'pointer', margin: '6px 0' } }, 'Write a question'),
        h('div.qform', qIn, ...opts, h('div.row', correct, coins), ref, h('button.btn.ok', { on: { click: add } }, 'Add question'))),
      h('div.section-label', 'Question bank'),
      h('div.qlist#h-qlist'),
    ];
  }

  function buildVoting(st) {
    const v = { ...DEFAULT_VOTING, ...st.settings.voting };
    const sv = (patch) => send({ voting: patch });
    return [
      h('h3', 'Voting weights'),
      h('p.muted', 'Every vote is 1–5 stars. A presenter’s score is the weighted average of the stars they get, plus bonuses.'),
      slider('Host (you)', v.hostWeight, { min: 0, max: 20, step: 0.5, fmt: (x) => `×${x}`, onInput: (x) => sv({ hostWeight: x }), key: 'hostWeight', hint: 'The teacher has the highest weight by default.' }),
      slider('Helper teachers (judges)', v.judgeWeight, { min: 0, max: 20, step: 0.5, fmt: (x) => `×${x}`, onInput: (x) => sv({ judgeWeight: x }), key: 'judgeWeight' }),
      slider('Each student', v.studentWeight, { min: 0, max: 5, step: 0.25, fmt: (x) => `×${x}`, onInput: (x) => sv({ studentWeight: x }), key: 'studentWeight' }),
      select('Adjust for team size', v.normalize, [['equal', 'Equal power per team'], ['sqrt', 'Partly balanced (√)'], ['none', 'No adjustment']], (x) => sv({ normalize: x }),
        'Equal: a team of 3 gets the same total say as a team of 8 (each small-team vote counts more). √: halfway. None: every student counts the same.'),
      select('Votes for teammates', v.teammateVotes, [['half', 'Count half'], ['full', 'Count fully'], ['none', 'Don’t count']], (x) => sv({ teammateVotes: x }), 'Nobody can vote for themselves.'),
      h('div.section-label', 'Per-team fine tuning'),
      h('div#h-teammult'),
      slider('Full armor bonus', v.fullArmorBonus, { min: 0, max: 2, step: 0.25, fmt: (x) => `+${x}★`, onInput: (x) => sv({ fullArmorBonus: x }), key: 'fullArmorBonus', hint: 'Added when all six pieces are worn.' }),
      slider('Prayer bonus', v.prayerBonus, { min: 0, max: 1, step: 0.25, fmt: (x) => `+${x}★`, onInput: (x) => sv({ prayerBonus: x }), key: 'prayerBonus' }),
      select('Team score', v.teamScore, [['average', 'Average of members'], ['total', 'Total of members']], (x) => sv({ teamScore: x })),
      h('div.section-label', 'Live voting power'),
      h('div#h-wtable'),
    ];
  }

  function buildTeams(st) {
    const count = h('select', ...[1, 2, 3, 4, 5, 6].map((n) => h('option', { value: n }, `${n} team${n > 1 ? 's' : ''}`)));
    count.value = st.teams.length;
    const names = h('div.qform');
    const fill = (n) => {
      const cur = [...names.querySelectorAll('input')].map((i) => i.value);
      names.replaceChildren(...Array.from({ length: n }, (_, i) => h('input', { value: cur[i] ?? st.teams[i]?.name ?? '', placeholder: `Team ${i + 1}`, maxLength: 20 })));
      names.querySelectorAll('input').forEach((inp, i) => { inp.value = cur[i] ?? st.teams[i]?.name ?? ['Team Faith', 'Team Hope', 'Team Love', 'Team Peace', 'Team Truth', 'Team Joy'][i]; });
    };
    fill(st.teams.length);
    count.addEventListener('change', () => fill(Number(count.value)));
    return [h('h3', 'Teams'), h('div.field', h('span.lbl', 'Number of teams'), count), names,
      h('div.modal-actions', h('button.btn.primary', { on: { click: () => socket.emit('host:teams', { count: Number(count.value), names: [...names.querySelectorAll('input')].map((i) => i.value) }, () => { toast('Teams saved'); renderedTab = ''; }) } }, 'Save teams'))];
  }

  // ---------------- live refresh (no full rebuild)
  function refreshLive(st) {
    const teamOf = (id) => st.teams.find((t) => t.id === id);
    const students = st.players.filter((p) => p.role === 'player');
    const cnt = $('#h-count');
    if (cnt) cnt.textContent = `${students.length} student${students.length === 1 ? '' : 's'} joined · ${st.questionCount} questions`;
    const ready = $('#h-ready');
    if (ready) ready.textContent = `${students.filter((p) => p.ready).length}/${students.length} ready for the runway`;

    const pl = $('#h-plist');
    if (pl) {
      if (!st.players.length) pl.replaceChildren(h('p.muted', 'Waiting for students to join…'));
      else pl.replaceChildren(...st.players.slice().sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)).map((p) => {
        const t = teamOf(p.team);
        const teamSel = h('select', ...st.teams.map((x) => h('option', { value: x.id }, x.name)));
        teamSel.value = p.team;
        teamSel.addEventListener('change', () => socket.emit('host:player', { id: p.id, team: teamSel.value }));
        const roleSel = h('select', h('option', { value: 'player' }, 'Student'), h('option', { value: 'judge' }, 'Teacher'));
        roleSel.value = p.role;
        roleSel.addEventListener('change', () => socket.emit('host:player', { id: p.id, role: roleSel.value }));
        return h('div.prow', { class: p.connected ? '' : 'offline' },
          h('div', h('div.pn', h('span.team-dot', { style: { background: t?.color } }), p.name, p.connected ? '' : ' (offline)'),
            h('div.ps', `${p.role === 'judge' ? '⚖️ judge' : `${p.armor}/6 armor`} · ${p.coins} 🪙`)),
          h('div.pc', st.teams.length > 1 ? teamSel : null, roleSel,
            h('button.btn.small', { title: 'Give 10 coins', on: { click: () => socket.emit('host:player', { id: p.id, coins: 10 }) } }, '+10🪙'),
            h('button.btn.small.danger', { title: 'Remove', on: { click: () => confirmBox(`Remove ${p.name}?`, 'They can rejoin with the code.', () => socket.emit('host:player', { id: p.id, kick: true })) } }, '✕')));
      }));
    }
    const pg = $('#h-progress');
    if (pg) {
      const full = new Map(extra.players.map((p) => [p.id, p]));
      pg.replaceChildren(...students.map((p) => {
        const t = teamOf(p.team), x = full.get(p.id) || {};
        return h('div.pcard', { class: p.connected ? '' : 'offline' },
          h('div.pn', h('span.team-dot', { style: { background: t?.color } }), p.name, p.ready ? ' ✅' : ''),
          h('div.bar', h('i', { style: { width: `${(p.armor / 6) * 100}%` } })),
          h('div.ps', `${p.armor}/6 armor · ${p.coins} 🪙 · ${x.correct ?? 0}✓ ${x.wrong ?? 0}✗`),
          x.prayer ? h('div.ps', { style: { marginTop: '4px', fontStyle: 'italic' } }, `🙏 “${x.prayer}” `,
            h('button.btn.small.ghost', { on: { click: () => socket.emit('host:player', { id: p.id, clearPrayer: true }) } }, 'clear')) : h('div.ps', 'No prayer yet'));
      }));
    }
    const ql = $('#h-qlist');
    if (ql && ql.childElementCount !== extra.questions.length) {
      ql.replaceChildren(...extra.questions.map((q, i) => h('div.qrow',
        h('div.row.between', h('span.qq', `${i + 1}. ${q.q}`),
          h('button.btn.small.ghost', { on: { click: () => socket.emit('host:questions', { questions: extra.questions.filter((x) => x.id !== q.id) }) } }, 'delete')),
        h('div.qa', ...q.choices.map((c, k) => (k === q.answer ? h('b', `✓ ${c}`) : `${c}`)).flatMap((x, k) => (k ? [' · ', x] : [x])),
          q.coins != null ? ` · ${q.coins}🪙` : '', q.ref ? ` · ${q.ref}` : ''))));
    }
    const qs = $('#h-qsrc');
    if (qs) qs.textContent = `${extra.questions.length} questions · ${extra.questionSource || ''}`;
    const tm = $('#h-teammult');
    if (tm && tm.childElementCount !== st.teams.length) {
      tm.replaceChildren(...st.teams.map((t) => slider(`${t.name} multiplier`, st.settings.voting.teamMultipliers?.[t.id] ?? 1, {
        min: 0, max: 3, step: 0.1, fmt: (x) => `×${x.toFixed(1)}`, onInput: (x) => send({ voting: { teamMultipliers: { [t.id]: x } } }),
      })));
    }
    const wt = $('#h-wtable');
    if (wt) {
      const tw = teamWeights(st.players, st.teams, st.settings.voting);
      const v = { ...DEFAULT_VOTING, ...st.settings.voting };
      const pct = (x) => (tw.grand ? (x / tw.grand) * 100 : 0);
      const row = (name, n, each, total, color) => h('tr', h('td', color ? h('span.team-dot', { style: { background: color, marginRight: '6px' } }) : null, name), h('td', n), h('td', each.toFixed(2)), h('td', total.toFixed(2)),
        h('td', h('div.share-bar', h('i', { style: { width: `${pct(total)}%` } })), `${pct(total).toFixed(0)}%`));
      wt.replaceChildren(h('table.wtable',
        h('tr', h('th', 'Voter'), h('th', '#'), h('th', 'Each'), h('th', 'Total'), h('th', 'Share')),
        row('Host (you)', 1, v.hostWeight, v.hostWeight),
        tw.judges ? row('Helper teachers', tw.judges, v.judgeWeight, tw.judges * v.judgeWeight) : null,
        ...tw.rows.map((r) => row(r.team.name, r.size, r.each, r.total, r.team.color))),
      h('p.muted', `Teammate votes ${v.teammateVotes === 'half' ? 'count half' : v.teammateVotes === 'none' ? 'are ignored' : 'count fully'}. The share shown is each group's slice of the total voting power for a typical presenter.`));
    }
    // keep sliders in sync if changed elsewhere (e.g. another host tab)
    for (const inp of main.querySelectorAll('input[type=range][data-key]')) {
      const k = inp.dataset.key; if (!k || document.activeElement === inp) continue;
      const val = st.settings.voting[k];
      if (val != null && Number(inp.value) !== val) { inp.value = val; inp._val.textContent = inp._fmt(val); }
    }
  }

  function tick() {
    const st = S.room;
    if (!st || S.lastScreen !== 'host') return;
    const t = $('#h-timer');
    if (t && st.phase === 'styling') t.textContent = fmtTime(st.styleEndsAt - now());
  }

  // ---------------- runway controls (shown over the runway)
  function renderRunwayControls() {
    const box = $('#host-runway');
    const rw = S.room.runway;
    box.replaceChildren(
      h('div.row', { style: { justifyContent: 'flex-end' } },
        h('button.btn.small', { on: { click: () => socket.emit('host:runway', { action: rw.paused ? 'resume' : 'pause' }) } }, rw.paused ? '▶ Resume' : '⏸ Pause'),
        h('button.btn.small', { on: { click: () => socket.emit('host:runway', { action: 'replay' }) } }, '↺ Replay'),
        h('button.btn.small.primary', { on: { click: () => socket.emit('host:runway', { action: 'next' }) } }, 'Next ›')),
      h('button.btn.small.ghost', { on: { click: () => confirmBox('Skip to results?', 'Remaining students won\'t present.', () => socket.emit('host:runway', { action: 'finish' })) } }, 'Finish & show results'),
      h('div.tally#h-tally'),
    );
    box._paused = rw.paused;
    updateTally();
  }
  function tickRunway(entry) {
    const box = $('#host-runway');
    if (box._paused !== S.room.runway.paused) renderRunwayControls(entry);
  }
  function updateTally() {
    const el = $('#h-tally');
    const rw = S.room?.runway;
    if (!el || !rw) return;
    const voters = S.room.players.filter((p) => p.connected && p.id !== rw.current).length + 1;
    el.textContent = `🗳️ ${extra.votes?.[rw.current] || 0}/${voters} votes in`;
  }

  return { start, resume, reconnect, onState, onExtra, tick, renderRunwayControls, tickRunway };
}

function confirmBox(title, text, ok) {
  modal(h('h3', title), h('p', text), h('div.modal-actions',
    h('button.btn', { on: { click: closeModal } }, 'Cancel'),
    h('button.btn.primary', { on: { click: () => { closeModal(); ok(); } } }, 'Yes')));
}

function download(name, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: name });
  document.body.append(a); a.click(); a.remove();
}

const TEMPLATE = `question,option_a,option_b,option_c,option_d,answer,coins,reference
What is the belt in the Armor of God called?,Belt of Strength,Belt of Truth,Belt of Joy,Belt of Gold,B,10,Ephesians 6:14
Which piece of armor protects your head?,Shield of Faith,Helmet of Salvation,Shoes of Peace,Breastplate,B,,Ephesians 6:17
True or false: we should pray on all occasions.,True,False,,,A,5,Ephesians 6:18
`;
