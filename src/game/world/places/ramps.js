// Stunt ramps: wooden kickers, dirt mounds, car-carrier trailers, half-buried buses, dune lips.
import * as THREE from "three";

// Unit ramp: x -0.5..0.5, y 0..1, z +0.5 (foot) .. -0.5 (lip). Curved top.
export function rampGeometry(curve = 1.4, seg = 10) {
  const pos = [], idx = [];
  const top = (s) => Math.pow(s, curve);
  for (let i = 0; i <= seg; i++) {
    const s = i / seg, z = 0.5 - s, y = top(s);
    pos.push(-0.5, y, z, 0.5, y, z, -0.5, 0, z, 0.5, 0, z);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 4, b = (i + 1) * 4;
    idx.push(a, a + 1, b, a + 1, b + 1, b); // top
    idx.push(a + 2, a, b + 2, a, b, b + 2); // left side
    idx.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1); // right side
  }
  const L = seg * 4;
  idx.push(L, L + 2, L + 1, L + 1, L + 2, L + 3); // lip face
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] + 0.5 + pos[i + 1] * 0.3, pos[i + 2] + 0.5);
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

const SPECS = {
  kicker: { w: 7, len: 12, h: 2.6, curve: 1.6 },
  mound: { w: 10, len: 16, h: 3.2, curve: 1.3 },
  carrier: { w: 4.4, len: 14, h: 3.4, curve: 1.0 },
  bus: { w: 3, len: 11, h: 3.0, curve: 1.0 },
  dune: { w: 16, len: 22, h: 4.2, curve: 1.5 },
};

// Run-up and landing lanes: no colliding scatter (rocks, car husks, tarp wrecks) within these metres of a ramp.
const RUN_UP = 45, LANDING = 60; // matches the landing lane rampCheck.js tests (up to 60 m past the lip)
/** True when (x, z) lies in a ramp's run-up, deck or landing lane, `pad` metres wider than the ramp either side. */
export function inRampLane(ramps, x, z, pad = 2) {
  for (const r of ramps || []) {
    const dx = x - r.x, dz = z - r.z;
    const a = dx * r.dirX + dz * r.dirZ, s = dz * r.dirX - dx * r.dirZ;
    // two-sided: the run-up of one direction is the landing of the other, and the far half (plateau + mirrored wedge) is deck
    const reach = Math.max(RUN_UP, LANDING) + pad, deck = r.back || 0;
    if (a > -(r.len / 2 + reach) && a < r.len / 2 + deck + reach && Math.abs(s) < r.w / 2 + pad) return true;
  }
  return false;
}

const MAX_SLOPE = 0.12;
// The first spot no steeper than MAX_SLOPE along and across the ramp, or null. Road ramps try their own spot, then
// the spare spots along the same road (roads.js `alts`, same side and offset, so a ramp never slides onto or off the
// carriageway). Open ramps try their spot, then up to 40 m along their line or 8 m sideways.
function flatSpot(terrain, r, sp) {
  const slope = (p) => {
    const fx = p.dirX, fz = p.dirZ, sx = -fz, sz = fx;
    const h = (a, b) => terrain.heightAt(p.x + fx * a + sx * b, p.z + fz * a + sz * b);
    return Math.max(Math.abs(h(sp.len / 2, 0) - h(-sp.len / 2, 0)) / sp.len, Math.abs(h(0, sp.w / 2) - h(0, -sp.w / 2)) / sp.w);
  };
  let tries;
  if (r.alts) tries = [r, ...r.alts];
  else {
    const fx = r.dirX, fz = r.dirZ, sx = -fz, sz = fx, ab = [];
    for (const a of [0, 10, -10, 20, -20, 30, -30, 40, -40]) for (const b of [0, 8, -8]) ab.push([a, b]);
    ab.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
    tries = ab.map(([a, b]) => ({ x: r.x + fx * a + sx * b, z: r.z + fz * a + sz * b, dirX: r.dirX, dirZ: r.dirZ }));
  }
  return tries.find((p) => slope(p) <= MAX_SLOPE) || null;
}

