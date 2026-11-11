// Drives AI cars round a race track: reads each car into track terms, asks race/raceBrain.js what to do, writes the
// car's controls. Also backs a car out when it is stopped against something and puts it back on the road when it
// has left the track or fallen into a gap.
import * as THREE from "three";
import { placeVehicle } from "@/game/vehicles/vehicle";
import { planDrive } from "@/game/race/raceBrain";

const fwd = new THREE.Vector3();
const LANES = [0, 1.4, -1.4, 0.7, -0.7];

export function createRaceDriver(game, track, line) {
  const mem = new Map(); // car -> where it is and what it remembers

  function read(v) {
    let m = mem.get(v);
    if (!m) mem.set(v, (m = { hint: -1, st: {}, bias: LANES[mem.size % LANES.length], s: 0, d: 0, along: 0, offT: 0, stillT: 0, reverse: 0 }));
    const at = track.locate(v.pos.x, v.pos.z, m.hint), p = track.samples[at.i];
    m.hint = at.i; m.d = at.d;
    m.s = track.closed ? ((at.s % track.length) + track.length) % track.length : at.s;
    m.along = v.vel.x * p.tx + v.vel.z * p.tz;
    return m;
  }

  function reset(v) {
    const m = mem.get(v) || read(v), pose = track.resetPose(m.s);
    placeVehicle(v, pose.x, pose.y + 1.2, pose.z, pose.heading);
    m.hint = track.idx(Math.round(pose.s / track.step)); m.offT = 0; m.stillT = 0; m.reverse = 0; m.st = {}; // keeps its level where roads are stacked
    game.particles.dust(pose.x, pose.y + 0.3, pose.z, 0, 0, 2.2);
  }

  return {
    /** Once a step, before drive(): where every car on the track is (racers, the player, wrecks). */
    locate(cars) { for (const v of cars) read(v); },
    where: (v) => mem.get(v) || read(v),
    forget(v) { mem.delete(v); },
    /** A racer's new car takes over where its wrecked one was (lane, place on the lap). */
    adopt(v, old) { const o = mem.get(old); mem.delete(old); if (o) mem.set(v, { ...o, st: {}, offT: 0, stillT: 0, reverse: 0, stuck: 0 }); },
    reset,
    /** Write car v's controls for this step. cars: everything else on the road. skill 0..1. */
    drive(v, dt, cars, skill = 0.6) {
      const m = mem.get(v) || read(v), c = v.ctl, h = v.chassis.hit.half, sp = v.vel.length();
      fwd.set(0, 0, -1).applyQuaternion(v.quat).setY(0).normalize();
      const obs = track.obstacles.slice();
      for (const o of cars) {
        if (o === v) continue;
        const n = mem.get(o);
        if (n) obs.push({ s: n.s, d: n.d, r: (o.chassis.hit.half[0] + o.chassis.hit.half[2]) / 2, v: o.alive ? Math.max(0, n.along) : 0 });
      }
      const car = {
        s: m.s, d: m.d, x: v.pos.x, y: v.pos.y, z: v.pos.z, fx: fwd.x, fz: fwd.z, speed: sp, half: h[0], grounded: v.contacts >= 2,
        vScale: Math.sqrt((v.chassis.grip || 1.15) / 1.15) * (0.8 + 0.22 * skill), vTop: (v.stats.topSpeed / 3.6) * 0.97, bias: m.bias,
      };
      const plan = planDrive(m.st, dt, car, track, line, obs);
      Object.assign(c, { steer: plan.steer, throttle: plan.throttle, brake: plan.brake, turbo: plan.turbo && v.turbo > 0.05, handbrake: false, pitch: 0 });

      // Stopped against something: back out. Off the track or still stuck: back on the road.
      m.stillT = sp < 1.5 && m.reverse <= 0 ? m.stillT + dt : Math.max(0, m.stillT - dt);
      if (m.stillT > 1.4) { m.reverse = 1.2; m.stuck = (m.stuck || 0) + 1; m.stillT = 0; }
      if (m.reverse > 0) { m.reverse -= dt; Object.assign(c, { throttle: 0, brake: 1, steer: -plan.steer, turbo: false }); }
      if (sp > 8) m.stuck = 0;
      m.offT = plan.off ? m.offT + dt : 0;
      if (m.offT > 1.2 || m.stuck >= 3) { m.stuck = 0; reset(v); }
      return plan;
    },
  };
}