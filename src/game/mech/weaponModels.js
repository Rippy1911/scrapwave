// Models for the walker weapons (size X): shoulder rocket rack, arm cannon, twin autocannon and ram fist.
// Same shape as weapons/models.js returns ({ root, yaw, pitch, muzzles }), so turret aim and the muzzle code in
// combat.js treat them like any gun. Tier trim is added by build.js like for car weapons.
import * as THREE from "three";

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cylZ = (r, l, m, s = 10) => { const g = new THREE.CylinderGeometry(r, r, l, s); g.rotateX(Math.PI / 2); return new THREE.Mesh(g, m); };

export const MECH_WEAPON_IDS = new Set(["rocketRack", "armCannon", "twinAuto", "ramFist"]);

export function mechWeaponModel(id, M) {
  const root = new THREE.Group(), yaw = new THREE.Group(), pitch = new THREE.Group();
  root.add(yaw); yaw.add(pitch);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.18, 10), M.dark);
  base.position.y = 0.09; root.add(base);
  pitch.position.y = 0.42;
  const muzzles = [];
  const add = (o, x, y, z) => { o.position.set(x, y, z); pitch.add(o); return o; };
  if (id === "rocketRack") {
    add(box(0.95, 0.55, 0.9, M.rust), 0, 0, 0);
    add(box(1.0, 0.08, 0.95, M.hazard), 0, 0.3, 0);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const x = (c - 1) * 0.28, y = (r - 0.5) * 0.24;
      add(cylZ(0.085, 0.2, M.dark, 8), x, y, -0.5);
      muzzles.push(new THREE.Vector3(x, y, -0.62));
    }
  } else if (id === "armCannon") {
    add(box(0.5, 0.5, 0.9, M.dark), 0, 0, 0.1);
    add(cylZ(0.17, 1.6, M.chrome, 12), 0, 0.02, -1.0);
    add(cylZ(0.24, 0.3, M.rust, 12), 0, 0.02, -1.8);
    add(box(0.12, 0.3, 0.5, M.hazard), 0.3, 0.05, 0.1);
    muzzles.push(new THREE.Vector3(0, 0.02, -2.0));
  } else if (id === "twinAuto") {
    add(box(0.75, 0.42, 0.85, M.dark), 0, 0, 0.1);
    for (const x of [-0.2, 0.2]) {
      add(cylZ(0.08, 1.7, M.chrome, 8), x, 0.04, -1.0);
      add(cylZ(0.12, 0.25, M.rust, 8), x, 0.04, -1.85);
      muzzles.push(new THREE.Vector3(x, 0.04, -2.0));
    }
    add(box(0.3, 0.3, 0.4, M.hazard), 0, 0.32, 0.25);
  } else {
    // Ram fist: a riveted block knuckle on a short forearm sleeve, thrust forward by the arm's piston.
    add(box(0.5, 0.45, 0.7, M.dark), 0, 0, 0.1);
    add(box(0.75, 0.7, 0.55, M.rust), 0, 0, -0.5);
    for (let i = 0; i < 4; i++) add(box(0.14, 0.16, 0.18, M.chrome), (i - 1.5) * 0.17, 0.18, -0.82);
    add(box(0.8, 0.1, 0.6, M.hazard), 0, -0.36, -0.5);
    muzzles.push(new THREE.Vector3(0, 0, -0.9));
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, yaw, pitch, muzzles };
}