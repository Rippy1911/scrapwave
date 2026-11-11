// Open-world AI population helpers shared by the rules and the arena: clear AI cars out cleanly
// (packs and the Drifter roster forget them) and bring the Rattlers and Drifters back.
import { removeVehicle } from "@/game/vehicles/vehicle";

const OPEN_WORLD = new Set(["rattler", "drifter", "warlord", "cisterner"]);

// Removes AI cars this browser owns. filter(v) picks which (default: every open-world AI car).
export function clearAI(game, filter = (v) => OPEN_WORLD.has(v.team) && !v.arena) {
  const gone = game.vehicles.filter((v) => v !== game.player && !v.remote && filter(v));
  for (const v of gone) {
    v.alive = false; // packs and brains that still hold it now see it as gone
    if (v.brain) v.brain.raid = null;
    removeVehicle(game, v);
    game.vehicles.splice(game.vehicles.indexOf(v), 1);
  }
  if (game.drifters) for (const e of game.drifters.roster) if (!e.v || gone.includes(e.v)) { e.v = null; e.respawnAt = 0; e.leaving = null; }
  return gone.length;
}

export const hasOpenWorldAI = (game) => game.vehicles.some((v) => (v.team === "rattler" || v.team === "drifter") && !v.arena && v.alive);