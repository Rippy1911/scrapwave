// Editor state for the free build: the tool, the palette pick, symmetry / fine snapping, Drive or Walker view,
// the selection, the clipboard, undo / redo and the joint preview sliders. Every edit goes through freeEdit.js.
import { useRef, useState } from "react";
import { addPart, movePart, rotatePart, mirrorPart, removePart, setPartProps, copyParts, pasteParts, createHistory } from "@/game/workshop/freeEdit";
import { savePose, removePose } from "@/game/workshop/freePoses";
import { partCap, freeCount } from "@/game/workshop/freeValidate";

export function useFreeEditor(design, setDesign, quality) {
  const hist = useRef(createHistory());
  const [opt, setOptState] = useState({ tool: "place", type: "block", tier: 1, mode: "drive", sym: true, fine: false });
  const [sel, setSel] = useState([]);
  const [clip, setClip] = useState(null);
  const [preview, setPreview] = useState({});
  const [msg, setMsg] = useState("");
  const [, setTick] = useState(0);
  const cap = partCap(quality), count = freeCount(design);
  const setOpt = (patch) => setOptState((o) => ({ ...o, ...patch }));
  const apply = (next) => { if (!next || next === design) return; hist.current.push(design); setDesign(next); setTick((t) => t + 1); };
  const o = { mode: opt.mode, sym: opt.sym, fine: opt.fine, tier: opt.tier };
  const id = sel[0];
  const ops = {
    place(at) {
      if (count >= cap) { setMsg(`Part cap reached (${cap})`); return; }
      const r = addPart(design, opt.type, at, o);
      if (r.unique) { setMsg("Only one Transform Core per machine"); return; }
      if (r.full) { setMsg("Part cap reached"); return; }
      apply(r.design); setSel(r.ids.slice(0, 1)); setMsg("");
    },
    move(at) { if (id) apply(movePart(design, id, at, o)); },
    rotate(axis) { if (id) apply(rotatePart(design, id, axis, o)); },
    mirror() { if (!id) return; const r = mirrorPart(design, id); apply(r.design); if (!r.ids.length) setMsg("Already mirrored"); },
    remove() { if (!id) return; let d = design; for (const x of sel) d = removePart(d, x, o); apply(d); setSel([]); },
    props(patch) { if (id) apply(setPartProps(design, id, patch, o)); },
    copy() { const c = copyParts(design, sel); if (c) { setClip(c); setMsg(`Copied ${c.length} part${c.length > 1 ? "s" : ""}`); } },
    paste(at) { if (!clip) return; const r = pasteParts(design, clip, at || [0, 1.5, 0], o); apply(r.design); setSel(r.ids); },
    undo() { const d = hist.current.undo(design); if (d) { setDesign(d); setSel([]); } },
    redo() { const d = hist.current.redo(design); if (d) { setDesign(d); setSel([]); } },
    savePose(name, key) { apply(savePose(design, name, key, preview)); setMsg(`Pose "${name}" saved`); },
    removePose(name) { apply(removePose(design, name)); },
    clear() { const d = { ...design }; delete d.free; apply(d); setSel([]); setPreview({}); },
  };
  return { opt, setOpt, sel, setSel, clip, preview, setPreview, msg, setMsg, ops, cap, count, sizes: hist.current.sizes() };
}