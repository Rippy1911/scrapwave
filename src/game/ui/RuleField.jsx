import { PLAYER_CARS } from "@/game/rules/gameRules";

// One editable rule on the Custom Game screen: choice, toggle, number slider or the allowed-cars picker.
export default function RuleField({ f, value, onChange }) {
  let input;
  if (f.type === "choice") {
    input = (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#141210] border border-[#57503f] px-2 py-1 text-sm text-[#f4ead6]">
        {Object.entries(f.options).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    );
  } else if (f.type === "bool") {
    input = (
      <button onClick={() => onChange(!value)} className={`w-16 px-2 py-1 text-xs font-bold tracking-[0.2em] border ${value ? "bg-[#f2c230] text-[#1b140b] border-[#7a5410]" : "bg-[#141210] text-[#a8987f] border-[#57503f]"}`}>
        {value ? "ON" : "OFF"}
      </button>
    );
  } else if (f.type === "num") {
    input = (
      <div className="flex items-center gap-2">
        <input type="range" min={f.min} max={f.max} step={f.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[#f2c230]" />
        <span className="w-12 text-right sw-display text-sm text-[#f2c230]">{value}</span>
      </div>
    );
  } else {
    const toggle = (c) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
    input = (
      <div className="flex gap-1.5">
        {Object.entries(PLAYER_CARS).map(([k, label]) => (
          <button key={k} onClick={() => toggle(k)} className={`px-2 py-1 text-xs font-bold border ${value.includes(k) ? "bg-[#3a3122] text-[#f2c230] border-[#8a6a1e]" : "bg-[#141210] text-[#7d7262] border-[#3a362f]"}`}>{label}</button>
        ))}
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">{f.label}</span>
      {input}
    </label>
  );
}