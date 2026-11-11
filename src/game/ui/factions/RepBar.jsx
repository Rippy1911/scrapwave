// One faction's standing: name, band and a -100..100 bar with the centre marked.
export default function RepBar({ row }) {
  const v = row.value, k = Math.abs(v) / 100;
  const color = row.standing.color;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="sw-display text-sm tracking-wide text-[#eadfc8]">{row.name}</span>
        <span className="text-xs uppercase tracking-[0.18em]" style={{ color }}>{row.standing.name} · {v > 0 ? "+" : ""}{v}</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-sm bg-[#14120f] border border-[#46413a]">
        <div className="absolute top-0 h-full" style={{ background: color, width: `${k * 50}%`, left: v >= 0 ? "50%" : `${50 - k * 50}%` }} />
        <div className="absolute left-1/2 top-0 h-full w-px bg-[#8a7a62]" />
      </div>
    </div>
  );
}