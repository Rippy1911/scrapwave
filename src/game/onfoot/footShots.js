// What a walker's weapons put in the air: bullets (travel time and drop, stepped as short rays), rockets, grenades
// (bounce, fuse) and C4 charges (stick where they land or to a car, blown by hand). Hits go through the game's own
// ray and blast code (weapons/combat.js) and damage rules (net/damage.js), with the player's car as the attacker,
// so its own parked car is never in the way. No engine types here: vectors come from fx.v3 (engine/three/footFx.js).
// walkers: { ray(o, d, maxT) -> { id, t, part } | null, hit(id, part, dmg) -> { hp, dead } } (onfoot/remoteWalkers.js).
import { DAMAGE } from "@/game/data/tuning";
import { applyDamage } from "@/game/net/damage";
import { FOOT } from "@/game/onfoot/footGear";
import { throughGlass, hurtDriver } from "@/game/onfoot/driverHit";

const LOB_GRAVITY = 14;

export function createFootShots(game, fx, walkers) {
  const live = [], charges = [];
  const stats = { fired: 0, hits: 0, last: null };
  const dir = fx.v3(), end = fx.v3();
  const solid = (r) => !!(r.v || r.fig || r.prop || r.world);
  const cast = (s, len) => { dir.copy(s.v).normalize(); return game.combat.ray(s.p, dir, len, game.player); };

  function boom(p, st, weapon) {
    stats.hits++; stats.last = { kind: "blast" };
    game.combat.explode(p.clone(), st.splash, st.dmg, game.player, 0.8, null, weapon);
  }

  function bulletHit(st, r) {
    stats.hits++;
    if (r.v) {
      applyDamage(game, r.v, st.car, r.point, game.player, { weapon: st.net || "mg" });
      game.particles.sparks(r.point.x, r.point.y, r.point.z, 5);
      const glass = throughGlass(r.v, r.point), driver = glass ? hurtDriver(game, r.v, st.driver, st.stun) : "none";
      if (driver === "dead") game.callout("DRIVER DOWN", `${r.v.stats.name} is free to take`, "#7fe0a0");
      else if (driver === "hurt") game.emit({ type: "minor", text: "DRIVER HIT" });
      stats.last = { kind: "car", id: r.v.id, glass, driver };
    } else if (r.fig) {
      game.horde.kill(r.fig, game.player);
      stats.last = { kind: "figure" };
    } else if (r.prop) {
      game.world.props.kill(r.prop);
      game.combat.explode(fx.v3(r.prop.x, r.prop.y + 0.6, r.prop.z), DAMAGE.barrelRadius, DAMAGE.barrelDamage, game.player, 1.1);
      stats.last = { kind: "barrel" };
    } else {
      if (r.box && r.box.mod && game.base) game.base.hitBox(r.box, st.car, game.player, r.point);
      else if (r.box && r.box.onHit) r.box.onHit(st.car, game.player, r.point);
      game.particles.dust(r.point.x, r.point.y, r.point.z, 0, 0, 0.6);
      stats.last = { kind: "world" };
    }
  }

  const STEP = {
    bullet(s, dt) {
      s.v.y -= FOOT.gravity * dt;
      const len = s.v.length() * dt, r = cast(s, len), hit = solid(r);
      const w = walkers.ray(s.p, dir, hit ? r.t : len);
      end.copy(s.p).addScaledVector(dir, w ? w.t : hit ? r.t : len);
      fx.streak(s.p, end);
      if (w) { stats.hits++; stats.last = { kind: "walker", id: w.id, part: w.part, ...walkers.hit(w.id, w.part, w.part === "head" ? s.stats.head : s.stats.body) }; return false; }
      if (hit) { bulletHit(s.stats, r); return false; }
      s.p.copy(end);
      s.range -= len;
      return s.range > 0 && s.p.y > game.world.terrain.heightAt(s.p.x, s.p.z);
    },
    rocket(s, dt) {
      const len = s.v.length() * dt, r = cast(s, len), hit = solid(r);
      s.p.addScaledVector(dir, hit ? Math.max(0, r.t - 0.3) : len);
      s.mesh.position.copy(s.p);
      s.range -= len;
      if (Math.random() < 0.7) game.particles.smoke(s.p.x, s.p.y, s.p.z, false, 0.7);
      if (!hit && s.range > 0 && s.p.y > game.world.groundAt(s.p.x, s.p.z, s.p.y + 1) + 0.05) return true;
      boom(s.p, s.stats, "rockets");
      return false;
    },
    grenade(s, dt) {
      s.v.y -= LOB_GRAVITY * dt;
      const flat = Math.hypot(s.v.x, s.v.z);
      if (flat > 0.5 && game.world.colliders.raycast(s.p.x, s.p.y, s.p.z, s.v.x / flat, 0, s.v.z / flat, flat * dt + 0.15)) { s.v.x *= -0.4; s.v.z *= -0.4; } // off a wall
      s.p.addScaledVector(s.v, dt);
      const g = game.world.groundAt(s.p.x, s.p.z, s.p.y + 0.6) + 0.07;
      if (s.p.y < g) { s.p.y = g; s.v.y = Math.abs(s.v.y) > 1.5 ? -s.v.y * 0.35 : 0; s.v.x *= 0.6; s.v.z *= 0.6; }
      s.mesh.position.copy(s.p);
      s.mesh.rotation.x += dt * 9;
      s.fuse -= dt;
      if (s.fuse > 0) return true;
      boom(s.p, s.stats, "explosion");
      return false;
    },
    c4(s, dt) {
      s.v.y -= LOB_GRAVITY * dt;
      const len = s.v.length() * dt, r = cast(s, len + 0.1);
      const car = r.v && r.v.alive ? r.v : null;
      if (car) s.p.copy(r.point); else s.p.addScaledVector(s.v, dt);
      const g = game.world.groundAt(s.p.x, s.p.z, s.p.y + 0.6) + 0.04;
      s.mesh.position.copy(s.p);
      if (!car && !r.world && s.p.y > g) return true;
      if (!car) s.p.y = Math.max(s.p.y, g);
      // Stuck: to the car it touched (it rides along), else where it landed.
      charges.push({ p: s.p, mesh: s.mesh, stats: s.stats, car, off: car ? s.p.clone().sub(car.pos).applyQuaternion(car.quat.clone().invert()) : null });
      s.mesh = null;
      return false;
    },
  };

  const add = (kind, o, vel, st, more) => { stats.fired++; const s = { kind, p: o.clone(), v: vel, stats: st, range: st.range || 0, ...more }; if (s.mesh) s.mesh.position.copy(s.p); live.push(s); return s; };

  return {
    stats, charges,
    bullet: (o, d, st) => add("bullet", o, d.clone().multiplyScalar(st.speed), st),
    rocket(o, d, st) { const s = add("rocket", o, d.clone().multiplyScalar(st.speed), st, { mesh: fx.spawn("rocket") }); fx.face(s.mesh, d); return s; },
    // A grenade or a C4 charge thrown along d with a little lift.
    lob(kind, o, d, st) { const vel = d.clone().multiplyScalar(st.throw); vel.y += 3; return add(kind, o, vel, st, { mesh: fx.spawn(kind), fuse: st.fuse || 0 }); },
    // Blows every charge that is out. Returns how many.
    detonate() {
      const n = charges.length;
      for (const c of charges.splice(0)) { fx.remove(c.mesh); boom(c.p, c.stats, "explosion"); }
      return n;
    },
    flying: () => live.length,
    step(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        if (STEP[s.kind](s, dt)) continue;
        if (s.mesh) fx.remove(s.mesh);
        live.splice(i, 1);
      }
      for (const c of charges) {
        if (!c.car) continue;
        if (!c.car.mesh.root.parent) { c.car = null; c.p.y = game.world.groundAt(c.p.x, c.p.z, c.p.y + 0.6) + 0.04; }
        else c.p.copy(c.off).applyQuaternion(c.car.quat).add(c.car.pos);
        c.mesh.position.copy(c.p);
      }
    },
    clear() {
      for (const s of live.splice(0)) if (s.mesh) fx.remove(s.mesh);
      for (const c of charges.splice(0)) fx.remove(c.mesh);
    },
  };
}