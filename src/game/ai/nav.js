// Road-graph navigation: follow a road spline, switch roads at junctions, steer toward a destination,
// and flag the broken highway-bridge gap (jumpable only east → west with speed).
import * as THREE from "three";

const fwd = new THREE.Vector3();
const JUNCTION = 18;

function reacquire(game, v, b) {
  const n = game.world.roads.nearest(v.pos.x, v.pos.z, 8, true);
  if (!n.road) return null;
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  b.nav = { road: n.road, i: n.i, dir: n.dx * fwd.x + n.dz * fwd.z >= 0 ? 1 : -1 };
  return b.nav;
}

function junction(game, nv, end) {
  for (const r of game.world.roads.roads) {
    if (r === nv.road) continue;
    for (let i = 0; i < r.samples.length; i++) {
      const p = r.samples[i];
      if (p.deck || Math.hypot(p.x - end.x, p.z - end.z) > JUNCTION) continue;
      const a = r.samples[Math.min(r.samples.length - 1, i + 8)], z = r.samples[Math.max(0, i - 8)];
      const da = Math.hypot(a.x - end.x, a.z - end.z), dz = Math.hypot(z.x - end.x, z.z - end.z);
      return { road: r, i, dir: da >= dz ? 1 : -1 };
    }
  }
  return null;
}

// Writes the next road target into `out`. Sets b.gapAhead (metres) when the bridge gap is coming up.
export function followRoad(game, v, b, out, dest = null) {
  let nv = b.nav;
  if (!nv || Math.hypot(nv.road.samples[nv.i].x - v.pos.x, nv.road.samples[nv.i].z - v.pos.z) > 35) nv = reacquire(game, v, b);
  if (!nv) return null;
  const S = nv.road.samples;
  let best = nv.i, bd = Infinity;
  for (let k = -6; k <= 14; k++) {
    const i = nv.i + k * nv.dir;
    if (i < 0 || i >= S.length) continue;
    const dd = (S[i].x - v.pos.x) ** 2 + (S[i].z - v.pos.z) ** 2;
    if (dd < bd) { bd = dd; best = i; }
  }
  nv.i = best;
  if (dest && !b.lockDir) {
    const ahead = S[Math.max(0, Math.min(S.length - 1, nv.i + nv.dir * 25))], back = S[Math.max(0, Math.min(S.length - 1, nv.i - nv.dir * 25))];
    const da = Math.hypot(ahead.x - dest.x, ahead.z - dest.z), dbk = Math.hypot(back.x - dest.x, back.z - dest.z);
    if (dbk + 20 < da) nv.dir *= -1;
  }
  const look = Math.max(5, Math.min(14, Math.round(5 + v.vel.length() * 0.22)));
  let gi = nv.i + nv.dir * look;
  if (gi <= 0 || gi >= S.length - 1) {
    const end = S[gi <= 0 ? 0 : S.length - 1];
    const j = junction(game, nv, end);
    if (j && Math.hypot(end.x - v.pos.x, end.z - v.pos.z) < 40) { b.nav = nv = j; }
    else if (Math.hypot(end.x - v.pos.x, end.z - v.pos.z) < 20) nv.dir *= -1;
    gi = Math.max(0, Math.min(nv.road.samples.length - 1, nv.i + nv.dir * look));
  }
  const T = nv.road.samples;
  out.set(T[gi].x, T[gi].y, T[gi].z);
  // Gap check on the highway: deck samples ahead.
  b.gapAhead = 0;
  if (nv.road.id === "highway") {
    for (let k = 1; k < 45; k++) {
      const i = nv.i + nv.dir * k;
      if (i < 0 || i >= T.length) break;
      if (T[i].deck) { b.gapAhead = k * 4; break; }
    }
  }
  b.gapEastWest = nv.dir === 1;
  return out;
}

// Turn around on the current road (used when the gap can't be jumped).
export function turnAround(b) { if (b.nav) b.nav.dir *= -1; }