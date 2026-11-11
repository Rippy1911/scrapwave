// Spawn points on the "Choose your ride" screen: every safe zone you have visited (the Well-town always).
const KIND = { town: "Town", outpost: "Outpost", plot: "Your base" };

export default function SpawnPointList({ points, current, onPick }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Spawn point</div>
      {points.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className={`sw-btn px-3 py-2 text-left text-sm ${p.id === current ? "text-[#f2c230] border-[#8a6a1e]" : ""}`}
        >
          <div>{p.name}</div>
          <div className="sw-body text-[11px] normal-case tracking-normal text-[#a8987f]">
            {KIND[p.kind] || "Safe zone"}{p.free != null ? ` · ${p.free} free car${p.free === 1 ? "" : "s"}` : ""}
          </div>
        </button>
      ))}
      <div className="text-[11px] text-[#8a7d68]">Visit outposts to unlock them as spawn points.</div>
    </div>
  );
}