// Foundry Pen's set pieces: the alley and the shopping arcade (the two shortcuts), the prison with its wall,
// towers and watchtower, and the docks (water, containers, cranes). K scales the plan like the track's corners.
const BOXES = ["#7a2410", "#2f5d7a", "#8a7a3a", "#4f5a44", "#9a5a1f"];

export function foundryYards(B, city, K) {
  // The alley: straight on where the road turns left, between two walls, fences across it.
  const ax = 200 * K, a0 = 108 * K, a1 = 172 * K, am = (a0 + a1) / 2;
  for (const sd of [-1, 1]) B.solid("concrete", ax + sd * 5.6, am, 1, 5, a1 - a0, 0);
  for (const z of [a0 + 12, am, a1 - 12]) for (const dx of [-3.1, 0, 3.1]) B.prop("fence", ax + dx, z);
  for (const [dx, z] of [[-3, am - 14], [2.6, am + 16], [-2.4, am + 30]]) { B.prop("crate", ax + dx, z); B.prop("barrel", ax - dx, z + 2); }
  for (const z of [a0 + 6, am, a1 - 6]) B.bit("lit:#ffb060", ax + 5, 4.4, z, 0.3, 0.4, 1.6);

  // The arcade: a shopping hall you drive through, glass at both ends, stalls inside.
  const hx = 260 * K, h0 = -72 * K, h1 = -8 * K, hm = (h0 + h1) / 2;
  for (const sd of [-1, 1]) B.solid("#5a4638", hx + sd * 7.4, hm, 1.2, 9, h1 - h0, 0);
  B.deco("corrugated", hx, hm, 16.4, 0.8, h1 - h0 + 2, 0, 9);
  for (const z of [h0 + 4, h1 - 4]) { for (const dx of [-3.7, 1.3]) B.prop("front", hx + dx + 1.2, z); B.bit("lit:#ff5ad0", hx, 7.6, z, 9, 1.1, 0.3); }
  for (let z = h0 + 14; z < h1 - 10; z += 13) {
    for (const sd of [-1, 1]) { B.prop("crate", hx + sd * 5.2, z); B.bit("lit:#7ad8ff", hx + sd * 6.6, 3.2, z + 5, 0.2, 1.6, 4); }
    B.bit("lit:#ffd29a", hx, 8.4, z, 0.6, 0.2, 5);
  }

  // The prison: the wall along the road with a tower every 60 m, the other three walls, cell blocks, the watchtower.
  let k = 0;
  B.zone("prison", 12, (p, side) => {
    const [x, z] = side(p.w / 2 + 4.5);
    B.solid("concrete", x, z, 1.6, 10, 12.6, p.r);
    B.bit("rust", x, 10.3, z, 0.3, 0.6, 12.6, p.r);
    if (k++ % 5 !== 2) return;
    const [tx, tz] = side(p.w / 2 + 7);
    B.solid("concrete", tx, tz, 5, 15, 5, p.r);
    B.deco("dark", tx, tz, 6.4, 0.5, 6.4, p.r, 15);
    B.bit("lit:#ffe9b0", tx, 13.6, tz, 5.2, 1, 5.2, p.r);
  });
  const px = -352 * K, pz = 130 * K, west = -404 * K, n = -22 * K, s = 286 * K, east = -300 * K - 12;
  B.solid("concrete", west, (n + s) / 2, 1.6, 10, s - n, 0);
  for (const z of [n, s]) B.solid("concrete", (west + east) / 2, z, east - west, 10, 1.6, 0);
  for (const z of [30, 215]) city.tryBld("slab", px, z * K, Math.PI / 2, 2);
  B.solid("concrete", px, pz, 9, 40, 9);
  B.deco("dark", px, pz, 13, 1, 13, 0, 40);
  B.solid("concrete", px, pz, 7, 5, 7, 0, 41);
  B.lamp(px, pz, 48, 2.2);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) B.bit("lit:#ffe9b0", px + dx * 3.6, 43.5, pz + dz * 3.6, dx ? 0.2 : 5, 2.4, dx ? 5 : 0.2);

  // The docks: water north and west of the quay, containers on the quay, a crane every 120 m.
  B.deco("water", -700, -338 - 420, 1500, 0.3, 800, 0, 0);
  B.deco("water", -598 - 420, 100, 800, 0.3, 1900, 0, 0);
  let c = 0;
  B.zone("docks", 30, (p, side) => {
    const i = c++, [x, z] = side(p.w / 2 + 6.5);
    B.solid(BOXES[i % 5], x, z, 2.6, 2.6, 12.2, p.r);
    if (i % 2) B.solid(BOXES[(i + 2) % 5], x, z, 2.6, 2.6, 12.2, p.r, 2.6);
    if (i % 3 === 0) B.solid(BOXES[(i + 3) % 5], ...side(p.w / 2 + 9.6), 2.6, 2.6, 12.2, p.r);
    if (i % 4 !== 1) return;
    for (const d of [p.w / 2 + 2.4, -(p.w / 2 + 2.4)]) { const [qx, qz] = side(d); B.post("dark", qx, qz, 0.55, 27); }
    const [bx, bz] = side(9);
    B.deco("#c8901a", bx, bz, 46, 1.6, 2.2, p.r, 27);
    B.bit("lit:#ff3a20", bx, 29.4, bz, 0.8, 0.8, 0.8);
  });
}