// The deck every world map stands on (round 15): a level floor high above the free-roam world, so the Saltreach
// stays loaded (and hidden) underneath and you come back to it as you left it. Its top clears every hill, building
// and legacy arena fence of the roam world. The site is the open spot farthest from the safe zones, because the
// safe-zone and no-fire checks only look at x and z.
import { WORLD } from "@/game/data/tuning";
import { PLACES } from "@/game/data/places";

let cached = null;
export function deckSite(game) {
  if (cached) return cached;
  const T = game.world.terrain;
  let top = -Infinity;
  for (let x = -WORLD.half; x <= WORLD.half; x += 10) for (let z = -WORLD.half; z <= WORLD.half; z += 10) top = Math.max(top, T.heightAt(x, z));
  top += 60; // a legacy arena fence reaches its floor + 57
  for (const b of game.world.colliders.all) {
    const t = b.y + (b.hy || 0);
    if (!b.dead && b.tag !== "arenaFence" && Number.isFinite(t)) top = Math.max(top, t + 12);
  }
  const safe = PLACES.filter((p) => p.safe), lim = WORLD.bound - 200;
  let best = { x: 0, z: 0, d: -Infinity };
  for (let x = -lim; x <= lim; x += 20) for (let z = -lim; z <= lim; z += 20) {
    const d = safe.length ? Math.min(...safe.map((p) => Math.hypot(x - p.x, z - p.z) - p.r - (p.pad || 0))) : 0;
    if (d > best.d) best = { x, z, d };
  }
  return (cached = { x: best.x, z: best.z, y: Math.ceil(top) });
}

const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

// Ground to the horizon, the map floor (with its collider), the ring wall with its hazard band and the invisible
// fence above it, and a ring of far mesas so the edge reads as a landscape and not a cliff.
export function buildDeck(F, M, L, mat) {
  const R = L.R, wallH = L.wallH || 8;
  F.box(mat(L.outer || L.floor), 0, -1.06, 0, 2800, 2, 2800);
  F.box(mat(L.floor), 0, -1, 0, 2 * R + 8, 2, 2 * R + 8);
  F.collider(0, -2, 0, 2 * R + 40, 4, 2 * R + 40, 0, { tag: "arenaFloor" });
  const N = Math.ceil((2 * Math.PI * R) / 14), wall = mat(L.wall);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, w = (2 * Math.PI * (R + 1)) / N + 0.5;
    const x = Math.sin(a) * (R + 1), z = Math.cos(a) * (R + 1);
    F.box(wall, x, wallH / 2, z, w, wallH, 2, a, { collide: true, tag: "arenaWall" });
    F.box(M.hazard, Math.sin(a) * (R - 0.06), wallH - 0.7, Math.cos(a) * (R - 0.06), w, 0.9, 0.12, a);
    F.collider(x, wallH + 25, z, w, 50, 2, a, { noRay: true, tag: "arenaFence" });
  }
  const far = mat(L.horizon);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + hash(i, 1) * 0.3, r = R + 110 + hash(i, 2) * 260, h = 18 + hash(i, 3) * 46, w = 50 + hash(i, 4) * 90;
    F.box(far, Math.sin(a) * r, h / 2 - 1, Math.cos(a) * r, w, h, w * (0.5 + hash(i, 5) * 0.4), a + hash(i, 6));
  }
}