import { Lock } from "lucide-react";
import { roman, lockReason, tierInfo, tierPrice } from "@/game/workshop/tiers";

// I / II / III picker. Tiers above `owned` that are locked show a padlock and what unlocks them (tooltip + aria).
export default function TierPips({ value, onPick, save, base = 0, owned = 1 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((t) => {
        const why = t > owned ? lockReason(save, t) : null, on = value === t;
        const tip = why || `${tierInfo(t).name} · ${tierPrice(base, t)} scrap`;
        return (
          <button key={t} type="button" title={tip} aria-label={`Tier ${roman(t)}: ${tip}`} disabled={!!why} onClick={() => onPick(t)}
            className={`sw-display flex h-7 min-w-[2.1rem] items-center justify-center gap-0.5 rounded-sm border-2 px-1.5 text-xs transition-colors ${on ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#46413a] bg-[#1a1816] text-[#cdbfa6] hover:border-[#8a6a1e]"} ${why ? "cursor-not-allowed opacity-40" : ""}`}>
            {why && <Lock className="h-3 w-3" />}{roman(t)}
          </button>
        );
      })}
    </div>
  );
}