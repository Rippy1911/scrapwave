// Rolling replay buffer: every vehicle's pose, steer, turbo and wheel state at REPLAY.hz for REPLAY.keep seconds,
// plus an event ring (shots, hits, parts off, explosions). Fixed preallocated frames, no per-sample garbage.
import { REPLAY } from "@/game/data/tuning";

export const MAXV = 48, MAXW = 6, STRIDE = 10 + MAXW * 2;
const N = REPLAY.hz * REPLAY.keep, MAXE = 2400;

export function createRecorder(game) {
  const frames = Array.from({ length: N }, () => ({ t: 0, n: 0, vs: new Array(MAXV), d: new Float32Array(MAXV * STRIDE) }));
  const events = [];
  let head = 0, count = 0, acc = 0;

  function sample() {
    const f = frames[head];
    f.t = game.time; f.n = 0;
    for (const v of game.vehicles) {
      if (f.n >= MAXV || !v.mesh.root.parent) continue;
      const o = f.n * STRIDE, d = f.d;
      d[o] = v.pos.x; d[o + 1] = v.pos.y; d[o + 2] = v.pos.z;
      d[o + 3] = v.quat.x; d[o + 4] = v.quat.y; d[o + 5] = v.quat.z; d[o + 6] = v.quat.w;
      d[o + 7] = v.steer || 0; d[o + 8] = v.alive ? 1 : 0; d[o + 9] = v.turboActive ? 1 : 0;
      const ws = v.wheelState || [];
      for (let i = 0; i < MAXW; i++) {
        const w = ws[i];
        d[o + 10 + i * 2] = w && w.contact ? w.comp : -1;
        d[o + 11 + i * 2] = w ? w.spin : 0;
      }
      f.vs[f.n++] = v;
    }
    head = (head + 1) % N;
    count = Math.min(N, count + 1);
  }

  const at = (i) => frames[(head - count + i + N) % N];

  return {
    // Called every fixed sim step.
    step(dt) {
      acc += dt;
      if (acc < 1 / REPLAY.hz) return;
      acc -= 1 / REPLAY.hz;
      sample();
      const cut = game.time - REPLAY.keep;
      while (events.length && (events[0].t < cut || events.length > MAXE)) events.shift();
    },
    event(type, a, b = null, s = 1) {
      events.push({ t: game.time, type, x: a.x, y: a.y, z: a.z, x2: b ? b.x : 0, y2: b ? b.y : 0, z2: b ? b.z : 0, s });
    },
    count: () => count,
    oldest: () => (count ? at(0).t : game.time),
    newest: () => (count ? at(count - 1).t : game.time),
    // Index i with frame(i).t <= t < frame(i + 1).t (clamped), for interpolation.
    find(t) {
      let lo = 0, hi = count - 1;
      if (hi < 1) return 0;
      if (t <= at(0).t) return 0;
      if (t >= at(hi).t) return hi - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (at(m).t <= t) lo = m; else hi = m; }
      return lo;
    },
    frame: at,
    events,
    clear() { head = 0; count = 0; events.length = 0; },
  };
}