// Switching cars. At most one of your own garage cars is out at a time: rolling out another (spawn screen or
// summon) sends the parked one back to the garage. Leaving a free car abandons it (it despawns later); leaving
// your own car parks it. Empty cars (v.empty) are ignored by every targeting system (see onfoot.js).
import { removeVehicle } from "@/game/vehicles/vehicle";

export function createRides(game, free) {
  let parkedOwn = null;

  const inWorld = (v) => !!v && game.vehicles.includes(v);
  function removeCar(v) {
    const i = game.vehicles.indexOf(v);
    if (i >= 0) { game.vehicles.splice(i, 1); removeVehicle(game, v); }
    if (parkedOwn === v) parkedOwn = null;
  }
  function park(v) {
    v.empty = true;
    Object.assign(v.ctl, { throttle: 0, brake: 0, steer: 0, handbrake: true, turbo: false, fire: false, rockets: false, harpoon: false });
  }

  // The car you are leaving for another: wrecks go (as a wreck always did on respawn), free cars are abandoned,
  // your own car stays parked where it is.
  function retire(old, next) {
    if (!inWorld(old)) return;
    if (!old.alive) { removeCar(old); return; }
    if (old.free) { free.leave(old); return; }
    if (parkedOwn && parkedOwn !== old && parkedOwn !== next) removeCar(parkedOwn); // never the car being got into
    park(old);
    parkedOwn = old;
  }

  const rides = {
    parked: () => (inWorld(parkedOwn) ? parkedOwn : null),
    park,
    // Make v the player's car (it may already be).
    drive(v) {
      const old = game.player;
      if (old !== v) retire(old, v);
      if (v.free) free.take(v);
      v.empty = false; v.summoned = false; v.ctl.handbrake = false;
      if (parkedOwn === v) parkedOwn = null;
      game.adoptPlayer(v);
      return v;
    },
    // A garage car rolling out at pose ({ x, y, z, heading, vx, vz }); any other garage car out goes home.
    rollOut(chassis, pose) {
      if (inWorld(parkedOwn) && parkedOwn !== game.player) removeCar(parkedOwn);
      parkedOwn = null;
      const v = game.buildOwnedCar(pose, chassis);
      v.vel.set(pose.vx || 0, 0, pose.vz || 0);
      v.rollT = pose.vx || pose.vz ? 1.6 : 0; // coasts out of the garage door, then the handbrake goes on
      return v;
    },
    // Summoned: rolls out and waits, empty, for you to walk over and get in.
    summon(chassis, pose) {
      const v = rides.rollOut(chassis, pose);
      v.summoned = true;
      park(v);
      v.ctl.handbrake = !v.rollT;
      parkedOwn = v;
      return v;
    },
    step(dt) {
      for (const v of game.vehicles) {
        if (!v.rollT) continue;
        v.rollT -= dt;
        if (v !== game.player || v.empty) v.ctl.handbrake = v.rollT <= 0;
        if (v.rollT <= 0) v.rollT = 0;
      }
    },
    reset() { if (inWorld(parkedOwn) && parkedOwn !== game.player) removeCar(parkedOwn); parkedOwn = null; },
  };
  return rides;
}