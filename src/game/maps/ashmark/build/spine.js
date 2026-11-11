// The Spine's four places. K: { F (frame at the site, -z is its front), F0 (map frame: map coordinates, world
// heights), M (materials), S (the placed site), net (the laid-out roads) }. The dam and the gallery follow their
// road's samples, so they are laid out in the map frame.
import { block, deco, slab, post, ramp, lamp, shack, rubble } from "@/game/maps/ashmark/build/parts";
import { bridge } from "@/game/maps/ashmark/build/bridge";

const TAG = "ash";

// Greywater Dam: the wall stands under the crest road on both sides of the blown-out gate (24 m, the sluiceway road
// runs through it); the deck still carries the road across the hole.
function dam({ F, F0, M, net }) {
  const R = net.roads.get("rim"), sp = R.span, P = R.pts, c = P[sp.c];
  bridge(F0, M, R, { piers: false });
  for (let i = sp.a; i < sp.b; i++) {
    const a = P[i], b = P[i + 1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    if (!(a.deck && b.deck) || Math.hypot(mx - c.x, mz - c.z) < 12) continue;
    const g = Math.min(F0.groundY(a.x, a.z), F0.groundY(b.x, b.z)) - 2, h = a.y - 1.2 - g;
    F0.box(M.concrete, mx, g + h / 2, mz, 15, h, Math.hypot(b.x - a.x, b.z - a.z) + 0.3, Math.atan2(b.x - a.x, b.z - a.z), { collide: true, tag: TAG });
  }
  for (const k of [-1, 1]) {
    block(F, M.concrete, 6.2, -1.2, k * 15, 2.4, 6.4, 4); // the gate towers on the wall beside the road
    lamp(F, M, 6.2, 5.2, k * 15, 2, true);
    deco(F, M.rust, 2, -9, k * 11.4, 7, 8, 0.5, 0, 0, k * 0.3); // what is left of the gate
  }
}

// Signal Crown: the relay mast on the levelled summit, its red lamp lit.
function mast({ F, M }) {
  const T = 62, leg = (kx, kz, y) => [kx * (3.2 - (2.7 * y) / T), y, kz * (3.2 - (2.7 * y) / T)];
  for (const kx of [-1, 1]) for (const kz of [-1, 1]) F.beam(M.rust, leg(kx, kz, 0), leg(kx, kz, T), 0.16);
  for (let y = 6; y < T; y += 8) {
    F.beam(M.rust, leg(-1, -1, y), leg(1, -1, y + 8 > T ? T : y + 8), 0.07);
    F.beam(M.rust, leg(1, 1, y), leg(-1, 1, y + 8 > T ? T : y + 8), 0.07);
    F.beam(M.rust, leg(-1, 1, y), leg(-1, -1, y), 0.07);
    F.beam(M.rust, leg(1, -1, y), leg(1, 1, y), 0.07);
  }
  F.collider(0, T / 2, 0, 4, T, 4, 0, { tag: TAG });
  F.ball(M.redLight, 0, T + 0.6, 0, 0.7);
  F.cone(M.chrome, 1.6, 40, -1.2, 1.4, 0.8, { rx: Math.PI / 2 });
  F.cone(M.chrome, -1.5, 46, 1.2, 1.1, 0.7, { rx: -Math.PI / 2 });
  shack(F, M, 10, 0, 6, 5, 4, 2.8);
  for (const [x, z] of [[16, -12], [-16, -12], [0, 19]]) { block(F, M.concrete, x, 0, z, 1.6, 1, 1.6); F.beam(M.dark, [x, 1, z], [x * 0.05, 44, z * 0.05], 0.04); }
  lamp(F, M, 7, 0, -4, 4);
  rubble(F, M.rock, -12, 0, 10, 8, 10, 4);
}

// Coldwater Gallery: a rock-fall roof over 120 m of the sluiceway road, a wall on one side and columns on the other.
function tunnel({ F, F0, M, S, net }) {
  const P = net.roads.get("gorge").pts, e0 = P[S.at - 5], e1 = P[S.at + 5]; // this leg of the road is straight
  const ry = Math.atan2(e1.x - e0.x, e1.z - e0.z), c = Math.cos(ry), s = Math.sin(ry);
  for (let i = S.at - 5; i < S.at + 5; i++) {
    const a = P[i], b = P[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z) + 0.3, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, y = Math.max(a.y, b.y);
    F0.box(M.concrete, mx, y + 6, mz, 12.6, 0.8, l, ry, { collide: true, tag: TAG });
    F0.box(M.concrete, mx - 5.8 * c, y + 2.8, mz + 5.8 * s, 0.9, 5.6, l, ry, { collide: true, tag: TAG });
    F0.cyl(M.concrete, a.x + 5.8 * c, y + 2.8, a.z - 5.8 * s, 0.45, 5.6, { collide: true, tag: TAG });
    if (i % 4 < 2) F0.ball(M.lamp, mx, y + 5.4, mz, 0.22); // half the roof lights still work
  }
  for (const e of [e0, e1]) F0.box(M.hazard, e.x, e.y + 5.1, e.z, 12.6, 0.9, 0.5, ry); // the portals
  rubble(F, M.rock, -3, 6.6, 0, 16, 22, 3);
  for (let i = 0; i < 5; i++) F.ball(M.rock, -4 + i * 1.7, 7.2, -16 + i * 8, 1.4 + (i % 2) * 0.7, { sy: 0.7 });
}

// Kestrel Drop: a launch ramp at the cliff edge, in line with the spur that leads to it.
function launch({ F, M }) {
  ramp(F, M.rust, 0, 0, -14, 8, 18, 5, 0, 1.6);
  for (const k of [-1, 1]) {
    deco(F, M.hazard, k * 4.3, 0, -2, 0.5, 0.9, 8);
    F.beam(M.dark, [k * 3.6, 4.6, -22.6], [k * 3.6, -9, -17], 0.14);
    lamp(F, M, k * 5.4, 0, 4, 4, true);
  }
  post(F, M.dark, 9, 0, -8, 0.1, 6);
  F.cone(M.cloth, 9.9, 5.8, -8, 0.35, 1.8, { rz: -Math.PI / 2 }); // windsock
  slab(F, M.rust, 0, 0.05, 6, 8, 16, 0, 0.3);
  shack(F, M, -13, 0, 8, 4, 4, 2.6);
}

export const SPINE = { dam, mast, tunnel, launch };