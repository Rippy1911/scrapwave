// A race track from a list of points (race/spline.js). Pure data: the road with its width, the barrier pieces down
// both sides, kerbs through the turns, the gaps (jumps), a checkpoint about every 300 m, the start grid and the
// poses cars are put back on. race/trackMesh.js draws it and adds the colliders.
//
// def: { id, name, points, closed = true, width = 14, checkpointEvery = 300, surface = "asphalt" }
import { buildSpline } from "@/game/race/spline";

export const TRACK = { width: 14, checkpointEvery: 300, kerbRadius: 90, kerbW: 1.1, barrierGap: 0.6, outerRadius: 120 };

export function buildTrack(def, { ground = null } = {}) {
  const width = def.width || TRACK.width;
  const line = buildSpline(def.points, { closed: def.closed !== false, step: 2, width, ground });
  const S = line.samples, N = line.n, closed = line.closed, ds = line.step, idx = line.idx, L = line.length;

  // Gaps: runs of samples with no road. i0 = the lip (the last road sample), i1 = the first road sample after it.
  // The road is drawn between two neighbouring samples only when neither is in a gap (see road()).
  const gaps = [];
  for (let i = 0; i < N; i++) {
    if (!S[i].gap || ((closed || i > 0) && S[idx(i - 1)].gap)) continue;
    let j = i;
    while (j - i < N && (closed || j < N - 1) && S[idx(j + 1)].gap) j++;
    const i0 = idx(i - 1), i1 = idx(j + 1), a = S[i0], b = S[i1], len = (j - i + 2) * ds;
    gaps.push({ i0, i1, s0: a.s, s1: a.s + len, len, drop: a.y - b.y, slope: (a.y - S[idx(i0 - 3)].y) / (3 * ds) });
  }
  /** Is there road from sample i to the next one? */
  const road = (i) => (closed || i < N - 1) && !S[i].gap && !S[idx(i + 1)].gap;
  // How far s is past `from` going forward (wraps on a closed lap).
  const ahead = (s, from) => (closed ? (((s - from) % L) + L) % L : s - from);
  /** The gap whose run-up (before m), flight or landing (after m) holds s, else null. */
  const gapZone = (s, before = 0, after = 0) => gaps.find((g) => { const a = ahead(s, g.s0 - before); return a >= 0 && a <= before + g.len + after; }) || null;

  // Checkpoints about every 300 m; 0 is the start/finish line. Never on a run-up, in the air or on a landing.
  const count = Math.max(closed ? 3 : 1, Math.round(L / (def.checkpointEvery || TRACK.checkpointEvery)));
  const checkpoints = [];
  for (let c = 0; c < (closed ? count : count + 1); c++) {
    let i = Math.min(N - 1, Math.round((c * L) / count / ds));
    for (let tries = 0; tries < N && (gapZone(S[i].s, 30, 24) || S[i].cut) && (closed || i < N - 1); tries++) i = idx(i + 1); // nor where a shortcut skips the road
    const p = S[i], last = checkpoints[checkpoints.length - 1];
    if (last && (p.s - last.s < 60 || (closed && L - p.s < 60))) continue; // moved on top of the next one: one gate is enough
    checkpoints.push({ n: checkpoints.length, i, s: p.s, x: p.x, y: p.y, z: p.z, tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz, w: p.w, heading: Math.atan2(-p.tx, -p.tz) });
  }

  // Barriers: 4 m pieces along both edges, none over a gap or an `open` stretch. outer: on the outside of a turn.
  const barriers = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < (closed ? N : N - 1); i += 2) {
      const a = S[i], m = S[idx(i + 1)], b = S[idx(i + 2)];
      if (!road(i) || a.open) continue;
      const e = !road(idx(i + 1)) || m.open ? m : b; // the last piece before a lip stops at the lip
      const ax = a.x + a.nx * side * (a.w / 2 + TRACK.barrierGap), az = a.z + a.nz * side * (a.w / 2 + TRACK.barrierGap);
      const bx = e.x + e.nx * side * (e.w / 2 + TRACK.barrierGap), bz = e.z + e.nz * side * (e.w / 2 + TRACK.barrierGap);
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.2) continue;
      barriers.push({ side, i, x: (ax + bx) / 2, y: (a.y + e.y) / 2, z: (az + bz) / 2, yaw: Math.atan2(bx - ax, bz - az), len, dy: e.y - a.y, outer: m.k * side < -1 / TRACK.outerRadius });
    }
  }

  // Kerbs: the outer 1.1 m of the road on both sides through every turn tighter than 90 m, with a short lead-in.
  for (let i = 0; i < N; i++) {
    let on = false;
    for (let o = -3; o <= 3 && !on; o++) on = Math.abs(S[idx(i + o)].k) > 1 / TRACK.kerbRadius;
    S[i].kerb = on && !S[i].gap;
  }

  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of S) { x0 = Math.min(x0, p.x - p.w); x1 = Math.max(x1, p.x + p.w); z0 = Math.min(z0, p.z - p.w); z1 = Math.max(z1, p.z + p.w); }

  /** A pose on the track at distance s, d metres to the right of the centre line. */
  const pose = (s, d = 0) => { const p = line.at(s); return { x: p.x + p.nx * d, y: p.y, z: p.z + p.nz * d, heading: Math.atan2(-p.tx, -p.tz), s }; };
  /** Start grid slot k: two staggered columns behind the line (in front of it on a point-to-point track). */
  const grid = (k) => { const back = 8 + Math.floor(k / 2) * 9 + (k % 2) * 4; return pose(closed ? -back : Math.max(2, 60 - back), (k % 2 ? 1 : -1) * width * 0.22); };
  /** Back on the road at s: on the centre line, or at the start of the run-up when s is on a jump. */
  const resetPose = (s) => { const g = gapZone(s, 50, 8); return pose(g ? g.s0 - 70 : s); };

  return {
    id: def.id, name: def.name, def, line, samples: S, n: N, step: ds, length: L, closed, width,
    gaps, checkpoints, barriers, bounds: { x0, x1, z0, z1 }, obstacles: [],
    ahead, gapZone, road, pose, grid, resetPose, locate: line.nearest, at: line.at, idx,
  };
}