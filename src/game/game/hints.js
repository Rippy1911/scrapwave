// First-session hint cards, each timed to its moment: drive + turbo at spawn, the first ramp ahead, first enemy in range.
import { FLOW } from "@/game/data/tuning";
import { writeSave } from "@/game/core/save";
import { hostile } from "@/game/ai/steer";
import * as THREE from "three";

const CARDS = {
  drive: { title: "Hit the road", body: "Hold W to drive, A / D to steer. Hold Shift for turbo.", keys: ["W", "A", "D", "SHIFT"] },
  ramp: { title: "Ramp ahead", body: "Line up and turbo into it. In the air, W / S pitch, A / D roll and Space levels out. Long air pays scrap.", keys: ["SHIFT", "W", "S", "A", "D"] },
  shoot: { title: "Rattlers in range", body: "Point the crosshair near one and it locks on. Hold Left Click or J to shoot; F or K fires rockets once the lock beeps. Tab switches target, G drops a trap. Wrecks drop scrap: bank it in the Well-town.", keys: ["LMB", "J", "F", "TAB", "G"] },
};
const fwd = new THREE.Vector3();

export function createHints(game) {
  const seen = game.save.hints || (game.save.hints = {});
  const show = (id) => {
    seen[id] = true;
    if (!game.noSave) writeSave(game.save);
    game.emit({ type: "hint", id, ...CARDS[id], time: FLOW.hintTime });
  };
  let driveT = 0;
  return {
    step(dt) {
      const p = game.player;
      if (game.autopilot || !p.alive || game.introT > 0 || game.uiOpen) return;
      if (!seen.drive) { driveT += dt; if (driveT > 0.3) show("drive"); return; }
      if (!seen.ramp) {
        fwd.set(0, 0, -1).applyQuaternion(p.quat);
        for (const r of game.world.ramps) {
          const dx = r.x - p.pos.x, dz = r.z - p.pos.z, d = Math.hypot(dx, dz);
          if (d < FLOW.rampHintDist && d > 15 && (dx * fwd.x + dz * fwd.z) / d > 0.8) { show("ramp"); break; }
        }
      }
      if (!seen.shoot && !game.inSafeZone(p)) {
        if (game.vehicles.some((v) => hostile(p, v) && v.team === "rattler" && v.pos.distanceTo(p.pos) < 140)) show("shoot");
      }
    },
  };
}