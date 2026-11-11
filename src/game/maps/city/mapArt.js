// Brasswater City's picture for the map card, the loading screen and the minimap: the street grid, the districts,
// every building shaded by height, the rooftop routes in amber. Painted once into an offscreen canvas (one pixel is
// about 2.2 m) and then just drawn scaled. The caller has set the transform: one unit one metre, origin the centre.
import { CITY, ZONES, RUNWAY, hw } from "@/game/maps/city/plan";

const SIZE = 640, cache = new WeakMap();

function paint(plan) {
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) return null;
  c.width = c.height = SIZE;
  const g = c.getContext("2d"), s = SIZE / (2 * CITY.R);
  g.translate(SIZE / 2, SIZE / 2); g.scale(s, s);
  const rect = (col, x0, x1, z0, z1) => { g.fillStyle = col; g.fillRect(x0, z0, x1 - x0, z1 - z0); };
  g.fillStyle = "#4a4338"; g.beginPath(); g.arc(0, 0, CITY.R, 0, 7); g.fill(); // verge
  g.fillStyle = "#33322f"; g.beginPath(); g.arc(0, 0, CITY.INNER, 0, 7); g.fill(); // block interiors
  for (const l of plan.lawns) rect("#46703a", l.x0, l.x1, l.z0, l.z1);
  // roads: avenues and streets
  for (let k = -CITY.LINES; k <= CITY.LINES; k++) {
    const x = k * CITY.G, w = hw(k) * 2, reach = Math.sqrt(CITY.RING0 * CITY.RING0 - x * x);
    rect(hw(k) > 10 ? "#8a8578" : "#6c6a63", x - w / 2, x + w / 2, -reach, reach);
    rect(hw(k) > 10 ? "#8a8578" : "#6c6a63", -reach, reach, x - w / 2, x + w / 2);
  }
  g.strokeStyle = "#5d5b56"; g.lineWidth = CITY.RING1 - CITY.RING0; g.beginPath(); g.arc(0, 0, (CITY.RING0 + CITY.RING1) / 2, 0, 7); g.stroke();
  const A = ZONES.airfield, H = ZONES.harbour, S = ZONES.stadium;
  rect("#4a7a40", A.x0, A.x1, A.z0, A.z1); rect("#2c2c2e", RUNWAY.cx - RUNWAY.hl, RUNWAY.cx + RUNWAY.hl, RUNWAY.cz - RUNWAY.hw, RUNWAY.cz + RUNWAY.hw);
  rect("#8b8678", -200, 260, -476, -410);
  rect("#8b8678", H.x0, H.x1, 400, 472); rect("#1e4d63", H.x0, H.x1, 472, H.z1);
  for (const [x0, x1] of [[-262, -228], [-132, -98], [-2, 32]]) rect("#8b8678", x0, x1, 472, 580);
  g.fillStyle = "#8b8678"; g.beginPath(); g.arc(S.cx, S.cz, S.r, 0, 7); g.fill();
  g.fillStyle = "#4a7a40"; g.beginPath(); g.arc(S.cx, S.cz, 62, 0, 7); g.fill();
  g.fillStyle = "#1e4d63"; g.beginPath(); g.arc(-250, -50, 22, 0, 7); g.fill();
  rect("#9c9486", -100, 100, -100, 100);
  for (const b of [...plan.buildings].sort((p, q) => p.h - q.h)) { // lighter is taller
    const t = Math.min(1, b.h / 170);
    g.fillStyle = b.route ? "#d89c1c" : `rgb(${Math.round(82 + t * 150)},${Math.round(76 + t * 130)},${Math.round(68 + t * 100)})`;
    g.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
  }
  rect("#c9a24a", -14, 14, -14, 14); // the Needle's base
  return c;
}

export function drawCity(ctx, L, o = {}) {
  if (!L.plan) return;
  let img = cache.get(L.plan);
  if (img === undefined) { img = paint(L.plan); cache.set(L.plan, img); }
  if (img) ctx.drawImage(img, -CITY.R, -CITY.R, 2 * CITY.R, 2 * CITY.R);
  void o;
}
