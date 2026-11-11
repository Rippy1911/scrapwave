// ?map=<id>[&mode=roam|hunt|wreck] boots straight into a world map without the menus (for links, checks and
// screenshots): roam = the map's Free Roam rules, hunt = Horde Night with zombies, wreck = Derby. Returns the rules
// to start with, or null when the page was not opened with a world map.
import { isWorldMap, mapById } from "@/game/maps/catalog";
import { DEFAULT_RULES, validateRules } from "@/game/rules/gameRules";
import { presetPatch } from "@/game/rules/presets";
import "@/game/maps/worlds";

export function bootMapRules(search = typeof window !== "undefined" ? window.location.search : "") {
  const q = new URLSearchParams(search), id = q.get("map");
  if (!id || !isWorldMap(id)) return null;
  const m = mapById(id), mode = q.get("mode") || "roam";
  const patch = mode === "hunt" ? { ...presetPatch("Horde Night"), horde: "zombies" } : mode === "wreck" ? presetPatch("Derby") : { ...m.roamRules, name: `Free Roam · ${m.name}` };
  return validateRules({ ...DEFAULT_RULES, ...patch, map: id });
}
