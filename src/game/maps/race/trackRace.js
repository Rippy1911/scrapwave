// Wreck Race on a race world: the same shape as the ring race (arena/race.js) so the arena can swap one for the
// other, but run by the track tools (game.tracks): lap clock, checkpoint gates, places, the ghost, and AI cars that
// drive the race line. A wrecked car comes back on the road where it was. First over the line wins.
export function createTrackRace(game) {
  let on = false, opp = null;
  const T = () => game.tracks;
  const R = {
    tracked: true, // arena/opponents.js: the track tools steer the AI cars
    start(points, laps, checkpoints, opponents) { opp = opponents; T().start([], game.arena.rules.aiSkill, laps); on = true; },
    stop() { if (on) T().stop(); on = false; },
    on: () => on,
    /** Opponent slot i has a (new) car. */
    join(i, v) { if (on) T().setCar(i, v, game.arena.rules.aiSkill); },
    goal: () => null,
    back: (i) => (!on ? null : i < 0 ? T().playerPose() : T().racerPose(i)),
    step() {
      const f = on ? T().finished() : [];
      if (!f.length) return null;
      return f[0].v === game.player ? { won: true, reason: "first over the line" } : { won: false, reason: `${f[0].v.name} took the flag`, title: "BEATEN" };
    },
    place: () => (on ? T().place() : 1),
    field: () => 1 + (opp ? opp.total() : 0),
    lapText: () => { const h = on && T().hud(); return h ? `${h.lap}/${h.laps}` : ""; },
    state: () => ({ on, track: true, ...((on && T().hud()) || {}), map: undefined }),
  };
  return R;
}