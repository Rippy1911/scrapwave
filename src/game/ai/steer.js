// Shared low-level AI control used by Rattlers, Drifters and the player autopilot:
// steering to a point, reversing out when blocked, target choice, line of sight and aim/fire.
import * as THREE from "three";
import { newAim, aimStep, skillQ, vehicleMuzzle } from "@/game/ai/aim";
import { avoidDrive } from "@/game/ai/avoid";

const qi = new THREE.Quaternion(), l = new THREE.Vector3(), o = new THREE.Vector3(), d = new THREE.Vector3(), mzv = new THREE.Vector3();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// Teams: "player", "rattler", "drifter". Drifters are free agents and fight each other too.
// The Warlord rides with the Rattlers; the Cisterner convoy is its own side; "militia" guards (round 11) too.
// Round 11: nearestHostile also asks game.factions.willAttack (factions/relations.js): standing and provocation
// decide whether a faction car goes for the player, and which factions fight each other.
const side = (t) => (t === "warlord" ? "rattler" : t);
export const hostile = (a, b) => a !== b && b.alive && (side(a.team) !== side(b.team) || a.team === "drifter");

export function newBrain(extra = {}) {
  return { think: Math.random(), mode: "roam", goal: new THREE.Vector3(), stuck: 0, reverse: 0, still: 0, los: false, orbit: Math.random() < 0.5 ? 1 : -1, target: null, ...extra };
}

// Steer/throttle toward a world point. o: { maxSpeed (m/s), turbo, noHandbrake }
export function driveTo(v, goal, dt, opt = {}) {
  const b = v.brain, c = v.ctl;
  qi.copy(v.quat).invert();
  l.copy(goal).sub(v.pos).applyQuaternion(qi);
  const ang = Math.atan2(l.x, -l.z);
  const speed = v.vel.length();
  c.steer = clamp(ang * 2.2, -1, 1);
  c.throttle = Math.abs(ang) < 1.3 ? 1 : 0.55;
  c.brake = Math.abs(ang) > 2.2 && speed > 14 ? 1 : 0;
  if (opt.maxSpeed && speed > opt.maxSpeed) { c.throttle = 0; if (speed > opt.maxSpeed + 4) c.brake = 1; }
  c.handbrake = !opt.noHandbrake && Math.abs(ang) > 1.1 && speed > 18;
  c.pitch = 0;
  c.turbo = !!opt.turbo && Math.abs(ang) < 0.3 && v.turbo > 0.05;
  if (avoidDrive(v, ang, Math.hypot(l.x, l.z), dt, opt)) return ang; // look-ahead, back-out and respawn (ai/avoid.js)
  if (c.throttle && speed < 1.5 && b.reverse <= 0) b.stuck += dt; else b.stuck = Math.max(0, b.stuck - dt);
  b.still = speed < 1 ? b.still + dt : 0;
  if (b.stuck > (opt.stuckTime || 1.6) || b.still > (opt.stillMax || 3)) { b.reverse = 1.3; b.stuck = 0; b.still = 0; }
  if (b.reverse > 0) { b.reverse -= dt; c.throttle = 0; c.brake = 1; c.steer = -Math.sign(ang || 1); c.handbrake = false; c.turbo = false; }
  return ang;
}

export function lineOfSight(game, v, t, dist) {
  o.copy(v.pos); o.y += 1.2;
  d.copy(t.pos).sub(o).normalize();
  return !game.world.colliders.raycast(o.x, o.y, o.z, d.x, d.y, d.z, dist);
}

// Nearest hostile within range that is not sheltered in the safe zone. filter(t) may veto.
export function nearestHostile(game, v, range, filter) {
  let best = null, bd = range;
  for (const t of game.vehicles) {
    if (!hostile(v, t) || game.inSafeZone(t)) continue;
    if (game.factions && !game.factions.willAttack(v, t)) continue;
    if (filter && !filter(t)) continue;
    const dd = t.pos.distanceTo(v.pos);
    if (dd < bd) { bd = dd; best = t; }
  }
  return best;
}

// Aim (ai/aim.js: line of sight from the muzzle, reaction delay, distance and speed error, imperfect lead) and
// decide which weapons to use this step. Guns fire in bursts; rockets and the harpoon only with a clear shot.
// `los` is the caller's own check (false always holds fire).
export function aimAndFire(game, v, t, dist, los) {
  const c = v.ctl, sk = v.skill, R = Math.random;
  const st = v.aimSt || (v.aimSt = newAim());
  const shell = (v.weapons || []).find((w) => !w.disabled && w.def.kind === "shell");
  const a = aimStep(game, st, v, t, dist, skillQ(sk), vehicleMuzzle(v, mzv), v.aimPoint, shell ? dist / shell.def.speed : 0);
  v.lockTarget = t;
  const safe = game.inSafeZone(v) || game.inSafeZone(t);
  const ok = !safe && los && a.ready;
  c.fire = ok && a.burst && dist < 130;
  c.rockets = ok && dist < 170 && dist > 25 && R() < 0.006 * (1 + sk.aggression);
  c.harpoon = ok && dist < 60 && R() < 0.01;
  v.aiming = c.fire || c.rockets;
}

export function holdFire(v, lookAt) {
  const c = v.ctl;
  c.fire = false; c.rockets = false; c.harpoon = false;
  v.aiming = false; v.lockTarget = null;
  if (lookAt) v.aimPoint.copy(lookAt);
}

// Orbit point for close fights so cars circle instead of parking on each other.
export function fightPoint(v, t, dist, out) {
  const lead = Math.min(1.2, dist / 60);
  out.copy(t.pos).addScaledVector(t.vel, lead);
  if (dist < 40 && !v.ram) {
    l.set(-(t.pos.z - v.pos.z), 0, t.pos.x - v.pos.x).normalize().multiplyScalar(25 * v.brain.orbit);
    out.add(l);
  }
  return out;
}