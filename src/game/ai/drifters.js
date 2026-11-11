// Drifters: ten named AI players. Keeps them alive (respawning at the map edge), runs their brains (host only),
// lets them loot and bank, assigns cargo hunters and payback grudges, and keeps scoreboard stats.
import { AI, DAMAGE, FLOW } from "@/game/data/tuning";
import { DRIFTERS, DRIFTER_AI as K, TIER_NAME, TIER_COLOR } from "@/game/data/drifters";
import { createVehicle, placeVehicle } from "@/game/vehicles/vehicle";
import { edgeRoadSpawn, clearAt, surfaceY } from "@/game/world/spawn";
import { newBrain } from "@/game/ai/steer";
import { agentThink, agentDrive } from "@/game/ai/agent";
import { createNameTag, setPayback } from "@/game/vehicles/nametag";
import { createSeats } from "@/game/ai/seats";

export function createDrifters(game) {
  const roster = DRIFTERS.map((d, i) => ({ ...d, id: i, wrecks: 0, banked: 0, deaths: 0, v: null, respawnAt: 0, payback: false }));
  let hunterT = 0;
  const seats = createSeats(game, roster);

  function spawnOne(e, pose) {
    const skill = AI.skills[e.skill];
    const v = createVehicle(game, e.chassis, { team: "drifter", name: e.name, paint: e.paint, paint2: e.paint2, loadout: { ...e.loadout }, skill, plate: "DR-" + (10 + e.id) });
    v.skillName = TIER_NAME[e.skill];
    v.spreadMul = skill.spread / 0.03;
    v.entry = e;
    v.netId = "adr" + e.id; // stable AI id: owns its plot and wallet across respawns
    placeVehicle(v, pose.x, pose.y + 1.4, pose.z, pose.heading);
    v.brain = newBrain({ brawly: Math.random() < K.drifterFightChance, payback: e.payback, paybackUntil: game.time + K.paybackTime });
    createNameTag(game, v, e.name, TIER_COLOR[e.skill], true, TIER_NAME[e.skill]);
    setPayback(v, e.payback);
    game.vehicles.push(v);
    e.v = v;
    return v;
  }

  // Initial spread: random road points away from the player and out of town.
  function scatterPose() {
    const roads = game.world.roads.roads, p = game.player;
    for (let i = 0; i < 80; i++) {
      const r = roads[Math.floor(Math.random() * roads.length)], s = r.samples[Math.floor(Math.random() * r.samples.length)];
      if (s.deck || s.bridge || game.inTown(s.x, s.z)) continue;
      if (p && Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < 200) continue;
      if (!clearAt(game.world, s.x, s.z, 8, game.vehicles)) continue;
      return { x: s.x, y: surfaceY(game.world, s.x, s.z), z: s.z, heading: Math.atan2(-s.dx, -s.dz) + (Math.random() < 0.5 ? Math.PI : 0) };
    }
    return edgeRoadSpawn(game.world, p && p.pos, game.vehicles);
  }

  function populate(n = K.keepAlive) { for (const e of roster.slice(0, n)) spawnOne(e, scatterPose()); }

  function onWreck(v, attacker) {
    if (attacker && attacker.entry) attacker.entry.wrecks++;
    if (v === game.player && attacker && attacker.entry) {
      attacker.entry.payback = false;
      if (attacker.brain) attacker.brain.payback = false;
      setPayback(attacker, false);
    }
    if (!v.entry) return;
    const e = v.entry;
    e.deaths++; e.v = null;
    e.payback = attacker === game.player;
    e.respawnAt = game.time + K.respawnDelay[0] + Math.random() * (K.respawnDelay[1] - K.respawnDelay[0]);
  }

  function assignHunters() {
    const p = game.player;
    const carrying = p.alive && p.scrap > 0 && !game.inSafeZone(p);
    const near = roster.filter((e) => e.v && e.v.alive).map((e) => e.v)
      .filter((v) => carrying && v.pos.distanceTo(p.pos) < FLOW.huntCargoRange)
      .sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos)).slice(0, FLOW.maxHunters);
    for (const e of roster) if (e.v && e.v.brain) e.v.brain.hunting = near.includes(e.v);
  }

  function update(dt) {
    for (const e of roster) if (!e.v && game.time >= e.respawnAt && e.respawnAt > 0) spawnOne(e, edgeRoadSpawn(game.world, game.player.pos, game.vehicles));
    seats.update(dt);
    hunterT -= dt;
    if (hunterT <= 0) { hunterT = 2; assignHunters(); }
    for (const e of roster) {
      const v = e.v;
      if (!v || !v.alive) continue;
      const b = v.brain;
      if (e.leaving) seats.stepLeaving(e, dt);
      else if (!(b.raid && game.base && game.base.raids.drive(v, dt))) {
        b.think -= dt;
        if (b.think <= 0 || !b.primed) { b.primed = true; agentThink(game, v); } // first think before the first drive
        agentDrive(game, v, dt);
      }
      for (const pk of [...game.pickups.list]) if (!pk.crateId && pk.g.position.distanceToSquared(v.pos) < 14) { v.scrap += pk.amount; game.pickups.take(pk); }
      if (game.inTown(v.pos.x, v.pos.z)) {
        if (v.scrap > 0) { e.banked += v.scrap; game.onAiBank?.(v, e, v.scrap); v.scrap = 0; }
        if (v.siphoned > 0) { e.banked += v.siphoned; v.siphoned = 0; }
        v.hull = Math.min(v.maxHull, v.hull + DAMAGE.repairRate * dt);
      }
    }
  }

  return { roster, populate, update, onWreck, spawnOne, seats: seats.state };
}