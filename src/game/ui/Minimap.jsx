import { useEffect, useRef } from "react";
import { ROADS, PLACES } from "@/game/data/places";
import { drawWorldMap } from "@/game/maps/drawLayout";

const SIZE = 180, RANGE = 320;

// Rotating minimap: roads, places, Rattlers, scrap.
export default function Minimap({ hud }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !hud) return;
    const ctx = c.getContext("2d");
    const s = SIZE / (RANGE * 2);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, 7); ctx.clip();
    ctx.fillStyle = "rgba(42,30,20,0.82)"; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(hud.yaw);
    ctx.scale(s, s);
    ctx.translate(-hud.x, -hud.z);
    ctx.lineCap = "round";
    const wm = hud.worldMap; // a world map is loaded: draw it instead of the Saltreach
    if (wm) drawWorldMap(ctx, wm);
    for (const r of wm ? [] : ROADS) {
      ctx.strokeStyle = r.kind === "highway" ? "#8a7a62" : r.kind === "rail" ? "#5a5148" : "#6e5a40";
      ctx.lineWidth = r.kind === "highway" ? 9 : 6;
      ctx.beginPath();
      r.pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
      ctx.stroke();
    }
    for (const p of wm ? [] : PLACES) {
      ctx.fillStyle = p.safe ? "rgba(127,224,160,0.35)" : "rgba(242,194,48,0.18)";
      ctx.beginPath(); ctx.arc(p.x, p.z, p.r, 0, 7); ctx.fill();
    }
    for (const p of (!wm && hud.plots) || []) {
      ctx.fillStyle = p.dark ? "rgba(60,50,44,0.6)" : p.mine ? "rgba(127,224,160,0.45)" : p.name ? "rgba(255,90,58,0.35)" : "rgba(242,194,48,0.14)";
      ctx.fillRect(p.x - 30, p.z - 30, 60, 60);
      ctx.strokeStyle = p.mine ? "#7fe0a0" : p.name ? p.paint || "#ff5a3a" : "#8a7a62"; ctx.lineWidth = 4;
      ctx.strokeRect(p.x - 30, p.z - 30, 60, 60);
      if (p.siphon) { ctx.strokeStyle = "#ff2a10"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(p.x, p.z, 40, 0, 7 * p.siphon.k); ctx.stroke(); }
    }
    if (hud.cycle && hud.cycle.storm && hud.stormR) { ctx.strokeStyle = "rgba(255,138,58,0.8)"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(300, -40, hud.stormR, 0, 7); ctx.stroke(); }
    const icon = (x, z, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, z - r); ctx.lineTo(x + r, z); ctx.lineTo(x, z + r); ctx.lineTo(x - r, z); ctx.closePath(); ctx.fill(); };
    for (const j of (hud.jobs && hud.jobs.active) || []) if (j.x != null) icon(j.x, j.z, "#9cc8ff", 14);
    if (hud.warlord) icon(hud.warlord.x, hud.warlord.z, "#ff2a10", 20);
    if (hud.convoy) icon(hud.convoy.x, hud.convoy.z, "#5fb4c6", 12);
    if (hud.alert) { ctx.strokeStyle = "#ff2a10"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(hud.alert.x, hud.alert.z, 30 + ((performance.now() / 8) % 60), 0, 7); ctx.stroke(); }
    for (const d of hud.dots) {
      ctx.fillStyle = d.t === "rattler" ? "#ff4a2a" : d.t === "scrap" ? "#f2c230" : d.t === "drifter" ? (d.pb ? "#ff2a8a" : "#5d8fd6") : d.t === "cisterner" ? "#5fb4c6" : d.t === "warlord" ? "#ff2a10" : "#9cc8ff";
      ctx.beginPath(); ctx.arc(d.x, d.z, d.t === "scrap" ? 5 : 8, 0, 7); ctx.fill();
      if (d.t === "drifter") { ctx.strokeStyle = d.pb ? "#ff3a20" : "#dfe9ff"; ctx.lineWidth = d.pb ? 5 : 3; ctx.stroke(); }
    }
    ctx.restore();
    // Owner names on claimed plots (drawn upright).
    ctx.font = "bold 10px Rajdhani, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const yc = Math.cos(hud.yaw), ys = Math.sin(hud.yaw);
    for (const p of (!hud.worldMap && hud.plots) || []) {
      if (!p.name) continue;
      const dx = (p.x - hud.x) * s, dz = (p.z - hud.z) * s, sx = SIZE / 2 + dx * yc - dz * ys, sy = SIZE / 2 + dx * ys + dz * yc;
      if (Math.hypot(sx - SIZE / 2, sy - SIZE / 2) > SIZE / 2 - 10) continue;
      const label = p.mine ? "YOU" : p.name.slice(0, 10);
      ctx.fillStyle = "#000"; ctx.fillText(label, sx + 1, sy - 13);
      ctx.fillStyle = p.mine ? "#7fe0a0" : "#ffd9c8"; ctx.fillText(label, sx, sy - 14);
    }
    ctx.fillStyle = "#f2e6c8";
    ctx.beginPath(); ctx.moveTo(SIZE / 2, SIZE / 2 - 8); ctx.lineTo(SIZE / 2 + 6, SIZE / 2 + 6); ctx.lineTo(SIZE / 2 - 6, SIZE / 2 + 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#57503f"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, 7); ctx.stroke();
    // north marker
    const a = hud.yaw - Math.PI / 2;
    ctx.fillStyle = "#f2c230"; ctx.font = "bold 13px Rajdhani, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", SIZE / 2 + Math.cos(a) * (SIZE / 2 - 12), SIZE / 2 + Math.sin(a) * (SIZE / 2 - 12));
  }, [hud]);
  return <canvas ref={ref} width={SIZE} height={SIZE} className="w-[140px] h-[140px] md:w-[180px] md:h-[180px]" />;
}