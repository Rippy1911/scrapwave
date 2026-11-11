// Your own pen maps in localStorage (up to 12) and which one "Your map" plays.
import { cleanMap } from "@/game/arena/custom/mapData";
import { local } from "@/game/core/safeStorage";

const KEY = "scrapwake-maps-v1";

// What a new builder starts from: a cross of walls, two ramps onto a deck, a few barrels.
const STARTER = cleanMap({
  name: "Starter pen",
  pieces: [
    { k: "wall", x: -20, z: 0, r: 0 }, { k: "wall", x: 20, z: 0, r: 0 }, { k: "wall", x: 0, z: -20, r: 2 }, { k: "wall", x: 0, z: 20, r: 2 },
    { k: "deck", x: 0, z: 0, r: 0 }, { k: "ramp", x: 0, z: 8, r: 0 }, { k: "ramp", x: 0, z: -8, r: 4 },
    { k: "barrel", x: -30, z: -30, r: 0 }, { k: "barrel", x: 30, z: 30, r: 0 }, { k: "crate", x: 30, z: -30, r: 0 }, { k: "crate", x: -30, z: 30, r: 0 },
  ],
});

function read() {
  try {
    const d = JSON.parse(local.get(KEY) || "{}");
    return { current: typeof d.current === "string" ? d.current : "", maps: Array.isArray(d.maps) ? d.maps.map(cleanMap) : [] };
  } catch {
    return { current: "", maps: [] };
  }
}
function write(d) {
  try { local.set(KEY, JSON.stringify(d)); } catch { /* private mode: the map lasts until the tab closes */ }
}

export const listMaps = () => read().maps;

// The map "Your map" plays: the one you saved or picked last, else the starter.
export function currentMap() {
  const d = read();
  return d.maps.find((m) => m.name === d.current) || d.maps[d.maps.length - 1] || STARTER;
}

export function saveMap(map) {
  const m = cleanMap(map), d = read();
  d.maps = [...d.maps.filter((x) => x.name !== m.name), m].slice(-12);
  d.current = m.name;
  write(d);
  return m;
}

export function deleteMap(name) {
  const d = read();
  d.maps = d.maps.filter((x) => x.name !== name);
  if (d.current === name) d.current = "";
  write(d);
}