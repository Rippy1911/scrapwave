// Blueprints (D): named designs in the save — save (a second save under the same name revises it), load, duplicate,
// delete — and share codes: "SW1." + base64url(JSON). Every code is validated and clamped by normalizeDesign.
import { ensureWorkshop, commit } from "@/game/workshop/store";
import { normalizeDesign, cleanName, copyDesign } from "@/game/workshop/validate";
import { DESIGN_VERSION } from "@/game/workshop/designs";

// Codes stay "SW1." (version 1 codes have no free build); a free build of up to 300 parts needs the longer limit.
const MAX_BLUEPRINTS = 40, MAX_CODE = 60000, PREFIX = "SW1.";
const find = (save, name) => ensureWorkshop(save).blueprints.find((b) => b.name.toLowerCase() === String(name).toLowerCase());

export const listBlueprints = (save) => ensureWorkshop(save).blueprints.map((b) => ({ name: b.name, v: b.v, savedAt: b.savedAt, design: normalizeDesign(b.design) }));
export const findBlueprint = (save, name) => { const b = find(save, name); return b ? { ...b, design: normalizeDesign(b.design) } : null; };

export function saveBlueprint(save, name, design, noSave = false) {
  const ws = ensureWorkshop(save), n = cleanName(name || design?.name);
  const d = normalizeDesign({ ...design, name: n }), old = find(save, n);
  if (old) Object.assign(old, { v: DESIGN_VERSION, design: d, savedAt: Date.now(), revision: (old.revision || 1) + 1 });
  else {
    if (ws.blueprints.length >= MAX_BLUEPRINTS) throw new Error(`At most ${MAX_BLUEPRINTS} blueprints: delete one first`);
    ws.blueprints.push({ name: n, v: DESIGN_VERSION, design: d, savedAt: Date.now(), revision: 1 });
  }
  commit(save, noSave);
  return findBlueprint(save, n);
}

export function loadBlueprint(save, name) {
  const b = findBlueprint(save, name);
  return b ? copyDesign(b.design) : null;
}

export function duplicateBlueprint(save, name, newName, noSave = false) {
  const b = find(save, name);
  if (!b) return null;
  let n = cleanName(newName || `${b.name} copy`), i = 2;
  while (find(save, n)) n = cleanName(`${b.name} copy ${i++}`);
  return saveBlueprint(save, n, b.design, noSave);
}

export function deleteBlueprint(save, name, noSave = false) {
  const ws = ensureWorkshop(save), before = ws.blueprints.length;
  ws.blueprints = ws.blueprints.filter((b) => b.name.toLowerCase() !== String(name).toLowerCase());
  commit(save, noSave);
  return ws.blueprints.length < before;
}

// ---- share codes ----
const toB64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))));

export function encodeDesign(design) {
  const d = normalizeDesign(design);
  const p = Object.entries(d.parts).map(([k, x]) => [k, x.id, x.tier]);
  const w = d.weapons.map((x) => (x ? [x.id, x.tier] : 0));
  const f = d.free ? { p: d.free.parts, s: d.free.poses, n: d.free.next } : undefined; // v2: the free build
  return PREFIX + toB64u(JSON.stringify({ v: DESIGN_VERSION, n: d.name, c: d.paint, p, w, f }));
}

// Returns a clean design, or throws with a reason a player can read.
export function decodeDesign(code) {
  const s = String(code || "").trim();
  if (!s.startsWith(PREFIX)) throw new Error("Not a Scrapwave blueprint code");
  if (s.length > MAX_CODE) throw new Error("Code is too long");
  let o;
  try { o = JSON.parse(fromB64u(s.slice(PREFIX.length))); } catch { throw new Error("Code is damaged"); }
  if (!o || typeof o !== "object" || !Array.isArray(o.p)) throw new Error("Code has no parts");
  const parts = {};
  for (const e of o.p.slice(0, 20)) if (Array.isArray(e) && typeof e[0] === "string") parts[e[0]] = { id: String(e[1]), tier: e[2] };
  const weapons = (Array.isArray(o.w) ? o.w.slice(0, 8) : []).map((e) => (Array.isArray(e) ? { id: String(e[0]), tier: e[1] } : null));
  const free = o.f && typeof o.f === "object" ? { parts: o.f.p, poses: o.f.s, next: o.f.n } : undefined;
  return normalizeDesign({ name: o.n, paint: o.c, parts, weapons, free });
}