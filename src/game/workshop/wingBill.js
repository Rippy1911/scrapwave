// Bill lines for wings (round 13), by the same rule as every other part: a new wing pays its tier price, a tier
// change pays the difference, a wing taken off (or swapped) refunds half once you own a built design.
import { WINGS, WING_SIDES } from "@/game/workshop/wings";
import { changeCost, sellRefund, tierPrice, roman } from "@/game/workshop/tiers";

const LABEL = { left: "Left wing", right: "Right wing", roof: "Roof wing", fin: "Tail fin" };
const keyOf = (w) => (WINGS[w.id].fin ? "fin" : w.side);
const bySlot = (design) => Object.fromEntries(((design && design.wings) || []).map((w) => [keyOf(w), w]));

export function wingBillLines(owned, draft, refund = true) {
  const a = bySlot(owned), b = bySlot(draft), out = [];
  for (const k of [...WING_SIDES, "fin"]) {
    const x = a[k], y = b[k];
    if (!x && !y) continue;
    if (x && y && x.id === y.id) {
      if (x.tier === y.tier) continue;
      const c = changeCost(WINGS[y.id].cost, x.tier, y.tier);
      out.push({ label: LABEL[k], text: `${WINGS[y.id].name} ${roman(x.tier)} → ${roman(y.tier)}`, cost: refund ? c : Math.max(0, c), tier: y.tier, up: y.tier > x.tier });
      continue;
    }
    const cost = (y ? tierPrice(WINGS[y.id].cost, y.tier) : 0) - (x && refund ? sellRefund(WINGS[x.id].cost, x.tier) : 0);
    out.push({ label: LABEL[k], text: `${x ? `${WINGS[x.id].name} ${roman(x.tier)}` : "empty"} → ${y ? `${WINGS[y.id].name} ${roman(y.tier)}` : "empty"}`, cost, tier: y ? y.tier : 1, up: !!y });
  }
  return out;
}