// On-screen key legend (round 14): which key fires what on the car you are driving, built from the HUD's weapon list
// (each weapon already carries its key from the Loadout bindings), plus turbo and the trap slot. Hidden on touch
// (.sw-touch in index.css) and on narrow screens; switch it off in the pause menu's Loadout page.
export default function KeyLegend({ hud }) {
  if (!hud.legendOn || !hud.weapons) return null;
  const by = new Map();
  for (const w of hud.weapons) {
    if (w.disabled || w.key === "OFF") continue;
    if (!by.has(w.key)) by.set(w.key, new Set());
    by.get(w.key).add(w.name);
  }
  const rows = [...by].map(([key, names]) => [key, [...names].join(", ")]);
  rows.push(["Shift", "Turbo · in the air: jet"]);
  if (hud.traps) rows.push(["G · H", "Drop trap · next trap"]);
  return (
    <div className="sw-hud-legend pointer-events-none absolute left-4 top-[52%] hidden -translate-y-1/2 flex-col gap-1 sw-body md:flex">
      {rows.map(([key, text]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="min-w-[52px] rounded-sm border border-[#57503f] bg-[rgba(27,23,18,0.8)] px-1.5 py-0.5 text-center text-[10px] uppercase tracking-wider text-[#f2c230]">{key}</span>
          <span className="max-w-[150px] truncate text-[11px] uppercase tracking-[0.12em] text-[#d8cbb2] [text-shadow:0_1px_2px_#000]">{text}</span>
        </div>
      ))}
    </div>
  );
}