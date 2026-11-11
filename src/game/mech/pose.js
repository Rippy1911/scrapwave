// Pose math for moving machines (no physics here). A pose is a plain object { jointId: value }: an angle in
// radians for hinges, rotors and motors, an extension in metres for pistons. Limbs are groups of parts hung on a
// joint; a joint can hang on another limb's joint (hip → knee → foot). Transforms between Drive and Walker mode
// blend every part between its two placements with a staggered wave so parts swing, slide and fold in turn.
import * as THREE from "three";

export const JOINT_KINDS = ["hinge", "rotor", "piston", "motor"];
export const TRANSFORM_TIME = 1.2; // seconds, real time (time never slows)

const ax = new THREE.Vector3(), pv = new THREE.Vector3(), q = new THREE.Quaternion();
const mA = new THREE.Matrix4(), mB = new THREE.Matrix4();

export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Hinges and pistons have limits; rotors and motors set to spin wrap freely.
export function clampJoint(j, v) {
  if (j.kind === "rotor" || (j.kind === "motor" && j.spin)) return v;
  const lo = j.min ?? (j.kind === "piston" ? 0 : -Math.PI), hi = j.max ?? (j.kind === "piston" ? 1 : Math.PI);
  return clamp(v, lo, hi);
}

export function blendPose(a, b, k, out = {}) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const id of keys) {
    const x = a?.[id] ?? 0, y = b?.[id] ?? 0;
    out[id] = x + (y - x) * k;
  }
  return out;
}

// A pose track animates from the current pose to a target over dur seconds (eased). step() returns true while moving.
export function createPoseTrack(initial = {}) {
  const tr = { current: { ...initial }, from: { ...initial }, to: { ...initial }, t: 1, dur: 0.3 };
  tr.set = (to, dur = 0.3) => { tr.from = { ...tr.current }; tr.to = { ...tr.current, ...to }; tr.t = 0; tr.dur = Math.max(0.01, dur); };
  tr.snap = (to) => { tr.current = { ...tr.current, ...to }; tr.from = { ...tr.current }; tr.to = { ...tr.current }; tr.t = 1; };
  tr.step = (dt) => {
    if (tr.t >= 1) return false;
    tr.t = Math.min(1, tr.t + dt / tr.dur);
    blendPose(tr.from, tr.to, ease(tr.t), tr.current);
    return tr.t < 1;
  };
  tr.busy = () => tr.t < 1;
  return tr;
}

// Local matrix a joint applies to its limb: rotate about axis through pivot, or slide along axis (piston).
export function jointMatrix(j, value, out = new THREE.Matrix4()) {
  ax.fromArray(j.axis || [1, 0, 0]).normalize();
  pv.fromArray(j.pivot || [0, 0, 0]);
  if (j.kind === "piston") return out.makeTranslation(ax.x * value, ax.y * value, ax.z * value);
  q.setFromAxisAngle(ax, value);
  mA.makeTranslation(pv.x, pv.y, pv.z);
  mB.makeRotationFromQuaternion(q);
  out.multiplyMatrices(mA, mB);
  mA.makeTranslation(-pv.x, -pv.y, -pv.z);
  return out.multiply(mA);
}

// Frame-space matrix for every joint, parents first. joints: [{ id, parent, kind, axis, pivot, ... }].
export function solveJoints(joints, pose, out = new Map()) {
  const done = new Set();
  const solve = (j, depth = 0) => {
    if (done.has(j.id) || depth > 16) return out.get(j.id);
    const m = out.get(j.id) || new THREE.Matrix4();
    jointMatrix(j, clampJoint(j, pose?.[j.id] ?? j.rest ?? 0), m);
    const par = j.parent && joints.find((x) => x.id === j.parent);
    if (par) m.premultiply(solve(par, depth + 1));
    out.set(j.id, m); done.add(j.id);
    return m;
  };
  for (const j of joints) solve(j);
  return out;
}

// Transform wave: part i of n starts a little after the one before it, so the machine folds in sequence.
export function partProgress(t, i, n, spread = 0.45) {
  const start = n > 1 ? (i / (n - 1)) * spread : 0;
  return ease((t - start) / (1 - spread));
}

// Blend a part's drive placement to its walker placement. Placements: { p: [x,y,z], r: [qx,qy,qz,qw] }.
// A little lift on the way makes parts swing out rather than pass straight through each other.
export function blendPlacement(a, b, k, outPos, outQuat, lift = 0.35) {
  outPos.set(a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k + Math.sin(k * Math.PI) * lift, a.p[2] + (b.p[2] - a.p[2]) * k);
  outQuat.fromArray(a.r || [0, 0, 0, 1]);
  q.fromArray(b.r || [0, 0, 0, 1]);
  return outQuat.slerp(q, k);
}