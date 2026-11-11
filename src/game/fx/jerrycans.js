// Glowing jerry-can pickups: scattered along the roads (respawning) and dropped by some wrecks.
import * as THREE from "three";
import { FUEL } from "@/game/data/tuning";

export function createJerryCans(scene, M) {
  const can = new THREE.BoxGeometry(0.55, 0.7, 0.3);
  const handle = new THREE.BoxGeometry(0.4, 0.08, 0.12);
  const glowGeo = new THREE.CylinderGeometry(0.55, 0.8, 2.6, 10, 1, true);
  const red = M.paint("#c0311c");
  const glowMat = new THREE.MeshBasicMaterial({ color: "#ff6a2a", toneMapped: false, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const list = [];
  let roadT = 0;

  function spawn(x, y, z, o = {}) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(can, red); body.castShadow = true;
    const h = new THREE.Mesh(handle, M.dark); h.position.y = 0.4;
    const glow = new THREE.Mesh(glowGeo, glowMat); glow.position.y = 1;
    g.add(body, h, glow);
    g.position.set(x, y + 0.6, z);
    scene.add(g);
    const c = { g, amount: o.amount || FUEL.jerry, vy: o.drop ? 5 : 0, vx: o.vx || 0, vz: o.vz || 0, t: Math.random() * 6, life: o.drop ? 80 : Infinity, road: !!o.road };
    list.push(c);
    return c;
  }

  // Keep FUEL.jerryCount road cans alive, away from the Well-town (which has pumps).
  function fillRoads(game) {
    const roads = game.world.roads.roads;
    let have = list.filter((c) => c.road).length;
    for (let tries = 0; have < FUEL.jerryCount && tries < 200; tries++) {
      const r = roads[Math.floor(Math.random() * roads.length)], s = r.samples[Math.floor(Math.random() * r.samples.length)];
      if (s.deck || s.bridge || game.inTown(s.x, s.z)) continue;
      if (list.some((c) => Math.hypot(c.g.position.x - s.x, c.g.position.z - s.z) < 60)) continue;
      const side = Math.random() < 0.5 ? 1 : -1, off = r.width * 0.3 * side;
      const x = s.x - s.dz * off, z = s.z + s.dx * off;
      spawn(x, game.world.groundAt(x, z, s.y + 3), z, { road: true });
      have++;
    }
  }

  return {
    list, spawn, fillRoads,
    take(c) { c.g.removeFromParent(); list.splice(list.indexOf(c), 1); },
    update(dt, game) {
      roadT -= dt;
      if (roadT <= 0) { roadT = FUEL.jerryRespawn; fillRoads(game); }
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        c.life -= dt; c.t += dt;
        if (c.life <= 0) { c.g.removeFromParent(); list.splice(i, 1); continue; }
        if (c.vy || c.vx || c.vz) {
          c.vy -= 15 * dt;
          c.g.position.x += c.vx * dt; c.g.position.z += c.vz * dt; c.g.position.y += c.vy * dt;
          const gy = game.world.groundAt(c.g.position.x, c.g.position.z, c.g.position.y + 1) + 0.4;
          if (c.g.position.y < gy) { c.g.position.y = gy; c.vy = 0; c.vx *= 0.85; c.vz *= 0.85; if (Math.abs(c.vx) + Math.abs(c.vz) < 0.1) c.vx = c.vz = 0; }
        }
        c.g.children[0].rotation.y = c.g.children[1].rotation.y = c.t * 1.4;
        c.g.children[2].scale.y = 0.8 + Math.sin(c.t * 4) * 0.2;
      }
    },
  };
}