import { useState } from "react";
import MenuShell from "@/game/ui/menu/MenuShell";
import PauseSettings from "@/game/ui/menu/PauseSettings";
import ControlsList from "@/game/ui/ControlsList";

// Settings from the title: the same sections as the pause menu, plus the driver name and the controls list.
export default function SettingsMenu({ save, handle, onQuality, onVolume, driver, onRename, onBack }) {
  const [, tick] = useState(0);
  const g = handle.game;
  const extra = (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#a8987f]">
      Driver: <span className="text-[#f2c230]">{driver || "not set"}</span>
      <button type="button" onClick={onRename} className="sw-btn px-3 py-1 text-xs">Change</button>
    </div>
  );
  return (
    <MenuShell title="SETTINGS" sub="Esc goes back" actions={<button type="button" onClick={onBack} className="sw-btn px-4 py-2 text-sm">Back</button>}>
      <PauseSettings save={save} game={g} aimMode={g.playerAim.mode()} onAimMode={(m) => { handle.setAimMode(m); tick((x) => x + 1); }}
        onQuality={onQuality} onVolume={onVolume} touch={g.touch.enabled()} showTouch={g.touch.enabled()} extra={extra} />
      <ControlsList />
    </MenuShell>
  );
}