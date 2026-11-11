// Checkpoint gates for a race track: a pair of lamp posts at every checkpoint, and at the start/finish line a
// tall gantry with a hazard beam and a chequered line across the road. setNext(n) lights the lamps of the
// checkpoint to drive for; the posts stand outside the barriers, so they need no colliders.
// All posts are one instanced mesh and all unlit lamps another; the two lit lamps move to the next gate.
import * as THREE from "three";

function chequer() {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 4;
  const ctx = cv.getContext("2d");
  for (let x = 0; x < 32; x++) for (let y = 0; y < 2; y++) { ctx.fillStyle = (x + y) % 2 ? "#e9e2d2" : "#16130f"; ctx.fillRect(x * 2, y * 2, 2, 2); }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildGates(game, track) {
  const M = game.M, group = new THREE.Group(), cps = track.checkpoints;
  const postGeo = new THREE.CylinderGeometry(0.22, 0.28, 1, 10), lampGeo = new THREE.SphereGeometry(0.42, 12, 8), beamGeo = new THREE.BoxGeometry(1, 0.9, 0.5);
  const dim = new THREE.MeshStandardMaterial({ color: "#5a5346", roughness: 0.6 });
  const tex = chequer(), lineMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const posts = new THREE.InstancedMesh(postGeo, M.dark, cps.length * 2), lamps = new THREE.InstancedMesh(lampGeo, dim, cps.length * 2);
  const lit = [new THREE.Mesh(lampGeo, M.lamp), new THREE.Mesh(lampGeo, M.lamp)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const lineGeos = [], spots = [];
  posts.castShadow = true;
  for (const l of lit) { l.scale.setScalar(1.15); l.visible = false; }
  group.add(posts, lamps, ...lit);

  cps.forEach((c, i) => {
    const big = c.n === 0 || (!track.closed && c.n === cps.length - 1); // the start line, and the finish of a point-to-point
    const h = big ? 7 : 4.2, half = c.w / 2 + 1.6, across = Math.atan2(-c.nz, c.nx), pair = [];
    [-1, 1].forEach((side, k) => {
      const x = c.x + c.nx * side * half, z = c.z + c.nz * side * half;
      posts.setMatrixAt(i * 2 + k, m4.compose(p.set(x, c.y + h / 2, z), q, s.set(1, h, 1)));
      lamps.setMatrixAt(i * 2 + k, m4.compose(p.set(x, c.y + h + 0.3, z), q, s.set(1, 1, 1)));
      pair.push([x, c.y + h + 0.3, z]);
    });
    spots.push(pair);
    if (!big) return;
    const beam = new THREE.Mesh(beamGeo, M.hazard);
    beam.position.set(c.x, c.y + h - 0.45, c.z); beam.rotation.y = across; beam.scale.x = half * 2; beam.castShadow = true;
    const geo = new THREE.PlaneGeometry(c.w, 2.2), line = new THREE.Mesh(geo, lineMat);
    line.rotation.order = "YXZ"; line.rotation.set(-Math.PI / 2, across, 0);
    line.position.set(c.x, c.y + 0.09, c.z); line.receiveShadow = true;
    group.add(beam, line); lineGeos.push(geo);
  });
  posts.computeBoundingSphere(); lamps.computeBoundingSphere();

  return {
    group,
    /** Light the lamps of checkpoint n (-1: none). */
    setNext(n) { const pair = spots[n]; lit.forEach((l, k) => { l.visible = !!pair; if (pair) l.position.set(...pair[k]); }); },
    dispose() {
      for (const g of [postGeo, lampGeo, beamGeo, ...lineGeos]) g.dispose();
      posts.dispose(); lamps.dispose(); dim.dispose(); lineMat.dispose(); tex.dispose();
    },
  };
}