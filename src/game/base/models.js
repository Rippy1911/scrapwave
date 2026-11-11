// Base module models built from the kit materials. buildModel(kind, M) returns
// { root, head?, pitch?, muzzles?, dish?, door?, flames?, lamps? }. Pass a ghost material set to get a ghost.
import * as THREE from "three";

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const CONE = new THREE.ConeGeometry(1, 1, 6);
const SPH = new THREE.IcosahedronGeometry(1, 1);

function mk(geo, mat, parent, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (mat, p, x, y, z, w, h, d, ry = 0) => mk(BOX, mat, p, x, y, z, w, h, d, 0, ry, 0);
const cyl = (mat, p, x, y, z, r, h, rx = 0, rz = 0) => mk(CYL, mat, p, x, y, z, r, h, r, rx, 0, rz);

function rig(M, g, o) {
  box(M.dark, g, 0, 0.25, 0, 6, 0.5, 6);
  box(M.hazard, g, 0, 0.55, 2.95, 5.6, 0.2, 0.1); box(M.hazard, g, 0, 0.55, -2.95, 5.6, 0.2, 0.1);
  box(M.rust, g, 0, 1.9, 0.3, 4.6, 2.8, 4);
  box(M.dark, g, -2.4, 1.7, 0.3, 0.25, 2.2, 3.6); box(M.dark, g, 2.4, 1.7, 0.3, 0.25, 2.2, 3.6);
  box(M.dark, g, 0, 1.6, -1.8, 4.2, 2, 0.25);
  for (let i = -1; i <= 1; i++) box(M.chrome, g, i * 1.3, 2.2, -1.95, 0.7, 0.18, 0.06);
  box(M.glass, g, 0, 2.7, -1.75, 2.4, 0.5, 0.1);
  const tank = cyl(M.corrugated, g, 0, 4.2, 0.6, 1.15, 4.2, 0, Math.PI / 2);
  tank.scale.set(1.15, 4.2, 1.15);
  for (const x of [-1.6, 0, 1.6]) cyl(M.dark, g, x, 4.2, 0.6, 1.22, 0.12, 0, Math.PI / 2);
  box(M.dark, g, -1.5, 3.4, 0.6, 0.3, 0.5, 2.2); box(M.dark, g, 1.5, 3.4, 0.6, 0.3, 0.5, 2.2);
  cyl(M.dark, g, 1.8, 6.3, 1.7, 0.07, 6.5);
  for (const y of [5, 6.6, 8]) box(M.dark, g, 1.8, y, 1.7, 1.1 - (y - 5) * 0.2, 0.06, 0.06);
  o.lamps = [];
  for (const [x, z] of [[-2.7, -2.7], [2.7, -2.7], [-2.7, 2.7], [2.7, 2.7]]) {
    cyl(M.dark, g, x, 1.9, z, 0.08, 3);
    box(M.dark, g, x, 3.45, z, 0.5, 0.35, 0.3);
    o.lamps.push(box(M.light, g, x, 3.45, z + (z < 0 ? -0.16 : 0.16), 0.4, 0.25, 0.05));
  }
  cyl(M.rubber, g, -2.1, 3.6, -1.2, 0.35, 0.5);
  o.labelY = 9.6;
}

function scrapwall(M, g) {
  for (const x of [-0.95, 0.95]) box(M.dark, g, x, 1.3, 0, 0.18, 2.6, 0.18);
  box(M.corrugated, g, 0, 1.25, 0, 1.9, 2.3, 0.16);
  box(M.rust, g, -0.35, 0.8, -0.1, 0.9, 0.8, 0.05, 0.08);
  box(M.rust, g, 0.45, 1.8, 0.1, 0.7, 0.6, 0.05, -0.12);
  box(M.wood, g, 0, 2.15, -0.12, 1.9, 0.18, 0.08, 0.04);
  box(M.dark, g, 0, 0.2, 0, 2, 0.4, 0.5);
}
function platewall(M, g) {
  box(M.dark, g, 0, 1.45, 0, 2, 2.9, 0.7);
  box(M.hazard, g, 0, 2.95, 0, 2, 0.12, 0.72);
  for (const z of [-0.37, 0.37]) for (const y of [0.5, 1.45, 2.4]) for (const x of [-0.8, -0.27, 0.27, 0.8]) mk(SPH, M.chrome, g, x, y, z, 0.05, 0.05, 0.05);
  box(M.rust, g, 0, 1.45, -0.36, 1.8, 0.08, 0.04); box(M.rust, g, 0, 1.45, 0.36, 1.8, 0.08, 0.04);
}
function spikewall(M, g) {
  box(M.rust, g, 0, 1, 0, 2, 2, 0.6);
  box(M.dark, g, 0, 2.05, 0, 2.05, 0.15, 0.65);
  for (const s of [-1, 1]) for (const y of [0.6, 1.4]) for (const x of [-0.65, 0, 0.65]) mk(CONE, M.chrome, g, x, y, s * 0.65, 0.12, 0.7, 0.12, s * Math.PI / 2, 0, 0);
}
function gate(M, g, o) {
  for (const x of [-1.75, 1.75]) { box(M.concrete, g, x, 1.7, 0, 0.5, 3.4, 1); box(M.hazard, g, x, 3.25, 0, 0.52, 0.3, 1.02); }
  box(M.dark, g, 0, 3.3, 0, 4, 0.25, 0.4);
  o.door = new THREE.Group(); g.add(o.door);
  box(M.corrugated, o.door, 0, 1.45, 0, 3, 2.8, 0.18);
  box(M.hazard, o.door, 0, 0.25, 0, 3, 0.3, 0.2);
  box(M.dark, o.door, 0, 1.45, 0.12, 0.12, 2.8, 0.05);
  o.lamps = [box(M.redLight, g, 1.75, 3.55, 0, 0.18, 0.18, 0.18)];
}
function turretBase(M, g) {
  box(M.concrete, g, 0, 0.45, 0, 1.9, 0.9, 1.9);
  box(M.hazard, g, 0, 0.92, 0, 1.92, 0.06, 1.92);
  cyl(M.dark, g, 0, 1.1, 0, 0.55, 0.35);
}
function mgturret(M, g, o) {
  turretBase(M, g);
  o.head = new THREE.Group(); o.head.position.y = 1.35; g.add(o.head);
  o.pitch = new THREE.Group(); o.pitch.position.y = 0.35; o.head.add(o.pitch);
  box(M.dark, o.pitch, 0, 0, 0, 0.8, 0.55, 0.9);
  box(M.rust, o.pitch, 0, 0.1, -0.55, 1.3, 0.8, 0.12);
  o.muzzles = [];
  for (const x of [-0.18, 0.18]) { cyl(M.dark, o.pitch, x, 0, -1.1, 0.06, 1.3, Math.PI / 2); o.muzzles.push(new THREE.Vector3(x, 0, -1.8)); }
  box(M.dark, o.pitch, 0.5, -0.05, 0.1, 0.25, 0.35, 0.5);
}
function rocketturret(M, g, o) {
  turretBase(M, g);
  o.head = new THREE.Group(); o.head.position.y = 1.4; g.add(o.head);
  o.pitch = new THREE.Group(); o.pitch.position.y = 0.5; o.head.add(o.pitch);
  box(M.dark, o.head, 0, 0.15, 0, 0.5, 0.6, 0.5);
  o.muzzles = [];
  for (const x of [-0.5, 0.5]) {
    box(M.rust, o.pitch, x, 0, 0, 0.7, 0.7, 1.4);
    box(M.hazard, o.pitch, x, 0.36, 0, 0.72, 0.05, 1.42);
    for (const [dx, dy] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
      cyl(M.rubber, o.pitch, x + dx, dy, -0.71, 0.11, 0.04, Math.PI / 2);
      o.muzzles.push(new THREE.Vector3(x + dx, dy, -0.8));
    }
  }
}
function flametrap(M, g, o) {
  box(M.dark, g, 0, 0.08, 0, 2, 0.16, 2);
  for (let i = -3; i <= 3; i++) box(M.rust, g, i * 0.27, 0.18, 0, 0.06, 0.05, 1.8);
  for (const s of [-1, 1]) { box(M.hazard, g, s * 0.97, 0.12, 0, 0.08, 0.2, 2); box(M.hazard, g, 0, 0.12, s * 0.97, 2, 0.2, 0.08); }
  o.flames = [];
  for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    cyl(M.chrome, g, x, 0.25, z, 0.08, 0.2);
    o.flames.push(mk(SPH, M.fire, g, x, 0.4, z, 0.07, 0.12, 0.07));
  }
}
function garagepad(M, g, o) {
  box(M.concrete, g, 0, 0.08, 0, 6, 0.16, 6);
  for (const s of [-1, 1]) { box(M.hazard, g, s * 2.85, 0.18, 0, 0.3, 0.06, 6); box(M.hazard, g, 0, 0.18, s * 2.85, 6, 0.06, 0.3); }
  box(M.dark, g, 0, 0.17, 0, 0.3, 0.04, 3.2); box(M.dark, g, 0, 0.17, 0, 3.2, 0.04, 0.3);
  o.lamps = [];
  for (const x of [-2.9, 2.9]) {
    cyl(M.dark, g, x, 2.3, 2.9, 0.08, 4.4);
    box(M.dark, g, x * 0.92, 4.5, 2.9, 0.6, 0.12, 0.12);
    o.lamps.push(box(M.light, g, x * 0.85, 4.4, 2.9, 0.4, 0.15, 0.3));
  }
  box(M.rust, g, 2.6, 0.7, -2.5, 0.8, 1.2, 0.6);
  cyl(M.rubber, g, 2.6, 1.5, -2.5, 0.1, 0.5);
}
function refinery(M, g, o) {
  box(M.concrete, g, 0, 0.15, 0, 4, 0.3, 4);
  cyl(M.rust, g, -0.7, 1.9, 0.5, 1.2, 3.2);
  cyl(M.dark, g, -0.7, 3.55, 0.5, 1.25, 0.15);
  for (const y of [1, 2.2]) cyl(M.dark, g, -0.7, y, 0.5, 1.23, 0.08);
  cyl(M.dark, g, 1.3, 2.8, -1.2, 0.3, 5.2);
  cyl(M.rust, g, 1.3, 5.45, -1.2, 0.38, 0.2);
  o.flames = [mk(CONE, M.fire, g, 1.3, 6, -1.2, 0.22, 0.9, 0.22)];
  cyl(M.chrome, g, 0.4, 1.2, -1.2, 0.12, 1.6, 0, Math.PI / 2);
  cyl(M.chrome, g, 1.3, 0.8, 0.4, 0.12, 2.6, Math.PI / 2);
  box(M.dark, g, 1.3, 0.8, 1.4, 0.9, 1.1, 0.8);
  o.lamps = [box(M.redLight, g, 1.3, 1.45, 1.4, 0.15, 0.15, 0.15)];
}
function radar(M, g, o) {
  box(M.concrete, g, 0, 0.3, 0, 1.6, 0.6, 1.6);
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) mk(BOX, M.dark, g, x * 0.6, 4, z * 0.6, 0.09, 7, 0.09, z * 0.06, 0, -x * 0.06);
  for (let y = 1.2; y < 7.5; y += 1.1) box(M.dark, g, 0, y, 0, 0.62 - y * 0.03, 0.05, 0.62 - y * 0.03);
  o.dish = new THREE.Group(); o.dish.position.y = 7.6; g.add(o.dish);
  mk(CYL6, M.dark, o.dish, 0, 0, 0, 0.18, 0.4, 0.18);
  const d = mk(SPH, M.chrome, o.dish, 0, 0.5, -0.4, 1.1, 0.7, 0.18); d.rotation.x = 0.3;
  cyl(M.dark, o.dish, 0, 0.5, -0.9, 0.04, 0.9, Math.PI / 2);
  o.lamps = [mk(SPH, M.redLight, g, 0, 8.6, 0, 0.12, 0.12, 0.12)];
}

const BUILDERS = { rig, scrapwall, platewall, spikewall, gate, mgturret, rocketturret, flametrap, garagepad, refinery, radar };

export function buildModel(kind, M) {
  const root = new THREE.Group();
  const o = { root };
  const inner = new THREE.Group(); root.add(inner); o.inner = inner;
  (BUILDERS[kind] || scrapwall)(M, inner, o);
  return o;
}

// A material set where every slot is one translucent ghost material (build preview / blueprint outlines).
export function ghostMaterials(color = "#7fe0a0", opacity = 0.45, wire = false) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, wireframe: wire });
  return { mat, set: new Proxy({}, { get: () => mat }) };
}