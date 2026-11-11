// The Dust Devil: a salvage-yard strike jet. Nose is -Z, glowing exhaust at +Z, gear bottom at y -1.4.
import * as THREE from "three";
import { box, cyl, plate, band } from "@/game/air/meshKit";

export function buildJetMesh(M, { paint = "#7d8a80" } = {}) {
  const g = new THREE.Group();
  const paintMat = M.paint(paint).clone();
  const hz = M.hazard || M.bone;
  box(g, [1.3, 1.1, 7.0], [0, 0, 0.4], paintMat);
  cyl(g, 0.62, 0.05, 2.3, [0, 0, -4.2], paintMat, "z");
  box(g, [0.8, 0.5, 1.7], [0, 0.72, -2.1], M.glass);
  box(g, [0.9, 0.12, 0.5], [0, 0.95, -1.2], M.dark);
  // Swept wings, tail fin and stabilisers.
  for (const s of [-1, 1]) {
    box(g, [3.6, 0.12, 2.0], [s * 2.2, -0.1, 1.0], M.dark, [0, s * 0.32, 0]);
    band(g, [0.5, 0.12, 1.2], [s * 3.9, -0.1, 1.55], hz);
    box(g, [1.6, 0.1, 0.9], [s * 1.2, 0.15, 3.7], M.dark, [0, s * 0.3, 0]);
  }
  box(g, [0.12, 1.7, 1.4], [0, 1.15, 3.4], paintMat, [-0.25, 0, 0]);
  band(g, [0.12, 0.25, 1.4], [0, 1.75, 3.55], hz);
  // Welded intake patches and riveted plates.
  for (const s of [-1, 1]) cyl(g, 0.38, 0.38, 1.6, [s * 0.85, -0.05, -0.6], M.rust, "z");
  plate(g, [1.0, 0.05, 1.8], [0, 0.58, 1.4], M.rust, M.chrome, 5);
  plate(g, [0.05, 0.6, 1.6], [0.67, 0, 2.2], M.rust, M.chrome, 3);
  // Nozzle and the exhaust glow.
  cyl(g, 0.55, 0.45, 0.9, [0, 0, 4.3], M.dark, "z");
  const glowGeo = new THREE.ConeGeometry(0.42, 2.0, 10, 1, true).rotateX(-Math.PI / 2);
  const glow = new THREE.Mesh(glowGeo, M.turbo);
  glow.position.set(0, 0, 5.6);
  g.add(glow);
  cyl(g, 0.16, 0.16, 1.1, [-2.0, -0.42, 0.8], M.dark, "z"); // decorative pod
  // Landing gear.
  for (const [x, z] of [[0, -2.6], [-1.0, 1.1], [1.0, 1.1]]) {
    box(g, [0.1, 0.75, 0.1], [x, -0.85, z], M.chrome);
    cyl(g, 0.26, 0.26, 0.2, [x, -1.14, z], M.rubber, "x");
  }
  return { group: g, paintMat, glow, hard: { gun: [0, -0.6, -2.8], rockets: [2.0, -0.42, 0.8] }, exhaust: [0, 0, 4.9] };
}