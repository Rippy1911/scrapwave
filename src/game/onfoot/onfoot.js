// Round 9 on-foot layer: game.onfoot. Safe zones (rings + weapons gate), the scavenger (walk, run, jump, third-person
// camera), E to get out (anywhere in free roam when slow and on the ground, exitRules.js; health, weapons and death
// on foot are footCombat.js) and back in (your car, a summoned one, a FREE or unlocked car), E at the
// trader / garage / job board, Z to summon a garage car, free cars, spawn points and the "Choose your ride" screen.
// game.js calls control(dt) before the player's driving, step(dt) after every controller, view() for the camera
// while on foot, and frame() every render frame. Arenas, the demo and the autopilot always drive.
import * as THREE from "three";
import { createZoneSet } from "@/game/onfoot/zoneSources";
import { createZoneRings } from "@/game/onfoot/zoneRings";
import { createWeaponsGate } from "@/game/onfoot/weaponsGate";
import { buildScavenger } from "@/game/onfoot/scavengerMesh";
import { newAnimState, animateScavenger } from "@/game/onfoot/scavengerAnim";
import { createFootCam } from "@/game/onfoot/footCam";
import { createFootKeys } from "@/game/onfoot/keys";
import { createWalker } from "@/game/onfoot/walker";
import { buildLandmarks } from "@/game/onfoot/landmarks";
import { nearestUse } from "@/game/onfoot/interact";
import { createFreeVehicles } from "@/game/onfoot/freeVehicles";
import { createRides } from "@/game/onfoot/rides";
import { createSpawnPoints } from "@/game/onfoot/spawnPoints";
import { createSpawnFlow } from "@/game/onfoot/spawnFlow";
import { createRemoteWalkers } from "@/game/onfoot/remoteWalkers";
import { markWrecked } from "@/game/onfoot/ownedRoster";
import { operateLandmark } from "@/game/onfoot/landmarkUse";
import { exitCheck } from "@/game/onfoot/exitRules";
import { createFootCombat } from "@/game/onfoot/footCombat";
import { clearAt } from "@/game/world/spawn";

const fwd = new THREE.Vector3(), side = new THREE.Vector3(), camF = new THREE.Vector3();

