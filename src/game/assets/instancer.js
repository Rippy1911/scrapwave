// Instanced placements of GLB models with an optional distance LOD: instances near the camera draw the full model,
// far ones a vertex-clustered copy, the rest are culled. Two draw calls per model part, refilled when the camera
// moves. Placement data (matrices) is fixed up front, so colliders built from the same data never move.
import * as THREE from "three";
import { loadModel, mergeParts, simplifyGeometry, partsBox } from "@/game/assets/assets";
import { onFrame, RC } from "@/game/render/frame";

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const tmp = new THREE.Matrix4();

/**
 * opts.models: model names (variants). opts.items: [{ m: Matrix4, v: variant index }].
 * opts.prepare(parts, name, box): returns [{ geometry, material }] in placement space (re-material, rotate, scale).
 * opts.lod: { near, far, cell } in metres, scaled by the quality preset's lod factor; omit to draw every instance.
 * opts.fallback: { geometry, material } drawn until the models arrive (and kept if they fail).
 */
export function createInstanced(scene, opts) {
  const { models, items, lod = null, castShadow = true, receiveShadow = true } = opts;
  const groups = models.map(() => ({ items: [], hi: [], lo: [], ready: false }));
  items.forEach((it, i) => { it.i = i; it.alive = true; (groups[it.v || 0] || groups[0]).items.push(it); });
  let density = 1, dirty = true, lastX = 1e9, lastZ = 1e9, lastLod = -1;
  const handle = { items, groups, meshes: [], fallback: null, onReady: null };

  if (opts.fallback && items.length) {
    const fb = new THREE.InstancedMesh(opts.fallback.geometry, opts.fallback.material, items.length);
    items.forEach((it, i) => fb.setMatrixAt(i, it.m));
    fb.castShadow = castShadow; fb.receiveShadow = receiveShadow; fb.frustumCulled = false; fb.userData.roam = true;
    scene.add(fb);
    handle.fallback = fb;
  }

  let pending = models.length;
  models.forEach((name, gi) => {
    const g = groups[gi];
    if (!g.items.length) { pending--; return; }
    loadModel(name).then((raw) => {
      if (raw) {
        const box = partsBox(raw);
        const parts = opts.prepare ? opts.prepare(raw, name, box) : mergeParts(raw);
        for (const p of parts) {
          const hiGeo = lod && lod.hiCell ? simplifyGeometry(p.geometry, lod.hiCell, 0.02) : p.geometry;
          const hi = new THREE.InstancedMesh(hiGeo, p.material, g.items.length);
          hi.castShadow = castShadow; hi.receiveShadow = receiveShadow; hi.frustumCulled = false; hi.count = 0; hi.userData.roam = true;
          scene.add(hi); g.hi.push(hi); handle.meshes.push(hi);
          if (lod) {
            const lg = simplifyGeometry(p.geometry, lod.cell || 0.35);
            const lo = new THREE.InstancedMesh(lg, p.material, g.items.length);
            lo.castShadow = false; lo.receiveShadow = receiveShadow; lo.frustumCulled = false; lo.count = 0; lo.userData.roam = true;
            scene.add(lo); g.lo.push(lo); handle.meshes.push(lo);
          }
        }
        g.ready = true;
      }
      if (--pending === 0) {
        if (handle.fallback && groups.every((x) => x.ready || !x.items.length)) { handle.fallback.removeFromParent(); handle.fallback = null; }
        dirty = true;
        if (handle.onReady) handle.onReady(handle);
      }
    });
  });

  function fill(cam) {
    const k = RC.q ? RC.q.lod : 1;
    const near = lod ? lod.near * k : Infinity, far = lod ? lod.far * Math.max(0.7, k) : Infinity;
    const n2 = near * near, f2 = far * far;
    const cx = cam ? cam.position.x : 0, cz = cam ? cam.position.z : 0;
    for (const g of groups) {
      if (!g.ready) continue;
      const active = Math.floor(g.items.length * Math.min(1, density));
      let h = 0, l = 0;
      for (let i = 0; i < active; i++) {
        const it = g.items[i];
        if (!it.alive) continue;
        const e = it.m.elements, d2 = (e[12] - cx) ** 2 + (e[14] - cz) ** 2;
        if (d2 < n2) { for (const m of g.hi) m.setMatrixAt(h, it.m); h++; }
        else if (lod && d2 < f2) { for (const m of g.lo) m.setMatrixAt(l, it.m); l++; }
      }
      for (const m of g.hi) { m.count = h; m.instanceMatrix.needsUpdate = true; }
      for (const m of g.lo) { m.count = l; m.instanceMatrix.needsUpdate = true; }
    }
    if (handle.fallback) {
      const fb = handle.fallback;
      items.forEach((it, i) => fb.setMatrixAt(i, it.alive ? it.m : ZERO));
      fb.count = Math.floor(items.length * Math.min(1, density));
      fb.instanceMatrix.needsUpdate = true;
    }
  }

  handle.dispose = onFrame((cam) => {
    const k = RC.q ? RC.q.lod : 1;
    if (lod && cam) {
      const dx = cam.position.x - lastX, dz = cam.position.z - lastZ;
      if (dx * dx + dz * dz > 64 || k !== lastLod) dirty = true;
    }
    if (!dirty) return;
    dirty = false; lastLod = k;
    if (cam) { lastX = cam.position.x; lastZ = cam.position.z; }
    fill(cam);
  }, scene);
  handle.setDensity = (d) => { if (d !== density) { density = d; dirty = true; } };
  handle.kill = (i) => { items[i].alive = false; dirty = true; };
  handle.revive = (i) => { items[i].alive = true; dirty = true; };
  handle.setMatrix = (i, m) => { items[i].m.copy(m); dirty = true; };
  handle.refresh = () => { dirty = true; };
  return handle;
}

