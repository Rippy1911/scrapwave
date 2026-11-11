// Brasswater City's runtime: everything that is not plain layout pieces. The loader calls this once after it has
// built the layout (pieces, deck, wall) and drives step() every fixed step and dispose() when the map goes. All of it
// lives in one group placed at the deck site, so every position below is in plan metres (centre origin, +x east,
// +z south, y up from the deck floor): the ground plane, the instanced buildings and street kit in 128 m chunks,
// the breakables, the ambient crowds, the night light uniform and the LOD pass.
import * as THREE from "three";
import { onFrame, RC } from "@/game/render/frame";
import { createGround, paintMask } from "@/game/maps/city/ground";
import { createChunks } from "@/game/maps/city/chunks";
import { createBuildingMaterial, addBuildings } from "@/game/maps/city/buildings";
import { addStreetKit, createKitMaterials } from "@/game/maps/city/streetKit";
import { createSmash } from "@/game/maps/city/smash";
import { createCrowds } from "@/game/maps/city/crowds";

// Small seeded generator: the city is the same on every client and every run.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ctx: { game, group (the loader's map group), F (place-kit frame at the site), S (site: x, y, z), L (layout), M (materials), coll ({ add }) }
export function buildCity({ game, group, F, S, L, M, coll }) {
  const plan = L.plan, rng = seeded(0x8a55);
  const city = new THREE.Group();
  city.name = "brasswater";
  city.position.set(S.x, S.y, S.z);
  group.add(city);
  const night = { value: 0 };
  const mats = createKitMaterials(M, night);
  mats.building = createBuildingMaterial(night);
  const mask = paintMask(plan), ground = createGround(mask);
  city.add(ground);
  const chunks = createChunks(city);
  const smash = createSmash(game, chunks, S, coll);
  const colliders = addBuildings(chunks, plan, F, mats, rng);
  const kit = addStreetKit(chunks, plan, F, mats, smash, rng);
  chunks.finish();
  const crowds = createCrowds(game, city, S, plan, seeded(0x2b1f));
  const offFrame = onFrame((cam) => chunks.update(cam), game.scene);
  // The free-roam world sits under the deck. Its GLB scatter (assets/instancer.js tags every mesh userData.roam) loads and
  // joins the scene after the loader hid the roam world, so it is still drawn every frame, hundreds of draw calls and
  // a few hundred thousand triangles nobody can see, and the scatter refills its own .visible/.count each frame. So
  // each tagged mesh goes to a camera layer nobody renders (the main and shadow passes both skip it) until the map drops.
  const hidden = [], gone = new WeakSet();
  const sweep = () => {
    for (const o of game.scene.children) {
      if (gone.has(o) || !o.userData || !o.userData.roam) continue;
      hidden.push([o, o.layers.mask]); o.layers.set(31); gone.add(o);
    }
  };
  sweep();
  let nightT = 0, sweepT = 1.5;
  const readNight = () => { const s = game.skyCycle && game.skyCycle.state(); night.value = s ? Math.max(0, Math.min(1, s.night)) : 0; };
  readNight();
  chunks.update(RC.camera || { position: new THREE.Vector3(S.x, S.y + 5, S.z) });

  return {
    // End of the fixed step.
    step(dt) {
      nightT -= dt;
      if (nightT <= 0) { nightT = 0.4; readNight(); }
      sweepT -= dt;
      if (sweepT <= 0) { sweepT = 1.5; sweep(); }
      smash.step(dt);
      crowds.step(dt);
    },
    stats: () => ({ roamMeshesHidden: hidden.length, plan: { buildings: plan.buildings.length, colliders, ...kit }, chunks: chunks.count(), smash: smash.count(), crowds: crowds.count(), night: night.value }),
    dispose() {
      offFrame();
      for (const [o, mask] of hidden) o.layers.mask = mask;
      crowds.dispose();
      for (const m of chunks.meshes()) { m.geometry.dispose(); m.dispose(); }
      ground.geometry.dispose(); ground.material.dispose(); mask.dispose();
      for (const k of Object.keys(mats)) if (mats[k] && mats[k].dispose && mats[k] !== M.lamp && mats[k] !== M.redLight) mats[k].dispose();
      group.remove(city);
    },
  };
}
