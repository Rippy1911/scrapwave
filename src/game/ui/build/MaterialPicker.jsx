const MATS = [
  { id: "wood", name: "Wood", sw: "#8a6239" },
  { id: "sheet", name: "Sheet", sw: "#8f8a7c" },
  { id: "concrete", name: "Concrete", sw: "#a8a092" },
  { id: "steel", name: "Steel", sw: "#5d6168" },
];

// Material (keys 1-4) and tier (T) for the next piece.
export default function MaterialPicker({ mat, tier, onMat, onTier }) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <div className="flex gap-1">
        {MATS.map((m, i) => (
          <button key={m.id} onClick={() => onMat(m.id)} title={`${m.name} (${i + 1})`}
            className={`flex items-center gap-1 rounded-sm border-2 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider ${mat === m.id ? "border-[#f2c230] text-[#f2c230]" : "border-[#46413a] text-[#e9dcc4] hover:border-[#8a6a1e]"}`}>
            <span className="h-3 w-3 rounded-sm" style={{ background: m.sw }} />{m.name}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3].map((t) => (
          <button key={t} onClick={() => onTier(t)}
            className={`flex-1 rounded-sm border-2 py-0.5 sw-display text-xs ${tier === t ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#46413a] text-[#e9dcc4] hover:border-[#8a6a1e]"}`}>
            Tier {["I", "II", "III"][t - 1]}
          </button>
        ))}
      </div>
    </div>
  );
}