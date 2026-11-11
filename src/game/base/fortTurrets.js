// Fortress turrets (host): the head swings to the nearest non-raider car in range and sight, fires MG bursts
// and now and then a homing rocket. Their own rockets never hurt their own fortress.
import * as THREE from "three";
import { applyDamage } from "@/game/net/damage";
import { limitAim } from "@/game/weapons/aimLimits";

const RANGE = 120, MG_GAP = 0.13, MG_DMG = 5, RK_GAP = 7, RK_SPEED = 60;
const hq = new THREE.Quaternion();
// Round 14: fortress barrels obey the shared limits (35 degrees up, 20 down), measured from the turret head.
const limited = (pc, d) => limitAim(d, pc.o.head.getWorldQuaternion(hq));
const mz = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), aim = new THREE.Vector3();
const raider = (v) => v.team === "rattler" || v.team === "warlord";

export function createFortTurrets(game) {
  const rockets = [];
  const geo = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8).rotateX(Math.PI / 2);

  function target(pc) {
    let best = null, bd = RANGE;
    for (const v of game.vehicles) {
      if (!v.alive || raider(v) || v.team === "prop" || v.team === "cisterner" || (game.inSafeZone && game.inSafeZone(v))) continue;
      const d = Math.hypot(v.pos.x - pc.wx, v.pos.z - pc.wz);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function muzzle(pc, i) { pc.o.head.updateWorldMatrix(true, false); return pc.o.head.localToWorld(mz.set(i % 2 ? 0.25 : -0.25, 0.05, -2)); }

  function stepTurret(pc, dt) {
    const t = pc.tgt && pc.tgt.alive && pc.tgt.pos.distanceTo(pc.o.root.position) < RANGE * 1.1 ? pc.tgt : target(pc);
    pc.tgt = t;
    if (!t) return;
    const yaw = Math.atan2(-(t.pos.x - pc.wx), -(t.pos.z - pc.wz)) - pc.yaw;
    let d = yaw - pc.o.head.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    pc.o.head.rotation.y += d * Math.min(1, dt * 3);
    if (Math.abs(d) > 0.15) return;
    pc.mgT = (pc.mgT || 0) - dt; pc.rkT = (pc.rkT ?? 3) - dt;
    if (pc.mgT <= 0) {
      pc.mgT = MG_GAP; pc.flip = (pc.flip || 0) + 1;
      muzzle(pc, pc.flip);
      aim.copy(t.pos); aim.y += 0.6;
      limited(pc, dir.subVectors(aim, mz).normalize());
      dir.x += (Math.random() - 0.5) * 0.05; dir.y += (Math.random() - 0.5) * 0.03; dir.z += (Math.random() - 0.5) * 0.05; dir.normalize();
      const r = game.combat.ray(mz, dir, RANGE + 10, null);
      if (r.v && !raider(r.v)) applyDamage(game, r.v, MG_DMG, r.point, null, { weapon: "turretMG" });
      game.fx.tracer(mz, r.point);
      game.particles.muzzle(mz.x, mz.y, mz.z, 0.8);
      game.audio.shot("mg", mz, false);
    }
    if (pc.rkT <= 0) {
      pc.rkT = RK_GAP;
      muzzle(pc, 0);
      limited(pc, dir.subVectors(t.pos, mz).normalize());
      const mesh = new THREE.Mesh(geo, game.M.dark);
      mesh.position.copy(mz); game.scene.add(mesh);
      rockets.push({ pos: mz.clone(), vel: dir.clone().multiplyScalar(RK_SPEED), t, life: 4, mesh });
      game.audio.shot("rockets", mz, false);
    }
  }

  function boom(r, at) {
    r.mesh.removeFromParent();
    game.base.skipFort = true; // turret rockets never chip their own walls
    game.combat.explode(at, 4, 55, null, 0.6, null, "turretRocket");
    game.base.skipFort = false;
  }

  function stepRockets(dt) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.life -= dt;
      if (r.t && r.t.alive) { tmp.subVectors(r.t.pos, r.pos).normalize().multiplyScalar(RK_SPEED); r.vel.lerp(tmp, Math.min(1, dt * 1.2)); }
      const step = r.vel.length() * dt;
      dir.copy(r.vel).normalize();
      const hit = game.combat.ray(r.pos, dir, step, null);
      const own = hit.box && hit.box.piece && hit.box.piece.group.startsWith("fort:");
      if ((hit.t < step && !own) || r.life <= 0) { boom(r, hit.t < step ? hit.point.addScaledVector(dir, -0.4) : r.pos.clone()); rockets.splice(i, 1); continue; }
      r.pos.addScaledVector(r.vel, dt);
      r.mesh.position.copy(r.pos); r.mesh.lookAt(tmp.copy(r.pos).add(r.vel));
      game.particles.trail(r.pos.x, r.pos.y, r.pos.z);
    }
  }

  return {
    step(dt, turrets, host) { if (host) for (const pc of turrets) if (pc.alive && !pc.fall) stepTurret(pc, dt); stepRockets(dt); },
    clear() { for (const r of rockets) r.mesh.removeFromParent(); rockets.length = 0; },
  };
}