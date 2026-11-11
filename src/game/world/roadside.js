// Small roadside scatter so the ground near the camera is never empty: rocks, tyres, scrap pieces
// and the rusted bones of old cars. Instanced; only the car bones get (low) colliders. Visuals are CC0 models
// (Poly Haven rocks, old tyres, the covered car wreck; Kenney debris rusted over), snapped to the ground.
import * as THREE from "three";
import { createInstanced, normalise, snapY } from "@/game/assets/instancer";
import { mergeParts } from "@/game/assets/assets";
import { wreckMaterial, tinted } from "@/game/assets/remat";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { mulberry32 } from "@/game/core/rng";
import { inRampLane } from "@/game/world/places/ramps";

function boneGeo() {
  const parts = [
    new THREE.BoxGeometry(1.8, 0.35, 4).translate(0, 0.35, 0),
    new THREE.BoxGeometry(1.6, 0.08, 1.7).translate(0, 1.15, 0.3),
    new THREE.BoxGeometry(0.08, 0.6, 0.08).translate(-0.75, 0.85, -0.5),
    new THREE.BoxGeometry(0.08, 0.6, 0.08).translate(0.75, 0.85, -0.5),
    new THREE.BoxGeometry(0.08, 0.6, 0.08).translate(-0.75, 0.85, 1.1),
    new THREE.BoxGeometry(0.08, 0.6, 0.08).translate(0.75, 0.85, 1.1),
    new THREE.BoxGeometry(1.7, 0.25, 1.2).translate(0, 0.62, -1.4),
  ];
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

export function buildRoadside(kit, roads, M, density = 1) {
  const { terrain, colliders, scene } = kit;
  const r = mulberry32(2024);
  const KINDS = {
    rock: { geo: new THREE.DodecahedronGeometry(0.45, 0), mat: M.rock, list: [] },
    pebble: { geo: new THREE.DodecahedronGeometry(0.18, 0), mat: M.rock, list: [] },
    tyre: { geo: new THREE.TorusGeometry(0.36, 0.14, 6, 12).rotateX(Math.PI / 2).translate(0, 0.12, 0), mat: M.rubber, list: [] },
    scrap: { geo: new THREE.BoxGeometry(1, 0.06, 0.6).translate(0, 0.03, 0), mat: M.rust, list: [] },
    bones: { geo: boneGeo(), mat: M.rust, list: [] },
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const add = (kind, x, z, scale, ry, tilt = 0) => {
    const y = terrain.heightAt(x, z);
    e.set(tilt * (r() - 0.5), ry, tilt * (r() - 0.5)); q.setFromEuler(e);
    KINDS[kind].list.push(m4.compose(p.set(x, y - 0.05, z), q, s.set(scale, scale * (0.7 + r() * 0.5), scale)).clone());
    return y;
  };
  for (const road of roads.roads) {
    for (let i = 3; i < road.samples.length; i += 2) {
      const sm = road.samples[i];
      if (sm.deck || sm.bridge) continue;
      for (const side of [-1, 1]) {
        if (r() > 0.75) continue;
        const off = road.width / 2 + 1.2 + r() * 11;
        const x = sm.x - sm.dz * off * side + (r() - 0.5) * 3, z = sm.z + sm.dx * off * side + (r() - 0.5) * 3;
        const roll = r();
        if (roll < 0.42) { add("rock", x, z, 0.6 + r() * 1.4, r() * 6, 0.6); for (let k = 0; k < 3; k++) add("pebble", x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, 0.6 + r(), r() * 6, 1); }
        else if (roll < 0.62) add("scrap", x, z, 0.6 + r() * 1.2, r() * 6, 0.3);
        else if (roll < 0.8) { add("tyre", x, z, 0.9 + r() * 0.3, r() * 6, 0.25); if (r() < 0.4) add("tyre", x + 0.5, z + 0.3, 1, r() * 6, 0.25); }
        else if (roll < 0.83 && off > road.width / 2 + 4 && !inRampLane(kit.ramps, x, z, 3)) { // tarp wrecks collide: not in a ramp lane
          const ry = Math.atan2(sm.dx, sm.dz) + (r() - 0.5) * 1.6;
          const y = add("bones", x, z, 1, ry, 0.15);
          colliders.add({ x, y: y + 0.5, z, hx: 0.9, hy: 0.55, hz: 2, yaw: ry, tag: "bones" });
        } else for (let k = 0; k < 4; k++) add("pebble", x + (r() - 0.5) * 4, z + (r() - 0.5) * 4, 0.8 + r(), r() * 6, 1);
      }
    }
  }
  const meshes = [];
  // Pebbles stay as cheap instanced stones; everything else becomes a model.
  {
    const K = KINDS.pebble;
    const mesh = new THREE.InstancedMesh(K.geo, K.mat, K.list.length);
    K.list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.receiveShadow = true; mesh.userData.full = K.list.length;
    scene.add(mesh);
    meshes.push({ setDensity: (d) => { mesh.count = Math.floor(mesh.userData.full * Math.min(1, d)); } });
  }
  const rv = mulberry32(5150);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), eu = new THREE.Euler();
  // re-seat a stored matrix on the lowest ground under its footprint
  const reseat = (m, r, sink, tilt = 0.2, k = 1) => {
    m.decompose(pos, quat, scl);
    eu.setFromQuaternion(quat); eu.x = (rv() - 0.5) * tilt; eu.z = (rv() - 0.5) * tilt; quat.setFromEuler(eu);
    pos.y = snapY(terrain, pos.x, pos.z, r * scl.x * k, sink);
    return new THREE.Matrix4().compose(pos, quat, scl.multiplyScalar(k));
  };
  const rockMat = new Map();
  meshes.push(createInstanced(scene, {
    models: ["rock_small", "rock_boulder_flat"], lod: { near: 45, far: 200, cell: 0.12, hiCell: 0.03 },
    items: KINDS.rock.list.map((m) => ({ v: rv() < 0.6 ? 0 : 1, m: reseat(m, 0.5, 0.06, 0.3, 0.75) })),
    fallback: { geometry: KINDS.rock.geo, material: M.rock },
    prepare: (raw) => normalise(mergeParts(raw), { size: 1.1 }).map((pp) => {
      if (!rockMat.has(pp.material)) rockMat.set(pp.material, tinted(pp.material, [1.06, 0.8, 0.66]));
      return { ...pp, material: rockMat.get(pp.material) };
    }),
  }));
  // old tyres lying flat
  meshes.push(createInstanced(scene, {
    models: ["tyre_old"], lod: { near: 40, far: 150, cell: 0.05, hiCell: 0.015 },
    items: KINDS.tyre.list.map((m) => ({ m: reseat(m, 0.35, 0.05, 0.25, 1.05) })),
    fallback: { geometry: KINDS.tyre.geo, material: M.rubber },
    prepare: (raw) => normalise(mergeParts(raw).map((pp) => { const g = pp.geometry.clone(); g.rotateX(Math.PI / 2); return { ...pp, geometry: g }; })),
  }));
  // scrap: rusted Kenney debris (doors, bumpers, drivetrains)
  meshes.push(createInstanced(scene, {
    models: ["debris_door", "debris_bumper", "debris_drivetrain"], lod: { near: 70, far: 200, cell: 0.08 },
    items: KINDS.scrap.list.map((m) => ({ v: Math.floor(rv() * 3), m: reseat(m, 0.5, 0.05, 0.15, 0.85) })),
    fallback: { geometry: KINDS.scrap.geo, material: M.rust },
    prepare: (raw, name) => {
      let parts = mergeParts(raw);
      if (name === "debris_door") parts = parts.map((pp) => { const g = pp.geometry.clone(); g.rotateZ(Math.PI / 2); return { ...pp, geometry: g }; });
      return normalise(parts).map((pp) => ({ ...pp, material: wreckMaterial(pp.material, { paint: 0.5, soot: 0.12 }) }));
    },
  }));
  // car bones -> tarp-covered wrecks (same footprint as their colliders)
  const bones = createInstanced(scene, {
    models: ["car_covered_wreck"], lod: { near: 90, far: 420, cell: 0.1, hiCell: 0.025 },
    items: KINDS.bones.list.map((m) => ({ m: reseat(m, 1.6, 0.1, 0.08, 1) })),
    fallback: { geometry: KINDS.bones.geo, material: M.rust },
    prepare: (raw) => normalise(mergeParts(raw)),
  });
  bones.keep = true;
  meshes.push(bones);
  const setDensity = (d) => { for (const m of meshes) m.setDensity(m.keep ? 1 : Math.min(1, d)); };
  setDensity(density);
  return { meshes, setDensity };
}