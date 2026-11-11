// Hollow Town: a wrecked main street between gutted blocks, a gas station with a canopy and pumps, back roads
// and alleys, and a collapsed overpass: the broken slab is a long ramp up onto the standing deck, which ends
// in a drop on the west side.
export const HOLLOW = { name: "Hollow Town", look: (M) => ({ floor: M.concrete, wall: M.dark, ramp: M.concrete }) };

const BLOCKS = [
  [-21, -42, 18, 14, 7], [-21, -17, 18, 16, 4.5], [-21, 9, 18, 16, 8],
  [21, -17, 18, 16, 6], [21, 9, 18, 16, 3.5],
];

export function buildHollow(ctx) {
  const { M } = ctx;
  for (const [x, z, w, d, h] of BLOCKS) {
    ctx.solid(M.concrete, x, 0, z, w, h, d, 0, "block");
    ctx.deco(M.dark, x, h, z, w + 0.4, 0.4, d + 0.4); // roof lip
    ctx.solid(M.concrete, x + w * 0.3, 0, z + d * 0.55, 3, 1.1, 2.2, 0.5, "rubble"); // fallen chunk
  }
  // Gas station (south-east): canopy on four pillars, two pumps, a kiosk.
  for (const [x, z] of [[17, -47], [31, -47], [17, -37], [31, -37]]) ctx.solid(M.dark, x, 0, z, 0.7, 5, 0.7, 0, "pillar");
  ctx.deco(M.paint("#b23a1f"), 24, 5, -42, 17, 0.7, 13);
  ctx.deco(M.lamp, 24, 4.95, -42, 14, 0.06, 0.4);
  for (const x of [21, 27]) ctx.solid(M.paint("#e3d6bd"), x, 0, -42, 0.9, 1.7, 0.6, 0, "pump");
  ctx.solid(M.corrugated, 26, 0, -55, 9, 3.4, 4, 0, "kiosk");
  // Collapsed overpass across the north plaza: pillars, the standing deck, the broken slab as a ramp.
  for (const x of [-40, -27, -14]) ctx.solid(M.concrete, x, 0, 28, 1.4, 5, 1.4, 0, "pillar");
  ctx.solid(M.concrete, -27, 5, 28, 34, 1, 9, 0, "deck");
  ctx.deco(M.hazard, -27, 5.95, 23.6, 34, 0.25, 0.2);
  ctx.ramp(4, 28, 9, 28, 6, Math.PI / 2, { mat: M.concrete });
  // Wrecked cars in the street.
  for (const [x, z, r] of [[-4, -28, 0.4], [5, -6, 2.6], [-6, 14, 1.2], [3, 40, 0.2]]) ctx.solid(M.rust, x, 0, z, 2, 1.3, 4.3, r, "husk");

  const P = (x, z, y = 0) => ({ x, z, y });
  return {
    checkpoints: [P(0, -45), P(24, -42), P(0, -4), P(-40, -30), P(-44, 10), P(-20, 44), P(30, 40), P(-25, 28, 6), P(-52, 20), P(44, -10)],
    power: [P(0, -20), P(-40, -5), P(40, 25), P(-10, 50), P(24, -30), P(-27, 28, 6)],
    spawns: [P(0, -52), P(0, -36), P(0, -14), P(0, 2), P(0, 20), P(-42, -20), P(-46, 0), P(44, -24), P(44, 2), P(30, 48)],
    horde: [P(0, -30), P(0, 0), P(-40, -14), P(42, 14), P(-20, 50), P(20, 50), P(36, -26), P(-50, 30)],
    props: [
      ...[-40, -24, -8, 8, 24].map((z) => ({ kind: "pole", x: 10, z })),
      ...[-32, -16, 0, 16].map((z) => ({ kind: "pole", x: -10, z })),
      ...[[-21, -30], [-21, -4], [21, -4], [21, 22]].map(([x, z]) => ({ kind: "fence", x, z, ry: 0 })),
      ...[[14, -50], [34, -40], [19, -33], [30, -51]].flatMap(([x, z]) => [{ kind: "barrel", x, z }, { kind: "barrel", x: x + 1.1, z: z + 0.4 }]),
      ...[[-35, -40], [-34, 20], [38, -2], [12, 46], [-27, 30, 6], [-18, 26, 6]].map(([x, z, y]) => ({ kind: "crate", x, z, y: y || 0 })),
      ...[[8, -46], [-8, 30], [40, 30]].map(([x, z]) => ({ kind: "sign", x, z, ry: 0 })),
    ],
  };
}