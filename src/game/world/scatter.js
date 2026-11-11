// Instanced scatter: rocks, scrub, dead trees, car husks, tyre piles, pylons with sagging cables, billboards, signs.
// Placement (and every collider) comes from the same seeded loop as before; the visuals are CC0 models (Poly Haven
// rocks, shrubs, dead trees, tyre stacks; Kenney car bodies re-materialed as burnt husks) with a distance LOD,
// snapped to the lowest ground under their footprint so nothing floats.
import * as THREE from "three";
import { createInstanced, normalise, snapY } from "@/game/assets/instancer";
import { mergeParts } from "@/game/assets/assets";
import { wreckMaterial, tinted } from "@/game/assets/remat";
import { addSmoke, addFire } from "@/game/render/atmosphere";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { mulberry32 } from "@/game/core/rng";
import { PLACES, PLOTS, BILLBOARDS, CANYON } from "@/game/data/places";
import { distToPolyline } from "@/game/core/rng";
import { inRampLane } from "@/game/world/places/ramps";

function husk() {
  const parts = [
    new THREE.BoxGeometry(1.9, 0.7, 4.3).translate(0, 0.55, 0),
    new THREE.BoxGeometry(1.6, 0.55, 1.9).translate(0, 1.15, 0.3).rotateZ(0.06),
  ];
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
function tree() {
  const g = [new THREE.CylinderGeometry(0.12, 0.25, 4, 5).translate(0, 2, 0)];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.CylinderGeometry(0.04, 0.09, 1.8, 4).translate(0, 0.9, 0);
    b.rotateZ(0.6 + i * 0.2).rotateY(i * 1.7).translate(0, 2.2 + i * 0.5, 0);
    g.push(b);
  }
  return mergeGeometries(g.map((x) => x.toNonIndexed()));
}
function tyres() {
  const g = [];
  for (let i = 0; i < 4; i++) g.push(new THREE.TorusGeometry(0.42, 0.18, 6, 10).rotateX(Math.PI / 2).translate((i % 2) * 0.3, 0.18 + i * 0.32, (i % 3) * 0.1));
  return mergeGeometries(g.map((x) => x.toNonIndexed()));
}
function pylonGeo() {
  const g = [];
  const leg = (a, b) => {
    const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), l = v.length();
    const c = new THREE.CylinderGeometry(0.08, 0.08, l, 4).translate(0, l / 2, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
    c.translate(...a);
    g.push(c.toNonIndexed());
  };
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) leg([x, 0, z], [x * 0.2, 18, z * 0.2]);
  for (let h = 3; h < 18; h += 3.5) { const w = 1.6 * (1 - h / 22); leg([-w, h, -w], [w, h + 3, w]); leg([w, h, -w], [-w, h + 3, w]); }
  leg([-4, 16, 0], [4, 16, 0]); leg([-3, 13, 0], [3, 13, 0]);
  return mergeGeometries(g);
}

