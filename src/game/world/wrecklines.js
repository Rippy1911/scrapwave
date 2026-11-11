// Wreck lines along the roads: old crash scenes (a car on its roof, one T-boned into it, a pickup in the ditch,
// debris strewn toward the road) and abandoned convoys parked nose to tail on the shoulder, some with a
// scavenger camp beside them (campfire, burn barrel, crates). Fires and smoke columns, vultures over some
// sites and crow perches for the crows system come from the same seeded layout.
// Deterministic: placement never reads the quality preset, so every client builds the same colliders. Every
// vehicle body is drawn at every quality (the distance LOD only swaps meshes) and gets one box collider.
// Nothing lands on a road (footprint corners stay 2 m beyond the road edge), on a plot, a place or its pad,
// near a ramp, a bridge end or the canyon rim.
import * as THREE from "three";
import { createInstanced, normalise, snapY } from "@/game/assets/instancer";
import { mergeParts } from "@/game/assets/assets";
import { wreckMaterial } from "@/game/assets/remat";
import { addSmoke, addFire, addFlock } from "@/game/render/atmosphere";
import { onFrame } from "@/game/render/frame";
import { dressProps } from "@/game/world/places/dressing";
import { inRampLane } from "@/game/world/places/ramps";
import { mulberry32, distToPolyline } from "@/game/core/rng";
import { PLACES, PLOTS, BRIDGES, CANYON, BILLBOARDS } from "@/game/data/places";

// Kenney Car Kit sizes in metres [width, height, length] (public/assets/index.json); the models face +Z.
const DIMS = {
  car_sedan: [2.1, 1.82, 3.57], car_sports: [1.82, 1.54, 3.57], car_hatchback_sports: [1.82, 1.54, 3.99], suv: [2.1, 1.82, 3.78],
  van: [2.1, 1.89, 3.85], truck_pickup: [2.1, 1.82, 4.13], truck_delivery: [2.1, 2.31, 4.55], truck_garbage: [2.24, 2.24, 4.83],
};
const CONVOY = ["truck_delivery", "truck_garbage", "van", "suv", "truck_pickup"];
const BURNT = ["car_sedan", "car_sports", "car_hatchback_sports", "truck_pickup"];
const FLIPPED = ["car_sedan", "car_hatchback_sports"];
const ROADS = ["highway", "northway", "southway", "saltTrack", "eastTrack", "westTrack", "towerTrack", "dunes", "ford"];
// Places with fuel stations or the spawn nearby keep a wider berth.
const WIDE = new Set(["town", "scrapN", "scrapSW"]);

