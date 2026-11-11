// E at a landmark: a trader or job board opens the Trader menu for the faction that runs it (goods, trap restock and
// tiers, tyres, and that faction's job board; factions/trader.js), the garage opens the Garage screen (free cars
// can't be modified, garage changes apply to your own car).
export function operateLandmark(game, m) {
  const p = game.player, msg = (text) => game.emit({ type: "minor", text });
  if (m.kind === "trader" || m.kind === "jobs") {
    game.emit({ type: "trader", id: m.id, tab: m.kind === "jobs" ? "jobs" : "trade" });
    return m.kind === "jobs" ? "jobs" : "trader";
  }
  if (m.kind === "garage") {
    if (p.free) msg("FREE VEHICLES CAN'T BE MODIFIED · CHANGES APPLY TO YOUR OWN CARS");
    game.emit({ type: "garage" });
    return "garage";
  }
  return null;
}