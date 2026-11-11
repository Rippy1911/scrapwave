// Militia guard cars (host only, not in arenas): two per militia town. They circle home, ride out to the border
// points where Rattler patrols pass, fight raiders on sight there, and go for the player only when the town is
// Hostile or after the player starts it (relations.js). Wrecked guards come back after a while.
import * as THREE from "three";
import { AI } from "@/game/data/tuning";
import { net } from "@/game/net/net";
import { createVehicle, placeVehicle } from "@/game/vehicles/vehicle";
import { clearAt, surfaceY } from "@/game/world/spawn";
import { createNameTag, setTagSub } from "@/game/vehicles/nametag";
import { newBrain, driveTo, nearestHostile, lineOfSight, aimAndFire, holdFire, fightPoint } from "@/game/ai/steer";
import { MILITIAS } from "@/game/factions/roster";

const PER_TOWN = 2, RESPAWN = 45, ENGAGE = 170, HOLD = 25;
const g = new THREE.Vector3();

export function createMilitia(game) {
  const slots = MILITIAS.flatMap((f) => Array.from({ length: PER_TOWN }, (_, k) => ({ f, k, v: null, at: 0 })));
  let fights = 0;

  function poseNear(x, z, rMin, rMax) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (clearAt(game.world, px, pz, 4, game.vehicles)) return { x: px, y: surfaceY(game.world, px, pz), z: pz, heading: a };
    }
    return { x: x + rMax, y: surfaceY(game.world, x + rMax, z), z, heading: 0 };
  }

  function spawn(s, pose) {
    const { f, k } = s;
    const v = createVehicle(game, k === 0 ? "pickup" : "buggy", { team: "militia", name: `${f.short} Guard`, paint: f.paint, paint2: "#d9d2c0", skill: AI.skills.veteran, plate: `${f.plate}-${10 + k}` });
    v.faction = f.id;
    v.netId = `am-${f.id}-${k}`;
    v.skillName = "Militia";
    v.spreadMul = v.skill.spread / 0.03;
    const p = pose || poseNear(f.home.x, f.home.z, 70, 110);
    placeVehicle(v, p.x, p.y + 1.3, p.z, p.heading);
    v.brain = newBrain({ mode: "guard" });
    createNameTag(game, v, v.name, f.color, true, "MILITIA");
    game.vehicles.push(v);
    s.v = v;
    think(v, f); // destination and target set before the first drive()
    return v;
  }

  // Next patrol goal: a border point, or a lap around home.
  function pickGoal(v, f) {
    const b = v.brain;
    if (Math.random() < 0.6) { const [x, z] = f.border[Math.floor(Math.random() * f.border.length)]; b.dest = { x, z }; b.mode = "border"; }
    else { const a = Math.random() * Math.PI * 2; b.dest = { x: f.home.x + Math.cos(a) * 95, z: f.home.z + Math.sin(a) * 95 }; b.mode = "guard"; }
    b.holdUntil = 0;
  }

  function think(v, f) {
    const b = v.brain;
    b.think = 0.4 * (0.7 + v.skill.react);
    const t = nearestHostile(game, v, ENGAGE);
    b.target = t;
    if (t) { b.dist = t.pos.distanceTo(v.pos); b.los = b.dist < 200 && lineOfSight(game, v, t, b.dist); }
    if (!b.dest) pickGoal(v, f);
    if (game.debug) setTagSub(v, (t ? "FIGHT · " + t.name : b.mode.toUpperCase()));
  }

  function drive(v, f, dt) {
    const b = v.brain, t = b.target;
    if (!b.dest || !Number.isFinite(b.dest.x)) pickGoal(v, f); // never drive toward a missing destination
    if (t && t.alive && t.pos) {
      b.dist = t.pos.distanceTo(v.pos);
      fightPoint(v, t, b.dist, g);
      driveTo(v, g, dt);
      aimAndFire(game, v, t, b.dist, b.los);
      return;
    }
    const d = Math.hypot(b.dest.x - v.pos.x, b.dest.z - v.pos.z);
    if (d < 18) {
      if (!b.holdUntil) b.holdUntil = game.time + HOLD;
      if (game.time > b.holdUntil) pickGoal(v, f);
      Object.assign(v.ctl, { throttle: 0, brake: 1, steer: 0, turbo: false });
      holdFire(v);
      return;
    }
    g.set(b.dest.x, 0, b.dest.z);
    driveTo(v, g, dt, { maxSpeed: 20 });
    holdFire(v, g);
  }

  return {
    update(dt) {
      if (!net.isHost() || game.arena.active) return;
      let n = 0;
      for (const s of slots) {
        const v = s.v;
        if (!v || !v.alive || !game.vehicles.includes(v)) {
          if (v) { s.v = null; s.at = game.time + RESPAWN; }
          // A new host adopts the old host's guard (net/hostSwap.js) instead of spawning a second one.
          const id = `am-${s.f.id}-${s.k}`, own = game.vehicles.find((x) => x.netId === id && !x.remote && x.alive);
          if (own) { s.v = own; own.faction = s.f.id; if (!own.brain) own.brain = newBrain({ mode: "guard" }); think(own, s.f); continue; }
          if (game.time >= s.at) spawn(s);
          continue;
        }
        if (v.remote) continue;
        v.brain.think -= dt;
        if (v.brain.think <= 0) think(v, s.f);
        drive(v, s.f, dt);
        if (v.brain.target && v.brain.target.team !== "player" && v.brain.target.team !== "remote") n++;
      }
      fights = n;
    },
    // Put a guard and a Rattler pair at a border point (test hook): they should start fighting at once.
    skirmish(fid = "well") {
      const f = (slots.find((x) => x.f.id === fid) || slots[0]).f, [bx, bz] = f.border[0];
      const s = { f, k: slots.length, v: null, at: Infinity }; // an extra guard that is not replaced when wrecked
      slots.push(s);
      const gv = spawn(s, poseNear(bx, bz, 4, 12));
      const rs = [0, 1].map(() => game.ai.makeRattler(poseNear(bx, bz, 45, 60), null));
      return { guard: gv.id, rattlers: rs.map((r) => r.id), at: { x: bx, z: bz } };
    },
    list: () => slots.filter((s) => s.v && s.v.alive).map((s) => ({ id: s.v.id, faction: s.f.id, mode: s.v.brain.mode, target: s.v.brain.target ? s.v.brain.target.name : null })),
    fights: () => fights,
    reset() { for (const s of slots) { s.v = null; s.at = 0; } },
  };
}