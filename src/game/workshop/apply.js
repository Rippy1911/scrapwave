// Fit tiers onto a vehicle right after createVehicle: weapon tier entries (the weapon code reads w.def as today),
// ram multiplier, engine / tyre / turbo / tank tiers through the vehicle's own stats copy, module tiers, and the tier
// trim you can see. Everything at Tier I leaves the car exactly as it is today (stats are not even copied).
import { BIKE, FUEL, MINES, TURBO, DAMAGE } from "@/game/data/tuning";
import { tierWeapon, tierDef, statMul } from "@/game/workshop/tiers";
import { tierTrim } from "@/game/workshop/tierLook";
import { tiersOf } from "@/game/workshop/store";
import { fitWings } from "@/game/vehicles/wingFlight";
import { fitTank, isTank } from "@/game/vehicles/tank";
import { ARMOUR_TIERS } from "@/game/data/tuning";

const ownStats = (v) => { if (!v.ownStats) { v.stats = { ...v.stats }; v.ownStats = true; } return v.stats; };

// tune: { weaponTiers: { hardpointId: tier }, ramMul, ramTier, turboMul (null = default, 0 = no turbo), fuelMul }
export function fitTune(game, v, tune) {
  for (const w of v.weapons) {
    const t = tune.weaponTiers?.[w.mount.hp.id] || 1;
    w.tier = t;
    if (v.stats.bike) { w.def = tierDef(BIKE.turret, t); w.tail = true; w.mount.model.root.scale.setScalar(BIKE.turretScale); }
    else if (t > 1) w.def = tierWeapon(w.id, t);
    if (t > 1) tierTrim(w.mount.model.root, t, game.M, [0.72, 0.14, 0.72], 0.07);
  }
  v.ramMul = tune.ramMul || 1;
  v.ramTier = tune.ramTier || 0;
  const ram = v.mesh.parts.find((p) => p.kind === "ram");
  if (ram && v.ramTier > 1) tierTrim(ram.obj, v.ramTier, game.M, [v.chassis.hit.half[0] * 2, 0.22, 0.2], 0.1);
  if (tune.turboMul !== undefined && tune.turboMul !== null) { v.turboMul = tune.turboMul; ownStats(v); }
  if (tune.turboTier > 1) { v.turboTier = tune.turboTier; ownStats(v); }
  if (tune.engineTier > 1) { const s = ownStats(v), m = statMul(tune.engineTier); s.accel *= m; s.topSpeed *= 1 + (m - 1) * 0.35; }
  if (tune.tyreTier > 1) ownStats(v).grip *= statMul(tune.tyreTier);
  if (tune.fuelMul && tune.fuelMul !== 1) { v.fuelMax *= tune.fuelMul; v.fuel = v.fuelMax; }
  v.tankTier = tune.tankTier || tune.turboTier || 1; // round 14: a bigger turbo tank flies longer (vehicles/turboFlight.js)
  v.baseAccel = v.stats.accel;
  if (tune.wings && tune.wings.length) fitWings(game, v, tune.wings); // round 13: lift, drag and the meshes
  if (isTank(v)) fitTank(v, tune);
}

// Garage car (not a built design): tiers bought in the garage, per weapon id and per upgrade.
export function garageTune(save, v) {
  const T = tiersOf(save);
  const weaponTiers = {};
  for (const w of v.weapons) weaponTiers[w.mount.hp.id] = T.weapons[w.id] || 1;
  const base = { weaponTiers, ramMul: statMul(T.ram), ramTier: T.ram, turboTier: T.turbo, engineTier: T.engine, tyreTier: T.tyres, fuelMul: statMul(T.tank) };
  if (v.chassisId === "bulwark") {
    const arm = save.garage.armour.bulwark;
    const hullTier = arm ? (ARMOUR_TIERS.find((a) => a.id === arm)?.tier || 1) : 1;
    return { ...base, traverseTier: T.traverse || 1, hullTier };
  }
  return base;
}

// Module tiers (the garage's modules): mines carried, bigger long-range tank, thriftier engine; nitro, welder and
// smoke get their tier bonus each step in tuneStep.
export function fitModules(save, v) {
  const M = tiersOf(save).modules, m = (id) => statMul(M[id] || 1);
  v.moduleTiers = M;
  if (v.mines) v.minesLeft = Math.round(MINES.count * m("mines"));
  if (M.bigtank > 1 && v.fuelMax) { v.fuelMax *= (1 + (FUEL.bigTankMul - 1) * m("bigtank")) / FUEL.bigTankMul; v.fuel = v.fuelMax; }
  if (M.efficient > 1 && v.fuelUse < 1) v.fuelUse = 1 - (1 - FUEL.efficientMul) * m("efficient");
}

// Before physics each step: turbo boost per vehicle (no turbo, small / big, tiers) and module tier bonuses.
// v.turboBoost is the engine multiplier physics.js uses while the turbo burns (null: TURBO.force); round 16 stopped
// swapping stats.accel for it, so physics can fade the extra with speed and stats.accel stays the engine's own.
export function tuneStep(game, v, dt) {
  if (v.turboMul === 0) v.ctl.turbo = false;
  const mul = v.turboMul ? v.turboMul : v.turboTier > 1 ? 1 + (TURBO.force - 1) * statMul(v.turboTier) : null;
  v.turboBoost = mul;
  const M = v.moduleTiers;
  if (!M || !v.alive) return;
  const extra = (id) => statMul(M[id] || 1) - 1;
  if (v.nitro && extra("nitro") > 0 && v.vel.length() * 3.6 > TURBO.refillSpeed && !v.turboActive) v.turbo = Math.min(1, v.turbo + TURBO.refillRate * dt * 1.5 * extra("nitro"));
  if (v.welder && extra("welder") > 0 && game.time - v.lastCombat > DAMAGE.combatTimeout) v.hull = Math.min(v.maxHull, v.hull + DAMAGE.welderRate * extra("welder") * dt);
  if (v.smokeModule && extra("smoke") > 0 && v.smokeCd > 0) v.smokeCd = Math.max(0, v.smokeCd - dt * extra("smoke"));
}