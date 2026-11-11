import { useEffect, useRef } from "react";
import EmblemPreview from "@/game/ui/profile/EmblemPreview";

// Rank-up toast: small, near the top, never takes input or pauses play, and clears itself after a few seconds.
// (The first version was a centred panel with a Continue button that pointer lock made unclickable mid-game.)
export const RANK_UP_MS = 3500;

export default function RankUpPopup({ data, onDone }) {
  const done = useRef(onDone);
  done.current = onDone; // GameRoot passes a new arrow every render; keep the timer keyed on the data only
  useEffect(() => {
    if (!data) return undefined;
    const t = setTimeout(() => done.current && done.current(), RANK_UP_MS);
    return () => clearTimeout(t);
  }, [data]);
  if (!data) return null;
  return (
    <div className="fixed inset-x-0 top-24 z-30 flex justify-center pointer-events-none" role="status" aria-live="polite">
      <div className="sw-panel px-4 py-2 sw-slide flex items-center gap-3 max-w-sm">
        <EmblemPreview avatar={data.avatar} size={32} />
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#a8987f]">Rank up · {data.kind === "overall" ? "Overall fame" : `${data.track} track`}</p>
          <p className="sw-display text-lg text-[#f2c230] leading-tight">{data.label}</p>
        </div>
      </div>
    </div>
  );
}