export function buildWreckLines(kit, roads, { ramps = [], scatter = null, props = null } = {}) {
  const { terrain, colliders, scene } = kit;
  const r = mulberry32(31337);

  // Everything the scatter placed (all of it, whatever the density), on a 10 m grid.
  const grid = new Map(), gk = (x, z) => Math.floor(x / 10) * 4096 + Math.floor(z / 10);
  if (scatter) for (const h of scatter.meshes) {
    if (!h.items || h.keep) continue;
    for (const it of h.items) {
      const e = it.m.elements, k = gk(e[12], e[14]);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(e[12], e[14]);
    }
  }
  const nearScatter = (x, z, rad) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const l = grid.get(gk(x + i * 10, z + j * 10));
      if (l) for (let n = 0; n < l.length; n += 2) if ((l[n] - x) ** 2 + (l[n + 1] - z) ** 2 < rad * rad) return true;
    }
    return false;
  };

  const zoneOk = (x, z) => {
    if (Math.abs(x) > 560 || Math.abs(z) > 560) return false;
    for (const p of PLACES) if (Math.hypot(x - p.x, z - p.z) < (WIDE.has(p.id) ? 112 : Math.max((p.r || 40) + 30, (p.pad || 0) + 25))) return false;
    for (const p of PLOTS) if (Math.abs(x - p.x) < 38 && Math.abs(z - p.z) < 38) return false;
    for (const b of Object.values(BRIDGES)) for (const e of [b.a, b.b]) if (Math.hypot(x - e[0], z - e[1]) < 70) return false;
    if (distToPolyline(CANYON.pts, x, z).d < CANYON.rimHalf + 12) return false;
    for (const rp of ramps) if (Math.hypot(x - rp.x, z - rp.z) < 38) return false;
    if (inRampLane(ramps, x, z, 3)) return false; // not on a run-up or landing
    for (const b of BILLBOARDS) if (Math.hypot(x - b.x, z - b.z) < 16) return false;
    return true;
  };
  const pointOk = (x, z) => {
    if (!zoneOk(x, z)) return false;
    const n = roads.nearest(x, z, 3, true);
    if (n.road && n.dist < n.road.width / 2 + 2) return false;
    return true;
  };
  // A vehicle footprint (half width hw, half length hl, yaw) is clear: off the roads, off structures, flat enough.
  const footOk = (x, z, yaw, hw, hl) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let lo = Infinity, hi = -Infinity;
    for (const [lx, lz] of [[0, 0], [-hw - 0.6, -hl - 0.6], [hw + 0.6, -hl - 0.6], [-hw - 0.6, hl + 0.6], [hw + 0.6, hl + 0.6]]) {
      const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
      if (!pointOk(px, pz)) return false;
      const y = terrain.heightAt(px, pz); lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    if (hi - lo > 1.3) return false;
    let hit = false;
    colliders.collect(x, z, hl + 3, (b) => { if (!hit && b.tag !== "rock" && b.tag !== "husk" && Math.hypot(b.x - x, b.z - z) < hl + 2.5 + Math.max(b.hx, b.hz)) hit = true; });
    if (hit) return false;
    if (nearScatter(x, z, hl + 2.2)) return false;
    if (props) { props.near(x, z, hl + 2, () => { hit = true; }); if (hit) return false; }
    return true;
  };
  const taken = []; // vehicles placed so far: keep sites apart
  const freeOfTaken = (x, z, d) => taken.every((t) => Math.hypot(t.x - x, t.z - z) > d);

  const pieces = []; // { set, model, x, z, yaw, s, rx, rz }
  const perches = [], sites = [], camp = [];
  const along = (road, i, side, off) => { const sm = road.samples[i]; return [sm.x - sm.dz * off * side, sm.z + sm.dx * off * side, sm]; };
  const idxAt = (road, s) => { const S = road.samples; let i = 0; while (i < S.length - 1 && S[i].s < s) i++; return i; };
  const yawOf = (sm, dir = 1) => Math.atan2(sm.dx * dir, sm.dz * dir); // model +Z along the road

  function tryVehicle(set, model, x, z, yaw, s, o = {}) {
    const d = DIMS[model], hw = (d[0] * s) / 2, hl = (d[2] * s) / 2;
    if (!footOk(x, z, yaw, hw, hl)) return null;
    const p = { set, model, x, z, yaw, s, rx: o.rx || 0, rz: o.rz || 0, hw, hl, hh: (d[1] * s) / 2 };
    pieces.push(p); taken.push(p);
    return p;
  }

  function crashScene(road, i, side, n) {
    const off = road.width / 2 + 5.5;
    const [ax, az, sm] = along(road, i, side, off + 1.2);
    if (!freeOfTaken(ax, az, 90)) return false;
    const ry = yawOf(sm);
    const before = pieces.length;
    const A = tryVehicle("flipped", FLIPPED[n % FLIPPED.length], ax, az, ry + (0.5 + r() * 0.7) * side, 1.12);
    if (!A) return false;
    const [bx, bz] = along(road, Math.min(road.samples.length - 1, i + 1), side, off + 2.6);
    const fx = bx + sm.dx * 1.8, fz = bz + sm.dz * 1.8;
    tryVehicle("burnt", BURNT[(n + 1) % BURNT.length], fx, fz, ry + Math.PI / 2 * side + (r() - 0.5) * 0.5, 1.12);
    if (r() < 0.6) {
      const j = Math.max(0, i - 3), [cx, cz, sc] = along(road, j, side, off + 4.5);
      tryVehicle("burnt", BURNT[(n + 2) % BURNT.length], cx, cz, yawOf(sc, -1) + (r() - 0.5) * 0.6, 1.12, { rz: 0.16 * side });
    }
    // debris thrown toward the road (visual only, on the shoulder)
    const items = [];
    for (let k = 0; k < 7; k++) {
      const [dx, dz] = along(road, Math.max(0, Math.min(road.samples.length - 1, i + Math.round((r() - 0.5) * 6))), side, road.width / 2 + 2.4 + r() * 4);
      if (!pointOk(dx, dz)) continue;
      const m = ["debris_door", "debris_bumper", "tyre_old", "wheel_rim_rusted", "debris_drivetrain"][Math.floor(r() * 5)];
      items.push({ model: m, x: dx, z: dz, ry: r() * 6.28, s: m === "tyre_old" ? 1.15 : 1 });
    }
    camp.push(...items);
    const gy = terrain.heightAt(ax, az);
    if (n % 3 === 0) {
      addFire(scene, ax + 0.4, gy + 0.3, az, 0.95);
      addSmoke(scene, ax, gy + 1.6, az, { kind: "black", rate: 2.2, size: 2.2, rise: 3.6, life: 11 });
    } else addSmoke(scene, ax, gy + 1.2, az, { kind: "grey", rate: 0.9, size: 1.3, rise: 2.4 });
    if (n % 2 === 0) addFlock(scene, ax, gy + 26 + r() * 10, az, 4, 18 + r() * 8);
    const [px, pz] = along(road, i, side, off + 9);
    if (pointOk(px, pz)) perches.push({ x: px, z: pz, n: 4 + Math.floor(r() * 3) });
    sites.push({ kind: "crash", x: ax, z: az, n: pieces.length - before });
    return true;
  }

  function convoy(road, i, side, n) {
    const dir = r() < 0.5 ? 1 : -1, count = 4 + Math.floor(r() * 3);
    const [x0, z0] = along(road, i, side, road.width / 2 + 5);
    if (!freeOfTaken(x0, z0, 110)) return false;
    let s = road.samples[i].s;
    const placed = [];
    for (let k = 0; k < count; k++) {
      const model = k === 0 ? (r() < 0.5 ? "truck_delivery" : "truck_garbage") : CONVOY[Math.floor(r() * CONVOY.length)];
      const sc = model.startsWith("truck_d") || model.startsWith("truck_g") ? 1.35 : 1.15;
      const L = DIMS[model][2] * sc;
      if (k > 0) s += dir * (L / 2 + 2.2);
      const j = idxAt(road, s), sm = road.samples[j];
      if (!sm || sm.deck || sm.bridge) break;
      const hw = (DIMS[model][0] * sc) / 2;
      const off = road.width / 2 + 3.4 + hw;
      const x = sm.x - sm.dz * off * side, z = sm.z + sm.dx * off * side;
      const crooked = r() < 0.2 ? (r() - 0.5) * 0.8 : (r() - 0.5) * 0.12;
      const p = tryVehicle("convoy", model, x, z, yawOf(sm, dir) + crooked, sc, { rz: r() < 0.25 ? 0.05 * (r() < 0.5 ? 1 : -1) : 0 });
      if (p) placed.push({ p, sm, off });
      s += dir * (L / 2);
    }
    if (placed.length < 3) { for (const { p } of placed) { pieces.splice(pieces.indexOf(p), 1); taken.splice(taken.indexOf(p), 1); } return false; }
    // scavenger camp on the far side of the middle vehicle
    const mid = placed[Math.floor(placed.length / 2)];
    const co = mid.off + mid.p.hw + 5.5;
    const cx = mid.sm.x - mid.sm.dz * co * side, cz = mid.sm.z + mid.sm.dx * co * side;
    if (n % 2 === 0 && pointOk(cx, cz) && !nearScatter(cx, cz, 3)) {
      const gy = terrain.heightAt(cx, cz);
      addFire(scene, cx, gy + 0.08, cz, 0.62);
      addSmoke(scene, cx, gy + 0.9, cz, { kind: "grey", rate: 1.0, size: 0.9, rise: 1.8 });
      for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28; camp.push({ model: "rock_small", x: cx + Math.cos(a) * 0.85, z: cz + Math.sin(a) * 0.85, ry: a, s: 0.24 }); }
      const ry = yawOf(mid.sm);
      camp.push({ model: "log_dead_fallen", x: cx + Math.sin(ry) * 2.2, z: cz + Math.cos(ry) * 2.2, ry: ry + Math.PI / 2, s: 0.42 });
      camp.push({ model: "log_dead_fallen", x: cx - Math.sin(ry) * 2.2, z: cz - Math.cos(ry) * 2.2, ry: ry + Math.PI / 2 + 0.3, s: 0.38 });
      const bx = cx + Math.sin(ry) * 4.2 - Math.cos(ry) * 1.5 * side, bz = cz + Math.cos(ry) * 4.2 + Math.sin(ry) * 1.5 * side;
      camp.push({ model: "barrel_stove", x: bx, z: bz, ry: r() * 6 });
      addFire(scene, bx, terrain.heightAt(bx, bz) + 0.8, bz, 0.4);
      for (let k = 0; k < 3; k++) camp.push({ model: k ? "crate_wood" : "jerrycan", x: cx - Math.sin(ry) * (3.5 + k * 0.7) + Math.cos(ry) * 1.2, z: cz - Math.cos(ry) * (3.5 + k * 0.7) - Math.sin(ry) * 1.2, ry: ry + (r() - 0.5) * 0.4 });
      camp.push({ model: "tyre_stack", x: cx + Math.cos(ry) * 2.6 * side, z: cz - Math.sin(ry) * 2.6 * side, ry: 0 });
      perches.push({ x: cx + Math.sin(ry) * 9, z: cz + Math.cos(ry) * 9, n: 3 + Math.floor(r() * 3) });
    } else perches.push({ x: cx, z: cz, n: 3 });
    if (n % 2 === 1) {
      // one burnt-out truck in the line still smoulders
      const f = placed[0].p, gy = terrain.heightAt(f.x, f.z);
      addSmoke(scene, f.x, gy + 2.5, f.z, { kind: "grey", rate: 0.8, size: 1.6, rise: 2.2 });
      addFlock(scene, f.x, gy + 30, f.z, 3, 20);
    }
    sites.push({ kind: "convoy", x: placed[0].p.x, z: placed[0].p.z, n: placed.length });
    return true;
  }

  // Walk the roads; every ~120 m try a site (two crash scenes to one convoy), flipping side and nudging along on
  // failure, then falling back to the other kind.
  let nCrash = 0, nConvoy = 0, slot = 0;
  const MAXC = 9, MAXV = 6;
  for (const id of ROADS) {
    const road = roads.roads.find((x) => x.id === id);
    if (!road) continue;
    for (let i = 14; i < road.samples.length - 14; i += 30) {
      if (nCrash >= MAXC && nConvoy >= MAXV) break;
      const want = slot++ % 3 === 2 ? "convoy" : "crash";
      const order = want === "crash" ? ["crash", "convoy"] : ["convoy", "crash"];
      let done = null;
      for (const kind of order) {
        if (done || (kind === "crash" ? nCrash >= MAXC : nConvoy >= MAXV)) continue;
        for (let t = 0; t < 6 && !done; t++) {
          const j = i + Math.floor(t / 2) * 5, side = (t % 2 ? -1 : 1) * (r() < 0.5 ? 1 : -1);
          const sm = road.samples[j];
          if (!sm || sm.deck || sm.bridge) continue;
          if (kind === "crash" ? crashScene(road, j, side, nCrash) : convoy(road, j, side, nConvoy)) done = kind;
        }
      }
      if (done === "crash") nCrash++; else if (done === "convoy") nConvoy++;
    }
  }

  // Colliders: one box per vehicle body.
  for (const p of pieces) {
    const gy = snapY(terrain, p.x, p.z, p.hw, 0);
    p.y = gy - 0.05;
    colliders.add({ x: p.x, y: gy + p.hh, z: p.z, hx: p.hw, hy: p.hh, hz: p.hl, yaw: p.yaw, tag: "wreckline" });
  }

  // Visuals: one instanced set per look; Kenney bodies re-materialed (faded paint for the convoys, burnt for crashes).
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  const mat = (p) => { e.set(p.rx, p.yaw, p.rz, "YXZ"); q.setFromEuler(e); return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s)); };
  const handles = [];
  const build = (set, models, prepare) => {
    const list = pieces.filter((p) => p.set === set);
    if (!list.length) return;
    handles.push(createInstanced(scene, { models, items: list.map((p) => ({ v: models.indexOf(p.model), m: mat(p) })), lod: { near: 140, far: 1300, cell: 0.1 }, prepare }));
  };
  const bodyOnly = (raw) => raw.filter((p) => !/wheel/i.test(p.name));
  build("convoy", CONVOY, (raw) => normalise(mergeParts(raw)).map((pp) => ({ ...pp, material: wreckMaterial(pp.material, { paint: 0.72, soot: 0.1, metres: 1.6 }) })));
  build("burnt", BURNT, (raw) => normalise(mergeParts(bodyOnly(raw))).map((pp) => ({ ...pp, material: wreckMaterial(pp.material, { paint: 0.3, soot: 0.7 }) })));
  build("flipped", FLIPPED, (raw) => {
    const parts = normalise(mergeParts(bodyOnly(raw)));
    const box = new THREE.Box3();
    for (const pp of parts) { pp.geometry.computeBoundingBox(); box.union(pp.geometry.boundingBox); }
    const flip = new THREE.Matrix4().makeTranslation(0, box.max.y - 0.08, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI));
    return parts.map((pp) => { const g = pp.geometry.clone(); g.applyMatrix4(flip); return { ...pp, geometry: g, material: wreckMaterial(pp.material, { paint: 0.25, soot: 0.8 }) }; });
  });
  // An instanced mesh with nothing to draw still costs a draw call: hide empty LOD buckets.
  onFrame(() => { for (const h of handles) for (const m of h.meshes) m.visible = m.count > 0; }, scene);
  if (camp.length) dressProps(kit, camp);
  // vultures riding the thermals over the scrapyards
  for (const id of ["scrapN", "scrapSW"]) { const pl = PLACES.find((x) => x.id === id); if (pl) addFlock(scene, pl.x, terrain.heightAt(pl.x, pl.z) + 34, pl.z, 4, 30); }
  for (const pr of perches) pr.y = terrain.heightAt(pr.x, pr.z);
  return { pieces, sites, perches, handles, counts: { crash: nCrash, convoy: nConvoy, vehicles: pieces.length } };
}

// Smoke columns from fires beyond the basin rim: tall, slow, hazed by distance, always emitting so they stand on
// the skyline wherever the camera is.
export function buildHorizonSmoke(kit) {
  const { terrain, scene } = kit;
  const COLS = [[-860, 140, 1.0], [160, -880, 0.85], [820, 560, 0.9], [-620, -760, 0.75], [700, -700, 0.7], [-520, 820, 0.8]];
  for (const [x, z, k] of COLS) {
    const y = terrain.heightAt(Math.max(-599, Math.min(599, x)), Math.max(-599, Math.min(599, z)));
    addSmoke(scene, x, y - 10, z, { kind: "black", rate: 1.1 * k, size: 10 * k, rise: 9, life: 24, far: 3000 });
  }
  return COLS.length;
}
