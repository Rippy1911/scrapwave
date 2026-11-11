// Physics ground for the Ashmark: one Rapier heightfield per 250 m tile, alive only around simulated vehicles
// (the streamer decides which). Heights are the tile's detail 0 grid, so wheels sit on the triangles on screen.
// world() returns the Rapier world (null until the physics module is ready); nothing here edits vehicles/rapier.js.
import { RAPIER } from "@/game/vehicles/rapier";
import { PHYSICS } from "@/game/data/tuning";
import { ASH, tileX0, tileZ0 } from "@/game/maps/ashmark/layout";
import { CELLS } from "@/game/maps/ashmark/tileData";

export function createTileColliders(world) {
  const live = new Map(); // tile key -> collider
  let made = 0, freed = 0;
  return {
    ready: () => !!world(),
    has: (key) => live.has(key),
    /** heights: tileData.tileHeights (65 x 65, columns along x). Returns false while physics is not ready. */
    add(key, i, j, heights) {
      const R = world();
      if (!R) return false;
      if (live.has(key)) return true;
      const n = CELLS[0], S = ASH.tile;
      const desc = RAPIER.ColliderDesc.heightfield(n, n, heights, { x: S, y: 1, z: S }, RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES)
        .setTranslation(tileX0(i) + S / 2, 0, tileZ0(j) + S / 2)
        .setFriction(PHYSICS.groundFriction).setRestitution(PHYSICS.groundRestitution);
      live.set(key, R.createCollider(desc));
      made++;
      return true;
    },
    remove(key) {
      const c = live.get(key), R = world();
      if (!c) return;
      if (R) R.removeCollider(c, true);
      live.delete(key);
      freed++;
    },
    clear() { for (const k of Array.from(live.keys())) this.remove(k); },
    stats: () => ({ live: live.size, made, freed }),
  };
}