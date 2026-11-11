// The Rapier world behind one game world: the terrain as a heightfield, every static collider from
// colliders.js (boxes as cuboids, ramp wedges as convex slices that follow the visible curve, hulls),
// and walls at the map edge. Created lazily on the first vehicle step once the WASM module is ready.
import RAPIER from "@dimforge/rapier3d-compat";
import { WORLD, PHYSICS } from "@/game/data/tuning";

let ready = false;
// Starts as soon as the game code is imported, long before the world finishes building.
export const physicsReady = RAPIER.init().then(() => { ready = true; });
export { RAPIER };

// Scatter clutter gets rounded corners so a car glances off instead of snagging on a box edge.
const ROUND = { rock: 0.6, husk: 0.35, bones: 0.35, tyres: 0.5 };

export function getPhys(world) {
  if (world.phys) return world.phys;
  if (!ready) return null;
  world.phys = createPhys(world);
  return world.phys;
}

function createPhys(world) {
  const R = new RAPIER.World({ x: 0, y: -WORLD.gravity, z: 0 });
  R.timestep = 1 / PHYSICS.hz;
  // Rapier 0.21's World.step() ends by re-mapping every body and collider handle to its JS object (about 16,000
  // WASM-JS calls and 740 KB of garbage per step with our ~8,000 colliders: steady GC pauses). Bodies and colliders
  // are mapped when created and unmapped when removed, and nothing is created inside a step (no soft bodies), so
  // that pass is skipped.
  R.mapNewSoftBodies = () => {};
  const P = {
    R, eq: new RAPIER.EventQueue(true), world,
    vehicles: new Set(), pending: new Set(), byCollider: new Map(), carHits: new Map(),
    tick: 0, time: 0, active: 0, statics: 0,
    stats: { ms: 0, msAvg: 0, msMax: 0, stepMs: 0, steps: 0, vehicles: 0 },
  };

  // Terrain. Our grid is H[zi * N + xi]; Rapier's heightfield is column-major with rows along z and columns
  // along x. Rapier splits each cell along the (x+1, z)-(x, z+1) diagonal, the same as the render mesh, so the
  // collider surface is the triangles on screen (checkHeightfield measures it).
  const T = world.terrain, N = T.N;
  const h = new Float32Array(N * N);
  for (let zi = 0; zi < N; zi++) for (let xi = 0; xi < N; xi++) h[xi * N + zi] = T.H[zi * N + xi];
  P.terrainCollider = R.createCollider(
    RAPIER.ColliderDesc.heightfield(N - 1, N - 1, h, { x: T.S, y: 1, z: T.S }, RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES)
      .setFriction(PHYSICS.groundFriction).setRestitution(PHYSICS.groundRestitution),
  );

  // Map edge walls (the terrain also rises there).
  const B = WORLD.bound + 3;
  for (const [x, z, hx, hz] of [[B, 0, 2, B + 4], [-B, 0, 2, B + 4], [0, B, B + 4, 2], [0, -B, B + 4, 2]]) {
    R.createCollider(RAPIER.ColliderDesc.cuboid(hx, 160, hz).setTranslation(x, 80, z).setFriction(0.2).setRestitution(0.3));
  }

  for (const b of world.colliders.all) if (!b.dead) addStatic(P, b);
  P.unlisten = world.colliders.listen((type, b) => (type === "add" ? addStatic(P, b) : removeStatic(P, b)));
  return P;
}

// Runtime static colliders (base walls, modules): a box {x, y, z, hx, hy, hz, yaw, tag} or a convex hull
// {points: [[x, y, z], ...] in world space, tag}. Goes through colliders.js, so weapons, spawns and the
// camera see it too, and the Rapier world gets it at once. Returns an id for removeStaticCollider.
export function addStaticCollider(world, spec) {
  return (spec.points ? world.colliders.addHull(spec) : world.colliders.add({ ...spec })).id;
}
export function removeStaticCollider(world, id) { world.colliders.removeById(id); }

const yawQ = (yaw) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });

