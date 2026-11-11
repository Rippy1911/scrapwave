import { useState } from "react";
import { Stamp, X, RotateCw, Grid3x3, Boxes, FolderOpen } from "lucide-react";
import ModuleTray from "@/game/ui/build/ModuleTray";
import PieceTray from "@/game/ui/build/PieceTray";
import PieceInfo from "@/game/ui/build/PieceInfo";
import BlueprintMenu from "@/game/ui/build/BlueprintMenu";
import BuildTouchRow from "@/game/ui/build/BuildTouchRow";

const REASON = { scrap: "Not enough scrap", blocked: "Blocked", pos: "Outside the plot", full: "Plot full", dark: "Base is dark" };
const tabCls = (on) => `sw-btn flex shrink-0 flex-col items-center justify-center gap-1 px-3 text-[10px] ${on ? "text-[#f2c230] border-[#8a6a1e]" : ""}`;

// Build view bottom bar: Pieces (material, tier, palette, cap meter, repair) or Modules, blueprints, leave.
export default function BuildBar({ build, game, onSelect, onStamp, onClose, touch }) {
  const [tab, setTab] = useState("pieces");
  const [bpOpen, setBpOpen] = useState(false);
  if (!build) return null;
  const pc = build.pieces, placer = game.buildView.pieces;
  const pick = (t) => { setTab(t); onSelect(null); };
  const reason = build.msg || (tab === "pieces" ? pc.reason : build.sel && (REASON[build.reason] || build.reason));
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 sw-body select-none">
      {bpOpen && <BlueprintMenu list={build.blueprints} bp={game.base.blueprints} onClose={() => setBpOpen(false)} />}
      <div className="mx-auto mb-1 flex w-fit flex-wrap items-center justify-center gap-3 px-3 text-xs uppercase tracking-[0.2em] text-[#e9dcc4]">
        <span className="sw-display text-base text-[#f2c230]">{build.plot}</span>
        <span>Banked <b className="text-[#f2c230]">{build.bank}</b></span>
        <span>Stash <b className="text-[#7fe0a0]">{build.stash}</b></span>
        {tab === "modules" && <span>{build.count}/40 modules</span>}
        {tab === "modules" && <span className="flex items-center gap-1"><RotateCw className="h-3 w-3" /> R rotate · {build.rot * 90}°</span>}
        <span className="text-[#a8987f]">{touch ? "Drag to aim · lift to place" : "Click place · right click cancel · Esc leave"}</span>
      </div>
      {touch && <BuildTouchRow game={game} />}
      {tab === "pieces" && <PieceInfo pc={pc} onRepair={() => game.base.repairPieces()} onUndo={() => placer.undo()} onRedo={() => placer.redo()} />}
      {reason && <div className="mx-auto mb-2 w-fit sw-panel px-4 py-1 text-sm text-[#ff8a6a] sw-slide">{reason}</div>}
      <div className="sw-panel mx-auto flex max-w-full gap-1 overflow-x-auto px-3 py-2 md:w-fit">
        <button onClick={() => pick("pieces")} className={tabCls(tab === "pieces")}><Grid3x3 className="h-5 w-5" />Pieces</button>
        <button onClick={() => pick("modules")} className={tabCls(tab === "modules")}><Boxes className="h-5 w-5" />Modules</button>
        <div className="mx-1 w-px shrink-0 bg-[#46413a]" />
        {tab === "pieces" ? <PieceTray pc={pc} placer={placer} onSelect={onSelect} /> : <ModuleTray modules={build.modules} sel={build.sel} onSelect={onSelect} />}
        <div className="mx-1 w-px shrink-0 bg-[#46413a]" />
        <button onClick={() => setBpOpen((o) => !o)} className={tabCls(bpOpen)}><FolderOpen className="h-5 w-5" />Blueprints</button>
        <button onClick={onStamp} disabled={!build.canStamp} className="sw-btn flex shrink-0 flex-col items-center justify-center gap-1 px-3 text-[10px] disabled:opacity-40"><Stamp className="h-5 w-5" />Last cycle</button>
        <button onClick={onClose} className="sw-btn flex shrink-0 flex-col items-center justify-center gap-1 px-3 text-[10px]"><X className="h-5 w-5" />Leave</button>
      </div>
      {build.outlines > 0 && <div className="mx-auto mb-2 mt-1 w-fit text-[11px] uppercase tracking-[0.2em] text-[#f2c230]">{build.outlines} blueprint outline{build.outlines > 1 ? "s" : ""} waiting for scrap</div>}
    </div>
  );
}