export function createOnFoot(game) {
  const zones = createZoneSet(game);
  const rings = createZoneRings(game, zones);
  const gate = createWeaponsGate(game, zones);
  const landmarks = buildLandmarks(game, zones);
  const free = createFreeVehicles(game, zones);
  const rides = createRides(game, free);
  const points = createSpawnPoints(game, zones);
  const remote = createRemoteWalkers(game);
  const keys = createFootKeys(game.input);
  const walker = createWalker(game);
  const cam = createFootCam(game.camera, game.world);
  const mesh = buildScavenger();
  const anim = newAnimState();
  const st = { mode: "drive", zone: null, use: null, blockedAt: -99, hintAt: -99, refuseAt: -99, visitT: 0 };
  mesh.root.visible = false;
  game.scene.add(mesh.root);

  // On-foot combat: health, the loadout, shots, loot and death (footCombat.js). A dead walker asks for the same
  // respawn a wreck asks for: Choose your ride at a garage, or straight back on the road where that screen is off.
  const combat = createFootCombat(game, { walker, cam, keys, mesh, remote, rides, onDead: () => game.requestRespawn() });
  const foot = { toDriving() { st.mode = "drive"; st.use = null; mesh.root.visible = false; combat.rest(); } };
  const spawn = createSpawnFlow(game, { points, free, rides, foot });

  // Empty cars are never targets; free cars can't be modified; a wrecked garage car goes on repair/cooldown.
  const safe = game.inSafeZone, garage = game.inGarage, onWreck = game.onWreck, respawn = game.respawnPlayer;
  game.inSafeZone = (v) => !!v.empty || safe(v);
  game.inGarage = (v) => !v.free && garage(v);
  game.onWreck = (v, a) => { if (v.owned && !game.noSave) markWrecked(game, v.chassisId); return onWreck(v, a); };
  game.respawnPlayer = (pose) => { foot.toDriving(); rides.reset(); return respawn(pose); };
  const rebuild = game.rebuildPlayer; // garage changes / town repairs while you are out of the car keep it parked
  game.rebuildPlayer = () => { rebuild(); if (st.mode === "foot") rides.park(game.player); };

  const prey = { foot: true, alive: true, pos: walker.pos, vel: walker.vel }; // what a crowd chases (target())
  // Aircraft: E is yaw in flight and X gets out, so on-foot never takes over a flying player.
  const driveOnly = () => game.arena.active || game.demo.running || game.autopilot || !!game.player.air;

  function exit() {
    const p = game.player, zone = zones.at(p.pos.x, p.pos.z), can = exitCheck(game, zone);
    st.refused = can.ok ? null : can.why;
    if (!can.ok) {
      if (can.why && game.time - st.refuseAt > 1.5) { st.refuseAt = game.time; game.emit({ type: "minor", text: can.why }); }
      return false;
    }
    rides.park(p);
    fwd.set(0, 0, -1).applyQuaternion(p.quat).setY(0).normalize();
    side.set(-fwd.z, 0, fwd.x);
    const [hx, , hz] = p.chassis.hit.half;
    const spots = [side.clone().multiplyScalar(-(hx + 0.8)), side.clone().multiplyScalar(hx + 0.8), fwd.clone().multiplyScalar(-(hz + 0.9))];
    const off = spots.find((o) => clearAt(game.world, p.pos.x + o.x, p.pos.z + o.z, 0.5)) || spots[0];
    const x = p.pos.x + off.x, z = p.pos.z + off.z, heading = Math.atan2(-fwd.x, -fwd.z);
    walker.place(x, game.world.groundAt(x, z, p.pos.y + 1), z, heading);
    cam.snapBehind(heading);
    cam.update(walker.pos, 0, true);
    Object.assign(st, { mode: "foot", zone });
    mesh.root.visible = true;
    combat.out(p, zone);
    game.emit({ type: "minor", text: "ON FOOT · E TO GET BACK IN" });
    game.audio.sample("engine_stop", p.pos, 0.5); game.audio.sample("door_open", p.pos, 0.7);
    return true;
  }

  function enter(v) {
    game.audio.sample("door_close", v.pos, 0.7); game.audio.sample("engine_start", v.pos, 0.5);
    if (v === game.player) { v.empty = false; v.summoned = false; v.ctl.handbrake = false; }
    else rides.drive(v);
    foot.toDriving();
    game.cam.snap(game.player);
    return game.player;
  }

  function activate(u) {
    if (u.kind === "vehicle") return enter(u.v);
    return operateLandmark(game, u.m);
  }

  function summon() {
    const zone = zones.at(walker.pos.x, walker.pos.z);
    if (!zone) return false;
    points.visit(walker.pos.x, walker.pos.z);
    return spawn.open("summon", zone.id);
  }

  function control(dt) {
    keys.tick();
    if (st.mode === "foot" && driveOnly()) { game.player.empty = false; foot.toDriving(); }
    const busy = game.uiOpen || game.introT > 0 || game.buildView.active || spawn.isOpen() || game.loop.paused;
    if (st.mode === "drive") {
      if (!busy && !driveOnly() && keys.pressed("KeyE")) exit();
      return st.mode === "foot";
    }
    for (const e of ["trapDrop", "trapCycle", "harpoon", "rockets", "cycle"]) game.input.edge(e); // the parked car's keys do nothing on foot
    const zone = zones.at(walker.pos.x, walker.pos.z);
    if (zone) st.zone = zone;
    const free = !busy && combat.canAct(); // knocked down or dead: no walking, no hands
    const a = free ? keys.axis() : { x: 0, z: 0, run: false };
    walker.step(dt, { ...a, jump: free && keys.pressed("Space") }, cam.forward(camF), st.zone);
    combat.control(busy);
    if (walker.blocked) {
      st.blockedAt = game.time;
      if (game.time - st.hintAt > 3) { st.hintAt = game.time; game.emit({ type: "minor", text: "GET IN A VEHICLE TO LEAVE THE SAFE ZONE" }); }
    }
    st.use = free ? nearestUse(game, walker.pos, landmarks) : null;
    if (free && keys.pressed("KeyE") && st.use) activate(st.use);
    else if (free && keys.pressed("KeyZ")) summon();
    return st.mode === "foot";
  }

  function step(dt) {
    zones.step(dt);
    gate.step();
    free.step();
    rides.step(dt);
    combat.step(dt, st.mode === "foot"); // ducking drivers, shots in the air, health, loot; a death may end in a respawn
    const on = st.mode === "foot";
    remote.send(dt, on ? walker : null);
    st.visitT -= dt;
    if (st.visitT <= 0) { st.visitT = 0.5; const pos = on ? walker.pos : game.player.pos; if (on || game.player.alive) points.visit(pos.x, pos.z); }
  }

  return game.onfoot = {
    zones, free, rides, points, spawn, remote, walker, landmarks, exit, enter, summon, control, step,
    active: () => st.mode === "foot",
    orbit: (dx, dy) => cam.orbit(dx, dy),
    view(real) { cam.update(walker.pos, real); cam.apply(); },
    frame(dt, time) {
      rings.frame(time);
      free.frame(time);
      remote.frame(dt);
      const on = st.mode === "foot";
      if (on) {
        mesh.root.position.copy(walker.pos);
        mesh.root.rotation.y = walker.heading;
        animateScavenger(mesh.joints, anim, { speed: walker.speed, running: walker.running, airborne: !walker.grounded }, dt);
      }
      combat.frame(dt, time, on); // the weapon in the hand, the aim pose, lying down, streaks and loot bags
    },
    combat,
    // The walker as prey for a crowd (arena/horde.js): null while driving or dead.
    target: () => (st.mode === "foot" && !combat.dead() ? prey : null),
    blast: (pos, radius) => st.mode === "foot" && combat.blast(pos, radius), // every explosion (weapons/combat.js)
    hurt: (dmg, cause) => st.mode === "foot" && combat.hurt(dmg, cause),
    canExit: () => exitCheck(game, zones.at(game.player.pos.x, game.player.pos.z)),
    foot: () => combat.state(st.mode === "foot"), // window.scrapwake.foot.state()
    // Session start: the "Choose your ride" screen (skipped in scripted modes and arenas).
    sessionStart() { foot.toDriving(); rides.reset(); free.step(); return spawn.open("start"); },
    hud() {
      const p = game.player, on = st.mode === "foot", pos = on ? walker.pos : p.pos;
      const zone = zones.at(pos.x, pos.z);
      const canExit = !on && !driveOnly() && exitCheck(game, zone).ok;
      return {
        on, zone: zone ? { name: zone.name, kind: zone.kind } : null, x: pos.x, z: pos.z, combat: on ? combat.hud() : null,
        prompt: on ? (st.use ? st.use.label : null) : canExit ? "Get out" : null,
        edge: on && game.time - st.blockedAt < 1.5, summon: on && !!zone && game.save.garage.owned.chassis.length > 0,
      };
    },
    state: () => ({ mode: st.mode, pos: { x: +walker.pos.x.toFixed(2), y: +walker.pos.y.toFixed(2), z: +walker.pos.z.toFixed(2) }, grounded: walker.grounded, speed: +walker.speed.toFixed(2), zone: st.zone && st.zone.id, use: st.use && st.use.label }),
    dispose() { combat.dispose(); rings.dispose(); remote.dispose(); mesh.dispose(); },
  };
}