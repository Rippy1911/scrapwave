// AI Bulwark raid / horde boss: slow, long-range gunnery (uses ai/steer.js — does not change avoid.js).
import * as THREE from "three";
import { AI } from "@/game/data/tuning";
import { LOADOUTS } from "@/game/data/vehicles";
import { createVehicle, placeVehicle } from "@/game/vehicles/vehicle";
import { createNameTag } from "@/game/vehicles/nametag";
import { newBrain, driveTo, aimAndFire, holdFire, fightPoint, lineOfSight } from "@/game/ai/steer";
import { fitTank } from "@/game/vehicles/tank";
import { tierWeapon } from "@/game/workshop/tiers";

const g = new THREE.Vector3();

export function spawnBulwarkBoss(game, pose, o = {}) {
  const skill = AI.skills.veteran;
  const v = createVehicle(game, "bulwark", {
    team: o.team || "rattler",
    name: o.name || "Iron Maw",
    paint: o.paint || "#3f5f6e",
    paint2: "#2c2a28",
    loadout: { ...LOADOUTS.bulwark },
    skill,
    plate: o.plate || "IRN-01",
    hull: 2800,
  });
  v.skillName = "veteran";
  v.spreadMul = skill.spread / 0.03;
  for (const w of v.weapons) {
    w.tier = 2;
    w.def = tierWeapon(w.id, 2);
  }
  fitTank(v, { traverseTier: 2, engineTier: 2, tyreTier: 2, hullTier: 2 });
  placeVehicle(v, pose.x, pose.y + 1.4, pose.z, pose.heading ?? 0);
  v.brain = newBrain({ mode: o.mode || "bulwark", standoff: 55, engage: 130 });
  v.boss = true;
  createNameTag(game, v, v.name, "#8a9aa8", true, o.tag || "BOSS");
  game.vehicles.push(v);
  return v;
}

export function bulwarkBossDrive(game, v, dt) {
  const b = v.brain;
  if (!b || b.mode !== "bulwark") return false;
  b.think = (b.think || 0) - dt;
  if (b.think <= 0) {
    b.think = 1 / AI.thinkHz;
    const t = game.player;
    b.target = t && t.alive ? t : null;
    b.dist = b.target ? b.target.pos.distanceTo(v.pos) : 9999;
    b.los = !!b.target && b.dist < b.engage && lineOfSight(game, v, b.target, b.dist);
  }
  const t = b.target;
  if (!t || !t.alive) {
    holdFire(v);
    return true;
  }
  if (b.dist > b.standoff + 12) {
    g.copy(t.pos);
    driveTo(v, g, dt, { stuckTime: 2.5, throttleCap: 0.55 });
  } else if (b.dist < b.standoff - 8) {
    g.subVectors(v.pos, t.pos).setY(0).add(v.pos);
    driveTo(v, g, dt, { throttleCap: 0.45 });
  } else fightPoint(v, t, b.dist, g);
  if (b.los && b.dist < b.engage) aimAndFire(game, v, t, b.dist, b.los);
  else holdFire(v);
  return true;
}
