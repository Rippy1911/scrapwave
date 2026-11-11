import { useState } from "react";
import ControlsList from "@/game/ui/ControlsList";
import ReputationPanel from "@/game/ui/factions/ReputationPanel";
import MenuShell from "@/game/ui/menu/MenuShell";
import ConfirmButton from "@/game/ui/menu/ConfirmButton";
import PauseSettings from "@/game/ui/menu/PauseSettings";
import LoadoutPanel from "@/game/ui/LoadoutPanel";

// The pause menu (Esc). Resume, Leave arena and Settings are pinned in the top bar; everything else scrolls under it.
// touch: touch controls are on (aim is always assisted then); showTouch: show the Touch settings section.
// arena: a match is running (Restart shows); onChangeMap opens the map picker of the mode; onLeave goes to the menus.
export default function PauseMenu({ save, game, aimMode, onAimMode, onResume, onQuality, onVolume, arena = false, onRestart, onChangeMap, onLeave, touch = false, showTouch = false, online = false, reputation = null }) {
  const [tab, setTab] = useState("menu");
  const actions = (
    <>
      <button type="button" onClick={() => setTab(tab === "loadout" ? "menu" : "loadout")} className={`sw-btn px-4 py-2 text-sm ${tab === "loadout" ? "text-[#f2c230] border-[#8a6a1e]" : ""}`}>Loadout</button>
      <button type="button" onClick={() => setTab(tab === "settings" ? "menu" : "settings")} className={`sw-btn px-4 py-2 text-sm ${tab === "settings" ? "text-[#f2c230] border-[#8a6a1e]" : ""}`}>{tab === "settings" ? "Controls" : "Settings"}</button>
      {arena && <button type="button" onClick={onRestart} className="sw-btn px-4 py-2 text-sm">Restart</button>}
      <button type="button" onClick={onChangeMap} className="sw-btn px-4 py-2 text-sm">Change map</button>
      <ConfirmButton label="Leave" ask="Back to the menu?" yes="Leave" onConfirm={onLeave} />
      <button type="button" onClick={onResume} className="sw-btn sw-btn-primary px-6 py-2 text-base md:px-8 md:text-lg">Resume</button>
    </>
  );
  return (
    <MenuShell title={online ? "MENU" : "PAUSED"} sub={online ? "Online · the Saltreach keeps moving" : arena ? "Arena match" : null} actions={actions}>
      {tab === "loadout" ? <LoadoutPanel game={game} save={save} /> : tab === "settings" ? (
        <PauseSettings save={save} game={game} aimMode={aimMode} onAimMode={onAimMode} onQuality={onQuality} onVolume={onVolume} touch={touch} showTouch={showTouch} />
      ) : (
        <>
          <ReputationPanel rows={reputation} compact />
          <ControlsList />
        </>
      )}
    </MenuShell>
  );
}