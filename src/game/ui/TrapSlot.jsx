// Trap slot row in the weapons panel: charges per kind, the selected kind (H cycles, G drops), tier, flat tyres.
const KINDS = [["oil", "Oil"], ["spikes", "Spikes"], ["mines", "Mines"]];

export default function TrapSlot({ traps }) {
  if (!traps) return null;
  return (
    <div className="mt-1 border-t border-[#46413a] pt-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#a8987f]">
        <span>Traps · {traps.tier}</span>
        <span><span className="text-[#f2c230]">G</span> drop · <span className="text-[#f2c230]">H</span> cycle</span>
      </div>
      <div className="mt-1 flex gap-1">
        {KINDS.map(([k, label]) => (
          <span
            key={k}
            className={`flex-1 rounded-sm border px-1 py-0.5 text-center text-[10px] uppercase tracking-wider ${traps.sel === k ? "border-[#f2c230] bg-[#3a2f14] text-[#f2c230]" : "border-[#57503f] bg-[#26231f] text-[#d8cbb2]"} ${traps.charges[k] > 0 ? "" : "opacity-40"}`}
          >
            {label} {traps.charges[k]}
          </span>
        ))}
      </div>
      {traps.flat && <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#ff8a6a] sw-pulse">Tyres popped · repair at an outpost</div>}
    </div>
  );
}