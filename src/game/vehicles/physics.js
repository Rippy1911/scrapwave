// Vehicle physics on Rapier: one dynamic rigid body per vehicle (rounded hitbox, low centre of mass) driven by
// Rapier's ray-cast vehicle controller. The game keeps its own state fields (pos, quat, vel, angVel, grounded,
// airTime, contacts, wheelState, ...): writes from game code (spawns, unstick, explosions, harpoons, prop hits)
// are pushed into the bodies before each step and the bodies are read back after it.
//
// game.js calls stepVehicle(v) for every vehicle each fixed step. Each call applies that vehicle's controls; the
// Rapier world steps once, when the last vehicle of the tick has been prepared (see stepVehicle).
import * as THREE from "three";
import { PHYSICS, TURBO, WORLD, OVERLOAD_MAX_PENALTY } from "@/game/data/tuning";
import { RAPIER, getPhys } from "@/game/vehicles/rapier";
import { FEEL, enginePull, turboGain } from "@/game/vehicles/feel";
import { wingStep, WING_TURBO_DRAIN } from "@/game/vehicles/wingFlight";
import { airTurbo, airDrain } from "@/game/vehicles/turboFlight";
import { isTank, tankPreStep, capTankRamDamage } from "@/game/vehicles/tank";
import { TANK } from "@/game/data/tuning";

const UP = new THREE.Vector3(0, 1, 0);
const up = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), force = new THREE.Vector3();
const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), lw = new THREE.Vector3(), ww = new THREE.Vector3();
const qi = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const IDQ = { x: 0, y: 0, z: 0, w: 1 };
const RAY_FLAGS = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (k) => k * k * (3 - 2 * k);
const isRemote = (v) => v.remote === true || v.controller === "remote";

export function initBody(v) {
  const [hx, hy, hz] = v.chassis.hit.half, c = v.chassis.hit.center;
  const k = (v.mass / 3) * PHYSICS.inertiaMul;
  v.inertia = new THREE.Vector3(k * (hy * hy + hz * hz), k * (hx * hx + hz * hz), k * (hx * hx + hy * hy));
  v.invI = new THREE.Vector3(1 / v.inertia.x, 1 / v.inertia.y, 1 / v.inertia.z);
  v.com = new THREE.Vector3(c[0], c[1] - hy * PHYSICS.comDrop - (v.chassis.comDrop || 0), c[2]); // bikes sit lower still
  v.wheelState = v.chassis.wheels.map(() => ({ comp: 0, contact: false, spin: 0, slide: 0 }));
  v.steer = 0; v.drift = 0; v.turboT = 0; v.airTime = 0; v.flipTime = 0; v.grounded = false; v.contacts = 0; v.justLanded = 0; v.sliding = 0;
  v.wallN = new THREE.Vector3(); v.wallTouch = false; v.stuckT = 0; v.bodyTouch = false;
  v.rb = null; v.ctrl = null; v.wmap = []; v.righting = null; v.phys = null;
  v._vpre = new THREE.Vector3(); v._s = new Float64Array(13);
  // Ride height: body origin above the ground with the car resting on its wheels.
  const C = v.chassis;
  v.rideH = Math.max(...C.wheels.map((w) => -(w.pos[1] - C.susLen / 2 + PHYSICS.staticComp - w.r)));
}

// ---- compatibility helpers (combat explosions and harpoons push vehicles through these) ----

const comW = (v, out) => out.copy(v.com || t2.set(0, 0, 0)).applyQuaternion(v.quat).add(v.pos);
function applyInvI(v, vec) {
  qi.copy(v.quat).invert();
  vec.applyQuaternion(qi).multiply(v.invI).applyQuaternion(v.quat);
  return vec;
}
export function pointVel(v, p, out) {
  comW(v, t1);
  t1.subVectors(p, t1);
  return out.crossVectors(v.angVel, t1).add(v.vel);
}
// Impulse j (N s) at world point p. Writes vel/angVel; the body picks them up before the next step.
export function applyImpulse(v, p, j) {
  v.vel.addScaledVector(j, 1 / v.mass);
  comW(v, t1);
  t1.subVectors(p, t1);
  t2.crossVectors(t1, j);
  v.angVel.add(applyInvI(v, t2));
}

// ---- body and controller ----

