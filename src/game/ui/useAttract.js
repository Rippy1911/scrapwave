import { useEffect } from "react";
import { urlScene } from "@/game/demo/urlScene";

let linked = false; // a ?demo= link starts its scene once per page load; Esc then returns to the title as usual

// Starts the title attract mode after `idleSec` seconds without input while `active` is true.
// ?demo=fly | hunt | base opens that one reel scene as soon as the title is up (window.scrapwake.demo, as the Demo reel button does).
export default function useAttract(active, start, idleSec) {
  useEffect(() => {
    if (!active) return undefined;
    if (!linked && urlScene() && window.scrapwake && window.scrapwake.demo) { linked = true; window.scrapwake.demo(true); return undefined; }
    let t = setTimeout(start, idleSec * 1000);
    const reset = () => { clearTimeout(t); t = setTimeout(start, idleSec * 1000); };
    const evs = ["mousemove", "keydown", "pointerdown", "wheel", "touchstart"];
    for (const e of evs) window.addEventListener(e, reset, { passive: true });
    return () => { clearTimeout(t); for (const e of evs) window.removeEventListener(e, reset); };
  }, [active, start, idleSec]);
}
