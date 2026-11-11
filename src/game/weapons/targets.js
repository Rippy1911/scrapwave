// Everything assisted aim may lock: enemy cars, enemy base turrets and walls, arena horde figures and explosive
// barrels. Each candidate carries a `homing` object ({ pos, alive, name, hull, maxHull }) rockets can steer to:
// the car itself, or for anything else the candidate (its `alive` reads the live object).
import * as THREE from "three";
import { vehicleMuzzle } from "@/game/ai/aim";

const TURRETS = new Set(["mgturret", "rocketturret", "flametrap"]);
const WALLS = new Set(["scrapwall", "platewall", "spikewall", "gate"]);
const wrap = new WeakMap(); // car / module / figure / barrel → its stable candidate (identity across frames)
const mz = new THREE.Vector3(), dir = new THREE.Vector3();

function stable(key, fields, alive) {
  let c = wrap.get(key);
  if (!c) {
    c = { key, pos: new THREE.Vector3(), ...fields };
    if (alive) { Object.defineProperty(c, "alive", { get: alive }); c.homing = c; }
    wrap.set(key, c);
  }
  return c;
}

export function gatherTargets(game, v, maxDist) {
  const out = [], md2 = maxDist * maxDist;
  for (const t of game.vehicles) {
    if (t === v || !t.alive || t.team === "player" || !t.mesh.root.parent || game.inSafeZone(t)) continue;
    if (t.pos.distanceToSquared(v.pos) > md2) continue;
    const c = stable(t, { id: t.netId || t.id, kind: "car", vel: t.vel, homing: t });
    c.pos.copy(t.pos); c.pos.y += 0.4;
    c.name = t.name; c.hull = t.hull; c.maxHull = t.maxHull;
    out.push(c);
  }
  const base = game.base;
  if (base && base.modules) {
    for (const e of base.modules.list) {
      if (!e.alive || !e.plotRef || !e.plotRef.owner || base.isOwner(e.plotRef, v)) continue;
      if (Math.hypot(e.wx - v.pos.x, e.wz - v.pos.z) > maxDist) continue;
      const kind = TURRETS.has(e.kind) ? "turret" : WALLS.has(e.kind) ? "wall" : "module";
      const c = stable(e, { id: `${e.plot}:${e.id}`, kind, bias: kind === "turret" ? 0.1 : 0.35 }, () => e.alive);
      c.pos.set(e.wx, e.wy + e.h * 0.55, e.wz);
      c.name = (e.def && e.def.name) || e.kind; c.hull = e.hp; c.maxHull = e.maxHp;
      out.push(c);
    }
  }
  if (game.horde && game.horde.active()) {
    const figs = game.horde.figures();
    for (const f of figs) {
      if (Math.hypot(f.x - v.pos.x, f.z - v.pos.z) > maxDist) continue;
      const c = stable(f, { id: `fig${f.id ?? ""}`, kind: "figure", bias: 0.15, name: "", hull: 1, maxHull: 1 }, () => game.horde.figures().includes(f));
      c.pos.set(f.x, f.y + 0.8, f.z);
      out.push(c);
    }
  }
  for (const p of game.world.props.explosives()) {
    if (!p.alive || Math.hypot(p.x - v.pos.x, p.z - v.pos.z) > maxDist) continue;
    const c = stable(p, { id: `barrel${p.id ?? ""}`, kind: "barrel", bias: 0.4, name: "Barrel", hull: 1, maxHull: 1 }, () => p.alive);
    c.pos.set(p.x, p.y + 0.6, p.z);
    out.push(c);
  }
  return out;
}

// A clear line from the car's gun to the candidate: the first thing the ray meets is the candidate itself.
export function targetVisible(game, v, c) {
  vehicleMuzzle(v, mz);
  dir.subVectors(c.pos, mz);
  const L = dir.length();
  if (L < 2) return true;
  dir.divideScalar(L);
  const r = game.combat.ray(mz, dir, L + 1.5, v);
  if (r.v) return r.v === c.key;
  if (r.fig) return r.fig === c.key;
  if (r.prop) return r.prop === c.key;
  if (r.world) return (!!r.box && r.box.mod === c.key) || r.t >= L - 1.2;
  return true;
}