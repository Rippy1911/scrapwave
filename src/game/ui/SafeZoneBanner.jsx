// Top-centre banner while you (or your car) are inside a safe zone: the Well-town, an outpost or your base.
const SUB = { town: "Weapons cold · scrap banked · repairing", outpost: "Weapons cold · traps restocked", plot: "Weapons cold · your turf" };

export default function SafeZoneBanner({ zone, garage, onFoot }) {
  if (!zone) return null;
  return (
    <div className="absolute left-1/2 top-24 -translate-x-1/2 text-center">
      <div className="sw-display text-[#7fe0a0] text-xl tracking-widest drop-shadow-[0_2px_0_#000]">SAFE ZONE</div>
      <div className="text-xs uppercase tracking-[0.2em] text-[#cfe9d6]">{zone.name} · {SUB[zone.kind] || "Weapons cold"}</div>
      {garage && !onFoot && <div className="mt-2 inline-block sw-panel px-3 py-1 text-sm text-[#f2c230] sw-pulse">Press B for the Garage</div>}
    </div>
  );
}