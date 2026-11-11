// Build view undo / redo and the copy clipboard. Actions: { type: "add" | "del", spec } where spec is a piece
// description ({ kind, mat, tier, lx, lz, yaw }). Undoing an add removes it (refunded), undoing a removal rebuilds it.
const MAX = 60;

export function createHistory({ add, del }) {
  const undo = [], redo = [];
  let clip = null;
  const run = (a, inverse) => ((a.type === "add") !== inverse ? add(a.spec) : del(a.spec));
  return {
    push(type, spec) { undo.push({ type, spec: { ...spec } }); if (undo.length > MAX) undo.shift(); redo.length = 0; },
    undo() { const a = undo.pop(); if (!a) return false; const ok = run(a, true); if (ok) redo.push(a); else undo.push(a); return ok; },
    redo() { const a = redo.pop(); if (!a) return false; const ok = run(a, false); if (ok) undo.push(a); else redo.push(a); return ok; },
    copy(spec) { clip = spec ? { kind: spec.kind, mat: spec.mat, tier: spec.tier, yaw: spec.yaw } : null; return clip; },
    paste: () => clip,
    state: () => ({ undo: undo.length, redo: redo.length, clip: clip ? clip.kind : null }),
    clear() { undo.length = 0; redo.length = 0; },
  };
}