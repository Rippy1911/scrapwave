// The ten Drifters: AI players who roam, loot, bank, fight and hold grudges. Edit names, cars and loadouts here.
// skill: rookie | veteran | ace (numbers in tuning.js AI.skills). chassis: jackal | brawler | mammoth.
export const DRIFTERS = [
  { name: "Mag Ruskin", chassis: "brawler", skill: "ace", paint: "#3f5f6e", paint2: "#d9b23a", loadout: { m1: "rockets", s1: "mg", s2: "mg", ram: true } },
  { name: "Sable Ox", chassis: "mammoth", skill: "veteran", paint: "#5e6b3a", paint2: "#2c2a28", loadout: { l1: "autocannon", l2: null, m1: "harpoon", m2: null, s1: "mg", s2: "mg", ram: true } },
  { name: "Tin Valentina", chassis: "jackal", skill: "ace", paint: "#8c3b55", paint2: "#e3d6bd", loadout: { s1: "mg", s2: "mg" } },
  { name: "Odd Petrov", chassis: "jackal", skill: "rookie", paint: "#d9b23a", paint2: "#2c2a28", loadout: { s1: "scatter", s2: "mg" } },
  { name: "Grit Mae", chassis: "brawler", skill: "veteran", paint: "#b23a1f", paint2: "#2c2a28", loadout: { m1: "flamer", s1: "scatter", s2: "mg", ram: true } },
  { name: "Rook Kessler", chassis: "brawler", skill: "rookie", paint: "#2c2a28", paint2: "#c7762e", loadout: { m1: "harpoon", s1: "mg", s2: "mg" } },
  { name: "Dusty Imre", chassis: "jackal", skill: "veteran", paint: "#e3d6bd", paint2: "#7d8a80", loadout: { s1: "mg", s2: "scatter" } },
  { name: "Lark Ondine", chassis: "jackal", skill: "rookie", paint: "#2f7a74", paint2: "#e3d6bd", loadout: { s1: "mg", s2: "mg" } },
  { name: "Bram Holloway", chassis: "mammoth", skill: "rookie", paint: "#7d8a80", paint2: "#b23a1f", loadout: { l1: "autocannon", l2: null, m1: null, m2: null, s1: "mg", s2: "scatter", ram: true } },
  { name: "Juno Rask", chassis: "brawler", skill: "ace", paint: "#c7762e", paint2: "#3f5f6e", loadout: { m1: "rockets", s1: "mg", s2: "scatter", ram: true } },
];

export const TIER_NAME = { rookie: "Rookie", veteran: "Veteran", ace: "Ace" };
export const TIER_COLOR = { rookie: "#9cc8ff", veteran: "#7fe0a0", ace: "#f2c230" };

// Behaviour knobs for Drifters (and the autopilot that shares their brain).
export const DRIFTER_AI = {
  respawnDelay: [8, 16], bankAt: 160, repairHull: 0.35, lootRange: 160, rampRange: 130, rampChance: 0.35,
  fightRange: 150, drifterFightChance: 0.35, paybackTime: 180, keepAlive: 10,
};