/** Fit helpers for prepare(): bake a transform into every part's geometry. */
export function bakeParts(parts, matrix) {
  return parts.map((p) => { const g = p.geometry.clone(); g.applyMatrix4(matrix); return { ...p, geometry: g }; });
}
export const yRot = (a) => tmp.clone().makeRotationY(a);

/** Ground height under a footprint: the lowest of the centre and 8 points on radius r, minus sink. Nothing floats. */
export function snapY(terrain, x, z, r, sink = 0.2) {
  let y = terrain.heightAt(x, z);
  if (r > 0.05) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    y = Math.min(y, terrain.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return y - sink;
}

/** Normalise model parts: centre on x/z, bottom at y = 0, optional uniform fit so the largest x/z extent = size. */
export function normalise(parts, { size = 0, height = 0, rotY = 0, filter = null, sinkTo = null, unitBox = false } = {}) {
  const ps = filter ? parts.filter((p) => filter(p.name)) : parts;
  const box = new THREE.Box3(), b = new THREE.Box3();
  for (const p of ps) { p.geometry.computeBoundingBox(); b.copy(p.geometry.boundingBox); box.union(b); }
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const ext = Math.max(box.max.x - box.min.x, box.max.z - box.min.z), h = box.max.y - box.min.y;
  const k = size ? size / ext : height ? height / h : 1;
  const sx = unitBox ? 1 / (box.max.x - box.min.x) : k, sy = unitBox ? 1 / h : k, sz = unitBox ? 1 / (box.max.z - box.min.z) : k;
  const m = new THREE.Matrix4().makeRotationY(rotY)
    .multiply(new THREE.Matrix4().makeScale(sx, sy, sz))
    .multiply(new THREE.Matrix4().makeTranslation(-cx, -(sinkTo ?? box.min.y), -cz));
  return ps.map((p) => { const g = p.geometry.clone(); g.applyMatrix4(m); return { ...p, geometry: g }; });
}
