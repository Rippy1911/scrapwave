// Upgrade tiers (A): I "Scrap", II "Welded", III "War-forged" — unlocks, prices, stat scaling and weapon tier entries.
// Numbers live in tuning.js (UPGRADE_TIERS, TIER_WEAPON); this file only applies them.
import { UPGRADE_TIERS, TIER_WEAPON, WEAPONS } from "@/game/data/tuning";
import { progressOf } from "@/game/workshop/progress";
import { getRules } from "@/game/rules/state";

export const clampTier = (t) => Math.max(1, Math.min(3, Math.round(Number(t) || 1)));
export const tierInfo = (t) => UPGRADE_TIERS[clampTier(t) - 1];
export const roman = (t) => tierInfo(t).roman;

// Custom games may cap upgrades with rules.maxTier (Main adds the field); absent = no cap.
export function rulesCap() {
  const r = getRules();
  return r && r.maxTier ? clampTier(r.maxTier) : 3;
}

// null when the tier can be fitted, otherwise a short reason naming what unlocks it.
export function lockReason(save, t) {
  t = clampTier(t);
  const cap = rulesCap();
  if (t > cap) return `These rules cap upgrades at tier ${roman(cap)}`;
  const u = tierInfo(t).unlock;
  if (!u) return null;
  const p = progressOf(save);
  if (p.jobs >= u.jobs || p.story >= u.story) return null;
  return `Unlocks at ${u.jobs} jobs & contracts (${p.jobs} done) or ${u.storyLabel}`;
}
export const tierOpen = (save, t) => !lockReason(save, t);
export function maxOpenTier(save) {
  let t = 1;
  while (t < 3 && tierOpen(save, t + 1)) t++;
  return t;
}
export const fitTier = (save, t) => Math.min(clampTier(t), maxOpenTier(save));

// Prices: tier price = base × tier cost. Upgrading pays the difference; going down or selling refunds half.
export const tierPrice = (base, t) => Math.round(base * tierInfo(t).cost);
export function changeCost(base, from, to) {
  const d = tierPrice(base, to) - tierPrice(base, from);
  return d >= 0 ? d : Math.round(d / 2);
}
export const sellRefund = (base, t) => Math.floor(tierPrice(base, t) / 2);
export const statMul = (t) => tierInfo(t).stat;
export const massMul = (t) => tierInfo(t).mass;

// Weapon tier entry: same shape as today's def (the weapon code reads it unchanged), better numbers.
// Reload weapons: dmg x stat x reload factor, so damage per second steps by exactly the tier's stat.
export function tierDef(base, t) {
  t = clampTier(t);
  if (t === 1) return base;
  const i = t - 1, W = TIER_WEAPON, d = { ...base, tier: t, name: `${base.name} ${roman(t)}` };
  const reloads = typeof base.reload === "number";
  if (typeof base.dps === "number") d.dps = base.dps * W.dmg[i];
  if (typeof base.dmg === "number") d.dmg = base.dmg * W.dmg[i] * (reloads ? W.reload[i] : 1);
  if (typeof base.burnDps === "number") d.burnDps = base.burnDps * W.dmg[i];
  for (const f of ["range", "splash", "speed", "cone"]) if (typeof base[f] === "number") d[f] = base[f] * W.range[i];
  if (reloads) d.reload = base.reload * W.reload[i];
  if (typeof base.heat === "number") d.heat = base.heat * W.heat[i];
  return d;
}
const table = {};
export function weaponTiers(id) {
  const base = WEAPONS[id];
  if (!base) return null;
  if (!table[id]) table[id] = [base, tierDef(base, 2), tierDef(base, 3)];
  return table[id];
}
export const tierWeapon = (id, t) => (weaponTiers(id) || [])[clampTier(t) - 1] || WEAPONS[id];

// Damage per second of a def, for the stats panels and the hook checks.
export function weaponDps(d) {
  if (!d) return 0;
  if (d.kind === "hitscan" || d.kind === "flame") return d.dps;
  if (d.kind === "pellets") return (d.dmg * d.pellets) / d.reload;
  if (d.kind === "shell") return d.dps;
  if (d.kind === "rocket" || d.kind === "harpoon") return (d.dmg * (d.count || 1)) / d.reload;
  return d.dps || 0;
}