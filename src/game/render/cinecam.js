// Cinematic camera for the autopilot / attract mode and the 2 s intro swoop:
// alternates chase cam, a low trackside angle on jumps and a slow orbit around fresh wrecks.
import * as THREE from "three";

const ease = (t) => t * t * (3 - 2 * t);

export function createCineCam(camera, chase) {
  const c = { mode: "chase", t: 0, swoopT: 0, swoopDur: 0 };
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), from = new THREE.Vector3(), anchor = new THREE.Vector3();
  const fwd = new THREE.Vector3(), side = new THREE.Vector3();

  c.swoop = (fromPos, dur) => { from.copy(fromPos); c.swoopT = 0; c.swoopDur = dur; };
  c.swooping = () => c.swoopT < c.swoopDur;

  // Intro swoop: high above the town down onto the chase position.
  c.applySwoop = (p, dt) => {
    c.swoopT += dt;
    const k = ease(Math.min(1, c.swoopT / c.swoopDur));
    pos.lerpVectors(from, chase.pos, k);
    pos.y += Math.sin(k * Math.PI) * 12;
    look.copy(p.mesh.root.position).lerp(chase.look, k);
    camera.position.copy(pos);
    camera.lookAt(look);
  };

  // Returns true when the cinematic camera owns the frame this tick.
  c.update = (game, dt) => {
    const p = game.player, root = p.mesh.root;
    c.t += dt;
    const w = game.lastWreck;
    if (c.mode !== "orbit" && w && game.time - w.time < 0.4 && w.pos.distanceTo(p.pos) < 70) {
      c.mode = "orbit"; c.t = 0; anchor.copy(w.pos); c.ang = Math.atan2(camera.position.x - anchor.x, camera.position.z - anchor.z);
    } else if (c.mode === "chase" && !p.grounded && p.airTime > 0.25 && p.vel.length() > 14) {
      c.mode = "trackside"; c.t = 0;
      fwd.copy(p.vel).setY(0).normalize();
      side.set(-fwd.z, 0, fwd.x);
      anchor.copy(p.pos).addScaledVector(fwd, Math.min(40, p.vel.length() * 0.9)).addScaledVector(side, 11);
      anchor.y = game.world.groundAt(anchor.x, anchor.z, anchor.y + 20) + 1.3;
    }
    if (c.mode === "orbit") {
      if (c.t > 3.5) { c.mode = "chase"; return false; }
      c.ang += dt * 0.45;
      camera.position.set(anchor.x + Math.sin(c.ang) * 15, anchor.y + 5 + Math.sin(c.t) * 0.8, anchor.z + Math.cos(c.ang) * 15);
      camera.lookAt(anchor.x, anchor.y + 0.8, anchor.z);
      return true;
    }
    if (c.mode === "trackside") {
      if ((p.grounded && c.t > 1.2) || c.t > 4) { c.mode = "chase"; return false; }
      camera.position.copy(anchor);
      look.copy(root.position); look.y += 0.6;
      camera.lookAt(look);
      if (Math.abs(camera.fov - 55) > 0.05) { camera.fov = 55; camera.updateProjectionMatrix(); }
      return true;
    }
    return false;
  };
  return c;
}