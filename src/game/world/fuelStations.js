// Fuel stations: a covered pad with two pumps beside the road at the Well-town and at both scrapyards.
// Built after the world (own meshes + colliders), so nothing in places/ changes.
import * as THREE from "three";
import { clearAt } from "@/game/world/spawn";

const SITES = [
  { id: "town", place: "town", rMin: 26, rMax: 52, want: 40, town: true, name: "Well-town pumps" },
  { id: "scrapN", place: "scrapN", rMin: 50, rMax: 95, want: 62, name: "North Scrapyard pumps" },
  { id: "scrapSW", place: "scrapSW", rMin: 50, rMax: 95, want: 62, name: "Rattler Scrapyard pumps" },
];

// A clear spot just off a road sample, nearest the wanted distance from the place centre.
function findSpot(world, cx, cz, site) {
  const cands = [];
  for (const road of world.roads.roads) {
    for (let i = 0; i < road.samples.length; i += 2) {
      const s = road.samples[i];
      if (s.deck || s.bridge) continue;
      const d = Math.hypot(s.x - cx, s.z - cz);
      if (d >= site.rMin && d <= site.rMax) cands.push({ s, road, score: Math.abs(d - site.want) });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  for (const { s, road } of cands) {
    for (const side of [1, -1]) {
      const off = road.width / 2 + 5.5;
      const x = s.x - s.dz * off * side, z = s.z + s.dx * off * side;
      if (world.roads.nearest(x, z, 3, true).dist < road.width / 2 + 3.5) continue;
      if (!clearAt(world, x, z, 6.5)) continue;
      return { x, z, yaw: Math.atan2(s.dx, s.dz) };
    }
  }
  return null;
}

function buildPad(scene, M, colliders, at, y) {
  const g = new THREE.Group();
  g.position.set(at.x, y, at.z);
  g.rotation.y = at.yaw;
  const box = (mat, x, yy, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, yy, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  box(M.concrete, 0, 0.06, 0, 7, 0.14, 10);
  box(M.hazard, 0, 0.14, -4.9, 7, 0.04, 0.3);
  const red = M.paint("#b23a1f");
  for (const pz of [-2.2, 2.2]) {
    box(M.concrete, 0, 0.25, pz, 1.1, 0.35, 0.9);
    box(red, 0, 1.3, pz, 0.7, 1.8, 0.6);
    box(M.lamp, 0, 2.35, pz, 0.75, 0.3, 0.65);
    box(M.dark, -0.4, 1.1, pz + 0.15, 0.06, 1.2, 0.06);
  }
  for (const [px, pz] of [[-3, -4.4], [3, -4.4], [-3, 4.4], [3, 4.4]]) box(M.dark, px, 2.4, pz, 0.25, 4.8, 0.25);
  box(M.rust, 0, 4.9, 0, 7.6, 0.3, 10.4);
  box(M.hazard, 0, 4.55, 5.15, 7.6, 0.4, 0.12);
  box(M.sign("FUEL", "STOP AT THE PUMP", "#2b2a28", "#f2c230"), 0, 5.7, 0, 0.12, 1.1, 3.2);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4, 40), new THREE.MeshBasicMaterial({ color: "#f2c230", transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.16;
  g.add(ring);
  scene.add(g);
  g.updateMatrixWorld(true);
  for (const pz of [-2.2, 2.2]) {
    const w = g.localToWorld(new THREE.Vector3(0, 0, pz));
    colliders.add({ x: w.x, y: y + 1.2, z: w.z, hx: 0.45, hy: 1.2, hz: 0.4, yaw: at.yaw, tag: "pump" });
  }
  return { group: g, ring };
}

export function buildFuelStations(scene, M, world) {
  const out = [];
  for (const site of SITES) {
    const pl = world.places[site.place];
    const at = findSpot(world, pl.x, pl.z, site);
    if (!at) continue;
    const y = world.terrain.heightAt(at.x, at.z);
    const { group, ring } = buildPad(scene, M, world.colliders, at, y);
    out.push({ ...site, x: at.x, y, z: at.z, yaw: at.yaw, group, ring, filling: 0 });
  }
  return {
    list: out,
    nearest(x, z, filter) {
      let best = null, bd = Infinity;
      for (const s of out) { if (filter && !filter(s)) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
      return best;
    },
    update(t) { for (const s of out) { s.ring.material.opacity = s.filling > 0 ? 0.45 + Math.sin(t * 10) * 0.2 : 0.18 + Math.sin(t * 2) * 0.06; s.filling = Math.max(0, s.filling - 0.05); } },
  };
}