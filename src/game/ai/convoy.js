// Cisterner water convoy (host): two armoured tankers and two escort pickups leave the Well-town every
// 5 minutes along the rail road over the rail bridge to the dam. They fight back and slow when attacked;
// each tanker drops 400 to 700 scrap and a part.
import * as THREE from "three";
import { AI } from "@/game/data/tuning";
import { net } from "@/game/net/net";
import { createVehicle, placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";
import { createNameTag } from "@/game/vehicles/nametag";
import { newBrain, driveTo, aimAndFire, holdFire, lineOfSight } from "@/game/ai/steer";

const EVERY = 300, ORDER = ["pickup", "tanker", "tanker", "pickup"], PAINT = "#5f7f86";
const g = new THREE.Vector3();

export function createConvoy(game) {
  let path = null, timer = 40, arrivedAt = -99, wave = 0;
  const route = () => {
    if (path) return path;
    const rail = game.world.roads.roads.find((r) => r.id === "rail");
    path = rail.samples.filter((_, i) => i % 4 === 0).map((s) => new THREE.Vector3(s.x, 0, s.z));
    return path;
  };
  const members = () => game.vehicles.filter((v) => v.team === "cisterner" && v.alive);
  const nearestIdx = (v) => { const P = route(); let b = 0, bd = Infinity; for (let i = 0; i < P.length; i++) { const d = (P[i].x - v.pos.x) ** 2 + (P[i].z - v.pos.z) ** 2; if (d < bd) { bd = d; b = i; } } return b; };

  // Tank body and armour on a tanker (also used for the host's AI seen on other browsers).
  game.decorateCisterner = (v) => {
    if (v.chassisId !== "tanker" || v.mesh.cistern) return;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 4.2, 14), game.M.corrugated);
    tank.rotation.x = Math.PI / 2; tank.position.set(0, 2.1, 1.1); tank.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.25, 14), game.M.hazard);
    band.rotation.x = Math.PI / 2; band.position.set(0, 2.1, 1.1);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 4.4), game.M.dark); plate.position.set(0, 1.05, 1.1);
    v.mesh.root.add(tank, band, plate);
    v.mesh.cistern = true;
  };

  function spawn() {
    const P = route();
    wave++;
    ORDER.forEach((chassis, k) => {
      const i = Math.max(0, 6 - k * 3), a = P[i], b = P[i + 1];
      const y = game.world.groundAt(a.x, a.z, 999);
      const v = createVehicle(game, chassis, { team: "cisterner", name: chassis === "tanker" ? `Cistern ${k}` : "Cistern Escort", paint: PAINT, paint2: "#d9d2c0", skill: AI.skills.veteran, hull: chassis === "tanker" ? 900 : undefined, plate: "CW-" + (wave * 10 + k) });
      placeVehicle(v, a.x, y + 1.4, a.z, Math.atan2(-(b.x - a.x), -(b.z - a.z)));
      v.brain = newBrain({ mode: "convoy" });
      v.cv = { i: i + 1, k };
      v.spreadMul = 1;
      game.decorateCisterner(v);
      createNameTag(game, v, v.name, "#9cc8ff", true, chassis === "tanker" ? "WATER" : "ESCORT");
      game.vehicles.push(v);
    });
    game.emit({ type: "radio", from: "Cistern Mother Ilse", text: "Convoy's leaving the Well-town for the dam. Anyone touches my water, they answer to the escorts." });
    game.audio.radio();
  }

  function drive(v, dt) {
    const P = route();
    if (!v.cv) v.cv = { i: nearestIdx(v) + 1, k: 0 };
    let wp = P[Math.min(v.cv.i, P.length - 1)];
    if (Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z) < 9 && v.cv.i < P.length - 1) { v.cv.i++; wp = P[v.cv.i]; }
    if (v.cv.i >= P.length - 1 && Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z) < 12) return "arrived";
    // Keep the column together: wait for the car behind, don't ram the one ahead.
    const all = members();
    const ahead = all.filter((o) => o !== v && o.cv && o.cv.i >= v.cv.i).sort((a, b) => a.pos.distanceTo(v.pos) - b.pos.distanceTo(v.pos))[0];
    const behind = all.some((o) => o !== v && o.cv && o.cv.i < v.cv.i - 3);
    const attacked = all.some((o) => game.time - o.lastCombat < 6);
    let max = attacked ? 9 : 15;
    if (ahead && ahead.pos.distanceTo(v.pos) < 13) max = Math.min(max, ahead.vel.length() * 0.8);
    if (behind) max = Math.min(max, 6);
    g.set(wp.x, v.pos.y, wp.z);
    driveTo(v, g, dt, { maxSpeed: max, noHandbrake: true });
    // Fight back at whoever hit the convoy.
    const foe = all.map((o) => o.lastHitBy).find((a) => a && a.alive && a.team !== "cisterner" && game.time - (a.lastCombat || -99) < 8);
    const d = foe ? foe.pos.distanceTo(v.pos) : 999;
    if (foe && d < 140) aimAndFire(game, v, foe, d, lineOfSight(game, v, foe, d));
    else holdFire(v, g);
    return null;
  }

  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => {
    onWreck(v, attacker);
    if (v.team !== "cisterner" || v.chassisId !== "tanker") return;
    if (attacker === game.player) { game.save.stats.tankers = (game.save.stats.tankers || 0) + 1; game.session.tankers++; game.session.moments.push({ score: 60, text: "Cracked open a water tanker" }); }
    if (v.remote || !net.isHost()) return;
    const total = 400 + Math.random() * 300;
    for (let i = 0; i < 3; i++) game.base.spawnCrate(v.pos.x + (Math.random() - 0.5) * 5, v.pos.y + 1, v.pos.z + (Math.random() - 0.5) * 5, total / 3);
    game.base.spawnCrate(v.pos.x, v.pos.y + 1.5, v.pos.z, 25, true);
  };

  return {
    update(dt) {
      if (!net.isHost()) return;
      const list = members();
      if (!list.length && game.cycleSys.phase() === "run") { timer -= dt; if (timer <= 0) { timer = EVERY; spawn(); } }
      let arrived = false;
      for (const v of list) if (!v.remote && drive(v, dt) === "arrived") arrived = true;
      if (arrived) {
        arrivedAt = game.time;
        for (const v of members()) { const i = game.vehicles.indexOf(v); if (i >= 0 && !v.remote) { game.vehicles.splice(i, 1); removeVehicle(game, v); } }
        game.emit({ type: "radio", from: "Cistern Mother Ilse", text: "Water's at the dam. Good driving out there." });
      }
    },
    active: () => members().some((v) => v.chassisId === "tanker"),
    arrived: () => game.time - arrivedAt < 10,
    lead: () => { const t = members().find((v) => v.chassisId === "tanker"); return t ? t.pos : null; },
    progress: () => { const t = members().find((v) => v.chassisId === "tanker"); return t ? nearestIdx(t) / (route().length - 1) : 0; },
    spawnNow() { if (!members().length) spawn(); return members().length; },
    reset() { timer = 40; },
  };
}