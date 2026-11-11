// Your garage as the spawn screen shows it: every chassis you own with its loadout, armour tier, modules, trap tier
// and any saved blueprint. An owned car that was wrecked must be repaired (banked scrap) or wait out a short
// cooldown before it can roll again. Wreck times live in save.rides (merged by loadSave like any other field).
import { VEHICLES, WEAPONS, ARMOUR_TIERS, MODULES } from "@/game/data/tuning";
import { TRAP_TIERS, ownedTier } from "@/game/traps/tiers";
import { writeSave } from "@/game/core/save";

export const RIDES = { cooldown: 60, repairPerHull: 0.3 }; // seconds; scrap per point of hull

const rides = (save) => save.rides || (save.rides = { wrecked: {} });
export const repairCost = (id) => Math.round((VEHICLES[id].hull * RIDES.repairPerHull) / 10) * 10;

export function rideStatus(save, id, now = Date.now()) {
  const at = rides(save).wrecked[id];
  if (!at) return { ready: true, wrecked: false, wait: 0, cost: 0 };
  const wait = Math.max(0, Math.ceil(RIDES.cooldown - (now - at) / 1000));
  if (wait <= 0) { delete rides(save).wrecked[id]; return { ready: true, wrecked: false, wait: 0, cost: 0 }; }
  return { ready: false, wrecked: true, wait, cost: repairCost(id), afford: save.banked >= repairCost(id) };
}

export function markWrecked(game, id) {
  rides(game.save).wrecked[id] = Date.now();
  if (!game.noSave) writeSave(game.save);
}

// Pay the repair from banked scrap; returns true when the car is ready now.
export function payRepair(game, id) {
  const st = rideStatus(game.save, id);
  if (st.ready) return true;
  if (game.save.banked < st.cost) return false;
  game.save.banked -= st.cost;
  delete rides(game.save).wrecked[id];
  if (!game.noSave) writeSave(game.save);
  return true;
}

export function ownedRides(save) {
  const g = save.garage, mods = (g.owned.modules || []).map((m) => (MODULES[m] ? MODULES[m].name : m));
  const trap = TRAP_TIERS[ownedTier(save)];
  return (g.owned.chassis || []).filter((id) => VEHICLES[id]).map((id) => {
    const lo = g.loadouts[id] || {}, armour = ARMOUR_TIERS.find((a) => a.id === (g.armour || {})[id]);
    const weapons = Object.entries(lo).filter(([k, w]) => k !== "ram" && w && WEAPONS[w]).map(([, w]) => WEAPONS[w].name);
    const bp = g.blueprints && g.blueprints[id];
    return {
      id, name: VEHICLES[id].name, selected: g.chassis === id, weapons, ram: !!(lo.ram && g.owned.ram),
      armour: armour ? armour.name : "None", modules: mods, trapTier: trap ? trap.name : null,
      blueprint: bp ? bp.name || "Saved" : null, status: rideStatus(save, id),
    };
  });
}