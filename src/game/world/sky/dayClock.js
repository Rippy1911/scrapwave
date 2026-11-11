// The hour of the day (round 14). Rules: timeOfDay is the starting hour, dayCycle how fast it runs. Pure maths.
// The sun rises at 6 and sets at 18. At hours 9 and 15 it stands exactly where the game's tuned daylight has it,
// so the Classic rules (hour 9) open on the same light as before.
export const DAY_MINUTES = { off: 0, slow: 48, normal: 24, fast: 6 }; // real minutes for one full day

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function createDayClock() {
  let hour = 9, rate = 0; // rate: game hours per real second
  return {
    set(h, cycle) { hour = (((+h || 0) % 24) + 24) % 24; rate = DAY_MINUTES[cycle] ? 24 / (DAY_MINUTES[cycle] * 60) : 0; },
    setHour(h) { hour = (((+h || 0) % 24) + 24) % 24; },
    step(dt) { hour = (hour + rate * dt) % 24; return hour; },
    hour: () => hour,
    rate: () => rate,
  };
}

// Sun elevation in degrees for an hour; tuned: the elevation of the game's daylight (RENDER.sunElevation).
export const sunElevation = (hour, tuned) => (tuned / Math.SQRT1_2) * Math.sin(((hour - 6) / 12) * Math.PI);
// The sun swings only a little in compass direction, so the warm side of the ground haze stays under it.
export const sunAzimuth = (hour, base) => base + (hour - 9) * 4;

// Blend weights by elevation: night is full 8 degrees under the horizon, dusk and dawn peak just above it.
export const nightK = (elev) => clamp01((2 - elev) / 10);
export const duskK = (elev) => clamp01(1 - Math.abs(elev - 2) / 11);
export const phaseOf = (elev) => (elev < -3 ? "night" : elev < 8 ? "dusk" : "day");

// "07:30"
export const clockText = (hour) => `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.floor((hour % 1) * 60)).padStart(2, "0")}`;