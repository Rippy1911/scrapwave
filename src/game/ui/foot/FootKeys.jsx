// On-foot key hints, where the car's key legend sits (KeyLegend.jsx): the slots, fire, aim and reload. With C4 in
// the hands R blows the charges that are out; through a scope Q changes the zoom. Hidden on touch (.sw-touch in
// index.css) and on narrow screens, and switched off with the legend in the pause menu's Loadout page.
export default function FootKeys({ c }) {
  const thrown = c.sel === "grenade" || c.sel === "c4";
  const rows = [
    ["1 · 2", "Long gun · sidearm"],
    ["3 · 4", "Grenades · C4"],
    ["LMB", thrown ? "Throw" : "Fire"],
    ["RMB", "Aim"],
    c.scope ? ["Q", "Zoom step"] : null,
    ["R", c.sel === "c4" ? "Blow the charges" : "Reload"],
    ["E", "Get in · use"],
  ].filter(Boolean);
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