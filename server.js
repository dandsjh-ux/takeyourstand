// Take Your Stand — multiplayer Armor of God dress-up game server.
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import {
  ITEM_MAP, POSE_MAP, WALK_MAP, priceFor, sanitizeOutfit, defaultOutfit, armorCount, PRAYER_MAX,
} from './public/js/catalog.js';
import { parseQuestionsCSV } from './public/js/csv.js';
import { DEFAULT_VOTING, teamWeights, scoreEntry } from './public/js/scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, pingInterval: 10000, pingTimeout: 20000 });

app.disable('x-powered-by');
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, file) => {
    // code & pages revalidate every load so a redeploy reaches phones immediately
    if (/\.(js|css|html|csv)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/qr.svg', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 300);
  if (!text) return res.status(400).end();
  try {
    const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#3a2418', light: '#fffaf0' } });
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
  } catch { res.status(500).end(); }
});

// ---------------------------------------------------------------- data
const DEFAULT_QUESTIONS = (() => {
  try {
    const txt = fs.readFileSync(path.join(__dirname, 'public/questions-default.csv'), 'utf8');
    return parseQuestionsCSV(txt).questions;
  } catch (e) {
    console.warn('No default questions:', e.message);
    return [];
  }
})();

const TEAM_PRESETS = [
  { name: 'Team Faith', color: '#c0573f' },
  { name: 'Team Hope', color: '#3f73b8' },
  { name: 'Team Love', color: '#b8487c' },
  { name: 'Team Peace', color: '#4f9a6a' },
  { name: 'Team Truth', color: '#c99a2e' },
  { name: 'Team Joy', color: '#7d58b5' },
];

const DEFAULT_SETTINGS = {
  styleSeconds: 300,
  presentSeconds: 24,
  coinsPerCorrect: 10,
  startCoins: 0,
  priceScale: 1,
  unlockAll: false,
  teamMode: 'choose', // 'choose' | 'auto'
  voting: { ...DEFAULT_VOTING },
};

const BAD_WORDS = ['fuck', 'shit', 'bitch', 'bastard', 'dick', 'cunt', 'asshole', 'slut', 'whore', 'nigger', 'nigga', 'fag', 'retard', 'piss', 'cock', 'pussy', 'damn'];
const cleanText = (s, max) => {
  let t = String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  for (const w of BAD_WORDS) t = t.replace(new RegExp(`\\b${w}\\w*`, 'gi'), (m) => '*'.repeat(m.length));
  return t;
};

// ---------------------------------------------------------------- rooms
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const newCode = () => {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
};
const uid = () => Math.random().toString(36).slice(2, 10);

function makeTeams(n, old = []) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: old[i]?.name || TEAM_PRESETS[i].name,
    color: TEAM_PRESETS[i].color,
  }));
}

function createRoom(hostToken) {
  const room = {
    code: newCode(),
    hostToken,
    hostSockets: new Set(),
    phase: 'lobby',
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    questions: DEFAULT_QUESTIONS.map((q) => ({ ...q, id: uid() })),
    questionSource: 'Default Armor of God questions',
    teams: makeTeams(2),
    players: new Map(),
    styleEndsAt: 0,
    runway: null,
    results: null,
    touched: Date.now(),
    round: 0,
  };
  rooms.set(room.code, room);
  return room;
}

function newPlayer(room, clientId, name, body, team) {
  return {
    id: uid(),
    clientId,
    name,
    team,
    role: 'player',
    coins: room.phase === 'lobby' ? 0 : room.settings.startCoins,
    owned: new Set(),
    outfit: defaultOutfit(body),
    answered: new Set(),
    recentQ: [],
    pendingQ: null,
    lastAnswerAt: 0,
    correct: 0,
    wrong: 0,
    ready: false,
    sockets: new Set(),
    joinedAt: Date.now(),
  };
}

const students = (room) => [...room.players.values()].filter((p) => p.role === 'player');

