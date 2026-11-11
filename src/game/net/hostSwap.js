// Host changes. Non-hosts drop their local AI (the host's AI arrives in snapshots); a new host adopts the
// remote AI cars where they are, gives them brains again and tops the population back up.
import { AI } from "@/game/data/tuning";
import { newBrain } from "@/game/ai/steer";
import { removeVehicle } from "@/game/vehicles/vehicle";

// Arena opponents are this browser's own (each lobby player runs the match's AI locally), never the shard's.
const isAi = (v) => !v.arena && (v.team === "rattler" || v.team === "drifter" || v.team === "cisterner" || v.team === "warlord" || v.team === "militia");

export function dropLocalAi(game) {
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const v = game.vehicles[i];
    if (v === game.player || v.remote || !isAi(v)) continue;
    game.vehicles.splice(i, 1);
    removeVehicle(game, v);
  }
  for (const e of game.drifters.roster) { e.v = null; e.respawnAt = 0; }
  game.ai.packs.length = 0;
}

export function adoptAi(game, list) {
  const roster = game.drifters.roster;
  for (const v of list) {
    v.remote = false;
    v.angVel.set(0, 0, 0);
    v.lockTarget = null; v.aiming = false;
    if (v.team === "rattler") {
      v.skill = AI.skills.veteran;
      v.brain = newBrain({ mode: "patrol" });
    } else if (v.team === "militia") {
      v.skill = AI.skills.veteran; // factions/militia.js takes the guard back into its slot by netId
      v.brain = newBrain({ mode: "guard" });
    } else if (v.team === "cisterner" || v.team === "warlord") {
      v.skill = AI.skills.veteran; // convoy.js / warlord.js pick their route up from where they stand
      v.brain = newBrain({ mode: v.team });
    } else {
      const e = roster.find((x) => x.name === v.name && !x.v);
      if (e) { e.v = v; v.entry = e; v.skill = AI.skills[e.skill]; }
      else v.skill = AI.skills.veteran;
      v.brain = newBrain({});
    }
    v.spreadMul = v.skill.spread / 0.03;
  }
  // Drifters nobody adopted come back from the map edge; Rattlers are topped up to the minimum.
  for (const e of roster) if (!e.v && e.respawnAt <= 0) e.respawnAt = game.time + 3 + Math.random() * 6;
  const rattlers = game.vehicles.filter((v) => v.alive && v.team === "rattler").length;
  for (let i = rattlers; i < AI.rattlers[0]; i++) game.ai.spawn();
}