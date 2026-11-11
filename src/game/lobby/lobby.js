// Custom-game lobbies (game.lobby): host one from any rules, list and join them (tap, code or share link), ready
// up, pick a ride, chat, start, play by the lobby's rules, shared results, back to the lobby, rejoin after a drop.
// Runs on the room server's existing messages only (lobby/wire.js, docs/notes-lobbies.md).
import * as LS from "@/game/lobby/lobbyState";
import { validateRules } from "@/game/rules/gameRules";
import { createTransport } from "@/game/lobby/transport";
import { createHostSide, rideOut } from "@/game/lobby/host";
import { createMatch } from "@/game/lobby/match";
import { unpackSnapshot, unpackBeacon, packBeacon } from "@/game/lobby/packing";
import { reportFrom } from "@/game/lobby/results";
import { resolveTarget, waitForJoin } from "@/game/lobby/join";
import { ensureOnline, driverName, shardNow } from "@/game/lobby/online";
import { rememberLobby, lobbyLink } from "@/game/lobby/session";
import { checkRide } from "@/game/lobby/rideRules";

const LIST_TTL = 16000, OFFLINE = "Couldn't reach the Saltreach server";

export function createLobby(game) {
  const st = { role: null, lobby: null, code: "", chat: [], list: new Map(), screen: null, error: null, busy: null, pending: null, playedRound: 0, finished: false, lastSnap: 0, everPlayed: false };
  const subs = new Set();
  const changed = () => {
    if (st.role === "host" && st.lobby && st.lobby.phase === "results") st.screen = "results"; // the board closed
    for (const fn of subs) fn();
  };
  const T = createTransport({ onMessage, onWorld });
  const me = () => T.me();
  const match = createMatch(game);
  const H = createHostSide({ T, get: () => st, changed, myName: driverName });
  const fail = (reason) => { st.error = reason; st.busy = null; changed(); return { ok: false, reason }; };
  const mine = () => (st.lobby ? LS.findPlayer(st.lobby, me()) : null);

  function addChat(id, name, text) {
    const t = String(text || "").slice(0, LS.LOBBY.chatLen);
    if (!t) return;
    const p = st.lobby && LS.findPlayer(st.lobby, id);
    st.chat.push({ id, name: id === me() ? "You" : (p && p.name) || name || "Driver", text: t, at: Date.now() });
    if (st.chat.length > LS.LOBBY.chatLines) st.chat.shift();
    changed();
  }

  // This browser's match result: to the host (or into the board when hosting); the results screen opens.
  function finishMine(rep) {
    if (st.finished || !st.lobby) return;
    st.finished = true; st.screen = "results";
    if (st.role === "host") H.report(rep); else T.send("f", st.lobby.id, rep, "report");
    changed();
  }

  // Follow the lobby's phase: start our match for a new round, stop it back in the lobby, show the board.
  function applyPhase() {
    const l = st.lobby;
    if (l.phase === "match") {
      if (l.round > st.playedRound) { st.playedRound = l.round; st.finished = false; st.everPlayed = true; match.start(l, me()); st.screen = null; }
      else match.sync(l, me());
      if (l.ending && !st.finished) finishMine(reportFrom(null, game));
    } else if (l.phase === "lobby") {
      if (match.active()) match.stop();
      st.finished = false; st.screen = "room";
    } else if (l.phase === "results") st.screen = "results";
  }

  function promote(l) {
    st.role = "host";
    st.lobby = { ...l, code: st.code, created: Date.now() };
    H.snapshot(true); H.beacon();
    game.emit({ type: "minor", text: "YOU NOW HOST THE LOBBY" });
  }

  function onSnapshot(m) {
    const s = unpackSnapshot(m.data);
    if (!s || m.from !== s.hostId) return; // only the lobby's own host speaks for it
    const pend = st.pending && st.pending.lid === s.id;
    if (!pend && !(st.lobby && st.lobby.id === s.id)) return;
    if (st.role === "host") return;
    const inIt = s.players.some((p) => p.id === me() && !p.dropped);
    if (!inIt) { if (!pend) { api.leave(true); fail("You are no longer in that lobby"); } return; }
    st.lobby = s; st.lastSnap = Date.now(); st.role = "guest";
    if (pend) { st.pending.done({ ok: true }); st.screen = "room"; }
    if (s.hostId === me()) return promote(s);
    applyPhase();
    changed();
  }

  function onMessage(m) {
    switch (m.type) {
      case "b": { const b = unpackBeacon(m.lid, m.data, m.from); if (b) { st.list.set(b.id, b); changed(); } return; }
      case "c": if (st.lobby && m.lid === st.lobby.id) addChat(m.from, m.name, m.data && m.data.x); return;
      case "s": return onSnapshot(m);
      case "no": {
        if (!m.data || m.data.to !== me()) return;
        if (st.pending && st.pending.lid === m.lid) st.pending.done({ ok: false, reason: String(m.data.why || "Refused") });
        else { st.error = String(m.data.why || "Refused"); changed(); }
        return;
      }
      default: if (st.role === "host") H.onGuest(m);
    }
  }

  function onWorld(m) {
    const l = st.lobby;
    if (!l) return;
    if (m.t === "leave" && LS.findPlayer(l, m.id)) {
      if (st.role === "host") { LS.leave(l, m.id, true); H.snapshot(); return; }
      if (m.id === l.hostId) { LS.leave(l, m.id, true); if (l.hostId === me()) promote(l); else changed(); }
    } else if (m.t === "welcome") { // reconnected: take our seat back
      if (st.role === "host") H.snapshot(true);
      else T.send("j", l.id, { c: st.code, n: driverName(), rd: rideOut(mine() && mine().ride) });
    }
  }

  const emit0 = game.emit; // a lobby match's end goes to the shared board, not the single-player results
  game.emit = (e) => {
    if (e && e.type === "arenaResults" && match.active() && st.lobby) { st.lastArena = e.data; finishMine(reportFrom(e.data, game)); return; }
    emit0(e);
  };

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of st.list) if (now - b.seen > LIST_TTL) { st.list.delete(k); changed(); }
    if (st.role === "host") H.tick(1);
    else if (st.role === "guest" && now - st.lastSnap > 30000) { st.lastSnap = now - 20000; T.send("rq", st.lobby.id, {}); }
  }, 1000);

  const api = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    match,
    async browse() {
      Object.assign(st, { screen: st.lobby ? st.screen : "browse", error: null, busy: "Connecting..." }); changed();
      if (!(await ensureOnline(game))) return fail(OFFLINE);
      T.ensure(); st.busy = null; changed();
      return { ok: true };
    },
    // Quick play: connect and start hearing lobby beacons, with no lobby screen of its own (lobby/quick.js).
    async listen() {
      if (!(await ensureOnline(game))) return { ok: false, reason: OFFLINE };
      T.ensure();
      return { ok: true };
    },
    openHostForm(rules) { st.draft = validateRules(rules); st.screen = "hostForm"; st.error = null; changed(); },
    async host(rules, opts = {}) {
      if (st.lobby) api.leave(true);
      st.busy = "Connecting..."; st.error = null; changed();
      if (!(await ensureOnline(game))) return fail(OFFLINE);
      T.ensure();
      const l = LS.makeLobby({ host: { id: me(), name: driverName() }, name: opts.name, max: opts.max, code: opts.code, rules: validateRules(rules) });
      Object.assign(st, { role: "host", lobby: l, code: l.code, chat: [], playedRound: 0, finished: false, busy: null, screen: "room" });
      rememberLobby({ id: l.id, shard: shardNow(), code: l.code });
      H.snapshot(true); H.beacon(); changed();
      return { ok: true, id: l.id, code: l.code };
    },
    list() {
      const out = [...st.list.values()];
      if (st.role === "host") out.unshift({ id: st.lobby.id, ...packBeaconView(), seen: Date.now(), hostRtt: T.rtt() });
      return out.map((b) => ({ ...b, ping: Math.round((T.rtt() + (b.hostRtt || 0)) / 2) })).sort((a, b) => (a.phase === "lobby" ? 0 : 1) - (b.phase === "lobby" ? 0 : 1) || b.players - a.players);
    },
    async join(q, code = "", shard = null) {
      st.error = null; st.busy = "Joining..."; changed();
      if (!(await ensureOnline(game, shard))) return fail(OFFLINE);
      T.ensure();
      const want = String(q || "").trim().toUpperCase();
      if (st.lobby && st.lobby.id === want) { st.busy = null; changed(); return { ok: true, id: want }; }
      if (st.lobby) api.leave(true);
      const t = await resolveTarget(st.list, q, code);
      if (!t) return fail("No lobby with that name or code in this room");
      st.code = t.code;
      const r = await waitForJoin(st, t.lid, () => T.send("j", t.lid, { c: t.code, n: driverName(), rd: null }));
      if (!r.ok) return fail(r.reason);
      st.busy = null; st.error = null;
      rememberLobby({ id: t.lid, shard: shardNow(), code: t.code });
      changed();
      return { ok: true, id: t.lid };
    },
    ready(on = true) {
      const l = st.lobby;
      if (!l) return { ok: false, reason: "Not in a lobby" };
      const r = LS.setReady(l, me(), on);
      if (r.ok && st.role === "host") H.snapshot(); else if (r.ok) T.send("r", l.id, { on: !!on }, "ready");
      changed();
      return r;
    },
    ride(ride) {
      const l = st.lobby;
      if (!l) return { ok: false, reason: "Not in a lobby" };
      const bad = checkRide(l.rules, ride);
      if (bad) return fail(bad);
      const r = LS.setRide(l, me(), ride);
      if (r.ok && st.role === "host") H.snapshot(); else if (r.ok) T.send("d", l.id, rideOut(ride), "ride");
      st.error = null; changed();
      return r;
    },
    chat(text) {
      // eslint-disable-next-line no-control-regex -- strips control characters from chat
      const t = String(text || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, LS.LOBBY.chatLen);
      if (!t || !st.lobby) return false;
      addChat(me(), "You", t);
      return T.send("c", st.lobby.id, { x: t });
    },
    setRules(rules) {
      const l = st.lobby;
      if (!l || st.role !== "host") return { ok: false, reason: "Only the host changes the rules" };
      const r = LS.setRules(l, me(), validateRules(rules));
      if (r.ok) { H.recheckRides(); H.snapshot(); H.beacon(); }
      changed();
      return r;
    },
    setMeta(meta) { const l = st.lobby; const r = l && st.role === "host" ? LS.setMeta(l, me(), meta) : { ok: false }; if (r.ok) { if (meta.code !== undefined) st.code = l.code; H.snapshot(); } changed(); return r; },
    start() {
      const l = st.lobby;
      if (!l || st.role !== "host") return { ok: false, reason: "Only the host can start" };
      const r = H.start();
      if (!r.ok) return fail(r.reason);
      st.playedRound = l.round; st.finished = false; st.everPlayed = true; st.error = null; st.screen = null;
      match.start(l, me());
      changed();
      return r;
    },
    // Host: end the round now (open-world lobbies have no clock); everyone reports what they have.
    endMatch() {
      const l = st.lobby;
      if (!l || st.role !== "host" || l.phase !== "match") return { ok: false };
      l.ending = true; l.rev++;
      H.snapshot(true);
      finishMine(reportFrom(null, game)); // no-op when the host's own match already finished
      return { ok: true };
    },
    back() {
      const l = st.lobby;
      if (!l || st.role !== "host") return { ok: false, reason: "Only the host returns the group" };
      const r = LS.backToLobby(l, me());
      if (!r.ok) return r;
      l.ending = false;
      match.stop();
      st.finished = false; st.screen = "room";
      H.snapshot(true); changed();
      return r;
    },
    // quiet: switching lobbies (no screen change).
    leave(quiet = false) {
      const l = st.lobby;
      if (l) {
        if (st.role === "host") { LS.leave(l, me()); if (LS.present(l).length) H.snapshot(true); }
        else T.send("q", l.id, {});
      }
      if (match.active() || (st.everPlayed && !quiet)) match.leave();
      const back = st.everPlayed ? "playing" : "title";
      Object.assign(st, { role: null, lobby: null, code: "", chat: [], pending: null, playedRound: 0, finished: false, lastArena: null, everPlayed: false, screen: quiet ? st.screen : null, leftTo: back });
      rememberLobby(null);
      changed();
      return { ok: true, to: back };
    },
    closeScreen() { if (!st.lobby) { st.screen = null; st.leftTo = "title"; st.error = null; changed(); } },
    link: () => (st.lobby ? lobbyLink({ id: st.lobby.id, shard: shardNow(), code: st.code }) : null),
    state() { return snapshotView(); },
    dispose() { clearInterval(timer); H.dispose(); T.dispose(); },
  };

  function packBeaconView() {
    const b = packBeacon(st.lobby, { hostName: driverName(), rtt: T.rtt(), shard: shardNow() });
    return { name: b.n, mode: b.mo, map: b.mp, players: b.pl, max: b.mx, locked: !!b.k, phase: b.ph, host: b.h, hostId: me(), codeHash: b.c, shard: b.s, mine: true };
  }

  function snapshotView() {
    const l = st.lobby, id = me();
    return {
      role: st.role, me: id, screen: st.screen, error: st.error, busy: st.busy, finished: st.finished, leftTo: st.leftTo || null,
      online: T.online(), shard: shardNow(), draft: st.draft || null, list: api.list(), chat: st.chat.slice(-12),
      lobby: l ? { id: l.id, name: l.name, code: st.role === "host" ? l.code : st.code, locked: !!(l.code || l.locked), max: l.max, phase: l.phase, round: l.round, rev: l.rev, hostId: l.hostId, rules: l.rules, players: l.players.map((p) => ({ ...p })), results: l.results, ending: !!l.ending } : null,
      canStart: l && st.role === "host" ? LS.startProblem(l, id) : "Only the host can start",
      link: api.link(),
    };
  }

  game.lobby = api;
  return api;
}