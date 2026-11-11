import MenuShell from "@/game/ui/menu/MenuShell";

// End of an arena match: win or time out, the tally and the payout. Rematch and Back to the wasteland are pinned in
// the top bar, so the way out is in reach however long the tally is.
export default function ArenaResults({ data, onRematch, onNext, onLeave }) {
  if (!data) return null;
  const actions = (
    <>
      <button type="button" onClick={onLeave} className="sw-btn px-4 py-2 text-sm">Back to menu</button>
      <button type="button" onClick={onNext} className="sw-btn px-4 py-2 text-sm">Next map</button>
      <button type="button" onClick={onRematch} className="sw-btn sw-btn-primary px-6 py-2 text-sm">Play again</button>
    </>
  );
  return (
    <MenuShell title={data.won ? "VICTORY" : data.title || "TIME'S UP"} tone={data.won ? "text-[#7fe0a0]" : "text-[#ff6a4a]"} sub={`${data.map} · ${data.rules} · ${data.time}s`} actions={actions} backdrop="bg-[rgba(40,22,10,0.72)]">
      <div className="sw-hazard h-2 w-full shrink-0" />
      <div className="flex items-end justify-between gap-4">
        <div className="text-sm text-[#e9dcc4]">{data.reason}</div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#a8987f]">Banked</div>
          <div className="sw-display text-2xl text-[#7fe0a0]">+{data.payout}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {data.tally.map(([k, v]) => (
          <div key={k} className="bg-[#141210] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">{k}</div>
            <div className="sw-display text-xl text-[#f4ead6]">{v}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-[#a8987f]">What you banked is kept whichever way you go.</div>
    </MenuShell>
  );
}