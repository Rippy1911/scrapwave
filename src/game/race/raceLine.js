// The AI race line for a track (race/track.js). Pure data.
//  - a waypoint about every 8 m, grouped by the checkpoint it leads to
//  - sideways offset: the smoothest line the road allows (wide in, apex, wide out), kept off the kerbs
//  - a target speed at every waypoint from how tight the line is there, pulled down ahead of tight turns so a
//    car has room to slow: the start of each of those stretches is a braking point
//  - jumps: the line runs dead straight through the run-up, the gap and the landing, and the run-up carries the
//    speed needed to clear the gap (vMin), so cars arrive lined up and fast enough
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cross = (ax, az, bx, bz) => ax * bz - az * bx;

export const LINE = { spacing: 8, margin: 2.4, vTop: 40, aLat: 11, aBrake: 11, aAccel: 6, gravity: 15, runUp: 60, runOut: 26, brakeDrop: 4, sweeps: 240, shorten: 0.12 };

export function buildRaceLine(track, opts = {}) {
  const O = { ...LINE, ...opts }, closed = track.closed, L = track.length;
  const M = Math.max(8, Math.round(L / O.spacing)) + (closed ? 0 : 1), sp = L / (closed ? M : M - 1);
  const wi = (j) => (closed ? ((j % M) + M) % M : clamp(j, 0, M - 1));
  const cps = track.checkpoints;
  const W = [];
  for (let j = 0; j < M; j++) {
    const c = track.at(j * sp), g = track.gapZone(j * sp, O.runUp, O.runOut);
    let cp = cps.findIndex((k) => k.s > j * sp + 0.01);
    if (cp < 0) cp = closed ? 0 : cps.length - 1;
    W.push({ j, s: j * sp, i: c.i, cx: c.x, cz: c.z, y: c.y, tx: c.tx, tz: c.tz, nx: c.nx, nz: c.nz, w: c.w, air: c.gap, lim: Math.max(0, c.w / 2 - O.margin), d: 0, x: c.x, z: c.z, pin: !closed && (j < 2 || j > M - 3), gap: g, cp, k: 0, v: O.vTop, vMin: 0, brake: false });
  }

  // Jumps: pin the line to the straight through the lip, along the lip's heading.
  for (const p of W) {
    const g = p.gap;
    if (!g) continue;
    const lip = track.samples[g.i0], den = cross(p.nx, p.nz, lip.tx, lip.tz);
    p.d = Math.abs(den) > 0.3 ? clamp(cross(lip.x - p.cx, lip.z - p.cz, lip.tx, lip.tz) / den, -p.lim, p.lim) : 0;
    p.x = p.cx + p.nx * p.d; p.z = p.cz + p.nz * p.d; p.pin = true;
  }

  // Smoothest line: each waypoint slides across the road to where the bend through its neighbours is least.
  const a4 = 4 + O.shorten, den = 6 + 2 * O.shorten;
  for (let it = 0; it < O.sweeps; it++) {
    for (let j = 0; j < M; j++) {
      const p = W[j];
      if (p.pin) continue;
      const a = W[wi(j - 2)], b = W[wi(j - 1)], c = W[wi(j + 1)], e = W[wi(j + 2)];
      const gx = (a4 * (b.x + c.x) - (a.x + e.x)) / den, gz = (a4 * (b.z + c.z) - (a.z + e.z)) / den;
      const want = clamp((gx - p.cx) * p.nx + (gz - p.cz) * p.nz, -p.lim, p.lim);
      p.d = clamp(p.d + (want - p.d) * 1.5, -p.lim, p.lim);
      p.x = p.cx + p.nx * p.d; p.z = p.cz + p.nz * p.d;
    }
  }

  // How tight the line is (1/m, positive = bending right), then the speed the grip allows there.
  const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z) || 1e-3;
  const raw = W.map((p, j) => {
    const a = W[wi(j - 1)], c = W[wi(j + 1)];
    return a === p || c === p ? 0 : (2 * cross(p.x - a.x, p.z - a.z, c.x - p.x, c.z - p.z)) / (dist(a, p) * dist(p, c) * dist(a, c));
  });
  W.forEach((p, j) => {
    p.k = 0.25 * raw[wi(j - 1)] + 0.5 * raw[j] + 0.25 * raw[wi(j + 1)];
    p.v = Math.min(O.vTop, Math.sqrt(O.aLat / Math.max(1e-4, Math.abs(p.k))));
  });

  // Jumps: the take-off speed that clears the gap (plus a car length), with the lip's slope and the drop.
  const jumps = track.gaps.map((g) => {
    const x = g.len + 4, th = Math.atan(g.slope), rise = x * Math.tan(th) + g.drop;
    const need = rise > 0.05 ? Math.sqrt((O.gravity * x * x) / (2 * Math.cos(th) ** 2 * rise)) * 1.12 : O.vTop;
    return { gap: g, s0: g.s0, s1: g.s1, len: g.len, speed: Math.min(O.vTop, need), clear: need <= O.vTop };
  });

  // Braking: going backwards, no waypoint may be faster than a car can slow from before the next one (nothing
  // slows in the air). Going forwards, none faster than a car can have built up. Twice round, so a lap joins up.
  const loops = closed ? 2 : 1;
  for (let n = 0; n < loops; n++) for (let j = M - 1; j >= 0; j--) {
    const p = W[j], q = W[wi(j + 1)];
    if (q !== p) p.v = Math.min(p.v, p.air ? q.v : Math.sqrt(q.v * q.v + 2 * O.aBrake * dist(p, q)));
  }
  if (!closed) W[0].v = Math.min(W[0].v, 6);
  for (let n = 0; n < loops; n++) for (let j = 0; j < M; j++) {
    const p = W[j], q = W[wi(j - 1)];
    if (q !== p) p.v = Math.min(p.v, Math.sqrt(q.v * q.v + 2 * O.aAccel * dist(q, p)));
  }
  for (const p of W) {
    const jump = p.gap && jumps.find((x) => x.gap === p.gap);
    if (jump && track.ahead(p.s, jump.s0 - O.runUp) <= O.runUp + jump.len) { p.vMin = jump.speed; p.v = Math.max(p.v, jump.speed); }
  }
  W.forEach((p, j) => { p.brake = W[wi(j + 1)].v < p.v - 0.05; });

  // Braking points: where a slow-down of 4 m/s or more begins.
  const brakePoints = [];
  for (let j = 0; j < M; j++) {
    if (!W[j].brake || (W[wi(j - 1)].brake && (closed || j > 0))) continue;
    let e = j, n = 0;
    while (W[wi(e)].brake && n++ < M) e++;
    const from = W[j].v, to = W[wi(e)].v;
    if (from - to >= O.brakeDrop) brakePoints.push({ j, s: W[j].s, x: W[j].x, z: W[j].z, from, to, dist: (e - j) * sp, turn: W[wi(e)].s });
  }

  /** The line at track distance s: position, target speed, jump speed (vMin), braking flag. */
  function at(s) {
    const u = (closed ? ((s % L) + L) % L : clamp(s, 0, L)) / sp, j = Math.min(Math.floor(u), closed ? M - 1 : M - 2), f = u - j;
    const a = W[j], b = W[wi(j + 1)], mix = (key) => a[key] + (b[key] - a[key]) * f;
    return { j, x: mix("x"), y: mix("y"), z: mix("z"), d: mix("d"), v: mix("v"), k: mix("k"), w: mix("w"), vMin: Math.min(a.vMin, b.vMin), brake: a.brake, air: a.air, jump: !!a.gap, cp: a.cp };
  }
  /** Waypoints from checkpoint c up to the next one. */
  const between = (c) => W.filter((p) => p.cp === (closed ? (c + 1) % cps.length : c + 1));

  return { pts: W, n: M, spacing: sp, brakePoints, jumps, at, between, opts: O };
}