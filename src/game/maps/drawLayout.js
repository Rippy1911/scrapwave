// Top-down drawings on a 2D canvas: a world map's layout (map cards, the loading screen, the minimap) and the
// Saltreach for free-roam cards. The caller sets the transform: one unit = one metre, +x right, +z down (north up),
// origin at the map centre. Higher ground is drawn lighter, ramps amber, the landmark as a red-ringed star.
import { ROADS, PLACES } from "@/game/data/places";
import { layoutOf } from "@/game/maps/catalog";
import { drawRaceLayout } from "@/game/maps/race/drawRace";

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const shade = (top) => { const t = Math.max(0, Math.min(1, top / 12)); return `rgb(${lerp(78, 214, t)},${lerp(64, 190, t)},${lerp(48, 150, t)})`; };

export function drawLayout(ctx, L, o = {}) {
  if (!L) return;
  if (L.track) return drawRaceLayout(ctx, L, o); // a race world: maps/race/drawRace.js
  ctx.fillStyle = L.tint; ctx.beginPath(); ctx.arc(0, 0, L.R, 0, 7); ctx.fill();
  if (L.paint) L.paint(ctx, L, o); // a map that paints its own picture (the city's street grid)
  const list = (L.paint ? [] : L.pieces).filter((p) => p.t !== "lamp" && p.y < 30).sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const p of list) {
    ctx.save(); ctx.translate(p.x, p.z); ctx.rotate(-p.r);
    ctx.globalAlpha = p.t === "deco" ? 0.55 : 1;
    ctx.fillStyle = p.t === "ramp" ? "#d89c1c" : shade(p.y + p.h);
    if (p.t === "cyl" && !p.rx && !p.rz) { ctx.beginPath(); ctx.arc(0, 0, Math.max(p.w / 2, 0.8), 0, 7); ctx.fill(); }
    else if (p.t === "cyl") ctx.fillRect(-p.h / 2, -p.d / 2, p.h, p.d);
    else ctx.fillRect(-p.w / 2, -p.d / 2, p.w, p.d);
    if (p.t === "ramp" && !o.mini) { ctx.fillStyle = "#3a2a10"; ctx.beginPath(); ctx.moveTo(0, -p.d * 0.4); ctx.lineTo(p.w * 0.3, p.d * 0.1); ctx.lineTo(-p.w * 0.3, p.d * 0.1); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#1b1712"; ctx.lineWidth = Math.max(3, L.R * 0.025); ctx.beginPath(); ctx.arc(0, 0, L.R + 1, 0, 7); ctx.stroke();
  if (L.landmark) star(ctx, L.landmark.x, L.landmark.z, L.R * (o.mini ? 0.04 : 0.06));
}

function star(ctx, x, z, r) {
  ctx.fillStyle = "#ff3a20"; ctx.beginPath(); ctx.arc(x, z, r * 1.3, 0, 7); ctx.fill();
  ctx.fillStyle = "#f2c230"; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, k = i % 2 ? 0.45 : 1; ctx.lineTo(x + Math.cos(a) * r * k, z + Math.sin(a) * r * k); }
  ctx.fill();
}

// The loaded world map on the minimap, in world coordinates.
export function drawWorldMap(ctx, wm) {
  ctx.save(); ctx.translate(wm.x, wm.z); drawLayout(ctx, layoutOf(wm.id), { mini: true }); ctx.restore();
}

// The Saltreach: sand, roads, places (safe ones green).
export function drawRoam(ctx) {
  ctx.fillStyle = "#8a7356"; ctx.fillRect(-600, -600, 1200, 1200);
  ctx.lineCap = "round";
  for (const r of ROADS) {
    ctx.strokeStyle = r.kind === "highway" ? "#e3d6bd" : r.kind === "rail" ? "#4d4236" : "#b8a684";
    ctx.lineWidth = r.kind === "highway" ? 14 : 9;
    ctx.beginPath(); r.pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z))); ctx.stroke();
  }
  for (const p of PLACES) { ctx.fillStyle = p.safe ? "rgba(127,224,160,0.75)" : "rgba(242,194,48,0.55)"; ctx.beginPath(); ctx.arc(p.x, p.z, p.r, 0, 7); ctx.fill(); }
}