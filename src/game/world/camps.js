// Lived-in land (lane A look pass): roadside camps with a fire and a smoke column, ruined buildings, and wooden power
// lines along the side roads with sagging wires, some poles leaning or down. Built from the building kit (merged per
// material) and CC0 props; solid parts get box colliders, cloth, wires and small clutter do not. Every site sits off
// the road and out of the ramp lanes (world/keepout.js), on the heightfield.
import * as THREE from "three";
import { mulberry32 } from "@/game/core/rng";
import { dressProps } from "@/game/world/places/dressing";
import { addSmoke, addFire } from "@/game/render/atmosphere";

function roadsideSpot(roads, keep, r, ids, off0, off1, pad, tries = 60) {
  const pool = roads.roads.filter((x) => ids.includes(x.id));
  for (let t = 0; t < tries; t++) {
    const road = pool[Math.floor(r() * pool.length)];
    const s = road.samples[6 + Math.floor(r() * (road.samples.length - 12))];
    if (!s || s.bridge || s.deck) continue;
    const side = r() < 0.5 ? -1 : 1, off = road.width / 2 + off0 + r() * (off1 - off0);
    const x = s.x - s.dz * off * side, z = s.z + s.dx * off * side;
    if (keep.blocked(x, z, pad)) continue;
    return { x, z, face: Math.atan2(-s.dz * side, s.dx * side) + Math.PI, road, s, side };
  }
  return null;
}

