import { BrickWall, PanelLeft, Fence, DoorOpen, TrendingUp, Square, RectangleVertical, Castle, Waypoints, Package, Cylinder, Layers, Lamp } from "lucide-react";

const ICON = { wall: BrickWall, halfwall: PanelLeft, barrier: Fence, gate: DoorOpen, ramp: TrendingUp, platform: Square, pillar: RectangleVertical, tower: Castle, bridge: Waypoints, crate: Package, barrels: Cylinder, sandbags: Layers, lamp: Lamp };

// Free-build pieces: icon, name, cost and HP in the chosen material and tier.
export default function PiecePalette({ pieces, sel, onSelect }) {
  return (
    <div className="flex gap-1">
      {pieces.map((p) => {
        const Icon = ICON[p.id] || BrickWall, on = sel === p.id;
        return (
          <button key={p.id} onClick={() => onSelect(on ? null : p.id)}
            className={`flex w-[74px] shrink-0 flex-col items-center gap-0.5 rounded-sm border-2 px-1 py-1.5 transition-colors ${on ? "border-[#f2c230] bg-[#3a3122]" : "border-[#46413a] bg-[#1c1b1a] hover:border-[#8a6a1e]"} ${p.afford ? "" : "opacity-50"}`}>
            <Icon className={`h-5 w-5 ${on ? "text-[#f2c230]" : "text-[#e9dcc4]"}`} />
            <span className="text-center text-[10px] font-bold uppercase leading-tight tracking-wider text-[#e9dcc4]">{p.name}</span>
            <span className="text-[11px] font-bold text-[#f2c230]">{p.cost}</span>
            <span className="text-[9px] text-[#a8987f]">{p.hp} HP</span>
          </button>
        );
      })}
    </div>
  );
}