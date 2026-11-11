// A race world's layout (round 15, section D): maps/layout.js plus the road. The track is a list of points
// (maps/race/trackPath.js); zone() places things along it; buildings go to the chunked, instanced city
// (maps/race/chunks.js) and not into the merged pieces. Plain data: the loader builds it, the map card draws it.
//   look: floor, outer, tint, sky, landmark, facade ("night" lit windows | "ruin"), zombies, lapTime (s), margin (m)
import { createLayout } from "@/game/maps/layout";
import { buildSpline } from "@/game/race/spline";
import { BLD } from "@/game/maps/race/buildings";

export function createRaceLayout({ track, margin = 110, ...look }) {
  const B = createLayout({ wall: null, facade: "night", ...look });
  const L = B.L, P = track.points, line = buildSpline(P, { closed: true, step: 4, width: track.width || 14 }), S = line.samples;
  for (const p of S) { p.r = Math.atan2(p.tx, p.tz); p.zone = P[p.seg].zone || null; }
  Object.assign(L, { track, blds: [], bits: [], lap: line.length });
  B.samples = S;

  /** fn(p, side) every `every` metres of road inside a zone (null: the whole lap). p: the road there (x, z, y, w,
   *  r = the turn that lays a box's depth along the road). side(d, f) = [x, z], d m right of the centre, f m on. */
  B.zone = (name, every, fn) => {
    const st = Math.max(1, Math.round(every / line.step));
    let k = 0;
    for (const p of S) {
      if (name && p.zone !== name) { k = 0; continue; }
      if (k++ % st === 0) fn(p, (d, f = 0) => [p.x + p.nx * d + p.tx * f, p.z + p.nz * d + p.tz * f]);
    }
  };
  /** A building from a template (maps/race/buildings.js): solid, instanced, tinted c (0-4). */
  B.bld = (t, x, z, r = 0, c = 0, y = 0) => { const [w, h, d] = BLD[t], b = { t, x, z, y, r, c, w, h, d }; L.blds.push(b); return b; };
  /** A small looks-only box drawn only near the camera (lamps, signs, roof clutter). m: material key or "lit:#hex". */
  B.bit = (m, x, y, z, w, h, d, r = 0) => L.bits.push({ m, x, y, z, w, h, d, r });
  /** A ring of n boxes round (x, z): crater rims, tank walls. */
  B.rim = (m, x, z, rad, n, h, thick, solid = true) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = (2 * Math.PI * rad) / n + 0.6;
      (solid ? B.solid : B.deco)(m, x + Math.sin(a) * rad, z + Math.cos(a) * rad, w, h * (0.7 + 0.6 * ((i * 7) % 5) / 4), thick, a);
    }
  };

  const done = B.done;
  B.done = () => {
    let hx = 0, hz = 0;
    for (const p of [...S, ...L.blds]) { hx = Math.max(hx, Math.abs(p.x)); hz = Math.max(hz, Math.abs(p.z)); }
    L.half = [Math.ceil(hx + margin), Math.ceil(hz + margin)];
    L.R = Math.max(L.half[1] / 1.05, L.half[0] / 1.87); // the radius the map cards fit into their picture
    L.path = S.filter((p, i) => i % 2 === 0).map((p) => [p.x, p.z, p.gap ? 1 : 0, p.w, p.y]);
    return done();
  };
  return B;
}