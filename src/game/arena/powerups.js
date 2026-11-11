// Power-up crates: floating, spinning crates on the map's power points. Drive through one (any car) to take
// its effect (see status.js); AI cars only roll the effects they can use. A taken crate returns after 15 s.
import * as THREE from "three";
import { EFFECTS } from "@/game/arena/status";

const ALL = Object.keys(EFFECTS), AI_OK = ALL.filter((k) => EFFECTS[k].ai);
const crateGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3), glowGeo = new THREE.OctahedronGeometry(0.5, 0);

export function createPowerups(game) {
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color("#f2c230").multiplyScalar(3) });
  let crates = [], t = 0;

  function start(points) {
    clear();
    crates = points.map((p) => {
      const g = new THREE.Group();
      const box = new THREE.Mesh(crateGeo, game.M.hazard); box.castShadow = true;
      const gem = new THREE.Mesh(glowGeo, glow); gem.position.y = 1.3;
      g.add(box, gem);
      g.position.set(p.x, p.y + 1.1, p.z);
      game.scene.add(g);
      return { ...p, g, gem, back: 0 };
    });
  }

  function step(dt) {
    for (const c of crates) {
      if (c.back > 0) { c.back -= dt; if (c.back <= 0) c.g.visible = true; continue; }
      for (const v of game.vehicles) {
        if (!v.alive || v.remote || (v !== game.player && !v.arena)) continue;
        if ((v.pos.x - c.x) ** 2 + (v.pos.z - c.z) ** 2 > 9 || Math.abs(v.pos.y - c.y - 1) > 3) continue;
        const pool = v === game.player ? ALL : AI_OK;
        game.arena.status.give(v, pool[Math.floor(Math.random() * pool.length)]);
        game.particles.sparks(c.x, c.y + 1.2, c.z, 14);
        c.g.visible = false; c.back = 15;
        break;
      }
    }
  }
  function frame(dt) {
    t += dt;
    for (const c of crates) { c.g.rotation.y = t * 1.4; c.g.position.y = c.y + 1.1 + Math.sin(t * 2.2 + c.x) * 0.2; c.gem.rotation.y = -t * 3; }
  }
  function clear() { for (const c of crates) c.g.removeFromParent(); crates = []; }
  return { start, step, frame, clear };
}