// ?debug=1 scene overlays: collider wireframes (solid boxes orange, ramp wedges green) and the road graph.
import * as THREE from "three";

const CORNERS = [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

function colliderLines(colliders, wedge) {
  const pos = [];
  for (const b of colliders.all) {
    if (b.dead || (b.kind === "wedge") !== wedge) continue;
    const pts = CORNERS.map(([sx, sy, sz]) => {
      const lx = sx * b.hx, lz = sz * b.hz;
      return [b.x + lx * b.cos + lz * b.sin, b.y + sy * b.hy, b.z - lx * b.sin + lz * b.cos];
    });
    for (const [a, c] of EDGES) pos.push(...pts[a], ...pts[c]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: wedge ? "#5dff8a" : "#ff8a3a", fog: false, transparent: true, opacity: 0.7, depthTest: true }));
}

export function createDebugOverlay(scene, world) {
  const group = new THREE.Group();
  group.name = "debug";
  group.add(colliderLines(world.colliders, false), colliderLines(world.colliders, true));
  for (const r of world.roads.roads) {
    const pts = r.samples.map((p) => new THREE.Vector3(p.x, p.y + 0.6, p.z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: r.kind === "highway" ? "#5dc8ff" : r.kind === "rail" ? "#c88aff" : "#ffe25d", fog: false }));
    group.add(line);
    const nodes = [r.samples[0], r.samples[r.samples.length - 1]].map((p) => new THREE.Vector3(p.x, p.y + 0.6, p.z));
    const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(nodes), new THREE.PointsMaterial({ color: "#ffffff", size: 6, sizeAttenuation: false, fog: false }));
    group.add(dots);
  }
  scene.add(group);
  return group;
}