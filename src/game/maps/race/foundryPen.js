// Foundry Pen (round 15): a night lap of a walled city. From the start: the wide avenue, six tight downtown blocks
// (an alley and a shopping arcade cut two of them short), a tunnel, a ramp up onto the elevated rail line, down to
// the docks along the water, a second tunnel, then the long run under the prison wall back to the avenue.
// Landmark: the Pen's watchtower, red on top. Zombies walk the streets.
import { createRaceLayout } from "@/game/maps/race/raceLayout";
import { roundCorners } from "@/game/maps/race/trackPath";
import { createCity } from "@/game/maps/race/city";
import { tunnel, pillars } from "@/game/maps/race/roadside";
import { foundryYards } from "@/game/maps/race/foundryYards";

const K = 1.34, V = (x, z, o) => [x * K, z * K, o];
const A = { w: 18, zone: "avenue" }, D = { w: 12, zone: "downtown" }, CUT = { ...D, cut: true };
const VERTS = [
  V(-200, 300, A), V(60, 300, A), V(200, 300, { ...D, r: 55 }),
  V(200, 180, { ...CUT, r: 26, open: true }), V(170, 180, CUT), V(120, 180, { ...CUT, r: 26 }), V(120, 100, { ...CUT, r: 26 }),
  V(186, 100, { ...CUT, open: true }), V(214, 100, D), V(260, 100, { ...D, r: 26 }),
  V(260, 0, { ...CUT, r: 26, open: true }), V(230, 0, CUT), V(160, 0, { ...CUT, r: 26 }), V(160, -80, { ...CUT, r: 26 }),
  V(246, -80, { ...CUT, open: true }), V(274, -80, D),
  V(330, -80, { w: 12, zone: "tunnel1", r: 30 }), V(330, -215, { w: 12, zone: "uptown" }), V(330, -260, { w: 12, zone: "uptown", r: 50 }),
  V(250, -260, { w: 11, zone: "rail" }), V(170, -260, { w: 11, zone: "rail", y: 9 }), V(-120, -260, { w: 11, zone: "rail", y: 9 }),
  V(-200, -260, { w: 14, zone: "docks" }), V(-460, -260, { w: 14, zone: "docks", r: 50 }),
  V(-460, -40, { w: 12, zone: "tunnel2", r: 40 }), V(-300, -40, { w: 14, zone: "prison", r: 30 }), V(-300, 300, { ...A, r: 50 }),
];

function build() {
  const B = createRaceLayout({ track: { points: roundCorners(VERTS), width: 14 }, floor: "concrete", outer: "rock", tint: "#2c2f36", facade: "night",
    sky: { hour: 23.5, weather: "clear" }, zombies: true, lapTime: 150, landmark: { name: "The Pen", x: -352 * K, z: 130 * K } });
  const keep = [];
  for (let z = 100; z <= 180; z += 8) keep.push({ x: 200 * K, z: z * K, r: 9 });
  for (let z = -80; z <= 0; z += 8) keep.push({ x: 260 * K, z: z * K, r: 13 });
  const city = createCity(B, { keep, seed: 3 });
  foundryYards(B, city, K);

  city.street("avenue", { l: ["tower", "mid", "slab"], r: ["mid", "block", "tower"] }, 5);
  city.street("downtown", { l: ["shop", "low", "block"], r: ["shop", "low", "block"] }, 3);
  city.street("uptown", { l: ["mid", "block"], r: ["mid", "block"] }, 4);
  city.street("rail", { l: ["mid", "block"], r: ["block", "slab"] }, 8);
  city.street("docks", { l: ["shed", "low"], r: null }, 5);
  city.street("prison", { l: ["block", "low", "shop"], r: null }, 4);
  const pen = (x, z) => x > -415 * K && x < -300 * K && z > -30 * K && z < 295 * K; // inside the prison wall
  const dry = (x, z) => !(x < -478 * K || (z < -278 * K && x < -190 * K) || pen(x, z));
  city.fill([-470 * K, -330 * K, 400 * K, 380 * K], 46, (x, z, h) => (!dry(x, z) ? null : h < 0.14 ? "spire" : h < 0.34 ? "tower" : h < 0.6 ? "mid" : h < 0.85 ? "block" : null));
  for (const z of ["avenue", "downtown", "uptown", "docks", "prison"]) city.lamps(z, z === "avenue" ? 36 : 48);

  tunnel(B, "tunnel1");
  tunnel(B, "tunnel2");
  pillars(B, "rail", 26);
  B.zone("rail", 52, (p, side) => { // gantries over the line
    if (p.y < 8.5) return;
    for (const sd of [-1, 1]) { const [x, z] = side(sd * (p.w / 2 + 1.2)); B.bit("dark", x, p.y + 3.5, z, 0.3, 7, 0.3); }
    B.bit("dark", p.x, p.y + 7, p.z, p.w + 2.8, 0.4, 0.4, p.r);
    B.bit("lit:#ff3a20", p.x, p.y + 6.6, p.z, 0.5, 0.4, 0.3, p.r);
  });

  B.zone("avenue", 80, (p, side) => { B.horde(...side(4)); B.horde(...side(-5, 30)); });
  B.zone("downtown", 60, (p) => B.horde(p.x, p.z));
  B.zone("docks", 110, (p, side) => B.horde(...side(-3)));
  B.zone("prison", 100, (p, side) => B.horde(...side(-4)));
  B.zone(null, 430, (p) => B.power(p.x, p.z, p.y));
  B.zone("avenue", 120, (p, side) => { const [x, z] = side(p.w / 2 - 1.4, 20); B.prop("barrel", x, z); B.prop("crate", x + 1.2, z + 0.9); });
  B.zone("docks", 70, (p, side) => { const [x, z] = side(-(p.w / 2 - 1.5), 12); B.prop("crate", x, z); B.prop("crate", x + 1.3, z - 0.4); });
  return B.done();
}

export const FOUNDRY_PEN = {
  id: "foundry", kind: "race", name: "Foundry Pen", landmark: "The Pen", laps: 2, size: [1300, 1000], build,
  blurb: "A night lap of the walled city: the avenue, tight downtown blocks, the elevated rail, the docks and the prison wall.",
  tip: "The alley and the shopping arcade downtown each cut a block off the lap. Smash through the fences and the glass.",
};