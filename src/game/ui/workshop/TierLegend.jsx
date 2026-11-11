import { UPGRADE_TIERS } from "@/game/data/tuning";
import { lockReason } from "@/game/workshop/tiers";
import { progressOf } from "@/game/workshop/progress";

// The three tiers: price factor, stat step, and what unlocks each (with your progress).
export default function TierLegend({ save }) {
  const p = progressOf(save);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-2">
        {UPGRADE_TIERS.map((t) => {
          const why = lockReason(save, t.tier);
          return (
            <div key={t.tier} className={`rounded-sm border-2 px-3 py-2 ${why ? "border-[#3a352e] bg-[#181614]" : "border-[#5a4a2a] bg-[#221e19]"}`}>
              <div className="flex items-baseline gap-2">
                <span className="sw-display text-xl text-[#f2c230]">{t.roman}</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#e9dcc4]">{t.name}</span>
              </div>
              <div className="text-[11px] text-[#a8987f]">{t.cost === 1 ? "base price" : `×${t.cost} price`} · {t.stat === 1 ? "base stats" : `+${Math.round((t.stat - 1) * 100)}% main stat`}</div>
              <div className={`mt-0.5 text-[11px] leading-tight ${why ? "text-[#ff9a52]" : "text-[#7fe0a0]"}`}>{why || "Unlocked"}</div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-[#8f8270]">Progress · {p.jobs} jobs & contracts · {p.banked.toLocaleString("en-US")} scrap banked</div>
    </div>
  );
}