function register(P, v) {
  const R = P.R, C = v.chassis, [hx, hy, hz] = C.hit.half, c = C.hit.center;
  const remote = isRemote(v);
  const d = (remote ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic())
    .setTranslation(v.pos.x, v.pos.y, v.pos.z).setRotation(v.quat)
    .setLinvel(v.vel.x, v.vel.y, v.vel.z).setAngvel(v.angVel)
    .setAdditionalMassProperties(v.mass, v.com, v.inertia, IDQ)
    .setLinearDamping(PHYSICS.linDamp).setAngularDamping(PHYSICS.groundAngDamp)
    .setCcdEnabled(true).setCanSleep(false);
  const rb = R.createRigidBody(d);
  const r = Math.min(PHYSICS.bodyRound, hx * 0.4, hy * 0.4, hz * 0.4);
  const col = R.createCollider(
    RAPIER.ColliderDesc.roundCuboid(hx - r, hy - r, hz - r, r).setTranslation(c[0], c[1], c[2]).setDensity(0)
      .setFriction(PHYSICS.bodyFriction).setRestitution(PHYSICS.bodyRestitution)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(v.mass * PHYSICS.impactForcePerKg),
    rb,
  );
  v.rb = rb; v.col = col; v.phys = P; v.kinematic = remote;
  P.vehicles.add(v); P.byCollider.set(col.handle, v); P.active++;
  v._stale = false; v._prep = P.tick;
  if (!remote) buildController(P, v);
  snap(v);
}

const liveWheels = (v) => v.chassis.wheels.reduce((n, w, i) => n + (v.mesh.wheels[i].part.detached ? 0 : 1), 0);

// (Re)builds the wheel set. A wheel shot off is left out, so the car drops onto that corner.
function buildController(P, v) {
  if (v.ctrl) P.R.removeVehicleController(v.ctrl);
  const C = v.chassis, s = v.stats, n = C.wheels.length;
  const ctrl = P.R.createVehicleController(v.rb);
  ctrl.indexUpAxis = 1;
  ctrl.setIndexForwardAxis = 2;
  // Per-unit-mass spring and dampers (Rapier multiplies the suspension force by the chassis mass).
  const k = WORLD.gravity / (n * PHYSICS.staticComp), w0 = Math.sqrt(k / n);
  v.wmap = [];
  C.wheels.forEach((wd, i) => {
    if (v.mesh.wheels[i].part.detached) return;
    const j = ctrl.numWheels();
    ctrl.addWheel({ x: wd.pos[0], y: wd.pos[1] + C.susLen / 2, z: wd.pos[2] }, { x: 0, y: -1, z: 0 }, { x: 1, y: 0, z: 0 }, C.susLen, wd.r);
    ctrl.setWheelSuspensionStiffness(j, k);
    ctrl.setWheelSuspensionCompression(j, 2 * PHYSICS.zetaComp * w0);
    ctrl.setWheelSuspensionRelaxation(j, 2 * PHYSICS.zetaRelax * w0);
    ctrl.setWheelMaxSuspensionForce(j, (v.mass * WORLD.gravity / n) * PHYSICS.maxSusLoad);
    ctrl.setWheelMaxSuspensionTravel(j, C.susLen);
    ctrl.setWheelFrictionSlip(j, s.grip * PHYSICS.frictionSlip);
    ctrl.setWheelSideFrictionStiffness(j, PHYSICS.sideStiffness);
    v.wmap.push(i);
  });
  v.ctrl = ctrl;
  v.wheelsLive = v.wmap.length;
  v._hb = null; v._rg = null; v._rs = null;
}

export function removeBody(v) {
  const P = v.phys;
  if (!P || !v.rb) return;
  if (v.ctrl) P.R.removeVehicleController(v.ctrl);
  P.byCollider.delete(v.col.handle);
  P.R.removeRigidBody(v.rb);
  P.vehicles.delete(v); P.pending.delete(v);
  if (!v._stale) P.active--;
  v.rb = null; v.ctrl = null; v.col = null; v.phys = null;
}

// ---- mirroring game state <-> body ----

function snap(v) {
  const s = v._s;
  s[0] = v.pos.x; s[1] = v.pos.y; s[2] = v.pos.z;
  s[3] = v.quat.x; s[4] = v.quat.y; s[5] = v.quat.z; s[6] = v.quat.w;
  s[7] = v.vel.x; s[8] = v.vel.y; s[9] = v.vel.z;
  s[10] = v.angVel.x; s[11] = v.angVel.y; s[12] = v.angVel.z;
}

