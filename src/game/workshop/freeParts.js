// Free-build parts (A, B, C): placed anywhere on the 3D grid attached to the frame. Every part has a mass (kg),
// HP, a Tier I scrap cost and a tier (I "Scrap", II "Welded", III "War-forged"); tiers scale HP or the part's main
// number (reactor power, thrust, joint speed) and make structure a little heavier, exactly like the slot parts.
// size is in metres in the part's own frame; shape is what vehicles/build.js draws.
import { ARMOUR_TIERS, WEAPONS } from "@/game/data/tuning";
import { clampTier, tierPrice, statMul, massMul } from "@/game/workshop/tiers";

const S = (o) => ({ group: "Structure", mat: "paint", ...o });
export const FREE_PARTS = {
  block: S({ name: "Block", shape: "box", size: [0.5, 0.5, 0.5], mass: 60, hp: 80, cost: 40, mat: "rust" }),
  beam: S({ name: "Beam", shape: "box", size: [0.25, 0.25, 1], mass: 35, hp: 60, cost: 30, mat: "dark" }),
  plate: S({ name: "Plate", shape: "box", size: [1, 0.1, 1], mass: 45, hp: 70, cost: 35 }),
  wedge: S({ name: "Wedge", shape: "wedge", size: [0.5, 0.5, 0.5], mass: 40, hp: 60, cost: 35 }),
  wheel: { name: "Wheel", group: "Motion", shape: "wheel", size: [0.42, 0.3], mass: 30, hp: 120, cost: 80, mat: "rubber" },
  thruster: { name: "Thruster", group: "Motion", shape: "cone", size: [0.22, 0.6], mass: 40, hp: 50, cost: 220, mat: "dark", thrust: 1 },
  light: { name: "Lamp", group: "Detail", shape: "cylZ", size: [0.12, 0.12], mass: 4, hp: 15, cost: 15, mat: "light" },
  armour: { name: "Armour plate", group: "Armour", shape: "box", size: [1, 0.12, 0.6], mass: 0, hp: 0, cost: 120, mat: "dark", armour: true },
  mount: { name: "Weapon mount", group: "Weapons", shape: "box", size: [0.6, 0.12, 0.6], mass: 45, hp: 60, cost: 150, mat: "dark", mount: "L" },
  heavyMount: { name: "Heavy walker mount", group: "Weapons", shape: "box", size: [0.8, 0.16, 0.8], mass: 120, hp: 120, cost: 400, mat: "dark", mount: "X", walker: true },
  reactor: { name: "Reactor", group: "Power", shape: "cyl", size: [0.42, 0.8], mass: 380, hp: 200, cost: 1200, mat: "chrome", power: 22 },
  core: { name: "Transform Core", group: "Power", shape: "rbox", size: [0.6, 0.6, 0.6], mass: 220, hp: 250, cost: 1500, mat: "hazard", core: true, unique: true },
  hinge: { name: "Hinge", group: "Joints", shape: "cylX", size: [0.16, 0.36], mass: 25, hp: 90, cost: 120, mat: "chrome", joint: "hinge", range: [-1.6, 1.6], speed: 2.5 },
  rotor: { name: "Rotor", group: "Joints", shape: "cyl", size: [0.22, 0.16], mass: 30, hp: 90, cost: 160, mat: "chrome", joint: "rotor", range: [-3.2, 3.2], speed: 6 },
  piston: { name: "Piston", group: "Joints", shape: "box", size: [0.2, 0.2, 0.6], mass: 40, hp: 100, cost: 180, mat: "chrome", joint: "piston", range: [0, 0.8], speed: 3 },
  motor: { name: "Powered motor", group: "Joints", shape: "cylX", size: [0.22, 0.4], mass: 45, hp: 110, cost: 260, mat: "hazard", joint: "motor", range: [-1.6, 1.6], speed: 3.5 },
};
export const FREE_GROUPS = ["Structure", "Motion", "Armour", "Weapons", "Power", "Joints", "Detail"];
export const JOINT_ROLES = ["", "hip", "knee", "shoulder", "elbow", "fist"];
export const isJoint = (t) => !!FREE_PARTS[t]?.joint;

// One free part at a tier. Armour plates read ARMOUR_TIERS (hp and mass per square metre of plate).
export function freePartInfo(type, tier) {
  const t = clampTier(tier), d = FREE_PARTS[type];
  if (!d) return null;
  const out = { ...d, type, tier: t, price: tierPrice(d.cost, t) };
  if (d.armour) { const a = ARMOUR_TIERS[t - 1]; out.hp = Math.round(a.hp * 0.8); out.mass = Math.round(a.mass * 0.6); out.armourId = a.id; return out; }
  const structure = d.group === "Structure" || d.joint;
  out.hp = Math.round(d.hp * statMul(t));
  out.mass = Math.round(structure ? d.mass * (1 + (massMul(t) - 1) * 0.5) : d.mass);
  if (d.power) out.power = +(d.power * statMul(t)).toFixed(1);
  if (d.thrust) out.thrust = +(d.thrust * statMul(t)).toFixed(2);
  if (d.speed) out.speed = +(d.speed * statMul(t)).toFixed(2);
  return out;
}

// Weapons a free mount takes: the normal mounts take car weapons (S, M, L); the heavy walker mount takes those plus
// the walker weapons (size X).
export function freeWeaponsFor(type) {
  const m = FREE_PARTS[type]?.mount;
  if (!m) return [];
  return Object.entries(WEAPONS).filter(([, w]) => (m === "X" ? true : w.size !== "X")).map(([id]) => id);
}

// Half extents of a part in its own frame (for bounds, centre of mass, colliders and picking).
export function partHalf(type) {
  const d = FREE_PARTS[type];
  if (!d) return [0.25, 0.25, 0.25];
  const [a, b, c] = d.size;
  if (d.shape === "wheel" || d.shape === "cylX") return [b / 2, a, a];
  if (d.shape === "cylZ") return [a, a, b / 2];
  if (d.shape === "cyl" || d.shape === "cone") return [a, b / 2, a];
  return [a / 2, b / 2, c / 2];
}