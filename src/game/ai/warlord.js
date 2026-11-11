// The Rattler Warlord (host): after minute 15 of a cycle, once, a huge armoured tractor-trailer with three
// trailer turrets and 4,000 HP drives a loop through the north basin and drops a big haul when wrecked.
import * as THREE from "three";
import { AI } from "@/game/data/tuning";
import { net } from "@/game/net/net";
import { createVehicle, placeVehicle } from "@/game/vehicles/vehicle";
import { createNameTag } from "@/game/vehicles/nametag";
import { applyDamage } from "@/game/net/damage";
import { newBrain, driveTo, nearestHostile, aimAndFire, holdFire, lineOfSight } from "@/game/ai/steer";
import { newAim, aimStep, skillQ } from "@/game/ai/aim";

const LOOP = [[345, -170], [300, -330], [170, -420], [80, -430], [60, -330], [140, -200], [200, -110]];
const g = new THREE.Vector3(), mz = new THREE.Vector3(), d = new THREE.Vector3(), aimL = new THREE.Vector3();

export function createWarlord(game) {
  let spawned = false, v = null, warned = false;
  const pts = [];
  for (let i = 0; i < LOOP.length; i++) {
    const [ax, az] = LOOP[i], [bx, bz] = LOOP[(i + 1) % LOOP.length], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 12);
    for (let k = 0; k < n; k++) pts.push(new THREE.Vector3(ax + ((bx - ax) * k) / n, 0, az + ((bz - az) * k) / n));
  }

  // Trailer with three turret heads behind the tractor (visual; also used on other browsers).
  game.decorateWarlord = (w) => {
    if (w.mesh.trailer) return;
    const M = game.M, t = new THREE.Group(); t.position.set(0, 0.2, 7.2);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; t.add(m); return m; };
    add(new THREE.BoxGeometry(2.8, 0.5, 9.5), M.dark, 0, 0.9, 0);
    add(new THREE.BoxGeometry(2.9, 1.6, 8.6), M.rust, 0, 2, 0.2);
    add(new THREE.BoxGeometry(3, 0.2, 8.8), M.hazard, 0, 2.85, 0.2);
    for (const z of [-2.6, 2.6, 3.8]) for (const x of [-1.25, 1.25]) { const wh = add(new THREE.CylinderGeometry(0.62, 0.62, 0.5, 14), M.rubber, x, 0.62, z); wh.rotation.z = Math.PI / 2; }
    for (let i = 0; i < 6; i++) { const s = add(new THREE.ConeGeometry(0.12, 0.8, 6), M.chrome, (i % 2 ? 1.5 : -1.5), 2, -3 + i * 1.2); s.rotation.z = (i % 2 ? -1 : 1) * Math.PI / 2; }
    w.mesh.turrets = [-3, 0.4, 3.6].map((z) => {
      const head = new THREE.Group(); head.position.set(0, 3.1, z); t.add(head);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1.1), M.dark); head.add(b);
      for (const x of [-0.18, 0.18]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), M.dark); br.rotation.x = Math.PI / 2; br.position.set(x, 0.05, -1.1); head.add(br); }
      return { head, cd: Math.random() };
    });
    w.mesh.root.add(t);
    w.mesh.trailer = t;
  };

  function spawn() {
    spawned = true;
    const [x, z] = LOOP[0], y = game.world.groundAt(x, z, 999);
    v = createVehicle(game, "mammoth", { team: "warlord", name: "The Warlord", paint: "#3b302a", paint2: "#e6dfcc", hull: 4000, skill: AI.skills.ace, plate: "WAR-01" });
    placeVehicle(v, x, y + 1.6, z, Math.PI);
    v.brain = newBrain({ mode: "warlord" });
    v.wl = { i: 1 };
    v.spreadMul = 1.2;
    game.decorateWarlord(v);
    createNameTag(game, v, "THE WARLORD", "#ff4a2a", true, "4000 HP");
    game.vehicles.push(v);
    game.callout("THE WARLORD RIDES", "huge rig · three turrets · big haul", "#ff4a2a");
    game.emit({ type: "radio", from: "Well-town radio", text: "The Rattler Warlord is out on the north loop. Three guns on that trailer. Bring friends." });
    game.audio.radio(); game.audio.siren?.();
  }

  // Trailer turrets: hitscan bursts through the shared AI aim (line of sight, reaction, error); the host deals the damage.
  function turrets(w, dt, target, real) {
    if (!w.mesh.turrets) return;
    w.mesh.root.updateMatrixWorld();
    for (const t of w.mesh.turrets) {
      t.head.localToWorld(mz.set(0, 0.05, -1.9));
      const dist = target ? target.pos.distanceTo(w.pos) : 999;
      const a = real && target ? aimStep(game, t.aimSt || (t.aimSt = newAim()), w, target, dist, skillQ(w.skill), mz, g, 0) : null;
      const at = a ? g : w.aimPoint;
      aimL.copy(at); t.head.parent.worldToLocal(aimL);
      t.head.rotation.y += (Math.atan2(-(aimL.x - t.head.position.x), -(aimL.z - t.head.position.z)) - t.head.rotation.y) * Math.min(1, dt * 5);
      t.cd -= dt;
      const firing = real ? !!a && a.ready && a.burst && dist < 110 : w.ctl.fire;
      if (!firing || t.cd > 0) continue;
      t.cd = 0.14;
      d.subVectors(at, mz).normalize();
      d.x += (Math.random() - 0.5) * 0.012; d.y += (Math.random() - 0.5) * 0.008; d.z += (Math.random() - 0.5) * 0.012; d.normalize();
      const r = game.combat.ray(mz, d, 120, w);
      if (real && r.v && r.v.team !== "warlord") applyDamage(game, r.v, 7, r.point, w, { weapon: "turretMg" });
      if (real && r.box && r.box.mod) game.base.damage(r.box.mod, 7, w, r.point);
      game.fx.tracer(mz, r.point);
      game.particles.muzzle(mz.x, mz.y, mz.z, 0.9);
      if (Math.random() < 0.5) game.audio.shot("mg", mz, false);
    }
  }

  function drive(w, dt) {
    if (!w.wl) { let b = 0, bd = Infinity; pts.forEach((p, i) => { const dd = p.distanceToSquared(w.pos); if (dd < bd) { bd = dd; b = i; } }); w.wl = { i: b }; }
    let wp = pts[w.wl.i];
    if (Math.hypot(wp.x - w.pos.x, wp.z - w.pos.z) < 10) { w.wl.i = (w.wl.i + 1) % pts.length; wp = pts[w.wl.i]; }
    g.set(wp.x, w.pos.y, wp.z);
    driveTo(w, g, dt, { maxSpeed: 13, noHandbrake: true, stillMax: 5 });
    const t = nearestHostile(game, w, 150);
    if (t) { const dist = t.pos.distanceTo(w.pos); aimAndFire(game, w, t, dist, lineOfSight(game, w, t, dist)); w.ctl.harpoon = false; } else holdFire(w, g);
    turrets(w, dt, t, true);
  }

  const onWreck = game.onWreck;
  game.onWreck = (x, attacker) => {
    onWreck(x, attacker);
    if (x.team !== "warlord") return;
    // The rig goes up big: cab fireball plus the trailer behind it (cosmetic on top of the normal wreck blast).
    const tail = new THREE.Vector3(0, 1.2, 9).applyQuaternion(x.quat).add(x.pos);
    game.particles.explosion(x.pos.x, x.pos.y + 1.5, x.pos.z, 2.8);
    game.particles.explosion(tail.x, tail.y, tail.z, 2.2);
    game.fx.flash(x.pos.x, x.pos.y + 3, x.pos.z, 2200, 0.6);
    game.shake(x.pos, 2.5);
    game.callout("WARLORD DOWN", attacker === game.player ? "the haul is yours" : "the haul is on the sand", "#f2c230");
    if (attacker === game.player) game.session.moments.push({ score: 200, text: "Wrecked the Rattler Warlord" });
    if (x.remote || !net.isHost()) return;
    for (let i = 0; i < 6; i++) game.base.spawnCrate(x.pos.x + (Math.random() - 0.5) * 10, x.pos.y + 1, x.pos.z + (Math.random() - 0.5) * 10, 420);
    game.base.spawnCrate(x.pos.x, x.pos.y + 1.5, x.pos.z, 60, true);
  };

  return {
    update(dt) {
      const c = game.cycle;
      if (net.isHost() && !spawned && c.t >= c.length / 2 && game.cycleSys.phase() === "run") spawn();
      if (!warned && c.t >= c.length / 2 - 60 && c.t < c.length / 2) { warned = true; game.emit({ type: "radio", from: "Well-town radio", text: "Scouts see dust on the north loop. The Warlord's rolling out in a minute." }); }
      for (const w of game.vehicles) {
        if (w.team !== "warlord" || !w.alive) continue;
        if (!w.remote && net.isHost()) drive(w, dt);
        else turrets(w, dt, null, false);
      }
    },
    vehicle: () => game.vehicles.find((x) => x.team === "warlord" && x.alive) || null,
    spawnNow() { if (!game.vehicles.some((x) => x.team === "warlord" && x.alive)) spawn(); return true; },
    reset() { spawned = false; warned = false; v = null; },
  };
}