import { useState } from "react";
import { writeSave } from "@/game/core/save";

// Short cycles setting: 15-minute cycles from the next cycle on (offline; online follows the server).
export default function ShortCycles({ save }) {
  const [on, setOn] = useState(!!save.shortCycles);
  const toggle = () => { save.shortCycles = !on; setOn(!on); writeSave(save); };
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#a8987f]">
      <input type="checkbox" checked={on} onChange={toggle} className="accent-[#f2c230]" />
      Short cycles (15 min)
    </label>
  );
}