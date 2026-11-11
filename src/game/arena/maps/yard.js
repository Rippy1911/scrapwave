// The Container Yard: rows of shipping containers (two wide, some stacked two high) with narrow lanes between
// them, cross gaps, a gantry crane over the middle gap, and a loading ramp up onto the south row.
export const YARD = { name: "Container Yard", look: (M) => ({ floor: M.concrete, wall: M.corrugated, ramp: M.rust }) };

const COLORS = ["#a8462c", "#2f5f7a", "#c7762e", "#4e6b3a", "#7d8a80", "#8c3b55"];
const SEGMENTS = [[-54, -34], [-26, -4], [4, 26], [34, 54]];
const CH = 2.6; // container height

export function buildYard(ctx) {
  const { M } = ctx;
  let c = 0;
  const container = (x, y, z, len) => ctx.solid(M.paint(COLORS[c++ % COLORS.length]), x, y, z, len, CH, 2.45, 0, "container");
  // Three rows (z = -24, 0, 24), each two containers wide; the middle row is stacked on its inner segments.
  for (const rz of [-24, 0, 24]) for (const [a, b] of SEGMENTS) {
    const half = (b - a) / 2;
    for (const side of [-1.25, 1.25]) for (const k of [0, 1]) {
      const x = a + half * (k + 0.5);
      if (rz === -24 && a === 34 && k === 0) continue; // open space in front of the loading ramp
      container(x, 0, rz + side, half - 0.15);
      if (rz === 0 && (a === -26 || a === 4)) container(x, CH, rz + side, half - 0.15);
    }
  }
  // Loading ramp onto the south row (rises toward -x, onto the segment from x 4 to 26).
  ctx.ramp(30, -24, 5, 8, CH, Math.PI / 2, { mat: M.rust });
  // Gantry crane over the middle gap: four legs, two top beams, a hanging container.
  for (const lx of [-6, 6]) for (const lz of [-8, 8]) ctx.solid(M.paint("#d9b23a"), lx, 0, lz, 0.9, 15, 0.9, 0, "crane");
  for (const lz of [-8, 8]) ctx.deco(M.paint("#d9b23a"), 0, 14.2, lz, 13, 1, 1);
  ctx.deco(M.paint("#d9b23a"), 0, 14.2, 0, 1.2, 1, 17);
  ctx.deco(M.dark, 0, 9.4, 0, 0.12, 4.8, 0.12);
  ctx.deco(M.paint("#2f5f7a"), 0, 6.4, 0, 6, CH, 2.45, 0.3);
  // Pallet piles and a tyre wall at the lane ends.
  for (const [x, z] of [[-48, 44], [48, -44], [-50, -12], [50, 12]]) ctx.solid(M.wood, x, 0, z, 3, 1.2, 3, 0.4, "pallets");

  const P = (x, z, y = 0) => ({ x, z, y });
  return {
    checkpoints: [P(-45, -36), P(0, -36), P(45, -36), P(15, -24, CH), P(-15, -12), P(0, 0), P(-30, 12), P(-45, 36), P(15, 36), P(45, 12)],
    power: [P(-15, -36), P(30, -12), P(-40, 12), P(40, 36), P(0, 12), P(-30, -12)],
    spawns: [P(-40, -36), P(-20, -36), P(20, -36), P(40, -36), P(-40, 36), P(-20, 36), P(20, 36), P(40, 36), P(-40, -12), P(40, 12)].map((p) => ({ ...p, faceX: true })),
    horde: [P(-20, -12), P(20, -12), P(-20, 12), P(20, 12), P(0, -36), P(0, 36), P(-45, 0), P(45, 0)],
    props: [
      ...[[-30, -36], [30, 36], [0, -12], [0, 12]].map(([x, z]) => ({ kind: "fence", x, z, ry: 0 })),
      ...[[-30, 24], [30, -24]].map(([x, z]) => ({ kind: "fence", x, z, ry: Math.PI / 2 })),
      ...[[-52, -30], [8, -30], [-8, 30], [52, 30], [-20, -6], [20, 6]].flatMap(([x, z]) => [{ kind: "barrel", x, z }, { kind: "barrel", x: x + 1.2, z: z + 0.5 }]),
      ...[[-36, -40], [12, -40], [-12, 40], [36, 40], [-48, 6], [48, -6], [18, -24, CH], [-18, 0, CH * 2]].map(([x, z, y]) => ({ kind: "crate", x, z, y: y || 0 })),
      ...[[-30, -30], [30, -30], [-30, 30], [30, 30], [0, -30], [0, 30]].map(([x, z]) => ({ kind: "pole", x, z })),
      ...[[34, -30], [-4, -18]].map(([x, z]) => ({ kind: "sign", x, z, ry: Math.PI / 2 })),
    ],
  };
}