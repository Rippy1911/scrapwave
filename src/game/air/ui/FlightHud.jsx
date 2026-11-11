// Flight panel while in an aircraft: altitude, airspeed, hull, fuel and what X / landing will do.
function Bar({ k, color }) {
  return <div className="mt-1 h-1.5 bg-[#0e0c0a]"><div className="h-full transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(1, k)) * 100}%`, background: color }} /></div>;
}

export default function FlightHud({ air }) {
  if (!air) return null;
  const high = air.alt > air.ceiling * 0.9;
  return (
    <div className="sw-hud-flight absolute left-4 top-1/3 w-52 sw-panel px-4 py-3 sw-slide">
      <div className="sw-display text-sm tracking-wider text-[#f2c230]">{air.name}{air.tier ? ` · T${air.tier}` : ""}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div><div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Alt</div><div className={`sw-display text-xl ${high ? "text-[#ff8a3a]" : ""}`}>{air.alt}<span className="text-xs"> m</span></div></div>
        <div><div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Speed</div><div className="sw-display text-xl">{air.speed}<span className="text-xs"> km/h</span></div></div>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Hull {air.hp} / {air.maxHp}</div>
      <Bar k={air.hp / air.maxHp} color="#ff5a2a" />
      {air.kind === "heli" && <><div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Fuel</div><Bar k={air.fuel} color="#f2c230" /></>}
      <div className="mt-2 text-[11px] uppercase tracking-[0.15em] text-[#cfc6b8]">
        {!air.alive ? <span className="text-[#ff4a2a]">Going down</span>
          : air.servicing ? <span className="text-[#7fe0a0] sw-pulse">Servicing at {air.servicing}</span>
          : air.limp ? <span className="text-[#ff8a3a] sw-pulse">Dry tank · autorotating</span>
          : air.grounded ? "Landed · X to get out" : high ? "Near the ceiling" : "Airborne"}
      </div>
    </div>
  );
}