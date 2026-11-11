// Player autopilot (?autoplay=1, ?test=1 and the title attract mode): the player's own car and loadout,
// driven by the same brain, steering and combat code as the Drifters.
import { newBrain } from "@/game/ai/steer";
import { agentThink, agentDrive } from "@/game/ai/agent";
import { createNameTag } from "@/game/vehicles/nametag";

export function createAutopilot(game) {
  const ap = {
    on: false,
    set(on) {
      ap.on = !!on;
      game.autopilot = ap.on;
      const p = game.player;
      if (p && ap.on && !p.tag) createNameTag(game, p, "AUTOPILOT", "#9cc8ff", false);
      if (p && !ap.on) Object.assign(p.ctl, { throttle: 0, brake: 0, steer: 0, fire: false, rockets: false, harpoon: false, turbo: false });
    },
    step(dt) {
      const p = game.player;
      if (!p.alive) return;
      if (!p.brain) p.brain = newBrain({ mode: "roam" });
      p.brain.think -= dt;
      if (p.brain.think <= 0 || !p.brain.primed) { p.brain.primed = true; agentThink(game, p); } // first think before the first drive
      agentDrive(game, p, dt);
      if (game.inSafeZone(p)) { p.ctl.fire = false; p.ctl.rockets = false; p.ctl.harpoon = false; }
    },
  };
  return ap;
}