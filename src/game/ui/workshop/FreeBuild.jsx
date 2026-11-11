import { useEffect } from "react";
import { useFreeEditor } from "@/game/ui/workshop/useFreeEditor";
import FreeViewport from "@/game/ui/workshop/FreeViewport";
import FreePalette from "@/game/ui/workshop/FreePalette";
import FreeToolbar from "@/game/ui/workshop/FreeToolbar";
import JointsPanel from "@/game/ui/workshop/JointsPanel";
import PosesPanel from "@/game/ui/workshop/PosesPanel";
import FreeStats from "@/game/ui/workshop/FreeStats";
import { wreckframeDesign } from "@/game/mech/wreckframe";
import { scuttlerDesign } from "@/game/mech/scuttler";

const Box = ({ title, children }) => (
  <div className="rounded-sm border-2 border-[#3d3832] bg-[#171513] p-2.5">
    <div className="mb-1.5 text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">{title}</div>{children}
  </div>
);

// Free build: weld parts anywhere on the 3D grid, hang them on joints, bind keys and poses, check the numbers.
export default function FreeBuild({ design, setDesign, game, save, c, bill }) {
  const ed = useFreeEditor(design, setDesign, save.quality);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) ed.ops.redo(); else ed.ops.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") { e.preventDefault(); ed.ops.redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyC") ed.ops.copy();
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyV") ed.ops.paste();
      else if (e.code === "Delete" || e.code === "Backspace") ed.ops.remove();
      else if (e.code === "KeyR") ed.ops.rotate("y");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[14rem_1fr_17rem]">
      <div className="order-2 lg:order-1"><Box title="Parts"><FreePalette ed={ed} /></Box></div>
      <div className="order-1 flex flex-col gap-2 lg:order-2">
        <FreeToolbar ed={ed} />
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border-2 border-[#3d3832] bg-[radial-gradient(ellipse_at_center,#3a3128_0%,#14110e_75%)]">
          <FreeViewport game={game} design={design} ed={ed} />
          <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.2em] text-[#a8987f]">{ed.opt.mode === "walk" ? "Walker placements" : "Drive placements"} · left click {ed.opt.tool} · right drag orbit · wheel zoom</div>
        </div>
        {ed.msg && <div className="text-xs text-[#f2c230]">{ed.msg}</div>}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => { setDesign(wreckframeDesign()); ed.setSel([]); }} className="sw-btn px-3 py-1 text-[11px]">Load Wreckframe</button>
          <button type="button" onClick={() => { setDesign(scuttlerDesign()); ed.setSel([]); }} className="sw-btn px-3 py-1 text-[11px]">Load Scuttler</button>
          <button type="button" onClick={ed.ops.clear} className="sw-btn px-3 py-1 text-[11px]">Clear free parts</button>
        </div>
      </div>
      <div className="order-3 flex flex-col gap-3">
        <Box title="Selected part"><JointsPanel design={design} ed={ed} /></Box>
        <Box title="Poses"><PosesPanel design={design} ed={ed} /></Box>
        <Box title="Machine"><FreeStats c={c} count={ed.count} cap={ed.cap} /></Box>
        {bill}
      </div>
    </div>
  );
}