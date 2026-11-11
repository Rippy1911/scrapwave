// Walker state over the existing net code (round 12). The room server keeps `parts` as an array of detached part
// ids or as an object of up to 64 numeric or boolean values (docs/protocol.md), so a moving machine sends `parts` as
// an object, with no server change:
//   <partId>: true   a detached part (what the array form carried)
//   wd   which machine: 1 Wreckframe, 2 Scuttler; 12 / 14 any other 2 / 4-legged build (shown as the stock one)
//   wm   mode: 0 drive, 1 walker, 2 transforming      wk  fold 0 (car) .. 1 (standing)
//   wp   active pose key (0 none)                      j0..jN  every joint value, in rig order (limb angles, pistons)
// Receivers (net/remote.js) build the machine from wd and pose its rig from wk and the joint values.
import { isMech } from "@/game/mech/mech";
import { wreckframeDesign } from "@/game/mech/wreckframe";
import { scuttlerDesign } from "@/game/mech/scuttler";
import { walkChassis } from "@/game/mech/transform";

const MAX_J = 40, r3 = (x) => Math.round(x * 1000) / 1000;
const NAMED = { Wreckframe: 1, Scuttler: 2 };

export function mechCode(v) {
  if (!isMech(v)) return 0;
  return NAMED[v.design.design.name] || (v.design.mech.legs === 4 ? 14 : 12);
}
export const designForCode = (c) => (c === 2 || c === 14 ? scuttlerDesign() : wreckframeDesign());

// Adds the walker to a packed state (codec.packState). Returns the state.
export function packMech(state, game) {
  const v = game.player, code = mechCode(v);
  if (!code) return state;
  const st = game.mech.state(v), parts = {};
  for (const id of (state.parts || []).slice(0, 64 - 5 - MAX_J)) parts[id] = true;
  parts.wd = code; parts.wk = r3(st.k); parts.wm = st.tr ? 2 : v.walking ? 1 : 0; parts.wp = st.keys.active || 0;
  st.rig.D.info.slice(0, MAX_J).forEach((j, i) => { parts["j" + i] = r3(st.pose[j.id] || 0); });
  state.parts = parts;
  return state;
}

// { code, k, mode, pose, joints[] } from a remote state, or null when it is not a moving machine.
export function readMech(s) {
  const p = s && s.parts;
  if (!p || Array.isArray(p) || !p.wd) return null;
  const joints = [];
  for (let i = 0; i < MAX_J && ("j" + i) in p; i++) joints.push(+p["j" + i] || 0);
  return { code: +p.wd, k: Math.max(0, Math.min(1, +p.wk || 0)), mode: +p.wm || 0, pose: +p.wp || 0, joints };
}
// Detached part ids in either `parts` form.
export const detachedOf = (s) => (Array.isArray(s.parts) ? s.parts : Object.keys(s.parts || {}).filter((k) => s.parts[k] === true));

// Pose a remote machine from its latest state: fold, joints (eased toward the sent values), standing hit box.
export function applyRemoteMech(game, v, m, dt) {
  const st = game.mech.state(v);
  if (!st || !m) return;
  st.k = m.k; st.remoteMode = m.mode;
  const info = st.rig.D.info, ease = Math.min(1, dt * 15), pose = st.pose;
  if (m.joints.length === info.length) info.forEach((j, i) => { pose[j.id] = (pose[j.id] || 0) + (m.joints[i] - (pose[j.id] || 0)) * ease; });
  else if (m.k > 0.5) st.gait.step(dt, Math.hypot(v.vel.x, v.vel.z), 0, 0, (st.pose = {}), () => {}); // a custom build shown as the stock one
  const stand = m.k >= 0.5;
  if (stand && !st.carChassis) { st.carChassis = v.chassis; v.chassis = walkChassis(v.chassis, st.rig.D.T); }
  else if (!stand && st.carChassis) { v.chassis = st.carChassis; st.carChassis = null; }
}