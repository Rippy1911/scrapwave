// Faction traders: the Trader menu's data and actions. Goods are paid in banked scrap at the faction's price
// (reputation.priceMult), Hostile factions refuse, and goods sold where they are needed raise standing.
// The trap upgrade / restock keeps its own rules (traps/shop.js), priced by the same multiplier.
import { POSTS, GATES, FACTION } from "@/game/factions/roster";
import { priceList, holdCount, HOLD, neededGood, GOODS } from "@/game/factions/goods";
import { writeSave } from "@/game/core/save";

export function createTrader(game, rep, events) {
  const save = game.save;
  if (!save.goods || typeof save.goods !== "object") save.goods = {};
  const msg = (text) => game.emit({ type: "minor", text });
  const persist = () => { if (!game.noSave) writeSave(save); };
  const cycleN = () => (game.cycle && game.cycle.n) || 1;

  // The faction whose prices apply at a world position (the zone's gate faction; the Well-town by default).
  function factionAt(x, z) {
    const zone = game.onfoot.zones.at(x, z);
    return (zone && GATES[zone.id]) || "well";
  }

  function view(postId) {
    const fid = POSTS[postId] || "well", f = FACTION[fid], mult = rep.priceMult(fid);
    const goods = priceList(fid, mult, cycleN()).map((g) => ({ ...g, have: save.goods[g.id] | 0 }));
    return {
      postId, faction: { id: fid, name: f.name, color: f.color }, standing: rep.standing(fid), value: rep.get(fid),
      mult, canTrade: mult != null, goods, hold: holdCount(save), holdMax: HOLD, banked: save.banked,
      need: GOODS[neededGood(fid, cycleN())]?.name || null,
      trap: mult != null ? game.traps.shop.offer(game.player, true) : null,
      tyres: !!game.player.flat,
      board: game.jobs.board(fid), boardFull: game.jobs.full(),
    };
  }

  function priceOf(postId, id) {
    const fid = POSTS[postId] || "well";
    return { fid, g: priceList(fid, rep.priceMult(fid), cycleN()).find((x) => x.id === id) };
  }

  function buy(postId, id) {
    const { fid, g } = priceOf(postId, id);
    if (!rep.canTrade(fid)) { msg(`${FACTION[fid].short.toUpperCase()} WON'T TRADE WITH YOU`); return false; }
    if (!g || g.buy == null) return false;
    if (holdCount(save) >= HOLD) { msg("CARGO HOLD FULL"); return false; }
    if (save.banked < g.buy) { msg(`${g.name.toUpperCase()} COSTS ${g.buy} BANKED SCRAP`); return false; }
    save.banked -= g.buy;
    save.goods[id] = (save.goods[id] | 0) + 1;
    persist();
    return true;
  }

  function sell(postId, id) {
    const { fid, g } = priceOf(postId, id);
    if (!rep.canTrade(fid)) { msg(`${FACTION[fid].short.toUpperCase()} WON'T TRADE WITH YOU`); return false; }
    if (!g || !(save.goods[id] > 0)) return false;
    save.goods[id]--;
    save.banked += g.sell;
    events.sold(fid, g.needed);
    persist();
    return true;
  }

  // Restock traps, patch tyres, or buy the next trap tier (traps/shop.js applies the faction price).
  function service(postId, what) {
    const fid = POSTS[postId] || "well", p = game.player;
    if (!rep.canTrade(fid)) { msg(`${FACTION[fid].short.toUpperCase()} WON'T TRADE WITH YOU`); return false; }
    if (what === "trap") return game.traps.shop.buy(p, true);
    const refilled = game.traps.refill(p);
    if (p.flat) { p.flat = null; msg("TYRES PATCHED"); return true; }
    msg(refilled ? "TRAPS RESTOCKED" : "NOTHING TO RESTOCK");
    return refilled;
  }

  return { view, buy, sell, service, factionAt, take: (postId, kind) => game.jobs.takeKind(kind, POSTS[postId]) };
}