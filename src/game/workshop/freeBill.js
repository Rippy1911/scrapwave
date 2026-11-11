// Build bill lines for the free build: parts (and weapons on free mounts) counted by type and tier against the
// machine you own. New parts pay their tier price, parts taken off refund half (only once something is built),
// and a tier you have not unlocked cannot be fitted, the same rules as the slots (economy.js).
import { WEAPONS } from "@/game/data/tuning";
import { freePartInfo } from "@/game/workshop/freeParts";
import { tierPrice, sellRefund, roman } from "@/game/workshop/tiers";

function tally(d) {
  const m = new Map();
  const add = (key, label, base, tier) => { const e = m.get(key) || { label, base, tier, n: 0 }; e.n++; m.set(key, e); };
  for (const p of d?.free?.parts || []) {
    const i = freePartInfo(p.t, p.tier);
    add(`p:${p.t}:${p.tier}`, `${i.name} ${roman(p.tier)}`, i.cost, p.tier);
    if (p.wpn && WEAPONS[p.wpn.id]) add(`w:${p.wpn.id}:${p.wpn.tier}`, `${WEAPONS[p.wpn.id].name} ${roman(p.wpn.tier)}`, WEAPONS[p.wpn.id].price, p.wpn.tier);
  }
  return m;
}

// -> [{ label, text, cost, tier, up }]
export function freeBillLines(owned, draft, refund) {
  const a = tally(owned), b = tally(draft), out = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(k), y = b.get(k), diff = (y ? y.n : 0) - (x ? x.n : 0);
    if (!diff) continue;
    const e = y || x;
    const cost = diff > 0 ? diff * tierPrice(e.base, e.tier) : refund ? -(-diff) * sellRefund(e.base, e.tier) : 0;
    out.push({ label: "Free build", text: `${e.label} ${diff > 0 ? "+" : ""}${diff}`, cost, tier: e.tier, up: diff > 0 });
  }
  return out;
}