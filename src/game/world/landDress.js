// Dressing the land (lane A look pass): cliff blocks on every strata wall, scree under it, fallen blocks and spires
// round the buttes, boulder fields on the open ground, dead brush, standing dead shrubs and quiver trees.
// Rocks are geometry-only CC0 Poly Haven models (public/assets/models/rk_*.glb) under one shared strata material.
//
// Placement rules:
//   - seeded: every client builds the same rocks and the same colliders;
//   - each piece sits on the physics heightfield: the lowest ground under its footprint, sunk a little, never floating;
//   - keep-out (world/keepout.js): nothing on a road, a ramp run-up or landing, a bridge, a plot, an arena or a place;
//   - rocks big enough to stop a car get a convex-hull collider from the model's own shape (world/rockHulls.js) and are
//     drawn on every preset; smaller ones have no collider and thin out with the preset (LOOK.decor).
import * as THREE from "three";
import { createInstanced, snapY } from "@/game/assets/instancer";
import { mergeParts } from "@/game/assets/assets";
import { rockMaterial } from "@/game/render/rockMaterial";
import { addSway } from "@/game/render/foliage";
import { onQuality } from "@/game/render/frame";
import { lookFor } from "@/game/render/lookQuality";
import { ROCK_HULLS } from "@/game/world/rockHulls";
import { mulberry32, makeNoise2D, fbm, smoothstep } from "@/game/core/rng";

export const ROCKS = ["rk_cliff", "rk_face_a", "rk_face_b", "rk_boulder_a", "rk_boulder_b", "rk_scree_0", "rk_scree_1", "rk_scree_2", "rk_scree_3", "rk_stones_0", "rk_stones_1", "rk_stones_2", "rk_stones_3"];
const RI = Object.fromEntries(ROCKS.map((n, i) => [n, i]));
const BIG = ["rk_boulder_a", "rk_boulder_b", "rk_scree_0", "rk_scree_3"];
const SMALL = ["rk_scree_1", "rk_scree_2", "rk_stones_0", "rk_stones_1", "rk_stones_2", "rk_stones_3"];
const FACE = ["rk_face_a", "rk_face_b", "rk_cliff", "rk_boulder_a", "rk_face_a"];

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

/** Seeded in-place shuffle: the density cut keeps the first N of each group, so order must be spatially random. */
export function shuffle(list, r) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
  return list;
}

export function hullCollider(colliders, name, m, tag = "rock") {
  const pts = ROCK_HULLS[name];
  if (!pts) return null;
  const out = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => { _v.set(p[0], p[1], p[2]).applyMatrix4(m); out[i * 3] = _v.x; out[i * 3 + 1] = _v.y; out[i * 3 + 2] = _v.z; });
  return colliders.addHull({ points: out, tag });
}

/** Instanced rock family: items [{ v: rock index, m }]. */
export function rockInstances(scene, T, items, lod, castShadow = true) {
  const mat = rockMaterial(T);
  return createInstanced(scene, {
    models: ROCKS, items, lod, castShadow,
    prepare: (raw) => mergeParts(raw).map((p) => ({ geometry: p.geometry, material: mat })),
  });
}

