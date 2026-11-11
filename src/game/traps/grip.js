// Grip and speed effects of traps on a car, applied in the controller layer (after the drivers set ctl, before
// physics). Grip goes straight to the car's wheel controller; while a trap owns the grip we keep physics'
// handbrake bookkeeping (v._hb) in step, and hand it back by clearing v._hb so physics re-applies its own values.
import * as THREE from "three";
import { PHYSICS } from "@/game/data/tuning";
import { applyImpulse } from "@/game/vehicles/physics";

const side = new THREE.Vector3(), front = new THREE.Vector3();

export function setGrip(v, mul) {
  const ctrl = v.ctrl;
  if (!ctrl || !v.wmap || v.remote) return;
  const hand = v.alive && v.ctl.handbrake;
  for (let j = 0; j < v.wmap.length; j++) {
    const rear = !v.chassis.wheels[v.wmap[j]].steer, hb = hand && rear;
    ctrl.setWheelFrictionSlip(j, v.stats.grip * PHYSICS.frictionSlip * (hb ? PHYSICS.handbrakeGrip : 1) * mul);
    ctrl.setWheelSideFrictionStiffness(j, PHYSICS.sideStiffness * (hb ? PHYSICS.handbrakeSide : 1) * Math.max(0.25, mul));
  }
  v._hb = hand;
  v.trapGrip = mul;
}

export function releaseGrip(v) {
  if (v.trapGrip === undefined) return;
  v.trapGrip = undefined;
  v._hb = undefined; // physics re-applies its normal grip next step
}

// Entering a slick: a sideways shove at the nose so the car tends to spin (stronger the faster it goes).
export function spinKick(v, k) {
  if (v.remote) return;
  const sp = v.vel.length();
  if (sp < 4) return;
  front.set(0, 0, -v.chassis.hit.half[2]).applyQuaternion(v.quat).add(v.pos);
  side.set(1, 0, 0).applyQuaternion(v.quat).setY(0).normalize().multiplyScalar((Math.random() < 0.5 ? -1 : 1) * v.mass * Math.min(14, sp) * 0.09 * k);
  applyImpulse(v, front, side);
}

// Flat tyres: throttle cut above a share of top speed; tier 2+ strips also drag the car down for a moment.
export function flatLimit(v, f, dt) {
  const c = v.ctl, kmh = v.vel.length() * 3.6;
  if (kmh > v.stats.topSpeed * f.top) { c.throttle = Math.min(c.throttle, 0.15); c.turbo = false; }
  if (f.slowT > 0) { f.slowT -= dt; c.throttle = 0; c.turbo = false; if (kmh > 15) c.brake = Math.max(c.brake, 0.45); }
}