// One car on the "Choose your ride" screen: a FREE car parked at the spawn point, or one of your garage cars.
export default function RideCard({ ride, free, summon, banked, onPick }) {
  const s = ride.status || { ready: true };
  const lines = free
    ? [ride.weapons.join(" · ") || "Base guns", "Tier I · no upgrades · can't be modified"]
    : [ride.weapons.join(" · ") || "No weapons", `Armour: ${ride.armour}${ride.ram ? " · Ram" : ""}`, ride.modules.length ? ride.modules.join(" · ") : "No modules", `Traps: ${ride.trapTier || "None"}${ride.blueprint ? ` · Blueprint: ${ride.blueprint}` : ""}`];
  const action = s.ready ? (summon ? "Summon" : "Drive") : null;
  return (
    <div className={`sw-panel flex flex-col gap-1 px-4 py-3 ${ride.selected ? "border-[#f2c230]" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="sw-display text-lg text-[#f4ead6]">{ride.name}</span>
        {free && <span className="rounded-sm bg-[#7fe0a0] px-1.5 text-[10px] font-bold tracking-[0.2em] text-[#10200f]">FREE</span>}
        {!free && ride.selected && <span className="text-[10px] uppercase tracking-[0.2em] text-[#f2c230]">Last driven</span>}
      </div>
      {lines.map((l) => <div key={l} className="text-xs text-[#a8987f]">{l}</div>)}
      {!s.ready && <div className="text-xs uppercase tracking-[0.15em] text-[#ff8a6a]">Wrecked · ready in {s.wait}s</div>}
      <div className="mt-2 flex gap-2">
        {action && <button className="sw-btn sw-btn-primary flex-1 px-3 py-1.5 text-sm" onClick={() => onPick(false)}>{action}</button>}
        {!s.ready && (
          <button className="sw-btn flex-1 px-3 py-1.5 text-sm disabled:opacity-40" disabled={banked < s.cost} onClick={() => onPick(true)}>
            Repair · {s.cost} scrap
          </button>
        )}
      </div>
    </div>
  );
}