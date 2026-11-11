// Ramp runs for the shared Drifter/autopilot brain: pick a ramp ahead, approach it from a point on the road
// behind it (at road height), and give up when the car stalls so it never sits still waiting for unstick.
import * as THREE from "three";
import { DRIFTER_AI as K } from "@/game/data/drifters";
import { surfaceY } from "@/game/world/spawn";

const fwd = new THREE.Vector3();
const STALL_SPEED = 3 / 3.6, STALL_TIME = 2, GIVE_UP_CD = 20;

// Walk the road from the ramp backwards (against the ramp direction) until we're far enough behind it.
function approachPoint(game, r) {
  const w = game.world, back = r.len / 2 + 16;
  const n = w.roads.nearest(r.x, r.z, 4, false);
  if (!n.road || Math.hypot(n.x - r.x, n.z - r.z) > 12) return null;
  const S = n.road.samples, step = S[n.i].dx * r.dirX + S[n.i].dz * r.dirZ >= 0 ? -1 : 1;
  for (let i = n.i; i >= 0 && i < S.length; i += step) {
    const p = S[i];
    if (p.deck || p.bridge) return null;
    const along = (p.x - r.x) * r.dirX + (p.z - r.z) * r.dirZ;
    if (along <= -back) return { x: p.x, y: surfaceY(w, p.x, p.z), z: p.z };
  }
  return null;
}

export function pickRamp(game, v, b) {
  if (game.time < (b.rampCd || 0)) return null;
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  for (const r of game.world.ramps) {
    const dx = r.x - v.pos.x, dz = r.z - v.pos.z, d = Math.hypot(dx, dz);
    if (d > K.rampRange || d < r.len) continue;
    if ((dx * fwd.x + dz * fwd.z) / d < 0.75 || r.dirX * fwd.x + r.dirZ * fwd.z < 0.6) continue;
    const at = approachPoint(game, r);
    if (at) return { r, at };
  }
  return null;
}

export function startRamp(game, b, pick) {
  b.mode = "ramp"; b.ramp = pick.r; b.rampAt = pick.at; b.rampStage = 0; b.rampUntil = game.time + 9; b.rampSlow = 0;
}

// Sets `g` to this frame's ramp target. Returns false when the run is over (done or abandoned).
export function rampTarget(game, v, b, g, dt) {
  const r = b.ramp, half = r.len / 2;
  b.rampSlow = v.vel.length() < STALL_SPEED ? (b.rampSlow || 0) + dt : 0;
  if (b.rampSlow > STALL_TIME) { b.mode = "roam"; b.rampCd = game.time + GIVE_UP_CD; return false; }
  const along = (v.pos.x - r.x) * r.dirX + (v.pos.z - r.z) * r.dirZ;
  if (b.rampStage === 0) g.set(b.rampAt.x, b.rampAt.y, b.rampAt.z);
  else g.set(r.x + r.dirX * 60, r.y, r.z + r.dirZ * 60);
  if (b.rampStage === 0 && (g.distanceTo(v.pos) < 9 || along > -half - 16)) b.rampStage = 1;
  if (b.rampStage === 1 && along > half + 6) { b.mode = "roam"; b.rampCd = game.time + 12; return false; }
  return true;
}