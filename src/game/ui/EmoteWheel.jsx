import { useEffect } from "react";
import { EMOTES } from "@/game/net/emotes";

const POS = ["top-0 left-1/2 -translate-x-1/2", "right-0 top-1/2 -translate-y-1/2", "bottom-0 left-1/2 -translate-x-1/2", "left-0 top-1/2 -translate-y-1/2"];

// T opens it; click or press 1-4 to emote, T or Esc to close.
export default function EmoteWheel({ onPick, onClose }) {
  useEffect(() => {
    const k = (e) => {
      const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
      if (n >= 0) onPick(n);
      else if (e.code === "Escape" || e.code === "KeyT") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onPick, onClose]);
  return (
    <div className="fixed inset-0 flex items-center justify-center sw-body" onClick={onClose}>
      <div className="relative h-64 w-64 rounded-full border-2 border-[#57503f] bg-[rgba(18,14,10,0.7)]">
        {EMOTES.map((t, i) => (
          <button key={t} onClick={(e) => { e.stopPropagation(); onPick(i); }} className={`absolute sw-btn px-3 py-2 text-xs ${POS[i]}`}>
            <span className="mr-1 text-[#a8987f]">{i + 1}</span>{t}
          </button>
        ))}
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-[0.3em] text-[#a8987f]">Emote</div>
      </div>
    </div>
  );
}