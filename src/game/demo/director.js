// Demo-reel camera director: timed cuts between chase / low / high / flyby / orbit, overridden by the action —
// trackside on turbo jumps, orbit on wrecks, parts flying off and explosions near the car.
import { DEMO } from "@/game/data/tuning";
import { newShot, applyShot } from "@/game/replay/shots";

const CYCLE = ["chase", "low", "flyby", "high", "chase", "orbit", "low"];
// An aircraft is bigger and faster than a car, so its chase / low / high cuts stand further off: the game's own
// flight camera, and slow orbits that follow it.
const AIR_SHOTS = {
  chase: ["aircam"],
  low: ["orbit", { follow: true, radius: 26, height: 4, speed: 0.45 }],
  high: ["orbit", { follow: true, radius: 36, height: 20, speed: 0.2 }],
};

export function createDirector(game) {
  const d = { shot: null, until: 0, prio: 0, t: 0, i: 0, seen: { wreck: 0, part: 0, blast: 0 } };

  function cut(kind, dur, prio, o) {
    if (game.player.air && AIR_SHOTS[kind]) [kind, o] = AIR_SHOTS[kind].length > 1 ? AIR_SHOTS[kind] : [AIR_SHOTS[kind][0], o];
    else if (game.player.air && kind === "orbit" && o && o.follow) o = { ...o, radius: Math.max(o.radius || 0, 24) };
    d.shot = newShot(kind === "aircam" ? "chase" : kind, game.world, game.player.mesh.root, o);
    d.shot.kind = kind;
    d.until = d.t + dur; d.prio = prio;
  }
  const fresh = (ev, key, range) => {
    const p = game.player;
    if (!ev || ev.time === d.seen[key] || game.time - ev.time > 0.35 || ev.pos.distanceTo(p.pos) > range) return false;
    d.seen[key] = ev.time;
    return true;
  };

  d.reset = () => { d.shot = null; d.until = 0; d.prio = 0; };
  // Scripted cut (a scene's cue): kind, seconds, optional shot options and priority (3 holds off blasts and parts).
  d.cut = (kind, dur, o, prio = 3) => cut(kind, dur, prio, o);

  // Owns the camera every frame while the reel runs.
  d.update = (dt) => {
    d.t = game.time; // the sim clock: cuts keep pace with the scene script even when frames are slow
    const p = game.player, root = p.mesh.root;
    if (fresh(game.lastWreck, "wreck", 90)) cut("orbit", 3.6, 3, { at: game.lastWreck.pos, fixed: true, radius: 15, speed: 0.45 });
    else if (d.prio < 3 && fresh(game.lastBlast, "blast", 70)) cut("orbit", 2.6, 2, { at: game.lastBlast.pos, fixed: true, radius: 16, speed: 0.6 });
    else if (d.prio < 2 && fresh(game.lastPartOff, "part", 60)) cut("orbit", 2.4, 2, { at: game.lastPartOff.pos, fixed: true, radius: 11, speed: 0.8 });
    else if (d.prio < 2 && !p.grounded && p.airTime > 0.25 && p.vel.length() > 14) cut("trackside", 3.2, 2, { lead: Math.min(42, p.vel.length() * 1.1), offset: 12 });
    if (d.shot && d.shot.kind === "trackside" && d.prio === 2 && p.grounded && d.shot.t > 1.4) d.until = Math.min(d.until, d.t);
    if (!d.shot || d.t >= d.until) {
      const kind = CYCLE[d.i++ % CYCLE.length];
      cut(kind, DEMO.cutMin + Math.random() * (DEMO.cutMax - DEMO.cutMin), 0, kind === "orbit" ? { radius: 12, speed: 0.4, follow: true } : undefined);
    }
    if (d.shot.kind === "aircam" && game.air.active()) game.air.camera(dt, game.time);
    else applyShot(game.camera, game.world, d.shot, root, dt);
  };
  d.kind = () => (d.shot ? d.shot.kind : "none");
  return d;
}