// A wedge rises from the foot (local +z) to the lip (local -z): top(s) = bottom + 2hy * s^curve.
// Curved tops are concave, so they become slices, each the convex hull of one chord of the curve.
function wedgeDescs(b) {
  const c = b.curve || 1.4, n = Math.abs(c - 1) < 0.02 ? 1 : 8;
  const top = (s) => -b.hy + 2 * b.hy * Math.pow(s, c), zAt = (s) => b.hz - 2 * b.hz * s;
  const out = [];
  for (let k = 0; k < n; k++) {
    const pts = [];
    for (const s of [k / n, (k + 1) / n]) for (const x of [-b.hx, b.hx]) pts.push(x, -b.hy, zAt(s), x, top(s), zAt(s));
    const d = RAPIER.ColliderDesc.convexHull(new Float32Array(pts));
    if (d) out.push(d);
  }
  return out;
}

function addStatic(P, b) {
  if (b.noCollide || b.dead || b._rc) return;
  let descs;
  if (b.kind === "wedge") descs = wedgeDescs(b).map((d) => d.setTranslation(b.x, b.y, b.z).setRotation(yawQ(b.yaw)));
  else if (b.kind === "hull") { const d = RAPIER.ColliderDesc.convexHull(b.points); descs = d ? [d] : []; }
  else {
    const r = Math.min(b.hx, b.hy, b.hz) * (ROUND[b.tag] || 0);
    const d = r > 0.05 ? RAPIER.ColliderDesc.roundCuboid(b.hx - r, b.hy - r, b.hz - r, r) : RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz);
    descs = [d.setTranslation(b.x, b.y, b.z).setRotation(yawQ(b.yaw))];
  }
  b._rc = descs.map((d) => P.R.createCollider(d.setFriction(PHYSICS.staticFriction).setRestitution(PHYSICS.staticRestitution)));
  P.statics += b._rc.length;
}

function removeStatic(P, b) {
  if (!b._rc) return;
  for (const c of b._rc) P.R.removeCollider(c, true);
  P.statics -= b._rc.length;
  b._rc = null;
}

// Height of the rendered terrain triangles at (x, z) (terrain.js buildMesh: a,c,b and b,c,d per cell).
function meshHeight(T, x, z) {
  const fx = Math.min(T.N - 1.0001, Math.max(0, (x + T.half) / T.cell)), fz = Math.min(T.N - 1.0001, Math.max(0, (z + T.half) / T.cell));
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * T.N + i, H = T.H;
  const a = H[k], b = H[k + 1], c = H[k + T.N], d = H[k + T.N + 1];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

// Heightfield check: ray-cast straight down at random points and compare with the rendered triangles
// (meshErr, should be ~0) and with the bilinear terrain.heightAt the old physics used (bilinearErr).
export function checkHeightfield(world, samples = 400) {
  const P = getPhys(world);
  if (!P) return null;
  const T = world.terrain;
  let max = 0, sum = 0, n = 0, bmax = 0;
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  for (let i = 0; i < samples; i++) {
    const x = (Math.random() - 0.5) * T.S * 0.95, z = (Math.random() - 0.5) * T.S * 0.95;
    ray.origin = { x, y: 400, z };
    const hit = P.R.castRay(ray, 1000, true, undefined, undefined, undefined, undefined, (c) => c === P.terrainCollider);
    if (!hit) continue;
    const hy = 400 - hit.timeOfImpact;
    const e = Math.abs(hy - meshHeight(T, x, z));
    max = Math.max(max, e); sum += e; n++;
    bmax = Math.max(bmax, Math.abs(hy - T.heightAt(x, z)));
  }
  // Grid vertices must match exactly.
  let vmax = 0;
  for (let i = 0; i < 50; i++) {
    const xi = Math.floor(Math.random() * T.N), zi = Math.floor(Math.random() * T.N);
    const x = -T.half + xi * T.cell, z = -T.half + zi * T.cell;
    ray.origin = { x: Math.max(-T.half + 1e-3, Math.min(T.half - 1e-3, x)), y: 400, z: Math.max(-T.half + 1e-3, Math.min(T.half - 1e-3, z)) };
    const hit = P.R.castRay(ray, 1000, true, undefined, undefined, undefined, undefined, (c) => c === P.terrainCollider);
    if (hit) vmax = Math.max(vmax, Math.abs(400 - hit.timeOfImpact - T.H[zi * T.N + xi]));
  }
  return { samples: n, meshMeanErr: +(sum / Math.max(1, n)).toFixed(4), meshMaxErr: +max.toFixed(4), vertexMaxErr: +vmax.toFixed(4), bilinearMaxErr: +bmax.toFixed(3) };
}
