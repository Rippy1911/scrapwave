// Arena HUD: the clock, the win condition with live progress, and your active power-ups.
export default function ArenaCard({ arena }) {
  if (!arena) return null;
  const low = arena.time <= 15;
  const mm = Math.floor(arena.time / 60), ss = String(arena.time % 60).padStart(2, "0");
  return (
    <div className="absolute left-1/2 top-4 -translate-x-1/2 flex flex-col items-center gap-2">
      <div className="sw-panel px-5 py-2 text-center min-w-[220px]">
        <div className={`sw-display text-3xl tracking-wider ${low ? "text-[#ff4a2a] sw-pulse" : "text-[#f2c230]"}`}>{mm}:{ss}</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">{arena.win}</div>
        <div className="mt-1 flex justify-center gap-4">
          {arena.goals.map(([k, v]) => (
            <div key={k}><div className="sw-display text-lg text-[#f4ead6]">{v}</div><div className="text-[9px] uppercase tracking-[0.2em] text-[#a8987f]">{k}</div></div>
          ))}
        </div>
      </div>
      {arena.fx.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {arena.fx.map((f) => <span key={f} className="rounded-sm bg-[#1b1712] border border-[#57503f] px-2 py-0.5 text-[11px] font-bold tracking-[0.15em] text-[#9cc8ff]">{f}</span>)}
        </div>
      )}
    </div>
  );
}