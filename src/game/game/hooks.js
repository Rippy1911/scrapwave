// window.scrapwake — test and trailer hooks. Installed when the game boots, removed on dispose.
import * as THREE from "three";
import { VERSION, CYCLE, AI as AI_TUNING } from "@/game/data/tuning";
const AI_SKILLS = AI_TUNING.skills;
import { PLACES } from "@/game/data/places";
import { DRIFTERS } from "@/game/data/drifters";
import { wreckVehicle, placeVehicle, removeVehicle, createVehicle } from "@/game/vehicles/vehicle";
import { flipOver, startRighting, physicsStats } from "@/game/vehicles/physics";
import { checkHeightfield } from "@/game/vehicles/rapier";
import { nearestRoadPose, poseAt, roadSpawn, surfaceY } from "@/game/world/spawn";
import { baseHooks } from "@/game/base/hooks";
import { workshopHooks } from "@/game/workshop/hooks";
import { airHooks, adminHook } from "@/game/air";
import { aimTrapHooks } from "@/game/game/hooksAim";
import { footHooks } from "@/game/game/hooksFoot";
import { mechHooks } from "@/game/mech/hooks";
import { touchHooks } from "@/game/ui/touch/hooks";
import { installFactionHooks } from "@/game/factions/hooks";
import { lobbyHooks } from "@/game/lobby/hooks";
import { quickHooks } from "@/game/lobby/quickCheck";
import { rampCheck, rampCheckOverlay } from "@/game/world/rampCheck";
import { rampProbeText } from "@/game/world/rampProbe";
import { round13Hooks } from "@/game/game/hooksRound13";
import { round14Hooks } from "@/game/game/hooksRound14";
import { telemetryHooks } from "@/game/core/telemetry";
import { bigHooks } from "@/game/maps/ashmark/hooks";
import { runFameCheck } from "@/game/fame/fameCheck";

const placeBy = (q) => PLACES.find((p) => p.id.toLowerCase() === String(q).toLowerCase() || p.name.toLowerCase() === String(q).toLowerCase() || p.name.toLowerCase().includes(String(q).toLowerCase()));

