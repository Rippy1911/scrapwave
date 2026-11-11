import { useEffect } from "react";
import SpawnPointList from "@/game/ui/SpawnPointList";
import RideCard from "@/game/ui/RideCard";
import ShowcaseCard from "@/game/ui/ShowcaseCard";

const ERR = { noFree: "That free car was just taken", notOwned: "You don't own that car", wrecked: "Still being repaired", scrap: "Not enough banked scrap", point: "Unknown spawn point" };

// "Choose your ride": at session start, after a wreck, and (summon) on foot in a safe zone.
export default function SpawnMenu({ opts, error, onZone, onChoose, onRefresh, onClose }) {
  useEffect(() => { const t = setInterval(onRefresh, 1000); return () => clearInterval(t); }, [onRefresh]);
  if (!opts) return null;
  const summon = opts.reason === "summon";
  const pick = (id, repair) => onChoose(opts.zoneId, id, repair);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(10,8,6,0.72)] p-4 sw-body text-[#efe3cb]">
      <div className="sw-panel sw-pop flex max-h-[92vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#000]">{summon ? "SUMMON A CAR" : "CHOOSE YOUR RIDE"}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#a8987f]">{summon ? "It rolls out of the garage and waits for you" : "Pick a spawn point and a car"}</div>
          </div>
          <div className="text-right text-sm"><span className="text-[#a8987f]">Banked </span><span className="font-semibold text-[#f2c230]">{opts.banked}</span></div>
        </div>
        {error && <div className="sw-shake text-sm uppercase tracking-[0.15em] text-[#ff8a6a]">{ERR[error] || error}</div>}
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <SpawnPointList points={opts.points} current={opts.zoneId} onPick={onZone} />
          <div className="flex flex-col gap-4">
            {!summon && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Free cars here</div>
                {opts.free.length ? <div className="grid gap-2 sm:grid-cols-2">{opts.free.map((r) => <RideCard key={r.id} ride={r} free banked={opts.banked} onPick={() => pick("free:" + r.id)} />)}</div>
                  : <div className="text-xs text-[#8a7d68]">All taken · they come back in a few minutes</div>}
              </div>
            )}
            {opts.showcase && opts.showcase.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Showcase · free, one of each</div>
                <div className="grid gap-2 sm:grid-cols-2">{opts.showcase.map((r) => <ShowcaseCard key={r.id} ride={r} action={summon ? "Summon" : "Drive"} onPick={() => pick("show:" + r.id)} />)}</div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Your garage</div>
              <div className="grid gap-2 sm:grid-cols-2">{opts.garage.map((r) => <RideCard key={r.id} ride={r} summon={summon} banked={opts.banked} onPick={(repair) => pick(r.id, repair)} />)}</div>
            </div>
          </div>
        </div>
        {summon && <button className="sw-btn self-end px-4 py-2 text-sm" onClick={onClose}>Cancel</button>}
      </div>
    </div>
  );
}