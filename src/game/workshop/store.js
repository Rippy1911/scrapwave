// The workshop's part of the save (localStorage, through core/save.js): which car you drive, the built design,
// upgrade tiers for the garage cars, and blueprints. Versioned: older shapes are upgraded on read, never dropped.
import { writeSave } from "@/game/core/save";
import { clampTier } from "@/game/workshop/tiers";

export const WORKSHOP_VERSION = 1;

// ride: "garage" = today's garage car (default), "design" = the built design (a car or a bike).
// Upgrades the shape once and then returns the same object every call, so callers can hold on to it and mutate it.
export function ensureWorkshop(save) {
  const w = save.workshop && typeof save.workshop === "object" ? save.workshop : {};
  if (w._ok === save) return w;
  const t = w.tiers || {};
  save.workshop = {
    v: WORKSHOP_VERSION,
    ride: w.ride === "design" && w.built ? "design" : "garage",
    built: w.built || null,
    blueprints: Array.isArray(w.blueprints) ? w.blueprints.filter((b) => b && b.name && b.design) : [],
    tiers: {
      weapons: { ...(t.weapons || {}) }, modules: { ...(t.modules || {}) },
      ram: clampTier(t.ram), engine: clampTier(t.engine), tyres: clampTier(t.tyres), turbo: clampTier(t.turbo), tank: clampTier(t.tank), traverse: clampTier(t.traverse),
    },
  };
  // Not saved (JSON skips it): marks this object as already checked for this save.
  Object.defineProperty(save.workshop, "_ok", { value: save, enumerable: false });
  return save.workshop;
}

export const tiersOf = (save) => ensureWorkshop(save).tiers;
export const weaponTier = (save, id) => clampTier(tiersOf(save).weapons[id]);
export const moduleTier = (save, id) => clampTier(tiersOf(save).modules[id]);

export function commit(save, noSave = false) {
  if (!noSave) writeSave(save);
}