// Game code wrote to pos/quat/vel/angVel since the last step: push it into the body.
function pullWrites(v) {
  const s = v._s, rb = v.rb;
  let dirty = false;
  if (v.pos.x !== s[0] || v.pos.y !== s[1] || v.pos.z !== s[2]) {
    const jump = Math.hypot(v.pos.x - s[0], v.pos.y - s[1], v.pos.z - s[2]);
    if (!v.kinematic) rb.setTranslation(v.pos, true);
    if (jump > 2.5) { v.righting = null; v.flipTime = 0; v.airTime = 0; v.justLanded = 0; if (rb.isKinematic() && !isRemote(v)) makeDynamic(v); }
    dirty = true;
  }
  if (v.quat.x !== s[3] || v.quat.y !== s[4] || v.quat.z !== s[5] || v.quat.w !== s[6]) { v.quat.normalize(); if (!v.kinematic) rb.setRotation(v.quat, true); dirty = true; }
  if (v.vel.x !== s[7] || v.vel.y !== s[8] || v.vel.z !== s[9]) { if (!v.kinematic) rb.setLinvel(v.vel, true); dirty = true; }
  if (v.angVel.x !== s[10] || v.angVel.y !== s[11] || v.angVel.z !== s[12]) { if (!v.kinematic) rb.setAngvel(v.angVel, true); dirty = true; }
  if (dirty) snap(v);
}

function makeKinematic(v) {
  v.rb.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  v.kinematic = true;
}
function makeDynamic(v) {
  v.rb.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  v.kinematic = false;
}

// ---- per-vehicle controls (before the world step) ----

