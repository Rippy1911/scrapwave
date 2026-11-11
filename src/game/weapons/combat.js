// Weapons fire, projectiles, hit detection (vehicles, world, barrels) and explosions.
import * as THREE from "three";
import { DAMAGE, MINES } from "@/game/data/tuning";
import { applyImpulse } from "@/game/vehicles/physics";
import { applyDamage, cosmetic } from "@/game/net/damage";
import { limitAim } from "@/game/weapons/aimLimits";

const qi = new THREE.Quaternion(), lo = new THREE.Vector3(), ld = new THREE.Vector3();
const mz = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), sh = new THREE.Vector3();

function rayOBB(v, o, d, maxT) {
  const C = v.chassis;
  qi.copy(v.quat).invert();
  lo.copy(o).sub(v.pos).applyQuaternion(qi);
  ld.copy(d).applyQuaternion(qi);
  let t0 = 0, t1 = maxT;
  for (let a = 0; a < 3; a++) {
    const ax = ["x", "y", "z"][a], c = C.hit.center[a], h = C.hit.half[a];
    const oo = lo[ax] - c, dd = ld[ax];
    if (Math.abs(dd) < 1e-8) { if (oo < -h || oo > h) return Infinity; continue; }
    let ta = (-h - oo) / dd, tb = (h - oo) / dd;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

export function createCombat(game) {
  const { scene, M } = game;
  const projectiles = [], pending = [], mines = [];
  // Test counters: AI hitscan rounds fired at the player and how many hit (window.scrapwake.shotStats()).
  const stats = { aiShots: 0, aiHits: 0 };
  const rocketGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8).rotateX(Math.PI / 2);
  const shellGeo = new THREE.SphereGeometry(0.12, 6, 4);
  const spearGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6).rotateX(Math.PI / 2);
  const mineGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.2, 10);

  function ray(o, d, range, shooter) {
    let best = range, hitV = null, hitProp = null, world = false, box = null;
    const h = game.world.colliders.raycast(o.x, o.y, o.z, d.x, d.y, d.z, range);
    if (h) { best = h.t; world = true; box = h.box; }
    for (let t = 2; t < best; t += 2) {
      const y = o.y + d.y * t;
      if (y < game.world.terrain.heightAt(o.x + d.x * t, o.z + d.z * t)) { best = t - 1; world = true; box = null; break; }
    }
    for (const v of game.vehicles) {
      if (v === shooter || !v.mesh.root.parent) continue;
      if (v.pos.distanceToSquared(o) > (best + 8) ** 2) continue;
      const t = rayOBB(v, o, d, best);
      if (t < best) { best = t; hitV = v; world = false; }
    }
    for (const p of game.world.props.explosives()) {
      if (!p.alive) continue;
      tmp.set(p.x - o.x, p.y + 0.6 - o.y, p.z - o.z);
      const t = tmp.dot(d);
      if (t < 0 || t > best) continue;
      if (tmp.lengthSq() - t * t < 0.45) { best = t; hitProp = p; hitV = null; world = false; }
    }
    const hz = game.horde && game.horde.active() ? game.horde.ray(o, d, best) : null; // arena horde figures
    if (hz) return { t: hz.t, v: null, prop: null, fig: hz.f, world: false, box: null, point: o.clone().addScaledVector(d, hz.t) };
    return { t: best, v: hitV, prop: hitProp, world, box: world ? box : null, point: o.clone().addScaledVector(d, best) };
  }

  // A static collider (wall, building, base module, rock) between a blast and a car shields the car completely.
  // Callers place impact blasts a little in front of the surface they hit (see update), so the struck wall counts.
  // up, gap: for a walker the line runs to the chest (up) and cover counts to within gap of the body, so standing
  // against a wall works and a kerb covers nobody.
  function shielded(pos, v, up = 0, gap = 1) {
    sh.subVectors(v.pos, pos);
    sh.y += up;
    const L = sh.length();
    if (L < 1.2) return false;
    sh.divideScalar(L);
    const h = game.world.colliders.raycast(pos.x, pos.y, pos.z, sh.x, sh.y, sh.z, L);
    return !!h && h.t < L - gap;
  }

  function muzzleOf(w, i, out) {
    const mod = w.mount.model;
    return mod.pitch.localToWorld(out.copy(mod.muzzles[i % mod.muzzles.length]));
  }
  // v.aimFor(w, from): per-weapon aim point from assisted aim (player only); everyone else aims at v.aimPoint.
  function aimDir(v, from, spread, out, w = null) {
    out.subVectors((w && v.aimFor && v.aimFor(w, from)) || v.aimPoint, from).normalize();
    if (!v.air && v.quat) limitAim(out, v.quat); // cars, AI and walkers: no higher than 35 degrees, no lower than 20 (aircraft aim freely)
    out.x += (Math.random() - 0.5) * spread * 2; out.y += (Math.random() - 0.5) * spread * 2; out.z += (Math.random() - 0.5) * spread * 2;
    return out.normalize();
  }

  // Shots from remote cars are replayed for looks only; their owner reports the damage.
  function hitResult(r, dmg, shooter, o = {}) {
    if (shooter && shooter.remote && !game.cosmetic) return cosmetic(game, () => hitResult(r, dmg, shooter, o));
    if (r.v) {
      applyDamage(game, r.v, dmg, r.point, shooter, o);
      game.particles.sparks(r.point.x, r.point.y, r.point.z, 5);
      game.rec.event("hit", r.point);
    } else if (r.fig) {
      if (dmg > 0) game.horde.kill(r.fig, shooter);
    } else if (r.prop) {
      game.world.props.kill(r.prop);
      queueExplosion(new THREE.Vector3(r.prop.x, r.prop.y + 0.6, r.prop.z), 0.05, shooter, true);
    } else if (r.world && r.t < 400) {
      if (r.box && r.box.mod && game.base) game.base.hitBox(r.box, dmg, shooter, r.point);
      else if (r.box && r.box.onHit) r.box.onHit(dmg, shooter, r.point);
      game.particles.dust(r.point.x, r.point.y, r.point.z, 0, 0, 0.6);
      if (Math.random() < 0.3) game.particles.sparks(r.point.x, r.point.y, r.point.z, 3);
    }
  }

  function fireHitscan(v, w, dmg, pellets, spread) {
    muzzleOf(w, w.flip++, mz);
    for (let p = 0; p < pellets; p++) {
      aimDir(v, mz, spread * (v.spreadMul || 1), dir, w);
      const r = ray(mz, dir, w.def.range, v);
      if (v !== game.player && v.lockTarget === game.player) { stats.aiShots++; if (r.v === game.player) stats.aiHits++; }
      hitResult(r, dmg, v, { weapon: w.id });
      if (pellets > 1 || w.flip % (w.def.tracerEvery || 1) === 0) { game.fx.tracer(mz, r.point); if (p === 0) game.rec.event("shot", mz, r.point); }
    }
    game.particles.muzzle(mz.x, mz.y, mz.z, pellets > 1 ? 1.4 : 0.8);
    game.audio.shot(w.id, mz, v.team === "player");
  }

  function launch(v, w, kind, speed, extra = {}) {
    muzzleOf(w, w.flip++, mz);
    aimDir(v, mz, (w.def.spread || 0.01) * (v.spreadMul || 1), dir, w);
    const geo = kind === "rocket" ? rocketGeo : kind === "harpoon" ? spearGeo : kind === "cannon" ? shellGeo.clone() : shellGeo;
    const mesh = new THREE.Mesh(geo, kind === "shell" || kind === "cannon" ? M.tracer : M.dark);
    if (kind === "cannon") mesh.scale.setScalar(1.8);
    mesh.position.copy(mz);
    mesh.lookAt(mz.clone().add(dir)); mesh.rotateY(Math.PI);
    scene.add(mesh);
    projectiles.push({ kind, pos: mz.clone(), vel: dir.clone().multiplyScalar(speed).add(v.vel), shooter: v, w, life: w.def.range / speed + 0.3, mesh, target: extra.target || null });
    game.audio.shot(w.id, mz, v.team === "player");
  }

  function fire(v, dt) {
    for (const w of v.weapons) {
      if (w.disabled || !v.alive) continue;
      w.cd -= dt;
      const d = w.def, c = v.ctl;
      // Trigger by fire group (weapons/binds.js): the player's Loadout choice, else by weapon kind as before.
      const g = w.group || (d.kind === "rocket" ? "heavy" : d.kind === "harpoon" ? "aux" : "guns");
      const on = g === "guns" ? c.fire : g === "heavy" ? c.rockets : g === "aux" ? c.harpoon : false;
      if (d.kind === "hitscan" && on && w.cd <= 0) { w.cd = 1 / d.rate; fireHitscan(v, w, d.dps / d.rate, 1, d.spread); }
      else if (d.kind === "pellets" && on && w.cd <= 0) { w.cd = d.reload; fireHitscan(v, w, d.dmg, d.pellets, d.spread); }
      else if (d.kind === "shell" && on && w.cd <= 0) { w.cd = 1 / d.rate; launch(v, w, "shell", d.speed); }
      else if (d.kind === "cannon" && on && w.cd <= 0) { w.cd = d.reload; launch(v, w, "cannon", d.speed); }
      else if (d.kind === "flame") flame(v, w, dt, on);
      else if (d.kind === "rocket") {
        if (w.salvo > 0) { w.gap -= dt; if (w.gap <= 0) { w.salvo--; w.gap = d.gap; launch(v, w, "rocket", d.speed, { target: v.lockTarget }); } }
        else if (on && w.cd <= 0) { w.salvo = d.count; w.gap = 0; w.cd = d.reload; }
      } else if (d.kind === "harpoon" && on && w.cd <= 0) { w.cd = d.reload; launch(v, w, "harpoon", d.speed); }
    }
  }

  function flame(v, w, dt, on) {
    if (!on || w.cd > 0) return;
    muzzleOf(w, 0, mz);
    aimDir(v, mz, 0, dir, w);
    if (game.traps) game.traps.ignite(mz, dir, w.def.range); // flames light oil slicks
    for (let i = 0; i < 3; i++) {
      const s = 14 + Math.random() * 10;
      game.particles.fire(mz.x, mz.y, mz.z, 1.2);
      game.particles.emitFlame?.(mz, dir, s);
    }
    for (const t of game.vehicles) {
      if (t === v || !t.alive) continue;
      tmp.subVectors(t.pos, mz);
      const dist = tmp.length();
      if (dist > w.def.range || v.remote) continue;
      if (tmp.normalize().dot(dir) < Math.cos(w.def.cone)) continue;
      if (game.world.colliders.raycast(mz.x, mz.y, mz.z, tmp.x, tmp.y, tmp.z, dist)) continue; // flames stop at walls
      applyDamage(game, t, w.def.dps * dt, t.pos, v, { splash: true, weapon: "flamer" });
      if (!t.remote) { t.burn = Math.max(t.burn, w.def.burnTime); t.burnBy = v; }
    }
    if (Math.random() < dt * 8) game.audio.shot("flamer", mz, v.team === "player");
  }

  function queueExplosion(pos, delay, attacker, barrel) {
    pending.push({ pos, delay, attacker, barrel });
  }

  function explode(pos, radius, damage, attacker, scale = 1, skip = null, weapon = "explosion") {
    if (attacker && attacker.remote && !game.cosmetic) return cosmetic(game, () => explode(pos, radius, damage, attacker, scale, skip, weapon));
    if (!game.cosmetic && !skip && game.netSync) game.netSync.sendExplode(pos, radius, scale);
    game.particles.explosion(pos.x, pos.y, pos.z, scale);
    game.fx.flash(pos.x, pos.y + 1, pos.z, 600 * scale, 0.35);
    game.rec.event("explode", pos, null, scale);
    game.lastBlast = { pos: pos.clone(), time: game.time, scale };
    game.audio.explosion(pos, scale);
    game.shake(pos, scale);
    for (const v of game.vehicles) {
      if (v === skip || !v.mesh.root.parent) continue;
      const d = v.pos.distanceTo(pos);
      if (d > radius + 2 || shielded(pos, v)) continue;
      const k = 1 - Math.min(1, d / (radius + 2));
      tmp.subVectors(v.pos, pos).setY(0).normalize();
      tmp.y = 0.8;
      if (!v.remote) applyImpulse(v, v.pos.clone().addScaledVector(tmp, -0.5), tmp.multiplyScalar(DAMAGE.explosionImpulse * k * scale * Math.min(1, 2500 / v.mass)));
      if (v.alive) applyDamage(game, v, damage * k, pos.clone().lerp(v.pos, 0.7), attacker, { splash: true, weapon });
    }
    if (game.base) game.base.blast(pos, radius, damage, attacker, weapon);
    if (game.arena) game.arena.blast(pos, radius, attacker);
    if (game.traps) game.traps.blast(pos, radius); // explosions light oil slicks
    const walker = game.onfoot && game.onfoot.target(); // you, on foot: inside the radius kills, unless a wall covers you
    if (walker && !shielded(pos, walker, 0.9, 0.4)) game.onfoot.blast(pos, radius);
    game.world.props.near(pos.x, pos.z, radius, (p) => {
      game.world.props.kill(p);
      if (p.def.explosive) queueExplosion(new THREE.Vector3(p.x, p.y + 0.6, p.z), 0.12 + Math.random() * 0.15, attacker, true);
    });
  }

  function update(dt) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const e = pending[i];
      e.delay -= dt;
      if (e.delay > 0) continue;
      pending.splice(i, 1);
      if (e.barrel) game.onBarrel(e.attacker);
      explode(e.pos, DAMAGE.barrelRadius, DAMAGE.barrelDamage, e.attacker, 1.1);
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      if (p.kind === "rocket") {
        if (p.target && p.target.alive) {
          tmp.subVectors(p.target.pos, p.pos).normalize().multiplyScalar(p.vel.length());
          p.vel.lerp(tmp, Math.min(1, dt * 1.6));
        }
        game.particles.trail(p.pos.x, p.pos.y, p.pos.z);
      } else if (p.kind === "cannon") p.vel.y -= (p.w.def.drop || 9.8) * dt;
      else p.vel.y -= (p.kind === "harpoon" ? 6 : 2) * dt;
      const step = p.vel.length() * dt;
      dir.copy(p.vel).normalize();
      const r = ray(p.pos, dir, step, p.shooter);
      if (r.t < step || p.life <= 0) {
        p.mesh.removeFromParent(); projectiles.splice(i, 1);
        const d = p.w.def, at = r.point.clone().addScaledVector(dir, -0.3); // the blast starts on the near side of what it hit
        if (p.kind === "rocket") explode(at, d.splash * 1.4, d.dmg, p.shooter, 0.7, null, "rockets");
        else if (p.kind === "shell") { hitResult(r, d.dps / d.rate, p.shooter, { weapon: "autocannon" }); explode(at, d.splash * 2, 18, p.shooter, 0.3, null, "autocannon"); }
        else if (p.kind === "cannon") {
          hitResult(r, d.dmg, p.shooter, { weapon: "cannon" });
          explode(at, d.splash, d.dmg, p.shooter, 0.55, p.shooter, "cannon");
          if (r.v && !r.v.remote) {
            const imp = (d.knock || 12000) * Math.min(1, 2500 / r.v.mass);
            tmp.subVectors(r.v.pos, at).setY(0.35).normalize();
            applyImpulse(r.v, r.v.pos.clone().addScaledVector(tmp, -0.4), tmp.multiplyScalar(imp));
          }
        }
        else if (p.kind === "harpoon" && r.v) {
          hitResult(r, d.dmg, p.shooter, { weapon: "harpoon" });
          tmp.subVectors(p.shooter.pos, r.v.pos).normalize();
          if (!r.v.remote && !p.shooter.remote) applyImpulse(r.v, r.v.pos, tmp.multiplyScalar(r.v.mass * 9 * Math.min(1, (p.shooter.mass * 1.5) / r.v.mass)));
        } else hitResult(r, 0, p.shooter);
        continue;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
    }
    // Mines
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      m.life -= dt; m.arm -= dt;
      if (m.life <= 0) { m.mesh.removeFromParent(); mines.splice(i, 1); continue; }
      if (m.arm > 0) continue;
      const hit = game.vehicles.find((v) => v.alive && v !== m.owner && v.pos.distanceToSquared(m.mesh.position) < 6);
      if (hit) { m.mesh.removeFromParent(); mines.splice(i, 1); explode(m.mesh.position.clone(), m.splash, m.dmg, m.owner, m.scale, null, "mine"); }
    }
  }

  // Mines are one of the trap slot's kinds (src/game/traps/); o = { dmg, splash, scale } from the trap tier.
  function dropMine(v, o = {}) {
    const mesh = new THREE.Mesh(mineGeo, M.hazard);
    const back = new THREE.Vector3(0, 0, v.chassis.hit.half[2] + 1).applyQuaternion(v.quat).add(v.pos);
    back.y = game.world.groundAt(back.x, back.z, back.y + 1) + 0.1;
    mesh.position.copy(back); scene.add(mesh);
    const m = { mesh, owner: v, arm: MINES.arm, life: MINES.life, dmg: o.dmg ?? MINES.dmg, splash: o.splash ?? MINES.splash, scale: o.scale ?? 1 };
    mines.push(m);
    return m;
  }

  return { fire, update, explode, ray, dropMine, projectiles, stats, shielded, mines };
}