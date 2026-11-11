// Prices (A, C). Building a design pays only for what changes against the car you own: a part swapped out refunds
// half its price, a tier change on the same part pays the difference (or refunds half of it going down). Locked tiers
// cannot be fitted. Garage upgrades (weapons, ram, engine, tyres, turbo, tank, modules, armour) follow the same rule.
import { WEAPONS, MODULES, RAM, UPGRADES, ARMOUR_TIERS } from "@/game/data/tuning";
import { slotsFor, slotDef, mountList, mountSide, MOUNT_PARTS } from "@/game/workshop/parts";
import { changeCost, sellRefund, tierPrice, lockReason, roman, clampTier } from "@/game/workshop/tiers";
import { normalizeDesign, designClass } from "@/game/workshop/validate";
import { ensureWorkshop, commit } from "@/game/workshop/store";
import { presetByName, PRESET_FOR } from "@/game/workshop/designs";
import { freeBillLines } from "@/game/workshop/freeBill";
import { wingBillLines } from "@/game/workshop/wingBill";

let fameEconomyHook = null;
export function setFameEconomyHook(fn) {
  fameEconomyHook = fn;
}

// The design you own now: the built one, else today's garage car as its ready-made design.
export function ownedDesign(save) {
  const ws = ensureWorkshop(save);
  if (ws.built) return normalizeDesign(ws.built);
  const p = presetByName(PRESET_FOR[save.garage.chassis]);
  return p ? normalizeDesign(p) : null;
}

const slotItem = (key, x) => { const o = x && slotDef(key).options[x.id]; return o && o.cost ? { id: x.id, tier: x.tier, base: o.cost, name: o.name } : null; };
const weaponItem = (x) => (x ? { id: x.id, tier: x.tier, base: WEAPONS[x.id].price, name: WEAPONS[x.id].name } : null);

// refund: false while nothing is built yet: the garage car's parts count as owned but stay with the garage car.
function line(label, a, b, refund = true) {
  if (!a && !b) return null;
  if (a && b && a.id === b.id) {
    if (a.tier === b.tier) return null;
    const c = changeCost(b.base, a.tier, b.tier);
    return { label, text: `${b.name} ${roman(a.tier)} → ${roman(b.tier)}`, cost: refund ? c : Math.max(0, c), tier: b.tier, up: b.tier > a.tier };
  }
  const cost = (b ? tierPrice(b.base, b.tier) : 0) - (a && refund ? sellRefund(a.base, a.tier) : 0);
  return { label, text: `${a ? `${a.name} ${roman(a.tier)}` : "empty"} → ${b ? `${b.name} ${roman(b.tier)}` : "empty"}`, cost, tier: b ? b.tier : 1, up: !!b };
}

// { lines: [{ label, text, cost, tier, up }], total, locked: [reasons] }
export function buildBill(save, draft) {
  const d = normalizeDesign(draft), o = ownedDesign(save), lines = [], refund = !!ensureWorkshop(save).built;
  const keys = new Set([...slotsFor(designClass(d)).map((s) => s.key), ...(o ? slotsFor(designClass(o)).map((s) => s.key) : [])]);
  for (const k of keys) lines.push(line(slotDef(k).label, slotItem(k, o?.parts[k]), slotItem(k, d.parts[k]), refund));
  const n = Math.max(d.weapons.length, o ? o.weapons.length : 0);
  for (let i = 0; i < n; i++) lines.push(line(`Mount ${i + 1}`, weaponItem(o?.weapons[i]), weaponItem(d.weapons[i]), refund));
  const count = (des) => { const m = des ? mountList(des.parts.chassis.id).filter((_, i) => !mountSide(des.parts.chassis.id, i)) : []; return { S: m.filter((s) => s === "S").length, M: m.filter((s) => s === "M").length, L: m.filter((s) => s === "L").length }; };
  const cn = count(d), co = count(o);
  for (const s of ["S", "M", "L"]) {
    const diff = cn[s] - co[s];
    if (diff) lines.push({ label: MOUNT_PARTS[s].name, text: `${diff > 0 ? "+" : ""}${diff}`, cost: diff > 0 ? diff * MOUNT_PARTS[s].cost : refund ? Math.round((diff * MOUNT_PARTS[s].cost) / 2) : 0, tier: 1, up: diff > 0 });
  }
  lines.push(...freeBillLines(o, d, refund));
  lines.push(...wingBillLines(o, d, refund));
  const out = lines.filter(Boolean);
  const locked = [...new Set(out.filter((l) => l.up && l.tier > 1).map((l) => lockReason(save, l.tier)).filter(Boolean))];
  return { lines: out, total: out.reduce((a, l) => a + l.cost, 0), locked };
}

