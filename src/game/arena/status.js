// Power-up effects on cars (arena): armour boost (half damage), mega-ram (double ram damage), tyre spikes
// (shred cars you touch), freeze (a frozen car stalls for 3 s), freeze shot charges (your next hit freezes),
// triple rockets (charges: the rocket key fires three homing rockets from the roof), jump boost and repair.
// Timers tick in the controller layer: after the drivers set ctl, before physics.
import * as THREE from "three";
import { WEAPONS } from "@/game/data/tuning";
import { applyImpulse } from "@/game/vehicles/physics";
import { applyDamage } from "@/game/net/damage";
import { setTagSub } from "@/game/vehicles/nametag";

const rocketGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.95, 8).rotateX(Math.PI / 2);
const t1 = new THREE.Vector3(), fwd = new THREE.Vector3();

export const EFFECTS = {
  armour: { text: "ARMOUR BOOST", sub: "half damage · 15 s", color: "#9cc8ff", ai: true },
  triple: { text: "TRIPLE ROCKETS", sub: "rocket key · 3 salvos", color: "#ff8a3a" },
  freeze: { text: "FREEZE SHOT", sub: "your next hit stalls them 3 s", color: "#7fe0ff" },
  megaram: { text: "MEGA-RAM", sub: "double ram damage · 10 s", color: "#f2c230", ai: true },
  spikes: { text: "TYRE SPIKES", sub: "shred what you touch · 15 s", color: "#ff5a3a", ai: true },
  jump: { text: "JUMP BOOST", sub: "up you go", color: "#7fe0a0", ai: true },
  repair: { text: "REPAIR", sub: "hull, tyres and traps restored", color: "#7fe0a0", ai: true },
};

export function createStatus(game) {
  let prevRockets = false;

  function give(v, id) {
    if (id === "armour") v.armourT = 15;
    else if (id === "megaram") v.megaRamT = 10;
    else if (id === "spikes") v.spikesT = 15;
    else if (id === "triple") v.tripleShots = (v.tripleShots || 0) + 3;
    else if (id === "freeze") v.freezeShots = (v.freezeShots || 0) + 1;
    else if (id === "repair") { v.hull = v.maxHull; v.flat = null; if (game.traps) game.traps.refill(v); } // tyres and traps too
    else if (id === "jump") {
      fwd.set(0, 0, -1).applyQuaternion(v.quat).setY(0).normalize();
      applyImpulse(v, v.pos, t1.set(fwd.x * 4, 11, fwd.z * 4).multiplyScalar(v.mass));
    }
    if (v === game.player) { const e = EFFECTS[id]; game.callout(e.text, e.sub, e.color); game.audio.pickup(); }
  }

  function freeze(v) {
    v.frozenT = 3;
    if (v.tag) setTagSub(v, "FROZEN");
    game.callout("FROZEN", v.name, "#7fe0ff");
  }

  // Your hit marker fires on every hit you land: spend a freeze charge on the first one.
  const onHitMarker = game.onHitMarker;
  game.onHitMarker = (v, amount) => {
    onHitMarker(v, amount);
    const p = game.player;
    if (p.freezeShots > 0 && v !== p && v.alive && !(v.frozenT > 0)) { p.freezeShots--; freeze(v); }
  };

  function tripleSalvo(v) {
    v.tripleShots--;
    fwd.set(0, 0, -1).applyQuaternion(v.quat);
    for (let i = -1; i <= 1; i++) {
      const pos = v.pos.clone().add(t1.set(i * 0.6, 1.6, 0).applyQuaternion(v.quat));
      const dir = new THREE.Vector3().subVectors(v.aimPoint, pos).normalize();
      dir.x += i * 0.04;
      const mesh = new THREE.Mesh(rocketGeo, game.M.dark);
      mesh.position.copy(pos); mesh.lookAt(pos.clone().add(dir)); mesh.rotateY(Math.PI);
      game.scene.add(mesh);
      const w = { def: WEAPONS.rockets, id: "rockets" };
      game.combat.projectiles.push({ kind: "rocket", pos, vel: dir.multiplyScalar(WEAPONS.rockets.speed).add(v.vel), shooter: v, w, life: 3, mesh, target: v.lockTarget || null });
    }
    game.audio.shot("rockets", v.pos, true);
  }

  function step(dt) {
    const p = game.player;
    if (p.alive && p.tripleShots > 0 && p.ctl.rockets && !prevRockets) tripleSalvo(p);
    prevRockets = p.ctl.rockets;
    for (const v of game.vehicles) {
      if (!v.alive || v.remote) continue;
      for (const k of ["armourT", "megaRamT", "spikesT"]) if (v[k] > 0) v[k] -= dt;
      if (v.frozenT > 0) {
        v.frozenT -= dt;
        Object.assign(v.ctl, { throttle: 0, brake: 1, steer: 0, turbo: false, fire: false, rockets: false, harpoon: false });
        if (Math.random() < 0.3) game.particles.sparks(v.pos.x, v.pos.y + 1, v.pos.z, 2);
        if (v.frozenT <= 0 && v.tag) setTagSub(v, "ARENA");
      }
      if (v.spikesT > 0 && v.vel.length() > 2) for (const o of game.vehicles) {
        if (o === v || !o.alive || o.pos.distanceToSquared(v.pos) > (v.chassis.hit.half[2] + o.chassis.hit.half[0] + 0.6) ** 2) continue;
        applyDamage(game, o, 35 * dt, o.pos, v, { weapon: "spikes" });
        if (Math.random() < 0.4) game.particles.sparks(o.pos.x, o.pos.y + 0.3, o.pos.z, 3);
      }
    }
  }

  function clear(v) { for (const k of ["armourT", "megaRamT", "spikesT", "frozenT", "tripleShots", "freezeShots"]) v[k] = 0; }
  return { give, step, clear };
}