// One 250 m tile of the Ashmark as plain typed arrays, sampled from height.js a few rows at a time so a frame never
// spends more than its budget here. Detail 0 is 64 cells a side (3.9 m), 1 is 32, 2 is 16. Every tile hangs a skirt
// from its edge so neighbours of a different detail show no cracks. No three.js here: engine/three/ashTiles.js turns
// the arrays into meshes, and colliders.js turns detail 0 heights into a Rapier heightfield.
import { ASH, tileX0, tileZ0 } from "@/game/maps/ashmark/layout";
import { heightAt } from "@/game/maps/ashmark/height";

export const CELLS = [64, 32, 16];
const W = { city: 0, spine: 0, dunes: 0, marsh: 0, waste: 0 };
const byte = (v) => (v * 255 + 0.5) | 0;

/** A tile job: a height grid with one extra sample on every side (for normals) and the biome weights as bytes. */
export function startTile(i, j, lod) {
  const n = CELLS[lod], P = n + 3;
  return { i, j, lod, n, row: 0, H: new Float32Array(P * P), B: new Uint8Array((n + 1) * (n + 1) * 4), mask: 0 };
}

/** Samples rows until now() passes deadline (ms). Returns true once the whole grid is filled. */
export function stepTile(job, deadline, now) {
  const { n, H, B } = job, P = n + 3, cell = ASH.tile / n, x0 = tileX0(job.i) - cell, z0 = tileZ0(job.j) - cell;
  while (job.row < P) {
    const r = job.row, z = z0 + r * cell, inner = r >= 1 && r <= n + 1;
    for (let c = 0; c < P; c++) {
      H[r * P + c] = heightAt(x0 + c * cell, z, W);
      if (!inner || c < 1 || c > n + 1) continue;
      const k = ((r - 1) * (n + 1) + c - 1) * 4;
      B[k] = byte(W.city); B[k + 1] = byte(W.spine); B[k + 2] = byte(W.dunes); B[k + 3] = byte(W.marsh);
      job.mask |= (W.city > 0.01 ? 1 : 0) | (W.spine > 0.01 ? 2 : 0) | (W.dunes > 0.01 ? 4 : 0) | (W.marsh > 0.01 ? 8 : 0);
    }
    job.row++;
    if (now() >= deadline) break;
  }
  return job.row >= P;
}

// The grid vertices round the edge, in order: north edge west to east, east edge north to south, south edge east to
// west, west edge south to north. With this order every skirt quad faces outward.
const rings = new Map();
function perimeter(n) {
  if (rings.has(n)) return rings.get(n);
  const V = n + 1, ring = new Uint16Array(4 * n);
  for (let k = 0; k < n; k++) { ring[k] = k; ring[n + k] = k * V + n; ring[2 * n + k] = n * V + n - k; ring[3 * n + k] = (n - k) * V; }
  rings.set(n, ring);
  return ring;
}

/** Vertex arrays of a finished job: positions local to the tile's north-west corner, normals, biome weights. */
export function tileArrays(job) {
  const { n, H, B, lod } = job, P = n + 3, V = n + 1, cell = ASH.tile / n, top = V * V, total = top + 4 * n;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), bw = new Uint8Array(total * 4);
  let minY = Infinity, maxY = -Infinity;
  for (let r = 0; r < V; r++) for (let c = 0; c < V; c++) {
    const k = (r * V + c) * 3, g = (r + 1) * P + c + 1, h = H[g];
    const dx = (H[g + 1] - H[g - 1]) / (2 * cell), dz = (H[g + P] - H[g - P]) / (2 * cell), l = Math.hypot(dx, 1, dz);
    pos[k] = c * cell; pos[k + 1] = h; pos[k + 2] = r * cell;
    nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
    if (h < minY) minY = h;
    if (h > maxY) maxY = h;
  }
  bw.set(B);
  const ring = perimeter(n), drop = cell * 1.5 + 2;
  for (let q = 0; q < ring.length; q++) {
    const s = (top + q) * 3, k = ring[q] * 3;
    pos[s] = pos[k]; pos[s + 1] = pos[k + 1] - drop; pos[s + 2] = pos[k + 2];
    nor[s] = nor[k]; nor[s + 1] = nor[k + 1]; nor[s + 2] = nor[k + 2];
    for (let b = 0; b < 4; b++) bw[(top + q) * 4 + b] = B[ring[q] * 4 + b];
  }
  return { pos, nor, bw, lod, mask: job.mask, minY: minY - drop, maxY };
}

