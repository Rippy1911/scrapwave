// Free parts -> chassis spec entries in the same format layout.js produces (parts with shape, size, pos, rot, mat;
// hardpoints for weapon mounts), so vehicles/build.js draws them and the damage code can shoot them off.
// Every entry keeps `fid` (the free part id) so the mech rig can move it with its limb and between modes.
import * as THREE from "three";
import { FREE_PARTS, freePartInfo, partHalf } from "@/game/workshop/freeParts";

const D2R = Math.PI / 180, UP = new THREE.Vector3(), EU = new THREE.Euler();
const KIND = { block: "scrap", beam: "scrap", plate: "scrap", wedge: "scrap", wheel: "fwheel", thruster: "thruster", light: "light", armour: "armour", mount: "mount", heavyMount: "mount", reactor: "reactor", core: "core" };

// Damage zone of a point on the car (same rule as vehicle.js ZONE_OF).
function zoneOf(p, hit) {
  const h = hit.half, c = hit.center;
  const rx = (p[0] - c[0]) / h[0], ry = (p[1] - c[1]) / h[1], rz = (p[2] - c[2]) / h[2];
  const ax = Math.abs(rx), ay = Math.abs(ry), az = Math.abs(rz);
  if (ay > ax && ay > az && ry > 0) return "top";
  if (az >= ax) return rz < 0 ? "front" : "rear";
  return rx < 0 ? "left" : "right";
}

function shapeOf(d) {
  if (d.shape === "wheel") return { shape: "cylX", size: d.size };
  if (d.shape === "cone") return { shape: "cyl", size: d.size, cone: true };
  return { shape: d.shape, size: d.size };
}

// -> { specs, hardpoints, loadout, tiers, info: [{ part, info }] }
export function layoutFree(design, chassis) {
  const parts = design.free?.parts || [], specs = [], hardpoints = [], loadout = {}, tiers = {}, info = [];
  for (const p of parts) {
    const d = FREE_PARTS[p.t], i = freePartInfo(p.t, p.tier);
    info.push({ part: p, info: i });
    const kind = d.joint ? "joint" : KIND[p.t] || "scrap";
    const s = shapeOf(d);
    const mat = d.armour ? (p.tier === 3 ? "dark" : p.tier === 2 ? "rust" : "rust") : d.mat;
    specs.push({
      id: "f" + p.id, kind, zone: zoneOf(p.p, chassis.hit), hp: Math.max(1, i.hp || 40), ...s, pos: [...p.p],
      rot: p.r.map((a) => a * D2R), mat, fid: p.id, free: true, tier: p.tier,
    });
    if (d.mount && p.wpn) {
      const id = "f" + p.id, up = partHalf(p.t)[1] + 0.01;
      // the mount's top face: up along the part's own y axis
      const ry = p.r.map((a) => a * D2R), off = UP.set(0, up, 0).applyEuler(EU.set(ry[0], ry[1], ry[2], "XYZ")).toArray();
      hardpoints.push({ id, size: d.mount, pos: p.p.map((x, k) => +(x + off[k]).toFixed(3)), rot: ry, fid: p.id });
      loadout[id] = p.wpn.id; tiers[id] = p.wpn.tier;
    }
  }
  return { specs, hardpoints, loadout, tiers, info };
}

// Hit box grown to cover the free parts in drive mode (never below the frame's own bottom, so the body collider
// cannot scrape the ground on parts folded underneath).
export function growHit(hit, parts) {
  const lo = hit.center.map((c, i) => c - hit.half[i]), hi = hit.center.map((c, i) => c + hit.half[i]);
  const bottom = lo[1];
  for (const p of parts) {
    const h = partHalf(p.t), r = Math.max(...h);
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.p[i] - r); hi[i] = Math.max(hi[i], p.p[i] + r); }
  }
  lo[1] = Math.max(lo[1], bottom);
  for (const i of [0, 2]) { const m = Math.max(Math.abs(lo[i]), Math.abs(hi[i]), hit.half[i]); lo[i] = -m + (i === 2 ? 0 : 0); hi[i] = m; }
  return { half: lo.map((l, i) => +((hi[i] - l) / 2).toFixed(3)), center: lo.map((l, i) => (i === 1 ? +((hi[i] + l) / 2).toFixed(3) : hit.center[i])) };
}