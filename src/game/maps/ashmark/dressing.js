// What dresses the Ashmark beyond its ground, roads and built places, as one round-15 part (game/round15.js): the
// ground scatter (scatter.js), the working garages and toll gate (outposts.js) and the look of each biome (look.js).
// This file makes them the first time the Ashmark is the active world, runs them while it is, and switches them
// off when it is not. window.scrapwake.big.life() reads stats().
import { ASH } from "@/game/maps/ashmark/layout";
import { layRoads } from "@/game/maps/ashmark/roads";
import { createScatter, KINDS } from "@/game/maps/ashmark/scatter";
import { createOutposts } from "@/game/maps/ashmark/outposts";
import { createLook } from "@/game/maps/ashmark/look";
import { makeGroup, dropGroup } from "@/game/engine/three/ashGroups";
import { createAshScatter } from "@/game/engine/three/ashScatter";

export function createDressing(game) {
  let group = null, parts = null, on = false;
  function make() {
    const net = layRoads();
    group = makeGroup(game.scene, "ash-dress");
    parts = { scatter: createScatter(net, createAshScatter(group, game.M, KINDS)), outposts: createOutposts(game, net), look: createLook(game) };
  }
  function turn(want) {
    if (want && !parts) make();
    if (want === on) return;
    on = want;
    group.visible = on;
    parts.outposts.set(on);
    parts.look.set(on);
  }
  const api = {
    // End of the fixed step.
    step(dt) { if (on) parts.outposts.step(dt); },
    // Every rendered frame, after the big world's own (round15 runs its parts in creation order).
    frame(dt, real) {
      turn(game.big.active);
      if (!on) return;
      const cam = game.camera.position;
      parts.scatter.update(cam.x - ASH.site.x, cam.z - ASH.site.z);
      parts.look.frame(real);
    },
    stats: () => (parts ? { scatter: parts.scatter.stats(), outposts: parts.outposts.stats(), look: parts.look.stats() } : null),
    dispose() {
      if (!parts) return;
      turn(false);
      parts.scatter.dispose();
      dropGroup(group);
      parts = group = null;
    },
  };
  game.big.life = api.stats;
  return api;
}