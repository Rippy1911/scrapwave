// ?quickcheck=1 (or window.scrapwake.quick.check()): runs the Quick play controller against a scripted stand-in
// for the lobby service, with short timings, and prints pass or fail for join, create, bot fill, cancel and the
// offline fallback to the #quick-check overlay and the console. It touches no network and starts no match. The
// real two-window run is a manual one (docs/notes-quick-play.md).
import { createQuick, pickLobby, betterLobby, QUICK } from "@/game/lobby/quick";
import { describeRules } from "@/game/lobby/describe";
import { findPreset } from "@/game/rules/state";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Short timings; wide margins on purpose: a background tab runs timers about once a second.
const CFG = { scanMs: 150, waitMs: 500, guestMs: 6000, startMs: 3000, tickMs: 20 };

async function until(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(10); }
  return null;
}

// One listed lobby the way lobby.list() reports it.
const beacon = (id, o = {}) => ({ id, name: `Quick match · ${id}`, mode: "Derby", map: "Quarry Bowl", players: 1, max: 6, locked: false, phase: "lobby", ping: 40, seen: Date.now(), mine: false, ...o });

// A stand-in for game.lobby: records every call, answers like the real one.
function fakeLobby(o = {}) {
  const calls = [], st = { role: null, lobby: null };
  const note = (n, a) => calls.push({ n, a, at: Date.now() });
  const mk = (id, name, rules, ids, max = 6) => ({ id, name, phase: "lobby", max, rules, players: ids.map((x) => ({ id: x, name: x, ready: x === "HOST", dropped: false })) });
  const api = {
    calls, st, beacons: o.beacons || [],
    named: (n) => calls.filter((c) => c.n === n),
    async listen() { note("listen"); return o.offline ? { ok: false, reason: "Couldn't reach the Saltreach server" } : { ok: true }; },
    list: () => api.beacons,
    async join(id) {
      note("join", id);
      await sleep(15);
      const b = api.beacons.find((x) => x.id === id);
      if (!b || o.joinFails) return { ok: false, reason: "No answer from that lobby's host" };
      st.role = "guest"; st.lobby = mk(id, b.name, findPreset("Derby"), ["HOST", "ME"]);
      return { ok: true, id };
    },
    async host(rules, opts) {
      note("host", { rules, opts });
      st.role = "host"; st.lobby = mk("LQCHECK1", opts.name, rules, ["ME"], opts.max);
      return { ok: true, id: "LQCHECK1" };
    },
    ride: () => note("ride"),
    ready(on) { note("ready", on); const p = st.lobby && st.lobby.players.find((x) => x.id === "ME"); if (p) p.ready = !!on; return { ok: true }; },
    start() { note("start", st.lobby && st.lobby.players.length); if (st.lobby) st.lobby.phase = "match"; return { ok: true }; },
    leave() { note("leave"); st.lobby = null; st.role = null; return { ok: true }; },
    state: () => ({ me: "ME", role: st.role, online: true, lobby: st.lobby }),
  };
  return api;
}

function rig(game, o = {}, cfg = {}) {
  const L = fakeLobby(o), disc = { n: 0 };
  const Q = createQuick(game, { lobby: L, cfg: { ...CFG, ...cfg }, disconnect: () => { disc.n++; } });
  return { L, Q, disc, phase: () => Q.state().phase };
}

function overlay() {
  let el = document.getElementById("quick-check");
  if (!el) {
    el = document.createElement("pre");
    el.id = "quick-check";
    el.style.cssText = "position:fixed;left:8px;top:8px;z-index:99;max-width:60vw;background:rgba(0,0,0,.85);color:#cfe;font:11px/1.35 monospace;padding:8px;white-space:pre-wrap;pointer-events:none";
    document.body.appendChild(el);
  }
  return el;
}

