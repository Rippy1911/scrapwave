// The Ashmark's ground scatter: rocks, rubble slabs, dead trees, poles and bone ribs, placed by a hash of the 40 m
// map cell they stand in, so every visit finds them in the same spots. Only the cells within REACH of the camera
// are worked out (a few per frame, then kept) and handed to engine/three/ashScatter.js, which draws one instanced
// mesh per kind: five draw calls for the whole map. Nothing stands on a road, on a site's pad or in open water.
// Scatter has no colliders: every piece is small or thin enough to drive through.
import { ASH, biomeAtMap } from "@/game/maps/ashmark/layout";
import { mapHeight } from "@/game/maps/ashmark/height";

export const KINDS = ["rock", "slab", "snag", "post", "rib"];
const CELL = 40, CN = ASH.size / CELL, REACH = 320, N = Math.ceil(REACH / CELL), TRIES = 4, PER_FRAME = 14;
const KEEP = 10, GN = ASH.size / KEEP; // the keep-out grid: 10 m cells under roads and pads
// Per biome: [kind, chance per try, smallest scale, largest scale].
const MIX = {
  waste: [[0, 0.3, 0.5, 1.1], [2, 0.08, 0.6, 1], [3, 0.03, 0.7, 1], [4, 0.03, 0.8, 1.4]],
  city: [[1, 0.5, 0.6, 1.6], [3, 0.12, 0.8, 1.3], [0, 0.1, 0.4, 0.8]],
  spine: [[0, 0.55, 0.6, 1.3], [2, 0.3, 0.9, 1.6]],
  dunes: [[4, 0.07, 0.9, 1.8], [0, 0.1, 0.4, 0.8], [2, 0.04, 0.6, 1]],
  marsh: [[3, 0.3, 0.7, 1.3], [2, 0.3, 0.7, 1.2], [0, 0.08, 0.4, 0.8]],
};
const WADES = [0, 0, 1, 1, 0]; // dead trees and poles also stand in the shallows

// A small seeded generator (mulberry32), one per cell.
function rng(i, j) {
  let a = (Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663) ^ ASH.seed) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** net: the laid-out roads and sites (roads.js). gfx: engine/three/ashScatter.js. */
export function createScatter(net, gfx) {
  const keep = new Uint8Array(GN * GN), cache = new Map(), count = KINDS.map(() => 0);
  const g = (v) => Math.floor((v + ASH.half) / KEEP);
  const mark = (x, z, r) => {
    for (let j = Math.max(0, g(z - r)); j <= Math.min(GN - 1, g(z + r)); j++) for (let i = Math.max(0, g(x - r)); i <= Math.min(GN - 1, g(x + r)); i++) keep[j * GN + i] = 1;
  };
  for (const R of net.list) for (const p of R.pts) mark(p.x, p.z, R.w / 2 + 6);
  for (const s of net.sites.values()) mark(s.x, s.z, (s.r || 30) + 6);
  let ci0 = -1, cj0 = -1, dirty = false, shown = 0;

  // One cell's pieces as a flat list: kind, x, y, z, yaw, width scale, height scale (map coordinates).
  function cell(ci, cj) {
    const rnd = rng(ci, cj), out = [];
    for (let t = 0; t < TRIES; t++) {
      const x = (ci + rnd()) * CELL - ASH.half, z = (cj + rnd()) * CELL - ASH.half, pick = rnd(), yaw = rnd() * 6.283, size = rnd(), tall = rnd();
      if (Math.abs(x) > ASH.play || Math.abs(z) > ASH.play || keep[g(z) * GN + g(x)]) continue;
      let acc = 0, m = null;
      for (const e of MIX[biomeAtMap(x, z)]) { acc += e[1]; if (pick < acc) { m = e; break; } }
      if (!m) continue;
      const y = mapHeight(x, z), s = m[2] + (m[3] - m[2]) * size;
      if (y < (WADES[m[0]] ? -1.2 : 0.3)) continue;
      out.push(m[0], x, y - 0.12 * s, z, yaw, s, s * (0.8 + 0.4 * tall));
    }
    return out;
  }

  return {
    /** Every frame, with the camera in map coordinates: works out a few missing cells and refills the meshes on a change. */
    update(mx, mz) {
      const ci = Math.floor((mx + ASH.half) / CELL), cj = Math.floor((mz + ASH.half) / CELL);
      if (ci !== ci0 || cj !== cj0) { ci0 = ci; cj0 = cj; dirty = true; }
      let made = 0;
      for (let j = Math.max(0, cj - N); j <= Math.min(CN - 1, cj + N) && made < PER_FRAME; j++) for (let i = Math.max(0, ci - N); i <= Math.min(CN - 1, ci + N) && made < PER_FRAME; i++) {
        if (!cache.has(i * 1000 + j)) { cache.set(i * 1000 + j, cell(i, j)); made++; }
      }
      if (!dirty && !made) return;
      dirty = false;
      const lists = KINDS.map(() => []);
      for (let j = cj - N; j <= cj + N; j++) for (let i = ci - N; i <= ci + N; i++) {
        const c = cache.get(i * 1000 + j);
        if (c) for (let o = 0; o < c.length; o += 7) lists[c[o]].push(c[o + 1], c[o + 2], c[o + 3], c[o + 4], c[o + 5], c[o + 6]);
      }
      shown = gfx.fill(lists);
      lists.forEach((L, k) => { count[k] = L.length / 6; });
      if (cache.size > 3000) for (const k of cache.keys()) if (Math.abs(Math.floor(k / 1000) - ci) > N + 6 || Math.abs((k % 1000) - cj) > N + 6) cache.delete(k);
    },
    /** True while cells round the camera are still being worked out. */
    busy() { for (let j = Math.max(0, cj0 - N); j <= Math.min(CN - 1, cj0 + N); j++) for (let i = Math.max(0, ci0 - N); i <= Math.min(CN - 1, ci0 + N); i++) if (!cache.has(i * 1000 + j)) return true; return false; },
    stats: () => ({ shown, cells: cache.size, byKind: Object.fromEntries(KINDS.map((k, i) => [k, count[i]])) }),
    dispose() { cache.clear(); gfx.dispose(); },
  };
}