import { WINGS, wingSpec, describeWings } from "@/game/workshop/wings";

const ROWS = [
  { key: "sides", label: "Side wings (pair)", sides: ["left", "right"], ids: ["stub", "glider", "swept"] },
  { key: "roof", label: "Roof wing", sides: ["roof"], ids: ["stub", "glider", "swept"] },
  { key: "fin", label: "Tail fin", sides: ["roof"], ids: ["tailfin"], fin: true },
];
const TIERS = ["I", "II", "III"];

// Workshop: wings and tail fin of a car design. Side wings are fitted as a pair; each is its own part in a fight.
export default function WingsPanel({ design, onChange, mass }) {
  const wings = design.wings || [];
  const inRow = (row) => wings.filter((w) => (row.fin ? WINGS[w.id].fin : !WINGS[w.id].fin && row.sides.includes(w.side)));
  const set = (row, id, tier) => {
    const rest = wings.filter((w) => !inRow(row).includes(w));
    const add = id ? row.sides.map((side) => ({ id, tier, side })) : [];
    const next = [...rest, ...add];
    const d = { ...design };
    if (next.length) d.wings = next; else delete d.wings;
    onChange(d);
  };
  const info = wings.length ? describeWings(wings, (mass || 1300) / 1300) : null;
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-[#3d3832] bg-[rgba(0,0,0,0.25)] p-3">
      <div className="flex items-baseline justify-between">
        <div className="sw-display text-sm text-[#f2c230]">WINGS</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#a8987f]">hold turbo in the air to fly</div>
      </div>
      {ROWS.map((row) => {
        const cur = inRow(row)[0], spec = cur ? wingSpec(cur.id, cur.tier) : null;
        return (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-[11px] uppercase tracking-[0.15em] text-[#c9a36a]">{row.label}</span>
            <select aria-label={row.label} value={cur ? cur.id : ""} onChange={(e) => set(row, e.target.value, cur ? cur.tier : 1)} className="min-h-[36px] flex-1 rounded-sm border border-[#57503f] bg-[#1c1b1a] px-2 text-sm text-[#e9dcc4]">
              <option value="">None</option>
              {row.ids.map((id) => <option key={id} value={id}>{WINGS[id].name}</option>)}
            </select>
            <div className="flex gap-1">
              {TIERS.map((t, i) => (
                <button key={t} type="button" disabled={!cur} onClick={() => set(row, cur.id, i + 1)} className={`sw-btn min-h-[36px] px-2.5 text-[11px] disabled:opacity-40 ${cur && cur.tier === i + 1 ? "sw-btn-primary" : ""}`}>{t}</button>
              ))}
            </div>
            {spec && <span className="w-full text-[11px] text-[#a8987f]">{spec.mass * row.sides.length} kg · {spec.hp} HP each · {spec.cost * row.sides.length} scrap · {spec.blurb}</span>}
          </div>
        );
      })}
      {info && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-[#3d3832] pt-2 text-[12px] sm:grid-cols-4">
          <span>Lift <b className="text-[#7fe0a0]">{info.lift}</b> g</span>
          <span>Drag <b className="text-[#ffcf7a]">{info.drag}</b></span>
          <span>Stall <b>{info.stallKmh ?? "-"}</b> km/h</span>
          <span>{info.canFly ? <b className="text-[#7fe0a0]">Flies on turbo</b> : <b className="text-[#ffcf7a]">Glides only</b>}</span>
        </div>
      )}
    </div>
  );
}