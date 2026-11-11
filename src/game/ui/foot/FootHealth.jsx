// The walker's health on the on-foot panel: green, amber, then red, and it says when you are knocked down.
export default function FootHealth({ c }) {
  const k = Math.max(0, Math.min(1, c.hp / c.max));
  const color = k > 0.6 ? "bg-[#7fe0a0]" : k > 0.3 ? "bg-[#f2c230]" : "bg-[#ff4a2a]";
  return (
    <div>
      <div className="flex justify-between text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">
        <span>Health</span>
        <span className={c.down ? "text-[#ff8a6a] sw-pulse" : ""}>{c.down ? "Knocked down" : `${Math.max(0, c.hp)} / ${c.max}`}</span>
      </div>
      <div className="mt-1 h-3 border border-[#46413a] bg-[#0e0c0a]">
        <div className={`h-full ${color} transition-all duration-150`} style={{ width: `${k * 100}%` }} />
      </div>
    </div>
  );
}