export function buildScatter(kit, roads, density = 0.75) {
  const { M, terrain, scene, colliders } = kit;
  const r = mulberry32(4242);
  const blocked = (x, z, pad = 6) => {
    if (Math.abs(x) > 560 || Math.abs(z) > 560) return true;
    for (const p of PLACES) if (Math.hypot(x - p.x, z - p.z) < (p.r || 40) + pad + 8) return true;
    for (const p of PLOTS) if (Math.abs(x - p.x) < 34 && Math.abs(z - p.z) < 34) return true;
    const n = roads.nearest(x, z, 2);
    return n.road && n.dist < n.road.width / 2 + pad;
  };
  const kinds = [
    { name: "rock", geo: new THREE.IcosahedronGeometry(1, 0), mat: M.rock, n: 700, s: [0.6, 3.2], collide: 1.6, sink: 0.3 },
    { name: "scrub", geo: new THREE.IcosahedronGeometry(0.8, 0), mat: new THREE.MeshStandardMaterial({ color: "#6b6a3c", roughness: 1, flatShading: true }), n: 1100, s: [0.4, 1.1], sink: 0.2, squash: 0.6 },
    { name: "tree", geo: tree(), mat: M.dark, n: 160, s: [0.8, 1.4] },
    { name: "husk", geo: husk(), mat: M.rust, n: 90, s: [1, 1], collide: 0, car: true },
    { name: "tyres", geo: tyres(), mat: M.rubber, n: 110, s: [0.8, 1.3] },
  ];
  const meshes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const rv = mulberry32(9090); // visual-only randomness: never touches the placement sequence above
  const place = {};
  for (const k of kinds) {
    const list = (place[k.name] = []);
    let c = 0;
    for (let tries = 0; tries < k.n * 4 && c < k.n; tries++) {
      const x = (r() - 0.5) * 1140, z = (r() - 0.5) * 1140;
      if (blocked(x, z, k.car ? 10 : 4)) continue;
      if (k.collide !== undefined && inRampLane(kit.ramps, x, z, 3)) continue; // keep run-ups and landings clear
      const cd = distToPolyline(CANYON.pts, x, z).d;
      if (k.name !== "rock" && cd < CANYON.rimHalf) continue;
      const s = k.s[0] + r() * (k.s[1] - k.s[0]);
      const y = terrain.heightAt(x, z);
      e.set(k.name === "rock" ? r() * 3 : 0, r() * 6.28, k.name === "husk" ? (r() - 0.5) * 0.3 : 0);
      q.setFromEuler(e);
      sc.set(s * (k.name === "rock" ? 1 + r() * 0.8 : 1), s * (k.squash || (k.name === "rock" ? 0.7 : 1)), s);
      m4.compose(p.set(x, y - (k.sink || 0) * s, z), q, sc);
      const solid = k.collide !== undefined && (k.car || s > k.collide)
        ? { x, y: y + (k.car ? 0.7 : s * 0.4), z, hx: k.car ? 1 : s * 0.8, hy: k.car ? 0.8 : s * 0.6, hz: k.car ? 2.1 : s * 0.8, yaw: e.y, tag: k.name }
        : null;
      list.push({ x, z, s, yaw: e.y, roll: e.z, fb: m4.clone(), solid, entry: null }); // colliders: syncSolid below
      c++;
    }
  }
  // Visual placement: footprint-snapped, gently tilted, per-instance size jitter.
  const mat = (x, y, z, yaw, tilt, sx, sy = sx, sz = sx) => {
    e.set((rv() - 0.5) * tilt, yaw, (rv() - 0.5) * tilt); q.setFromEuler(e);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  };
  const ROCKS = ["rock_boulder_large", "rock_boulder_flat", "rock_small", "rock_outcrop"];
  const rockItems = place.rock.map((it) => {
    const v = it.s > 2.5 && rv() < 0.5 ? 3 : Math.floor(rv() * 3);
    const k = it.s * (0.85 + rv() * 0.35);
    return { v, m: mat(it.x, snapY(terrain, it.x, it.z, k * 0.7, 0.18 * k), it.z, it.yaw, 0.35, k, k * (0.8 + rv() * 0.35), k) };
  });
  const rockMat = new Map();
  meshes.push(createInstanced(scene, {
    models: ROCKS, items: rockItems, lod: { near: 75, far: 650, cell: 0.3, hiCell: 0.045 },
    fallback: { geometry: kinds[0].geo, material: M.rock },
    prepare: (raw) => normalise(mergeParts(raw), { size: 2.1 }).map((pp) => {
      if (!rockMat.has(pp.material)) rockMat.set(pp.material, tinted(pp.material, [1.06, 0.8, 0.66]));
      return { ...pp, material: rockMat.get(pp.material) };
    }),
  }));
  // Dry scrub: the Poly Haven shrub has two variants side by side; each becomes its own model.
  const scrubItems = place.scrub.map((it) => {
    const k = it.s * (1.6 + rv() * 0.6);
    return { v: rv() < 0.5 ? 0 : 1, m: mat(it.x, snapY(terrain, it.x, it.z, 0.3, 0.08), it.z, it.yaw, 0.2, k, k * (0.8 + rv() * 0.4), k) };
  });
  const shrub = (variant) => (raw) => normalise(raw, { size: 1, filter: (n) => n.includes(variant) });
  const scrubA = createInstanced(scene, { models: ["shrub_dry"], items: scrubItems.filter((i) => i.v === 0).map((i) => ({ m: i.m })), lod: { near: 45, far: 170, cell: 0.07 }, castShadow: true, prepare: shrub("variant_a") });
  const scrubB = createInstanced(scene, { models: ["shrub_dry"], items: scrubItems.filter((i) => i.v === 1).map((i) => ({ m: i.m })), lod: { near: 45, far: 170, cell: 0.07 }, castShadow: true, prepare: shrub("variant_e") });
  meshes.push(scrubA, scrubB);
  // Dead quiver trees standing, fallen logs lying.
  const treeItems = place.tree.map((it) => {
    const log = rv() < 0.3, k = it.s * (log ? 1 : 2.0 + rv() * 0.4);
    return log ? { v: 1, m: mat(it.x, snapY(terrain, it.x, it.z, 1.8, 0.22), it.z, it.yaw, 0.08, k) }
      : { v: 0, m: mat(it.x, snapY(terrain, it.x, it.z, 0.25, 0.15), it.z, it.yaw, 0.18, k) };
  });
  meshes.push(createInstanced(scene, {
    models: ["tree_dead_quiver", "log_dead_fallen"], items: treeItems, lod: { near: 80, far: 380, cell: 0.12, hiCell: 0.02 },
    fallback: { geometry: kinds[2].geo, material: M.dark }, prepare: (raw) => normalise(mergeParts(raw)),
  }));
  // Burnt-out car husks (Kenney bodies without wheels, rusted and sooty, sitting on their sills).
  const CARS = ["car_sedan", "truck_pickup", "van", "suv", "car_hatchback_sports", "car_sports"];
  const huskItems = place.husk.map((it) => ({ v: Math.floor(rv() * CARS.length), m: mat(it.x, snapY(terrain, it.x, it.z, 1.6, 0.08), it.z, it.yaw, 0.12, 1) }));
  meshes.push(createInstanced(scene, {
    models: CARS, items: huskItems, lod: { near: 120, far: 700, cell: 0.12 },
    fallback: { geometry: kinds[3].geo, material: M.rust },
    prepare: (raw) => husk4(raw),
  }));
  // A few husks near the roads are still smouldering; some are on fire.
  let burning = 0;
  for (const it of place.husk) {
    if (burning >= 9) break;
    const n = roads.nearest(it.x, it.z, 3);
    if (!n.road || n.dist > 45 || rv() < 0.4) continue;
    const y = terrain.heightAt(it.x, it.z);
    addSmoke(scene, it.x, y + 1.2, it.z, { kind: "grey", rate: 1.0, size: 1.2, rise: 2.4 });
    if (burning % 2 === 0) addFire(scene, it.x + 0.4, y + 0.55, it.z, 0.7);
    burning++;
  }
  // Tyre stacks
  const tyreItems = place.tyres.map((it) => {
    const k = it.s * (1.5 + rv() * 0.4);
    return { m: mat(it.x, snapY(terrain, it.x, it.z, 0.35 * k, 0.06), it.z, it.yaw, 0.1, k) };
  });
  meshes.push(createInstanced(scene, { models: ["tyre_stack"], items: tyreItems, lod: { near: 50, far: 220, cell: 0.06, hiCell: 0.02 }, fallback: { geometry: kinds[4].geo, material: M.rubber }, prepare: (raw) => normalise(mergeParts(raw)) }));
  for (const h of meshes) h.setDensity(density);
  // Only drawn instances collide: the quality density hides the tail of each model group, and a hidden rock or
  // husk must not stop a car. Colliders follow the density both ways (the near/far LOD is visual only).
  const solidSets = meshes.filter((h) => h.items === rockItems || h.items === huskItems).map((h) => [h, h.items === rockItems ? place.rock : place.husk]);
  const syncSolid = (d) => {
    for (const [h, src] of solidSets) for (const g of h.groups) {
      const active = Math.floor(g.items.length * Math.min(1, d));
      g.items.forEach((it, idx) => {
        const o = src[it.i];
        if (!o.solid) return;
        if (idx < active && !o.entry) o.entry = colliders.add({ ...o.solid });
        else if (idx >= active && o.entry) { colliders.remove(o.entry); o.entry = null; }
      });
    }
  };
  syncSolid(density);

  // Power line: leaning pylons and sagging cables beside the highway.
  const pg = pylonGeo();
  const tops = [];
  const pyl = new THREE.InstancedMesh(pg, M.dark, 24);
  let pc = 0;
  const hw = roads.roads.find((x) => x.id === "highway");
  for (let i = 4; i < hw.samples.length - 4 && pc < 24; i += 14) {
    const s = hw.samples[i];
    if (s.bridge || s.deck) continue;
    const x = s.x - s.dz * 26, z = s.z + s.dx * 26;
    if (blocked(x, z, 2) && Math.hypot(x - 300, z + 40) < 90) continue;
    const y = terrain.heightAt(x, z), lean = (r() - 0.5) * 0.16;
    e.set(lean, Math.atan2(s.dx, s.dz), lean * 0.5); q.setFromEuler(e);
    m4.compose(p.set(x, y, z), q, sc.set(1, 1, 1));
    pyl.setMatrixAt(pc++, m4);
    colliders.add({ x, y: y + 3, z, hx: 1.8, hy: 3, hz: 1.8, tag: "pylon" });
    const tl = new THREE.Vector3(-3.8, 16, 0).applyQuaternion(q).add(p), tr = new THREE.Vector3(3.8, 16, 0).applyQuaternion(q).add(p);
    tops.push([tl, tr]);
  }
  pyl.count = pc; pyl.castShadow = true;
  scene.add(pyl);
  const cablePts = [];
  for (let i = 0; i < tops.length - 1; i++) for (let side = 0; side < 2; side++) {
    const a = tops[i][side], b = tops[i + 1][side];
    for (let k = 0; k < 10; k++) {
      const t0 = k / 10, t1 = (k + 1) / 10;
      const pa = a.clone().lerp(b, t0); pa.y -= Math.sin(t0 * Math.PI) * 3;
      const pb = a.clone().lerp(b, t1); pb.y -= Math.sin(t1 * Math.PI) * 3;
      cablePts.push(pa, pb);
    }
  }
  const cables = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePts), new THREE.LineBasicMaterial({ color: "#1a1714" }));
  scene.add(cables);

  // Billboards with made-up brands
  for (const b of BILLBOARDS) {
    if (inRampLane(kit.ramps, b.x, b.z, 6)) continue; // its two posts stood in a ramp run-up
    const y = terrain.heightAt(b.x, b.z);
    const F = kit.frame(b.x, y, b.z, -(b.heading * Math.PI) / 180);
    F.box(M.dark, -4, 4, 0, 0.35, 8, 0.35, 0, { collide: true });
    F.box(M.dark, 4, 4, 0, 0.35, 8, 0.35, 0, { collide: true });
    F.box(M.sign(b.text, b.sub), 0, 8.5, 0.2, 11, 4.2, 0.2, 0, { rz: (r() - 0.5) * 0.08 });
    F.box(M.dark, 0, 6.2, 0.4, 11, 0.15, 0.8);
  }
  return { meshes, setDensity(d) { for (const h of meshes) h.setDensity(d); syncSolid(d); } };
}

// Kenney car body without wheels: scaled to ~4.3 m long, dropped onto its sills, rusted and burnt.
export function husk4(raw, o = {}) {
  const body = raw.filter((p) => !/wheel/i.test(p.name));
  const parts = normalise(mergeParts(body), { size: o.length || 4.3 });
  return parts.map((pp) => ({ ...pp, material: wreckMaterial(pp.material, { paint: o.paint ?? 0.4, soot: o.soot ?? 0.55 }) }));
}