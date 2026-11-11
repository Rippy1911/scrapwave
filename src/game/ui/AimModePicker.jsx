// Pause-menu setting: assisted aim (lock-on, the default) or manual (free crosshair).
const MODES = [["assisted", "Assisted"], ["manual", "Manual"]];

export default function AimModePicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#a8987f]">
      Aim
      {MODES.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`sw-btn px-3 py-1 text-[11px] ${value === k ? "sw-btn-primary" : ""}`}>{label}</button>
      ))}
    </div>
  );
}