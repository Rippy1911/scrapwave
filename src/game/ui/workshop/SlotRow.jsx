import { optionsFor, partInfo, slotDef } from "@/game/workshop/parts";
import TierPips from "@/game/ui/workshop/TierPips";

// One part slot: its options (mass, HP, price at the chosen tier) and the tier picker for the fitted part.
export default function SlotRow({ slot, cls, part, owned, save, onPart, onTier }) {
  const def = slotDef(slot), opts = optionsFor(slot, cls);
  const cur = partInfo(slot, part.id, part.tier);
  const ownedTier = owned && owned.id === part.id ? owned.tier : 1;
  return (
    <div className="flex flex-col gap-1.5 border-b border-[#2f2b26] pb-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">{def.label}</span>
        {cur.cost > 0 && <TierPips value={part.tier} onPick={onTier} save={save} base={cur.cost} owned={ownedTier} />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map(([id]) => {
          const i = partInfo(slot, id, id === part.id ? part.tier : 1), on = id === part.id;
          return (
            <button key={id} type="button" onClick={() => onPart(id)}
              className={`rounded-sm border-2 px-2 py-1 text-left text-[11px] transition-colors ${on ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#3d3832] bg-[#1c1a17] text-[#d8cbb2] hover:border-[#8a6a1e]"}`}>
              <div className="font-bold uppercase tracking-wider">{i.name}</div>
              <div className="text-[10px] text-[#9d907b]">{i.mass} kg{i.hp ? ` · ${i.hp} hp` : ""}{i.power ? ` · ${i.power} kN` : ""}{i.cost ? ` · ${i.price}` : ""}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}