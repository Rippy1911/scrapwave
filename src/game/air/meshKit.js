// Small low-poly helpers for the scrap-built aircraft: boxes, welded plates, rivets, hazard bands.
import * as THREE from "three";

export function box(parent, size, pos, mat, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent, r1, r2, len, pos, mat, axis = "y", seg = 8) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg);
  if (axis === "z") g.rotateX(Math.PI / 2);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(...pos);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// A slightly skewed plate welded over a surface, with a row of rivets.
export function plate(parent, size, pos, mat, rivetMat, n = 4) {
  const p = box(parent, size, pos, mat, [0, 0, (Math.random() - 0.5) * 0.06]);
  const long = size[0] >= size[2] ? 0 : 2;
  for (let i = 0; i < n; i++) {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), rivetMat);
    const t = (i + 0.5) / n - 0.5;
    r.position.set(long === 0 ? t * size[0] : 0, size[1] / 2 + 0.01, long === 2 ? t * size[2] : 0);
    if (size[1] > size[0] && size[1] > size[2]) r.position.set(size[0] / 2 + 0.01, t * size[1], 0);
    p.add(r);
  }
  return p;
}

// Hazard band around a box-shaped section.
export function band(parent, size, pos, mat) {
  return box(parent, [size[0] + 0.04, size[1] + 0.04, size[2]], pos, mat);
}

// Tier dressing shared by both aircraft: Tier 2 adds welded rust plates and hazard stripes,
// Tier 3 swaps them for dark riveted steel.
export function tierDress(g, M, tier, spots) {
  if (tier < 2) return;
  const mat = tier >= 3 ? M.dark : M.rust;
  for (const s of spots) plate(g, s.size, s.pos, mat, M.chrome, tier >= 3 ? 7 : 4);
  if (tier === 2 && M.hazard) for (const s of spots.slice(0, 2)) band(g, [s.size[0], 0.08, s.size[2] * 0.3], [s.pos[0], s.pos[1] + s.size[1] / 2 + 0.03, s.pos[2]], M.hazard);
}