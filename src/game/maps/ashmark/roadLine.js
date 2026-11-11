// Line tools for the Ashmark's roads: smooth a list of control points, round the corners of a straight-legged one,
// resample at an even step, find the nearest point on a sampled road, and ease a height profile. Plain arrays;
// roads.js does the laying out.

/** Catmull-Rom through pts ([x, z]), closed when loop. Returns points about `fine` metres apart. */
export function smoothLine(pts, loop, fine = 3) {
  const n = pts.length, out = [], last = loop ? n : n - 1;
  const at = (i) => (loop ? pts[((i % n) + n) % n] : pts[i < 0 ? 0 : i >= n ? n - 1 : i]);
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / fine));
    for (let j = 0; j < k; j++) out.push([cr(p0[0], p1[0], p2[0], p3[0], j / k), cr(p0[1], p1[1], p2[1], p3[1], j / k)]);
  }
  if (!loop) out.push(pts[n - 1].slice());
  return out;
}

/** A straight-legged line with every corner rounded over `cut` metres of each leg (it stays inside a 9 m road bed). */
export function roundCorners(pts, cut = 10) {
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ka = Math.min(cut, la / 2) / la, kc = Math.min(cut, lc / 2) / lc;
    const p = [b[0] + (a[0] - b[0]) * ka, b[1] + (a[1] - b[1]) * ka], q = [b[0] + (c[0] - b[0]) * kc, b[1] + (c[1] - b[1]) * kc];
    for (let j = 0; j <= 4; j++) {
      const t = j / 4, u = 1 - t;
      out.push([u * u * p[0] + 2 * u * t * b[0] + t * t * q[0], u * u * p[1] + 2 * u * t * b[1] + t * t * q[1]]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/** Points an even step apart along a line: { pts, ds }. An open line keeps both ends; a loop does not repeat its start. */
export function resample(line, step, loop) {
  const src = loop ? [...line, line[0]] : line;
  let total = 0;
  for (let i = 1; i < src.length; i++) total += Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]);
  const n = Math.max(1, Math.round(total / step)), ds = total / n, count = loop ? n : n + 1, out = [src[0].slice()];
  let i = 1, acc = 0, want = ds;
  while (out.length < count && i < src.length) {
    const a = src[i - 1], b = src[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > 0 && acc + l >= want - 1e-6) { const t = (want - acc) / l; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); want += ds; }
    else { acc += l; i++; }
  }
  if (!loop) { while (out.length < count) out.push(src[src.length - 1].slice()); out[n] = src[src.length - 1].slice(); }
  return { pts: out, ds };
}

/** Nearest point on a sampled road (P: [{ x, z, y }]): { x, z, y, i, t, d, dx, dz } (dx, dz: the way the road runs there). */
export function nearestOn(P, loop, x, z) {
  const n = P.length, last = loop ? n : n - 1;
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i < last; i++) {
    const a = P[i], b = P[(i + 1) % n], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + dx * t - x, pz = a.z + dz * t - z, d = px * px + pz * pz;
    if (d < best) { best = d; bi = i; bt = t; }
  }
  const a = P[bi], b = P[(bi + 1) % n], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: a.x + (b.x - a.x) * bt, z: a.z + (b.z - a.z) * bt, y: a.y + (b.y - a.y) * bt, i: bi, t: bt, d: Math.sqrt(best), dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
}

/** The point `s` metres along a sampled road (samples ds apart): { x, z, y, s, dx, dz } (dx, dz: the way it runs). */
export function pointAt(P, ds, s) {
  const u = Math.min(P.length - 1 - 1e-9, Math.max(0, s / ds)), i = Math.floor(u), t = u - i, a = P[i], b = P[i + 1];
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, s, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
}

/**
 * Sharp corners must be level, or the two legs disagree about the ground inside the bend. Every free sample where
 * the line (pts: [x, z]) turns more than `sharp` radians forms one node with the free sample before and after it.
 * Returns { node (the node of every sample), count }: ease the profile by node and copy it back.
 */
export function levelNodes(pts, pin, sharp = 0.35) {
  const n = pts.length, hot = new Uint8Array(n), node = new Int32Array(n);
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const d = Math.atan2(c[0] - b[0], c[1] - b[1]) - Math.atan2(b[0] - a[0], b[1] - a[1]);
    if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) > sharp) hot[i - 1] = hot[i] = hot[i + 1] = 1;
  }
  let k = -1;
  for (let i = 0; i < n; i++) { if (!(i > 0 && hot[i] && hot[i - 1] && !pin[i] && !pin[i - 1])) k++; node[i] = k; }
  return { node, count: k + 1 };
}

/** A box blur over ±r samples, `times` passes. Pinned samples stay where they are. */
export function blurProfile(Y, r, times, pin, loop) {
  const n = Y.length, T = new Float64Array(n);
  for (let p = 0; p < times; p++) {
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const j = loop ? (((i + k) % n) + n) % n : i + k; if (j >= 0 && j < n) { s += Y[j]; c++; } }
      T[i] = pin[i] ? Y[i] : s / c;
    }
    Y.set(T);
  }
}

/** Eases a height profile until no step is steeper than grade (rise over run). Returns the steepest step left. */
export function easeProfile(Y, ds, grade, pin, loop, passes = 4000) {
  const n = Y.length, max = grade * ds, last = loop ? n : n - 1;
  // First bring every free sample inside the cone of every pinned one: what the grade lets the road reach from there.
  const lo = new Float64Array(n).fill(-Infinity), hi = new Float64Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) if (pin[i]) lo[i] = hi[i] = Y[i];
  for (let i = 1; i < n; i++) { lo[i] = Math.max(lo[i], lo[i - 1] - max); hi[i] = Math.min(hi[i], hi[i - 1] + max); }
  for (let i = n - 2; i >= 0; i--) { lo[i] = Math.max(lo[i], lo[i + 1] - max); hi[i] = Math.min(hi[i], hi[i + 1] + max); }
  for (let i = 0; i < n; i++) if (!pin[i]) Y[i] = Y[i] < lo[i] ? lo[i] : Y[i] > hi[i] ? hi[i] : Y[i];
  const fix = (i) => {
    const j = (i + 1) % n, d = Y[j] - Y[i], over = Math.abs(d) - max;
    if (over <= 1e-4 || (pin[i] && pin[j])) return false;
    const m = over * Math.sign(d);
    if (pin[i]) Y[j] -= m; else if (pin[j]) Y[i] += m; else { Y[i] += m / 2; Y[j] -= m / 2; }
    return true;
  };
  for (let p = 0; p < passes; p++) {
    let moved = false;
    for (let i = 0; i < last; i++) if (fix(i)) moved = true;
    for (let i = last - 1; i >= 0; i--) if (fix(i)) moved = true;
    if (!moved) break;
  }
  let worst = 0;
  for (let i = 0; i < last; i++) worst = Math.max(worst, Math.abs(Y[(i + 1) % n] - Y[i]) / ds);
  return worst;
}