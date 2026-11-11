// Puts a race track (race/track.js) into the scene: the road, kerbs, raised slabs, the barriers down both sides
// (hazard stripes on the outside of turns), the checkpoint gates, and every collider. dispose() takes it all out.
import * as THREE from "three";
import { buildRoadGeometry } from "@/game/race/trackRoad";
import { buildGates } from "@/game/race/trackGates";

const BAR = { w: 0.5, h: 1.8, sink: 0.6 }; // a barrier stands 1.2 m above the road and reaches 0.6 m under it

export function buildTrackMesh(game, track) {
  const M = game.M, C = game.world.colliders, group = new THREE.Group(), ids = [], geos = [];
  group.name = `track:${track.id}`;
  const G = buildRoadGeometry(track);
  const mesh = (geo, mat, cast = false) => {
    if (!geo) return;
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true; m.castShadow = cast;
    group.add(m); geos.push(geo);
  };
  const kerbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  mesh(G.road, track.def.surface === "dirt" ? M.dirt : M.asphalt);
  mesh(G.kerbs, kerbMat);
  mesh(G.slab, M.concrete, true);
  for (const points of G.hulls) ids.push(C.addHull({ points, tag: "road" }).id);

  // Barriers: one instanced box per piece, tilted with the road; the collider is an upright box around it.
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const outer of [false, true]) {
    const list = track.barriers.filter((b) => b.outer === outer);
    if (!list.length) continue;
    const geo = new THREE.BoxGeometry(BAR.w, BAR.h, 1), im = new THREE.InstancedMesh(geo, outer ? M.hazard : M.concrete, list.length);
    list.forEach((b, i) => {
      e.set(-Math.atan2(b.dy, b.len), b.yaw, 0);
      im.setMatrixAt(i, m4.compose(p.set(b.x, b.y + BAR.h / 2 - BAR.sink, b.z), q.setFromEuler(e), s.set(1, 1, Math.hypot(b.len, b.dy) + 0.12)));
    });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    group.add(im); geos.push(geo);
  }
  for (const b of track.barriers) {
    ids.push(C.add({ x: b.x, y: b.y + BAR.h / 2 - BAR.sink, z: b.z, hx: BAR.w / 2, hy: BAR.h / 2 + Math.abs(b.dy) / 2, hz: b.len / 2 + 0.06, yaw: b.yaw, tag: "track" }).id);
  }

  const gates = buildGates(game, track);
  group.add(gates.group);
  game.scene.add(group);

  return {
    group, gates,
    dispose() {
      game.scene.remove(group);
      gates.dispose();
      for (const g of geos) g.dispose();
      kerbMat.dispose();
      for (const id of ids) C.removeById(id);
    },
  };
}