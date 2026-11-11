// Tab scoreboard: you and the ten Drifters (AI badge, tier, car, wrecks, banked scrap).
export default function Scoreboard({ rows }) {
  if (!rows) return null;
  return (
    <div className="absolute left-1/2 top-1/2 w-[min(640px,94vw)] -translate-x-1/2 -translate-y-1/2 sw-panel px-5 py-4">
      <div className="sw-display text-xl text-[#f2c230] tracking-widest mb-2">THE SALTREACH</div>
      <div className="grid grid-cols-[1fr_90px_90px_60px_70px] gap-x-2 text-[11px] uppercase tracking-[0.2em] text-[#a8987f] pb-1 border-b border-[#46413a]">
        <span>Driver</span><span>Tier</span><span>Car</span><span className="text-right">Wrecks</span><span className="text-right">Banked</span>
      </div>
      {rows.map((r) => (
        <div key={r.key || r.name} className={`grid grid-cols-[1fr_90px_90px_60px_70px] gap-x-2 items-center py-1 text-sm ${r.me ? "text-[#f2c230]" : r.alive ? "text-[#efe3cb]" : "text-[#6f655a]"}`}>
          <span className="flex items-center gap-2 truncate">
            {r.ai && <span className="rounded-sm bg-[#5d8fd6] px-1 text-[10px] font-bold text-[#0e1420]">AI</span>}
            <span className="truncate font-semibold">{r.name}</span>
            {r.payback && <span className="text-[10px] text-[#ff3a20] tracking-wider">PAYBACK</span>}
          </span>
          <span className="text-xs">{r.tier || "—"}</span>
          <span className="text-xs truncate">{r.vehicle}</span>
          <span className="text-right">{r.wrecks}</span>
          <span className="text-right">{r.banked}</span>
        </div>
      ))}
    </div>
  );
}