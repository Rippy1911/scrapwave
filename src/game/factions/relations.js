// Who an AI car is willing to attack, by faction and the player's standing. nearestHostile (ai/steer.js) asks this
// after the old team check, so it only ever narrows targets, except militias, which have no team side of their own.
import { factionOf, factionsAtWar } from "@/game/factions/roster";

const PROVOKE_TIME = 20; // seconds a faction keeps fighting back after the player shoots one of its cars

const human = (game, t) => t === game.player || t.team === "remote";
const hitMeRecently = (game, v, t) => v.lastHitBy === t && game.time - (v.lastCombat || -99) < 12;

export function createRelations(game, rep) {
  const provokedUntil = {};

  const provoke = (id) => { if (id) provokedUntil[id] = game.time + PROVOKE_TIME; };
  const provoked = (id) => game.time < (provokedUntil[id] || -1);

  // v: the AI car choosing; t: a candidate target that already passed the team check (or is a militia case).
  function willAttack(v, t) {
    const fv = factionOf(v), ft = factionOf(t);
    if (!fv) return true; // arena cars, props, test gunners: unchanged
    if (t.empty) return false;
    if (human(game, t)) {
      if (hitMeRecently(game, v, t)) return true;
      if (t !== game.player) return fv === "raiders"; // other humans: raiders hunt them, the rest leave them be
      if (fv === "raiders") return v.team === "warlord" || !rep.peaceful("raiders") || provoked("raiders");
      if (fv === "drifters") return true; // agent.js keeps its own rules (hunters, payback, Hostile on sight)
      return rep.hostile(fv) || provoked(fv); // militias: Hostile on sight, or after you start it
    }
    if (!ft) return true;
    if (fv === ft) return fv === "drifters"; // brawly Drifters still fight each other
    return factionsAtWar(fv, ft) || hitMeRecently(game, v, t);
  }

  // Should a Drifter go for the player with no other reason (Hostile standing, or provoked)?
  const drifterOnSight = () => rep.hostile("drifters") || provoked("drifters");

  return { willAttack, provoke, provoked, drifterOnSight, provokedUntil };
}