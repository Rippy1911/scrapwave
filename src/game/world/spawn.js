// Safe vehicle placement: ground from terrain + road surface only (never roofs or prop tops),
// clearance checks against colliders, props and other vehicles, and road-aligned poses.

// Road ribbon or terrain height — whichever is higher. Ignores every collider.
export function surfaceY(world, x, z) {
  const t = world.terrain.heightAt(x, z);
  const r = world.roads.nearest(x, z, 2, false);
  if (r.road && r.dist < r.road.width / 2 + 0.5) return Math.max(t, r.y + 0.06);
  return t;
}

// True when no collider footprint, breakable prop or other vehicle is within `radius` of (x, z).
export function clearAt(world, x, z, radius, vehicles = [], skip = null) {
  let blocked = false;
  world.colliders.collect(x, z, radius, (b) => {
    if (blocked || b.dead) return;
    const dx = x - b.x, dz = z - b.z;
    const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
    const ex = Math.max(0, Math.abs(lx) - b.hx), ez = Math.max(0, Math.abs(lz) - b.hz);
    if (Math.hypot(ex, ez) < radius) blocked = true;
  });
  if (blocked) return false;
  world.props.near(x, z, radius, () => { blocked = true; });
  if (blocked) return false;
  for (const v of vehicles) if (v !== skip && v.mesh.root.parent && Math.hypot(v.pos.x - x, v.pos.z - z) < radius + 3) return false;
  return true;
}

const headingOf = (dx, dz) => Math.atan2(-dx, -dz);
const clearFor = (v, base) => base + (v ? v.chassis.hit.half[2] : 2);

// A pose on `roadId` near `s` metres, facing along the road (dir ±1), with the area clear.
export function roadSpawn(world, { road: roadId, s, dir = 1, clear = 6 }, vehicles = [], v = null) {
  const road = world.roads.roads.find((r) => r.id === roadId);
  const S = road.samples;
  let i0 = 0;
  while (i0 < S.length - 1 && S[i0].s < s) i0++;
  const radius = clearFor(v, clear);
  for (let k = 0; k < 60; k++) {
    const i = i0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 2;
    const p = S[i];
    if (!p || p.deck || p.bridge) continue;
    if (!clearAt(world, p.x, p.z, radius, vehicles, v)) continue;
    return { x: p.x, y: surfaceY(world, p.x, p.z), z: p.z, heading: headingOf(p.dx * dir, p.dz * dir) };
  }
  const p = S[i0];
  return { x: p.x, y: surfaceY(world, p.x, p.z), z: p.z, heading: headingOf(p.dx * dir, p.dz * dir) };
}

// Nearest clear road point to (x, z), facing along the road in the direction closest to `fx, fz`.
export function nearestRoadPose(world, x, z, fx = 0, fz = -1, vehicles = [], v = null) {
  const n = world.roads.nearest(x, z, 10, false);
  if (!n.road) return { x, y: surfaceY(world, x, z), z, heading: headingOf(fx, fz) };
  const road = n.road, sgn = n.dx * fx + n.dz * fz >= 0 ? 1 : -1;
  return roadSpawn(world, { road: road.id, s: road.samples[n.i].s, dir: sgn, clear: 3 }, vehicles, v);
}

// A clear road point near the edge of the map, far from `avoid` (used for Drifter respawns).
export function edgeRoadSpawn(world, avoid, vehicles = [], rand = Math.random) {
  const roads = world.roads.roads;
  for (let tries = 0; tries < 80; tries++) {
    const r = roads[Math.floor(rand() * roads.length)];
    const p = r.samples[Math.floor(rand() * r.samples.length)];
    if (p.deck || p.bridge || Math.max(Math.abs(p.x), Math.abs(p.z)) < 380) continue;
    if (avoid && Math.hypot(p.x - avoid.x, p.z - avoid.z) < 250) continue;
    if (!clearAt(world, p.x, p.z, 7, vehicles)) continue;
    const toC = p.dx * -p.x + p.dz * -p.z >= 0 ? 1 : -1;
    return { x: p.x, y: surfaceY(world, p.x, p.z), z: p.z, heading: headingOf(p.dx * toC, p.dz * toC) };
  }
  return roadSpawn(world, { road: "highway", s: 700, dir: -1 }, vehicles);
}

// A clear pose `ahead` metres along the nearest road from a point (for test spawns).
export function poseAt(world, x, z, headingDeg) {
  const h = (headingDeg * Math.PI) / 180;
  return { x, y: surfaceY(world, x, z), z, heading: headingOf(Math.sin(h), -Math.cos(h)) };
}