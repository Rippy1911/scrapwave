// Base modules in the world: spawn (rise out of the ground with dust and a clang), colliders that block cars
// and shots, damage visuals (dents, smoke, sparks), collapse into debris at 0 HP, and the end-of-cycle dust sweep.
import * as THREE from "three";
import { BASE } from "@/game/data/tuning";
import CONFIG from "@/game/net/world-config.json";
import { buildModel } from "@/game/base/models";
import { labelSprite, drawLabel } from "@/game/base/plots";

export const MODULE_IDS = ["scrapwall", "platewall", "spikewall", "gate", "mgturret", "rocketturret", "flametrap", "garagepad", "refinery", "radar"];
export const RIG = { id: "rig", module: "rig", x: 0, z: 0, rot: 0 };
export const moduleDef = (k) => ({ ...BASE.modules[k], ...(CONFIG.modules[k] || {}) });
export function footprint(kind, rot) {
  const [w, d] = (BASE.modules[kind] || BASE.modules.scrapwall).size;
  return (rot | 0) % 2 ? [d, w] : [w, d];
}
// Collider boxes per module, plot-local to the module: [lx, ly, lz, hx, hy, hz]. Flame traps and pads have none.
const BOXES = {
  rig: [[0, 2.6, 0, 3, 2.6, 3]], scrapwall: [[0, 1.3, 0, 1, 1.3, 0.3]], platewall: [[0, 1.5, 0, 1, 1.5, 0.36]],
  spikewall: [[0, 1.05, 0, 1, 1.05, 0.35]], gate: [[-1.75, 1.7, 0, 0.25, 1.7, 0.5], [1.75, 1.7, 0, 0.25, 1.7, 0.5], [0, 1.45, 0, 1.5, 1.45, 0.25, "door"]],
  mgturret: [[0, 1.1, 0, 0.95, 1.1, 0.95]], rocketturret: [[0, 1.2, 0, 0.95, 1.2, 0.95]], refinery: [[0, 1.8, 0, 2, 1.8, 2]],
  radar: [[0, 4, 0, 0.6, 4, 0.6]], garagepad: [[2.6, 0.7, -2.5, 0.4, 0.6, 0.3]], flametrap: [],
};
const HEIGHT = { rig: 6, radar: 8.5, refinery: 6.5, garagepad: 4.6, gate: 3.5 };

