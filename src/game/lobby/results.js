// The shared results board. Every player's browser plays its match and reports one line; the host collects them,
// ranks them and broadcasts the board. It closes when everyone present has reported, or WAIT_S after the first.
import { present } from "@/game/lobby/lobbyState";

export const WAIT_S = 25;

// What one browser reports at the end of its match (arena results data, or open-world stats).
export function reportFrom(data, game) {
  if (data && data.tally) {
    const t = Object.fromEntries(data.tally);
    return { w: data.won ? 1 : 0, t: data.time | 0, wr: +t["Cars wrecked"] || 0, k: +t["Horde killed"] || 0, cp: parseInt(t.Checkpoints, 10) || 0, p: data.payout | 0 };
  }
  const p = game.player;
  return { w: 0, t: Math.round(game.time - (game.lobbyMatchT0 || 0)), wr: game.lobbyWrecks || 0, k: 0, cp: 0, p: Math.round((p && p.scrap) || 0) };
}

const rank = (a, b) => (b.won - a.won) || (a.won ? a.time - b.time : 0) || (b.wrecks - a.wrecks) || (b.kills - a.kills) || (b.cps - a.cps) || (b.payout - a.payout);

// Host: record one report and return the ranked rows (players still playing are listed as not done).
export function addReport(l, id, r) {
  const p = l.players.find((x) => x.id === id);
  if (!p) return null;
  l.reports = l.reports || {};
  l.reports[id] = { w: !!r.w, t: Math.max(0, r.t | 0), wr: Math.max(0, r.wr | 0), k: Math.max(0, r.k | 0), cp: Math.max(0, r.cp | 0), p: Math.max(0, r.p | 0) };
  if (!l.firstReportAt) l.firstReportAt = Date.now();
  return board(l);
}

export function board(l) {
  const reps = l.reports || {};
  const rows = l.players.filter((p) => reps[p.id] || !p.dropped).map((p) => {
    const r = reps[p.id];
    return r ? { id: p.id, name: p.name, won: r.w, time: r.t, wrecks: r.wr, kills: r.k, cps: r.cp, payout: r.p, done: true }
      : { id: p.id, name: p.name, won: false, time: 0, wrecks: 0, kills: 0, cps: 0, payout: 0, done: false };
  });
  return rows.sort((a, b) => (b.done - a.done) || rank(a, b));
}

export function boardClosed(l, now = Date.now()) {
  const reps = l.reports || {};
  if (present(l).every((p) => reps[p.id])) return true;
  return !!l.firstReportAt && now - l.firstReportAt > WAIT_S * 1000;
}

export const clearReports = (l) => { l.reports = {}; l.firstReportAt = 0; };