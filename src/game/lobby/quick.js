// Quick play (game.quick): the title's main button. It joins the best open public lobby for the default mode, or
// hosts one and fills it with AI bots after 10 s. Built only on game.lobby (no new backend, docs/notes-quick-play.md).
// It never starts a local match by itself: offline, or a lobby service that fails, ends in a plain message and the
// player chooses "Play offline" (GameRoot.quickOffline) or tries again.
import { net } from "@/game/net/net";
import { findPreset } from "@/game/rules/state";
import { describeRules } from "@/game/lobby/describe";
import { driverName } from "@/game/lobby/online";
import { garageRide, checkRide } from "@/game/lobby/rideRules";

// preset: the default mode (a built-in rules preset). scanMs: how long to listen for lobbies (hosts repeat their
// beacon every 5 s). waitMs: how long a lobby we created waits for drivers before the bots fill it.
export const QUICK = { preset: "Derby", name: "Quick match", seats: 6, scanMs: 6000, waitMs: 10000, guestMs: 40000, startMs: 20000, freshMs: 9000, tickMs: 300 };

const IDLE = { active: false, phase: "idle", role: null, players: 0, left: 0, lobbyName: "", note: "", error: "", offline: false };
export const isQuickLobby = (b) => String(b.name || "").startsWith(QUICK.name);

// Quick lobbies first (they start on their own), then the fuller one, then the lower ping.
const rank = (a, b) => (isQuickLobby(b) - isQuickLobby(a)) || (b.players - a.players) || ((a.ping || 0) - (b.ping || 0)) || (a.id < b.id ? -1 : 1);

// The best open public lobby for the mode `want` ({ mode, map } from describeRules), or null. list: lobby.list().
export function pickLobby(list, want, now = Date.now(), skip = new Set()) {
  const ok = list.filter((b) => !b.mine && !skip.has(b.id) && b.phase === "lobby" && !b.locked && b.players < b.max
    && b.mode === want.mode && b.map === want.map && now - b.seen <= QUICK.freshMs);
  return ok.sort(rank)[0] || null;
}

// A lobby we are alone in gives way to a Quick lobby with drivers in it (or, at a tie, the smaller id), so two
// drivers who press Quick play together end up in one lobby.
export function betterLobby(list, ourId, want, now, skip) {
  const o = pickLobby(list, want, now, skip);
  return o && isQuickLobby(o) && (o.players > 1 || o.id < ourId) ? o : null;
}

