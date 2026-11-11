// The Radio Tower: a toppled lattice mast and a shack on the north-west hill.
export function buildTower(kit, place) {
  const { M } = kit;
  const y0 = kit.terrain.heightAt(place.x, place.z);
  const F = kit.frame(place.x, y0, place.z, 1.1);
  // Standing stub
  const lat = (x0, z0, x1, z1, y0s, y1s, w) => {
    for (const [dx, dz] of [[-w, -w], [w, -w], [-w, w], [w, w]]) F.beam(M.hazard, [x0 + dx, y0s, z0 + dz], [x1 + dx * 0.7, y1s, z1 + dz * 0.7], 0.12);
  };
  lat(0, 0, 0, 0, 0, 12, 1.6);
  for (let h = 2; h <= 12; h += 2.5) F.box(M.hazard, 0, h, 0, 3, 0.12, 3);
  F.collider(0, 6, 0, 3.4, 12, 3.4);
  // Toppled mast lying across the hilltop
  const LEN = 54;
  for (let i = 0; i < LEN; i += 3) {
    const y = 1.2 + Math.max(0, 6 - i * 0.18);
    F.box(M.hazard, 0, y, 4 + i, 2.4, 0.12, 0.12);
    F.box(M.hazard, 0, y + 2.2, 4 + i, 2.4, 0.12, 0.12);
    F.beam(M.hazard, [-1.2, y, 4 + i], [1.2, y + 2.2, 7 + i], 0.08);
  }
  for (const [x, dy] of [[-1.2, 0], [1.2, 0], [-1.2, 2.2], [1.2, 2.2]]) F.beam(M.hazard, [x, 7.2 + dy, 4], [x, 1.2 + dy, 4 + LEN], 0.12);
  F.ball(M.redLight, 0, 2.4, 4 + LEN + 1, 0.4);
  // Shack with dish
  F.box(M.corrugated, -12, 1.6, -6, 6, 3.2, 5, 0, { collide: true });
  F.box(M.rust, -12, 3.4, -6, 6.8, 0.2, 5.8);
  F.cyl(M.dark, -12, 4.5, -6, 0.1, 2.2);
  F.cone(M.chrome, -12, 6, -6, 1.6, 0.6, { rx: 0.9 });
  F.box(M.dark, -9.2, 1.4, -3.4, 1.2, 1.2, 0.8);
  F.ball(M.lamp, -9, 3, -3.4, 0.15);
  // Signal shed and battery bank
  for (let i = 0; i < 3; i++) F.box(M.paint("#3f5f6e"), 8, 0.6 + i * 1.1, -8 + i * 0.2, 2.2, 1, 1.4);
  kit.label(place.name, place.x, y0 + 22, place.z);
  return { hold: { x: place.x, z: place.z, r: 30 } };
}