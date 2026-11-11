// The rule fields that matter for a rules object's mode (Custom Game screen and the lobby's rules panel).
import { FIELDS, PLAYER_CARS } from "@/game/rules/gameRules";

const ARENA_ONLY = new Set(["map", "win", "laps", "timeLimit", "powerups", "horde", "hordeDensity"]);
const ROAM_ONLY = new Set(["building", "freeBuild", "raids"]);

export const fieldsFor = (rules) => FIELDS.filter((f) => !(rules.mode === "arena" ? ROAM_ONLY : ARENA_ONLY).has(f.key));

// A rule's value as text (read-only lobby view).
export function fieldText(f, v) {
  if (f.type === "bool") return v ? "On" : "Off";
  if (f.type === "choice") return f.options[v] ?? String(v);
  if (f.type === "cars") return v.map((c) => PLAYER_CARS[c] || c).join(", ");
  return String(v);
}