// Helicopter upgrade rows: armour, rotor & engine, guns, rocket pods, fuel tank — Tier 1, 2 and 3 each.
import { UPGRADES, airSave, tierPrice } from "@/game/air/tiers";

export default function AircraftUpgrades({ save, onBuy }) {
  const tiers = airSave(save).tiers;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Object.entries(UPGRADES).map(([id, u]) => {
        const t = tiers[id] || 0, next = t + 1, maxed = t >= 3;
        return (
          <div key={id} className="flex items-center justify-between gap-2 rounded-sm border-2 border-[#46413a] bg-[#201d1a] px-3 py-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#d8cbb2]">{u.name}</div>
              <div className="mt-1 flex gap-1">{[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-6 ${i <= t ? "bg-[#f2c230]" : "bg-[#3a3631]"}`} />)}</div>
              <div className="text-[11px] text-[#a8987f]">{u.desc}</div>
            </div>
            <button disabled={maxed} onClick={() => onBuy(id)} className={`sw-btn px-3 py-1 text-xs ${maxed ? "opacity-50" : ""}`}>
              {maxed ? "Tier 3" : `T${next} · ${tierPrice(id, next)}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}