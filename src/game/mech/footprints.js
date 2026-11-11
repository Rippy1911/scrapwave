// Walker footsteps: a dark footprint pressed into the sand (one instanced mesh, oldest prints reused), a dust
// puff, a thud and a camera shake that grows with the machine's mass and fades with distance.
import * as THREE from "three";

const MAX = 160;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export function createFootprints(scene) {
  const geo = new THREE.PlaneGeometry(1, 1.35).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: "#2b2118", transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1;
  scene.add(mesh);
  let n = 0;
  return {
    add(x, y, z, yaw, size) {
      m4.compose(p.set(x, y + 0.04, z), q.setFromAxisAngle(UP, yaw), s.set(size, 1, size));
      mesh.setMatrixAt(n % MAX, m4);
      n++; mesh.count = Math.min(n, MAX);
      mesh.instanceMatrix.needsUpdate = true;
    },
    count: () => Math.min(n, MAX),
    total: () => n,
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}

// One foot coming down at world point at. mass in kg; big landings pass a larger k.
export function footstep(game, prints, at, yaw, mass, k = 1) {
  const t = mass / 1000;
  const y = game.world.groundAt(at.x, at.z, at.y + 1.5);
  prints.add(at.x, y, at.z, yaw, Math.min(1.6, 0.7 + t * 0.08));
  game.particles.dust(at.x, y + 0.2, at.z, 0, 0, Math.min(3, 1 + t * 0.15) * k);
  game.audio.impact(p.set(at.x, y, at.z), Math.min(1.6, 0.5 + t * 0.08) * k);
  game.shake(p, Math.min(0.9, 0.12 + t * 0.03) * k);
}