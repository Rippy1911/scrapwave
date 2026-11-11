// Runs a lobby match on this browser: the lobby's rules (with this player's ride), the room's cars, the arena at
// this player's spawn slot, and the way back. Every browser plays the same rules; arena AI and the horde run
// locally on each browser (the room server only lets its shard host stream AI; see docs/notes-lobbies.md).
import { net } from "@/game/net/net";
import { setRules } from "@/game/rules/state";
import { DEFAULT_RULES, validateRules } from "@/game/rules/gameRules";
import { rideCap, defaultRide, checkRide } from "@/game/lobby/rideRules";
import { present } from "@/game/lobby/lobbyState";
import { modePicked } from "@/game/core/telemetry";

export function createMatch(game) {
  let cur = null; // { lid, round, ids }
  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => { onWreck(v, attacker); if (cur && attacker === game.player && v !== game.player) game.lobbyWrecks = (game.lobbyWrecks || 0) + 1; };

  // The room's welcome with the lobby's players as the known drivers (names and cars for their remote cars).
  function welcomeFor(l, me) {
    const base = net.welcome();
    if (!base || net.mode !== "online") return null;
    const ids = new Set(present(l).map((p) => p.id));
    const others = (base.players || []).filter((p) => !ids.has(p.id));
    const mates = present(l).map((p) => ({ id: p.id, name: p.name, vehicle: (p.ride || defaultRide(l.rules)).ch, paint: "rust" }));
    return { ...base, you: me, players: [...others, ...mates] };
  }

  const M = {
    active: () => !!cur,
    round: () => (cur ? cur.round : 0),
    // Keep the arena's visible cars in step with the lobby (a rejoin can bring a new player id).
    sync(l, me) { if (cur) cur.ids = new Set(present(l).map((p) => p.id).filter((id) => id !== me)); },
    start(l, me) {
      const ps = present(l), slot = Math.max(0, ps.findIndex((p) => p.id === me));
      const pick = ps[slot] && ps[slot].ride;
      const ride = pick && !checkRide(l.rules, pick) ? pick : defaultRide(l.rules);
      const rules = setRules(validateRules({ ...l.rules, startCar: ride.ch, maxTier: rideCap(ride, l.rules) }));
      cur = { lid: l.id, round: l.round, ids: new Set() };
      M.sync(l, me);
      game.demo.stop();
      const welcome = welcomeFor(l, me);
      if (welcome) { game.netSync.start(welcome); game.base.start(welcome); }
      game.lobbyMatchT0 = game.time; game.lobbyWrecks = 0;
      if (rules.mode === "arena") {
        game.netFilter = (id, ai) => !ai && !!cur && cur.ids.has(id);
        game.arena.start(rules, { slot, humans: ps.length });
        game.startIntro(false);
      } else {
        game.netFilter = null;
        game.arena.stop();
        const g = game.save.garage, keep = g.chassis;
        g.chassis = ride.ch;
        try { game.respawnPlayer(); } finally { g.chassis = keep; }
        game.ruleSys.syncPopulation();
        game.startIntro(true);
      }
      modePicked(game);
      return { slot, ride };
    },
    // End of a round: the match stops (cars, horde, crates); the player waits in the lobby where they are.
    stop() {
      if (!cur) return;
      cur = null;
      if (game.arena.active) game.arena.stop();
      game.netFilter = null;
    },
    // Leaving the lobby for good: back to the open world on Classic rules.
    leave() {
      const wasArena = game.arena.active || getMode() === "arena";
      M.stop();
      if (wasArena) game.arena.leave(); else setRules(DEFAULT_RULES);
    },
  };
  const getMode = () => (game.arena.rules ? game.arena.rules.mode : null);
  return M;
}