// The mech rig on a built vehicle mesh: moves every body child between its drive placement (as build.js made it)
// and its Walker placement, with joints applied in both frames. Free parts are found by userData.fid; everything
// else (cab, body, wheels, shell, dressing) is the frame and stands up as the torso.
// apply(k, pose): k 0 = car, 1 = walker (parts fold in a staggered wave while k moves); pose = { jointId: value }.
import * as THREE from "three";
import { rigData } from "@/game/mech/rigData";
import { solveJoints, partProgress, ease } from "@/game/mech/pose";

const I = new THREE.Matrix4(), mD = new THREE.Matrix4(), mW = new THREE.Matrix4();
const pA = new THREE.Vector3(), pB = new THREE.Vector3(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), s = new THREE.Vector3();

export function createRig(mesh, design) {
  const D = rigData(design), body = mesh.body;
  const byFid = new Map(D.parts.map((p) => [p.id, p]));
  const stand = D.T.stand(1, new THREE.Matrix4());
  const items = [];
  for (const o of body.children) {
    o.updateMatrix();
    const base = o.matrix.clone(), fid = o.userData.fid, P = fid && byFid.get(fid);
    if (P) {
      const off = P.drive.clone().invert().multiply(base); // the object's offset inside its part (mount guns sit on top)
      items.push({ o, base, walk: P.walk.clone().multiply(off), limb: P.limb, fid, i: items.length });
    } else items.push({ o, base, walk: stand.clone().multiply(base), limb: 0, fid: 0, frame: true });
  }
  const n = items.length, jd = new Map(), jw = new Map();
  const free = items.filter((x) => !x.frame);
  free.forEach((x, i) => { x.i = i; });

  function apply(k, pose) {
    solveJoints(D.joints.drive, pose, jd);
    if (k > 0) solveJoints(D.joints.walk, pose, jw);
    const kf = ease(k);
    if (k > 0) { body.position.multiplyScalar(1 - kf); body.quaternion.slerp(qA.identity(), kf); }
    for (const x of items) {
      if (x.o.parent !== body) continue; // shot off
      if (x.frame && k <= 0) continue; // the car's own parts: build.js and the suspension own them while driving
      mD.copy(x.limb && jd.has(x.limb) ? jd.get(x.limb) : I).multiply(x.base);
      if (k <= 0) { mD.decompose(x.o.position, x.o.quaternion, s); continue; }
      mW.copy(x.limb && jw.has(x.limb) ? jw.get(x.limb) : I).multiply(x.walk);
      const kk = x.frame ? kf : partProgress(k, x.i, Math.max(1, free.length));
      mD.decompose(pA, qA, s); mW.decompose(pB, qB, s);
      x.o.position.lerpVectors(pA, pB, kk);
      if (!x.frame) x.o.position.y += Math.sin(kk * Math.PI) * 0.35; // swing out rather than through each other
      x.o.quaternion.slerpQuaternions(qA, qB, kk);
    }
  }
  // Back to exactly what build.js made (driving with every joint at rest).
  function restore() { for (const x of items) if (x.o.parent === body) x.base.decompose(x.o.position, x.o.quaternion, x.o.scale); }
  const objOf = (fid) => { const x = items.find((it) => it.fid === fid && it.o.parent === body); return x ? x.o : null; };
  return { D, apply, restore, objOf, count: n };
}