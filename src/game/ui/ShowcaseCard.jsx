// One showcase vehicle: free, one copy, cannot be sold. Used on "Choose your ride" and in the garage.
export default function ShowcaseCard({ ride, action = "Drive", onPick, onEdit }) {
  const s = ride.status || { ready: true };
  return (
    <div className="sw-panel flex flex-col gap-1 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="sw-display text-lg text-[#f4ead6]">{ride.name}</span>
        <span className="rounded-sm bg-[#f2c230] px-1.5 text-[10px] font-bold tracking-[0.2em] text-[#1b140b]">SHOWCASE</span>
      </div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#c9a36a]">{ride.type}</div>
      <div className="text-xs text-[#a8987f]">{ride.blurb}</div>
      <div className="text-xs text-[#a8987f]">Hull {ride.hull} · {ride.topSpeed} km/h{ride.tags.length ? ` · ${ride.tags.join(" · ")}` : ""}</div>
      {!s.ready && <div className="text-xs uppercase tracking-[0.15em] text-[#ff8a6a]">Wrecked · back in {s.wait}s</div>}
      <div className="mt-2 flex gap-2">
        {onPick && <button type="button" disabled={!s.ready} className="sw-btn sw-btn-primary min-h-[40px] flex-1 px-3 py-1.5 text-sm disabled:opacity-40" onClick={onPick}>{action}</button>}
        {onEdit && <button type="button" className="sw-btn min-h-[40px] flex-1 px-3 py-1.5 text-sm" onClick={onEdit}>Edit a copy</button>}
      </div>
    </div>
  );
}