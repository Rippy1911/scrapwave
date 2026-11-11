// Visible weapon models. Each returns {root, yaw, pitch, muzzles:[Vector3 in pitch space]}. Barrels point -z.
import * as THREE from "three";

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cylZ = (r, l, m, seg = 10) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); c.rotation.x = Math.PI / 2; return c; };

export function weaponModel(id, M) {
  const root = new THREE.Group(), yaw = new THREE.Group(), pitch = new THREE.Group();
  root.add(yaw); yaw.add(pitch);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.14, 12), M.dark);
  ring.position.y = 0.07; root.add(ring);
  pitch.position.y = 0.3;
  const muzzles = [];
  const add = (o, x, y, z) => { o.position.set(x, y, z); pitch.add(o); return o; };
  if (id === "mg") {
    add(box(0.32, 0.22, 0.6, M.dark), 0, 0, 0.05);
    for (const x of [-0.09, 0.09]) { add(cylZ(0.035, 0.9, M.chrome, 6), x, 0.02, -0.65); muzzles.push(new THREE.Vector3(x, 0.02, -1.1)); }
    add(box(0.1, 0.18, 0.2, M.hazard), 0.2, -0.02, 0.1);
  } else if (id === "scatter") {
    add(box(0.3, 0.26, 0.5, M.rust), 0, 0, 0.1);
    add(cylZ(0.11, 0.8, M.dark), 0, 0.02, -0.5);
    add(cylZ(0.14, 0.12, M.chrome), 0, 0.02, -0.92);
    muzzles.push(new THREE.Vector3(0, 0.02, -1.0));
  } else if (id === "rockets") {
    add(box(0.8, 0.55, 0.9, M.paint("#5e6b3a")), 0, 0.05, 0);
    for (let i = 0; i < 4; i++) {
      const x = (i % 2 ? 0.18 : -0.18), y = (i < 2 ? 0.17 : -0.07);
      add(cylZ(0.1, 0.06, M.rubber), x, y + 0.05, -0.46);
      muzzles.push(new THREE.Vector3(x, y + 0.05, -0.55));
    }
    add(box(0.82, 0.08, 0.92, M.hazard), 0, 0.36, 0);
  } else if (id === "harpoon") {
    add(box(0.34, 0.3, 0.9, M.dark), 0, 0, 0.1);
    add(cylZ(0.06, 1.2, M.chrome), 0, 0.08, -0.6);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), M.rust);
    tip.rotation.x = -Math.PI / 2; add(tip, 0, 0.08, -1.3);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12), M.rust), 0, -0.05, 0.4).rotation.y = Math.PI / 2;
    muzzles.push(new THREE.Vector3(0, 0.08, -1.4));
  } else if (id === "flamer") {
    add(cylZ(0.18, 0.7, M.paint("#b23a1f")), 0, 0.05, 0.2);
    add(cylZ(0.06, 0.8, M.dark), 0, 0.05, -0.5);
    add(cylZ(0.1, 0.12, M.chrome), 0, 0.05, -0.92);
    muzzles.push(new THREE.Vector3(0, 0.05, -1.0));
  } else if (id === "cannon") {
    add(box(1.05, 0.75, 1.15, M.dark), 0, 0.05, 0.15);
    add(cylZ(0.14, 2.8, M.dark), 0, 0.12, -1.5);
    add(cylZ(0.2, 0.35, M.rust), 0, 0.12, -2.85);
    muzzles.push(new THREE.Vector3(0, 0.12, -3.05));
    add(box(0.35, 0.2, 0.55, M.dark), 0.38, 0.22, 0.2);
    add(cylZ(0.05, 0.75, M.chrome, 6), 0.38, 0.22, -0.15);
    muzzles.push(new THREE.Vector3(0.38, 0.22, -0.55));
  } else if (id === "autocannon") {
    add(box(0.9, 0.6, 1.1, M.dark), 0, 0.05, 0.1);
    add(box(1.0, 0.7, 0.12, M.hazard), 0, 0.05, -0.5);
    add(cylZ(0.11, 2.0, M.dark), 0, 0.1, -1.3);
    add(cylZ(0.16, 0.3, M.rust), 0, 0.1, -2.25);
    muzzles.push(new THREE.Vector3(0, 0.1, -2.45));
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, yaw, pitch, muzzles };
}

export function ramModel(M, width) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const b = box(width * 0.56, 0.5, 0.12, M.rust);
    b.position.set(s * width * 0.24, 0, -0.25); b.rotation.y = s * 0.5; g.add(b);
  }
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 6), M.chrome);
    c.rotation.x = -Math.PI / 2; c.position.set((i - 2) * width * 0.18, 0, -0.5 - (2 - Math.abs(i - 2)) * 0.12); g.add(c);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}