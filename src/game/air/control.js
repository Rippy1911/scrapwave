// The flight controller: spawn / board / exit, per-step flight (after the drivers and fuel, before physics),
// crash and shoot-down handling, the camera and the HUD block. game.air is this object.
import * as THREE from "three";
import { FUEL, WORLD } from "@/game/data/tuning";
import { removeVehicle, damageVehicle } from "@/game/vehicles/vehicle";
import { stepFlight } from "@/game/air/flight";
import { createFlightKeys } from "@/game/air/keys";
import { createAirCam } from "@/game/air/camera";
import { createAirFx } from "@/game/air/fx";
import { board, unboard } from "@/game/air/board";
import { mapAirAllowed, mapAirPose, clampAir } from "@/game/maps/airPose";
import { clearSight } from "@/game/air/sight";
import { isAdmin } from "@/game/air/admin";
import { airSave } from "@/game/air/tiers";
import { launchCheck, heliHull, serviceStep } from "@/game/air/economy";
import { trackProgress } from "@/game/air/progress";
import { writeSave } from "@/game/core/save";

const prev = new THREE.Vector3(), dir = new THREE.Vector3(), push = new THREE.Vector3();

export function createAirSystem(game) {
  const keys = createFlightKeys(), cam = createAirCam(game);
  const ctl = { fwd: 0, right: 0, turn: 0, up: false, down: false, limp: false };
  let craft = null, car = null, fx = null, hold = null;
  trackProgress(game);

  const say = (text) => game.emit({ type: "minor", text });
  const keepHp = () => {
    if (!craft || craft.air !== "heli" || craft.adminSpawn) return;
    const a = airSave(game.save);
    a.hp = craft.alive ? Math.round(craft.hull) : 0;
    a.fuel = craft.alive ? craft.fuel : null;
    if (!game.noSave) writeSave(game.save);
  };

  function spawn(kind, o = {}) {
    if (kind !== "heli" && kind !== "jet") return { ok: false, msg: "Unknown aircraft" };
    const admin = isAdmin();
    if (kind === "jet" && !admin) return { ok: false, msg: "Admin only" };
    if ((game.arena.active && !mapAirAllowed(game)) || (game.demo.running && !game.demo.allowAir) || game.replay.active || game.buildView.active) return { ok: false, msg: "Not here" };
    if (!game.player || !game.player.alive) return { ok: false, msg: "Wrecked" };
    if (craft) exit(true);
    const a = airSave(game.save);
    const free = admin && o.admin !== false && (kind === "jet" || !a.owned || o.tier !== undefined);
    let msg = "";
    if (kind === "heli" && !free) {
      const chk = launchCheck(game.save);
      if (!chk.ok) return chk;
      msg = chk.msg;
    }
    const tiers = kind === "heli" ? (o.tier !== undefined && admin ? Object.fromEntries(Object.keys(a.tiers).map((k) => [k, o.tier])) : a.tiers) : {};
    const h = kind === "heli" && !free ? heliHull(game.save) : null;
    car = game.player;
    craft = board(game, kind, { pose: mapAirPose(game, kind), tiers, paint: kind === "heli" ? game.save.garage.paint : undefined, hp: h ? h.hp : null, fuel: kind === "heli" && !free ? a.fuel : null });
    craft.adminSpawn = free;
    fx = createAirFx(game, craft);
    keys.attach(); cam.reset();
    game.callout(craft.stats.name.toUpperCase(), kind === "heli" ? "Space climb · Shift descend · X get out" : "Space boost · S to lift off · X get out", "#f2c230");
    if (msg) say(msg);
    return { ok: true, msg, id: craft.id };
  }

  function exit(force = false) {
    if (!craft) return false;
    const s = craft.flight;
    if (!force && craft.alive && !(s.grounded || s.alt < 2.5) ) { say("LAND TO GET OUT"); return false; }
    if (!force && craft.alive && s.speed > 8) { say("SLOW DOWN TO GET OUT"); return false; }
    if (!craft.alive) { // shot down: only a forced exit, as a respawn (the parked car is lost with it)
      if (!force) return false;
      game.respawnPlayer();
      lost();
      return true;
    }
    keepHp();
    keys.detach(); fx.dispose();
    unboard(game, craft, car);
    craft = null; car = null; fx = null;
    return true;
  }

  // The aircraft left the world without exit() (respawn, teleport, a new cycle): forget it and the parked car.
  function lost() {
    keepHp();
    keys.detach(); fx.dispose(); craft.body.remove();
    if (car && car !== game.player) removeVehicle(game, car);
    craft = null; car = null; fx = null;
  }

  function hurt(dmg, at) { if (dmg > 0) damageVehicle(game, craft, dmg, at.clone(), null, { blunt: true }); }

  function step(dt) {
    if (!craft) return;
    if (game.player !== craft || !game.vehicles.includes(craft)) { lost(); return; }
    const v = craft, s = v.flight;
    const blocked = game.uiOpen || game.introT > 0 || !v.alive;
    if (blocked) Object.assign(ctl, { fwd: 0, right: 0, turn: 0, up: false, down: false });
    else if (hold && hold.t > 0) { hold.t -= dt; Object.assign(ctl, hold.ctl); } else keys.read(game.input.a, ctl);
    ctl.limp = !!v.limp;
    if (!blocked && keys.exit()) exit(false);
    if (!craft) return;
    // Knocks from explosions and harpoons land in v.vel; feed them into the flight state.
    push.subVectors(v.vel, s.vel);
    if (v.alive && push.lengthSq() > 0.01) s.vel.addScaledVector(push.clampLength(0, 14), v.air === "heli" ? 1 : 0.3);
    if (!v.alive && !s.dead) { s.dead = true; s.grounded = s.alt < 1; fx.wreckLook(); keepHp(); }
    prev.copy(s.pos);
    const gy = game.world.groundAt(s.pos.x, s.pos.z, s.pos.y + 1);
    stepFlight(s, ctl, dt, gy);
    // Walls and buildings: stop short and take a knock.
    const dist = prev.distanceTo(s.pos);
    if (dist > 1e-3) {
      dir.subVectors(s.pos, prev).divideScalar(dist);
      const h = game.world.colliders.raycast(prev.x, prev.y, prev.z, dir.x, dir.y, dir.z, dist + 1.2);
      if (h && h.t < dist + 1.2) {
        s.pos.copy(prev).addScaledVector(dir, Math.max(0, h.t - 1.4));
        hurt(s.speed * (v.air === "jet" ? 3 : 1.2), s.pos);
        s.vel.multiplyScalar(-0.25); s.speed *= 0.3;
      }
    }
    const big = game.big && game.big.active ? game.big.bounds : null; // the Ashmark has its own edge
    if (big) { s.pos.x = Math.max(big.x0, Math.min(big.x1, s.pos.x)); s.pos.z = Math.max(big.z0, Math.min(big.z1, s.pos.z)); }
    else clampAir(game, s.pos, WORLD.bound - 10);
    if (s.touchdown === 99) { game.combat.explode(s.pos.clone(), 7, 70, v.lastHitBy, 1.4, v); game.shake(s.pos, 1.2); }
    else if (s.touchdown > (v.air === "jet" ? 9 : 7)) hurt((s.touchdown - (v.air === "jet" ? 9 : 7)) * 14, s.pos);
    v.pos.copy(s.pos); v.quat.copy(s.quat); v.vel.copy(s.vel); v.angVel.set(0, 0, 0);
    v.grounded = s.grounded; v.contacts = 0; v.airTime = 0;
    v.ctl.throttle = ctl.up ? 1 : s.grounded ? 0.15 : 0.55;
    // Fuel: the helicopter drinks more than any car; refuels only when landed at an outpost or a base.
    if (v.alive && v.air === "heli" && (!game.ruleSys || game.ruleSys.fuelOn())) {
      const rate = s.grounded && !ctl.up ? 0.1 : ctl.up || s.speed > 30 ? v.airStats.burnFast : v.airStats.burn;
      v.fuel = Math.max(0, v.fuel - FUEL.burn * rate * dt);
    }
    if (v.lockTarget && !clearSight(game, v, v.lockTarget)) v.lockTarget = null;
    v.body.move(v.pos, v.quat);
    serviceStep(game, v, dt);
  }

  function hud() {
    if (!craft) return null;
    const v = craft, s = v.flight;
    return {
      kind: v.air, name: v.stats.name, alt: Math.round(s.alt), speed: Math.round(s.speed * 3.6), hp: Math.round(v.hull), maxHp: Math.round(v.maxHull),
      fuel: v.fuelMax ? v.fuel / v.fuelMax : 1, grounded: s.grounded, servicing: v.servicing || null, ceiling: s.stats.ceiling,
      limp: !!v.limp, tier: v.airStats.look, alive: v.alive,
    };
  }

  function state() {
    if (!craft) return null;
    const v = craft, s = v.flight, r = (x) => +x.toFixed(2);
    return { kind: v.air, id: v.id, pos: { x: r(s.pos.x), y: r(s.pos.y), z: r(s.pos.z) }, speedKmh: Math.round(s.speed * 3.6), altitude: r(s.alt), hp: Math.round(v.hull), maxHp: Math.round(v.maxHull), alive: v.alive, grounded: s.grounded, fuel: Math.round(v.fuel), yaw: r(s.yaw), pitch: r(s.pitch), roll: r(s.roll), tiers: v.airStats.look };
  }

  return {
    active: () => !!craft, craft: () => craft, spawn, exit, step, hud, state,
    frame(dt) { if (craft && fx) fx.frame(dt, ctl); },
    camera(dt, time) { return craft ? cam.update(craft, dt, time) : false; },
    // Test hook: hold these controls for t seconds instead of the keys.
    hold(c = {}, t = 2) { hold = { ctl: { fwd: 0, right: 0, turn: 0, up: false, down: false, ...c }, t }; return true; },
    moveTo(x, z, y) { if (!craft) return false; const s = craft.flight, gy = game.world.groundAt(x, z, 999); s.pos.set(x, y ?? gy + 60, z); s.grounded = false; craft.prevPos.copy(s.pos); return true; },
    dispose() { keys.detach(); },
  };
}