function preStep(P, v, dt) {
  const rb = v.rb;
  // A car (re)spawned on a ramp sometimes comes back from Rapier disabled and frozen in place (seen on the
  // first kicker, where the demo reel starts); re-enable it so it drives off.
  if (!rb.isEnabled()) rb.setEnabled(true);
  pullWrites(v);
  if (isRemote(v)) {
    if (!v.kinematic) { makeKinematic(v); if (v.ctrl) { P.R.removeVehicleController(v.ctrl); v.ctrl = null; } }
    rb.setNextKinematicTranslation(v.pos); rb.setNextKinematicRotation(v.quat);
    return;
  }
  if (!v.ctrl || liveWheels(v) !== v.wheelsLive) buildController(P, v);
  if (v.righting) { rightingStep(v, dt); return; }
  if (v.kinematic) makeDynamic(v);

  const s = v.stats, C = v.chassis, ctl = v.ctl, alive = v.alive, ctrl = v.ctrl;
  up.copy(UP).applyQuaternion(v.quat);
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  right.set(1, 0, 0).applyQuaternion(v.quat);
  const speed = v.vel.dot(fwd), asp = Math.abs(speed);
  const grounded = v.contacts >= 2, airborne = v.contacts === 0;
  const overload = clamp((v.loadMass || 0) / s.load - 1, 0, 1) * OVERLOAD_MAX_PENALTY;
  const winged = !!(v.wings && v.wingAero && v.wingAero.has); // wings still on the car (vehicles/wingFlight.js)
  let topMs = (s.topSpeed / 3.6) * (1 - overload) * (v.wingAero ? v.wingAero.topSpeedMul : 1);
  if (isTank(v) && P.world?.roads) {
    const road = P.world.roads.nearest(v.pos.x, v.pos.z, 9, true);
    topMs = ((road && road.dist < 7 ? s.topSpeed : TANK.offRoadTop) / 3.6) * (1 - overload);
  }
  const steerMax = THREE.MathUtils.lerp(s.steerMax, s.steerMin, clamp(asp / topMs, 0, 1));
  // Steering slews linearly: full lock in FEEL.steerLockTime, back to centre in FEEL.steerCentreTime (feel.js).
  const steerTo = (alive ? ctl.steer : 0) * steerMax;
  const centring = Math.abs(steerTo) < Math.abs(v.steer) || steerTo * v.steer < 0;
  const steerStep = (steerMax / (centring ? FEEL.steerCentreTime : FEEL.steerLockTime)) * dt;
  v.steer += clamp(steerTo - v.steer, -steerStep, steerStep);

  // Turbo. The first FEEL.turboKickHold s of a press push FEEL.turboKick x, then ease back to normal.
  const turboOn = alive && ctl.turbo && v.turbo > 0.01;
  if (turboOn) v.turbo = Math.max(0, v.turbo - (dt / TURBO.drainTime) * (airborne ? FEEL.turboAirDrain * airDrain(v, winged, WING_TURBO_DRAIN) : 1)); // in the air: the Flight rule's burn, slower on a bigger tank
  else if (asp * 3.6 > TURBO.refillSpeed) v.turbo = Math.min(1, v.turbo + TURBO.refillRate * dt * (v.nitro ? 1.5 : 1));
  if (turboOn && !v.turboActive && grounded) rb.applyImpulse(t1.copy(fwd).multiplyScalar(TURBO.kick * v.mass), true);
  v.turboT = turboOn && v.turboActive ? v.turboT + dt : 0;
  v.turboActive = turboOn;
  // No kick when the game rules turn turbo strength down to nothing.
  const kick = turboOn && TURBO.force > 1 ? 1 + (FEEL.turboKick - 1) * clamp(1 - (v.turboT - FEEL.turboKickHold) / FEEL.turboKickFade, 0, 1) : 1;

  // Brake drift: brake + a hard steer at speed lowers rear grip (v.drift 0..1); handbrake stays the sharper drift.
  const throttle = alive ? ctl.throttle : 0, brake = alive ? ctl.brake : 0;
  const hard = Math.abs(v.steer) >= FEEL.driftSteer * steerMax;
  const wantDrift = alive && !s.bike && grounded && brake > 0 && hard && speed * 3.6 > (v.drift > 0 ? FEEL.driftKeepKmh : FEEL.driftMinKmh);
  v.drift = clamp(v.drift + (wantDrift ? dt / FEEL.driftIn : -dt / FEEL.driftOut), 0, 1);
  const dk = smooth(v.drift);

  // Engine, brakes, reverse. Round 16: full pull up to FEEL.pullFullKmh, then it falls off with speed (feel.js
  // enginePull). The turbo multiplies the engine by boost (TURBO.force, or the car's own from workshop/apply.js), but
  // its extra fades with speed (turboGain): a hard launch, not a rocket at speed. gs: speed over the ground along the
  // car, so a wheelie (nose up, little speed along the nose) cannot run past the top speed.
  const top = topMs * (turboOn ? TURBO.speed : 1);
  const gs = speed > 0 ? Math.hypot(speed, v.vel.dot(up)) : 0;
  const boost = turboOn ? (v.turboBoost || TURBO.force) : 1, tg = turboOn ? turboGain(gs, topMs) : 0;
  let drive = 0, brakeImp = 0;
  if (throttle > 0) drive = throttle * s.accel * v.mass * (1 + (boost * kick - 1) * tg) * enginePull(gs, topMs, top);
  if (brake > 0) {
    if (speed > 1) brakeImp = brake * s.brake * v.mass * dt * (1 - (1 - FEEL.driftBrake) * dk);
    else drive -= brake * s.accel * 0.7 * v.mass * Math.max(0, 1 + Math.min(0, speed) / PHYSICS.reverseSpeed);
  }
  if (!alive) brakeImp = PHYSICS.wreckBrake * v.mass * dt;
  else if (!throttle && !brake) brakeImp = (PHYSICS.rolling + PHYSICS.engineBrake * Math.min(1, asp / 10)) * v.mass * dt;

  // Drift assist: the front wheels follow the slide (counter-steer), and past FEEL.driftAngle the yaw that would
  // open the slide further is bled off, so the angle holds instead of turning into a spin.
  const hand = alive && ctl.handbrake;
  let wheelSteer = v.steer;
  if (dk > 0 && speed > 3) {
    const slip = Math.atan2(v.vel.dot(right), speed);
    wheelSteer = clamp(v.steer + clamp(slip * FEEL.driftCounter, -FEEL.driftCounterMax, FEEL.driftCounterMax) * dk, -s.steerMax, s.steerMax);
    const yaw = v.angVel.dot(up), over = Math.abs(slip) * (180 / Math.PI) - FEEL.driftAngle;
    if (over > 0 && yaw * slip > 0) {
      v.angVel.addScaledVector(up, -yaw * Math.min(1, FEEL.driftHold * over * dt) * dk);
      rb.setAngvel(v.angVel, true);
      v._s[10] = v.angVel.x; v._s[11] = v.angVel.y; v._s[12] = v.angVel.z;
    }
  }

  const nl = v.wmap.length;
  if (isTank(v)) {
    tankPreStep(v, P.world, ctrl, nl, C, drive, brakeImp, dt, topMs);
    if (v._tankTopMs) topMs = v._tankTopMs;
  } else {
    let driveCount = 0;
    for (const i of v.wmap) if (C.wheels[i].drive) driveCount++;
    for (let j = 0; j < nl; j++) {
      const wd = C.wheels[v.wmap[j]], rear = !wd.steer;
      const hb = hand && rear;
      ctrl.setWheelEngineForce(j, wd.drive && driveCount && !hb ? drive / driveCount : 0);
      ctrl.setWheelBrake(j, hb ? v.mass * 30 * dt : brakeImp / nl);
      ctrl.setWheelSteering(j, wd.steer ? -wheelSteer : 0);
    }
    const biteK = hand || s.bike ? 0 : clamp((FEEL.biteNone - asp / topMs) / (FEEL.biteNone - FEEL.biteFull), 0, 1);
    const frontGrip = 1 + Math.round((FEEL.frontGrip - 1) * biteK * 50) / 50;
    const rearGrip = (hand ? PHYSICS.handbrakeGrip : 1) * (1 - (1 - FEEL.driftRearGrip) * dk);
    const rearSide = (hand ? PHYSICS.handbrakeSide : 1) * (1 - (1 - FEEL.driftRearGrip) * dk);
    if (v.trapGrip !== undefined) v._rg = null;
    else if (v._rg !== rearGrip || v._rs !== rearSide || v._fg !== frontGrip || v._hb !== hand) {
      v._rg = rearGrip; v._rs = rearSide; v._fg = frontGrip; v._hb = hand;
      for (let j = 0; j < nl; j++) {
        const rear = !C.wheels[v.wmap[j]].steer;
        ctrl.setWheelFrictionSlip(j, s.grip * PHYSICS.frictionSlip * (rear ? rearGrip : frontGrip));
        ctrl.setWheelSideFrictionStiffness(j, PHYSICS.sideStiffness * (rear ? rearSide : 1));
      }
    }
  }

  // Forces: aero drag, a little downforce on the ground, turbo push (ground) or thrust along the nose (air).
  rb.resetForces(false);
  const sp = v.vel.length();
  force.copy(v.vel).multiplyScalar(-PHYSICS.drag * sp * v.mass);
  if (grounded) force.addScaledVector(up, -PHYSICS.downforce * speed * speed * v.mass);
  if (turboOn) {
    if (airborne) {
      // Round 14: jet thrust along the nose plus a hold force by aero and weight (vehicles/turboFlight.js).
      airTurbo(v, force, fwd, speed, topMs, TURBO.airThrust * FEEL.turboAirMul * (s.accel * boost + TURBO.push), WORLD.gravity, winged);
    }
    else if (grounded) force.addScaledVector(fwd, TURBO.push * kick * tg * v.mass * Math.max(0, 1 - gs / (top * 1.05)));
  }
  if (v.wings) wingStep(v, force, fwd, up, right, speed, airborne, turboOn, dt, WORLD.gravity);
  rb.addForce(force, true);
  rb.setAngularDamping(airborne ? PHYSICS.airAngDamp : PHYSICS.groundAngDamp);

  if (airborne && alive) airControl(v, dt);
  v._vpre.copy(v.vel);
}

