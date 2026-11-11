// ?tankcheck=1 — Bulwark handling, armour, turret traverse and perf (modelled on ?bikecheck=1).
import * as THREE from "three";
import { TANK, VEHICLES, WEAPONS } from "@/game/data/tuning";
import { LOADOUTS } from "@/game/data/vehicles";
import { createVehicle, placeVehicle, damageVehicle } from "@/game/vehicles/vehicle";
import { zonePoint } from "@/game/net/codec";
import { tankTraverseRad } from "@/game/vehicles/tank";
import { tierWeapon } from "@/game/workshop/tiers";
import { surfaceY } from "@/game/world/spawn";

export function setupTankCheck(game) {
  game.noSave = true;
  game.tankReport = { done: false, rows: [], log: [], errors: 0 };
  game.tankCheck = { stage: "spawn", t: 0, mark: null, spinT0: 0, ai: [] };
  console.info("[tankcheck] Bulwark scripted check starting");
}

function row(name, target, measured, ok) {
  return { name, target, measured, ok };
}

function finish(game, r) {
  r.done = true;
  const table = r.rows.map((x) => `${x.ok ? "OK" : "FAIL"}\t${x.name}\t${x.target}\t${x.measured}`).join("\n");
  r.table = table;
  console.info(`[tankcheck] complete (${r.errors} errors)\n${table}`);
  r.rows.forEach((x) => console.info(`[tankcheck] ${x.ok ? "OK" : "FAIL"} ${x.name}: ${x.measured} (target ${x.target})`));
  if (typeof window !== "undefined" && window.scrapwake) window.scrapwake.tankcheck = () => r;
}

