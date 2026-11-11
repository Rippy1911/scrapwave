// Oil spots in the world: permanent slick patches on a few road stretches and beside the fuel stations.
// Data only: each entry is resolved against the built world (roads by index and fraction along their length,
// fuel stations by index), so the world files stay untouched. Same grip effect as a dropped slick; they burn
// too (and come back after burning out).
export const OIL_SPOTS = [
  { road: 0, at: 0.28, r: 4.6, side: 0.2 },
  { road: 0, at: 0.71, r: 4.0, side: -0.25 },
  { road: 1, at: 0.42, r: 5.0, side: 0 },
  { road: 2, at: 0.55, r: 4.2, side: 0.3 },
  { road: 3, at: 0.35, r: 4.4, side: -0.2 },
  { fuel: 0, ahead: 9, r: 3.6 },
  { fuel: 1, ahead: -8, r: 3.8 },
  { fuel: 2, ahead: 8, r: 3.4 },
];

/** Resolve the data to world spots: [{ x, z, r }]. */
export function resolveOilSpots(game) {
  const out = [], w = game.world;
  for (const s of OIL_SPOTS) {
    if (s.road !== undefined) {
      const road = w.roads && w.roads[s.road];
      if (!road || road.samples.length < 4) continue;
      const p = road.samples[Math.min(road.samples.length - 1, Math.floor(s.at * road.samples.length))];
      const off = s.side * (road.width || 8) * 0.5; // across the road (right-hand normal of its direction)
      out.push({ x: p.x - p.dz * off, z: p.z + p.dx * off, r: s.r });
    } else if (s.fuel !== undefined) {
      const st = w.fuel && w.fuel.list[s.fuel];
      if (!st) continue;
      out.push({ x: st.x + Math.sin(st.yaw) * s.ahead, z: st.z + Math.cos(st.yaw) * s.ahead, r: s.r });
    }
  }
  return out;
}