import { useEffect, useRef } from "react";
import { ROADS, PLACES } from "@/game/data/places";
import { FACTIONS } from "@/game/factions/roster";

const SIZE = 520;
// World extent from every road and place, padded a little.
const xs = [...ROADS.flatMap((r) => r.pts.map((p) => p[0])), ...PLACES.map((p) => p.x)];
const zs = [...ROADS.flatMap((r) => r.pts.map((p) => p[1])), ...PLACES.map((p) => p.z)];
const PAD = 150; // room for place names at the edges
const MIN_X = Math.min(...xs) - PAD, MIN_Z = Math.min(...zs) - PAD;
const SPAN = Math.max(Math.max(...xs) + PAD - MIN_X, Math.max(...zs) + PAD - MIN_Z);

// North-up world map: roads, places, faction territories and border points, and the player.
export default function WorldMap({ px, pz, yaw }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current.getContext("2d"), s = SIZE / SPAN;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#2a1e14"; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save(); ctx.scale(s, s); ctx.translate(-MIN_X, -MIN_Z); ctx.lineCap = "round";
    for (const f of FACTIONS) if (f.home) {
      ctx.fillStyle = f.color + "2e"; ctx.beginPath(); ctx.arc(f.home.x, f.home.z, 260, 0, 7); ctx.fill();
      ctx.fillStyle = f.color;
      for (const [bx, bz] of f.border || []) { ctx.beginPath(); ctx.arc(bx, bz, 14, 0, 7); ctx.fill(); }
    }
    for (const r of ROADS) {
      ctx.strokeStyle = r.kind === "highway" ? "#8a7a62" : r.kind === "rail" ? "#5a5148" : "#6e5a40";
      ctx.lineWidth = r.kind === "highway" ? 12 : 8;
      ctx.beginPath(); r.pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z))); ctx.stroke();
    }
    ctx.font = "bold 34px sans-serif"; ctx.textAlign = "center";
    for (const p of PLACES) {
      ctx.fillStyle = p.safe ? "rgba(127,224,160,0.4)" : "rgba(242,194,48,0.22)";
      ctx.beginPath(); ctx.arc(p.x, p.z, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = "#eadfc8"; ctx.fillText(p.name, p.x, p.z - p.r - 10);
    }
    ctx.translate(px, pz); ctx.rotate(yaw || 0);
    ctx.fillStyle = "#f2c230"; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(24, 28); ctx.lineTo(-24, 28); ctx.closePath(); ctx.fill();
    ctx.restore();
  }, [px, pz, yaw]);
  return <canvas ref={ref} width={SIZE} height={SIZE} className="w-full max-w-[520px] aspect-square border-2 border-[#46413a]" />;
}