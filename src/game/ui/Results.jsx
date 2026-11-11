import MenuShell from "@/game/ui/menu/MenuShell";

// End-of-cycle results: the tally, the best moment, the payout into saved scrap and the cycle's top drivers.
// Next cycle is pinned in the top bar; the tally and the board scroll under it.
export default function Results({ data, onNext, onMenu }) {
  if (!data) return null;
  return (
    <MenuShell title="RESULTS" sub={`Cycle ${data.n} · the storm has passed`} backdrop="bg-[rgba(40,22,10,0.72)]" actions={<><button type="button" onClick={onMenu} className="sw-btn px-4 py-2 text-sm">Back to menu</button><button type="button" onClick={onNext} className="sw-btn sw-btn-primary px-8 py-2 text-lg">Next cycle</button></>}>
      <div className="sw-hazard h-2 w-full shrink-0" />
      <div className="flex items-end justify-between">
        <div className="border-l-4 border-[#f2c230] bg-[#141210] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Best moment</div>
          <div className="text-base font-bold text-[#f4ead6]">{data.best}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#a8987f]">Stash paid out</div>
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
      <div>
        {data.rows.map((r, i) => (
          <div key={r.name + i} className={`flex justify-between px-2 py-0.5 text-sm ${r.me ? "bg-[#3a3122] text-[#f2c230]" : "text-[#e9dcc4]"}`}>
            <span>{i + 1}. {r.name}{r.ai ? <span className="ml-2 text-[10px] text-[#9cc8ff]">AI</span> : null}</span>
            <span>{r.banked} banked · {r.wrecks} wrecks</span>
          </div>
        ))}
      </div>
    </MenuShell>
  );
}