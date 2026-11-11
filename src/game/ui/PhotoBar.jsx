import { useState } from "react";
import { Camera, EyeOff, X } from "lucide-react";

const MOVES = [["KeyW", "Fwd"], ["KeyS", "Back"], ["KeyA", "Left"], ["KeyD", "Right"], ["Space", "Up"], ["ShiftLeft", "Down"]];
const label = "text-[10px] uppercase tracking-[0.25em] text-[#a8987f]";

// Photo mode bar: zoom, tilt, move buttons for touch screens, snap and leave. The saved PNG never includes this bar.
export default function PhotoBar({ photo, onExit }) {
  const [, tick] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [msg, setMsg] = useState("");
  const st = photo.state;
  const set = (k, v) => { st[k] = v; tick((x) => x + 1); };
  const snap = () => { photo.shot(); setMsg("Saved to your downloads"); setTimeout(() => setMsg(""), 2500); };
  const hold = (code) => ({ onPointerDown: () => photo.hold(code, true), onPointerUp: () => photo.hold(code, false), onPointerLeave: () => photo.hold(code, false), onPointerCancel: () => photo.hold(code, false) });
  if (hidden) return <button type="button" onClick={() => setHidden(false)} className="fixed bottom-2 right-2 z-30 sw-btn px-3 py-2 text-[10px] opacity-50">Show bar</button>;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-2 sw-body text-[#e9dcc4] select-none">
      <div className="sw-panel flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="sw-display text-lg text-[#f2c230]">PHOTO MODE</div>
        <label className="flex items-center gap-2"><span className={label}>Zoom</span>
          <input type="range" min="20" max="100" step="1" value={st.fov} onChange={(e) => set("fov", Number(e.target.value))} className="w-28 accent-[#f2c230]" />
        </label>
        <label className="flex items-center gap-2"><span className={label}>Tilt</span>
          <input type="range" min="-0.6" max="0.6" step="0.02" value={st.roll} onChange={(e) => set("roll", Number(e.target.value))} className="w-28 accent-[#f2c230]" />
        </label>
        <div className="flex flex-wrap gap-1">
          {MOVES.map(([code, name]) => <button key={code} type="button" {...hold(code)} className="sw-btn min-h-[40px] px-2.5 text-[10px] touch-none">{name}</button>)}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={snap} className="sw-btn sw-btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"><Camera className="h-4 w-4" />Snap</button>
          <button type="button" onClick={() => setHidden(true)} aria-label="Hide the bar" className="sw-btn flex items-center px-3 py-2"><EyeOff className="h-4 w-4" /></button>
          <button type="button" onClick={onExit} className="sw-btn flex items-center gap-1.5 px-4 py-2 text-sm"><X className="h-4 w-4" />Leave</button>
        </div>
        <div className="w-full text-center text-[11px] text-[#a8987f]">{msg || "Drag to look · W A S D move · Space up · Shift down · Ctrl faster · wheel zooms · Enter snaps · O or Esc leaves"}</div>
      </div>
    </div>
  );
}