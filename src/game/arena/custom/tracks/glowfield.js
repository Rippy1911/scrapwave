// Glowfield (Wreck Race): a figure of eight through fields of glowing pylons on a dark floor. Both loops cross at the
// centre, which is also the start line, so the field meets itself twice a lap. The path is x = 48 sin t,
// z = 28 sin 2t with a ring every 30 degrees of t; rings 6 and 12 both sit on the crossing.
const D = Math.PI / 180;
const GLOW = ["#59e0c8", "#c084fc", "#f2c230"];
const eight = (deg) => ({ x: +(48 * Math.sin(deg * D)).toFixed(1), z: +(28 * Math.sin(2 * deg * D)).toFixed(1) });
const cluster = (cx, cz, r, count, c0) => Array.from({ length: count }, (_, i) => {
  const a = (i / count) * Math.PI * 2;
  return { k: "glow", x: +(cx + Math.sin(a) * r).toFixed(1), z: +(cz + Math.cos(a) * r).toFixed(1), r: 0, c: GLOW[(i + c0) % 3] };
});
// The grid runs back from the crossing along the way the lap arrives (from the lower left), two cars a row.
const GRID = [[-3.3, -8], [-7.9, -3.4], [-7.5, -12.3], [-12.1, -7.7], [-11.8, -16.5], [-16.4, -11.9], [-16, -20.8], [-20.6, -16.2], [-20.2, -25.1], [-24.8, -20.5]];

export const GLOWFIELD = {
  name: "Glowfield", floor: "#1d1b22", laps: 3,
  pieces: [
    ...Array.from({ length: 12 }, (_, i) => ({ k: "cp", ...eight((i + 1) * 30), r: 0 })), // the last ring is the start line, so nobody passes a ring on the grid
    ...GRID.map(([x, z]) => ({ k: "spawn", x, z, r: 0 })),
    // The middle of each loop.
    ...cluster(27, 0, 9, 8, 0), ...cluster(27, 0, 3.5, 4, 1), ...cluster(-27, 0, 9, 8, 1), ...cluster(-27, 0, 3.5, 4, 2),
    // The two fields between the loops.
    ...[[0, 34], [-6, 41], [6, 41], [0, 48], [0, -34], [-6, -41], [6, -41], [0, -48]].map(([x, z], i) => ({ k: "glow", x, z, r: 0, c: GLOW[i % 3] })),
    ...[45, 135, 225, 315].map((deg) => ({ k: "power", ...eight(deg), r: 0 })),
    ...[[12, 0], [-12, 0], [0, 13], [0, -13]].map(([x, z]) => ({ k: "barrel", x, z, r: 0 })),
  ],
};