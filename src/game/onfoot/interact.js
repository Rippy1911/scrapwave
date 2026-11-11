// What E would use right now on foot: the nearest enterable vehicle (your parked car, a car you summoned, or a
// FREE one nobody is driving) within reach of its side, else the nearest landmark you stand at.
import * as THREE from "three";

const REACH = 2.2;
const qi = new THREE.Quaternion(), l = new THREE.Vector3();

// Metres from point p to the outside of the vehicle's box, on the ground plane.
function boxGap(v, p) {
  const [hx, , hz] = v.chassis.hit.half, c = v.chassis.hit.center;
  qi.copy(v.quat).invert();
  l.copy(p).sub(v.pos).applyQuaternion(qi);
  const dx = Math.max(0, Math.abs(l.x - c[0]) - hx), dz = Math.max(0, Math.abs(l.z - c[2]) - hz);
  return Math.hypot(dx, dz);
}

// Yours (the one you left, a summoned one, another of your own parked out here) or a FREE one nobody is driving.
// A car whose driver was shot through the glass is a FREE car from then on (driverHit.js): unlocked, anyone's.
export const canEnter = (game, v) => v.alive && !v.remote && !!v.mesh.root.parent && (v === game.player || v.summoned || ((v.free || v.owned) && v.empty));

export function vehicleLabel(game, v) {
  if (v === game.player && !v.free) return `Get in · your ${v.stats.name}`;
  return v.free ? `Get in · FREE ${v.stats.name}` : `Get in · ${v.stats.name}`;
}

export function nearestUse(game, pos, landmarks) {
  let best = null, bd = REACH;
  for (const v of game.vehicles) {
    if (v.pos.distanceToSquared(pos) > 100 || !canEnter(game, v)) continue;
    const d = boxGap(v, pos);
    if (d < bd) { bd = d; best = { kind: "vehicle", v, label: vehicleLabel(game, v) }; }
  }
  if (best) return best;
  let lb = null, ld = Infinity;
  for (const m of landmarks) {
    const d = Math.hypot(m.x - pos.x, m.z - pos.z);
    if (d < m.r && d < ld) { ld = d; lb = m; }
  }
  return lb ? { kind: "landmark", m: lb, label: `${lb.verb} · ${lb.name}` } : null;
}