// The draft's numbers next to the car you own: total mass and engine power decide speed, acceleration, braking,
// landing and how hard a ram hits. Then the bill for building it.
const ROWS = [
  ["mass", "Mass", "kg", -1], ["power", "Engine", "kN", 1], ["aero", "Aero · air turbo", "", 1], ["topSpeed", "Top speed", "km/h", 1], ["zeroTo100", "0-100", "s", -1],
  ["accel", "Accel", "m/s²", 1], ["brake", "Brakes", "m/s²", 1], ["grip", "Grip", "", 1], ["landing", "Suspension", "m", 1],
  ["hull", "Hull", "hp", 1], ["armour", "Armour", "hp", 1], ["ram", "Ram at 54 km/h", "dmg", 1], ["cost", "Parts value", "scrap", 0],
];

export default function StatsPanel({ summary, owned, bill, banked }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {ROWS.map(([k, label, unit, good]) => {
          const v = summary[k], o = owned ? owned[k] : v, d = Number.isFinite(v) && Number.isFinite(o) ? v - o : 0;
          const better = good && d ? (d * good > 0 ? "text-[#7fe0a0]" : "text-[#ff8a6a]") : "text-[#8f8270]";
          return (
            <div key={k} className="flex items-baseline justify-between gap-2 border-b border-[#2a2622] py-0.5">
              <span className="text-[11px] uppercase tracking-[0.15em] text-[#a8987f]">{label}</span>
              <span className="sw-display text-sm text-[#e9dcc4]">{Number.isFinite(v) ? v : "—"}<span className="ml-1 font-sans text-[10px] text-[#8f8270]">{unit}</span>
                {Math.abs(d) > 0.005 && <span className={`ml-1 font-sans text-[10px] ${better}`}>{d > 0 ? "+" : ""}{+d.toFixed(2)}</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="rounded-sm border-2 border-[#3d3832] bg-[#171513] p-2.5">
        <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Build bill</div>
        {!bill.lines.length && <div className="text-xs text-[#8f8270]">No changes to your car.</div>}
        {bill.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-2 text-[11px]"><span className="text-[#cdbfa6]">{l.label}: {l.text}</span><span className={l.cost < 0 ? "text-[#7fe0a0]" : "text-[#e9dcc4]"}>{l.cost > 0 ? "+" : ""}{l.cost}</span></div>
        ))}
        <div className="mt-1.5 flex justify-between border-t border-[#3d3832] pt-1.5 text-xs font-bold uppercase tracking-wider">
          <span>Total</span><span className={bill.total > banked ? "text-[#ff8a6a]" : "text-[#f2c230]"}>{bill.total < 0 ? `${-bill.total} refund` : `${bill.total} scrap`}</span>
        </div>
        {bill.locked.map((r) => <div key={r} className="mt-1 text-[11px] text-[#ff9a52]">Locked: {r}</div>)}
      </div>
    </div>
  );
}