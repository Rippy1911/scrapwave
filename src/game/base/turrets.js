// Base defences. The host aims and fires MG and rocket turrets (real projectiles, leading their aim) and runs
// flame traps; other browsers get the turret aim/fire state as `turret` events and replay it for looks only.
import * as THREE from "three";
import { BASE } from "@/game/data/tuning";
import { net } from "@/game/net/net";
import { applyDamage, cosmetic } from "@/game/net/damage";
import { newAim, aimStep } from "@/game/ai/aim";
import { AIM } from "@/game/data/tuning";
import { clampPitch } from "@/game/weapons/aimLimits";

const MG = BASE.modules.mgturret, RK = BASE.modules.rocketturret, FL = BASE.modules.flametrap;
const MG_RATE = 10, MG_SPEED = 260, RK_SPEED = 70;
const aimL = new THREE.Vector3(), mz = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), aimP = new THREE.Vector3();

export function createTurrets(game) {
  const base = game.base;
  const shots = [];
  const bulletGeo = new THREE.BoxGeometry(0.08, 0.08, 1.4), rocketGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8).rotateX(Math.PI / 2);
  const remoteState = new Map();

  const hostileTo = (plot, v) => {
    if (!v.alive || base.isOwner(plot, v) || game.inSafeZone(v) || v.team === "cisterner") return false;
    if (game.weaponsSafeAt && game.weaponsSafeAt(v.pos.x, v.pos.z)) return false; // no shots into a safe zone
    if (v.team === "rattler" || v.team === "warlord" || (v.brain && v.brain.raid === plot.id)) return true;
    if ((v.hitBase || {})[plot.id] > game.time - 20) return true;
    return Math.abs(v.pos.x - plot.x) < 34 && Math.abs(v.pos.z - plot.z) < 34;
  };

  function aimHead(e, at, dt) {
    e.o.root.updateMatrixWorld();
    aimL.copy(at); e.o.root.worldToLocal(aimL);
    aimL.y -= e.o.head.position.y + e.o.pitch.position.y;
    const yaw = Math.atan2(-aimL.x, -aimL.z), pitch = clampPitch(Math.atan2(aimL.y, Math.hypot(aimL.x, aimL.z))); // the same 35 up / 20 down as every gun
    let d = yaw - e.o.head.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    e.o.head.rotation.y += d * Math.min(1, dt * 6);
    e.o.pitch.rotation.x += (pitch - e.o.pitch.rotation.x) * Math.min(1, dt * 6);
    return Math.abs(d) < 0.12;
  }

  function launch(e, kind, fake = false) {
    const mods = e.o.muzzles;
    e.flip = (e.flip || 0) + 1;
    e.o.pitch.localToWorld(mz.copy(mods[e.flip % mods.length]));
    dir.set(0, 0, -1).applyQuaternion(e.o.pitch.getWorldQuaternion(new THREE.Quaternion()));
    dir.x += (Math.random() - 0.5) * 0.02; dir.y += (Math.random() - 0.5) * 0.02; dir.z += (Math.random() - 0.5) * 0.02; dir.normalize();
    const mesh = new THREE.Mesh(kind === "mg" ? bulletGeo : rocketGeo, kind === "mg" ? game.M.tracer : game.M.dark);
    mesh.position.copy(mz); mesh.lookAt(tmp.copy(mz).add(dir));
    game.scene.add(mesh);
    const speed = kind === "mg" ? MG_SPEED : RK_SPEED;
    shots.push({ kind, pos: mz.clone(), vel: dir.clone().multiplyScalar(speed), life: (kind === "mg" ? MG.range : RK.range) / speed + 0.2, mesh, plot: e.plotRef, e, fake, target: e.target });
    game.particles.muzzle(mz.x, mz.y, mz.z, kind === "mg" ? 0.9 : 1.4);
    game.audio.shot(kind === "mg" ? "mg" : "rockets", mz, false);
  }

  function boom(s, point) {
    game.particles.explosion(point.x, point.y, point.z, 0.6);
    game.fx.flash(point.x, point.y + 1, point.z, 300, 0.25);
    game.audio.explosion(point, 0.6);
    game.shake(point, 0.5);
    if (s.fake) return;
    for (const v of game.vehicles) {
      const d = v.pos.distanceTo(point);
      if (d < 6 && v.alive && !base.isOwner(s.plot, v) && !game.combat.shielded(point, v)) applyDamage(game, v, RK.dmg * (1 - d / 7), point, null, { splash: true, weapon: "turretRocket" });
    }
    for (const m of base.modules.list) if (m.alive && m.plot !== s.plot.id && Math.hypot(m.wx - point.x, m.wz - point.z) < 6) base.damage(m, RK.dmg * 0.6, null, point, `t${s.plot.id}${s.e.id}`);
    if (net.isHost() && game.netSync) game.netSync.sendExplode(point, 6, 0.6);
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      if (s.kind === "rk") {
        if (s.target && s.target.alive) { tmp.subVectors(s.target.pos, s.pos).normalize().multiplyScalar(RK_SPEED); s.vel.lerp(tmp, Math.min(1, dt * 1.4)); }
        game.particles.trail(s.pos.x, s.pos.y, s.pos.z);
      }
      const step = s.vel.length() * dt;
      dir.copy(s.vel).normalize();
      const r = game.combat.ray(s.pos, dir, step, null);
      const own = r.v && base.isOwner(s.plot, r.v);
      if ((r.t < step && !own) || s.life <= 0) {
        s.mesh.removeFromParent(); shots.splice(i, 1);
        if (s.kind === "rk") { boom(s, r.point.addScaledVector(dir, -0.3)); continue; }
        if (r.v) { if (!s.fake) applyDamage(game, r.v, MG.dps / MG_RATE, r.point, null, { weapon: "turretMg" }); game.particles.sparks(r.point.x, r.point.y, r.point.z, 4); }
        else if (r.world && r.t < step) {
          const box = r.box;
          if (box && box.mod && box.mod.plot !== s.plot.id && !s.fake) base.damage(box.mod, MG.dps / MG_RATE, null, r.point, `t${s.plot.id}${s.e.id}`);
          game.particles.dust(r.point.x, r.point.y, r.point.z, 0, 0, 0.5);
        }
        continue;
      }
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
    }
  }

  function flame(e, dt, damage) {
    for (const v of game.vehicles) {
      if (!v.alive) continue;
      const dx = v.pos.x - e.wx, dz = v.pos.z - e.wz;
      if (dx * dx + dz * dz > 2.2 * 2.2 || !hostileTo(e.plotRef, v)) continue;
      for (let i = 0; i < 3; i++) game.particles.fire(e.wx + (Math.random() - 0.5) * 1.6, e.wy + 0.4 + Math.random(), e.wz + (Math.random() - 0.5) * 1.6, 1.6);
      if (damage) { applyDamage(game, v, FL.dps * dt, v.pos, null, { splash: true, weapon: "flameTrap" }); if (!v.remote) v.burn = Math.max(v.burn, 1.5); }
      if (Math.random() < dt * 6) game.audio.shot("flamer", v.pos, false);
    }
  }

  let sendT = 0;
  function step(dt) {
    sendT -= dt;
    const report = sendT <= 0 && net.mode === "online";
    if (report) sendT = 0.25;
    for (const e of base.modules.list) {
      if (!e.alive || e.rise > 0 || e.plotRef.dark) continue;
      if (e.kind === "flametrap") { flame(e, dt, true); continue; }
      if (e.kind !== "mgturret" && e.kind !== "rocketturret") continue;
      const range = e.kind === "mgturret" ? MG.range : RK.range;
      e.think = (e.think || 0) - dt;
      if (e.think <= 0) {
        e.think = 0.4;
        let best = null, bd = range;
        for (const v of game.vehicles) {
          if (!hostileTo(e.plotRef, v)) continue;
          const d = Math.hypot(v.pos.x - e.wx, v.pos.z - e.wz);
          if (d < bd) { bd = d; best = v; }
        }
        e.target = best;
      }
      const t = e.target;
      if (!t || !t.alive) { e.firing = false; continue; }
      // shared AI aim: line of sight from the muzzle (walls, buildings, terrain), reaction, error, MG bursts
      const dist = t.pos.distanceTo(e.o.root.position);
      e.o.root.updateMatrixWorld();
      e.o.pitch.localToWorld(mz.copy(e.o.muzzles[0]));
      const a = aimStep(game, e.aimSt || (e.aimSt = newAim()), null, t, dist, AIM.turretQ, mz, aimP, dist / (e.kind === "mgturret" ? MG_SPEED : RK_SPEED * 2));
      const on = aimHead(e, aimP, dt) && a.ready;
      e.cd = (e.cd || 0) - dt;
      e.firing = on && (e.kind === "rocketturret" || a.burst);
      if (e.firing && e.cd <= 0) {
        if (e.kind === "mgturret") { e.cd = 1 / MG_RATE; launch(e, "mg"); }
        else { e.cd = RK.reload; e.salvo = 4; }
      }
      if (e.salvo > 0) { e.gap = (e.gap || 0) - dt; if (e.gap <= 0) { e.gap = 0.18; e.salvo--; launch(e, "rk"); } }
      if (report) net.impl().sendEvent("turret", { plot: e.plot, mod: e.id, x: Math.round(aimP.x), y: Math.round(aimP.y), z: Math.round(aimP.z), f: e.firing ? 1 : 0 });
    }
    updateShots(dt);
  }

  // Non-host browsers: point and fire turrets from the host's reports; projectiles do no damage.
  function cosmeticStep(dt) {
    for (const [key, st] of remoteState) {
      const e = base.modules.find(st.plot, st.mod);
      if (!e || !e.alive || game.time - st.t > 0.6) { remoteState.delete(key); continue; }
      const on = aimHead(e, tmp.set(st.x, st.y, st.z), dt);
      e.cd = (e.cd || 0) - dt;
      if (st.f && on && e.cd <= 0) {
        if (e.kind === "mgturret") { e.cd = 1 / MG_RATE; launch(e, "mg", true); }
        else { e.cd = RK.reload; for (let i = 0; i < 4; i++) setTimeout(() => e.alive && launch(e, "rk", true), i * 180); }
      }
    }
    for (const e of base.modules.list) if (e.alive && e.kind === "flametrap" && !e.plotRef.dark) flame(e, dt, false);
    cosmetic(game, () => updateShots(dt));
  }

  return {
    step, cosmeticStep, hostileTo,
    remoteShot(m) { remoteState.set(`${m.plot}|${m.mod}`, { ...m, t: game.time }); },
    count: () => shots.length,
  };
}