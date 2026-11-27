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

// Star points. Every vote adds stars × the voter's weight, so 5★ from a team of 5 adds 25 points
// while 5★ from a team of 1 adds only 5: a heavier vote pushes the score further ("overshoot"),
// not just nudges an average.
// Teams can't vote for themselves, so each team's points are scaled by
// (all voting power ÷ voting power that could vote for it). That way every team can reach the
// same maximum, and a big team isn't penalised for its own missing vote.
// Bonuses count as extra stars from every voter: bonus stars × all voting power.
// votes: {voterId: stars}; voters: map id -> voter (with isHost / role / members)
export function scoreEntry(entry, votes, voters, tw, voting) {
  const v = { ...DEFAULT_VOTING, ...voting };
  let sw = 0, s = 0, count = 0;
  for (const [vid, raw] of Object.entries(votes || {})) {
    const voter = voters[vid];
    const stars = Number(raw);
    if (!voter || !(stars >= 1 && stars <= 5)) continue;
    const w = voterWeight(voter, entry, tw, v);
    if (w <= 0) continue;
    sw += w; s += w * stars; count++;
  }
  const avg = sw ? s / sw : 0;
  const pool = tw.grand || 0;
  const own = tw.rows.find((r) => r.team.id === entry.id)?.weight || 0;
  const eligible = pool - own;
  const fair = eligible > 0 ? pool / eligible : 1;
  const points = s * fair;
  const full = armorCount(entry.outfit) === ARMOR_SLOTS.length;
  const bonusStars = (full ? Number(v.fullArmorBonus) || 0 : 0) + (entry.outfit?.prayer?.trim() ? Number(v.prayerBonus) || 0 : 0);
  const bonus = bonusStars * pool;
  const max = (5 + (Number(v.fullArmorBonus) || 0) + (Number(v.prayerBonus) || 0)) * pool;
  return { stars: avg, points, bonus, bonusStars, total: points + bonus, max, votes: count, weight: sw, fullArmor: full };
}

// How many points one vote adds (shown to the voter right after they tap the stars).
export function votePoints(stars, voter, presenter, tw, voting) {
  return stars * voterWeight(voter, presenter, tw, voting);
}

export const fmtPoints = (x) => `${Math.round(x)}`;