// W/S pitch and A/D roll (the arrows never reach here), Q/E yaw, Space levels. Keys held through take-off do nothing until released,
// so holding W off a ramp does not nose the car into the ground.
function airControl(v, dt) {
  const ctl = v.ctl, onBody = restingOnBody(v);
  if (onBody) return;
  const pIn = ctl.pitch || 0, rIn = ctl.roll || 0, yIn = ctl.yaw || 0;
  if (!pIn) v.armP = true;
  if (!rIn) v.armR = true;
  const p = v.armP ? pIn : 0, r = v.armR ? rIn : 0;
  qi.copy(v.quat).invert();
  lw.copy(v.angVel).applyQuaternion(qi);
  // Pitch and roll reach their top rate FEEL.airRampTime after key down and die fast on release (feel.js); with the
  // turbo burning every rate is FEEL.airTurboRate x.
  const drive = (cur, input, acc, mr, dmp) => (input ? clamp(cur - input * acc * dt, -mr, mr) : cur * Math.max(0, 1 - dmp * dt));
  const tk = v.turboActive ? FEEL.airTurboRate : 1, pr = FEEL.airPitchRate * tk, rr = FEEL.airRollRate * tk;
  lw.x = drive(lw.x, p, pr / FEEL.airRampTime, pr, FEEL.airDamp);
  lw.z = drive(lw.z, r, rr / FEEL.airRampTime, rr, FEEL.airDamp);
  lw.y = drive(lw.y, yIn, PHYSICS.airYaw * tk, PHYSICS.airMaxRate * tk, PHYSICS.airDamp);
  ww.copy(lw).applyQuaternion(v.quat);
  const level = ctl.level ? PHYSICS.airLevel : !p && !r && !yIn && up.y > 0.25 ? PHYSICS.airAutoLevel : 0;
  if (level) {
    // Turn toward the same heading with the roof up; only the tilt (horizontal) axes are steered.
    uprightQuat(v.quat, qa);
    qb.copy(qa).multiply(qi);
    if (qb.w < 0) { qb.x = -qb.x; qb.y = -qb.y; qb.z = -qb.z; qb.w = -qb.w; }
    const ang = 2 * Math.acos(clamp(qb.w, -1, 1)), sn = Math.sqrt(Math.max(1e-9, 1 - qb.w * qb.w));
    t1.set(qb.x / sn, 0, qb.z / sn).multiplyScalar(ang * level);
    const k = Math.min(1, level * dt);
    ww.x += (t1.x - ww.x) * k; ww.z += (t1.z - ww.z) * k;
  }
  v.rb.setAngvel(ww, true);
  v.angVel.copy(ww);
  v._s[10] = ww.x; v._s[11] = ww.y; v._s[12] = ww.z;
}