export function installHooks(game, api) {
  const w = game.world;
  const near = (q) => {
    if (q && typeof q === "object") return { x: q.x, z: q.z };
    const pl = q ? placeBy(q) : null;
    if (pl) return { x: pl.x, z: pl.z };
    const p = game.player, f = new THREE.Vector3(0, 0, -60).applyQuaternion(p.quat);
    return { x: p.pos.x + f.x, z: p.pos.z + f.z };
  };
  const hooks = {
    version: VERSION,
    state() {
      const p = game.player;
      const place = PLACES.find((pl) => Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z) < pl.r) || PLACES.slice().sort((a, b) => Math.hypot(p.pos.x - a.x, p.pos.z - a.z) - Math.hypot(p.pos.x - b.x, p.pos.z - b.z))[0];
      return {
        pos: { x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2) },
        speedKmh: Math.round(p.vel.length() * 3.6), hull: Math.round(p.hull), scrap: game.save.banked + p.scrap,
        banked: game.save.banked, carried: p.scrap, alive: p.alive, grounded: p.grounded, airTime: +p.airTime.toFixed(2),
        vehicle: p.chassisId, nearestPlace: place.name,
        enemiesNear: game.vehicles.filter((v) => v.alive && v !== p && v.pos.distanceTo(p.pos) < 150).length,
        fps: Math.round(1000 / Math.max(1, game.loop.frameMs)), autopilot: !!game.autopilot,
        cycleTime: Math.round(game.cycle.t), drifters: game.vehicles.filter((v) => v.alive && v.team === "drifter").length,
        test: game.testReport ? { ...game.testReport, buggy: undefined } : null, accel: game.accelReport || null,
        fuel: Math.round(p.fuel * 10) / 10, fuelMax: p.fuelMax, limp: !!p.limp, refuelling: !!p.refuelling,
        replaying: !!game.replay.active, replayOffer: game.replay.offer(), demo: game.demo.state(),
        selfcheck: game.selfReport ? { ...game.selfReport, st: undefined } : null,
      };
    },
    // Fuel: setFuel(units) for the player's tank (0 = limp mode). fuel() reads it back.
    setFuel(n) { return game.setFuel(game.player, +n || 0); },
    fuel() { const p = game.player; return { fuel: Math.round(p.fuel * 10) / 10, max: p.fuelMax, limp: !!p.limp, refuelling: !!p.refuelling }; },
    stations() { return game.world.fuel.list.map((s) => ({ id: s.id, name: s.name, x: Math.round(s.x), z: Math.round(s.z) })); },
    // Instant replay of the pending moment (or the last 10 s). stopReplay() skips it.
    replay() { return game.replay.start(); },
    stopReplay() { game.replay.stop(); return true; },
    // Demo reel: demo(true) starts the 2-minute show reel, demo(false) stops it.
    demo(on = true) {
      if (on) game.demo.start({ attract: false }); else game.demo.stop();
      api.emit({ type: "demo", on: !!on });
      return game.demo.state();
    },
    demoState() { const s = game.demo.state(); return { running: s.running, shot: s.shot, t: s.t, segment: s.segment }; },
    setMapTarget(id) { game.mapTarget = id || null; return game.mapTarget; },
    startCycle(opts = {}) {
      game.base.resetAll(false);
      game.cycleSys.restart({ short: opts.short, length: opts.length || (opts.short ? CYCLE.shortLength : undefined) });
      game.respawnPlayer();
      game.startIntro(opts.intro !== false);
      api.emit({ type: "play" });
      return hooks.state();
    },
    setAutopilot(on) { game.autopilotCtl.set(on); return !!game.autopilot; },
    teleport(target) {
      let pose;
      if (target && typeof target === "object") pose = target.heading !== undefined ? poseAt(w, target.x, target.z, target.heading) : nearestRoadPose(w, target.x, target.z, 0, -1, game.vehicles, game.player);
      else { const pl = placeBy(target); if (!pl) return false; pose = pl.safe ? roadSpawn(w, { road: "highway", s: 88, dir: 1 }, game.vehicles) : nearestRoadPose(w, pl.x, pl.z, 0, -1, game.vehicles, game.player); }
      game.respawnPlayer(pose);
      return hooks.state().pos;
    },
    give(scrap = 100) { game.player.scrap += Math.round(scrap); return game.player.scrap; },
    spawn(kind = "rattler", where) {
      const at = near(where);
      const pose = nearestRoadPose(w, at.x, at.z, 0, -1, game.vehicles);
      // Workshop: a design object, a bike id (dirtbike, chopper, sidecar), a blueprint name or "preset:Name" (parked, hostile).
      if (game.workshop.resolve(kind)) return game.workshop.spawn(kind, pose).id;
      if (kind === "drifter") {
        const e = game.drifters.roster.find((x) => !x.v) || null;
        if (!e) return null;
        return game.drifters.spawnOne(e, pose).id;
      }
      return game.ai.makeRattler(pose, null, kind === "pickup" ? "pickup" : kind === "buggy" ? "buggy" : null).id;
    },
    // Park a brainless vehicle of any chassis (jackal, buggy, brawler, pickup, mammoth, tanker) for close-ups and fx
    // tests: showcase("brawler", { x, z, heading (deg), armour: "plate", paint }). Returns its id.
    showcase(chassis = "jackal", o = {}) {
      const at = near(o);
      const pose = o.heading !== undefined ? poseAt(w, at.x, at.z, o.heading) : nearestRoadPose(w, at.x, at.z, 0, -1, game.vehicles);
      const tier = o.armour || null;
      const armour = tier ? { front: tier, rear: tier, left: tier, right: tier, top: tier } : {};
      const v = createVehicle(game, chassis, { team: o.team || "prop", paint: o.paint, paint2: o.paint2, armour, plate: "SW-" + (10 + game.vehicles.length) });
      placeVehicle(v, pose.x, pose.y + 1.2, pose.z, pose.heading);
      game.vehicles.push(v);
      return v.id;
    },
    // Freeze the simulation and the effects without the pause menu (screenshots of a moment): pause(true|false).
    pause(on = true) { game.loop.paused = !!on; return game.loop.paused; },
    // Wreck a vehicle by id (or the nearest when omitted).
    wreck(id) {
      const v = game.vehicles.find((x) => x.id === id && x.alive);
      if (!v) return hooks.explodeNearest();
      wreckVehicle(game, v, game.player);
      return v.name;
    },
    // Draw calls and triangles per vehicle mesh (visible meshes only).
    vehicleStats() {
      return game.vehicles.map((v) => {
        let calls = 0, tris = 0;
        v.mesh.root.traverseVisible((o) => { if (o.isMesh) { calls++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
        return { id: v.id, chassis: v.chassisId, team: v.team, calls, tris: Math.round(tris), parts: v.mesh.parts.length };
      });
    },
    explodeNearest() {
      const p = game.player;
      const t = game.vehicles.filter((v) => v.alive && v !== p).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0];
      if (t) { wreckVehicle(game, t, p); return t.name; }
      return null;
    },
    setTime(seconds) { return game.cycleSys.skipTo(seconds); },
    // Bases: claim(plotId) skips the 5 s hold; build(module, x, z, rot) on your plot (plot-local metres);
    // raidNow() sends a Rattler wave at every lit base; fund(n) adds banked scrap; state() summarises.
    base: baseHooks(game),
    // Workshop: parts(), tiers(), design(), build(design), upgrade(slot, tier), blueprints(), save(name), load(name),
    // exportCode(name), importCode(code), ride(kind), throwOff(), state(), check().
    workshop: workshopHooks(game),
    mech: mechHooks(game),
    // Lobbies: lobby.host(rules, { name, max, code }), list(), join(idOrCode), ready(on), start(), state(), check(role).
    lobby: lobbyHooks(game),
    // Quick play (the title's main button): quick.start(), cancel(), state(), check(); ?quickcheck=1 runs the check.
    quick: quickHooks(game),
    // Aircraft: air.spawn('heli'|'jet'), air.state(), air.exit(); admin(true|false) sets the local developer admin flag.
    air: airHooks(game),
    admin: adminHook,
    // Cycle: skipTo(seconds) moves the clock (1800 = storm, 2100 = cycle end); state() reads it.
    cycle: { skipTo: (s) => game.cycleSys.skipTo(s), state: () => ({ ...game.cycleSys.hud(), t: Math.round(game.cycle.t), phase: game.cycleSys.phase() }), next: () => { game.cycleSys.next(); return game.cycle.n; } },
    // Physics test hooks (Rapier lane).
    flip() { flipOver(game.player); return hooks.pose(); },
    rightNow() { return startRighting(game.player); },
    // Detailed player physics state.
    pose() {
      const p = game.player, f = new THREE.Vector3(0, 0, -1).applyQuaternion(p.quat), u = new THREE.Vector3(0, 1, 0).applyQuaternion(p.quat), rt = new THREE.Vector3(1, 0, 0).applyQuaternion(p.quat);
      const r3 = (v) => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) });
      return {
        pos: r3(p.pos), vel: r3(p.vel), angVel: r3(p.angVel), fwd: r3(f), up: r3(u), right: r3(rt), quat: { x: p.quat.x, y: p.quat.y, z: p.quat.z, w: p.quat.w },
        speedKmh: +(p.vel.length() * 3.6).toFixed(1), fwdKmh: +(p.vel.dot(f) * 3.6).toFixed(1),
        heading: +((Math.atan2(f.x, -f.z) * 180) / Math.PI).toFixed(1),
        contacts: p.contacts, grounded: p.grounded, airTime: +p.airTime.toFixed(3), turbo: +p.turbo.toFixed(3), turboActive: !!p.turboActive,
        righting: !!p.righting, flipTime: +(p.flipTime || 0).toFixed(2), hull: Math.round(p.hull), alive: p.alive, time: +game.time.toFixed(3),
        impacts: p.impacts || 0, impactDmg: Math.round(p.impactDmg || 0), partsOff: p.mesh.parts.filter((x) => x.detached).map((x) => x.id),
      };
    },
    // Move the player's car (no respawn): x, z, optional y, heading in degrees (0 = -z, 90 = +x), speed in km/h along it.
    setPose({ x, z, y, heading = 0, kmh = 0 } = {}) {
      const p = game.player, h = (-heading * Math.PI) / 180;
      const gy = y ?? Math.max(surfaceY(w, x, z), w.groundAt(x, z, 999)) + (p.rideH || 1) + 0.1;
      placeVehicle(p, x, gy, z, h);
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(p.quat);
      p.vel.copy(f).multiplyScalar(kmh / 3.6);
      p.airTime = 0; p.righting = null;
      return hooks.pose();
    },
    setSpeed(kmh) { const p = game.player; p.vel.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(p.quat)).multiplyScalar(kmh / 3.6); return hooks.pose(); },
    // Network-driven test: the player's car becomes a kinematic remote vehicle that follows v.pos/v.quat.
    setRemote(on = true) { game.player.remote = !!on; return game.player.remote; },
    setTurbo(x = 1) { game.player.turbo = x; return x; },
    physics(check = false) { return { ...physicsStats(w), heightfield: check ? checkHeightfield(w) : undefined }; },
    // Colliders whose footprint is within r of (x, z): for wall and jump tests.
    walls(x, z, r = 80) {
      const out = [];
      w.colliders.collect(x, z, r, (b) => {
        if (b.dead || b.noCollide) return;
        const dx = x - b.x, dz = z - b.z, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
        const d = Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz));
        if (d <= r) out.push({ id: b.id, kind: b.kind, x: b.x, y: b.y, z: b.z, hx: b.hx, hy: b.hy, hz: b.hz, yaw: b.yaw, tag: b.tag || null, dist: +d.toFixed(2) });
      });
      return out;
    },
    // A test wall (collider + plain mesh) built at runtime: len along its yaw (degrees, same convention as heading).
    addWall({ x, z, len = 40, h = 2.4, thick = 1, yaw = 0 } = {}) {
      const ry = (-yaw * Math.PI) / 180, y = w.terrain.heightAt(x, z) + h / 2 - 0.3;
      const b = w.colliders.add({ x, y, z, hx: thick / 2, hy: h / 2, hz: len / 2, yaw: ry, tag: "testwall" });
      const m = new THREE.Mesh(new THREE.BoxGeometry(thick, h, len), game.M.concrete || game.M.dark);
      m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
      game.scene.add(m);
      (game._testWalls ||= new Map()).set(b.id, m);
      return b.id;
    },
    removeWall(id) { w.colliders.removeById(id); const m = game._testWalls?.get(id); if (m) { m.removeFromParent(); game._testWalls.delete(id); } return true; },
    // Gunnery tests. sentry({ x, z, skill: rookie|veteran|ace, kind: buggy|pickup }) parks a Rattler that only aims and
    // fires at you (MGs, rockets too with rockets: true); shotStats(reset) counts AI rounds fired at you and hits; god(on) makes your car take no damage.
    sentry({ x, z, skill = "veteran", kind = "buggy", rockets = false } = {}) {
      const p = game.player, h = Math.atan2(p.pos.x - x, -(p.pos.z - z)) * 180 / Math.PI;
      const pose = poseAt(w, x, z, h);
      const v = game.ai.makeRattler(pose, null, kind);
      v.skill = AI_SKILLS[skill] || AI_SKILLS.veteran; v.skillName = skill; v.spreadMul = v.skill.spread / 0.03;
      v.brain.mode = "sentry"; v.brain.think = 0; v.brain.sentryRockets = !!rockets;
      return v.id;
    },
    shotStats(reset = false) { const s = { ...game.combat.stats }; if (reset) { game.combat.stats.aiShots = 0; game.combat.stats.aiHits = 0; } return s; },
    god(on = true) { game.player.god = !!on; return game.player.god; },
    // A gunner's aim right now: aim point minus its target's position, line of sight, reaction (s).
    aimOf(id) {
      const v = game.vehicles.find((x) => x.id === id), t = v && v.lockTarget, st = v && v.aimSt;
      if (!t) return null;
      const o = v.aimPoint.clone().sub(t.pos);
      return { x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), see: !!(st && st.see), react: st ? +st.react.toFixed(2) : null, fire: !!v.ctl.fire };
    },
    // Remove every AI vehicle (test isolation; they do not respawn until wrecked ones would).
    clearTraffic() {
      for (const v of game.vehicles.slice()) {
        if (v === game.player) continue;
        game.vehicles.splice(game.vehicles.indexOf(v), 1);
        removeVehicle(game, v);
      }
      return game.vehicles.length;
    },
    ramps() { return w.ramps.map((r) => ({ x: r.x, z: r.z, y: r.y, dirX: r.dirX, dirZ: r.dirZ, len: r.len, h: r.h, w: r.w, type: r.type })); },
    // Run-up, foot fit and landing lane of every ramp (?rampcheck=1 shows the failures).
    rampCheck: () => rampCheck(w),
    // Wreck-line sites (crash scenes and convoys) and every placed wreck: wrecks() -> { counts, sites, pieces }.
    wrecks() { const k = w.wrecks; return k ? { counts: k.counts, sites: k.sites, pieces: k.pieces.map((p) => ({ model: p.model, x: +p.x.toFixed(1), z: +p.z.toFixed(1), hl: +p.hl.toFixed(2) })) } : null; },
    groundAt(x, z) { return { terrain: w.terrain.heightAt(x, z), ground: w.groundAt(x, z, 999), surface: surfaceY(w, x, z) }; },
    // Every vehicle's state is finite (no NaN anywhere).
    finite() {
      const bad = game.vehicles.filter((v) => ![v.pos, v.vel, v.angVel].every((q) => Number.isFinite(q.x + q.y + q.z)) || !Number.isFinite(v.quat.x + v.quat.y + v.quat.z + v.quat.w));
      return { vehicles: game.vehicles.length, bad: bad.map((v) => v.name) };
    },
    drifterNames: DRIFTERS.map((d) => d.name),
    // Multiplayer: net.state() → mode, id, host, shard, rtt, humans and remote cars. net.chat(text), net.emote(0-3).
    // net.loopback(n) adds n (max 8) scripted fake remote cars offline; loopback(0) removes them. net.seats() → Drifter seat balance.
    net: { state: () => game.netSync.debug(), chat: (t) => game.netSync.chat(t), emote: (i) => game.netSync.emote(i | 0), loopback: (n = 3) => game.netSync.loopback(+n), seats: () => game.drifters.seats() },
  };
  Object.assign(hooks, aimTrapHooks(game)); // aim.*, traps.*, arenaOpponents()
  Object.assign(hooks, footHooks(game)); // onfoot.*, spawnMenu.*
  Object.assign(hooks, touchHooks(game)); // touch.*
  installFactionHooks(game, hooks); // factions.*
  Object.assign(hooks, round13Hooks(game)); // maps.*, race.*, photo(), rideNet(), check13()
  Object.assign(hooks, round14Hooks(game)); // flight.*, check14()
  Object.assign(hooks, telemetryHooks()); // telemetry.state(), telemetry.flush()
  hooks.big = bigHooks(game); // big.state(), big.enter(), big.teleport(), big.check()
  hooks.fame = {
    view: () => game.fame?.view(),
    report: () => game.fameReport,
    check: () => runFameCheck(game),
  };
  window.scrapwake = hooks;
  const rq = new URLSearchParams(window.location.search), probe = rq.get("rampprobe");
  if (rq.get("rampcheck") === "1" || probe) setTimeout(() => { if (window.scrapwake === hooks) rampCheckOverlay(w, probe ? rampProbeText(w, probe.split(";")) : ""); }, 1500);
  return () => { if (window.scrapwake === hooks) delete window.scrapwake; };
}