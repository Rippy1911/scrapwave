// What moves reputation: wrecks and hits by the player, finished faction jobs, staying with the water convoy to the
// dam, and goods sold where they are needed (factions/trader.js). Wraps game.onWreck and game.onHitMarker once.
import { factionOf, MILITIAS } from "@/game/factions/roster";

const WRECK = {
  raiders: { raiders: -3, well: 2, gasket: 2, drifters: 1 },
  warlord: { raiders: -12, well: 8, gasket: 8, drifters: 5 },
  drifters: { drifters: -8 },
  well: { well: -10 },
  tanker: { well: -12, drifters: -3 },
  gasket: { gasket: -10 },
};
const HIT = -1, HIT_GAP = 1.5;

export function attachRepEvents(game, rep, rel) {
  const seen = new WeakMap();
  let pollT = 0;
  const apply = (table, why) => { for (const [id, d] of Object.entries(table)) rep.change(id, d, why); };
  const live = () => !game.arena.active && !game.demo.running && !game.autopilot;

  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => {
    onWreck(v, attacker);
    if (attacker !== game.player || v === game.player || !live()) return;
    const f = factionOf(v);
    if (!f) return;
    rel.provoke(f);
    const key = v.team === "warlord" ? "warlord" : v.team === "cisterner" && v.chassisId === "tanker" ? "tanker" : f;
    apply(WRECK[key] || {}, "wreck");
  };

  // Every hit the player lands goes through game.onHitMarker (vehicle.js / net/damage.js).
  const onHitMarker = game.onHitMarker;
  game.onHitMarker = (v, amount) => {
    onHitMarker(v, amount);
    const f = v && v !== game.player ? factionOf(v) : null;
    if (!f || !live()) return;
    rel.provoke(f);
    const at = seen.get(v) ?? -99;
    if (f !== "raiders" && game.time - at > HIT_GAP) { seen.set(v, game.time); rep.change(f, HIT, "hit"); }
  };

  let convoyWas = false;
  function convoyWatch() {
    const c = game.convoy, on = c.active();
    if (convoyWas && !on && c.arrived()) {
      const lead = game.vehicles.find((v) => v.team === "cisterner") || null;
      const near = !lead || lead.pos.distanceTo(game.player.pos) < 160;
      if (near && game.player.alive) apply({ well: 3, drifters: 2 }, "convoy");
    }
    convoyWas = on;
  }

  return {
    step(dt) {
      if (!live()) return;
      pollT -= dt;
      if (pollT <= 0) { pollT = 0.25; convoyWatch(); }
    },
    jobDone(def) {
      if (!def || !live()) return;
      rep.change(def.faction, def.rep || 4, "job");
      if (def.rival) apply(def.rival, "rival job");
    },
    sold(factionId, needed) { if (needed && live()) rep.change(factionId, 2, "trade"); },
    militias: MILITIAS.map((m) => m.id),
  };
}