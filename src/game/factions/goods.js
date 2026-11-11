// Trade goods: bought at one faction's trader, sold where they are needed. Carried in the cargo hold
// (save.goods, up to HOLD crates) and paid for with banked scrap. Pure data and price maths.

export const HOLD = 6;

export const GOODS = {
  water: { name: "Water", base: 40 },
  parts: { name: "Machine parts", base: 60 },
  fuel: { name: "Fuel drums", base: 50 },
  chems: { name: "Chems", base: 80 },
};

// What each faction's traders sell, and the two goods they want; the wanted one swaps every cycle.
export const MARKETS = {
  well: { sells: ["water"], wants: ["parts", "chems"] },
  gasket: { sells: ["parts"], wants: ["water", "fuel"] },
  raiders: { sells: ["chems", "fuel"], wants: ["parts", "water"] },
  drifters: { sells: ["fuel", "water"], wants: ["chems", "parts"] },
};

const SELL_BASE = 0.6, NEED_BONUS = 1.8;

export const neededGood = (factionId, cycleN = 0) => {
  const m = MARKETS[factionId];
  return m ? m.wants[Math.abs(cycleN | 0) % m.wants.length] : null;
};

// mult: the faction's buying price multiplier (reputation.priceMult); null = no trade.
export function priceList(factionId, mult, cycleN = 0) {
  const m = MARKETS[factionId];
  if (!m || mult == null) return [];
  const need = neededGood(factionId, cycleN);
  return Object.entries(GOODS).map(([id, g]) => {
    const sells = m.sells.includes(id), needed = id === need;
    return {
      id, name: g.name, sells, needed,
      buy: sells ? Math.round(g.base * mult) : null,
      sell: Math.round((g.base * SELL_BASE * (needed ? NEED_BONUS : 1)) / mult),
    };
  });
}

export const holdCount = (save) => Object.values(save.goods || {}).reduce((a, b) => a + (b | 0), 0);