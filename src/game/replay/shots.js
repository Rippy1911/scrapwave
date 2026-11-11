// Cinematic camera shots shared by instant replays and the demo reel. Each takes the camera, a shot state and a
// subject mesh root (or a fixed point), and writes the camera pose for this frame.
import * as THREE from "three";

const fwd = new THREE.Vector3(), side = new THREE.Vector3(), want = new THREE.Vector3(), look = new THREE.Vector3();

function setFov(camera, f) { if (Math.abs(camera.fov - f) > 0.05) { camera.fov = f; camera.updateProjectionMatrix(); } }
const clampGround = (world, p, lift) => { const g = world.groundAt(p.x, p.z, p.y + 4) + lift; if (p.y < g) p.y = g; };

// A fresh shot state. kind: chase | low | trackside | orbit | high | flyby
export function newShot(kind, world, root, o = {}) {
  const s = { kind, t: 0, pos: new THREE.Vector3(), anchor: new THREE.Vector3(), ang: 0, side: Math.random() < 0.5 ? 1 : -1, snap: true, ...o };
  fwd.set(0, 0, -1).applyQuaternion(root.quaternion).setY(0);
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  side.set(-fwd.z, 0, fwd.x);
  if (kind === "trackside") {
    const lead = o.lead ?? 26;
    if (!o.at) s.anchor.copy(root.position).addScaledVector(fwd, lead).addScaledVector(side, (o.offset ?? 11) * s.side);
    else s.anchor.copy(o.at).addScaledVector(side, (o.offset ?? 12) * s.side);
    s.anchor.y = world.groundAt(s.anchor.x, s.anchor.z, s.anchor.y + 30) + (o.height ?? 1.4);
  } else if (kind === "orbit") {
    s.anchor.copy(o.at || root.position);
    s.ang = Math.atan2(side.x * s.side, side.z * s.side);
  } else if (kind === "flyby") {
    s.anchor.copy(root.position).addScaledVector(fwd, 60).addScaledVector(side, 8 * s.side);
    s.anchor.y = world.groundAt(s.anchor.x, s.anchor.z, s.anchor.y + 30) + 3;
  }
  return s;
}

// Writes the camera for this frame. root: subject Object3D. dt in real seconds.
export function applyShot(camera, world, s, root, dt) {
  s.t += dt;
  const k = s.snap ? 1 : Math.min(1, dt * 6);
  s.snap = false;
  fwd.set(0, 0, -1).applyQuaternion(root.quaternion).setY(0);
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  side.set(-fwd.z, 0, fwd.x);
  look.copy(root.position); look.y += 0.7;
  switch (s.kind) {
    case "low":
      want.copy(root.position).addScaledVector(fwd, -5.2).addScaledVector(side, 1.4 * s.side); want.y += 0.9;
      s.pos.lerp(want, k); clampGround(world, s.pos, 0.5);
      look.addScaledVector(fwd, 4);
      setFov(camera, 62); break;
    case "high":
      want.copy(root.position).addScaledVector(fwd, -16); want.y += 11;
      s.pos.lerp(want, k * 0.6 + (k === 1 ? 0.4 : 0)); clampGround(world, s.pos, 2);
      setFov(camera, 58); break;
    case "trackside": case "flyby":
      s.pos.copy(s.anchor);
      setFov(camera, s.kind === "flyby" ? 48 : 52); break;
    case "orbit": {
      s.ang += dt * (s.speed ?? 0.5) * s.side;
      if (s.follow) s.anchor.lerp(root.position, Math.min(1, dt * 4));
      const r = s.radius ?? 13;
      s.pos.set(s.anchor.x + Math.sin(s.ang) * r, s.anchor.y + (s.height ?? 4.5) + Math.sin(s.t * 0.8) * 0.6, s.anchor.z + Math.cos(s.ang) * r);
      clampGround(world, s.pos, 1.2);
      if (s.fixed) look.copy(s.anchor).setY(s.anchor.y + 0.8);
      setFov(camera, 55); break;
    }
    default: // chase
      want.copy(root.position).addScaledVector(fwd, -8); want.y += 3;
      s.pos.lerp(want, k * 0.8 + (k === 1 ? 0.2 : 0)); clampGround(world, s.pos, 1);
      look.addScaledVector(fwd, 2);
      setFov(camera, 68);
  }
  camera.position.copy(s.pos);
  camera.lookAt(look);
}