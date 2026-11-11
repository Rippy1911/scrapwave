// window.scrapwake.big: test hooks for the Ashmark Expanse.
//   big.state()            biome at the player, tile coordinates, tiles loaded (and per detail level), colliders live,
//                          tile build ms (last, max, budget), draw calls, heap (MB, Chrome only), frame ms, rescues
//   big.enter("ashmark")   switch to the Ashmark and put the car on the flats; big.leave() goes back to the Saltreach
//   big.teleport(to)       a biome ("city" | "spine" | "dunes" | "marsh" | "waste"), a place id from big.places()
//                          ("tower", "dam", "span", "g-city", ...) or { x, z } in map coordinates (centre = 0, 0)
//   big.spots()            the named biome spots; big.height(x, z) the ground height at a map point
//   big.places()           every place: id, kind, biome, name, map x and z, ground height
//   big.roads()            road meshes (total, shown), total km and one row per road: kind, km, steepest grade, bridge
//   big.sites()            the places built right now: ids, meshes, triangles, colliders, build ms (last, max)
//   big.life()             scatter and wildlife counts, outposts in reach (ashmark/life.js), once those are running
//   big.resetMax()         clears the build-ms maximum and the rescue count; big.check() the ?bigcheck=1 report
import { ASH, SPOTS, BIOME_NAME } from "@/game/maps/ashmark/layout";
import { mapHeight } from "@/game/maps/ashmark/height";
import { layRoads, roadStats } from "@/game/maps/ashmark/roads";

export function bigHooks(game) {
  const B = game.big;
  return {
    state: () => B.state(),
    enter(id = "ashmark") { B.enter(id); return B.teleport("waste"); },
    leave() { B.leave(); game.startIntro(false); return B.state(); },
    teleport: (to = "waste") => B.teleport(to),
    spots: () => Object.fromEntries(Object.entries(SPOTS).map(([k, s]) => [k, { name: BIOME_NAME[k], x: s[0][0], z: s[0][1] }])),
    places: () => [...layRoads().sites.values()].map((s) => ({ id: s.id, kind: s.kind, biome: s.biome, name: s.name, x: Math.round(s.x), z: Math.round(s.z), y: +s.y.toFixed(1) })),
    roads() { const table = roadStats(); return { meshes: B.roads(), km: +table.reduce((a, r) => a + r.km, 0).toFixed(2), table }; },
    sites: () => B.sites(),
    life: () => (B.life ? B.life() : null),
    height: (x, z) => +mapHeight(x, z).toFixed(2),
    resetMax() { B.resetMax(); return B.state().buildMs; },
    check: () => game.bigReport || null,
    size: ASH.size,
  };
}