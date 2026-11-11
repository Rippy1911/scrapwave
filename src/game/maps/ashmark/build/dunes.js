// The Sallow Sea's four places. K: { F (frame at the site, -z is its front), M (materials), S (the placed site), sign }.
import { block, deco, slab, post, ramp, lamp, wreck, container, shack, fireDrum, rubble, hash } from "@/game/maps/ashmark/build/parts";

// The Marrow: a grounded tanker, bow to the front, its stern sunk in the sand. A drift leads up onto the stern,
// a plate ramp from there to the main deck, and a lip at the bow sends you off it.
function tanker({ F, M }) {
  const hull = M.paint("#5a2f22");
  block(F, hull, 0, 0, -10, 14, 9, 50);
  block(F, hull, 0, 0, 25, 14, 5, 20);
  for (const k of [-1, 1]) deco(F, hull, k * 3.6, 0, -39, 8.5, 9, 12, k * 0.5); // the bow plates
  for (const k of [-1, 1]) deco(F, M.dark, k * 7.05, 0, -10, 0.1, 2.4, 50);
  block(F, M.bone, -3.6, 5, 30, 6, 8, 8);
  deco(F, M.glass, -3.6, 10.4, 25.9, 5.4, 1.4, 0.1);
  post(F, M.rust, -3.6, 13, 31, 1.1, 4);
  ramp(F, M.sand, 3.5, 0, 46, 7, 22, 5, 0, 1);
  ramp(F, M.rust, 3.5, 5, 20, 6, 10, 4, 0, 1);
  ramp(F, M.rust, 0, 9, -30, 6, 8, 1.6, 0, 1.4);
  for (let i = 0; i < 4; i++) deco(F, M.rust, -4, 9, -28 + i * 9, 4.4, 0.5, 6); // hatch covers
  for (const k of [-1, 1]) F.cyl(M.dark, k * 6.2, 9.4, -10, 0.25, 46, { rx: Math.PI / 2, six: true });
  for (let i = 0; i < 5; i++) post(F, M.dark, 6.6, 9, -32 + i * 10, 0.08, 1.1);
  wreck(F, M, 22, 0, 12, 0.8);
  container(F, M.paint("#7a3b26"), -20, 0, -6, 0.5);
  rubble(F, M.rust, 18, 0, -26, 12, 14, 7);
  lamp(F, M, -1.6, 13, 27, 3, true);
}

// Sawtooth Field: a dozen ramps dragged out onto the dunes round a scrap sign. Each one faces up its own slope,
// its foot on the sand.
function rampfield({ F, M, S, sign }) {
  F.box(sign(S.name.toUpperCase(), "TWELVE RAMPS · NO RULES"), 0, 3.4, 0, 7, 2, 0.15);
  for (const k of [-1, 1]) post(F, M.dark, k * 3, 0, 0, 0.12, 2.6);
  wreck(F, M, 9, 0, 6, 1.9);
  fireDrum(F, M, -6, 0, -5);
  lamp(F, M, 6, 0, -8, 5);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.283 + hash(i, 4) * 0.4, d = 46 + hash(i, 6) * 66, x = Math.sin(a) * d, z = Math.cos(a) * d;
    const big = i % 4 === 0, len = big ? 16 : 12, h = big ? 5 : 3.4;
    let ux = F.groundY(x + 3, z) - F.groundY(x - 3, z), uz = F.groundY(x, z + 3) - F.groundY(x, z - 3);
    const l = Math.hypot(ux, uz);
    if (l < 0.15) { ux = Math.sin(a); uz = Math.cos(a); } else { ux /= l; uz /= l; }
    const y = F.groundY(x - (ux * len) / 2, z - (uz * len) / 2) - 0.2; // the foot's ground
    ramp(F, i % 2 ? M.rust : M.corrugated, x, y, z, 7, len, h, Math.atan2(-ux, -uz), 1.4);
  }
}

