// LocalStorage persistence under one versioned key.
import { SAVE_KEY, ECONOMY } from "@/game/data/tuning";
import { LOADOUTS } from "@/game/data/vehicles";
import { local } from "@/game/core/safeStorage";

const DEFAULTS = {
  banked: ECONOMY.startScrap, quality: "medium",
  volume: { master: 0.8, music: 0.45, sfx: 0.9 },
  stats: { wrecks: 0, wheels: 0, parts: 0, jumps: 0, bestAir: 0, banked: 0, barrels: 0, flips: 0 },
  fame: { carnage: 0, speed: 0, stunts: 0, survival: 0, salvage: 0, sky: 0 },
  profile: {
    equippedTitle: "overall:1",
    tag: "",
    avatar: { shape: "circle", icon: 0, color: "#c7762e", color2: "#3a3734", border: "thin", walker: null },
  },
  garage: {
    chassis: "jackal", paint: "#c7762e",
    owned: { chassis: ["jackal", "brawler"], weapons: ["mg", "scatter", "rockets"], ram: true, modules: [] },
    loadouts: {
      jackal: { ...LOADOUTS.jackal },
      brawler: { ...LOADOUTS.brawler },
      mammoth: { l1: "autocannon", l2: null, m1: null, m2: null, s1: "mg", s2: "mg", ram: true },
      bulwark: { l1: "cannon", s1: "mg", ram: true },
    },
    armour: { jackal: null, brawler: null, mammoth: null, bulwark: null },
  },
};

export function loadSave() {
  try {
    const raw = local.get(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    const d = structuredClone(DEFAULTS);
    return {
      ...d, ...s,
      stats: { ...d.stats, ...(s.stats || {}) },
      fame: { ...d.fame, ...(s.fame || {}) },
      profile: { ...d.profile, ...(s.profile || {}), avatar: { ...d.profile.avatar, ...(s.profile?.avatar || {}) } },
      volume: { ...d.volume, ...(s.volume || {}) },
      garage: { ...d.garage, ...(s.garage || {}), owned: { ...d.garage.owned, ...(s.garage?.owned || {}) }, loadouts: { ...d.garage.loadouts, ...(s.garage?.loadouts || {}) }, armour: { ...d.garage.armour, ...(s.garage?.armour || {}) } },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function writeSave(s) {
  local.setJSON(SAVE_KEY, s);
}