// The building templates of the race worlds: [width, height, depth] in metres. A city is made of these few
// shapes, turned and tinted, so each one is a single instanced mesh per city chunk (maps/race/chunks.js).
export const BLD = {
  shop: [14, 7, 12], low: [18, 12, 16], block: [24, 18, 20], mid: [20, 30, 20],
  slab: [36, 24, 16], tower: [22, 54, 22], spire: [18, 82, 18], shed: [40, 11, 26],
};
export const BLD_TINTS = ["#9a9084", "#7d8891", "#a08670", "#6c746c", "#b0a898"];

/** How far the point (x, z) is from a box's footprint (0 inside it). b: { x, z, r, w, d }. */
export function gapTo(b, x, z) {
  const c = Math.cos(b.r), s = Math.sin(b.r), dx = x - b.x, dz = z - b.z;
  return Math.hypot(Math.max(Math.abs(dx * c - dz * s) - b.w / 2, 0), Math.max(Math.abs(dx * s + dz * c) - b.d / 2, 0));
}

const PTS = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]];
/** Do two footprints come within `gap` metres of each other? (corners, edge middles and centres tested) */
export function clash(a, b, gap = 0) {
  for (const [p, q] of [[a, b], [b, a]]) {
    const c = Math.cos(p.r), s = Math.sin(p.r);
    for (const [u, v] of PTS) {
      const lx = (u * p.w) / 2, lz = (v * p.d) / 2;
      if (gapTo(q, p.x + lx * c + lz * s, p.z - lx * s + lz * c) < gap) return true;
    }
  }
  return false;
}