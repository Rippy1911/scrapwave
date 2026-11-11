// Walker locomotion (kinematic, no car physics): W/S walk, A/D turn, Q/E strafe, Shift run, Space jump (a real
// hop with thrusters fitted). Follows the ground, stops at walls, and burns fuel; a dry tank slows it to a crawl.
// st: the mech state (yaw, vy, air), S: compiled walker stats. Returns signed forward speed for the gait.
import * as THREE from "three";
import { FUEL } from "@/game/data/tuning";

const UP = new THREE.Vector3(0, 1, 0), G = 22;

// The player's intent from the keys; other walkers use their controls.
export function playerIntent(game) {
  const a = game.input.a, held = game.input.held;
  if (game.uiOpen) return { fwd: 0, turn: 0, strafe: 0, run: false, jump: false };
  return { fwd: a.throttle - a.brake, turn: a.steer, strafe: (held("KeyE") ? 1 : 0) - (held("KeyQ") ? 1 : 0), run: held("ShiftLeft") || held("ShiftRight"), jump: held("Space") };
}
export const ctlIntent = (c) => ({ fwd: (c.throttle || 0) - (c.brake || 0), turn: c.steer || 0, strafe: 0, run: !!c.turbo, jump: false });

export function walkStep(game, v, st, S, it, dt, onLand) {
  const w = game.world, stance = st.stance;
  const fuelOn = !game.ruleSys || game.ruleSys.fuelOn();
  const slow = fuelOn && v.fuel <= 0 ? 0.35 : 1;
  const max = (it.run ? S.run : S.walk) * slow;
  st.yaw -= it.turn * S.turn * dt;
  const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
  const tx = (fx * it.fwd + rx * it.strafe * 0.6) * max, tz = (fz * it.fwd + rz * it.strafe * 0.6) * max;
  const acc = Math.min(1, dt * (st.air ? 1.5 : 6));
  v.vel.x += (tx - v.vel.x) * acc; v.vel.z += (tz - v.vel.z) * acc;
  // Walls, rocks and buildings stop the walker (checked at knee and chest height).
  const sp = Math.hypot(v.vel.x, v.vel.z);
  if (sp > 0.01) {
    const dx = v.vel.x / sp, dz = v.vel.z / sp, reach = sp * dt + 1.2;
    const g0 = w.groundAt(v.pos.x, v.pos.z, v.pos.y + 2);
    for (const hy of [g0 + 1, v.pos.y + 1.5]) {
      const h = w.colliders.raycast(v.pos.x, hy, v.pos.z, dx, 0, dz, reach);
      if (h && h.t < reach) { v.vel.x = 0; v.vel.z = 0; break; }
    }
  }
  v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
  const ground = w.groundAt(v.pos.x, v.pos.z, v.pos.y + 2);
  if (st.air) {
    st.vy -= G * dt; v.pos.y += st.vy * dt;
    if (v.pos.y <= ground + stance) { v.pos.y = ground + stance; const hit = -st.vy; st.vy = 0; st.air = false; onLand(hit); }
  } else {
    v.pos.y += (ground + stance - v.pos.y) * Math.min(1, dt * 12);
    if (it.jump && !st.jumpHeld) { st.vy = S.hop ? S.jump : Math.min(S.jump, 4.5); st.air = true; st.thrust = S.hop ? 0.5 : 0; }
  }
  st.jumpHeld = it.jump;
  st.thrust = Math.max(0, (st.thrust || 0) - dt);
  v.vel.y = st.air ? st.vy : 0;
  v.quat.setFromAxisAngle(UP, st.yaw); v.angVel.set(0, 0, 0);
  v.contacts = 4; v.grounded = !st.air; v.airTime = 0;
  const moving = Math.min(1, sp / Math.max(0.5, S.walk));
  if (fuelOn) v.fuel = Math.max(0, v.fuel - FUEL.burn * S.burn * (0.25 + moving + (st.thrust > 0 ? 2 : 0)) * (v.fuelUse || 1) * dt);
  return v.vel.x * fx + v.vel.z * fz;
}