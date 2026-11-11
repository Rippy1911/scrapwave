import { useCallback, useState } from "react";
import { isWorldMap, mapById } from "@/game/maps/catalog";

const MIN_MS = 1100;
const frames = (n) => new Promise((done) => { const f = () => (--n <= 0 ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); });

// Runs fn (which starts a match on a world map, so the map loader builds it) behind the loading screen: the screen
// paints first, the build runs, and the screen stays up at least MIN_MS so it reads as a step, not a flash.
// Any other map runs fn straight away.
export default function useMapLoading() {
  const [map, setMap] = useState(null);
  const run = useCallback(async (id, fn) => {
    if (!id || !isWorldMap(id)) return fn();
    const t0 = performance.now();
    setMap(mapById(id));
    await frames(2);
    try { return await fn(); } finally {
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - (performance.now() - t0))));
      setMap(null);
    }
  }, []);
  return { map, run };
}