export async function runQuickCheck(game) {
  const el = overlay(), out = [], results = {};
  const log = (key, ok, text) => { results[key] = !!ok; out.push(`${ok ? "PASS" : "FAIL"} ${key}: ${text}`); el.textContent = `QUICK PLAY CHECK\n${out.join("\n")}`; };
  const localBefore = !!(game.arena && game.arena.active);
  try {
    const want = describeRules(findPreset(QUICK.preset));
    const now = Date.now();

    // pick: only open, public, fresh lobbies for the default mode; Quick lobbies and fuller ones first
    const A = beacon("LAAAAAA", { players: 2 }), B = beacon("LBBBBBB"), C = beacon("LCCCCCC", { name: "Dana's game", players: 4 });
    const noise = [beacon("LDDDDDD", { locked: true }), beacon("LEEEEEE", { mode: "Horde Night" }), beacon("LFFFFFF", { players: 6 }), beacon("LGGGGGG", { seen: now - 60000 }), beacon("LHHHHHH", { phase: "match" }), beacon("LIIIIII", { mine: true })];
    const p1 = pickLobby([B, C, A, ...noise], want, now), p2 = pickLobby([C, ...noise], want, now), p3 = pickLobby(noise, want, now);
    const y1 = betterLobby([B], "LZZZZZZ", want, now, new Set()), y2 = betterLobby([B], "LAAAAAA", want, now, new Set()), y3 = betterLobby([A], "LZZZZZZ", want, now, new Set());
    log("pick", p1 && p1.id === "LAAAAAA" && p2 && p2.id === "LCCCCCC" && !p3 && !!y1 && !y2 && y3 && y3.id === "LAAAAAA",
      `best=${p1 && p1.id} then ${p2 && p2.id}, none for locked/other mode/full/stale/running/own=${!p3}; alone yields to the smaller id ${!!y1}, not to a bigger one ${!y2}, to a fuller one ${!!y3}`);

    // join: the best open public lobby, no lobby of our own, we ready up, the match starting ends Quick play
    {
      const t = rig(game, { beacons: [noise[0], noise[1], B, A, noise[3]] });
      const q = t.Q.start();
      const waiting = !!(await until(() => t.phase() === "waiting"));
      const joined = t.L.named("join").map((c) => c.a), ready = t.L.named("ready").map((c) => c.a);
      t.L.st.lobby.phase = "match"; // the host starts
      const ended = await until(() => !t.Q.state().active);
      await q;
      log("join", joined.length === 1 && joined[0] === "LAAAAAA" && !t.L.named("host").length && ready.includes(true) && waiting && ended && t.phase() === "started",
        `joined ${joined.join(",")}, own lobbies ${t.L.named("host").length}, ready sent ${ready.includes(true)}, waited ${waiting}, ended when the match began ${!!ended}`);
    }

    // a lobby that refuses or never answers is skipped, and Quick play goes on to create its own
    {
      const t = rig(game, { beacons: [A], joinFails: true });
      const t0 = Date.now();
      const q = t.Q.start();
      await until(() => t.L.named("host").length === 1);
      log("join-fallback", t.L.named("join").length === 1 && t.L.named("host").length === 1, `refused lobby tried once (${t.L.named("join").length}), then hosted (${t.L.named("host").length}) after ${Date.now() - t0} ms`);
      t.Q.cancel(); await q;
    }

    // two drivers pressing Quick play together: our lobby (alone) gives way to the one with the smaller id
    {
      const t2 = rig(game, {}, { waitMs: 9000 });
      const q = t2.Q.start();
      await until(() => t2.L.named("host").length === 1);
      t2.L.beacons.push(beacon("L0AAAAA")); // another Quick lobby, smaller id, heard while we wait
      const joined = await until(() => t2.L.named("join").length === 1);
      const guest = await until(() => t2.phase() === "waiting");
      log("yield", joined && guest && t2.L.named("join")[0].a === "L0AAAAA" && !t2.L.named("start").length, `alone in our own lobby, heard L0AAAAA, joined it ${!!joined} and wait there ${!!guest}, never started our own ${!t2.L.named("start").length}`);
      t2.Q.cancel(); await q;
    }

    // create + bot fill: nothing to join -> host a public lobby after the scan, start with the bots after the wait
    {
      const t = rig(game, {});
      const t0 = Date.now();
      const q = t.Q.start();
      const hosted = await until(() => t.L.named("host").length === 1);
      const hAt = hosted && t.L.named("host")[0].at - t0;
      const h = t.L.named("host")[0] && t.L.named("host")[0].a;
      log("create", hosted && !t.L.named("join").length && h.rules.mode === "arena" && !h.rules.code && h.opts.name.startsWith(QUICK.name) && h.opts.max === QUICK.seats && hAt >= CFG.scanMs - 20,
        `hosted ${h ? `"${h.opts.name}" (${h.rules.name}, ${h.opts.max} seats, public)` : "no"} after the ${CFG.scanMs} ms scan (${hAt} ms), joins ${t.L.named("join").length}`);
      const early = t.L.named("start").length;
      await q;
      const s = t.L.named("start")[0], hostAt = t.L.named("host")[0].at;
      log("bot-fill", !early && t.L.named("start").length === 1 && s.at - hostAt >= CFG.waitMs - 30 && h.rules.aiCount >= 1 && t.phase() === "started",
        `not started before the wait (${!early}), started ${s ? s.at - hostAt : "never"} ms after hosting (wait ${CFG.waitMs} ms) with ${h.rules.aiCount} AI bots and ${s && s.a} driver`);
    }

    // cancel: during the scan nothing is created; while hosting the lobby is left and nothing starts
    {
      const t = rig(game, {});
      const q = t.Q.start();
      await until(() => t.phase() === "searching");
      t.Q.cancel(); await q;
      await sleep(CFG.scanMs + 1500);
      const a = !t.L.named("host").length && !t.L.named("join").length && !t.L.named("start").length && !t.Q.state().active && t.disc.n === 1;
      const t2 = rig(game, {});
      const q2 = t2.Q.start();
      await until(() => t2.phase() === "hosting" && t2.L.st.lobby);
      t2.Q.cancel(); await q2;
      await sleep(CFG.waitMs + 1500);
      const b = t2.L.named("leave").length === 1 && !t2.L.named("start").length && !t2.L.st.lobby && !t2.Q.state().active && t2.disc.n === 1;
      log("cancel", a && b, `during the scan: nothing created, joined or started, back offline ${a}; while hosting: lobby left, never started ${b}`);
    }

    // offline: the lobby service cannot be reached -> a plain message and a "Play offline" choice, nothing started
    {
      const t = rig(game, { offline: true });
      await t.Q.start();
      const s = t.Q.state();
      const quiet = t.L.calls.every((c) => c.n === "listen");
      await sleep(CFG.scanMs + CFG.waitMs + 1500);
      const still = t.Q.state().phase === "failed" && t.L.calls.every((c) => c.n === "listen");
      const noLocal = !!(game.arena && game.arena.active) === localBefore;
      log("offline", s.active && s.phase === "failed" && s.offline && /Saltreach|offline/i.test(s.error) && quiet && still && noLocal,
        `message "${s.error}", offered Play offline ${s.phase === "failed" && s.offline}, only the connect was tried ${quiet}, still waiting for the player after ${CFG.scanMs + CFG.waitMs} ms ${still}, no local match started ${noLocal}`);
      t.Q.cancel();
    }
  } catch (e) {
    log("error", false, String((e && e.stack) || e).split("\n").slice(0, 3).join(" | "));
  }
  const pass = ["pick", "join", "join-fallback", "yield", "create", "bot-fill", "cancel", "offline"].every((k) => results[k]);
  out.push(pass ? "QUICKCHECK PASS" : "QUICKCHECK FAIL");
  el.textContent = `QUICK PLAY CHECK\n${out.join("\n")}`;
  console.log(out.join("\n"));
  return { pass, results, lines: out };
}

// window.scrapwake.quick: start(), cancel(), state(), check(). ?quickcheck=1 runs the check once the game is up.
export function quickHooks(game) {
  const hooks = {
    start: () => game.quick.start(),
    cancel: () => game.quick.cancel(),
    state: () => game.quick.state(),
    check: () => runQuickCheck(game),
  };
  const q = new URLSearchParams(window.location.search);
  if (q.get("quickcheck")) setTimeout(() => { if (window.scrapwake && window.scrapwake.quick === hooks) hooks.check(); }, 1500);
  return hooks;
}
