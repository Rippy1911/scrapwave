// Unstick rule for every vehicle (player, autopilot and AI):
// throttle/reverse held for 2 s under 3 km/h while touching a collider → push 2 m out along the contact normal and up 0.5 m;
// still stuck after 4 s → reset onto the nearest road point facing along the road, with a puff of dust.
import * as THREE from "three";
import { UNSTICK } from "@/game/data/tuning";
import { nearestRoadPose } from "@/game/world/spawn";
import { avoidOwns } from "@/game/ai/avoid";

const UP = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(), push = new THREE.Vector3();

export function unstickStep(game, v, dt) {
  const c = v.ctl;
  const trying = c.throttle > 0.1 || c.brake > 0.1;
  const blocked = v === game.player && (game.uiOpen || game.introT > 0);
  if (!v.alive || blocked || !trying || v.vel.length() * 3.6 >= UNSTICK.speedKmh) { v.stuckT = 0; v.pushed = false; return; }
  v.stuckT += dt;
  if (v.stuckT > UNSTICK.pushAfter && !v.pushed && v.wallTouch) {
    push.copy(v.wallN).setY(0);
    if (push.lengthSq() < 1e-4) push.set(0, 0, 1).applyQuaternion(v.quat).setY(0);
    push.normalize();
    v.pos.addScaledVector(push, UNSTICK.pushDist);
    v.pos.y += UNSTICK.pushUp;
    v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
    v.prevPos.copy(v.pos);
    v.pushed = true;
  }
  if (v.stuckT > UNSTICK.resetAfter && !avoidOwns(v)) { // AI cars back out and respawn themselves (ai/avoid.js)
    resetToRoad(game, v);
    v.stuckT = 0; v.pushed = false;
  }
}

export function resetToRoad(game, v) {
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  const pose = nearestRoadPose(game.world, v.pos.x, v.pos.z, fwd.x, fwd.z, game.vehicles, v);
  v.pos.set(pose.x, pose.y + 1.2, pose.z);
  v.quat.setFromAxisAngle(UP, pose.heading);
  v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
  v.prevPos.copy(v.pos); v.prevQuat.copy(v.quat);
  for (let i = 0; i < 6; i++) game.particles.dust(pose.x + (Math.random() - 0.5) * 3, pose.y + 0.3, pose.z + (Math.random() - 0.5) * 3, 0, 0, 2.2);
  if (v === game.player) game.emit({ type: "minor", text: "BACK ON THE ROAD" });
}