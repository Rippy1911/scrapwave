// Data half of ?mechcheck=1: blueprint save and reload, the part cap, old v1 blueprints and today's cars, the admin
// gate on Spawn Wreckframe. Pure checks; nothing is written to the real save (noSave) and the test blueprint is removed.
import { compileDesign } from "@/game/workshop/compile";
import { saveBlueprint, loadBlueprint, deleteBlueprint } from "@/game/workshop/blueprints";
import { PRESETS } from "@/game/workshop/designs";
import { normalizeDesign } from "@/game/workshop/validate";
import { normalizeFree, HARD_CAP } from "@/game/workshop/freeValidate";
import { wreckframeDesign } from "@/game/mech/wreckframe";
import { isAdmin } from "@/game/air/admin";

export function dataChecks(game, ok) {
  const wf = wreckframeDesign();
  saveBlueprint(game.save, "Mechcheck", wf, true);
  const back = loadBlueprint(game.save, "Mechcheck");
  deleteBlueprint(game.save, "Mechcheck", true);
  ok("Blueprint saves and reloads", back && JSON.stringify(back.free) === JSON.stringify(normalizeDesign(wf).free));
  const many = { parts: Array.from({ length: HARD_CAP + 100 }, (_, i) => ({ id: i + 1, t: "block", p: [(i % 12) - 6, Math.floor(i / 12) % 11 - 3, Math.floor(i / 132) - 8] })) };
  const capped = normalizeFree(many);
  ok("Part cap holds", capped && capped.parts.length <= HARD_CAP, capped && capped.parts.length);
  const old = { ...PRESETS[0], v: 1 };
  delete old.free;
  const oc = compileDesign(old);
  ok("Old v1 blueprint still compiles", oc && oc.stats && !normalizeDesign(old).free, oc && oc.stats && oc.stats.name);
  const bad = PRESETS.filter((d) => { const c = compileDesign(d); return !c || !c.stats || (c.mech && c.mech.joints > 0); });
  ok("Today's cars compile unchanged", bad.length === 0, PRESETS.length + " presets");
  ok("Spawn Wreckframe is admin only", isAdmin() ? "admin here" : game.adminActions.wreckframe() === false, isAdmin() ? "admin session" : "refused");
}