// Upright orientation with the same heading (from the nose, or the roof when the nose points straight up/down).
function uprightQuat(q, out) {
  t2.set(0, 0, -1).applyQuaternion(q);
  if (t2.x * t2.x + t2.z * t2.z < 0.01) {
    // Nose straight up: the belly faces the way the car was going; nose straight down: the roof does.
    const s = Math.sign(t2.y) || 1;
    t2.set(0, -1, 0).applyQuaternion(q).multiplyScalar(s);
  }
  return out.setFromAxisAngle(UP, Math.atan2(-t2.x, -t2.z));
}

const bodyRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
function restingOnBody(v) {
  const P = v.phys, h = v.chassis.hit.half;
  bodyRay.origin = { x: v.pos.x, y: v.pos.y, z: v.pos.z };
  const hit = P.R.castRay(bodyRay, Math.max(h[0], h[1]) + 0.45, true, RAY_FLAGS);
  return !!hit;
}

// ---- flips: auto-right and R ----

export function startRighting(v) {
  if (!v.rb || v.righting || isRemote(v)) return false;
  const gy = v.phys ? v.phys.world.groundAt(v.pos.x, v.pos.z, v.pos.y + 1.5) : v.pos.y - v.rideH;
  v.righting = { t: 0, q0: v.quat.clone(), q1: uprightQuat(v.quat, new THREE.Quaternion()), y0: v.pos.y, y1: Math.max(gy, v.pos.y - 3) + v.rideH + 0.12, x: v.pos.x, z: v.pos.z };
  v.flipTime = 0;
  makeKinematic(v);
  return true;
}

function rightingStep(v, dt) {
  const r = v.righting, k = Math.min(1, (r.t += dt) / PHYSICS.rightTime), e = smooth(k);
  v.quat.slerpQuaternions(r.q0, r.q1, e);
  v.pos.set(r.x, THREE.MathUtils.lerp(r.y0, r.y1, e) + Math.sin(Math.PI * k) * PHYSICS.rightLift, r.z);
  v.rb.setNextKinematicTranslation(v.pos);
  v.rb.setNextKinematicRotation(v.quat);
  if (k >= 1) r.done = true;
}

function finishRighting(v) {
  makeDynamic(v);
  v.rb.setTranslation(v.pos, true); v.rb.setRotation(v.quat, true);
  v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
  v.rb.setLinvel(v.vel, true); v.rb.setAngvel(v.angVel, true);
  v.righting = null; v.flipTime = 0;
}

// Instant upright reset (kept for old callers); prefer startRighting.
export function resetUpright(v, lift = 1.8) {
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  v.quat.setFromAxisAngle(UP, Math.atan2(-fwd.x, -fwd.z));
  v.pos.y += lift;
  v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
}

// Test helper: lay the car on its roof on the ground where it stands.
export function flipOver(v) {
  const C = v.chassis, gy = v.phys ? v.phys.world.groundAt(v.pos.x, v.pos.z, v.pos.y + 1) : v.pos.y - v.rideH;
  uprightQuat(v.quat, qa);
  qb.setFromAxisAngle(t1.set(0, 0, 1), Math.PI);
  v.quat.copy(qa).multiply(qb);
  v.pos.y = gy + C.hit.center[1] + C.hit.half[1] + 0.05;
  v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
  v.righting = null; v.flipTime = 0;
}

// ---- after the world step ----

