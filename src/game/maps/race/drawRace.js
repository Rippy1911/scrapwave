// A race world from above, for the map cards, the loading screen and the minimap: the ground, water, buildings
// (taller = lighter), the layout's bigger pieces, the road with its gaps left open, the start line and the landmark.
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

export function drawRaceLayout(ctx, L, o = {}) {
  const [hx, hz] = L.half;
  ctx.fillStyle = L.tint; ctx.fillRect(-hx, -hz, 2 * hx, 2 * hz);
  const box = (p, fill) => { ctx.save(); ctx.translate(p.x, p.z); ctx.rotate(-p.r); ctx.fillStyle = fill; ctx.fillRect(-p.w / 2, -p.d / 2, p.w, p.d); ctx.restore(); };
  for (const p of L.pieces) if (p.m === "water") box(p, "#26464d");
  if (L.water) { ctx.fillStyle = "rgba(38,70,77,0.85)"; ctx.fillRect(-hx, -hz, 2 * hx, 2 * hz); }
  if (!o.mini) for (const p of L.pieces) if (p.m !== "water" && p.t !== "lamp" && p.t !== "ramp" && p.w * p.d > 40 && p.w * p.d < 30000) box(p, "rgba(150,130,100,0.6)");
  for (const b of L.blds) { const t = Math.min(1, b.h / 70); box(b, `rgb(${lerp(70, 190, t)},${lerp(72, 180, t)},${lerp(78, 160, t)})`); }
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const pts = [...L.path, L.path[0]];
  for (const [color, extra] of [["#14110d", 10], ["#e3d6bd", 0]]) {
    ctx.strokeStyle = color; ctx.lineWidth = 16 + extra;
    ctx.beginPath();
    let pen = false;
    for (const p of pts) { if (p[2]) { pen = false; continue; } if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); pen = true; }
    ctx.stroke();
  }
  const a = L.path[0], b = L.path[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
  ctx.strokeStyle = "#f2c230"; ctx.lineWidth = 9; ctx.lineCap = "butt";
  ctx.beginPath(); ctx.moveTo(a[0] - nx * 22, a[1] - nz * 22); ctx.lineTo(a[0] + nx * 22, a[1] + nz * 22); ctx.stroke();
  if (L.landmark) {
    const r = L.R * (o.mini ? 0.03 : 0.045);
    ctx.fillStyle = "#ff3a20"; ctx.beginPath(); ctx.arc(L.landmark.x, L.landmark.z, r * 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = "#f2c230"; ctx.beginPath(); ctx.arc(L.landmark.x, L.landmark.z, r * 0.6, 0, 7); ctx.fill();
  }
}