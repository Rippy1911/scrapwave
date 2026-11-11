// Free-build editing (A): place, move, rotate, mirror, copy / paste and remove parts on the grid, with symmetry
// (a part off the centre line gets a mirrored twin, kept in step), snapping (0.25 m grid, 0.05 m fine) and an
// undo / redo history. Every op takes a design and returns a new one; the input is never changed.
// mode "drive" edits drive placements (p, r); mode "walk" edits walker placements (w).
import { FREE_PARTS, isJoint, freeWeaponsFor } from "@/game/workshop/freeParts";
import { normalizeFree, HARD_CAP } from "@/game/workshop/freeValidate";
import { torsoFor, toDrive, placeOf } from "@/game/workshop/torso";
import { copyDesign } from "@/game/workshop/designs";

export const GRID = 0.25, FINE = 0.05;
export const snap = (x, fine) => { const s = fine ? FINE : GRID; return Math.round(x / s) * s; };
const snap3 = (p, fine) => p.map((x) => +snap(x, fine).toFixed(3));
const mirP = (p) => [+(-p[0]).toFixed(3), p[1], p[2]];
const mirR = (r) => [r[0], r[1] ? -r[1] : 0, r[2] ? -r[2] : 0];
const freeOf = (d) => (d.free ? d.free : { parts: [], poses: [], next: 1 });
const finish = (d, free) => { const out = { ...copyDesign(d), free: normalizeFree(free) }; if (!out.free) delete out.free; return out; };
export const findPart = (d, id) => (d.free?.parts || []).find((p) => p.id === id) || null;

// Sets a placement in one mode. Drive edits leave a separate walker placement alone; walk edits create one.
function setPlace(part, mode, pl) {
  if (mode === "walk") part.w = { p: pl.p, r: pl.r };
  else { part.p = pl.p; part.r = pl.r; }
}

// add(design, "block", [x, y, z], { mode, sym, fine, tier, r }) -> { design, ids }
export function addPart(d, type, at, o = {}) {
  const F = copyDesign(freeOf(d));
  if (!FREE_PARTS[type]) return { design: d, ids: [] };
  if (F.parts.length >= HARD_CAP) return { design: d, ids: [], full: true };
  if (FREE_PARTS[type].unique && F.parts.some((p) => p.t === type)) return { design: d, ids: [], unique: true };
  const T = torsoFor(d), mode = o.mode || "drive", r = o.r || [0, 0, 0];
  const pos = snap3(at, o.fine);
  const make = (p, rr) => {
    const part = { id: F.next++, t: type, tier: o.tier || 1, p, r: rr };
    if (mode === "walk") { const dr = toDrive(T, p, rr); part.p = dr.p; part.r = dr.r; part.w = { p, r: rr }; }
    if (FREE_PARTS[type].mount) { const w = freeWeaponsFor(type)[0]; part.wpn = { id: type === "heavyMount" ? "armCannon" : w, tier: o.tier || 1 }; }
    if (o.limb) part.limb = o.limb;
    F.parts.push(part);
    return part;
  };
  const a = make(pos, r), ids = [a.id];
  if (o.sym !== false && Math.abs(pos[0]) > 0.01 && !FREE_PARTS[type].unique && F.parts.length < HARD_CAP) {
    const b = make(mirP(pos), mirR(r));
    a.mir = b.id; b.mir = a.id; ids.push(b.id);
    if (o.limb) { const lj = F.parts.find((x) => x.id === o.limb); if (lj && lj.mir) b.limb = lj.mir; }
  }
  return { design: finish(d, F), ids };
}

// Apply fn(part, twin?) to a part and, with symmetry, its mirrored twin.
function edit(d, id, fn, sym = true) {
  const F = copyDesign(freeOf(d)), part = F.parts.find((p) => p.id === id);
  if (!part) return d;
  const twin = sym && part.mir ? F.parts.find((p) => p.id === part.mir) : null;
  fn(part, false, F);
  if (twin) fn(twin, true, F, part);
  return finish(d, F);
}

export function movePart(d, id, at, o = {}) {
  const pos = snap3(at, o.fine), T = torsoFor(d), mode = o.mode || "drive";
  return edit(d, id, (p, isTwin) => { const cur = placeOf(T, p, mode); setPlace(p, mode, { p: isTwin ? mirP(pos) : pos, r: cur.r }); }, o.sym !== false);
}