function pickTeam(room) {
  const counts = Object.fromEntries(room.teams.map((t) => [t.id, 0]));
  for (const p of students(room)) if (counts[p.team] != null) counts[p.team]++;
  return room.teams.slice().sort((a, b) => counts[a.id] - counts[b.id])[0].id;
}

function publicPlayer(p) {
  return {
    id: p.id, name: p.name, team: p.team, role: p.role,
    connected: p.sockets.size > 0, ready: p.ready,
    armor: armorCount(p.outfit), body: p.outfit.body, coins: p.coins,
    hasPrayer: !!p.outfit.prayer?.trim(),
  };
}

function publicState(room) {
  const s = room.settings;
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    serverNow: Date.now(),
    styleEndsAt: room.styleEndsAt,
    teams: room.teams,
    players: [...room.players.values()].map(publicPlayer),
    settings: {
      styleSeconds: s.styleSeconds, presentSeconds: s.presentSeconds, coinsPerCorrect: s.coinsPerCorrect,
      startCoins: s.startCoins, priceScale: s.priceScale, unlockAll: s.unlockAll, teamMode: s.teamMode,
      voting: s.voting,
    },
    questionCount: room.questions.length,
    runway: room.runway ? {
      index: room.runway.index, startedAt: room.runway.startedAt, paused: room.runway.paused,
      pausedAt: room.runway.pausedAt, count: room.runway.order.length, presentMs: room.runway.presentMs,
      current: room.runway.order[room.runway.index] || null,
    } : null,
    results: room.phase === 'results' ? room.results : null,
  };
}

function privateState(room, p) {
  return {
    playerId: p.id,
    round: room.round,
    forceOutfit: !!p.forceOutfit,
    coins: p.coins,
    owned: [...p.owned],
    outfit: p.outfit,
    correct: p.correct,
    questionsLeft: room.questions.filter((q) => !p.answered.has(q.id)).length,
  };
}

function hostExtra(room) {
  return {
    questions: room.questions,
    questionSource: room.questionSource,
    players: [...room.players.values()].map((p) => ({
      ...publicPlayer(p), correct: p.correct, wrong: p.wrong, prayer: p.outfit.prayer,
    })),
    votes: room.runway ? Object.fromEntries(Object.entries(room.runway.votes).map(([k, v]) => [k, Object.keys(v).length])) : {},
  };
}

let broadcastTimers = new Map();
function broadcast(room, immediate = false) {
  room.touched = Date.now();
  const send = () => {
    broadcastTimers.delete(room.code);
    io.to(room.code).emit('room:state', publicState(room));
    for (const sid of room.hostSockets) io.to(sid).emit('host:extra', hostExtra(room));
  };
  if (immediate) { clearTimeout(broadcastTimers.get(room.code)); send(); return; }
  if (!broadcastTimers.has(room.code)) broadcastTimers.set(room.code, setTimeout(send, 120));
}
function sendPrivate(room, p, forceOutfit = false) {
  p.forceOutfit = forceOutfit;
  for (const sid of p.sockets) io.to(sid).emit('me', privateState(room, p));
  p.forceOutfit = false;
}

// ---------------------------------------------------------------- phases
function startStyling(room) {
  room.round++;
  room.phase = 'styling';
  room.styleEndsAt = Date.now() + room.settings.styleSeconds * 1000;
  room.runway = null;
  room.results = null;
  for (const p of room.players.values()) {
    p.coins = room.settings.startCoins;
    p.owned = new Set();
    p.answered = new Set();
    p.recentQ = [];
    p.pendingQ = null;
    p.correct = 0; p.wrong = 0;
    p.ready = false;
    const keep = p.outfit;
    p.outfit = { ...defaultOutfit(keep.body), body: keep.body, skin: keep.skin, hair: keep.hair, hairColor: keep.hairColor };
    sendPrivate(room, p);
  }
  broadcast(room, true);
}

