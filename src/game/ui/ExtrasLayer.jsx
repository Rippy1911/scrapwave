import { useEffect } from "react";
import PhotoBar from "@/game/ui/PhotoBar";
import FeedbackCard from "@/game/ui/feedback/FeedbackCard";
import { useFeedbackPrompt } from "@/game/ui/feedback/useFeedbackPrompt";

// Round 13 overlays: photo mode (phase "photo") and the feedback card.
export default function ExtrasLayer({ game, phase, hud, touch }) {
  useEffect(() => { if (game) game.photo.set(phase === "photo"); }, [game, phase]);
  const fb = useFeedbackPrompt(phase, !!(hud && hud.safe), touch);
  return (
    <>
      {phase === "photo" && game && <PhotoBar photo={game.photo} onExit={() => game.emit({ type: "photo" })} />}
      {fb.show && <FeedbackCard context={fb.context} touch={touch} onDone={fb.close} />}
      {fb.waiting && <div className="pointer-events-none fixed bottom-28 right-3 rounded-sm border border-[#57503f] bg-[#1b1712] px-2 py-1 sw-body text-[11px] uppercase tracking-[0.15em] text-[#c9a36a]">Got a minute? A feedback card is in the pause menu (Esc)</div>}
    </>
  );
}