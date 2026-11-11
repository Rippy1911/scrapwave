// Arena opponents: 6-8 AI cars in mixed models that hunt the player and each other (Drifter team, so everyone
// is fair game), using the shared AI driving (driveTo, fightPoint, aimAndFire). With no car close they chase
// the horde, else cruise the bowl. Wrecked ones come back after 6 s unless the win is "wreck everyone".
// Gunnery matches the open world: the Rattler skill mix (55 % rookie, 36 % veteran, 9 % ace, shifted by the
// rules' AI skill), the same think rate, spread and per-target reaction delay (ai/aim.js).
import * as THREE from "three";
import { AI } from "@/game/data/tuning";
import { LOADOUTS } from "@/game/data/vehicles";
import { createVehicle, placeVehicle, wreckVehicle } from "@/game/vehicles/vehicle";
import { createNameTag } from "@/game/vehicles/nametag";
import { newBrain, driveTo, nearestHostile, lineOfSight, aimAndFire, holdFire, fightPoint } from "@/game/ai/steer";
import { skillAt } from "@/game/rules/apply";

const MODELS = ["buggy", "jackal", "pickup", "brawler", "jackal", "buggy", "mammoth", "pickup"];
const NAMES = ["Rivet Kane", "Dust Moll", "Gearjaw", "Silt Annie", "Hob Nails", "Krank", "Ash Vesna", "Tallow"];
const PAINTS = [["#8c3b55", "#e3d6bd"], ["#2f7a74", "#2c2a28"], ["#d9b23a", "#2c2a28"], ["#3f5f6e", "#d9b23a"], ["#b23a1f", "#e3d6bd"], ["#5e6b3a", "#c7762e"], ["#7d8a80", "#b23a1f"], ["#c7762e", "#3f5f6e"]];
const TIER_POS = { rookie: 0, veteran: 0.5, ace: 1 };
const MAX_HUNTERS = 2;
const g = new THREE.Vector3();

// Same roll as a Rattler (ai/ai.js makeRattler), then the rules' AI skill shifts it like ruleSys does in the open world.
function pickSkill(k) {
  const R = Math.random;
  const name = R() < 0.55 ? "rookie" : R() < 0.8 ? "veteran" : "ace";
  const skill = k === undefined || k === 0.5 ? AI.skills[name] : skillAt(Math.max(0, Math.min(1, TIER_POS[name] + k - 0.5)));
  return { name, skill };
}

export function createOpponents(game) {
  let slots = [], ctx = null;

  function spawnSlot(s) {
    const pose = (ctx.race && ctx.race.back(s.i)) || ctx.pose(s.i + 1); // a racer comes back at its last ring
    const id = MODELS[s.i % MODELS.length], [paint, paint2] = PAINTS[s.i % PAINTS.length];
    const { name: skillName, skill } = pickSkill(ctx.skill);
    const v = createVehicle(game, id, { team: "drifter", name: NAMES[s.i % NAMES.length], paint, paint2, loadout: { ...LOADOUTS[id] }, skill, plate: "AR-" + (11 + s.i) });
    v.arena = true; v.slotI = s.i; v.skillName = skillName; v.spreadMul = skill.spread / 0.03; v.fuelInit = true;
    placeVehicle(v, pose.x, pose.y + 1.4, pose.z, pose.heading);
    v.brain = newBrain({ roam: null });
    createNameTag(game, v, v.name, "#ff9a5a", true, "ARENA");
    game.vehicles.push(v);
    s.v = v; s.deadAt = 0;
    if (ctx.race && ctx.race.join) ctx.race.join(s.i, v);
    think(v); // a target or a roam point before the first drive()
  }

  function start(n, c) {
    ctx = c;
    slots = Array.from({ length: n }, (_, i) => ({ i, v: null, deadAt: 0 }));
    slots.forEach(spawnSlot);
  }

  function think(v) {
    const b = v.brain;
    b.think = (1 / AI.thinkHz) * (0.7 + v.skill.react);
    // At most two opponents hunt the same car (counting this one if it already does), so they spread out.
    const hunters = (t) => slots.filter((s) => s.v && s.v !== v && s.v.alive && s.v.brain && s.v.brain.target === t).length;
    b.target = nearestHostile(game, v, 170, (t) => (t.arena || t === game.player) && hunters(t) < MAX_HUNTERS);
    b.dist = b.target ? b.target.pos.distanceTo(v.pos) : 9999;
    b.los = !!b.target && b.dist < 160 && lineOfSight(game, v, b.target, b.dist);
    b.prey = !b.target || b.dist > 60 ? game.horde.nearest(v.pos, 70) : null;
    if (!b.roam || Math.hypot(b.roam.x - v.pos.x, b.roam.z - v.pos.z) < 10) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * Math.max(5, ctx.R - 25);
      b.roam = { x: ctx.site.x + Math.sin(a) * r, z: ctx.site.z + Math.cos(a) * r };
    }
  }

  function drive(v, dt) {
    const b = v.brain;
    b.think -= dt;
    if (b.think <= 0) think(v);
    const t = b.target;
    if (ctx.race) { // Wreck Race: head for the next ring, shoot whoever is close and in sight
      if (ctx.race.tracked) { // a race world: the track tools steer (race/trackTools.js), this car only shoots
        if (t && t.alive && b.los && b.dist < 60) aimAndFire(game, v, t, b.dist, b.los); else holdFire(v);
        return;
      }
      const c = ctx.race.goal(v.slotI);
      g.set(c.x, v.pos.y, c.z);
      const ang = driveTo(v, g, dt, { stuckTime: 1.2 });
      v.ctl.turbo = Math.abs(ang) < 0.2 && Math.random() < v.skill.turbo * 0.3;
      if (t && t.alive && b.los && b.dist < 60) aimAndFire(game, v, t, b.dist, b.los); else holdFire(v, g);
      return;
    }
    if (t && t.alive) {
      const ang = driveTo(v, fightPoint(v, t, b.dist, g), dt);
      v.ctl.turbo = Math.abs(ang) < 0.25 && b.dist > 40 && Math.random() < v.skill.turbo * 0.2;
      aimAndFire(game, v, t, b.dist, b.los);
      return;
    }
    const goal = b.prey || b.roam;
    if (!goal) { holdFire(v); return; } // nothing to do until the next think
    g.set(goal.x, v.pos.y, goal.z);
    driveTo(v, g, dt, { maxSpeed: b.prey ? 26 : 18 });
    holdFire(v, g);
  }

  function step(dt, respawn) {
    for (const s of slots) {
      const v = s.v;
      if (v && v.alive) {
        drive(v, dt);
        if (Math.hypot(v.pos.x - ctx.site.x, v.pos.z - ctx.site.z) > ctx.R + 6 || v.pos.y < ctx.floorY - 8) wreckVehicle(game, v, null); // out of the arena somehow
        continue;
      }
      if (!respawn) continue;
      if (!s.deadAt) s.deadAt = game.time;
      if (game.time - s.deadAt > 6) spawnSlot(s);
    }
  }

  return {
    start, step,
    alive: () => slots.filter((s) => s.v && s.v.alive).length,
    total: () => slots.length,
    cars: () => slots.map((s) => ({ i: s.i, v: s.v })),
    list: () => slots.filter((s) => s.v).map((s) => ({ id: s.v.id, name: s.v.name, skill: s.v.skillName, alive: s.v.alive, react: s.v.aimSt ? +s.v.aimSt.react.toFixed(2) : null, target: s.v.brain && s.v.brain.target ? s.v.brain.target.id : null })),
    clear() { slots = []; },
  };
}