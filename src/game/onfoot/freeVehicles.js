// Free vehicles: a few Tier I cars parked with a FREE tag in every town and outpost. Anyone can take one (walk up
// and press E, or pick it on the spawn screen). They have no upgrades and cannot be sold or modified. An abandoned
// free car despawns after a while (a wrecked one with its wreck), and its spot refills a few minutes later.
import { createVehicle, placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";
import { surfaceY, clearAt } from "@/game/world/spawn";
import { spotNear } from "@/game/onfoot/landmarks";
import { addFreeMarker, setFreeMarker } from "@/game/onfoot/freeMarker";

export const FREE = {
  kinds: { town: ["buggy", "brawler", "buggy"], outpost: ["buggy", "brawler"] }, // no bikes in the game yet
  loadouts: { buggy: { s1: "mg" }, brawler: { s1: "mg", s2: "mg" } }, // Tier I: base guns, no ram, armour or modules
  paint: "#7d8a80", paint2: "#5e6b3a",
  refill: 180, abandon: 90, // seconds
};

export function createFreeVehicles(game, zones) {
  const slots = [];
  for (const z of zones.all()) {
    const kinds = FREE.kinds[z.kind];
    if (!kinds) continue;
    kinds.forEach((kind, i) => {
      const a = 0.9 + (i / kinds.length) * Math.PI * 2, d = z.r * (z.kind === "town" ? 0.42 : 0.4);
      const p = spotNear(game.world, z.x, z.z, Math.cos(a) * d, Math.sin(a) * d, 4.5);
      slots.push({ id: `${z.id}-${i}`, zoneId: z.id, kind, x: p.x, z: p.z, heading: a, v: null, refillAt: 0 });
    });
  }
  const loose = new Set(); // free cars somebody drove off in or left behind

  function spawn(s) {
    const v = createVehicle(game, s.kind, { team: "free", name: "Free " + s.kind, paint: FREE.paint, paint2: FREE.paint2, loadout: { ...FREE.loadouts[s.kind] }, plate: "FREE" });
    v.name = "Free " + v.stats.name;
    v.free = { kind: s.kind }; v.empty = true; v.slot = s; v.fuelInit = true;
    placeVehicle(v, s.x, surfaceY(game.world, s.x, s.z) + 1.2, s.z, s.heading);
    v.ctl.handbrake = true;
    addFreeMarker(v);
    game.vehicles.push(v);
    s.v = v;
    return v;
  }

  function despawn(v) {
    loose.delete(v);
    const i = game.vehicles.indexOf(v);
    if (i >= 0) { game.vehicles.splice(i, 1); removeVehicle(game, v); }
  }

  const api = {
    slots,
    // Someone got in: the spot starts its refill timer.
    take(v) {
      v.empty = false; v.abandonedAt = 0;
      if (v.slot) { v.slot.v = null; v.slot.refillAt = game.time + FREE.refill; v.slot = null; }
      loose.add(v);
      setFreeMarker(v, false);
    },
    // Driver got out or switched cars: despawns after FREE.abandon seconds unless someone gets back in.
    leave(v) {
      v.empty = true; v.abandonedAt = game.time;
      v.team = "free"; v.name = "Free " + v.stats.name;
      v.ctl.throttle = 0; v.ctl.brake = 0; v.ctl.steer = 0; v.ctl.handbrake = true; v.ctl.turbo = false;
      loose.add(v);
    },
    // Parked free cars nobody is driving at one zone (the spawn screen lists these).
    at: (zoneId) => slots.filter((s) => s.zoneId === zoneId && s.v && s.v.alive && s.v.empty).map((s) => s.v),
    step() {
      for (const s of slots) {
        if (s.v && !game.vehicles.includes(s.v)) s.v = null; // wrecked and cleared away
        if (!s.v && game.time >= s.refillAt && clearAt(game.world, s.x, s.z, 3, game.vehicles)) spawn(s);
      }
      for (const v of [...loose]) {
        if (!game.vehicles.includes(v)) { loose.delete(v); continue; }
        if (v === game.player) continue;
        if (v.empty && v.abandonedAt && game.time - v.abandonedAt > FREE.abandon) despawn(v);
      }
    },
    frame(time) {
      for (const s of slots) if (s.v) setFreeMarker(s.v, s.v.empty && s.v.alive, time);
      for (const v of loose) setFreeMarker(v, v.empty && v.alive, time);
    },
    clear() { for (const s of slots) if (s.v) { despawn(s.v); s.v = null; s.refillAt = 0; } for (const v of [...loose]) if (v !== game.player) despawn(v); },
  };
  return api;
}