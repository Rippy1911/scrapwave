// On-foot movement: camera-relative WASD walk, Shift run, Space jump, gravity, steps up kerbs and onto low
// surfaces, slides along walls (world colliders) and around cars, and stops at the safe-zone ring.
import * as THREE from "three";
import { clampToZone } from "@/game/onfoot/zones";

export const WALK = { walk: 2.6, run: 5.8, accel: 14, jump: 5.4, gravity: 20, radius: 0.35, turn: 12, step: 0.45 };
const qi = new THREE.Quaternion(), l = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), want = new THREE.Vector3();

export function createWalker(game) {
  const w = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, grounded: true, speed: 0, running: false, blocked: false,
  };

  w.place = (x, y, z, heading) => {
    w.pos.set(x, y, z); w.vel.set(0, 0, 0); w.heading = heading; w.grounded = true; w.speed = 0;
  };

  function pushOutOfWalls() {
    for (const h of [0.45, 1.25]) {
      game.world.colliders.sphere(w.pos.x, w.pos.y + h, w.pos.z, WALK.radius, (b, nx, ny, nz, depth) => {
        if (ny > 0.7 || depth <= 0) return; // floors are handled by the ground check
        const k = 1 / Math.max(1e-6, Math.hypot(nx, nz));
        w.pos.x += nx * k * depth; w.pos.z += nz * k * depth;
      });
    }
  }

  // Cars are boxes: push the walker out along the shallowest side.
  function pushOutOfCars() {
    for (const v of game.vehicles) {
      if (!v.mesh.root.parent || v.pos.distanceToSquared(w.pos) > 64) continue;
      const [hx, hy, hz] = v.chassis.hit.half, c = v.chassis.hit.center;
      qi.copy(v.quat).invert();
      l.copy(w.pos).sub(v.pos).applyQuaternion(qi);
      const ex = hx + WALK.radius - Math.abs(l.x - c[0]), ez = hz + WALK.radius - Math.abs(l.z - c[2]);
      if (ex <= 0 || ez <= 0 || l.y > c[1] + hy || l.y + 1.7 < c[1] - hy) continue;
      if (ex < ez) l.x += Math.sign(l.x - c[0] || 1) * ex; else l.z += Math.sign(l.z - c[2] || 1) * ez;
      w.pos.copy(l.applyQuaternion(v.quat).add(v.pos));
    }
  }

  // move: { x, z (-1..1), run, jump }; camFwd: ground-plane forward of the camera; zone: the zone to stay in.
  w.step = (dt, move, camFwd, zone) => {
    fwd.copy(camFwd); right.set(-fwd.z, 0, fwd.x);
    want.set(0, 0, 0).addScaledVector(fwd, move.z).addScaledVector(right, move.x);
    const n = want.length();
    w.running = !!move.run && n > 0;
    if (n > 0) {
      want.multiplyScalar((w.running ? WALK.run : WALK.walk) / Math.max(1, n));
      let d = Math.atan2(-want.x, -want.z) - w.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      w.heading += d * Math.min(1, dt * WALK.turn);
    }
    const k = Math.min(1, dt * (w.grounded ? WALK.accel : 3));
    w.vel.x += (want.x - w.vel.x) * k; w.vel.z += (want.z - w.vel.z) * k;
    if (move.jump && w.grounded) { w.vel.y = WALK.jump; w.grounded = false; }
    w.vel.y -= WALK.gravity * dt;
    w.pos.addScaledVector(w.vel, dt);
    pushOutOfWalls();
    pushOutOfCars();
    w.blocked = zone ? clampToZone(zone, w.pos) : false;
    const g = game.world.groundAt(w.pos.x, w.pos.z, w.pos.y + WALK.step);
    if (w.pos.y <= g || (w.grounded && w.vel.y <= 0 && w.pos.y - g < WALK.step)) { w.pos.y = g; w.vel.y = 0; w.grounded = true; }
    else w.grounded = false;
    w.speed = Math.hypot(w.vel.x, w.vel.z);
  };
  return w;
}