function startRunway(room) {
  const list = students(room).filter((p) => p.sockets.size > 0 || Date.now() - p.joinedAt < 3600e3);
  // alternate teams so the runway mixes them
  const byTeam = {};
  for (const p of shuffle(list)) (byTeam[p.team] ||= []).push(p);
  const order = [];
  const queues = Object.values(byTeam);
  while (queues.some((q) => q.length)) for (const q of shuffle(queues)) if (q.length) order.push(q.shift());
  const entries = order.map((p) => ({
    id: p.id, name: p.name, team: p.team,
    outfit: sanitizeOutfit(p.outfit, p.owned, room.settings.unlockAll),
  }));
  room.phase = 'runway';
  room.runway = {
    order: entries.map((e) => e.id),
    entries,
    index: 0,
    presentMs: room.settings.presentSeconds * 1000,
    startedAt: Date.now() + 4000,
    paused: false,
    pausedAt: 0,
    votes: {}, // presenterId -> {voterId: stars}
  };
  io.to(room.code).emit('runway:entries', { entries, round: room.round });
  if (!entries.length) return finishRunway(room);
  broadcast(room, true);
}

function finishRunway(room) {
  const rw = room.runway;
  const voters = {};
  for (const p of room.players.values()) voters[p.id] = { id: p.id, team: p.team, role: p.role };
  voters.host = { id: 'host', isHost: true };
  const tw = teamWeights([...room.players.values()], room.teams, room.settings.voting);
  const scores = (rw?.entries || []).map((e) => {
    const sc = scoreEntry(e, rw.votes[e.id], voters, tw, room.settings.voting);
    return { id: e.id, name: e.name, team: e.team, outfit: e.outfit, ...sc };
  }).sort((a, b) => b.total - a.total);
  const teamScores = room.teams.map((t) => {
    const mine = scores.filter((s) => s.team === t.id);
    const sum = mine.reduce((a, s) => a + s.total, 0);
    const val = room.settings.voting.teamScore === 'total' ? sum : (mine.length ? sum / mine.length : 0);
    return { id: t.id, name: t.name, color: t.color, score: val, members: mine.length };
  }).filter((t) => t.members > 0).sort((a, b) => b.score - a.score);
  room.results = { scores, teamScores, teamScoreMode: room.settings.voting.teamScore };
  room.phase = 'results';
  broadcast(room, true);
}

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// game clock
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === 'styling' && now >= room.styleEndsAt) startRunway(room);
    else if (room.phase === 'runway' && room.runway && !room.runway.paused) {
      const rw = room.runway;
      if (now >= rw.startedAt + rw.presentMs) {
        if (rw.index + 1 >= rw.order.length) {
          if (now >= rw.startedAt + rw.presentMs + 2500) finishRunway(room);
        } else {
          rw.index++;
          rw.startedAt = now + 1500;
          broadcast(room, true);
        }
      }
    }
    // clean up idle rooms after 8 hours
    if (now - room.touched > 8 * 3600e3) rooms.delete(room.code);
  }
}, 250);

// ---------------------------------------------------------------- sockets
const num = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

