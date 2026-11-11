import { rideOptions } from "@/game/lobby/rideRules";

// Your ride for the match: your garage car (upgrades capped at the rules' max tier) or a free stock car.
// Cars the rules do not allow are shown but cannot be picked.
export default function RidePicker({ save, rules, ride, onPick, locked }) {
  const opts = rideOptions(save, rules);
  const same = (o) => ride && ride.kind === o.kind && ride.ch === o.ch;
  const current = ride || { kind: "free", ch: rules.startCar || rules.cars[0] };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Your ride · max tier {rules.maxTier}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {opts.map((o) => {
          const on = same(o) || (!ride && o.kind === "free" && o.ch === current.ch);
          return (
            <button key={o.kind + o.ch} disabled={!!o.why || locked} title={o.why || o.note} onClick={() => onPick({ kind: o.kind, ch: o.ch, tier: o.tier })}
              className={`flex flex-col items-start border px-2.5 py-1.5 text-left transition-colors disabled:cursor-not-allowed ${on ? "bg-[#3a3122] border-[#8a6a1e]" : "bg-[#141210] border-[#3a362f] hover:border-[#57503f]"} ${o.why ? "opacity-40" : ""}`}>
              <span className={`sw-display text-sm ${on ? "text-[#f2c230]" : "text-[#eadfc8]"}`}>{o.name}</span>
              <span className="text-[10px] text-[#a8987f]">{o.why || o.note}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}