import QualityPicker from "@/game/ui/QualityPicker";
import ShortCycles from "@/game/ui/ShortCycles";
import AimModePicker from "@/game/ui/AimModePicker";
import TouchSettings from "@/game/ui/touch/TouchSettings";

const head = "text-[11px] uppercase tracking-[0.3em] text-[#c9a36a]";

// The Settings page of the pause menu: picture, sound, aim, touch. extra: more sections (key bindings, the legend).
export default function PauseSettings({ save, aimMode, onAimMode, onQuality, onVolume, touch, showTouch, extra = null }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className={head}>Picture and sound</div>
        <div className="flex flex-wrap items-center gap-4">
          <QualityPicker value={save.quality} onChange={onQuality} />
          {["master", "music", "sfx"].map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#a8987f]">
              {k}
              <input type="range" min={0} max={1} step={0.05} defaultValue={save.volume[k]} onChange={(e) => onVolume(k, Number(e.target.value))} className="w-24 accent-[#f2c230]" />
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className={head}>Game</div>
        <div className="flex flex-wrap items-center gap-4">
          <ShortCycles save={save} />
          {onAimMode && !touch && <AimModePicker value={aimMode || "assisted"} onChange={onAimMode} />}
        </div>
      </div>
      {extra}
      {showTouch && <TouchSettings />}
    </>
  );
}