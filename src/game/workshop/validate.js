// Validate and clamp any design (saved, imported, or from a hook): unknown parts fall back to the chassis default,
// tiers clamp to I-III, weapons must fit their mount size, names are trimmed. Older blueprint versions upgrade here.
import { SLOTS, CHASSIS_PARTS, clsOf, slotsFor, optionsFor, mountList, weaponsFor } from "@/game/workshop/parts";
import { clampTier } from "@/game/workshop/tiers";
import { DESIGN_VERSION, PRESETS, copyDesign } from "@/game/workshop/designs";
import { normalizeFree } from "@/game/workshop/freeValidate";
import { sanitizeWings } from "@/game/workshop/wings";

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT = { car: PRESETS[0], bike: PRESETS.find((p) => p.parts.chassis.id === "dirtbike") };

export function cleanName(n, fallback = "Blueprint") {
  const s = String(n ?? "").replace(/[^\w \-'.!#]/g, "").trim().slice(0, 28);
  return s || fallback;
}

export function normalizeDesign(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const parts = d.parts && typeof d.parts === "object" ? d.parts : {};
  const chassisId = CHASSIS_PARTS[parts.chassis?.id] ? parts.chassis.id : "light";
  const cls = clsOf(chassisId);
  const base = DEFAULT[cls];
  const out = { v: DESIGN_VERSION, name: cleanName(d.name, base.name), paint: HEX.test(d.paint || "") ? d.paint : base.paint, parts: {}, weapons: [] };
  for (const s of slotsFor(cls)) {
    const want = parts[s.key] || {};
    const ok = optionsFor(s.key, cls).some(([id]) => id === want.id);
    const id = s.key === "chassis" ? chassisId : ok ? want.id : (base.parts[s.key]?.id ?? optionsFor(s.key, cls)[0][0]);
    out.parts[s.key] = { id, tier: clampTier(want.tier) };
  }
  const mounts = mountList(chassisId), ws = Array.isArray(d.weapons) ? d.weapons : [];
  out.weapons = mounts.map((size, i) => {
    const w = ws[i];
    if (!w || !weaponsFor(size).includes(w.id)) return null;
    return { id: w.id, tier: clampTier(w.tier) };
  });
  const free = cls === "car" ? normalizeFree(d.free) : null; // free build (v2): cars only; v1 blueprints have none
  if (free) out.free = free;
  // Wings (round 13): cars only, one per side plus one tail fin. Stored without the runtime HP fields.
  const wings = cls === "car" ? sanitizeWings(d.wings).map((w) => ({ id: w.id, tier: w.tier, side: w.side })) : [];
  if (wings.length) out.wings = wings;
  return out;
}

export const designClass = (d) => clsOf(d?.parts?.chassis?.id);
export const sameDesign = (a, b) => JSON.stringify(normalizeDesign(a)) === JSON.stringify(normalizeDesign(b));
export const SLOT_KEYS = SLOTS.map((s) => s.key);
export { copyDesign };