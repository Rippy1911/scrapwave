// Race track outlines the easy way: a list of street corners, [x, z, { r, y, w, gap, open, cut, zone }]. A vertex
// with r is a corner of that radius between the vertex before it and the one after; without r the road passes
// straight through the point. Every flag of a vertex holds until the next vertex. Returns race/spline.js points,
// spaced evenly enough (a point every 25 degrees of a corner, every 50 m of a straight) for the spline to stay true.
//   y     height of the road above the map floor (straight inclines between vertices)
//   w     road width
//   gap   no road to the next vertex (a jump)       open  no barriers to the next vertex
//   cut   a shortcut skips this stretch, so no checkpoint stands on it
//   zone  a name the map uses to place things along this stretch (maps/race/raceLayout.js zone())
const STEP = 50, ARC = (25 * Math.PI) / 180;

export function roundCorners(verts) {
  const V = verts.map(([x, z, o = {}]) => ({ x, z, ...o })), n = V.length, pts = [];
  for (let i = 0; i < n; i++) {
    const { r, x, z, ...flags } = V[i];
    if (!r) { pts.push({ ...flags, x, z }); continue; }
    const p = V[(i - 1 + n) % n], q = V[(i + 1) % n];
    let ax = x - p.x, az = z - p.z, bx = q.x - x, bz = q.z - z;
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    ax /= la; az /= la; bx /= lb; bz /= lb;
    const half = Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz))) / 2; // half the turn
    if (half < 0.02) { pts.push({ ...flags, x, z }); continue; }
    const t = Math.min(r * Math.tan(half), la * 0.45, lb * 0.45), R = t / Math.tan(half); // a corner may not eat more than half a street
    const ux = bx - ax, uz = bz - az, lu = Math.hypot(ux, uz), cd = R / Math.cos(half);
    const cx = x + (ux / lu) * cd, cz = z + (uz / lu) * cd; // the corner's centre
    const sx = x - ax * t - cx, sz = z - az * t - cz, turn = Math.sign(ax * bz - az * bx) * 2 * half, m = Math.max(2, Math.ceil((2 * half) / ARC));
    // Heights run in straight inclines from vertex to vertex; the corner takes its share of both.
    const yv = flags.y || 0, y0 = yv + ((p.y || 0) - yv) * (t / la), y1 = yv + ((q.y || 0) - yv) * (t / lb);
    for (let k = 0; k <= m; k++) {
      const a = (turn * k) / m, c = Math.cos(a), s = Math.sin(a), f = k / m;
      pts.push({ ...flags, y: f < 0.5 ? y0 + (yv - y0) * f * 2 : yv + (y1 - yv) * (f * 2 - 1), x: cx + sx * c - sz * s, z: cz + sx * s + sz * c });
    }
  }
  // Long straights: a point every 50 m, heights on a straight incline.
  const out = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length], len = Math.hypot(b.x - a.x, b.z - a.z), k = Math.max(1, Math.round(len / STEP));
    for (let j = 0; j < k; j++) {
      const f = j / k;
      out.push({ ...a, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * f });
    }
  });
  return out;
}

/** Vertices round a circle (a spiral when y0 differs from y1): centre, radius, start and end angle in degrees. */
export function arcVerts(cx, cz, rad, a0, a1, o = {}, y0 = 0, y1 = y0) {
  const n = Math.max(2, Math.round(Math.abs(a1 - a0) / 30)), out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + Math.sin(a) * rad, cz + Math.cos(a) * rad, { ...o, y: y0 + ((y1 - y0) * i) / n }]);
  }
  return out;
}