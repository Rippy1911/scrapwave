// On-foot state over the existing net code (round 11). The room server relays only its whitelisted state fields
// (docs/protocol.md), so while you are on foot your car's state carries the scavenger too, with no server change:
//   flags  | 32 on foot, | 64 running, | 128 airborne
//   steer, thr        walker offset from the parked car (x, z metres); the parked car really has 0 steer / throttle
//   aimYaw, aimPitch  walker heading (radians) and speed (m/s)
// The car's own x/y/z/quaternion stay the parked pose, so the parked car keeps showing where it is.
// Receivers (net/remote.js) rebuild { x, y, z, h, s, run, air } and hand it to onfoot/remoteWalkers.js.

export const FOOT_FLAG = 32, RUN_FLAG = 64, AIR_FLAG = 128;
const r2 = (x) => Math.round(x * 100) / 100;

// Adds our scavenger to a packed player state (codec.packState) when we are on foot. Returns the state.
export function packFoot(state, game) {
  if (!game.onfoot || !game.onfoot.active()) return state;
  const w = game.onfoot.walker, car = game.player;
  state.flags = (state.flags | FOOT_FLAG) | (w.running ? RUN_FLAG : 0) | (w.grounded ? 0 : AIR_FLAG);
  state.flags &= ~(2 | 4 | 8); // no weapons from a parked car
  state.steer = r2(w.pos.x - car.pos.x);
  state.thr = r2(w.pos.z - car.pos.z);
  state.aimYaw = r2(w.heading);
  state.aimPitch = r2(w.speed);
  return state;
}

// The walker pose in a remote state relative to that player's car position, or null when they are driving.
export function readFoot(s, carPos, world) {
  const f = s && s.flags;
  if (!(f & FOOT_FLAG)) return null;
  const x = carPos.x + (+s.steer || 0), z = carPos.z + (+s.thr || 0);
  return { x, y: world.groundAt(x, z, carPos.y + 2), z, h: +s.aimYaw || 0, s: +s.aimPitch || 0, run: !!(f & RUN_FLAG), air: !!(f & AIR_FLAG) };
}