// What the walker carries: a long gun (key 1), a sidearm (key 2), grenades (key 3, up to 3) and C4 (key 4, up to
// 2), with magazines, spare ammo, reloading and the time between shots. Guns are { id, tier, mag, spare };
// throwables are { tier, n }. L.placed is the number of C4 charges lying out (set by footCombat.js).
import { GEAR, SLOTS, STARTER, gearStats, validTier } from "@/game/onfoot/footGear";

const GUNS = ["long", "side"], THROWN = ["grenade", "c4"];
const newGun = (id, tier) => { const s = gearStats(id, tier); return { id, tier: s.tier, mag: s.mag, spare: s.spare }; };

export function createLoadout() {
  const L = { long: null, side: null, grenade: null, c4: null, sel: "long", reloadT: 0, reloadOf: 1, cd: 0, placed: 0, empty: true };
  const stats = (slot = L.sel) => { const it = L[slot]; return it ? gearStats(it.id || slot, it.tier) : null; };
  const has = (slot) => { const it = L[slot]; return !!it && (it.id ? true : it.n > 0 || (slot === "c4" && L.placed > 0)); };
  L.stats = stats; L.has = has;

  // give("sniper", 2): a gun fills its slot with a full magazine and its spare ammo; grenades and C4 fill to their limit.
  L.give = (id, tier = 1) => {
    const g = GEAR[id];
    if (!g) return false;
    L[g.slot] = g.max ? { tier: validTier(tier), n: g.max } : newGun(id, tier);
    L.empty = false;
    L.sel = g.slot; L.reloadT = 0;
    return true;
  };
  // Climbing out: empty hands get the starter kit; in a safe zone the ammo is topped back up to what each tier carries.
  L.kit = (restock) => {
    const fresh = L.empty;
    if (!fresh && !restock) return null;
    for (const s of GUNS) {
      if (!L[s]) L[s] = newGun(STARTER[s].id, STARTER[s].tier);
      else { const st = stats(s); L[s].mag = st.mag; L[s].spare = Math.max(L[s].spare, st.spare); }
    }
    for (const s of THROWN) L[s] = { tier: L[s] ? L[s].tier : STARTER[s].tier, n: Math.max(L[s] ? L[s].n : 0, STARTER[s].n) };
    L.empty = false;
    if (fresh) L.sel = "long";
    return fresh ? "starter" : "restock";
  };
  L.select = (slot) => {
    if (!has(slot) || L.sel === slot) return false;
    L.sel = slot; L.reloadT = 0; L.cd = Math.max(L.cd, 0.25);
    return true;
  };
  // One shot or throw from the selected slot: { ok, stats }, or { ok: false, why: "wait" | "reload" | "empty" | "none" }.
  L.use = () => {
    const it = L[L.sel], st = stats();
    if (!it || !st) return { ok: false, why: "none" };
    if (L.cd > 0 || L.reloadT > 0) return { ok: false, why: "wait" };
    if (it.id) {
      if (it.mag <= 0) return { ok: false, why: it.spare > 0 ? "reload" : "empty" };
      it.mag--; L.cd = st.rate;
    } else {
      if (it.n <= 0) return { ok: false, why: "empty" };
      it.n--; L.cd = 0.6;
    }
    return { ok: true, stats: st };
  };
  L.reload = () => {
    const it = L[L.sel], st = stats();
    if (!it || !it.id || L.reloadT > 0 || it.mag >= st.mag || it.spare <= 0) return false;
    L.reloadT = L.reloadOf = st.reload;
    return true;
  };
  L.step = (dt) => {
    L.cd = Math.max(0, L.cd - dt);
    if (L.reloadT > 0 && (L.reloadT -= dt) <= 0) {
      const it = L[L.sel], st = stats(), n = it && it.id ? Math.min(st.mag - it.mag, it.spare) : 0;
      if (n > 0) { it.mag += n; it.spare -= n; }
      L.reloadT = 0;
    }
    if (!has(L.sel)) L.sel = SLOTS.find(has) || L.sel; // the last grenade is gone: back to a gun
  };
  // Everything carried, as a kit for the loot bag; the hands are empty afterwards.
  L.drop = () => {
    const kit = { long: L.long, side: L.side, grenade: L.grenade, c4: L.c4 };
    Object.assign(L, { long: null, side: null, grenade: null, c4: null, reloadT: 0, cd: 0, empty: true });
    return kit;
  };
  // Picking a kit up: a gun fills an empty slot or replaces a lower tier, the same gun adds its rounds; throwables add up.
  L.take = (kit) => {
    for (const s of GUNS) {
      const k = kit[s], mine = L[s];
      if (!k) continue;
      if (!mine || k.tier > mine.tier) L[s] = { ...k };
      else if (k.id === mine.id) mine.spare += k.mag + k.spare;
    }
    for (const s of THROWN) {
      const k = kit[s];
      if (k && k.n > 0) L[s] = { tier: Math.max(k.tier, L[s] ? L[s].tier : 1), n: Math.min(GEAR[s].max, (L[s] ? L[s].n : 0) + k.n) };
    }
    L.empty = false;
  };
  L.hud = () => ({
    sel: L.sel, reload: L.reloadT > 0 ? 1 - L.reloadT / L.reloadOf : null,
    slots: SLOTS.map((s, i) => {
      const it = L[s], st = it ? stats(s) : null, isGun = !!(it && it.id);
      return { key: i + 1, slot: s, name: st ? st.name : GEAR[s] ? GEAR[s].name : null, tier: it ? it.tier : 0, mag: isGun ? it.mag : null, spare: isGun ? it.spare : null, n: it && !isGun ? it.n : null };
    }),
  });
  L.state = () => {
    const g = (s) => (L[s] ? { id: L[s].id, tier: L[s].tier } : null), a = (s) => (L[s] ? { mag: L[s].mag, spare: L[s].spare } : null);
    const n = (s) => (L[s] ? L[s].n : 0);
    return { slots: { long: g("long"), side: g("side"), grenades: n("grenade"), c4: n("c4"), selected: L.sel }, ammo: { long: a("long"), side: a("side"), grenades: n("grenade"), c4: n("c4") } };
  };
  return L;
}