export function buildLandDress(kit, keep, T) {
  const { scene, terrain, colliders } = kit;
  const r = mulberry32(51515), rv = mulberry32(61616);
  const nF = makeNoise2D(9191);
  const cliffs = [], solid = [], decor = [], stats = { cliff: 0, scree: 0, butte: 0, field: 0, solids: 0, brush: 0, shrubs: 0, trees: 0 };
  const n = new THREE.Vector3();
  const mat = (x, y, z, yaw, tx, tz, sx, sy, sz) => {
    _e.set(tx, yaw, tz); _q.setFromEuler(_e);
    return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  };
  // three draw families by size: big blocks are seen across the basin, mid rocks to ~400 m, small ones near only
  const put = (name, m, collide, big = false) => {
    const it = { v: RI[name], m };
    if (collide) { hullCollider(colliders, name, m); (big ? cliffs : solid).push(it); stats.solids++; } else decor.push(it);
  };
  const { N, cell, half, cliffW, screeW, buttes } = terrain;

  // 1. Cliff blocks on the strata walls (mesas, buttes, canyon, rim escarpment): blocks standing out of the face, and
  // big fallen blocks at the toe where the wall meets its apron.
  for (let j = 1; j < N - 1; j += 2) for (let i = 1; i < N - 1; i += 2) {
    const k = j * N + i;
    if (!cliffW[k] || r() > 0.3) continue;
    const x = -half + (i + (r() - 0.5) * 1.6) * cell, z = -half + (j + (r() - 0.5) * 1.6) * cell;
    terrain.normalAt(x, z, n);
    if (n.y > 0.82) continue;
    const size = 2.6 + Math.pow(r(), 1.6) * 6;
    if (keep.blocked(x, z, 2 + size * 0.4, { colliderPad: 0, edge: 600 })) continue;
    const hl = Math.hypot(n.x, n.z) || 1, hx = n.x / hl, hz = n.z / hl;
    const name = FACE[Math.floor(r() * FACE.length)];
    const sy = size * (0.45 + r() * 0.6);
    const y = terrain.heightAt(x, z) - sy * 0.45;
    const m = mat(x + hx * size * 0.18, y, z + hz * size * 0.18, Math.atan2(hx, hz) + (r() - 0.5) * 0.9, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2, size, sy, size * (0.75 + r() * 0.4));
    put(name, m, true, true);
    stats.cliff++;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    if (screeW[k] < 0.6 || r() > 0.05) continue;
    const x = -half + (i + r() - 0.5) * cell, z = -half + (j + r() - 0.5) * cell;
    const size = 2.4 + Math.pow(r(), 1.4) * 4.5;
    if (keep.blocked(x, z, 2 + size * 0.5, { colliderPad: 1 })) continue;
    const y = snapY(terrain, x, z, size * 0.4, size * 0.2);
    put(r() < 0.5 ? "rk_boulder_a" : FACE[Math.floor(r() * FACE.length)], mat(x, y, z, r() * 6.28, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5, size, size * (0.5 + r() * 0.5), size * (0.8 + r() * 0.3)), true, true);
    stats.cliff++;
  }

  // 2. Scree on the aprons: rubble thickest at the foot of the wall, big blocks collide.
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, w = screeW[k];
    if (w < 0.18 || r() > w * 0.3) continue;
    const x = -half + (i + r() - 0.5) * cell, z = -half + (j + r() - 0.5) * cell;
    const size = 0.35 + Math.pow(r(), 2.6) * 3.6 * (0.45 + w * 0.7);
    if (keep.blocked(x, z, 1 + size * 0.5, { colliderPad: size > 1.4 ? 1 : 0 })) continue;
    const big = size > 1.4;
    const name = big ? BIG[Math.floor(r() * BIG.length)] : SMALL[Math.floor(r() * SMALL.length)];
    const y = snapY(terrain, x, z, size * 0.4, size * 0.16);
    put(name, mat(x, y, z, r() * 6.28, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5, size, size * (0.7 + r() * 0.5), size * (0.8 + r() * 0.4)), big);
    stats.scree++;
  }

  // 3. Buttes: a ring of fallen blocks on the apron, and a spire or two standing off the wall.
  for (const b of buttes) {
    const ring = 10 + Math.floor(b.r * 0.8);
    for (let q = 0; q < ring; q++) {
      const a = r() * 6.28, d = b.r * (1.05 + r() * 0.5) + 3 + r() * 9;
      const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
      const size = 1.2 + Math.pow(r(), 1.8) * 4.5;
      if (keep.blocked(x, z, size * 0.6 + 1, { colliderPad: 0 })) continue;
      const y = snapY(terrain, x, z, size * 0.4, size * 0.2);
      put(BIG[Math.floor(r() * BIG.length)], mat(x, y, z, r() * 6.28, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6, size, size * (0.6 + r() * 0.6), size), size > 1.3);
      stats.butte++;
    }
    const spires = r() < 0.6 ? 1 + Math.floor(r() * 2) : 0;
    for (let q = 0; q < spires; q++) {
      const a = r() * 6.28, d = b.r * 1.15 + 12 + r() * 14;
      const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
      const w = 2.6 + r() * 2.2, h = 7 + r() * 9;
      if (keep.blocked(x, z, w + 4, { colliderPad: 0 })) continue;
      const y = snapY(terrain, x, z, w * 0.5, 0.8);
      put("rk_face_b", mat(x, y, z, r() * 6.28, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08, w, h, w), true, true);
      stats.butte++;
    }
  }

  // 4. Boulder fields on the open ground: clusters with a power-law size spread.
  for (let c = 0; c < 170; c++) {
    const cx = (r() - 0.5) * 1100, cz = (r() - 0.5) * 1100;
    const salt = terrain.saltW[Math.round((cz + half) / cell) * N + Math.round((cx + half) / cell)] || 0;
    if (salt > 0.6 && r() < 0.8) continue;
    const count = 5 + Math.floor(r() * 22), rad = 6 + r() * 20;
    for (let q = 0; q < count; q++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * rad;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const size = 0.4 + Math.pow(r(), 2.2) * 3.8;
      if (keep.blocked(x, z, size * 0.6 + 2, { colliderPad: size > 1.3 ? 2 : 0 })) continue;
      terrain.normalAt(x, z, n);
      if (n.y < 0.7) continue;
      const big = size > 1.3;
      const name = big ? BIG[Math.floor(r() * BIG.length)] : SMALL[Math.floor(r() * SMALL.length)];
      const y = snapY(terrain, x, z, size * 0.4, size * 0.15);
      put(name, mat(x, y, z, r() * 6.28, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4, size, size * (0.65 + r() * 0.5), size * (0.8 + r() * 0.4)), big);
      stats.field++;
    }
  }

  // Rocks: colliding ones always drawn, the rest thin out with the preset.
  shuffle(decor, rv);
  const hCliff = rockInstances(scene, T, cliffs, { near: 85, far: 1200, cell: 0.16, hiCell: 0.03 }, true);
  const hSolid = rockInstances(scene, T, solid, { near: 55, far: 420, cell: 0.2, hiCell: 0.045 }, true);
  const hDecor = rockInstances(scene, T, decor, { near: 30, far: 170, cell: 0.25, hiCell: 0.07 }, true);

  // 5. Flora: dead brush (low), dead standing shrubs and quiver trees (tall, a trunk collider). Denser near the cliffs
  // and in the grass patches, sparse on the salt.
  const brush = [], shrubs = [], trees = [];
  const lushAt = (x, z) => {
    const i = Math.round((x + half) / cell), j = Math.round((z + half) / cell), k = j * N + i;
    const salt = terrain.saltW[k] || 0, scree = screeW[k] || 0;
    const patch = smoothstep(-0.1, 0.35, fbm(nF, x * 0.012, z * 0.012, 3));
    return Math.max(0, (0.35 + patch * 0.9 + scree * 0.6) * (1 - salt * 0.85));
  };
  const tryPlace = (list, n0, pad, fn) => {
    for (let t = 0; t < n0 * 3 && list.length < n0; t++) {
      const x = (r() - 0.5) * 1150, z = (r() - 0.5) * 1150;
      if (r() > lushAt(x, z)) continue;
      terrain.normalAt(x, z, n);
      if (n.y < 0.8) continue;
      if (keep.blocked(x, z, pad, { colliderPad: pad })) continue;
      fn(x, z);
    }
  };
  tryPlace(brush, 2600, 2.5, (x, z) => {
    const k = 1.4 + r() * 2.2;
    brush.push({ m: mat(x, snapY(terrain, x, z, k * 0.4, 0.06), z, r() * 6.28, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2, k, k * (0.8 + r() * 0.8), k) });
  });
  tryPlace(shrubs, 900, 3, (x, z) => {
    const k = 0.8 + r() * 0.9;
    shrubs.push({ m: mat(x, snapY(terrain, x, z, 0.3, 0.05), z, r() * 6.28, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15, k, k * (0.8 + r() * 0.5), k) });
  });
  tryPlace(trees, 190, 5, (x, z) => {
    const k = 2.4 + r() * 1.8, y = snapY(terrain, x, z, 0.5, 0.1), yaw = r() * 6.28;
    trees.push({ m: mat(x, y, z, yaw, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1, k, k * (0.9 + r() * 0.3), k) });
    colliders.add({ x, y: y + 1.6, z, hx: 0.06 * k + 0.12, hy: 1.6, hz: 0.06 * k + 0.12, yaw, tag: "tree" });
  });
  shuffle(brush, rv); shuffle(shrubs, rv);
  stats.brush = brush.length; stats.shrubs = shrubs.length; stats.trees = trees.length;
  const plant = (name, items, lod, sway, h, castShadow) => createInstanced(scene, {
    models: [name], items, lod, castShadow,
    prepare: (raw) => mergeParts(raw).map((p) => {
      const m = p.material.clone();
      m.roughness = 0.95; m.metalness = 0; m.envMapIntensity = 0.7;
      if (sway) addSway(m, sway, h);
      return { geometry: p.geometry, material: m };
    }),
  });
  const hBrush = plant("pl_dry_brush", brush, { near: 50, far: 200, cell: 0.06 }, 0.12, 0.26, true);
  const hShrub = plant("pl_dead_branch", shrubs, { near: 60, far: 240, cell: 0.08 }, 0.22, 1.7, true);
  const hTree = plant("pl_quiver_tree", trees, { near: 90, far: 700, cell: 0.12 }, 0.05, 1.7, true);

  const decorHandles = [hDecor, hBrush, hShrub];
  const shadows = () => {
    const L = lookFor();
    const set = (h, on) => { for (const g of h.groups) { for (const m of g.hi) m.castShadow = on; for (const m of g.lo) m.castShadow = false; } };
    set(hCliff, L.rockShadow); set(hSolid, L.solidShadow); set(hTree, L.solidShadow);
    for (const h of decorHandles) set(h, L.decorShadow);
  };
  const named = (h, fam, models) => () => {
    h.groups.forEach((g, i) => { for (const m of g.hi) m.name = `${fam}:${models[i]}:hi`; for (const m of g.lo) m.name = `${fam}:${models[i]}:lo`; });
    shadows();
  };
  [[hCliff, "cliff", ROCKS], [hSolid, "solid", ROCKS], [hDecor, "decor", ROCKS], [hBrush, "brush", ["pl_dry_brush"]], [hShrub, "shrub", ["pl_dead_branch"]], [hTree, "tree", ["pl_quiver_tree"]]]
    .forEach(([h, fam, models]) => { h.onReady = named(h, fam, models); });
  const offQ = onQuality(() => {
    for (const h of decorHandles) h.setDensity(lookFor().decor);
    shadows();
  });
  return { stats, solid, decor, handles: [hCliff, hSolid, hDecor, hBrush, hShrub, hTree], dispose: offQ };
}
