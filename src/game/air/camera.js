// Chase camera for aircraft: smooth follow behind the heading (helicopter) or behind the nose (jet, further back).
// Mouse / right-stick orbit offsets come from the normal chase cam so looking around feels the same.
import * as THREE from "three";

export function createAirCam(game) {
  const camera = game.camera;
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), fwd = new THREE.Vector3();
  let fov = 70, fresh = true;

  function update(v, dt, time) {
    const root = v.mesh.root, A = v.airStats, cam = game.cam;
    if (v.air === "jet" && !v.flight.grounded) fwd.set(0, 0, -1).applyQuaternion(root.quaternion);
    else fwd.set(-Math.sin(v.flight.yaw), 0, -Math.cos(v.flight.yaw));
    const yaw = Math.atan2(-fwd.x, -fwd.z) + cam.orbitYaw;
    const pitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -0.9, 0.9)) * 0.6 + 0.2 + cam.orbitPitch;
    const d = A.camDist * (cam.mode === 1 ? 1.5 : 1);
    want.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(d).add(root.position);
    want.y += A.camHeight * 0.4;
    if (fresh) { pos.copy(want); fresh = false; } else pos.lerp(want, Math.min(1, dt * (v.air === "jet" ? 5 : 4)));
    look.copy(root.position).addScaledVector(fwd, v.air === "jet" ? 14 : 4);
    look.y += 1.5;
    camera.position.copy(pos);
    const g = game.world.groundAt(pos.x, pos.z, pos.y + 3) + 1.5;
    if (camera.position.y < g) camera.position.y = g;
    const s = cam.shake * cam.shake;
    camera.position.x += (Math.sin(time * 47) + Math.sin(time * 31)) * s * 0.6;
    camera.position.y += Math.sin(time * 53) * s * 0.6;
    camera.lookAt(look);
    const fovT = 68 + Math.min(14, v.vel.length() * 0.12);
    fov += (fovT - fov) * Math.min(1, dt * 2);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    return true;
  }
  return { update, reset() { fresh = true; } };
}