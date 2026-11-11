// Lobby list text for a rules object, the short public hash of a join code, and rules <-> compact code.
import { MAPS } from "@/game/rules/gameRules";
import { encodeRules, decodeRules } from "@/game/rules/share";
import { normCode } from "@/game/lobby/lobbyState";

export function describeRules(r) {
  if (!r) return { mode: "?", map: "" };
  if (r.mode === "arena") return { mode: r.name && r.name !== "Classic" ? r.name : "Arena", map: MAPS[r.map] || r.map };
  return { mode: r.name && r.name !== "Classic" ? r.name : "Open world", map: "The Saltreach" };
}

// FNV-1a of the code, 4 hex digits: lets a player find a locked lobby from its code alone. The host still checks
// the code itself, so the hash only narrows the search.
export function codeHash(code) {
  const c = normCode(code);
  if (!c) return "";
  let h = 0x811c9dc5;
  for (let i = 0; i < c.length; i++) { h ^= c.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h & 0xffff).toString(16).padStart(4, "0");
}

export const packRules = (rules) => encodeRules(rules);
export const unpackRules = (code) => decodeRules(code);