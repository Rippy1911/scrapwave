// Scene groups for the Ashmark's built places. A site streams in as one group (the place kit merges its pieces into
// a few meshes inside it) and is dropped whole; the code that lays out the pieces holds no three.js of its own.
import * as THREE from "three";

export function makeGroup(parent, name) {
  const g = new THREE.Group();
  g.name = name;
  parent.add(g);
  return g;
}

/** Removes a group and frees the geometry of everything in it (materials are shared and stay). */
export function dropGroup(g) {
  if (!g) return;
  if (g.parent) g.parent.remove(g);
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

/** Meshes and triangles in a group, for the hooks. */
export function groupStats(g) {
  let meshes = 0, tris = 0;
  g.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  return { meshes, tris: Math.round(tris) };
}