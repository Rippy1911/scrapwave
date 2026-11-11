// Cut and fill for the Ashmark: makeGrade() returns the function height.js calls for every ground sample. Inside a
// road's bed (half its width plus MARGIN) or a site's pad the ground is the road's or pad's height; past that it
// eases back to the ground around it over a distance that grows with the height of the cut or fill (8 to 44 m), so
// a shallow road barely marks the land and a deep cut gets a slope and not a wall. Where beds meet, what was laid
// last goes on first: pads, then tracks, then the roads they join. So a road keeps its own surface through every
// junction and the ground eases from one bed into the next with no step. Road stretches on a deck (bridges) leave
// the ground alone. Lookups go through a 40 m grid, so ground far from any road pays one array read.
import { ASH } from "@/game/maps/ashmark/layout";
import { smoothstep } from "@/game/core/rng";

export const MARGIN = 5; // level ground past the edge of the road surface
const CELL = 40, N = Math.ceil(ASH.size / CELL), REACH = 44, PIT = 4, SEG = 8;
const cellOf = (v) => { const c = ((v + ASH.half) / CELL) | 0; return c < 0 ? 0 : c >= N ? N - 1 : c; };

/** roads (in the order they were laid): [{ w, loop, pts: [{ x, z, y, deck }] }]   pads: [{ x, z, r, y, pit }]. */
export function makeGrade(roads, pads) {
  const cells = new Array(N * N), seg = []; // seg: 8 numbers each: ax, az, ay, bx, bz, by, flat, road index
  const put = (x0, z0, x1, z1, reach, v) => {
    for (let j = cellOf(Math.min(z0, z1) - reach); j <= cellOf(Math.max(z0, z1) + reach); j++) for (let i = cellOf(Math.min(x0, x1) - reach); i <= cellOf(Math.max(x0, x1) + reach); i++) {
      const k = j * N + i;
      (cells[k] || (cells[k] = [])).push(v);
    }
  };
  // Every cell's list ends up in laying order: the roads first to last, then the pads.
  roads.forEach((R, r) => {
    const P = R.pts, n = P.length, last = R.loop ? n : n - 1, flat = R.w / 2 + MARGIN;
    for (let i = 0; i < last; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if (a.deck && b.deck) continue; // the fill ends under the first deck sample, where the deck takes over
      put(a.x, a.z, b.x, b.z, flat + REACH, seg.length / SEG);
      seg.push(a.x, a.z, a.y, b.x, b.z, b.y, flat, r);
    }
  });
  pads.forEach((p, k) => put(p.x, p.z, p.x, p.z, p.r + REACH, -1 - k));
  const S = Float64Array.from(seg);

  return function grade(x, z, h) {
    const L = cells[cellOf(z) * N + cellOf(x)];
    if (!L) return h;
    // Backwards through the list, one layer (a pad, or all of one road's stretches) at a time. Within a road the
    // strongest pull counts, and inside its bed (all pull fully) the nearest stretch.
    let layer = 0, bw = 0, by = 0, bd = 0;
    for (let q = L.length - 1; q >= 0; q--) {
      const k = L[q];
      let d, y, flat, id;
      if (k < 0) {
        const p = pads[-1 - k];
        d = Math.hypot(x - p.x, z - p.z); y = p.y; flat = p.r; id = k;
        if (p.pit && d < p.r * 0.5) y -= PIT * smoothstep(p.r * 0.5, p.r * 0.28, d); // a sunk middle with a ramp down
      } else {
        const o = k * SEG, ax = S[o], az = S[o + 1], dx = S[o + 3] - ax, dz = S[o + 4] - az;
        let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        d = Math.hypot(ax + dx * t - x, az + dz * t - z); y = S[o + 2] + (S[o + 5] - S[o + 2]) * t; flat = S[o + 6]; id = S[o + 7] + 1;
      }
      if (id !== layer) { if (bw > 0) h += (by - h) * bw; layer = id; bw = 0; }
      const far = Math.abs(h - y) * 1.5, B = far < 8 ? 8 : far > REACH ? REACH : far;
      const w = d <= flat ? 1 : d >= flat + B ? 0 : smoothstep(flat + B, flat, d);
      if (w > bw || (w === bw && w > 0 && d < bd)) { bw = w; by = y; bd = d; }
    }
    return bw > 0 ? h + (by - h) * bw : h;
  };
}