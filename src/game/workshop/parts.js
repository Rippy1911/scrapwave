// Workshop parts (B). Every part has a slot, mass (kg), HP, a Tier I scrap cost and a tier (I-III, tiers.js).
// Tiers scale HP or the part's main number (power, grip, boost, capacity) and make structure a little heavier.
// Total mass and engine power decide the handling (compile.js); nothing here touches physics directly.
import { ARMOUR_TIERS, RAM, WEAPONS, MODULES, VEHICLES } from "@/game/data/tuning";
import { clampTier, tierPrice, statMul, massMul, tierWeapon } from "@/game/workshop/tiers";

// len, wid: footprint (m). r: wheel radius. ride: body origin above ground. mounts: weapon mounts by size.
export const CHASSIS_PARTS = {
  light: { name: "Light frame", cls: "car", mass: 480, hp: 260, cost: 300, len: 3.9, wid: 1.85, r: 0.42, wheels: 4, sus: 0.55, ride: 0.88, mounts: { S: 2, M: 1, L: 0 } },
  medium: { name: "Medium frame", cls: "car", mass: 820, hp: 400, cost: 700, len: 4.7, wid: 2.0, r: 0.45, wheels: 4, sus: 0.52, ride: 0.92, mounts: { S: 2, M: 2, L: 0 } },
  heavy: { name: "Heavy frame", cls: "car", mass: 1450, hp: 560, cost: 1400, len: 5.6, wid: 2.3, r: 0.5, wheels: 4, sus: 0.55, ride: 1.0, mounts: { S: 2, M: 2, L: 1 } },
  six: { name: "Six-wheel frame", cls: "car", mass: 3000, hp: 800, cost: 2400, len: 8.2, wid: 2.5, r: 0.55, wheels: 6, sus: 0.6, ride: 1.25, mounts: { S: 2, M: 2, L: 2 } },
  dirtbike: { name: "Dirt bike", cls: "bike", mass: VEHICLES.dirtbike.mass, hp: VEHICLES.dirtbike.hull, cost: VEHICLES.dirtbike.price },
  chopper: { name: "Chopper", cls: "bike", mass: VEHICLES.chopper.mass, hp: VEHICLES.chopper.hull, cost: VEHICLES.chopper.price },
  sidecar: { name: "Sidecar rig", cls: "bike", mass: VEHICLES.sidecar.mass, hp: VEHICLES.sidecar.hull, cost: VEHICLES.sidecar.price },
};
// h: height above the deck (m).
export const CAB_PARTS = {
  cage: { name: "Open buggy cage", mass: 60, hp: 60, cost: 100, h: 0.85 },
  closed: { name: "Closed cab", mass: 180, hp: 140, cost: 250, h: 0.75 },
  armoured: { name: "Armoured cab", mass: 380, hp: 260, cost: 600, h: 0.7 },
};
export const BODY_PARTS = {
  openbed: { name: "Open bed", mass: 110, hp: 80, cost: 120, h: 0.4 },
  cargo: { name: "Cargo box", mass: 300, hp: 160, cost: 300, h: 1.1 },
  tanker: { name: "Tanker", mass: 560, hp: 220, cost: 500, h: 1.3, fuel: 0.3 },
  armoured: { name: "Armoured box", mass: 680, hp: 360, cost: 900, h: 1.0 },
  bus: { name: "Bus shell", mass: 1300, hp: 700, cost: 1300, h: 1.7 },
};
// power: engine force in kN (acceleration = power / total mass).
export const ENGINE_PARTS = {
  small: { name: "Small engine", mass: 120, hp: 0, cost: 200, power: 9, sound: "rasp" },
  medium: { name: "Medium engine", mass: 220, hp: 0, cost: 500, power: 15, sound: "burble" },
  large: { name: "Large engine", mass: 420, hp: 0, cost: 1100, power: 30, sound: "diesel" },
  bike: { name: "Bike engine", mass: 0, hp: 0, cost: 300, power: 0, bike: true },
};
// mass per wheel; grip: tyre grip; speed: top-speed factor; r: wheel size factor; sus: extra suspension travel.
export const TYRE_PARTS = {
  road: { name: "Road tyres", mass: 14, hp: 0, cost: 120, grip: 1.22, speed: 1.04, r: 1, sus: 0 },
  offroad: { name: "Off-road tyres", mass: 20, hp: 0, cost: 200, grip: 1.14, speed: 0.97, r: 1.08, sus: 0.1 },
  spiked: { name: "Spiked tyres", mass: 24, hp: 0, cost: 300, grip: 1.16, speed: 1, r: 1, sus: 0, ram: 0.15 },
  bike: { name: "Bike tyres", mass: 0, hp: 0, cost: 200, grip: 0, speed: 1, r: 1, sus: 0, bike: true },
};
// boost: extra engine force while the turbo burns (x tier stat).
export const TURBO_PARTS = {
  none: { name: "No turbo", mass: 0, hp: 0, cost: 0, boost: 0 },
  small: { name: "Small turbo", mass: 30, hp: 0, cost: 250, boost: 0.45 },
  big: { name: "Big turbo", mass: 60, hp: 0, cost: 600, boost: 0.8 },
};
export const TANK_PARTS = { std: { name: "Fuel tank", mass: 30, hp: 0, cost: 100, cap: 100 } };
export const MOUNT_PARTS = {
  S: { name: "Small mount", mass: 20, hp: 0, cost: 60 },
  M: { name: "Medium mount", mass: 45, hp: 0, cost: 150 },
  L: { name: "Large mount", mass: 90, hp: 0, cost: 350 },
};
export const TURRET_PARTS = { tail: { name: "Tail turret", mass: 0, hp: 0, cost: 250 } };
const PLATE = (zone, zones) => ({ none: { name: "No plate", mass: 0, hp: 0, cost: 0 }, plate: { name: `${zone} plate`, zones, mass: 0, hp: 0, cost: (ARMOUR_TIERS[0].price / 5) * zones, armour: true } });
const RAM_PARTS = { none: { name: "No ram", mass: 0, hp: 0, cost: 0 }, blade: { name: "Ram blade", mass: RAM.mass, hp: 260, cost: RAM.price, ram: true } };

