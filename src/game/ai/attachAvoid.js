// Plugs AI avoidance (ai/avoid.js) and the ?aicheck=1 harness (game/aicheck.js) into round15's part list, so the
// shared files only gain one import and one call. ?avoid=0 turns the avoidance off; ?aicheck=1 runs the check.
import { bindAvoid, avoidPost, unbindAvoid } from "@/game/ai/avoid";
import { setupAiCheck, aiCheckStep } from "@/game/game/aicheck";

export function attachAvoid(game) {
  const q = new URLSearchParams(window.location.search), check = q.get("aicheck") === "1" || q.get("aicheck") === "true";
  bindAvoid(game);
  if (check) setupAiCheck(game);
  return {
    // After every AI driver (some set turbo or throttle after driveTo): a car that must brake does not accelerate.
    control(dt) { avoidPost(game); if (check) aiCheckStep(game, dt); },
    dispose() { unbindAvoid(game); },
  };
}
