import { useEffect, useState } from "react";
import { canAsk } from "@/game/ui/feedback/feedbackStore";

export const SAFE_WAIT = 35; // seconds resting inside a safe ring before the card is offered in the open world
const MENUS = new Set(["paused", "garage", "trader", "spawn", "map"]);
const MATCH = { arenaResults: "arena", results: "cycle" };

// When to show the feedback card. After a match it sits beside the results. In the open world it waits until you have
// rested 35 s in a safe ring, then shows on the next menu (the mouse is free there); on a touch screen it shows at once.
export function useFeedbackPrompt(phase, safe, touch) {
  const [ok, setOk] = useState(false);
  const [rested, setRested] = useState(false);
  useEffect(() => { setOk(canAsk()); }, []);
  useEffect(() => {
    if (!ok || rested || phase !== "playing" || !safe) return undefined;
    const t = setTimeout(() => setRested(true), SAFE_WAIT * 1000);
    return () => clearTimeout(t);
  }, [ok, rested, phase, safe]);
  const context = MATCH[phase] || (rested ? "safe_zone" : null);
  const open = !!MATCH[phase] || (rested && (MENUS.has(phase) || (touch && phase === "playing")));
  return {
    show: ok && !!context && open, context,
    waiting: ok && rested && !touch && phase === "playing", // desktop: a one-line pointer to the pause menu
    close: () => setOk(false),
  };
}