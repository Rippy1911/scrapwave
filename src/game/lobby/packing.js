// Compact forms of what the host broadcasts: the lobby snapshot (players, rules, phase, results) and the list
// beacon. Players travel in join order, so every client agrees on who takes over when the host drops.
import { packRules, unpackRules, describeRules, codeHash } from "@/game/lobby/describe";
import { present } from "@/game/lobby/lobbyState";

const RK = { free: "f", garage: "g" }, KR = { f: "free", g: "garage" };

export function packSnapshot(l) {
  const ps = [...l.players].sort((a, b) => a.joined - b.joined);
  return {
    i: l.id, n: l.name, h: l.hostId, m: l.max, k: l.code ? 1 : 0, r: l.rev, ph: l.phase, rd: l.round, sd: l.seed,
    en: l.ending ? 1 : 0, ru: packRules(l.rules),
    p: ps.map((p) => [p.id, p.name, p.ready ? 1 : 0, p.dropped ? 1 : 0, p.ride ? RK[p.ride.kind] : "", p.ride ? p.ride.ch : "", p.ride ? p.ride.tier : 0]),
    x: l.results ? l.results.map((r) => [r.id, r.name, r.won ? 1 : 0, r.time, r.wrecks, r.kills, r.cps, r.payout, r.done ? 1 : 0]) : null,
  };
}

export function unpackSnapshot(s) {
  if (!s || typeof s !== "object" || !s.i || !Array.isArray(s.p)) return null;
  const rules = unpackRules(s.ru);
  if (!rules) return null;
  return {
    id: s.i, name: String(s.n || ""), hostId: s.h, max: s.m | 0, locked: !!s.k, code: "", rev: s.r | 0, phase: s.ph || "lobby",
    round: s.rd | 0, seed: s.sd | 0, ending: !!s.en, rules, chat: [],
    players: s.p.map((a, i) => ({ id: a[0], name: String(a[1] || "Driver"), ready: !!a[2], dropped: !!a[3], joined: i, droppedAt: 0, ride: a[4] ? { kind: KR[a[4]], ch: a[5], tier: a[6] | 0 } : null })),
    results: Array.isArray(s.x) ? s.x.map((a) => ({ id: a[0], name: a[1], won: !!a[2], time: a[3], wrecks: a[4], kills: a[5], cps: a[6], payout: a[7], done: !!a[8] })) : null,
  };
}

// The lobby list entry the host repeats every few seconds.
export function packBeacon(l, { hostName, rtt, shard }) {
  const d = describeRules(l.rules);
  return { n: l.name, mo: d.mode, mp: d.map, pl: present(l).length, mx: l.max, k: l.code ? 1 : 0, ph: l.phase, h: hostName, rt: Math.round(rtt || 0), c: codeHash(l.code), s: shard || "" };
}

export function unpackBeacon(lid, b, from) {
  if (!b || typeof b !== "object") return null;
  return { id: lid, name: String(b.n || lid), mode: String(b.mo || "?"), map: String(b.mp || ""), players: b.pl | 0, max: b.mx | 0, locked: !!b.k, phase: b.ph || "lobby", host: String(b.h || ""), hostId: from, hostRtt: b.rt | 0, codeHash: b.c || "", shard: b.s || "", seen: Date.now() };
}