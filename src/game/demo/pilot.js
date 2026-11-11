// Scripted piloting for the demo scenes. Everything goes through the controls a player has: the helicopter's
// W / A / S / D / Q / E / Space / Shift (game.air.hold) and the shared AI gunnery (reaction, lead, bursts).
import { aimAndFire, holdFire, lineOfSight, nearestHostile } from "@/game/ai/steer";

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Helicopter controls for the next few steps: fwd W(+1) / S(-1), right D(+1) / A(-1), turn E(+1) / Q(-1), up Space, down Shift.
export function heli(game, c = {}) {
  game.air.hold({ fwd: 0, right: 0, turn: 0, up: false, down: false, ...c }, 0.06);
}

// Climb / descend / hover to a height above the ground, with a dead band so it does not hunt.
export function holdAlt(s, agl, band = 1.6) {
  const d = agl - s.alt;
  return { up: d > band, down: d < -band };
}

// Distance and heading error (+ = target is to the right, so turn with E) from the craft to a point.
export function bearing(s, x, z) {
  const dx = x - s.pos.x, dz = z - s.pos.z;
  return { dist: Math.hypot(dx, dz), err: wrap(Math.atan2(-dx, -dz) - s.yaw) };
}

// Guns and rockets at the nearest hostile in range, through the same aim code the AI uses. Returns the target.
export function engage(game, v, range) {
  const t = nearestHostile(game, v, range);
  if (!t) { holdFire(v); return null; }
  const d = t.pos.distanceTo(v.pos);
  aimAndFire(game, v, t, d, lineOfSight(game, v, t, d));
  return t;
}
