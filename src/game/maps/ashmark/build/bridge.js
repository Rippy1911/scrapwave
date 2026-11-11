// A bridge's structure along a laid-out road span (roads.js): a level concrete deck with a parapet on each side,
// piers down to the ground under it, and at a gap a launch lip on each side. The deck ends exactly at the span's
// two lips (a sample over the gap is built at its lip), so the gap is as wide as roadNet.js asks. The ribbon mesh
// is the road surface; this is what carries it. F0 is a kit frame at the map's origin with y 0, so its coordinates
// are map coordinates and heights are world heights.
import { ramp } from "@/game/maps/ashmark/build/parts";

const TAG = "ash";

/** o.piers false leaves the piers out (the dam stands under its own crest). */
export function bridge(F0, M, R, o = {}) {
  const P = R.pts, sp = R.span, w = R.w;
  for (let i = sp.a; i < sp.b; i++) {
    if (!(P[i].deck && P[i + 1].deck) || (P[i].gap && P[i + 1].gap)) continue;
    const a = P[i].lip || P[i], b = P[i + 1].lip || P[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) + 0.3, ry = Math.atan2(dx, dz);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, c = Math.cos(ry), s = Math.sin(ry), e = w / 2 + 0.55;
    F0.box(M.concrete, mx, a.y - 0.6, mz, w + 1.6, 1.2, l, ry, { collide: true, tag: TAG });
    for (const k of [-1, 1]) F0.box(M.concrete, mx + k * e * c, a.y + 0.45, mz - k * e * s, 0.5, 0.9, l, ry, { collide: true, tag: TAG });
    if (o.piers === false || i % 2 || P[i].gap) continue;
    const g = F0.groundY(a.x, a.z) - 1.5, h = a.y - 1.2 - g;
    if (h > 1) F0.box(M.concrete, a.x, g + h / 2, a.z, 2.4, h, 2.4, ry, { collide: true, tag: TAG });
  }
  if (!sp.lips) return;
  sp.lips.forEach((e, k) => { // e: the deck's end; (dx, dz) points along the road, so toward the gap for the first lip
    const dx = k ? -e.dx : e.dx, dz = k ? -e.dz : e.dz;
    ramp(F0, M.rust, e.x - dx * 5, e.y, e.z - dz * 5, w - 2, 9, 1.5, Math.atan2(-dx, -dz), 1.4);
  });
}