io.on('connection', (socket) => {
  let room = null;
  let player = null;
  let isHost = false;

  const ack = (cb, data) => { if (typeof cb === 'function') cb(data); };
  const requireHost = (cb) => {
    if (!room || !isHost) { ack(cb, { ok: false, error: 'Not the host.' }); return false; }
    return true;
  };

  socket.on('host:create', ({ hostToken } = {}, cb) => {
    if (typeof hostToken !== 'string' || hostToken.length < 8) return ack(cb, { ok: false, error: 'Bad token' });
    room = createRoom(hostToken.slice(0, 64));
    isHost = true;
    room.hostSockets.add(socket.id);
    socket.join(room.code);
    ack(cb, { ok: true, code: room.code });
    broadcast(room, true);
  });

  socket.on('host:resume', ({ code, hostToken } = {}, cb) => {
    const r = rooms.get(String(code || '').toUpperCase());
    if (!r || r.hostToken !== hostToken) return ack(cb, { ok: false, error: 'Room not found' });
    room = r; isHost = true;
    room.hostSockets.add(socket.id);
    socket.join(room.code);
    ack(cb, { ok: true, code: room.code });
    if (room.runway) socket.emit('runway:entries', { entries: room.runway.entries, round: room.round });
    broadcast(room, true);
  });

  socket.on('player:join', ({ code, clientId, name, body, team } = {}, cb) => {
    const r = rooms.get(String(code || '').trim().toUpperCase());
    if (!r) return ack(cb, { ok: false, error: 'No game with that code. Check with your teacher!' });
    if (typeof clientId !== 'string' || clientId.length < 8) return ack(cb, { ok: false, error: 'Bad client' });
    room = r;
    let p = [...room.players.values()].find((x) => x.clientId === clientId);
    const cleanName = cleanText(name, 18);
    if (!p) {
      if (!cleanName) return ack(cb, { ok: false, error: 'Please type your name.' });
      if (room.players.size >= 80) return ack(cb, { ok: false, error: 'This game is full.' });
      const t = room.settings.teamMode === 'choose' && room.teams.some((x) => x.id === team) ? team : pickTeam(room);
      p = newPlayer(room, clientId, cleanName, body, t);
      room.players.set(p.id, p);
    } else if (cleanName) {
      p.name = cleanName;
      if (room.phase === 'lobby' && room.settings.teamMode === 'choose' && room.teams.some((x) => x.id === team)) p.team = team;
    }
    player = p;
    p.sockets.add(socket.id);
    socket.join(room.code);
    ack(cb, { ok: true, code: room.code, state: publicState(room), me: privateState(room, p) });
    if (room.runway) socket.emit('runway:entries', { entries: room.runway.entries, round: room.round });
    broadcast(room);
  });

  socket.on('player:outfit', (outfit, cb) => {
    if (!room || !player) return;
    if (outfit && typeof outfit.prayer === 'string') outfit.prayer = cleanText(outfit.prayer, PRAYER_MAX);
    const before = player.outfit;
    let next = sanitizeOutfit(outfit, player.owned, room.settings.unlockAll);
    // in the lobby only the "Me" features may change
    if (room.phase === 'lobby') next = { ...before, body: next.body, skin: next.skin, hair: next.hair, hairColor: next.hairColor };
    if (room.phase === 'runway' || room.phase === 'results') return ack(cb, { ok: false });
    if (room.phase === 'lobby' && before.body !== next.body) {
      // keep tunic matching default style when switching body in lobby
      next.tunic = defaultOutfit(next.body).tunic;
    }
    player.outfit = next;
    ack(cb, { ok: true });
    broadcast(room);
  });

  socket.on('player:buy', ({ kind, id } = {}, cb) => {
    if (!room || !player) return ack(cb, { ok: false });
    if (room.phase !== 'styling') return ack(cb, { ok: false, error: 'The shop opens when styling starts.' });
    if (!['item', 'pose', 'walk'].includes(kind)) return ack(cb, { ok: false });
    const price = priceFor(kind, id, room.settings.priceScale);
    if (price == null) return ack(cb, { ok: false });
    const key = kind === 'item' ? id : `${kind}:${id}`;
    if (player.owned.has(key) || price === 0 || room.settings.unlockAll) return ack(cb, { ok: true, coins: player.coins });
    if (player.coins < price) return ack(cb, { ok: false, error: `You need ${price - player.coins} more coins.` });
    player.coins -= price;
    player.owned.add(key);
    sendPrivate(room, player);
    ack(cb, { ok: true, coins: player.coins });
  });

  socket.on('player:question', (_x, cb) => {
    if (!room || !player) return ack(cb, { ok: false });
    if (room.phase !== 'styling') return ack(cb, { ok: false, error: 'Questions open during styling time.' });
    const pool = room.questions.filter((q) => !player.answered.has(q.id));
    if (!pool.length) return ack(cb, { ok: true, done: true });
    let choices = pool.filter((q) => !player.recentQ.includes(q.id));
    if (!choices.length) choices = pool;
    const q = choices[Math.floor(Math.random() * choices.length)];
    // shuffle 3+ options each time so the right answer isn't always in the same spot
    // (two-option questions such as True/False keep their order)
    const order = q.choices.length >= 3 ? shuffle(q.choices.map((_, i) => i)) : q.choices.map((_, i) => i);
    player.pendingQ = { id: q.id, order };
    player.recentQ = [q.id, ...player.recentQ].slice(0, Math.min(3, Math.max(0, pool.length - 1)));
    ack(cb, {
      ok: true,
      question: { id: q.id, q: q.q, choices: order.map((i) => q.choices[i]), coins: q.coins ?? room.settings.coinsPerCorrect },
      left: pool.length,
    });
  });

  socket.on('player:answer', ({ id, choice } = {}, cb) => {
    if (!room || !player) return ack(cb, { ok: false });
    if (room.phase !== 'styling') return ack(cb, { ok: false });
    const q = room.questions.find((x) => x.id === id);
    const pend = player.pendingQ;
    if (!q || !pend || pend.id !== id) return ack(cb, { ok: false, error: 'That question expired.' });
    const now = Date.now();
    if (now - player.lastAnswerAt < 1200) return ack(cb, { ok: false, error: 'Slow down!' });
    player.lastAnswerAt = now;
    player.pendingQ = null;
    const correct = pend.order[Number(choice)] === q.answer;
    const shownAnswer = pend.order.indexOf(q.answer);
    let earned = 0;
    if (correct) {
      earned = q.coins ?? room.settings.coinsPerCorrect;
      player.coins += earned;
      player.answered.add(q.id);
      player.correct++;
    } else player.wrong++;
    sendPrivate(room, player);
    broadcast(room);
    ack(cb, { ok: true, correct, answer: shownAnswer, earned, ref: q.ref || '', coins: player.coins });
  });

  socket.on('player:ready', (ready) => {
    if (!room || !player) return;
    player.ready = !!ready;
    broadcast(room);
  });

  socket.on('vote', ({ presenterId, stars } = {}, cb) => {
    if (!room || room.phase !== 'runway' || !room.runway) return ack(cb, { ok: false });
    const rw = room.runway;
    const idx = rw.order.indexOf(presenterId);
    if (idx < 0 || idx > rw.index) return ack(cb, { ok: false });
    const voterId = isHost ? 'host' : player?.id;
    if (!voterId || voterId === presenterId) return ack(cb, { ok: false });
    const s = Math.round(num(stars, 1, 5, 0));
    if (!s) return ack(cb, { ok: false });
    (rw.votes[presenterId] ||= {})[voterId] = s;
    ack(cb, { ok: true });
    for (const sid of room.hostSockets) io.to(sid).emit('host:extra', hostExtra(room));
  });

  // ---------------- host controls
  socket.on('host:settings', (patch = {}, cb) => {
    if (!requireHost(cb)) return;
    const s = room.settings;
    if ('styleSeconds' in patch) s.styleSeconds = Math.round(num(patch.styleSeconds, 30, 3600, s.styleSeconds));
    if ('presentSeconds' in patch) s.presentSeconds = Math.round(num(patch.presentSeconds, 12, 60, s.presentSeconds));
    if ('coinsPerCorrect' in patch) s.coinsPerCorrect = Math.round(num(patch.coinsPerCorrect, 1, 500, s.coinsPerCorrect));
    if ('startCoins' in patch) s.startCoins = Math.round(num(patch.startCoins, 0, 5000, s.startCoins));
    if ('priceScale' in patch) s.priceScale = num(patch.priceScale, 0.25, 4, s.priceScale);
    if ('unlockAll' in patch) s.unlockAll = !!patch.unlockAll;
    if ('teamMode' in patch) s.teamMode = patch.teamMode === 'auto' ? 'auto' : 'choose';
    if (patch.voting && typeof patch.voting === 'object') {
      const v = s.voting, pv = patch.voting;
      if ('hostWeight' in pv) v.hostWeight = num(pv.hostWeight, 0, 100, v.hostWeight);
      if ('judgeWeight' in pv) v.judgeWeight = num(pv.judgeWeight, 0, 100, v.judgeWeight);
      if ('studentWeight' in pv) v.studentWeight = num(pv.studentWeight, 0, 20, v.studentWeight);
      if ('normalize' in pv && ['equal', 'sqrt', 'none'].includes(pv.normalize)) v.normalize = pv.normalize;
      if ('teammateVotes' in pv && ['full', 'half', 'none'].includes(pv.teammateVotes)) v.teammateVotes = pv.teammateVotes;
      if ('teamScore' in pv && ['average', 'total'].includes(pv.teamScore)) v.teamScore = pv.teamScore;
      if ('fullArmorBonus' in pv) v.fullArmorBonus = num(pv.fullArmorBonus, 0, 5, v.fullArmorBonus);
      if ('prayerBonus' in pv) v.prayerBonus = num(pv.prayerBonus, 0, 5, v.prayerBonus);
      if (pv.teamMultipliers && typeof pv.teamMultipliers === 'object') {
        for (const [k, val] of Object.entries(pv.teamMultipliers)) {
          if (room.teams.some((t) => t.id === k)) v.teamMultipliers[k] = num(val, 0, 5, 1);
        }
      }
    }
    if (room.phase === 'styling' && 'unlockAll' in patch) for (const p of room.players.values()) sendPrivate(room, p);
    ack(cb, { ok: true });
    broadcast(room);
  });

  socket.on('host:teams', ({ count, names } = {}, cb) => {
    if (!requireHost(cb)) return;
    const n = Math.round(num(count, 1, 6, room.teams.length));
    const old = room.teams.map((t, i) => ({ ...t, name: names?.[i] ? cleanText(names[i], 20) : t.name }));
    room.teams = makeTeams(n, old);
    for (const p of room.players.values()) if (!room.teams.some((t) => t.id === p.team)) p.team = pickTeam(room);
    ack(cb, { ok: true });
    broadcast(room);
  });

  socket.on('host:balanceTeams', (_x, cb) => {
    if (!requireHost(cb)) return;
    const list = shuffle(students(room));
    list.forEach((p, i) => { p.team = room.teams[i % room.teams.length].id; });
    ack(cb, { ok: true });
    broadcast(room);
  });

  socket.on('host:player', ({ id, team, role, kick, coins, clearPrayer } = {}, cb) => {
    if (!requireHost(cb)) return;
    const p = room.players.get(id);
    if (!p) return ack(cb, { ok: false });
    if (kick) {
      room.players.delete(id);
      for (const sid of p.sockets) io.to(sid).emit('kicked');
    } else {
      if (team && room.teams.some((t) => t.id === team)) p.team = team;
      if (role === 'player' || role === 'judge') p.role = role;
      if (coins != null) { p.coins = Math.max(0, p.coins + Math.round(num(coins, -1000, 1000, 0))); sendPrivate(room, p); }
      if (clearPrayer) { p.outfit = { ...p.outfit, prayer: '' }; sendPrivate(room, p, true); }
    }
    ack(cb, { ok: true });
    broadcast(room);
  });

  socket.on('host:giveCoins', ({ amount } = {}, cb) => {
    if (!requireHost(cb)) return;
    const a = Math.round(num(amount, -1000, 1000, 0));
    for (const p of room.players.values()) { p.coins = Math.max(0, p.coins + a); sendPrivate(room, p); }
    ack(cb, { ok: true });
    broadcast(room);
  });

  socket.on('host:questions', ({ csv, questions, mode } = {}, cb) => {
    if (!requireHost(cb)) return;
    let list = [], errors = [], source = room.questionSource;
    if (mode === 'default') { list = DEFAULT_QUESTIONS; source = 'Default Armor of God questions'; }
    else if (typeof csv === 'string') {
      if (csv.length > 500_000) return ack(cb, { ok: false, error: 'File too large.' });
      ({ questions: list, errors } = parseQuestionsCSV(csv));
      source = 'Uploaded CSV';
      if (!list.length) return ack(cb, { ok: false, error: errors[0] || 'No questions found.', errors });
    } else if (Array.isArray(questions)) {
      list = questions.filter((q) => q && typeof q.q === 'string' && Array.isArray(q.choices) && q.choices.length >= 2)
        .slice(0, 500)
        .map((q) => ({
          q: cleanText(q.q, 300), choices: q.choices.slice(0, 6).map((c) => String(c).slice(0, 160)),
          answer: Math.round(num(q.answer, 0, Math.min(5, q.choices.length - 1), 0)),
          coins: q.coins == null || q.coins === '' ? null : Math.round(num(q.coins, 0, 500, 0)),
          ref: String(q.ref || '').slice(0, 200),
        }));
      source = 'Edited in host menu';
    }
    if (mode === 'append') room.questions = room.questions.concat(list.map((q) => ({ ...q, id: uid() })));
    else room.questions = list.map((q) => ({ ...q, id: q.id || uid() }));
    room.questionSource = source;
    ack(cb, { ok: true, count: room.questions.length, errors });
    broadcast(room);
  });

  socket.on('host:start', (_x, cb) => {
    if (!requireHost(cb)) return;
    if (room.phase !== 'lobby') return ack(cb, { ok: false });
    startStyling(room);
    ack(cb, { ok: true });
  });

  socket.on('host:addTime', ({ seconds } = {}, cb) => {
    if (!requireHost(cb)) return;
    if (room.phase !== 'styling') return ack(cb, { ok: false });
    room.styleEndsAt = Math.max(Date.now() + 5000, room.styleEndsAt + Math.round(num(seconds, -600, 600, 60)) * 1000);
    ack(cb, { ok: true });
    broadcast(room, true);
  });

  socket.on('host:endStyling', (_x, cb) => {
    if (!requireHost(cb)) return;
    if (room.phase !== 'styling') return ack(cb, { ok: false });
    startRunway(room);
    ack(cb, { ok: true });
  });

  socket.on('host:runway', ({ action } = {}, cb) => {
    if (!requireHost(cb)) return;
    const rw = room.runway;
    if (room.phase !== 'runway' || !rw) return ack(cb, { ok: false });
    const now = Date.now();
    if (action === 'pause' && !rw.paused) { rw.paused = true; rw.pausedAt = now; }
    else if (action === 'resume' && rw.paused) { rw.startedAt += now - rw.pausedAt; rw.paused = false; }
    else if (action === 'next') {
      if (rw.index + 1 >= rw.order.length) finishRunway(room);
      else { rw.index++; rw.startedAt = now + 1200; rw.paused = false; }
    } else if (action === 'replay') { rw.startedAt = now + 800; rw.paused = false; }
    else if (action === 'finish') finishRunway(room);
    ack(cb, { ok: true });
    broadcast(room, true);
  });

  socket.on('host:again', (_x, cb) => {
    if (!requireHost(cb)) return;
    room.phase = 'lobby';
    room.runway = null;
    room.results = null;
    room.styleEndsAt = 0;
    for (const p of room.players.values()) { p.ready = false; }
    ack(cb, { ok: true });
    broadcast(room, true);
  });

  socket.on('disconnect', () => {
    if (room) {
      room.hostSockets.delete(socket.id);
      if (player) player.sockets.delete(socket.id);
      broadcast(room);
    }
  });
});

server.listen(PORT, () => console.log(`Take Your Stand running on http://localhost:${PORT}`));
