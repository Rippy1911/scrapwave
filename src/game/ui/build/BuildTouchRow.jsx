import { RotateCw, Trash2, X } from "lucide-react";

const cls = "sw-btn flex min-h-[44px] items-center gap-1.5 px-4 text-xs";

// Build view on a touch screen: the keys a finger cannot press. Turn (R), remove the piece under the ghost (X) and
// put the piece down (right click). Drag on the plot to move the ghost; lift the finger to place.
export default function BuildTouchRow({ game }) {
  const bv = game.buildView, placer = bv.pieces;
  const turn = () => { if (placer.st.sel) placer.rotate(1); else bv.rot = (bv.rot + 1) & 3; };
  return (
    <div className="mx-auto mb-2 flex w-fit flex-wrap justify-center gap-2">
      <button type="button" onClick={turn} className={cls}><RotateCw className="h-4 w-4" />Turn</button>
      <button type="button" onClick={() => placer.erase()} className={cls}><Trash2 className="h-4 w-4" />Remove</button>
      <button type="button" onClick={() => bv.select(null)} className={cls}><X className="h-4 w-4" />Put down</button>
    </div>
  );
}