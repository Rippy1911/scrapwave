import { useEffect, useRef } from "react";
import { createEditorScene } from "@/game/ui/workshop/editorScene";

// The free-build 3D view. Left click: place (Place tool), select (Select tool, Shift adds) or move the selected part
// (Move tool). Right drag orbits, the wheel zooms. A ghost shows where the part will go.
export default function FreeViewport({ game, design, ed }) {
  const ref = useRef(null), sc = useRef(null), drag = useRef(null);
  const { opt, sel, preview } = ed;
  useEffect(() => {
    const s = createEditorScene(ref.current, game);
    sc.current = s;
    return () => s.dispose();
  }, [game]);
  useEffect(() => { if (sc.current) sc.current.setDesign(design, opt.mode, preview); }, [design, opt.mode, preview]);
  useEffect(() => { if (sc.current) sc.current.highlight(sel); }, [sel, design, opt.mode, preview]);

  const at = (e) => { const r = ref.current.getBoundingClientRect(); return sc.current.pick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
  const onMove = (e) => {
    if (drag.current) { sc.current.orbit(e.clientX - drag.current.x, e.clientY - drag.current.y); drag.current = { x: e.clientX, y: e.clientY }; return; }
    const p = opt.tool === "select" ? null : at(e);
    sc.current.ghost(p && p.at, opt.tool === "move" && sel[0] ? "block" : opt.type);
  };
  const onDown = (e) => {
    if (e.button === 2 || e.button === 1) { drag.current = { x: e.clientX, y: e.clientY }; return; }
    const p = at(e);
    if (opt.tool === "place") { if (p) ed.ops.place(p.at); return; }
    if (opt.tool === "move") { if (p && sel[0]) ed.ops.move(p.at); return; }
    if (!p || !p.fid) { if (!e.shiftKey) ed.setSel([]); return; }
    ed.setSel(e.shiftKey ? (sel.includes(p.fid) ? sel.filter((x) => x !== p.fid) : [...sel, p.fid]) : [p.fid]);
  };
  return (
    <canvas
      ref={ref}
      className="h-full w-full cursor-crosshair"
      aria-label="Free build editor: click to place or select parts, right drag to orbit"
      onPointerMove={onMove}
      onPointerDown={onDown}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; sc.current && sc.current.ghost(null); }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => sc.current.zoom(e.deltaY)}
    />
  );
}