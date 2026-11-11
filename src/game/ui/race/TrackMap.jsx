import { useEffect, useRef } from "react";

const SIZE = 190, PAD = 12;

// The whole lap from above, north up: the road (gaps left open), the start line, every checkpoint with the next one
// lit, the other cars, the ghost of the best lap and you. The road is drawn once per track and kept.
export default function TrackMap({ race, x, z }) {
  const ref = useRef(null), base = useRef({ id: null, canvas: null });
  useEffect(() => {
    const c = ref.current, m = race && race.map;
    if (!c || !m) return;
    const B = m.bounds, k = (SIZE - PAD * 2) / Math.max(B.x1 - B.x0, B.z1 - B.z0, 1);
    const X = (wx) => SIZE / 2 + (wx - (B.x0 + B.x1) / 2) * k, Y = (wz) => SIZE / 2 + (wz - (B.z0 + B.z1) / 2) * k;
    const tick = (g, p, color, width) => {
      g.strokeStyle = color; g.lineWidth = width;
      const h = Math.max(5, (p.w / 2) * k + 3);
      g.beginPath(); g.moveTo(X(p.x) - p.nx * h, Y(p.z) - p.nz * h); g.lineTo(X(p.x) + p.nx * h, Y(p.z) + p.nz * h); g.stroke();
    };
    if (base.current.id !== m.id) {
      const b = document.createElement("canvas");
      b.width = b.height = SIZE;
      const g = b.getContext("2d"), pts = m.closed ? [...m.pts, m.pts[0]] : m.pts;
      g.lineCap = "round"; g.lineJoin = "round";
      for (const [color, extra] of [["#14110d", 4], ["#a8987f", 0]]) {
        g.strokeStyle = color; g.lineWidth = Math.max(3, m.pts[0][3] * k) + extra;
        g.beginPath();
        let pen = false;
        for (const p of pts) { if (p[2]) { pen = false; continue; } if (pen) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); pen = true; }
        g.stroke();
      }
      m.cps.forEach((p, i) => tick(g, p, i ? "#6b5a2a" : "#f4efe2", i ? 2 : 3));
      base.current = { id: m.id, canvas: b };
    }
    const g = c.getContext("2d");
    g.clearRect(0, 0, SIZE, SIZE);
    g.fillStyle = "rgba(42,30,20,0.82)"; g.fillRect(0, 0, SIZE, SIZE);
    g.drawImage(base.current.canvas, 0, 0);
    if (race.next >= 0 && m.cps[race.next]) tick(g, m.cps[race.next], "#f2c230", 4);
    const dot = (p, r, fill, ring) => { g.beginPath(); g.arc(X(p.x), Y(p.z), r, 0, 7); g.fillStyle = fill; g.fill(); if (ring) { g.strokeStyle = ring; g.lineWidth = 2; g.stroke(); } };
    for (const p of race.cars) dot(p, 3.5, "#ff9a5a");
    if (race.ghost) dot(race.ghost, 3.5, "rgba(159,216,255,0.85)");
    dot({ x, z }, 4.5, "#ffffff", "#f2c230");
  });
  if (!race) return null;
  return <canvas ref={ref} width={SIZE} height={SIZE} className="rounded-sm border-2 border-[#46413a] shadow-lg" />;
}