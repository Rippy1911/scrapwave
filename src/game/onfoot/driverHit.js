// A shot through the cabin glass hurts the driver. The light hull damage is paid by footShots.js; this file decides
// whether a hit went through the glass and what it does to whoever is at the wheel:
//  - any AI car on this browser: the driver ducks, so no throttle, steering or weapons for the weapon's stun time;
//  - a Rattler (not a base raider) whose driver runs out of health is dead: the car is left empty and unlocked,
//    which makes it a FREE car anyone can take (onfoot/freeVehicles.js parks it and clears it away later).
// Cars driven by other players are left alone: their own browser owns them.
import { addFreeMarker } from "@/game/onfoot/freeMarker";

export const DRIVER_HP = 100;

// The glass: the upper part of the hit box. Over the middle of the car's length that is the side windows; nearer
// the ends (a shot from dead ahead or behind lands on the end of the box) it is the windscreen or the rear glass,
// which starts higher, above the bonnet.
export function throughGlass(v, point) {
  const [, hy, hz] = v.chassis.hit.half, c = v.chassis.hit.center;
  const l = point.clone().sub(v.pos).applyQuaternion(v.quat.clone().invert());
  const up = (l.y - c[1]) / hy, along = Math.abs(l.z - c[2]) / hz;
  return up > (along < 0.55 ? 0.15 : 0.4);
}

// Returns "none" | "hurt" | "dead".
export function hurtDriver(game, v, dmg, stun) {
  if (v.remote || v.empty || v === game.player || !v.alive) return "none";
  v.driverHp = (v.driverHp ?? DRIVER_HP) - dmg;
  v.stunT = Math.max(v.stunT || 0, stun);
  if (v.driverHp > 0) return "hurt";
  if (v.team !== "rattler" || !v.brain || v.brain.raid) { v.driverHp = 1; return "hurt"; } // other crews only duck
  const pack = v.brain.pack, i = pack ? pack.members.indexOf(v) : -1;
  if (i >= 0) pack.members.splice(i, 1); // the pack goes on without it
  v.stunT = 0;
  v.free = { kind: v.chassisId, taken: true };
  if (!v.freeMarker) addFreeMarker(v);
  game.onfoot.free.leave(v); // empty, parked, team "free": the AI lets go of it and anyone can get in
  return "dead";
}

// After every controller and before physics reads the controls: a ducking driver does nothing.
export function stunStep(game, dt) {
  for (const v of game.vehicles) {
    if (!(v.stunT > 0)) continue;
    v.stunT -= dt;
    Object.assign(v.ctl, { throttle: 0, steer: 0, turbo: false, fire: false, rockets: false, harpoon: false });
  }
}