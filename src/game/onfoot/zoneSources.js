// The live safe-zone list: the Well-town, every outpost (fuel stations away from town) and the player's own lit
// base plot. The plot stops being a safe zone while it is under a raid (raiders heading for it or siphoning), so
// turrets can still defend it. Arenas have no safe zones.
import { makeZone, zoneAt } from "@/game/onfoot/zones";

export function createZoneSet(game) {
  const w = game.world;
  const fixed = [makeZone("town", "town", "The Well-town", w.town.bank.x, w.town.bank.z)];
  for (const s of w.fuel ? w.fuel.list : []) {
    if (s.town) continue;
    fixed.push(makeZone("out-" + s.id, "outpost", s.name.replace(/ pumps$/, " outpost"), s.x, s.z));
  }
  let plotZone = null, list = fixed, t = 0;
  const set = { version: 0 };

  function raided(plot) {
    return game.vehicles.some((v) => v.alive && v.brain && v.brain.raid === plot.id);
  }

  function refresh() {
    const mine = game.base && game.base.mine ? game.base.mine() : null;
    const want = mine && !mine.dark && !raided(mine) ? mine : null;
    const before = plotZone;
    if (!want) plotZone = null;
    else if (!plotZone || plotZone.plotId !== want.id) plotZone = { ...makeZone("plot", "plot", want.name, want.x, want.z), plotId: want.id };
    if (before !== plotZone) set.version++;
    list = plotZone ? [...fixed, plotZone] : fixed;
  }

  set.step = (dt) => {
    t -= dt;
    if (t <= 0) { t = 0.5; refresh(); }
  };
  set.list = () => (game.arena && game.arena.active ? [] : list);
  set.all = () => list; // ignoring the arena (spawn points)
  set.byId = (id) => list.find((z) => z.id === id) || null;
  set.at = (x, z, margin = 0) => zoneAt(set.list(), x, z, margin);
  set.refresh = refresh;
  refresh();
  return set;
}