export function buildCamps(kit, roads, keep) {
  const { M, terrain, scene } = kit;
  const r = mulberry32(31337);
  const props = [], sites = [];
  const ALL = roads.roads.filter((x) => x.kind !== "rail").map((x) => x.id);

  // --- Camps: a tent, a tarp lean-to on poles, a fire pit with smoke, crates, barrels, a stove, tyres.
  for (let c = 0; c < 13; c++) {
    const sp = roadsideSpot(roads, keep, r, ALL, 16, 26, 9);
    if (!sp) continue;
    const y = terrain.heightAt(sp.x, sp.z);
    const F = kit.frame(sp.x, y, sp.z, sp.face + (r() - 0.5) * 0.6);
    const g = (lx, lz) => F.groundY(lx, lz);
    // tent (A-frame) on its own ground height
    const tx = -3.5, tz = 1.5, ty = g(tx, tz);
    F.box(M.cloth, tx - 0.85, ty + 0.85, tz, 0.08, 2.1, 3.2, 0, { rz: 0.72 });
    F.box(M.cloth, tx + 0.85, ty + 0.85, tz, 0.08, 2.1, 3.2, 0, { rz: -0.72 });
    F.collider(tx, ty + 0.7, tz, 2.6, 1.4, 3.2);
    // tarp lean-to over two poles
    const lx = 3.2, lz = -1.5, ly = g(lx, lz);
    F.cyl(M.wood, lx - 1.6, ly + 1.2, lz - 1.6, 0.07, 2.4, { collide: true });
    F.cyl(M.wood, lx + 1.6, ly + 1.2, lz - 1.6, 0.07, 2.4, { collide: true });
    F.box(M.tarp, lx, ly + 1.75, lz - 0.4, 3.6, 0.05, 2.8, 0, { rx: 0.42 });
    // fire pit, fire and smoke
    const fx = 0.5, fz = 2.5, [wx, wz] = F.toWorld(fx, fz);
    props.push({ model: "pr_fire_pit", x: wx, z: wz, ry: r() * 6.28, s: 1.5 });
    const fy = terrain.heightAt(wx, wz);
    addFire(scene, wx, fy + 0.35, wz, 0.75);
    addSmoke(scene, wx, fy + 1.4, wz, { kind: "grey", rate: 1.4, size: 1.3, rise: 2.6, life: 8 });
    // clutter
    const clutter = [["crate_wood", 1.2], ["barrel_fuel", 1], ["barrel_stove", 1], ["tyre_stack", 1], ["jerrycan", 1.1], ["propane_tank", 1], ["crate_wood", 0.9]];
    for (const [model, s] of clutter) {
      if (r() < 0.25) continue;
      const a = r() * 6.28, d = 4.5 + r() * 3;
      const [cx, cz] = F.toWorld(Math.cos(a) * d, Math.sin(a) * d);
      props.push({ model, x: cx, z: cz, ry: r() * 6.28, s });
    }
    sites.push({ kind: "camp", x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) });
  }

  // --- Ruins: roofless shells of old buildings with broken walls, a fallen beam and rubble.
  for (let c = 0; c < 16; c++) {
    const sp = roadsideSpot(roads, keep, r, ALL, 20, 55, 16);
    if (!sp) continue;
    const W = 7 + r() * 9, D = 6 + r() * 6, y = terrain.heightAt(sp.x, sp.z);
    const F = kit.frame(sp.x, y, sp.z, sp.face + (r() - 0.5) * 0.4);
    const wallMat = r() < 0.6 ? M.concrete : M.wood;
    const edges = [[-W / 2, -D / 2, W / 2, -D / 2], [W / 2, -D / 2, W / 2, D / 2], [W / 2, D / 2, -W / 2, D / 2], [-W / 2, D / 2, -W / 2, -D / 2]];
    for (const [ax, az, bx, bz] of edges) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(L / 1.6)), ry = Math.atan2(bx - ax, bz - az);
      const gap = Math.floor(r() * n), gap2 = r() < 0.4 ? Math.floor(r() * n) : -1;
      for (let i = 0; i < n; i++) {
        if (i === gap || i === gap2) continue;
        const t = (i + 0.5) / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        const h = Math.max(0.5, 3.2 * (0.25 + r() * 0.75) * (r() < 0.2 ? 0.4 : 1));
        const gy = F.groundY(px, pz);
        F.box(wallMat, px, gy + h / 2 - 0.3, pz, 0.35, h + 0.6, L / n + 0.02, ry, { collide: h > 0.9 });
      }
    }
    if (r() < 0.7) { const gy = F.groundY(0, 0); F.box(M.wood, 0, gy + 0.6, 0, 0.3, 0.3, Math.max(W, D) * 0.8, r() * 3, { rx: 0.25, rz: 0.1 }); }
    for (let i = 0; i < 6; i++) {
      const px = (r() - 0.5) * W * 0.8, pz = (r() - 0.5) * D * 0.8, s = 0.4 + r() * 0.8, gy = F.groundY(px, pz);
      F.box(M.concrete, px, gy + s * 0.25, pz, s * 1.6, s * 0.6, s, r() * 3, { rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4 });
    }
    if (r() < 0.5) { const [wx, wz] = F.toWorld(W / 2 + 2, 0); props.push({ model: "tyre_stack", x: wx, z: wz, ry: r() * 6.28, s: 1 }); }
    sites.push({ kind: "ruin", x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) });
  }

  // --- Wooden power lines along the side roads: poles every ~32 m, three sagging wires, some leaning, some down.
  const wires = [];
  for (const id of ["northway", "southway", "saltTrack", "eastTrack", "ford", "westTrack", "towerTrack"]) {
    const road = roads.roads.find((x) => x.id === id);
    if (!road) continue;
    const side = r() < 0.5 ? -1 : 1, off = road.width / 2 + 7;
    let prev = null;
    for (let i = 4; i < road.samples.length - 4; i += 8) {
      const s = road.samples[i];
      if (s.bridge || s.deck) { prev = null; continue; }
      const x = s.x - s.dz * off * side, z = s.z + s.dx * off * side;
      if (keep.blocked(x, z, 1.2, { colliderPad: 1.5 })) { prev = null; continue; }
      const y = terrain.heightAt(x, z), yaw = Math.atan2(s.dx, s.dz);
      const roll = r();
      const F = kit.frame(x, y, z, yaw);
      if (roll < 0.08) { // a pole down in the dirt, off the road side
        F.cyl(M.wood, side * 3.5, 0.2, 0, 0.15, 8.5, { rz: Math.PI / 2 - 0.05, ry: 0.2 });
        prev = null;
        continue;
      }
      const lean = roll < 0.25 ? (r() - 0.5) * 0.3 : (r() - 0.5) * 0.06;
      F.cyl(M.wood, 0, 4.2, 0, 0.15, 8.6, { rz: lean });
      F.collider(0, 2, 0, 0.36, 4, 0.36);
      const topX = -Math.sin(lean) * 3.8; // the axis at 8 m, rotated about the pole's centre (4.2 m)
      F.box(M.wood, topX, 8.0, 0, 2.4, 0.14, 0.14, 0, { rz: lean }); // cross-arm across the road line
      const pts = [-1.05, 0, 1.05].map((a) => { const [wx, wz] = F.toWorld(topX + a, 0); return new THREE.Vector3(wx, y + 8.15 + (a === 0 ? 0.25 : 0), wz); });
      if (prev) for (let w = 0; w < 3; w++) {
        const a = prev[w], b = pts[w], sag = 1.1 + r() * 0.8;
        for (let k = 0; k < 8; k++) {
          const t0 = k / 8, t1 = (k + 1) / 8;
          const p0 = a.clone().lerp(b, t0); p0.y -= Math.sin(t0 * Math.PI) * sag;
          const p1 = a.clone().lerp(b, t1); p1.y -= Math.sin(t1 * Math.PI) * sag;
          wires.push(p0, p1);
        }
      }
      prev = roll < 0.12 ? null : pts; // a few spans are cut
    }
  }
  if (wires.length) {
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wires), new THREE.LineBasicMaterial({ color: "#1c1814" }));
    lines.name = "powerlines";
    scene.add(lines);
  }
  dressProps(kit, props);
  return { sites, wires: wires.length / 2 };
}
