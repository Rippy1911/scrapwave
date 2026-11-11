// The Beached Tanker: a huge rusted hull on its side in the salt, with holes you can drive through.
export function buildTanker(kit, place) {
  const { M } = kit;
  const y0 = kit.terrain.heightAt(place.x, place.z);
  const F = kit.frame(place.x, y0, place.z, 0.5);
  const R = 12, CY = 9, LEN = 108, SEC = 6;
  const holes = new Set([5, 6, 12, 13]);
  const loot = [];
  for (let s = 0; s < LEN / SEC; s++) {
    const z = -LEN / 2 + SEC / 2 + s * SEC;
    const taper = s < 3 ? 0.55 + s * 0.15 : 1;
    for (let k = -7; k <= 7; k++) {
      const a = (k / 7) * (Math.PI * 0.55);
      const x = Math.cos(a) * R * taper, y = CY + Math.sin(a) * R * taper;
      if (y < -0.4) continue;
      if (holes.has(s) && y < 7) continue;
      const mat = (k + s) % 5 === 0 ? M.paint("#7a2a1a") : M.rust;
      F.box(mat, x, y, z, 0.45, R * taper * 0.4, SEC + 0.05, 0, { rz: a });
    }
    if (!holes.has(s)) F.collider(R * taper * 0.85, 4, z, 3, 8, SEC);
    // ribs inside
    if (s % 2 === 0) F.box(M.dark, R * taper * 0.6, CY, z, 0.3, R * 1.2 * taper, 0.3);
  }
  // deck side: railings and fallen containers on the salt
  for (let i = 0; i < 6; i++) {
    const z = -40 + i * 15;
    F.box(i % 2 ? M.paint("#3f5f6e") : M.paint("#b23a1f"), -8 - (i % 3) * 3, 1.3, z, 2.6, 2.6, 6, i * 0.3, { collide: true });
  }
  // superstructure lying on its side at the stern
  F.box(M.paint("#e3d6bd"), -2, 4, LEN / 2 - 6, 14, 8, 10, 0, { collide: true });
  for (let i = 0; i < 4; i++) F.box(M.glass, -2 - 5 + i * 3.2, 8.05, LEN / 2 - 6, 1.6, 0.1, 6);
  F.cyl(M.dark, -10, 4, LEN / 2 - 4, 1.6, 6, { rz: Math.PI / 2 });
  // bow tip
  F.box(M.rust, 3, CY * 0.7, -LEN / 2 - 2, 4, 10, 6, 0.4, { collide: true });
  // loot inside
  for (const z of [-20, 0, 25]) { const [wx, wz] = F.toWorld(4, z); loot.push({ x: wx, z: wz }); }
  F.box(M.sign("SALTREACH STAR", null, "#7a2a1a", "#e3d6bd", 512, 128), R + 0.3, 6, 0, 0.1, 3, 14, 0);
  kit.label(place.name, place.x, y0 + 30, place.z);
  return { loot };
}