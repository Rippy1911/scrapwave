// Old Varrow's four places. K: { F (frame at the site, -z is its front), M (materials), S (the placed site), sign }.
// Every place stands on its level pad; heights are metres above it.
import { block, deco, slab, post, ramp, lamp, wreck, fireDrum, rubble } from "@/game/maps/ashmark/build/parts";

const H = Math.PI / 2;

// Halcyon Block: the stair core of a fallen tower, the lift motor still on top. A fallen floor leans on the first
// landing, so you can drive up onto it and off its far edge.
function tower({ F, M }) {
  block(F, M.concrete, 0, 0, 6, 9, 46, 9);
  block(F, M.rust, 0, 46, 6, 4, 2.6, 4);
  F.ball(M.redLight, 0, 49.2, 6, 0.5);
  for (let k = 0; k < 4; k++) deco(F, M.concrete, k % 2 ? 7 : -7, 12 + k * 8, 6, 8, 0.5, 9, 0, 0, (k % 2 ? -1 : 1) * 0.12); // floor stubs
  slab(F, M.concrete, 0, 6, -6, 20, 12);
  for (const k of [-1, 1]) block(F, M.concrete, k * 8.5, 0, -10.5, 1.2, 5.4, 1.2);
  ramp(F, M.concrete, -21, 0, -6, 10, 22, 6, -H, 1);
  deco(F, M.concrete, 22, 0, 12, 16, 0.7, 10, 0.4, 0, 0.32);
  deco(F, M.concrete, -18, 0, 24, 14, 0.7, 9, -0.6, 0.28, 0);
  deco(F, M.concrete, 10, 0, 30, 12, 0.7, 12, 1.1, -0.2, 0.2);
  rubble(F, M.concrete, 14, 0, -24, 18, 26, 5);
  rubble(F, M.concrete, -20, 0, 20, 14, 18, 8);
  for (let i = 0; i < 6; i++) deco(F, M.rust, 16 + i * 1.7, 0, 9 + (i % 3), 0.1, 3 + (i % 2), 0.1, 0, 0.2, 0.3); // rebar
  wreck(F, M, -30, 0, -22, 0.7);
  wreck(F, M, 26, 0, -14, 2.2, M.paint("#5b4a3a"));
  lamp(F, M, -12, 0, -16, 6);
}

// Sump Station: the pad's middle is sunk 4 m (grading.js) and flooded; a carriage lies in the pool.
function metro({ F, M, S, sign }) {
  F.box(M.water, 0, -2.6, 0, 34, 0.1, 34);
  block(F, M.rust, -3, -4, 2, 3, 3.2, 15, 0.25);
  deco(F, M.dark, -3, -1.9, 2, 2.6, 0.5, 13, 0.25);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.3; post(F, M.concrete, Math.sin(a) * 26, 0, Math.cos(a) * 26, 0.55, 4.2); }
  slab(F, M.concrete, 0, 4.8, 30, 22, 8);
  for (const k of [-1, 1]) block(F, M.concrete, k * 10, 0, 30, 1.4, 4.2, 6);
  F.box(sign(S.name.toUpperCase(), "VARROW UNDERGROUND · LINE 4"), 0, 5.9, 25.8, 12, 1.8, 0.2);
  for (let i = -2; i <= 2; i++) deco(F, M.chrome, i * 2.2, 0, 27, 0.3, 1.1, 1.4); // turnstiles
  block(F, M.concrete, -24, 0, 32, 18, 3, 0.8, 0.5);
  block(F, M.concrete, 24, 0, 32, 18, 3, 0.8, -0.5);
  rubble(F, M.concrete, 28, 0, -12, 10, 14, 4);
  wreck(F, M, 30, 0, 8, 1.3);
  lamp(F, M, -14, 0, 24, 5);
  lamp(F, M, 14, 0, 24, 5);
}

