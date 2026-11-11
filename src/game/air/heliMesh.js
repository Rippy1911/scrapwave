// The Scrap Hornet: a welded-together gunship. Nose is -Z, rotor on top, skids underneath (bottom at y -1.24).
import * as THREE from "three";
import { box, cyl, plate, band, tierDress } from "@/game/air/meshKit";

export function buildHeliMesh(M, { paint = "#c7762e", tier = 0 } = {}) {
  const g = new THREE.Group();
  const paintMat = M.paint(paint).clone();
  const hz = M.hazard || M.bone;
  // Body: cabin, nose, glass, tail boom and fin.
  box(g, [1.7, 1.5, 3.4], [0, 0, 0], paintMat);
  box(g, [1.4, 1.05, 1.1], [0, -0.18, -2.15], paintMat);
  box(g, [1.32, 0.7, 0.05], [0, 0.32, -1.78], M.glass, [-0.55, 0, 0]);
  box(g, [0.05, 0.55, 1.1], [-0.86, 0.3, -1.0], M.glass);
  box(g, [0.05, 0.55, 1.1], [0.86, 0.3, -1.0], M.glass);
  box(g, [0.42, 0.42, 4.3], [0, 0.3, 3.7], M.dark);
  band(g, [0.42, 0.42, 0.35], [0, 0.3, 2.9], hz);
  band(g, [0.42, 0.42, 0.35], [0, 0.3, 4.5], hz);
  box(g, [0.1, 1.3, 0.85], [0, 0.95, 5.6], paintMat);
  box(g, [1.6, 0.08, 0.5], [0, 0.45, 5.4], M.dark);
  // Scrap-built: mismatched welded patches, an exhaust stack, a hazard nose band.
  plate(g, [0.05, 0.7, 1.2], [0.88, -0.2, 0.6], M.rust, M.chrome, 3);
  plate(g, [0.05, 0.5, 0.9], [-0.88, 0.25, 1.0], M.rust, M.chrome, 3);
  plate(g, [1.0, 0.05, 1.1], [0, 0.78, 0.9], M.rust, M.chrome, 4);
  band(g, [1.4, 0.2, 0.25], [0, -0.55, -2.6], hz);
  cyl(g, 0.13, 0.16, 0.7, [0.55, 0.95, 1.3], M.rust);
  // Stub wings, skids and struts.
  box(g, [3.0, 0.12, 0.6], [0, -0.25, 0.25], M.dark);
  for (const x of [-0.85, 0.85]) {
    box(g, [0.12, 0.12, 3.6], [x, -1.18, 0.2], M.rust);
    box(g, [0.12, 0.12, 0.4], [x, -1.1, -1.65], M.rust, [0.5, 0, 0]);
    for (const z of [-0.8, 1.0]) box(g, [0.08, 0.55, 0.08], [x * 0.95, -0.88, z], M.dark);
  }
  cyl(g, 0.16, 0.16, 1.1, [-1.3, -0.42, 0.25], M.dark, "z"); // second (decorative) rocket pod
  // Main rotor and tail rotor.
  cyl(g, 0.12, 0.16, 0.55, [0, 1.0, 0], M.chrome);
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.3, 0);
  cyl(rotor, 0.22, 0.22, 0.14, [0, 0, 0], M.dark);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI * 2) / 3;
    box(arm, [5.4, 0.05, 0.32], [2.75, 0, 0], M.dark);
    box(arm, [0.4, 0.06, 0.34], [5.25, 0, 0], hz);
    rotor.add(arm);
  }
  g.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.12, 0.95, 5.75);
  for (let i = 0; i < 2; i++) box(tailRotor, [0.04, 1.5, 0.16], [0.04, 0, 0], M.dark, [i * Math.PI / 2, 0, 0]);
  g.add(tailRotor);
  tierDress(g, M, tier, [
    { size: [0.06, 0.9, 2.2], pos: [0.9, 0, 0.1] }, { size: [0.06, 0.9, 2.2], pos: [-0.9, 0, 0.1] },
    { size: [0.46, 0.06, 2.0], pos: [0, 0.54, 3.3] }, { size: [1.2, 0.06, 0.8], pos: [0, 0.38, -2.15] },
  ]);
  return { group: g, paintMat, rotor, tailRotor, spin: 0, hard: { gun: [0, -0.8, -1.95], rockets: [1.3, -0.38, 0.25] }, exhaust: [0.55, 1.35, 1.3] };
}