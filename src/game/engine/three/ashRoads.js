// The Ashmark's road surfaces: ribbon meshes cut from the laid-out network (maps/ashmark/roads.js), one mesh per
// CHUNK samples (about 580 m) so the camera's frustum and a distance check drop most of the 49 km. Highways and
// roads wear the broken-asphalt ribbon material, tracks the dirt one (render/materials.js: uv.x across, uv.y along).
// A gap in a bridge is left open. The ground under every ribbon is graded to it, so the ribbon sits LIFT above it.
import * as THREE from "three";
import { ASH } from "@/game/maps/ashmark/layout";
import { mapHeight } from "@/game/maps/ashmark/height";
import { pointAt } from "@/game/maps/ashmark/roadLine";

const CHUNK = 48, LIFT = 0.09, SEE = 2600; // metres past which a stretch is not drawn (it is a few pixels wide)

export function createAshRoads(parent, M, net) {
  const group = new THREE.Group();
  group.name = "ash-roads";
  group.position.set(ASH.site.x, 0, ASH.site.z); // the samples are in map coordinates
  group.matrixAutoUpdate = false;
  group.updateMatrix();
  parent.add(group);
  const chunks = [];
  let shown = 0;

  for (const R of net.list) {
    const P = R.pts, n = P.length, last = R.loop ? n : n - 1, hw = R.w / 2, mat = R.kind === "track" ? M.dirt : M.asphalt;
    const at = (i) => P[R.loop ? ((i % n) + n) % n : i < 0 ? 0 : i >= n ? n - 1 : i];
    // Where sample i is drawn: at the deck's end for a sample over a gap, and no nearer a junction than the edge of
    // the road this one joins (R.trim), so the two surfaces never overlap.
    const s0 = R.trim[0], s1 = (n - 1) * R.ds - R.trim[1];
    const spot = (p) => p.lip || (R.loop || (p.s >= s0 && p.s <= s1) ? p : pointAt(P, R.ds, p.s < s0 ? s0 : s1));
    for (let a = 0; a < last; a += CHUNK) {
      const cnt = Math.min(last, a + CHUNK) - a + 1;
      const pos = new Float32Array(cnt * 6), nor = new Float32Array(cnt * 6), uv = new Float32Array(cnt * 4), idx = [];
      for (let k = 0; k < cnt; k++) {
        const i = a + k, p = at(i), c = spot(p), q0 = at(i - 1), q1 = at(i + 1), l = Math.hypot(q1.x - q0.x, q1.z - q0.z) || 1;
        const px = (-(q1.z - q0.z) / l) * hw, pz = ((q1.x - q0.x) / l) * hw, v = (c === p ? i * R.ds : c.s) / (R.w * 1.4);
        // In a junction the two edges lie on the ground, which slopes with the road this one joins.
        const yl = p.join ? mapHeight(c.x - px, c.z - pz) : c.y, yr = p.join ? mapHeight(c.x + px, c.z + pz) : c.y;
        pos.set([c.x - px, yl + LIFT, c.z - pz, c.x + px, yr + LIFT, c.z + pz], k * 6);
        nor.set([0, 1, 0, 0, 1, 0], k * 6);
        uv.set([0, v, 1, v], k * 4);
        if (k < cnt - 1 && !(p.gap && at(i + 1).gap)) { const o = k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.name = "ash-road:" + R.id;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      group.add(m);
      const c = g.boundingSphere;
      chunks.push({ m, x: c.center.x + ASH.site.x, z: c.center.z + ASH.site.z, r: c.radius });
    }
  }
  group.updateMatrixWorld(true);

  return {
    /** Shows the stretches near the camera (world x, z). Called a few times a second. */
    update(camX, camZ) {
      shown = 0;
      for (const c of chunks) { c.m.visible = Math.hypot(c.x - camX, c.z - camZ) < SEE + c.r; if (c.m.visible) shown++; }
    },
    stats: () => ({ meshes: chunks.length, shown }),
    dispose() {
      for (const c of chunks) c.m.geometry.dispose();
      parent.remove(group);
      chunks.length = 0;
    },
  };
}