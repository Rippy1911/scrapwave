// Design -> drivable car. Total mass and engine power decide the handling numbers that physics.js already reads from
// the vehicle spec (accel, topSpeed, brake, grip, steer); the chassis spec comes from layout.js. Built cars register
// under "ws_<hash>" in CHASSIS / VEHICLES so createVehicle, build.js and the damage code treat them like any car.
import { VEHICLES, WEAPONS, ARMOUR_TIERS, RAM, PHYSICS } from "@/game/data/tuning";
import { CHASSIS } from "@/game/data/vehicles";
import { CHASSIS_PARTS, ENGINE_PARTS, TYRE_PARTS, TURBO_PARTS, BODY_PARTS, MOUNT_PARTS, SLOTS, partInfo, weaponInfo, slotsFor, mountList, mountSide } from "@/game/workshop/parts";
import { statMul, tierPrice } from "@/game/workshop/tiers";
import { layoutChassis } from "@/game/workshop/layout";
import { normalizeDesign, designClass } from "@/game/workshop/validate";
import { applyFree, walkerStats, centreOfMass } from "@/game/workshop/freeCompile";
import { wingBill, describeWings } from "@/game/workshop/wings";
import { aeroScore, shapeOf } from "@/game/vehicles/turboFlight";
import { enginePull } from "@/game/vehicles/feel";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const CARGO = { light: 1, medium: 2, heavy: 3, six: 6 };

// Seconds from 0 to 100 km/h on flat ground with the engine curve and drag physics.js uses (no turbo).
export function zeroTo100(accel, topKmh) {
  const top = topKmh / 3.6;
  if (top <= 100 / 3.6) return Infinity;
  let v = 0, t = 0;
  while (v < 100 / 3.6 && t < 60) { v += (accel * enginePull(v, top) - PHYSICS.drag * v * v) * 0.01; t += 0.01; }
  return +t.toFixed(2);
}
// Ram damage into a car in front at a 15 m/s (54 km/h) closing speed, by the collideVehicles formula.
export const ramAt54 = (mass, ram, ramMul) => Math.round(70 * (mass / 1000) * (ram ? 1.6 : 1.1) * ramMul);

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }

export function compileDesign(raw) {
  const d = normalizeDesign(raw);
  return designClass(d) === "bike" ? compileBike(d) : compileCar(d);
}

