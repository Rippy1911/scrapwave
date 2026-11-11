// Brokeway (round 15): the broken freeway over the drowned city, in the rain. From the start: the upper deck with
// its first gap to jump, the long bend, a second gap, then down the spiral interchange (a turn and a half) to the
// lower road just above the water, through the tunnel under a fallen tower, and the long climb back up.
// Fall off and you are put back on the road. Landmark: the Spiral.
import { createRaceLayout } from "@/game/maps/race/raceLayout";
import { roundCorners, arcVerts } from "@/game/maps/race/trackPath";
import { createCity } from "@/game/maps/race/city";
import { tunnel, pillars } from "@/game/maps/race/roadside";

const TOP = 16, LOW = 4, SP = { x: 150, z: 145, R: 45 };
const U = { w: 16, zone: "upper", y: TOP }, LO = { w: 14, zone: "lower", y: LOW };
// A gap in the deck at (x, z) going along +x (dir 1) or -x (dir -1): 40 m of ramp up, 24 m of air, a lower landing.
const jump = (x, z, dir) => [[x, z, U], [x + 40 * dir, z, { ...U, y: TOP + 5, gap: true }], [x + 64 * dir, z, { ...U, y: TOP + 2 }], [x + 110 * dir, z, U]];
const VERTS = [
  [-500, -250, U], [-250, -250, U], ...jump(-160, -250, 1), [250, -250, U],
  [660, -250, { ...U, r: 160 }], [660, 100, { ...U, r: 140 }], ...jump(400, 100, -1), [220, 100, U],
  ...arcVerts(SP.x, SP.z, SP.R, 180, 720, { w: 13, zone: "spiral" }, TOP, LOW),
  [240, 190, LO], [380, 190, { ...LO, r: 60 }], [380, 330, { ...LO, r: 70 }], [210, 330, { ...LO, w: 12, zone: "tunnel" }], [-90, 330, LO],
  [-700, 330, { ...LO, r: 90, zone: "climb" }], [-700, 220, { ...LO, zone: "climb" }], [-700, -120, U], [-700, -250, { ...U, r: 100 }],
];

function build() {
  const B = createRaceLayout({ track: { points: roundCorners(VERTS), width: 16 }, floor: "concrete", outer: "concrete", tint: "#3d4a4c", facade: "ruin",
    water: 2.2, fall: 3, sky: { hour: 16.5, weather: "rain" }, lapTime: 150, margin: 130, landmark: { name: "The Spiral", x: SP.x, z: SP.z } });
  for (const z of ["upper", "climb", "lower"]) pillars(B, z, 30, "concrete");
  // The spiral: a core column, a spoke under every eighth of a turn, a red light on top.
  B.post("concrete", SP.x, SP.z, 5, TOP + 14);
  B.lamp(SP.x, SP.z, TOP + 16, 2.4);
  B.zone("spiral", 35, (p) => {
    const a = Math.atan2(p.x - SP.x, p.z - SP.z);
    B.deco("concrete", SP.x + Math.sin(a) * SP.R * 0.5, SP.z + Math.cos(a) * SP.R * 0.5, 2, 1.4, SP.R, a, p.y - 2.3);
  });
  tunnel(B, "tunnel");
  B.zone("tunnel", 5000, (p) => { // the fallen tower lying across the lower road
    B.deco("concrete", p.x - 70, p.z + 6, 150, 30, 34, 0.12, LOW - 6, { rz: 0.1 });
    B.deco("dark", p.x - 70, p.z + 6, 152, 2, 36, 0.12, LOW + 24, { rz: 0.1 });
  });
  // Broken ends at the gaps: bent rebar and a warning light.
  B.zone("upper", 4, (p, side) => {
    if (!p.gap || B.samples[(B.samples.indexOf(p) + B.samples.length - 1) % B.samples.length].gap) return;
    for (const sd of [-1, 1]) { const [x, z] = side(sd * (p.w / 2 + 1)); B.post("rust", x, z, 0.3, 4, p.y, false); B.lamp(x, z, p.y + 4.3, 0.8); }
  });
  // The drowned city: towers standing in the water on both sides of every road.
  const city = createCity(B, { seed: 7 });
  city.fill([-840, -400, 820, 470], 58, (x, z, h) => (h < 0.16 ? "tower" : h < 0.4 ? "mid" : h < 0.62 ? "block" : h < 0.74 ? "slab" : null), -7);
  B.zone("lower", 150, (p, side) => { B.prop("crate", ...side(p.w / 2 - 1.6), 0, p.y); B.prop("barrel", ...side(-(p.w / 2 - 1.6), 30), 0, p.y); });
  B.zone(null, 450, (p) => B.power(p.x, p.z, p.y));
  B.zone("lower", 120, (p) => B.horde(p.x, p.z, p.y));
  B.zone("upper", 200, (p) => { if (!p.gap) B.horde(p.x, p.z, p.y); });
  return B.done();
}

export const BROKEWAY = {
  id: "brokeway", kind: "race", name: "Brokeway", landmark: "The Spiral", laps: 2, size: [1700, 1100], build,
  blurb: "The broken freeway over the drowned city: two gaps to jump, the spiral interchange, a tunnel and the lower road by the water.",
  tip: "Keep the speed up into the gaps: the ramps only carry a fast car across. Miss, and you start the run-up again.",
};