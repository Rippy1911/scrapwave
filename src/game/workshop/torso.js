// Walker mode geometry shared by the Workshop and the game. In Walker mode the frame (every slot part: cab, body,
// wheels, armour) stands up as the torso: nose up, roof facing forward, its tail just above the hips. Free parts
// either ride the torso (no walker placement) or have their own walker placement `w` (legs, arms, guns).
// Frames: drive placements are in the car's body frame; walker placements are in the walker root frame, whose
// origin is the hip point (stance metres above the ground), y up, forward = -z, like the car.
import * as THREE from "three";
import { CHASSIS_PARTS } from "@/game/workshop/parts";
import { FREE_PARTS, partHalf } from "@/game/workshop/freeParts";

const Q_STAND = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI, 0, "YXZ"));
const D2R = Math.PI / 180, e = new THREE.Euler(), q = new THREE.Quaternion(), v = new THREE.Vector3();

export const toQuat = (r, out = new THREE.Quaternion()) => out.setFromEuler(e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, "XYZ"));
export function toEuler(quat) {
  e.setFromQuaternion(quat, "XYZ");
  return [e.x / D2R, e.y / D2R, e.z / D2R].map((a) => Math.round(a * 10) / 10);
}

// Torso transform for a design: { lift, stance, legs, stand(k, outMatrix) } — k 0 = car, 1 = standing.
export function torsoFor(design) {
  const F = CHASSIS_PARTS[design?.parts?.chassis?.id] || CHASSIS_PARTS.light;
  const lift = F.len / 2 + 0.15;
  const legs = [];
  let stance = 0;
  for (const p of design?.free?.parts || []) {
    const pl = p.w;
    if (!pl || !isLegPart(design, p)) continue;
    legs.push(p.id);
    stance = Math.max(stance, -(pl.p[1] - partHalf(p.t)[1]));
  }
  if (!stance) stance = 1.2;
  const T = { lift, stance: Math.max(0.6, stance), len: F.len, wid: F.wid, ride: F.ride, legs };
  T.stand = (k, out = new THREE.Matrix4()) => {
    q.identity().slerp(Q_STAND, k);
    return out.compose(v.set(0, lift * k, 0), q, new THREE.Vector3(1, 1, 1));
  };
  T.Q = Q_STAND;
  return T;
}

// A placement in the walker root frame for a drive placement riding the standing torso, and back.
export function toWalk(T, p, r) {
  const pos = new THREE.Vector3(...p).applyQuaternion(T.Q).add(v.set(0, T.lift, 0));
  const quat = T.Q.clone().multiply(toQuat(r));
  return { p: pos.toArray().map((x) => Math.round(x * 1000) / 1000), r: toEuler(quat) };
}
export function toDrive(T, p, r) {
  const inv = T.Q.clone().invert();
  const pos = new THREE.Vector3(...p).sub(v.set(0, T.lift, 0)).applyQuaternion(inv);
  return { p: pos.toArray().map((x) => Math.round(x * 1000) / 1000), r: toEuler(inv.multiply(toQuat(r))) };
}

// Where a part sits in a mode: { p, r } in that mode's frame.
export function placeOf(T, part, mode) {
  if (mode !== "walk") return { p: part.p, r: part.r };
  return part.w || toWalk(T, part.p, part.r);
}

// Parts tagged as legs: everything hung (directly or through further joints) on a joint whose role is "hip".
export function isLegPart(design, part) {
  const by = new Map((design?.free?.parts || []).map((x) => [x.id, x]));
  let q2 = part, n = 0;
  while (q2 && n < 40) {
    if (FREE_PARTS[q2.t]?.joint && q2.role === "hip") return true;
    q2 = q2.limb ? by.get(q2.limb) : null; n++;
  }
  return false;
}
// "L" or "R" by which side of the centre line the part's hip sits; "F"/"B" front or back pair for four legs.
export function legOf(design, part) {
  const by = new Map((design?.free?.parts || []).map((x) => [x.id, x]));
  let q2 = part, n = 0;
  while (q2 && n < 40) {
    if (FREE_PARTS[q2.t]?.joint && q2.role === "hip") return q2;
    q2 = q2.limb ? by.get(q2.limb) : null; n++;
  }
  return null;
}