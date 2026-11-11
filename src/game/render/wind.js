// Shared wind for the living-world pass: one slowly veering direction with travelling gusts. Smoke, dust sheets,
// dust devils and tumbleweeds all read it, so everything that drifts leans the same way. The base direction
// matches the dust motes in atmosphere.js (toward +x, a little +z). Pure maths on the render clock: no state
// to step, and every caller of tickWind(time) in the same frame sees the same values.

export const WIND = { x: 0.936, z: 0.351, speed: 4, time: -1, mul: 1 }; // mul: the Wind rule (0 calm .. 2 gale), set by world/sky/skyCycle.js
const BASE = Math.atan2(0.351, 0.936);

/** Advance the wind to render time `time` (seconds). Idempotent within a frame. */
export function tickWind(time) {
  if (time === WIND.time) return WIND;
  WIND.time = time;
  const a = BASE + Math.sin(time * 0.013) * 0.22 + Math.sin(time * 0.041 + 1.3) * 0.08;
  WIND.x = Math.cos(a); WIND.z = Math.sin(a);
  WIND.speed = (4 + Math.sin(time * 0.071) * 1.2 + Math.max(0, Math.sin(time * 0.23 + 0.7)) * 1.6) * WIND.mul;
  return WIND;
}

/** Wind speed (m/s) at a point: gust fronts travel downwind, so neighbours gust together and far points differ. */
export function windSpeedAt(x, z) {
  const t = WIND.time, along = x * WIND.x + z * WIND.z;
  const g = 0.8 + 0.3 * Math.sin(t * 0.9 - along * 0.035) + 0.15 * Math.sin(t * 2.1 + x * 0.05 - z * 0.04);
  return WIND.speed * g;
}