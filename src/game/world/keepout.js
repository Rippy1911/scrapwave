// Where world dressing may go. One rule set for every scatter layer, so props never land on a road, a ramp run-up or
// landing, a bridge, a plot, an arena floor or inside a place, and never overlap a collider that is already there.
// A 2 m mask answers the per-blade questions of the ground cover; blocked() answers the per-rock ones.
import { PLACES, PLOTS, BRIDGES } from "@/game/data/places";
import { inRampLane } from "@/game/world/places/ramps";
import { distToPolyline } from "@/game/core/rng";

const MC = 2; // mask cell (m)
export const FREE = 0, SHOULDER = 1, HARD = 2;

export function createKeepOut({ terrain, roads, ramps, colliders, arenas = [] }) {
  const half = terrain.half, MN = Math.ceil(terrain.S / MC);
  const mask = new Uint8Array(MN * MN);
  const stamp = (x, z, r, v) => {
    const i0 = Math.max(0, Math.floor((x - r + half) / MC)), i1 = Math.min(MN - 1, Math.floor((x + r + half) / MC));
    const j0 = Math.max(0, Math.floor((z - r + half) / MC)), j1 = Math.min(MN - 1, Math.floor((z + r + half) / MC));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -half + (i + 0.5) * MC - x, cz = -half + (j + 0.5) * MC - z;
      if (cx * cx + cz * cz <= r * r) { const k = j * MN + i; if (mask[k] < v) mask[k] = v; }
    }
  };
  // roads: the carriageway is hard (oil spots and traffic live there), a strip beside it takes only low cover
  for (const r of roads.roads) for (const s of r.samples) {
    if (s.deck) continue;
    stamp(s.x, s.z, r.width / 2 + 0.6, HARD);
    stamp(s.x, s.z, r.width / 2 + 3, SHOULDER);
  }
  for (const b of Object.values(BRIDGES)) {
    const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]);
    for (let t = 0; t <= L; t += 2) stamp(b.a[0] + ((b.b[0] - b.a[0]) * t) / L, b.a[1] + ((b.b[1] - b.a[1]) * t) / L, b.width / 2 + 4, HARD);
  }
  for (const r of ramps || []) {
    // the whole ramp lane and more: 75 m run-up (a car starts its run there), the ramp, 95 m of flight and roll-out
    const sx = -r.dirZ, sz = r.dirX;
    for (let a = -(r.len / 2 + 75); a <= r.len / 2 + 95; a += 2) for (let b = -(r.w / 2 + 5); b <= r.w / 2 + 5; b += 2) stamp(r.x + r.dirX * a + sx * b, r.z + r.dirZ * a + sz * b, 1.5, HARD);
  }
  for (const p of PLOTS) stamp(p.x, p.z, 36, HARD);
  for (const p of PLACES) stamp(p.x, p.z, (p.r || 40) * 0.85, HARD);
  for (const a of arenas) stamp(a.x, a.z, a.R + 12, HARD);

  const at = (x, z) => {
    const i = Math.floor((x + half) / MC), j = Math.floor((z + half) / MC);
    if (i < 0 || j < 0 || i >= MN || j >= MN) return HARD;
    return mask[j * MN + i];
  };

  /** Big dressing (rocks, trees, camps): pad metres of clearance from roads, ramp lanes, places, plots, arenas, colliders. */
  function blocked(x, z, pad = 4, { colliderPad = pad, edge = 592 } = {}) {
    if (Math.abs(x) > edge || Math.abs(z) > edge) return true;
    if (at(x, z) !== FREE) return true;
    for (const p of PLACES) if (Math.hypot(x - p.x, z - p.z) < (p.r || 40) + pad + 4) return true;
    for (const p of PLOTS) if (Math.abs(x - p.x) < 34 + pad && Math.abs(z - p.z) < 34 + pad) return true;
    for (const a of arenas) if (Math.hypot(x - a.x, z - a.z) < a.R + 14 + pad) return true;
    for (const b of Object.values(BRIDGES)) if (distToPolyline([b.a, b.b], x, z).d < b.width / 2 + pad + 6) return true;
    const n = roads.nearest(x, z, 2);
    if (n.road && n.dist < n.road.width / 2 + pad + 1.5) return true;
    if (inRampLane(ramps, x, z, pad)) return true;
    if (colliders && colliderPad > 0) {
      let hit = false;
      colliders.collect(x, z, colliderPad + 2, (b) => {
        if (hit || b.dead || b.noCollide || b.tag === "arenaFence") return;
        const dx = Math.max(0, Math.abs(x - b.x) - Math.max(b.hx, b.hz)), dz = Math.max(0, Math.abs(z - b.z) - Math.max(b.hx, b.hz));
        if (dx * dx + dz * dz < colliderPad * colliderPad) hit = true;
      });
      if (hit) return true;
    }
    return false;
  }
  return { mask, MN, MC, at, blocked, stamp };
}
