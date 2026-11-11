// Crater Town (round 15): a 340 m ruined town in a meteor crater, late afternoon. Streets in a grid around a plaza;
// four flat roofs in the north-east are joined by plank bridges (a rooftop route, ramps up from two streets). A
// clear ring road runs between the town and the crater rim, and the 6 m rim itself is the high outer route, with
// ramps up all round. Small impact craters and wrecks give cover on the ring road.
// Landmark: the Water Tower in the plaza, 53 m to the tip of its mast, lit red.
import { createLayout, D2R } from "@/game/maps/layout";

const RIM = 6, ROOF = 5, G = 33; // rim height, rooftop height, street grid step
const WALLS = ["#9a7a5a", "#8a6a4a", "#b08a62", "#7a6a5a"];
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5; return s - Math.floor(s); };
const roofs = (i, j) => i >= 1 && j <= -1; // the north-east rooftop cluster

function build() {
  const B = createLayout({ R: 170, floor: "sand", wall: "rock", tint: "#a8855c", sky: { hour: 16.8, weather: "clear" },
    landmark: { name: "The Water Tower", x: 0, z: 0 } });
  const { polar, pt } = B, P = (deg, r) => polar(deg * D2R, r);

  // Town blocks: a 5 x 5 grid without the plaza; ruins get a broken top storey.
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    if (!i && !j) continue;
    const x = i * G, z = j * G, k = hash(i, j), m = WALLS[(i + j + 4) % 4];
    if (roofs(i, j)) { B.solid(m, x, z, 18, ROOF, 18); if (j === -2) B.solid(m, x, z - 8.5, 18, 1, 1, 0, ROOF); continue; }
    const h = 4 + Math.round(k * 3) * 2, w = 14 + k * 4;
    B.solid(m, x, z, w, h, 18 - k * 4, k * 0.2);
    if (k > 0.45) B.deco(m, x + (k - 0.5) * 6, z, w * 0.55, 2.5, 8, k, h);
  }
  // The rooftop route: bridges between the four roofs, ramps up from the south and west streets, a parapet.
  for (const [x, z, w, d] of [[49.5, -33, 15.4, 6], [49.5, -66, 15.4, 6], [33, -49.5, 6, 15.4], [66, -49.5, 6, 15.4]]) B.solid("wood", x, z, w, 0.6, d, 0, ROOF - 0.6);
  B.ramp(33, -18, 8, 12, ROOF, 0, { m: "rust" });
  B.ramp(18, -66, 8, 12, ROOF, -Math.PI / 2, { m: "rust" });
  // The plaza: kickers into the open, broken walls for cover.
  for (const deg of [45, 225]) { const [x, z] = P(deg, 18); B.ramp(x, z, 7, 8, 2, deg * D2R - Math.PI / 2, { m: "rust", curve: 1.6 }); }
  for (const [x, z, r] of [[-14, 12, 0.3], [14, -12, 1.2], [-4, -17, 2.1]]) B.solid("concrete", x, z, 7, 2.2, 0.8, r);

  // The Water Tower: four legs and braces, the tank, its roof, the mast and the light.
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) B.post("rust", x, z, 0.7, 30);
  for (const y of [10, 20]) { B.deco("rust", 0, -5, 10, 0.4, 0.4, 0, y); B.deco("rust", 0, 5, 10, 0.4, 0.4, 0, y); B.deco("rust", -5, 0, 0.4, 0.4, 10, 0, y); B.deco("rust", 5, 0, 0.4, 0.4, 10, 0, y); }
  B.disc("rust", 0, 0, 8, 9, 30);
  B.disc("dark", 0, 0, 8.4, 0.6, 39);
  B.disc("corrugated", 0, 0, 5, 1.2, 39.6);
  B.post("dark", 0, 0, 0.3, 12, 40.8, false);
  B.lamp(0, 0, 53.4, 1.8);
  B.lamp(8.2, 0, 35, 0.8, "lamp"); B.lamp(-8.2, 0, 35, 0.8, "lamp");

  // The crater rim (r 146-168), ramps up from the ring road, and boulders on top.
  B.band("rock", 146, 168, RIM, 0, Math.PI * 2, 48);
  for (let k = 0; k < 8; k++) { const deg = k * 45 + 22.5, [x, z] = P(deg, 137); B.ramp(x, z, 10, 18, RIM, deg * D2R + Math.PI, { m: "rock" }); }
  for (let k = 0; k < 10; k++) { const deg = k * 36 + 5, [x, z] = P(deg, 158), s = 3 + hash(k, 9) * 3; B.solid("rock", x, z, s, s * 0.8, s, k, RIM); }
  // The ring road (r 110-137): impact craters (rings of low rock with gaps) and burnt-out cars.
  for (const deg of [36, 144, 252]) {
    const [cx, cz] = P(deg, 124);
    B.ring(8, 9, (a, x, z, w, i) => { if (i % 4 !== 1) B.solid("rock", cx + x, cz + z, w + 0.5, 1.4, 2.2, a); });
  }
  for (const [deg, r] of [[60, 118], [180, 126], [300, 120], [72, 132]]) {
    const [x, z] = P(deg, r), a = deg * D2R;
    B.solid("#3a3330", x, z, 2.2, 1.5, 4.6, a + 0.5); B.deco("rust", x, z, 1.9, 0.6, 2.4, a + 0.5, 1.5);
  }

  for (let i = 0; i < 10; i++) { const p = pt(i * 36 + 18, 124); B.spawn(p.x, p.z); }
  for (const [x, z, y] of [[0, -14], [49.5, -33, ROOF], [66, -66, ROOF], [-G / 2 - 0.5, G], [G * 1.5, G / 2]]) B.cp(x, z, y || 0);
  for (const [deg, r, y] of [[30, 157, RIM], [135, 157, RIM], [210, 124], [270, 157, RIM], [330, 124]]) { const p = pt(deg, r, y); B.cp(p.x, p.z, p.y); }
  for (const [x, z, y] of [[0, 16], [33, -49.5, ROOF], [-49.5, 0], [0, 49.5]]) B.power(x, z, y || 0);
  for (const deg of [60, 180, 300, 105]) { const p = pt(deg, 157, RIM); B.power(p.x, p.z, p.y); }
  for (const [x, z] of [[-49.5, -49.5], [49.5, 16.5], [-16.5, 49.5], [-49.5, 16.5], [16.5, 66]]) B.horde(x, z);
  for (const deg of [30, 100, 170, 260, 330]) { const p = pt(deg, 130); B.horde(p.x, p.z); }
  for (const [x, z] of [[-16.5, -40], [16.5, 40], [-40, 16.5], [49.5, -10], [-66, -16.5], [70, 16.5]]) { B.prop("barrel", x, z); B.prop("barrel", x + 1.2, z + 0.6); B.prop("crate", x - 1.5, z - 0.8); }
  for (const [x, z, r] of [[-20, 0, Math.PI / 2], [20, 0, Math.PI / 2], [0, 20, 0], [0, -20, 0]]) B.prop("fence", x, z, r);
  for (const deg of [22.5, 112.5, 202.5, 292.5]) { const [x, z] = P(deg + 5, 128); B.prop("sign", x, z, deg * D2R); }
  for (const [x, z] of [[-16.5, -16.5], [16.5, 16.5], [-16.5, 16.5], [-82, -82], [82, 82]]) B.prop("pole", x, z);
  return B.done();
}

export const CRATER_TOWN = {
  id: "crater-town", kind: "arena", name: "Crater Town", landmark: "The Water Tower", size: [340, 340], build,
  blurb: "A ruined town in a crater: tight streets, a rooftop route in the north-east, a ring road and the high crater rim.",
  tip: "The Water Tower stands in the plaza. Ramps from the ring road climb the rim; two streets ramp onto the roofs.",
};