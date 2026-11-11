// Weather (round 14). Rule: clear, dust, rain, fog, storm, or random (changes on its own every few minutes).
// Each kind is a small set of numbers the sky look reads; kinds cross-fade over about 20 seconds.
// dens: fog density x. tint / tintK: colour the air leans to and how far. dim: sunlight x. gain: sky brightness x.
// hemi: fill light x. rain: rain amount 0..1. stars: how much of the night sky shows.
export const WEATHER_LOOK = {
  clear: { dens: 1, tint: [1, 1, 1], tintK: 0, dim: 1, gain: 1, hemi: 1, rain: 0, stars: 1 },
  dust: { dens: 3, tint: [0.65, 0.44, 0.25], tintK: 0.7, dim: 0.7, gain: 0.8, hemi: 0.95, rain: 0, stars: 0.3 },
  rain: { dens: 2.2, tint: [0.44, 0.47, 0.5], tintK: 0.75, dim: 0.45, gain: 0.55, hemi: 0.85, rain: 0.7, stars: 0 },
  fog: { dens: 5, tint: [0.72, 0.7, 0.66], tintK: 0.85, dim: 0.6, gain: 0.75, hemi: 0.95, rain: 0, stars: 0 },
  storm: { dens: 2.6, tint: [0.25, 0.27, 0.31], tintK: 0.85, dim: 0.25, gain: 0.35, hemi: 0.7, rain: 1, stars: 0 },
};
export const WEATHER_IDS = Object.keys(WEATHER_LOOK);
const ODDS = [["clear", 0.45], ["dust", 0.15], ["rain", 0.15], ["fog", 0.12], ["storm", 0.13]];
const FADE = 20; // seconds for one kind to take over
const NUM = ["dens", "tintK", "dim", "gain", "hemi", "rain", "stars"];

export function createWeather(random = Math.random) {
  const w = Object.fromEntries(WEATHER_IDS.map((k) => [k, k === "clear" ? 1 : 0]));
  const out = { dens: 1, tint: [1, 1, 1], tintK: 0, dim: 1, gain: 1, hemi: 1, rain: 0, stars: 1, flash: 0, thunder: false, kind: "clear" };
  let cur = "clear", mode = "clear", timer = 0, bolt = 6;

  function roll() {
    let r = random();
    for (const [k, p] of ODDS) { if ((r -= p) <= 0) return k; }
    return "clear";
  }

  return {
    out,
    // rule: a kind, or "random". now: jump straight there (a new match) instead of fading.
    set(rule, now = false) {
      mode = WEATHER_LOOK[rule] ? rule : "random";
      cur = mode === "random" ? (now ? "clear" : cur) : mode;
      timer = 90 + random() * 120;
      if (now) for (const k of WEATHER_IDS) w[k] = k === cur ? 1 : 0;
    },
    step(dt) {
      if (mode === "random" && (timer -= dt) <= 0) { cur = roll(); timer = 120 + random() * 180; }
      let sum = 0;
      for (const k of WEATHER_IDS) { w[k] += ((k === cur ? 1 : 0) - w[k]) * Math.min(1, (dt * 3) / FADE); sum += w[k]; }
      for (const n of NUM) out[n] = 0;
      out.tint[0] = out.tint[1] = out.tint[2] = 0;
      let tw = 0;
      for (const k of WEATHER_IDS) {
        const L = WEATHER_LOOK[k], a = w[k] / sum;
        for (const n of NUM) out[n] += L[n] * a;
        const t = a * L.tintK;
        tw += t; out.tint[0] += L.tint[0] * t; out.tint[1] += L.tint[1] * t; out.tint[2] += L.tint[2] * t;
      }
      if (tw > 1e-4) { out.tint[0] /= tw; out.tint[1] /= tw; out.tint[2] /= tw; } else out.tint[0] = out.tint[1] = out.tint[2] = 1;
      // Lightning: a short flash now and then while the thunderstorm is most of the weather.
      out.thunder = false;
      out.flash = Math.max(0, out.flash - dt * 5);
      if (w.storm / sum > 0.6 && (bolt -= dt) <= 0) { bolt = 5 + random() * 11; out.flash = 1; out.thunder = true; }
      out.kind = cur;
      return out;
    },
    kind: () => cur,
    mode: () => mode,
    weights: () => ({ ...w }),
  };
}