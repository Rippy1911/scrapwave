// AI gunnery shared by every AI gunner: Rattlers, Drifters, the autopilot, the Warlord and its trailer guns, and
// base turrets. A gunner only shoots along a clear line from its muzzle to the target (buildings, walls, base
// modules, rocks and terrain block it), starts 0.3-0.6 s after it first sees the target, aims with an error that
// grows with distance and the target's speed, leads imperfectly, and fires in short bursts with pauses.
// Skill q runs from 0 (rookie) to 1 (ace); see AIM in tuning.js.
import * as THREE from "three";
import { AIM } from "@/game/data/tuning";

const to = new THREE.Vector3(), dir = new THREE.Vector3();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2; // mean 0, sd 1, bounded at 3

/** Skill quality 0 (rookie) .. 1 (ace) from a skill's spread (rookie 0.06, veteran 0.035, ace 0.018). */
export const skillQ = (sk) => clamp((0.06 - (sk ? sk.spread : 0.035)) / 0.05, 0, 1);

export function newAim() {
  return { t: null, see: false, seenAt: -1, lostAt: -1e9, react: 0, losT: 0, last: -1e9, burst: 0, pause: 0, errT: 0, err: new THREE.Vector3(), errTo: new THREE.Vector3(), lag: 0, leadK: 1 };
}

/** A clear shot from `from` to the target's body: no static collider or terrain on the way, and no other car first. */
export function clearShot(game, from, t, shooter) {
  to.copy(t.pos); to.y += 0.5;
  dir.subVectors(to, from);
  const L = dir.length();
  if (L < 1) return true;
  dir.divideScalar(L);
  const r = game.combat.ray(from, dir, L + 1.5, shooter);
  return !r.world && (!r.v || r.v === t);
}

/**
 * One step of a gunner's aim. st: newAim() kept by the gunner; from: its muzzle (world); q: skill 0..1;
 * leadT: the round's flight time to the target (0 for hitscan); out: receives the aim point.
 * Returns { see, ready, burst }: ready = seen long enough to react, burst = trigger held this step.
 */
const res = { see: false, ready: false, burst: false };
export function aimStep(game, st, shooter, t, dist, q, from, out, leadT = 0) {
  const now = game.time;
  let dt = now - st.last;
  if (st.t !== t || dt > AIM.forget) { // new target, or the gunner had looked away: start over
    st.t = t; st.see = false; st.seenAt = -1; st.lostAt = -1e9; st.losT = 0; st.burst = 0; st.pause = 0; st.errT = 0; st.err.set(0, 0, 0);
    dt = 0;
  }
  st.last = now;
  // line of sight from the muzzle, a few times a second
  st.losT -= dt;
  if (st.losT <= 0) {
    st.losT = AIM.losEvery;
    const see = clearShot(game, from, t, shooter);
    if (see && !st.see && (st.seenAt < 0 || now - st.lostAt > AIM.forget)) {
      st.seenAt = now;
      st.react = lerp(AIM.react[0], AIM.react[1], q) + Math.random() * AIM.reactJitter;
      st.burst = 0; st.pause = 0;
    }
    if (!see && st.see) st.lostAt = now;
    st.see = see;
  }
  // aim error: an offset at the target that drifts to a new value every errEvery seconds
  const speed = t.vel.length();
  const sigma = AIM.err * (1.4 - 0.7 * q) + AIM.errPerM * dist + AIM.errPerMs * speed * (1.5 - q);
  st.errT -= dt;
  if (st.errT <= 0) {
    st.errT = lerp(AIM.errEvery[0], AIM.errEvery[1], Math.random());
    const m = sigma * dist;
    st.errTo.set(gauss() * m, gauss() * m * AIM.errUp, gauss() * m);
    st.lag = lerp(AIM.lag[0], AIM.lag[1], q) * (0.6 + Math.random() * 0.8);
    st.leadK = lerp(AIM.lead[0], AIM.lead[1], q) + (Math.random() - 0.5) * 0.4;
  }
  st.err.lerp(st.errTo, Math.min(1, dt * 6));
  // hitscan aims where the target was a moment ago; projectiles get part of the true lead
  out.copy(t.pos).addScaledVector(t.vel, leadT * st.leadK - st.lag).add(st.err);
  out.y += 0.4;
  res.see = st.see;
  res.ready = st.see && st.seenAt >= 0 && now - st.seenAt >= st.react;
  // bursts: hold the trigger, let go, again (only once ready)
  if (!res.ready) { st.burst = 0; st.pause = 0; res.burst = false; return res; }
  if (st.burst > 0) { st.burst -= dt; if (st.burst <= 0) st.pause = lerp(AIM.pause[0], AIM.pause[1], q) * (0.7 + Math.random() * 0.6); }
  else if (st.pause > 0) st.pause -= dt;
  else st.burst = lerp(AIM.burst[0], AIM.burst[1], q) * (0.7 + Math.random() * 0.6);
  res.burst = st.burst > 0;
  return res;
}

/** World position of a vehicle's first working gun muzzle (falls back to the roof). */
export function vehicleMuzzle(v, out) {
  for (const w of v.weapons || []) {
    if (w.disabled || !w.mount || !w.mount.model || !w.mount.model.pitch) continue;
    const m = w.mount.model;
    return m.pitch.localToWorld(out.copy(m.muzzles[0]));
  }
  out.copy(v.pos); out.y += 1.2;
  return out;
}
