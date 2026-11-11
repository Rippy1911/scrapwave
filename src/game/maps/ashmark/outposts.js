// The Ashmark's working places: the four garages and the toll gate are safe zones (no guns inside the ring, E gets
// you out of the car) with a trader at every stall, and each garage has a bay that opens the Garage screen and
// patches the hull of a car that stops inside its ring. While the Ashmark is the active world its zones and
// landmarks are added to the game's own lists (onfoot/zoneSources.js, onfoot/landmarks.js) and taken out again when
// it is not, so the trader menu, the weapons gate, the ground rings and the HUD banner need nothing new.
import { ASH } from "@/game/maps/ashmark/layout";
import { makeZone, zoneAt } from "@/game/onfoot/zones";

const REPAIR = 0.05, STOPPED = 8 / 3.6; // share of the hull per second, for a car slower than 8 km/h

/** net: the laid-out roads and sites (roads.js). */
export function createOutposts(game, net) {
  const Z = game.onfoot.zones, marks = game.onfoot.landmarks, orig = { list: Z.list, all: Z.all, byId: Z.byId, at: Z.at };
  const zones = [], lm = [];
  // A point in a site's own frame (x to its right, -z its front; build/highway.js) as world coordinates.
  const at = (s, lx, lz) => { const c = Math.cos(s.yaw), n = Math.sin(s.yaw); return { x: s.x + lx * c + lz * n + ASH.site.x, z: s.z - lx * n + lz * c + ASH.site.z }; };
  const mark = (s, id, kind, name, verb, lx, lz, r) => lm.push({ id, kind, name, verb, r, ...at(s, lx, lz) });
  for (const s of net.sites.values()) {
    if (s.kind !== "garage" && s.kind !== "outpost") continue;
    zones.push({ ...makeZone("ash-" + s.id, "outpost", s.name, s.x + ASH.site.x, s.z + ASH.site.z, s.r), garage: s.kind === "garage" });
    if (s.kind === "garage") {
      mark(s, "trader-ash-" + s.id, "trader", s.name + " trader", "Trade", -15, -4, 4.5); // the stall beside the shed
      mark(s, "garage-ash-" + s.id, "garage", s.name, "Open the garage", 0, 4, 6); // the mouth of the shed
    } else {
      mark(s, "trader-ash-" + s.id, "trader", "Toll traders", "Trade", 19, 2, 4.5);
      mark(s, "trader-ash-" + s.id + "-2", "trader", "Toll traders", "Trade", 25, -9, 4.5);
    }
  }
  let on = false, mending = null, base = null, both = zones;
  const all = () => { const b = orig.all(); if (b !== base) { base = b; both = [...b, ...zones]; } return both; };

  return {
    /** Adds the Ashmark's zones and landmarks to the game's lists, or takes them out again. */
    set(active) {
      if (active === on) return;
      on = active;
      if (on) {
        Z.all = all;
        Z.list = () => (game.arena && game.arena.active ? [] : all());
        Z.byId = (id) => all().find((z) => z.id === id) || null;
        Z.at = (x, z, margin = 0) => zoneAt(Z.list(), x, z, margin);
        marks.push(...lm);
      } else {
        Object.assign(Z, orig);
        for (const m of lm) { const i = marks.indexOf(m); if (i >= 0) marks.splice(i, 1); }
      }
      Z.version++; // the ground rings are redrawn
    },
    // End of the fixed step: a car standing in a garage's ring is patched up.
    step(dt) {
      mending = null;
      for (const v of game.vehicles) {
        if (v.remote || !v.alive || v.hull >= v.maxHull || Math.hypot(v.vel.x, v.vel.z) > STOPPED) continue;
        const z = zoneAt(zones, v.pos.x, v.pos.z);
        if (!z || !z.garage) continue;
        v.hull = Math.min(v.maxHull, v.hull + v.maxHull * REPAIR * dt);
        if (v === game.player) mending = z.id;
      }
    },
    stats: () => ({ on, zones: zones.map((z) => z.id), landmarks: lm.length, mending }),
  };
}