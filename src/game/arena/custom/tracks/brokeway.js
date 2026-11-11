// Brokeway (Wreck Race): a clockwise loop with two raised roads, each broken in the middle. Ramp up, two decks, a
// 13 m gap, then a ramp back up (so a car that falls short just climbs again), a deck and a ramp down. Rubble blocks
// line both sides of each road: you can weave through them on the ground, but the road is the fast way.
// dir 1: the bottom road at z = 40, driven toward +x. dir -1: the top road at z = -40, driven toward -x.
const UP = { 1: 6, [-1]: 2 }, DOWN = { 1: 2, [-1]: 6 }; // ramp turns: the high end points the way you drive, or back

const road = (z, dir) => [
  { k: "ramp", x: -30 * dir, z, r: UP[dir] },
  { k: "deck", x: -21.5 * dir, z, r: 0 }, { k: "deck", x: -13.5 * dir, z, r: 0 },
  { k: "ramp", x: 8 * dir, z, r: UP[dir] },
  { k: "deck", x: 16.5 * dir, z, r: 0 },
  { k: "ramp", x: 25 * dir, z, r: DOWN[dir] },
  ...[-20, -8, 4, 16].flatMap((x) => [{ k: "block", x: x * dir, z: z - 8, r: 1, c: "#5c5a55" }, { k: "block", x: x * dir, z: z + 8, r: 1, c: "#5c5a55" }]),
  ...[[-3, 0], [-1, -1.5], [-5.5, 1.5]].map(([x, dz]) => ({ k: "barrel", x: x * dir, z: z + dz, r: 0 })), // in the gap
];

const RINGS = [[-40, 38], [-17, 40], [16, 40], [40, 36], [50, 14], [50, -14], [40, -38], [17, -40], [-16, -40], [-40, -36], [-50, -14], [-50, 14]];

export const BROKEWAY = {
  name: "Brokeway", floor: "#2c3140", laps: 2,
  pieces: [
    ...road(40, 1), ...road(-40, -1),
    ...RINGS.map(([x, z]) => ({ k: "cp", x, z, r: 0 })),
    // The grid: down the left side, facing the first ring at the foot of the bottom road.
    ...[20, 12, 4, -4, -12].flatMap((z) => [{ k: "spawn", x: -45, z, r: 0 }, { k: "spawn", x: -51.5, z, r: 0 }]),
    // The fallen interchange in the middle.
    { k: "deck", x: 0, z: 0, r: 0 }, { k: "ramp", x: 0, z: 8.5, r: 0 }, { k: "ramp", x: 0, z: -8.5, r: 4 },
    ...[[-9, -9], [9, -9], [-9, 9], [9, 9]].map(([x, z]) => ({ k: "pillar", x, z, r: 0, c: "#5c5a55" })),
    ...[[0, 24], [0, -24], [32, 0], [-32, 0]].map(([x, z]) => ({ k: "power", x, z, r: 0 })),
  ],
};