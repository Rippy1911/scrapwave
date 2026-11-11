// "Player-like" brain shared by Drifters and the player autopilot: roam the roads, loot crates, jump ramps,
// fight, bank cargo and repair in the Well-town, hunt cargo carriers and take payback.
import * as THREE from "three";
import { FLOW } from "@/game/data/tuning";
import { PLACES } from "@/game/data/places";
import { DRIFTER_AI as K } from "@/game/data/drifters";
import { driveTo, nearestHostile, lineOfSight, aimAndFire, holdFire, fightPoint } from "@/game/ai/steer";
import { followRoad, turnAround } from "@/game/ai/nav";
import { setTagSub } from "@/game/vehicles/nametag";
import { needsFuel, refuelDrive } from "@/game/ai/refuel";
import { pickRamp, startRamp, rampTarget } from "@/game/ai/rampRun";

const g = new THREE.Vector3(), tp = new THREE.Vector3();
const ROAM = PLACES.filter((p) => !p.safe);

function nearestPickup(game, v, range) {
  let best = null, bd = range;
  for (const k of game.pickups.list) {
    const d = k.g.position.distanceTo(v.pos);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

export function agentThink(game, v) {
  const b = v.brain, p = game.player, auto = v === game.player;
  b.think = 0.25 * (0.7 + v.skill.react);
  const hullK = v.hull / v.maxHull;
  const recentlyHitBy = v.lastHitBy && game.time - v.lastCombat < 10 ? v.lastHitBy : null;
  const filter = auto ? null : (t) => t.team === "rattler" || t === recentlyHitBy || (t.team === "drifter" && b.brawly) || (t === p && (b.hunting || !!game.factions?.drifterOnSight())); // Hostile Drifters attack on sight
  b.target = null;
  if (!auto && b.payback && p.alive && !game.inSafeZone(p) && game.time < b.paybackUntil) { b.mode = "payback"; b.target = p; }
  else if (hullK < K.repairHull || (b.mode === "repair" && hullK < 0.95)) b.mode = "repair";
  else if (needsFuel(v)) b.mode = "refuel";
  else if (v.scrap >= (auto ? FLOW.bankAt : K.bankAt)) b.mode = "bank";
  else {
    const t = nearestHostile(game, v, K.fightRange * (auto ? 1.2 : 1), filter);
    if (t) { b.mode = "fight"; b.target = t; }
    else if (b.hunting && p.alive && p.scrap > 0 && !game.inSafeZone(p)) { b.mode = "hunt"; b.target = p; }
    else if (b.mode === "ramp" && b.ramp && game.time < b.rampUntil) { /* keep jumping */ }
    else {
      const k = nearestPickup(game, v, K.lootRange);
      const r = !k && (auto || Math.random() < K.rampChance) ? pickRamp(game, v, b) : null;
      if (k) { b.mode = "loot"; b.loot = k; }
      else if (r) startRamp(game, b, r);
      else b.mode = "roam";
    }
  }
  if (b.target) { b.dist = b.target.pos.distanceTo(v.pos); b.los = b.dist < 200 && lineOfSight(game, v, b.target, b.dist); }
  if (b.mode === "roam" && (!b.dest || Math.hypot(b.dest.x - v.pos.x, b.dest.z - v.pos.z) < 60)) {
    const seek = auto ? nearestHostile(game, v, 480) : null;
    const pl = ROAM[Math.floor(Math.random() * ROAM.length)];
    b.dest = seek ? { x: seek.pos.x, z: seek.pos.z } : { x: pl.x, z: pl.z };
  }
  if (auto && b.mode === "roam") { const seek = nearestHostile(game, v, 480); if (seek) b.dest = { x: seek.pos.x, z: seek.pos.z }; }
  if (game.debug) setTagSub(v, b.mode.toUpperCase() + (b.target ? " · " + b.target.name : ""));
}

function roadDrive(game, v, b, dt, dest, maxSpeed) {
  if (!followRoad(game, v, b, g, dest)) g.set(dest ? dest.x : 0, 0, dest ? dest.z : 0);
  let turbo = false;
  if (b.gapAhead && b.gapAhead < 150) {
    const fast = v.vel.length() > 30 || v.turbo > 0.45;
    if (b.gapEastWest && fast) { turbo = true; maxSpeed = 0; }
    else { turnAround(b); followRoad(game, v, b, g, null); b.lockDir = 4; }
  }
  if (b.lockDir > 0) b.lockDir -= dt;
  return driveTo(v, g, dt, { maxSpeed, turbo, noHandbrake: turbo });
}

export function agentDrive(game, v, dt) {
  const b = v.brain, t = b.target, auto = v === game.player;
  const town = game.world.town.bank;
  switch (b.mode) {
    case "fight": case "payback": case "hunt": {
      if (!t || !t.alive) { b.mode = "roam"; break; }
      b.dist = t.pos.distanceTo(v.pos);
      fightPoint(v, t, b.dist, g);
      const ang = driveTo(v, g, dt);
      v.ctl.turbo = Math.abs(ang) < 0.3 && b.dist > 60 && v.turbo > 0.2 && Math.random() < v.skill.turbo;
      aimAndFire(game, v, t, b.dist, b.los);
      return;
    }
    case "loot": {
      if (!b.loot || !game.pickups.list.includes(b.loot)) { b.mode = "roam"; break; }
      tp.copy(b.loot.g.position);
      driveTo(v, tp, dt, { maxSpeed: tp.distanceTo(v.pos) < 30 ? 13 : 0 });
      holdFire(v, tp);
      return;
    }
    case "ramp": {
      if (!b.ramp || !rampTarget(game, v, b, g, dt)) break;
      driveTo(v, g, dt, { turbo: b.rampStage === 1, noHandbrake: true });
      holdFire(v, g);
      return;
    }
    case "refuel":
      if (refuelDrive(game, v, dt, { allowTown: true, roadDrive })) return;
      break;
    case "repair": case "bank": {
      const d = Math.hypot(town.x - v.pos.x, town.z - v.pos.z);
      if (d > 160) roadDrive(game, v, b, dt, town, 0);
      else { g.set(town.x, 0, town.z); driveTo(v, g, dt, { maxSpeed: d < 40 ? 8 : 18 }); }
      holdFire(v, g);
      return;
    }
    default: break;
  }
  roadDrive(game, v, b, dt, b.dest, auto ? 0 : 30);
  holdFire(v, g);
}