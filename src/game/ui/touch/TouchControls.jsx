import { useEffect, useState } from "react";
import TouchStick from "@/game/ui/touch/TouchStick";
import TouchButton from "@/game/ui/touch/TouchButton";
import LookPad from "@/game/ui/touch/LookPad";
import { getTouchPrefs, onTouchPrefs } from "@/game/ui/touch/prefs";
import "@/game/ui/touch/touch.css";

// The on-screen controls: look pad (empty right side), left stick, the right-side button cluster for the current
// mode and a pause button. Rows go top to bottom; the last button of a row sits at the screen edge.
const LAYOUTS = {
  drive: (safe, build) => [
    [...(build ? [["build", "Build", ""]] : []), ["turbo", "Turbo", "is-blue"], ["rockets", "Rocket", "is-red"], ["trap", "Trap", ""], ["use", "Get out", safe ? "" : "is-dim"]],
    [["fire", "Fire", "is-big is-red"], ["brake", "Brake", ""], ["throttle", "Gas", "is-big"]],
  ],
  foot: () => [
    [["summon", "Call car", ""]],
    [["jump", "Jump", ""], ["use", "Use", "is-big"]],
  ],
  air: () => [
    [["use", "Exit", ""]],
    [["descend", "Down", "is-blue"], ["climb", "Up", "is-big is-blue"]],
  ],
};

export default function TouchControls({ tc, mode = "drive", safe = false }) {
  const [prefs, setPrefs] = useState(getTouchPrefs);
  useEffect(() => onTouchPrefs((p) => setPrefs({ ...p })), []);
  const rows = (LAYOUTS[mode] || LAYOUTS.drive)(safe, tc.canBuild());
  return (
    <div className={`sw-tc ${prefs.left ? "is-left" : ""}`} style={{ "--bs": prefs.button }}>
      <LookPad tc={tc} />
      <TouchStick tc={tc} scale={prefs.stick} left={prefs.left} />
      <div className="sw-tc-pad">
        {rows.map((row, i) => (
          <div key={`${mode}-${i}`} className="sw-tc-row">
            {row.map(([action, label, kind]) => <TouchButton key={action} tc={tc} action={action} label={label} kind={kind} />)}
          </div>
        ))}
      </div>
      <TouchButton tc={tc} action="pause" label="II" kind="sw-tc-pause" />
    </div>
  );
}