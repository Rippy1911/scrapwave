// Built-in rule presets: each one is a patch over DEFAULT_RULES (see gameRules.js), validated on use.
// Classic is an empty patch: today's open world, unchanged.

const ARENA = { mode: "arena", fuel: false, building: false, raids: false, powerups: true, timeLimit: 120 };

export const PRESETS = [
  { name: "Classic", patch: {} },
  { name: "Derby", patch: { ...ARENA, map: "quarry", aiCount: 7, aiSkill: 0.6, win: "wreck" } },
  { name: "Horde Night", patch: { ...ARENA, map: "hollow", aiCount: 6, horde: "aliens", hordeDensity: 0.8, win: "horde" } },
  { name: "Checkpoint Rush", patch: { ...ARENA, map: "yard", aiCount: 6, win: "checkpoints" } },
  { name: "Low Gravity", patch: { ...ARENA, map: "quarry", aiCount: 6, gravity: 0.4, win: "any" } },
  { name: "Glass Cannons", patch: { ...ARENA, map: "yard", aiCount: 7, damage: 3, ramDamage: 3, win: "wreck" } },
  { name: "Wreck Race · Foundry Pen", patch: { ...ARENA, map: "foundry", aiCount: 5, win: "race", laps: 3, timeLimit: 300 } },
  { name: "Wreck Race · Glowfield", patch: { ...ARENA, map: "glowfield", aiCount: 5, win: "race", laps: 3, timeLimit: 300 } },
  { name: "Wreck Race · Brokeway", patch: { ...ARENA, map: "brokeway", aiCount: 5, win: "race", laps: 2, timeLimit: 300 } },
  { name: "Builders", patch: { aiCount: 0, building: true, freeBuild: true, raids: false } },
];

export const PRESET_NAMES = PRESETS.map((p) => p.name);

export function presetPatch(name) {
  const p = PRESETS.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
  return p ? { ...p.patch, name: p.name } : null;
}