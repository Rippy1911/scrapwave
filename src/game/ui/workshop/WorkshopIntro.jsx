import { useEffect, useState } from "react";
import { local } from "@/game/core/safeStorage";

const KEY = "scrapwake.workshopIntro";
const STEPS = [
  ["Place parts", "Pick a chassis, cab, body, engine and tyres on the left. The turntable and the numbers change as you go. Wings are under the slots."],
  ["Free build", "Press Free build to put blocks, weapons and plates anywhere on a grid. Tap a part, then tap the grid. Rotate, mirror, undo and redo are on the toolbar."],
  ["Joints and a Transform Core", "In Free build, add a joint between two parts so it can swing, then add a Transform Core and legs: T folds the machine between Drive and Walker. Save joint positions as poses on keys 1 to 6."],
  ["Start from a showcase", "Not sure where to begin? Pick a Showcase design below, change what you like, and press Build. Parts cost scrap as usual."],
];

// First-time card for the Workshop. Shown once; "How it works" brings it back.
export default function WorkshopIntro({ force, onClose }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = !!local.get(KEY); } catch { seen = false; }
    if (!seen || force) setShow(true);
  }, [force]);
  if (!show) return null;
  const close = () => {
    try { local.set(KEY, "1"); } catch { /* private mode: the card just shows again next time */ }
    setShow(false);
    if (onClose) onClose();
  };
  return (
    <div className="rounded-sm border-2 border-[#8a6a1e] bg-[rgba(58,49,34,0.6)] p-4" role="note" aria-label="How the Workshop works">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="sw-display text-lg text-[#f2c230]">FIRST TIME IN THE WORKSHOP?</div>
        <button type="button" onClick={close} className="sw-btn min-h-[40px] px-4 py-1 text-xs">Got it</button>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="text-sm leading-snug text-[#e9dcc4]">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c9a36a]">{i + 1}. {title}</div>
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}