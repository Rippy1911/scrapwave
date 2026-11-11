// The mountain of a race world: a looks-only height mesh over the whole map from the layout's terrain(x, z)
// (metres above the map floor). Cars drive on the road's own slab, so this has no collider.
import * as THREE from "three";

const CELL = 14;

export function buildTerrainMesh(L, material, site) {
  const [hx, hz] = L.half, nx = Math.ceil((2 * hx) / CELL), nz = Math.ceil((2 * hz) / CELL);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2), index = [];
  for (let j = 0, k = 0; j <= nz; j++) for (let i = 0; i <= nx; i++, k++) {
    const x = -hx + (i / nx) * 2 * hx, z = -hz + (j / nz) * 2 * hz;
    pos.set([site.x + x, site.y + L.terrain(x, z), site.z + z], k * 3);
    uv.set([x / 9, z / 9], k * 2);
    if (i < nx && j < nz) index.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = "map:terrain";
  return mesh;
}