export function createModules(game) {
  const { scene, M, world } = game;
  const list = [], debris = [];
  const chunkMats = [M.rust, M.dark, M.corrugated, M.concrete];

  function addBox(e, [lx, ly, lz, hx, hy, hz, role]) {
    const c = Math.cos(e.yaw), s = Math.sin(e.yaw);
    const b = world.colliders.add({ x: e.wx + lx * c + lz * s, y: e.wy + ly, z: e.wz - lx * s + lz * c, hx, hy, hz, yaw: e.yaw, tag: "module" });
    b.mod = e; b.role = role || "";
    e.boxes.push(b);
    return b;
  }

  function spawn(plot, mod, rise = true) {
    const kind = mod.module, def = moduleDef(kind), rot = (mod.rot | 0) & 3;
    const o = buildModel(kind, M);
    const wx = plot.x + mod.x, wz = plot.z + mod.z, wy = world.terrain.heightAt(wx, wz);
    o.root.position.set(wx, wy, wz); o.root.rotation.y = rot * Math.PI / 2;
    scene.add(o.root);
    const e = {
      id: mod.id, plot: plot.id, plotRef: plot, kind, def, x: mod.x, z: mod.z, rot, yaw: rot * Math.PI / 2, wx, wy, wz,
      hp: mod.hp ?? def.hp, maxHp: mod.maxHp ?? def.hp, o, boxes: [], rise: rise ? 1 : 0, alive: true, cd: 0, dents: 0, t: Math.random() * 9,
      h: HEIGHT[kind] || 3,
    };
    for (const b of BOXES[kind] || []) addBox(e, b);
    if (kind === "rig") {
      e.label = labelSprite(); e.label.position.set(0, o.labelY || 9, 0); o.root.add(e.label);
      e.ring = siphonRing(); e.ring.position.y = 0.3; o.root.add(e.ring);
    }
    if (rise) { o.inner.position.y = -e.h; game.particles.dust(wx, wy + 0.5, wz, 0, 0, 3); }
    list.push(e);
    setHp(e, e.hp);
    return e;
  }

  function siphonRing() {
    const m = new THREE.Mesh(new THREE.RingGeometry(14.2, 15, 64, 1, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: "#ff3a20", transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false;
    return m;
  }
  function setSiphon(e, k) {
    if (!e.ring) return;
    e.ring.visible = k > 0;
    if (k > 0) { e.ring.geometry.dispose(); e.ring.geometry = new THREE.RingGeometry(14, 15.2, 64, 1, Math.PI / 2, -Math.PI * 2 * Math.min(1, k)); }
  }
  function setStashLabel(e, stash, owner, dark) {
    if (!e.label) return;
    drawLabel(e.label, `${Math.round(stash)} SCRAP`, dark ? "RIG DOWN" : (owner || "RIG").toUpperCase() + " · STASH", dark ? "#ff5a3a" : "#7fe0a0");
  }

  // Dents: knock a few parts askew each time HP crosses a quarter.
  function setHp(e, hp) {
    e.hp = Math.max(0, hp);
    const k = e.hp / e.maxHp, want = k < 0.25 ? 3 : k < 0.5 ? 2 : k < 0.75 ? 1 : 0;
    while (e.dents < want) {
      e.dents++;
      const parts = e.o.inner.children.filter((c) => c.isMesh);
      for (let i = 0; i < 3 && parts.length; i++) {
        const m = parts[Math.floor(Math.random() * parts.length)];
        m.rotation.x += (Math.random() - 0.5) * 0.18; m.rotation.z += (Math.random() - 0.5) * 0.18;
        m.position.y -= Math.random() * 0.08; m.scale.multiplyScalar(0.94 + Math.random() * 0.05);
      }
    }
  }
  function hitFx(e, point) {
    const p = point || new THREE.Vector3(e.wx, e.wy + e.h * 0.5, e.wz);
    game.particles.sparks(p.x, p.y, p.z, 6);
    if (Math.random() < 0.3) game.particles.dust(p.x, p.y, p.z, 0, 0, 0.8);
  }

  function dropBoxes(e) { for (const b of e.boxes) world.colliders.remove(b); e.boxes.length = 0; }

  // 0 HP: chunks fly, the frame sinks and tilts, smoke rises.
  function collapse(e) {
    if (!e.alive) return;
    e.alive = false; dropBoxes(e);
    const [w, d] = footprint(e.kind, e.rot);
    game.particles.explosion(e.wx, e.wy + 1, e.wz, e.kind === "rig" ? 1.4 : 0.6);
    game.audio.explosion(new THREE.Vector3(e.wx, e.wy, e.wz), e.kind === "rig" ? 1.2 : 0.5);
    for (let i = 0; i < (e.kind === "rig" ? 16 : 8); i++) {
      const s = 0.3 + Math.random() * 0.6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.5, s * 1.4), chunkMats[i % chunkMats.length]);
      m.castShadow = true;
      m.position.set(e.wx + (Math.random() - 0.5) * w, e.wy + 0.5 + Math.random() * e.h * 0.6, e.wz + (Math.random() - 0.5) * d);
      scene.add(m);
      debris.push({ m, vx: (Math.random() - 0.5) * 9, vy: 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 9, life: 25, spin: Math.random() * 6 });
    }
    e.sink = 1.5; e.burnT = 12;
    e.o.inner.rotation.z = (Math.random() - 0.5) * 0.3;
  }
  // Cycle end: a sweep of dust, the module sinks into the sand.
  function dissolve(e, delay = 0) {
    if (e.dissolve != null) return;
    e.alive = false; dropBoxes(e);
    e.dissolve = 1.6 + delay;
  }
  function destroy(e) {
    dropBoxes(e);
    e.o.root.removeFromParent();
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.t += dt;
      if (e.rise > 0) {
        e.rise = Math.max(0, e.rise - dt * 1.3);
        const k = 1 - (1 - e.rise) ** 3;
        e.o.inner.position.y = -e.h * k;
        if (Math.random() < 0.6) game.particles.dust(e.wx + (Math.random() - 0.5) * 3, e.wy + 0.3, e.wz + (Math.random() - 0.5) * 3, 0, 0, 1.4);
        if (e.rise === 0) { game.audio.impact(e.o.root.position, 0.9); game.audio.clank?.(); game.particles.dust(e.wx, e.wy + 0.4, e.wz, 0, 0, 3); }
      }
      if (e.dissolve != null) {
        e.dissolve -= dt;
        if (e.dissolve < 1.6) {
          e.o.inner.position.y -= dt * e.h * 0.8;
          if (Math.random() < 0.8) game.particles.dust(e.wx + (Math.random() - 0.5) * 4, e.wy + 0.5, e.wz + (Math.random() - 0.5) * 4, 2, 1, 3);
        }
        if (e.dissolve <= 0) destroy(e);
        continue;
      }
      if (e.sink != null) {
        e.sink -= dt;
        if (e.sink > 0) e.o.inner.position.y -= dt * e.h * 0.25;
        e.burnT -= dt;
        if (e.burnT > 0 && Math.random() < 0.4) game.particles.smoke(e.wx, e.wy + 1.5, e.wz, true, 2);
        if (e.burnT < -20) destroy(e);
        continue;
      }
      const k = e.hp / e.maxHp, top = e.wy + e.h * 0.8;
      if (k < 0.6 && Math.random() < (k < 0.3 ? 0.35 : 0.12)) game.particles.smoke(e.wx, top, e.wz, k < 0.3, 1.2);
      if (k < 0.3 && Math.random() < 0.08) game.particles.sparks(e.wx, top, e.wz, 4);
      if (e.o.dish) e.o.dish.rotation.y += dt * 1.6;
      if (e.o.flames) for (const f of e.o.flames) { f.scale.y = (f.userData.base ||= f.scale.y) * (0.7 + Math.random() * 0.6); f.visible = !e.plotRef.dark; }
      if (e.o.lamps) for (const l of e.o.lamps) l.visible = !e.plotRef.dark && (k > 0.3 || Math.sin(e.t * 23) > 0);
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt;
      if (d.life <= 0) { d.m.removeFromParent(); d.m.geometry.dispose(); debris.splice(i, 1); continue; }
      const g = world.terrain.heightAt(d.m.position.x, d.m.position.z) + 0.15;
      if (d.m.position.y > g || d.vy > 0) {
        d.vy -= 18 * dt;
        d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
        d.m.rotation.x += d.spin * dt; d.m.rotation.z += d.spin * 0.7 * dt;
        if (d.m.position.y < g) { d.m.position.y = g; d.vy = d.vy < -3 ? -d.vy * 0.25 : 0; d.vx *= 0.5; d.vz *= 0.5; d.spin *= 0.4; }
      }
      if (d.life < 2) d.m.scale.setScalar(Math.max(0.01, d.life / 2));
    }
  }

  return {
    list, spawn, setHp, hitFx, collapse, dissolve, destroy, update, setSiphon, setStashLabel, addBox,
    find: (plotId, id) => list.find((e) => e.plot === plotId && e.id === id) || null,
    forPlot: (plotId) => list.filter((e) => e.plot === plotId && e.alive),
    rigOf: (plotId) => list.find((e) => e.plot === plotId && e.kind === "rig" && e.alive) || null,
    clearPlot(plotId, mode = "dissolve") {
      let n = 0;
      for (const e of [...list]) if (e.plot === plotId) { if (mode === "now") destroy(e); else dissolve(e, n++ * 0.05); }
    },
  };
}