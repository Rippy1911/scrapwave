// ?racecheck=1&track=<map id>: sets the rules for a one-lap Wreck Race on that race world before play begins, so
// the page opens straight on its grid. An id that is not a race world changes nothing (free roam starts).
import { setRules } from "@/game/rules/state";
import { DEFAULT_RULES, validateRules } from "@/game/rules/gameRules";
import { presetPatch } from "@/game/rules/presets";
import { mapById } from "@/game/maps/catalog";

export function raceCheckStart(id) {
  const m = mapById(id);
  if (!m || !m.build || m.kind !== "race") return false;
  setRules(validateRules({ ...DEFAULT_RULES, ...presetPatch("Wreck Race · Foundry Pen"), name: `Wreck Race · ${m.name}`, map: m.id, laps: 1 }));
  return true;
}