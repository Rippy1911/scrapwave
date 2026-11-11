// AI fuel runs: when the tank is low, drive to the nearest pump, stop in the ring and wait until nearly full.
import * as THREE from "three";
import { FUEL } from "@/game/data/tuning";
import { driveTo, holdFire } from "@/game/ai/steer";
import { followRoad, turnAround } from "@/game/ai/nav";

const g = new THREE.Vector3();

// True while a run is needed (low, empty, or already refuelling and not yet ~full).
export function needsFuel(v) {
  const k = v.fuel / v.fuelMax;
  return k < FUEL.aiLow || v.limp || (v.brain && v.brain.mode === "refuel" && k < 0.95);
}

// Drives toward the nearest allowed station. roadDrive(game, v, b, dt, dest, maxSpeed) is the caller's road follower.
export function refuelDrive(game, v, dt, { allowTown = true, roadDrive = null } = {}) {
  const s = game.world.fuel.nearest(v.pos.x, v.pos.z, allowTown ? null : (x) => !x.town);
  if (!s) return false;
  const b = v.brain, d = Math.hypot(s.x - v.pos.x, s.z - v.pos.z), speed = v.vel.length();
  if (d > 130) {
    if (roadDrive) roadDrive(game, v, b, dt, s, 0);
    else {
      if (!followRoad(game, v, b, g, s)) g.set(s.x, 0, s.z);
      if (b.gapAhead && b.gapAhead < 60) { turnAround(b); followRoad(game, v, b, g, s); }
      driveTo(v, g, dt, { maxSpeed: 24 });
    }
  } else if (d > 4) {
    g.set(s.x, 0, s.z);
    driveTo(v, g, dt, { maxSpeed: d < 14 ? 2 : d < 40 ? 7 : 15, noHandbrake: true });
  } else {
    Object.assign(v.ctl, { throttle: 0, brake: speed > 1.5 ? 1 : 0, steer: 0, handbrake: true, turbo: false });
  }
  holdFire(v, g.set(s.x, s.y + 1, s.z));
  return true;
}