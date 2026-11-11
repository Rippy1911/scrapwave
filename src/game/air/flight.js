// Arcade flight models for the helicopter and the jet. Pure math on a small state object:
// the caller feeds controls + the ground height under the craft; this moves pos/vel/quat.
// Forward is local -Z (same as the cars), +Y is up. Never a simulator: no stall, no torque.
import * as THREE from "three";

export const FLIGHT = {
  heli: {
    maxPitch: 0.36, maxRoll: 0.4, tiltRate: 3.2, yawRate: 1.7, accel: 30, drag: 0.75,
    climb: 14, descend: 12, ceiling: 220, gear: 1.25, groundDrag: 6,
  },
  jet: {
    pitchRate: 1.35, rollRate: 2.6, yawRate: 0.55, coordTurn: 1.15, levelRate: 1.1,
    minAir: 46, cruise: 82, boost: 145, brake: 52, speedRate: 0.9, takeoff: 56,
    groundMax: 95, groundAccel: 20, ceiling: 400, gear: 1.4, maxClimb: 0.75,
  },
};

const E = new THREE.Euler(0, 0, 0, "YXZ");
const qd = new THREE.Quaternion(), ax = new THREE.Vector3(), fw = new THREE.Vector3(), rt = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ease = (a, b, k) => a + (b - a) * Math.min(1, k);

