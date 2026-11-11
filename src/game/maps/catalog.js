// Every map the menus, the rules and the loader know (round 15). kind: roam | arena | race | stunt.
// A map with build() is its own world (maps/loader.js loads it); the legacy entries are the round 13 arenas that
// sit on the free-roam ground, kept only for the old hooks and hidden from the pickers once a mode has world maps.
// Each world map module exports { id, kind, name, blurb, size: [w, d] metres, lap (metres, races), build() }.
export const MAP_KINDS = { roam: "Free Roam", arena: "Arena", race: "Wreck Race", stunt: "Stunt Parks" };

const LIST = [
  { id: "saltreach", kind: "roam", name: "The Saltreach", blurb: "The open wasteland: a town, outposts, ramps, raids and your base. Solo.", size: [1200, 1200] },
  { id: "saltreach-online", kind: "roam", online: true, name: "The Saltreach · Online", blurb: "The same wasteland, shared with every driver on the road.", size: [1200, 1200] },
  { id: "quarry", kind: "arena", legacy: true, name: "Quarry Bowl", blurb: "The old fenced bowl on the salt flats.", size: [128, 128] },
  { id: "yard", kind: "arena", legacy: true, name: "Container Yard", blurb: "The old fenced yard of stacked containers.", size: [128, 128] },
  { id: "hollow", kind: "arena", legacy: true, name: "Hollow Town", blurb: "The old fenced ruin.", size: [128, 128] },
  { id: "foundry", kind: "race", legacy: true, laps: 3, name: "Foundry Pen", blurb: "Tight laps between furnace stacks and slag ramps.", size: [128, 128] },
  { id: "glowfield", kind: "race", legacy: true, laps: 3, name: "Glowfield", blurb: "Fast sweepers through the glowing rings.", size: [128, 128] },
  { id: "brokeway", kind: "race", legacy: true, laps: 2, name: "Brokeway", blurb: "A long broken highway with a gap jump.", size: [128, 128] },
  { id: "custom", kind: "arena", legacy: true, own: true, name: "Your map · Map builder", blurb: "The map you saved in the map builder.", size: [128, 128] },
];
const byId = new Map(LIST.map((m) => [m.id, m]));

// World maps register themselves here (maps/worlds.js adds them all at import time).
export function addMap(m) {
  if (byId.has(m.id)) LIST.splice(LIST.indexOf(byId.get(m.id)), 1);
  LIST.push(m); byId.set(m.id, m);
  return m;
}

export const mapById = (id) => byId.get(id) || null;
export const isWorldMap = (id) => !!(byId.get(id) && byId.get(id).build);
export const allMaps = () => LIST.slice();
// What a picker shows for a mode: the world maps, or the legacy ones while that mode has none yet.
export function mapsFor(kind) {
  const all = LIST.filter((m) => (m.kind === kind || (m.also && m.also.includes(kind))) && !m.own); // also: other modes it is offered in
  const worlds = all.filter((m) => m.build || kind === "roam");
  return worlds.length ? worlds : all;
}
// Any arena mode may use any arena-capable map (arena, race and stunt worlds, the legacy arenas, your own map).
export const arenaMapNames = () => Object.fromEntries(LIST.filter((m) => m.kind !== "roam").map((m) => [m.id, m.name]));
export const defaultMap = (kind) => (mapsFor(kind)[0] || LIST[0]).id;
export function nextMap(id) {
  const m = byId.get(id);
  if (!m) return id;
  const l = mapsFor(m.kind), i = l.indexOf(m);
  return l[(i + 1) % l.length].id;
}

// Layouts are plain data and cost a few milliseconds to lay out, so the pickers' pictures share one copy each.
const layouts = new Map();
export function layoutOf(id) {
  const m = byId.get(id);
  if (!m || !m.build) return null;
  if (!layouts.has(id)) layouts.set(id, m.build());
  return layouts.get(id);
}