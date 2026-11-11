// Bikes. Round 15 (A): a strong upright assist. The body is held vertical while a wheel is down (and through short
// hops), the lean into a turn is drawn on the mesh and never passes 45 degrees, and the bike stands back up when the
// steering is released. A bike falls only when a car hits it hard, after a landing more than 60 degrees off, or
// after a big explosion; a fallen bike rights itself where it lies after 1.5 s, or at once on R. Wheelies only when
// asked (ctl.wheelie). In the air W, A, S, D work as before: the gentle levelling runs only with no air input.
// Also here: the tail auto-turret. No person physics: the rider hides while the bike is down. Never slows time.
import * as THREE from "three";
import { BIKE } from "@/game/data/tuning";
import { placeVehicle } from "@/game/vehicles/vehicle";

const UP = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
const ax = new THREE.Vector3(), to = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const BIKE_BALANCE = {
  roll: 160, rollDamp: 26, // wheels down: spring (1/s2) and damper (1/s) on the roll angle
  limit: 0.5, limitRate: 7, // past this roll (rad) the roll rate is simply set back toward upright
  pitchDamp: 5, // one wheel down: damp the pitch rate, so kerbs and crests cannot loop the bike
  hop: 0.45, // seconds in the air that still count as a bump, not a jump
  airRoll: 14, airRollDamp: 5, airPitch: 5, airPitchDamp: 2.2, // jumps with no air input: level out, nose along the path
  maxLean: Math.PI / 4, // the drawn lean into a turn never passes 45 degrees
  landOff: 0.5, // cos 60 deg: a landing further off than this is a fall
  hardHit: 4, // m/s the bike's speed must change in one step for a car hit to count as hard
  blastScale: 0.65, blastNear: 2, blastPerScale: 4.5, // big explosions: rockets and up, within 2 + 4.5 x scale metres
  rightTime: 1.5, rightLift: 1.0, restTime: 0.6, // down for 1.5 s, then stood up 1 m above the ground
}; // the lower centre of mass is the chassis' comDrop (data/vehicles.js bikeBase), applied in vehicles/physics.js
const B = BIKE_BALANCE;

export const isBike = (v) => !!(v && v.stats && v.stats.bike);
const riderShown = (v, on) => { for (const p of v.mesh.parts) if (p.id && p.id.startsWith("rider")) p.obj.visible = on; };
const hostile = (v, t) => t !== v && t.alive && t.team !== v.team && t.team !== "prop";
// Signed roll about the bike's own forward axis: the angle that would bring its up back to the world's up.
function rollOf(v) {
  fwd.set(0, 0, -1).applyQuaternion(v.quat); up.copy(UP).applyQuaternion(v.quat);
  return Math.atan2(ax.crossVectors(up, UP).dot(fwd), up.y);
}

// Fires the tail turret at the nearest enemy behind or beside the bike; nothing ahead, nothing aimed by the rider.
function turret(game, v) {
  const w = v.weapons.find((x) => x.tail && !x.disabled);
  v.ctl.fire = false; v.ctl.rockets = false; v.ctl.harpoon = false;
  v.tailTarget = null;
  if (!w || v.thrown || (game.inSafeZone && game.inSafeZone(v))) return;
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  let best = null, bd = w.def.range;
  for (const t of game.vehicles) {
    if (!hostile(v, t)) continue;
    to.subVectors(t.pos, v.pos);
    const d = to.length();
    if (d > bd || d < 1 || to.dot(fwd) / d > BIKE.turretArc) continue;
    best = t; bd = d;
  }
  if (!best) return;
  v.tailTarget = best;
  v.aimPoint.copy(best.pos); v.aimPoint.y += 0.4;
  v.ctl.fire = true;
}

const newState = (v) => ({ hull: v.hull, vel: v.vel.clone(), air: 0, rest: 0, blastT: -1 });

// The only reasons a bike goes down. A rider cage (round 15 F, v.guard.cage) holds the rider in while it lasts.
function fallReason(game, v, dt, s) {
  const lost = s.hull - v.hull, dv = to.subVectors(v.vel, s.vel).length();
  s.hull = v.hull; s.vel.copy(v.vel);
  const lb = game.lastBlast, caged = !!(v.guard && v.guard.cage > 0);
  let blown = false;
  if (lb && lb.time !== s.blastT) {
    s.blastT = lb.time;
    blown = game.time - lb.time < 0.3 && lb.scale >= B.blastScale && lb.pos.distanceTo(v.pos) < B.blastNear + B.blastPerScale * lb.scale;
  }
  up.copy(UP).applyQuaternion(v.quat);
  const resting = up.y < 0.3 && !v.righting && (v.contacts >= 1 || v.vel.lengthSq() < 9); // lying on its back
  s.rest = resting ? s.rest + dt : 0;
  if (caged) return s.rest > B.restTime ? "ROLLED" : null; // the cage only ever lets the bike be stood back up
  if (blown) return "BLOWN OFF";
  if (lost >= BIKE.knockDmg && dv > B.hardHit && game.vehicles.some((t) => t !== v && t.alive && t.pos.distanceTo(v.pos) < BIKE.knockNear)) return "RAMMED OFF";
  if (v.justLanded > BIKE.landAir && up.y < B.landOff) return "BAD LANDING";
  return s.rest > B.restTime ? "WIPED OUT" : null;
}

