// The Well-town: neutral trading post around a water tower and well.
import * as THREE from "three";
import { mulberry32 } from "@/game/core/rng";
import { dressProps } from "@/game/world/places/dressing";
import { addSmoke, addFire } from "@/game/render/atmosphere";

export function buildTown(kit, place, roads) {
  const { M } = kit;
  const y0 = kit.terrain.heightAt(place.x, place.z);
  const F = kit.frame(place.x, y0, place.z, 0);
  const r = mulberry32(77);
  const clearOfRoad = (lx, lz, m = 9) => roads.nearest(place.x + lx, place.z + lz, 4, true).dist > m;

  // Well
  F.cyl(M.concrete, 0, 0.5, 0, 2.6, 1.0, { collide: true });
  F.cyl(M.water, 0, 0.95, 0, 2.2, 0.1);
  for (const [x, z] of [[-2.4, 0], [2.4, 0]]) F.box(M.wood, x, 2, z, 0.25, 3, 0.25);
  F.box(M.wood, 0, 3.5, 0, 5.2, 0.25, 0.25);
  F.box(M.corrugated, 0, 3.9, 0, 5.8, 0.12, 3.6, 0, { rz: 0.05 });

  // Water tower
  const T = [16, -18];
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    F.beam(M.dark, [T[0] + dx, 0, T[1] + dz], [T[0] + dx * 0.7, 14, T[1] + dz * 0.7], 0.25);
    F.collider(T[0] + dx, 3, T[1] + dz, 0.6, 6, 0.6);
  }
  F.beam(M.dark, [T[0] - 3, 5, T[1] - 3], [T[0] + 3, 9, T[1] + 3], 0.1);
  F.beam(M.dark, [T[0] + 3, 5, T[1] - 3], [T[0] - 3, 9, T[1] + 3], 0.1);
  F.cyl(M.rust, T[0], 17.5, T[1], 4.6, 7);
  F.cyl(M.hazard, T[0], 15.2, T[1], 4.65, 0.8);
  F.cone(M.rust, T[0], 22.2, T[1], 4.9, 2.4);
  F.box(M.dark, T[0] + 4.7, 12, T[1], 0.2, 24, 0.6);
  kit.label("Well-town", place.x + T[0], y0 + 28, place.z + T[1], "#f2c230");

  // Garage bay (repairs + garage menu)
  const G = [-30, -30];
  F.box(M.concrete, G[0], 0.05, G[1] + 10, 12, 0.1, 12);
  F.box(M.hazard, G[0], 0.12, G[1] + 16, 12, 0.05, 0.6);
  F.box(M.corrugated, G[0] - 7, 4, G[1], 0.3, 8, 14, 0, { collide: true });
  F.box(M.corrugated, G[0] + 7, 4, G[1], 0.3, 8, 14, 0, { collide: true });
  F.box(M.corrugated, G[0], 4, G[1] - 7, 14, 8, 0.3, 0, { collide: true });
  F.box(M.rust, G[0], 8.2, G[1], 15, 0.4, 15, 0, { rz: 0.04 });
  F.box(M.hazard, G[0], 7.4, G[1] + 7.1, 14, 0.6, 0.2);
  F.box(M.dark, G[0] - 4, 1, G[1] - 5, 2.5, 2, 1.2, 0, { collide: true });
  F.cyl(M.rubber, G[0] + 5, 0.4, G[1] - 4.5, 0.6, 0.8);
  F.cyl(M.rubber, G[0] + 5, 1.2, G[1] - 4.5, 0.6, 0.8);
  F.box(M.sign("GARAGE", "REPAIRS · PARTS · PAINT", "#2b2a28", "#f2c230"), G[0], 9.6, G[1] + 7.3, 8, 2.4, 0.15);
  F.ball(M.lamp, G[0] - 4, 7, G[1] + 6.5, 0.25); F.ball(M.lamp, G[0] + 4, 7, G[1] + 6.5, 0.25);

  // Market stalls with awnings
  const awn = [M.cloth, M.paint("#3f5f6e"), M.paint("#d9b23a"), M.cloth];
  for (let i = 0; i < 6; i++) {
    const x = 26 + (i % 3) * 7, z = 10 + Math.floor(i / 3) * 9;
    if (!clearOfRoad(x, z, 7)) continue;
    F.box(M.wood, x, 0.6, z, 5, 1.2, 2.4, 0, { collide: true });
    for (const dx of [-2.4, 2.4]) F.box(M.wood, x + dx, 1.6, z - 1.4, 0.15, 3.2, 0.15);
    F.box(awn[i % 4], x, 3.2, z - 0.4, 5.6, 0.08, 3.2, 0, { rx: 0.22 });
    for (let k = 0; k < 4; k++) F.box(k % 2 ? M.rust : M.wood, x - 1.8 + k * 1.2, 1.45, z + 0.3, 0.8, 0.5, 0.8);
  }

  // Shacks around the ring
  let placed = 0;
  const shacks = [];
  for (let i = 0; i < 40 && placed < 16; i++) {
    const a = r() * Math.PI * 2, d = 32 + r() * 28;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - G[0], z - G[1]) < 14 || (x > 20 && x < 50 && z > 4 && z < 30) || Math.hypot(x - T[0], z - T[1]) < 9) continue;
    if (!clearOfRoad(x, z, 11)) continue;
    placed++;
    const w = 5 + r() * 4, d2 = 4 + r() * 3, h = 3 + r() * 1.5, ry = -a + Math.PI / 2;
    const S = kit.frame(place.x + x, y0, place.z + z, ry);
    S.box(r() > 0.5 ? M.corrugated : M.rust, 0, h / 2, 0, w, h, d2, 0, { collide: true });
    S.box(M.rust, 0, h + 0.2, 0, w + 0.8, 0.15, d2 + 0.8, 0, { rx: 0.08 });
    S.box(M.dark, 0, 1, d2 / 2 + 0.02, 1, 2, 0.05);
    S.box(M.glass, w / 4, 1.7, d2 / 2 + 0.02, 1, 0.7, 0.05);
    if (r() > 0.5) { S.box(awn[placed % 4], 0, h * 0.75, d2 / 2 + 1.2, w * 0.8, 0.06, 2.2, 0, { rx: -0.25 }); }
    if (r() > 0.6) S.cyl(M.rust, -w / 2 - 0.6, 0.6, 1, 0.45, 1.2);
    S.ball(M.lamp, w / 3, h - 0.3, d2 / 2 + 0.3, 0.12);
    shacks.push({ S, w, d2 });
  }

  // String lights between poles around the well
  const poles = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; poles.push([Math.cos(a) * 14, Math.sin(a) * 14]); }
  for (const [x, z] of poles) F.box(M.wood, x, 3, z, 0.2, 6, 0.2);
  for (let i = 0; i < poles.length; i++) {
    const a = poles[i], b = poles[(i + 1) % poles.length];
    for (let k = 1; k < 8; k++) {
      const t = k / 8, sag = Math.sin(t * Math.PI) * 1.2;
      F.ball(k % 2 ? M.lamp : M.redLight, a[0] + (b[0] - a[0]) * t, 5.8 - sag, a[1] + (b[1] - a[1]) * t, 0.12);
    }
  }

  // Fence ring with gaps for roads
  const R = place.r;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (!clearOfRoad(x, z, 10)) continue;
    const gy = F.groundY(x, z);
    F.box(M.wood, x, gy + 1, z, 0.2, 2.2, 0.2);
    F.box(i % 3 ? M.corrugated : M.rust, x, gy + 0.9, z, 0.08, 1.6, (2 * Math.PI * R) / 96 + 0.1, -a, { collide: true });
  }

  // Welcome sign on the western approach
  const wx = -95, wz = -6;
  const W = kit.frame(place.x + wx, kit.terrain.heightAt(place.x + wx, place.z + wz), place.z + wz - 14, Math.PI / 2);
  W.box(M.dark, -6, 4, 0, 0.4, 8, 0.4, 0, { collide: true });
  W.box(M.dark, 6, 4, 0, 0.4, 8, 0.4, 0, { collide: true });
  W.box(M.sign("WELL-TOWN", "WATER · TRADE · NO GUNS INSIDE", "#e3d2a8", "#2f6a74"), 0, 7, 0.25, 13, 4, 0.2);
  for (let i = 0; i < 7; i++) W.ball(M.lamp, -6 + i * 2, 9.3, 0.3, 0.14);

  // Clutter (visual only, tucked against walls): crates, jerrycans, propane, fuel drums, tyre stacks, burn barrels.
  const rv = mulberry32(4711), items = [];
  const put = (model, Fr, lx, lz, ry = rv() * 6.28, s = 1) => { const [wx, wz] = Fr.toWorld(lx, lz); items.push({ model, x: wx, z: wz, ry: Fr.yaw + ry, s }); };
  for (const { S, w, d2 } of shacks) {
    const side = rv() < 0.5 ? -1 : 1;
    put("crate_wood", S, side * (w / 2 - 0.5), d2 / 2 + 0.45, Math.PI / 2 + (rv() - 0.5) * 0.3);
    if (rv() < 0.7) put(rv() < 0.5 ? "jerrycan" : "propane_tank", S, side * (w / 2 - 1.3), d2 / 2 + 0.3);
    if (rv() < 0.5) put("barrel_fuel", S, -side * (w / 2 + 0.55), -d2 / 4);
    if (rv() < 0.35) put("tyre_stack", S, -side * (w / 2 + 0.6), d2 / 4);
  }
  for (const [lx, lz] of [[G[0] - 8, G[1] + 3], [G[0] - 8, G[1] - 2], [G[0] + 8.2, G[1] - 5]]) put("tyre_stack", F, lx, lz);
  put("wheel_rim_rusted", F, G[0] - 8.4, G[1] + 6.4, 0, 1.2);
  for (const [lx, lz] of [[G[0] + 8, G[1] + 1], [G[0] + 8.1, G[1] + 2.2]]) put("barrel_oil_red", F, lx, lz);
  for (const [lx, lz] of [[20.5, 6.5], [-6.5, 9], [9, -8.5], [-12, -6]]) {
    if (!clearOfRoad(lx, lz, 7)) continue;
    put("barrel_stove", F, lx, lz);
    const [wx, wz] = F.toWorld(lx, lz), gy = kit.terrain.heightAt(wx, wz);
    addFire(kit.scene, wx, gy + 0.8, wz, 0.42);
    addSmoke(kit.scene, wx, gy + 1.4, wz, { kind: "grey", rate: 0.8, size: 0.8, rise: 1.6 });
  }
  dressProps(kit, items);

  return {
    garage: { x: place.x + G[0], z: place.z + G[1] + 10, r: 8 },
    bank: { x: place.x, z: place.z, r: 45 },
  };
}