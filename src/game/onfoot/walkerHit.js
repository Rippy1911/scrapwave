// Where a shot meets a standing walker whose feet are at (wx, wy, wz): the head (a ball at 1.62 m) or the body
// (a column from the feet up to 1.45 m). Pure numbers, no engine types: o and d are { x, y, z }, d is unit length.
export const BODY = { r: 0.32, top: 1.45, headY: 1.62, headR: 0.2 };

// Returns { t, part: "head" | "body" } for the nearer of the two, or null when the ray misses within maxT.
export function rayWalker(o, d, maxT, wx, wy, wz) {
  let best = null;
  const hx = wx - o.x, hy = wy + BODY.headY - o.y, hz = wz - o.z;
  const along = hx * d.x + hy * d.y + hz * d.z, off2 = hx * hx + hy * hy + hz * hz - along * along, r2 = BODY.headR * BODY.headR;
  if (along > 0 && off2 < r2) {
    const t = along - Math.sqrt(r2 - off2);
    if (t >= 0 && t <= maxT) best = { t, part: "head" };
  }
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-9) {
    const ox = o.x - wx, oz = o.z - wz, b = ox * d.x + oz * d.z, disc = b * b - a * (ox * ox + oz * oz - BODY.r * BODY.r);
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a, y = o.y + d.y * t - wy;
      if (t >= 0 && t <= maxT && y >= 0 && y <= BODY.top && (!best || t < best.t)) best = { t, part: "body" };
    }
  }
  return best;
}