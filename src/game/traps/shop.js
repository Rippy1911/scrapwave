// Trap tier upgrades: bought at an outpost with banked scrap (U), unlocked by jobs and contracts finished.
// Also counts that progress: every "JOB DONE" and "CONTRACT DONE" callout adds one.
import { TRAP_TIERS, nextTierOffer } from "@/game/traps/tiers";
import { atOutpost } from "@/game/traps/charges";
import { writeSave } from "@/game/core/save";

export function createTrapShop(game, { refill }) {
  const callout = game.callout;
  game.callout = (text, ...rest) => {
    if ((text === "JOB DONE" || text === "CONTRACT DONE") && !game.noSave && !game.demo?.running) {
      game.save.trapProgress = (game.save.trapProgress || 0) + 1;
      writeSave(game.save);
    }
    return callout(text, ...rest);
  };

  // What the HUD card shows at an outpost (null elsewhere or when maxed).
  // here: the player is standing at a trader on foot (the car may be parked elsewhere in the zone).
  function offer(p, here = false) {
    if (!p.alive || !(here || atOutpost(game, p))) return null;
    const o = nextTierOffer(game.save);
    if (!o) return null;
    // Round 11: the outpost's faction sets the price (Allied about 20% off, Wary dearer) and Hostile refuses.
    const f = game.factions, price = f ? Math.round(o.price * f.priceAt(p.pos.x, p.pos.z)) : o.price;
    return { ...o, price, afford: game.save.banked >= price, refused: f ? !f.canTradeAt(p.pos.x, p.pos.z) : false };
  }

  function buy(p, here = false) {
    const o = offer(p, here);
    if (!o) return false;
    if (o.refused) { game.emit({ type: "minor", text: "THIS TRADER WON'T DEAL WITH YOU" }); return false; }
    if (o.locked) { game.emit({ type: "minor", text: `${o.name.toUpperCase()} TRAPS: FINISH ${o.need} JOBS & CONTRACTS (${o.have})` }); return false; }
    if (!o.afford) { game.emit({ type: "minor", text: `${o.name.toUpperCase()} TRAPS COST ${o.price} BANKED SCRAP` }); return false; }
    game.save.banked -= o.price;
    game.save.trapTier = o.tier;
    if (!game.noSave) writeSave(game.save);
    refill(game, p);
    game.callout(`${TRAP_TIERS[o.tier].name.toUpperCase()} TRAPS`, "bigger slicks · meaner spikes · harder mines · +1 charge", "#f2c230");
    game.audio.bank();
    game.fame?.onTrapUpgrade?.();
    return true;
  }

  return { offer, buy };
}