// Voting weights & scoring (shared by server + host UI preview).
// Each joined device is a team. The host sets how many players are in each team; a team's
// stars count once per player, so bigger teams carry more weight.
import { armorCount, ARMOR_SLOTS } from './catalog.js';

export const DEFAULT_VOTING = {
  hostWeight: 10,          // the teacher running the game
  hostAlwaysHighest: true, // keep the teacher's vote above any single team's
  judgeWeight: 4,          // helper teachers promoted in the lobby
  studentWeight: 1,        // weight of each player in a team
  fullArmorBonus: 0.5,     // stars added when all 6 armor pieces are worn
  prayerBonus: 0.25,       // stars added when a prayer was written
};

const membersOf = (p) => Math.max(1, Math.round(Number(p?.members) || 1));

// Voting power of every voter group for the live table and for scoring.
export function teamWeights(players, voting) {
  const v = { ...DEFAULT_VOTING, ...voting };
  const teams = players.filter((p) => p.role !== 'judge');
  const rows = teams.map((p) => ({ team: p, members: membersOf(p), weight: v.studentWeight * membersOf(p) }));
  const maxTeam = rows.reduce((m, r) => Math.max(m, r.weight), 0);
  const host = v.hostAlwaysHighest ? Math.max(v.hostWeight, maxTeam + 1) : v.hostWeight;
  const judges = players.filter((p) => p.role === 'judge').length;
  const grand = rows.reduce((a, r) => a + r.weight, 0) + host + judges * v.judgeWeight;
  return { rows, maxTeam, host, judges, grand };
}

export function voterWeight(voter, presenter, tw, voting) {
  const v = { ...DEFAULT_VOTING, ...voting };
  if (voter.isHost) return tw.host;
  if (voter.role === 'judge') return v.judgeWeight;
  if (voter.id === presenter.id) return 0;
  return v.studentWeight * membersOf(voter);
}

// votes: {voterId: stars}; voters: map id -> voter (with isHost / role / members)
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
