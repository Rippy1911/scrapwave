// Lap timing for one car on a race track (pure). The clock starts at GO. Checkpoints count in order when the car
// crosses their line inside the gate; crossing the start line after all of them ends the lap. Keeps the current,
// last and best lap, the split at every checkpoint and the gap to the best lap's split there.
// Point-to-point tracks: one run from the start to the last checkpoint.
export function createLapTimer(track, laps = 3, best = null) {
  const cps = track.checkpoints, n = cps.length, closed = track.closed;
  const T = {
    t: 0, lap: 1, laps: closed ? laps : 1, lapT: 0, next: closed ? 0 : 1, passed: 0, last: null, done: false, total: null,
    best: best ? best.time : null, bestSplits: best ? best.splits : null, splits: [], delta: null, isBest: false,
  };
  let side = null;

  /** Call every step with the car's position. Returns null, or what just happened:
   *  { type: "checkpoint", n, split, delta } | { type: "lap", lap, time, best } | { type: "finish", time, total, best } */
  T.step = (dt, x, z, y = null) => { // y: only gates on the car's level count (stacked roads)
    if (T.done) return null;
    T.t += dt; T.lapT += dt;
    const c = cps[T.next], dx = x - c.x, dz = z - c.z, along = dx * c.tx + dz * c.tz, across = dx * c.nx + dz * c.nz;
    const was = side;
    side = Math.abs(across) < c.w / 2 + 6 && Math.abs(along) < 14 && (y === null || Math.abs(y - c.y) < 7) ? along : null;
    if (was === null || side === null || was >= 0 || side < 0) return null;
    side = null;
    T.passed++;
    const lineHit = closed ? T.next === 0 : T.next === n - 1;
    T.next = closed ? (T.next + 1) % n : T.next + 1;
    if (closed && T.passed === 1) return null; // the first roll over the start line: nothing to report
    if (!lineHit) {
      T.splits[c.n] = T.lapT;
      T.delta = T.bestSplits && T.bestSplits[c.n] != null ? T.lapT - T.bestSplits[c.n] : null;
      return { type: "checkpoint", n: c.n, split: T.lapT, delta: T.delta };
    }
    const time = T.lapT, isBest = T.best === null || time < T.best;
    T.last = time; T.isBest = isBest; T.delta = T.best === null ? null : time - T.best;
    if (isBest) { T.best = time; T.bestSplits = T.splits.slice(); }
    T.splits = []; T.lapT = 0;
    if (T.lap >= T.laps) { T.done = true; T.total = T.t; return { type: "finish", time, total: T.t, best: isBest }; }
    T.lap++;
    return { type: "lap", lap: T.lap, time, best: isBest };
  };
  /** How far round the race the car is at lap distance s (bigger = further ahead): for places. */
  T.progress = (s) => {
    const prev = cps[(T.next - 1 + n) % n], seg = track.ahead(cps[T.next % n].s, prev.s) || track.length;
    return T.passed + Math.min(0.999, Math.max(0, track.ahead(s, prev.s) / seg));
  };
  return T;
}

/** 83.456 -> "1:23.456" (ms: false -> "1:23.4"). */
export function lapText(t, ms = true) {
  if (t == null) return "--:--";
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${ms ? s.toFixed(3) : (Math.floor(s * 10) / 10).toFixed(1)}`;
}