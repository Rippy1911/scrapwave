// Aircraft data: base stats, the helicopter unlock, its three-tier upgrades and the running costs.
// Tier 2 costs ~2.5x Tier 1, Tier 3 ~6x; each tier is ~22% better than the one below.
import { WEAPONS } from "@/game/data/tuning";

export const TIER_MUL = 1.22;
export const TIER_PRICE = [0, 1, 2.5, 6];

export const AIRCRAFT = {
  heli: {
    name: "Scrap Hornet", hull: 300, topSpeed: 160, sound: "diesel", camDist: 15, camHeight: 5,
    hit: { half: [1.0, 0.95, 2.4], center: [0, 0.1, 0.4] }, mass: 1400,
    guns: { dps: 40, range: 150 }, rockets: { count: 2, dmg: 70, reload: 8 },
    fuelTank: 80, burn: 2.4, burnFast: 3.2, // x the car burn rate: thirstier than any car
  },
  jet: {
    name: "Dust Devil", hull: 520, topSpeed: 520, sound: "rasp", camDist: 26, camHeight: 6,
    hit: { half: [1.1, 0.75, 4.4], center: [0, 0, 0] }, mass: 2200,
    guns: { dps: 95, range: 220 }, rockets: { count: 4, dmg: 100, reload: 5 },
    fuelTank: 100, burn: 0, burnFast: 0, // admin toy: no fuel
  },
};

// The helicopter unlock: price plus a high rank (story done or 40 jobs + contracts).
export const UNLOCK = { price: 25000, jobs: 40, upkeep: 400, repairPerHp: 3 };

export const UPGRADES = {
  armour: { name: "Armour plating", base: 2000, desc: "+22% hull per tier" },
  rotor: { name: "Rotor & engine", base: 2400, desc: "+22% speed, climb and agility per tier" },
  guns: { name: "Chin guns", base: 1800, desc: "+22% gun damage per tier" },
  rockets: { name: "Rocket pods", base: 2200, desc: "+22% rocket damage, faster reload per tier" },
  tank: { name: "Fuel tank", base: 1500, desc: "+22% fuel per tier" },
};

export const tierPrice = (id, tier) => Math.round((UPGRADES[id].base * TIER_PRICE[tier]) / 50) * 50;
const mul = (t) => Math.pow(TIER_MUL, t || 0);

// Default save block for aircraft (merged into old saves on first use).
export function airSave(save) {
  if (!save.air) save.air = {};
  const a = save.air;
  a.owned = !!a.owned;
  a.tiers = { armour: 0, rotor: 0, guns: 0, rockets: 0, tank: 0, ...(a.tiers || {}) };
  if (a.hp === undefined) a.hp = null; // null = full
  if (a.fuel === undefined) a.fuel = null;
  a.paidDay = a.paidDay || null;
  return a;
}

// Stats for one aircraft at the given tiers (the jet always flies stock).
export function statsFor(kind, tiers = {}) {
  const A = AIRCRAFT[kind];
  const k = kind === "heli" ? tiers : {};
  const mg = WEAPONS.mg, rk = WEAPONS.rockets;
  return {
    ...A,
    hull: Math.round(A.hull * mul(k.armour)),
    agility: mul(k.rotor),
    fuelTank: Math.round(A.fuelTank * mul(k.tank)),
    gunDef: { ...mg, name: kind === "heli" ? "Light chin gun" : "Nose cannons", dps: A.guns.dps * mul(k.guns), range: A.guns.range },
    rocketDef: { ...rk, count: A.rockets.count, dmg: A.rockets.dmg * mul(k.rockets), reload: A.rockets.reload / mul(k.rockets) },
    look: Math.max(k.armour || 0, 0),
  };
}

export const today = () => new Date().toISOString().slice(0, 10);