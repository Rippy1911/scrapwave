// Fortress guards (host): Rattler cars of the raider faction that circle outside the walls and fight any
// non-raider car that comes within 110 m. brain.raid = "fort:<id>" keeps the normal AI and the base raids off them.
import * as THREE from "three";
import { driveTo, aimAndFire, holdFire, fightPoint, lineOfSight } from "@/game/ai/steer";
import { poseAt } from "@/game/world/spawn";

const ALERT = 110, LOOP = 36;
const g = new THREE.Vector3();
const raider = (v) => v.team === "rattler" || v.team === "warlord";

export function createFortGuards(game) {
  function spawn(f, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = f.gateA + (i - (n - 1) / 2) * 0.35, x = f.x + Math.sin(a) * (LOOP + 4), z = f.z + Math.cos(a) * (LOOP + 4);
      const v = game.ai.makeRattler(poseAt(game.world, x, z, (a * 180) / Math.PI + 90), null, i === 0 ? "pickup" : null);
      v.brain.raid = `fort:${f.id}`; v.brain.fort = f.id; v.brain.loop = i * 2;
      out.push(v);
    }
    return out;
  }

  function hostileNear(f) {
    let best = null, bd = ALERT;
    for (const v of game.vehicles) {
      if (!v.alive || raider(v) || v.team === "prop" || v.team === "cisterner" || (game.inSafeZone && game.inSafeZone(v))) continue;
      const d = Math.hypot(v.pos.x - f.x, v.pos.z - f.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  function drive(v, f, dt, foe) {
    const b = v.brain;
    if (foe) {
      const d = foe.pos.distanceTo(v.pos);
      driveTo(v, fightPoint(v, foe, d, g), dt);
      aimAndFire(game, v, foe, d, lineOfSight(game, v, foe, d));
      return;
    }
    const a = (b.loop * Math.PI) / 4;
    g.set(f.x + Math.sin(a) * LOOP, v.pos.y, f.z + Math.cos(a) * LOOP);
    if (Math.hypot(v.pos.x - g.x, v.pos.z - g.z) < 9) b.loop = (b.loop + 1) % 8;
    driveTo(v, g, dt, { maxSpeed: 12 });
    holdFire(v, g);
  }

  return {
    spawn,
    step(dt, forts) {
      for (const f of forts) {
        f.guards = f.guards.filter((v) => v.alive && game.vehicles.includes(v));
        const foe = hostileNear(f);
        for (const v of f.guards) if (!v.remote) drive(v, f, dt, foe);
      }
    },
  };
}