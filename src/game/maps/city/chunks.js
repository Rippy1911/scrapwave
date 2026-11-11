// The city's chunk grid: 128 m squares. Producers (buildings, lamps, cars, trees, fences, shop fronts) hand each
// instance to the chunk it stands in; finish() turns every chunk's list into one InstancedMesh per kind, so a chunk
// costs a handful of draw calls and the frustum culls it as a unit. Every frame batch (4 per second) the LOD pass
// switches the detail kinds on and off by distance: bodies always draw, small things only inside their range.
import * as THREE from "three";
import { RC } from "@/game/render/frame";

export const CHUNK = 128, HALF = 704;
const key = (cx, cz) => cx * 64 + cz;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

// A transform for an instance: position, yaw about y, scale.
export function compose(x, y, z, yaw, sx, sy, sz, out = new THREE.Matrix4()) {
  q.setFromAxisAngle(Y, yaw);
  return out.compose(p.set(x, y, z), q, s.set(sx, sy, sz));
}

export function createChunks(group) {
  const chunks = new Map(), kinds = {}, meshes = [];
  const chunkAt = (x, z) => {
    const cx = Math.floor((x + HALF) / CHUNK), cz = Math.floor((z + HALF) / CHUNK), k = key(cx, cz);
    let c = chunks.get(k);
    if (!c) { c = { cx, cz, x: cx * CHUNK - HALF + CHUNK / 2, z: cz * CHUNK - HALF + CHUNK / 2, lists: {}, meshes: [] }; chunks.set(k, c); }
    return c;
  };
  return {
    chunks,
    chunkAt,
    // kind = { geometry, material, range (m, 0 = always drawn), shadow, attr: { name, size } }
    kind(name, def) { kinds[name] = { range: 0, shadow: false, ...def }; return name; },
    // matrix: a Matrix4 (kept, so pass a fresh one); color: THREE.Color or null; attr: numbers for the kind's custom attribute.
    // Returns { chunk, idx } so a breakable can find its instance again.
    add(name, x, z, matrix, color = null, attr = null) { const c = chunkAt(x, z), l = c.lists[name] || (c.lists[name] = []); l.push({ matrix, color, attr }); return { chunk: c, idx: l.length - 1 }; },
    finish() {
      for (const c of chunks.values()) for (const name in c.lists) {
        const K = kinds[name], L = c.lists[name], g = K.geometry.clone();
        if (K.attr) g.setAttribute(K.attr.name, new THREE.InstancedBufferAttribute(new Float32Array(L.length * K.attr.size), K.attr.size));
        const mesh = new THREE.InstancedMesh(g, K.material, L.length);
        L.forEach((r, i) => {
          mesh.setMatrixAt(i, r.matrix);
          if (r.color) mesh.setColorAt(i, r.color);
          if (r.attr) { const a = g.getAttribute(K.attr.name); for (let k = 0; k < K.attr.size; k++) a.array[i * K.attr.size + k] = r.attr[k]; }
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = K.shadow; mesh.receiveShadow = true; mesh.name = `city:${c.cx},${c.cz}:${name}`;
        mesh.userData = { kind: name, range: K.range, chunk: c };
        mesh.computeBoundingSphere();
        group.add(mesh); c.meshes.push(mesh); meshes.push(mesh);
        c.lists[name] = null; // the matrices live in the mesh now
      }
      return meshes;
    },
    // The LOD pass: range scales with the quality preset's lod (0.55 low, 1 high, 1.5 ultra).
    update(cam) {
      const k = (RC.q && RC.q.lod) || 1;
      for (const c of chunks.values()) {
        const d = Math.max(0, Math.hypot(cam.position.x - group.position.x - c.x, cam.position.z - group.position.z - c.z) - CHUNK * 0.7);
        for (const m of c.meshes) {
          const r = m.userData.range;
          m.visible = !r || d < r * k;
          if (m.userData.kind === "buildings") m.castShadow = d < 240;
        }
      }
    },
    count: () => ({ chunks: chunks.size, meshes: meshes.length, visible: meshes.filter((m) => m.visible).length }),
    meshes: () => meshes,
  };
}
