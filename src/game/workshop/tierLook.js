// What a tier looks like on the car (A). Tier I is today's rusty bolted-on look and adds nothing; Tier II adds welded
// seams and a hazard-stripe band; Tier III adds dark riveted steel and glowing strips. Used by build.js for weapon
// mounts and the ram (armour plates draw their own tier look in build.js).
import * as THREE from "three";

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// obj: the group to decorate; size [w, h, d] of the band; y: its height in obj space.
export function tierTrim(obj, tier, M, size = [0.6, 0.12, 0.6], y = 0) {
  if (!obj || !tier || tier < 2) return;
  const [w, h, d] = size, add = (m, x, yy, z) => { m.position.set(x, yy, z); m.castShadow = true; obj.add(m); return m; };
  if (tier === 2) {
    add(box(w * 1.03, Math.max(0.05, h * 0.3), d * 1.03, M.hazard), 0, y, 0);
    add(box(w * 1.05, 0.022, 0.03, M.chrome), 0, y + h * 0.28, d * 0.52);
    add(box(w * 1.05, 0.022, 0.03, M.chrome), 0, y + h * 0.28, -d * 0.52);
    return;
  }
  add(box(w * 1.05, Math.max(0.06, h * 0.4), d * 1.05, M.dark), 0, y, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), M.chrome), Math.cos(a) * w * 0.5, y + h * 0.22, Math.sin(a) * d * 0.5);
  }
  add(box(w * 0.8, 0.026, 0.026, M.light), 0, y + h * 0.05, -d * 0.54);
  add(box(w * 0.8, 0.026, 0.026, M.light), 0, y + h * 0.05, d * 0.54);
}