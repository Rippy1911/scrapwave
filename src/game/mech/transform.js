// T: Drive <-> Walker. Needs a Transform Core and 2 or 4 legs, the machine upright and nearly stopped. The fold
// takes TRANSFORM_TIME seconds of real time; sparks fly and steam vents while the parts swing. Car physics stop for
// the walker (v.walking) and the hit box stands up with it; at the end of the fold back the car is placed on the road.
import * as THREE from "three";
import { TRANSFORM_TIME, ease } from "@/game/mech/pose";
import { placeVehicle } from "@/game/vehicles/vehicle";

const UP = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(), e = new THREE.Euler(), qY = new THREE.Quaternion();

// Why a machine cannot transform now, or "" when it can.
export function blockReason(v, st, toWalk) {
  const m = v.design?.mech;
  if (!m || !m.core) return "No Transform Core";
  if (!m.walker.ok) return "Needs 2 or 4 legs";
  if (st.tr) return "Transforming";
  if (!v.alive) return "Wrecked";
  if (toWalk) {
    if (up.copy(UP).applyQuaternion(v.quat).y < 0.7) return "Get upright first";
    if (v.vel.length() > 6) return "Slow down";
  } else if (st.air) return "Land first";
  return "";
}

export function walkChassis(C, T) {
  const top = T.lift * 2, bot = -T.stance;
  return { ...C, hit: { center: [0, (top + bot) / 2, 0], half: [Math.max(1.6, T.wid / 2 + 0.7), (top - bot) / 2, 1.3] } };
}

export function startTransform(game, v, st, toWalk) {
  const why = blockReason(v, st, toWalk);
  if (why) return why;
  const ground = game.world.groundAt(v.pos.x, v.pos.z, v.pos.y + 2);
  if (toWalk) {
    st.driveH = Math.min(2.5, Math.max(0.6, v.pos.y - ground));
    st.yaw = e.setFromQuaternion(v.quat, "YXZ").y;
    st.carChassis = v.chassis;
    v.chassis = walkChassis(v.chassis, st.rig.D.T);
    v.walking = true; v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
  }
  st.tr = { t: 0, from: st.k, to: toWalk ? 1 : 0, y0: v.pos.y, q0: v.quat.clone() };
  game.audio.clank();
  if (v === game.player) game.callout(toWalk ? "WALKER MODE" : "DRIVE MODE", "Transforming", "#f2c230");
  return "";
}

// Each fixed step while a fold runs. Returns true while it is still moving.
export function transformStep(game, v, st, dt) {
  const tr = st.tr;
  if (!tr) return false;
  tr.t = Math.min(1, tr.t + dt / TRANSFORM_TIME);
  st.k = tr.from + (tr.to - tr.from) * tr.t;
  const ground = game.world.groundAt(v.pos.x, v.pos.z, v.pos.y + 2);
  const y1 = ground + (tr.to ? st.stance : st.driveH);
  v.pos.y = tr.y0 + (y1 - tr.y0) * ease(tr.t);
  v.quat.slerpQuaternions(tr.q0, qY.setFromAxisAngle(UP, st.yaw), ease(tr.t));
  v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
  // Sparks off the joints, steam from the vents.
  if (Math.random() < dt * 40) {
    const x = v.pos.x + (Math.random() - 0.5) * 3, z = v.pos.z + (Math.random() - 0.5) * 3, y = v.pos.y + Math.random() * 2.5;
    if (Math.random() < 0.6) game.particles.sparks(x, y, z, 4); else game.particles.smoke(x, y, z, false, 1.4);
  }
  if (Math.random() < dt * 3) game.audio.impact(v.pos, 0.6);
  if (tr.t < 1) return true;
  st.tr = null;
  if (!tr.to) {
    v.walking = false;
    if (st.carChassis) v.chassis = st.carChassis;
    placeVehicle(v, v.pos.x, ground + st.driveH, v.pos.z, st.yaw);
  }
  game.audio.clank();
  return false;
}