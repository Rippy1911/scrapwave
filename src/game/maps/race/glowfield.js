// Glowfield (round 15): a long, fast loop over the glowing flats at dusk. From the start: past the first gas
// station, under two rusted overpasses, a weave between bomb craters, the sweep round the cracked reactor dome,
// the second gas station, two more overpasses and the last craters before the line.
// Landmark: the reactor dome, split open and lit green from inside.
import { createRaceLayout } from "@/game/maps/race/raceLayout";
import { roundCorners } from "@/game/maps/race/trackPath";
import { overpass, gasStation } from "@/game/maps/race/roadside";

const K = 1.22, V = (x, z, o) => [x * K, z * K, { w: 16, ...o }];
const GLOW = "lit:#7dff6a", DOME = { x: 140 * K, z: -262 * K, R: 60 };
const VERTS = [
  V(-450, 400, { zone: "start" }), V(150, 400, { zone: "pumps" }), V(600, 380, { r: 160, zone: "flats" }), V(640, 60, { r: 120, zone: "over" }),
  V(420, -60, { r: 90, zone: "craters" }), V(520, -300, { r: 110, zone: "craters" }), V(300, -420, { r: 120, zone: "dome" }), V(0, -330, { r: 140, zone: "dome" }),
  V(-260, -420, { r: 110, zone: "flats" }), V(-560, -330, { r: 120, zone: "flats" }), V(-592, -222, { zone: "pumps" }), V(-640, -60, { r: 130, zone: "over" }),
  V(-430, 60, { r: 80, zone: "craters" }), V(-600, 250, { r: 90, zone: "flats" }), V(-600, 400, { r: 80, zone: "start" }),
];

// A bomb crater: a broken rim of rock, a scorched floor and a glowing pool.
function crater(B, x, z, rad) {
  B.rim("rock", x, z, rad, Math.max(7, Math.round(rad * 0.9)), rad * 0.16 + 0.8, rad * 0.3);
  B.disc("dark", x, z, rad * 0.86, 0.1, 0.02);
  B.disc(GLOW, x, z, rad * 0.34, 0.1, 0.1);
}

function dome(B) {
  const { x, z, R } = DOME;
  for (let lv = 0; lv < 7; lv++) { // rings of concrete closing in; a quarter of every ring is missing (the crack)
    const a0 = (lv * 12 * Math.PI) / 180, a1 = ((lv + 1) * 12 * Math.PI) / 180, r = R * Math.cos(a0), y = R * Math.sin(a0), h = R * (Math.sin(a1) - Math.sin(a0)) + 0.6;
    const n = Math.max(8, Math.round(r / 3.4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (a > 0.5 + lv * 0.05 && a < 1.7 - lv * 0.09) continue;
      (lv ? B.deco : B.solid)("concrete", x + Math.sin(a) * r, z + Math.cos(a) * r, (2 * Math.PI * r) / n + 0.5, h, 3, a, y);
    }
  }
  B.post("concrete", x, z, 9, 30);
  B.disc(GLOW, x, z, 30, 0.3, 0.2);
  for (const [dx, dz, y] of [[0, 0, 31], [14, 10, 8], [-12, 16, 12], [8, -15, 16]]) B.lamp(x + dx, z + dz, y, 4, GLOW);
  for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; B.post("dark", x + Math.sin(a) * (R + 26), z + Math.cos(a) * (R + 26), 2.6, 44); }
}

function build() {
  const B = createRaceLayout({ track: { points: roundCorners(VERTS), width: 16 }, floor: "sand", outer: "sand", tint: "#6f6a48", facade: "ruin",
    sky: { hour: 19.3, weather: "dust" }, lapTime: 150, margin: 140, landmark: { name: "The Reactor", x: DOME.x, z: DOME.z } });
  dome(B);
  let k = 0;
  B.zone("craters", 95, (p, side) => { const sd = k++ % 2 ? 1 : -1, rad = 9 + (k % 3) * 4; crater(B, ...side(sd * (p.w / 2 + rad + 7)), rad); });
  for (const [x, z, rad] of [[100, 100, 40], [-150, -100, 30], [250, 150, 26], [-250, 180, 34], [330, -200, 22], [-380, -250, 28], [0, 250, 20]]) crater(B, x * K, z * K, rad);
  B.zone("over", 170, (p, side) => overpass(B, p, side));
  let g = 0;
  B.zone("pumps", 5000, (p, side) => {
    const sd = g++ % 2 ? 1 : -1, q = B.samples[(B.samples.indexOf(p) + 20) % B.samples.length]; // 80 m into the stretch
    gasStation(B, q, (d, f = 0) => [q.x + q.nx * d + q.tx * f, q.z + q.nz * d + q.tz * f], sd, GLOW);
  });
  B.zone("flats", 130, (p, side) => { // marker posts with a glowing cap, wrecked drums
    const [x, z] = side(p.w / 2 + 3);
    B.post("rust", x, z, 0.25, 3.2, 0, false); B.lamp(x, z, 3.4, 0.5, GLOW);
    B.prop("barrel", ...side(-(p.w / 2 - 1.6), 40));
  });
  B.zone(null, 470, (p) => B.power(p.x, p.z, p.y));
  B.zone(null, 260, (p, side) => B.horde(...side(p.w / 2 + 10)));
  return B.done();
}

export const GLOWFIELD = {
  id: "glowfield", kind: "race", name: "Glowfield", landmark: "The Reactor", laps: 2, size: [1900, 1300], build,
  blurb: "A long, fast loop over the glowing flats: bomb craters, two gas stations, rusted overpasses and the cracked reactor dome.",
  tip: "The green light is the reactor: the long sweep round it is flat out. Brake for the craters after the overpasses.",
};