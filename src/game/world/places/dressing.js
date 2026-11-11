// Visual-only set dressing for places (crates, cans, drums, tyre stacks, rims, guard rails): CC0 models, instanced
// per model, snapped to the lowest ground under their footprint. Nothing here has a collider, so callers only put
// these against walls, on parapets or inside fenced clutter where cars do not drive.
import * as THREE from "three";
import { createInstanced, normalise, snapY } from "@/game/assets/instancer";
import { mergeParts } from "@/game/assets/assets";
import { wreckMaterial } from "@/game/assets/remat";

const KENNEY = new Set(["guard_rail", "guard_rail_double", "barrier_block_red", "barrier_block_white", "barrier_wall", "debris_bumper", "debris_door", "debris_drivetrain", "cone", "crate_kenney"]);
const FOOT = { tyre_stack: 0.33, crate_wood: 0.5, barrel_fuel: 0.32, barrel_oil_red: 0.3, barrel_stove: 0.3, propane_tank: 0.17, jerrycan: 0.18, wheel_rim_rusted: 0.2, tyre_old: 0.3, debris_door: 0.5, debris_bumper: 0.6 };

/** items: [{ model, x, z, ry, s?, y?, ground? }] (ground: false keeps y as given, e.g. rails on a parapet). */
export function dressProps(kit, items) {
  const by = new Map();
  for (const it of items) { if (!by.has(it.model)) by.set(it.model, []); by.get(it.model).push(it); }
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [model, list] of by) {
    const inst = list.map((it) => {
      const s = it.s || 1;
      const y = it.ground === false ? it.y : snapY(kit.terrain, it.x, it.z, (FOOT[model] || 0.4) * s, 0.04);
      e.set(0, it.ry || 0, 0); q.setFromEuler(e);
      return { m: new THREE.Matrix4().compose(new THREE.Vector3(it.x, y, it.z), q, new THREE.Vector3(s, s, s)) };
    });
    createInstanced(kit.scene, {
      models: [model], items: inst, lod: { near: 70, far: 280, cell: 0.05 },
      prepare: (raw) => {
        let parts = mergeParts(raw);
        if (model === "tyre_old" || model === "wheel_rim_rusted") parts = parts.map((pp) => { const g = pp.geometry.clone(); g.rotateX(Math.PI / 2); return { ...pp, geometry: g }; });
        parts = normalise(parts);
        return KENNEY.has(model) ? parts.map((pp) => ({ ...pp, material: wreckMaterial(pp.material, { paint: 0.75, soot: 0.08, metres: 1.2 }) })) : parts;
      },
    });
  }
}
