// Tile streaming for the Ashmark. Around the camera: detail 0 tiles near, detail 1 and 2 further out, and past the
// last ring the horizon mesh. Around every simulated vehicle: 3 x 3 collider tiles (5 x 5 for a fast flyer), which
// are always detail 0. Tiles build a few rows per frame inside a time budget, collider tiles first, then nearest
// first; a tile that falls out of range frees its mesh, its heights and its collider at once.
import { ASH, tileX0, tileZ0, tileI, tileJ } from "@/game/maps/ashmark/layout";
import { startTile, stepTile, tileArrays, tileHeights } from "@/game/maps/ashmark/tileData";

export const RINGS = [430, 860, 1320]; // metres from the camera to a tile's centre: detail 0, 1, 2
const KEEP = 45; // a tile keeps its detail this far past its ring, so a ring's edge never flickers
export const BUDGET_MS = 4; // height sampling per frame; the mesh and collider hand-over adds about 1 ms

export function createStreamer({ gfx, colliders, now }) {
  const T = ASH.tiles, HALF = ASH.tile / 2, recs = new Map(), hidden = new Uint8Array(T * T);
  const S = { last: 0, max: 0, built: 0, freed: 0 };
  let stamp = 0, scale = 1, horizonDirty = true;
  const rec = (i, j) => {
    const k = j * T + i;
    let r = recs.get(k);
    if (!r) recs.set(k, (r = { k, i, j, lod: -1, eff: -1, want: -1, mesh: null, colH: null, col: false, wantCol: false, job: null, d: 0, seen: 0, colStamp: 0 }));
    return r;
  };
  function free(r) {
    if (r.mesh) { gfx.removeTile(r.mesh); hidden[r.k] = 0; horizonDirty = true; }
    if (r.col) colliders.remove(r.k);
    recs.delete(r.k);
    S.freed++;
  }
  function finish(r) {
    const job = r.job, old = r.mesh;
    r.mesh = gfx.addTile(tileArrays(job), tileX0(r.i), tileZ0(r.j));
    if (old) gfx.removeTile(old);
    r.colH = job.lod === 0 ? tileHeights(job) : null;
    r.lod = job.lod; r.job = null;
    S.built++;
    if (!hidden[r.k]) { hidden[r.k] = 1; horizonDirty = true; }
  }
  const pri = (r) => (r.wantCol ? 0 : 1e6) + r.eff * 300 + r.d;

  return {
    setScale(s) { scale = s; },
    /** Decides what every tile should be. vehicles: [{ x, z, wide }] (wide = 5 x 5 colliders). */
    update(camX, camZ, vehicles) {
      stamp++;
      const R = RINGS.map((r) => r * scale), reach = R[2] + KEEP, ci = tileI(camX), cj = tileJ(camZ), span = Math.ceil(reach / ASH.tile) + 1;
      for (let j = Math.max(0, cj - span); j <= Math.min(T - 1, cj + span); j++) for (let i = Math.max(0, ci - span); i <= Math.min(T - 1, ci + span); i++) {
        const d = Math.hypot(tileX0(i) + HALF - camX, tileZ0(j) + HALF - camZ);
        if (d > reach) continue;
        const old = recs.get(j * T + i);
        let lod = d < R[0] ? 0 : d < R[1] ? 1 : d < R[2] ? 2 : -1;
        if (old && old.want >= 0 && (lod < 0 || lod > old.want) && d < R[old.want] + KEEP) lod = old.want;
        if (lod < 0) continue;
        const r = old || rec(i, j);
        r.want = lod; r.d = d; r.seen = stamp;
      }
      for (const v of vehicles) {
        const vi = tileI(v.x), vj = tileJ(v.z), k = v.wide ? 2 : 1;
        for (let j = Math.max(0, vj - k); j <= Math.min(T - 1, vj + k); j++) for (let i = Math.max(0, vi - k); i <= Math.min(T - 1, vi + k); i++) {
          const r = rec(i, j);
          if (r.seen !== stamp) { r.seen = stamp; r.want = -1; r.d = Math.hypot(tileX0(i) + HALF - camX, tileZ0(j) + HALF - camZ); }
          r.colStamp = stamp;
        }
      }
      for (const r of Array.from(recs.values())) {
        r.wantCol = r.colStamp === stamp;
        if (!r.wantCol && r.col) { colliders.remove(r.k); r.col = false; }
        r.eff = r.seen !== stamp ? -1 : r.wantCol ? 0 : r.want;
        if (r.eff < 0) free(r);
        else if (r.lod === r.eff) r.job = null;
        else if (!r.job || r.job.lod !== r.eff) r.job = startTile(r.i, r.j, r.eff);
      }
    },
    /** Runs tile jobs until the budget is spent. Returns the milliseconds this call took. */
    pump(budgetMs = BUDGET_MS) {
      const t0 = now(), deadline = t0 + budgetMs;
      for (;;) {
        let best = null;
        for (const r of recs.values()) if (r.job && (!best || pri(r) < pri(best))) best = r;
        if (!best) break;
        if (stepTile(best.job, deadline, now)) finish(best);
        if (now() >= deadline) break;
      }
      if (colliders.ready()) for (const r of recs.values()) {
        if (!r.wantCol || r.col || !r.colH) continue;
        r.col = colliders.add(r.k, r.i, r.j, r.colH);
        if (now() >= deadline) break;
      }
      if (horizonDirty) { gfx.setHorizon(hidden); horizonDirty = false; }
      S.last = now() - t0;
      if (S.last > S.max) S.max = S.last;
      return S.last;
    },
    /** True when every collider tile around (x, z) is live: 3 x 3, clipped at the map edge. */
    readyAround(x, z) {
      const vi = tileI(x), vj = tileJ(z);
      for (let j = Math.max(0, vj - 1); j <= Math.min(T - 1, vj + 1); j++) for (let i = Math.max(0, vi - 1); i <= Math.min(T - 1, vi + 1); i++) {
        const r = recs.get(j * T + i);
        if (!r || !r.col) return false;
      }
      return true;
    },
    resetMax() { S.max = 0; },
    stats() {
      const byLod = [0, 0, 0];
      let pending = 0, colliders_ = 0;
      for (const r of recs.values()) { if (r.mesh) byLod[r.lod]++; if (r.job) pending++; if (r.col) colliders_++; }
      return { tiles: byLod[0] + byLod[1] + byLod[2], byLod, pending, colliders: colliders_, lastMs: S.last, maxMs: S.max, built: S.built, freed: S.freed };
    },
    clear() {
      for (const r of Array.from(recs.values())) free(r);
      hidden.fill(0); horizonDirty = true;
      S.last = S.max = 0;
    },
  };
}