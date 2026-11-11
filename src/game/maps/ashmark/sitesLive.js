// The Ashmark's built places, streamed like its ground: a site's pieces and colliders exist only while the camera or
// a simulated vehicle is within NEAR of it, and go again past FAR. A site is one scene group (the place kit merges
// its pieces into one mesh per material) plus its box and wedge colliders. At most one site is built per update, so
// arriving somewhere never builds two in one frame. The builders live in build/*.js, one file per biome.
import { ASH } from "@/game/maps/ashmark/layout";
import { createKit } from "@/game/world/places/kit";
import { makeGroup, dropGroup, groupStats } from "@/game/engine/three/ashGroups";
import { HIGHWAY } from "@/game/maps/ashmark/build/highway";
import { CITY } from "@/game/maps/ashmark/build/city";
import { SPINE } from "@/game/maps/ashmark/build/spine";
import { DUNES } from "@/game/maps/ashmark/build/dunes";
import { MARSH } from "@/game/maps/ashmark/build/marsh";

const BUILD = { ...HIGHWAY, ...CITY, ...SPINE, ...DUNES, ...MARSH };
const NEAR = 1500, FAR = 1900;
const now = () => performance.now();

export function createSites(game, parent, net) {
  const C = game.world.colliders, M = game.M, live = new Map(), signs = new Map();
  const all = [...net.sites.values()].filter((s) => BUILD[s.id]);
  const S = { built: 0, dropped: 0, lastMs: 0, maxMs: 0 };
  let waiting = 0;
  // Sign boards are made once each: a site that streams in again reuses its texture.
  const sign = (text, sub) => { const k = text + "|" + sub; if (!signs.has(k)) signs.set(k, M.sign(text, sub)); return signs.get(k); };

  function build(s) {
    const t0 = now(), group = makeGroup(parent, "ash-site:" + s.id), ids = [];
    const coll = { add: (b) => { const e = C.add(b); ids.push(e.id); return e; } };
    const kit = createKit(group, M, coll, game.world.terrain);
    const F = kit.frame(s.x + ASH.site.x, s.y, s.z + ASH.site.z, s.yaw), F0 = kit.frame(ASH.site.x, 0, ASH.site.z, 0);
    BUILD[s.id]({ F, F0, M, S: s, net, sign });
    kit.finalize();
    live.set(s.id, { group, ids });
    S.built++;
    S.lastMs = now() - t0;
    if (S.lastMs > S.maxMs) S.maxMs = S.lastMs;
  }
  function drop(id) {
    const L = live.get(id);
    dropGroup(L.group);
    for (const i of L.ids) C.removeById(i);
    live.delete(id);
    S.dropped++;
  }
  const reach = (s, pts) => {
    let d = Infinity;
    for (const p of pts) d = Math.min(d, Math.hypot(p.x - s.x - ASH.site.x, p.z - s.z - ASH.site.z));
    return d;
  };

  return {
    /** pts: [{ x, z }] in world coordinates: the camera and every simulated vehicle on the map. */
    update(pts) {
      let next = null, nd = Infinity;
      waiting = 0;
      for (const s of all) {
        const d = reach(s, pts), on = live.has(s.id);
        if (on && d > FAR) drop(s.id);
        else if (!on && d < NEAR) { waiting++; if (d < nd) { nd = d; next = s; } }
      }
      if (next) { build(next); waiting--; }
    },
    /** True while a site in reach is still to be built (a freshly placed car waits for it). */
    busy: () => waiting > 0,
    /** The name of the place at a world point, or null: inside a pad, or within 60 m of a place on a road. */
    nameAt(wx, wz) {
      const x = wx - ASH.site.x, z = wz - ASH.site.z;
      for (const s of all) if (s.id !== "start" && Math.hypot(x - s.x, z - s.z) < (s.r || 60) + 8) return s.name;
      return null;
    },
    stats() {
      let meshes = 0, tris = 0, colliders = 0;
      for (const L of live.values()) { const g = groupStats(L.group); meshes += g.meshes; tris += g.tris; colliders += L.ids.length; }
      return { live: [...live.keys()], meshes, ktris: Math.round(tris / 1000), colliders, built: S.built, dropped: S.dropped, buildMs: { last: +S.lastMs.toFixed(1), max: +S.maxMs.toFixed(1) } };
    },
    clear() { for (const id of [...live.keys()]) drop(id); waiting = 0; },
    dispose() { this.clear(); for (const m of signs.values()) { if (m.map) m.map.dispose(); m.dispose(); } signs.clear(); },
  };
}