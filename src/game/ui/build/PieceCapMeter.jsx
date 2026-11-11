// Pieces on this plot against the per-plot cap; turns red near the limit.
export default function PieceCapMeter({ count, cap, funds }) {
  const k = Math.min(1, count / cap), hot = k > 0.9;
  return (
    <div className="flex w-[112px] shrink-0 flex-col justify-center gap-1 text-[10px] uppercase tracking-wider text-[#e9dcc4]">
      <div className="flex justify-between"><span>Pieces</span><b className={hot ? "text-[#ff6a4a]" : "text-[#f2c230]"}>{count}/{cap}</b></div>
      <div className="h-2 overflow-hidden rounded-sm border border-[#46413a] bg-[#11100f]">
        <div className={`h-full ${hot ? "bg-[#ff6a4a]" : "bg-[#f2c230]"}`} style={{ width: `${k * 100}%` }} />
      </div>
      <div className="flex justify-between text-[#a8987f]"><span>Scrap</span><b className="text-[#7fe0a0]">{funds}</b></div>
    </div>
  );
}