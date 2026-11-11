// Rattler gang AI: packs patrol the main roads near town, engage the nearest hostile (you or a Drifter),
// lead their shots, flee when broken, and respawn far from you. Drifters live in drifters.js.
import * as THREE from "three";
import { AI } from "@/game/data/tuning";
import { RATTLER_PAINT } from "@/game/data/vehicles";
import { FIRST_MINUTE } from "@/game/data/places";
import { createVehicle, placeVehicle } from "@/game/vehicles/vehicle";
import { roadSpawn, clearAt, surfaceY } from "@/game/world/spawn";
import { newBrain, driveTo, nearestHostile, lineOfSight, aimAndFire, holdFire, fightPoint } from "@/game/ai/steer";
import { followRoad, turnAround } from "@/game/ai/nav";
import { setTagSub } from "@/game/vehicles/nametag";
import { needsFuel, refuelDrive } from "@/game/ai/refuel";

const NAMES = ["Gristle", "Sawtooth", "Mother Hex", "Cinder", "Bonejaw", "Lugnut", "Vulture", "Sizzle", "Crank", "Ratchet", "Scab", "Fender"];
const MAIN = ["highway", "northway", "southway"];
const g = new THREE.Vector3(), fwd = new THREE.Vector3();

export function createAI(game) {
  const R = () => Math.random();
  const packs = [];
  const town = () => game.world.town.bank;

  function makeRattler(pose, pack, kind) {
    const skillName = R() < 0.55 ? "rookie" : R() < 0.8 ? "veteran" : "ace";
    const id = kind || (R() < 0.6 ? "buggy" : "pickup");
    const v = createVehicle(game, id, { team: "rattler", paint: RATTLER_PAINT, paint2: "#b23a1f", name: NAMES[Math.floor(R() * NAMES.length)], skill: AI.skills[skillName], plate: "RTL-" + Math.floor(R() * 90 + 10) });
    v.skillName = skillName;
    placeVehicle(v, pose.x, pose.y + 1.2, pose.z, pose.heading);
    v.brain = newBrain({ mode: "patrol", pack });
    v.spreadMul = v.skill.spread / 0.03;
    game.vehicles.push(v);
    if (pack) pack.members.push(v);
    return v;
  }

  // A pack of n on a road at s metres (followers spaced behind the leader).
  function spawnPack(roadId, s, n, dir = 1) {
    const pack = { members: [], road: roadId, home: s, dir };
    packs.push(pack);
    for (let i = 0; i < n; i++) {
      const pose = roadSpawn(game.world, { road: roadId, s: s - i * 14 * dir, dir, clear: 4 }, game.vehicles);
      makeRattler(pose, pack, i === 0 ? "pickup" : null);
    }
    return pack;
  }

  // Respawn one Rattler on a main road near town, out of the player's sight, into the weakest pack.
  function spawn() {
    const p = game.player, roads = game.world.roads.roads.filter((r) => MAIN.includes(r.id));
    let pose = null;
    for (let i = 0; i < 60 && !pose; i++) {
      const rd = roads[Math.floor(R() * roads.length)], s = rd.samples[Math.floor(R() * rd.samples.length)];
      if (s.deck || s.bridge || game.inTown(s.x, s.z)) continue;
      if (p && Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < AI.minSpawnDist) continue;
      if (Math.hypot(s.x - town().x, s.z - town().z) > 520 || !clearAt(game.world, s.x, s.z, 5, game.vehicles)) continue;
      pose = { x: s.x, y: surfaceY(game.world, s.x, s.z), z: s.z, heading: Math.atan2(-s.dx, -s.dz) };
    }
    if (!pose) pose = roadSpawn(game.world, { road: "northway", s: 300, clear: 4 }, game.vehicles);
    for (const pk of packs) pk.members = pk.members.filter((m) => m.alive);
    const pack = packs.filter((pk) => pk.members.length < AI.packSize[1]).sort((a, b) => a.members.length - b.members.length)[0] || null;
    return makeRattler(pose, pack);
  }

  function populate() {
    spawnPack("highway", FIRST_MINUTE.packS, FIRST_MINUTE.packSize, 1);
    spawnPack("northway", 220, 3, 1);
    spawnPack("southway", 200, 3, 1);
    for (let i = 0; i < 2; i++) spawn();
  }

  function think(v) {
    const b = v.brain;
    b.think = (1 / AI.thinkHz) * (0.7 + v.skill.react);
    if (b.mode === "sentry") { // test gunner (hooks.sentry): parked, always on the player
      const t = game.player; b.target = t; b.dist = t.pos.distanceTo(v.pos);
      b.los = b.dist < 200 && lineOfSight(game, v, t, b.dist);
      return;
    }
    if (b.mode === "wait") {
      const t = nearestHostile(game, v, 120);
      if (!t) return;
      b.mode = "attack";
    }
    const t = nearestHostile(game, v, AI.engageRange * (0.8 + v.skill.aggression * 0.6), (x) => !game.inTown(x.pos.x, x.pos.z));
    b.target = t; b.dist = t ? t.pos.distanceTo(v.pos) : 9999;
    if (needsFuel(v) && b.dist > 60) b.mode = "refuel";
    else if (t && v.hull < v.maxHull * AI.fleeHull && b.dist < 200) b.mode = "flee";
    else if (t) b.mode = "attack";
    else b.mode = "patrol";
    b.los = b.mode === "attack" && b.dist < 200 && lineOfSight(game, v, t, b.dist);
    if (game.debug) setTagSub(v, b.mode.toUpperCase() + (t ? " · " + t.name : ""));
  }

  function patrolGoal(v, dt) {
    const b = v.brain, pk = b.pack, lead = pk && pk.members.find((m) => m.alive);
    if (lead && lead !== v) {
      fwd.set(0, 0, 1).applyQuaternion(lead.quat);
      const k = pk.members.indexOf(v);
      g.copy(lead.pos).addScaledVector(fwd, 10 * k);
      return driveTo(v, g, dt, { maxSpeed: lead.vel.length() + 6 });
    }
    if (!followRoad(game, v, b, g)) g.copy(town());
    // Stay within the patrol ring near town and never drive into the gap.
    if (Math.hypot(v.pos.x - town().x, v.pos.z - town().z) > 600 || (b.gapAhead && b.gapAhead < 60) || game.inTown(g.x, g.z)) { turnAround(b); followRoad(game, v, b, g); }
    return driveTo(v, g, dt, { maxSpeed: 22 });
  }

  function drive(v, dt) {
    const b = v.brain, t = b.target;
    if (b.mode === "sentry") { Object.assign(v.ctl, { throttle: 0, brake: 1, steer: 0, turbo: false, handbrake: true }); if (t && t.alive) aimAndFire(game, v, t, b.dist, b.los); else holdFire(v); if (!b.sentryRockets) v.ctl.rockets = false; v.ctl.harpoon = false; return; }
    if (b.mode === "wait") { Object.assign(v.ctl, { throttle: 0, brake: 1, steer: 0, turbo: false }); holdFire(v); return; }
    if (b.mode === "refuel" && refuelDrive(game, v, dt, { allowTown: false })) return;
    if (b.mode === "patrol" || !t || !t.alive) { patrolGoal(v, dt); holdFire(v, g); return; }
    if (b.mode === "flee") g.copy(v.pos).multiplyScalar(2).sub(t.pos);
    else fightPoint(v, t, b.dist, g);
    const ang = driveTo(v, g, dt);
    v.ctl.turbo = (b.mode === "flee") || (Math.abs(ang) < 0.25 && b.dist > 50 && R() < v.skill.turbo);
    if (b.mode === "attack") aimAndFire(game, v, t, b.dist, b.los); else holdFire(v, g);
  }

  return {
    spawn, spawnPack, populate, makeRattler, packs,
    update(dt) {
      for (const v of game.vehicles) {
        if (v.team !== "rattler" || !v.alive || !v.brain || v.brain.raid) continue; // raiders: base/raids.js
        v.brain.think -= dt;
        if (v.brain.think <= 0 || !v.brain.primed) { v.brain.primed = true; think(v); } // first think before the first drive
        drive(v, dt);
      }
    },
  };
}