function compileCar(d) {
  const p = d.parts, F = CHASSIS_PARTS[p.chassis.id], ty = TYRE_PARTS[p.tyres.id];
  const info = Object.fromEntries(slotsFor("car").map((s) => [s.key, partInfo(s.key, p[s.key].id, p[s.key].tier)]));
  let struct = 0, cost = 0, armourHp = 0;
  const armour = {}, armourHpZ = {};
  for (const s of slotsFor("car")) {
    const i = info[s.key];
    cost += i.price;
    if (s.zones) { if (i.armour) for (const z of s.zones) { armour[z] = ARMOUR_TIERS[i.tier - 1].id; armourHpZ[z] = ARMOUR_TIERS[i.tier - 1].hp; armourHp += armourHpZ[z]; } continue; }
    if (s.key === "ram") { if (i.ram) struct += i.mass - RAM.mass; continue; }
    struct += s.key === "tyres" ? i.mass * F.wheels : i.mass;
  }
  const mounts = mountList(p.chassis.id), loadout = {};
  let chassis = layoutChassis(d);
  mounts.forEach((size, k) => {
    if (!mountSide(p.chassis.id, k)) { struct += MOUNT_PARTS[size].mass; cost += MOUNT_PARTS[size].cost; } // side brackets are free
    const w = d.weapons[k];
    if (w) { loadout[chassis.hardpoints[k].id] = w.id; cost += weaponInfo(w.id, w.tier).price; }
  });
  const slotMass = struct;
  const fr = applyFree(d, { chassis, loadout, tune: { weaponTiers: {} } }); // free build: parts, mounts, joints, core
  if (fr) {
    chassis = fr.chassis; Object.assign(loadout, fr.loadout); struct += fr.mass; cost += fr.cost;
    for (const x of d.free.parts) if (x.wpn) cost += weaponInfo(x.wpn.id, x.wpn.tier).price;
  }
  const wb = wingBill(d.wings); // wings: mass and scrap like any part (their HP is their own, not hull)
  struct += wb.mass; cost += wb.cost;
  const ram = info.ram.ram;
  if (ram) loadout.ram = true;
  let loadMass = 0;
  for (const z in armour) loadMass += ARMOUR_TIERS.find((a) => a.id === armour[z]).mass;
  for (const k in loadout) if (WEAPONS[loadout[k]]) loadMass += WEAPONS[loadout[k]].mass;
  if (ram) loadMass += RAM.mass;
  const engineKN = ENGINE_PARTS[p.engine.id].power * statMul(p.engine.tier);
  const mass = struct + loadMass, power = (engineKN + (fr ? fr.reactor * 0.5 : 0)) * 1000; // reactors help on wheels too
  const accel = power / mass, topSpeed = clamp(40 + 11 * accel, 55, 175) * ty.speed;
  const L = F.len, hull = info.chassis.hp + info.cab.hp + info.body.hp + (fr ? fr.hp : 0);
  const stats = {
    name: d.name, kind: L > 6 ? "bus" : "car", topSpeed, mass: struct, hull, load: loadMass * 1.2 + 200,
    cargo: CARGO[p.chassis.id] + (["cargo", "tanker", "bus"].includes(p.body.id) ? 1 : 0),
    accel, brake: clamp(4 + 360 / Math.sqrt(mass), 6, 18), grip: ty.grip * statMul(p.tyres.tier),
    steerMax: clamp(0.64 - (L - 3.9) * 0.05, 0.4, 0.62), steerMin: clamp(0.16 - (L - 3.9) * 0.008, 0.11, 0.16),
    price: 0, cam: L > 6 ? "bus" : "car", workshop: true,
  };
  const turbo = TURBO_PARTS[p.turbo.id];
  const tune = {
    turboMul: turbo.boost ? 1 + turbo.boost * statMul(p.turbo.tier) : 0,
    fuelMul: statMul(p.tank.tier) * (1 + (BODY_PARTS[p.body.id].fuel || 0)),
    ramMul: (ram ? statMul(p.ram.tier) : 1) + (ty.ram || 0),
    weaponTiers: { ...Object.fromEntries(mounts.map((_, k) => [chassis.hardpoints[k].id, d.weapons[k] ? d.weapons[k].tier : 1])), ...(fr ? fr.weaponTiers : {}) },
    ramTier: ram ? p.ram.tier : 0,
    wings: d.wings || null,
  };
  const id = "ws_" + hash(JSON.stringify({ ...d, name: "", paint: "" }));
  chassis.name = d.name;
  CHASSIS[id] = chassis; VEHICLES[id] = stats;
  const summary = { mass: Math.round(mass), power: +(power / 1000).toFixed(1), accel: +accel.toFixed(2), topSpeed: Math.round(topSpeed), zeroTo100: zeroTo100(accel, topSpeed),
    brake: +stats.brake.toFixed(1), grip: +stats.grip.toFixed(2), hull, armour: armourHp, cost, landing: +chassis.susLen.toFixed(2), ram: ramAt54(mass, ram, tune.ramMul),
    pw: +((power / 1000) / (mass / 1000)).toFixed(2), com: centreOfMass(slotMass + loadMass, chassis.hit.center, fr), parts: fr ? fr.count : 0 };
  if (d.wings) summary.wings = describeWings(d.wings, mass / 1300); // lift, drag, stall (the Workshop stats panel)
  // Round 14: how well it flies on turbo. Body shape and weight give 0..100; each wing adds 25 (vehicles/turboFlight.js).
  summary.aero = aeroScore(mass, shapeOf(chassis.hit.half[0], chassis.hit.half[2]), (d.wings || []).filter((w) => w.side !== "roof").length, (d.wings || []).some((w) => w.side === "roof") ? 0.05 : 0);
  tune.tankTier = p.turbo.tier; // a bigger turbo tank (Tier I, II, III) flies longer
  // Machines with a Transform Core also get Walker-mode numbers (src/game/mech reads compiled.mech).
  const mech = fr ? { core: fr.core, legs: fr.legs, joints: fr.joints, torso: fr.torso, walker: walkerStats(mass, engineKN, fr.reactor, fr.thrust, fr.legs) } : null;
  if (mech && mech.core) Object.assign(summary, { walkSpeed: Math.round(mech.walker.run * 3.6), walkerPw: mech.walker.pw, legs: mech.legs });
  return { id, cls: "car", design: d, stats, chassis, loadout, armour, armourHp: armourHpZ, tune, summary, mech };
}

function compileBike(d) {
  const p = d.parts, id = p.chassis.id, base = VEHICLES[id];
  const em = statMul(p.engine.tier), hull = Math.round(base.hull * statMul(p.chassis.tier));
  const stats = { ...base, accel: base.accel * em, topSpeed: base.topSpeed * (1 + (em - 1) * 0.35), grip: base.grip * statMul(p.tyres.tier), hull };
  const mass = base.mass + BIKE_MOUNT_MASS;
  let cost = 0;
  for (const s of slotsFor("bike")) cost += partInfo(s.key, p[s.key].id, p[s.key].tier).price;
  const tune = { turboMul: null, fuelMul: 1, ramMul: 1, weaponTiers: { t1: p.turret.tier }, turretTier: p.turret.tier, ramTier: 0 };
  const summary = { mass, power: +((stats.accel * mass) / 1000).toFixed(1), accel: +stats.accel.toFixed(2), topSpeed: Math.round(stats.topSpeed), zeroTo100: zeroTo100(stats.accel, stats.topSpeed),
    brake: stats.brake, grip: +stats.grip.toFixed(2), hull, armour: 0, cost, landing: +CHASSIS[id].susLen.toFixed(2), ram: ramAt54(mass, false, 1) };
  summary.aero = aeroScore(mass, shapeOf(CHASSIS[id].hit.half[0], CHASSIS[id].hit.half[2], true)); // bikes nearly hover on turbo
  return { id, cls: "bike", design: d, stats, chassis: CHASSIS[id], loadout: { t1: "mg" }, armour: {}, armourHp: {}, tune, summary };
}
const BIKE_MOUNT_MASS = WEAPONS.mg.mass;
export const SLOT_COUNT = SLOTS.length;
export const basePrice = (slot, id) => tierPrice(SLOTS.find((s) => s.key === slot).options[id].cost, 1);