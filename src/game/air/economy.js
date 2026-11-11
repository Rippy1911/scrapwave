// Helicopter running costs: buying it and its tiers, the daily upkeep, scrap for repairs, and refuel / repair
// only when landed at an outpost (any fuel stop) or your own base.
import { writeSave } from "@/game/core/save";
import { FUEL } from "@/game/data/tuning";
import { UNLOCK, UPGRADES, airSave, statsFor, tierPrice, today } from "@/game/air/tiers";
import { unlockStatus } from "@/game/air/progress";

const keep = (save) => writeSave(save);

export function buyHeli(save) {
  const s = unlockStatus(save);
  if (s.owned) return { ok: true, msg: "Already in your hangar" };
  if (!s.rank) return { ok: false, msg: `Rank too low: beat the Warlord or finish ${s.jobsNeed} jobs and contracts (${s.jobs} so far)` };
  if (save.banked < s.price) return { ok: false, msg: `Need ${s.price - save.banked} more scrap` };
  save.banked -= s.price;
  const a = airSave(save);
  a.owned = true; a.hp = null; a.paidDay = today();
  keep(save);
  return { ok: true, msg: `Bought the ${statsFor("heli").name} for ${s.price}` };
}

export function buyTier(save, id) {
  const a = airSave(save), t = (a.tiers[id] || 0) + 1;
  if (!a.owned || !UPGRADES[id] || t > 3) return { ok: false, msg: "Nothing to buy" };
  const price = tierPrice(id, t);
  if (save.banked < price) return { ok: false, msg: `Need ${price - save.banked} more scrap for ${UPGRADES[id].name} Tier ${t}` };
  save.banked -= price; a.tiers[id] = t;
  if (id === "armour" && a.hp !== null) a.hp = Math.round(a.hp * 1.22);
  keep(save);
  return { ok: true, msg: `${UPGRADES[id].name} Tier ${t} fitted (-${price})` };
}

export function heliHull(save) {
  const a = airSave(save), max = statsFor("heli", a.tiers).hull;
  return { hp: a.hp === null ? max : Math.min(max, a.hp), max };
}
export const repairCost = (save) => { const h = heliHull(save); return Math.ceil((h.max - h.hp) * UNLOCK.repairPerHp); };

export function repairHeli(save) {
  const cost = repairCost(save);
  if (!cost) return { ok: true, msg: "Already patched up" };
  if (save.banked < cost) return { ok: false, msg: `Repairs cost ${cost} scrap` };
  save.banked -= cost; airSave(save).hp = null; keep(save);
  return { ok: true, msg: `Repaired for ${cost}` };
}

// Launch from the garage: owned, not a wreck, and today's upkeep paid (charged here once per day).
export function launchCheck(save) {
  const a = airSave(save);
  if (!a.owned) return { ok: false, msg: "You don't own an aircraft" };
  if (heliHull(save).hp <= 0) return { ok: false, msg: `Wrecked: repair it first (${repairCost(save)} scrap)` };
  if (a.paidDay !== today()) {
    if (save.banked < UNLOCK.upkeep) return { ok: false, msg: `Daily upkeep is ${UNLOCK.upkeep} scrap` };
    save.banked -= UNLOCK.upkeep; a.paidDay = today(); keep(save);
    return { ok: true, msg: `Upkeep paid (-${UNLOCK.upkeep})` };
  }
  return { ok: true, msg: "" };
}

// Is a landed helicopter at a service point? Outposts = every fuel stop; bases = your own plot.
function servicePoint(game, v) {
  const s = game.world.fuel.nearest(v.pos.x, v.pos.z);
  if (s && Math.hypot(s.x - v.pos.x, s.z - v.pos.z) < 22) return "outpost";
  const b = game.base && game.base.mine && game.base.mine();
  if (b && Math.abs(v.pos.x - b.x) < 34 && Math.abs(v.pos.z - b.z) < 34) return "base";
  return null;
}

// Per step for the flown helicopter: service when landed, and charge scrap for any hull repaired (here or by
// the town's free car repair), reverting what the bank cannot pay for.
export function serviceStep(game, v, dt) {
  if (v.air !== "heli" || !v.alive) return;
  const save = game.save;
  const landed = v.flight.grounded && v.flight.speed < 2;
  const at = landed ? servicePoint(game, v) : null;
  v.servicing = at;
  if (at) {
    if (v.fuel < v.fuelMax) game.addFuel(v, FUEL.fillRate * dt);
    if (v.hull < v.maxHull) v.hull = Math.min(v.maxHull, v.hull + 30 * dt);
  }
  const seen = v.hullSeen ?? v.hull;
  if (v.hull > seen + 1e-3) {
    const cost = (v.hull - seen) * UNLOCK.repairPerHp;
    if (save.banked >= cost) {
      v.repairOwed = (v.repairOwed || 0) + cost;
      const n = Math.floor(v.repairOwed);
      save.banked -= n; v.repairOwed -= n; v.repairSpent = (v.repairSpent || 0) + n;
    } else v.hull = seen;
  }
  v.hullSeen = v.hull;
}