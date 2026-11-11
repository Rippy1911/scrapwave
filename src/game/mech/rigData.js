// Rig data for a design with free parts (pure, no scene): each part's drive and walker placement matrices, the
// joints in both frames (pivot and axis from the joint part's own placement), and the walker's legs, arms and fists
// worked out from joint roles (hip, knee, shoulder, elbow, fist).
import * as THREE from "three";
import { FREE_PARTS, freePartInfo, partHalf } from "@/game/workshop/freeParts";
import { torsoFor, placeOf, toQuat, legOf } from "@/game/workshop/torso";

const AXIS = { hinge: [1, 0, 0], motor: [1, 0, 0], rotor: [0, 1, 0], piston: [0, 0, 1] };
const ONE = new THREE.Vector3(1, 1, 1);
const matOf = (pl) => new THREE.Matrix4().compose(new THREE.Vector3(...pl.p), toQuat(pl.r), ONE);

export function rigData(design) {
  const T = torsoFor(design), parts = design?.free?.parts || [];
  const D = { T, parts: [], joints: { drive: [], walk: [] }, info: [], legs: [], arms: [], fists: [], feet: new Map() };
  for (const p of parts) {
    D.parts.push({ id: p.id, t: p.t, limb: p.limb || 0, drive: matOf(placeOf(T, p, "drive")), walk: matOf(placeOf(T, p, "walk")) });
    const d = FREE_PARTS[p.t];
    if (!d.joint) continue;
    for (const mode of ["drive", "walk"]) {
      const pl = placeOf(T, p, mode);
      const axis = new THREE.Vector3(...AXIS[d.joint]).applyQuaternion(toQuat(pl.r)).toArray();
      D.joints[mode].push({ id: p.id, parent: p.limb || null, kind: d.joint, axis, pivot: [...pl.p], min: p.min, max: p.max, spin: !!p.spin });
    }
    const w = placeOf(T, p, "walk").p;
    D.info.push({ id: p.id, t: p.t, role: p.role || "", key: p.key || 0, min: p.min ?? d.range[0], max: p.max ?? d.range[1], spin: !!p.spin, speed: freePartInfo(p.t, p.tier).speed || d.speed, side: Math.sign(w[0]), z: w[2] });
  }
  // Legs: one per hip, with its knees and its lowest part (the foot) in Walker mode.
  for (const hip of D.info.filter((j) => j.role === "hip")) {
    const chain = parts.filter((p) => p.id !== hip.id && legOf(design, p)?.id === hip.id);
    const knees = chain.filter((p) => p.role === "knee" && FREE_PARTS[p.t].joint).map((p) => p.id);
    let foot = hip.id, low = Infinity;
    for (const p of chain) { const y = placeOf(T, p, "walk").p[1] - partHalf(p.t)[1]; if (y < low) { low = y; foot = p.id; } }
    D.legs.push({ hip: hip.id, knees, foot, side: hip.side, fb: Math.sign(hip.z) });
  }
  const four = D.legs.length >= 4;
  for (const L of D.legs) L.offset = (L.side > 0) !== (four && L.fb > 0) ? Math.PI : 0; // diagonal pairs step together
  for (const A of D.info.filter((j) => j.role === "shoulder")) D.arms.push({ id: A.id, offset: A.side > 0 ? 0 : Math.PI });
  // Fists: ram fist mounts, punched forward by the fist (or elbow) joint they hang on.
  const byId = new Map(parts.map((p) => [p.id, p]));
  for (const p of parts) {
    if (p.wpn?.id !== "ramFist") continue;
    let j = p.limb ? byId.get(p.limb) : null, n = 0;
    while (j && n < 20 && !(j.role === "fist" || j.role === "elbow")) { j = j.limb ? byId.get(j.limb) : null; n++; }
    D.fists.push({ mount: p.id, hp: "f" + p.id, joint: j ? j.id : 0 });
  }
  return D;
}