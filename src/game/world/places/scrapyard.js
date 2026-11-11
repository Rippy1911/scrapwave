// Scrapyard: fenced yard of stacked crushed wrecks, a wreck ramp, a crane with a swinging magnet, loot piles.
import * as THREE from "three";
import { mulberry32 } from "@/game/core/rng";
import { createInstanced, normalise } from "@/game/assets/instancer";
import { mergeParts } from "@/game/assets/assets";
import { wreckMaterial } from "@/game/assets/remat";
import { dressProps } from "@/game/world/places/dressing";

const CRUSHED = ["car_sedan", "van", "suv", "truck_pickup", "car_hatchback_sports", "car_sports"];

export function buildScrapyard(kit, place, seed, roads) {
  const { M } = kit;
  const y0 = kit.terrain.heightAt(place.x, place.z);
  const yaw = seed * 0.7;
  const F = kit.frame(place.x, y0, place.z, yaw);
  const r = mulberry32(seed * 31 + 7);
  const S = 44;

  // Fence with two gates
  for (let side = 0; side < 4; side++) {
    for (let i = -10; i <= 10; i++) {
      const t = i * 4.2;
      if (Math.abs(t) < 8 && (side === 0 || side === 2)) continue;
      const [x, z, ry] = side === 0 ? [t, -S, 0] : side === 1 ? [S, t, Math.PI / 2] : side === 2 ? [t, S, 0] : [-S, t, Math.PI / 2];
      const [wx, wz] = F.toWorld(x, z);
      if (roads && roads.nearest(wx, wz, 3).dist < 9) continue;
      F.box(M.dark, x, 1.5, z, 0.15, 3, 0.15);
      F.box(i % 4 ? M.corrugated : M.rust, x, 1.3, z, 4.2, 2.4, 0.08, ry, { collide: true });
    }
  }

  // Stacks of crushed cars forming lanes (Kenney bodies flattened into the old stack boxes; colliders unchanged)
  const lanes = [-24, -8, 8, 24];
  const crushed = [];
  const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), le = new THREE.Euler();
  for (const lx of lanes) {
    for (let z = -36; z <= 36; z += 5) {
      if (Math.abs(z) < 7) continue;
      const h = 1 + Math.floor(r() * 3);
      const [sx, sz] = F.toWorld(lx, z);
      if (roads && roads.nearest(sx, sz, 3).dist < 8) continue;
      for (let k = 0; k < h; k++) {
        if (r() > 0.4) r(); // keeps the seeded sequence of the old paint pick
        const ox = (r() - 0.5) * 0.6, ry = (r() - 0.5) * 0.25, rx = (r() - 0.5) * 0.06;
        le.set(rx, ry + (k % 2) * Math.PI, 0); lq.setFromEuler(le);
        lm.compose(new THREE.Vector3(lx + ox, 0.05 + k * 1.25, z), lq, new THREE.Vector3(3.5, 1.18, 4.3));
        crushed.push({ v: (lx * 7 + z * 3 + k + seed) & 0xffff, m: F.matrix.clone().multiply(lm) });
      }
      F.collider(lx, h * 0.62, z, 3.6, h * 1.25, 4.4);
    }
  }
  for (const c of crushed) c.v %= CRUSHED.length;
  createInstanced(kit.scene, {
    models: CRUSHED, items: crushed, lod: { near: 140, far: 600, cell: 0.06 },
    fallback: { geometry: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), material: M.rust },
    prepare: (raw) => normalise(mergeParts(raw.filter((pp) => !/wheel/i.test(pp.name))), { unitBox: true })
      .map((pp) => ({ ...pp, material: wreckMaterial(pp.material, { paint: 0.55, soot: 0.2, metres: 1.1 }) })),
  });
  // Ramp built from wrecks
  F.wedge(16, 0, 6, 14, 3, -Math.PI / 2, { curve: 1, baseY: y0 }); // curve matches kit.rampGeo (1.0)
  F.prim(kit.rampGeo, M.rust, 16, 0, 0, 6, 3, 14, 0, -Math.PI / 2, 0);
  F.box(M.hazard, 9.2, 3.05, 0, 0.5, 0.1, 6);

  // Crane: lattice tower, jib, cable and swinging magnet
  const C = [-36, -36];
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) F.beam(M.hazard, [C[0] + dx, 0, C[1] + dz], [C[0] + dx * 0.6, 20, C[1] + dz * 0.6], 0.18);
  for (let h = 2; h < 20; h += 3) F.box(M.hazard, C[0], h, C[1], 2.4 - h * 0.05, 0.15, 2.4 - h * 0.05);
  F.collider(C[0], 6, C[1], 3, 12, 3);
  F.box(M.hazard, C[0] + 12, 20.5, C[1] + 12, 1.2, 1.2, 36, Math.PI / 4);
  F.box(M.dark, C[0] - 4, 20.5, C[1] - 4, 3, 2.5, 3, Math.PI / 4);
  const pivot = new THREE.Group();
  const [px, pz] = F.toWorld(C[0] + 20, C[1] + 20);
  pivot.position.set(px, y0 + 20, pz);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 12, 4), M.dark);
  cable.position.y = -6;
  const magnet = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.7, 16), M.rust);
  magnet.position.y = -12.3; magnet.castShadow = true;
  const held = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 4.2), M.paint("#b23a1f"));
  held.position.y = -13.3; held.castShadow = true;
  pivot.add(cable, magnet, held);
  kit.scene.add(pivot);
  const crane = { pivot, held, t: r() * 10, dropTimer: 20 + r() * 20, x: px, z: pz, y: y0 };
  kit.updaters.push((dt, ctx) => {
    crane.t += dt;
    pivot.rotation.z = Math.sin(crane.t * 0.9) * 0.18;
    pivot.rotation.x = Math.cos(crane.t * 0.7) * 0.12;
    crane.dropTimer -= dt;
    if (crane.dropTimer < 0 && ctx && ctx.onCraneDrop) {
      crane.dropTimer = 25 + Math.random() * 25;
      const wp = new THREE.Vector3(); held.getWorldPosition(wp);
      ctx.onCraneDrop(wp);
      held.visible = false;
      setTimeout(() => { held.visible = true; }, 6000);
    }
  });

  // Glinting loot piles
  const loot = [];
  for (let i = 0; i < 7; i++) {
    const lx = lanes[Math.floor(r() * 3)] + 8, lz = -30 + r() * 60;
    const [wx, wz] = F.toWorld(lx, lz);
    for (let k = 0; k < 6; k++) F.box(k % 2 ? M.rust : M.chrome, lx + (r() - 0.5) * 2, 0.3 + r() * 0.4, lz + (r() - 0.5) * 2, 0.6 + r(), 0.4, 0.6 + r(), r() * 3);
    loot.push({ x: wx, z: wz, lx, lz });
  }
  // Office shack
  F.box(M.corrugated, 30, 1.6, -34, 8, 3.2, 5, 0, { collide: true });
  F.box(M.sign(place.rattlers ? "KEEP OUT" : "SCRAP · BUY · SELL", null, "#e3d2a8", "#7a2410", 512, 128), 30, 3.8, -31.4, 6, 1.4, 0.1);
  const rv = mulberry32(seed * 977 + 3), items = [];
  const put = (model, lx, lz, s = 1) => { const [wx, wz] = F.toWorld(lx, lz); items.push({ model, x: wx, z: wz, ry: rv() * 6.28, s }); };
  for (const [lx, lz] of [[25, -36.5], [26.5, -31], [35, -31], [36, -36.8]]) put(rv() < 0.6 ? "tyre_stack" : "barrel_fuel", lx, lz);
  for (const l of loot) {
    const [lx, lz] = [l.lx, l.lz];
    put("wheel_rim_rusted", lx + 1.6, lz - 0.8, 1.3);
    put(rv() < 0.5 ? "debris_bumper" : "debris_door", lx - 1.5, lz + 1.2);
    if (rv() < 0.5) put("tyre_old", lx + 0.4, lz + 1.9);
  }
  dressProps(kit, items);
  kit.label(place.name, place.x, y0 + 26, place.z);
  return { loot, crane };
}