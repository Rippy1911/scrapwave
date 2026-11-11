import { useEffect } from "react";

// Menu buttons click (round 14): one listener for every .sw-btn. Silent until the sample pack has loaded.
export default function useUiClicks(gameRef) {
  useEffect(() => {
    const onClick = (e) => {
      const g = gameRef.current;
      if (g && e.target.closest && e.target.closest(".sw-btn")) g.game.audio.sample("ui_click", null, 0.5);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [gameRef]);
}