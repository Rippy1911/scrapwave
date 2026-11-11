// Lobby model: pure data and rules, no network and no game. The host's copy is the truth; guests mirror the
// snapshots it broadcasts. Every mutator edits the lobby in place and returns { ok, reason? }.
// minPlayers: to start (a host alone may start); a lobby always offers at least 2 seats.
export const LOBBY = { maxPlayers: 8, minPlayers: 1, minSeats: 2, chatLines: 30, chatLen: 100, nameLen: 28, codeLen: 6, dropGrace: 180 };

// eslint-disable-next-line no-control-regex -- strips control characters from names and codes
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const clampMax = (n) => Math.max(LOBBY.minSeats, Math.min(LOBBY.maxPlayers, Math.round(+n || 6)));
const fail = (reason) => ({ ok: false, reason });
const OK = { ok: true };

export const normCode = (c) => clean(c, 16).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LOBBY.codeLen);
export const newLobbyId = () => "L" + Math.random().toString(36).slice(2, 8).toUpperCase();
export function randomCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

const player = (who, now) => ({ id: who.id, name: clean(who.name, 20) || "Driver", ready: false, ride: who.ride || null, joined: now, dropped: false, droppedAt: 0 });

// host: { id, name, ride? }. rules: a full rules object (gameRules.js shape), copied.
export function makeLobby({ id = newLobbyId(), host, name, max = 6, code = "", rules }) {
  const now = Date.now();
  return {
    id, name: clean(name, LOBBY.nameLen) || `${clean(host.name, 20) || "Driver"}'s game`, code: normCode(code), max: clampMax(max),
    hostId: host.id, rules: clone(rules), rev: 1, phase: "lobby", round: 0, seed: 0,
    players: [{ ...player(host, now), ready: true }], chat: [], results: null, created: now,
  };
}

export const present = (l) => l.players.filter((p) => !p.dropped);
export const findPlayer = (l, id) => l.players.find((p) => p.id === id) || null;
export const isHost = (l, id) => !!l && l.hostId === id;

// Join or rejoin. A dropped player (same id, or same name while dropped) slips back into their seat at any phase;
// new players only join while the lobby is between matches, with the right code and a free seat.
export function join(l, who, code = "") {
  const now = Date.now();
  const back = findPlayer(l, who.id) || l.players.find((p) => p.dropped && p.name === clean(who.name, 20));
  if (back) {
    back.id = who.id; back.dropped = false; back.droppedAt = 0;
    if (who.name) back.name = clean(who.name, 20);
    return { ok: true, rejoin: true };
  }
  if (l.code && normCode(code) !== l.code) return fail("Wrong code");
  if (l.phase !== "lobby") return fail("Match in progress");
  if (present(l).length >= l.max) return fail("Lobby full");
  l.players.push(player(who, now));
  return OK;
}

// drop: lost connection (keeps the seat for dropGrace seconds); otherwise the player left on purpose.
export function leave(l, id, drop = false) {
  const p = findPlayer(l, id);
  if (!p) return fail("Not in lobby");
  if (drop) { p.dropped = true; p.droppedAt = Date.now(); p.ready = false; }
  else l.players.splice(l.players.indexOf(p), 1);
  if (l.hostId === id) migrateHost(l);
  return OK;
}

// The longest-standing present player takes over as host. Returns the new host id (null = lobby empty).
export function migrateHost(l) {
  const next = present(l).sort((a, b) => a.joined - b.joined)[0];
  l.hostId = next ? next.id : null;
  if (next) next.ready = true;
  return l.hostId;
}

export function prune(l, now = Date.now()) {
  const before = l.players.length;
  l.players = l.players.filter((p) => !p.dropped || now - p.droppedAt < LOBBY.dropGrace * 1000);
  return before - l.players.length;
}

export function setReady(l, id, on) {
  const p = findPlayer(l, id);
  if (!p) return fail("Not in lobby");
  if (l.phase !== "lobby") return fail("Match in progress");
  p.ready = id === l.hostId ? true : !!on;
  return OK;
}

// ride: { kind: "free"|"garage", chassis, tier, name }. The caller checks it against the rules (rideRules.js).
export function setRide(l, id, ride) {
  const p = findPlayer(l, id);
  if (!p) return fail("Not in lobby");
  if (l.phase !== "lobby") return fail("Match in progress");
  p.ride = ride ? clone(ride) : null;
  if (id !== l.hostId) p.ready = false; // a new ride needs a fresh ready
  return OK;
}

// Host only, between matches. Every change bumps rev and clears the guests' ready flags.
export function setRules(l, by, rules) {
  if (!isHost(l, by)) return fail("Only the host changes the rules");
  if (l.phase !== "lobby") return fail("Match in progress");
  l.rules = clone(rules);
  l.rev++;
  for (const p of l.players) if (p.id !== l.hostId) p.ready = false;
  return OK;
}

export function setMeta(l, by, { name, max, code } = {}) {
  if (!isHost(l, by)) return fail("Only the host changes the lobby");
  if (name !== undefined) l.name = clean(name, LOBBY.nameLen) || l.name;
  if (max !== undefined) l.max = Math.max(clampMax(max), present(l).length);
  if (code !== undefined) l.code = normCode(code);
  l.rev++;
  return OK;
}

export function addChat(l, id, text) {
  const p = findPlayer(l, id), t = clean(text, LOBBY.chatLen);
  if (!p || !t) return fail("Nothing to send");
  l.chat.push({ from: p.name, id, text: t, at: Date.now() });
  if (l.chat.length > LOBBY.chatLines) l.chat.splice(0, l.chat.length - LOBBY.chatLines);
  return OK;
}

export function startProblem(l, by) {
  if (!isHost(l, by)) return "Only the host can start";
  if (l.phase !== "lobby") return "Match in progress";
  const here = present(l);
  if (here.length < LOBBY.minPlayers) return "Waiting for players";
  const waiting = here.filter((p) => !p.ready);
  if (waiting.length) return `Waiting for ${waiting.map((p) => p.name).join(", ")}`;
  return null;
}

export function startMatch(l, by) {
  const why = startProblem(l, by);
  if (why) return fail(why);
  l.phase = "match"; l.round++; l.seed = (Math.random() * 1e9) | 0; l.results = null; l.startedAt = Date.now();
  return OK;
}

export function finishMatch(l, results) {
  if (l.phase !== "match") return fail("No match running");
  l.phase = "results"; l.results = clone(results);
  return OK;
}

export function backToLobby(l, by) {
  if (!isHost(l, by)) return fail("Only the host returns the group");
  l.phase = "lobby";
  for (const p of l.players) p.ready = p.id === l.hostId;
  return OK;
}

// What the lobby list shows. describe(rules) → { mode, map } (rules/describe lives with the lobby service).
export function summary(l, describe = (r) => ({ mode: r?.mode || "?", map: r?.map || "" })) {
  const d = describe(l.rules) || {};
  const host = findPlayer(l, l.hostId);
  return { id: l.id, name: l.name, mode: d.mode, map: d.map, players: present(l).length, max: l.max, locked: !!l.code, phase: l.phase, host: host ? host.name : "", hostId: l.hostId };
}

// Snapshot the host broadcasts (the code stays with the host: guests only learn whether one exists).
export function snapshot(l) {
  const s = clone(l);
  s.locked = !!l.code;
  delete s.code;
  return s;
}