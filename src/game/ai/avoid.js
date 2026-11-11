// AI avoidance for every non-race AI car (Rattlers, Drifters, arena opponents, the convoy, the Warlord, militia,
// base guards and raiders): they all steer through ai/steer.js driveTo(), which calls avoidDrive() below.
//
// Look-ahead: about 1.5 s of travel (12-70 m) probed with seven rays fanned across +-54 degrees from the bumper
// (the forward ray is a three-ray swept box as wide as the car) against the colliders (walls, buildings, barriers,
// base modules), then four ground samples along each ray for drops, cliffs, the map edge and water (a map may set
// world.hazardAt(x, z) to mark the sea). The car keeps steering at its goal while that way is clear; when it is not,
// it steers at the clear ray that is closest to the goal (the side with more room, the road side on a tie) and
// holds back its speed so it can still stop or turn inside the free distance.
// Stuck: no progress for 2 s -> reverse and re-aim toward the open side; still within 10 m after 5 s -> back to the
// nearest safe point (a breadcrumb the car drove through, else a map spawn or the nearest road). Off the map or
// under the ground -> the same respawn at once.
// Cost: far cars probe every 4th step, near cars every 2nd, and each car's state (one object and one Float32Array
// per brain) is made once, so a step allocates nothing. ?avoid=0 turns it all off (the old behaviour).
import * as THREE from "three";
import { WORLD } from "@/game/data/tuning";
import { nearestRoadPose } from "@/game/world/spawn";
import { mapById } from "@/game/maps/catalog";
import { placeVehicle } from "@/game/vehicles/vehicle";

const D2R = Math.PI / 180;
const ANG = [-54, -36, -18, 0, 18, 36, 54].map((d) => d * D2R); // + is to the right, like driveTo's angle
const NR = ANG.length, MID = 3, COS = ANG.map(Math.cos), SIN = ANG.map(Math.sin);
const LOOK_S = 1.5, LOOK_MIN = 12, LOOK_MAX = 70; // seconds of travel and its bounds (m)
const BRAKE = 11, TURN_G = 7; // m/s^2 we trust the tyres for: braking and sideways
const STUCK_REVERSE = 2, STUCK_RESPAWN = 5, REVERSE_FOR = 2, PROGRESS = 10; // s, s, s, m
const CRUMBS = 6;

let G = null;
const ON = !(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("avoid") === "0"); // ?avoid=0: the old driving
export function bindAvoid(game) { G = game; }
export const avoidOn = () => ON && !!G;
// True while this car's own recovery owns it, so the generic unstick rule does not reset it to a far-off road.
export const avoidOwns = (v) => ON && !!G && !!v.brain && !!v.brain.av && G.time - v.brain.av.t < 0.5;

const fwd = new THREE.Vector3();
let fx = 0, fz = 0, rx = 0, rz = 0; // the car's heading and right vector on the ground (scratch)

function newState() {
  return {
    t: 0, cd: (Math.random() * 4) | 0, every: 2, d: new Float32Array(NR).fill(LOOK_MAX), look: LOOK_MIN, pick: MID, free: LOOK_MAX, fwdFree: LOOK_MAX,
    vmax: 99, side: 1, hold: 0, pT: 0, slowT: 0, px: 0, pz: 0, nextRev: 0, corner: 0, rear: 99, fail: 0, crowd: false,
    crumbs: new Float32Array(CRUMBS * 4), cn: 0, ci: 0, crumbT: 0, resp: 0, stuckEv: 0,
  };
}

// ---- where the map ends -------------------------------------------------------------------------------------
// Returns true when (x, z) is outside the drivable area by more than `m` metres (arena ring, world map box, roam).
function outside(x, z, m) {
  const A = G.arena;
  if (A && A.active && A.map && A.map.ctx) { const s = A.map.ctx.site; return Math.hypot(x - s.x, z - s.z) > A.map.ctx.R - 3 + m; }
  const cur = G.maps && G.maps.current && G.maps.current();
  const def = cur && mapById(cur.id);
  if (cur && def && def.size) return Math.abs(x - cur.x) > def.size[0] / 2 - 6 + m || Math.abs(z - cur.z) > def.size[1] / 2 - 6 + m;
  return Math.abs(x) > WORLD.bound - 6 + m || Math.abs(z) > WORLD.bound - 6 + m;
}

