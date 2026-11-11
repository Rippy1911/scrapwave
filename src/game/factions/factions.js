// game.factions: reputation (saved), relations (who attacks whom), reputation events, traders and goods, militia
// guards, and town gates. game.js calls createFactions(game) after the on-foot layer and step(dt) every sim step.
import { writeSave } from "@/game/core/save";
import { createReputation, standingOf } from "@/game/factions/reputation";
import { FACTIONS, FACTION, POSTS, factionOf } from "@/game/factions/roster";
import { createRelations } from "@/game/factions/relations";
import { attachRepEvents } from "@/game/factions/repEvents";
import { createTrader } from "@/game/factions/trader";
import { createMilitia } from "@/game/factions/militia";
import { createGates } from "@/game/factions/gates";
import { jobDef } from "@/game/factions/jobCatalog";

export function createFactions(game) {
  let saveT = 0;
  // A short toast per change ("+5 Gasket militia"), and a callout when the standing band changes.
  const toast = (id, d, value, standing, reason, before) => {
    const f = FACTION[id];
    game.emit({ type: "minor", text: `${d > 0 ? "+" : ""}${d} ${f.name}` });
    if (before != null && standingOf(before).id !== standing.id) game.callout(`${f.name.toUpperCase()}: ${standing.name.toUpperCase()}`, d > 0 ? "standing up" : "standing down", standing.color);
    saveT = 1;
  };
  const rep = createReputation(game.save, FACTIONS, toast);
  const rel = createRelations(game, rep);
  const events = attachRepEvents(game, rep, rel);
  const gates = createGates(game, rep);
  const militia = createMilitia(game);
  const factions = { rep, rel, events, gates, militia, factionOf, POSTS };
  game.factions = factions;
  factions.trader = createTrader(game, rep, events);

  Object.assign(factions, {
    willAttack: (v, t) => rel.willAttack(v, t),
    drifterOnSight: () => rel.drifterOnSight(),
    // Price multiplier for the trader nearest a world position (traps/shop.js, the U key at outposts).
    priceAt: (x, z) => rep.priceMult(factions.trader.factionAt(x, z)) ?? 1,
    canTradeAt: (x, z) => rep.canTrade(factions.trader.factionAt(x, z)),
    jobAllowed: (kind) => { const d = jobDef(kind); return !!d && rep.jobAllowed(d.faction, d.need); },
    jobDone: (kind) => events.jobDone(jobDef(kind)),
    all: () => rep.all(),
    step(dt) {
      rep.step(dt);
      events.step(dt);
      gates.step(dt);
      militia.update(dt);
      if (saveT > 0) { saveT -= dt; if (saveT <= 0 && !game.noSave) writeSave(game.save); }
    },
  });
  return factions;
}