export function throwRider(game, v, why = "THROWN OFF") {
  v.thrown = B.rightTime; v.throws = (v.throws || 0) + 1;
  (game.bikeLog || (game.bikeLog = [])).push({ t: +game.time.toFixed(2), why, bike: v.stats.name, x: Math.round(v.pos.x), z: Math.round(v.pos.z) });
  riderShown(v, false);
  v.angVel.x += (Math.random() - 0.5) * 6; v.angVel.z += (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3); v.vel.y += 2;
  game.particles.dust(v.pos.x, v.pos.y, v.pos.z, 0, 0, 1.2);
  game.audio.impact(v.pos, 0.7);
  if (v === game.player) game.callout(why, `back up in ${B.rightTime} s · R to stand now`, "#ff8a3a");
}

// Stands the same bike back up where it lies, facing the way it was heading. Nothing is lost: hull, scrap and fuel stay.
export function rightBike(game, v) {
  fwd.set(0, 0, -1).applyQuaternion(v.quat).setY(0);
  if (fwd.lengthSq() < 0.01) fwd.set(0, 0, -1);
  fwd.normalize();
  const heading = Math.atan2(-fwd.x, -fwd.z), y = game.world.groundAt(v.pos.x, v.pos.z, v.pos.y + 2);
  placeVehicle(v, v.pos.x, y + B.rightLift, v.pos.z, heading);
  v.thrown = 0; v.bikeSt = null; riderShown(v, true);
}

// The upright assist. Wheels down (or a short hop): hold the body vertical, hard. A real jump with no air input:
// level the roll gently and point the nose along the flight path, so normal landings come down on the wheels.
function balance(v, dt, s) {
  const err = rollOf(v), rate = v.angVel.dot(fwd); // rollOf leaves fwd and up set
  if (v.contacts >= 1 || s.air < B.hop) {
    const follows = v.chassis.lean === false && Math.abs(err) < 0.35; // three wheels sit on a side slope
    if (Math.abs(err) > B.limit) v.angVel.addScaledVector(fwd, err * B.limitRate - rate);
    else if (!follows) v.angVel.addScaledVector(fwd, (err * B.roll - rate * B.rollDamp) * dt);
    if (v.contacts === 1) { right.set(1, 0, 0).applyQuaternion(v.quat); v.angVel.addScaledVector(right, -v.angVel.dot(right) * Math.min(1, B.pitchDamp * dt)); }
    return;
  }
  const c = v.ctl;
  if (Math.abs(c.pitch || 0) + Math.abs(c.roll || 0) + Math.abs(c.yaw || 0) > 0.1) return; // the rider is flying it
  v.angVel.addScaledVector(fwd, (err * B.airRoll - rate * B.airRollDamp) * dt);
  const sp = v.vel.length();
  if (sp < 3 || v.vel.dot(fwd) < 0) return;
  right.set(1, 0, 0).applyQuaternion(v.quat);
  const want = clamp(Math.asin(clamp(v.vel.y / sp, -1, 1)), -0.6, 0.6), have = Math.asin(clamp(fwd.y, -1, 1));
  v.angVel.addScaledVector(right, ((want - have) * B.airPitch - v.angVel.dot(right) * B.airPitchDamp) * dt);
}

// Each fixed step, after the player's controls and before physics.
export function bikeStep(game, v, dt) {
  if (!v.alive || v.remote) return;
  if (v.thrown > 0) {
    const now = !!v.ctl.reset; // R stands it up at once
    Object.assign(v.ctl, { throttle: 0, brake: 0, steer: 0, handbrake: false, turbo: false, fire: false, rockets: false, harpoon: false, pitch: 0, roll: 0, yaw: 0, wheelie: false });
    v.thrown -= dt;
    if (v.thrown <= 0 || now) rightBike(game, v);
    return;
  }
  const s = v.bikeSt || (v.bikeSt = newState(v));
  s.air = v.contacts === 0 ? s.air + dt : 0;
  const why = fallReason(game, v, dt, s);
  if (why === "ROLLED") { rightBike(game, v); return; }
  if (why) { throwRider(game, v, why); return; }
  turret(game, v);
  if (!v.righting) balance(v, dt, s);
}

// Each render frame: lean, wheelie (pivoting on the rear tyre), and the turret's aim after the crosshair aim ran.
export function bikeFrame(v, dt) {
  const s = v.stats, b = v.mesh.body, C = v.chassis;
  if (v.tailTarget && v.tailTarget.alive) { v.aimPoint.copy(v.tailTarget.pos); v.aimPoint.y += 0.4; }
  const room = Math.max(0, B.maxLean - Math.abs(rollOf(v))); // body roll plus drawn lean stays inside 45 degrees
  const speed = v.vel.dot(fwd), up2 = !v.thrown && v.alive;
  const lean = up2 ? clamp(-(v.steer / s.steerMax) * Math.min(1, Math.abs(speed) / 15) * (s.lean || 0), -room, room) : 0;
  const asked = up2 && v.ctl.wheelie && v.contacts >= 1 && speed > BIKE.wheelieMin && speed < BIKE.wheelieMax;
  const wantW = asked ? (s.wheelie || 0) * (1 - Math.min(1, Math.abs(v.ctl.steer))) : 0;
  v.leanA = (v.leanA || 0) + (lean - (v.leanA || 0)) * Math.min(1, dt * (lean === 0 ? 9 : 6)); // stands up faster than it leans
  v.wheelieA = (v.wheelieA || 0) + (wantW - (v.wheelieA || 0)) * Math.min(1, dt * 4);
  const rw = C.wheels.reduce((a, w) => (w.pos[2] > a.pos[2] ? w : a), C.wheels[0]);
  const zr = rw.pos[2], yr = rw.pos[1] - rw.r, a = v.wheelieA;
  b.rotation.set(a, 0, v.leanA);
  b.position.set(0, yr - (yr * Math.cos(a) - zr * Math.sin(a)), zr - (yr * Math.sin(a) + zr * Math.cos(a)));
}