// ---- probing ------------------------------------------------------------------------------------------------
// Distance along (dx, dz) from (ox, oy, oz) to the first solid collider, capped at `max`. Ray-only colliders
// (breakable props) and, when `wedgeOk`, ramps are looked through.
function cast(ox, oy, oz, dx, dz, max, wedgeOk) {
  const C = G.world.colliders;
  let t0 = 0;
  for (let i = 0; i < 3; i++) {
    const h = C.raycast(ox + dx * t0, oy, oz + dz * t0, dx, 0, dz, max - t0);
    if (!h) return max;
    // looked through: breakable props, ramps on a jump run, and the ramp the bumper is already on (a car standing on a ramp is not facing a wall)
    if (h.box.noCollide || (h.box.kind === "wedge" && (wedgeOk || (t0 === 0 && h.t < 0.3)))) { t0 += h.t + 0.1; if (t0 >= max) return max; continue; }
    return t0 + h.t;
  }
  return max;
}

// Ground samples along one ray: the first station that is off the map, over water, a drop or a cliff face cuts
// the clear distance there. g0 is the ground under the car.
function groundCut(v, g0, ox, oz, dx, dz, dist) {
  if (dist < 6) return dist;
  const W = G.world, yRef = v.pos.y + 1.5, st = dist > 30 ? 4 : 3;
  let gPrev = g0;
  for (let i = 1; i <= st; i++) {
    const s = (dist * i) / st, x = ox + dx * s, z = oz + dz * s, step = dist / st;
    if (outside(x, z, 0) || (W.hazardAt && W.hazardAt(x, z))) return Math.max(0, s - step - 1);
    const gy = W.groundAt(x, z, yRef);
    if (gPrev - gy > 2.2 || g0 - gy > 3.2 || gy - gPrev > 0.8 * step + 1.2) return Math.max(0, s - step - 1);
    gPrev = gy;
  }
  return dist;
}

function heading(v) {
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  const n = Math.hypot(fwd.x, fwd.z) || 1;
  fx = fwd.x / n; fz = fwd.z / n; rx = -fz; rz = fx;
}

function probe(v, A, look, jump) {
  const half = v.chassis.hit.half, hl = half[2], hw = half[0] + 0.2;
  const oy = v.pos.y + 0.15; // body height: an overhead beam or a raised platform is as solid as a wall
  const bx = v.pos.x + fx * hl, bz = v.pos.z + fz * hl;
  const g0 = jump ? 0 : G.world.groundAt(v.pos.x, v.pos.z, v.pos.y);
  for (let k = 0; k < NR; k++) {
    const dx = fx * COS[k] + rx * SIN[k], dz = fz * COS[k] + rz * SIN[k];
    let d = cast(bx, oy, bz, dx, dz, look, jump);
    if (k === MID) { // the swept box: both sides of the bumper too
      d = Math.min(d, cast(bx + rx * hw, oy, bz + rz * hw, dx, dz, look, jump), cast(bx - rx * hw, oy, bz - rz * hw, dx, dz, look, jump));
    }
    A.d[k] = jump ? d : groundCut(v, g0, bx, bz, dx, dz, d);
  }
  A.look = look;
}

// ---- recovery -----------------------------------------------------------------------------------------------
function crumb(v, A) {
  const i = A.ci * 4;
  A.crumbs[i] = v.pos.x; A.crumbs[i + 1] = v.pos.y - 0.9; A.crumbs[i + 2] = v.pos.z; A.crumbs[i + 3] = Math.atan2(-fx, -fz);
  A.ci = (A.ci + 1) % CRUMBS; if (A.cn < CRUMBS) A.cn++;
}

