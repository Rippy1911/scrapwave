// window.scrapwake.workshop — test hooks for tiers, parts, designs, blueprints and bikes (installed by game/hooks.js).
import { UPGRADE_TIERS, WEAPONS } from "@/game/data/tuning";
import { SLOTS, partInfo } from "@/game/workshop/parts";
import { lockReason, weaponDps, tierWeapon, maxOpenTier, rulesCap } from "@/game/workshop/tiers";
import { progressOf } from "@/game/workshop/progress";
import { compileDesign, zeroTo100 } from "@/game/workshop/compile";
import { normalizeDesign, copyDesign } from "@/game/workshop/validate";
import { ownedDesign, buildDesign, setTier } from "@/game/workshop/economy";
import { listBlueprints, saveBlueprint, loadBlueprint, findBlueprint, duplicateBlueprint, deleteBlueprint, encodeDesign, decodeDesign } from "@/game/workshop/blueprints";
import { ensureWorkshop } from "@/game/workshop/store";
import { PRESETS } from "@/game/workshop/designs";
import { throwRider, isBike } from "@/game/workshop/bike";
import { freeHooks } from "@/game/workshop/hooksFree";

const GARAGE_KINDS = ["ram", "engine", "tyres", "turbo", "tank"];

export function workshopHooks(game) {
  const save = game.save, ns = () => game.noSave;
  const rebuild = () => { if (game.player) game.rebuildPlayer(); return h.state(); };
  const h = {
    // Every slot and its options with mass, HP and price at Tier I, II and III.
    parts: () => SLOTS.map((s) => ({ slot: s.key, label: s.label, cls: s.cls, options: Object.keys(s.options).map((id) => ({ id, tiers: [1, 2, 3].map((t) => { const i = partInfo(s.key, id, t); return { tier: t, name: i.name, mass: i.mass, hp: i.hp, price: i.price }; }) })) })),
    tiers: () => ({ progress: progressOf(save), open: maxOpenTier(save), rulesCap: rulesCap(), tiers: UPGRADE_TIERS.map((t) => ({ ...t, locked: lockReason(save, t.tier) })) }),
    // The design you own (built, or today's garage car as its ready-made design), and its numbers.
    design: () => { const d = ownedDesign(save); return d ? { design: d, summary: compileDesign(d).summary, ride: ensureWorkshop(save).ride } : null; },
    compile: (d) => compileDesign(d).summary,
    presets: () => PRESETS.map((p) => p.name),
    free: freeHooks(game), // free build: add / move / rotate / mirror / joints / poses on a draft, then build()
    // Pay for the changes against your car and drive it now. build(design or blueprint name).
    build(d) {
      const des = typeof d === "string" ? loadBlueprint(save, d) : d;
      if (!des) return { ok: false, msg: "No such blueprint" };
      const r = buildDesign(save, des, ns());
      if (r.ok) rebuild();
      return { ok: r.ok, msg: r.msg, total: r.bill.total, locked: r.bill.locked };
    },
    // upgrade(slot, tier): a slot of the built design ("engine", "armourFront", "weapon:2"...), or with the garage car a
    // garage upgrade ("engine", "tyres", "turbo", "tank", "ram", "weapon:mg", "module:nitro").
    upgrade(slot, tier) {
      const ws = ensureWorkshop(save), [a, b] = String(slot).split(":");
      if (ws.ride === "design" && ws.built) {
        const d = copyDesign(ws.built);
        if (a === "weapon") { const w = d.weapons[+b]; if (!w) return { ok: false, msg: "Empty mount" }; w.tier = tier; } else if (d.parts[a]) d.parts[a].tier = tier; else return { ok: false, msg: "No such slot" };
        return h.build(d);
      }
      const r = a === "weapon" || a === "module" ? setTier(save, a, b, tier, ns()) : GARAGE_KINDS.includes(a) ? setTier(save, a, null, tier, ns()) : { ok: false, msg: "No such upgrade" };
      if (r.ok) rebuild();
      return r;
    },
    blueprints: () => listBlueprints(save).map((b) => ({ name: b.name, savedAt: b.savedAt, chassis: b.design.parts.chassis.id, code: encodeDesign(b.design) })),
    save: (name, d) => saveBlueprint(save, name, d || ownedDesign(save), ns()),
    load: (name) => loadBlueprint(save, name),
    duplicate: (name, to) => duplicateBlueprint(save, name, to, ns()),
    remove: (name) => deleteBlueprint(save, name, ns()),
    exportCode: (name) => { const b = name ? findBlueprint(save, name) : null; return name && !b ? null : encodeDesign(b ? b.design : ownedDesign(save)); },
    importCode(code, name) {
      try { const d = decodeDesign(code); return { ok: true, design: d, blueprint: saveBlueprint(save, name || d.name, d, ns()).name }; } catch (e) { return { ok: false, msg: e.message }; }
    },
    // Test helpers: ride("dirtbike" | design | blueprint | "preset:Name" | "garage") for free; throwOff() unseats a bike rider.
    ride(kind) {
      const ws = ensureWorkshop(save);
      if (kind === "garage") ws.ride = "garage";
      else { const d = game.workshop.resolve(kind); if (!d) return null; ws.built = normalizeDesign(d); ws.ride = "design"; }
      return rebuild();
    },
    throwOff() { const p = game.player; if (!isBike(p) || p.thrown) return false; throwRider(game, p, "THROWN OFF"); return true; },
    state() {
      const p = game.player;
      return { chassis: p.chassisId, name: p.stats.name, bike: isBike(p), thrown: +(p.thrown || 0).toFixed(2), throws: p.throws || 0, mass: Math.round(p.mass), accel: +p.stats.accel.toFixed(2), topSpeed: Math.round(p.stats.topSpeed), grip: +p.stats.grip.toFixed(2), hull: Math.round(p.hull), maxHull: p.maxHull, weapons: p.weapons.map((w) => ({ id: w.id, tier: w.tier || 1, name: w.def.name, dps: Math.round(weaponDps(w.def)) })), tailTarget: p.tailTarget ? p.tailTarget.id : null, fire: !!p.ctl.fire };
    },
    // Numbers for the checks: each weapon's damage per second at Tier I-III, and 0-100 km/h of each preset's engine tiers.
    check() {
      const weapons = Object.keys(WEAPONS).map((id) => ({ id, dps: [1, 2, 3].map((t) => Math.round(weaponDps(tierWeapon(id, t)))), range: [1, 2, 3].map((t) => Math.round(tierWeapon(id, t).range)) }));
      const engines = PRESETS.map((p) => ({ name: p.name, zeroTo100: [1, 2, 3].map((t) => { const d = copyDesign(p); d.parts.engine.tier = t; const s = compileDesign(d).summary; return s.zeroTo100; }) }));
      return { weapons, engines, accelCheck: zeroTo100(10, 150) };
    },
  };
  return h;
}