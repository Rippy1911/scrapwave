import { BrickWall, Shield, Swords, DoorOpen, Crosshair, Rocket, Flame, Wrench, Factory, Radar } from "lucide-react";

const ICON = { scrapwall: BrickWall, platewall: Shield, spikewall: Swords, gate: DoorOpen, mgturret: Crosshair, rocketturret: Rocket, flametrap: Flame, garagepad: Wrench, refinery: Factory, radar: Radar };

// Module mode tray: turrets, traps, pads and the classic walls (icon, name, cost, HP).
export default function ModuleTray({ modules, sel, onSelect }) {
  return modules.map((m) => {
    const Icon = ICON[m.id] || BrickWall, on = sel === m.id;
    return (
      <button key={m.id} onClick={() => onSelect(on ? null : m.id)}
        className={`flex w-[84px] shrink-0 flex-col items-center gap-0.5 rounded-sm border-2 px-1 py-1.5 transition-colors ${on ? "border-[#f2c230] bg-[#3a3122]" : "border-[#46413a] bg-[#1c1b1a] hover:border-[#8a6a1e]"} ${m.afford ? "" : "opacity-50"}`}>
        <Icon className={`h-6 w-6 ${on ? "text-[#f2c230]" : "text-[#e9dcc4]"}`} />
        <span className="text-center text-[10px] font-bold uppercase leading-tight tracking-wider text-[#e9dcc4]">{m.name}</span>
        <span className="text-[11px] font-bold text-[#f2c230]">{m.cost}</span>
        <span className="text-[9px] text-[#a8987f]">{m.hp} HP</span>
      </button>
    );
  });
}