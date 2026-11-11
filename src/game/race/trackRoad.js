// Geometry for a race track (race/track.js): the road ribbon, the kerbs, and for raised road (ramps, bridges) the
// slab under it plus one hull collider per 2 m of slab. Looks and collider data only; race/trackMesh.js adds them.
import * as THREE from "three";
import { TRACK } from "@/game/race/track";

const SLAB = 0.8, RED = [0.62, 0.1, 0.07], WHITE = [0.82, 0.79, 0.72];

// Collects quads. Corners: a -> b across, a -> c along; the face looks toward (b - a) x (c - a).
function mesher() {
  const pos = [], nor = [], uv = [], col = [], index = [];
  return {
    quad(a, b, c, d, o = {}) {
      const at = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d);
      if (o.n) nor.push(...o.n[0], ...o.n[0], ...o.n[1], ...o.n[1]);
      if (o.uv) uv.push(...o.uv);
      if (o.col) for (let k = 0; k < 4; k++) col.push(...o.col);
      index.push(at, at + 1, at + 2, at + 1, at + 3, at + 2);
    },
    done() {
      if (!index.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      if (uv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      if (col.length) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(index);
      if (nor.length) g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); else g.computeVertexNormals();
      return g;
    },
  };
}

export function buildRoadGeometry(track) {
  const S = track.samples, N = track.n, ds = track.step, idx = track.idx;
  const road = mesher(), kerbs = mesher(), slab = mesher(), hulls = [];
  // A point on sample p, `off` metres right of the centre, `up` above the road.
  const P = (p, off, up = 0) => [p.x + p.nx * off, p.y + up, p.z + p.nz * off];
  const normal = (i) => { // up, tipped back by the slope
    const p = S[i], q = S[idx(i + 1)], r = S[idx(i - 1)], slope = track.road(i) && track.road(idx(i - 1)) ? (q.y - r.y) / (2 * ds) : 0;
    const l = Math.hypot(slope, 1);
    return [(-p.tx * slope) / l, 1 / l, (-p.tz * slope) / l];
  };

  for (let i = 0; i < N; i++) {
    if (!track.road(i)) continue;
    const a = S[i], b = S[idx(i + 1)], ha = a.w / 2, hb = b.w / 2;
    const sa = a.s, sb = a.s + ds; // not b.s: the last piece of a lap would run its texture backwards
    road.quad(P(a, -ha, 0.06), P(a, ha, 0.06), P(b, -hb, 0.06), P(b, hb, 0.06), {
      n: [normal(i), normal(idx(i + 1))], uv: [0, sa / (a.w * 1.4), 1, sa / (a.w * 1.4), 0, sb / (b.w * 1.4), 1, sb / (b.w * 1.4)],
    });
    if (a.kerb) {
      const col = Math.floor(a.s / 2) % 2 ? RED : WHITE, k = TRACK.kerbW;
      kerbs.quad(P(a, -ha, 0.1), P(a, -ha + k, 0.1), P(b, -hb, 0.1), P(b, -hb + k, 0.1), { col });
      kerbs.quad(P(a, ha - k, 0.1), P(a, ha, 0.1), P(b, hb - k, 0.1), P(b, hb, 0.1), { col });
    }
    if (Math.max(a.lift, b.lift) < 0.05) continue;
    // Raised road: sides, underside and end faces of the slab, and its collider.
    const la = P(a, -ha), ra = P(a, ha), lb = P(b, -hb), rb = P(b, hb);
    const la2 = P(a, -ha, -SLAB), ra2 = P(a, ha, -SLAB), lb2 = P(b, -hb, -SLAB), rb2 = P(b, hb, -SLAB);
    slab.quad(la, lb, la2, lb2);
    slab.quad(ra, ra2, rb, rb2);
    slab.quad(ra2, la2, rb2, lb2);
    if (!track.road(idx(i - 1))) slab.quad(ra, la, ra2, la2);
    if (!track.road(idx(i + 1))) slab.quad(lb, rb, lb2, rb2);
    hulls.push([la, ra, lb, rb, la2, ra2, lb2, rb2]);
  }
  return { road: road.done(), kerbs: kerbs.done(), slab: slab.done(), hulls };
}