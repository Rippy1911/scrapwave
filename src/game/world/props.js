// Breakable props (fuel barrels, oil drums, cones, signs, cacti) as instanced meshes with a spatial grid.
// Visuals are CC0 models (Poly Haven oil barrel, fuel barrel and dead quiver tree, a rusted Kenney cone) sized to
// the same footprint as before; the gameplay data (radius, height, mass) is unchanged.
import * as THREE from "three";
import { createInstanced, normalise, snapY } from "@/game/assets/instancer";
import { mergeParts } from "@/game/assets/assets";
import { wreckMaterial } from "@/game/assets/remat";

const CELL = 20;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// model, target height (m), and how to dress it
const MODELS = {
  barrel: { name: "barrel_oil_red", h: 1.2 },
  drum: { name: "barrel_fuel", h: 1.15 },
  cone: { name: "cone", h: 0.8, wreck: { paint: 0.85, soot: 0.15 } },
  cactus: { name: "tree_dead_quiver", h: 2.6 },
};

function meshHeights(scene) {
  const t = scene.getObjectByName("terrain");
  if (!t || !t.geometry) return null; // the terrain is chunked now: world.js passes the terrain itself
  const P = t.geometry.attributes.position.array, N = Math.round(Math.sqrt(P.length / 3));
  const x0 = P[0], cell = P[3] - P[0];
  const at = (i, j) => P[(j * N + i) * 3 + 1];
  return {
    heightAt(x, z) {
      const fx = Math.max(0, Math.min(N - 1.001, (x - x0) / cell)), fz = Math.max(0, Math.min(N - 1.001, (z - x0) / cell));
      const i = fx | 0, j = fz | 0, u = fx - i, w = fz - j;
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    },
  };
}

export function createProps(scene, M) {
  const KINDS = {
    barrel: { geo: new THREE.CylinderGeometry(0.42, 0.42, 1.2, 12), mat: M.paint("#b8261a"), r: 0.6, h: 1.2, explosive: true, mass: 60, color: "#b8261a" },
    drum: { geo: new THREE.CylinderGeometry(0.4, 0.4, 1.15, 10), mat: M.rust, r: 0.55, h: 1.15, mass: 40, color: "#7a4a2a" },
    cone: { geo: new THREE.ConeGeometry(0.3, 0.8, 8), mat: M.paint("#e0661c"), r: 0.4, h: 0.8, mass: 5, color: "#e0661c" },
    cactus: { geo: new THREE.CylinderGeometry(0.28, 0.35, 2.6, 7), mat: new THREE.MeshStandardMaterial({ color: "#5c6b3a", roughness: 0.9 }), r: 0.5, h: 2.6, mass: 20, color: "#5c6b3a" },
    sign: { geo: new THREE.BoxGeometry(0.1, 2.6, 0.1), mat: M.dark, r: 0.5, h: 2.6, mass: 15, color: "#3a3734", plate: true },
    fence: { geo: new THREE.BoxGeometry(0.12, 1.3, 3), mat: M.wood, r: 1.4, h: 1.3, mass: 25, color: "#6e5434" },
  };
  for (const k in KINDS) KINDS[k].geo.translate(0, KINDS[k].h / 2, 0);
  const list = [], grid = new Map(), meshes = {};
  const key = (cx, cz) => cx * 4096 + cz;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let terrain = null;

  function add(kind, x, y, z, ry = Math.random() * 6.28) {
    const p = { kind, x, y, z, ry, alive: true, idx: -1, def: KINDS[kind], respawn: 0 };
    list.push(p);
    const k = key(Math.floor(x / CELL), Math.floor(z / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
    return p;
  }

  const matrixOf = (p) => {
    q.setFromAxisAngle(up, p.ry);
    // stacked barrels (refinery dump) keep their y; ground props sit on the lowest point under them
    const gy = terrain ? terrain.heightAt(p.x, p.z) : p.y;
    const y = terrain && Math.abs(p.y - gy) < 0.35 ? snapY(terrain, p.x, p.z, p.def.r * 0.8, 0.04) : p.y;
    return m4.compose(v.set(p.x, y, p.z), q, one).clone();
  };

  // Ground props snap to their footprint: heights come from the terrain mesh (built before the props).
  function finalize(terrainRef) {
    terrain = terrainRef || meshHeights(scene);
    for (const kind in KINDS) {
      const items = list.filter((p) => p.kind === kind);
      if (!items.length) continue;
      const D = KINDS[kind], MD = MODELS[kind];
      if (MD) {
        const h = createInstanced(scene, {
          models: [MD.name], items: items.map((p) => ({ m: matrixOf(p) })),
          fallback: { geometry: D.geo, material: D.mat },
          prepare: (raw) => normalise(mergeParts(raw), { height: MD.h }).map((pp) => (MD.wreck ? { ...pp, material: wreckMaterial(pp.material, MD.wreck) } : pp)),
        });
        items.forEach((p, i) => { p.idx = i; p.inst = h; });
        meshes[kind] = h;
        continue;
      }
      const mesh = new THREE.InstancedMesh(D.geo, D.mat, items.length);
      mesh.castShadow = true; mesh.receiveShadow = true;
      items.forEach((p, i) => { p.idx = i; p.mesh = mesh; place(p); });
      scene.add(mesh);
      meshes[kind] = mesh;
    }
    if (list.some((p) => p.kind === "sign")) {
      const plates = list.filter((p) => p.kind === "sign");
      const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.7, 0.05).translate(0, 2.3, 0.08), M.hazard, plates.length);
      plates.forEach((p, i) => { p.plateIdx = i; p.plateMesh = pm; });
      meshes.signPlate = pm;
      plates.forEach(place);
      scene.add(pm);
    }
  }
  function place(p) {
    if (p.inst) { p.inst.revive(p.idx); return; }
    q.setFromAxisAngle(up, p.ry);
    m4.compose(v.set(p.x, p.y, p.z), q, one);
    p.mesh.setMatrixAt(p.idx, m4);
    p.mesh.instanceMatrix.needsUpdate = true;
    if (p.plateMesh) { p.plateMesh.setMatrixAt(p.plateIdx, m4); p.plateMesh.instanceMatrix.needsUpdate = true; }
  }
  function kill(p) {
    p.alive = false;
    p.respawn = 90;
    if (p.inst) { p.inst.kill(p.idx); return; }
    p.mesh.setMatrixAt(p.idx, ZERO);
    p.mesh.instanceMatrix.needsUpdate = true;
    if (p.plateMesh) { p.plateMesh.setMatrixAt(p.plateIdx, ZERO); p.plateMesh.instanceMatrix.needsUpdate = true; }
  }
  function near(x, z, r, fn) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const l = grid.get(key(i, j));
      if (!l) continue;
      for (const p of l) if (p.alive && (p.x - x) ** 2 + (p.z - z) ** 2 < (r + p.def.r) ** 2) fn(p);
    }
  }
  function update(dt) {
    for (const p of list) if (!p.alive) { p.respawn -= dt; if (p.respawn < 0) { p.alive = true; place(p); } }
  }
  const explosives = () => list.filter((p) => p.def.explosive);
  return { add, finalize, kill, near, update, list, KINDS, explosives };
}
