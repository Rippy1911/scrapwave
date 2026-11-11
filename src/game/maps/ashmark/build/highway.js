// The Ashmark's places on and beside the highway: the start marker, the four garages, the toll-gate outpost, the
// broken span with its gap jump and the two fallen overpasses. Each builder gets K: { F (frame at the site, -z is
// its front), F0 (map frame, world heights), M (materials), S (the placed site), net (roads), sign(text, sub) }.
import { block, deco, slab, post, ramp, lamp, wreck, container, shack, fireDrum, rubble, stall } from "@/game/maps/ashmark/build/parts";
import { bridge } from "@/game/maps/ashmark/build/bridge";

// The survey marker stands beside the spawn point, never on it.
function start({ F, M, sign }) {
  post(F, M.concrete, 14, 0, 0, 0.7, 5);
  F.ball(M.redLight, 14, 5.4, 0, 0.35);
  F.box(sign("ASHMARK", "SURVEY POINT 0 · RING ROAD 1.3 KM NORTH"), 14, 2.4, -0.8, 5, 1.6, 0.15);
  rubble(F, M.concrete, 17, 0, 5, 5, 6, 2);
}

// A work shed open toward the road, the trader's stall beside it. The track arrives at the front edge of the pad.
function garage({ F, M, S, sign }) {
  block(F, M.corrugated, 0, 0, 15, 18, 6.5, 0.6);
  for (const k of [-1, 1]) block(F, M.corrugated, k * 9, 0, 8, 0.6, 6.5, 14);
  slab(F, M.rust, 0, 7, 8, 19.4, 15, 0, 0.5);
  deco(F, M.hazard, 0, 5.4, 1, 18, 1.1, 0.4);
  F.box(sign(S.name.toUpperCase(), "REPAIRS · TRADER · NO GUNS"), 0, 7.9, 0.8, 11, 1.8, 0.2);
  deco(F, M.concrete, 0, 0, 8, 16, 0.1, 13);
  for (const k of [-1, 1]) post(F, M.dark, k * 2.6, 0, 10, 0.18, 3.2); // the lift
  deco(F, M.rust, 0, 3.2, 10, 5.6, 0.25, 4);
  block(F, M.wood, 6.5, 0, 13.6, 3.5, 1, 1.2);
  stall(F, M, -15, 0, -4, 0.5);
  for (const k of [-1, 1]) lamp(F, M, k * 11, 0, -1, 7);
  container(F, M.paint("#7a3b26"), 15, 0, 6, 0.1);
  container(F, M.paint("#3f5a57"), 15.2, 2.6, 6.4, 0.2);
  for (let i = 0; i < 3; i++) post(F, M.paint("#8a2a1a"), 12 + i, 0, -3, 0.32, 0.95);
  wreck(F, M, -12, 0, 10, 0.4);
  fireDrum(F, M, 8, 0, -8);
}

// Four booths under one canopy, the barriers welded open; the traders' yard on the right, a bunk shack on the left.
function toll({ F, M, S, sign }) {
  for (const x of [-7.6, -2.5, 2.5, 7.6]) {
    block(F, M.paint("#b9a26a"), x, 0, 0, 1.4, 2.7, 3.2);
    post(F, M.concrete, x, 2.7, 0, 0.35, 3.3);
    deco(F, M.hazard, x, 0, -2.6, 1.4, 0.5, 1.6);
    deco(F, M.rust, x + 0.9, 2.2, -1.2, 0.12, 3.4, 0.12, 0, 0, -0.5);
  }
  F.box(M.corrugated, 0, 6.3, 0, 24, 0.6, 9);
  F.box(sign(S.name.toUpperCase(), "TRADERS · NO GUNS PAST THE BOOTHS"), 0, 7.6, -4.4, 14, 2, 0.2);
  for (const k of [-1, 1]) lamp(F, M, k * 13, 0, -6, 7);
  stall(F, M, 19, 0, 2, -0.3);
  stall(F, M, 25, 0, -9, 0.4);
  container(F, M.paint("#5b6b3a"), 29, 0, 7, 1.2);
  container(F, M.paint("#7a3b26"), 21, 0, 13, 0.2);
  shack(F, M, -19, 0, 4, 6, 5, 3);
  wreck(F, M, -16, 0, -10, 1.1);
  fireDrum(F, M, 15, 0, -4);
}

// The viaduct over a dune trough with its middle gone: the deck, the piers and a launch lip on each side of the gap.
function span({ F, F0, M, net }) {
  bridge(F0, M, net.roads.get("ring"));
  for (const k of [-1, 1]) {
    wreck(F, M, k * 3, 0, k * 46, 0.3 * k);
    deco(F, M.hazard, -k * 4, 0, k * 26, 3, 1, 0.5, 0.2);
    lamp(F, M, k * 6.4, 0, k * 22, 5, true);
  }
}

// A flyover with its approach spans down: the fallen slabs lean on the standing one, so they are ramps onto it.
function ruin({ F, M }) {
  slab(F, M.concrete, 0, 7, 0, 20, 9, 0, 1);
  for (const kx of [-1, 1]) for (const kz of [-1, 1]) block(F, M.concrete, kx * 8.6, 0, kz * 3.4, 1.5, 6, 1.5);
  for (const k of [-1, 1]) {
    ramp(F, M.concrete, k * 21, 0, 0, 9, 22, 7, (k * Math.PI) / 2, 1);
    rubble(F, M.concrete, k * 30, 0, 9, 7, 10, k + 3);
    deco(F, M.rust, k * 9.6, 7, 4.2, 0.14, 1, 0.14);
    deco(F, M.rust, k * 9.6, 7, -4.2, 0.14, 1, 0.14);
  }
  wreck(F, M, 3, 7, 1, 0.6);
}

export const HIGHWAY = { start, toll, span, "ruin-a": ruin, "ruin-b": ruin, "g-city": garage, "g-spine": garage, "g-dunes": garage, "g-marsh": garage };