import { KINDS, KIND_IDS } from "@/game/arena/custom/kinds";

const GROUPS = [["solid", "Walls and blocks"], ["ramp", "Ramps"], ["prop", "Smashables"], ["point", "Markers"]];
const cls = (on) => `flex min-h-[40px] items-center gap-1.5 rounded-sm border-2 px-2 py-1 text-xs uppercase tracking-wider ${on ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#46413a] bg-[#201d1a] text-[#d8cbb2]"}`;

// The map builder's piece picker, with Erase. Buttons are finger sized so it works on a phone or tablet.
export default function MapPalette({ tool, onTool }) {
  return (
    <div className="flex flex-col gap-2">
      {GROUPS.map(([g, label]) => (
        <div key={g}>
          <div className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">{label}</div>
          <div className="flex flex-wrap gap-1.5">
            {KIND_IDS.filter((k) => KINDS[k].group === g).map((k) => (
              <button key={k} type="button" onClick={() => onTool(k)} className={cls(tool === k)}>
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KINDS[k].color }} />
                {KINDS[k].name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onTool("erase")} className={cls(tool === "erase")}>Erase</button>
    </div>
  );
}