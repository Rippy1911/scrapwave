// Built pieces in the world (plots and fortresses): spawn with colliders, take damage by hit kind (materials.js),
// break into debris, and make whatever loses its support fall. Groups: "plot:<id>" and "fort:<id>".
import * as THREE from "three";
import { pieceDef, pieceFoot, pieceStats, pieceBoxes } from "@/game/base/pieceCatalog";
import { pieceMaterial } from "@/game/base/pieceLook";
import { buildPiece } from "@/game/base/pieceMesh";
import { resisted } from "@/game/base/materials";
import { aabb, topUnder, unsupported } from "@/game/base/support";
import { showHp, punch, clearDamage, tickDamage, hitSparks } from "@/game/base/pieceDamage";
import { createDebris } from "@/game/base/debris";

const v3 = new THREE.Vector3();

export function createPieces(game) {
  const { scene, world } = game;
  const list = [], byId = new Map(), groups = new Map(), breakFns = [], hurtFns = [];
  const debris = createDebris(game);
  let seq = 1;
  const groupOf = (g) => { let l = groups.get(g); if (!l) groups.set(g, (l = [])); return l; };
  const terrainMin = (x, z, fw, fd) => Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => world.terrain.heightAt(x + (a * fw) / 2, z + (b * fd) / 2)));

  // Where a piece would stand: on the highest standing piece under its footprint, else on the ground.
  function restY(group, kind, wx, wz, yaw, skip = null, maxY = Infinity) {
    const [fw, fd] = pieceFoot(kind, yaw);
    const box = { x0: wx - fw / 2, x1: wx + fw / 2, z0: wz - fd / 2, z1: wz + fd / 2 };
    const on = topUnder(groupOf(group), box, maxY, skip);
    const g = terrainMin(wx, wz, fw, fd) - 0.12;
    return on && on.y > g + 0.3 ? { y: on.y, ground: false, on: on.piece } : { y: g, ground: true, on: null };
  }

  function addColliders(pc) {
    const c = Math.cos(pc.yaw), s = Math.sin(pc.yaw);
    for (const [lx, ly, lz, hx, hy, hz, role, shape] of pieceBoxes(pc.kind)) {
      if (role === "door" && pc.open) continue;
      const b = world.colliders.add({ x: pc.wx + lx * c + lz * s, y: pc.y0 + ly, z: pc.wz - lx * s + lz * c, hx, hy, hz, yaw: pc.yaw, tag: "piece", kind: shape || "solid", curve: 1 });
      b.piece = pc; b.role = role;
      b.onHit = (dmg, shooter, point) => damage(pc, dmg, "mg", point, shooter);
      pc.boxes.push(b);
    }
  }
  function dropColliders(pc, role = null) {
    for (let i = pc.boxes.length - 1; i >= 0; i--) if (!role || pc.boxes[i].role === role) { world.colliders.remove(pc.boxes[i]); pc.boxes.splice(i, 1); }
  }

  // d: { kind, mat, tier, lx, lz, yaw, id?, hp? } relative to origin {x, y, z}. o: { rise, owner, y0, ground }.
  function spawn(group, d, origin, o = {}) {
    const def = pieceDef(d.kind), yaw = d.yaw || 0, [fw, fd] = pieceFoot(d.kind, yaw);
    const wx = origin.x + d.lx, wz = origin.z + d.lz;
    const rest = o.y0 != null ? { y: o.y0, ground: !!o.ground } : restY(group, d.kind, wx, wz, yaw);
    const st = pieceStats(d.kind, d.mat, d.tier);
    const pc = {
      id: d.id || `${group}#${seq++}`, group, kind: d.kind, def, mat: d.mat, tier: d.tier | 0 || 1, yaw, lx: d.lx, lz: d.lz, size: def.size, fw, fd,
      wx, wz, y0: rest.y, ground: rest.ground, top: rest.y + def.size[1], ox: origin.x, oy: origin.y, oz: origin.z,
      hp: d.hp ?? st.hp, maxHp: st.hp, mass: st.mass, cost: st.cost, alive: true, boxes: [], owner: o.owner || null, rise: o.rise ? 1 : 0, t: Math.random() * 9,
    };
    pc.o = buildPiece(d.kind, pieceMaterial(pc.mat, pc.tier));
    pc.o.root.position.set(wx, pc.y0, wz); pc.o.root.rotation.y = yaw;
    if (pc.rise) pc.o.root.position.y -= def.size[1];
    scene.add(pc.o.root);
    addColliders(pc);
    list.push(pc); byId.set(pc.id, pc); groupOf(group).push(pc);
    if (pc.hp < pc.maxHp) showHp(pc);
    return pc;
  }

  function unlink(pc) {
    dropColliders(pc);
    pc.o.root.removeFromParent();
    if (pc.crack) pc.crack.material.dispose();
    list.splice(list.indexOf(pc), 1); byId.delete(pc.id);
    const g = groupOf(pc.group); g.splice(g.indexOf(pc), 1);
  }

  function settle(group) { for (const p of unsupported(groupOf(group))) { p.fall = { vy: 0 }; dropColliders(p); } }

  function breakPiece(pc, point = null, by = null) {
    if (!pc.alive) return;
    pc.alive = false;
    debris.burst(pc, point);
    v3.set(pc.wx, pc.y0 + pc.size[1] / 2, pc.wz);
    game.particles.explosion(v3.x, v3.y, v3.z, 0.35);
    game.particles.dust(v3.x, pc.y0 + 0.5, v3.z, 0, 0, 3);
    game.audio.impact(v3, 1); game.audio.explosion(v3, 0.3);
    unlink(pc);
    for (const fn of breakFns) fn(pc, by);
    settle(pc.group);
  }

  // amount: raw weapon damage; kind: mg | rocket | mine | ram | blast.
  function damage(pc, amount, kind, point, by = null, remote = false) {
    if (!pc || !pc.alive || amount <= 0) return 0;
    if (by && !remote && game.base.pieceGuard && !game.base.pieceGuard(pc, by)) return 0; // owners and own turrets
    hitSparks(game, pc, point, kind);
    if (game.cosmetic) return 0;
    const dealt = remote ? amount : resisted(pc.mat, pc.tier, kind, amount);
    pc.hp -= dealt;
    if (kind !== "mg" && dealt > pc.maxHp * 0.08) punch(pc, point, kind === "ram" ? 1.6 : 1.1);
    showHp(pc);
    if (by === game.player && dealt > 0.5) game.onHitMarker?.(null, dealt);
    for (const fn of hurtFns) fn(pc, dealt, kind, by, remote);
    if (pc.hp <= 0) breakPiece(pc, point, by);
    return dealt;
  }

  // Explosions: rockets, mines, barrels, shells. Heavier damage than on cars: structures are what they are for.
  function blast(pos, radius, dmg, attacker, weapon = "explosion") {
    const kind = weapon === "rockets" ? "rocket" : weapon === "mine" ? "mine" : "blast", R = radius + 1.5;
    for (const pc of list.slice()) {
      if (!pc.alive || pc.fall || (game.base.skipFort && pc.group.startsWith("fort:"))) continue;
      const a = aabb(pc), dx = Math.max(a.x0 - pos.x, 0, pos.x - a.x1), dz = Math.max(a.z0 - pos.z, 0, pos.z - a.z1);
      const dy = Math.max(pc.y0 - pos.y, 0, pos.y - pc.top), d = Math.hypot(dx, dy, dz);
      if (d < R) damage(pc, dmg * 1.25 * (1 - (d / R) * 0.7), kind, pos, attacker);
    }
  }

  function stepFall(pc, dt) {
    const from = pc.y0;
    pc.fall.vy -= 18 * dt;
    pc.y0 += pc.fall.vy * dt;
    const r = restY(pc.group, pc.kind, pc.wx, pc.wz, pc.yaw, pc, from + 0.05); // the first top at or below where it was
    const target = r.y;
    if (pc.y0 > target) { pc.o.root.position.y = pc.y0; pc.o.root.rotation.z = Math.min(0.25, -pc.fall.vy * 0.01); return; }
    const hit = -pc.fall.vy;
    pc.y0 = target; pc.top = target + pc.size[1]; pc.ground = r.ground; pc.fall = null;
    pc.o.root.position.y = pc.y0; pc.o.root.rotation.z = 0.04;
    addColliders(pc);
    game.particles.dust(pc.wx, pc.y0 + 0.3, pc.wz, 0, 0, 3);
    game.audio.impact(v3.set(pc.wx, pc.y0, pc.wz), Math.min(1, hit / 10));
    const fallDmg = hit * hit * pc.mass * 0.004;
    if (r.on) damage(r.on, fallDmg * 0.5, "ram", null, null);
    damage(pc, fallDmg, "ram", null, null);
  }

  function step(dt) { for (const pc of list.slice()) if (pc.fall) stepFall(pc, dt); }

  function frame(dt, camPos) {
    for (const pc of list) {
      pc.o.root.visible = !camPos || Math.hypot(pc.wx - camPos.x, pc.wz - camPos.z) < 480;
      if (pc.rise > 0) { pc.rise = Math.max(0, pc.rise - dt * 1.6); pc.o.root.position.y = pc.y0 - pc.size[1] * pc.rise ** 3; }
      if (pc.hp < pc.maxHp && pc.o.root.visible) tickDamage(game, pc, dt);
      if (pc.o.door) pc.o.door.position.y += ((pc.open ? -(pc.size[1] - 0.3) : 0) - pc.o.door.position.y) * Math.min(1, dt * 5);
    }
    debris.update(dt);
  }

  function repair(pc) { pc.hp = pc.maxHp; clearDamage(pc); }
  function remove(pc) { if (!pc || !pc.alive) return; pc.alive = false; unlink(pc); settle(pc.group); }
  function clearGroup(group, sink = false) {
    for (const pc of groupOf(group).slice()) { pc.alive = false; if (sink) game.particles.dust(pc.wx, pc.y0 + 0.4, pc.wz, 2, 1, 3); unlink(pc); }
  }
  function setOpen(pc, open) {
    if (!!pc.open === open || !pc.alive || pc.fall) return;
    pc.open = open;
    if (open) dropColliders(pc, "door"); else { dropColliders(pc); addColliders(pc); }
  }

  return {
    list, byId, group: groupOf, spawn, damage, blast, breakPiece, repair, remove, clearGroup, restY, setOpen, step, frame, debris,
    onBreak: (fn) => breakFns.push(fn), onHurt: (fn) => hurtFns.push(fn), dropColliders, addColliders,
  };
}