// Unit ramp geometry that matches a colliders.js wedge: x and z in -0.5..0.5, the top rises from the foot
// (local +z) to the lip (local -z) as y = -0.5 + s^curve. Indexed with uvs so the building kit can merge it.
import * as THREE from "three";

const cache = new Map();

export function rampGeometry(curve = 1.4) {
  const key = curve.toFixed(2);
  if (cache.has(key)) return cache.get(key);
  const n = Math.abs(curve - 1) < 0.02 ? 1 : 10;
  const pos = [], nrm = [], uv = [], idx = [];
  const quad = (a, b, c, d, nx, ny, nz) => {
    const i = pos.length / 3;
    for (const p of [a, b, c, d]) { pos.push(...p); nrm.push(nx, ny, nz); uv.push(p[0] + p[2], p[1] + p[2]); }
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const top = (s) => -0.5 + Math.pow(s, curve), zAt = (s) => 0.5 - s;
  for (let k = 0; k < n; k++) {
    const s0 = k / n, s1 = (k + 1) / n, y0 = top(s0), y1 = top(s1), z0 = zAt(s0), z1 = zAt(s1);
    const ny = z0 - z1, nz = y1 - y0, l = Math.hypot(ny, nz) || 1;
    quad([-0.5, y0, z0], [0.5, y0, z0], [0.5, y1, z1], [-0.5, y1, z1], 0, ny / l, nz / l); // driving surface
    quad([0.5, -0.5, z0], [0.5, -0.5, z1], [0.5, y1, z1], [0.5, y0, z0], 1, 0, 0); // right side strip
    quad([-0.5, -0.5, z1], [-0.5, -0.5, z0], [-0.5, y0, z0], [-0.5, y1, z1], -1, 0, 0); // left side strip
  }
  quad([0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], 0, 0, -1); // lip face
  quad([-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], 0, -1, 0); // bottom
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  cache.set(key, g);
  return g;
}