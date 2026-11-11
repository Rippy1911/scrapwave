// A quick model of one AI car lapping a track (pure, no physics engine): race/raceBrain.js drives a point car with
// roughly the game's acceleration, braking, steering and gravity. ?racecheck=1 prints its lap as the expected time,
// and it shows whether the race line stays off the walls and clears every jump before a real car tries it.
import { planDrive } from "@/game/race/raceBrain";
import { createLapTimer } from "@/game/race/lapTimer";

const G = 15, DT = 1 / 60;

export function simLap(track, line, { vTop = 42, laps = 2, vScale = 1, maxTime = 900 } = {}) {
  const g = track.grid(0);
  const c = { x: g.x, z: g.z, y: g.y, fx: -Math.sin(g.heading), fz: -Math.cos(g.heading), speed: 0, half: 1, grounded: true, vScale, vTop, bias: 0 };
  const st = {}, timer = createLapTimer(track, laps), times = [];
  let hint = -1, air = null, walls = 0, jumps = 0, landed = 0, offT = 0, resets = 0, top = 0;
  for (let t = 0; t < maxTime && !timer.done; t += DT) {
    const l = track.locate(c.x, c.z, hint);
    hint = l.i; c.d = l.d; c.s = ((l.s % track.length) + track.length) % track.length;
    const out = planDrive(st, DT, c, track, line, track.obstacles), at = track.at(c.s);
    if (air) {
      air.vy -= G * DT; c.y += air.vy * DT;
      if (!at.gap) { jumps++; if (c.y >= at.y - 0.5) landed++; air = null; c.y = at.y; }
    } else if (at.gap) { const gap = track.gapZone(c.s); air = { vy: c.speed * Math.sin(Math.atan(gap ? gap.slope : 0)) }; } else c.y = at.y;
    c.grounded = !air;
    if (c.grounded) {
      const lock = 0.55 - 0.4 * Math.min(1, c.speed / 40), cap = 13 / Math.max(3, c.speed);
      const yaw = Math.max(-cap, Math.min(cap, (c.speed * Math.tan(out.steer * lock)) / 2.6));
      const fx = c.fx - c.fz * yaw * DT, fz = c.fz + c.fx * yaw * DT, len = Math.hypot(fx, fz);
      c.fx = fx / len; c.fz = fz / len;
      c.speed = Math.max(0, c.speed + (out.throttle * 8 * (out.turbo ? 1.6 : 1) * Math.max(0, 1 - c.speed / (vTop * 1.15)) - out.brake * 14) * DT);
    }
    c.x += c.fx * c.speed * DT; c.z += c.fz * c.speed * DT;
    top = Math.max(top, c.speed);
    if (!at.gap && Math.abs(c.d) > at.w / 2 - c.half + 0.6) walls++;
    offT = out.off ? offT + DT : 0;
    if (offT > 1.2) { const p = track.resetPose(c.s); Object.assign(c, { x: p.x, z: p.z, y: p.y, fx: -Math.sin(p.heading), fz: -Math.cos(p.heading), speed: 0 }); hint = -1; offT = 0; resets++; }
    const e = timer.step(DT, c.x, c.z, c.y);
    if (e && e.type !== "checkpoint") times.push(e.time);
  }
  return { done: timer.done, times, lap: times.length ? Math.min(...times) : null, wallFrames: walls, jumps, landed, resets, topKmh: Math.round(top * 3.6) };
}