export function createFlightState(kind, pos, yaw = 0) {
  const s = {
    kind, pos: pos.clone(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(),
    yaw, pitch: 0, roll: 0, speed: 0, grounded: true, alt: 0, dead: false, spin: 0, touchdown: 0,
    stats: { ...FLIGHT[kind] },
  };
  s.quat.setFromEuler(E.set(0, yaw, 0));
  return s;
}

export function forwardOf(s, out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(s.quat); }

// ctl: { fwd (W +1 / S -1), right (D +1 / A -1), turn (E +1 / Q -1), up (Space), down (Shift) }
export function stepFlight(s, ctl, dt, groundY) {
  s.touchdown = 0;
  if (s.dead) return stepDead(s, dt, groundY);
  if (s.kind === "heli") stepHeli(s, ctl, dt, groundY);
  else stepJet(s, ctl, dt, groundY);
  s.alt = s.pos.y - groundY;
}

function stepHeli(s, c, dt, gy) {
  const T = s.stats;
  s.yaw -= c.turn * T.yawRate * dt;
  const tp = s.grounded ? 0 : -c.fwd * T.maxPitch, tr = s.grounded ? 0 : -c.right * T.maxRoll;
  s.pitch = ease(s.pitch, tp, T.tiltRate * dt); // auto-levels when the keys are released
  s.roll = ease(s.roll, tr, T.tiltRate * dt);
  fw.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
  rt.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
  const kf = -s.pitch / T.maxPitch, kr = -s.roll / T.maxRoll;
  s.vel.addScaledVector(fw, kf * T.accel * dt).addScaledVector(rt, kr * T.accel * dt);
  const drag = Math.exp(-(s.grounded ? T.groundDrag : T.drag) * dt);
  s.vel.x *= drag; s.vel.z *= drag;
  let vy = c.up ? T.climb : c.down ? -T.descend : 0; // hovers when nothing is held
  if (c.down && s.pos.y - gy < 10) vy = -Math.max(3, (s.pos.y - gy) * 1.1); // flare: soft touchdowns
  if (c.limp) vy = Math.min(vy, -2.5); // dry tank: no climb, gentle autorotation down
  if (s.pos.y - gy > T.ceiling) vy = Math.min(vy, -2);
  s.vel.y = ease(s.vel.y, vy, 3 * dt);
  if (s.grounded && c.up) s.grounded = false;
  s.pos.addScaledVector(s.vel, dt);
  if (s.pos.y <= gy + T.gear) {
    if (!s.grounded) s.touchdown = Math.max(0, -s.vel.y);
    s.pos.y = gy + T.gear; s.vel.y = Math.max(0, s.vel.y);
    s.grounded = !c.up;
  }
  s.speed = s.vel.length();
  s.quat.setFromEuler(E.set(s.pitch, s.yaw, s.roll));
}

function rotLocal(s, x, y, z, ang) {
  if (!ang) return;
  s.quat.multiply(qd.setFromAxisAngle(ax.set(x, y, z), ang));
}

function stepJet(s, c, dt, gy) {
  const T = s.stats;
  forwardOf(s, fw);
  rt.set(1, 0, 0).applyQuaternion(s.quat);
  const bank = Math.asin(THREE.MathUtils.clamp(-rt.y, -1, 1)); // + = right wing down
  if (s.grounded) {
    if (c.up || c.fwd > 0) s.speed = ease(s.speed, c.up ? T.groundMax : T.groundMax * 0.7, (T.groundAccel / T.groundMax) * dt);
    else s.speed = Math.max(0, s.speed - (c.down ? 22 : 3) * dt); // Shift brakes on the ground, else it rolls out
    s.yaw -= (c.turn + c.right) * 0.6 * dt * Math.min(1, s.speed / 15 + 0.3);
    let pitch = 0;
    if (s.speed >= T.takeoff && c.fwd < 0) pitch = 0.22; // S rotates the nose up once fast enough
    s.quat.setFromEuler(E.set(pitch, s.yaw, 0));
    forwardOf(s, fw);
    s.vel.copy(fw).multiplyScalar(s.speed);
    s.pos.addScaledVector(s.vel, dt);
    if (pitch > 0 && s.vel.y > 0) s.grounded = false;
    else s.pos.y = gy + T.gear;
    s.speed = s.vel.length();
    return;
  }
  // Air: W nose down, S nose up, A/D roll, Q/E yaw; bank turns the jet by itself.
  rotLocal(s, 1, 0, 0, -c.fwd * T.pitchRate * dt);
  rotLocal(s, 0, 0, 1, -c.right * T.rollRate * dt);
  rotLocal(s, 0, 1, 0, -c.turn * T.yawRate * dt);
  s.quat.premultiply(qd.setFromAxisAngle(UP, -Math.sin(bank) * T.coordTurn * dt));
  if (!c.right) rotLocal(s, 0, 0, 1, bank * T.levelRate * dt); // wings drift back to level
  forwardOf(s, fw);
  if (fw.y > T.maxClimb) rotLocal(s, 1, 0, 0, -(fw.y - T.maxClimb) * 2 * dt);
  if (s.pos.y - gy > T.ceiling && fw.y > -0.1) rotLocal(s, 1, 0, 0, -0.8 * dt); // ceiling: nose eases down
  s.quat.normalize();
  const target = c.up ? T.boost : c.down ? T.brake : T.cruise;
  s.speed = Math.max(T.minAir, ease(s.speed, target - fw.y * 12, T.speedRate * dt));
  forwardOf(s, fw);
  s.vel.copy(fw).multiplyScalar(s.speed);
  s.pos.addScaledVector(s.vel, dt);
  if (s.pos.y <= gy + T.gear) {
    s.touchdown = Math.max(0, -s.vel.y) + Math.abs(bank) * 20; // steep or banked = hard landing
    s.pos.y = gy + T.gear;
    s.grounded = true;
    s.yaw = Math.atan2(-fw.x, -fw.z);
  }
  E.setFromQuaternion(s.quat, "YXZ");
  if (!s.grounded) s.yaw = E.y;
  s.pitch = E.x; s.roll = E.z;
}

// Shot down: spiral to the ground under gravity, then report the impact once.
function stepDead(s, dt, gy) {
  if (s.grounded) { s.vel.set(0, 0, 0); return; }
  s.spin = Math.min(4, s.spin + dt * 2.5);
  s.yaw += s.spin * dt;
  s.roll = ease(s.roll, 0.7, dt);
  s.pitch = ease(s.pitch, -0.5, dt);
  s.vel.y -= 14 * dt;
  s.vel.x *= Math.exp(-0.4 * dt); s.vel.z *= Math.exp(-0.4 * dt);
  s.pos.addScaledVector(s.vel, dt);
  if (s.pos.y <= gy + 0.8) { s.pos.y = gy + 0.8; s.touchdown = 99; s.grounded = true; }
  s.quat.setFromEuler(E.set(s.pitch, s.yaw, s.roll));
  s.alt = s.pos.y - gy;
}