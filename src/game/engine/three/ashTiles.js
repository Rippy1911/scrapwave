// The Ashmark's meshes: streamed tile meshes, the horizon (one mesh for the whole map, drawn where no tile is) and
// the sea. The streamer (maps/ashmark/streamer.js) holds no three.js: it hands typed arrays in and keeps the handles.
import * as THREE from "three";
import { ASH } from "@/game/maps/ashmark/layout";
import { tileIndex, horizonArrays, horizonIndex } from "@/game/maps/ashmark/tileData";
import { createAshMaterials } from "@/game/engine/three/ashMaterial";
import { terrainShadowDepth } from "@/game/render/terrainMaterial";

export function createAshGfx(scene, T, waterMaterial) {
  const group = new THREE.Group();
  group.name = "ashmark";
  group.visible = false;
  scene.add(group);
  const mats = createAshMaterials(T), depth = terrainShadowDepth();
  const index = [0, 1, 2].map((l) => new THREE.BufferAttribute(tileIndex(l), 1)); // shared by every tile of a detail level
  const attr = (a, n, norm = false) => new THREE.BufferAttribute(a, n, norm);
  let horizon = null, hIndex = null, water = null, tiles = 0;

  function geometry(a, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", attr(a.pos, 3));
    g.setAttribute("normal", attr(a.nor, 3));
    g.setAttribute("bw", attr(a.bw, 4, true));
    g.setIndex(idx);
    return g;
  }
  function fixed(m) { m.matrixAutoUpdate = false; m.updateMatrix(); m.receiveShadow = true; group.add(m); return m; }

  return {
    group,
    show(on) { group.visible = on; },
    /** A tile mesh from tileData.tileArrays at its north-west corner (world). Returns the handle for removeTile. */
    addTile(a, x0, z0) {
      const g = geometry(a, index[a.lod]), S = ASH.tile;
      g.boundingBox = new THREE.Box3(new THREE.Vector3(0, a.minY, 0), new THREE.Vector3(S, a.maxY, S));
      g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(g, mats.get(a.mask, a.lod < 2));
      m.name = "ash-tile";
      m.position.set(x0, 0, z0);
      if (a.lod === 0) { m.castShadow = true; m.customDepthMaterial = depth; }
      tiles++;
      return fixed(m);
    },
    removeTile(m) {
      group.remove(m);
      m.geometry.setIndex(null); // the index is shared: keep its buffer for the other tiles
      m.geometry.dispose();
      tiles--;
    },
    /** Builds the horizon and the sea once (about 6,500 height samples). */
    build() {
      if (horizon) return;
      const a = horizonArrays();
      hIndex = new THREE.BufferAttribute(new Uint16Array(a.maxIndex), 1);
      hIndex.setUsage(THREE.DynamicDrawUsage);
      const g = geometry(a, hIndex);
      g.computeBoundingBox(); g.computeBoundingSphere();
      horizon = new THREE.Mesh(g, mats.get(15, false));
      horizon.name = "ash-horizon";
      horizon.position.set(a.x0, 0, a.z0);
      fixed(horizon);
      water = new THREE.Mesh(new THREE.PlaneGeometry(ASH.size + 6000, ASH.size + 6000).rotateX(-Math.PI / 2), waterMaterial);
      water.name = "ash-sea";
      water.position.set(ASH.site.x, ASH.sea - 0.05, ASH.site.z);
      fixed(water);
    },
    /** hidden: one byte per tile (row-major), 1 where a tile mesh covers the ground. */
    setHorizon(hidden) {
      if (!horizon) return;
      const n = horizonIndex(hidden, hIndex.array);
      hIndex.needsUpdate = true;
      horizon.geometry.setDrawRange(0, n);
    },
    stats: () => ({ tiles, materials: mats.count(), meshes: tiles + (horizon ? 2 : 0) }),
    dispose() {
      for (const m of group.children.slice()) { group.remove(m); if (m.name === "ash-tile") m.geometry.setIndex(null); m.geometry.dispose(); }
      scene.remove(group);
      mats.dispose(); depth.dispose();
      horizon = water = null; tiles = 0;
    },
  };
}