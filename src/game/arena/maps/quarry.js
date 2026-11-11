// The Quarry Bowl: a sunken sand pit ringed by two rock terraces (2.5 m and 5 m) with ramps up, a curved
// half-pipe along the south wall, and twin kickers that throw you over the middle of the bowl.
const D = Math.PI / 180;
const T1 = 2.5, T2 = 5; // terrace heights

export const QUARRY = { name: "Quarry Bowl", look: (M) => ({ floor: M.sand, wall: M.rock, ramp: M.wood }) };

export function buildQuarry(ctx) {
  const { M, polar } = ctx;
  const inHalfPipe = (a) => a > 158 * D && a < 202 * D;
  // Terraces: ring 1 from r 46 to 56, ring 2 from 56 to the wall, skipping the half-pipe arc.
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2;
    if (inHalfPipe(a)) continue;
    const w1 = (2 * Math.PI * 51) / N + 0.5, w2 = (2 * Math.PI * 60) / N + 0.6;
    const [x1, z1] = polar(a, 51), [x2, z2] = polar(a, 60.2);
    ctx.solid(M.rock, x1, 0, z1, w1, T1, 10, a);
    ctx.solid(M.rock, x2, 0, z2, w2, T2, 8.4, a);
  }
  // Half-pipe: curved ramps rising into the wall.
  for (let k = 0; k < 7; k++) {
    const a = (160 + k * 6.6 + 3.3) * D;
    ctx.ramp(...polar(a, 57.5), 7.6, 12, 6.5, a + Math.PI, { curve: 2.4, mat: M.concrete });
  }
  // Ramps floor → ring 1 and ring 1 → ring 2 (rising outward).
  for (const deg of [30, 120, 240, 330]) ctx.ramp(...polar(deg * D, 41), 7, 10, T1, deg * D + Math.PI);
  for (const deg of [75, 285]) ctx.ramp(...polar(deg * D, 51.5), 6, 9, T2 - T1, deg * D + Math.PI, { ly: T1 });
  // Twin kickers over the middle, plus boulders.
  ctx.ramp(0, -14, 8, 8, 2.2, Math.PI, { curve: 1.6 });
  ctx.ramp(0, 14, 8, 8, 2.2, 0, { curve: 1.6 });
  for (const [x, z, s] of [[-24, 8, 3], [22, -10, 3.6], [-14, -28, 2.6], [26, 24, 3]]) ctx.solid(M.rock, x, 0, z, s, s * 0.8, s * 1.1, x * 0.1, "rock");

  const P = (deg, r, y = 0) => { const [x, z] = polar(deg * D, r); return { x, z, y }; };
  return {
    checkpoints: [P(0, 24), P(30, 51, T1), P(90, 60, T2), P(120, 51, T1), P(180, 40), { x: 0, z: 0, y: 2 }, P(240, 51, T1), P(285, 60, T2), P(330, 51, T1), P(270, 26)],
    power: [P(55, 32), P(135, 30), P(215, 32), P(305, 30), P(60, 51, T1), P(260, 51, T1)],
    spawns: Array.from({ length: 10 }, (_, i) => P(i * 36 + 18, 34)),
    horde: [P(10, 18), P(80, 28), P(150, 22), P(200, 30), P(250, 16), P(320, 26), P(100, 51, T1), P(300, 51, T1)],
    props: [
      ...[45, 135, 225, 315].map((deg) => ({ kind: "pole", ...P(deg, 43) })),
      ...[20, 40, 110, 130, 230, 250, 320, 340].map((deg) => ({ kind: "fence", ...P(deg, 45), ry: deg * D + Math.PI / 2 })),
      ...[[-18, 30], [19, 33], [-30, -16], [33, -20]].flatMap(([x, z]) => [{ kind: "barrel", x, z }, { kind: "barrel", x: x + 1.3, z: z + 0.6 }, { kind: "crate", x: x - 1.6, z: z - 0.8 }]),
      ...[60, 200, 300].map((deg) => ({ kind: "crate", ...P(deg, 51, T1) })),
      ...[30, 120, 240, 330].map((deg) => ({ kind: "sign", ...P(deg + 9, 36), ry: deg * D })),
    ],
  };
}