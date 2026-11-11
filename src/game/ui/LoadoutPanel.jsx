import { useState } from "react";
import { writeSave } from "@/game/core/save";
import { GROUPS, GROUP_IDS, groupOf, setBind, bindWeapons, mountLabel } from "@/game/weapons/binds";

const chip = (on) => `rounded-sm border-2 px-2.5 py-1.5 text-[11px] uppercase tracking-wider transition-colors ${on ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#3d3832] bg-[#1c1a17] text-[#d8cbb2] hover:border-[#8a6a1e]"}`;

// Loadout (pause menu): which trigger fires each weapon mount on the car you are driving, and the key legend switch.
export default function LoadoutPanel({ game, save }) {
  const [, force] = useState(0);
  const v = game && game.player;
  if (!v) return null;
  const pick = (w, g) => { if (setBind(save, w, g)) { bindWeapons(save, v); writeSave(save); force((x) => x + 1); } };
  const legend = save.legend !== false;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase tracking-[0.25em] text-[#c9a36a]">Loadout · key bindings</div>
      {!v.weapons.length && <div className="text-sm text-[#a8987f]">No weapons fitted. Fit some in the Garage (B in town).</div>}
      {v.weapons.map((w, i) => (
        <div key={i} className="flex flex-col gap-1.5 border-b border-[#2f2b26] pb-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-[#e9dcc4]">{w.def.name}{w.disabled ? " · destroyed" : ""}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9d907b]">{mountLabel(w)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_IDS.map((g) => (
              <button key={g} type="button" className={chip(groupOf(w) === g)} onClick={() => pick(w, g)}>{GROUPS[g].name} · {GROUPS[g].keys}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#d8cbb2]">Key legend on screen</span>
        <button type="button" className={chip(legend)} onClick={() => { save.legend = !legend; writeSave(save); force((x) => x + 1); }}>{legend ? "On" : "Off"}</button>
      </div>
      <div className="text-xs text-[#a8987f]">K fires the Heavy trigger, or Utility when nothing is on Heavy. On a pad: X guns, D-pad up heavy, B utility.</div>
    </div>
  );
}