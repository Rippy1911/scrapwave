// Reputation store: one standing per faction, -100..100, saved with the game (save.rep).
// Pure bookkeeping + the rules that read it (prices, trade, jobs, hostility, gates). No scene or net code here.

export const REP_MIN = -100;
export const REP_MAX = 100;

// Standing bands, low to high. A value belongs to the first band whose max it does not exceed.
export const STANDINGS = [
  { id: "hostile", name: "Hostile", max: -50, color: "#ff5a3c" },
  { id: "wary", name: "Wary", max: -15, color: "#ff9a3c" },
  { id: "neutral", name: "Neutral", max: 14, color: "#cfc6b4" },
  { id: "friendly", name: "Friendly", max: 49, color: "#9be36a" },
  { id: "allied", name: "Allied", max: REP_MAX, color: "#5ad1ff" },
];
const RANK = { hostile: 0, wary: 1, neutral: 2, friendly: 3, allied: 4 };

// Trader price multiplier per standing (buying; selling uses the inverse). null = no trade.
const PRICE = { hostile: null, wary: 1.2, neutral: 1, friendly: 0.9, allied: 0.8 };

const clamp = (v) => Math.max(REP_MIN, Math.min(REP_MAX, Math.round(v)));

export function standingOf(value) {
  for (const s of STANDINGS) if (value <= s.max) return s;
  return STANDINGS[STANDINGS.length - 1];
}

// defs: [{ id, name, short, start }] from factions/roster.js. onChange(id, delta, value, standing, reason).
export function createReputation(save, defs, onChange = () => {}) {
  if (!save.rep || typeof save.rep !== "object") save.rep = {};
  for (const d of defs) if (typeof save.rep[d.id] !== "number") save.rep[d.id] = d.start || 0;
  const byId = Object.fromEntries(defs.map((d) => [d.id, d]));

  const get = (id) => (byId[id] ? save.rep[id] : 0);
  const standing = (id) => standingOf(get(id));
  const atLeast = (id, band) => RANK[standing(id).id] >= RANK[band];

  // Pending deltas per faction are batched for ~0.6 s so a burst of hits makes one toast, not ten.
  const pending = {};
  let flushT = 0;

  function set(id, value, reason = "set") {
    if (!byId[id]) return false;
    const before = save.rep[id];
    save.rep[id] = clamp(value);
    const d = save.rep[id] - before;
    if (d) onChange(id, d, save.rep[id], standing(id), reason, before);
    return true;
  }

  function change(id, delta, reason = "") {
    if (!byId[id] || !delta) return 0;
    const before = save.rep[id];
    save.rep[id] = clamp(before + delta);
    const d = save.rep[id] - before;
    if (d) {
      const p = pending[id] || (pending[id] = { d: 0, before, reason });
      p.d += d; p.reason = reason || p.reason;
      flushT = 0.6;
    }
    return d;
  }

  function step(dt) {
    if (flushT <= 0) return;
    flushT -= dt;
    if (flushT > 0) return;
    for (const id of Object.keys(pending)) {
      const p = pending[id];
      delete pending[id];
      if (p.d) onChange(id, p.d, save.rep[id], standing(id), p.reason, p.before);
    }
  }

  return {
    defs, byId, get, set, change, step, standing, atLeast,
    // Buying price multiplier at this faction's traders; null = they refuse to trade.
    priceMult: (id) => PRICE[standing(id).id],
    sellMult: (id) => (PRICE[standing(id).id] ? 1 / PRICE[standing(id).id] : null),
    canTrade: (id) => PRICE[standing(id).id] !== null,
    hostile: (id) => standing(id).id === "hostile",
    // Friendly or better: they leave the player alone unless provoked.
    peaceful: (id) => atLeast(id, "friendly"),
    gateOpen: (id) => standing(id).id !== "hostile", // factions/gates.js shuts the town when Hostile
    jobAllowed: (id, need = "neutral") => atLeast(id, need),
    all: () => defs.map((d) => ({ id: d.id, name: d.name, short: d.short, kind: d.kind, value: save.rep[d.id], standing: standing(d.id) })),
  };
}