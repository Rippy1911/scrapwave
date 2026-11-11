// Breakable street furniture that lives inside the instanced chunks: shop-front glass, chain-link fences, lamp posts.
// Each item is one or two instances in a chunk mesh plus a ray-only collider (shots call onHit, like the arena's
// barrels). Cars break whatever they touch above 3 m/s. A broken pane vanishes in a puff of glass; a fence or a
// lamp topples away from the hit and then drops out. Nothing here is solid, so a car is never stopped by a pane.
import * as THREE from "three";

const CELL = 24, FALL = 0.7;
const q = new THREE.Quaternion(), qy = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4(), ax = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
const KINDS = {
  pane: { hp: 8, sound: "glass", sparks: 10, topple: false },
  fence: { hp: 18, sound: "metal", sparks: 5, topple: true },
  lamp: { hp: 45, sound: "glass", sparks: 8, topple: true },
};

export function createSmash(game, chunks, site, coll) {
  const items = [], grid = new Map(), falling = [];
  let broken = 0;
  const key = (x, z) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);
  const meshOf = (chunk, kind) => chunk.meshes.find((m) => m.userData.kind === kind);

  // links: [{ chunk, kind, idx, x, y, z, yaw, sx, sy, sz }] the instances that make this item up (base transform kept).
  function add(o) {
    const it = { ...o, alive: true, hp: KINDS[o.type].hp, box: null };
    it.box = coll.add({ x: site.x + o.x, y: site.y + o.y, z: site.z + o.z, hx: o.hx, hy: o.hy, hz: o.hz, yaw: o.yaw || 0, noCollide: true, tag: "breakable", onHit: (dmg, by, pt) => hurt(it, Math.max(5, dmg), by, pt) });
    items.push(it);
    const k = key(o.x, o.z);
    let l = grid.get(k); if (!l) grid.set(k, (l = []));
    l.push(it);
    return it;
  }
  function hurt(it, dmg, by, from) {
    if (!it.alive) return;
    it.hp -= dmg;
    if (it.hp <= 0) smash(it, by, from);
  }
  function smash(it, by, from) {
    it.alive = false; broken++;
    game.world.colliders.remove(it.box);
    const K = KINDS[it.type], wx = site.x + it.x, wy = site.y + it.y, wz = site.z + it.z;
    game.particles.sparks(wx, wy, wz, K.sparks);
    game.particles.dust(wx, wy, wz, 0, 0, K.topple ? 0.8 : 1.2);
    tmp.set(wx, wy, wz);
    if (!game.audio.sample(K.sound, tmp, 0.8)) game.audio.impact(tmp, 0.5);
    let dx = from ? wx - from.x : Math.random() - 0.5, dz = from ? wz - from.z : Math.random() - 0.5;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (const link of it.links) {
      if (K.topple) falling.push({ link, t: 0, dx, dz });
      else write(link, 0, 0, 0, true); // glass: gone
    }
    if (by === game.player && game.arena && game.arena.active) game.arena.onSmash(it);
  }
  // Writes a link's matrix: the base transform tipped by `ang` about the horizontal axis (dz, 0, -dx), or hidden.
  function write(link, ang, dx, dz, hide) {
    const mesh = meshOf(link.chunk, link.kind);
    if (!mesh) return;
    if (hide) m4.makeScale(0, 0, 0);
    else {
      ax.set(dz, 0, -dx);
      q.setFromAxisAngle(ax, ang); qy.setFromAxisAngle(Y, link.yaw); q.multiply(qy);
      m4.compose(pos.set(link.x, link.y, link.z), q, sc.set(link.sx, link.sy, link.sz));
    }
    mesh.setMatrixAt(link.idx, m4);
    mesh.instanceMatrix.needsUpdate = true;
  }

  function step(dt) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.t += dt;
      if (f.t >= FALL) { write(f.link, 0, 0, 0, true); falling.splice(i, 1); continue; }
      const k = f.t / FALL;
      write(f.link, k * k * 1.45, f.dx, f.dz, false);
    }
    for (const v of game.vehicles) {
      if (!v.alive || v.remote || v.vel.lengthSq() < 9) continue;
      const vx = v.pos.x - site.x, vz = v.pos.z - site.z, vy = v.pos.y - site.y, reach = v.chassis.hit.half[0] + 0.5;
      if (Math.abs(vx) > 720 || Math.abs(vz) > 720) continue;
      const cx = Math.floor(vx / CELL), cz = Math.floor(vz / CELL);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const l = grid.get((cx + a) * 4096 + cz + b);
        if (!l) continue;
        for (const it of l) {
          if (!it.alive || Math.abs(it.y - vy) > 4) continue;
          if ((it.x - vx) ** 2 + (it.z - vz) ** 2 > (reach + it.r) ** 2) continue;
          smash(it, v, v.pos);
          v.vel.multiplyScalar(it.type === "pane" ? 0.99 : 0.97);
        }
      }
    }
  }
  return { add, step, count: () => ({ items: items.length, alive: items.filter((i) => i.alive).length, broken }), items: () => items };
}
