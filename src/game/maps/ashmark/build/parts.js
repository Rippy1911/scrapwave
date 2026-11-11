// Shared pieces for the Ashmark's places, laid out with a place-kit frame (world/places/kit.js): F is the frame at
// the site (x right, z toward the back, -z is the front the site faces), y is metres above the site's ground.
// Everything solid gets a box collider; ramps get a wedge that matches the surface you see.
import { rampGeometry } from "@/game/arena/shapes";

const TAG = "ash";
export const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

/** A solid block standing on y. */
export const block = (F, mat, x, y, z, w, h, d, ry = 0) => F.box(mat, x, y + h / 2, z, w, h, d, ry, { collide: true, tag: TAG });
/** A looks-only block standing on y; it may tilt. */
export const deco = (F, mat, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) => F.box(mat, x, y + h / 2, z, w, h, d, ry, { rx, rz });
/** A floor you can drive on, its top at y. */
export const slab = (F, mat, x, y, z, w, d, ry = 0, t = 0.6) => F.box(mat, x, y - t / 2, z, w, t, d, ry, { collide: true, tag: TAG });
/** A round column standing on y. */
export const post = (F, mat, x, y, z, r, h) => F.cyl(mat, x, y + h / 2, z, r, h, { collide: true, tag: TAG, six: r < 0.5 });
/** A ramp standing on y: w wide, len long, h high, its lip toward the front turned by ry. curve 1 is a straight slope. */
export function ramp(F, mat, x, y, z, w, len, h, ry = 0, curve = 1) {
  F.prim(rampGeometry(curve), mat, x, y + h / 2, z, w, h, len, 0, ry);
  F.wedge(x, z, w, len, h, ry, { baseY: F.y + y, curve });
}
export function lamp(F, M, x, y, z, h = 6, red = false) {
  F.cyl(M.dark, x, y + h / 2, z, 0.12, h, { six: true });
  F.ball(red ? M.redLight : M.lamp, x, y + h + 0.2, z, 0.3);
}
/** A burnt-out car: a low collider and a cabin. */
export function wreck(F, M, x, y, z, ry = 0, mat = M.rust) {
  block(F, mat, x, y, z, 1.9, 0.8, 4.2, ry);
  deco(F, M.dark, x, y + 0.8, z, 1.7, 0.6, 2.1, ry);
}
/** A shipping container, 2.6 x 2.6 x 6.1. */
export const container = (F, mat, x, y, z, ry = 0) => block(F, mat, x, y, z, 2.6, 2.6, 6.1, ry);
/** A shack: one solid box under a tilted roof sheet. */
export function shack(F, M, x, y, z, w, d, h, ry = 0, wall = M.corrugated) {
  block(F, wall, x, y, z, w, h, d, ry);
  F.box(M.rust, x, y + h + 0.2, z, w + 0.9, 0.14, d + 0.9, ry, { rz: 0.08 });
}
export function fireDrum(F, M, x, y, z) {
  post(F, M.rust, x, y, z, 0.32, 0.9);
  F.cone(M.fire, x, y + 1.2, z, 0.26, 0.7);
}
/** Loose blocks strewn inside radius r (looks only), the same every visit. */
export function rubble(F, mat, x, y, z, r, count, seed = 1) {
  for (let i = 0; i < count; i++) {
    const a = hash(i, seed) * 6.283, d = Math.sqrt(hash(i, seed + 3)) * r, s = 0.5 + hash(i, seed + 5) * 1.8;
    deco(F, mat, x + Math.sin(a) * d, y - 0.15, z + Math.cos(a) * d, s * 1.4, s * 0.7, s, hash(i, seed + 7) * 3.1, hash(i, seed + 9) * 0.5 - 0.25, hash(i, seed + 11) * 0.5 - 0.25);
  }
}
/** A name board on two legs facing the front. */
export function board(F, M, mat, x, y, z, w = 8, h = 2.4, ry = 0) {
  F.box(mat, x, y + 3.2 + h / 2, z, w, h, 0.16, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const k of [-1, 1]) F.cyl(M.dark, x + k * (w / 2 - 0.5) * c, y + 1.6, z - k * (w / 2 - 0.5) * s, 0.12, 3.2, { six: true });
}
/** An outpost's working corner: the trader's stall with its awning, crates and a lamp. */
export function stall(F, M, x, y, z, ry = 0) {
  block(F, M.wood, x, y, z, 4.2, 1.1, 1.2, ry);
  F.box(M.cloth, x, y + 3, z, 5, 0.08, 3, ry, { rx: 0.12 });
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const k of [-1, 1]) F.cyl(M.wood, x + k * 2.3 * c, y + 1.5, z - k * 2.3 * s, 0.08, 3, { six: true });
  block(F, M.wood, x + 3.4 * c, y, z - 3.4 * s, 1.2, 1.2, 1.2, ry + 0.3);
  lamp(F, M, x - 3.2 * c, y, z + 3.2 * s, 4);
}