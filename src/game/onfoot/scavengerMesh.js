// The on-foot scavenger: an original low-poly figure in the scrap-built style. Brass goggles, a red scarf with a
// loose tail, a long patched coat, a scrap backpack with a pipe. About 1.75 m tall, feet at the origin,
// facing -z like the cars. Joints are pivot groups the animation (scavengerAnim.js) bends.
import * as THREE from "three";

let shared = null;
function kit() {
  if (shared) return shared;
  const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...o });
  shared = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 7).rotateX(Math.PI / 2),
    mat: {
      coat: m("#6b5a42"), coatDark: m("#4f4232"), patchA: m("#8c3b55"), patchB: m("#3f5f6e"), stitch: m("#d9c79e"),
      scarf: m("#b23a1f"), skin: m("#c8936a"), pants: m("#3a3631"), boots: m("#2b2420"), gloves: m("#4a3a2a"),
      metal: m("#7d7468", { metalness: 0.6, roughness: 0.45 }), brass: m("#b0802c", { metalness: 0.7, roughness: 0.35 }),
      lens: m("#f2c230", { emissive: "#6a4a08", emissiveIntensity: 0.6, roughness: 0.2 }), hair: m("#2c2622"),
    },
  };
  return shared;
}

export function buildScavenger(o = {}) {
  const K = kit(), M = K.mat;
  const coat = o.coat ? new THREE.MeshStandardMaterial({ color: o.coat, roughness: 0.85, flatShading: true }) : M.coat;
  const add = (parent, geo, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(sx, sy, sz); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const B = (p, mat, sx, sy, sz, x, y, z, rx, ry, rz) => add(p, K.box, mat, sx, sy, sz, x, y, z, rx, ry, rz);
  const C = (p, mat, r, len, x, y, z, rx, ry, rz) => add(p, K.cyl, mat, r * 2, r * 2, len, x, y, z, rx, ry, rz);
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new THREE.Group();
  root.name = "scavenger";
  const hips = pivot(root, 0, 0.93, 0);
  B(hips, M.pants, 0.34, 0.18, 0.22, 0, 0, 0);

  const legs = [-1, 1].map((s) => {
    const leg = pivot(hips, s * 0.1, -0.04, 0);
    B(leg, M.pants, 0.14, 0.44, 0.16, 0, -0.22, 0);
    B(leg, M.patchB, 0.15, 0.1, 0.02, 0, -0.18, -0.085); // knee patch
    const knee = pivot(leg, 0, -0.44, 0);
    B(knee, M.pants, 0.13, 0.4, 0.15, 0, -0.2, 0);
    B(knee, M.boots, 0.16, 0.12, 0.27, 0, -0.43, -0.04);
    return { leg, knee };
  });

  const torso = pivot(hips, 0, 0.06, 0);
  B(torso, coat, 0.42, 0.52, 0.26, 0, 0.26, 0);
  B(torso, coat, 0.46, 0.5, 0.3, 0, -0.08, 0.01); // coat skirt
  const tail = pivot(torso, 0, -0.3, 0.12);
  B(tail, M.coatDark, 0.44, 0.34, 0.06, 0, -0.16, 0);
  B(torso, M.patchA, 0.12, 0.12, 0.02, 0.12, 0.34, -0.135, 0, 0, 0.2);
  B(torso, M.patchB, 0.1, 0.14, 0.02, -0.14, -0.05, -0.16, 0, 0, -0.15);
  B(torso, M.stitch, 0.02, 0.5, 0.02, 0, 0.1, -0.16); // button line
  B(torso, M.coatDark, 0.44, 0.06, 0.29, 0, 0.02, 0); // belt
  B(torso, M.brass, 0.06, 0.05, 0.02, 0.08, 0.02, -0.15);
  // backpack: a scrap crate with a pipe
  B(torso, M.metal, 0.3, 0.32, 0.14, 0, 0.3, 0.2);
  C(torso, M.metal, 0.03, 0.42, 0.11, 0.55, 0.22, Math.PI / 2, 0, 0);
  // scarf around the neck plus a tail that swings
  B(torso, M.scarf, 0.3, 0.11, 0.28, 0, 0.55, 0);
  const scarfTail = pivot(torso, 0.1, 0.52, 0.14);
  B(scarfTail, M.scarf, 0.09, 0.32, 0.04, 0, -0.15, 0);

  const head = pivot(torso, 0, 0.62, 0);
  B(head, M.skin, 0.22, 0.24, 0.22, 0, 0.12, 0);
  B(head, M.hair, 0.24, 0.08, 0.24, 0, 0.26, 0.01);
  B(head, M.coatDark, 0.26, 0.03, 0.08, 0, 0.17, 0.02); // goggle strap
  for (const s of [-1, 1]) {
    C(head, M.brass, 0.05, 0.06, s * 0.055, 0.16, -0.12);
    C(head, M.lens, 0.035, 0.02, s * 0.055, 0.16, -0.155);
  }
  B(head, M.scarf, 0.2, 0.08, 0.04, 0, 0.03, -0.12); // scarf pulled over the chin

  const arms = [-1, 1].map((s) => {
    const arm = pivot(torso, s * 0.27, 0.46, 0);
    B(arm, coat, 0.13, 0.34, 0.14, 0, -0.16, 0);
    if (s > 0) B(arm, M.patchA, 0.02, 0.1, 0.1, 0.07, -0.14, 0);
    const elbow = pivot(arm, 0, -0.33, 0);
    B(elbow, coat, 0.12, 0.28, 0.13, 0, -0.13, 0);
    B(elbow, M.gloves, 0.11, 0.1, 0.12, 0, -0.31, 0);
    return { arm, elbow };
  });

  return {
    root,
    joints: {
      hips, torso, head, tail, scarfTail,
      legL: legs[0].leg, legR: legs[1].leg, kneeL: legs[0].knee, kneeR: legs[1].knee,
      armL: arms[0].arm, armR: arms[1].arm, elbowL: arms[0].elbow, elbowR: arms[1].elbow,
    },
    dispose() { root.removeFromParent(); if (coat !== M.coat) coat.dispose(); },
  };
}