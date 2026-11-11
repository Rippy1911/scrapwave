import { FREE_PARTS, FREE_GROUPS, freePartInfo } from "@/game/workshop/freeParts";

const TIERS = [[1, "I Scrap"], [2, "II Welded"], [3, "III War-forged"]];

// Parts palette: pick a part and the tier it is placed at; shows its price, mass and HP at that tier.
export default function FreePalette({ ed }) {
  const { opt, setOpt } = ed;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {TIERS.map(([t, label]) => (
          <button key={t} type="button" onClick={() => setOpt({ tier: t })} className={`sw-btn flex-1 px-1 py-1 text-[10px] ${opt.tier === t ? "sw-btn-primary" : ""}`}>{label}</button>
        ))}
      </div>
      <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
        {FREE_GROUPS.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#c9a36a]">{g}</div>
            <div className="grid grid-cols-2 gap-1">
              {Object.keys(FREE_PARTS).filter((k) => FREE_PARTS[k].group === g).map((k) => {
                const i = freePartInfo(k, opt.tier), on = opt.type === k;
                return (
                  <button key={k} type="button" onClick={() => setOpt({ type: k, tool: "place" })}
                    className={`rounded-sm border-2 px-1.5 py-1 text-left ${on ? "border-[#f2c230] bg-[#2b2418]" : "border-[#3d3832] bg-[#171513] hover:border-[#8a6a1e]"}`}>
                    <div className="text-[11px] font-bold leading-tight text-[#e9dcc4]">{i.name}</div>
                    <div className="text-[10px] text-[#a8987f]">{i.price} scrap · {i.mass} kg{i.hp ? ` · ${i.hp} hp` : ""}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}