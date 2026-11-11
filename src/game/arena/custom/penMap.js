// The pen: one empty walled arena (built once, on its own site) that data maps are laid into. Your own maps from
// the map builder and the Wreck Race tracks all play here; loading a map clears the last one's pieces first.
import { findSites } from "@/game/arena/site";
import { buildShell, toWorldPoints } from "@/game/arena/shell";
import { createField } from "@/game/arena/custom/field";
import { cleanMap, layoutOf } from "@/game/arena/custom/mapData";

export function createPen(game) {
  let ctx = null, field = null;
  return {
    // Returns the map entry the arena controller uses (same shape as a built-in arena's).
    load(data) {
      if (!ctx) {
        ctx = buildShell(game, findSites(game.world).pen, { floor: game.M.concrete, wall: game.M.corrugated, ramp: game.M.rust });
        ctx.kit.finalize();
        field = createField(game);
      }
      const map = cleanMap(data), L = layoutOf(map), W = (list) => toWorldPoints(ctx, list);
      field.set(ctx, map);
      return { ctx, name: map.name, laps: map.laps, pieces: field.count(), cps: W(L.checkpoints), power: W(L.power), spawns: W(L.spawns), horde: W(L.horde), props: W(L.props) };
    },
    clear() { if (field) field.clear(); },
  };
}