// The nearest safe spot: a crumb the car drove through (at least 12 m from here and within 80 m), else the nearest
// clear, level, inside-the-map point on rings around the car, else (open world) the nearest road.
const RING_R = [14, 22, 32, 48, 70], RING_N = 12;
// Free of colliders (at the car's height, so a map deck is not blocked by what stands on the ground far below it)
// and of other cars, within r metres of (x, z) at ground height gy.
let blockHit = false;
function blocked(x, z, gy, r, v) {
  blockHit = false;
  G.world.colliders.collect(x, z, r, (b) => {
    if (blockHit || b.dead || b.noCollide || b.y + b.hy < gy + 0.3 || b.y - b.hy > gy + 2) return;
    const dx = x - b.x, dz = z - b.z, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
    if (Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz)) < r) blockHit = true;
  });
  if (blockHit) return true;
  for (let i = 0; i < G.vehicles.length; i++) { const o = G.vehicles[i]; if (o !== v && o.alive && Math.abs(o.pos.y - gy) < 3 && Math.hypot(o.pos.x - x, o.pos.z - z) < r + 3) return true; }
  return false;
}
function respawn(v, A, b) {
  const W = G.world, x0 = v.pos.x, z0 = v.pos.z, g0 = W.groundAt(x0, z0, v.pos.y);
  let bx = 0, by = 0, bz = 0, bh = 0, bd = Infinity;
  for (let k = 0; k < A.cn; k++) {
    const i = k * 4, d = Math.hypot(A.crumbs[i] - x0, A.crumbs[i + 2] - z0);
    if (d < 12 || d > 80 || d >= bd || blocked(A.crumbs[i], A.crumbs[i + 2], A.crumbs[i + 1], 3.5, v)) continue;
    bd = d; bx = A.crumbs[i]; by = A.crumbs[i + 1]; bz = A.crumbs[i + 2]; bh = A.crumbs[i + 3];
  }
  for (let r = 0; r < RING_R.length && bd === Infinity; r++) {
    for (let k = 0; k < RING_N; k++) {
      const a = ((k + r * 0.5) / RING_N) * Math.PI * 2, x = x0 + Math.sin(a) * RING_R[r], z = z0 + Math.cos(a) * RING_R[r];
      if (outside(x, z, -5)) continue;
      const gy = W.groundAt(x, z, v.pos.y);
      if (Math.abs(gy - g0) > 1.5 || (W.hazardAt && W.hazardAt(x, z)) || blocked(x, z, gy, 4.5, v)) continue;
      const d = RING_R[r] + (k % 3) * 0.1; // nearest ring first; the first clear spot on it
      bd = d; bx = x; by = gy; bz = z; bh = Math.atan2(-(x - x0), -(z - z0)); // facing away from where it was stuck
      break;
    }
  }
  if (bd === Infinity && !(G.arena && G.arena.active)) {
    const p = nearestRoadPose(W, x0, z0, fx, fz, G.vehicles, v);
    bx = p.x; by = p.y; bz = p.z; bh = p.heading; bd = 0;
  }
  if (bd === Infinity) { A.fail++; return false; }
  placeVehicle(v, bx, by + 1.2, bz, bh);
  v.stuckT = 0; v.pushed = false;
  b.nav = null; b.reverse = 0; b.stuck = 0; b.still = 0;
  A.resp++; A.pT = 0; A.px = bx; A.pz = bz; A.hold = 0; A.cd = 0; A.corner = 0;
  for (let i = 0; i < 4; i++) G.particles.dust(bx + (i - 1.5), by + 0.3, bz + (i % 2) - 0.5, 0, 0, 2.2);
  return true;
}

