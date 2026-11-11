// The Ashmark's ground scatter as instanced meshes (maps/ashmark/scatter.js decides what stands where): a faceted
// rock, a rubble slab, a dead tree, a pole and a bone rib. One draw call per kind for the whole map; the two tall
// kinds cast shadows. Instances are in map coordinates, so the group sits at the map's origin.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ASH } from "@/game/maps/ashmark/layout";

const CAP = 1200; // instances per kind (17 x 17 cells of at most 4 pieces)

function shapes() {
  const rock = new THREE.IcosahedronGeometry(0.62, 0);
  rock.scale(1, 0.72, 1.25);
  rock.translate(0, 0.2, 0);
  const slab = new THREE.BoxGeometry(1.7, 0.34, 1.1);
  slab.rotateZ(0.14);
  slab.translate(0, 0.16, 0);
  const limb = (len, r, rz, rx, y) => {
    const g = new THREE.CylinderGeometry(r * 0.4, r, len, 5);
    g.translate(0, len / 2, 0); g.rotateZ(rz); g.rotateX(rx); g.translate(0, y, 0);
    return g;
  };
  const parts = [limb(3.4, 0.16, 0.06, 0, 0), limb(1.5, 0.07, 0.9, 0.2, 1.7), limb(1.2, 0.06, -0.8, -0.4, 2.3)];
  const snag = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return { rock, slab, snag, post: limb(2.3, 0.1, 0.07, 0.04, 0), rib: new THREE.TorusGeometry(1.1, 0.07, 4, 8, Math.PI) };
}

/** kinds: the names in the order the lists come in (scatter.js KINDS). */
export function createAshScatter(parent, M, kinds) {
  const group = new THREE.Group();
  group.name = "ash-scatter";
  group.position.set(ASH.site.x, 0, ASH.site.z);
  group.matrixAutoUpdate = false;
  group.updateMatrix();
  parent.add(group);
  const geo = shapes(), mat = { rock: M.rock, slab: M.concrete, snag: M.wood, post: M.dark, rib: M.bone };
  const meshes = kinds.map((k) => {
    const m = new THREE.InstancedMesh(geo[k], mat[k], CAP);
    m.name = "ash-scatter:" + k;
    m.count = 0;
    m.frustumCulled = false; // the instances lie all round the camera
    m.castShadow = k === "snag" || k === "rib";
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    group.add(m);
    return m;
  });
  group.updateMatrixWorld(true);

  return {
    /** lists: per kind a flat array of x, y, z, yaw, width scale, height scale. Returns how many pieces are shown. */
    fill(lists) {
      let total = 0;
      meshes.forEach((m, q) => {
        const L = lists[q], n = Math.min(CAP, L.length / 6), A = m.instanceMatrix.array;
        for (let i = 0; i < n; i++) {
          const o = i * 6, e = i * 16, w = L[o + 4], c = Math.cos(L[o + 3]) * w, s = Math.sin(L[o + 3]) * w;
          A[e] = c; A[e + 1] = 0; A[e + 2] = -s; A[e + 3] = 0;
          A[e + 4] = 0; A[e + 5] = L[o + 5]; A[e + 6] = 0; A[e + 7] = 0;
          A[e + 8] = s; A[e + 9] = 0; A[e + 10] = c; A[e + 11] = 0;
          A[e + 12] = L[o]; A[e + 13] = L[o + 1]; A[e + 14] = L[o + 2]; A[e + 15] = 1;
        }
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        total += n;
      });
      return total;
    },
    dispose() {
      for (const m of meshes) { m.geometry.dispose(); m.dispose(); }
      parent.remove(group);
    },
  };
}