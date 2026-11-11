// Wreck Race (round 13): laps round the arena's rings against the AI cars. Guns, rams and traps all stay live; a
// wrecked car comes back at the last ring it passed. First over the line wins, so an AI finishing first ends the
// match as a loss. The player's rings are the arena's checkpoint rings (reset every lap); each AI car counts its own.
export function createRace(game) {
  let cps = [], laps = 1, mine = 0, on = false, rings = null, opp = null;
  const ai = new Map(); // opponent slot -> rings passed since the start
  const n = () => cps.length;
  const count = () => mine * n() + rings.next; // rings the player has passed
  const gap = (pos, c) => { const p = cps[c % n()]; return Math.hypot(pos.x - p.x, pos.z - p.z); };
  // At the last ring passed, facing the next one. null before the first ring (use the grid).
  function poseAt(c) {
    if (c <= 0) return null;
    const a = cps[(c - 1) % n()], b = cps[c % n()];
    return { x: a.x, y: a.y, z: a.z, heading: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
  }

  const R = {
    start(points, lapCount, checkpoints, opponents) { cps = points; laps = lapCount; rings = checkpoints; opp = opponents; mine = 0; ai.clear(); on = n() > 1; },
    stop() { on = false; },
    on: () => on,
    goal: (i) => cps[(ai.get(i) || 0) % n()], // the ring opponent i is heading for
    back: (i) => (on ? poseAt(i < 0 ? count() : ai.get(i) || 0) : null), // respawn pose: i < 0 is the player
    // Once per step, after the player's ring check. Returns { won, reason, title } when the race is decided.
    step() {
      if (!on) return null;
      if (rings.next >= rings.total) {
        mine++;
        if (mine >= laps) return { won: true, reason: "first over the line" };
        rings.set(cps);
        game.callout(`LAP ${mine + 1}/${laps}`, mine + 1 === laps ? "last lap" : null, "#f2c230");
      }
      for (const { i, v } of opp.cars()) {
        if (!v || !v.alive) continue;
        const c = ai.get(i) || 0;
        if (gap(v.pos, c) > 9) continue;
        ai.set(i, c + 1);
        if (c + 1 >= n() * laps) return { won: false, reason: `${v.name} took the flag`, title: "BEATEN" };
      }
      return null;
    },
    // Your place: 1 + the cars with more rings, or the same rings and closer to the next one.
    place() {
      if (!on) return 1;
      const me = count(), myGap = gap(game.player.pos, me);
      let ahead = 0;
      for (const { i, v } of opp.cars()) {
        const c = ai.get(i) || 0;
        if (c > me || (c === me && v && v.alive && gap(v.pos, c) < myGap)) ahead++;
      }
      return 1 + ahead;
    },
    field: () => 1 + (opp ? opp.total() : 0),
    lapText: () => `${Math.min(laps, mine + 1)}/${laps}`,
    state: () => ({ on, laps, lap: Math.min(laps, mine + 1), rings: n(), passed: on ? count() : 0, place: R.place(), field: R.field(), ai: [...ai.entries()].map(([i, c]) => ({ i, passed: c })) }),
  };
  return R;
}