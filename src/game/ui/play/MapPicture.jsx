import { useEffect, useRef } from "react";
import { layoutOf, mapById } from "@/game/maps/catalog";
import { drawLayout, drawRoam } from "@/game/maps/drawLayout";

// A map's picture for its card and the loading screen: the world map's layout from above, the Saltreach's roads and
// places for free roam, or the old fenced ring for the legacy maps.
export default function MapPicture({ id, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d"), W = c.width, H = c.height, m = mapById(id), L = layoutOf(id);
    ctx.fillStyle = "#1b1712"; ctx.fillRect(0, 0, W, H);
    if (m && m.draw) { m.draw(ctx, W, H); return; } // a map that draws its own picture (the Ashmark's biomes)
    ctx.save(); ctx.translate(W / 2, H / 2);
    if (L) { const s = (H * 0.46) / L.R; ctx.scale(s, s); drawLayout(ctx, L); }
    else if (m && m.kind === "roam") { const s = H / 1200; ctx.scale(s, s); drawRoam(ctx); }
    else { ctx.strokeStyle = "#8a6a1e"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, H * 0.36, 0, 7); ctx.stroke(); }
    ctx.restore();
  }, [id]);
  return <canvas ref={ref} width={320} height={180} className={`block h-auto w-full rounded-sm border border-[#3a362f] ${className}`} />;
}