// deps (for the self-check): lobby (the game.lobby API), now, disconnect, cfg overrides.
export function createQuick(game, deps = {}) {
  const cfg = { ...QUICK, ...(deps.cfg || {}) };
  const L = deps.lobby || game.lobby;
  const clock = deps.now || Date.now;
  const leaveNet = deps.disconnect || (() => { game.netSync.stop(); net.goOffline(); });
  const subs = new Set();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rulesNow = () => findPreset(cfg.preset);
  let S = { ...IDLE }, run = 0;
  const set = (p) => { S = { ...S, ...p }; for (const fn of subs) fn(); };

  const fail = (me, offline, error) => {
    if (me !== run) return;
    if (L.state().lobby) L.leave(); // settles back to the title; the message stays up
    set({ active: true, phase: "failed", offline, error, note: "" });
  };
  const done = (me) => { if (me === run) set({ active: false, phase: "started", note: "" }); };

  // Your garage car when the rules allow it, then ready.
  function prep() {
    const l = L.state().lobby;
    if (!l) return;
    const ride = garageRide(game.save, l.rules);
    if (!checkRide(l.rules, ride)) L.ride(ride);
    L.ready(true);
  }

  // true = joined, false = refused or no answer, null = cancelled meanwhile (we already left again).
  async function joinIt(me, pick, bad) {
    set({ phase: "joining", role: "guest", lobbyName: pick.name, players: pick.players });
    const r = await L.join(pick.id, "");
    if (me !== run) { if (r.ok) { L.leave(); leaveNet(); } return null; }
    if (!r.ok) { bad.add(pick.id); return false; }
    return true;
  }

  async function guestWait(me, bad, want) {
    prep();
    const t0 = clock();
    let notReady = 0;
    set({ phase: "waiting", role: "guest", left: 0 });
    for (;;) {
      await sleep(cfg.tickMs);
      if (me !== run) return undefined;
      const s = L.state(), l = s.lobby;
      if (!l) return fail(me, false, "The lobby closed before the match started.");
      if (l.phase !== "lobby") return done(me);
      if (s.role === "host") return hostWait(me, bad, want); // the host dropped and we took over
      const mine = l.players.find((p) => p.id === s.me);
      notReady = mine && mine.ready ? 0 : notReady + cfg.tickMs;
      if (notReady > 2000) { L.ready(true); notReady = 0; } // a rules change clears the ready flags
      set({ players: l.players.filter((p) => !p.dropped).length, lobbyName: l.name });
      if (clock() - t0 > cfg.guestMs) return fail(me, false, "That lobby never started the match.");
    }
  }

  async function hostIt(me, bad, want) {
    set({ phase: "hosting", role: "host", players: 1, left: Math.ceil(cfg.waitMs / 1000), lobbyName: "" });
    const h = await L.host(rulesNow(), { name: `${cfg.name} · ${driverName()}`, max: cfg.seats });
    if (me !== run) { if (h.ok) { L.leave(); leaveNet(); } return undefined; }
    if (!h.ok) return fail(me, false, h.reason || "The lobby could not be created.");
    prep();
    return hostWait(me, bad, want);
  }

  // Our lobby waits waitMs for drivers (less when it fills up), then starts: the lobby's rules carry the AI bots.
  async function hostWait(me, bad, want) {
    const t0 = clock();
    for (;;) {
      await sleep(cfg.tickMs);
      if (me !== run) return undefined;
      const l = L.state().lobby;
      if (!l) return fail(me, false, "The lobby closed before the match started.");
      const humans = l.players.filter((p) => !p.dropped).length, left = cfg.waitMs - (clock() - t0);
      set({ role: "host", phase: "hosting", players: humans, left: Math.max(0, Math.ceil(left / 1000)), lobbyName: l.name });
      if (humans === 1 && left > 1500) {
        const o = betterLobby(L.list(), l.id, want, clock(), bad);
        if (o) {
          const j = await joinIt(me, o, bad);
          if (j === null) return undefined;
          return j ? guestWait(me, bad, want) : hostIt(me, bad, want);
        }
      }
      if (left <= 0 || humans >= l.max) break;
    }
    set({ phase: "starting", note: "" });
    const t1 = clock();
    for (;;) {
      const r = L.start();
      if (r.ok) return done(me);
      if (clock() - t1 > cfg.startMs) return fail(me, false, r.reason || "The match could not start.");
      set({ note: r.reason || "" }); // someone in the lobby is not ready yet
      await sleep(1000);
      if (me !== run) return undefined;
    }
  }

  async function start() {
    if (S.active && S.phase !== "failed") return;
    const me = ++run, bad = new Set(), want = describeRules(rulesNow());
    S = { ...IDLE, active: true, phase: "connecting" };
    set({});
    const c = await L.listen();
    if (me !== run) { if (c.ok && !S.active) leaveNet(); return; }
    if (!c.ok) {
      const gone = typeof navigator !== "undefined" && navigator.onLine === false;
      return fail(me, true, gone ? "This device is offline." : c.reason || "The lobby server did not answer.");
    }
    set({ phase: "searching" });
    const t0 = clock();
    for (;;) {
      const pick = pickLobby(L.list(), want, clock(), bad);
      if (pick) {
        const j = await joinIt(me, pick, bad);
        if (j === null) return;
        if (j) return guestWait(me, bad, want);
        continue; // refused or no answer: the next best one, else our own
      }
      if (clock() - t0 >= cfg.scanMs) break;
      await sleep(cfg.tickMs);
      if (me !== run) return;
    }
    await hostIt(me, bad, want);
  }

  const Q = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    state: () => ({ ...S }),
    start,
    // Cancel / Back / Play offline: leave whatever we joined and go back offline. A join still in flight settles
    // in the background and leaves again (joinIt).
    cancel() {
      const was = S;
      run++;
      S = { ...IDLE };
      for (const fn of subs) fn();
      if (!was.active || was.phase === "joining") return;
      if (L.state().lobby) L.leave();
      leaveNet();
    },
  };
  game.quick = game.quick || Q;
  return Q;
}
