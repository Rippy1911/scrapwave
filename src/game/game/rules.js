// Gameplay rules: scrap pickups, banking, town repair, burning, smoke, wrecks, respawns, air callouts, prop smashing.
import * as THREE from "three";
import { AIR, AI, DAMAGE, ECONOMY, TURBO, WORLD, REPLAY } from "@/game/data/tuning";
import { writeSave } from "@/game/core/save";
import { removeVehicle, damageVehicle } from "@/game/vehicles/vehicle";

const UP = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(), qi = new THREE.Quaternion(), lw = new THREE.Vector3();
const rint = ([a, b]) => Math.round(a + Math.random() * (b - a));

export function attachRules(game) {
  const town = game.world.town;
  game.inTown = (x, z) => Math.hypot(x - town.bank.x, z - town.bank.z) < WORLD.noFireRadius;
  // Players and Drifters are safe inside the town ring; Rattlers never are.
  game.inSafeZone = (v) => v.team !== "rattler" && v.team !== "warlord" && game.inTown(v.pos.x, v.pos.z);
  game.session = { wrecks: 0, banked: 0 };
  game.inGarage = (v) => Math.hypot(v.pos.x - town.garage.x, v.pos.z - town.garage.z) < town.garage.r + 4;
  game.callout = (text, sub, color = "#f2c230") => game.emit({ type: "callout", text, sub, color });
  game.hitFlash = 0;
  game.respawnIn = 0;
  let rattlerDebt = 0, lootTimer = 0;

  game.shake = (pos, scale) => {
    const p = game.player;
    if (!p) return;
    const d = pos.distanceTo(p.pos);
    game.cam.addTrauma(scale * 0.5 * Math.max(0, 1 - d / 90));
  };
  game.onPlayerHit = (amount) => { game.hitFlash = Math.min(1, game.hitFlash + amount / 70); };
  game.onHitMarker = (v, amount) => { game.emit({ type: "hit", amount }); game.audio.hitMarker(); };
  game.onPartOff = (v, part) => {
    if (part.kind === "wheel") { game.save.stats.wheels++; game.callout("WHEEL OFF!", v.name, "#ff8a3a"); }
    else { game.save.stats.parts++; game.emit({ type: "minor", text: (part.kind === "armour" ? "ARMOUR" : part.kind.toUpperCase()) + " OFF" }); }
  };
  game.onBarrel = (attacker) => { if (attacker === game.player) game.save.stats.barrels++; };
  game.onWreck = (v, attacker) => {
    const value = v.team === "rattler" ? rint(ECONOMY.rattlerWreck) : ECONOMY.drifterWreck;
    const spill = Math.floor(v.scrap * DAMAGE.spillFraction);
    game.lastWreck = { pos: v.pos.clone(), time: game.time, v };
    if (game.drifters) game.drifters.onWreck(v, attacker);
    for (let i = 0; i < 3; i++) game.pickups.spawn(v.pos.x, v.pos.y, v.pos.z, Math.round((value + spill) / 3), (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    game.onWreckFuel(v);
    if (v === game.player) game.replay.mark("wrecked", v, DAMAGE.respawnTime - 0.2);
    else if (attacker === game.player) game.replay.mark("wreck", v);
    if (v === game.player) {
      v.scrap = 0;
      game.respawnIn = DAMAGE.respawnTime;
      game.callout("WRECKED", attacker ? "by " + attacker.name : "the wasteland wins", "#ff4a2a");
      return;
    }
    if (v.team === "rattler") rattlerDebt++;
    if (attacker === game.player) {
      game.save.stats.wrecks++; game.session.wrecks++;
      game.player.turbo = Math.min(1, game.player.turbo + TURBO.wreckRefill);
      const air = !game.player.grounded;
      game.callout(air ? "DEATH FROM ABOVE" : "WRECKED " + v.name.toUpperCase(), `+${value} scrap dropped`, "#f2c230");
    }
  };

  function airCallouts(p, dt) {
    if (!p.alive) return;
    if (!p.contacts) {
      qi.copy(p.quat).invert(); lw.copy(p.angVel).applyQuaternion(qi);
      p.flipAcc = (p.flipAcc || 0) + lw.x * dt; p.rollAcc = (p.rollAcc || 0) + lw.z * dt;
    }
    if (p.justLanded > AIR.minCallout) {
      const t = p.justLanded;
      up.copy(UP).applyQuaternion(p.quat);
      const clean = up.y > Math.cos((AIR.cleanAngle * Math.PI) / 180);
      const flips = Math.round(Math.abs(p.flipAcc || 0) / (Math.PI * 2)), rolls = Math.round(Math.abs(p.rollAcc || 0) / (Math.PI * 2));
      let scrap = Math.round(t * AIR.scrapPerSec) + flips * AIR.flipScrap + rolls * AIR.rollScrap;
      if (clean) { scrap = Math.round(scrap * 1.5); p.turbo = Math.min(1, p.turbo + TURBO.cleanRefill); }
      else damageVehicle(game, p, AIR.badLandingDmg * t, p.pos, null, { blunt: true });
      p.scrap += scrap;
      game.save.stats.jumps += t > 1.5 ? 1 : 0;
      game.save.stats.flips += flips + rolls;
      game.save.stats.bestAir = Math.max(game.save.stats.bestAir, Math.round(t * 10) / 10);
      const trick = flips ? `${flips > 1 ? flips + "x " : ""}FLIP` : rolls ? `${rolls > 1 ? rolls + "x " : ""}BARREL ROLL` : `AIR ${t.toFixed(1)}s`;
      game.callout(trick + (clean ? " · CLEAN" : ""), `+${scrap} scrap`, clean ? "#7fe0a0" : "#f2c230");
      if (t > REPLAY.minAir) game.replay.mark("jump", p);
      if (game.onAirLanded) game.onAirLanded(t);
      game.audio.callout();
    }
    if (p.grounded) { p.flipAcc = 0; p.rollAcc = 0; }
  }

  game.rulesStep = (dt) => {
    const p = game.player;
    game.hitFlash = Math.max(0, game.hitFlash - dt * 2.5);
    airCallouts(p, dt);
    // pickups
    if (p.alive) for (const pk of [...game.pickups.list]) {
      if (pk.g.position.distanceToSquared(p.pos) >= 12) continue;
      if (pk.crateId) { game.base.lootCrate(pk); continue; } // server crate: scrap arrives with lootOk
      p.scrap += pk.amount; game.pickups.take(pk); game.audio.pickup();
      game.emit({ type: "minor", text: `+${pk.amount} SCRAP${pk.part ? " · PART SALVAGED" : ""}` });
    }
    lootTimer -= dt;
    if (lootTimer <= 0) {
      lootTimer = 120;
      for (const l of game.world.lootSpots) {
        if (game.pickups.list.some((x) => Math.hypot(x.g.position.x - l.x, x.g.position.z - l.z) < 6)) continue;
        game.pickups.spawn(l.x, game.world.groundAt(l.x, l.z, 999), l.z, rint(ECONOMY.lootPile));
      }
    }
    // town: bank + repair
    if (p.alive && game.inSafeZone(p)) {
      if (p.scrap > 0) {
        game.save.banked += p.scrap; game.save.stats.banked += p.scrap; game.session.banked += p.scrap;
        game.callout("BANKED", `+${p.scrap} scrap`, "#7fe0a0"); game.audio.bank();
        if (game.onBank) game.onBank(p.scrap);
        p.scrap = 0;
        if (!game.noSave) writeSave(game.save);
      }
      p.hull = Math.min(p.maxHull, p.hull + DAMAGE.repairRate * dt);
      p.turbo = Math.min(1, p.turbo + dt * 0.2);
      if (p.hull >= p.maxHull && p.mesh.parts.some((x) => x.detached) && (p.vel.length() < 2 || game.autopilot)) game.rebuildPlayer();
    } else if (p.alive && p.welder && game.time - p.lastCombat > DAMAGE.combatTimeout) p.hull = Math.min(p.maxHull, p.hull + DAMAGE.welderRate * dt);
    // vehicle state effects + wreck cleanup
    for (let i = game.vehicles.length - 1; i >= 0; i--) {
      const v = game.vehicles[i];
      const hood = v.pos.clone().add(new THREE.Vector3(0, 0.6, -v.chassis.hit.half[2] * 0.6).applyQuaternion(v.quat));
      if (v.burn > 0) {
        v.burn -= dt;
        if (Math.random() < 0.5) game.particles.fire(hood.x, hood.y, hood.z, 1.6);
        if (v.alive && v.burnBy) damageVehicle(game, v, 15 * dt, v.pos, v.burnBy, { splash: true });
      }
      if (!v.alive) {
        if (Math.random() < 0.3) game.particles.smoke(hood.x, hood.y + 0.5, hood.z, true, 2);
        if (v !== p) { v.wreckTime -= dt; if (v.wreckTime <= 0) { removeVehicle(game, v); game.vehicles.splice(i, 1); } }
        continue;
      }
      const k = v.hull / v.maxHull;
      if (k < DAMAGE.smokeWhite && Math.random() < (k < DAMAGE.smokeBlack ? 0.5 : 0.25)) game.particles.smoke(hood.x, hood.y, hood.z, k < DAMAGE.smokeBlack, 1);
      if (k < DAMAGE.flames && Math.random() < 0.5) game.particles.fire(hood.x, hood.y, hood.z, 1);
      // smash props
      const sp = v.vel.length();
      if (sp > 3) game.world.props.near(v.pos.x, v.pos.z, v.chassis.hit.half[0] + 0.4, (pr) => {
        game.world.props.kill(pr);
        game.particles.dust(pr.x, pr.y + 0.5, pr.z, v.vel.x, v.vel.z, 1.2);
        game.particles.sparks(pr.x, pr.y + 0.6, pr.z, 4);
        v.vel.multiplyScalar(1 - Math.min(0.15, pr.def.mass / v.mass));
        if (pr.def.explosive) game.combat.explode(new THREE.Vector3(pr.x, pr.y + 0.6, pr.z), DAMAGE.barrelRadius, DAMAGE.barrelDamage, v, 1.1);
      });
      // dust and skid smoke
      if (v.sliding && Math.random() < 0.6) game.particles.dust(v.pos.x, v.pos.y - 0.5, v.pos.z, v.vel.x, v.vel.z, 1.5);
      else if (v.grounded && sp > 18 && Math.random() < 0.2) game.particles.dust(v.pos.x, v.pos.y - 0.6, v.pos.z, v.vel.x, v.vel.z, 1.2);
    }
    // respawns
    if (!p.alive) { game.respawnIn -= dt; if (game.respawnIn <= 0) game.requestRespawn(); } // the spawn screen, or straight back on the road
    if (rattlerDebt > 0) {
      game.rattlerTimer = (game.rattlerTimer ?? AI.respawnDelay) - dt;
      if (game.rattlerTimer <= 0) { rattlerDebt--; game.rattlerTimer = AI.respawnDelay; game.ai.spawn(); }
    }
    game.world.props.update(dt);
    game.pickups.update(dt, game.world);
  };
}