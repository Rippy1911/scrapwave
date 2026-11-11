import FuelGauge from "@/game/ui/FuelGauge";
import TrapSlot from "@/game/ui/TrapSlot";

// Bottom HUD: hull, turbo and fuel bars bottom-left; scrap and weapon slots, then the speedo in the bottom-right corner.
// Nothing sits bottom-centre, so the road ahead of the car stays clear.
export default function HudBars({ hud }) {
  const hullK = Math.max(0, hud.hull / hud.maxHull);
  const hullColor = hullK > 0.6 ? "bg-[#7fe0a0]" : hullK > 0.3 ? "bg-[#f2c230]" : "bg-[#ff4a2a]";
  return (
    <>
      {/* On foot the walker's health and slots take this corner (ui/foot/FootHud.jsx). */}
      <div className={`sw-hud-left absolute left-4 bottom-4 w-64 md:w-80 sw-panel px-4 py-3 ${hud.foot && hud.foot.on ? "hidden" : ""}`}>
        <div className="flex justify-between text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]"><span>Hull</span><span>{Math.ceil(Math.max(0, hud.hull))} / {hud.maxHull}</span></div>
        <div className="mt-1 h-3 bg-[#0e0c0a] border border-[#46413a]"><div className={`h-full ${hullColor} transition-all duration-150`} style={{ width: `${hullK * 100}%` }} /></div>
        <div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]"><span>Turbo</span><span>{hud.turboOn ? "BURNING" : "Shift"}</span></div>
        <div className="mt-1 h-2 bg-[#0e0c0a] border border-[#46413a]"><div className={`h-full ${hud.turboOn ? "bg-[#9cc8ff]" : "bg-[#5d8fd6]"}`} style={{ width: `${hud.turbo * 100}%` }} /></div>
        <FuelGauge hud={hud} />
        {hud.partsOff > 0 && <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[#ff8a6a]">{hud.partsOff} part{hud.partsOff > 1 ? "s" : ""} missing · repair in town</div>}
      </div>

      <div className="sw-hud-right absolute right-4 bottom-4 flex items-end gap-3">
        <div className="sw-hud-carried w-60 md:w-72 sw-panel px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Carried</span>
            <span className="sw-display text-2xl text-[#f2c230]">{hud.scrap}</span>
          </div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#a8987f]">Banked</span>
            <span className="text-[#cfe9d6] font-semibold">{hud.banked}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {hud.weapons.map((w, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs ${w.disabled ? "opacity-40 line-through" : ""}`}>
                <span className="w-9 text-center rounded-sm border border-[#57503f] bg-[#26231f] text-[10px] text-[#f2c230]">{w.key}</span>
                <span className="flex-1 uppercase tracking-wider">{w.name}</span>
                <span className="h-1.5 w-12 bg-[#0e0c0a]"><span className="block h-full bg-[#f2c230]" style={{ width: `${w.ready * 100}%` }} /></span>
              </div>
            ))}
            <TrapSlot traps={hud.traps} />
            {hud.smoke !== null && <div className="text-xs uppercase tracking-wider"><span className="text-[#f2c230] mr-2">V</span>Smoke {hud.smoke > 0 ? `${Math.ceil(hud.smoke)}s` : "ready"}</div>}
          </div>
        </div>

        <div className="sw-hud-speedo min-w-[130px] md:min-w-[170px] text-center sw-panel px-4 pt-2 pb-2">
          <div className={`sw-display text-5xl md:text-6xl leading-none tabular-nums drop-shadow-[0_3px_0_#000] ${hud.turboOn ? "text-[#9cc8ff]" : "text-[#f2e6c8]"}`}>{hud.speed}</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.45em] text-[#f2c230]">km/h</div>
        </div>
      </div>
    </>
  );
}