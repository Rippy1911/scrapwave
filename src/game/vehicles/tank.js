// Bulwark skid-steer tracks, off-road top speed and turret traverse (round: tank family).
import * as THREE from "three";
import { TANK, PHYSICS } from "@/game/data/tuning";
import { statMul } from "@/game/workshop/tiers";

const D = Math.PI / 180;
const up = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();

export const isTank = (v) => v && v.stats && v.stats.class === "tank";

export function tankTraverseRad(tier = 1) {
  return (TANK.traverse[Math.max(0, Math.min(2, tier - 1))] || TANK.traverse[0]) * D;
}

export function fitTank(v, tune = {}) {
  const tr = tune.traverseTier || tune.turretTier || 1;
  v.turretTraverse = tankTraverseRad(tr);
  v.tankArmourMul = { ...TANK.armourMul };
  if (tune.engineTier > 1) v.stats.accel *= statMul(tune.engineTier);
  if (tune.tyreTier > 1) v.stats.grip *= statMul(tune.tyreTier);
  if (tune.hullTier > 1) {
    const m = statMul(tune.hullTier);
    v.maxHull = Math.round(v.stats.hull * m);
    v.hull = Math.min(v.hull, v.maxHull);
  }
}

export function tankTreadScroll(v, dt) {
  const m = v.mesh;
  if (!m || !m.treadU) return;
  const side = v.vel.dot(right.set(1, 0, 0).applyQuaternion(v.quat));
  const spin = side / (v.chassis.wheels[0]?.r || 0.42);
  m.treadU[0] = (m.treadU[0] || 0) + spin * dt * 0.15;
  m.treadU[1] = (m.treadU[1] || 0) - spin * dt * 0.15;
  for (const w of m.treadU.mats || []) if (w) w.offset.x = m.treadU[w.side] || 0;
}

// Skid-steer wheel torques: returns { left, right } multipliers 0..1 for engine force split.
function trackSplit(v, ctl, speedKmh, grounded) {
  const st = ctl.steer;
  const thr = Math.max(ctl.throttle, ctl.brake > 0 ? 0 : 0);
  const spin = grounded && thr < 0.05 && ctl.brake < 0.05 && Math.abs(st) > 0.08;
  if (spin) {
    const k = Math.abs(st);
    return st > 0 ? { left: k, right: -k * 0.85 } : { left: -k * 0.85, right: k };
  }
  const turn = Math.abs(st) * 0.65;
  const base = thr || (ctl.brake > 0 && speedKmh < 2 ? ctl.brake * 0.5 : 0);
  if (st > 0) return { left: base, right: base * (1 - turn) };
  if (st < 0) return { left: base * (1 - turn), right: base };
  return { left: base, right: base };
}

export function tankPreStep(v, world, ctrl, nl, C, drive, brakeImp, dt, topMs = 0) {
  const ctl = v.ctl;
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  right.set(1, 0, 0).applyQuaternion(v.quat);
  const speed = v.vel.dot(fwd);
  const speedKmh = Math.abs(speed) * 3.6;
  const grounded = v.contacts >= 2;
  v._tankTopMs = topMs;
  // Yaw damping near standstill (skid-steer jitter).
  if (grounded && speedKmh < 3) {
    up.set(0, 1, 0);
    const yaw = v.angVel.y;
    if (Math.abs(yaw) > 0.02) {
      v.angVel.addScaledVector(up, -yaw * Math.min(1, TANK.yawDamp * dt));
      v.rb.setAngvel(v.angVel, true);
    }
  }

  const split = trackSplit(v, ctl, speedKmh, grounded);
  const sides = { left: [], right: [] };
  for (let j = 0; j < nl; j++) {
    const wi = v.wmap[j];
    const wd = C.wheels[wi];
    (wd.pos[0] < 0 ? sides.left : sides.right).push(j);
  }
  const driveCount = sides.left.filter((j) => C.wheels[v.wmap[j]].drive).length + sides.right.filter((j) => C.wheels[v.wmap[j]].drive).length;
  const sideMul = (side) => (side === "left" ? split.left : split.right);
  for (const side of ["left", "right"]) {
    const list = sides[side];
    const n = list.length || 1;
    const mul = sideMul(side);
    for (const j of list) {
      const wd = C.wheels[v.wmap[j]];
      ctrl.setWheelSteering(j, 0);
      const eng = wd.drive && driveCount ? (mul * drive) / n : 0;
      ctrl.setWheelEngineForce(j, eng);
      ctrl.setWheelBrake(j, brakeImp / nl);
      ctrl.setWheelFrictionSlip(j, v.stats.grip * PHYSICS.frictionSlip * TANK.trackGrip);
      ctrl.setWheelSideFrictionStiffness(j, PHYSICS.sideStiffness * TANK.sideGrip);
    }
  }
}

export function capTankRamDamage(attacker, closing, dmg) {
  if (!attacker || !isTank(attacker)) return dmg;
  const kmh = closing * 3.6;
  if (kmh <= TANK.ramSpeedCap) return dmg;
  return dmg * TANK.ramSpeedCap / kmh;
}

export function clampTankPitch(p) {
  return Math.max(TANK.pitchMin * D, Math.min(TANK.pitchMax * D, p));
}
