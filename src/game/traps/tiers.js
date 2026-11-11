// Trap tiers, like every upgrade in the game: 1 "Scrap" from the start, 2 "Welded" after 15 jobs and contracts,
// 3 "War-forged" after 40. Bought at outposts (the Well-town and the fuel stations) for banked scrap.
// Higher tiers: a bigger, longer-lasting slick, spikes that also slow the car, mines that hit harder and wider,
// and one more charge of each. Custom games cap the tier with rules.maxTier.
import { MINES } from "@/game/data/tuning";

export const TRAP_KINDS = ["oil", "spikes", "mines"];
export const TRAP_NAMES = { oil: "Oil slick", spikes: "Spike strip", mines: "Mine" };

export const TRAP_TIERS = {
  1: {
    name: "Scrap", unlock: 0, price: 0,
    charges: { oil: 2, spikes: 2, mines: 3 },
    oil: { r: 3.4, life: 22, hold: 0.9, grip: 0.22, spin: 1, burn: 6, burnDps: 40 },
    spikes: { len: 4.6, life: 30, grip: 0.62, top: 0.7, slow: 0 },
    mines: { dmg: MINES.dmg, splash: MINES.splash, scale: 1 },
  },
  2: {
    name: "Welded", unlock: 15, price: 900,
    charges: { oil: 3, spikes: 3, mines: 4 },
    oil: { r: 4.4, life: 32, hold: 1.15, grip: 0.18, spin: 1.2, burn: 6, burnDps: 55 },
    spikes: { len: 5.6, life: 40, grip: 0.56, top: 0.62, slow: 1.2 },
    mines: { dmg: Math.round(MINES.dmg * 1.25), splash: MINES.splash * 1.2, scale: 1.15 },
  },
  3: {
    name: "War-forged", unlock: 40, price: 2200,
    charges: { oil: 4, spikes: 4, mines: 5 },
    oil: { r: 5.4, life: 45, hold: 1.4, grip: 0.14, spin: 1.4, burn: 6, burnDps: 70 },
    spikes: { len: 6.6, life: 50, grip: 0.5, top: 0.55, slow: 2 },
    mines: { dmg: Math.round(MINES.dmg * 1.5), splash: MINES.splash * 1.4, scale: 1.3 },
  },
};

const clampTier = (t) => Math.max(1, Math.min(3, Math.round(t) || 1));

/** Progress toward tier unlocks: jobs and contracts finished (counted by traps.js). */
export const trapProgress = (save) => (save.trapProgress || 0);
/** Tier the player owns (bought). */
export const ownedTier = (save) => clampTier(save.trapTier || 1);
/** Highest tier the player's progress has unlocked for purchase. */
export const unlockedTier = (save) => (trapProgress(save) >= TRAP_TIERS[3].unlock ? 3 : trapProgress(save) >= TRAP_TIERS[2].unlock ? 2 : 1);
/** Tier in force: what you own, capped by the rules. */
export const tierFor = (owned, rules) => Math.min(clampTier(owned), clampTier(rules ? rules.maxTier ?? 3 : 3));

/** Next tier on sale for this save, or null: { tier, name, price, locked, need }. */
export function nextTierOffer(save) {
  const cur = ownedTier(save);
  if (cur >= 3) return null;
  const t = TRAP_TIERS[cur + 1];
  return { tier: cur + 1, name: t.name, price: t.price, locked: trapProgress(save) < t.unlock, need: t.unlock, have: trapProgress(save) };
}

/** AI tier from skill quality 0..1 (rookie Scrap, veteran Welded, ace War-forged). */
export const aiTier = (q) => (q < 0.34 ? 1 : q < 0.75 ? 2 : 3);