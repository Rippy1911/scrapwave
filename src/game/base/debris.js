// Structure debris: a broken piece falls apart into chunks of its own material (one instanced mesh per material,
// so hundreds of chunks cost four draw calls). Chunks tumble, land on the ground or on other pieces, and cars
// shove them aside. They fade after a while; the oldest are recycled when the pool is full.
import * as THREE from "three";
import { MATERIAL_IDS } from "@/game/base/materials";
import { pieceMaterial } from "@/game/base/pieceLook";

const CAP = 90, LIFE = 45;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();

export function createDebris(game) {
  const pools = {};
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (const id of MATERIAL_IDS) {
    const mesh = new THREE.InstancedMesh(geo, pieceMaterial(id, 1), CAP);
    mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    game.scene.add(mesh);
    pools[id] = { mesh, list: [] };
  }
  const ground = (x, z, y) => Math.max(game.world.terrain.heightAt(x, z), game.world.groundAt(x, z, y));

  function add(mat, x, y, z, sx, sy, sz, vx, vy, vz) {
    const pool = pools[mat] || pools.wood;
    if (pool.list.length >= CAP) pool.list.shift();
    pool.list.push({ x, y, z, vx, vy, vz, sx, sy, sz, rx: Math.random() * 6, ry: Math.random() * 6, rz: 0, spin: 2 + Math.random() * 6, life: LIFE * (0.7 + Math.random() * 0.3), rest: false });
  }

  // from: the hit point (chunks fly away from it). Count and size follow the piece's volume.
  function burst(pc, from = null) {
    const [w, h, d] = pc.size, n = Math.max(4, Math.min(12, Math.round(w * h * d * 0.7)));
    const k = pc.mat === "wood" ? 0.7 : pc.mat === "sheet" ? 0.8 : 1;
    for (let i = 0; i < n; i++) {
      const x = pc.wx + (Math.random() - 0.5) * pc.fw, y = pc.y0 + Math.random() * h, z = pc.wz + (Math.random() - 0.5) * pc.fd;
      const ox = from ? x - from.x : Math.random() - 0.5, oz = from ? z - from.z : Math.random() - 0.5, L = Math.hypot(ox, oz) || 1;
      const sp = 3 + Math.random() * 6, sz = (0.35 + Math.random() * 0.6) * k;
      add(pc.mat, x, y, z, sz * (pc.mat === "sheet" ? 1.8 : 1.2), sz * (pc.mat === "sheet" ? 0.12 : 0.7), sz, (ox / L) * sp, 2 + Math.random() * 5, (oz / L) * sp);
    }
  }

  function push(c) {
    for (const v of game.vehicles) {
      if (!v.alive || v.air) continue;
      const dx = c.x - v.pos.x, dz = c.z - v.pos.z, r = 2.4 + c.sx * 0.5;
      if (dx * dx + dz * dz > r * r || c.y > v.pos.y + 1.6) continue;
      const L = Math.hypot(dx, dz) || 1, sp = Math.hypot(v.vel.x, v.vel.z);
      c.vx = v.vel.x * 1.1 + (dx / L) * (2 + sp * 0.3); c.vz = v.vel.z * 1.1 + (dz / L) * (2 + sp * 0.3);
      c.vy = Math.max(c.vy, sp > 8 ? 2 + Math.random() * 2 : 0.5);
      c.rest = false; c.spin = 3 + sp * 0.3;
    }
  }

  function update(dt) {
    for (const id in pools) {
      const pool = pools[id], list = pool.list;
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        c.life -= dt;
        if (c.life <= 0) { list.splice(i, 1); continue; }
        push(c);
        if (!c.rest) {
          c.vy -= 18 * dt;
          c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
          c.rx += c.spin * dt; c.rz += c.spin * 0.6 * dt;
          const g = ground(c.x, c.z, c.y + 0.5) + c.sy / 2;
          if (c.y < g) {
            c.y = g; c.vy = c.vy < -3 ? -c.vy * 0.25 : 0;
            c.vx *= 0.55; c.vz *= 0.55; c.spin *= 0.5;
            if (Math.hypot(c.vx, c.vz) < 0.3 && c.vy === 0) c.rest = true;
          }
        }
      }
      for (let i = 0; i < list.length; i++) {
        const c = list[i], fade = Math.min(1, c.life / 2);
        m4.compose(p.set(c.x, c.y, c.z), q.setFromEuler(e.set(c.rx, c.ry, c.rz)), s.set(c.sx * fade, c.sy * fade, c.sz * fade));
        pool.mesh.setMatrixAt(i, m4);
      }
      pool.mesh.count = list.length;
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  const count = () => MATERIAL_IDS.reduce((n, id) => n + pools[id].list.length, 0);
  const clear = () => { for (const id in pools) pools[id].list.length = 0; };
  return { burst, update, count, clear };
}