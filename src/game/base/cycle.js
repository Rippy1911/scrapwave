// The cycle: 30 minutes of play (15 with Short cycles), radio warnings at 25:00 and 29:00, then a 5-minute
// dust storm closing on the Well-town (hull drains 30/s inside it), then payout, results and a new cycle.
// Online the clock follows the server's cycle/cycleEnd messages; offline it runs here.
import * as THREE from "three";
import { CYCLE } from "@/game/data/tuning";
import { CRASH_SITES } from "@/game/data/places";
import { net } from "@/game/net/net";
import { writeSave } from "@/game/core/save";
import { damageVehicle } from "@/game/vehicles/vehicle";
import { createStorm } from "@/game/fx/storm";

const R0 = 900;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function createCycle(game) {
  const town = game.world.town.bank;
  const storm = createStorm(game, town);
  const c = game.cycle;
  Object.assign(c, { n: 1, storm: CYCLE.storm, warned: 0, stormOn: false, ended: false, crash: 0 });
  let server = null, waitEnd = 0;
  const radio = (text) => { game.emit({ type: "radio", from: "Well-town radio", text }); game.audio.radio(); };

  function newSession() {
    game.session = { wrecks: 0, banked: 0, start: { ...game.save.stats }, bestAir: 0, siphons: 0, longestHold: 0, claimedAt: null, moments: [], tankers: 0 };
  }
  newSession();
  const prevAir = game.onAirLanded;
  game.onAirLanded = (t) => {
    if (prevAir) prevAir(t);
    game.session.bestAir = Math.max(game.session.bestAir, t);
    if (t > 2) game.session.moments.push({ score: t * 12, text: `${t.toFixed(1)} s of air` });
  };

  function begin(n, length) {
    Object.assign(c, { t: 0, n, length, warned: 0, stormOn: false, ended: false, crash: (n - 1) % CRASH_SITES.length });
    storm.hide();
    newSession();
    for (const e of game.drifters.roster) { e.banked = 0; e.wrecks = 0; }
    if (game.jobs) game.jobs.reset();
    if (game.warlord) game.warlord.reset();
  }
  const localLength = () => (game.save.shortCycles ? CYCLE.shortLength : CYCLE.length);

  function sync(sc, phase) {
    if (!sc) return;
    if (sc.n && sc.n !== c.n && c.n) { if (!c.ended && server) end(null); begin(sc.n, sc.durationMs / 1000); }
    server = { start: sc.startedAt, off: (sc.now || Date.now()) - Date.now() };
    c.length = sc.durationMs / 1000; c.storm = sc.stormMs / 1000; c.n = sc.n;
    c.t = (Date.now() + server.off - server.start) / 1000;
    if ((phase || sc.phase) === "storm") c.t = Math.max(c.t, c.length);
  }

  function results(serverRows) {
    const p = game.player, s = game.session, st = game.save.stats, mine = game.base.mine();
    if (s.claimedAt != null) s.longestHold = Math.max(s.longestHold, game.time - s.claimedAt);
    const stash = Math.floor(net.mode === "online" ? (game.base.wallet.stash || (mine ? mine.stash : 0)) : mine && !mine.dark ? mine.stash : 0);
    const rows = serverRows ? serverRows.map((r) => ({ name: r.id === game.selfId() ? "You" : r.name, banked: r.banked | 0, wrecks: r.wrecks | 0, me: r.id === game.selfId(), ai: !!r.ai }))
      : [{ name: "You", banked: s.banked, wrecks: s.wrecks, me: true }, ...game.drifters.roster.map((e) => ({ name: e.name, banked: e.banked, wrecks: e.wrecks, ai: true }))].sort((a, b) => b.banked - a.banked);
    const best = s.moments.sort((a, b) => b.score - a.score)[0];
    return {
      n: c.n, payout: stash, rows: rows.slice(0, 12),
      tally: [
        ["Scrap banked", s.banked], ["Wrecks", s.wrecks], ["Parts ripped off", st.parts - s.start.parts + st.wheels - s.start.wheels],
        ["Best air", `${s.bestAir.toFixed(1)} s`], ["Longest base hold", s.longestHold ? fmt(s.longestHold) : "—"], ["Bases raided", s.siphons],
      ],
      best: best ? best.text : p.alive ? "Survived the storm" : "Ate sand",
    };
  }

  function end(msg) {
    if (c.ended) return;
    c.ended = true;
    const r = results(msg && msg.results);
    game.save.banked += r.payout;
    if (!game.noSave) writeSave(game.save);
    game.base.resetAll(true);
    storm.hide();
    game.emit({ type: "results", data: r });
  }

  return {
    storm, sync, begin,
    phase: () => (c.ended ? "end" : c.t >= c.length ? "storm" : "run"),
    serverEnd(m) { end(m); begin(m.cycle ? m.cycle.n : c.n + 1, m.cycle ? m.cycle.durationMs / 1000 : localLength()); if (m.cycle) sync(m.cycle); if (m.world) game.base.handlers.resync(m.world); },
    // Called by "Next cycle" on the results screen (offline the new cycle starts here).
    next() {
      if (net.mode !== "online") begin(c.n + 1, localLength());
      c.ended = false;
      game.respawnPlayer();
      game.startIntro(false);
      game.callout(`CYCLE ${c.n}`, "new crash site on the map", "#f2c230");
    },
    restart(o = {}) { begin(1, o.short ? CYCLE.shortLength : o.length || localLength()); },
    skipTo(sec) { c.t = Math.max(0, +sec || 0); c.warned = c.t >= c.length - 60 ? 2 : c.t >= c.length - 300 ? 1 : 0; c.stormOn = false; if (server) server.start = Date.now() + server.off - c.t * 1000; return c.t; },
    step(dt) {
      if (c.ended) return;
      if (net.mode === "online" && server) c.t = (Date.now() + server.off - server.start) / 1000;
      const left = c.length - c.t;
      if (c.warned < 1 && left <= 300 && left > 0) { c.warned = 1; radio("Storm front building out west. Five minutes, then it eats the basin."); }
      if (c.warned < 2 && left <= 60 && left > 0) { c.warned = 2; radio("One minute! Bank your scrap, get to the Well-town!"); game.audio.siren?.(); }
      if (c.t < c.length) return;
      const k = Math.min(1, (c.t - c.length) / c.storm);
      if (!c.stormOn) { c.stormOn = true; game.callout("DUST STORM", "get inside the ring · it closes on the Well-town", "#ff8a3a"); radio("Here it comes. Anything outside the wall gets sandblasted."); }
      const radius = R0 + (CYCLE.stormMinRadius - R0) * k;
      storm.set(radius, Math.min(1, (c.t - c.length) / 8));
      c.stormR = radius;
      const p = game.player;
      if (p.alive && storm.inside(p.pos.x, p.pos.z)) damageVehicle(game, p, CYCLE.stormDps * dt, p.pos, null, { blunt: true });
      if (k >= 1) {
        if (net.mode !== "online") end(null);
        else if ((waitEnd += dt) > 15) { waitEnd = 0; end(null); }
      } else waitEnd = 0;
    },
    frame(dt, cam) { return c.t >= c.length && !c.ended ? storm.update(dt, cam) : (storm.update(0, cam), 0); },
    crashSite() { const [x, z] = CRASH_SITES[c.crash % CRASH_SITES.length]; return new THREE.Vector3(x, game.world.groundAt(x, z, 999), z); },
    hud() {
      const st = c.t >= c.length;
      return { n: c.n, left: Math.max(0, c.length - c.t), length: c.length, storm: st, stormLeft: st ? Math.max(0, c.length + c.storm - c.t) : 0, inside: st && storm.inside(game.player.pos.x, game.player.pos.z), short: c.length < CYCLE.length };
    },
  };
}