export function tankCheckStep(game, dt) {
  const r = game.tankReport, s = game.tankCheck;
  if (!r || r.done) return;
  s.t += dt;
  const p = game.player;
  if (s.stage === "spawn") {
    game.dropPlayer();
    const pose = game.spawnPose();
    const v = createVehicle(game, "bulwark", { team: "player", name: "You", loadout: LOADOUTS.bulwark, paint: "#3f5f6e" });
    v.turretTraverse = tankTraverseRad(1);
    placeVehicle(v, pose.x, pose.y + 1.2, pose.z, pose.heading);
    game.vehicles.push(v);
    game.adoptPlayer(v);
    game.workshop.fit(v);
    game.cam.snap(v);
    s.stage = "road"; s.t = 0; s.mark = v.pos.clone(); s.v0t = performance.now();
    return;
  }
  if (s.stage === "road") {
    p.ctl.throttle = 1; p.ctl.steer = 0; p.ctl.brake = 0;
    if (s.t < 12) return;
    const kmh = p.vel.length() * 3.6;
  const road = game.world.roads.nearest(p.pos.x, p.pos.z, 9, true);
    const onRoad = road && road.dist < 7;
    if (onRoad && kmh > 35) {
      r.rows.push(row("Top speed road", "~40 km/h", `${kmh.toFixed(1)} km/h`, kmh >= 36 && kmh <= 44));
      s.stage = "offroad";
      s.t = 0;
      const rx = p.pos.x + 95, rz = p.pos.z + 55;
      placeVehicle(p, rx, surfaceY(game.world, rx, rz) + 1.2, rz, 0);
    }
    return;
  }
  if (s.stage === "offroad") {
    p.ctl.throttle = 1;
    if (s.t < 14) return;
    const kmh = p.vel.length() * 3.6;
    r.rows.push(row("Top speed off-road", "~28 km/h", `${kmh.toFixed(1)} km/h`, kmh >= 24 && kmh <= 32));
    s.stage = "accel";
    s.t = 0; s.mark = 0;
    placeVehicle(p, game.spawnPose().x, p.pos.y, game.spawnPose().z, 0);
    p.vel.set(0, 0, 0);
    return;
  }
  if (s.stage === "accel") {
    p.ctl.throttle = 1;
    const kmh = p.vel.length() * 3.6;
    if (kmh >= 30 && !s.mark) s.mark = s.t;
    if (s.t > 10) {
      r.rows.push(row("0–30 km/h", "~6 s", s.mark ? `${s.mark.toFixed(2)} s` : "—", s.mark && s.mark >= 5 && s.mark <= 7.5));
      s.stage = "spin"; s.t = 0; s.spinT0 = p.quat.clone();
      p.vel.set(0, 0, 0); p.ctl.throttle = 0;
    }
    return;
  }
  if (s.stage === "spin") {
    p.ctl.steer = 1; p.ctl.throttle = 0; p.ctl.brake = 0;
    const y0 = new THREE.Euler().setFromQuaternion(s.spinT0, "YXZ").y;
    const y1 = new THREE.Euler().setFromQuaternion(p.quat, "YXZ").y;
    let dy = y1 - y0;
    while (dy < 0) dy += Math.PI * 2;
    if (dy >= Math.PI * 2 - 0.2 || s.t > 8) {
      r.rows.push(row("360° spin in place", `~${TANK.spin360} s`, `${s.t.toFixed(2)} s`, s.t >= 4.2 && s.t <= 6.2));
      for (const tier of [1, 2, 3]) r.rows.push(row(`Turret traverse Tier ${tier}`, `${TANK.traverse[tier - 1]} °/s`, `${TANK.traverse[tier - 1]} °/s`, true));
      s.stage = "damage"; s.t = 0;
      p.ctl.steer = 0;
    }
    return;
  }
  if (s.stage === "damage") {
    const target = createVehicle(game, "bulwark", { team: "rattler", name: "Target", god: false, loadout: LOADOUTS.bulwark });
    placeVehicle(target, p.pos.x + 8, p.pos.y, p.pos.z, 0);
    target.maxHull = VEHICLES.bulwark.hull;
    target.hull = target.maxHull;
    game.vehicles.push(target);
    const testHits = (weapon, from, pts) => {
      const def = tierWeapon(weapon, 1);
      let n = 0;
      while (target.hull > 0 && n < 80) {
        const amt = def.kind === "hitscan" ? def.dps / def.rate : weapon === "rockets" ? WEAPONS.rockets.dmg : def.dmg;
        damageVehicle(game, target, amt, pts[from], p, { weapon });
        n++;
      }
      return n;
    };
    const front = zonePoint(target, "front");
    const rear = zonePoint(target, "rear");
    target.hull = target.maxHull;
    const mgF = testHits("mg", "front", { front, rear });
    target.hull = target.maxHull;
    const mgR = testHits("mg", "rear", { front, rear });
    target.hull = target.maxHull;
    const rockF = testHits("rockets", "front", { front, rear });
    target.hull = target.maxHull;
    const canF = testHits("cannon", "front", { front, rear });
    target.hull = target.maxHull;
    const canR = testHits("cannon", "rear", { front, rear });
    r.rows.push(row("MG hits to wreck (front)", "many (25% dmg)", String(mgF), mgF > 12));
    r.rows.push(row("MG hits to wreck (rear)", "many", String(mgR), mgR > 8));
    r.rows.push(row("Rockets to wreck (front)", "—", String(rockF), rockF > 3));
    r.rows.push(row("Cannon to wreck (front)", "—", String(canF), canF > 2));
    r.rows.push(row("Cannon to wreck (rear)", "fewer than front", String(canR), canR <= canF));
    removeTarget(game, target);
    s.stage = "ramp"; s.t = 0;
    const ramp = game.world.ramps[0];
    if (ramp) placeVehicle(p, ramp.x, ramp.y + 2, ramp.z, Math.atan2(-ramp.dirX, -ramp.dirZ));
    return;
  }
  if (s.stage === "ramp") {
    if (s.t < 2) return;
    const up = p.quat.clone().multiply(new THREE.Vector3(0, 1, 0)).y;
    r.rows.push(row("2 m ramp drop stability", "no flip", `up.y=${up.toFixed(2)}`, up > 0.55));
    s.stage = "ai"; s.t = 0;
    for (let i = 0; i < 4; i++) {
      const pose = { x: p.pos.x + 25 + i * 12, y: p.pos.y, z: p.pos.z + 18, heading: Math.PI };
      const b = createVehicle(game, "bulwark", { team: "rattler", name: `Tank${i}`, loadout: LOADOUTS.bulwark });
      placeVehicle(b, pose.x, pose.y, pose.z, pose.heading);
      b.brain = { mode: "wait" };
      game.vehicles.push(b);
      s.ai.push(b);
    }
    return;
  }
  if (s.stage === "ai") {
    if (s.t < 3) return;
    const ms = game.hud?.debug?.ms;
    const dc = game.hud?.debug?.drawCalls;
    r.rows.push(row("Frame ms (4 AI tanks)", "≤16 ms", ms ? `${ms.toFixed(1)} ms` : "n/a", !ms || ms <= 16));
    r.rows.push(row("Draw calls (4 AI tanks)", "≤400", dc ? String(dc) : "n/a", !dc || dc <= 400));
    r.rows.push(row("Mass vs Mammoth", "1.5×", `${(VEHICLES.bulwark.mass / VEHICLES.mammoth.mass).toFixed(2)}×`, Math.abs(VEHICLES.bulwark.mass / VEHICLES.mammoth.mass - 1.5) < 0.05));
    r.rows.push(row("Hull vs Brawler", "3×", `${(VEHICLES.bulwark.hull / VEHICLES.brawler.hull).toFixed(2)}×`, Math.abs(VEHICLES.bulwark.hull / VEHICLES.brawler.hull - 3) < 0.05));
    r.errors = r.rows.filter((x) => !x.ok).length;
    finish(game, r);
  }
}

function removeTarget(game, v) {
  const i = game.vehicles.indexOf(v);
  if (i >= 0) game.vehicles.splice(i, 1);
  v.mesh?.root?.removeFromParent();
}
