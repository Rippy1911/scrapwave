// Trap slot per car: charges of each kind, the selected kind and a short drop cooldown. Every car has the slot
// unless its vehicle spec says dropSlot: false. Tier: the player's bought tier, AI by skill, both capped by
// rules.maxTier. Charges refill at outposts (Well-town, fuel stations) and from arena crates.
import { TRAP_TIERS, TRAP_KINDS, ownedTier, tierFor, aiTier } from "@/game/traps/tiers";
import { skillQ } from "@/game/ai/aim";
import { getRules } from "@/game/rules/state";

export const hasSlot = (v) => !!v && !!v.stats && v.stats.dropSlot !== false;

export function vehicleTier(game, v) {
  const owned = v === game.player ? ownedTier(game.save) : aiTier(skillQ(v.skill));
  return tierFor(owned, getRules());
}

export function fullCharges(game, v) {
  const c = { ...TRAP_TIERS[vehicleTier(game, v)].charges };
  if (v.mines) c.mines += 2; // the old mine-layer module still adds mines
  return c;
}

/** The car's trap slot state (created on first use). */
export function slot(game, v) {
  if (!v.trapSt) v.trapSt = { charges: fullCharges(game, v), sel: "oil", cd: 0 };
  return v.trapSt;
}

/** Top the charges back up; returns true when anything was added. */
export function refill(game, v) {
  if (!hasSlot(v)) return false;
  const st = slot(game, v), full = fullCharges(game, v);
  let added = false;
  for (const k of TRAP_KINDS) if (st.charges[k] < full[k]) { st.charges[k] = full[k]; added = true; }
  return added;
}

/** Next kind in the slot (H). */
export function cycleKind(game, v) {
  const st = slot(game, v);
  st.sel = TRAP_KINDS[(TRAP_KINDS.indexOf(st.sel) + 1) % TRAP_KINDS.length];
  return st.sel;
}

/** At an outpost: the Well-town safe zone or beside a fuel station. */
export function atOutpost(game, v) {
  if (game.inSafeZone(v)) return true;
  const s = game.world.fuel && game.world.fuel.nearest(v.pos.x, v.pos.z);
  return !!s && Math.hypot(s.x - v.pos.x, s.z - v.pos.z) < 16;
}