// Slots in screen order. cls: which chassis class shows the slot.
export const SLOTS = [
  { key: "chassis", label: "Chassis", options: CHASSIS_PARTS, cls: "all" },
  { key: "cab", label: "Cab", options: CAB_PARTS, cls: "car" },
  { key: "body", label: "Body", options: BODY_PARTS, cls: "car" },
  { key: "engine", label: "Engine", options: ENGINE_PARTS, cls: "all" },
  { key: "tyres", label: "Tyres", options: TYRE_PARTS, cls: "all" },
  { key: "turbo", label: "Turbo", options: TURBO_PARTS, cls: "car" },
  { key: "tank", label: "Fuel tank", options: TANK_PARTS, cls: "car" },
  { key: "armourFront", label: "Front armour", options: PLATE("Front", 1), cls: "car", zones: ["front"] },
  { key: "armourSides", label: "Side armour", options: PLATE("Side", 2), cls: "car", zones: ["left", "right"] },
  { key: "armourRear", label: "Rear armour", options: PLATE("Rear", 1), cls: "car", zones: ["rear"] },
  { key: "armourRoof", label: "Roof armour", options: PLATE("Roof", 1), cls: "car", zones: ["top"] },
  { key: "ram", label: "Ram", options: RAM_PARTS, cls: "car" },
  { key: "turret", label: "Tail turret", options: TURRET_PARTS, cls: "bike" },
];
export const slotDef = (key) => SLOTS.find((s) => s.key === key);
export const clsOf = (chassisId) => (CHASSIS_PARTS[chassisId] || CHASSIS_PARTS.light).cls;
export const slotsFor = (cls) => SLOTS.filter((s) => s.cls === "all" || s.cls === cls);
// Options a slot offers for a chassis class (bikes keep their own engine and tyres; cars never see them).
export function optionsFor(slot, cls) {
  const all = Object.entries(slotDef(slot).options);
  if (slot === "chassis") return all;
  return all.filter(([, p]) => (cls === "bike" ? !!p.bike || slot === "turret" : !p.bike));
}

// Mount sizes of a chassis, in a fixed order the design's weapon list follows.
export function mountList(chassisId) {
  const m = (CHASSIS_PARTS[chassisId] || {}).mounts;
  return m ? [...Array(m.S).fill("S"), ...Array(m.M).fill("M"), ...Array(m.L).fill("L"), ...Array(SIDE_MOUNTS).fill("S")] : [];
}
// Round 14: every car frame also has a small mount on each flank. They come last in the list (left, then right), so
// older designs keep their weapons; the bracket itself is free and weightless, only the weapon on it counts.
export const SIDE_MOUNTS = 2;
export const sideMounts = (chassisId) => ((CHASSIS_PARTS[chassisId] || {}).mounts ? SIDE_MOUNTS : 0);
export function mountSide(chassisId, index) {
  const n = sideMounts(chassisId), len = n ? mountList(chassisId).length : 0;
  return n && index >= len - n ? (index === len - 1 ? "right" : "left") : null;
}

// One part at a tier: name, mass, HP, price. Armour plates read ARMOUR_TIERS (hp, mass per zone) for their tier.
export function partInfo(slot, id, tier) {
  const t = clampTier(tier), p = slotDef(slot)?.options[id];
  if (!p) return null;
  if (p.armour) { const a = ARMOUR_TIERS[t - 1]; return { ...p, tier: t, hp: a.hp * p.zones, mass: a.mass * p.zones, price: tierPrice(p.cost, t) }; }
  const structure = slot === "chassis" || slot === "cab" || slot === "body";
  const mass = p.ram ? p.mass * massMul(t) : structure ? p.mass * (1 + (massMul(t) - 1) * 0.5) : p.mass;
  return { ...p, tier: t, hp: Math.round(p.hp * statMul(t)), mass: Math.round(mass), price: tierPrice(p.cost, t) };
}

// A weapon in a mount at a tier.
export function weaponInfo(id, tier) {
  const d = tierWeapon(id, tier);
  return d ? { id, tier: clampTier(tier), name: d.name, size: d.size, mass: WEAPONS[id].mass, price: tierPrice(WEAPONS[id].price, tier), def: d } : null;
}
export const weaponsFor = (size) => Object.entries(WEAPONS).filter(([, w]) => ({ S: 1, M: 2, L: 3 }[w.size] <= { S: 1, M: 2, L: 3 }[size])).map(([id]) => id);
export const MODULE_IDS = Object.keys(MODULES);