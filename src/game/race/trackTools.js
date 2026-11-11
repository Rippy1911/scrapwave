// game.tracks: the race track tools in one place (round 15, section D). open(def) lays a track from a list of points
// (road, barriers, kerbs, gates, colliders), finds the obstacles on it and plans the AI race line. start(cars) runs a
// race on it: the player's lap clock and best lap, the ghost of the best lap, the AI drivers and everyone's place.
// The race worlds call this; nothing here knows about a particular track.
import { buildTrack } from "@/game/race/track";
import { buildTrackMesh } from "@/game/race/trackMesh";
import { buildRaceLine } from "@/game/race/raceLine";
import { scanObstacles } from "@/game/race/obstacles";
import { createRaceDriver } from "@/game/race/raceDriver";
import { createLapTimer, lapText } from "@/game/race/lapTimer";
import { createGhost } from "@/game/race/ghost";
import { loadBest, saveBest } from "@/game/race/bestLap";

export function createTrackTools(game) {
  let cur = null; // the open track and, while a race runs, its clocks

  // The lap from above for the HUD map: built once per track.
  const mapOf = (t) => ({
    id: t.id, bounds: t.bounds, closed: t.closed,
    pts: t.samples.filter((p, i) => i % 2 === 0).map((p) => [p.x, p.z, p.gap ? 1 : 0, p.w]),
    cps: t.checkpoints.map((c) => ({ x: c.x, z: c.z, nx: c.nx, nz: c.nz, w: c.w })),
  });
  const cars = () => [game.player, ...cur.racers.map((r) => r.v)];

  function playerEvent(e) {
    const p = game.player, T = cur.timer;
    if (e.type === "checkpoint") return;
    if (e.best && !game.noSave) {
      cur.best = { time: e.time, splits: T.bestSplits, car: p.chassis.name, ghost: cur.ghost.take() };
      saveBest(cur.track.id, cur.best);
      cur.ghost.show(cur.best.ghost, p);
    }
    cur.ghost.begin();
    if (e.type === "finish") { cur.finished.push({ v: p, total: e.total }); cur.ghost.hide(); game.callout("FINISH", lapText(e.total), "#f2c230"); }
    else game.callout(e.best ? "BEST LAP" : `LAP ${e.lap}/${T.laps}`, lapText(e.time), e.best ? "#7fe0a0" : "#f2c230");
  }

  const api = {
    /** Lay a track. def: race/track.js. ground(x, z): the height under it. Returns the track. */
    open(def, { ground = null, laps = 3, fall = 0 } = {}) { // fall: this far under the road, the player is put back on it
      api.close();
      const track = buildTrack(def, { ground }), mesh = buildTrackMesh(game, track);
      track.obstacles = scanObstacles(track, game.world.colliders);
      const line = buildRaceLine(track);
      cur = { track, line, mesh, laps, fall, map: mapOf(track), driver: createRaceDriver(game, track, line), ghost: createGhost(game), best: loadBest(track.id), timer: null, racers: [], finished: [], on: false };
      return track;
    },
    /** After props are put on the road: find the obstacles again. */
    rescan() { if (cur) cur.track.obstacles = scanObstacles(cur.track, game.world.colliders); },
    /** GO: start the clocks. aiCars: cars already on the grid for the AI to drive. skill 0..1. */
    start(aiCars = [], skill = 0.6, laps = cur.laps) {
      cur.laps = laps;
      cur.timer = createLapTimer(cur.track, cur.laps, cur.best);
      cur.racers = aiCars.map((v) => ({ v, timer: createLapTimer(cur.track, cur.laps), skill }));
      cur.finished = []; cur.on = true;
      cur.ghost.begin(); cur.ghost.show(cur.best && cur.best.ghost, game.player);
      cur.mesh.gates.setNext(cur.timer.next);
    },
    /** Racer k drives car v from now on (its first car, or a new one after a wreck): its laps carry over. */
    setCar(k, v, skill = 0.6) {
      const r = cur.racers[k];
      if (r) { cur.driver.adopt(v, r.v); r.v = v; r.skill = skill; } else cur.racers[k] = { v, timer: createLapTimer(cur.track, cur.laps), skill };
    },
    /** Where racer k / the player comes back after a wreck: on the road where the car was (null before the start). */
    racerPose(k) { const r = cur.racers[k]; return r ? cur.track.resetPose(cur.driver.where(r.v).s) : null; },
    playerPose() { return cur.timer && cur.timer.passed > 0 ? cur.track.resetPose(cur.driver.where(game.player).s) : null; },
    stop() { if (cur) { cur.on = false; cur.ghost.hide(); cur.mesh.gates.setNext(-1); } },
    close() { if (!cur) return; cur.mesh.dispose(); cur.ghost.dispose(); cur = null; },
    active: () => !!cur && cur.on,
    track: () => (cur ? cur.track : null),
    line: () => (cur ? cur.line : null),
    grid: (k) => cur.track.grid(k),
    /** Put a car back on the road where it left it (the player's reset, a respawn). */
    backOnTrack(v) { cur.driver.reset(v); },
    /** Cars in finishing order so far: [{ v, total }]. */
    finished: () => (cur ? cur.finished : []),
    place() {
      const mine = cur.timer.progress(cur.driver.where(game.player).s);
      return 1 + cur.racers.filter((r) => r.timer.done || r.timer.progress(cur.driver.where(r.v).s) > mine).length;
    },

    control(dt) {
      if (!cur || !cur.on) return;
      const all = cars();
      cur.driver.locate(all);
      for (const r of cur.racers) if (r.v.alive && !r.timer.done) cur.driver.drive(r.v, dt, all, r.skill);
    },
    step(dt) {
      if (!cur || !cur.on) return;
      const p = game.player, T = cur.timer;
      if (!T.done) {
        cur.ghost.sample(T.lapT, p);
        const was = T.next, e = T.step(dt, p.pos.x, p.pos.z, p.pos.y - 1);
        if (T.next !== was) cur.mesh.gates.setNext(T.done ? -1 : T.next);
        if (e) playerEvent(e);
      }
      for (const r of cur.racers) {
        const e = r.v.alive && r.timer.step(dt, r.v.pos.x, r.v.pos.z, r.v.pos.y - 1);
        if (e && e.type === "finish") cur.finished.push({ v: r.v, total: e.total });
      }
      if (cur.fall && p.alive) { // off the road and falling: back on it
        const m = cur.driver.where(p);
        if (p.pos.y < cur.track.samples[Math.max(0, m.hint)].y - cur.fall) cur.driver.reset(p);
      }
    },
    frame() { if (cur && cur.on && cur.timer && !cur.timer.done) cur.ghost.frame(cur.timer.lapT); },
    hud() {
      if (!cur || !cur.on) return null;
      const T = cur.timer, p = game.player, m = cur.driver.where(p), s = cur.track.samples[m.hint < 0 ? 0 : m.hint];
      return {
        name: cur.track.name, map: cur.map, lap: T.lap, laps: T.laps, lapT: T.lapT, last: T.last, best: T.best, delta: T.delta, isBest: T.isBest,
        done: T.done, total: T.total, next: T.done ? -1 : T.next, place: api.place(), field: 1 + cur.racers.length,
        wrongWay: p.vel.x * s.tx + p.vel.z * s.tz < -4, ghost: cur.ghost.pos(),
        cars: cur.racers.filter((r) => r.v.alive).map((r) => ({ x: r.v.pos.x, z: r.v.pos.z })),
      };
    },
    dispose() { api.close(); },
  };
  return api;
}