import { QUALITY } from "@/game/data/tuning";

// Every preset in QUALITY, in declaration order (new presets such as Ultra show up automatically).
const LEVELS = Object.keys(QUALITY);

export default function QualityPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 sw-panel px-2 py-1">
      <span className="px-2 text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Quality</span>
      {LEVELS.map((l) => (
        <button key={l} onClick={() => onChange(l)} className={`px-3 py-1 text-xs uppercase tracking-wider rounded-sm ${value === l ? "bg-[#f2c230] text-[#1b140b] font-bold" : "text-[#d8cbb2] hover:text-[#f2c230]"}`}>{l}</button>
      ))}
    </div>
  );
}