// Pays (or refunds) and makes the design your car. Returns { ok, msg, bill }.
export function buildDesign(save, draft, noSave = false) {
  const bill = buildBill(save, draft);
  if (bill.locked.length) return { ok: false, msg: bill.locked[0], bill };
  if (bill.total > save.banked) return { ok: false, msg: `Need ${bill.total - save.banked} more scrap`, bill };
  const ws = ensureWorkshop(save);
  save.banked -= bill.total;
  ws.built = normalizeDesign(draft); ws.ride = "design";
  commit(save, noSave);
  if (bill.total > 0) fameEconomyHook?.("build");
  return { ok: true, msg: bill.total >= 0 ? `Built for ${bill.total} scrap` : `Built, ${-bill.total} scrap refunded`, bill };
}

// ---- garage upgrades ----
export function upgradeBase(kind, id) {
  if (kind === "weapon") return WEAPONS[id]?.price || 0;
  if (kind === "module") return MODULES[id]?.price || 0;
  if (kind === "ram") return RAM.price;
  return UPGRADES[kind]?.price || 0;
}
export function currentTier(save, kind, id) {
  const T = ensureWorkshop(save).tiers;
  return clampTier(kind === "weapon" ? T.weapons[id] : kind === "module" ? T.modules[id] : T[kind]);
}
// Upgrade (or step down) one garage upgrade to a tier, capped by unlocks and the rules' maxTier.
export function setTier(save, kind, id, tier, noSave = false) {
  const T = ensureWorkshop(save).tiers, cur = currentTier(save, kind, id), t = clampTier(tier);
  if (t === cur) return { ok: true, msg: "", cost: 0 };
  const why = t > cur ? lockReason(save, t) : null;
  if (why) return { ok: false, msg: why };
  const cost = changeCost(upgradeBase(kind, id), cur, t);
  if (cost > save.banked) return { ok: false, msg: `Need ${cost - save.banked} more scrap` };
  save.banked -= cost;
  if (kind === "weapon") T.weapons[id] = t; else if (kind === "module") T.modules[id] = t; else T[kind] = t;
  commit(save, noSave);
  if (cost > 0) fameEconomyHook?.("upgrade");
  return { ok: true, cost, msg: cost >= 0 ? `Tier ${roman(t)} fitted for ${cost}` : `Tier ${roman(t)}, ${-cost} refunded` };
}

// Garage armour (all zones): ids scrap / plate / forged are tiers I / II / III. null = no armour.
export function armourChange(save, fromId, toId) {
  const a = ARMOUR_TIERS.find((x) => x.id === fromId), b = ARMOUR_TIERS.find((x) => x.id === toId), base = ARMOUR_TIERS[0].price;
  if (b && (!a || b.tier > a.tier)) { const why = lockReason(save, b.tier); if (why) return { cost: 0, locked: why }; }
  if (a && b) return { cost: changeCost(base, a.tier, b.tier) };
  if (b) return { cost: tierPrice(base, b.tier) };
  return { cost: a ? -sellRefund(base, a.tier) : 0 };
}