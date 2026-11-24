// Voting weights & scoring (shared by server + host UI preview).
import { armorCount, ARMOR_SLOTS } from './catalog.js';

export const DEFAULT_VOTING = {
  hostWeight: 5,          // the teacher running the game
  judgeWeight: 3,         // helper teachers promoted in the lobby
  studentWeight: 1,       // base weight of each student vote
  normalize: 'equal',     // 'equal' | 'sqrt' | 'none'  -> how team size adjusts student weight
  teammateVotes: 'half',  // 'full' | 'half' | 'none'  -> votes for your own teammates
  teamMultipliers: {},    // teamId -> extra multiplier (granular per-team control)
  fullArmorBonus: 0.5,    // stars added when all 6 armor pieces are worn
  prayerBonus: 0.25,      // stars added when a prayer was written
  teamScore: 'average',   // 'average' | 'total'
};

// players: [{id, team, role}] (role 'player' = student, 'judge' = helper teacher)
export function teamWeights(players, teams, voting) {
  const v = { ...DEFAULT_VOTING, ...voting };
  const sizes = {};
  for (const t of teams) sizes[t.id] = 0;
  for (const p of players) if (p.role === 'player' && sizes[p.team] != null) sizes[p.team]++;
  const active = Object.values(sizes).filter((n) => n > 0);
  const avg = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 1;
  const rows = teams.map((t) => {
    const n = sizes[t.id] || 0;
    let f = 1;
    if (n > 0 && v.normalize === 'equal') f = avg / n;
    else if (n > 0 && v.normalize === 'sqrt') f = Math.sqrt(avg / n);
    const mult = Number(v.teamMultipliers?.[t.id] ?? 1);
    const each = v.studentWeight * f * mult;
    return { team: t, size: n, factor: f, mult, each, total: each * n };
  });
  const judges = players.filter((p) => p.role === 'judge').length;
  const studentTotal = rows.reduce((a, r) => a + r.total, 0);
  const grand = studentTotal + v.hostWeight + judges * v.judgeWeight;
  return { rows, judges, studentTotal, grand, hostShare: grand ? v.hostWeight / grand : 0, judgeShare: grand ? (judges * v.judgeWeight) / grand : 0 };
}

export function voterWeight(voter, presenter, tw, voting) {
  const v = { ...DEFAULT_VOTING, ...voting };
  if (voter.isHost) return v.hostWeight;
  if (voter.role === 'judge') return v.judgeWeight;
  if (voter.id === presenter.id) return 0;
  const row = tw.rows.find((r) => r.team.id === voter.team);
  let w = row ? row.each : v.studentWeight;
  if (voter.team === presenter.team) {
    if (v.teammateVotes === 'none') return 0;
    if (v.teammateVotes === 'half') w *= 0.5;
  }
  return w;
}

// votes: {voterId: stars}; voters: map id -> voter (with isHost / role / team)
export function scoreEntry(entry, votes, voters, tw, voting) {
  const v = { ...DEFAULT_VOTING, ...voting };
  let sw = 0, s = 0, count = 0;
  for (const [vid, stars] of Object.entries(votes || {})) {
    const voter = voters[vid];
    if (!voter) continue;
    const w = voterWeight(voter, entry, tw, v);
    if (w <= 0) continue;
    sw += w; s += w * stars; count++;
  }
  const avg = sw ? s / sw : 0;
  const full = armorCount(entry.outfit) === ARMOR_SLOTS.length;
  const bonus = (full ? Number(v.fullArmorBonus) || 0 : 0) + (entry.outfit?.prayer?.trim() ? Number(v.prayerBonus) || 0 : 0);
  return { stars: avg, bonus, total: avg + bonus, votes: count, fullArmor: full };
}
