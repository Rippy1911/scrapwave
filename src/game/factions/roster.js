// The four factions of the Saltreach, built on the groups the game already has:
// - Drifters: the ten named wandering traders (team "drifter"); their caravan stall is in the Well-town.
// - Well-town militia: the town's guard cars (team "militia") and the Cisterner water convoy (team "cisterner").
// - Gasket militia: the scrap town at the North Scrapyard outpost (team "militia", faction "gasket").
// - Raiders: the Rattler gangs and the Warlord (teams "rattler", "warlord"); their fence is at the Rattler Scrapyard.
import { PLACES } from "@/game/data/places";

const place = (id) => PLACES.find((p) => p.id === id);
const SCRAP_N = place("scrapN"), SCRAP_SW = place("scrapSW"), TOWN = place("town");

export const FACTIONS = [
  { id: "drifters", name: "Drifters", short: "Drifters", kind: "traders", start: 0, color: "#e0b25a" },
  { id: "well", name: "Well-town militia", short: "Well-town", kind: "militia", start: 10, color: "#9cc8ff",
    home: { x: TOWN.x, z: TOWN.z }, zone: "town", paint: "#4d6a52", plate: "WM",
    border: [[190, -48], [345, 110], [345, -170]] },
  { id: "gasket", name: "Gasket militia", short: "Gasket", kind: "militia", start: 0, color: "#c9a0ff",
    home: { x: SCRAP_N.x, z: SCRAP_N.z }, zone: "out-scrapN", paint: "#5a4f6e", plate: "GK",
    border: [[170, -420], [60, -330], [-60, -470]] },
  { id: "raiders", name: "Raiders", short: "Raiders", kind: "raiders", start: -20, color: "#ff6a3c",
    home: { x: SCRAP_SW.x, z: SCRAP_SW.z }, zone: "out-scrapSW" },
];
export const FACTION = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));
export const MILITIAS = FACTIONS.filter((f) => f.kind === "militia");

// Which faction runs each trader / job board landmark (onfoot/landmarks.js ids).
export const POSTS = {
  "trader-town": "well", "jobs-town": "well", "caravan-town": "drifters",
  "trader-out-scrapN": "gasket", "trader-out-scrapSW": "raiders",
};

// Which faction guards each safe zone's gate (onfoot zone ids). Other zones (the player's plot) have no gate.
export const GATES = Object.fromEntries(FACTIONS.filter((f) => f.zone).map((f) => [f.zone, f.id]));

// A vehicle's faction id, or null for players, props, arena cars and anything unaligned.
export function factionOf(v) {
  if (!v) return null;
  if (v.faction) return v.faction;
  switch (v.team) {
    case "rattler": case "warlord": return "raiders";
    case "drifter": return "drifters";
    case "cisterner": return "well";
    default: return null;
  }
}

// AI faction vs AI faction: raiders fight everyone; militias and Drifters keep the peace with each other.
export function factionsAtWar(a, b) {
  if (!a || !b || a === b) return false;
  return a === "raiders" || b === "raiders";
}