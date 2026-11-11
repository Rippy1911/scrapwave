// The Drownings' four places. K: { F (frame at the site, -z is its front), M (materials), S (the placed site) }.
// Each stands on a dry pad 1.3 m above the water; what reaches past the pad stands on legs in the marsh.
import { block, deco, slab, post, ramp, lamp, wreck, container, shack, fireDrum, rubble, hash } from "@/game/maps/ashmark/build/parts";

// Stiltwick: five huts on poles in a ring round the dry rise, joined by boardwalks you can (just) drive.
function stilt({ F, M }) {
  const N = 5, R = 38, Y = 3.2, at = (i) => { const a = (i / N) * 6.283; return [Math.sin(a) * R, Math.cos(a) * R, a]; };
  for (let i = 0; i < N; i++) {
    const [x, z, a] = at(i), [nx, nz] = at((i + 1) % N), dx = nx - x, dz = nz - z;
    slab(F, M.wood, x, Y, z, 10, 10, a, 0.4);
    for (const kx of [-1, 1]) for (const kz of [-1, 1]) post(F, M.wood, x + kx * 4, -2.5, z + kz * 4, 0.2, 5.3);
    shack(F, M, x + Math.sin(a) * 1.5, Y, z + Math.cos(a) * 1.5, 5, 5, 2.6, a, i % 2 ? M.wood : M.corrugated);
    deco(F, M.dark, x - Math.sin(a) * 1.05, Y, z - Math.cos(a) * 1.05, 1.2, 2, 0.1, a); // the door stands open
    slab(F, M.wood, x + dx / 2, Y, z + dz / 2, Math.hypot(dx, dz) - 9, 3.4, Math.atan2(-dz, dx), 0.3);
    if (i % 2 === 0) lamp(F, M, x + 4.4, Y, z - 4.4, 3);
  }
  ramp(F, M.wood, 0, 0, 27, 4, 12, Y, Math.PI, 1);
  for (let i = 0; i < 7; i++) { const a = hash(i, 3) * 6.283; post(F, M.wood, Math.sin(a) * 48, -2.5, Math.cos(a) * 48, 0.14, 4.4 + hash(i, 5)); } // mooring poles
  fireDrum(F, M, 5, 0, -6);
  wreck(F, M, -9, 0, 4, 0.9);
}

// The Lowtide Ferry: aground at the slipway with its bow ramp down and its car deck still full.
function ferry({ F, M }) {
  const hull = M.paint("#2f4a52");
  block(F, hull, 0, -2, 26, 12, 5, 44);
  ramp(F, M.rust, 0, 0, -3, 8, 14, 3, Math.PI, 1);
  for (const k of [-1, 1]) block(F, hull, k * 5.8, 3, 26, 0.4, 1.2, 44);
  block(F, M.bone, 0, 3, 43, 11, 5, 8);
  deco(F, M.glass, 0, 5.8, 38.9, 9, 1.3, 0.1);
  post(F, M.rust, 0, 8, 44, 0.9, 3.5);
  for (let i = 0; i < 6; i++) wreck(F, M, i % 2 ? 2.9 : -2.9, 3, 11 + Math.floor(i / 2) * 9, (i % 3) * 0.08, i % 3 ? M.rust : M.paint("#6b5a2a"));
  deco(F, M.concrete, 0, 0, -16, 12, 0.12, 14);
  for (const k of [-1, 1]) { post(F, M.dark, k * 8, 0, -4, 0.35, 1.1); lamp(F, M, k * 8, 0, -18, 5); }
  shack(F, M, -18, 0, -8, 5, 4, 2.8, 0.3);
  container(F, M.paint("#7a3b26"), 17, 0, -12, 1.2);
}