export function buildRamps(kit, placements, M) {
  const geoCache = {};
  const ramps = [];
  for (let r of placements) {
    const sp = SPECS[r.type] || SPECS.kicker;
    // Steep spots (mesa faces, canyon sides) make a fitted ramp a tower or bury it: slide the ramp up to 40 m
    // along its line or 8 m sideways to the nearest spot no steeper than MAX_SLOPE along and across it, else
    // leave it out.
    const spot = flatSpot(kit.terrain, r, sp);
    if (!spot) continue;
    // Every ramp is two-sided now, so a ramp placed back to back with one already built (same spot, opposite way:
    // the highway kicker and its reversed mound) would only bury it. The first one serves both directions.
    if (ramps.some((o) => Math.hypot(o.x - spot.x, o.z - spot.z) < 8 && o.dirX * spot.dirX + o.dirZ * spot.dirZ < -0.9)) continue;
    r = { ...r, x: spot.x, z: spot.z, dirX: spot.dirX, dirZ: spot.dirZ };
    const yaw = Math.atan2(-r.dirX, -r.dirZ);
    // Fit to the slope: the ramp stands on the lowest ground under its footprint, so its foot never stands proud
    // of a rising road, and it is tall enough that the lip still rises sp.h above the higher end. On flat ground
    // this is the old placement exactly (base 0.15 under the ground, lip sp.h above the base).
    const fx = r.dirX, fz = r.dirZ, sx = -fz, sz = fx; // forward (foot -> lip) and sideways, world space
    const g = (along, side) => kit.terrain.heightAt(r.x + fx * along + sx * side, r.z + fz * along + sz * side);
    let minG = Infinity;
    for (let i = 0; i <= 6; i++) for (const k of [-0.5, 0, 0.5]) minG = Math.min(minG, g(-sp.len / 2 + (sp.len * i) / 6, k * sp.w));
    const footG = g(-sp.len / 2, 0), lipG = g(sp.len / 2, 0);
    const by = minG - 0.15;
    const H = Math.max(footG, lipG) + sp.h - 0.15 - by; // total wedge height above the base
    const footUp = Math.max(0, footG - minG); // how far the ground at the foot sits above the base
    const F = kit.frame(r.x, by, r.z, yaw);
    const key = sp.curve;
    const geo = geoCache[key] || (geoCache[key] = rampGeometry(sp.curve));
    F.wedge(0, 0, sp.w, sp.len, H, 0, { curve: sp.curve, baseY: by });
    // Mounds and dunes used to be bare sand_ripples, the same colour as the desert floor, so they vanished into it. They are
    // now packed red earth (tinted copy of the sand), and every ramp without its own hazard board gets a striped lip.
    const earth = M._earthRamp || (M._earthRamp = (() => { const m = M.sand.clone(); m.color.set("#b5683f"); return m; })());
    const surf = r.type === "kicker" ? M.wood : r.type === "carrier" ? M.dark : r.type === "bus" ? M.paint("#d9b23a") : earth;
    F.prim(geo, surf, 0, 0, 0, sp.w, H, sp.len);
    if (r.type === "kicker") {
      for (const x of [-sp.w / 2 + 0.2, sp.w / 2 - 0.2]) {
        F.beam(M.wood, [x, footUp, sp.len / 2], [x, H, -sp.len / 2], 0.18);
        F.box(M.wood, x, H / 2, -sp.len / 2 + 0.3, 0.3, H, 0.3);
      }
      F.box(M.hazard, 0, H + 0.05, -sp.len / 2 + 0.25, sp.w, 0.12, 0.5);
    } else if (r.type === "carrier") {
      // Two-sided now: the far half of the carrier is a second trailer bed, so there is no tractor behind the lip.
      for (const z of [-3, 2]) F.box(M.paint(z > 0 ? "#b23a1f" : "#3f5f6e"), 0, H * (0.5 - z / sp.len) + 0.6, z, 1.9, 0.9, 3.6, 0, { rx: -Math.atan2(H, sp.len) });
    } else if (r.type === "bus") {
      F.box(M.dark, 0, H * 0.5, 0, sp.w + 0.1, 0.1, sp.len * 1.04, 0, { rx: -Math.atan2(H, sp.len) });
      for (let z = -4; z <= 3; z += 1.8) F.box(M.glass, sp.w / 2 + 0.02, H * (0.5 - z / sp.len) + 0.3, z, 0.05, 0.6, 1.2, 0, { rx: -Math.atan2(H, sp.len) });
      F.ball(earth, 0, footUp, sp.len / 2 - 1, 4, { sx: 1.2, sy: 0.4, sz: 1 });
    } else {
      F.ball(earth, 0, footUp - 0.5, sp.len / 2, sp.w * 0.45, { sx: 1, sy: 0.25, sz: 0.6 });
    }
    if (r.type !== "kicker") {
      // striped lip board and two marker posts, so a jump reads from the road
      F.box(M.hazard, 0, H + 0.05, -sp.len / 2 + 0.25, sp.w, 0.12, 0.5);
      for (const x of [-sp.w / 2 + 0.15, sp.w / 2 - 0.15]) F.box(M.hazard, x, H + 0.7, -sp.len / 2 + 0.25, 0.14, 1.4, 0.14);
    }
    // Back half: a short flat top, then the same wedge mirrored, so the ramp climbs from both ends and a car that
    // meets it from the lip side rolls up instead of hitting a wall. Own base, so it follows the ground on that side.
    const PLATE = 2, lzB = -sp.len / 2 - PLATE - sp.len / 2; // centre of the mirrored wedge, local z
    let minB = Infinity;
    for (let i = 0; i <= 6; i++) for (const k of [-0.5, 0, 0.5]) minB = Math.min(minB, g(sp.len / 2 + PLATE + (sp.len * i) / 6, k * sp.w));
    const byB = Math.min(by, minB - 0.15), top = by + H, HB = top - byB;
    const footB = g(sp.len / 2 + PLATE + sp.len, 0), footUpB = Math.max(0, footB - byB);
    F.wedge(0, lzB, sp.w, sp.len, HB, Math.PI, { curve: sp.curve, baseY: byB });
    F.prim(geo, surf, 0, byB - by, lzB, sp.w, HB, sp.len, 0, Math.PI, 0);
    const base0 = Math.min(by, byB);
    F.box(surf, 0, (base0 + top) / 2 - by, -sp.len / 2 - PLATE / 2, sp.w, top - base0, PLATE, 0, { collide: true, tag: "ramp" });
    F.box(M.hazard, 0, H + 0.05, -sp.len / 2 - PLATE + 0.25, sp.w, 0.12, 0.5);
    if (r.type === "kicker") {
      for (const x of [-sp.w / 2 + 0.2, sp.w / 2 - 0.2]) F.beam(M.wood, [x, footUpB, lzB - sp.len / 2], [x, H, lzB + sp.len / 2], 0.18);
    } else if (r.type === "carrier") {
      F.box(M.paint("#3f5f6e"), 0, (HB * 0.5 + (byB - by)) + 0.6, lzB, 1.9, 0.9, 3.6, 0, { rx: Math.atan2(HB, sp.len) });
    } else if (r.type === "bus") {
      F.box(M.dark, 0, (HB * 0.5 + (byB - by)), lzB, sp.w + 0.1, 0.1, sp.len * 1.04, 0, { rx: Math.atan2(HB, sp.len) });
    } else {
      F.ball(earth, 0, footUpB + (byB - by) - 0.5, lzB - sp.len / 2, sp.w * 0.45, { sx: 1, sy: 0.25, sz: 0.6 });
    }
    ramps.push({ x: r.x, z: r.z, dirX: r.dirX, dirZ: r.dirZ, len: sp.len, h: H, w: sp.w, type: r.type, y: by, first: r.first, twoSided: true, back: sp.len + PLATE });
  }
  return ramps;
}