// Triangles of one detail level, shared by every tile of that level. Cells split along the (x+1, z)-(x, z+1)
// diagonal, as Rapier's heightfield does, so the collider is the surface on screen.
const indices = new Map();
export function tileIndex(lod) {
  if (indices.has(lod)) return indices.get(lod);
  const n = CELLS[lod], V = n + 1, top = V * V, ring = perimeter(n), out = new Uint16Array(n * n * 6 + 4 * n * 6);
  let p = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const a = r * V + c, b = a + 1, d = a + V, e = d + 1;
    out[p++] = a; out[p++] = d; out[p++] = b; out[p++] = b; out[p++] = d; out[p++] = e;
  }
  for (let q = 0; q < 4 * n; q++) {
    const q1 = (q + 1) % (4 * n), t0 = ring[q], t1 = ring[q1], s0 = top + q, s1 = top + q1;
    out[p++] = t0; out[p++] = t1; out[p++] = s0; out[p++] = t1; out[p++] = s1; out[p++] = s0;
  }
  indices.set(lod, out);
  return out;
}

/** Detail 0 heights in Rapier's order (columns along x, rows along z): 65 x 65. */
export function tileHeights(job) {
  const N = job.n + 1, P = job.n + 3, out = new Float32Array(N * N);
  for (let xi = 0; xi < N; xi++) for (let zi = 0; zi < N; zi++) out[xi * N + zi] = job.H[(zi + 1) * P + xi + 1];
  return out;
}

// The horizon: the whole map as one coarse grid (two cells a tile, 125 m), sunk a little so it never pokes through a
// tile's edge. Its index lists only the tiles that have no mesh of their own.
const HC = 2, SINK = 4;
export function horizonArrays() {
  const G = ASH.tiles * HC, V = G + 1, cell = ASH.size / G, x0 = ASH.site.x - ASH.half, z0 = ASH.site.z - ASH.half;
  const pos = new Float32Array(V * V * 3), nor = new Float32Array(V * V * 3), bw = new Uint8Array(V * V * 4);
  for (let r = 0; r < V; r++) for (let c = 0; c < V; c++) {
    const k = r * V + c;
    pos[k * 3] = c * cell; pos[k * 3 + 1] = heightAt(x0 + c * cell, z0 + r * cell, W) - SINK; pos[k * 3 + 2] = r * cell;
    bw[k * 4] = byte(W.city); bw[k * 4 + 1] = byte(W.spine); bw[k * 4 + 2] = byte(W.dunes); bw[k * 4 + 3] = byte(W.marsh);
  }
  const y = (r, c) => pos[((r < 0 ? 0 : r > G ? G : r) * V + (c < 0 ? 0 : c > G ? G : c)) * 3 + 1];
  for (let r = 0; r < V; r++) for (let c = 0; c < V; c++) {
    const dx = (y(r, c + 1) - y(r, c - 1)) / (2 * cell), dz = (y(r + 1, c) - y(r - 1, c)) / (2 * cell), l = Math.hypot(dx, 1, dz), k = (r * V + c) * 3;
    nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
  }
  return { pos, nor, bw, x0, z0, maxIndex: G * G * 6 };
}
/** Writes the horizon triangles of every tile whose hidden flag is 0 into out; returns how many indices. */
export function horizonIndex(hidden, out) {
  const T = ASH.tiles, V = T * HC + 1;
  let p = 0;
  for (let tj = 0; tj < T; tj++) for (let ti = 0; ti < T; ti++) {
    if (hidden[tj * T + ti]) continue;
    for (let dj = 0; dj < HC; dj++) for (let di = 0; di < HC; di++) {
      const a = (tj * HC + dj) * V + ti * HC + di, b = a + 1, d = a + V, e = d + 1;
      out[p++] = a; out[p++] = d; out[p++] = b; out[p++] = b; out[p++] = d; out[p++] = e;
    }
  }
  return p;
}