// Turn a part by step degrees about "x" | "y" | "z" (90 by default, 15 in fine mode).
export function rotatePart(d, id, axis, o = {}) {
  const step = o.step || (o.fine ? 15 : 90), i = { x: 0, y: 1, z: 2 }[axis] ?? 1, T = torsoFor(d), mode = o.mode || "drive";
  return edit(d, id, (p, isTwin) => {
    const cur = placeOf(T, p, mode), r = [...cur.r];
    r[i] += isTwin && i !== 0 ? -step : step;
    setPlace(p, mode, { p: cur.p, r });
  }, o.sym !== false);
}

// Mirror a part across the centre line as a new twin (when symmetry was off), or flip a centred part.
export function mirrorPart(d, id) {
  const src = findPart(d, id);
  if (!src || src.mir) return { design: d, ids: [] };
  if (Math.abs(src.p[0]) < 0.01) return { design: edit(d, id, (p) => { p.r = mirR(p.r); if (p.w) p.w.r = mirR(p.w.r); }, false), ids: [id] };
  const F = copyDesign(freeOf(d)), a = F.parts.find((p) => p.id === id);
  if (F.parts.length >= HARD_CAP) return { design: d, ids: [] };
  const b = { ...copyDesign(a), id: F.next++, p: mirP(a.p), r: mirR(a.r), mir: a.id };
  if (a.w) b.w = { p: mirP(a.w.p), r: mirR(a.w.r) };
  delete b.key;
  a.mir = b.id; F.parts.push(b);
  return { design: finish(d, F), ids: [b.id] };
}

export function removePart(d, id, o = {}) {
  const F = copyDesign(freeOf(d)), part = F.parts.find((p) => p.id === id);
  if (!part) return d;
  const gone = new Set([id]);
  if (o.sym !== false && part.mir) gone.add(part.mir);
  F.parts = F.parts.filter((p) => !gone.has(p.id));
  for (const p of F.parts) { if (gone.has(p.limb)) delete p.limb; if (gone.has(p.mir)) delete p.mir; }
  for (const s of F.poses) for (const g of gone) delete s.values[g];
  return finish(d, F);
}

// Change a part's settings: { tier, role, key, pose, min, max, spin, wpn, limb }. The twin follows (its limb is
// the twin of the chosen joint; a key binding stays on the part you set it on).
export function setPartProps(d, id, patch, o = {}) {
  return edit(d, id, (p, isTwin, F) => {
    for (const [k, v] of Object.entries(patch)) {
      if (k === "key" && isTwin) continue;
      if (k === "limb") {
        const j = F.parts.find((x) => x.id === v);
        const want = isTwin && j && j.mir ? j.mir : v;
        if (want && want !== p.id) p.limb = want; else delete p.limb;
        continue;
      }
      if (v === null || v === undefined || v === "") delete p[k]; else p[k] = k === "wpn" ? { ...v } : v;
    }
    if (!isJoint(p.t)) { delete p.role; delete p.key; delete p.pose; }
  }, o.sym !== false);
}

// Copy parts (relative to their centre) and paste them at a point as new parts, keeping limbs inside the group.
export function copyParts(d, ids) {
  const parts = ids.map((id) => findPart(d, id)).filter(Boolean);
  if (!parts.length) return null;
  const c = [0, 1, 2].map((i) => parts.reduce((a, p) => a + p.p[i], 0) / parts.length);
  return parts.map((p) => ({ ...copyDesign(p), p: p.p.map((x, i) => x - c[i]), w: undefined, mir: undefined }));
}
export function pasteParts(d, clip, at, o = {}) {
  if (!clip || !clip.length) return { design: d, ids: [] };
  const F = copyDesign(freeOf(d)), map = new Map(), ids = [];
  for (const c of clip) {
    if (F.parts.length >= HARD_CAP) break;
    if (FREE_PARTS[c.t].unique && F.parts.some((p) => p.t === c.t)) continue;
    const n = { ...copyDesign(c), id: F.next++, p: snap3(c.p.map((x, i) => x + at[i]), o.fine) };
    delete n.w; delete n.mir; map.set(c.id, n.id); F.parts.push(n); ids.push(n.id);
  }
  for (const id of ids) { const p = F.parts.find((x) => x.id === id); p.limb = map.get(p.limb); if (!p.limb) delete p.limb; }
  return { design: finish(d, F), ids };
}

// Undo / redo: a bounded stack of design snapshots.
export function createHistory(limit = 80) {
  const past = [], future = [];
  return {
    push(d) { past.push(JSON.stringify(d)); if (past.length > limit) past.shift(); future.length = 0; },
    undo(cur) { if (!past.length) return null; future.push(JSON.stringify(cur)); return JSON.parse(past.pop()); },
    redo(cur) { if (!future.length) return null; past.push(JSON.stringify(cur)); return JSON.parse(future.pop()); },
    sizes: () => ({ undo: past.length, redo: future.length }),
  };
}