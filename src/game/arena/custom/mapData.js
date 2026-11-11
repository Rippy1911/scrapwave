// A pen map as plain data: { name, floor, laps, pieces: [{ k, x, z, r, c }] }. x and z are metres from the pen centre,
// r is the turn in 45 degree steps, c an optional colour. cleanMap makes anything (a save, a pasted code) safe to
// build; layoutOf turns the markers into the lists the arena uses and fills in whatever the map leaves out.
import { KINDS, KIND_IDS, MAP_R, MAX_PIECES } from "@/game/arena/custom/kinds";

const HEX = /^#[0-9a-f]{6}$/i;
const r1 = (v) => Math.round(v * 10) / 10;

export function cleanMap(input) {
  const src = input && typeof input === "object" ? input : {};
  const name = typeof src.name === "string" && src.name.trim() ? src.name.trim().slice(0, 24) : "My map";
  const pieces = [];
  for (const p of Array.isArray(src.pieces) ? src.pieces : []) {
    if (pieces.length >= MAX_PIECES) break;
    if (!p || !KINDS[p.k]) continue;
    const x = Number(p.x), z = Number(p.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) > MAP_R) continue;
    const piece = { k: p.k, x: r1(x), z: r1(z), r: (((Math.round(Number(p.r)) || 0) % 8) + 8) % 8 };
    if (typeof p.c === "string" && HEX.test(p.c)) piece.c = p.c;
    pieces.push(piece);
  }
  const laps = Math.max(1, Math.min(9, Math.round(Number(src.laps)) || 3));
  return { name, floor: typeof src.floor === "string" && HEX.test(src.floor) ? src.floor : null, laps, pieces };
}

const ring = (n, r, off = 0) => Array.from({ length: n }, (_, i) => {
  const a = off + (i / n) * Math.PI * 2;
  return { x: r1(Math.sin(a) * r), z: r1(Math.cos(a) * r), y: 0 };
});

export function layoutOf(map) {
  const of = (k) => map.pieces.filter((p) => p.k === k).map((p) => ({ x: p.x, z: p.z, y: 0 }));
  const solids = map.pieces.filter((p) => KINDS[p.k].group === "solid" || KINDS[p.k].group === "ramp");
  const clear = (q) => solids.every((p) => Math.hypot(p.x - q.x, p.z - q.z) > 7);
  const spawns = of("spawn");
  for (const s of [...ring(12, 50, 0.26), ...ring(10, 38, 0.1)]) {
    if (spawns.length >= 10) break;
    if (clear(s) && spawns.every((o) => Math.hypot(o.x - s.x, o.z - s.z) > 6)) spawns.push(s);
  }
  if (!spawns.length) spawns.push(...ring(10, 50, 0.26));
  let checkpoints = of("cp");
  if (checkpoints.length < 2) { const open = ring(8, 42).filter(clear); checkpoints = open.length >= 4 ? open : ring(8, 42); }
  const power = of("power"), horde = of("horde");
  return {
    spawns, checkpoints,
    power: power.length ? power : ring(4, 24, 0.4).filter(clear),
    horde: horde.length ? horde : ring(6, 30, 0.9).filter(clear),
    props: map.pieces.filter((p) => KINDS[p.k].group === "prop").map((p) => ({ kind: p.k, x: p.x, z: p.z, ry: (p.r * Math.PI) / 4 })),
  };
}

// Share codes: "SWM1." + the map packed small. decodeMap returns a clean map or null.
export function encodeMap(map) {
  const m = cleanMap(map);
  const packed = [m.name, m.floor, m.laps, m.pieces.map((p) => [KIND_IDS.indexOf(p.k), p.x, p.z, p.r, p.c || 0])];
  return "SWM1." + btoa(encodeURIComponent(JSON.stringify(packed)));
}

export function decodeMap(code) {
  try {
    const text = String(code || "").trim();
    if (!text.startsWith("SWM1.")) return null;
    const [name, floor, laps, list] = JSON.parse(decodeURIComponent(atob(text.slice(5))));
    if (!Array.isArray(list)) return null;
    return cleanMap({ name, floor, laps, pieces: list.map(([k, x, z, r, c]) => ({ k: KIND_IDS[k], x, z, r, c: c || undefined })) });
  } catch {
    return null;
  }
}