// The Skyline Run: five roofs joined by planks and ramps. Up the front ramp onto the first, across to the fifth
// (one gap has no plank) and down the long ramp behind it.
function roofs({ F, M }) {
  const B = [[-56, 0, 22, 8, 22], [-28, 4, 20, 12, 20], [0, -4, 24, 12, 18], [28, 2, 20, 9, 20], [58, -2, 22, 15, 22]]; // x, z, w, h, d
  for (const [x, z, w, h, d] of B) {
    block(F, M.concrete, x, 0, z, w, h, d);
    for (let y = 2.4; y < h - 1; y += 3) deco(F, M.dark, x, y, z - d / 2 - 0.06, w * 0.84, 1.2, 0.1);
  }
  ramp(F, M.concrete, -56, 0, -24, 8, 26, 8, Math.PI, 1);
  ramp(F, M.rust, -50, 8, 2, 7, 10, 4, -H, 1);
  slab(F, M.wood, -41.5, 12, 2, 7.6, 5, 0, 0.3);
  slab(F, M.wood, -15, 12, 0, 6.6, 5, 0, 0.3);
  ramp(F, M.rust, 8, 12, 0, 6, 8, 1.6, -H, 1.4);
  ramp(F, M.rust, 31, 9, 0, 7, 14, 6, -H, 1);
  slab(F, M.wood, 42.5, 15, 0, 9.6, 5, 0, 0.3);
  ramp(F, M.concrete, 58, 0, 26, 9, 34, 15, 0, 1);
  post(F, M.rust, -62, 8, 6, 1.6, 3); // water tank
  post(F, M.rust, 6, 12, -9, 1.3, 2.6);
  deco(F, M.dark, -24, 12, 9, 3, 1.4, 2);
  deco(F, M.dark, 62, 15, 5, 3, 1.4, 2);
  lamp(F, M, -52, 0, -38, 6);
  lamp(F, M, 64, 15, -10, 4, true);
  wreck(F, M, -40, 0, -26, 0.9);
  rubble(F, M.concrete, 14, 0, 26, 14, 16, 6);
}

// Level Nine: a car park with its top decks torn off. An outside ramp to the first deck, an inside one to what is
// left of the second; the open floor is where arguments get settled.
function carpark({ F, M }) {
  slab(F, M.concrete, 0, 4.5, 0, 50, 40);
  for (const x of [-20, -7, 7, 20]) for (const z of [-14, 0, 14]) block(F, M.concrete, x, 0, z, 1, 3.9, 1);
  ramp(F, M.concrete, -36, 0, 0, 8, 22, 4.5, -H, 1);
  slab(F, M.concrete, 13, 9, 0, 24, 40);
  for (const x of [4, 22]) for (const z of [-14, 14]) block(F, M.concrete, x, 4.5, z, 1, 3.9, 1);
  ramp(F, M.concrete, -10, 4.5, 12, 7, 22, 4.5, -H, 1);
  for (const k of [-1, 1]) {
    block(F, M.concrete, 0, 4.5, k * 19.8, 50, 0.9, 0.4);
    block(F, M.concrete, -24.8, 4.5, k * 12, 0.4, 0.9, 16);
    block(F, M.concrete, 13, 9, k * 19.8, 24, 0.9, 0.4);
  }
  block(F, M.concrete, 24.8, 4.5, 0, 0.4, 0.9, 40);
  block(F, M.concrete, 24.8, 9, 0, 0.4, 0.9, 40);
  for (let i = 0; i < 7; i++) deco(F, M.rust, 1.2, 9, -15 + i * 5, 0.1, 1.6 + (i % 3) * 0.5, 0.1, 0, 0, 0.5); // torn rebar
  deco(F, M.hazard, -24, 4.5, 0, 1, 0.05, 8);
  wreck(F, M, -14, 4.5, -10, 0.5);
  wreck(F, M, 16, 4.5, 6, 2.4, M.paint("#3f5a57"));
  wreck(F, M, 14, 9, -8, 1.2);
  wreck(F, M, -8, 0, -6, 0.2);
  fireDrum(F, M, -18, 4.5, 15);
  fireDrum(F, M, 20, 4.5, -15);
  lamp(F, M, -30, 0, -14, 6);
  rubble(F, M.concrete, 34, 0, 18, 10, 14, 9);
}

export const CITY = { tower, metro, roofs, carpark };