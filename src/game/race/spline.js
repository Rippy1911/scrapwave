// Race track centre line (pure maths, no three.js): a Catmull-Rom spline through the track's points, resampled at
// even steps. Every sample knows its distance along the lap (s), tangent (tx, tz), side normal (nx, nz), signed
// curvature k (1/m, positive = the track bends toward +n), road width w and whether it sits over a gap.
//
// Points: [x, z] | [x, z, y] | { x, z, y, w, gap, open }
//   y     height above the ground (ramps, bridges): straight inclines between points
//   w     road width from this point on, blended to the next point
//   gap   no road on the stretch to the next point (a jump)
//   open  no barriers on the stretch to the next point

const SUB = 20;
const pt = (p) => (Array.isArray(p) ? { x: p[0], z: p[1], y: p[2] || 0 } : p);
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** opts.ground(x, z): height of the ground under the track (added to every point's y). */
export function buildSpline(points, { closed = true, step = 2, width = 14, ground = null } = {}) {
  const P = points.map(pt), n = P.length, segs = closed ? n : n - 1;
  const cp = (i) => (closed ? P[((i % n) + n) % n] : P[clamp(i, 0, n - 1)]);
  const xz = (seg, t) => {
    const a = cp(seg - 1), b = cp(seg), c = cp(seg + 1), d = cp(seg + 2);
    return [cr(a.x, b.x, c.x, d.x, t), cr(a.z, b.z, c.z, d.z, t)];
  };

  // 1. A dense polyline, to measure the lap.
  const dense = [], from = []; // from[i]: the lap distance where the stretch after point i begins
  let len = 0;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < SUB + (i === segs - 1 ? 1 : 0); j++) {
      const [x, z] = xz(i, j / SUB), prev = dense[dense.length - 1];
      if (prev) len += Math.hypot(x - prev.x, z - prev.z);
      if (j === 0) from[i] = len;
      dense.push({ x, z, len, u: i + j / SUB });
    }
  }
  from[segs] = len;

  // 2. Even samples along it.
  const count = Math.max(8, Math.round(len / step)), ds = len / count, N = closed ? count : count + 1, S = [];
  const idx = (i) => (closed ? ((i % N) + N) % N : clamp(i, 0, N - 1));
  for (let j = 0, k = 0; j < N; j++) {
    const s = j * ds;
    while (k < dense.length - 2 && dense[k + 1].len <= s) k++;
    const a = dense[k], b = dense[k + 1], f = b.len > a.len ? clamp((s - a.len) / (b.len - a.len), 0, 1) : 0;
    const u = a.u + (b.u - a.u) * f, seg = Math.min(segs - 1, Math.floor(u)), t = u - seg, p = cp(seg), q = cp(seg + 1);
    const [x, z] = xz(seg, t), m = clamp((s - from[seg]) / (from[seg + 1] - from[seg] || 1), 0, 1); // by distance: inclines are straight
    S.push({
      s, x, z, y: 0, seg, lift: (p.y || 0) + ((q.y || 0) - (p.y || 0)) * m,
      w: (p.w || width) + ((q.w || width) - (p.w || width)) * m, gap: !!p.gap, open: !!p.open, cut: !!p.cut,
    });
  }

  // 3. Heights: soften the kinks where inclines meet, but keep ramp lips and landings exact.
  for (let pass = 0; pass < 2; pass++) {
    const lifts = S.map((p, i) => {
      for (let o = -5; o <= 5; o++) if (S[idx(i + o)].gap) return p.lift;
      return 0.25 * S[idx(i - 1)].lift + 0.5 * p.lift + 0.25 * S[idx(i + 1)].lift;
    });
    S.forEach((p, i) => { p.lift = lifts[i]; });
  }
  for (const p of S) p.y = p.lift + (ground ? ground(p.x, p.z) : 0);

  // 4. Tangent, side normal, curvature (heading change over +-2 samples, which smooths the sampling noise).
  for (let i = 0; i < N; i++) {
    const a = S[idx(i - 1)], b = S[idx(i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, p = S[i];
    p.tx = (b.x - a.x) / l; p.tz = (b.z - a.z) / l; p.nx = -p.tz; p.nz = p.tx;
  }
  for (let i = 0; i < N; i++) {
    const ia = closed ? i - 2 : idx(i - 2), ib = closed ? i + 2 : idx(i + 2), a = S[idx(ia)], b = S[idx(ib)];
    S[i].k = Math.asin(clamp(a.tx * b.tz - a.tz * b.tx, -1, 1)) / ((ib - ia) * ds || 1);
  }

  /** The sample nearest (x, z). hint: the last index found (searches +-win around it). d: offset toward +n. */
  function nearest(x, z, hint = -1, win = 40) {
    let best = 0, bd = Infinity;
    const test = (i) => { const p = S[i], d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z); if (d < bd) { bd = d; best = i; } };
    if (hint >= 0) for (let o = -win; o <= win; o++) test(idx(hint + o));
    if (hint < 0 || bd > 2500) { // no hint, or it was carried far from the hint: look at the whole lap
      for (let i = 0; i < N; i += 4) test(i);
      for (let c = best, o = -4; o <= 4; o++) test(idx(c + o));
    }
    const p = S[best], dx = x - p.x, dz = z - p.z;
    return { i: best, s: p.s + dx * p.tx + dz * p.tz, d: dx * p.nx + dz * p.nz, dist: Math.sqrt(bd) };
  }

  /** The centre line at distance s (wraps on a closed lap). */
  function at(s) {
    const u = (closed ? ((s % len) + len) % len : clamp(s, 0, len)) / ds;
    const i = Math.min(Math.floor(u), closed ? N - 1 : N - 2), f = u - i, a = S[i], b = S[idx(i + 1)];
    const L = (key) => a[key] + (b[key] - a[key]) * f;
    return { i, x: L("x"), y: L("y"), z: L("z"), tx: L("tx"), tz: L("tz"), nx: L("nx"), nz: L("nz"), w: L("w"), k: L("k"), gap: a.gap };
  }

  return { samples: S, n: N, length: len, step: ds, closed, idx, nearest, at };
}