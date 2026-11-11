// Finds open ground for the three arenas on the existing map: away from towns, places, plots, ramps, crash
// sites and roads, as level as possible and with few existing colliders. Runs once per world (deterministic:
// the terrain is seeded), so the arenas always sit in the same spots.
import { PLACES, PLOTS, RAMPS, CRASH_SITES, BILLBOARDS } from "@/game/data/places";
import { WORLD } from "@/game/data/tuning";

export const ARENA_R = 64; // inner wall radius (m)
const ORDER = ["quarry", "yard", "hollow", "pen"]; // pen: the empty arena your own maps and the race tracks play in

function score(world, x, z, R, roadMin) {
  const T = world.terrain;
  for (const p of PLACES) if (Math.hypot(p.x - x, p.z - z) < (p.pad || p.r) + R + 30) return Infinity;
  for (const p of PLOTS) if (Math.hypot(p.x - x, p.z - z) < R + 45) return Infinity;
  for (const p of [...RAMPS, ...BILLBOARDS]) if (Math.hypot(p.x - x, p.z - z) < R + 20) return Infinity;
  for (const [cx, cz] of CRASH_SITES) if (Math.hypot(cx - x, cz - z) < R + 20) return Infinity;
  const road = world.roads.nearest(x, z, 8);
  const roadDist = road.road ? road.dist : 999;
  if (roadDist < roadMin) return Infinity;
  let lo = Infinity, hi = -Infinity;
  for (let r = 0; r <= R + 6; r += 14) for (let a = 0; a < 16; a++) {
    const h = T.heightAt(x + Math.sin((a / 16) * 6.283) * r, z + Math.cos((a / 16) * 6.283) * r);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  let clutter = 0;
  world.colliders.collect(x, z, R + 4, (b) => { if (!b.dead && Math.hypot(b.x - x, b.z - z) < R + 4) clutter++; });
  return (hi - lo) * 3 + clutter * 0.6 - Math.min(roadDist, 200) * 0.02;
}

export function findSites(world) {
  if (world.arenaSites) return world.arenaSites;
  const R = ARENA_R, lim = WORLD.bound - R - 12, picks = [];
  for (const roadMin of [R + 30, R + 12, R - 10, 0]) {
    const cands = [];
    for (let x = -lim; x <= lim; x += 24) for (let z = -lim; z <= lim; z += 24) {
      const s = score(world, x, z, R, roadMin);
      if (s < Infinity) cands.push({ x, z, s });
    }
    cands.sort((a, b) => a.s - b.s);
    for (const c of cands) {
      if (picks.length >= ORDER.length) break;
      if (picks.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > R * 2 + 40)) picks.push(c);
    }
    if (picks.length >= ORDER.length) break;
  }
  while (picks.length < ORDER.length) picks.push({ x: -400 + picks.length * 300, z: 0, s: 99 }); // never happens on the shipped map
  world.arenaSites = Object.fromEntries(ORDER.map((id, i) => [id, { id, x: picks[i].x, z: picks[i].z, R }]));
  return world.arenaSites;
}