// Arena breakables: fences, fuel barrels, crates, signs and light poles. Cars smash them (above 3 m/s), shots
// break them (a ray-only collider calls onHit), blasts flatten them; barrels explode. Broken ones topple and vanish.
import * as THREE from "three";
import { DAMAGE } from "@/game/data/tuning";

const KINDS = {
  fence: { sound: "wood", r: 1.6, hp: 30, half: [1.5, 0.65, 0.15] },
  barrel: { sound: "metal", r: 0.65, hp: 20, half: [0.42, 0.6, 0.42], explosive: true },
  crate: { sound: "wood", r: 0.85, hp: 40, half: [0.6, 0.6, 0.6] },
  sign: { sound: "metal", r: 0.6, hp: 25, half: [0.55, 1.3, 0.1] },
  pole: { sound: "glass", r: 0.45, hp: 60, half: [0.15, 3.5, 0.15] },
  front: { sound: "glass", r: 2.3, hp: 25, half: [2.4, 1.6, 0.12] }, // a shop front: a 4.8 m pane of glass in a frame
};

function makeMeshes(M) {
  const g = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
  return {
    fence: () => [g(new THREE.BoxGeometry(3, 1.1, 0.1), M.wood, 0, 0.75, 0), g(new THREE.BoxGeometry(0.14, 1.4, 0.14), M.wood, -1.45, 0.7, 0), g(new THREE.BoxGeometry(0.14, 1.4, 0.14), M.wood, 1.45, 0.7, 0)],
    barrel: () => [g(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 12), M.paint("#b8261a"), 0, 0.6, 0)],
    crate: () => [g(new THREE.BoxGeometry(1.2, 1.2, 1.2), M.wood, 0, 0.6, 0)],
    sign: () => [g(new THREE.BoxGeometry(0.1, 2.6, 0.1), M.dark, 0, 1.3, 0), g(new THREE.BoxGeometry(1.1, 0.7, 0.05), M.hazard, 0, 2.3, 0.08)],
    front: () => [g(new THREE.BoxGeometry(4.6, 3, 0.08), M.glass, 0, 1.6, 0), g(new THREE.BoxGeometry(4.8, 0.2, 0.2), M.dark, 0, 3.2, 0), g(new THREE.BoxGeometry(0.2, 3.2, 0.2), M.dark, -2.4, 1.6, 0), g(new THREE.BoxGeometry(0.2, 3.2, 0.2), M.dark, 2.4, 1.6, 0)],
    pole: () => [g(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), M.dark, 0, 3.5, 0), g(new THREE.BoxGeometry(1.6, 0.12, 0.12), M.dark, 0.7, 6.9, 0), g(new THREE.BoxGeometry(0.5, 0.18, 0.3), M.lamp, 1.4, 6.8, 0)],
  };
}

export function createBreakables(game) {
  const make = makeMeshes(game.M);
  let list = [];
  const tmp = new THREE.Vector3();

  function spawn(points) {
    clear();
    list = points.map((p) => {
      const def = KINDS[p.kind], root = new THREE.Group();
      for (const m of make[p.kind]()) root.add(m);
      root.position.set(p.x, p.y, p.z); root.rotation.y = p.ry || 0;
      game.scene.add(root);
      const b = { ...p, def, root, hp: def.hp, alive: true, fall: 0, dir: new THREE.Vector3() };
      b.box = game.world.colliders.add({ x: p.x, y: p.y + def.half[1], z: p.z, hx: def.half[0], hy: def.half[1], hz: def.half[2], yaw: p.ry || 0, noCollide: true, tag: "breakable", onHit: (dmg, by, pt) => hit(b, dmg, by, pt) });
      return b;
    });
  }

  function brk(b, by, from) {
    if (!b.alive) return;
    b.alive = false;
    game.world.colliders.remove(b.box);
    b.dir.subVectors(tmp.set(b.x, b.y, b.z), from || tmp).setY(0);
    if (b.dir.lengthSq() < 1e-4) b.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    b.dir.normalize();
    game.particles.dust(b.x, b.y + 0.6, b.z, b.dir.x * 4, b.dir.z * 4, 1.4);
    game.particles.sparks(b.x, b.y + 0.8, b.z, 6);
    if (!game.audio.sample(b.def.sound, tmp.set(b.x, b.y, b.z), 0.8)) game.audio.impact(tmp, 0.5); // wood, metal or glass (lamp poles)
    if (b.def.explosive) { b.root.visible = false; game.combat.explode(new THREE.Vector3(b.x, b.y + 0.6, b.z), DAMAGE.barrelRadius, DAMAGE.barrelDamage, by || null, 1.1); }
    if (by === game.player && game.arena) game.arena.onSmash(b);
  }
  function hit(b, dmg, by, pt) { b.hp -= Math.max(5, dmg); if (b.hp <= 0) brk(b, by, pt); }

  function step(dt) {
    for (const v of game.vehicles) {
      if (!v.alive || v.remote) continue;
      const sp = v.vel.length();
      if (sp < 3) continue;
      const reach = v.chassis.hit.half[0] + 0.4;
      for (const b of list) {
        if (!b.alive || Math.abs(b.y - v.pos.y) > 4) continue;
        if ((b.x - v.pos.x) ** 2 + (b.z - v.pos.z) ** 2 > (reach + b.def.r) ** 2) continue;
        brk(b, v, v.pos);
        v.vel.multiplyScalar(0.97);
      }
    }
    for (const b of list) {
      if (b.alive || !b.root.visible) continue;
      b.fall += dt;
      const k = Math.min(1, b.fall / 0.7);
      b.root.rotation.set(b.dir.z * k * 1.5, b.ry || 0, -b.dir.x * k * 1.5, "YXZ");
      b.root.position.y = b.y - k * 0.2;
      if (b.fall > 1.6) b.root.visible = false;
    }
  }

  function blast(pos, radius, attacker) {
    for (const b of list) if (b.alive && Math.hypot(b.x - pos.x, b.z - pos.z) < radius + b.def.r && Math.abs(b.y - pos.y) < radius) brk(b, attacker, pos);
  }

  function clear() {
    for (const b of list) {
      if (b.alive) game.world.colliders.remove(b.box);
      b.root.removeFromParent();
      b.root.traverse((m) => m.geometry && m.geometry.dispose());
    }
    list = [];
  }

  return { spawn, step, blast, clear, count: () => list.filter((b) => b.alive).length, list: () => list };
}