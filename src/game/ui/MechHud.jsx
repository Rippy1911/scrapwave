// HUD card for a machine with moving parts: Drive / Walker mode, the fold progress, what T does right now, and the
// joints and poses bound to keys 1-9.
export default function MechHud({ mech }) {
  if (!mech) return null;
  const walker = mech.mode === "walker", busy = mech.mode === "transforming";
  return (
    <div className="absolute bottom-40 left-4 w-60 sw-panel px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="sw-display text-sm tracking-wider text-[#f2c230]">{busy ? "TRANSFORMING" : walker ? "WALKER MODE" : "DRIVE MODE"}</span>
        {mech.canWalk && <span className="rounded-sm bg-[#1b1712] px-1.5 py-0.5 font-bold text-[#e9dcc4]">T</span>}
      </div>
      {busy && <div className="mt-1 h-1.5 bg-[#0e0c0a]"><div className="h-full bg-[#f2c230]" style={{ width: `${(walker ? 1 - mech.k : mech.k) * 100}%` }} /></div>}
      {!mech.canWalk && <div className="mt-1 text-[#a8987f]">{!mech.core ? "No Transform Core: joints only" : `Needs 2 or 4 legs (has ${mech.legs})`}</div>}
      {mech.canWalk && !walker && !busy && mech.block && <div className="mt-1 text-[#ff9a52]">{mech.block}</div>}
      {walker && <div className="mt-1 leading-snug text-[#cdbfa6]">W/S walk · A/D turn · Q/E strafe · Shift run · Space {mech.hop ? "thruster hop" : "jump"}{mech.fist ? " · J punch" : ""}</div>}
      {mech.overloaded && <div className="mt-1 text-[#ff8a6a]">Overloaded: fit a bigger reactor</div>}
      {mech.check && (
        <div className="mt-1.5 border-t border-[#3d3832] pt-1">
          <div className={mech.check.done ? (mech.check.pass ? "text-[#7fe0a0]" : "text-[#ff8a6a]") : "text-[#a8987f]"}>Mech check: {mech.check.done ? (mech.check.pass ? "PASS" : "FAIL") : mech.check.stage}</div>
          {/* Only the count here: the full list sits in the right-hand check panel so this card never grows over the location label. */}
          <div className="text-[#a8987f]">{mech.check.items.filter((x) => x.ok).length}/{mech.check.items.length} ok</div>
        </div>
      )}
      {mech.keys.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {mech.keys.map((k, i) => (
            <span key={i} className={`rounded-sm border px-1.5 py-0.5 ${k.on || k.held ? "border-[#f2c230] text-[#f2c230]" : "border-[#46413a] text-[#cdbfa6]"}`}>{k.key} {k.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}