function postStep(P, v, dt) {
  if (isRemote(v)) return;
  const rb = v.rb;
  const p = rb.translation(), q = rb.rotation(), lv = rb.linvel(), av = rb.angvel();
  if (!Number.isFinite(p.x + p.y + p.z + q.x + q.y + q.z + q.w + lv.x + lv.y + lv.z + av.x + av.y + av.z)) {
    // Never let a NaN out: restore the last good pose, at rest.
    const s = v._s;
    v.pos.set(s[0], s[1] + 0.5, s[2]); v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
    rb.setTranslation(v.pos, true); rb.setRotation(v.quat, true); rb.setLinvel(v.vel, true); rb.setAngvel(v.angVel, true);
    snap(v);
    return;
  }
  v.pos.set(p.x, p.y, p.z); v.quat.set(q.x, q.y, q.z, q.w); v.vel.set(lv.x, lv.y, lv.z); v.angVel.set(av.x, av.y, av.z);
  // Keep things sane after a huge explosion stack.
  const sp = v.vel.length(), spin = v.angVel.length();
  if (sp > PHYSICS.maxSpeed) { v.vel.multiplyScalar(PHYSICS.maxSpeed / sp); rb.setLinvel(v.vel, true); }
  if (spin > PHYSICS.maxSpin) { v.angVel.multiplyScalar(PHYSICS.maxSpin / spin); rb.setAngvel(v.angVel, true); }

  if (v.righting) {
    if (v.righting.done) finishRighting(v);
    for (const st of v.wheelState) { st.contact = false; st.spin *= 0.95; }
    v.contacts = 0; v.grounded = false; v.justLanded = 0; v.sliding = 0;
    snap(v);
    return;
  }

  // Wheels
  const C = v.chassis, ctrl = v.ctrl;
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  right.set(1, 0, 0).applyQuaternion(v.quat);
  up.copy(UP).applyQuaternion(v.quat);
  const speed = v.vel.dot(fwd), side = v.vel.dot(right);
  let contacts = 0, sliding = 0;
  for (const st of v.wheelState) st.contact = false;
  if (ctrl) for (let j = 0; j < v.wmap.length; j++) {
    const st = v.wheelState[v.wmap[j]], wd = C.wheels[v.wmap[j]];
    const on = ctrl.wheelIsInContact(j);
    st.contact = on;
    if (on) {
      contacts++;
      st.comp = clamp(C.susLen - ctrl.wheelSuspensionLength(j), 0, C.susLen);
      st.spin = (v.ctl.handbrake && !wd.steer && v.alive ? 0 : speed) / wd.r;
      st.slide = Math.abs(side) > 3 ? Math.min(1, Math.abs(side) / 10) : 0;
      if (Math.abs(side) > 2.5) sliding++;
    } else { st.comp = 0; st.spin *= 0.99; st.slide = 0; }
  }
  // Take-off: keys already held stay disarmed for air control until released.
  if (!contacts && v.contacts > 0) { v.armP = !v.ctl.pitch; v.armR = !v.ctl.roll; }
  v.contacts = contacts;
  v.sliding = sliding;
  const wasAir = !v.grounded;
  v.grounded = contacts >= 2;
  v.justLanded = wasAir && v.grounded ? v.airTime : 0;
  if (!contacts) v.airTime += dt;
  else if (v.grounded && !v.justLanded) v.airTime = 0;

  // Upside down or on its side and nearly still: count, then right it.
  const stuckFlip = v.alive && up.y < PHYSICS.rightUpY && sp < PHYSICS.rightSpeed && contacts < 2;
  v.flipTime = stuckFlip ? v.flipTime + dt : 0;
  if (v.flipTime > PHYSICS.rightAfter) startRighting(v);
  snap(v);
}

// Contact force events → damage for the speed into the surface only, and car-vs-car hits for collideVehicles.
function readEvents(P) {
  const R = P.R;
  P.carHits.clear();
  P.eq.drainContactForceEvents((e) => {
    const h1 = e.collider1(), h2 = e.collider2();
    const a = P.byCollider.get(h1), b = P.byCollider.get(h2);
    if (!a && !b) return;
    const d = e.maxForceDirection();
    const dir = t1.set(d.x, d.y, d.z);
    if (a && b) {
      // n points from b toward a (the push a received).
      const dva = t2.subVectors(a.vel, a._vpre).dot(dir);
      const n = dir.clone().multiplyScalar(dva >= 0 ? 1 : -1);
      const closing = -(t2.subVectors(a._vpre, b._vpre).dot(n));
      if (closing <= 0) return;
      const key = a.id < b.id ? a.id + ":" + b.id : b.id + ":" + a.id;
      const prev = P.carHits.get(key);
      if (!prev || prev.closing < closing) P.carHits.set(key, { a, b, n, closing, point: contactPoint(R, h1, h2) || a.pos.clone().lerp(b.pos, 0.5) });
      return;
    }
    const v = a || b;
    if (!v.onImpact || !v.alive || isRemote(v)) return;
    const dv = t2.subVectors(v.vel, v._vpre).dot(dir);
    const n = dir.clone().multiplyScalar(dv >= 0 ? 1 : -1);
    const into = -v._vpre.dot(n);
    // Landing on the wheels/belly mostly goes into the suspension: only big drops hurt (bad landings are
    // already charged by the air-callout rules).
    const belly = n.y > 0.7 && t2.set(0, 1, 0).applyQuaternion(v.quat).y > 0.7;
    const min = belly ? PHYSICS.landingDamageMin : PHYSICS.impactDamageMin;
    if (into <= min || P.time - (v._lastImpact || -9) < PHYSICS.impactCooldown) return;
    v._lastImpact = P.time;
    const pt = contactPoint(R, h1, h2) || v.pos.clone().addScaledVector(n, -0.8);
    const dmg = (into - min) * PHYSICS.impactDamageScale;
    v.impactDmg = (v.impactDmg || 0) + dmg; v.impacts = (v.impacts || 0) + 1;
    v.onImpact(dmg, pt, n, null);
  });
}

