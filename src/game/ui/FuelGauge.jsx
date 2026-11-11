import { FUEL } from "@/game/data/tuning";

// Fuel gauge for the hull/turbo panel: blinks at 15%, shows LIMP when dry and a filling sweep at a pump.
export default function FuelGauge({ hud }) {
  const k = Math.max(0, Math.min(1, hud.fuel));
  const low = k <= FUEL.low;
  const color = hud.refuelling ? "bg-[#7fe0a0]" : low ? "bg-[#ff4a2a]" : k < 0.4 ? "bg-[#f2c230]" : "bg-[#e07a1c]";
  const label = hud.refuelling ? "FILLING" : hud.limp ? "LIMP · EMPTY" : low ? "LOW" : `${hud.fuelUnits}`;
  return (
    <>
      <div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">
        <span>Fuel</span>
        <span className={hud.refuelling ? "text-[#7fe0a0]" : low ? "text-[#ff8a6a] sw-pulse" : ""}>{label}</span>
      </div>
      <div className={`relative mt-1 h-2 overflow-hidden bg-[#0e0c0a] border ${low && !hud.refuelling ? "border-[#ff4a2a] sw-pulse" : "border-[#46413a]"}`}>
        <div className={`h-full ${color} transition-all duration-150`} style={{ width: `${k * 100}%` }} />
        {hud.refuelling && <div className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-[rgba(220,255,230,0.6)] to-transparent sw-fill" />}
      </div>
    </>
  );
}