// The arena horde: shambling zombies or grey aliens (instanced figures) that rise from the horde points, walk
// at the nearest car and claw at it. Cars kill them by driving through (over 4 m/s), shots and blasts do too;
// every kill bursts into goo chunks and leaves a fading splat. "Clear the horde" = kill the whole wave.
import * as THREE from "three";
import { applyDamage } from "@/game/net/damage";
import { createHordeModels, variantFor } from "@/game/arena/hordeModels";

const KINDS = {
  zombies: { body: "#5f6b45", head: "#8a9a62", goo: "#6f8f2a", speed: 2.2, dps: 6, bodyH: 1.15, headR: 0.24 },
  aliens: { body: "#9aa0a6", head: "#c3c8cc", goo: "#5fe0b0", speed: 3.4, dps: 8, bodyH: 0.95, headR: 0.36 },
};
const MAX = 70, CHUNKS = 360, SPLATS = 40;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();

export function createHorde(game) {
  const scene = game.scene;
  const bodyGeo = new THREE.BoxGeometry(0.5, 1, 0.32).translate(0, 0.5, 0), headGeo = new THREE.SphereGeometry(1, 10, 8);
  const mats = {};
  for (const k in KINDS) mats[k] = { body: new THREE.MeshStandardMaterial({ color: KINDS[k].body, roughness: 0.9 }), head: new THREE.MeshStandardMaterial({ color: KINDS[k].head, roughness: 0.7 }), goo: new THREE.MeshBasicMaterial({ color: KINDS[k].goo }) };
  const bodies = new THREE.InstancedMesh(bodyGeo, mats.zombies.body, MAX), heads = new THREE.InstancedMesh(headGeo, mats.zombies.head, MAX);
  const chunks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mats.zombies.goo, CHUNKS);
  const splatGeo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
  for (const m of [bodies, heads, chunks]) { m.count = 0; m.frustumCulled = false; m.castShadow = m !== chunks; scene.add(m); }
  const splats = Array.from({ length: SPLATS }, () => { const m = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ color: "#6f8f2a", transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.visible = false; scene.add(m); return { m, t: 0 }; });
  let kind = null, K = null, list = [], bits = [], spots = [], left = 0, cap = 0, spawnT = 0, splatI = 0, kills = 0;

  // Round 14: hosted animated models near the camera; the built figures above are the far LOD and the fallback.
  const models = createHordeModels(scene);
  const voice = () => (kind === "aliens" ? "alien" : "zombie_groan");
  let groanT = 3;

  function start(k, density, points) {
    clear();
    if (k === "off" || !KINDS[k]) return;
    kind = k; K = KINDS[k]; spots = points;
    models.load(k);
    bodies.material = mats[k].body; heads.material = mats[k].head; chunks.material = mats[k].goo;
    for (const sp of splats) sp.m.material.color.set(K.goo);
    left = Math.round(20 + density * 60); cap = Math.round(14 + density * 46);
  }
  function rise() {
    const sp = spots[Math.floor(Math.random() * spots.length)];
    const x = sp.x + (Math.random() - 0.5) * 6, z = sp.z + (Math.random() - 0.5) * 6;
    list.push({ x, z, y: game.world.groundAt(x, z, sp.y + 2), yaw: Math.random() * 6.28, think: 0, target: null, wander: Math.random() * 6.28, t: Math.random() * 10, rise: 0, claw: 0, va: variantFor(kind, Math.random()) });
    left--;
  }

  function kill(f, by) {
    const i = list.indexOf(f);
    if (i < 0) return;
    list.splice(i, 1);
    models.release(f);
    kills++;
    for (let n = 0; n < 12 && bits.length < CHUNKS; n++) bits.push({ x: f.x, y: f.y + 0.9, z: f.z, vx: (Math.random() - 0.5) * 8, vy: 3 + Math.random() * 5, vz: (Math.random() - 0.5) * 8, life: 1 + Math.random() * 0.6, gy: f.y });
    const sp = splats[splatI++ % SPLATS];
    sp.m.position.set(f.x, f.y + 0.04, f.z); sp.m.scale.setScalar(0.9 + Math.random() * 0.8); sp.m.visible = true; sp.t = 8;
    game.audio.impact(tmp.set(f.x, f.y, f.z), 0.35);
    game.audio.sample(voice(), tmp, 0.6);
    if (by === game.player && game.arena) game.arena.onHordeKill();
  }

  function step(dt) {
    if (!kind) return;
    spawnT -= dt;
    if (left > 0 && list.length < cap && spawnT <= 0) { spawnT = 0.35; rise(); }
    groanT -= dt;
    if (groanT <= 0 && list.length) { // now and then one of them is heard
      groanT = 2.5 + Math.random() * 4;
      const g = list[Math.floor(Math.random() * list.length)];
      game.audio.sample(voice(), tmp.set(g.x, g.y, g.z), 0.45);
    }
    for (const f of [...list]) {
      f.claw = Math.max(0, f.claw - dt);
      f.t += dt; f.rise = Math.min(1, f.rise + dt * 1.5);
      f.think -= dt;
      if (f.think <= 0) {
        f.think = 0.4 + Math.random() * 0.3;
        f.target = null;
        let bd = 55;
        for (const v of game.vehicles) { if (!v.alive) continue; const d = Math.hypot(v.pos.x - f.x, v.pos.z - f.z); if (d < bd) { bd = d; f.target = v; } }
        f.y = game.world.groundAt(f.x, f.z, f.y + 1.5);
        if (!f.target) f.wander += (Math.random() - 0.5) * 1.5;
      }
      const v = f.target;
      const goal = v ? Math.atan2(v.pos.x - f.x, v.pos.z - f.z) : f.wander;
      f.yaw += Math.atan2(Math.sin(goal - f.yaw), Math.cos(goal - f.yaw)) * Math.min(1, dt * 4);
      const sp = K.speed * (v ? 1 : 0.4) * f.rise;
      f.x += Math.sin(f.yaw) * sp * dt; f.z += Math.cos(f.yaw) * sp * dt;
      if (!v || !v.alive) continue;
      const d = Math.hypot(v.pos.x - f.x, v.pos.z - f.z), reach = v.chassis.hit.half[0] + 0.7;
      const feetY = v.pos.y - (v.walking && v.mechState ? v.mechState.stance : 0); // a standing walker's body is metres up
      if (d < reach + 0.4 && Math.abs(feetY - f.y) < 3) {
        if (v.vel.length() > 4) { kill(f, v); v.vel.multiplyScalar(0.985); }
        else { f.claw = 0.4; applyDamage(game, v, K.dps * dt, v.pos, null, { blunt: true, weapon: "horde" }); f.x -= Math.sin(f.yaw) * sp * dt; f.z -= Math.cos(f.yaw) * sp * dt; }
      }
    }
  }

  function frame(dt) {
    if (!kind && !bits.length) return;
    if (kind) models.frame(list, K, dt);
    let n = 0;
    for (const f of list) {
      if (f.actor) continue; // a hosted model is standing in for this one
      const sz = f.va.size, bob = Math.abs(Math.sin(f.t * (kind === "aliens" ? 9 : 5))) * 0.08, lean = kind === "zombies" ? 0.25 : 0;
      q.setFromEuler(new THREE.Euler(lean, f.yaw, Math.sin(f.t * 3) * 0.1, "YXZ"));
      p.set(f.x, f.y - (1 - f.rise) * 1.2 * sz + bob, f.z);
      bodies.setMatrixAt(n, m4.compose(p, q, s.set(sz, K.bodyH * sz, sz)));
      tmp.set(0, (K.bodyH + K.headR * 0.8) * sz, lean * 0.4).applyQuaternion(q).add(p);
      heads.setMatrixAt(n++, m4.compose(tmp, q, s.set(K.headR, K.headR * (kind === "aliens" ? 1.25 : 1), K.headR).multiplyScalar(sz)));
    }
    bodies.count = heads.count = n;
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt; b.vy -= 18 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.y < b.gy + 0.08) { b.y = b.gy + 0.08; b.vx *= 0.5; b.vz *= 0.5; b.vy = 0; }
      if (b.life <= 0) bits.splice(i, 1);
    }
    bits.forEach((b, i) => chunks.setMatrixAt(i, m4.compose(p.set(b.x, b.y, b.z), q.identity(), s.setScalar(Math.min(1, b.life * 2)))));
    chunks.count = bits.length; chunks.instanceMatrix.needsUpdate = true;
    for (const sp of splats) if (sp.t > 0) { sp.t -= dt; sp.m.material.opacity = Math.min(0.8, sp.t / 3); if (sp.t <= 0) sp.m.visible = false; }
  }

  // Ray test for shots: the first figure the ray passes through (0.6 m around the chest).
  function ray(o, d, maxT) {
    let best = null, bt = maxT;
    for (const f of list) {
      tmp.set(f.x - o.x, f.y + 0.8 - o.y, f.z - o.z);
      const t = tmp.dot(d);
      if (t < 0 || t > bt) continue;
      if (tmp.lengthSq() - t * t < 0.36) { bt = t; best = f; }
    }
    return best ? { t: bt, f: best } : null;
  }
  function blast(pos, radius, attacker) {
    for (const f of [...list]) if (Math.hypot(f.x - pos.x, f.z - pos.z) < radius + 1 && Math.abs(f.y - pos.y) < radius + 1) kill(f, attacker);
  }
  function nearest(pos, r) {
    let best = null, bd = r;
    for (const f of list) { const d = Math.hypot(f.x - pos.x, f.z - pos.z); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  function clear() { models.clear(); list = []; kind = null; K = null; left = 0; kills = 0; bodies.count = heads.count = 0; }

  return {
    start, step, frame, ray, blast, nearest, kill, clear,
    active: () => !!kind,
    alive: () => list.length,
    figures: () => list, // live figures (assisted aim targets them)
    remaining: () => list.length + left,
    kills: () => kills,
    models: () => models.state(),
    cleared: () => !!kind && left <= 0 && list.length === 0,
  };
}