// Cinder Camp: a fenced scrap camp round a fire pit that is still warm.
function camp({ F, M }) {
  for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; F.ball(M.rock, Math.sin(a) * 2.4, 0.2, Math.cos(a) * 2.4, 0.55, { sy: 0.7 }); }
  F.cone(M.fire, 0, 0.7, 0, 0.9, 1.6);
  deco(F, M.dark, 0, 0, 0, 2.6, 0.25, 2.6, 0.6);
  for (let i = 0; i < 5; i++) { // tents: two cloth sheets leaning together
    const a = (i / 5) * 6.283 + 0.5, x = Math.sin(a) * 13, z = Math.cos(a) * 13;
    for (const k of [-1, 1]) F.box(i % 2 ? M.cloth : M.tarp, x + Math.cos(a) * k * 0.9, 1.1, z - Math.sin(a) * k * 0.9, 0.08, 2.8, 4, a, { rz: k * 0.62 });
  }
  shack(F, M, 22, 0, 8, 6, 5, 3, 0.4);
  shack(F, M, -20, 0, 14, 5, 5, 2.8, -0.5);
  shack(F, M, -6, 0, -24, 7, 4, 3, 0.1);
  for (let i = 0; i < 14; i++) { // the fence, with a gate at the front and one at the back
    const a = (i / 14) * 6.283 + 0.4488;
    if (i === 6 || i === 13) continue;
    block(F, i % 3 ? M.corrugated : M.rust, Math.sin(a) * 34, 0, Math.cos(a) * 34, 13, 2.4, 0.3, a);
  }
  slab(F, M.wood, 26, 5, -14, 5, 5, 0, 0.3); // the watch platform
  for (const kx of [-1, 1]) for (const kz of [-1, 1]) post(F, M.wood, 26 + kx * 2.2, 0, -14 + kz * 2.2, 0.12, 4.7);
  deco(F, M.wood, 23.2, 0, -14, 0.5, 5.2, 0.1, 0, 0, -0.12);
  lamp(F, M, 26, 5, -14, 2);
  wreck(F, M, -14, 0, -8, 2.6);
  wreck(F, M, 8, 0, 22, 0.3, M.paint("#6b5a2a"));
  container(F, M.paint("#3f5a57"), 6, 0, -26, 1.5);
  fireDrum(F, M, 16, 0, -4);
  fireDrum(F, M, -10, 0, 20);
}

// Fallen Lantern: a craft that came down hot. Its hull lies at the end of the trench it ploughed, its core still lit,
// and its crew have staked the ground round it.
function crash({ F, M }) {
  F.ball(M.chrome, 0, 1.6, -6, 6, { sx: 1.5, sy: 0.5, sz: 1 });
  F.ball(M.dark, 0, 3.2, -6, 3.2, { sx: 1.2, sy: 0.6, sz: 1 });
  F.ball(M.turbo, 0, 4.6, -6, 1.5);
  F.collider(0, 2.2, -6, 15, 4.4, 10, 0, { tag: "ash" });
  for (const k of [-1, 1]) {
    deco(F, M.sand, k * 8, -0.4, 22, 4, 2.2, 44, k * 0.05, 0, k * 0.2); // the trench's banks
    deco(F, M.chrome, k * 9, 0, -2, 7, 0.3, 3, k * 0.9, 0.3, k * 0.4); // a torn fin
  }
  for (let i = 0; i < 9; i++) {
    const z = 6 + i * 4.6, x = (hash(i, 2) - 0.5) * 8;
    deco(F, M.dark, x, 0, z, 1.2 + hash(i, 3) * 2, 0.2, 1 + hash(i, 5) * 2, hash(i, 7) * 3, hash(i, 9) * 0.6 - 0.3, 0.3);
    if (i % 2) F.ball(M.turbo, x + 1.5, 0.3, z + 1, 0.22);
  }
  for (let i = 0; i < 6; i++) { // the crew's stakes
    const a = (i / 6) * 6.283 + 0.3, x = Math.sin(a) * 30, z = Math.cos(a) * 30 + 4;
    post(F, M.chrome, x, 0, z, 0.1, 3.4);
    F.ball(M.turbo, x, 3.7, z, 0.3);
  }
  rubble(F, M.dark, -14, 0, 10, 9, 10, 6);
}

export const DUNES = { tanker, rampfield, camp, crash };