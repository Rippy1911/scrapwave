import { useEffect, useState } from "react";
import { getTouchPrefs, setTouchPrefs, onTouchPrefs } from "@/game/ui/touch/prefs";

// Settings → Touch: show the controls (auto / on / off), button size, stick size, left-handed (mirrored) layout.
const SHOW = [["Auto", null], ["On", true], ["Off", false]];
const lbl = "text-xs uppercase tracking-[0.2em] text-[#a8987f]";

export default function TouchSettings() {
  const [p, setP] = useState(getTouchPrefs);
  useEffect(() => onTouchPrefs((x) => setP({ ...x })), []);
  const slider = (key, name) => (
    <label className={`flex items-center gap-2 ${lbl}`}>
      {name}
      <input type="range" min={0.8} max={1.4} step={0.1} value={p[key]} onChange={(e) => setTouchPrefs({ [key]: Number(e.target.value) })} className="accent-[#f2c230] w-24" />
    </label>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="sw-display text-sm tracking-wider text-[#f2c230]">TOUCH</div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={lbl}>Controls</span>
          {SHOW.map(([name, v]) => (
            <button key={name} onClick={() => setTouchPrefs({ show: v })} className={`sw-btn px-3 py-1 text-xs ${p.show === v ? "sw-btn-primary" : ""}`}>{name}</button>
          ))}
        </div>
        {slider("button", "Buttons")}
        {slider("stick", "Stick")}
        <button onClick={() => setTouchPrefs({ left: !p.left })} className={`sw-btn px-3 py-1 text-xs ${p.left ? "sw-btn-primary" : ""}`}>Left-handed {p.left ? "on" : "off"}</button>
      </div>
    </div>
  );
}