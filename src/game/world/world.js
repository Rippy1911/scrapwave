// Assembles the Saltreach basin: terrain, roads, places, ramps, scatter, props and plot beacons.
import * as THREE from "three";
import { createTerrain } from "@/game/world/terrain";
import { buildRoads } from "@/game/world/roads";
import { createColliders } from "@/game/world/colliders";
import { createKit } from "@/game/world/places/kit";
import { rampGeometry, buildRamps } from "@/game/world/places/ramps";
import { buildTown } from "@/game/world/places/town";
import { buildScrapyard } from "@/game/world/places/scrapyard";
import { buildHighwayBridge, buildRailBridge, buildDam } from "@/game/world/places/bridges";
import { buildRefinery } from "@/game/world/places/refinery";
import { buildTanker } from "@/game/world/places/tanker";
import { buildTower } from "@/game/world/places/tower";
import { buildScatter } from "@/game/world/scatter";
import { buildRoadside } from "@/game/world/roadside";
import { createProps } from "@/game/world/props";
import { buildWreckLines, buildHorizonSmoke } from "@/game/world/wrecklines";
import { createKeepOut } from "@/game/world/keepout";
import { RAMP_SIZE } from "@/game/world/landform";
import { buildLandDress } from "@/game/world/landDress";
import { buildCamps } from "@/game/world/camps";
import { createGroundCover } from "@/game/world/groundCover";
import { findSites } from "@/game/arena/site";
import { PLACES, PLOTS } from "@/game/data/places";
import { mulberry32 } from "@/game/core/rng";

// The slope test of places/ramps.js (flatSpot), for the look pass.
function rampSlope(terrain, p, len, w) {
  const fx = p.dirX, fz = p.dirZ, sx = -fz, sz = fx;
  const h = (a, b) => terrain.heightAt(p.x + fx * a + sx * b, p.z + fz * a + sz * b);
  return Math.max(Math.abs(h(len / 2, 0) - h(-len / 2, 0)) / len, Math.abs(h(0, w / 2) - h(0, -w / 2)) / w);
}
// The spots flatSpot tries, in its order: the road ramp's alternates, or up to 40 m along and 8 m across.
function rampTries(r) {
  if (r.alts) return [r, ...r.alts];
  const fx = r.dirX, fz = r.dirZ, sx = -fz, sz = fx, ab = [];
  for (const a of [0, 10, -10, 20, -20, 30, -30, 40, -40]) for (const b of [0, 8, -8]) ab.push([a, b]);
  ab.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
  return ab.map(([a, b]) => ({ x: r.x + fx * a + sx * b, z: r.z + fz * a + sz * b, dirX: fx, dirZ: fz }));
}
// A run-up a car can use: over the 45 m behind the foot, no 5 m step of more than 1.5 m and no point 8 m off the foot.
function runUpOk(terrain, p, len) {
  const h = (a) => terrain.heightAt(p.x + p.dirX * a, p.z + p.dirZ * a), h0 = h(-len / 2);
  let prev = h0;
  for (let k = 5; k <= 45; k += 5) {
    const y = h(-len / 2 - k);
    if (Math.abs(y - prev) > 1.5 || Math.abs(y - h0) > 8) return false;
    prev = y;
  }
  return true;
}
// A moved ramp keeps clear of places (a wreck, a town): none within its pad + 10 m of the run-up or 60 m past the lip.
function clearOfPlaces(p, len) {
  for (let a = -len / 2 - 45; a <= len / 2 + 60; a += 5) {
    const x = p.x + p.dirX * a, z = p.z + p.dirZ * a;
    for (const q of PLACES) if (Math.hypot(q.x - x, q.z - z) < (q.pad || q.r || 0) + 10) return false;
  }
  return true;
}