function contactPoint(R, h1, h2) {
  let out = null;
  R.contactPair(R.getCollider(h1), R.getCollider(h2), (m) => {
    if (!out && m.numSolverContacts() > 0) { const p = m.solverContactPoint(0); if (p) out = new THREE.Vector3(p.x, p.y, p.z); }
  });
  return out;
}

// Only when the unstick rule asks (stuck for a while): is the body pressed against something, and which way out?
function wallContact(P, v) {
  v.wallTouch = false;
  v.wallN.set(0, 0, 0);
  P.R.contactPairsWith(v.col, (other) => {
    P.R.contactPair(v.col, other, (m) => {
      if (m.numSolverContacts() < 1) return;
      const p = m.solverContactPoint(0);
      if (!p) return;
      v.wallTouch = true;
      v.wallN.x += v.pos.x - p.x; v.wallN.z += v.pos.z - p.z;
    });
  });
}

// ---- the step ----

// One world step per tick: every vehicle's controls are prepared first; the step runs when the last vehicle
// has been prepared (or, if some vehicle was skipped, when the first vehicle of the next tick comes round).
export function stepVehicle(v, world, dt) {
  const P = getPhys(world);
  if (!P) return; // Rapier still compiling: hold everything for a frame
  if (!v.rb) register(P, v);
  if (P.pending.has(v)) flush(P, dt);
  if (v._stale) { v._stale = false; P.active++; }
  v._prep = P.tick;
  preStep(P, v, dt);
  P.pending.add(v);
  if (P.pending.size >= P.active) flush(P, dt);
}

function flush(P, dt) {
  const t0 = performance.now();
  for (const v of P.vehicles) {
    pullWrites(v);
    if (isRemote(v)) { if (!P.pending.has(v)) { v.rb.setNextKinematicTranslation(v.pos); v.rb.setNextKinematicRotation(v.quat); } continue; }
    if (v.ctrl && !v.righting) v.ctrl.updateVehicle(dt, RAY_FLAGS);
  }
  const t1s = performance.now();
  P.R.step(P.eq);
  const t2s = performance.now();
  P.time += dt;
  for (const v of P.vehicles) postStep(P, v, dt);
  readEvents(P);
  for (const v of P.vehicles) if (v.stuckT > 1) wallContact(P, v); else if (v.wallTouch) v.wallTouch = false;
  P.pending.clear();
  P.tick++;
  for (const v of P.vehicles) if (!v._stale && v._prep < P.tick - 2) { v._stale = true; P.active--; }
  const ms = performance.now() - t0, st = P.stats;
  st.ms = ms; st.stepMs = t2s - t1s; st.ctrlMs = t1s - t0;
  st.msAvg = st.steps ? st.msAvg * 0.98 + ms * 0.02 : ms;
  st.msMax = Math.max(st.msMax * 0.999, ms);
  st.steps++; st.vehicles = P.vehicles.size;
  st.total = (st.total || 0) + ms;
}

// Vehicle vs vehicle: Rapier resolves the contact by mass; this only turns the hit into damage.
// onHit(victim, attacker, dmg, point)
export function collideVehicles(a, b, onHit) {
  const P = a.phys;
  if (!P || !P.carHits.size) return;
  const key = a.id < b.id ? a.id + ":" + b.id : b.id + ":" + a.id;
  const h = P.carHits.get(key);
  if (!h) return;
  P.carHits.delete(key);
  const A = h.a, B = h.b, nrm = h.n, closing = h.closing, pt = h.point;
  if (closing > 6 && onHit) {
    const fa = fwd.set(0, 0, -1).applyQuaternion(A.quat).dot(nrm) < -0.5;
    const fb = right.set(0, 0, -1).applyQuaternion(B.quat).dot(nrm) > 0.5;
    const base = (closing - 5) * 7;
    onHit(B, A, capTankRamDamage(A, closing, base * (A.mass / 1000) * (fa ? (A.ram ? 1.6 : 1.1) : 0.6)), pt.clone());
    onHit(A, B, capTankRamDamage(B, closing, base * (B.mass / 1000) * (fb ? (B.ram ? 1.6 : 1.1) : 0.6) * (A.ram && fa ? 0.4 : 1)), pt.clone());
  }
}

export function physicsStats(world) {
  const P = world.phys;
  if (!P) return null;
  const s = P.stats;
  return { ms: +s.ms.toFixed(3), msAvg: +s.msAvg.toFixed(3), msMax: +s.msMax.toFixed(3), stepMs: +s.stepMs.toFixed(3), ctrlMs: +(s.ctrlMs || 0).toFixed(3), steps: s.steps, vehicles: s.vehicles, statics: P.statics, msMean: +((s.total || 0) / Math.max(1, s.steps)).toFixed(3) };
}