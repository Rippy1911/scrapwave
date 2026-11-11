// Foundry Pen (Wreck Race): a clockwise oval round a smelter island. Rings every 30 degrees at 44 m; the island is a
// broken ring of walls with molten pylons in the gaps and stacks in the middle. One jump on the outside of the back
// straight. Angles run clockwise on the plan from the bottom (deg 0 = +z).
const D = Math.PI / 180;
const at = (deg, r) => ({ x: +(Math.sin(deg * D) * r).toFixed(1), z: +(Math.cos(deg * D) * r).toFixed(1) });
const ringOf = (k, r, step, off = 0, extra = {}) => Array.from({ length: 360 / step }, (_, i) => ({ k, ...at(off + i * step, r), r: 0, ...extra }));

export const FOUNDRY = {
  name: "Foundry Pen", floor: "#40302c", laps: 3,
  pieces: [
    ...Array.from({ length: 8 }, (_, i) => ({ k: "wall", ...at(i * 45, 22), r: i, c: "#6b5a4e" })), // each wall lies along the ring
    ...ringOf("glow", 22, 45, 22.5, { c: "#ff7a2a" }),
    ...[[-7, -7], [7, -7], [-7, 7], [7, 7]].map(([x, z]) => ({ k: "tower", x, z, r: 0, c: "#4a3f38" })),
    { k: "pillar", x: 0, z: 0, r: 0, c: "#2c2a28" },
    ...ringOf("glow", 3, 90, 45, { c: "#ffb347" }),
    { k: "ramp", x: 0, z: -49, r: 2 }, // rises the way the race runs there (toward -x)
    ...ringOf("cp", 44, 30),
    // The grid: five rows of two behind the first ring; the first start spot is yours.
    ...[-14, -24, -34, -44, -54].flatMap((deg) => [{ k: "spawn", ...at(deg, 40), r: 0 }, { k: "spawn", ...at(deg, 48.5), r: 0 }]),
    ...ringOf("power", 44, 90, 45),
    ...ringOf("barrel", 55, 60, 15),
    ...ringOf("crate", 33, 90),
  ],
};