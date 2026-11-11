// Finds the solid things standing on a race track's road (wrecks, crates, pillars, walls that reach into it) and
// writes them in track terms, { s, d, r }: distance round the lap, metres right of the centre line, radius. The race
// AI (race/raceBrain.js) steers round them. The track's own barriers and road slabs are skipped; long boxes become a
// row of circles.
export function scanObstacles(track, colliders) {
  const out = [], B = track.bounds;
  for (const b of colliders.all) {
    if (b.dead || b.noCollide || b.tag === "track" || b.tag === "road" || b.kind === "wedge") continue;
    const reach = Math.hypot(b.hx, b.hz);
    if (b.x + reach < B.x0 || b.x - reach > B.x1 || b.z + reach < B.z0 || b.z - reach > B.z1) continue;
    const alongZ = b.hz >= b.hx, long = Math.max(b.hx, b.hz), short = Math.min(b.hx, b.hz);
    const r = Math.max(0.6, short * 1.2), n = Math.max(1, Math.ceil(long / Math.max(r, 1.5)));
    const ax = alongZ ? b.sin : b.cos, az = alongZ ? b.cos : -b.sin; // the box's long axis in the world
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0 : (k / (n - 1)) * 2 - 1, x = b.x + ax * t * (long - r), z = b.z + az * t * (long - r);
      const at = track.locate(x, z), p = track.samples[at.i];
      if (p.gap || Math.abs(at.d) - r > p.w / 2) continue; // not on the road
      if (b.y + b.hy < p.y + 0.4 || b.y - b.hy > p.y + 2.5) continue; // under the road (the floor) or overhead
      out.push({ s: at.s, d: at.d, r, v: 0 });
    }
  }
  return out;
}