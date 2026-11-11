// Places you can walk up to and use with E: the Well-town trader stand, the garage, the job board, and the
// trader at every outpost. The trader stand and the job board are small new meshes built here (their own
// colliders), next to the well; the garage is the existing bay. Each landmark: { id, kind, name, x, z, r, verb }.
import * as THREE from "three";
import { clearAt, surfaceY } from "@/game/world/spawn";

// A clear, off-road spot near (cx + dx, cz + dz).
export function spotNear(world, cx, cz, dx, dz, clear = 2.2) {
  for (let i = 0; i < 24; i++) {
    const a = Math.atan2(dz, dx) + (i % 2 ? 1 : -1) * Math.floor((i + 1) / 2) * 0.18, d = Math.hypot(dx, dz) + Math.floor(i / 8) * 2;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, n = world.roads.nearest(x, z, 4, true);
    if ((!n.road || n.dist > n.road.width / 2 + 2.5) && clearAt(world, x, z, clear)) return { x, z };
  }
  return { x: cx + dx, z: cz + dz };
}

function signPost(game, x, z, yaw, title, sub, bg, fg) {
  const { M, world, scene } = game, y = surfaceY(world, x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = yaw;
  const box = (mat, sx, sy, sz, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(px, py, pz); m.castShadow = true; g.add(m); };
  box(M.wood, 0.16, 2.6, 0.16, -1.1, 1.3, 0);
  box(M.wood, 0.16, 2.6, 0.16, 1.1, 1.3, 0);
  box(M.sign(title, sub, bg, fg), 2.6, 1.2, 0.08, 0, 2.1, 0.06);
  box(M.rust, 2.2, 0.9, 0.7, 0, 0.45, 0.5); // counter crate
  scene.add(g);
  world.colliders.add({ x, y: y + 0.6, z, hx: 1.3, hy: 0.6, hz: 0.45, yaw, tag: "landmark" });
  return g;
}

export function buildLandmarks(game, zones) {
  const { world } = game, t = world.town.bank, out = [];
  const face = (x, z) => Math.atan2(t.x - x, t.z - z); // signs face the well
  const tr = spotNear(world, t.x, t.z, 7, 8);
  signPost(game, tr.x, tr.z, face(tr.x, tr.z), "TRADER", "TRAPS · RESTOCK · TYRES", "#2b2a28", "#f2c230");
  out.push({ id: "trader-town", kind: "trader", name: "Trader", x: tr.x, z: tr.z, r: 3.2, verb: "Trade" });
  const jb = spotNear(world, t.x, t.z, -8, 7);
  signPost(game, jb.x, jb.z, face(jb.x, jb.z), "JOB BOARD", "RADIO JOBS · BOUNTIES", "#e3d2a8", "#2f6a74");
  out.push({ id: "jobs-town", kind: "jobs", name: "Job board", x: jb.x, z: jb.z, r: 3.2, verb: "Take a job" });
  const cv = spotNear(world, t.x, t.z, 2, -11); // round 11: the Drifters' caravan stall (factions/roster.js POSTS)
  signPost(game, cv.x, cv.z, face(cv.x, cv.z), "DRIFTER CARAVAN", "FUEL · WATER · RUMOURS", "#3a2f22", "#e0b25a");
  out.push({ id: "caravan-town", kind: "trader", name: "Drifter caravan", x: cv.x, z: cv.z, r: 3.2, verb: "Trade" });
  const gr = world.town.garage;
  out.push({ id: "garage-town", kind: "garage", name: "Garage", x: gr.x, z: gr.z, r: 5.5, verb: "Open the garage" });
  for (const z of zones.all()) {
    if (z.kind !== "outpost") continue;
    out.push({ id: "trader-" + z.id, kind: "trader", name: "Outpost trader", x: z.x, z: z.z, r: 6, verb: "Trade" });
  }
  return out;
}

// Where a summoned car rolls out: the Well-town garage bay (out through the door), else beside the zone centre.
// Returns { x, y, z, heading, vx, vz }.
export function garageDoor(game, zone) {
  const w = game.world, g = w.town.garage;
  if (zone.kind === "town") return { x: g.x, y: surfaceY(w, g.x, g.z - 9), z: g.z - 9, heading: Math.PI, vx: 0, vz: 5 };
  const p = spotNear(w, zone.x, zone.z, 9, -9);
  return { x: p.x, y: surfaceY(w, p.x, p.z), z: p.z, heading: Math.atan2(p.x - zone.x, p.z - zone.z) + Math.PI, vx: 0, vz: 0 };
}