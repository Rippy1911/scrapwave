import { Wrench, Undo2, Redo2 } from "lucide-react";

const MAT = { wood: "Wood", sheet: "Sheet metal", concrete: "Concrete", steel: "Steel" };

// Status line for piece mode: rotation, fine mode, the piece under the mouse, undo / redo and Repair.
export default function PieceInfo({ pc, onRepair, onUndo, onRedo }) {
  const h = pc.hover;
  return (
    <div className="mx-auto mb-2 flex w-fit flex-wrap items-center justify-center gap-3 px-3 text-[11px] uppercase tracking-[0.18em] text-[#e9dcc4]">
      <span>R rotate · {pc.deg}°</span>
      <span className={pc.fine ? "text-[#f2c230]" : ""}>F fine {pc.fine ? "on" : "off"}</span>
      <span className="text-[#a8987f]">C copy · V paste · X remove</span>
      {h && <span className="text-[#f2c230]">{h.name} · {MAT[h.mat]} {["I", "II", "III"][h.tier - 1]} · {h.hp}/{h.maxHp} HP</span>}
      <span className="pointer-events-auto flex gap-1">
        <button onClick={onUndo} className="sw-btn px-2 py-0.5" title="Undo (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></button>
        <button onClick={onRedo} className="sw-btn px-2 py-0.5" title="Redo (Ctrl+Y)"><Redo2 className="h-3.5 w-3.5" /></button>
        <button onClick={onRepair} disabled={!pc.repair} className="sw-btn flex items-center gap-1 px-2 py-0.5 text-[10px] disabled:opacity-40">
          <Wrench className="h-3.5 w-3.5" />Repair{pc.repair ? ` · ${pc.repair}` : ""}
        </button>
      </span>
    </div>
  );
}