export async function buildWorld(scene, T, M, quality, progress = () => {}, opts = {}) {
  const tick = async (p, msg) => { progress(p, msg); await new Promise((r) => setTimeout(r, 0)); };
  await tick(0.2, "Raising mesas...");
  const terrain = createTerrain();
  const place = Object.fromEntries(PLACES.map((p) => [p.id, p]));
  for (const p of PLACES) if (p.pad) p.y = terrain.flattenPad(p.x, p.z, p.pad, 30);
  for (const p of PLOTS) p.y = terrain.flattenPad(p.x, p.z, 32, 20);
  await tick(0.35, "Laying broken highways...");
  const roads = buildRoads(terrain, M);
  scene.add(roads.group);

  await tick(0.5, "Welding the Well-town...");
  const colliders = createColliders();
  const kit = createKit(scene, M, colliders, terrain);
  kit.rampGeo = rampGeometry(1.0);
  const props = createProps(scene, M);

  const town = buildTown(kit, place.town, roads);
  const scrapN = buildScrapyard(kit, place.scrapN, 1, roads);
  const scrapSW = buildScrapyard(kit, place.scrapSW, 2, roads);
  const hbridge = buildHighwayBridge(kit, roads);
  buildRailBridge(kit, roads);
  buildDam(kit, roads, place.dam);
  await tick(0.62, "Lighting the flare stacks...");
  const refinery = buildRefinery(kit, place.refinery, props, roads);
  const tanker = buildTanker(kit, place.tanker);
  const tower = buildTower(kit, place.tower);
  // Look pass: a ramp spot that no try of places/ramps.js fits (0.12 slope limit) would be left out; level it first.
  // A spot that fits but whose run-up drops off a canyon rim or meets a mesa foot moves to the first try with a usable
  // run-up (the same tries, so buildRamps keeps it there); with none, it stays as it was.
  const movedRamps = [];
  roads.rampPlacements.forEach((rp, i) => {
    const [len, w] = RAMP_SIZE[rp.type] || RAMP_SIZE.kicker;
    if ((rp.alts ? [rp, ...rp.alts] : [rp]).every((p) => rampSlope(terrain, p, len, w) > 0.12)) { terrain.levelSpot(rp, len, w); return; }
    const tries = rampTries(rp), fits = (p) => rampSlope(terrain, p, len, w) <= 0.12, first = tries.find(fits);
    if (!first || runUpOk(terrain, first, len)) return;
    const good = tries.find((p) => fits(p) && runUpOk(terrain, p, len) && clearOfPlaces(p, len));
    if (!good || good === rp) return;
    roads.rampPlacements[i] = { ...rp, x: good.x, z: good.z, dirX: good.dirX, dirZ: good.dirZ };
    movedRamps.push({ i, type: rp.type, from: [Math.round(first.x), Math.round(first.z)], to: [Math.round(good.x), Math.round(good.z)] });
  });
  const ramps = buildRamps(kit, roads.rampPlacements, M);
  kit.ramps = ramps; // scatter and roadside keep colliders out of the ramp lanes
  // Look pass: no strata wall beside a ramp's run-up or landing (the jumps carry 50-75 m), then draw the terrain.
  const nearRoadOrPlace = (x, z) => {
    const n = roads.nearest(x, z, 2, true);
    if (n.road && n.dist < n.road.width / 2 + 8) return true;
    for (const p of PLACES) if (Math.hypot(p.x - x, p.z - z) < (p.pad || p.r) + 10) return true;
    for (const p of PLOTS) if (Math.hypot(p.x - x, p.z - z) < 45) return true;
    return false;
  };
  for (const rp of ramps) terrain.clearLane(rp, 50, 85, nearRoadOrPlace);
  scene.add(terrain.buildMesh(T));

  // Plot beacons, rings and rigs are built by src/game/base/plots.js (the plot centre stays clear for the Rig).
  const plots = PLOTS.map((p) => ({ ...p, y: terrain.heightAt(p.x, p.z) }));

  // Roadside clutter: props along the roads
  const r = mulberry32(99);
  for (const road of roads.roads) {
    for (let i = 10; i < road.samples.length; i += 22) {
      const s = road.samples[i];
      if (s.deck || s.bridge) continue;
      const side = r() > 0.5 ? 1 : -1, off = road.width / 2 + 2.5;
      const x = s.x - s.dz * off * side, z = s.z + s.dx * off * side;
      const y = terrain.heightAt(x, z);
      const roll = r();
      if (roll < 0.25) props.add("sign", x, y, z, Math.atan2(s.dx, s.dz));
      else if (roll < 0.45) for (let k = 0; k < 3; k++) props.add("cone", x + k * 0.9 * s.dx, y, z + k * 0.9 * s.dz);
      else if (roll < 0.62) props.add("drum", x, y, z);
      else if (roll < 0.72) props.add("barrel", x, y, z);
      else if (roll < 0.86 && road.kind === "dirt") for (let k = 0; k < 4; k++) props.add("fence", x + s.dx * k * 3, terrain.heightAt(x + s.dx * k * 3, z + s.dz * k * 3), z + s.dz * k * 3, Math.atan2(s.dx, s.dz));
      else props.add("cactus", x + side * 3, y, z);
    }
  }
  for (const ramp of ramps) props.add("barrel", ramp.x + ramp.dirZ * 6, terrain.heightAt(ramp.x + ramp.dirZ * 6, ramp.z - ramp.dirX * 6), ramp.z - ramp.dirX * 6);

  if (opts.extraProps) for (const pr of opts.extraProps(roads)) props.add(pr.kind, pr.x, terrain.heightAt(pr.x, pr.z), pr.z);

  await tick(0.75, "Scattering rocks and wrecks...");
  const baseScatter = buildScatter(kit, roads, quality.scatter);
  const roadside = buildRoadside(kit, roads, M, quality.scatter);
  const scatter = { ...baseScatter, setDensity: (d) => { baseScatter.setDensity(d); roadside.setDensity(d); } };
  // Old crash scenes and abandoned convoys along the roads (seeded, same colliders on every client; they keep off
  // roads, ramps, plots and places), plus smoke columns beyond the rim.
  const wrecks = buildWreckLines(kit, roads, { ramps, scatter: baseScatter, props });
  buildHorizonSmoke(kit);
  // Look pass: the arena sites are fixed first (on the ground as it is now) so no rock or tree lands on an arena floor,
  // then camps, ruins and power lines, cliff blocks, scree, boulder fields and flora, then the near ground cover.
  await tick(0.8, "Weathering the mesas...");
  const arenaProbe = { terrain, roads, colliders };
  const arenaSites = findSites(arenaProbe);
  const keep = createKeepOut({ terrain, roads, ramps, colliders, arenas: Object.values(arenaSites) });
  const camps = buildCamps(kit, roads, keep);
  const land = buildLandDress(kit, keep, T);
  kit.finalize();
  props.finalize(terrain);
  const cover = createGroundCover(scene, terrain, keep, T);
  const look = { land: land.stats, camps: camps.sites, wires: camps.wires, cover, buttes: terrain.buttes.map((b) => ({ x: Math.round(b.x), z: Math.round(b.z), r: Math.round(b.r), H: Math.round(b.H) })) };
  if (typeof window !== "undefined") window.scrapwakeLook = { ...look, terrain, movedRamps }; // probes read the height grid and masks

  const tmpN = new THREE.Vector3();
  function groundAt(x, z, yRef, n) {
    const th = terrain.heightAt(x, z);
    const sb = colliders.groundAt(x, z, yRef, tmpN);
    if (sb > th) { if (n) { n.copy(tmpN); n.box = tmpN.box; } return sb; }
    if (n) { terrain.normalAt(x, z, n); n.box = null; }
    return th;
  }

  return {
    terrain, roads, colliders, props, kit, scatter, ramps, plots, groundAt, wrecks, arenaSites, look, keep,
    places: place, town, scrapN, scrapSW, hbridge, refinery, tanker, tower,
    lootSpots: [...scrapN.loot, ...scrapSW.loot.map((l) => ({ ...l, rattler: true })), ...tanker.loot],
    updaters: kit.updaters, labels: kit.labels,
  };
}