// Free build -> the compiled car (A, C, D). Adds the free parts to the chassis spec (drawn and breakable like any
// part), their mounts to the hardpoints and loadout, their mass and HP to the car, reactors and thrusters to the
// power, and works out the numbers the Workshop shows (total mass, centre of mass, power-to-weight, part count)
// plus the Walker-mode stats: a heavy walker needs a big reactor or it crawls, and it burns fuel fast.
import { FREE_PARTS } from "@/game/workshop/freeParts";
import { layoutFree, growHit } from "@/game/workshop/freeLayout";
import { torsoFor } from "@/game/workshop/torso";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// c: { chassis, loadout, tune } of the slot car (mutated copies are returned, nothing shared is changed).
export function applyFree(d, c) {
  const F = d.free;
  if (!F || !F.parts.length) return null;
  const L = layoutFree(d, c.chassis);
  let mass = 0, hp = 0, reactor = 0, thrust = 0, cost = 0, core = false, joints = 0, mx = 0, my = 0, mz = 0;
  for (const { part, info } of L.info) {
    const def = FREE_PARTS[part.t];
    mass += info.mass; cost += info.price; mx += info.mass * part.p[0]; my += info.mass * part.p[1]; mz += info.mass * part.p[2];
    if (!def.armour) hp += (info.hp || 0) * 0.25;
    if (def.power) reactor += info.power;
    if (def.thrust) thrust += info.thrust;
    if (def.core) core = true;
    if (def.joint) joints++;
  }
  const chassis = {
    ...c.chassis,
    parts: [...c.chassis.parts, ...L.specs],
    hardpoints: [...c.chassis.hardpoints, ...L.hardpoints],
    hit: growHit(c.chassis.hit, F.parts),
    free: true,
  };
  const T = torsoFor(d);
  return {
    chassis, loadout: { ...c.loadout, ...L.loadout }, weaponTiers: { ...c.tune.weaponTiers, ...L.tiers },
    mass, hp: Math.round(hp), reactor, thrust, cost, core, joints, legs: countLegs(d), count: F.parts.length,
    moment: [mx, my, mz], torso: { lift: T.lift, stance: T.stance },
  };
}

// Number of legs: hip joints that sit on the frame (not hung on another hip), counting each side.
export function countLegs(d) {
  return (d.free?.parts || []).filter((p) => p.role === "hip" && FREE_PARTS[p.t]?.joint).length;
}

// Walker numbers from total mass (kg), engine power (kN), reactor power (kN) and thrusters.
export function walkerStats(mass, engineKN, reactorKN, thrust, legs) {
  const t = mass / 1000, pw = (engineKN * 0.35 + reactorKN) / Math.max(0.3, t);
  const walk = clamp(1.4 + pw * 0.42, 1.1, 6.5);
  return {
    pw: +pw.toFixed(2), walk: +walk.toFixed(2), run: +Math.min(10, walk * 1.6).toFixed(2),
    turn: +clamp(2.2 - t / 6, 0.7, 2).toFixed(2), jump: +clamp(4.2 + thrust * 1.7 - t * 0.12, 3, 11).toFixed(2),
    hop: thrust > 0, burn: +(2.2 * Math.sqrt(Math.max(0.4, t) / 2.5)).toFixed(2), overloaded: pw < 3,
    legs, ok: legs === 2 || legs === 4,
  };
}

// Centre of mass of the whole machine: the slot car's mass sits at its hit-box centre.
export function centreOfMass(slotMass, chassisCentre, free) {
  const m = slotMass + (free ? free.mass : 0);
  if (!free) return chassisCentre.map((x) => +x.toFixed(2));
  return [0, 1, 2].map((i) => +((slotMass * chassisCentre[i] + free.moment[i]) / Math.max(1, m)).toFixed(2));
}