// Game rules: one object behind every tunable mechanic. DEFAULT_RULES is Classic (today's open world);
// validateRules(any) returns a complete, clamped copy, so anything from a URL, a save or a hook is safe to use.
export const RULES_VERSION = 1;
export const MAPS = { quarry: "Quarry Bowl", yard: "Container Yard", hollow: "Hollow Town", foundry: "Foundry Pen", glowfield: "Glowfield", brokeway: "Brokeway", custom: "Your map · Map builder" };
export const PLAYER_CARS = { jackal: "Jackal", brawler: "Brawler", mammoth: "Mammoth" };
export const WIN = { checkpoints: "Checkpoints in order", wreck: "Wreck every opponent", horde: "Clear the horde", any: "Any of them", race: "Wreck Race · first over the line" };
export const HORDE = { off: "Off", zombies: "Zombies", aliens: "Grey aliens" };

export const DEFAULT_RULES = {
  v: RULES_VERSION, name: "Classic", mode: "roam", map: "quarry",
  cars: ["jackal", "brawler", "mammoth"], startCar: "",
  aiCount: 10, aiSkill: 0.5, horde: "off", hordeDensity: 0.5,
  powerups: false, fuel: true, damage: 1, ramDamage: 1, partLoss: true,
  gravity: 1, turbo: 1, topSpeed: 1, timeLimit: 120, win: "any", laps: 3,
  building: true, freeBuild: false, raids: true, friendlyFire: true,
  maxTier: 3, // highest trap (and upgrade) tier anyone may use: 1 Scrap, 2 Welded, 3 War-forged
  flight: "arcade", // round 14: turbo in the air (vehicles/turboFlight.js)
  timeOfDay: 9, dayCycle: "normal", weather: "random", wind: 1, // round 14: sky (world/sky/)
};
export const FLIGHT = { off: "Off · the old air push", arcade: "Arcade · jet turbo", high: "High · light cars climb" };
export const DAY_CYCLE = { off: "Off · the hour stays put", slow: "Slow · 48 min a day", normal: "Normal · 24 min a day", fast: "Fast · 6 min a day" };
export const WEATHER = { random: "Random · changes on its own", clear: "Clear", dust: "Dust storm", rain: "Rain", fog: "Fog", storm: "Thunderstorm" };

// Field list for the Custom Game screen and the validator. type: choice | bool | num | cars | text.
export const FIELDS = [
  { key: "mode", label: "Mode", type: "choice", options: { roam: "Open world", arena: "Arena" } },
  { key: "map", label: "Arena", type: "choice", options: MAPS },
  { key: "win", label: "Win condition", type: "choice", options: WIN },
  { key: "timeLimit", label: "Arena clock (s)", type: "num", min: 30, max: 600, step: 10 },
  { key: "cars", label: "Allowed cars", type: "cars" },
  { key: "startCar", label: "Starting car", type: "choice", options: { "": "Your garage car", ...PLAYER_CARS } },
  { key: "aiCount", label: "AI cars", type: "num", min: 0, max: 12, step: 1 },
  { key: "aiSkill", label: "AI skill", type: "num", min: 0, max: 1, step: 0.05 },
  { key: "horde", label: "Horde", type: "choice", options: HORDE },
  { key: "hordeDensity", label: "Horde density", type: "num", min: 0.1, max: 1, step: 0.05 },
  { key: "powerups", label: "Power-up crates", type: "bool" },
  { key: "fuel", label: "Fuel burn", type: "bool" },
  { key: "damage", label: "Weapon damage", type: "num", min: 0.25, max: 3, step: 0.05 },
  { key: "ramDamage", label: "Ram damage", type: "num", min: 0, max: 3, step: 0.05 },
  { key: "partLoss", label: "Parts fall off", type: "bool" },
  { key: "gravity", label: "Gravity", type: "num", min: 0.3, max: 2, step: 0.05 },
  { key: "turbo", label: "Turbo strength", type: "num", min: 0, max: 2, step: 0.05 },
  { key: "topSpeed", label: "Top speed", type: "num", min: 0.5, max: 1.5, step: 0.05 },
  { key: "building", label: "Base building", type: "bool" },
  { key: "freeBuild", label: "Free building", type: "bool" },
  { key: "raids", label: "Raids", type: "bool" },
  { key: "friendlyFire", label: "Friendly fire", type: "bool" },
  { key: "maxTier", label: "Max upgrade tier (1 Scrap · 2 Welded · 3 War-forged)", type: "num", min: 1, max: 3, step: 1 },
  { key: "laps", label: "Race laps (Wreck Race)", type: "num", min: 1, max: 9, step: 1 },
  { key: "flight", label: "Flight (turbo in the air)", type: "choice", options: FLIGHT },
  { key: "timeOfDay", label: "Time of day (hour)", type: "num", min: 0, max: 23, step: 1 },
  { key: "dayCycle", label: "Day and night cycle", type: "choice", options: DAY_CYCLE },
  { key: "weather", label: "Weather", type: "choice", options: WEATHER },
  { key: "wind", label: "Wind", type: "num", min: 0, max: 2, step: 0.1 },
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function validateRules(input = {}) {
  const src = input && typeof input === "object" ? input : {};
  const out = { ...DEFAULT_RULES, v: RULES_VERSION };
  out.name = typeof src.name === "string" && src.name.trim() ? src.name.trim().slice(0, 32) : DEFAULT_RULES.name;
  for (const f of FIELDS) {
    const val = src[f.key];
    if (val === undefined) continue;
    if (f.type === "choice") { if (Object.prototype.hasOwnProperty.call(f.options, val)) out[f.key] = val; }
    else if (f.type === "bool") out[f.key] = !!val;
    else if (f.type === "num") { const n = Number(val); if (Number.isFinite(n)) out[f.key] = clamp(Math.round(n / f.step) * f.step, f.min, f.max); }
    else if (f.type === "cars" && Array.isArray(val)) {
      const cars = [...new Set(val.filter((c) => PLAYER_CARS[c]))];
      if (cars.length) out.cars = cars;
    }
  }
  for (const f of FIELDS) if (f.type === "num") out[f.key] = +out[f.key].toFixed(2);
  if (out.startCar && !out.cars.includes(out.startCar)) out.startCar = out.cars[0];
  if (out.mode === "arena") {
    out.aiCount = Math.min(8, out.aiCount);
    if (out.win === "wreck" && out.aiCount < 1) out.aiCount = 6;
    if (out.win === "horde" && out.horde === "off") out.horde = "zombies";
  }
  return out;
}

export const sameRules = (a, b) => JSON.stringify(validateRules(a)) === JSON.stringify(validateRules(b));