// Blackwell Rig: the causeway runs up a ramp onto the platform; the derrick stands in the middle and the flare
// stack still burns off what comes up.
function rig({ F, M }) {
  const Y = 8, T = 38, leg = (kx, kz, y) => [kx * (4 - (3.4 * (y - Y)) / (T - Y)), y, kz * (4 - (3.4 * (y - Y)) / (T - Y))];
  slab(F, M.rust, 0, Y, 0, 26, 26, 0, 0.8);
  for (const kx of [-1, 1]) for (const kz of [-1, 1]) {
    post(F, M.rust, kx * 11, -4, kz * 11, 1.2, Y + 3.2);
    F.beam(M.dark, leg(kx, kz, Y), leg(kx, kz, T), 0.16);
  }
  for (let y = Y + 5; y < T; y += 6) for (const k of [-1, 1]) {
    F.beam(M.dark, leg(-1, k, y), leg(1, k, y), 0.07);
    F.beam(M.dark, leg(k, -1, y), leg(k, 1, y), 0.07);
  }
  F.collider(0, Y + 6, 0, 1.2, 12, 1.2, 0, { tag: "ash" }); // the drill string
  F.cyl(M.chrome, 0, Y + 6, 0, 0.4, 12, { six: true });
  F.ball(M.redLight, 0, T + 0.5, 0, 0.5);
  ramp(F, M.rust, 0, 0, -25, 7, 24, Y, Math.PI, 1);
  F.beam(M.rust, [12, Y, 12], [24, Y + 9, 24], 0.3); // the flare boom
  F.cone(M.fire, 24.4, Y + 10.6, 24.4, 1.1, 3.4);
  block(F, M.rust, 0, Y, 12.8, 26, 1, 0.4);
  for (const k of [-1, 1]) { block(F, M.rust, k * 12.8, Y, 0, 0.4, 1, 26); block(F, M.rust, k * 8.4, Y, -12.8, 9.2, 1, 0.4); }
  shack(F, M, -8, Y, 7, 5, 5, 2.8);
  container(F, M.paint("#5b6b3a"), 8.5, Y, 6, 0.1);
  for (let i = 0; i < 4; i++) post(F, M.paint("#8a2a1a"), -9 + i * 1.1, Y, -8, 0.32, 0.95);
  F.cyl(M.dark, 6, Y + 0.4, -6, 0.3, 12, { rz: Math.PI / 2, six: true });
  lamp(F, M, -11, Y, -11, 4);
  lamp(F, M, 11, Y, -11, 4);
}

// The Reedbed: a drowned landing the reeds have taken, and what nests in them.
function nest({ F, M }) {
  for (let i = 0; i < 70; i++) {
    const a = hash(i, 2) * 6.283, d = 10 + Math.sqrt(hash(i, 4)) * 34, h = 2 + hash(i, 6) * 1.6;
    F.cone(M.tarp, Math.sin(a) * d, h / 2 - 0.4, Math.cos(a) * d, 0.14, h, { rx: hash(i, 8) * 0.3 - 0.15, rz: hash(i, 10) * 0.3 - 0.15 });
  }
  for (let i = 0; i < 6; i++) { // nest mounds, bones on top
    const a = (i / 6) * 6.283 + 0.4, x = Math.sin(a) * (12 + (i % 2) * 9), z = Math.cos(a) * (12 + (i % 2) * 9);
    F.ball(M.dark, x, 0.2, z, 2.4, { sy: 0.45 });
    F.beam(M.bone, [x - 0.8, 1.1, z], [x + 0.9, 1.5, z + 0.4], 0.07);
    F.ball(M.bone, x + 0.3, 1.3, z - 0.5, 0.22);
  }
  slab(F, M.wood, 0, 1.4, -20, 5, 22, 0, 0.3); // what is left of the landing
  deco(F, M.wood, 4, 0, -4, 5, 0.3, 9, 0.3, 0.25, 0.1);
  shack(F, M, 16, 0, -22, 5, 4, 2.6, 0.2, M.wood);
  deco(F, M.wood, 13, -0.6, 16, 2.2, 1.1, 6, 0.8, 0, 0.5); // a boat on its side
  for (let i = 0; i < 4; i++) { const x = -6 + i * 4; post(F, M.wood, x, 0, 6 + (i % 2) * 3, 0.1, 3.2); F.box(M.cloth, x, 2.6, 6 + (i % 2) * 3 + 0.3, 0.05, 1, 0.5, 0, { rz: 0.2 }); }
  rubble(F, M.wood, -4, 0, 14, 10, 12, 5);
}

export const MARSH = { stilt, ferry, rig, nest };