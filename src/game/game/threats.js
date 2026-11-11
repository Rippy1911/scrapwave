// Telegraphs for the HUD: who is aiming at you (screen-edge arrows) and incoming rocket locks.
import * as THREE from "three";

const v3 = new THREE.Vector3();

export function threats(game) {
  const p = game.player, cam = game.camera, arrows = [];
  if (!p.alive) return { arrows, lockedOn: false };
  for (const v of game.vehicles) {
    if (!v.alive || v === p || v.lockTarget !== p || !v.aiming) continue;
    const d = v.pos.distanceTo(p.pos);
    if (d > 200) continue;
    v3.copy(v.pos).project(cam);
    let x = v3.x, y = v3.y;
    const behind = v3.z > 1;
    if (behind) { x = -x; y = -y; }
    const on = !behind && Math.abs(x) < 0.9 && Math.abs(y) < 0.85;
    arrows.push({ id: v.id, a: Math.atan2(-y, x), on, x, y, d: Math.round(d) });
  }
  const rocketIn = game.combat.projectiles.some((pr) => pr.kind === "rocket" && pr.target === p && pr.pos.distanceTo(p.pos) < 200);
  const salvo = game.vehicles.some((v) => v.alive && v !== p && v.lockTarget === p && v.weapons.some((w) => w.salvo > 0));
  return { arrows: arrows.slice(0, 6), lockedOn: rocketIn || salvo };
}