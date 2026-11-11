// Assisted aim (round 8): locks the target nearest the crosshair inside a forward cone, keeps the lock
// with a little hysteresis, cycles with Tab, times the rocket lock and computes the aim point.
// Pure logic: candidates come from weapons/targets.js, the player wiring lives in weapons/playerAim.js.
import * as THREE from "three";
import { AIM_UP } from "@/game/weapons/aimLimits";

const D = Math.PI / 180;
export const ASSIST = {
  yaw: 25 * D, pitch: 15 * D, // cone half-angles around the crosshair
  pitchUp: 43 * D, // round 14: the cone's reach above the crosshair (which rests about 7 degrees below level); the 35 degree gun limit caps it
  keep: 1.3, // an existing lock survives until it leaves a cone this much wider
  rangeShow: 1.5, // locks are shown (grey) out to this multiple of the weapon range
  rocketLock: 0.6, // seconds on target before rockets home
  leadFrac: 0.5, // unguided slow weapons get half the lead they need
  losEvery: 0.15, // seconds between line-of-sight checks on the lock
};

const inv = new THREE.Quaternion(), loc = new THREE.Vector3(), out = new THREE.Vector3();

// Angles of a point in camera space: yaw right-positive, pitch up-positive, plus forward depth.
function angles(pos, origin, camQuat) {
  loc.subVectors(pos, origin).applyQuaternion(inv.copy(camQuat).invert());
  const fwd = -loc.z;
  return { yaw: Math.atan2(loc.x, fwd), pitch: Math.atan2(loc.y, Math.hypot(loc.x, fwd)), fwd, dist: loc.length() };
}

export function createAimAssist() {
  const st = { mode: "assisted", lock: null, next: null, lockT: 0, inRange: false, list: [], losT: 0, losOk: true };

  function rank(cands, origin, camQuat, range, widen) {
    const res = [];
    for (const c of cands) {
      const a = angles(c.pos, origin, camQuat);
      if (a.fwd <= 0 || a.dist > range * ASSIST.rangeShow) continue;
      // The cone is taller above the crosshair than below it, so cars on ramps and bridges, aircraft and wall tops
      // lock without hunting for them; nothing higher than the guns can elevate is ever offered.
      const ny = Math.abs(a.yaw) / (ASSIST.yaw * widen), np = Math.abs(a.pitch) / ((a.pitch > 0 ? ASSIST.pitchUp : ASSIST.pitch) * widen);
      if (ny > 1 || np > 1) continue;
      if (a.dist > 4 && Math.asin(Math.max(-1, Math.min(1, (c.pos.y - origin.y) / a.dist))) > AIM_UP + 0.05) continue;
      res.push({ c, score: Math.hypot(ny, np) + (c.bias || 0) + (a.dist > range ? 0.6 : 0), dist: a.dist });
    }
    return res.sort((x, y) => x.score - y.score);
  }

  // cands: [{ key, id, kind, pos, vel?, hull, maxHull, name, bias? }] (bias > 0 ranks a kind lower).
  // los(c) → true when nothing solid is in the way.
  function update(dt, cands, origin, camQuat, range, { cycle = false, los = null } = {}) {
    if (st.mode !== "assisted") { clear(); return st; }
    const list = rank(cands, origin, camQuat, range, 1);
    const prev = st.lock;
    let lock = prev && rank([prev.c], origin, camQuat, range, ASSIST.keep)[0];
    if (lock) {
      lock = { ...lock, c: cands.find((c) => c.key === prev.c.key) || prev.c };
      st.losT -= dt;
      if (los && st.losT <= 0) { st.losT = ASSIST.losEvery; st.losOk = los(lock.c); }
      if (!st.losOk) lock = null;
    }
    if (!lock) {
      lock = list.find((e) => !los || los(e.c)) || null;
      st.losOk = true; st.losT = ASSIST.losEvery;
    }
    if (cycle && list.length) {
      const i = lock ? list.findIndex((e) => e.c.key === lock.c.key) : -1;
      lock = list[(i + 1) % list.length];
    }
    st.lockT = lock && prev && lock.c.key === prev.c.key ? st.lockT + dt : 0;
    st.lock = lock;
    st.next = lock ? list.find((e) => e.c.key !== lock.c.key) || null : null;
    st.inRange = !!lock && lock.dist <= range;
    st.list = list;
    return st;
  }

  function clear() { st.lock = null; st.next = null; st.lockT = 0; st.inRange = false; st.list = []; }

  // Where to point a weapon: the locked target's centre, led by `leadFrac` of the true lead for slow shots.
  function aimPoint(origin, speed = 0, leadFrac = 0) {
    const c = st.lock && st.lock.c;
    if (!c) return null;
    out.copy(c.pos);
    if (speed > 0 && leadFrac > 0 && c.vel) out.addScaledVector(c.vel, (origin.distanceTo(c.pos) / speed) * leadFrac);
    return out;
  }

  return {
    st, update, clear, aimPoint,
    mode: () => st.mode,
    setMode(m) { st.mode = m === "manual" ? "manual" : "assisted"; if (st.mode === "manual") clear(); },
    rocketReady: () => !!st.lock && st.inRange && st.lockT >= ASSIST.rocketLock,
    lockInfo: () => (st.lock ? { id: st.lock.c.id, kind: st.lock.c.kind, distance: Math.round(st.lock.dist), inRange: st.inRange, lockT: +st.lockT.toFixed(2) } : null),
  };
}