// ---- the driver hook ----------------------------------------------------------------------------------------
// Called by driveTo() after it has set steer/throttle/brake toward the goal. ang: angle to the goal (+ right),
// dGoal: its distance. Returns true when this car is handled here (so driveTo skips its own stuck rule).
export function avoidDrive(v, ang, dGoal, dt, opt) {
  if (!ON || !G || v === G.player || v.remote || v.air || v.walking || !v.alive) return false;
  const b = v.brain, c = v.ctl, Ar = G.arena;
  if (Ar && Ar.active && Ar.race && Ar.race.on()) return false; // the race AI is its own thing
  const A = b.av || (b.av = newState());
  const speed = v.vel.length(), jump = !!opt.turbo || b.mode === "ramp"; // jumps and rams are on purpose
  A.t = G.time;
  if (v.contacts < 1) { A.pT = 0; return true; } // airborne: nothing to steer or brake with
  const want = c.throttle; // what the driver asked for, before any braking below
  heading(v);

  // -- probe (cars far from the player less often)
  if (--A.cd <= 0) {
    const pp = G.player.pos, dp = Math.hypot(pp.x - v.pos.x, pp.z - v.pos.z);
    A.every = dp < 90 ? 2 : dp < 220 ? 3 : 4;
    A.cd = A.every;
    probe(v, A, Math.max(LOOK_MIN, Math.min(LOOK_MAX, speed * LOOK_S + 6)), jump);
    // off the map / far under the ground: straight back
    if (outside(v.pos.x, v.pos.z, 6) || v.pos.y < G.world.groundAt(v.pos.x, v.pos.z, v.pos.y + 3) - 25) { if (respawn(v, A, b)) return true; }
    A.crumbT -= A.every / 60;
    if (A.crumbT <= 0 && speed > 4 && v.contacts >= 2 && A.d[MID] > 8) { crumb(v, A); A.crumbT = 1.2; }
    // the rear, only needed while backing out
    if (b.reverse > 0) {
      const hl = v.chassis.hit.half[2];
      A.rear = cast(v.pos.x - fx * hl, v.pos.y - 0.3, v.pos.z - fz * hl, -fx, -fz, 6, false);
    }
  }

  // -- steering: stay on the goal while the way to it is clear, else take the clear ray closest to it
  const gA = Math.max(-1.05, Math.min(1.05, ang)), look = A.look, d = A.d;
  let kg = MID, bs = 9;
  for (let k = 0; k < NR; k++) { const e = Math.abs(ANG[k] - gA); if (e < bs) { bs = e; kg = k; } }
  const free = d[kg] >= 0.85 * look && d[Math.max(0, kg - 1)] >= 0.6 * look && d[Math.min(NR - 1, kg + 1)] >= 0.6 * look;
  let pick = kg;
  if (!free) {
    let best = -9;
    for (let k = 0; k < NR; k++) {
      // a ray beside a blocked one is a narrow way: the car has to swing through it, so its room counts for less
      let e = d[k]; if (k > 0 && d[k - 1] * 1.5 < e) e = d[k - 1] * 1.5; if (k < NR - 1 && d[k + 1] * 1.5 < e) e = d[k + 1] * 1.5;
      const s = Math.min(1, e / look) - 0.4 * Math.abs(ANG[k] - gA) / 1.57 + (k === A.pick ? 0.1 : 0);
      if (s > best) { best = s; pick = k; }
    }
    // a tie between the two sides: keep to the road
    if (!G.arena.active && A.hold <= 0) {
      const o = NR - 1 - pick;
      if (o !== pick && Math.abs(d[o] - d[pick]) < 0.08 * look && Math.abs(ANG[o] - gA) < 0.9) {
        const R = G.world.roads, bx = v.pos.x + (fx * COS[pick] + rx * SIN[pick]) * look * 0.5, bz = v.pos.z + (fz * COS[pick] + rz * SIN[pick]) * look * 0.5;
        const ox = v.pos.x + (fx * COS[o] + rx * SIN[o]) * look * 0.5, oz = v.pos.z + (fz * COS[o] + rz * SIN[o]) * look * 0.5;
        if (R.nearest(ox, oz, 1, false).dist < R.nearest(bx, bz, 1, false).dist) pick = o;
      }
    }
  }
  A.pick = pick;
  A.free = d[pick];
  A.fwdFree = Math.min(d[2], d[MID], d[4]);
  // gentle while the thing is still far, full lock only when it is close
  if (!jump && !free) c.steer = Math.max(-1, Math.min(1, ANG[pick] * (1.1 + 2.6 * Math.max(0, 1 - A.fwdFree / look))));

  // -- speed: able to stop inside the free distance, and to turn away inside the distance ahead
  let vmax = 99;
  if (!jump) {
    vmax = Math.sqrt(2 * BRAKE * Math.max(0, A.free - 3)) + 2.5;
    if (A.fwdFree < 0.95 * look && pick !== MID) vmax = Math.min(vmax, Math.sqrt((TURN_G * Math.max(0, A.fwdFree - 2.5)) / Math.max(0.35, Math.abs(SIN[pick]))) + 2.5);
  }
  A.vmax = vmax;
  if (speed > vmax) { c.throttle = 0; c.brake = speed > vmax + 2 ? 1 : 0.4; c.turbo = false; c.handbrake = false; }

  // -- stuck: no 10 m of progress for 2 s -> back out toward the open side; 5 s -> the nearest safe point.
  // The anchor only moves once the car is 10 m from it, so backing out and driving at the same wall again does
  // not clear the clock. A car that is not trying to move (parked, at its goal, held at a low maxSpeed) resets it.
  const parked = dGoal < 3 || (opt.maxSpeed > 0 && opt.maxSpeed < 4);
  // slow = trying to move (forward or backing out) yet under 1.5 m/s forward
  const fs = v.vel.x * fx + v.vel.z * fz; // forward speed (negative while backing)
  if ((want > 0.3 || b.reverse > 0) && !parked && fs < 1.5) A.slowT += dt; else A.slowT = Math.max(0, A.slowT - 1.5 * dt);
  if (want <= 0.3 && b.reverse <= 0 || parked) { A.pT = 0; A.px = v.pos.x; A.pz = v.pos.z; A.slowT = 0; }
  else if (fs > 4 || Math.hypot(v.pos.x - A.px, v.pos.z - A.pz) >= PROGRESS) { A.pT = 0; A.px = v.pos.x; A.pz = v.pos.z; } // driving, or 10 m from where it was
  else A.pT += dt;
  if (A.pT >= STUCK_REVERSE) {
    let crowd = false; // another car this close is a ram or a pile-up: back out, but do not teleport it away early
    for (let i = 0; i < G.vehicles.length; i++) { const o = G.vehicles[i]; if (o !== v && o.alive && Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z) < 7) { crowd = true; break; } }
    A.crowd = crowd;
    // 5 s inside 10 m and never driving forward above 4 m/s (a slow circle or a back-and-forth is no progress)
    if (A.pT >= (crowd ? 4 : 1) * STUCK_RESPAWN && respawn(v, A, b)) return true;
    if (A.pT >= A.nextRev && b.reverse <= 0 && speed < 3 && A.slowT >= STUCK_REVERSE - 0.3) {
      A.nextRev = A.pT + REVERSE_FOR + 1; A.stuckEv++;
      let s = 0; for (let k = 0; k < NR; k++) s += (k > MID ? 1 : k < MID ? -1 : 0) * d[k];
      A.side = s >= 0 ? 1 : -1; A.rear = 99;
      b.reverse = REVERSE_FOR; A.hold = 1.2;
    }
  } else A.nextRev = STUCK_REVERSE;
  // cornered (every way close and nearly stopped): do not wait the full 2 s to back out
  if (speed < 2.5 && A.free < 4 && A.fwdFree < 4 && !parked) A.corner += dt; else A.corner = 0;
  if (A.corner > 0.8 && b.reverse <= 0) {
    A.corner = 0; A.stuckEv++;
    let s = 0; for (let k = 0; k < NR; k++) s += (k > MID ? 1 : k < MID ? -1 : 0) * d[k];
    A.side = s >= 0 ? 1 : -1; A.rear = 99; b.reverse = REVERSE_FOR; A.hold = 1.2;
  }

  if (b.reverse > 0) {
    b.reverse -= dt;
    if (A.rear < 2.5 && speed > 1) b.reverse = 0; // the back is against something too: go forward and turn
    else { c.throttle = 0; c.brake = 1; c.steer = -A.side; c.handbrake = false; c.turbo = false; }
  } else if (A.hold > 0) { // right after backing out: swing toward the open side before returning to the goal
    A.hold -= dt;
    if (A.fwdFree > 12) A.hold = 0; else { c.steer = A.side; c.throttle = Math.min(c.throttle, 0.6); c.turbo = false; }
  }
  return true;
}

// After every driver has run (some set the turbo or throttle after driveTo): keep a car that must brake from
// accelerating into the thing. Called each fixed step from the round-15 control layer.
export function avoidPost(game) {
  bindAvoid(game); // only the running game's loop gets here, so a disposed twin (React dev double mount) never keeps the binding
  if (!ON) return;
  const vs = G.vehicles, now = G.time;
  for (let i = 0; i < vs.length; i++) {
    const v = vs[i], b = v.brain, A = b && b.av;
    if (!A || A.t !== now || !v.alive || A.vmax > 90) continue;
    if (v.vel.length() > A.vmax) { v.ctl.turbo = false; v.ctl.throttle = 0; }
  }
}

export function unbindAvoid(game) { if (G === game) G = null; }
export const avoidStats = (v) => { const A = v.brain && v.brain.av; return A ? { respawns: A.resp, stuck: A.stuckEv } : null; };
