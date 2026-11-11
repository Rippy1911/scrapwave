// Spike strip look: a low steel bar across the road with a row of teeth, laid across the car's path.
import * as THREE from "three";

const bar = new THREE.BoxGeometry(1, 0.08, 0.42);
const tooth = new THREE.ConeGeometry(0.07, 0.22, 4);
let mats = null;

export function makeSpikeMesh(scene, M, x, y, z, yaw, len) {
  if (!mats) mats = { bar: M.dark, tooth: new THREE.MeshStandardMaterial({ color: "#b9b4aa", metalness: 0.8, roughness: 0.35 }) };
  const g = new THREE.Group();
  const b = new THREE.Mesh(bar, mats.bar);
  b.scale.x = len; b.position.y = 0.04; g.add(b);
  const n = Math.round(len * 3);
  for (let i = 0; i < n; i++) {
    const t = new THREE.Mesh(tooth, mats.tooth);
    t.position.set(-len / 2 + (i + 0.5) * (len / n), 0.18, (i % 2 ? 0.1 : -0.1));
    g.add(t);
  }
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}